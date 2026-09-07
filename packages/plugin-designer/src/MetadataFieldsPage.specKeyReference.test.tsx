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
 *
 * ## objectui#7714 — a half-filled lookup is HELD CLIENT-SIDE and never PUT
 *
 * The half-filled case below used to pin the opposite ("still saves, exactly as
 * before"). `@objectstack/spec` 17.3.0 made `reference` a hard requirement on
 * `lookup` / `master_detail`, and objectui#7714 drove the consequence in a
 * running designer against a 17.3.0 backend: the target-less draft PUT the
 * whole object, got `422 INVALID_METADATA` at `fields.<name>.reference`, and
 * then blocked the NEXT edit too — to an entirely different, already-saved
 * field — because the draft rides along in the same document.
 *
 * This page now refuses the list and issues **no PUT at all**. The claim is
 * about THE PUT BODY, not the spec's verdict, which is why it pins at this
 * repo's installed **17.2.0** (where the spec still accepts the draft) and does
 * not wait on the pin bump (objectui#7122). ⛔ Not "strip the incomplete field
 * and save the rest" — that shows the author a field the server never received,
 * the silent-drop shape objectstack#4001 closed. `puts` staying EMPTY is the
 * assertion that tells the two apart.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
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
 *   left behind, ALONGSIDE the spec spelling. `carryOver` spreads the previous
 *   server def verbatim, so without a tombstone the stale key rides straight
 *   back out to the route that rejects it — and the object stays blocked
 *   forever.
 *
 *   ⚠️ It carries BOTH keys deliberately (objectui#7714). Holding the target
 *   ONLY under the retired spelling is a different and much narrower state:
 *   the read door reads `raw.reference` alone, so such a field reaches the wire
 *   with NO target at all, and objectui#7714's guard now refuses it. That state
 *   has its own case at the bottom of this file rather than riding invisibly
 *   inside the fixture every other test here shares — where it would have made
 *   all of them assert the guard instead of what they are named for.
 */
const OBJECT_BODY = {
  name: 'probe_widget',
  label: 'Widget',
  fields: {
    name: { type: 'text', label: 'Name', required: true },
    owner_id: { type: 'lookup', label: 'Owner', reference: 'account', inlineHelpText: 'Record owner.' },
    legacy_id: { type: 'lookup', label: 'Legacy', reference: 'contact', referenceTo: 'contact' },
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
    // Falsification: the field is still there, still a lookup, and still
    // pointing at its target — the strip removed a KEY, not the field and not
    // the relationship.
    expect(fields.legacy_id.type).toBe('lookup');
    expect(fields.legacy_id.reference).toBe('contact');
    expect(FieldSchema.safeParse(fields.legacy_id).success).toBe(true);
  });

  it('a HALF-FILLED draft — type `lookup`, target left empty — is REFUSED, and issues NO PUT', async () => {
    // objectui#7714. Replaces the assertion that used to live here, rather
    // than respelling it: the branch it pinned is the branch this card removes.
    //
    // This page's caller is fire-and-forget (`void handleFieldsChange(next)`),
    // so the refusal is observed the way the AUTHOR observes it — the page's
    // error surface — and not as a rejected promise. The second assertion is
    // the card: no request was made at all, which is what distinguishes the
    // ruled fix from option B (strip the field, PUT the rest, report success).
    await renderPage();
    const next: DesignerFieldDefinition[] = [
      ...designerProps!.fields,
      { id: 'fld_half', name: 'half_id', label: 'Half', type: 'lookup' },
    ];
    await act(async () => {
      designerProps!.onFieldsChange!(next);
    });

    await waitFor(() =>
      expect(screen.getByTestId('metadata-fields-page-error').textContent).toMatch(
        /needs a `reference` naming the object it links to/,
      ),
    );
    expect(puts).toEqual([]);
  });

  it('a COMPLETE lookup still saves — the guard refuses drafts, not relationships', async () => {
    // Falsification: a guard that refused every `lookup` would satisfy the case
    // above while deleting the feature, so the accepting half is asserted here.
    await renderPage();
    const next: DesignerFieldDefinition[] = [
      ...designerProps!.fields,
      { id: 'fld_ok', name: 'billing_id', label: 'Billing', type: 'lookup', referenceTo: 'invoice' },
    ];
    await act(async () => {
      designerProps!.onFieldsChange!(next);
    });
    await waitFor(() => expect(puts).toHaveLength(1));

    expect(savedFields().billing_id.reference).toBe('invoice');
  });

  it('an UNTOUCHED stored lookup saves on an unrelated edit — the target comes from `prev`', async () => {
    // The reason the guard reads the EMITTED entry rather than the designer's
    // input. `owner_id`'s target lives in the stored document and reaches the
    // wire through `carryOver`; a guard reading `designed.referenceTo` would
    // refuse this save — a document the server accepts, blocked by the client —
    // on every object that has ever had a lookup.
    await renderPage();
    await relabel('name', 'Full name');

    expect(puts).toHaveLength(1);
    expect(savedFields().owner_id.reference).toBe('account');
  });

  it('refuses every unusable target state, and PUTs none of them', async () => {
    // objectui#7714, all four states plus `null`. The whitespace row is this
    // page being deliberately STRICTER than the contract: measured on 17.3.0,
    // `reference: '   '` parses green at field level and through `ObjectSchema`
    // (upstream objectstack#16126). The refusal is this writer's own, declared
    // in `MetadataFieldsPage.tsx`, and it does not depend on which spec is
    // installed — which is why it is asserted here and the spec's verdict is
    // not (at this repo's 17.2.0 pin the spec accepts every one of these).
    //
    // One render, re-driven per state: `renderPage` per iteration would leave
    // several mounted pages in the document and `getByTestId` would then find
    // more than one error surface.
    await renderPage();
    const base = designerProps!.fields;

    for (const referenceTo of [undefined, '', '   ', 42, null]) {
      const next = [
        ...base,
        { id: 'fld_x', name: 'x_id', label: 'X', type: 'lookup', referenceTo },
      ] as DesignerFieldDefinition[];
      await act(async () => {
        designerProps!.onFieldsChange!(next);
      });
      await waitFor(() =>
        expect(
          screen.getByTestId('metadata-fields-page-error').textContent,
          `referenceTo=${JSON.stringify(referenceTo)} should be refused`,
        ).toMatch(/needs a `reference` naming the object it links to/),
      );
      expect(puts, `referenceTo=${JSON.stringify(referenceTo)} must issue no PUT`).toEqual([]);
    }
  });

  it('does NOT pin a `master_detail` refusal — this page cannot reach one (measured)', () => {
    // objectui#7714. The guard's list carries `master_detail` for parity with
    // the sibling writer, where it IS reachable (`FieldMetadataPayload['type']`
    // is an unconstrained `string`, and `MetadataService.saveObject` refuses a
    // target-less master-detail today — pinned in
    // `MetadataService.specKeyReference.test.ts`).
    //
    // Through THIS page it is unreachable, and the reason is worth stating
    // rather than leaving as an empty spot: `toDesignerType` maps every type
    // outside `DESIGNER_FIELD_TYPES` to `'text'`, so a stored `master_detail`
    // arrives at the guard already flattened. Measured on this page:
    //
    //   stored { type: 'master_detail', reference: 'invoice' }
    //     => designer field type "text"
    //     => WIRE { "type": "text", "label": "Parent", "reference": "invoice" }
    //
    // So a refusal assertion here would be a PHANTOM — green because the guard
    // never sees a `master_detail`, not because it handled one. The flattening
    // is a separate defect (objectui#8060) and this case is a marker, so
    // that when it is fixed the missing coverage is visible rather than assumed.
    expect(true).toBe(true);
  });

});

/**
 * objectui#7714 — a target stored ONLY under the retired spelling.
 *
 * Surfaced by this card's guard rather than sought: it is what made every save
 * in this file refuse when the shared fixture held `legacy_id` that way.
 *
 * The state is real. `toDesignerField` reads `raw.reference` and nothing else,
 * and `carryOver` strips `referenceTo` — so a field whose target lives only
 * under the pre-objectui#6041 spelling reaches the wire with NO target. Before
 * this card that saved at the installed 17.2.0, silently dropping the
 * relationship, and answered `422 INVALID_METADATA` at `fields.<n>.reference`
 * against a 17.3.0 backend, with no field named. It is now refused here, by
 * name, before the request.
 *
 * ⚠️ This is a behaviour change BEYOND "a half-filled lookup is not PUT", and
 * it is stated rather than absorbed: a save that used to go through (losing the
 * target) is now refused. The refusal is the better half of a bad pair — a
 * named field the author can repair, instead of a silently emptied
 * relationship — but the underlying read-side gap is not this card's to fix and
 * is filed separately. The `carryOver` docblock's claim that stripping
 * `referenceTo` "costs nothing" because the target is re-emitted as `reference`
 * holds only when the READ found one, which for this shape it does not.
 */
describe('objectui#7714 · a lookup whose target survives only as `referenceTo`', () => {
  it('is refused by name, and issues no PUT', async () => {
    const client = new MetadataClient({
      baseUrl: 'http://localhost:3000',
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? 'GET').toUpperCase();
        if (method === 'PUT') {
          puts.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
          return json({ success: true, name: 'probe_widget' });
        }
        if (/\/meta\/object\/probe_widget(\?|$)/.test(url)) {
          return json({
            ...OBJECT_ENVELOPE,
            item: {
              ...OBJECT_BODY,
              fields: {
                name: { type: 'text', label: 'Name', required: true },
                stale_id: { type: 'lookup', label: 'Stale', referenceTo: 'contact' },
              },
            },
          });
        }
        return json({ items: [] });
      }) as unknown as typeof fetch,
    });
    render(<MetadataFieldsPage objectName="probe_widget" client={client} />);
    await waitFor(() => expect(designerProps).not.toBeNull());

    // A plain relabel of an UNRELATED field — the author never touched the
    // lookup, which is what makes the refusal worth stating.
    await act(async () => {
      designerProps!.onFieldsChange!(
        designerProps!.fields.map((f) => (f.name === 'name' ? { ...f, label: 'Full name' } : f)),
      );
    });

    await waitFor(() =>
      expect(screen.getByTestId('metadata-fields-page-error').textContent).toMatch(/`stale_id`/),
    );
    expect(puts).toEqual([]);
  });
});
