// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import * as React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  ConditionalFormattingEditor,
  normalizeRule,
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
