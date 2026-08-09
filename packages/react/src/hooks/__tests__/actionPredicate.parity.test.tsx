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
 *   1. There is only ONE normalizer. `@object-ui/core` owns the canonical
 *      `toPredicateInput`, and since #3367 `@object-ui/react` re-exports it
 *      rather than keeping a renderer-side twin — so this suite asserts
 *      *identity* (same function object), not input shapes one by one. The old
 *      14-shape normalization table was a guardrail against drift between two
 *      implementations; with one implementation it compared a function to
 *      itself and could no longer fail.
 *   2. The two PATHS agree verdict-for-verdict, including on a predicate where
 *      the engines genuinely disagree (`null < null` faults in CEL, is `false`
 *      in JS) — so the parity is proven, not merely assumed. This half is
 *      untouched by #3367: sharing a normalizer does not by itself prove the
 *      engine and the renderer reach the same verdict, because they run the
 *      normalized predicate through different call paths.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ActionEngine, toPredicateInput as coreToPredicateInput } from '@object-ui/core';
import { toPredicateInput, useCondition } from '../useExpression';

describe('action predicate normalization — one implementation, not two (#3314 / #3367)', () => {
  it('re-exports the canonical core normalizer instead of a renderer-side twin', () => {
    // The whole guarantee, in one assertion: the name `@object-ui/react` hands
    // to renderers IS `@object-ui/core`'s function object. Same function ⇒ the
    // input shapes cannot disagree and there is nothing left to drift, which is
    // strictly stronger than the 14-shape table this replaces (#3367).
    //
    // Enumerating shapes here again would be theatre — after the re-export both
    // columns of that table called the same function, so every row passed by
    // construction and the table could not fail for any implementation of it.
    // Per-shape behaviour is still covered where it is a real assertion:
    // `packages/react/src/hooks/__tests__/useExpression.test.ts` (through the
    // react export) and the verdict suite below (through both call paths).
    expect(toPredicateInput).toBe(coreToPredicateInput);
  });

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
    // objectui#3871 — the legacy `${…}` spelling. Both paths normalize with
    // `toPredicateInput` and both opt into `throwOnError`, so the double wrap
    // made them agree on a constant "hidden": this table was GREEN for the
    // `false` row and could only have caught the defect on the `true` row,
    // which is why that row is the one added first. Parity was never the
    // question here — the shared verdict was simply wrong on both paths.
    {
      what: 'legacy `${…}` template that holds → shown on both paths',
      visible: '${record.status === "open"}',
      expected: true,
    },
    {
      what: 'legacy `${…}` template that fails → hidden on both paths',
      visible: '${record.status === "closed"}',
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
