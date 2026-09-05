/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6041 — `MetadataService` writes the relationship target under the
 * spec's spelling `reference`, never `referenceTo`.
 *
 * Surfaced by the key-level parity gate built for objectui#5761
 * (`scripts/check-designer-field-key-parity.mjs`). `FieldMetadataPayload` is
 * one of that gate's two `wire` shapes: `toFieldPayload` builds it and
 * `saveFields` PUTs `fields.map(toFieldPayload)` to
 * `PUT /api/v1/meta/object/:name`.
 *
 * `referenceTo` is not in `FieldSchema`'s accept set. Measured against the
 * installed `@objectstack/spec` 17.2.0, both at field level and through the
 * whole object document:
 *
 *   ObjectSchema.safeParse({ …, fields: { rel: { type: 'lookup', label: 'Owner',
 *                                               referenceTo: 'user' } } })
 *     => success = false
 *     => unrecognized_keys at ["fields","rel"] keys=["referenceTo"]
 *        "Did you mean `referenceTo` -> `reference`?"
 *
 * which the route returns as a hard 422 `INVALID_METADATA`. Because the key is
 * then STORED, every later save of that object fails the same way until it is
 * cleared by hand.
 *
 * ## Why the negative controls are the deliverable
 *
 * A green parity assertion proves nothing on its own: `FieldSchema` could be
 * resolved to a look-alike or loosened to a passthrough and every positive
 * assertion here would stay green while the 422 still happened server-side. So
 * the instrument is asserted first, and each positive claim is paired with a
 * control that must fail.
 *
 * Assertions are made on the bytes the SDK actually PUT — `JSON.parse` of the
 * captured request body — not on the object handed to the client. That
 * distinction is load-bearing for this key: a property whose value is
 * `undefined` is a key that zod's strict object COUNTS but that
 * `JSON.stringify` DROPS, so an in-memory assertion and a wire assertion
 * disagree exactly on the half-filled draft this card had to measure.
 */

import { describe, expect, it, vi } from 'vitest';
import { FieldSchema } from '@objectstack/spec/data';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import type { DesignerFieldDefinition } from '@object-ui/types';
import { MetadataService } from './MetadataService';

/** The bodies of every PUT the SDK issued, exactly as they went over the wire. */
function makeCapturingAdapter() {
  const puts: Array<Record<string, unknown>> = [];
  const adapter = new ObjectStackAdapter({
    baseUrl: 'http://test.local',
    fetch: vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? 'GET').toUpperCase() === 'PUT') {
        puts.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch,
  });
  return { adapter, puts };
}

/**
 * The field defs of the last PUT, in wire order.
 *
 * `fields` is a name-keyed MAP on the wire (objectui#6240 — `ObjectSchema`
 * refuses an array at the value level), and this file's subject is what is
 * INSIDE one field def, so it reads the map's values in insertion order, which
 * is the only field order the spec has. The CONTAINER shape is pinned by
 * `MetadataService.objectPayloadFieldsMap.test.ts`, deliberately not here.
 */
function savedFields(puts: Array<Record<string, unknown>>): Record<string, unknown>[] {
  const fields = puts[puts.length - 1].fields as Record<string, Record<string, unknown>>;
  return Object.values(fields);
}

const unrecognizedKeys = (result: ReturnType<typeof FieldSchema.safeParse>): string[] =>
  result.success
    ? []
    : result.error.issues
        .filter((i) => i.code === 'unrecognized_keys')
        .flatMap((i) => (i as unknown as { keys: string[] }).keys);

const LOOKUP: DesignerFieldDefinition = {
  id: 'owner_id',
  name: 'owner_id',
  label: 'Owner',
  type: 'lookup',
  referenceTo: 'account',
};

describe('the instrument', () => {
  it('is the installed spec schema and it is STRICT — unknown keys are refused, not stripped', () => {
    // objectstack#4001 closed the silent-drop shape. Every parity assertion
    // below depends on it: a stripping schema would make them all trivially
    // green while the 422 still happened server-side.
    const result = FieldSchema.safeParse({ type: 'text', label: 'L', zzzDefinitelyNotAKey: 1 });
    expect(result.success).toBe(false);
    expect(unrecognizedKeys(result)).toContain('zzzDefinitelyNotAKey');
  });

  it('refuses `referenceTo` by name and accepts `reference` — the two states this file distinguishes', () => {
    expect(unrecognizedKeys(FieldSchema.safeParse({ type: 'lookup', label: 'Owner', referenceTo: 'account' })))
      .toEqual(['referenceTo']);
    expect(FieldSchema.safeParse({ type: 'lookup', label: 'Owner', reference: 'account' }).success).toBe(true);
  });
});

