// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * FlowNodeConfigField — inline expression/template validation gating (#2670
 * Phase 3 B). The malformed-condition brace-trap (ADR-0032) must fire on a real
 * CEL predicate but stay silent on a legitimate `interpolate()` `{var}` template
 * — an expression field flagged `refMode: 'template'` (e.g. a loop/map
 * collection). The scope-aware unknown-reference note still applies to a
 * template, using `{…}`-hole semantics rather than CEL predicate semantics.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FlowNodeConfigField } from './FlowNodeConfigField';
import type { FlowConfigField } from './flow-node-config';
import type { ScopeGroup } from './useFlowScope';

afterEach(cleanup);

/** A minimal scope with the given variable tokens (all in the `variables` group). */
function scope(tokens: string[]): ScopeGroup[] {
  return [
    {
      id: 'variables',
      label: 'Flow variables',
      refs: tokens.map((token) => ({ token, label: token, group: 'variables' as const })),
    },
  ];
}

const TEMPLATE_COLLECTION: FlowConfigField = {
  id: 'collection',
  path: ['config', 'collection'],
  label: 'Collection',
  kind: 'expression',
  refMode: 'template',
};

const CEL_CONDITION: FlowConfigField = {
  id: 'condition',
  path: ['config', 'condition'],
  label: 'Condition',
  kind: 'expression',
};

describe('FlowNodeConfigField — expression vs template validation gating', () => {
  it('does NOT flag a `{leadList}` template on an expression field in template mode', () => {
    render(
      <FlowNodeConfigField
        field={TEMPLATE_COLLECTION}
        value="{leadList}"
        onCommit={() => {}}
        scopeGroups={scope(['leadList'])}
      />,
    );
    // The pre-fix bug: the CEL brace-trap fired on the legal single-brace hole.
    expect(screen.queryByRole('alert')).toBeNull();
    // In scope → no unknown-reference note either.
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('surfaces an out-of-scope hole as a template NOTE (not a CEL error)', () => {
    render(
      <FlowNodeConfigField
        field={TEMPLATE_COLLECTION}
        value="{leadLst}"
        onCommit={() => {}}
        scopeGroups={scope(['leadList'])}
      />,
    );
    // No brace-trap error…
    expect(screen.queryByRole('alert')).toBeNull();
    // …but a gentle "did you mean" note, scanned as a `{…}` template hole.
    const note = screen.getByRole('note');
    expect(note.textContent).toMatch(/leadList/);
  });

  it('still flags a genuine `{record.x}` brace-in-CEL mistake on a predicate field', () => {
    render(
      <FlowNodeConfigField
        field={CEL_CONDITION}
        value="{record.amount} > 10"
        onCommit={() => {}}
        scopeGroups={scope(['record'])}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not flag a well-formed CEL predicate with an in-scope reference', () => {
    render(
      <FlowNodeConfigField
        field={CEL_CONDITION}
        value="amount > 10"
        onCommit={() => {}}
        scopeGroups={scope(['amount'])}
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('note')).toBeNull();
  });
});
