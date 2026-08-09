/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#3862 — `SchemaRenderer`'s inline `disabled` gate asked
 * `newSchema.disabled !== undefined`, the WIDEST of the three spellings this
 * repo had for "is a gate declared?", on the one key where width is not free.
 *
 * `evaluateCondition` answers an empty predicate with `true` — "no condition, so
 * visible/enabled". On `visible` that `true` is negated and means SHOW, which is
 * what "no gate" means anyway, so the `visible` chain above is benign. On
 * `disabled` it means GREY. So `disabled: ''` set `_disabled = true`, and one
 * notch wider than the `!= null` family, so did `disabled: null`.
 *
 * Two things make this the generic-path defect rather than one renderer's:
 *
 *   • the block runs in the `evaluatedSchema` useMemo with no type branch, so it
 *     covers EVERY node that renders through `SchemaRenderer`.
 *   • `_disabled` is not an internal marker. It is stripped from
 *     `componentProps` and re-injected as `disabled: __disabled || undefined`,
 *     so any component taking a `disabled` prop — inputs, buttons, form fields —
 *     is really disabled. That forwarding is pinned below, because "the flag is
 *     not set" and "the prop does not arrive" are different claims and only the
 *     second is what a user sees.
 *
 * The fix reads core's one definition (`hasDeclaredPredicate`, objectui#3850's
 * ruling) instead of adding a fourth local spelling — the `&& !== ''` this card
 * explicitly ruled out.
 *
 * ## What each case detects
 *
 *   • `disabled: ''` / `null` / `'   '` / `{ dialect, source: '' }` /
 *     `{ source: '' }` → NOT disabled, and no `disabled` prop forwarded. THE
 *     defect. `''` and `null` are the two rows the card measured; the envelope is
 *     objectui#3850's shape reaching this path too.
 *   • `disabled: true` / a truthy expression / a truthy CEL envelope → still
 *     disabled. Anti-mutation guards: "never disable" satisfies most of this file
 *     alone, and these refuse it.
 *   • `disabled: false` → still not disabled, and `disabled: 0` → not disabled
 *     (junk fails open, as it now does at every other gate).
 *   • `disabledOn` in each of those directions → the alias reads the same
 *     definition, not a copy of it.
 *   • precedence: an EMPTY `disabled` no longer short-circuits the chain, so a
 *     declared `disabledOn` is finally consulted. This case is the one that would
 *     stay green if someone "fixed" the defect by deleting the `disabled` leg.
 *   • the `visible` chain, unchanged: it keeps `!== undefined` (its alias
 *     precedence is load-bearing and its `true` is benign), so `visible: ''`
 *     still renders and `visible: false` still hides.
 *   • the `hidden` / `hiddenOn` legs of that same chain, which are NOT negated
 *     and therefore have this defect with the polarity that makes the node
 *     VANISH. Measured while writing the equivalence cases, out of this ruling's
 *     scope, filed as objectui#3955 and pinned here as a documented divergence
 *     rather than left for the next reader to rediscover.
 *
 * ## Reverse verification (direction predicted before running)
 *
 * Restoring `newSchema.disabled !== undefined` / `disabledOn !== undefined` must
 * turn RED exactly the five empty-shape cases on each key (`disabled`,
 * `disabledOn`), their forwarding cases, the `0` junk case and the precedence
 * case — and leave every `true` / `false` / expression / `visible` case GREEN.
 * Nothing here can go red in the other direction: the change only ever removes a
 * `disabled` prop, never adds one.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer } from '../SchemaRenderer';
import { SchemaRendererContext } from '../context/SchemaRendererContext';

/**
 * Records the `disabled` prop EXACTLY as it arrives — `absent` when the renderer
 * forwarded nothing, so the pin can tell "no prop" from "disabled={false}".
 */
const Probe = (props: { disabled?: unknown }) => (
  <div
    data-testid="probe"
    data-disabled-prop={props.disabled === undefined ? 'absent' : String(props.disabled)}
  />
);

const DATA = { status: 'locked', readOnly: true, unlocked: false };

function renderNode(schema: Record<string, unknown>) {
  return render(
    <SchemaRendererContext.Provider value={{ dataSource: DATA }}>
      <SchemaRenderer schema={{ type: 'probe-3862', ...schema } as never} />
    </SchemaRendererContext.Provider>,
  );
}

/** The forwarded prop, or `null` when the node did not render at all. */
function disabledProp(): string | null {
  const el = screen.queryByTestId('probe');
  return el ? el.getAttribute('data-disabled-prop') : null;
}

const EMPTY_SHAPES: Array<{ label: string; value: unknown }> = [
  { label: "'' (empty string)", value: '' },
  { label: 'null', value: null },
  { label: "'   ' (whitespace only)", value: '   ' },
  { label: "{ dialect: 'cel', source: '' } (what `objectstack build` emits)", value: { dialect: 'cel', source: '' } },
  { label: "{ source: '' } (envelope without a dialect)", value: { source: '' } },
];

