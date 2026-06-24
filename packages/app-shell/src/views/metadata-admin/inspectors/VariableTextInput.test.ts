// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { formatToken, insertToken } from './VariableTextInput';

describe('formatToken', () => {
  it('inserts a bare token in expression fields (ADR-0032)', () => {
    expect(formatToken('discount_pct', 'expression')).toBe('discount_pct');
    expect(formatToken('record.amount', 'expression')).toBe('record.amount');
  });
  it('wraps a token in single braces in template fields', () => {
    expect(formatToken('discount_pct', 'template')).toBe('{discount_pct}');
    expect(formatToken('record.amount', 'template')).toBe('{record.amount}');
  });
});

describe('insertToken (cursor splice)', () => {
  it('appends at the caret (end of value) — expression mode, no braces', () => {
    const r = insertToken('lead_score >= ', 'expression', 'record.amount', 14, 14);
    expect(r.next).toBe('lead_score >= record.amount');
    expect(r.caret).toBe('lead_score >= record.amount'.length);
  });
  it('inserts mid-string at the caret', () => {
    // caret between "a " and "b": "a | b"
    const r = insertToken('a  b', 'expression', 'x', 2, 2);
    expect(r.next).toBe('a x b');
    expect(r.caret).toBe(3);
  });
  it('replaces the current selection', () => {
    const r = insertToken('hello OLD world', 'expression', 'NEW', 6, 9);
    expect(r.next).toBe('hello NEW world');
  });
  it('wraps with braces in template mode', () => {
    const r = insertToken('Hi ', 'template', 'record.name', 3, 3);
    expect(r.next).toBe('Hi {record.name}');
    expect(r.caret).toBe('Hi {record.name}'.length);
  });
  it('clamps out-of-range / reversed selections instead of corrupting the value', () => {
    expect(insertToken('abc', 'expression', 'X', 99, 99).next).toBe('abcX');
    expect(insertToken('abc', 'expression', 'X', 3, 1).next).toBe('aX'); // reversed [3,1] → selects 'bc', replaced
    expect(insertToken('', 'template', 'v', -5, -5).next).toBe('{v}');
  });
});
