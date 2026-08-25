/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectstack#7494 (maintainer ruling, 2026-08-12) — view configuration is
 * ORG-WIDE, and its write path is gated.
 *
 * `sort` / `hiddenFields` / `columnState` / `rowHeight` persisted through
 * `updateViewConfig` are shared by every user of the view; there is no
 * per-user scope behind them (parked as objectstack#7611, v18) and none is
 * built here. So an ordinary user toggling density from the toolbar was
 * re-styling the view for the whole organization, and the ruling puts a
 * view-management-class permission on the WRITE — not on the affordance.
 *
 * ## What each cell is for
 *
 * The two load-bearing cells run in the SAME file and the same run on
 * purpose: "the gate works" must not be satisfiable by a change that simply
 * broke the write for everybody. `refuses` is only meaningful next to a
 * `permits` that still goes through, and vice versa.
 *
 * Every cell builds its OWN `makeMetaStore()`. A store shared across cells
 * would let one case's `saveItem` call satisfy the next case's assertion —
 * a refusal cell can pass while measuring nothing if the spy it reads was
 * already dirty.
 *
 * ## Which of these would still pass if the gate were reverted
 *
 * Stated so a reviewer does not have to guess:
 *
 *   - `permits` and `unreported capabilities fail OPEN` would BOTH still
 *     pass — they assert the write happens, which is what the code did
 *     before the gate existed. They are controls, not the measurement.
 *   - Every cell under `refuses` would FAIL on a revert: without the gate
 *     `updateViewConfig` resolves and calls `saveItem`, so the rejection
 *     assertion and the `not.toHaveBeenCalled()` both go red. Those are the
 *     cells that carry the ruling.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  ObjectStackAdapter,
  ViewConfigPermissionDeniedError,
  isViewConfigPermissionDeniedError,
  VIEW_CONFIG_CAPABILITY,
} from './index';

/** A stub metadata store keyed the way `sys_metadata` is: `type` + `name`. */
function makeMetaStore() {
  const rows = new Map<string, any>();
  const meta = {
    getItems: vi.fn(async (type: string) => ({ type, items: [] as any[] })),
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

function makeDS(meta: any, capabilities?: string[] | undefined, viaConstructor = false) {
  const ds: any = new ObjectStackAdapter({
    baseUrl: 'http://test.local',
    ...(viaConstructor ? { systemCapabilities: capabilities } : {}),
    fetch: vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { capabilities: {}, routes: {} } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })),
  });
  ds.connected = true;
  ds.connectionState = 'connected';
  ds.client = { meta };
  if (!viaConstructor) ds.setSystemCapabilities(capabilities);
  return ds;
}

/** The four properties the ruling names, as one realistic toolbar payload. */
const RULED_PATCH = {
  sort: [{ field: 'name', direction: 'asc' }],
  hiddenFields: ['description'],
  columnState: { order: ['name', 'amount'], widths: { name: 220 } },
  rowHeight: 40,
};

