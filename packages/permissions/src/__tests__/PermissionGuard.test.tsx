/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { PermissionGuard } from '../PermissionGuard';
import { PermissionProvider } from '../PermissionProvider';
import type { RoleDefinition, ObjectPermissionConfig } from '@object-ui/types';

const roles: RoleDefinition[] = [
  { name: 'admin', label: 'Admin' },
  { name: 'viewer', label: 'Viewer' },
];

const permissions: ObjectPermissionConfig[] = [
  {
    object: 'Task',
    roles: {
      admin: { actions: ['create', 'read', 'update', 'delete'] },
      viewer: { actions: ['read'] },
    },
  },
];

function renderGuard(userRoles: string[], action: any, fallback?: 'hide' | 'disable' | 'custom', fallbackContent?: React.ReactNode) {
  return render(
    <PermissionProvider roles={roles} permissions={permissions} userRoles={userRoles}>
      <PermissionGuard object="Task" action={action} fallback={fallback} fallbackContent={fallbackContent}>
        <span data-testid="protected">Protected Content</span>
      </PermissionGuard>
    </PermissionProvider>,
  );
}

describe('PermissionGuard', () => {
  it('renders children when action is allowed', () => {
    renderGuard(['admin'], 'delete');
    expect(screen.getByTestId('protected')).toBeTruthy();
  });

  it('hides children by default when denied', () => {
    renderGuard(['viewer'], 'delete');
    expect(screen.queryByTestId('protected')).toBeNull();
  });

  it('hides children with fallback="hide"', () => {
    renderGuard(['viewer'], 'delete', 'hide');
    expect(screen.queryByTestId('protected')).toBeNull();
  });

  it('disables children with fallback="disable"', () => {
    const { container } = renderGuard(['viewer'], 'delete', 'disable');
    const wrapper = container.querySelector('[aria-disabled="true"]');
    expect(wrapper).toBeTruthy();
    expect(wrapper?.getAttribute('aria-disabled')).toBe('true');
    // Children should still be in the DOM but disabled
    expect(screen.getByTestId('protected')).toBeTruthy();
  });

  it('shows custom fallback content', () => {
    renderGuard(['viewer'], 'delete', 'custom', <span data-testid="fallback">No Access</span>);
    expect(screen.queryByTestId('protected')).toBeNull();
    expect(screen.getByTestId('fallback')).toBeTruthy();
  });

  it('shows null for custom fallback without fallbackContent', () => {
    renderGuard(['viewer'], 'delete', 'custom');
    expect(screen.queryByTestId('protected')).toBeNull();
  });
});