describe('objectui#6041 · saveFields PUTs the relationship target as `reference`', () => {
  it('carries `reference` and no `referenceTo` on the wire', async () => {
    const { adapter, puts } = makeCapturingAdapter();

    await new MetadataService(adapter).saveFields('account', [LOOKUP]);

    const [def] = savedFields(puts);
    expect(def.reference).toBe('account');
    expect('referenceTo' in def).toBe(false);
  });

  it('the PUT body parses through the real FieldSchema', async () => {
    const { adapter, puts } = makeCapturingAdapter();

    await new MetadataService(adapter).saveFields('account', [LOOKUP]);

    const [def] = savedFields(puts);
    const result = FieldSchema.safeParse(def);
    expect(unrecognizedKeys(result)).toEqual([]);
    expect(result.success).toBe(true);
    // Falsification: the target actually made the trip. A payload that simply
    // dropped the key would also parse green, and that is not the fix.
    expect(def.reference).toBe('account');
  });

  it('a HALF-FILLED draft — type `lookup`, target left empty — is REFUSED before any PUT', async () => {
    // ⭐ This assertion is INVERTED from what it said at 17.2.0, and the
    // inversion is the point of objectui#7122's ruled item 4.
    //
    // It used to read "still saves, exactly as before". The spec's prose called
    // `reference` "Required for relationship types" while the zod parse did not
    // enforce it — `{ type: 'lookup', label: 'L' }` parsed green at field level
    // AND through `ObjectSchema` — so the designer was free to persist a
    // target-less draft, and did.
    //
    // `@objectstack/spec` 17.3.0 closes that declared-but-unenforced gap: the
    // same document is now refused by a `custom` refinement at path
    // `reference`. Against a matched backend the PUT comes back 422
    // `INVALID_METADATA` for the WHOLE object document, which blocks every
    // later save of that object — so flipping this pin green on its own would
    // have pinned a known-broken save path. The product half was fixed first
    // (`assertRelationshipTargetPresent` in `MetadataService.ts`), and this
    // asserts THAT: the incomplete draft never reaches the wire.
    const { adapter, puts } = makeCapturingAdapter();

    await expect(
      new MetadataService(adapter).saveFields('account', [{ ...LOOKUP, referenceTo: undefined }]),
    ).rejects.toThrow(/needs a `reference`/);

    // The load-bearing half: refusing is only an improvement if it happens
    // BEFORE the request. A guard that threw after the PUT would leave the
    // object in exactly the state this change exists to prevent.
    expect(puts).toHaveLength(0);
  });

  it('and it is the MISSING TARGET that is refused, not the type — the control', async () => {
    // Without this, the assertion above is satisfied by a guard that refuses
    // every `lookup`, which would break the feature rather than fix it.
    const { adapter, puts } = makeCapturingAdapter();

    await new MetadataService(adapter).saveFields('account', [LOOKUP]);

    const [def] = savedFields(puts);
    expect(def.reference).toBe('account');
    expect(FieldSchema.safeParse(def).success).toBe(true);
  });

  it('an empty-string target is refused too — `reference: ""` is not a target', async () => {
    // The spec refuses it (`.min(1)`-shaped: measured, `reference: ''` fails the
    // same `custom` issue at path `reference`), and a designer whose picker was
    // opened and cleared emits exactly this.
    const { adapter, puts } = makeCapturingAdapter();

    await expect(
      new MetadataService(adapter).saveFields('account', [{ ...LOOKUP, referenceTo: '' }]),
    ).rejects.toThrow(/needs a `reference`/);
    expect(puts).toHaveLength(0);
  });
});

describe('objectui#7122 · the guarded type list is the spec’s, not a hand-kept guess', () => {
  // `RELATIONSHIP_TYPES_REQUIRING_REFERENCE` is a named list in
  // `MetadataService.ts` (a full `FieldSchema` parse before the PUT is refused
  // on purpose — it would reject plugin-registered keys the server accepts).
  // A named list can go stale in both directions, so it is DERIVED here and
  // compared, which turns any upstream movement into a red test rather than a
  // silent hole in the guard.
  const REQUIRE_REFERENCE = ['lookup', 'master_detail'];

  it('every spec field type that needs a target is guarded, and no other type is', () => {
    const typeSchema = FieldSchema.shape.type as unknown as {
      options?: string[];
      def?: { entries?: Record<string, unknown> };
    };
    const allTypes: string[] =
      typeSchema.options ?? Object.keys(typeSchema.def?.entries ?? {});

    // Non-vacuity: a shape read that answered `[]` would make the derivation
    // agree with an empty list and assert nothing at all.
    expect(allTypes.length).toBeGreaterThan(20);

    const derived = allTypes.filter((type) => {
      const parsed = FieldSchema.safeParse({ type, label: 'L' });
      return !parsed.success && parsed.error.issues.some((i) => i.path.join('.') === 'reference');
    });

    expect([...derived].sort()).toEqual([...REQUIRE_REFERENCE].sort());
  });

  it('a guarded type parses green once the target is supplied — the requirement is the VALUE, not the type', () => {
    for (const type of REQUIRE_REFERENCE) {
      expect(FieldSchema.safeParse({ type, label: 'L', reference: 'account' }).success).toBe(true);
      expect(FieldSchema.safeParse({ type, label: 'L', reference: '' }).success).toBe(false);
    }
  });
});
