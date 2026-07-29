/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * RecordDetailView — the `user` seeded into the record surface's own
 * `<ActionProvider>` (ADR-0066 D4 / framework#3923).
 *
 * The record page mounts an ActionProvider that SHADOWS the shell-level one, so
 * the capability gate the engine reads (`user.systemPermissions`) is whatever
 * this object carries. It used to carry identity only — `{id, name, avatar}` —
 * and since `ActionEngine.getActionsForLocation` fails OPEN on `undefined`, every
 * `record_header` / `record_more` action's `requiredPermissions` was silently
 * unenforced on the one surface those locations exist on.
 *
 * Two properties are pinned here, and they pull in opposite directions:
 *   • loaded permissions MUST reach the engine (otherwise: no gate at all);
 *   • unloaded permissions MUST NOT be forwarded as `[]` (otherwise: every gated
 *     action hides in a standalone embed that never mounts a PermissionProvider).
 */

import { describe, it, expect } from 'vitest';
import { resolveActionUser } from './RecordDetailView';

const user = { id: 'u1', name: 'Ada', image: 'https://cdn/a.png' };

describe('resolveActionUser — ADR-0066 D4 capability gate seeding (#3923)', () => {
  it('forwards loaded systemPermissions so the action gate can enforce', () => {
    expect(resolveActionUser(user, true, ['manage_platform_settings'])).toEqual({
      id: 'u1',
      name: 'Ada',
      avatar: 'https://cdn/a.png',
      systemPermissions: ['manage_platform_settings'],
    });
  });

  it('forwards an EMPTY loaded set — "holds nothing" must gate, not fail open', () => {
    const resolved = resolveActionUser(user, true, []);
    expect(resolved.systemPermissions).toEqual([]);
    // The distinction the engine keys off: present-but-empty ≠ absent.
    expect(Array.isArray(resolved.systemPermissions)).toBe(true);
  });

  it('omits systemPermissions while permissions are still loading (fail-open)', () => {
    const resolved = resolveActionUser(user, false, []);
    expect(resolved).toEqual({ id: 'u1', name: 'Ada', avatar: 'https://cdn/a.png' });
    expect('systemPermissions' in resolved).toBe(false);
  });

  it('treats a loaded-but-undefined set as "holds nothing", not as unknown', () => {
    expect(resolveActionUser(user, true, undefined).systemPermissions).toEqual([]);
  });

  it('keeps the anonymous fallback identity and still carries the gate', () => {
    const resolved = resolveActionUser(null, true, ['setup.access']);
    expect(resolved.id).toBe('current-user');
    expect(resolved.systemPermissions).toEqual(['setup.access']);
  });

  it('never mutates the shared FALLBACK_USER constant', () => {
    resolveActionUser(undefined, true, ['a']);
    const second = resolveActionUser(undefined, false, undefined);
    expect('systemPermissions' in second).toBe(false);
  });
});
