// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { findUnknownRefs, scopeRoots } from './flow-ref-check';
import type { ScopeRef } from './flow-scope';

const roots = (...tokens: string[]) =>
  scopeRoots(tokens.map((t) => ({ token: t, label: t, group: 'variables' }) as ScopeRef));

describe('scopeRoots', () => {
  it('reduces ref tokens to their path roots, de-duped', () => {
    const s = roots('lead_score', 'record', 'record.email', 'record.account');
    expect([...s].sort()).toEqual(['lead_score', 'record']);
  });
});

describe('findUnknownRefs (predicate)', () => {
  const known = roots('lead_score', 'record', 'previous', 'account_data');

  it('accepts in-scope roots and any path under them', () => {
    expect(findUnknownRefs('lead_score >= 60', 'predicate', known)).toEqual([]);
    expect(findUnknownRefs('record.email != null && previous.status == "x"', 'predicate', known)).toEqual([]);
    expect(findUnknownRefs('account_data.annual_revenue > 1000', 'predicate', known)).toEqual([]);
  });

  it('flags a typo with a nearest-match suggestion', () => {
    const u = findUnknownRefs('recrod.email != null', 'predicate', known);
    expect(u).toHaveLength(1);
    expect(u[0]).toEqual({ token: 'recrod', suggestion: 'record' });
  });

  it('flags a genuinely unknown ref with no close match (no suggestion)', () => {
    const u = findUnknownRefs('discount_pct > 30', 'predicate', known);
    expect(u.map((x) => x.token)).toEqual(['discount_pct']);
    expect(u[0].suggestion).toBeUndefined();
  });

  it('skips function / macro calls', () => {
    expect(findUnknownRefs('daysFromNow(90) > record.close_date', 'predicate', known)).toEqual([]);
    expect(findUnknownRefs('has(record.x) && size(account_data) > 0', 'predicate', known)).toEqual([]);
  });

  it('skips runtime globals and $-prefixed roots', () => {
    expect(findUnknownRefs('env.KEY != "" && $error.message == null', 'predicate', known)).toEqual([]);
    expect(findUnknownRefs('data.lead_score > 0', 'predicate', known)).toEqual([]);
  });

  it('ignores identifiers inside string literals', () => {
    expect(findUnknownRefs('record.status == "qualifying"', 'predicate', known)).toEqual([]);
    // a bareword that only appears inside a string is not a reference
    expect(findUnknownRefs('record.stage == "discount_pct"', 'predicate', known)).toEqual([]);
  });

  it('only checks the root, never members', () => {
    // `email` is a member of the in-scope `record`; never flagged on its own.
    expect(findUnknownRefs('record.email.bogus', 'predicate', known)).toEqual([]);
  });

  it('skips CEL keywords/literals', () => {
    expect(findUnknownRefs('record.active == true && record.x != null', 'predicate', known)).toEqual([]);
  });

  it('returns nothing when scope is unknown (empty roots)', () => {
    expect(findUnknownRefs('totally_made_up', 'predicate', new Set())).toEqual([]);
  });

  it('de-dupes a repeated unknown root', () => {
    const u = findUnknownRefs('foo > 1 && foo < 9', 'predicate', known);
    expect(u.map((x) => x.token)).toEqual(['foo']);
  });
});

describe('findUnknownRefs (template)', () => {
  const known = roots('approval_path', 'record');

  it('only scans inside {…} holes', () => {
    expect(findUnknownRefs('Hello world, contact us', 'template', known)).toEqual([]);
    expect(findUnknownRefs('Path: {approval_path} for {record.name}', 'template', known)).toEqual([]);
  });

  it('flags an unknown reference inside a hole, with a suggestion', () => {
    const u = findUnknownRefs('Path: {aproval_path}', 'template', known);
    expect(u).toHaveLength(1);
    expect(u[0]).toEqual({ token: 'aproval_path', suggestion: 'approval_path' });
  });
});