describe('SchemaRenderer `disabled` — an empty predicate is not a declared gate (objectui#3862)', () => {
  beforeEach(() => {
    ComponentRegistry.register('probe-3862', Probe as never);
  });
  afterEach(() => {
    ComponentRegistry.unregister?.('probe-3862');
  });

  it.each(EMPTY_SHAPES)('disabled: $label → not disabled, and no `disabled` prop forwarded', ({ value }) => {
    renderNode({ disabled: value });
    // Both halves of the claim: the node renders, and the prop channel
    // (`disabled: __disabled || undefined`) carries nothing.
    expect(disabledProp()).toBe('absent');
  });

  it.each(EMPTY_SHAPES)('disabledOn: $label → not disabled either (the alias reads the same definition)', ({ value }) => {
    renderNode({ disabledOn: value });
    expect(disabledProp()).toBe('absent');
  });

  it('disabled: 0 (not a predicate) → not disabled — junk fails open here too', () => {
    renderNode({ disabled: 0 });
    expect(disabledProp()).toBe('absent');
  });

  it('disabled: true → still disabled, and the prop is forwarded', () => {
    renderNode({ disabled: true });
    expect(disabledProp()).toBe('true');
  });

  it('disabled: false → still not disabled', () => {
    renderNode({ disabled: false });
    expect(disabledProp()).toBe('absent');
  });

  it('no `disabled` at all → not disabled', () => {
    renderNode({});
    expect(disabledProp()).toBe('absent');
  });

  it('an expression-valued `disabled` keeps its verdict, both ways', () => {
    const { unmount } = renderNode({ disabled: '${data.status === "locked"}' });
    expect(disabledProp()).toBe('true');
    unmount();
    renderNode({ disabled: '${data.unlocked}' });
    expect(disabledProp()).toBe('absent');
  });

  it("a non-empty CEL envelope keeps its verdict, both ways", () => {
    const { unmount } = renderNode({ disabled: { dialect: 'cel', source: 'true' } });
    expect(disabledProp()).toBe('true');
    unmount();
    renderNode({ disabled: { dialect: 'cel', source: 'false' } });
    expect(disabledProp()).toBe('absent');
  });

  it('an expression-valued `disabledOn` keeps its verdict', () => {
    renderNode({ disabledOn: '${data.readOnly}' });
    expect(disabledProp()).toBe('true');
  });
});

describe('SchemaRenderer `disabled` chain precedence (objectui#3862)', () => {
  beforeEach(() => {
    ComponentRegistry.register('probe-3862', Probe as never);
  });
  afterEach(() => {
    ComponentRegistry.unregister?.('probe-3862');
  });

  it('an EMPTY `disabled` no longer short-circuits — a declared `disabledOn` is consulted', () => {
    // Before: `'' !== undefined` won the chain, `evaluateCondition('')` was
    // `true`, and the node was disabled for a reason no key stated. Now the
    // empty leg is not a gate, so the declared alias decides.
    renderNode({ disabled: '', disabledOn: '${data.readOnly}' });
    expect(disabledProp()).toBe('true');
  });

  it('… and the alias verdict is honoured in the other direction too', () => {
    renderNode({ disabled: { dialect: 'cel', source: '' }, disabledOn: '${data.unlocked}' });
    expect(disabledProp()).toBe('absent');
  });

  it('a DECLARED `disabled` still wins over `disabledOn`', () => {
    renderNode({ disabled: false, disabledOn: true });
    expect(disabledProp()).toBe('absent');
  });
});

describe('SchemaRenderer `visible` chain is untouched by this change (objectui#3862)', () => {
  beforeEach(() => {
    ComponentRegistry.register('probe-3862', Probe as never);
  });
  afterEach(() => {
    ComponentRegistry.unregister?.('probe-3862');
  });

  it.each(EMPTY_SHAPES)('visible: $label → still rendered', ({ value }) => {
    renderNode({ visible: value });
    expect(screen.getByTestId('probe')).toBeInTheDocument();
  });

  it('visible: false → still hidden; visible: true → still rendered', () => {
    const { unmount } = renderNode({ visible: false });
    expect(disabledProp()).toBeNull();
    unmount();
    renderNode({ visible: true });
    expect(screen.getByTestId('probe')).toBeInTheDocument();
  });

  it('DOCUMENTED DIVERGENCE (objectui#3955): the `hidden` leg is NOT negated, so an empty predicate still hides', () => {
    // The other polarity exit of the same asymmetry, in the same `useMemo`:
    // `hidden` / `hiddenOn` return `evaluateCondition(...)` UN-negated, so
    // "nothing to evaluate → true" means HIDE — the node vanishes for
    // `hidden: ''` / `null` / `'   '` / `{ dialect, source: '' }`. Measured, and
    // deliberately out of this PR's ruling (objectui#3850's placement clause
    // names the `disabled` / `disabledOn` legs; the `visible` family keeps
    // `!== undefined` and its alias precedence). Pinned as the current state so
    // the next reader sees it is known, with the issue that owns it — this
    // expectation is what goes RED when objectui#3955 is fixed, which is the
    // signal to move these rows into the fixed column.
    renderNode({ hidden: '' });
    expect(screen.queryByTestId('probe')).toBeNull();
    const { unmount } = renderNode({ hidden: { dialect: 'cel', source: '' } });
    expect(screen.queryByTestId('probe')).toBeNull();
    unmount();
    // The `visible` legs of the same chain ARE negated, which is why the same
    // empty value is benign there — the cases above this one.
    renderNode({ visible: '' });
    expect(screen.getByTestId('probe')).toBeInTheDocument();
  });
});
