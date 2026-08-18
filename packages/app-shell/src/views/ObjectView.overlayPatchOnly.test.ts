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
 * The half pinned HERE is the read: an overlay contributes only the keys it
 * owns (`VIEW_OVERLAY_OWNED_KEYS`), so every base key already frozen into
 * every stored row stops shadowing the source. That is the issue's third
 * disposition for existing rows — tolerate on read — chosen deliberately and
 * pinned rather than assumed, which is the difference the issue draws between
 * tolerance and SILENT tolerance. See the PR body for why strip-on-next-write
 * and migrate were not chosen, and for the measured platform constraint that
 * keeps the write half (patch-only at rest) out of this change.
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
import { buildViewTabs, loadViewOverrides, sanitizeViewOverride } from './ObjectView';

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
    it('a column drag writes an overlay; the admin then edits the filter; the user sees the NEW filter', async () => {
        const { meta } = makeMetaStore();
        const ds = makeAdapter(meta);

        // EXACTLY what `persistViewPatch` sends for a column drag on a system
        // view: the whole active tab, plus the one key the user actually
        // changed. `isSavedView` is omitted — this is the system-view case,
        // the one that lays an overlay ON TOP of a code-defined view.
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
