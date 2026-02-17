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
import { PermissionProvider } from '../PermissionProvider';
import { usePermissions } from '../usePermissions';
import { useFieldPermissions } from '../useFieldPermissions';
import type { RoleDefinition, ObjectPermissionConfig } from '@object-ui/types';

const roles: RoleDefinition[] = [
  { name: 'admin', label: 'Admin' },
  { name: 'editor', label: 'Editor' },
  { name: 'viewer', label: 'Viewer' },
];

const permissions: ObjectPermissionConfig[] = [
  {
    object: 'Task',
    roles: {
      admin: { actions: ['create', 'read', 'update', 'delete'] },
      editor: {
        actions: ['create', 'read', 'update'],
        fieldPermissions: [
          { field: 'title', read: true, write: true },
          { field: 'secret', read: true, write: false },
        ],
        rowPermissions: [{ actions: ['read'], filter: 'owner = $user.id' }],
      },
      viewer: { actions: ['read'] },
    },
    fieldDefaults: [{ field: 'notes', read: true, write: false }],
  },
];

function PermissionConsumer({ object, action }: { object: string; action: any }) {
  const { can, cannot, check, isLoaded, roles: userRoles } = usePermissions();
  const result = check(object, action);
  return (
    <div>
      <span data-testid="can">{String(can(object, action))}</span>
      <span data-testid="cannot">{String(cannot(object, action))}</span>
      <span data-testid="allowed">{String(result.allowed)}</span>
      <span data-testid="loaded">{String(isLoaded)}</span>
      <span data-testid="roles">{userRoles.join(',')}</span>
    </div>
  );
}

function FieldPermissionConsumer({ object }: { object: string }) {
  const { permissions, canRead, canWrite, readableFields, writableFields } = useFieldPermissions(object);
  return (
    <div>
      <span data-testid="perms-count">{permissions.length}</span>
      <span data-testid="can-read-title">{String(canRead('title'))}</span>
      <span data-testid="can-write-secret">{String(canWrite('secret'))}</span>
      <span data-testid="readable">{readableFields(['title', 'secret', 'other']).join(',')}</span>
      <span data-testid="writable">{writableFields(['title', 'secret', 'other']).join(',')}</span>
    </div>
  );
}

describe('PermissionProvider', () => {
  it('provides permission context to children', () => {
    render(
      <PermissionProvider roles={roles} permissions={permissions} userRoles={['admin']}>
        <PermissionConsumer object="Task" action="delete" />
      </PermissionProvider>,
    );
    expect(screen.getByTestId('can').textContent).toBe('true');
    expect(screen.getByTestId('cannot').textContent).toBe('false');
    expect(screen.getByTestId('allowed').textContent).toBe('true');
    expect(screen.getByTestId('loaded').textContent).toBe('true');
    expect(screen.getByTestId('roles').textContent).toBe('admin');
  });

  it('denies viewer from deleting', () => {
    render(
      <PermissionProvider roles={roles} permissions={permissions} userRoles={['viewer']}>
        <PermissionConsumer object="Task" action="delete" />
      </PermissionProvider>,
    );
    expect(screen.getByTestId('can').textContent).toBe('false');
    expect(screen.getByTestId('cannot').textContent).toBe('true');
  });

  it('provides checkField functionality', () => {
    render(
      <PermissionProvider roles={roles} permissions={permissions} userRoles={['editor']}>
        <FieldPermissionConsumer object="Task" />
      </PermissionProvider>,
    );
    expect(screen.getByTestId('perms-count').textContent).toBe('2');
    expect(screen.getByTestId('can-read-title').textContent).toBe('true');
    expect(screen.getByTestId('can-write-secret').textContent).toBe('false');
  });

  it('checks field defaults', () => {
    function CheckDefaults() {
      const { checkField } = usePermissions();
      return (
        <div>
          <span data-testid="notes-read">{String(checkField('Task', 'notes', 'read'))}</span>
          <span data-testid="notes-write">{String(checkField('Task', 'notes', 'write'))}</span>
        </div>
      );
    }
    render(
      <PermissionProvider roles={roles} permissions={permissions} userRoles={['viewer']}>
        <CheckDefaults />
      </PermissionProvider>,
    );
    expect(screen.getByTestId('notes-read').textContent).toBe('true');
    expect(screen.getByTestId('notes-write').textContent).toBe('false');
  });

  it('returns row filter', () => {
    function RowFilterConsumer() {
      const { getRowFilter } = usePermissions();
      return <span data-testid="filter">{getRowFilter('Task') ?? 'none'}</span>;
    }
    render(
      <PermissionProvider roles={roles} permissions={permissions} userRoles={['editor']}>
        <RowFilterConsumer />
      </PermissionProvider>,
    );
    expect(screen.getByTestId('filter').textContent).toContain('owner');
  });

  it('returns undefined row filter for unknown object', () => {
    function RowFilterConsumer() {
      const { getRowFilter } = usePermissions();
      return <span data-testid="filter">{getRowFilter('Unknown') ?? 'none'}</span>;
    }
    render(
      <PermissionProvider roles={roles} permissions={permissions} userRoles={['editor']}>
        <RowFilterConsumer />
      </PermissionProvider>,
    );
    expect(screen.getByTestId('filter').textContent).toBe('none');
  });

  it('returns empty field permissions for unknown object', () => {
    function FieldPermsConsumer() {
      const { getFieldPermissions } = usePermissions();
      return <span data-testid="count">{getFieldPermissions('Unknown').length}</span>;
    }
    render(
      <PermissionProvider roles={roles} permissions={permissions} userRoles={['editor']}>
        <FieldPermsConsumer />
      </PermissionProvider>,
    );
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('allows all when checkField has no config for object', () => {
    function CheckFieldConsumer() {
      const { checkField } = usePermissions();
      return <span data-testid="allowed">{String(checkField('Unknown', 'field', 'write'))}</span>;
    }
    render(
      <PermissionProvider roles={roles} permissions={permissions} userRoles={['editor']}>
        <CheckFieldConsumer />
      </PermissionProvider>,
    );
    expect(screen.getByTestId('allowed').textContent).toBe('true');
  });
});

describe('usePermissions without provider', () => {
  it('returns permissive defaults when no provider exists', () => {
    function NoProvider() {
      const { can, cannot, isLoaded, roles: userRoles } = usePermissions();
      return (
        <div>
          <span data-testid="can">{String(can('Any', 'delete'))}</span>
          <span data-testid="cannot">{String(cannot('Any', 'delete'))}</span>
          <span data-testid="loaded">{String(isLoaded)}</span>
          <span data-testid="roles">{userRoles.join(',')}</span>
        </div>
      );
    }
    render(<NoProvider />);
    expect(screen.getByTestId('can').textContent).toBe('true');
    expect(screen.getByTestId('cannot').textContent).toBe('false');
    expect(screen.getByTestId('loaded').textContent).toBe('false');
    expect(screen.getByTestId('roles').textContent).toBe('');
  });
});
