/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Parity suite for action `visible` predicates: the ENGINE path
 * (`ActionEngine.getActionsForLocation`) and the RENDERER path
 * (`toPredicateInput` → `useCondition`, what `action-button` / `action-menu` /
 * `action-bar` actually call) must reach the same verdict for the same
 * predicate.
 *
 * They did not (#3314). `getActionsForLocation` hand-rolled its own
 * normalization that unwrapped a `{ dialect: 'cel', source }` envelope into a
 * `${source}` string; `ExpressionEvaluator.evaluateCondition` only routes to
 * the canonical `@objectstack/formula` engine while the argument is still an
 * envelope, so the engine silently ran every CEL predicate on the legacy JS
 * evaluator while the renderers ran it on CEL (#2661). Since
 * `ExpressionInputSchema` normalizes even a bare authored string into
 * `{ dialect: 'cel', source }`, that was the common case, not an edge one.
 *
 * Two things are pinned here:
 *   1. The two normalizers agree input-for-input. `@object-ui/core` now owns
 *      the canonical `toPredicateInput`; `@object-ui/react` keeps a
 *      renderer-side twin (hook code must not be forced through the engine
 *      barrel). This table is what stops them drifting apart again.
 *   2. The two PATHS agree verdict-for-verdict, including on a predicate where
 *      the engines genuinely disagree (`null < null` faults in CEL, is `false`
 *      in JS) — so the parity is proven, not merely assumed.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ActionEngine, toPredicateInput as coreToPredicateInput } from '@object-ui/core';
import { toPredicateInput, useCondition } from '../useExpression';

/** Every shape an authored predicate can arrive in. */
const NORMALIZATION_CASES: { what: string; input: unknown }[] = [
  { what: 'null', input: null },
  { what: 'undefined', input: undefined },
  { what: 'empty string', input: '' },
  { what: 'boolean true', input: true },
  { what: 'boolean false', input: false },
  { what: 'bare expression string', input: 'record.done == true' },
  { what: 'cel envelope', input: { dialect: 'cel', source: 'record.done == true' } },
  { what: 'template envelope', input: { dialect: 'template', source: 'record.done == true' } },
  { what: 'dialect-less envelope', input: { source: 'record.done == true' } },
  { what: 'cel envelope with empty source', input: { dialect: 'cel', source: '' } },
  { what: 'envelope without a source', input: {} },
  { what: 'number 0', input: 0 },
  { what: 'number 1', input: 1 },
  { what: 'array', input: [] },
];

describe('action predicate normalization — core/react parity (#3314)', () => {
  it.each(NORMALIZATION_CASES)(
    'normalizes $what identically in @object-ui/core and @object-ui/react',
    ({ input }) => {
      expect(coreToPredicateInput(input)).toEqual(toPredicateInput(input));
    },
  );

  it('preserves the cel dialect instead of flattening it to a `${…}` string', () => {
    // The one branch #3314 was about: flattening here is what demoted the
    // predicate to the legacy JS engine on the engine path.
    const envelope = { dialect: 'cel', source: 'record.done == true' };
    expect(coreToPredicateInput(envelope)).toEqual({ dialect: 'cel', source: 'record.done == true' });
    expect(coreToPredicateInput({ dialect: 'template', source: 'record.done == true' }))
      .toBe('${record.done == true}');
  });
});

describe('action `visible` — engine path vs renderer path parity (#3314)', () => {
  const RECORD = { a: null, b: null, status: 'open' };
  const CONTEXT = { record: RECORD };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** The engine path: what `getActionsForLocation` decides. */
  function engineVerdict(visible: unknown): boolean {
    const engine = new ActionEngine({ ...CONTEXT });
    engine.registerAction(
      { name: 'probe', type: 'api', visible } as any,
      { locations: ['record_section'] },
    );
    return engine.getActionsForLocation('record_section').length === 1;
  }

  /** The renderer path: what `action-button` & friends decide. */
  function rendererVerdict(visible: unknown): boolean {
    const { result } = renderHook(() =>
      useCondition(toPredicateInput(visible), { ...CONTEXT }, {
        throwOnError: true,
        label: 'action "probe" (visible)',
      }),
    );
    return result.current;
  }

  const VERDICT_CASES: { what: string; visible: unknown; expected: boolean }[] = [
    // The discriminator. CEL has no `<` overload for `null`, so the predicate
    // FAULTS and both fail-closed paths hide the action. On the legacy JS
    // engine `null < null` is `false`, so `!(…)` is `true` and the action
    // shows — which is exactly what the engine used to do here, and the
    // renderer did not.
    {
      what: 'cel envelope whose null comparison faults → hidden on both paths',
      visible: { dialect: 'cel', source: '!(record.a < record.b)' },
      expected: false,
    },
    // Same text, no envelope → legacy JS on BOTH paths → shown on both.
    {
      what: 'bare string with the same null comparison → shown on both paths',
      visible: '!(record.a < record.b)',
      expected: true,
    },
    {
      what: 'non-cel dialect envelope stays on the legacy path → shown on both',
      visible: { dialect: 'template', source: '!(record.a < record.b)' },
      expected: true,
    },
    {
      what: 'cel envelope that genuinely holds → shown on both paths',
      visible: { dialect: 'cel', source: 'record.status == "open"' },
      expected: true,
    },
    {
      what: 'cel envelope that genuinely fails → hidden on both paths',
      visible: { dialect: 'cel', source: 'record.status == "closed"' },
      expected: false,
    },
    { what: 'literal true', visible: true, expected: true },
    { what: 'literal false', visible: false, expected: false },
    { what: 'absent predicate', visible: undefined, expected: true },
    { what: 'cel envelope with an empty source', visible: { dialect: 'cel', source: '' }, expected: true },
  ];

  it.each(VERDICT_CASES)('$what', ({ visible, expected }) => {
    // Both paths warn once on a fail-closed hide; keep the suite output clean.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fromEngine = engineVerdict(visible);
    const fromRenderer = rendererVerdict(visible);
    expect(fromEngine).toBe(expected);
    expect(fromRenderer).toBe(expected);
    expect(fromEngine).toBe(fromRenderer);
  });
});
