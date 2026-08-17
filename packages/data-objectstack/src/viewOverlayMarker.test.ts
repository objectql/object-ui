/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4227 — a system view's personalization row must never read back
 * from `listViews()` as a saved view. Toggling density/sort/hiddenFields/
 * columnState/inlineEdit on a code-defined view stamped `type='view'` /
 * `name=<viewId>` rows that `listViews()` could not tell apart from a
 * genuine user-created view, so the switcher tab lost its readonly lock and
 * gained Rename/Delete/Set-default/Pin against a view that lives in code.
 *
 * The fix has two layers, both pinned here end-to-end against a fake
 * `sys_metadata` store (round-trip, not a hand-written read fixture — the
 * write path is exactly where a shape mismatch would hide):
 *
 *   1. `updateViewConfig` — the ONLY production writer of personalization
 *      rows — stamps an explicit `_isOverride` marker on every row it saves.
 *   2. `listViews()` excludes any row carrying that marker, AND (for rows
 *      already persisted before this fix shipped) a best-effort legacy
 *      shape: flat body + a `viewKind` the platform can only have backfilled
 *      from a REGISTRY baseline (objectstack#2555 / #7741) — which a
 *      genuine runtime-created saved view never has.
 *
 * `listViewOverrides` (the batch personalization reader `ObjectView` merges
 * for DISPLAY) is a separate, unchanged consumer of the same rows — it is
 * supposed to see overlay rows, so this fix must not touch it.
 */

import { describe, it, expect, vi } from 'vitest';
import { ObjectStackAdapter } from './index';

/** A stub metadata store keyed the way `sys_metadata` is: `type` + `name`. */
function makeMetaStore() {
  const rows = new Map<string, any>();
  const meta = {
    getItems: vi.fn(async (type: string) => {
      const items = [...rows.entries()]
        .filter(([k]) => k.startsWith(`${type}::`))
        .map(([, v]) => v);
      return { type, items };
    }),
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

function makeDS(meta: any) {
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

describe('updateViewConfig stamps the overlay marker (objectui#4227)', () => {
  it('every saved item carries `_isOverride: true`', async () => {
    const { meta } = makeMetaStore();
    const ds = makeDS(meta);

    await ds.updateViewConfig('crm_lead', 'crm_lead.default', { rowHeight: 40 });

    expect(meta.saveItem).toHaveBeenCalledWith(
      'view',
      'crm_lead.default',
      expect.objectContaining({ _isOverride: true }),
    );
  });

  it('a caller-supplied `_isOverride` cannot un-mark the row — stamped last', async () => {
    const { meta } = makeMetaStore();
    const ds = makeDS(meta);

    // `persistViewPatch` spreads the whole active tab into the write; nothing
    // in that spread should be able to defeat the marker.
    await ds.updateViewConfig('crm_lead', 'crm_lead.default', { _isOverride: false, rowHeight: 40 } as any);

    expect(meta.saveItem).toHaveBeenCalledWith(
      'view',
      'crm_lead.default',
      expect.objectContaining({ _isOverride: true }),
    );
  });

  it('createView does NOT stamp the marker — it is a genuine saved view', async () => {
    const { meta } = makeMetaStore();
    const ds = makeDS(meta);

    await ds.createView('crm_lead', { name: 'crm_lead.custom', label: 'Custom', type: 'grid' });

    const [, , saved] = meta.saveItem.mock.calls[0]!;
    expect(saved._isOverride).toBeUndefined();
  });

  it('opts.isSavedView withholds the marker — a toggle on a SAVED view must not flag its own row (objectui#4227 follow-up, PR #4713)', async () => {
    const { meta } = makeMetaStore();
    const ds = makeDS(meta);

    // Exactly what `persistViewPatch` sends for a toggle on the ACTIVE tab
    // when that tab is already a saved view — `isSavedView: true`.
    await ds.updateViewConfig('crm_lead', 'crm_lead.my_pipeline', {
      type: 'kanban', label: 'My Pipeline', rowHeight: 40,
    }, { isSavedView: true });

    expect(meta.saveItem).toHaveBeenCalledWith(
      'view',
      'crm_lead.my_pipeline',
      expect.not.objectContaining({ _isOverride: true }),
    );
  });
});

describe('end-to-end: a toolbar toggle on a system view never masquerades as saved (objectui#4227)', () => {
  it('round-trips through the real write + read: excluded from listViews, still present in listViewOverrides', async () => {
    const { meta } = makeMetaStore();
    const ds = makeDS(meta);

    // The exact user action the issue reports: density toggle on a
    // code-defined view, going through the real adapter write path.
    await ds.updateViewConfig('crm_lead', 'crm_lead.default', {
      type: 'grid',
      data: { provider: 'object', object: 'crm_lead' },
      columns: ['name', 'status'],
      rowHeight: 40,
    });

    // `listViews()` — feeds `savedViews` / the switcher's mutability gate —
    // must NOT return the override as a saved view.
    const savedViews = await ds.listViews('crm_lead');
    expect(savedViews).toEqual([]);

    // `listViewOverrides()` — feeds the DISPLAY merge (viewOverrides) — is a
    // different, legitimate reader of the SAME row and must still see it.
    const overrides = await ds.listViewOverrides('crm_lead');
    expect(overrides['crm_lead.default']).toMatchObject({ rowHeight: 40 });
  });

  it('a genuinely created view survives the same round trip as fully manageable', async () => {
    const { meta } = makeMetaStore();
    const ds = makeDS(meta);

    await ds.createView('crm_lead', {
      name: 'crm_lead.my_pipeline',
      label: 'My Pipeline',
      type: 'kanban',
    });

    const savedViews = await ds.listViews('crm_lead');
    expect(savedViews.map((v: any) => v.name)).toEqual(['crm_lead.my_pipeline']);
  });

  // ── objectui#4227 follow-up (PM review on PR #4713): the danger sequence
  //    createView -> toggle its own toolbar -> listViews() -- that PR's own
  //    round-trip tests covered createView->listViews (no toggle) and a
  //    toggle on a SYSTEM view's id, but not a toggle on a SAVED view's own
  //    id, which is exactly what a user does immediately after creating a
  //    view and adjusting its density. ──────────────────────────────────────
  describe('a toggle on a SAVED view must not make it vanish (objectui#4227 follow-up)', () => {
    /** The real production shape a runtime "Add View" produces (app-shell's
     *  `viewEnvelope`, via the ADR-0034 seam) -- nested `config`, `viewKind`
     *  OUTSIDE it. `ObjectStackAdapter.createView`'s own flat `fullSpec` is
     *  NOT this shape and is not the path the console's UI actually uses
     *  (`viewEnvelope` + `persistRuntimeMetadata` write through a separate
     *  `MetadataClient`, bypassing this adapter's `createView` entirely) --
     *  using the real shape here is what makes this a genuine regression
     *  pin rather than one that only exercises the adapter's own writer.
     */
    const savedViewRow = {
      name: 'crm_lead.my_pipeline',
      object: 'crm_lead',
      viewKind: 'list',
      label: 'My Pipeline',
      config: {
        type: 'kanban',
        data: { provider: 'object', object: 'crm_lead' },
        columns: ['name', 'status'],
      },
    };

    it('createView -> toggle density on THAT SAME view -> listViews() still returns it (the fix)', async () => {
      const { meta, rows } = makeMetaStore();
      rows.set('view::crm_lead.my_pipeline', savedViewRow);
      const ds = makeDS(meta);

      // Sanity: the saved view is visible before any toggle.
      expect((await ds.listViews('crm_lead')).map((v: any) => v.name))
        .toEqual(['crm_lead.my_pipeline']);

      // `persistViewPatch` spreads the ACTIVE TAB (the flattened saved view
      // `listViews()` just returned) plus the toggle's patch, and — with
      // this fix — passes `isSavedView: true` because `isSavedViewId`
      // already found this id in `savedViews`.
      await ds.updateViewConfig('crm_lead', 'crm_lead.my_pipeline', {
        type: 'kanban',
        label: 'My Pipeline',
        columns: ['name', 'status'],
        rowHeight: 40, // the toggle itself
      }, { isSavedView: true });

      const afterToggle = await ds.listViews('crm_lead');
      expect(afterToggle.map((v: any) => v.name)).toEqual(['crm_lead.my_pipeline']);
      // The tab stays fully manageable: `isSavedViewId`/`viewRowId` match on
      // `name`, which the write preserved.
      expect(afterToggle[0]).toMatchObject({ name: 'crm_lead.my_pipeline', rowHeight: 40 });
    });

    it('the same sequence WITHOUT the fix (isSavedView omitted) is the regression this pins against', async () => {
      const { meta, rows } = makeMetaStore();
      rows.set('view::crm_lead.my_pipeline', savedViewRow);
      const ds = makeDS(meta);

      // Same toggle, but as `updateViewConfig` behaved before this
      // follow-up (no `isSavedView` signal) — demonstrates why the signal
      // is load-bearing, not decorative.
      await ds.updateViewConfig('crm_lead', 'crm_lead.my_pipeline', {
        type: 'kanban',
        label: 'My Pipeline',
        columns: ['name', 'status'],
        rowHeight: 40,
      });

      // The user's own saved view has vanished from the switcher.
      expect(await ds.listViews('crm_lead')).toEqual([]);
    });
  });
});
