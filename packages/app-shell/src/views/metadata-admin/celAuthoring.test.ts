// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, afterEach } from 'vitest';
import {
  lintCelPredicate,
  introspectCelScope,
  testRunCelPredicate,
  inferCelValueType,
  __setCelFormulaLoader,
} from './celAuthoring';

const HINT = { objectName: 'account', fields: ['organization_id', 'owner_id', 'status', 'amount'] };

afterEach(() => __setCelFormulaLoader(undefined));

/**
 * These run against the REAL `@objectstack/formula` engine (the same parser the
 * server uses) — the whole point of the bridge is that the GUI and the server
 * reach the identical verdict, so mocking the engine would test nothing.
 */
describe('celAuthoring · lintCelPredicate (real engine)', () => {
  it('is clean for a valid bare-field predicate', async () => {
    expect(await lintCelPredicate('organization_id == current_user.organization_id', HINT)).toEqual([]);
  });

  it('reports a parse error (blocking) for malformed CEL', async () => {
    const issues = await lintCelPredicate('organization_id ==', HINT);
    expect(issues.some((i) => i.severity === 'error')).toBe(true);
  });

  it('flags the single-brace map-literal footgun as an error', async () => {
    const issues = await lintCelPredicate('{status} == "open"', HINT);
    expect(issues.some((i) => i.severity === 'error')).toBe(true);
  });

  it('warns (non-blocking) on an unknown-field near miss', async () => {
    const issues = await lintCelPredicate('organizaton_id == 1', HINT);
    expect(issues.some((i) => i.severity === 'warning')).toBe(true);
    expect(issues.some((i) => i.severity === 'error')).toBe(false);
  });

  it('advises when a USING read filter is not pushdown-able (fail-open blast radius)', async () => {
    const issues = await lintCelPredicate('upper(status) == "OPEN"', { ...HINT, clause: 'using' });
    expect(issues.some((i) => i.severity === 'warning' && /push it down|widen/i.test(i.message))).toBe(true);
  });

  it('does NOT raise the pushdown advisory for a CHECK clause', async () => {
    const issues = await lintCelPredicate('upper(status) == "OPEN"', { ...HINT, clause: 'check' });
    expect(issues.some((i) => /push it down/i.test(i.message))).toBe(false);
  });

  it('is clean for empty input', async () => {
    expect(await lintCelPredicate('', HINT)).toEqual([]);
    expect(await lintCelPredicate('   ', HINT)).toEqual([]);
  });
});

describe('celAuthoring · lintCelPredicate in record scope (field conditional rules, #1582)', () => {
  const RULE_HINT = { ...HINT, scope: 'record' as const };

  it('is clean for a record.<field> predicate', async () => {
    expect(await lintCelPredicate('record.status == "open"', RULE_HINT)).toEqual([]);
  });

  it('flags a BARE field reference as an error with the record.<field> fix', async () => {
    const issues = await lintCelPredicate('status == "open"', RULE_HINT);
    expect(issues.some((i) => i.severity === 'error' && /record\.status/.test(i.message))).toBe(true);
  });

  it('flags an unknown record.<field> as an error with did-you-mean', async () => {
    const issues = await lintCelPredicate('record.statu == "open"', RULE_HINT);
    expect(issues.some((i) => i.severity === 'error' && /did you mean/i.test(i.message))).toBe(true);
  });

  it('checks previous.<field> refs against the catalog too', async () => {
    expect(await lintCelPredicate('record.status != previous.status', RULE_HINT)).toEqual([]);
    const issues = await lintCelPredicate('previous.statu == "x"', RULE_HINT);
    expect(issues.some((i) => i.severity === 'error')).toBe(true);
  });

  it('accepts the master-detail parent.* root without flagging it bare', async () => {
    expect(await lintCelPredicate('parent.status == "paid"', RULE_HINT)).toEqual([]);
  });
});

describe('celAuthoring · lintCelPredicate role "value" (formula expressions, #1582 follow-up)', () => {
  const FORMULA_HINT = { ...HINT, scope: 'record' as const, role: 'value' as const };

  it('is clean for a record-namespaced value expression (non-boolean is the point)', async () => {
    expect(await lintCelPredicate('record.amount * 0.2', FORMULA_HINT)).toEqual([]);
  });

  it('flags a BARE field reference as an error with the record.<field> fix', async () => {
    const issues = await lintCelPredicate('amount * 0.2', FORMULA_HINT);
    expect(issues.some((i) => i.severity === 'error' && /record\.amount/.test(i.message))).toBe(true);
  });

  it('flags an unknown record.<field> as an error with did-you-mean', async () => {
    const issues = await lintCelPredicate('record.amout * 0.2', FORMULA_HINT);
    expect(issues.some((i) => i.severity === 'error' && /did you mean/i.test(i.message))).toBe(true);
  });

  it('reports a parse error (blocking) for malformed CEL', async () => {
    const issues = await lintCelPredicate('record.amount *', FORMULA_HINT);
    expect(issues.some((i) => i.severity === 'error')).toBe(true);
  });
});

