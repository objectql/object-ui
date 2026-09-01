/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7190 — does a `dependsOn` lookup gate on the DETAIL page? It does.
 *
 * ## Why this file mounts the whole record page and not the widget
 *
 * `@object-ui/fields`' `LookupField` resolves the record it gates on as
 * `dependentValues ?? ctx.formValues ?? ctx.data ?? {}`, and
 * `plugin-detail`'s `InlineFieldInput` supplies none of the three — it renders
 * `LookupField` directly with `field` / `value` / `onChange` / `dataSource` /
 * `error` and nothing else. #7190 filed that as a supply-side census and
 * deliberately graded it a `finding`, NOT a bug, on an explicit boundary: a
 * detail page renders ONE record, which is exactly the "record scope" `ctx.data`
 * exists to carry, so a host that populates `ctx.data` would make the cascade
 * resolve and there would be no defect at all. That was never measured.
 *
 * ⚠️ It cannot be measured by mounting `InlineFieldInput` bare. A bare mount has
 * no provider setting `ctx.data`, so it reports a gated trigger TRIVIALLY and
 * ALWAYS — an answer about the harness, not about the product, and the single
 * most likely way to reach a confident false "bug" verdict here. So this file
 * mounts `RecordDetailView`, the app-shell record page, which is the host the
 * detail page actually runs in, and drives it the way a user does: the record
 * loads, a field is double-clicked to enter inline edit (#2401), and the
 * lookup's own trigger is read out of the resulting DOM.
 *
 * ## The control is load-bearing in both directions
 *
 * Each test renders TWO lookups over the SAME record and the SAME referenced
 * object, differing only in whether `dependsOn` is declared. The declared one
 * must gate and the control must NOT — the shape objectui#6875 established,
 * #7154 reused for the grid and #7165 uses in both directions. A gated reading
 * is worthless if the control is gated too (that would mean the picker path is
 * broken for an unrelated reason), and it asserts an enabled control rather
 * than merely observing one.
 *
 * ## Both of `InlineFieldInput`'s call sites are covered
 *
 * `InlineFieldInput` has exactly two non-test call sites — `DetailSection`
 * (the details body) and `HeaderHighlight` (the highlights strip) — and neither
 * passes `dependentValues`. The canonical record page routes a field to exactly
 * one of them: `buildDefaultTabs` hands the strip's field list to
 * `buildDefaultDetails` as `hideFields`, so a highlight is hidden from the body.
 * Declaring `highlightFields` therefore selects which call site renders the
 * pair, with no classname coupling and no double render — asserted below as an
 * exact trigger count of 2.
 *
 * ## What this pins
 *
 * The CURRENT behaviour, which is a defect: a `dependsOn` lookup on a detail
 * page is permanently gated ("Select region first") while the parent value it
 * asks for is on screen, in the same edit session, two fields away. It is
 * pinned rather than fixed here for the same reason #7154 pinned the grid's
 * gate rather than fixing it — the fix is a separate card, and which record the
 * host should feed (the saved record, or the inline session's in-flight staged
 * edits) is a design question this measurement does not answer.
 */
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MetadataCtx } from '@object-ui/react';

vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'Ada', image: null }, activeOrganization: null }),
  createAuthenticatedFetch: () => vi.fn(),
}));
vi.mock('@object-ui/collaboration', () => ({
  useRecordPresence: () => ({ viewers: [], others: [] }),
  PresenceAvatars: () => null,
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(), error: vi.fn(), info: vi.fn(),
    warning: vi.fn(), loading: vi.fn(), dismiss: vi.fn(),
  }),
}));
// Orthogonal chrome — stubbed so the only thing this file observes is the picker.
vi.mock('./ActionConfirmDialog', () => ({ ActionConfirmDialog: () => null }));
vi.mock('./ActionParamDialog', () => ({ ActionParamDialog: () => null }));
vi.mock('./ActionResultDialog', () => ({ ActionResultDialog: () => null }));
vi.mock('./FlowRunner', () => ({ FlowRunner: () => null }));
vi.mock('./MetadataInspector', () => ({
  MetadataPanel: () => null,
  useMetadataInspector: () => ({ showDebug: false, toggle: () => {} }),
}));

import { RecordDetailView } from './RecordDetailView';

const OBJECT = 'os_7190_task';
const REF = 'os_7190_person';
const REC = 'rec-1';

/** The referenced records. `region` is what the dependent filter would scope on. */
const PEOPLE = [
  { id: 'p1', name: 'Ana EMEA', region: 'emea' },
  { id: 'p2', name: 'Bo APAC', region: 'apac' },
];

/** The record under test — it CARRIES the parent value the cascade asks for. */
const RECORD = { id: REC, title: 'Task one', region: 'emea', regional_owner: null, owner: null };

const FIELDS = {
  id: { type: 'text', label: 'Id' },
  title: { type: 'text', label: 'Title' },
  region: { type: 'text', label: 'Region' },
  /** DECLARED: gates until `region` is known. */
  regional_owner: { type: 'lookup', label: 'Regional owner', reference: REF, dependsOn: ['region'] },
  /** CONTROL: same reference, same record, no `dependsOn`. */
  owner: { type: 'lookup', label: 'Owner', reference: REF },
};

