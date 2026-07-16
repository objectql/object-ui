/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  evalRowPredicate,
  resolveConditionalFormatting,
  isLegacyDialectSource,
} from '../listConditional';

describe('isLegacyDialectSource', () => {
  it('flags legacy-only syntax', () => {
    expect(isLegacyDialectSource('${data.x > 1}')).toBe(true);
    expect(isLegacyDialectSource("status === 'active'")).toBe(true);
    expect(isLegacyDialectSource('status !== 1')).toBe(true);
    expect(isLegacyDialectSource('record.name?.length')).toBe(true);
    expect(isLegacyDialectSource('a ?? b')).toBe(true);
    expect(isLegacyDialectSource("name.includes('x')")).toBe(true);
  });

  it('treats canonical CEL as non-legacy', () => {
    expect(isLegacyDialectSource("record.status == 'active'")).toBe(false);
    expect(isLegacyDialectSource("status in ['a', 'b']")).toBe(false);
    expect(isLegacyDialectSource("name.contains('x')")).toBe(false);
    expect(isLegacyDialectSource('a && b || c')).toBe(false);
  });
});

describe('evalRowPredicate', () => {
  it('evaluates a canonical CEL predicate over the row (record.* and bare)', () => {
    expect(evalRowPredicate("record.status == 'active'", { status: 'active' })).toBe(true);
    expect(evalRowPredicate("status == 'active'", { status: 'active' })).toBe(true);
    expect(evalRowPredicate("record.status == 'active'", { status: 'closed' })).toBe(false);
  });

  it('supports the CEL `in` operator (which the legacy engine lacks)', () => {
    expect(evalRowPredicate("record.status in ['sent', 'paid']", { status: 'paid' })).toBe(true);
    expect(evalRowPredicate("record.status in ['sent', 'paid']", { status: 'draft' })).toBe(false);
  });

  it('always evaluates an { dialect: cel } envelope on the CEL engine (never legacy)', () => {
    expect(
      evalRowPredicate({ dialect: 'cel', source: "record.status == 'active'" }, { status: 'active' }),
    ).toBe(true);
  });

  it('binds an extra scope (features/user) alongside the row', () => {
    expect(
      evalRowPredicate('features.canEdit == true', { id: '1' }, {
        scope: { features: { canEdit: true } },
      }),
    ).toBe(true);
    expect(
      evalRowPredicate("record.id == user.id", { id: 'u1' }, { scope: { user: { id: 'u1' } } }),
    ).toBe(true);
  });

  it('returns the fallback for an absent or empty predicate', () => {
    expect(evalRowPredicate(undefined, { a: 1 }, { fallback: true })).toBe(true);
    expect(evalRowPredicate(null, { a: 1 }, { fallback: false })).toBe(false);
    expect(evalRowPredicate('   ', { a: 1 }, { fallback: true })).toBe(true);
  });

  it('fails to the fallback on a broken predicate', () => {
    expect(evalRowPredicate('record.status ==', { status: 'x' }, { fallback: false })).toBe(false);
    expect(evalRowPredicate('record.status ==', { status: 'x' }, { fallback: true })).toBe(true);
  });

  describe('legacy-dialect routing', () => {
    let warn: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => warn.mockRestore());

    it('routes a `${…}` template string to the legacy engine and warns once', () => {
      expect(evalRowPredicate('${data.status === "active"}', { status: 'active' })).toBe(true);
      expect(evalRowPredicate('${data.status === "active"}', { status: 'closed' })).toBe(false);
      // Same source warns only once.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('legacy expression dialect');
    });

    it('routes a bare `===` string to the legacy engine', () => {
      expect(evalRowPredicate("status === 'active'", { status: 'active' })).toBe(true);
    });
  });

  describe('warnOnError (fail-closed row actions)', () => {
    let warn: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => warn.mockRestore());

    it('warns and returns the fallback when a present predicate faults', () => {
      const r = evalRowPredicate('record.status ==', { status: 'x' }, {
        fallback: false,
        warnOnError: true,
        label: 'resume',
      });
      expect(r).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('failed to evaluate');
    });

    it('does NOT warn on a genuine false', () => {
      const r = evalRowPredicate("record.status == 'active'", { status: 'closed' }, {
        fallback: false,
        warnOnError: true,
      });
      expect(r).toBe(false);
      expect(warn).not.toHaveBeenCalled();
    });
  });
});

