// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import * as React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { evalRowPredicate } from '@object-ui/core';
import {
  ConditionalFormattingEditor,
  normalizeRule,
  ROW_PREDICATE_ROOTS,
  type ConditionalFormattingRuleDraft,
} from './ConditionalFormattingEditor';
import { __setCelFormulaLoader } from './celAuthoring';

afterEach(() => {
  cleanup();
  __setCelFormulaLoader(undefined);
});

const t = (k: string) => k;

/** Controlled harness — holds the rule list so edits round-trip. */
function Harness({ initial = [] as any[] }: { initial?: any[] }) {
  const [rules, setRules] = React.useState<any[]>(initial);
  return (
    <div>
      <ConditionalFormattingEditor
        rules={rules}
        onChange={setRules as (r: ConditionalFormattingRuleDraft[]) => void}
        objectName="invoice"
        fieldNames={['status', 'amount']}
        t={t}
      />
      <pre data-testid="state">{JSON.stringify(rules)}</pre>
    </div>
  );
}

const state = () => JSON.parse(screen.getByTestId('state').textContent || '[]');

describe('normalizeRule', () => {
  it('passes a spec { condition, style } rule through', () => {
    expect(normalizeRule({ condition: "record.status == 'x'", style: { backgroundColor: '#fee' } })).toEqual({
      condition: "record.status == 'x'",
      style: { backgroundColor: '#fee' },
    });
  });

  it('unwraps a { dialect, source } condition envelope', () => {
    expect(
      normalizeRule({ condition: { dialect: 'cel', source: 'record.amount > 100' } as any, style: {} }),
    ).toEqual({ condition: 'record.amount > 100', style: {} });
  });

  it('translates a legacy { field, operator, value } rule to CEL + folds color props', () => {
    expect(
      normalizeRule({ field: 'status', operator: 'equals', value: 'overdue', backgroundColor: '#f00', textColor: '#fff' }),
    ).toEqual({
      condition: `record["status"] == "overdue"`,
      style: { backgroundColor: '#f00', color: '#fff' },
    });
  });

  it('translates the `in` operator', () => {
    expect(normalizeRule({ field: 'tier', operator: 'in', value: ['a', 'b'] }).condition).toBe(
      `record["tier"] in ["a", "b"]`,
    );
  });

  it('reads the ObjectUI `expression` shape', () => {
    expect(normalizeRule({ expression: 'record.x == 1', backgroundColor: 'red' })).toEqual({
      condition: 'record.x == 1',
      style: { backgroundColor: 'red' },
    });
  });
});

