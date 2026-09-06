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
 *
 * ## objectui#7714 — a half-filled lookup is HELD CLIENT-SIDE and never PUT
 *
 * The half-filled case below used to pin the opposite ("still saves, exactly as
 * before"). That was accurate for objectui#6041's question and is no longer the
 * truth: `@objectstack/spec` 17.3.0 made `reference` a hard requirement on
 * `lookup` / `master_detail`, and objectui#7714 drove the consequence in a
 * running designer against a 17.3.0 backend — the target-less draft PUT the
 * whole object, got `422 INVALID_METADATA` at `fields.<name>.reference`, and
 * then blocked the NEXT edit too, to an entirely different field, because the
 * draft rides along in the same document.
 *
 * So the fix is a client behaviour, and this file states it: the writer refuses
 * the list and issues **no PUT at all**. That claim is about THE PUT BODY, not
 * about the spec's verdict, which is exactly why it is pinnable at this repo's
 * installed **17.2.0** — where the spec still accepts the draft — and does not
 * wait on the pin bump (objectui#7122).
 *
 * ⛔ The refusal is not "strip the incomplete field and save the rest": that
 * would show the author a field the server never received, the silent-drop
 * shape objectstack#4001 closed and the ruling excluded by name. `puts` being
 * EMPTY is the assertion that tells the two apart.
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

  it('a HALF-FILLED draft — type `lookup`, target left empty — is REFUSED, and issues NO PUT', async () => {
    // objectui#7714. This case used to assert the opposite ("still saves,
    // exactly as before"), and that assertion is not respelled here — it is
    // REPLACED, because the branch it pinned is the branch this card removes.
    //
    // Two assertions, and the second is the card: the save is refused, AND the
    // client made no request at all. "Refused" alone would also describe option
    // B — strip the incomplete field, PUT the rest, report success — which is
    // the silent-drop shape objectstack#4001 closed and which the ruling
    // excluded by name. `puts` being empty is what distinguishes them.
    const { adapter, puts } = makeCapturingAdapter();

    await expect(
      new MetadataService(adapter).saveFields('account', [{ ...LOOKUP, referenceTo: undefined }]),
    ).rejects.toThrow(/needs a `reference` naming the object it links to/);

    expect(puts).toEqual([]);
  });

  it('the refusal names the field, the type and the consequence', async () => {
    // The author reads this string in the designer's error banner, so its
    // content is the deliverable rather than incidental. Asserted by content,
    // not by exact bytes: the docblocks are free to change and the four
    // load-bearing facts are not.
    const { adapter } = makeCapturingAdapter();

    await expect(
      new MetadataService(adapter).saveFields('account', [{ ...LOOKUP, referenceTo: undefined }]),
    ).rejects.toThrow(/`owner_id`/);
    await expect(
      new MetadataService(adapter).saveFields('account', [{ ...LOOKUP, referenceTo: undefined }]),
    ).rejects.toThrow(/`lookup` field/);
    await expect(
      new MetadataService(adapter).saveFields('account', [{ ...LOOKUP, referenceTo: undefined }]),
    ).rejects.toThrow(/blocks EVERY later save of this object/);
  });

  it('a COMPLETE lookup still saves — the guard refuses drafts, not relationships', async () => {
    // Falsification for the whole block above. A guard that refused every
    // `lookup` would make every assertion in it pass while deleting the
    // feature, so the accepting half is asserted in the same file.
    const { adapter, puts } = makeCapturingAdapter();

    await new MetadataService(adapter).saveFields('account', [LOOKUP]);

    expect(puts).toHaveLength(1);
    expect(savedFields(puts)[0].reference).toBe('account');
  });

  it('a NON-relationship field with no `reference` is untouched by the guard', async () => {
    // The guard is keyed to the two relationship types, not to the absence of a
    // key: 47 of the spec's 49 field types carry no `reference` at all and must
    // keep saving. Measured on the 17.3.0 artifact for objectui#7714 — exactly
    // `lookup` and `master_detail` are refused at `reference` on
    // `{ type, label }`, and no other type is refused at all.
    const { adapter, puts } = makeCapturingAdapter();

    await new MetadataService(adapter).saveFields('account', [
      { id: 'note', name: 'note', label: 'Note', type: 'text' },
    ]);

    expect(puts).toHaveLength(1);
    expect(savedFields(puts)[0].type).toBe('text');
  });

  it('`master_detail` is guarded too, through `saveObject` — the invariant is relationship targets, not one key', async () => {
    // Driven through `saveObject`'s `existingFields` rather than `saveFields`,
    // and that is the accurate reachability rather than a convenience:
    // `DesignerFieldDefinition['type']` does NOT include `master_detail`, so
    // the designer cannot author one, while `FieldMetadataPayload['type']` is
    // an unconstrained `string` and this path is where a stored master-detail
    // field actually arrives. It also exercises the second writer sharing this
    // door — `toObjectPayload` converts through the same `toFieldsMap`, so one
    // guard covers both, and nothing else in this file asserts that.
    const { adapter, puts } = makeCapturingAdapter();

    await expect(
      new MetadataService(adapter).saveObject({ id: 'account', name: 'account', label: 'Account' }, [
        { name: 'parent_id', label: 'Parent', type: 'master_detail' },
      ]),
    ).rejects.toThrow(/`master_detail` field/);

    expect(puts).toEqual([]);
  });

  it('`saveObject` still saves when the master-detail target IS present', async () => {
    // Falsification for the case above: it must be the missing target that was
    // refused, not the `saveObject` path or the type.
    const { adapter, puts } = makeCapturingAdapter();

    await new MetadataService(adapter).saveObject({ id: 'account', name: 'account', label: 'Account' }, [
      { name: 'parent_id', label: 'Parent', type: 'master_detail', reference: 'invoice' },
    ]);

    expect(puts).toHaveLength(1);
    expect(savedFields(puts)[0].reference).toBe('invoice');
  });

});