describe('resolveConditionalFormatting', () => {
  it('returns {} for empty / missing rules', () => {
    expect(resolveConditionalFormatting({ a: 1 }, undefined)).toEqual({});
    expect(resolveConditionalFormatting({ a: 1 }, [])).toEqual({});
  });

  it('spec shape { condition, style } — CEL predicate', () => {
    expect(
      resolveConditionalFormatting({ status: 'overdue' }, [
        { condition: "record.status == 'overdue'", style: { backgroundColor: '#fee2e2', color: '#991b1b' } },
      ]),
    ).toEqual({ backgroundColor: '#fee2e2', color: '#991b1b' });
    expect(
      resolveConditionalFormatting({ status: 'ok' }, [
        { condition: "record.status == 'overdue'", style: { backgroundColor: '#fee2e2' } },
      ]),
    ).toEqual({});
  });

  it('native shape { field, operator, value } — translated to CEL', () => {
    const rules = [
      { field: 'status', operator: 'equals' as const, value: 'active', backgroundColor: '#e0ffe0' },
    ];
    expect(resolveConditionalFormatting({ status: 'active' }, rules)).toEqual({ backgroundColor: '#e0ffe0' });
    expect(resolveConditionalFormatting({ status: 'inactive' }, rules)).toEqual({});
  });

  it('native operators: not_equals / greater_than / less_than / contains / in', () => {
    expect(
      resolveConditionalFormatting({ n: 5 }, [{ field: 'n', operator: 'greater_than', value: 3, textColor: 'red' }]),
    ).toEqual({ color: 'red' });
    expect(
      resolveConditionalFormatting({ n: 5 }, [{ field: 'n', operator: 'less_than', value: 3, textColor: 'red' }]),
    ).toEqual({});
    expect(
      resolveConditionalFormatting({ s: 'hello world' }, [
        { field: 's', operator: 'contains', value: 'world', borderColor: '#000' },
      ]),
    ).toEqual({ borderColor: '#000' });
    expect(
      resolveConditionalFormatting({ tier: 'gold' }, [
        { field: 'tier', operator: 'in', value: ['gold', 'platinum'], backgroundColor: 'gold' },
      ]),
    ).toEqual({ backgroundColor: 'gold' });
    expect(
      resolveConditionalFormatting({ tier: 'bronze' }, [
        { field: 'tier', operator: 'not_equals', value: 'bronze', backgroundColor: 'x' },
      ]),
    ).toEqual({});
  });

  it('first matching rule wins', () => {
    const rules = [
      { condition: "record.n > 100", style: { backgroundColor: 'red' } },
      { condition: "record.n > 10", style: { backgroundColor: 'orange' } },
    ];
    expect(resolveConditionalFormatting({ n: 50 }, rules)).toEqual({ backgroundColor: 'orange' });
    expect(resolveConditionalFormatting({ n: 500 }, rules)).toEqual({ backgroundColor: 'red' });
  });

  it('color props override the base style map', () => {
    expect(
      resolveConditionalFormatting({ ok: true }, [
        {
          condition: 'record.ok == true',
          style: { backgroundColor: 'base', fontWeight: 'bold' },
          backgroundColor: 'override',
          textColor: 'blue',
        },
      ]),
    ).toEqual({ backgroundColor: 'override', fontWeight: 'bold', color: 'blue' });
  });

  it('a rule whose field is missing from the record fails soft (no style)', () => {
    expect(
      resolveConditionalFormatting({ other: 1 }, [
        { field: 'status', operator: 'equals', value: 'active', backgroundColor: 'x' },
      ]),
    ).toEqual({});
  });
});
