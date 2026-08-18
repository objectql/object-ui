/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, screen, cleanup, fireEvent } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import { ListView } from '../ListView';
import { SchemaRendererProvider } from '@object-ui/react';
import { PermissionProvider } from '@object-ui/permissions';
import type { ListViewSchema } from '@object-ui/types';
import type { ObjectPermissionConfig, RoleDefinition } from '@object-ui/types';

/**
 * Negative tests for ListView FLS — when the current user lacks read
 * permission on a column, it must disappear from the rendered table
 * (and, by extension, from the hide-fields popover, the filter
 * builder, and any $select that flows to the data source).
 *
 * We assert against the `$select` arg passed to dataSource.find rather
 * than rendered DOM text: the DOM depends on which list renderer is
 * registered (which varies between isolated `--filter` test runs and
 * the root `vitest run --coverage` combined run where other packages
 * register table renderers), but the $select contract is invariant.
 */

// Every grant this role uses comes from the `ObjectPermissionConfig` below —
// the only wired home for role grants. (`RoleDefinition` used to require a
// second, never-read `permissions` array; retired in objectui#4288.)
const roles: RoleDefinition[] = [
  { name: 'restricted', label: 'Restricted', description: 'denies one field' },
];

function makeRestrictedConfig(deniedField: string): ObjectPermissionConfig {
  return {
    object: 'account',
    roles: {
      restricted: {
        // `actions` is the declared channel for a role's object-level grants and
        // the only one `evaluatePermission` reads. This entry used to spell them
        // `objectPermissions: { read: true, … }` beside a `roleName` echo of its
        // own map key — neither key exists on
        // `ObjectPermissionConfig['roles'][string]`, so both were inert and the
        // role granted nothing at all. The rewrite says what the old shape
        // meant: read allowed, no writes.
        //
        // No assertion moves. The field gate these cases exercise runs through
        // `checkField`, which reads `fieldPermissions` directly and never
        // consults `actions`, so they were testing what they claim even while
        // the object grant was empty.
        actions: ['read'],
        fieldPermissions: [{ field: deniedField, read: false, write: false }],
      },
    },
  };
}

const mockDataSource = {
  find: vi.fn().mockResolvedValue([
    { id: 'A1', name: 'Acme Co', annual_revenue: 1_000_000, industry: 'Tech' },
    { id: 'A2', name: 'Globex',  annual_revenue: 500_000,    industry: 'Energy' },
  ]),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const schema: ListViewSchema = {
  type: 'list-view',
  objectName: 'account',
  fields: ['name', 'industry', 'annual_revenue'],
};

function renderRestricted(deniedField: string) {
  return render(
    <SchemaRendererProvider dataSource={mockDataSource as any}>
      <PermissionProvider
        roles={roles}
        permissions={[makeRestrictedConfig(deniedField)]}
        userRoles={['restricted']}
      >
        <ListView schema={schema} dataSource={mockDataSource as any} />
      </PermissionProvider>
    </SchemaRendererProvider>,
  );
}

/** Pull the most-recent $select that ListView projected to the data source. */
function lastSelect(): string[] | undefined {
  const calls = mockDataSource.find.mock.calls;
  if (calls.length === 0) return undefined;
  const lastArgs = calls[calls.length - 1]?.[1];
  return lastArgs?.$select as string[] | undefined;
}

describe('ListView – field-level permission gating (negative)', () => {
  beforeEach(() => {
    mockDataSource.find.mockClear();
  });

  it('drops the denied column from the $select projection', async () => {
    renderRestricted('annual_revenue');
    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalled();
    });
    const select = lastSelect();
    // ListView always projects an explicit $select for trimmed payloads;
    // permission gating must remove the denied field from it.
    expect(select).toBeDefined();
    expect(select).not.toContain('annual_revenue');
    expect(select).toEqual(expect.arrayContaining(['industry', 'name']));
  });

  it('does not leak the denied value into any rendered cell', async () => {
    const { container } = renderRestricted('annual_revenue');
    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalled();
    });
    expect(container.textContent).not.toMatch(/1,000,000|1000000|500,000|500000/);
  });

  it('keeps the denied column in $select when no PermissionProvider is mounted', async () => {
    render(
      <SchemaRendererProvider dataSource={mockDataSource as any}>
        <ListView schema={schema} dataSource={mockDataSource as any} />
      </SchemaRendererProvider>,
    );
    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalled();
    });
    const select = lastSelect();
    expect(select).toBeDefined();
    expect(select).toContain('annual_revenue');
  });
});

