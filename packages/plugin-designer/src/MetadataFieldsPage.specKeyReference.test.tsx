/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6041 — the Field Designer reads and writes the relationship target
 * under the spec's spelling `reference`, in BOTH directions.
 *
 * Surfaced by the key-level parity gate built for objectui#5761
 * (`scripts/check-designer-field-key-parity.mjs`). `ServerFieldSchema` is one
 * of that gate's two `wire` shapes: `fromDesignerField` builds it and this page
 * PUTs the assembled `fields` map.
 *
 * `referenceTo` is not in `FieldSchema`'s accept set — measured against the
 * installed `@objectstack/spec` 17.2.0, through the whole object document:
 *
 *   ObjectSchema.safeParse({ …, fields: { rel: { type: 'lookup', label: 'Owner',
 *                                               referenceTo: 'user' } } })
 *     => success = false
 *     => unrecognized_keys at ["fields","rel"] keys=["referenceTo"]
 *
 * i.e. a hard 422 `INVALID_METADATA` that blocks every later save of the object.
 *
 * Two directions, both broken by one misspelling and both pinned here:
 *
 *   WRITE — `fromDesignerField` emitted `referenceTo`, so authoring a lookup
 *           field produced the 422.
 *   READ  — `toDesignerField` read `raw.referenceTo` from the server payload.
 *           A spec-parsed server sends `reference`, so every EXISTING lookup
 *           field loaded into the designer with an empty reference box.
 *
 * Fixing only the write side would leave every already-saved field unreadable,
 * so the read case below is not a bonus assertion — it is half the card.
 *
 * Written against the wire like its siblings `MetadataFieldsPage.saveEnvelope`
 * and `MetadataFieldsPage.retiredIndexed`: a REAL `MetadataClient` over a fetch
 * double, assertions on the captured PUT bytes rather than on the argument
 * handed to the client. That distinction matters for this key — a property
 * whose value is `undefined` is a key zod's strict object COUNTS but
 * `JSON.stringify` DROPS.
 *
 * This file names no `isSystem`/`system` key anywhere, and its sibling
 * `MetadataFieldsPage.specKeySystem.test.tsx` names no reference key: the two
 * cards of this fold are independently verifiable, and reverting one fix must
 * red only its own file.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { FieldSchema } from '@objectstack/spec/data';
import { MetadataClient } from '@object-ui/data-objectstack';
import type { DesignerFieldDefinition } from '@object-ui/types';

/**
 * The object document as it lives in the database.
 *
 *   `owner_id` carries what a SPEC-PARSED SERVER sends — `reference`. That is
 *   the read case: before this fix the designer looked for `referenceTo` and
 *   found nothing.
 *   `legacy_id` carries the misspelling a pre-fix designer build could have
 *   left behind. `carryOver` spreads the previous server def verbatim, so
 *   without a tombstone the key rides straight back out to the route that
 *   rejects it — and the object stays blocked forever.
 */
const OBJECT_BODY = {
  name: 'probe_widget',
  label: 'Widget',
  fields: {
    name: { type: 'text', label: 'Name', required: true },
    owner_id: { type: 'lookup', label: 'Owner', reference: 'account', inlineHelpText: 'Record owner.' },
    legacy_id: { type: 'lookup', label: 'Legacy', referenceTo: 'contact' },
  },
};

const OBJECT_ENVELOPE = {
  type: 'object',
  name: 'probe_widget',
  item: OBJECT_BODY,
  lock: 'none',
  provenance: 'org',
  editable: true,
};

interface RecordedDesignerProps {
  objectName: string;
  fields: DesignerFieldDefinition[];
  onFieldsChange?: (fields: DesignerFieldDefinition[]) => void;
  readOnly?: boolean;
}

let designerProps: RecordedDesignerProps | null = null;

vi.mock('./FieldDesigner', () => ({
  FieldDesigner: (props: RecordedDesignerProps) => {
    designerProps = props;
    return null;
  },
}));

import { MetadataFieldsPage } from './MetadataFieldsPage';

let puts: Array<Record<string, unknown>> = [];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function realClient(): MetadataClient {
  return new MetadataClient({
    baseUrl: 'http://localhost:3000',
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'PUT') {
        puts.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
        return json({ success: true, name: 'probe_widget' });
      }
      if (/\/meta\/object\/probe_widget(\?|$)/.test(url)) return json(OBJECT_ENVELOPE);
      return json({ items: [] });
    }) as unknown as typeof fetch,
  });
}

async function renderPage() {
  render(<MetadataFieldsPage objectName="probe_widget" client={realClient()} />);
  await waitFor(() => expect(designerProps).not.toBeNull());
}

/** The body of the last PUT, exactly as it went over the wire. */
function lastPut(): Record<string, unknown> {
  // Indexed rather than `.at(-1)`: this package's tsconfig `lib` predates
  // ES2022, so `Array.prototype.at` does not type-check here.
  return puts[puts.length - 1];
}

/** The fields map exactly as it went over the wire on the last PUT. */
function savedFields(): Record<string, Record<string, unknown>> {
  return lastPut().fields as Record<string, Record<string, unknown>>;
}

