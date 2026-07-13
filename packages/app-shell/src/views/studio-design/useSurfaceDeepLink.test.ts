// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { resolveSurfaceDeepLink } from './useSurfaceDeepLink';

/**
 * Pure half of the shared `?surface=` deep-link plumbing — the rail-restore
 * resolution each pillar applies to its loaded list (the hook half is thin
 * URL glue over the same nav-selection parse/format, tested separately).
 */
describe('resolveSurfaceDeepLink', () => {
  const objects = [
    { name: 'showcase_project', label: '项目' },
    { name: 'showcase_task', label: '任务' },
  ];

  it('resolves a matching-type deep-link to its rail item', () => {
    expect(
      resolveSurfaceDeepLink(objects, { type: 'object', name: 'showcase_task' }, 'object'),
    ).toBe(objects[1]);
  });

  it('returns undefined when there is no deep-link (first-item default applies)', () => {
    expect(resolveSurfaceDeepLink(objects, null, 'object')).toBeUndefined();
  });

  it("ignores a deep-link of another pillar's surface type", () => {
    // e.g. `?surface=page:crm_workbench` reaching the Data pillar after a
    // pillar-tab switch must not accidentally match an object named like it.
    expect(
      resolveSurfaceDeepLink(objects, { type: 'page', name: 'showcase_task' }, 'object'),
    ).toBeUndefined();
  });

  it('ignores a deep-link naming an item the rail does not have', () => {
    expect(
      resolveSurfaceDeepLink(objects, { type: 'object', name: 'deleted_object' }, 'object'),
    ).toBeUndefined();
  });

  it('works for the Access pillar shape (name-keyed permission sets)', () => {
    const perms = [{ name: 'member_default' }, { name: 'sales_manager' }];
    expect(
      resolveSurfaceDeepLink(perms, { type: 'permission', name: 'sales_manager' }, 'permission'),
    ).toBe(perms[1]);
  });
});
