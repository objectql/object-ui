// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  defaultColumnsFromObject,
  defaultKanbanFromObject,
  defaultCalendarFromObject,
  defaultGalleryFromObject,
} from './InterfaceListPage';

/**
 * ADR-0047: when a page whitelists a visualization (appearance.allowedVisualizations)
 * but the source view carries no binding for it, InterfaceListPage derives a
 * sensible default from the object's fields — so the switcher actually offers
 * and renders the viz (Airtable auto-picks a stack field on switch). Without
 * this, ListView.availableViews silently drops the whitelisted viz.
 */
const taskObject = {
  fields: {
    id: { type: 'autonumber' },
    title: { type: 'text' },
    status: { type: 'select' },
    due_date: { type: 'date' },
    cover: { type: 'image' },
    created_at: { type: 'datetime' },
  },
};

describe('InterfaceListPage default viz bindings', () => {
  it('kanban: picks the first select field as the group field (both aliases)', () => {
    expect(defaultKanbanFromObject(taskObject)).toEqual({ groupField: 'status', groupByField: 'status' });
  });

  it('kanban: falls back to a status-like field name when no select type exists', () => {
    const obj = { fields: { title: { type: 'text' }, stage: { type: 'text' } } };
    expect(defaultKanbanFromObject(obj)).toEqual({ groupField: 'stage', groupByField: 'stage' });
  });

  it('kanban: undefined when nothing groupable', () => {
    expect(defaultKanbanFromObject({ fields: { title: { type: 'text' }, note: { type: 'text' } } })).toBeUndefined();
  });

  it('calendar: picks the first date field (skipping system audit columns)', () => {
    expect(defaultCalendarFromObject(taskObject)).toEqual({ startDateField: 'due_date' });
  });

  it('gallery: picks the first image field', () => {
    expect(defaultGalleryFromObject(taskObject)).toEqual({ coverField: 'cover' });
  });

  it('ignores hidden and system fields', () => {
    const obj = { fields: { created_at: { type: 'datetime' }, hidden_sel: { type: 'select', hidden: true }, real_sel: { type: 'select' } } };
    expect(defaultKanbanFromObject(obj)).toEqual({ groupField: 'real_sel', groupByField: 'real_sel' });
  });
});

describe('defaultColumnsFromObject', () => {
  // Mirrors how the framework's `applySystemFields` presents an object to the
  // console: injected system fields (owner_id, audit columns) are spread to the
  // FRONT of the field map and carry `system: true`; owner_id is deliberately
  // non-hidden / non-readonly because ownership is reassignable.
  const fieldZooLike = {
    fields: {
      owner_id: { type: 'lookup', label: 'Owner', system: true },
      created_at: { type: 'datetime', system: true, readonly: true },
      created_by: { type: 'lookup', system: true, readonly: true },
      organization_id: { type: 'lookup', system: true, hidden: true },
      name: { type: 'text' },
      f_email: { type: 'email' },
      f_number: { type: 'number' },
    },
  };

  it('does NOT lead with the injected owner_id — business fields come first', () => {
    const cols = defaultColumnsFromObject(fieldZooLike);
    expect(cols[0]).toBe('name');
    expect(cols).not.toContain('owner_id');
    expect(cols).not.toContain('created_at');
    expect(cols).not.toContain('organization_id');
    expect(cols).toEqual(['name', 'f_email', 'f_number']);
  });

  it('excludes owner_id even when it arrives without the system flag (name fallback)', () => {
    const cols = defaultColumnsFromObject({
      fields: { owner_id: { type: 'lookup' }, title: { type: 'text' } },
    });
    expect(cols).toEqual(['title']);
  });

  it('honors highlightFields as the curated override', () => {
    const cols = defaultColumnsFromObject({
      highlightFields: ['name', 'owner_id'],
      fields: fieldZooLike.fields,
    });
    // Curated list wins verbatim (only dropping names with no field def).
    expect(cols).toEqual(['name', 'owner_id']);
  });

  it('caps the auto-derived business columns at six', () => {
    const fields: Record<string, any> = { owner_id: { type: 'lookup', system: true } };
    for (let i = 0; i < 10; i++) fields[`b_${i}`] = { type: 'text' };
    const cols = defaultColumnsFromObject({ fields });
    expect(cols).toHaveLength(6);
    expect(cols).not.toContain('owner_id');
    expect(cols[0]).toBe('b_0');
  });
});
