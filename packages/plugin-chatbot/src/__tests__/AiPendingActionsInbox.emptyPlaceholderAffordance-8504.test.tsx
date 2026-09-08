/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The AI-approvals detail drawer draws the shared `EmptyValue` for its three
 * missing-value placeholders (objectui#8504).
 *
 * ## The three carriers, and why they are one PR and not two
 *
 * objectui#8504 lists ONE carrier in this file — `JsonBlock`'s `<span
 * className="text-muted-foreground text-xs">—</span>` at `:193`. Its "Adjacent"
 * section names two more, at `:507` and `:511`: `{selected.proposed_by ?? '—'}`
 * and `{selected.decided_by ?? '—'}`, bare text fallbacks inside a plain
 * `<div>` — a different SOURCE shape, and the card asks for a deliberate
 * decision rather than a silent sweep in either direction.
 *
 * They are IN. The reasoning, recorded so it can be argued with:
 *
 *   - The card's scope fence protects a population of 41 bare em-dash ternary
 *     fallbacks across 33 files whose MEMBERSHIP is unknown — it holds a Select
 *     option label, a duration fallback and codegen writing markdown cells, so
 *     triage has to separate real carriers from decoration before anything
 *     mechanical touches them. These two are not un-triaged: they were verified
 *     individually and written into the card as "no span, no class, no
 *     accessible name".
 *   - They are rendered into the DOM, in this drawer, next to the very cell
 *     `:193` covers. To a screen reader the defect is identical; only the
 *     source spelling differs.
 *   - Leaving them means this file still ships an unannounced em dash after a
 *     PR whose entire purpose is to retire them from it, and a second PR would
 *     have to reopen the same four lines.
 *
 * What is deliberately NOT swept in: `formatRelative`'s `if (!s) return '—'` at
 * `:172`. That helper is declared `: string`; turning its fallback into a node
 * changes the return type and every call site. It is a member of the fenced
 * population, and it stays there.
 *
 * ## `JsonBlock`'s empty branch is reachable, but only just — MEASURED
 *
 * All three call sites are in this drawer. Two pass through `safeParseJson`,
 * which returns `null` for a falsy input — and `JSON.stringify(null)` is the
 * string `"null"`, not empty, so a null/absent `tool_input` renders a `<pre>`
 * reading `null` and never reaches the guard. The third (`error`) is behind a
 * truthiness check. The one input that DOES reach it is a JSON-encoded empty
 * string, `'""'`: `JSON.parse` yields `''`, `typeof` says string, and `text ===
 * ''` fires. That is a real tool input, and it is what the case below uses.
 *
 * ## Which cases DISCRIMINATE — MEASURED, not predicted
 *
 * The caricature was RUN: all three sites rewritten to render `<EmptyValue />`
 * unconditionally. Both `THE DEFECT` cases stay GREEN under it — "the empty
 * cell has an accessible name" is equally true of a drawer that has stopped
 * printing values — so each carries a control that reads a real value out of a
 * sibling field. The two `NON-REGRESSION` cases are what refuse it.
 *
 * ## Visual deltas, per site
 *
 * `:193` keeps `text-xs` through `className` — it sits where a `text-xs <pre>`
 * would be, and there is no neighbouring shared placeholder to match — so its
 * delta is the accessible name, the three affordances, and one step of opacity
 * (`text-muted-foreground` → `/50`). `:507` / `:511` were bare text inheriting
 * `text-xs font-mono` from their `<div>`, which they still inherit; their delta
 * is the same three affordances plus the muted colour.
 *
 * Every assertion is scoped to ONE labelled field (objectui#8495).
 */
import * as React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { PendingActionRow } from '@objectstack/spec/contracts';
import { AiPendingActionsInbox } from '../AiPendingActionsInbox';

const ROW_ID = 'aaaaaaaa1111';

function row(over: Partial<PendingActionRow> = {}): PendingActionRow {
  return {
    id: ROW_ID,
    object_name: 'task',
    action_name: 'delete',
    tool_name: 'action_delete_task',
    tool_input: '{"id":"t1"}',
    status: 'pending',
    proposed_by: 'agent_1',
    proposed_at: new Date().toISOString(),
    ...over,
  } as PendingActionRow;
}

function stubList(items: PendingActionRow[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ items, total: items.length }),
    }) as unknown as Response),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The shared placeholder inside ONE element, or null. */
const emptyIn = (el: HTMLElement): HTMLElement | null =>
  el.querySelector('[data-slot="empty-value"]');

/** Render the inbox, open the row's detail drawer, and scope reads to it. */
async function openDrawer(over: Partial<PendingActionRow>) {
  stubList([row(over)]);
  render(<AiPendingActionsInbox pollInterval={0} />);
  const view = await screen.findByTestId(`ai-inbox-view-${ROW_ID}`);
  fireEvent.click(view);
  await waitFor(() => expect(screen.queryByText('Proposed by')).not.toBeNull());

  /**
   * The value block under a drawer field label. Each field is a `<div>` holding
   * a `<Label>` and one sibling value block — never a drawer-wide lookup.
   */
  const field = (label: string): HTMLElement => {
    const labelEl = screen.getByText(label);
    const block = labelEl.parentElement?.querySelector(':scope > div:last-of-type');
    expect(block, `the "${label}" field has a value block`).toBeTruthy();
    return block as HTMLElement;
  };
  return { field };
}

describe('AiPendingActionsInbox drawer identity fields (objectui#8504 adjacent, :507/:511)', () => {
  it('THE DEFECT — an unknown proposer carries an accessible name', async () => {
    const { field } = await openDrawer({
      proposed_by: null,
      decided_by: 'human@objectos.ai',
    } as Partial<PendingActionRow>);
    const placeholder = emptyIn(field('Proposed by'));

    expect(placeholder, 'the unknown proposer draws the shared placeholder').not.toBeNull();
    expect(placeholder, 'and therefore has an accessible name').toHaveAttribute('aria-label');
    expect(
      (placeholder as HTMLElement).getAttribute('aria-label'),
      'the name is a word, never a naked punctuation mark',
    ).toBe('No value');
    expect((placeholder as HTMLElement).textContent, 'the glyph is unchanged').toBe('—');
    // CONTROL — without this, a drawer printing NO identities passes above.
    expect(
      within(field('Decided by')).queryByText('human@objectos.ai'),
      'CONTROL: the sibling identity field still prints its value',
    ).not.toBeNull();
  });

  it('NON-REGRESSION — a KNOWN identity renders its value and NO placeholder', async () => {
    const { field } = await openDrawer({
      proposed_by: null,
      decided_by: 'human@objectos.ai',
    } as Partial<PendingActionRow>);
    const filled = field('Decided by');

    expect(
      within(filled).queryByText('human@objectos.ai'),
      'the identity reaches the field',
    ).not.toBeNull();
    // THE DISCRIMINATING HALF: red for an EmptyValue-everywhere implementation.
    expect(emptyIn(filled), 'a known identity carries NO placeholder').toBeNull();
  });
});

describe('AiPendingActionsInbox JsonBlock (objectui#8504, :193)', () => {
  it('THE DEFECT — an empty tool input carries an accessible name', async () => {
    // `'""'` is the one reachable input — see the docblock's reachability note.
    const { field } = await openDrawer({ tool_input: '""', result: '{"ok":true}' });
    const placeholder = emptyIn(field('Tool input'));

    expect(placeholder, 'the empty JSON block draws the shared placeholder').not.toBeNull();
    expect(
      (placeholder as HTMLElement).getAttribute('aria-label'),
      'the name is a word, never a naked punctuation mark',
    ).toBe('No value');
    expect(
      (placeholder as HTMLElement).className,
      'the text-xs sizing is kept on purpose — a purely additive delta here',
    ).toContain('text-xs');
    // CONTROL — without this, a drawer rendering NO json blocks passes above.
    expect(
      field('Result').querySelector('pre'),
      'CONTROL: the sibling JSON block still printed its payload',
    ).not.toBeNull();
  });

  it('NON-REGRESSION — a FILLED tool input renders its payload and NO placeholder', async () => {
    const { field } = await openDrawer({ tool_input: '{"id":"t1"}' });
    const filled = field('Tool input');

    expect(filled.querySelector('pre'), 'the payload reaches the block').not.toBeNull();
    expect(filled.textContent, 'and it is the real input').toContain('t1');
    // THE DISCRIMINATING HALF: red for an EmptyValue-everywhere implementation.
    expect(emptyIn(filled), 'a filled JSON block carries NO placeholder').toBeNull();
  });
});