describe('ConditionalFormattingEditor', () => {
  it('shows the empty state and adds a rule', () => {
    render(<Harness />);
    expect(screen.getByText('engine.inspector.view.cf.empty')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cf-add'));
    expect(screen.getByTestId('cf-rule-0')).toBeInTheDocument();
    expect(state()).toEqual([{ condition: '', style: {} }]);
  });

  it('edits the CEL condition', () => {
    render(<Harness initial={[{ condition: '', style: {} }]} />);
    const ta = document.getElementById('cf-condition-0') as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: "record.status == 'overdue'" } });
    expect(state()[0].condition).toBe("record.status == 'overdue'");
  });

  it('sets a background color into style', () => {
    render(<Harness initial={[{ condition: 'record.x == 1', style: {} }]} />);
    const rule = screen.getByTestId('cf-rule-0');
    const bg = rule.querySelectorAll('input[placeholder="#RRGGBB"]')[0] as HTMLInputElement;
    fireEvent.change(bg, { target: { value: '#fee2e2' } });
    expect(state()[0].style).toEqual({ backgroundColor: '#fee2e2' });
  });

  it('clearing a color removes the style key', () => {
    render(<Harness initial={[{ condition: 'record.x == 1', style: { backgroundColor: '#fee2e2' } }]} />);
    const rule = screen.getByTestId('cf-rule-0');
    const bg = rule.querySelectorAll('input[placeholder="#RRGGBB"]')[0] as HTMLInputElement;
    fireEvent.change(bg, { target: { value: '' } });
    expect(state()[0].style).toEqual({});
  });

  it('removes a rule', () => {
    render(<Harness initial={[{ condition: 'a', style: {} }, { condition: 'b', style: {} }]} />);
    fireEvent.click(screen.getByTestId('cf-remove-0'));
    expect(state().map((r: any) => r.condition)).toEqual(['b']);
  });

  it('reorders rules (first-match-wins order matters)', () => {
    render(<Harness initial={[{ condition: 'a', style: {} }, { condition: 'b', style: {} }]} />);
    fireEvent.click(screen.getByTestId('cf-down-0'));
    expect(state().map((r: any) => r.condition)).toEqual(['b', 'a']);
    fireEvent.click(screen.getByTestId('cf-up-1'));
    expect(state().map((r: any) => r.condition)).toEqual(['a', 'b']);
  });

  it('normalizes a legacy native rule when rendered (upgrades in place on edit)', () => {
    render(<Harness initial={[{ field: 'status', operator: 'equals', value: 'x', backgroundColor: '#f00' }]} />);
    const ta = document.getElementById('cf-condition-0') as HTMLTextAreaElement;
    expect(ta.value).toBe(`record["status"] == "x"`);
    // an edit commits the normalized { condition, style } shape
    fireEvent.change(ta, { target: { value: "record.status == 'x'" } });
    expect(state()[0]).toEqual({ condition: "record.status == 'x'", style: { backgroundColor: '#f00' } });
  });
});