describe('celAuthoring · inferCelValueType (real engine)', () => {
  const FIELDS = { fields: ['amount', 'name', 'start_date', 'end_date'] };

  it('proves number for literal-pinned arithmetic', async () => {
    expect(await inferCelValueType('record.amount * 0.2', FIELDS)).toBe('number');
  });

  it('proves number for a numeric stdlib return', async () => {
    expect(await inferCelValueType('daysBetween(record.start_date, record.end_date) + 1', FIELDS)).toBe('number');
  });

  it('proves text for a string-returning stdlib call', async () => {
    expect(await inferCelValueType('upper(record.name)', FIELDS)).toBe('text');
  });

  it('proves boolean for a comparison', async () => {
    expect(await inferCelValueType('record.amount > 100', FIELDS)).toBe('boolean');
  });

  it('is unknown for dyn-over-dyn arithmetic (could be concatenation)', async () => {
    expect(await inferCelValueType('record.amount + record.name', FIELDS)).toBe('unknown');
  });

  it('is null (no affordance) for empty input', async () => {
    expect(await inferCelValueType('', FIELDS)).toBeNull();
    expect(await inferCelValueType('   ', FIELDS)).toBeNull();
  });
});

describe('celAuthoring · introspectCelScope (real engine)', () => {
  it('returns the object fields, scope roots, and stdlib functions', async () => {
    const scope = await introspectCelScope(HINT);
    expect(scope.fields).toContain('organization_id');
    expect(scope.roots).toContain('current_user');
    expect(scope.roots).toContain('record');
    expect(scope.functions).toContain('has');
  });

  it('honors a roots override (field rules bind record/previous/parent only)', async () => {
    const scope = await introspectCelScope({ ...HINT, scope: 'record', roots: ['record', 'previous', 'parent'] });
    expect(scope.roots).toEqual(['record', 'previous', 'parent']);
    expect(scope.functions).toContain('has');
  });
});

describe('celAuthoring · testRunCelPredicate (real engine)', () => {
  const sample = {
    record: { organization_id: 'org-1', status: 'open', amount: 500 },
    currentUser: { id: 'u1', organization_id: 'org-1', positions: ['sales'] },
  };

  it('ALLOWS when a bare-field predicate is satisfied', async () => {
    expect(await testRunCelPredicate('organization_id == current_user.organization_id', sample)).toEqual({
      status: 'allow',
    });
  });

  it('DENIES when the predicate is not satisfied', async () => {
    const out = await testRunCelPredicate('organization_id == current_user.organization_id', {
      ...sample,
      record: { ...sample.record, organization_id: 'org-X' },
    });
    expect(out).toEqual({ status: 'deny' });
  });

  it('supports the record.* namespaced form and membership', async () => {
    expect(await testRunCelPredicate('record.status == "open"', sample)).toEqual({ status: 'allow' });
    expect(await testRunCelPredicate('"sales" in current_user.positions', sample)).toEqual({ status: 'allow' });
  });

  it('reports a runtime error for a missing key (self-correcting message)', async () => {
    const out = await testRunCelPredicate('current_user.nope == 1', sample);
    expect(out.status).toBe('error');
    if (out.status === 'error') expect(out.message).toMatch(/nope/);
  });

  it('flags a non-boolean result as a "value" outcome', async () => {
    const out = await testRunCelPredicate('amount', sample);
    expect(out.status).toBe('value');
    if (out.status === 'value') expect(out.value).toBe(500);
  });
});

describe('celAuthoring · graceful degradation', () => {
  it('lint returns [] when the engine is unavailable', async () => {
    __setCelFormulaLoader(() => Promise.resolve(null));
    expect(await lintCelPredicate('organization_id ==', HINT)).toEqual([]);
  });

  it('introspect falls back to metadata fields when the engine is unavailable', async () => {
    __setCelFormulaLoader(() => Promise.resolve(null));
    const scope = await introspectCelScope(HINT);
    expect(scope.fields).toEqual(HINT.fields);
    expect(scope.roots).toEqual([]);
  });

  it('test-run reports "unavailable" when the engine cannot load', async () => {
    __setCelFormulaLoader(() => Promise.resolve(null));
    expect(await testRunCelPredicate('true', { record: {}, currentUser: {} })).toEqual({
      status: 'unavailable',
    });
  });

  it('type inference reports null (no affordance) when the engine is unavailable', async () => {
    __setCelFormulaLoader(() => Promise.resolve(null));
    expect(await inferCelValueType('record.amount * 0.2', { fields: ['amount'] })).toBeNull();
  });

  it('swallows a loader that throws', async () => {
    __setCelFormulaLoader(() => {
      throw new Error('boom');
    });
    expect(await lintCelPredicate('x == 1', HINT)).toEqual([]);
    expect(await testRunCelPredicate('true', { record: {}, currentUser: {} })).toEqual({
      status: 'unavailable',
    });
    expect(await inferCelValueType('1 + 1')).toBeNull();
  });
});
