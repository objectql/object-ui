/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectstack#7494 — the console half of the org-wide view-config gate.
 *
 * The gate itself lives on the WRITE (`ObjectStackAdapter.updateViewConfig`,
 * pinned in `data-objectstack/src/viewConfigPermissionGate.test.ts`). This file
 * pins the two things the console still owes it, because a gate whose refusal
 * nobody can see is a gate that reads as a bug:
 *
 *   1. the session's capabilities actually REACH the adapter, and
 *   2. the refusal is SHOWN rather than swallowed into `console.error`.
 *
 * ## Why part of this reads the source
 *
 * `persistViewPatch`'s catch is a closure inside `ObjectViewInner`; reaching it
 * behaviourally means rendering the whole object workspace and driving a
 * debounced toolbar toggle. This file instead closes the loop from both ends,
 * which is what actually needs proving:
 *
 *   - the REAL adapter's refusal is classified `true` by the REAL guard the
 *     catch branches on (round-trip, not a hand-written error fixture — a
 *     fixture is exactly where a code/name mismatch would hide);
 *   - the key that branch renders EXISTS in the `en` pack, so the toast shows a
 *     sentence and not a raw key path;
 *   - and the wiring lines are present in the source.
 *
 * `type-check` supplies the piece source-reading cannot: both
 * `isViewConfigPermissionDeniedError` and `setSystemCapabilities` are a real
 * import and a real method, so a typo in either name is a compile error, not a
 * silently-passing string match here.
 *
 * ## Which of these would still pass if the change were reverted
 *
 * None of them. Every assertion below names something this change introduced:
 * revert it and the guard export, the `en` key and all three source markers
 * disappear together. The controls that are supposed to survive a revert live
 * in the adapter's own test file, where the permitted-user write is asserted
 * beside the refusal.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ObjectStackAdapter,
  isViewConfigPermissionDeniedError,
} from '@object-ui/data-objectstack';
import en from '@object-ui/i18n/locales/en';

const SOURCE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'ObjectView.tsx'),
  'utf8',
);

/** The key `persistViewPatch`'s catch renders when the write is refused. */
const REFUSAL_KEY = 'console.objectView.viewConfigPermissionDenied';

describe('the console surfaces the org-wide view-config refusal (objectstack#7494)', () => {
  it('the guard the catch branches on classifies what the adapter really throws', async () => {
    // Round-trip: a real adapter, a real reported-but-insufficient grant, and
    // the real exported guard — so the catch's condition is proven against the
    // error that will actually arrive, not against a shape written here.
    const meta = {
      saveItem: vi.fn(async () => ({ success: true, item: {} })),
      getItems: vi.fn(async () => ({ type: 'view', items: [] })),
    };
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
    ds.setSystemCapabilities(['setup.access']);

    const err = await ds
      .updateViewConfig('crm_lead', 'crm_lead.default', { rowHeight: 40 })
      .then(() => null, (e: unknown) => e);

    expect(err).not.toBeNull();
    expect(isViewConfigPermissionDeniedError(err)).toBe(true);
    expect(meta.saveItem).not.toHaveBeenCalled();
  });

  it('the refusal renders a sentence, not a raw key path', () => {
    const value = REFUSAL_KEY.split('.').reduce<any>((o, k) => o?.[k], en as any);
    expect(typeof value).toBe('string');
    // The scope is the half an operator cannot otherwise see, so it has to be
    // in the sentence — naming only the missing permission would explain the
    // refusal without ever explaining what the setting does.
    expect(value).toContain('everyone who uses this view');
    expect(value).toContain('Manage Metadata');
  });

  it('persistViewPatch shows the refusal instead of swallowing it', () => {
    expect(SOURCE).toContain('isViewConfigPermissionDeniedError(err)');
    expect(SOURCE).toContain(`toast.error(t('${REFUSAL_KEY}'))`);
    // The generic console.error must SURVIVE for every other failure — the
    // branch is an addition, not a replacement. A guard that correctly survives
    // is what says the narrowing stopped where it should.
    expect(SOURCE).toContain("console.error('[ObjectView] Failed to persist view config:', err)");
  });

  it('the session capabilities are pushed into the adapter', () => {
    expect(SOURCE).toContain('setSystemCapabilities?.(systemPermissions)');
    // Passed through verbatim, `undefined` included: "never reported" and
    // "reported empty" are different answers and the adapter decides between
    // them. A `?? []` here would have collapsed the two and gated a
    // pre-ADR-0066 deployment closed.
    expect(SOURCE).not.toContain('setSystemCapabilities?.(systemPermissions ?? [])');
  });
});