const unrecognizedKeys = (result: ReturnType<typeof FieldSchema.safeParse>): string[] =>
  result.success
    ? []
    : result.error.issues
        .filter((i) => i.code === 'unrecognized_keys')
        .flatMap((i) => (i as unknown as { keys: string[] }).keys);

/** A plain relabel — the smallest edit that re-serialises every field. */
async function relabel(fieldName: string, label: string) {
  const next = designerProps!.fields.map((f) => (f.name === fieldName ? { ...f, label } : f));
  await act(async () => {
    designerProps!.onFieldsChange!(next);
  });
  await waitFor(() => expect(puts).toHaveLength(1));
}

beforeEach(() => {
  puts = [];
  designerProps = null;
});

afterEach(() => {
  designerProps = null;
});

describe('the instrument', () => {
  it('is the installed spec schema and it is STRICT — unknown keys are refused, not stripped', () => {
    // objectstack#4001 closed the silent-drop shape. Without it every parity
    // assertion here would be trivially green while the 422 still happened.
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

describe('objectui#6041 · READ — an existing lookup field loads with its target', () => {
  it('hands the stored `reference` down to the designer', async () => {
    await renderPage();
    const owner = designerProps!.fields.find((f) => f.name === 'owner_id')!;
    // Before this fix the reader looked for `raw.referenceTo`, so this was
    // `undefined` and the reference box rendered EMPTY for every saved field.
    expect(owner.referenceTo).toBe('account');
    // Falsification: the field itself arrived, with its other keys intact.
    expect(owner.label).toBe('Owner');
    expect(owner.type).toBe('lookup');
  });
});

describe('objectui#6041 · WRITE — the save carries `reference`, never `referenceTo`', () => {
  it('PUTs the target under the spec spelling', async () => {
    await renderPage();
    await relabel('owner_id', 'Record owner');

    const fields = savedFields();
    expect(fields.owner_id.reference).toBe('account');
    expect('referenceTo' in fields.owner_id).toBe(false);
    // Falsification, twice: the edit landed, and the unknown per-field key the
    // designer does not RENDER (but the spec accepts) survived the round-trip.
    expect(fields.owner_id.label).toBe('Record owner');
    expect(fields.owner_id.inlineHelpText).toBe('Record owner.');
  });

  it('every field it PUTs parses through the real FieldSchema', async () => {
    await renderPage();
    await relabel('owner_id', 'Record owner');

    for (const [name, def] of Object.entries(savedFields())) {
      const result = FieldSchema.safeParse(def);
      expect(unrecognizedKeys(result), `field \`${name}\` emitted a refused key`).toEqual([]);
      expect(result.success, `field \`${name}\` did not parse`).toBe(true);
    }
  });

  it('a newly authored lookup field emits `reference`', async () => {
    await renderPage();
    const next: DesignerFieldDefinition[] = [
      ...designerProps!.fields,
      { id: 'fld_new', name: 'billing_id', label: 'Billing', type: 'lookup', referenceTo: 'invoice' },
    ];
    await act(async () => {
      designerProps!.onFieldsChange!(next);
    });
    await waitFor(() => expect(puts).toHaveLength(1));

    const fields = savedFields();
    expect(fields.billing_id.reference).toBe('invoice');
    expect('referenceTo' in fields.billing_id).toBe(false);
    expect(FieldSchema.safeParse(fields.billing_id).success).toBe(true);
  });

  it('a save of an object ALREADY carrying `referenceTo` puts it back without the key', async () => {
    // Without the tombstone this is the case that keeps a blocked object
    // blocked: renaming the emit site does not touch what `carryOver` spreads,
    // so the stored misspelling would ride back out to the same 422.
    await renderPage();
    await relabel('owner_id', 'Record owner');

    const fields = savedFields();
    expect('referenceTo' in fields.legacy_id).toBe(false);
    // Falsification: the field is still there and still a lookup — the strip
    // removed a key, not the field.
    expect(fields.legacy_id.type).toBe('lookup');
    expect(FieldSchema.safeParse(fields.legacy_id).success).toBe(true);
  });

  it('a HALF-FILLED draft — type `lookup`, target left empty — still saves, exactly as before', async () => {
    // The behavioural edge this card had to measure. The spec's prose calls
    // `reference` "Required for relationship types", but that requirement is
    // NOT enforced by the zod parse at 17.2.0: `{ type: 'lookup', label: 'L' }`
    // parses green at field level AND through `ObjectSchema`. `undefined` is
    // dropped by `JSON.stringify` under either spelling, so the wire bytes are
    // byte-identical before and after this fix.
    //
    // ⚠ This case would still pass on a revert, and says so deliberately: it
    // exists to prove the rename did NOT newly block a draft.
    await renderPage();
    const next: DesignerFieldDefinition[] = [
      ...designerProps!.fields,
      { id: 'fld_half', name: 'half_id', label: 'Half', type: 'lookup' },
    ];
    await act(async () => {
      designerProps!.onFieldsChange!(next);
    });
    await waitFor(() => expect(puts).toHaveLength(1));

    const fields = savedFields();
    expect('reference' in fields.half_id).toBe(false);
    expect('referenceTo' in fields.half_id).toBe(false);
    expect(FieldSchema.safeParse(fields.half_id).success).toBe(true);
  });
});
