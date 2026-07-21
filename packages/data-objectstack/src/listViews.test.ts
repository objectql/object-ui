/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { ObjectStackAdapter } from './index';

/**
 * `listViews(object)` feeds the list-view switcher (ObjectView → ViewTabBar),
 * so it must return LIST-family views only. The backend exposes each view as
 * an independent ViewItem carrying a `viewKind` discriminant (ADR-0017); a
 * form-family view (e.g. `crm_activity.default`) must NOT leak in as a tab.
 */
function makeDS(items: any[]) {
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
  ds.client = { meta: { getItems: vi.fn(async () => ({ items })) } };
  return ds;
}

/**
 * A DS whose HTTP layer answers the `?preview=draft` metadata route with a
 * pre-overlaid list (the shape the framework already returns: draft wins by
 * name, each draft tagged `_draft`). The published `client.meta.getItems` stub
 * is present but MUST NOT be used in preview mode.
 */
function makeDraftDS(overlaid: any[]) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/meta/view')) {
      return new Response(JSON.stringify({ items: overlaid }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ success: true, data: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const ds: any = new ObjectStackAdapter({ baseUrl: 'http://test.local', fetch: fetchImpl });
  ds.connected = true;
  ds.connectionState = 'connected';
  ds.client = { meta: { getItems: vi.fn(async () => ({ items: [] })) } };
  return { ds, fetchImpl };
}

describe('ObjectStackDataSource.listViews', () => {
  // The crm_activity view set as the framework expands it.
  const listAll = {
    name: 'crm_activity.all', object: 'crm_activity', viewKind: 'list', isDefault: true,
    label: 'All Activities', config: { type: 'grid', data: { object: 'crm_activity' } },
  };
  const listCalendar = {
    name: 'crm_activity.calendar', object: 'crm_activity', viewKind: 'list',
    label: 'Activity Calendar', config: { type: 'calendar', data: { object: 'crm_activity' } },
  };
  const formDefault = {
    name: 'crm_activity.default', object: 'crm_activity', viewKind: 'form',
    label: 'Activity', config: { type: 'simple' },
  };

  it('excludes form-family ViewItems from the list-view switcher', async () => {
    const ds = makeDS([listAll, listCalendar, formDefault]);
    const views = await ds.listViews('crm_activity');
    const names = views.map((v: any) => v.name).sort();
    expect(names).toEqual(['crm_activity.all', 'crm_activity.calendar']);
    // The form view is the original leak — it must be gone.
    expect(views.find((v: any) => v.name === 'crm_activity.default')).toBeUndefined();
  });

  it('excludes detail-family views too', async () => {
    const detail = { name: 'crm_activity.detail', object: 'crm_activity', viewKind: 'detail', config: {} };
    const ds = makeDS([listAll, detail]);
    const views = await ds.listViews('crm_activity');
    expect(views.map((v: any) => v.name)).toEqual(['crm_activity.all']);
  });

  it('filters by object binding', async () => {
    const otherList = { name: 'crm_lead.all', object: 'crm_lead', viewKind: 'list', config: {} };
    const ds = makeDS([listAll, otherList]);
    const views = await ds.listViews('crm_activity');
    expect(views.map((v: any) => v.name)).toEqual(['crm_activity.all']);
  });

  it('keeps legacy bare specs without a viewKind (saved/list views)', async () => {
    const legacy = { name: 'saved_grid', object: 'crm_activity', type: 'grid' };
    const wrapped = { list: { name: 'wrapped_grid', object: 'crm_activity', type: 'grid' } };
    const ds = makeDS([legacy, wrapped]);
    const views = await ds.listViews('crm_activity');
    expect(views.map((v: any) => v.name).sort()).toEqual(['saved_grid', 'wrapped_grid']);
  });

  // ── #2767 draft-preview branch ───────────────────────────────────────────
  describe('previewDrafts (#2767 P2/P3)', () => {
    it('reads the draft-overlaid list in a SINGLE preview=draft request', async () => {
      // Server response overlays a draft edit of `all` (draft wins by name) and
      // a brand-new draft-only `mine`; `calendar` is untouched/published.
      const overlaid = [
        {
          name: 'crm_activity.all', object: 'crm_activity', viewKind: 'list',
          label: 'All (edited)', config: { type: 'grid', data: { object: 'crm_activity' } },
          _draft: true,
        },
        {
          name: 'crm_activity.calendar', object: 'crm_activity', viewKind: 'list',
          label: 'Activity Calendar', config: { type: 'calendar', data: { object: 'crm_activity' } },
        },
        {
          name: 'crm_activity.mine', object: 'crm_activity', viewKind: 'list',
          label: 'Mine', config: { type: 'grid', data: { object: 'crm_activity' } },
          _draft: true,
        },
      ];
      const { ds, fetchImpl } = makeDraftDS(overlaid);
      const views = await ds.listViews('crm_activity', { previewDrafts: true });

      // Exactly one request, and it carries the preview flag.
      const metaCalls = fetchImpl.mock.calls.filter(([u]: any[]) => String(u).includes('/meta/view'));
      expect(metaCalls).toHaveLength(1);
      expect(String(metaCalls[0][0])).toContain('preview=draft');
      // Preview mode must NOT also hit the published path (that's the P2 dupe bug).
      expect(ds.client.meta.getItems).not.toHaveBeenCalled();

      // One tab per name — the draft edit of `all` does not duplicate it.
      expect(views.map((v: any) => v.name).sort()).toEqual([
        'crm_activity.all', 'crm_activity.calendar', 'crm_activity.mine',
      ]);
    });

    it('flows the _draft provenance flag through for the switcher badge', async () => {
      const overlaid = [
        {
          name: 'crm_activity.mine', object: 'crm_activity', viewKind: 'list',
          label: 'Mine', config: { type: 'grid', data: { object: 'crm_activity' } }, _draft: true,
        },
        {
          name: 'crm_activity.calendar', object: 'crm_activity', viewKind: 'list',
          label: 'Cal', config: { type: 'calendar', data: { object: 'crm_activity' } },
        },
      ];
      const { ds } = makeDraftDS(overlaid);
      const views = await ds.listViews('crm_activity', { previewDrafts: true });
      expect(views.find((v: any) => v.name === 'crm_activity.mine')?._draft).toBe(true);
      expect(views.find((v: any) => v.name === 'crm_activity.calendar')?._draft).toBeUndefined();
    });

    it('non-preview mode uses the published getItems path (no draft fetch)', async () => {
      const { ds, fetchImpl } = makeDraftDS([]);
      ds.client.meta.getItems = vi.fn(async () => ({
        items: [{
          name: 'crm_activity.all', object: 'crm_activity', viewKind: 'list',
          config: { type: 'grid', data: { object: 'crm_activity' } },
        }],
      }));
      const views = await ds.listViews('crm_activity');
      expect(ds.client.meta.getItems).toHaveBeenCalledTimes(1);
      expect(fetchImpl.mock.calls.filter(([u]: any[]) => String(u).includes('/meta/view'))).toHaveLength(0);
      expect(views.map((v: any) => v.name)).toEqual(['crm_activity.all']);
      expect(views[0]._draft).toBeUndefined();
    });
  });
});