describe('ConditionalFormattingEditor · CEL authoring scope (#2571 follow-up)', () => {
  it('flags a BARE field condition with the record.<field> fix — the row binds only record.*', async () => {
    render(<Harness initial={[{ condition: "status == 'overdue'", style: {} }]} />);
    // TURNED, deliberately (objectui#7727). This pin used to assert the
    // opposite — "the real engine must accept the bare form (evalRowPredicate
    // spreads the row)" — and its own comment predicted this edit: "flipping
    // this editor to scope=\"record\" would break this test". objectui#5741
    // (Phase 2 of the objectui#5330 canon) retired the bare shorthand on
    // runtime record surfaces, so `evalRowPredicate` no longer spreads the row
    // and `status == 'overdue'` faults with `Unknown variable: status`. The
    // editor must say so at authoring time rather than lint it clean; the
    // runtime half of this claim is pinned in the contract suite below.
    expect(await screen.findByText(/record\.status/, {}, { timeout: 3000 })).toBeTruthy();
    const ta = document.getElementById('cf-condition-0') as HTMLTextAreaElement;
    await waitFor(() => expect(ta.getAttribute('aria-invalid')).toBe('true'), { timeout: 3000 });
  });

  it('still lints a canonical record.<field> condition clean', async () => {
    render(<Harness initial={[{ condition: "record.status == 'overdue'", style: {} }]} />);
    // The other half of the narrowing: the scope flip must reject the retired
    // spelling WITHOUT rejecting the canonical one.
    expect(await screen.findByText('perm.cel.valid', {}, { timeout: 3000 })).toBeTruthy();
    const ta = document.getElementById('cf-condition-0') as HTMLTextAreaElement;
    expect(ta.getAttribute('aria-invalid')).not.toBe('true');
  });

  it('lints a host-scope root (current_user / features) clean in the record scope', async () => {
    // The advertised host roots must survive the narrowing — a row predicate
    // legitimately reads the global predicate scope (#1583/ADR-0068).
    render(<Harness initial={[{ condition: "features.beta && current_user.id != ''", style: {} }]} />);
    expect(await screen.findByText('perm.cel.valid', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('KNOWN GAP — an `app.*` condition is advertised yet the record-scope lint refuses it', async () => {
    // NOT desired behaviour. Pinned so the one regression the scope flip
    // introduces cannot go silent, and so this test REDDENS the day it is
    // fixed and objectui#8155 can be closed.
    //
    // `app` IS bound at runtime: app-shell's `buildExpressionScope`
    // (ExpressionProvider, #1583/ADR-0068) puts it in the predicate scope that
    // `ObjectGrid` / `ListView` hand to `resolveConditionalFormatting`, and
    // ROW_PREDICATE_ROOTS advertises it for that reason. But
    // `@objectstack/formula`'s `SCOPE_ROOTS` (17.2.0) has no `app`, so under
    // `scope="record"` the engine reads it as a bare field reference and
    // errors with the nonsense fix `record.app`. Under the previous
    // `scope="flattened"` it was clean, because flattened accepts ANY bare
    // identifier. Full measurement and the two candidate fixes: objectui#8155.
    render(<Harness initial={[{ condition: "app.name == 'crm'", style: {} }]} />);
    const ta = document.getElementById('cf-condition-0') as HTMLTextAreaElement;
    await waitFor(() => expect(ta.getAttribute('aria-invalid')).toBe('true'), { timeout: 3000 });
    expect(screen.getByText(/bare reference/)).toBeTruthy();
  });

  it('still flags an unknown record.<field> with did-you-mean', async () => {
    render(<Harness initial={[{ condition: "record.statu == 'x'", style: {} }]} />);
    expect(await screen.findByText(/did you mean/i, {}, { timeout: 3000 })).toBeTruthy();
  });

  it('advertises runtime-bound roots and withholds unbound engine roots', async () => {
    __setCelFormulaLoader(() =>
      Promise.resolve({
        validateExpression: () => ({ ok: true, errors: [], warnings: [] }),
        // The engine's default advertisement — the editor's roots override
        // must win over it (introspectCelScope: hint.roots ?? engine roots).
        introspectScope: () => ({
          fields: ['status', 'amount'],
          roots: ['record', 'previous', 'input', 'os', 'current_user', 'user', 'vars'],
          functions: [],
        }),
      }),
    );
    const user = userEvent.setup();
    render(<Harness initial={[{ condition: '', style: {} }]} />);
    const ta = document.getElementById('cf-condition-0') as HTMLTextAreaElement;
    await user.click(ta);
    // `features` is bound at runtime (host predicate scope) — advertised.
    await user.type(ta, 'fea');
    expect(await screen.findByRole('option', { name: /features/ }, { timeout: 3000 })).toBeTruthy();
    // `vars` is an engine-default root NOT bound for row predicates — withheld.
    await user.clear(ta);
    await user.type(ta, 'va');
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByRole('option')).toBeNull();
  });
});

describe('ROW_PREDICATE_ROOTS ↔ evalRowPredicate runtime contract', () => {
  const u = { id: 'u1' };
  /**
   * The app-shell global predicate scope (`buildExpressionScope` in
   * `providers/ExpressionProvider.tsx`, #1583/ADR-0068) that hosts hand to the
   * shared row-predicate evaluator — MODELLED here, and deliberately WITHOUT
   * `data` or `os`.
   *
   * Why the model is load-bearing (objectui#7727). This block used to carry
   * `data: {}` and probe every advertised root with `size(<root>) >= 0`. For
   * `data` that probe hit the HOST's own empty object and never the row, so it
   * was green whether or not `data` named the row: a reading that could not
   * fail, and therefore indistinguishable from one that passed — the exact
   * trap `rowPredicateCanon.ts` documents for `data.*` on a record surface.
   * Every assertion below now names WHICH binder is supposed to supply the
   * root and checks the other direction too, so each one can fail for the
   * reason it is written for. The two roots a host legitimately carries
   * (`data`, `os`) get their own pins against a scope that does carry them.
   */
  const hostScope = {
    current_user: u,
    user: u,
    ctx: { user: u },
    app: { name: 'crm' },
    features: { beta: true },
  };
  const row = { id: 'r1', status: 'overdue' };

  /** Advertised roots the HOST binds — the row contributes nothing to them. */
  const HOST_BOUND_ROOTS = ['current_user', 'user', 'ctx', 'app', 'features'];

  it('binds the row as `record`, and it is the ROW rather than a host `record`', () => {
    // No host scope at all: only the row can be supplying `record`.
    expect(evalRowPredicate("record.status == 'overdue'", row, { fallback: false })).toBe(true);
    // And the row still wins over a host scope carrying its own `record`
    // (listConditional.ts pins `record` AFTER the spread).
    expect(
      evalRowPredicate("record.status == 'overdue'", row, {
        fallback: false,
        scope: { ...hostScope, record: { status: 'paid' } },
      }),
    ).toBe(true);
  });

  it('every OTHER advertised root is bound by the HOST — and unbound without it', () => {
    for (const root of ROW_PREDICATE_ROOTS) {
      if (root === 'record') continue;
      expect(HOST_BOUND_ROOTS, `advertised root "${root}" is unaccounted for`).toContain(root);
      expect(
        evalRowPredicate(`size(${root}) >= 0`, row, { fallback: false, scope: hostScope }),
        `root "${root}" should be bound by the host scope`,
      ).toBe(true);
      // The half that makes the line above a reading: drop the host scope and
      // the root must go unbound. Without this, a root bound by nothing in
      // particular would still pass.
      expect(
        evalRowPredicate(`size(${root}) >= 0`, row, { fallback: false }),
        `root "${root}" must come from the HOST scope, not from thin air`,
      ).toBe(false);
    }
    // ...and no member escapes the two assertions above by not being checked.
    expect([...ROW_PREDICATE_ROOTS].sort()).toEqual([...HOST_BOUND_ROOTS, 'record'].sort());
  });

  it('a BARE field ref no longer names the row — the editor ERROR matches the runtime', () => {
    // The runtime half of the flipped authoring pin above (objectui#5741).
    expect(evalRowPredicate("record.status == 'overdue'", row, { fallback: false, scope: hostScope })).toBe(true);
    expect(evalRowPredicate("status == 'overdue'", row, { fallback: false, scope: hostScope })).toBe(false);
  });

  it('`data` is RETIRED: unadvertised, and an ambient host `data` never names the row', () => {
    expect(ROW_PREDICATE_ROOTS).not.toContain('data');
    // A host may still legitimately carry its own ambient `data` — app-shell's
    // `buildExpressionScope` does. That is what made the old probe useless...
    const ambient = { ...hostScope, data: {} };
    expect(evalRowPredicate('size(data) >= 0', row, { fallback: false, scope: ambient })).toBe(true);
    // ...while the ROW is not reachable through it at all. Canonical spelling
    // against the same scope, so the two differ only in the spelling.
    expect(evalRowPredicate("record.status == 'overdue'", row, { fallback: false, scope: ambient })).toBe(true);
    expect(evalRowPredicate("data.status == 'overdue'", row, { fallback: false, scope: ambient })).toBe(false);
  });

  it('the engine-default extras stay unadvertised because they are NOT bound', () => {
    // `os` is NOT in this list any more: it is unadvertised but genuinely
    // bound, so asserting it here would be the same hand-model artefact as the
    // old `data` probe, in the opposite direction. See the pin below.
    for (const root of ['previous', 'input', 'vars']) {
      expect(ROW_PREDICATE_ROOTS).not.toContain(root);
      expect(
        evalRowPredicate(`size(${root}) >= 0`, row, { fallback: false, scope: hostScope }),
        `root "${root}" should NOT be bound at runtime`,
      ).toBe(false);
    }
  });

  it('`os` is unadvertised by CURATION, not because it is unbound', () => {
    // `buildExpressionScope` binds `os: { user }`, so a probe run against the
    // real host scope resolves it. Held apart from the extras above so that
    // list keeps meaning "not bound". Whether `os` SHOULD be advertised is
    // objectui#8156, not this card.
    expect(ROW_PREDICATE_ROOTS).not.toContain('os');
    expect(
      evalRowPredicate('size(os) >= 0', row, { fallback: false, scope: { ...hostScope, os: { user: u } } }),
    ).toBe(true);
  });
});