/**
 * [#4096] The NON-grid bulk bar (kanban / calendar / gallery / …), which
 * ListView renders itself — the grid path delegates to ObjectGrid, which gates
 * its own.
 *
 * The built-in `delete` entry used to be gated on the object's resolved delete
 * affordance alone: the ADR-0103 bucket ∧ `userActions.delete` ∧ the server's
 * `apiOperations`. All three describe the OBJECT. `apiOperations` in particular
 * is byte-identical across accounts with opposite write grants, so the most
 * destructive control on a board stayed visible for a principal with no
 * `allowDelete` — the same defect the main list's row kebab carried. It now
 * also ANDs `can(obj, 'delete')`.
 *
 * Both directions plus the no-provider fail-open are pinned here.
 */
function makeObjectPermissions(allowDelete: boolean): ObjectPermissionConfig {
  return {
    object: 'account',
    roles: {
      restricted: {
        // `evaluatePermission` reads the role's `actions` list, so the grant
        // has to live there. The `roleName` echo of the map key and the
        // `objectPermissions` block that used to sit beside it are gone: neither
        // is declared on `ObjectPermissionConfig['roles'][string]`, so neither
        // was ever read. The comment they carried — that `objectPermissions`
        // "drives the field-level gate" — was wrong twice over: that gate is
        // `checkField`, it reads `fieldPermissions`, and this fixture declares
        // none, so the block decided nothing here at all.
        actions: allowDelete ? ['read', 'delete'] : ['read'],
      },
    },
  };
}

const galleryBulkSchema: ListViewSchema = {
  type: 'list-view',
  objectName: 'account',
  viewType: 'gallery',
  fields: ['name', 'industry'],
  bulkActions: ['delete', 'archive'] as any,
};

/**
 * Stand in for the gallery renderer and select a row as soon as it mounts —
 * the bulk bar only renders with a non-empty selection, and driving the real
 * gallery's selection UI would couple this permission assertion to that
 * component's markup.
 */
function registerSelectingGallery() {
  ComponentRegistry.register('object-gallery', (props: any) => {
    const onRowSelect = props.onRowSelect;
    React.useEffect(() => {
      onRowSelect?.([{ id: 'A1', name: 'Acme Co' }]);
    }, [onRowSelect]);
    return <div data-testid="gallery-stub" />;
  });
}

/** `permissions: null` renders with NO PermissionProvider at all. */
function renderGalleryBulk(permissions: ObjectPermissionConfig | null) {
  const view = <ListView schema={galleryBulkSchema} dataSource={mockDataSource as any} />;
  return render(
    <SchemaRendererProvider dataSource={mockDataSource as any}>
      {permissions
        ? (
          <PermissionProvider roles={roles} permissions={[permissions]} userRoles={['restricted']}>
            {view}
          </PermissionProvider>
        )
        : view}
    </SchemaRendererProvider>,
  );
}

describe('ListView – non-grid bulk delete vs the principal permission gate (#4096)', () => {
  let prevGallery: ReturnType<typeof ComponentRegistry.get>;

  beforeEach(() => {
    mockDataSource.find.mockClear();
    prevGallery = ComponentRegistry.get('object-gallery');
    registerSelectingGallery();
  });

  afterEach(() => {
    cleanup();
    if (prevGallery) ComponentRegistry.register('object-gallery', prevGallery);
    else ComponentRegistry.unregister('object-gallery');
  });

  it('a principal WITH allowDelete keeps the bulk delete button', async () => {
    renderGalleryBulk(makeObjectPermissions(true));
    await waitFor(() => expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument());
    expect(screen.queryByTestId('bulk-action-delete')).not.toBeNull();
  });

  it('a principal WITHOUT allowDelete loses it, and keeps the non-delete actions', async () => {
    renderGalleryBulk(makeObjectPermissions(false));
    await waitFor(() => expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument());
    expect(screen.queryByTestId('bulk-action-delete')).toBeNull();
    // Control group: proves the bar rendered and the probe can observe a
    // surviving entry, so the absence above is not a false positive. Custom
    // ids route through the action runner with their own gates.
    expect(screen.queryByTestId('bulk-action-archive')).not.toBeNull();
  });

  it('with NO PermissionProvider the bulk delete survives (fail-open preserved)', async () => {
    renderGalleryBulk(null);
    await waitFor(() => expect(screen.getByTestId('bulk-actions-bar')).toBeInTheDocument());
    expect(screen.queryByTestId('bulk-action-delete')).not.toBeNull();
  });
});

