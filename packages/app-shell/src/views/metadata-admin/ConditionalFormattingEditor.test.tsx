// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import * as React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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
  it('lints a BARE field condition clean — row predicates bind fields bare at runtime', async () => {
    render(<Harness initial={[{ condition: "status == 'overdue'", style: {} }]} />);
    // The real engine must accept the bare form (evalRowPredicate spreads the
    // row); flipping this editor to scope="record" would break this test.
    expect(await screen.findByText('perm.cel.valid', {}, { timeout: 3000 })).toBeTruthy();
    const ta = document.getElementById('cf-condition-0') as HTMLTextAreaElement;
    expect(ta.getAttribute('aria-invalid')).not.toBe('true');
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
  // Shaped like the app-shell global predicate scope (ExpressionProvider,
  // #1583/ADR-0068) that hosts pass into the shared row-predicate evaluator.
  const u = { id: 'u1' };
  const hostScope = {
    current_user: u,
    user: u,
    ctx: { user: u },
    app: { name: 'crm' },
    data: {},
    features: { beta: true },
  };

  it('every advertised root is bound when a row predicate evaluates', () => {
    for (const root of ROW_PREDICATE_ROOTS) {
      // `size(<root>) >= 0` is true iff the root resolves to a bound map —
      // an unbound root faults and falls back to `false`.
      expect(
        evalRowPredicate(`size(${root}) >= 0`, { id: 'r1' }, { fallback: false, scope: hostScope }),
        `root "${root}" should be bound at runtime`,
      ).toBe(true);
    }
  });

  it('the engine-default extras stay unadvertised because they are NOT bound', () => {
    for (const root of ['previous', 'input', 'os', 'vars']) {
      expect(ROW_PREDICATE_ROOTS).not.toContain(root);
      expect(
        evalRowPredicate(`size(${root}) >= 0`, { id: 'r1' }, { fallback: false, scope: hostScope }),
        `root "${root}" should NOT be bound at runtime`,
      ).toBe(false);
    }
  });
});