/**
 * objectui#7714 — the four states of an unusable target, and the one where this
 * writer is deliberately stricter than the contract.
 *
 * ⚠️ Read the instrument note before adding a spec assertion here. This repo's
 * pin is `@objectstack/spec` **17.2.0**, where `reference` is prose-only: it
 * accepts absent, `''` AND `'   '` alike. So an assertion of the shape "the
 * spec accepts `'   '`" is TRUE here and measures nothing — it is true of every
 * value at this pin. The divergence is therefore asserted where it is real:
 * against THIS WRITER, whose refusal does not depend on the installed spec at
 * all, plus the one discriminating spec reading 17.2.0 does carry (a non-string
 * IS refused, so a value-level check exists; blankness is simply not part of
 * it, at either version).
 *
 * The 17.3.0 half was measured on the built artifact and recorded in
 * `MetadataService.ts`'s docblock rather than asserted here, because it is not
 * observable from this repo's installed spec. When objectui's pin reaches
 * 17.3.0 (objectui#7122) it becomes assertable; when objectstack#16126 lands
 * upstream the whitespace row moves to "refused" and only the guard's
 * declaration retires, never its behaviour.
 */
describe('objectui#7714 · the target states, and the declared divergence', () => {
  const puttable = async (reference: unknown) => {
    const { adapter, puts } = makeCapturingAdapter();
    const field = { ...LOOKUP, referenceTo: reference } as DesignerFieldDefinition;
    try {
      await new MetadataService(adapter).saveFields('account', [field]);
      return { refused: false, puts };
    } catch {
      return { refused: true, puts };
    }
  };

  it('refuses all four unusable states, and PUTs none of them', async () => {
    for (const reference of [undefined, '', '   ', 42, null]) {
      const { refused, puts } = await puttable(reference);
      expect(refused, `reference=${JSON.stringify(reference)} should be refused`).toBe(true);
      expect(puts, `reference=${JSON.stringify(reference)} must issue no PUT`).toEqual([]);
    }
  });

  it('accepts a real target, and one that merely needs no trimming', async () => {
    // Falsification for the row above: a guard that refused everything would
    // satisfy it. `'account'` is the ordinary case; the guard trims only to
    // TEST, never to rewrite, so the value on the wire is what the author gave.
    const { refused, puts } = await puttable('account');
    expect(refused).toBe(false);
    expect(savedFields(puts)[0].reference).toBe('account');
  });

  it('does not rewrite a target that has surrounding whitespace but a real name', async () => {
    // `' account '` trims to a non-empty name, so the guard passes it — and
    // passes it THROUGH, unchanged. This writer's job is to refuse a draft, not
    // to normalise author input; silently trimming would be a second, undeclared
    // divergence hiding inside the first.
    const { refused, puts } = await puttable(' account ');
    expect(refused).toBe(false);
    expect(savedFields(puts)[0].reference).toBe(' account ');
  });

  it('the divergence is real at THIS pin: the spec accepts `\'   \'`, this writer refuses it', async () => {
    // The writer half — true regardless of which spec is installed.
    const { refused } = await puttable('   ');
    expect(refused).toBe(true);

    // The spec half, stated honestly for 17.2.0. `'   '` parses green — but so
    // does an absent target here, so this line alone is NOT evidence of a
    // blankness gap. The discriminating reading is the next one.
    expect(FieldSchema.safeParse({ type: 'lookup', label: 'L', reference: '   ' }).success).toBe(true);

    // Discriminating control: a value-level check on `reference` DOES exist at
    // 17.2.0 — a non-string is refused, and refused as `invalid_type`. So the
    // schema is being consulted and is not a passthrough; blankness is simply
    // not among the things it tests, at either version. That is the shape
    // objectstack#16126 reports upstream.
    const nonString = FieldSchema.safeParse({ type: 'lookup', label: 'L', reference: 42 });
    expect(nonString.success).toBe(false);
    expect(nonString.error!.issues.map((i) => i.code)).toContain('invalid_type');
  });
});

