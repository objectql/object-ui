import { describe, it, expect } from 'vitest';
import { findRelationshipField, deriveColumns, deriveDetail, deriveFormFields, resolveInlineMode, fieldTypeToColumnType } from './deriveMasterDetail';

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

  const visible = (cols: any[]) => cols.filter((c) => !c.defaultHidden).map((c) => c.field);

  it('returns ALL columns — none dropped — and defaults a focused 6 visible', () => {
    const cols = deriveColumns(wideSchema, { relationshipField: 'parent' });
    expect(cols.length).toBe(12);              // every editable column kept (parent FK excluded)
    expect(visible(cols).length).toBe(6);      // default-visible budget
    expect(cols.some((c) => c.defaultHidden)).toBe(true); // the rest collapsed, not gone
  });

  it('always keeps required columns visible (never default-hidden)', () => {
    const cols = deriveColumns(wideSchema, { relationshipField: 'parent' });
    expect(visible(cols)).toContain('title');  // name-like + required
    expect(visible(cols)).toContain('status'); // required
  });

  it('collapses low-signal text columns into the chooser (hidden, not dropped)', () => {
    const cols = deriveColumns(wideSchema, { relationshipField: 'parent' });
    const byName = Object.fromEntries(cols.map((c) => [c.field, c]));
    expect(byName.notes).toBeDefined();
    expect(byName.notes.defaultHidden).toBe(true);
    expect(byName.labels.defaultHidden).toBe(true);
  });

  it('preserves schema order (including hidden columns)', () => {
    const names = deriveColumns(wideSchema, { relationshipField: 'parent' }).map((c) => c.field);
    const sorted = [...names].sort(
      (a, b) => Object.keys(wideSchema.fields).indexOf(a) - Object.keys(wideSchema.fields).indexOf(b),
    );
    expect(names).toEqual(sorted);
  });

  it('maxColumns: 0 marks no column hidden (all visible)', () => {
    const cols = deriveColumns(wideSchema, { relationshipField: 'parent', maxColumns: 0 });
    expect(cols.length).toBe(12);
    expect(cols.every((c) => !c.defaultHidden)).toBe(true);
  });

  it('keeps all required columns visible even if more than the budget', () => {
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
    const cols = deriveColumns(reqHeavy, { relationshipField: 'parent' });
    expect(visible(cols)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']); // 7 required visible
    expect(cols.find((c) => c.field === 'h')?.defaultHidden).toBe(true); // non-required collapsed
    expect(cols.length).toBe(8); // nothing dropped
  });
});

describe('deriveFormFields (per-row expand form)', () => {
  it('returns business fields, excluding system/audit/FK/computed', () => {
    const fields = deriveFormFields(taskSchema, { relationshipField: 'project' });
    expect(fields).toContain('title');
    expect(fields).toContain('status');
    expect(fields).toContain('assignee');
    expect(fields).not.toContain('id');         // system
    expect(fields).not.toContain('created_at'); // audit
    expect(fields).not.toContain('project');    // back-reference FK
    expect(fields).not.toContain('health');     // formula (computed)
  });

  it('keeps rich input types the grid omits (textarea/file/etc.)', () => {
    const rich = {
      fields: {
        title: { type: 'text', required: true },
        parent: { type: 'master_detail', reference: 'p', required: true },
        notes: { type: 'textarea' },
        cover: { type: 'image' },
        attachment: { type: 'file' },
        total: { type: 'summary' }, // computed → excluded
      },
    };
    const fields = deriveFormFields(rich, { relationshipField: 'parent' });
    expect(fields).toEqual(expect.arrayContaining(['title', 'notes', 'cover', 'attachment']));
    expect(fields).not.toContain('total');
    expect(fields).not.toContain('parent');
  });

  it('is surfaced on deriveDetail output', () => {
    const d = deriveDetail('showcase_task', taskSchema, 'showcase_project');
    expect(Array.isArray(d.formFields)).toBe(true);
    expect(d.formFields).toContain('title');
    expect(d.formFields).not.toContain('project');
  });
});

