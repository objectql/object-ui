// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { getReportSchema, getReportForm } from './report-schema';

describe('report-schema — getReportSchema', () => {
  it('derives a JSONSchema object for the Report document', () => {
    const schema = getReportSchema();
    expect(schema).toBeDefined();
    expect(schema?.type).toBe('object');
    const props = schema?.properties ?? {};
    // Core report properties flow through from the spec.
    expect(props.name).toBeDefined();
    expect(props.label).toBeDefined();
    expect(props.objectName).toBeDefined();
    expect(props.type).toBeDefined();
    expect(props.columns).toBeDefined();
  });

  it('exposes the report `type` enum from the spec', () => {
    const schema = getReportSchema();
    const en = schema?.properties?.type?.enum;
    expect(Array.isArray(en)).toBe(true);
    expect(en).toEqual(expect.arrayContaining(['tabular', 'summary', 'matrix', 'joined']));
  });

  it('memoises the result (same reference across calls)', () => {
    expect(getReportSchema()).toBe(getReportSchema());
  });
});

describe('report-schema — getReportForm', () => {
  it('returns a FormView with sections', () => {
    const form = getReportForm();
    expect(form).toBeDefined();
    expect(Array.isArray(form?.sections)).toBe(true);
    expect((form?.sections?.length ?? 0)).toBeGreaterThan(0);
  });

  it('prunes inspector-owned fields (columns / objectName / name) from every section', () => {
    const form = getReportForm();
    const declared = new Set<string>();
    for (const s of form?.sections ?? []) {
      for (const f of s.fields ?? []) {
        declared.add(typeof f === 'string' ? f : (f as { field: string }).field);
      }
    }
    expect(declared.has('columns')).toBe(false);
    expect(declared.has('objectName')).toBe(false);
    expect(declared.has('name')).toBe(false);
  });

  it('keeps non-owned spec fields (e.g. filter / chart / description)', () => {
    const form = getReportForm();
    const declared = new Set<string>();
    for (const s of form?.sections ?? []) {
      for (const f of s.fields ?? []) {
        declared.add(typeof f === 'string' ? f : (f as { field: string }).field);
      }
    }
    expect(declared.has('description')).toBe(true);
    expect(declared.has('filter')).toBe(true);
    expect(declared.has('chart')).toBe(true);
  });

  it('drops sections that become empty after pruning', () => {
    const form = getReportForm();
    for (const s of form?.sections ?? []) {
      expect((s.fields ?? []).length).toBeGreaterThan(0);
    }
  });

  it('memoises the result (same reference across calls)', () => {
    expect(getReportForm()).toBe(getReportForm());
  });
});
