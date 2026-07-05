/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * resolveHref — nav item → URL mapping, focused on the `type: 'object'`
 * target precedence (recordId → filters → viewName) and the #2251
 * parameterized bare data surface (`/:objectName/data?filter[...]=`).
 */

import { describe, it, expect } from 'vitest';
import type { NavigationItem } from '@object-ui/types';
import { resolveHref } from '../NavigationRenderer';

const BASE = '/apps/crm';

function objectItem(extra: Partial<NavigationItem> = {}): NavigationItem {
  return { id: 'nav_task', type: 'object', label: 'Tasks', objectName: 'task', ...extra };
}

/** Parse the href's query string back into entries for order-free asserts. */
function queryOf(href: string): URLSearchParams {
  const i = href.indexOf('?');
  return new URLSearchParams(i >= 0 ? href.slice(i + 1) : '');
}

describe('resolveHref — object targets', () => {
  it('bare object item → object route (workspace, default view)', () => {
    const { href, external } = resolveHref(objectItem(), BASE);
    expect(href).toBe(`${BASE}/task`);
    expect(external).toBe(false);
  });

  it('viewName → explicit view route', () => {
    const { href } = resolveHref(objectItem({ viewName: 'task.by_status' }), BASE);
    expect(href).toBe(`${BASE}/task/view/task.by_status`);
  });

  it('filters → /data with filter[<field>]=<value> params', () => {
    const { href, external } = resolveHref(
      objectItem({ filters: { status: 'open', priority: 'high' } }),
      BASE,
    );
    expect(href.startsWith(`${BASE}/task/data?`)).toBe(true);
    expect(external).toBe(false);
    const q = queryOf(href);
    expect(q.get('filter[status]')).toBe('open');
    expect(q.get('filter[priority]')).toBe('high');
  });

  it('empty filters object → bare /data surface with no params', () => {
    const { href } = resolveHref(objectItem({ filters: {} }), BASE);
    expect(href).toBe(`${BASE}/task/data`);
  });

  it('filters win over viewName (precedence: recordId → filters → viewName)', () => {
    const { href } = resolveHref(
      objectItem({ filters: { status: 'open' }, viewName: 'task.by_status' }),
      BASE,
    );
    expect(href.startsWith(`${BASE}/task/data?`)).toBe(true);
  });

  it('recordId wins over filters', () => {
    const { href } = resolveHref(
      objectItem({ recordId: 'rec_1', filters: { status: 'open' } }),
      BASE,
    );
    expect(href).toBe(`${BASE}/task/record/rec_1`);
  });

  it('substitutes template variables in filter values', () => {
    const { href } = resolveHref(
      objectItem({ filters: { owner_id: '{current_user_id}' } }),
      BASE,
      { currentUserId: 'u_42' },
    );
    expect(queryOf(href).get('filter[owner_id]')).toBe('u_42');
  });

  it('drops filter entries whose template cannot be resolved', () => {
    const { href } = resolveHref(
      objectItem({ filters: { owner_id: '{current_user_id}', status: 'open' } }),
      BASE,
      {},
    );
    const q = queryOf(href);
    expect(q.get('filter[owner_id]')).toBeNull();
    expect(q.get('filter[status]')).toBe('open');
    expect(href.startsWith(`${BASE}/task/data?`)).toBe(true);
  });

  it('unresolved recordId falls through to filters, not the list view', () => {
    const { href } = resolveHref(
      objectItem({ recordId: '{current_user_id}', filters: { status: 'open' } }),
      BASE,
      {},
    );
    expect(href.startsWith(`${BASE}/task/data?`)).toBe(true);
  });
});

describe('resolveHref — non-object targets unchanged', () => {
  it('dashboard', () => {
    const item: NavigationItem = { id: 'n1', type: 'dashboard', label: 'KPIs', dashboardName: 'kpis' };
    expect(resolveHref(item, BASE).href).toBe(`${BASE}/dashboard/kpis`);
  });

  it('page', () => {
    const item: NavigationItem = { id: 'n2', type: 'page', label: 'Home', pageName: 'home' };
    expect(resolveHref(item, BASE).href).toBe(`${BASE}/page/home`);
  });

  it('url is external when target=_blank', () => {
    const item: NavigationItem = { id: 'n3', type: 'url', label: 'Docs', url: 'https://example.com', target: '_blank' };
    const { href, external } = resolveHref(item, BASE);
    expect(href).toBe('https://example.com');
    expect(external).toBe(true);
  });
});
