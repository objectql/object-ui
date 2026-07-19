/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * auditHistoryDisplay — unit tests for the record History tab's diff
 * pipeline. Mirrors the field mix from the gantt QA report (objectui
 * detail-page history display): datetime fields shown as raw ISO strings,
 * lookup ids shown as raw JSON arrays, and formula helper fields producing
 * a phantom "value → —" line on every update.
 */
import { describe, it, expect } from 'vitest';
import {
  parseAuditValue,
  collectAuditChanges,
  collectLookupIds,
  formatAuditValue,
} from '../auditHistoryDisplay';

const fields = {
  plan_start: { type: 'datetime', label: '计划开始日期' },
  due_date: { type: 'date', label: '截止日期' },
  predecessors: { type: 'lookup', label: '紧前计划', reference_to: 'gantt_plan', multiple: true },
  deps_rendered: { type: 'formula', label: '紧前依赖(渲染用)' },
  helper: { type: 'text', label: '内部辅助', hidden: true },
  is_locked: { type: 'boolean', label: '锁定' },
  status: {
    type: 'select',
    label: '状态',
    options: [
      { value: 'todo', label: '待开始' },
      { value: 'doing', label: '进行中' },
    ],
  },
} as const;

describe('parseAuditValue', () => {
  it('parses JSON strings and passes objects through', () => {
    expect(parseAuditValue('{"a":1}')).toEqual({ a: 1 });
    expect(parseAuditValue({ a: 1 })).toEqual({ a: 1 });
    expect(parseAuditValue(null)).toBeNull();
    expect(parseAuditValue('not json')).toBeNull();
  });
});

describe('collectAuditChanges', () => {
  it('keeps genuine field changes', () => {
    const changes = collectAuditChanges(
      { plan_start: '2026-07-26T00:00:00.000Z' },
      { plan_start: '2026-08-04T12:00:00.000Z' },
      fields as any,
    );
    expect(changes).toEqual([
      { field: 'plan_start', from: '2026-07-26T00:00:00.000Z', to: '2026-08-04T12:00:00.000Z' },
    ]);
  });

  it('drops formula fields (asymmetric audit snapshots make their diffs phantom)', () => {
    const changes = collectAuditChanges(
      { deps_rendered: ['LnLJIsTwXbv1E2gF'] },
      { deps_rendered: null },
      fields as any,
    );
    expect(changes).toEqual([]);
  });

  it('drops hidden fields', () => {
    expect(collectAuditChanges({ helper: 'a' }, { helper: 'b' }, fields as any)).toEqual([]);
  });

  it('drops empty↔empty no-ops (undefined vs null vs "" vs [])', () => {
    expect(collectAuditChanges({ predecessors: '' }, { predecessors: null }, fields as any)).toEqual([]);
    expect(collectAuditChanges({}, { predecessors: [] }, fields as any)).toEqual([]);
  });

  it('drops system/noise columns and unchanged values', () => {
    const changes = collectAuditChanges(
      { organization_id: 'o1', updated_at: '1', status: 'todo' },
      { organization_id: 'o2', updated_at: '2', status: 'todo' },
      fields as any,
    );
    expect(changes).toEqual([]);
  });

  it('keeps unknown fields (no def) so nothing is silently lost', () => {
    const changes = collectAuditChanges({ custom: 1 }, { custom: 2 }, fields as any);
    expect(changes).toEqual([{ field: 'custom', from: 1, to: 2 }]);
  });
});

describe('collectLookupIds', () => {
  it('gathers scalar and array ids per reference target', () => {
    const map = collectLookupIds(
      [
        { field: 'predecessors', from: null, to: ['LnLJIsTwXbv1E2gF'] },
        { field: 'predecessors', from: ['a'], to: 'b' },
        { field: 'plan_start', from: '1', to: '2' }, // not a lookup
      ],
      fields as any,
    );
    expect(map.size).toBe(1);
    expect(Array.from(map.get('gantt_plan')!)).toEqual(
      expect.arrayContaining(['LnLJIsTwXbv1E2gF', 'a', 'b']),
    );
  });
});

describe('formatAuditValue', () => {
  it('renders empty values as empty string', () => {
    expect(formatAuditValue(fields.plan_start as any, null)).toBe('');
    expect(formatAuditValue(fields.predecessors as any, [])).toBe('');
  });

  it('localizes datetime values instead of raw ISO strings', () => {
    const out = formatAuditValue(fields.plan_start as any, '2026-08-04T12:00:00.000Z', {
      locale: 'zh-CN',
    });
    expect(out).not.toContain('T12:00:00.000Z');
    expect(out).toContain('2026');
  });

  it('renders date values without a time component', () => {
    const out = formatAuditValue(fields.due_date as any, '2026-08-06T00:00:00.000Z', {
      locale: 'en-US',
    });
    expect(out).not.toContain(':');
    expect(out).toContain('2026');
  });

  it('maps lookup ids to resolved record labels, joining arrays', () => {
    const lookupLabels = new Map([
      ['gantt_plan', new Map([['LnLJIsTwXbv1E2gF', '甘特计划B 装配']])],
    ]);
    expect(
      formatAuditValue(fields.predecessors as any, ['LnLJIsTwXbv1E2gF'], { lookupLabels }),
    ).toBe('甘特计划B 装配');
    // Unresolved ids fall back to the raw id, not JSON syntax.
    expect(formatAuditValue(fields.predecessors as any, ['x1', 'LnLJIsTwXbv1E2gF'], { lookupLabels })).toBe(
      'x1, 甘特计划B 装配',
    );
  });

  it('maps select values to option labels', () => {
    expect(formatAuditValue(fields.status as any, 'doing')).toBe('进行中');
  });

  it('localizes booleans through t with Yes/No fallback', () => {
    expect(formatAuditValue(fields.is_locked as any, true)).toBe('Yes');
    const t = (key: string) => (key === 'common.yes' ? '是' : '否');
    expect(formatAuditValue(fields.is_locked as any, false, { t })).toBe('否');
  });
});
