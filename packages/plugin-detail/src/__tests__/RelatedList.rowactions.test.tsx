/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Coverage for surfacing a child object's own row actions in a detail-page
 * related list: RelatedList must thread `rowActions` / `onRowAction` into the
 * data-table schema (as `rowActionDefs` / `onRowActionDef`) and enable the
 * row-actions column, so the actions appear in each row's overflow menu.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import * as React from 'react';
import { RelatedList } from '../RelatedList';

// Capture the schema RelatedList hands to SchemaRenderer.
const h = vi.hoisted(() => ({ schema: null as any }));
vi.mock('@object-ui/react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    SchemaRenderer: (props: any) => {
      h.schema = props.schema;
      return null;
    },
  };
});

beforeEach(() => {
  h.schema = null;
});

describe('RelatedList — child object row actions', () => {
  it('threads rowActions into the data-table as rowActionDefs + enables the actions column', () => {
    const onRowAction = vi.fn();
    const rowActions = [
      { name: 'send_welcome', label: 'Send Welcome', icon: 'mail' },
      { name: 'deactivate', label: 'Deactivate', variant: 'danger' as const },
    ];
    render(
      <RelatedList
        title="Contacts"
        type="table"
        api="contact"
        objectName="contact"
        data={[{ id: 'c1', name: 'Alice' }]}
        columns={[{ accessorKey: 'name', header: 'Name' }]}
        rowActions={rowActions}
        onRowAction={onRowAction}
      />,
    );

    expect(h.schema).toBeTruthy();
    expect(h.schema.type).toBe('data-table');
    // Row-actions column is enabled purely by the presence of custom actions.
    expect(h.schema.rowActions).toBe(true);
    expect(h.schema.rowActionDefs).toEqual(rowActions);
    expect(h.schema.onRowActionDef).toBe(onRowAction);
  });

  it('does not enable row actions when none are supplied', () => {
    render(
      <RelatedList
        title="Contacts"
        type="table"
        api="contact"
        objectName="contact"
        data={[{ id: 'c1', name: 'Alice' }]}
        columns={[{ accessorKey: 'name', header: 'Name' }]}
      />,
    );

    expect(h.schema.type).toBe('data-table');
    expect(h.schema.rowActions).toBe(false);
    expect(h.schema.rowActionDefs).toBeUndefined();
    expect(h.schema.onRowActionDef).toBeUndefined();
  });
});