describe('updateViewConfig is gated on a view-management capability (objectstack#7494)', () => {
  describe('permits — the control that keeps a green refusal honest', () => {
    it('a session holding the capability still writes view config', async () => {
      const { meta, rows } = makeMetaStore();
      const ds = makeDS(meta, ['setup.access', VIEW_CONFIG_CAPABILITY]);

      await expect(
        ds.updateViewConfig('crm_lead', 'crm_lead.default', RULED_PATCH),
      ).resolves.toBeDefined();

      expect(meta.saveItem).toHaveBeenCalledTimes(1);
      // Not merely "called" — the ruled payload actually landed in the store.
      expect(rows.get('view::crm_lead.default')).toMatchObject(RULED_PATCH);
    });

    it('unreported capabilities fail OPEN — a pre-ADR-0066 backend still writes', async () => {
      // `undefined` means "no answer was ever reported", which is NOT a
      // denial: the server enforces `manage_metadata` on the metadata door
      // regardless, and refusing here would break every deployment predating
      // ADR-0066 and every host with no permission provider mounted.
      const { meta } = makeMetaStore();
      const ds = makeDS(meta, undefined);

      await expect(
        ds.updateViewConfig('crm_lead', 'crm_lead.default', RULED_PATCH),
      ).resolves.toBeDefined();
      expect(meta.saveItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('refuses — the cells that carry the ruling', () => {
    it('a reported set WITHOUT the capability is refused, and nothing is written', async () => {
      const { meta } = makeMetaStore();
      // objectstack#8270's EE workspace owner: a real, non-empty grant that
      // simply does not include metadata authoring.
      const ds = makeDS(meta, ['manage_org_users', 'setup.access', 'setup.write']);

      await expect(
        ds.updateViewConfig('crm_lead', 'crm_lead.default', RULED_PATCH),
      ).rejects.toBeInstanceOf(ViewConfigPermissionDeniedError);

      // The refusal is BEFORE the wire. An org-wide row that is written and
      // then complained about is not a gate.
      expect(meta.saveItem).not.toHaveBeenCalled();
    });

    it('a reported EMPTY grant gates strictly — "holds nothing" is a real answer', async () => {
      const { meta } = makeMetaStore();
      const ds = makeDS(meta, []);

      await expect(
        ds.updateViewConfig('crm_lead', 'crm_lead.default', RULED_PATCH),
      ).rejects.toBeInstanceOf(ViewConfigPermissionDeniedError);
      expect(meta.saveItem).not.toHaveBeenCalled();
    });

    it('the capability injected at construction gates the same way', async () => {
      const { meta } = makeMetaStore();
      const ds = makeDS(meta, ['setup.access'], /* viaConstructor */ true);

      await expect(
        ds.updateViewConfig('crm_lead', 'crm_lead.default', RULED_PATCH),
      ).rejects.toBeInstanceOf(ViewConfigPermissionDeniedError);
      expect(meta.saveItem).not.toHaveBeenCalled();
    });

    it('the refusal is LOUD and self-describing — never a silent no-op', async () => {
      const { meta } = makeMetaStore();
      const ds = makeDS(meta, ['setup.access']);

      const err = await ds
        .updateViewConfig('crm_lead', 'crm_lead.default', RULED_PATCH)
        .then(() => null, (e: unknown) => e);

      // A resolved promise here would be the exact failure mode the ruling's
      // reviewers called out: the toolbar moves, the write vanishes, and the
      // operator learns about it on the next reload.
      expect(err).toBeInstanceOf(Error);
      expect(isViewConfigPermissionDeniedError(err)).toBe(true);
      expect((err as any).code).toBe('VIEW_CONFIG_PERMISSION_DENIED');
      expect((err as any).capability).toBe('manage_metadata');
      expect((err as any).objectName).toBe('crm_lead');
      expect((err as any).viewId).toBe('crm_lead.default');
      // The message states the SCOPE, which is the half an operator cannot
      // otherwise see, and then the capability that unlocks it.
      expect((err as any).message).toContain('changes it for everyone who uses this view');
      expect((err as any).message).toContain('manage_metadata');
    });
  });

  describe('the guard', () => {
    it('does not match unrelated errors', () => {
      expect(isViewConfigPermissionDeniedError(new Error('boom'))).toBe(false);
      expect(isViewConfigPermissionDeniedError(null)).toBe(false);
      expect(isViewConfigPermissionDeniedError({ code: 'CONCURRENT_UPDATE' })).toBe(false);
    });

    it('matches a wire twin that crossed a bundle boundary', () => {
      // Duck-checked rather than `instanceof`, so a host bundling this package
      // twice still gets the right verdict.
      expect(isViewConfigPermissionDeniedError({ code: 'VIEW_CONFIG_PERMISSION_DENIED' })).toBe(true);
      expect(isViewConfigPermissionDeniedError({ name: 'ViewConfigPermissionDeniedError' })).toBe(true);
    });
  });

  it('gates on the capability this repo already uses for metadata authoring', () => {
    // Pinned rather than asserted loosely: the ruling names a CLASS
    // ("view-management-class permission"), and the choice of `manage_metadata`
    // is the reviewable decision. `HomePage`'s AUTHORING_CAPABILITY is the
    // same string, and the write gated here goes through the same ADR-0005
    // metadata door the server already refuses without it.
    expect(VIEW_CONFIG_CAPABILITY).toBe('manage_metadata');
  });
});