describe('resolveInlineMode (grid vs form)', () => {
  const thin = { fields: { name: { type: 'text' }, amount: { type: 'currency' }, parent: { type: 'master_detail', reference: 'p' } } };
  const rich = { fields: { name: { type: 'text' }, notes: { type: 'textarea' }, parent: { type: 'master_detail', reference: 'p' } } };
  const wide = {
    fields: Object.fromEntries(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((n) => [n, { type: 'text' }])
        .concat([['parent', { type: 'master_detail', reference: 'p' }]]),
    ),
  };

  it('honors explicit grid/form', () => {
    expect(resolveInlineMode(thin, 'grid', { relationshipField: 'parent' })).toBe('grid');
    expect(resolveInlineMode(rich, 'grid', { relationshipField: 'parent' })).toBe('grid'); // explicit wins over heuristic
    expect(resolveInlineMode(thin, 'form', { relationshipField: 'parent' })).toBe('form');
  });

  it('smart default: thin child → grid', () => {
    expect(resolveInlineMode(thin, true, { relationshipField: 'parent' })).toBe('grid');
    expect(resolveInlineMode(thin, undefined, { relationshipField: 'parent' })).toBe('grid');
  });

  it('smart default: child with a rich/form-only type → form', () => {
    expect(resolveInlineMode(rich, true, { relationshipField: 'parent' })).toBe('form');
  });

  it('smart default: many business fields → form', () => {
    expect(resolveInlineMode(wide, true, { relationshipField: 'parent' })).toBe('form'); // 9 fields > 8
  });
});

describe('deriveDetail', () => {
  it('resolves relationshipField + columns + amountField from the child schema', () => {
    const d = deriveDetail('showcase_task', taskSchema, 'showcase_project');
    expect(d.relationshipField).toBe('project');
    expect(d.columns.map((c) => c.field)).toContain('estimate_hours');
    // The running total prefers the (last) currency column over a raw number
    // like hours — a line-grid footer is almost always a money total.
    expect(d.amountField).toBe('budget');
  });

  it('maps a field expression to a read-only computed column and totals it', () => {
    const lineSchema = {
      fields: {
        invoice: { type: 'master_detail', reference: 'inv' },
        product: { type: 'text', label: 'Product', required: true },
        quantity: { type: 'number', label: 'Qty', required: true },
        unit_price: { type: 'currency', label: 'Unit Price' },
        // Normalized CEL envelope, as the server serves it.
        amount: { type: 'currency', label: 'Amount', scale: 2, expression: { dialect: 'cel', source: 'record.quantity * record.unit_price' } },
      },
    };
    const d = deriveDetail('inv_line', lineSchema, 'inv');
    const amountCol = d.columns.find((c) => c.field === 'amount')!;
    expect(amountCol.computed).toBe(true);
    expect(amountCol.expr).toBe('record.quantity * record.unit_price');
    expect(amountCol.required).toBe(false); // computed → never user-required
    expect(d.amountField).toBe('amount'); // running total prefers the computed line total
  });

  it('detects a sort/position field, excludes it from columns, and reports it as sortField', () => {
    const lineSchema = {
      fields: {
        invoice: { type: 'master_detail', reference: 'inv' },
        position: { type: 'number', label: 'Position' },
        product: { type: 'text', label: 'Product', required: true },
        quantity: { type: 'number', label: 'Qty', required: true },
      },
    };
    const d = deriveDetail('inv_line', lineSchema, 'inv');
    expect(d.sortField).toBe('position');
    expect(d.columns.map((c) => c.field)).not.toContain('position'); // not user-edited
    expect(d.formFields).not.toContain('position');
    expect(d.columns.map((c) => c.field)).toEqual(['product', 'quantity']);
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