/** `highlightFields` selects which `InlineFieldInput` call site renders the pair. */
function objectsWith(highlightFields: string[]) {
  return [{ name: OBJECT, label: 'Task', managedBy: 'platform', highlightFields, fields: FIELDS }];
}

function makeDataSource() {
  return {
    find: vi.fn(async (objectName: string, params: any) => {
      if (objectName === REF) {
        let recs = PEOPLE;
        const f = params?.$filter;
        if (f && typeof f === 'object' && f.region) recs = recs.filter((p) => p.region === f.region);
        return { data: recs, total: recs.length, hasMore: false, pageSize: 50 };
      }
      return { data: [] };
    }),
    findOne: vi.fn(async (objectName: string, id: string) =>
      objectName === REF ? (PEOPLE.find((p) => p.id === id) ?? null) : { ...RECORD, id }),
    create: vi.fn(async (_o: string, row: any) => row),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    getObjectSchema: async (name: string) =>
      name === REF
        ? { name, fields: { id: { type: 'text' }, name: { type: 'text' }, region: { type: 'text' } } }
        : { name, fields: FIELDS },
  } as any;
}

function makeMetadata() {
  const pages: any[] = [];
  return {
    objects: [], pages, loading: false, error: null,
    refresh: async () => {}, invalidate: () => {},
    ensureType: async () => pages, getItem: async () => null,
    getItemsByType: () => pages,
  } as any;
}

function tree(ds: any, objects: any[]) {
  return (
    <MemoryRouter initialEntries={[`/app/demo/${OBJECT}/${REC}`]}>
      <MetadataCtx.Provider value={makeMetadata()}>
        <RecordDetailView
          dataSource={ds}
          objects={objects}
          onEdit={() => {}}
          objectNameOverride={OBJECT}
          recordIdOverride={REC}
          embedded
        />
      </MetadataCtx.Provider>
    </MemoryRouter>
  );
}

/**
 * Load the record page, enter inline edit off the `region` field, and hand back
 * the two lookup triggers. The strip and the details body share ONE inline-edit
 * session, so entering it anywhere puts both surfaces into edit mode.
 */
async function openInlineEdit(objects: any[]) {
  const { container } = render(tree(makeDataSource(), objects));
  await screen.findByText('Task one');
  fireEvent.doubleClick(screen.getByText('emea'));
  await waitFor(() => {
    expect(container.querySelectorAll('[data-testid^="lookup-trigger"]').length).toBe(2);
  });
  return {
    container,
    triggers: Array.from(container.querySelectorAll('[data-testid^="lookup-trigger"]')) as HTMLButtonElement[],
    gated: container.querySelector('[data-testid="lookup-trigger-gated"]') as HTMLButtonElement | null,
    control: container.querySelector('[data-testid="lookup-trigger-owner"]') as HTMLButtonElement | null,
  };
}

beforeAll(() => {
  // useIsMobile() keys off innerWidth (< 768 == mobile); pin a desktop width so
  // the desktop row carrying the double-click affordance renders.
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
});

beforeEach(() => {
  cleanup();
  // Unrelated chrome (approvals, favourites…) reaches for the platform API; in
  // jsdom that is a real socket. Answer it locally.
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify({ data: [] }), {
      status: 200, headers: { 'content-type': 'application/json' },
    })));
});

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('objectui#7190 — a `dependsOn` lookup on the app-shell record page', () => {
  it('gates in the DETAILS BODY while the control is usable and the parent value is on screen', async () => {
    // `region` alone is the strip, so both lookups fall through to the body →
    // `DetailSection`'s `InlineFieldInput` call site.
    const { container, triggers, gated, control } = await openInlineEdit(objectsWith(['region']));

    // Exactly two pickers: one per declared column, no double render.
    expect(triggers.length).toBe(2);

    // CONTROL — the same reference over the same record with no `dependsOn`.
    // Asserted enabled, not merely observed: a gated reading below would mean
    // nothing if the picker path were broken for both.
    expect(control).toBeTruthy();
    expect(control!.disabled).toBe(false);

    // The parent value the cascade asks for is RENDERED, in this very edit
    // session — so "the record does not know its region" is excluded.
    const regionInput = container.querySelector('[data-testid="inline-plain-text-input"]') as HTMLInputElement;
    expect(regionInput).toBeTruthy();
    expect(regionInput.value).toBe('emea');

    // THE DEFECT: gated anyway.
    expect(gated).toBeTruthy();
    expect(gated!.disabled).toBe(true);
    expect(gated!.textContent).toContain('Select region first');
  });

  it('gates in the HIGHLIGHTS STRIP too — the second call site, same verdict', async () => {
    // Both lookups declared as highlights → `HeaderHighlight`'s call site, and
    // `hideFields` keeps them out of the body, so the count stays 2.
    const { container, triggers, gated, control } =
      await openInlineEdit(objectsWith(['region', 'regional_owner', 'owner']));

    expect(triggers.length).toBe(2);

    expect(control).toBeTruthy();
    expect(control!.disabled).toBe(false);

    const regionInput = container.querySelector('[data-testid="inline-plain-text-input"]') as HTMLInputElement;
    expect(regionInput).toBeTruthy();
    expect(regionInput.value).toBe('emea');

    expect(gated).toBeTruthy();
    expect(gated!.disabled).toBe(true);
    expect(gated!.textContent).toContain('Select region first');
  });
});
