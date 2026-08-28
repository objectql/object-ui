/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Who owns app-navigation label localization (objectui#5197).
 *
 * The answer is: the server-side `/meta` boundary, alone. `translateApp` in
 * `@objectstack/spec` rewrites each navigation node's `label` by id before the
 * metadata reaches this renderer, so what arrives here is already localized
 * and must be rendered verbatim.
 *
 * Until #5197 the renderer also accepted two id-keyed client-side resolvers
 * (`resolveGroupLabel` / `resolveItemLabel`). They could never fire — the
 * `isCustomized` guard compares the authored label against the branch's
 * comparison target, and on those branches the target was the node's own `id`
 * (`grp_workspace`) while the label was its text (`Workspace`), which never
 * match. They are gone; these tests pin what is left:
 *
 *  - a normal tree renders exactly the labels it was given (the removal is not
 *    user-visible, because the server path was the one answering all along);
 *  - the `object` / `dashboard` branches keep their resolvers AND their guard;
 *  - id-keyed client-side resolution stays absent — the last test fails if
 *    anyone re-introduces it.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { NavigationItem } from '@object-ui/types';
import { SidebarProvider } from '@object-ui/components';
import { NavigationRenderer } from '../NavigationRenderer';

/** A conventionally-id'd tree: ids are slugs, labels are human text. */
const workspaceTree: NavigationItem[] = [
  {
    id: 'grp_workspace',
    type: 'group',
    label: 'Workspace',
    children: [
      { id: 'nav_users', type: 'url', label: 'Users', url: '/users' },
      { id: 'nav_pipeline', type: 'report', label: 'Pipeline report' },
    ],
  },
  { id: 'group_sales', type: 'group', label: 'Sales', children: [
    { id: 'nav_leads', type: 'url', label: 'Leads', url: '/leads' },
  ] },
];

function renderNav(items: NavigationItem[], props: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter initialEntries={['/apps/crm']}>
      <SidebarProvider defaultOpen>
        <NavigationRenderer items={items} basePath="/apps/crm" {...props} />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

describe('NavigationRenderer — nav label ownership', () => {
  it('renders a normal tree with the labels exactly as authored', () => {
    renderNav(workspaceTree);

    expect(screen.getByText('Workspace')).toBeTruthy();
    expect(screen.getByText('Sales')).toBeTruthy();
    expect(screen.getByText('Users')).toBeTruthy();
    expect(screen.getByText('Pipeline report')).toBeTruthy();
    expect(screen.getByText('Leads')).toBeTruthy();
    // No id ever leaks into the rail as a label.
    expect(screen.queryByText('grp_workspace')).toBeNull();
    expect(screen.queryByText('nav_users')).toBeNull();
  });

  it('renders server-localized labels verbatim — the /meta boundary already ran', () => {
    // Exactly what `translateApp` hands the shell for a zh-CN session: ids
    // untouched, labels rewritten. The renderer must not second-guess them.
    renderNav([
      {
        id: 'grp_workspace',
        type: 'group',
        label: '工作区',
        children: [{ id: 'nav_users', type: 'url', label: '用户', url: '/users' }],
      },
    ]);

    expect(screen.getByText('工作区')).toBeTruthy();
    expect(screen.getByText('用户')).toBeTruthy();
  });

  it('still resolves an un-customized object label through resolveObjectLabel', () => {
    const resolveObjectLabel = vi.fn((_objectName: string, _fallback: string) => 'Accounts');
    renderNav(
      [{ id: 'nav_accounts', type: 'object', label: 'account', objectName: 'account' }],
      { resolveObjectLabel },
    );

    expect(resolveObjectLabel).toHaveBeenCalledWith('account', 'account');
    expect(screen.getByText('Accounts')).toBeTruthy();
  });

  it('still lets an authored object label win over resolveObjectLabel', () => {
    const resolveObjectLabel = vi.fn((_objectName: string, _fallback: string) => 'Projects (translated)');
    renderNav(
      [{ id: 'nav_projects', type: 'object', label: 'Projects', objectName: 'project' }],
      { resolveObjectLabel },
    );

    // The `isCustomized` guard survives on this branch: an author who wrote a
    // custom label must never have it overridden by an object translation.
    expect(resolveObjectLabel).not.toHaveBeenCalled();
    expect(screen.getByText('Projects')).toBeTruthy();
  });

  it('keeps the same guard on the dashboard branch', () => {
    const resolveDashboardLabel = vi.fn((_dashboardName: string, _fallback: string) => 'Sales overview (translated)');
    renderNav(
      [
        { id: 'nav_so', type: 'dashboard', label: 'sales_overview', dashboardName: 'sales_overview' },
        { id: 'nav_custom', type: 'dashboard', label: 'Executive summary', dashboardName: 'exec' },
      ],
      { resolveDashboardLabel },
    );

    // Assert on WHICH names reached the resolver, not on a call count — the
    // tree re-renders (useIsMobile settles) and the count is not the contract.
    expect(resolveDashboardLabel).toHaveBeenCalledWith('sales_overview', 'sales_overview');
    expect(resolveDashboardLabel.mock.calls.every(([name]) => name === 'sales_overview')).toBe(true);
    expect(screen.getByText('Sales overview (translated)')).toBeTruthy();
    expect(screen.getByText('Executive summary')).toBeTruthy();
  });

  it('does not accept id-keyed client-side label resolvers', () => {
    // The ruling on #5197: nav localization has ONE owner, the server `/meta`
    // boundary. This renders with the retired prop names still supplied — a
    // consumer that never updated, or a future re-introduction. Nothing may
    // consume them.
    //
    // Note this assertion also held BEFORE the removal, because the guard made
    // those hooks unreachable; that degeneracy is the finding, not a gap. Its
    // job is forward-looking: re-adding id-keyed resolution (the rejected
    // option A) turns this red.
    const resolveGroupLabel = vi.fn((_groupId: string, _fallback: string) => 'GROUP FROM CLIENT PACK');
    const resolveItemLabel = vi.fn((_itemId: string, _fallback: string) => 'ITEM FROM CLIENT PACK');

    renderNav(workspaceTree, { resolveGroupLabel, resolveItemLabel });

    expect(resolveGroupLabel).not.toHaveBeenCalled();
    expect(resolveItemLabel).not.toHaveBeenCalled();
    expect(screen.queryByText('GROUP FROM CLIENT PACK')).toBeNull();
    expect(screen.queryByText('ITEM FROM CLIENT PACK')).toBeNull();
    expect(screen.getByText('Workspace')).toBeTruthy();
    expect(screen.getByText('Users')).toBeTruthy();
  });
});