/**
 * [#4647] The grid toolbar's inline-edit affordance — the permission gate it
 * never had, and the declared switch nothing read.
 *
 * ## Gap 1
 *
 * The toggle rendered on "grid view ∧ the host wired `onInlineEditChange` ∧ not
 * the compact toolbar", and every host wires that callback unconditionally. It
 * was the ONE affordance on this toolbar with no permission check: New and
 * Import are hidden for an account without the grant and the bulk-delete entry
 * pinned above ANDs `can(obj, 'delete')`, but a read-only principal could flip
 * inline edit, modify cells and press "Save all" to earn a server 403.
 *
 * ## Gap 2
 *
 * `userActions.editInline` is spec-declared and, on this toolbar, was read by
 * nothing — an author could not switch inline editing off even unconditionally.
 *
 * Three render sites carry the verdict, and all three are pinned: the wide
 * toolbar's toggle, the COMPACT toolbar's popover entry (which had no gate at
 * all, not even the callback), and the `editable` MODE handed to the grid —
 * because a stored view carrying `inlineEdit: true` drops a read-only principal
 * into editable cells with no toggle to press.
 */
function makeUpdatePermissions(allowUpdate: boolean): ObjectPermissionConfig {
  return {
    object: 'account',
    roles: {
      restricted: {
        actions: allowUpdate ? ['read', 'update'] : ['read'],
      },
    },
  };
}

const inlineEditSchema: ListViewSchema = {
  type: 'list-view',
  objectName: 'account',
  viewType: 'grid',
  fields: ['name', 'industry'],
};

/** Records the `editable` prop the grid is rendered with. */
let gridEditableCalls: Array<boolean | undefined> = [];

function registerRecordingGrid() {
  ComponentRegistry.register('object-grid', (props: any) => {
    gridEditableCalls.push(props.editable);
    return <div data-testid="grid-stub">{String(!!props.editable)}</div>;
  });
}

/** `permissions: null` renders with NO PermissionProvider at all. */
function renderInlineEdit(
  permissions: ObjectPermissionConfig | null,
  schemaOverride?: Partial<ListViewSchema>,
) {
  const view = (
    <ListView
      schema={{ ...inlineEditSchema, ...schemaOverride } as ListViewSchema}
      dataSource={mockDataSource as any}
      onInlineEditChange={vi.fn()}
    />
  );
  return render(
    <SchemaRendererProvider dataSource={mockDataSource as any}>
      {permissions
        ? (
          <PermissionProvider roles={roles} permissions={[permissions]} userRoles={['restricted']}>
            {view}
          </PermissionProvider>
        )
        : view}
    </SchemaRendererProvider>,
  );
}