/**
 * objectui#7714 — the refusal DIAGNOSES the state it found.
 *
 * Split out because the single sentence this message used to carry ("…and this
 * one has none") is wrong for two of the four states, and a message that
 * prescribes the wrong repair is worse than a terse one: "pick the target
 * object" is not what fixes `reference: 42`, and the 422 the message promises
 * is one this writer cannot deliver for `'   '`, which the spec accepts.
 */
describe('objectui#7714 · the refusal message distinguishes the four states', () => {
  const refusalFor = async (reference: unknown): Promise<string> => {
    const { adapter } = makeCapturingAdapter();
    try {
      await new MetadataService(adapter).saveFields('account', [
        { ...LOOKUP, referenceTo: reference } as DesignerFieldDefinition,
      ]);
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
    throw new Error(`expected a refusal for reference=${JSON.stringify(reference)}`);
  };

  it('absent → "has none", and names the 422 consequence', async () => {
    const m = await refusalFor(undefined);
    expect(m).toMatch(/has none/);
    expect(m).toMatch(/blocks EVERY later save of this object/);
  });

  it('empty string → "is empty", not "has none"', async () => {
    const m = await refusalFor('');
    expect(m).toMatch(/is empty/);
    expect(m).not.toMatch(/has none/);
  });

  it('non-string → names the KIND and `invalid_type`, and does not prescribe "supply a target"', async () => {
    const m = await refusalFor(42);
    expect(m).toMatch(/holds a number instead of an object name/);
    expect(m).toMatch(/invalid_type/);
    expect(m).not.toMatch(/has none/);
    // `null` is typeof 'object'; spelling it as "null" is the accurate word.
    expect(await refusalFor(null)).toMatch(/holds null instead of an object name/);
  });

  it('whitespace-only → says the spec ACCEPTS it, and does not promise a 422 it cannot deliver', async () => {
    const m = await refusalFor('   ');
    expect(m).toMatch(/is blank/);
    expect(m).toMatch(/ACCEPTS this value/);
    expect(m).toMatch(/objectstack#16126/);
    // The falsifying half: this is the ONE state where promising the server
    // would refuse the document would be a lie.
    expect(m).not.toMatch(/422/);
  });
});
