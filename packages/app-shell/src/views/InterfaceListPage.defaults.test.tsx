// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
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
