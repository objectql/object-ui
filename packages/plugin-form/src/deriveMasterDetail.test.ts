import { describe, it, expect } from 'vitest';
import { findRelationshipField, deriveColumns, deriveDetail, fieldTypeToColumnType } from './deriveMasterDetail';

const taskSchema = {
  name: 'showcase_task',
  fields: {
    id: { type: 'text', system: true },
    title: { type: 'text', label: 'Title', required: true },
    status: { type: 'select', label: 'Status', options: [{ label: 'To Do', value: 'todo' }, { label: 'Done', value: 'done' }] },
    estimate_hours: { type: 'number', label: 'Estimate (h)' },
    budget: { type: 'currency', label: 'Budget' },
    due_date: { type: 'date', label: 'Due Date' },
    assignee: { type: 'lookup', label: 'Assignee', reference: 'user', display_field: 'name' },
    project: { type: 'master_detail', label: 'Project', reference: 'showcase_project', required: true },
    health: { type: 'formula', label: 'Health', expression: 'x' },
    created_at: { type: 'datetime' },
  },
};

describe('fieldTypeToColumnType', () => {
  it('maps object field types to grid column types', () => {
    expect(fieldTypeToColumnType('number')).toBe('number');
    expect(fieldTypeToColumnType('currency')).toBe('currency');
    expect(fieldTypeToColumnType('datetime')).toBe('date');
    expect(fieldTypeToColumnType('select')).toBe('select');
    expect(fieldTypeToColumnType('master_detail')).toBe('lookup');
    expect(fieldTypeToColumnType('email')).toBe('text');
  });
});

describe('findRelationshipField', () => {
  it('finds the master_detail field pointing at the parent', () => {
    expect(findRelationshipField(taskSchema, 'showcase_project')).toBe('project');
  });
  it('prefers master_detail over lookup', () => {
    const s = { fields: { a: { type: 'lookup', reference: 'p' }, b: { type: 'master_detail', reference: 'p' } } };
    expect(findRelationshipField(s, 'p')).toBe('b');
  });
  it('returns undefined when no field references the parent', () => {
    expect(findRelationshipField(taskSchema, 'nope')).toBeUndefined();
  });
});

describe('deriveColumns', () => {
  it('derives editable columns, skipping system/audit/FK/non-editable fields', () => {
    const cols = deriveColumns(taskSchema, { relationshipField: 'project' });
    const names = cols.map((c) => c.field);
    expect(names).toEqual(['title', 'status', 'estimate_hours', 'budget', 'due_date', 'assignee']);
    // id (system), created_at (audit), project (FK), health (formula) excluded
    expect(names).not.toContain('id');
    expect(names).not.toContain('project');
    expect(names).not.toContain('health');
    expect(names).not.toContain('created_at');
  });

  it('carries type, options, required and lookup reference through', () => {
    const cols = deriveColumns(taskSchema, { relationshipField: 'project' });
    const byName = Object.fromEntries(cols.map((c) => [c.field, c]));
    expect(byName.title).toMatchObject({ type: 'text', label: 'Title', required: true });
    expect(byName.status).toMatchObject({ type: 'select', options: [{ label: 'To Do', value: 'todo' }, { label: 'Done', value: 'done' }] });
    expect(byName.estimate_hours.type).toBe('number');
    expect(byName.budget.type).toBe('currency');
    expect(byName.assignee).toMatchObject({ type: 'lookup', reference: 'user', displayField: 'name' });
  });
});

describe('deriveColumns curation (column budget)', () => {
  const wideSchema = {
    name: 'wide',
    fields: {
      title: { type: 'text', label: 'Title', required: true },
      assignee: { type: 'text', label: 'Assignee' },
      status: { type: 'select', label: 'Status', required: true, options: [{ label: 'A', value: 'a' }] },
      priority: { type: 'select', label: 'Priority', options: [{ label: 'Hi', value: 'hi' }] },
      estimate_hours: { type: 'number', label: 'Estimate' },
      progress: { type: 'text', label: 'Progress' },
      done: { type: 'boolean', label: 'Done' },
      due_date: { type: 'date', label: 'Due' },
      start_date: { type: 'date', label: 'Start' },
      end_date: { type: 'date', label: 'End' },
      labels: { type: 'text', label: 'Labels' },
      notes: { type: 'text', label: 'Notes' },
      parent: { type: 'master_detail', label: 'Parent', reference: 'p', required: true },
    },
  };

  it('caps to the default budget (6) when a child has many editable fields', () => {
    const cols = deriveColumns(wideSchema, { relationshipField: 'parent' });
    expect(cols.length).toBe(6);
  });

  it('always keeps required columns even under the cap', () => {
    const names = deriveColumns(wideSchema, { relationshipField: 'parent' }).map((c) => c.field);
    expect(names).toContain('title');  // name-like + required
    expect(names).toContain('status'); // required
  });

  it('drops low-signal text columns before keeping them all', () => {
    const names = deriveColumns(wideSchema, { relationshipField: 'parent' }).map((c) => c.field);
    expect(names).not.toContain('notes');
    expect(names).not.toContain('labels');
  });

  it('preserves schema order in the curated output', () => {
    const names = deriveColumns(wideSchema, { relationshipField: 'parent' }).map((c) => c.field);
    const sorted = [...names].sort(
      (a, b) => Object.keys(wideSchema.fields).indexOf(a) - Object.keys(wideSchema.fields).indexOf(b),
    );
    expect(names).toEqual(sorted);
  });

  it('maxColumns: 0 disables curation and returns every editable column', () => {
    const cols = deriveColumns(wideSchema, { relationshipField: 'parent', maxColumns: 0 });
    expect(cols.length).toBe(12); // all editable (parent FK excluded)
  });

  it('keeps all required columns even if more than the budget', () => {
    const reqHeavy = {
      fields: {
        a: { type: 'text', required: true },
        b: { type: 'text', required: true },
        c: { type: 'text', required: true },
        d: { type: 'text', required: true },
        e: { type: 'text', required: true },
        f: { type: 'text', required: true },
        g: { type: 'text', required: true },
        h: { type: 'text' },
        parent: { type: 'master_detail', reference: 'p', required: true },
      },
    };
    const names = deriveColumns(reqHeavy, { relationshipField: 'parent' }).map((c) => c.field);
    expect(names).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']); // 7 required kept, non-required 'h' dropped
  });
});

describe('deriveDetail', () => {
  it('resolves relationshipField + columns + amountField from the child schema', () => {
    const d = deriveDetail('showcase_task', taskSchema, 'showcase_project');
    expect(d.relationshipField).toBe('project');
    expect(d.columns.map((c) => c.field)).toContain('estimate_hours');
    expect(d.amountField).toBe('estimate_hours'); // first numeric/currency column
  });

  it('honors explicit overrides over derived values', () => {
    const d = deriveDetail('showcase_task', taskSchema, 'showcase_project', {
      relationshipField: 'project',
      columns: [{ field: 'title', type: 'text' }],
      amountField: 'budget',
    });
    expect(d.columns).toHaveLength(1);
    expect(d.amountField).toBe('budget');
  });

  it('throws a helpful error when no relationship can be resolved', () => {
    expect(() => deriveDetail('showcase_task', { fields: { title: { type: 'text' } } }, 'showcase_project'))
      .toThrow(/could not find a lookup\/master_detail field/i);
  });
});