describe('ListView – inline-edit toggle vs the principal permission gate (#4647)', () => {
  let prevGrid: ReturnType<typeof ComponentRegistry.get>;

  beforeEach(() => {
    mockDataSource.find.mockClear();
    gridEditableCalls = [];
    prevGrid = ComponentRegistry.get('object-grid');
    registerRecordingGrid();
  });

  afterEach(() => {
    cleanup();
    if (prevGrid) ComponentRegistry.register('object-grid', prevGrid);
    else ComponentRegistry.unregister('object-grid');
  });

  it('a principal WITH update keeps the inline-edit toggle', async () => {
    renderInlineEdit(makeUpdatePermissions(true));
    await waitFor(() => expect(screen.getByTestId('grid-stub')).toBeInTheDocument());
    expect(screen.queryByTestId('toolbar-inline-edit-toggle')).not.toBeNull();
  });

  it('a principal WITHOUT update loses it', async () => {
    renderInlineEdit(makeUpdatePermissions(false));
    await waitFor(() => expect(screen.getByTestId('grid-stub')).toBeInTheDocument());
    expect(screen.queryByTestId('toolbar-inline-edit-toggle')).toBeNull();
  });

  it('with NO PermissionProvider the toggle survives (fail-open preserved)', async () => {
    renderInlineEdit(null);
    await waitFor(() => expect(screen.getByTestId('grid-stub')).toBeInTheDocument());
    expect(screen.queryByTestId('toolbar-inline-edit-toggle')).not.toBeNull();
  });

  it('a read-only principal cannot reach edit MODE through a stored inlineEdit:true view', async () => {
    // The door that stays open if only the toggle is gated: the console
    // persists `inlineEdit` per view, so the mode can be entered with no
    // toggle press at all.
    renderInlineEdit(makeUpdatePermissions(false), { inlineEdit: true } as Partial<ListViewSchema>);
    await waitFor(() => expect(screen.getByTestId('grid-stub')).toBeInTheDocument());
    expect(screen.getByTestId('grid-stub')).toHaveTextContent('false');
    expect(gridEditableCalls.at(-1)).toBeFalsy();
  });

  it('…while a permitted principal keeps that same stored view editable', async () => {
    // Control group: proves the assertion above observes the PERMISSION and not
    // a schema key that stopped being forwarded.
    renderInlineEdit(makeUpdatePermissions(true), { inlineEdit: true } as Partial<ListViewSchema>);
    await waitFor(() => expect(screen.getByTestId('grid-stub')).toBeInTheDocument());
    expect(screen.getByTestId('grid-stub')).toHaveTextContent('true');
  });

  it('the COMPACT toolbar entry is gated too', async () => {
    // `showInlineEdit` on the settings popover was `currentView === 'grid'`
    // alone — it never even required the host callback, so gating only the wide
    // toolbar would have left the affordance reachable on mobile.
    //
    // Two layers have to be opened before an absence means anything, or the
    // assertion passes for every input including a completely ungated one:
    // the entry lives inside `PopoverContent` (closed until the trigger is
    // clicked) and inside a `Section` that renders its children only when
    // expanded — and that section's `defaultOpen` is `!!inlineEdit`. Hence the
    // seeded `inlineEdit: true`, which is also the realistic shape of this
    // regression: a stored view already in inline-edit mode, reopened by a
    // principal who has since lost `update`.
    renderInlineEdit(makeUpdatePermissions(false), {
      compactToolbar: true,
      inlineEdit: true,
    } as Partial<ListViewSchema>);
    await waitFor(() => expect(screen.getByTestId('grid-stub')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('view-settings-trigger'));
    await screen.findByTestId('view-settings-content');
    expect(screen.queryByTestId('view-settings-inline-edit')).toBeNull();
  });

  it('…and a permitted principal keeps that compact entry', async () => {
    // Control group for the case above: same two layers opened the same way,
    // so the absence there is the permission gate and not a collapsed panel.
    renderInlineEdit(makeUpdatePermissions(true), {
      compactToolbar: true,
      inlineEdit: true,
    } as Partial<ListViewSchema>);
    await waitFor(() => expect(screen.getByTestId('grid-stub')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('view-settings-trigger'));
    await screen.findByTestId('view-settings-content');
    expect(screen.queryByTestId('view-settings-inline-edit')).not.toBeNull();
  });
});

describe('ListView – the declared userActions.editInline switch (#4647 gap 2)', () => {
  let prevGrid: ReturnType<typeof ComponentRegistry.get>;

  beforeEach(() => {
    mockDataSource.find.mockClear();
    gridEditableCalls = [];
    prevGrid = ComponentRegistry.get('object-grid');
    registerRecordingGrid();
  });

  afterEach(() => {
    cleanup();
    if (prevGrid) ComponentRegistry.register('object-grid', prevGrid);
    else ComponentRegistry.unregister('object-grid');
  });

  it('`editInline: false` withholds the toggle from a fully-permitted principal', async () => {
    renderInlineEdit(makeUpdatePermissions(true), {
      userActions: { editInline: false },
    } as Partial<ListViewSchema>);
    await waitFor(() => expect(screen.getByTestId('grid-stub')).toBeInTheDocument());
    expect(screen.queryByTestId('toolbar-inline-edit-toggle')).toBeNull();
  });

  it('`editInline: false` also withholds edit MODE from a stored inlineEdit:true view', async () => {
    renderInlineEdit(makeUpdatePermissions(true), {
      inlineEdit: true,
      userActions: { editInline: false },
    } as Partial<ListViewSchema>);
    await waitFor(() => expect(screen.getByTestId('grid-stub')).toBeInTheDocument());
    expect(screen.getByTestId('grid-stub')).toHaveTextContent('false');
  });

  it('`editInline: true` offers the toggle', async () => {
    renderInlineEdit(makeUpdatePermissions(true), {
      userActions: { editInline: true },
    } as Partial<ListViewSchema>);
    await waitFor(() => expect(screen.getByTestId('grid-stub')).toBeInTheDocument());
    expect(screen.queryByTestId('toolbar-inline-edit-toggle')).not.toBeNull();
  });

  it('an ABSENT editInline defers to the host channel, keeping existing views intact', async () => {
    // The deliberate divergence from the spec's `.default(false)`, pinned so a
    // future change to it is a decision rather than an accident: enforcing that
    // default would take the toggle off every stored console view at once,
    // since nothing folds a legacy key into `editInline`. `toolbarFlags`' own
    // rule for this block — defaults matching what the flags have always done —
    // applied in the direction that would REMOVE an affordance.
    renderInlineEdit(makeUpdatePermissions(true), {
      userActions: { search: false },
    } as Partial<ListViewSchema>);
    await waitFor(() => expect(screen.getByTestId('grid-stub')).toBeInTheDocument());
    expect(screen.queryByTestId('toolbar-inline-edit-toggle')).not.toBeNull();
  });
});
