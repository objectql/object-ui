// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { getDashboardSchema, getDashboardForm } from './dashboard-schema';

describe('dashboard-schema — getDashboardSchema', () => {
  it('derives a JSONSchema object for the Dashboard document', () => {
    const schema = getDashboardSchema();
    expect(schema).toBeDefined();
    expect(schema?.type).toBe('object');
    const props = schema?.properties ?? {};
    // Core dashboard properties flow through from the spec.
    expect(props.name).toBeDefined();
    expect(props.label).toBeDefined();
    expect(props.description).toBeDefined();
    expect(props.widgets).toBeDefined();
    expect(props.columns).toBeDefined();
  });

  it('memoises the result (same reference across calls)', () => {
    expect(getDashboardSchema()).toBe(getDashboardSchema());
  });
});

describe('dashboard-schema — getDashboardForm', () => {
  it('returns a FormView with sections', () => {
    const form = getDashboardForm();
    expect(form).toBeDefined();
    expect(Array.isArray(form?.sections)).toBe(true);
    expect((form?.sections?.length ?? 0)).toBeGreaterThan(0);
  });

  it('prunes inspector-owned fields (widgets / label / description / name) from every section', () => {
    const form = getDashboardForm();
    const declared = new Set<string>();
    for (const s of form?.sections ?? []) {
      for (const f of s.fields ?? []) {
        declared.add(typeof f === 'string' ? f : (f as { field: string }).field);
      }
    }
    expect(declared.has('widgets')).toBe(false);
    expect(declared.has('label')).toBe(false);
    expect(declared.has('description')).toBe(false);
    expect(declared.has('name')).toBe(false);
  });

  it('keeps non-owned spec fields (e.g. layout / filters / performance)', () => {
    const form = getDashboardForm();
    const declared = new Set<string>();
    for (const s of form?.sections ?? []) {
      for (const f of s.fields ?? []) {
        declared.add(typeof f === 'string' ? f : (f as { field: string }).field);
      }
    }
    // Layout, filter and advanced fields survive the prune.
    expect(declared.has('columns')).toBe(true);
    expect(declared.has('globalFilters')).toBe(true);
    expect(declared.has('performance')).toBe(true);
  });

  it('drops sections that become empty after pruning', () => {
    const form = getDashboardForm();
    for (const s of form?.sections ?? []) {
      expect((s.fields ?? []).length).toBeGreaterThan(0);
    }
  });

  it('memoises the result (same reference across calls)', () => {
    expect(getDashboardForm()).toBe(getDashboardForm());
  });
});
