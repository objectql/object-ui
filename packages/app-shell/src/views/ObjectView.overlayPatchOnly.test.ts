/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5233 — a personalization overlay must not freeze the source view.
 *
 * `persistViewPatch` sends `{ ...baseViewDef, ...patch }`, so an overlay
 * written by a mere column drag copies the view's CURRENT effective `filter`
 * (and `columns`, `label`, `type`, `isDefault` …) into the stored row. The
 * display merge is `{ ...source, ...override }`, so that copy then outranks
 * the source view forever: an admin edits the view's filter and every user who
 * once resized a column keeps the old filter, with nothing reporting it.
 *
 * Ruled by the maintainer on 2026-08-12 (objectstack#7494, comment
 * 5261754173): "`persistViewPatch` 只存 patch,不存 merged base … 这与 per-user
 * 之争无关,是纯粹的存储形状错误."
 *
 * BOTH halves are pinned here now.
 *
 * - **read** (PR #5272): an overlay contributes only the keys it owns
 *   (`VIEW_OVERLAY_OWNED_KEYS`), so every base key already frozen into every
 *   stored row stops shadowing the source. That is the issue's third
 *   disposition for existing rows — tolerate on read — chosen deliberately and
 *   pinned rather than assumed, which is the difference the issue draws between
 *   tolerance and SILENT tolerance.
 * - **write** (this change): `persistViewPatch` stores the PATCH ALONE for a
 *   system view's overlay ({@link buildPersistedViewBody}), so no new row
 *   freezes anything — and because `saveItem` is a whole-document PUT, the next
 *   toggle also strips an old fat row. It was blocked until `columnState` was
 *   admitted to the view-metadata surface as an explicitly runtime-only overlay
 *   key (objectstack#9933, released in `@objectstack/spec` 17.1.0); before that
 *   a `columnState`-only patch was refused `422 INVALID_METADATA` and the fat
 *   copy was the only thing supplying a recognized key.
 *
 * A *saved* view's own row is deliberately NOT narrowed: for it the body IS the
 * view, `saveItem` PUTs the whole document, and a patch-only write would delete
 * the user's view rather than narrow it. That branch is pinned too — a guard
 * that correctly SURVIVES is the one that says the narrowing stopped where it
 * should.
 *
 * Written round-trip through the REAL adapter write + read and the REAL
 * consumer merge (`loadViewOverrides` → `buildViewTabs`), not against a
 * hand-written override fixture: the defect lives in what the write path
 * stores, so a fixture is exactly where it would hide.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ObjectStackAdapter, VIEW_OVERLAY_OWNED_KEYS } from '@object-ui/data-objectstack';
import { buildPersistedViewBody, buildViewTabs, loadViewOverrides, sanitizeViewOverride } from './ObjectView';

const OBJECT_NAME = 'crm_lead';
const VIEW_ID = 'crm_lead.default';

/** The code-defined view, as the object metadata declares it TODAY. */
const SOURCE_VIEW_AT_WRITE_TIME = {
    name: VIEW_ID,
    label: 'All Leads',
    type: 'grid',
    columns: ['name', 'status'],
    filter: [{ field: 'status', operator: 'equals', value: 'open' }],
    isDefault: true,
};

/** The same view AFTER an admin edits its filter (and its column set). */
const SOURCE_VIEW_AFTER_ADMIN_EDIT = {
    ...SOURCE_VIEW_AT_WRITE_TIME,
    label: 'All Leads (active)',
    columns: ['name', 'status', 'owner'],
    filter: [{ field: 'status', operator: 'equals', value: 'qualified' }],
};

/** A stub metadata store keyed the way `sys_metadata` is: `type` + `name`. */
function makeMetaStore() {
    const rows = new Map<string, any>();
    const meta = {
        getItems: vi.fn(async (type: string) => ({
            type,
            items: [...rows.entries()].filter(([k]) => k.startsWith(`${type}::`)).map(([, v]) => v),
        })),
        getItem: vi.fn(async (type: string, name: string) => {
            const item = rows.get(`${type}::${name}`);
            if (!item) {
                const err: any = new Error(`Not found: ${type}/${name}`);
                err.status = 404;
                throw err;
            }
            return { type, name, item };
        }),
        saveItem: vi.fn(async (type: string, name: string, item: any) => {
            rows.set(`${type}::${name}`, { ...item });
            return { success: true, item: rows.get(`${type}::${name}`) };
        }),
    };
    return { meta, rows };
}

function makeAdapter(meta: any) {
    const ds: any = new ObjectStackAdapter({
        baseUrl: 'http://test.local',
        fetch: vi.fn(async () =>
            new Response(JSON.stringify({ success: true, data: { capabilities: {}, routes: {} } }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })),
    });
    ds.connected = true;
    ds.connectionState = 'connected';
    ds.client = { meta };
    return ds;
}

const fallbackTab = () => ({ id: 'all', label: 'All records', type: 'grid', columns: [] });

/** The tab the switcher renders for `VIEW_ID`, built the way `ObjectView` builds it. */
async function tabAfterAdminEdit(ds: any) {
    const viewOverrides = await loadViewOverrides(ds, OBJECT_NAME, [VIEW_ID]);
    const tabs = buildViewTabs({
        definedViews: { [VIEW_ID]: SOURCE_VIEW_AFTER_ADMIN_EDIT },
        savedViews: [],
        viewOverrides,
        fallbackTab,
    });
    return tabs.find((t) => t.id === VIEW_ID)!;
}

describe('objectui#5233 — a source-view filter change reaches users who have an overlay', () => {
    it('a PRE-FIX fat overlay no longer shadows the source view on read', async () => {
        const { meta } = makeMetaStore();
        const ds = makeAdapter(meta);

        // EXACTLY what `persistViewPatch` USED TO send for a column drag on a
        // system view: the whole active tab, plus the one key the user
        // actually changed. Since the write half landed it sends the patch
        // alone (pinned in the WRITE describe below), so this body is now a
        // row an install has been carrying since before the fix — written here
        // through the REAL adapter rather than dropped into the store, so the
        // legacy shape is produced by a real write path and not by a fixture.
        // `isSavedView` is omitted — this is the system-view case, the one
        // that lays an overlay ON TOP of a code-defined view.
        await ds.updateViewConfig(OBJECT_NAME, VIEW_ID, {
            ...SOURCE_VIEW_AT_WRITE_TIME,
            columnState: { order: ['status', 'name'], widths: { name: 220 } },
        });

        // The row really did capture the source view verbatim — the defect in
        // one assertion, measured at rest rather than assumed.
        const stored = (await ds.listViewOverrides(OBJECT_NAME))[VIEW_ID];
        expect(stored.filter).toEqual(SOURCE_VIEW_AT_WRITE_TIME.filter);

        const tab = await tabAfterAdminEdit(ds);

        // The whole card: the admin's edit reaches this user.
        expect(tab.filter).toEqual(SOURCE_VIEW_AFTER_ADMIN_EDIT.filter);
        // …and so does every other key the overlay had frozen alongside it.
        expect(tab.columns).toEqual(SOURCE_VIEW_AFTER_ADMIN_EDIT.columns);
        expect(tab.label).toBe(SOURCE_VIEW_AFTER_ADMIN_EDIT.label);
    });

    it('the overlay still carries what it was written for', async () => {
        const { meta } = makeMetaStore();
        const ds = makeAdapter(meta);

        await ds.updateViewConfig(OBJECT_NAME, VIEW_ID, {
            ...SOURCE_VIEW_AT_WRITE_TIME,
            columnState: { order: ['status', 'name'], widths: { name: 220 } },
            sort: [{ field: 'created_at', order: 'desc' }],
            hiddenFields: ['owner'],
            rowHeight: 'compact',
            inlineEdit: true,
        });

        const tab = await tabAfterAdminEdit(ds);

        expect(tab.columnState).toEqual({ order: ['status', 'name'], widths: { name: 220 } });
        expect(tab.sort).toEqual([{ field: 'created_at', order: 'desc' }]);
        expect(tab.hiddenFields).toEqual(['owner']);
        expect(tab.rowHeight).toBe('compact');
        expect(tab.inlineEdit).toBe(true);
        // Narrowing is not amnesia: the personalization survives a reload,
        // which is the whole reason these rows exist.
        expect(tab.filter).toEqual(SOURCE_VIEW_AFTER_ADMIN_EDIT.filter);
    });
});

/**
 * The write half — the ruled change, and the one this card was reopened for.
 *
 * Driven through the REAL seam `persistViewPatch` calls
 * ({@link buildPersistedViewBody}) and the REAL adapter write + read, not a
 * hand-written body: the defect lives in what the write path stores, so a
 * fixture is exactly where it would hide.
 */
describe('objectui#5233 WRITE — a system view\'s overlay stores the patch ONLY', () => {
    /** The active tab a column drag fires on: source view + its runtime id. */
    const ACTIVE_TAB = { id: VIEW_ID, viewKind: 'list', ...SOURCE_VIEW_AT_WRITE_TIME };
    const DRAG = { columnState: { order: ['status', 'name'], widths: { name: 220 } } };

    it('the body carries the patch and NOTHING the source view owns', () => {
        const body = buildPersistedViewBody(ACTIVE_TAB, DRAG, { isSavedView: false });

        expect(body.columnState).toEqual(DRAG.columnState);
        // Every key the old `{ ...baseViewDef, ...patch }` spread copied in.
        // Spelled out one per line rather than as a key-set equality so a
        // failure names the key that leaked.
        expect(body).not.toHaveProperty('filter');
        expect(body).not.toHaveProperty('columns');
        expect(body).not.toHaveProperty('label');
        expect(body).not.toHaveProperty('type');
        expect(body).not.toHaveProperty('isDefault');
        expect(body).not.toHaveProperty('id');
        expect(body).not.toHaveProperty('name');
        // Identity the reader keeps (`VIEW_OVERLAY_IDENTITY_KEYS`) — `object`,
        // `name` and the marker are stamped by `updateViewConfig` itself.
        expect(body.viewKind).toBe('list');
        expect(Object.keys(body).sort()).toEqual(['columnState', 'viewKind']);
    });

    it('omits `viewKind` when the active tab has none — it is inherited, not invented', () => {
        const { viewKind: _dropped, ...tabWithoutKind } = ACTIVE_TAB;
        const body = buildPersistedViewBody(tabWithoutKind, DRAG, { isSavedView: false });
        expect(Object.keys(body)).toEqual(['columnState']);
    });

    it('writes a row that carries no source key AT REST, and the admin edit still reaches the user', async () => {
        const { meta } = makeMetaStore();
        const ds = makeAdapter(meta);

        // What `persistViewPatch` now sends for that drag.
        await ds.updateViewConfig(
            OBJECT_NAME,
            VIEW_ID,
            buildPersistedViewBody(ACTIVE_TAB, DRAG, { isSavedView: false }),
        );

        // Half one of the pair: the stored BYTES. `listViewOverrides` answers
        // with the stored document (it does not narrow — that is
        // `sanitizeViewOverride`'s job), so this reads the row as any consumer
        // outside objectui sees it: Studio, the server-side switcher.
        const stored = (await ds.listViewOverrides(OBJECT_NAME))[VIEW_ID];
        expect(stored).toBeDefined();
        expect(stored).not.toHaveProperty('filter');
        expect(stored).not.toHaveProperty('columns');
        expect(stored).not.toHaveProperty('label');
        expect(stored).not.toHaveProperty('type');
        expect(stored).not.toHaveProperty('isDefault');
        expect(stored.columnState).toEqual(DRAG.columnState);
        // Still addressable, and still says what kind of row it is.
        expect(stored.name).toBe(VIEW_ID);
        expect(stored.object).toBe(OBJECT_NAME);
        expect(stored.viewKind).toBe('list');
        expect(stored._isOverride).toBe(true);

        // Half two: the user-visible defect. The admin edits the view's filter
        // and the user who dragged a column sees the NEW one.
        const tab = await tabAfterAdminEdit(ds);
        expect(tab.filter).toEqual(SOURCE_VIEW_AFTER_ADMIN_EDIT.filter);
        expect(tab.columns).toEqual(SOURCE_VIEW_AFTER_ADMIN_EDIT.columns);
        expect(tab.label).toBe(SOURCE_VIEW_AFTER_ADMIN_EDIT.label);
        // Narrowing is not amnesia — the drag survived the reload.
        expect(tab.columnState).toEqual(DRAG.columnState);
    });

    it('a reader OUTSIDE objectui — no read-side narrowing — now sees the admin edit too', async () => {
        // The half the read-side narrowing could never reach, and the reason
        // the maintainer called the surviving fat write a transition rather
        // than an end state: `narrowPersonalizationOverlay` lives in objectui's
        // own merge seam. Studio and the server-side switcher merge the STORED
        // DOCUMENT over the source view with no such pass, so for them the
        // frozen copy still won. Modelled as the bare merge those readers do.
        const { meta } = makeMetaStore();
        const ds = makeAdapter(meta);
        const rawMerge = async () => ({
            ...SOURCE_VIEW_AFTER_ADMIN_EDIT,
            ...(await ds.listViewOverrides(OBJECT_NAME))[VIEW_ID],
        });

        // Control first — the SAME reader against a pre-fix row, so the
        // assertions below are a measurement and not a tautology.
        await ds.updateViewConfig(OBJECT_NAME, VIEW_ID, { ...SOURCE_VIEW_AT_WRITE_TIME, ...DRAG });
        const before: any = await rawMerge();
        expect(before.filter).toEqual(SOURCE_VIEW_AT_WRITE_TIME.filter);
        expect(before.label).toBe(SOURCE_VIEW_AT_WRITE_TIME.label);
        expect(before.columns).toEqual(SOURCE_VIEW_AT_WRITE_TIME.columns);

        // The same drag, written the way it is written now.
        await ds.updateViewConfig(
            OBJECT_NAME,
            VIEW_ID,
            buildPersistedViewBody(ACTIVE_TAB, DRAG, { isSavedView: false }),
        );
        const after: any = await rawMerge();
        expect(after.filter).toEqual(SOURCE_VIEW_AFTER_ADMIN_EDIT.filter);
        expect(after.label).toBe(SOURCE_VIEW_AFTER_ADMIN_EDIT.label);
        expect(after.columns).toEqual(SOURCE_VIEW_AFTER_ADMIN_EDIT.columns);
        expect(after.columnState).toEqual(DRAG.columnState);
    });

    it('the batched multi-key patch is written whole, and still carries nothing else', async () => {
        const { meta } = makeMetaStore();
        const ds = makeAdapter(meta);

        // `persistViewPatch` debounces concurrent toggles into ONE payload, so
        // the seam must pass a merged multi-key patch through unfiltered — all
        // five owned keys at once is the widest real payload.
        const batched = {
            ...DRAG,
            sort: [{ field: 'created_at', order: 'desc' }],
            hiddenFields: ['owner'],
            rowHeight: 'compact',
            inlineEdit: true,
        };
        await ds.updateViewConfig(
            OBJECT_NAME,
            VIEW_ID,
            buildPersistedViewBody(ACTIVE_TAB, batched, { isSavedView: false }),
        );

        const stored = (await ds.listViewOverrides(OBJECT_NAME))[VIEW_ID];
        expect(stored).not.toHaveProperty('filter');
        for (const key of VIEW_OVERLAY_OWNED_KEYS) {
            expect(stored, `the write dropped the owned key \`${key}\``).toHaveProperty(key);
        }

        const tab = await tabAfterAdminEdit(ds);
        expect(tab.sort).toEqual(batched.sort);
        expect(tab.hiddenFields).toEqual(['owner']);
        expect(tab.rowHeight).toBe('compact');
        expect(tab.inlineEdit).toBe(true);
        expect(tab.filter).toEqual(SOURCE_VIEW_AFTER_ADMIN_EDIT.filter);
    });

    it('the NEXT write strips a row already stored in the fat shape — PUT replaces the document', async () => {
        const { meta, rows } = makeMetaStore();
        const ds = makeAdapter(meta);

        // An install that has been running the pre-fix write path.
        rows.set(`view::${VIEW_ID}`, {
            ...SOURCE_VIEW_AT_WRITE_TIME,
            object: OBJECT_NAME,
            viewKind: 'list',
            columnState: { order: ['name', 'status'] },
            _isOverride: true,
        });

        // The user drags a column once more.
        await ds.updateViewConfig(
            OBJECT_NAME,
            VIEW_ID,
            buildPersistedViewBody(ACTIVE_TAB, DRAG, { isSavedView: false }),
        );

        // `client.meta.saveItem` is a PUT of the whole document, so the frozen
        // copy is gone from the BYTES — not merely masked on read. This is the
        // issue's "strip on next write" disposition arriving as a consequence
        // of the narrowing, alongside the tolerate-on-read half that already
        // shipped; neither is silent, both are pinned.
        const stored = (await ds.listViewOverrides(OBJECT_NAME))[VIEW_ID];
        expect(stored).not.toHaveProperty('filter');
        expect(stored).not.toHaveProperty('columns');
        expect(stored.columnState).toEqual(DRAG.columnState);
    });
});

describe('objectui#5233 WRITE — a SAVED view\'s own row is deliberately not narrowed', () => {
    const SAVED_ID = 'crm_lead.my_pipeline';

    /**
     * The row a user's own view has, and the tab `buildViewTabs` builds from
     * it (flattened — `...sv` spreads the row's top-level keys onto the tab).
     */
    const SAVED_ROW = {
        name: SAVED_ID,
        object: OBJECT_NAME,
        viewKind: 'list',
        label: 'My Pipeline',
        type: 'kanban',
        columns: ['name', 'owner'],
        filter: [{ field: 'owner', operator: 'equals', value: 'u1' }],
        config: { type: 'kanban', columns: ['name', 'owner'] },
    };
    const SAVED_TAB = { id: SAVED_ID, ...SAVED_ROW };

    it('carries the whole body — a patch-only PUT here would DELETE the user\'s view', () => {
        const body = buildPersistedViewBody(SAVED_TAB, { sort: [{ field: 'name', order: 'asc' }] }, { isSavedView: true });

        // This is the guard that must SURVIVE the narrowing, and it is worth
        // more than the ones that had to move: it says where the fix stops.
        // The row IS the view here — there is no source view underneath it for
        // a copied key to shadow, so the ruled harm cannot arise, while a
        // patch-only write would drop `config`/`columns`/`filter`/`label` on a
        // whole-document PUT and take the user's view with it.
        expect(body.config).toEqual(SAVED_ROW.config);
        expect(body.columns).toEqual(SAVED_ROW.columns);
        expect(body.filter).toEqual(SAVED_ROW.filter);
        expect(body.label).toBe('My Pipeline');
        expect(body.sort).toEqual([{ field: 'name', order: 'asc' }]);
    });

    it('a toolbar toggle on a saved view leaves its definition intact at rest', async () => {
        const { meta, rows } = makeMetaStore();
        const ds = makeAdapter(meta);
        rows.set(`view::${SAVED_ID}`, { ...SAVED_ROW });

        await ds.updateViewConfig(
            OBJECT_NAME,
            SAVED_ID,
            buildPersistedViewBody(SAVED_TAB, { rowHeight: 'compact' }, { isSavedView: true }),
            { isSavedView: true },
        );

        const stored = rows.get(`view::${SAVED_ID}`);
        expect(stored.config).toEqual(SAVED_ROW.config);
        expect(stored.columns).toEqual(SAVED_ROW.columns);
        expect(stored.filter).toEqual(SAVED_ROW.filter);
        expect(stored.label).toBe('My Pipeline');
        expect(stored.rowHeight).toBe('compact');
        // The marker stays withheld: stamping it would make `listViews()`
        // exclude the user's own view from the switcher (objectui#4227).
        expect(stored).not.toHaveProperty('_isOverride');
    });
});

describe('objectui#5233 — rows written BEFORE this fix (the disposition, pinned)', () => {
    /**
     * The decision this test encodes: existing rows are TOLERATED ON READ, not
     * stripped-on-next-write and not migrated. So a row already carrying the
     * frozen body behaves correctly on the very next page load, without its
     * user having to touch that view again and without an operator running
     * anything.
     */
    it('a row stored in the old shape stops shadowing the source on the NEXT READ — no write, no migration', async () => {
        const { meta, rows } = makeMetaStore();
        const ds = makeAdapter(meta);

        // Put the row in the store directly: this is the state of an install
        // that has been running the pre-fix write path, not something this
        // code path just produced.
        rows.set(`view::${VIEW_ID}`, {
            ...SOURCE_VIEW_AT_WRITE_TIME,
            object: OBJECT_NAME,
            viewKind: 'list',
            columnState: { order: ['status', 'name'] },
            _isOverride: true,
        });

        const tab = await tabAfterAdminEdit(ds);

        expect(tab.filter).toEqual(SOURCE_VIEW_AFTER_ADMIN_EDIT.filter);
        expect(tab.columns).toEqual(SOURCE_VIEW_AFTER_ADMIN_EDIT.columns);
        expect(tab.columnState).toEqual({ order: ['status', 'name'] });
        // Nothing was rewritten to achieve that — the row is untouched at rest.
        expect(meta.saveItem).not.toHaveBeenCalled();
    });

    it('a PRE-MARKER legacy row is narrowed by the same predicate listViews() excludes it by', async () => {
        const { meta, rows } = makeMetaStore();
        const ds = makeAdapter(meta);

        // Written before `_isOverride` existed (objectui#4227): flat body, and
        // a `viewKind` only the platform's registry-backed identity heal can
        // have put there.
        rows.set(`view::${VIEW_ID}`, {
            ...SOURCE_VIEW_AT_WRITE_TIME,
            object: OBJECT_NAME,
            viewKind: 'list',
            sort: [{ field: 'created_at', order: 'desc' }],
        });

        const tab = await tabAfterAdminEdit(ds);

        expect(tab.filter).toEqual(SOURCE_VIEW_AFTER_ADMIN_EDIT.filter);
        expect(tab.sort).toEqual([{ field: 'created_at', order: 'desc' }]);
    });
});

describe('objectui#5233 — what must NOT be narrowed', () => {
    it("a saved view's OWN body keeps every key its author wrote", async () => {
        // The runtime "Add View" shape (app-shell's `viewEnvelope`): nested
        // `config`, no marker. For this row the body IS the view — narrowing it
        // would delete a user's own view definition on read.
        const savedRow = {
            name: 'crm_lead.my_pipeline',
            object: OBJECT_NAME,
            viewKind: 'list',
            label: 'My Pipeline',
            config: { type: 'kanban', columns: ['name'] },
            filter: [{ field: 'owner', operator: 'equals', value: 'u1' }],
        };
        expect(sanitizeViewOverride(savedRow)).toBe(savedRow);
    });

    it('an explicit-save override still wins over the source filter (#4155 contract)', () => {
        // No marker, no legacy signature → not a personalization overlay. This
        // is the case `ObjectView.overlayFilterRecovery.test.tsx` already pins;
        // restated here because #5233's narrowing runs FIRST and must not eat it.
        const saved = { name: 'wo.mine', filter: [{ field: 'owner', operator: 'equals', value: 'u1' }] };
        expect(sanitizeViewOverride(saved)).toEqual(saved);
    });
});

describe('objectui#5233 ratchet — the owned-key list tracks the writers', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const objectViewSrc = readFileSync(path.join(here, 'ObjectView.tsx'), 'utf8');

    /**
     * Every `persistViewPatch(…, { key … })` in the file. The overlay's owned
     * keys and the calls that WRITE them are two statements of one fact, in two
     * packages; when they drift, the read silently drops a key the user just
     * set and nothing fails. This is the guard that makes that drift loud.
     */
    const PERSIST_CALLS = /persistViewPatch\s*\([^;]*?\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*[:,}]/gs;

    it('the ratchet is reading real source', () => {
        expect(objectViewSrc.length).toBeGreaterThan(10_000);
        expect(objectViewSrc).toContain('persistViewPatch');
    });

    /**
     * The seam above is pure and exported, so its behaviour is pinned without
     * mounting the view — but nothing in those assertions says `ObjectView`
     * still USES it. A revert to the old spread would leave every
     * `buildPersistedViewBody` test green while the product went back to
     * freezing the source view, which is the one failure this file exists to
     * make impossible. Source-level because that wiring has no other seam: the
     * caller is a `useCallback` inside a ~2700-line component.
     */
    it('the toolbar write routes its body through `buildPersistedViewBody`', () => {
        const call = objectViewSrc.match(/dataSource\.updateViewConfig\(([\s\S]{0,400}?)\{\s*isSavedView/);
        // Vacuous-pass guard: no match means the call site was renamed or
        // restructured, not that it is clean.
        expect(call, 'the `dataSource.updateViewConfig(...)` call site was not found').toBeTruthy();
        expect(call![1]).toContain('buildPersistedViewBody(');
        // The exact spread the ruling removed, in the shape it had.
        expect(call![1]).not.toMatch(/\.\.\.\s*baseViewDef/);
    });

    it('every key the toolbar persists is a key the overlay is allowed to own', () => {
        const written = [...new Set([...objectViewSrc.matchAll(PERSIST_CALLS)].map((m) => m[1]!))];
        // Vacuous-pass guard: the call sites are the evidence, so an empty
        // match set means the regex stopped matching, not that nothing writes.
        expect(written.length).toBeGreaterThanOrEqual(5);
        for (const key of written) {
            expect(
                VIEW_OVERLAY_OWNED_KEYS as readonly string[],
                `\`persistViewPatch\` writes \`${key}\`, which a personalization overlay is not allowed to own — `
                + 'add it to VIEW_OVERLAY_OWNED_KEYS (@object-ui/data-objectstack) or stop persisting it (objectui#5233)',
            ).toContain(key);
        }
    });
});
