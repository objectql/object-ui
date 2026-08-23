/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5687 — a node-gate `data.*` predicate the adapter cannot answer is
 * LOUD, and nothing else moves.
 *
 * Maintainer ruling, 2026-08-22, option A: the node tier keeps its documented
 * `data` = adapter semantics. No verdict changes, no interpolation changes —
 * objectui#5330's row binding does NOT extend to this tier. Instead the
 * objectui#5454 reporter posture is extended to this NON-throwing path, so an
 * author sees the constant-false instead of shipping it.
 *
 * ## The pin is a TRIPLE, not a pair
 *
 * Two of the three cases here are negatives, and they are the half that keeps
 * the report honest:
 *
 *   1. the card's reproduction shape (`properties: { visible: "data.status ==
 *      'draft'" }`) reports — and still hides, on every row;
 *   2. a canonical `record.*` predicate stays SILENT;
 *   3. a genuine adapter read (`${data.total}` against an adapter that HAS
 *      `total`) stays SILENT.
 *
 * Drop any one and the file is green on an implementation that reports
 * everything, or nothing.
 *
 * ## The control that decides WHICH discriminator is implemented
 *
 * "Reports the repro" is satisfied by three mutually incompatible triggers.
 * `same predicate text, adapter ANSWERS it` (group 2c) is what separates them:
 * it holds the predicate source and the `false` verdict fixed and moves only
 * whether the adapter has the key. A "references `data.`" trigger fails it; a
 * "the predicate is constant-false" trigger fails it; only "a `data.*` read the
 * bound object does not answer" passes it.
 *
 * ## Reverse verification (direction predicted before running)
 *
 * Deleting the `reportAdapterOnlyDataPredicate` call in `SchemaRenderer`'s
 * `evaluateVisibilityPredicate` turns RED exactly the four positive cases in
 * group 1 and the dedupe case, and leaves every silence case and every verdict
 * assertion green — that asymmetry IS leg-3-of-#5454's property, restated: the
 * change moves the silence, not the answer. Removing the `unresolved.length`
 * guard instead turns RED the silence cases (2a/2b/2c/3a/3b) while group 1 stays
 * green, which is the false-positive direction the ruling refuses.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer } from '../SchemaRenderer';
import {
  __resetVisibilityPredicateWarnings,
  ADAPTER_ONLY_DATA_PREDICATE_PREFIX,
  UNRESOLVABLE_VISIBILITY_PREFIX,
} from '../utils/visibilityDiagnostic';
import { SchemaRendererContext } from '../context/SchemaRendererContext';
import { RecordContextProvider } from '../context/RecordContext';
import { PredicateScopeProvider } from '../hooks/useExpression';

const NAME = 'probe-5687';
const TYPE = 'element:probe-5687';

const Probe = (props: { content?: unknown }) => (
  <div data-testid="probe" data-content={props.content === undefined ? 'absent' : String(props.content)} />
);

/**
 * The data-source ADAPTER — what `SchemaRendererContext` carries and what
 * `${data.total}` resolves against. It has `total` and deliberately has NO
 * `status`: `status` is a ROW field, and the whole card is that the node tier
 * never bound the row over `data`.
 */
const ADAPTER = { total: 99 };
/** Same adapter, plus the key the predicate asks for. Group 2c's other half. */
const ADAPTER_WITH_STATUS = { total: 99, status: 'draft' };
/** …and the polarity that makes group 2c's `false` a verdict, not an absence. */
const ADAPTER_WITH_OTHER_STATUS = { total: 99, status: 'published' };

const DRAFT = { id: 'r1', status: 'draft' };
const PUBLISHED = { id: 'r2', status: 'published' };

const cel = (source: string) => ({ dialect: 'cel', source });

/** The ambient scope app-shell's `ExpressionProvider` really mounts. */
const APP_SCOPE = {
  current_user: { id: 'u1', email_verified: true },
  user: { id: 'u1', email_verified: true },
  app: {},
  data: {},
  features: {},
};

function mount(
  schema: Record<string, unknown>,
  record?: Record<string, unknown>,
  adapter: unknown = ADAPTER,
  scope: Record<string, unknown> = APP_SCOPE,
) {
  const tree = (
    <PredicateScopeProvider scope={scope}>
      <SchemaRendererContext.Provider value={{ dataSource: adapter } as never}>
        <SchemaRenderer schema={{ type: TYPE, ...schema } as never} />
      </SchemaRendererContext.Provider>
    </PredicateScopeProvider>
  );
  return render(
    record === undefined
      ? tree
      : (
        <RecordContextProvider objectName="showcase_task" recordId={String(record.id)} data={record}>
          {tree}
        </RecordContextProvider>
      ),
  );
}

const shown = () => screen.queryByTestId('probe') !== null;

/**
 * The structural shape a `console.warn` spy presents, spelled locally.
 * `ReturnType<typeof vi.spyOn>` erases the argument tuple, so the callbacks
 * below lose their types under `noImplicitAny`.
 */
type WarnSpy = { mock: { calls: unknown[][] } };

/** Lines carrying THIS leg's prefix. */
const reports = (warn: WarnSpy): string[] =>
  warn.mock.calls.map(c => String(c[0])).filter(m => m.includes(ADAPTER_ONLY_DATA_PREDICATE_PREFIX));
/** Lines carrying the objectui#5454 leg's prefix — a different fault. */
const unresolvableReports = (warn: WarnSpy): string[] =>
  warn.mock.calls.map(c => String(c[0])).filter(m => m.includes(UNRESOLVABLE_VISIBILITY_PREFIX));

const spyWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

beforeEach(() => {
  ComponentRegistry.register(NAME, Probe as never, { namespace: 'element', skipFallback: true } as never);
  __resetVisibilityPredicateWarnings();
});
afterEach(() => {
  cleanup();
  ComponentRegistry.unregister?.(NAME, 'element');
  vi.restoreAllMocks();
});

describe('#5687 group 1 — the card\'s reproduction shape is reported', () => {
  it('THE acceptance criterion: `properties: { visible: "data.status == \'draft\'" }` warns, and still hides on EVERY row', () => {
    const warn = spyWarn();
    // The exact shape the card names. `properties.visible` is hoisted onto the
    // node by the memo and lands on the `visible` leg of the chain.
    mount({ properties: { visible: "data.status == 'draft'" } }, DRAFT);
    // Verdict UNCHANGED — the ruling refuses a verdict change, and this is the
    // constant-false the author would otherwise have shipped.
    expect(shown()).toBe(false);
    const msg = reports(warn)[0];
    expect(msg).toBeDefined();
    expect(msg).toContain(TYPE);
    expect(msg).toContain('visible');
    expect(msg).toContain("data.status == 'draft'");
    // The read that could not be answered, named — not just "something is wrong".
    expect(msg).toContain('data.status');
    // The two sentences that make it actionable rather than merely noted.
    expect(msg).toContain('CONSTANT');
    expect(msg).toContain('record.status');
  });

  it('… and hides on the OTHER row too, which is what "on every row" means', () => {
    // The row polarity pair. A gate that depends on the row would differ here;
    // this one cannot, and that is the defect.
    const warn = spyWarn();
    mount({ properties: { visible: "data.status == 'draft'" } }, DRAFT);
    expect(shown()).toBe(false);
    cleanup();
    mount({ properties: { visible: "data.status == 'draft'" } }, PUBLISHED);
    expect(shown()).toBe(false);
    expect(reports(warn).length).toBeGreaterThan(0);
  });

  it('the paired control: the same node with NO gate renders on both rows', () => {
    // Without this, "hidden" above could be "this node never renders" —
    // `SchemaRenderer` has several other paths to rendering nothing.
    const warn = spyWarn();
    mount({}, DRAFT);
    expect(shown()).toBe(true);
    cleanup();
    mount({}, PUBLISHED);
    expect(shown()).toBe(true);
    expect(reports(warn)).toHaveLength(0);
  });

  it('the `${…}` template dialect reports too — at the tier where it survives to the gate', () => {
    // A node-level key is NOT pre-evaluated by the memo (only `content`,
    // `props` and `properties` are), so the template reaches the chain with its
    // `data.` text intact. This is the spelling `@object-ui/types`' own protocol
    // comments use (`hidden?: string; // expression: "${data.role != 'admin'}"`).
    const warn = spyWarn();
    mount({ visibleWhen: "${data.status == 'draft'}" }, DRAFT);
    expect(shown()).toBe(false);
    expect(reports(warn)).toHaveLength(1);
  });

  it('KNOWN LIMIT, measured and pinned: a `${…}` template INSIDE `properties` is invisible to this leg', () => {
    // Not a choice — a structural consequence of an ordering this ruling
    // fences off. The memo evaluates every `properties.*` value BEFORE the
    // hoist ("Evaluating first is what makes one key mean one thing"), and
    // measured on `@object-ui/core`'s evaluator:
    //
    //   evaluate("data.status == 'draft'")   -> "data.status == 'draft'"  (verbatim)
    //   evaluate("${data.status == 'draft'}") -> false                    (boolean)
    //
    // So the bare string — the card's pinned repro — arrives at the gate with
    // its `data.` text intact and IS reported, while the template arrives as a
    // plain `false` with nothing left to detect. Reaching it would mean adding
    // a diagnostic inside the interpolation loop, and the 2026-08-22 ruling
    // fences interpolation off ("no interpolation changes").
    //
    // The verdict is pinned here anyway: the block is hidden on every row, and
    // the author gets no signal. That silence is filed separately, not
    // smuggled in here.
    const warn = spyWarn();
    mount({ properties: { visible: "${data.status == 'draft'}" } }, DRAFT);
    expect(shown()).toBe(false);
    cleanup();
    mount({ properties: { visible: "${data.status == 'draft'}" } }, PUBLISHED);
    expect(shown()).toBe(false); // constant across rows, exactly as in group 1
    expect(reports(warn)).toHaveLength(0);
  });

  it('a node-level `visibleWhen` written the deprecated way reports on ITS key', () => {
    const warn = spyWarn();
    mount({ visibleWhen: "data.status == 'draft'" }, DRAFT);
    expect(shown()).toBe(false);
    expect(reports(warn)[0]).toContain('visibleWhen');
  });

  it('the NON-negated `hidden` leg reports too, and keeps its own inverted answer', () => {
    // `hidden` is not negated: a constant-`false` there means the node stays
    // SHOWN by a gate that was meant to hide it. Equally constant, equally
    // silent before this change — and the verdict is untouched here as well.
    const warn = spyWarn();
    mount({ hidden: "data.status == 'draft'" }, DRAFT);
    expect(shown()).toBe(true);
    expect(reports(warn)[0]).toContain('hidden');
  });

  it('deduped: one line per (node type, key, predicate), not one per render', () => {
    // Matches objectui#5454's posture exactly — same Set, same key shape.
    const warn = spyWarn();
    mount({ properties: { visible: "data.status == 'draft'" } }, DRAFT);
    cleanup();
    mount({ properties: { visible: "data.status == 'draft'" } }, PUBLISHED);
    expect(reports(warn)).toHaveLength(1);
  });
});

describe('#5687 group 2 — a genuine adapter read stays SILENT', () => {
  it('2a: `${data.total}` in a props bag still interpolates, and says nothing', () => {
    // The docblock's pinned binding, restated: `data` is the adapter, and this
    // card does not touch it. A props-bag interpolation never reaches the
    // visibility chain at all — asserted here so the claim is measured, not
    // inferred from where the call site happens to sit.
    const warn = spyWarn();
    mount({ properties: { content: '${data.total}' } }, DRAFT);
    expect(screen.getByTestId('probe')).toHaveAttribute('data-content', '99');
    expect(reports(warn)).toHaveLength(0);
  });

  it('2b: a `data.*` VISIBILITY gate the adapter answers is silent, on both polarities', () => {
    // The harder half of 2a: this one DOES reach the reporter's call site, and
    // is silent because the adapter answers the read.
    const warn = spyWarn();
    mount({ properties: { visible: 'data.total > 0' } }, DRAFT);
    expect(shown()).toBe(true);
    cleanup();
    mount({ properties: { visible: 'data.total > 100' } }, DRAFT);
    // A correctly-hiding gate. This is also the case that DISQUALIFIES a
    // "the predicate is constant-false" trigger: the verdict here is `false`,
    // exactly as in group 1, and it must stay silent.
    expect(shown()).toBe(false);
    expect(reports(warn)).toHaveLength(0);
  });

  it('2c: SAME predicate text, SAME `false` verdict — silent once the adapter has the key', () => {
    // The control that picks the discriminator. Only the adapter moves.
    const warn = spyWarn();
    mount({ properties: { visible: "data.status == 'draft'" } }, DRAFT, ADAPTER_WITH_STATUS);
    expect(shown()).toBe(true);
    cleanup();
    mount({ properties: { visible: "data.status == 'draft'" } }, DRAFT, ADAPTER_WITH_OTHER_STATUS);
    expect(shown()).toBe(false); // a real verdict, from a real read
    expect(reports(warn)).toHaveLength(0);
  });

  it('2d: a predicate that merely QUOTES `data.status` reads nothing and says nothing', () => {
    // The scan is lexical, so string literals are stripped before it runs.
    // Not hypothetical: examples/schema-catalog carries `data.features` inside
    // a JS snippet in a `content` string.
    const warn = spyWarn();
    mount({ properties: { visible: "record.status == 'data.status'" } }, DRAFT);
    expect(shown()).toBe(false);
    expect(reports(warn)).toHaveLength(0);
  });
});

describe('#5687 group 3 — the `record.*` bucket is NOT this card, and cannot be caught by it', () => {
  it('3a: a canonical `record.*` predicate reaches opposite verdicts and stays silent', () => {
    // objectui#5401 → umbrella #5454 bound `record` at this tier. Same
    // evaluator, different identifier, different correct fix. This leg must be
    // structurally incapable of firing on it.
    const warn = spyWarn();
    mount({ properties: { visible: "record.status == 'draft'" } }, DRAFT);
    expect(shown()).toBe(true);
    cleanup();
    mount({ properties: { visible: "record.status == 'draft'" } }, PUBLISHED);
    expect(shown()).toBe(false);
    expect(reports(warn)).toHaveLength(0);
  });

  it('3b: an UNBOUND `record.*` predicate is still the OTHER reporter\'s case, not this one', () => {
    // With no row mounted, `record.status` cannot resolve. That is #5454's
    // fault, reported by #5454's function. This leg must add nothing — two
    // reports for one predicate would be the "two adjacent reporters" outcome.
    const warn = spyWarn();
    mount({ visibleWhen: cel("record.status == 'draft'") }, undefined);
    expect(shown()).toBe(true);
    expect(unresolvableReports(warn).length).toBeGreaterThan(0);
    expect(reports(warn)).toHaveLength(0);
  });

  it('3c: `metadata.*` is not `data.*` — a longer identifier that merely ENDS in "data"', () => {
    // The loose-sweep trap, mechanised. `metadata` is not this evaluator's
    // `data` root, so nothing here is a `data.*` read — even though the raw
    // source text does contain the substring `data.`.
    //
    // `metadata` is BOUND in the scope on purpose, and the ablation is why.
    // Written without it the predicate THROWS ("metadata is not defined"),
    // lands in the objectui#5454 catch, and never reaches this leg at all — so
    // it was green for a reason that had nothing to do with the boundary it
    // claims to check, and survived the "report on any `data.` mention"
    // ablation that it exists to kill. Measured, then fixed.
    const warn = spyWarn();
    const scopeWithMetadata = { ...APP_SCOPE, metadata: { status: 'published' } };
    mount(
      { properties: { visible: "metadata.status == 'draft'" } },
      DRAFT,
      ADAPTER,
      scopeWithMetadata,
    );
    expect(shown()).toBe(false); // a real verdict off a real read — not a throw
    expect(reports(warn)).toHaveLength(0);
    expect(unresolvableReports(warn)).toHaveLength(0);
  });

  it('3d: `record.data.*` is the ROW\'s own field, not this evaluator\'s `data` root', () => {
    const warn = spyWarn();
    mount({ properties: { visible: "record.data.status == 'draft'" } }, { id: 'r3', data: { status: 'x' } });
    expect(reports(warn)).toHaveLength(0);
  });

  it('3e: a CEL envelope reading `data.*` already throws — reported ONCE, by #5454', () => {
    // Measured on this base: `{ dialect: 'cel' }` routes to `evalFieldPredicate`,
    // whose bag binds values under `record.`, so `data.status` FAULTS and
    // `throwOnError` raises. The card's premise ("this path never throws") holds
    // for the bare-string and template dialects only. This leg runs after a
    // clean evaluation, so it cannot double-report — pinned here rather than
    // argued.
    const warn = spyWarn();
    mount({ visibleWhen: cel("data.status == 'draft'") }, DRAFT);
    expect(unresolvableReports(warn).length).toBeGreaterThan(0);
    expect(reports(warn)).toHaveLength(0);
  });
});

describe('#5687 group 4 — production is untouched', () => {
  it('a PRODUCTION build reaches the SAME verdicts and prints nothing', async () => {
    // The diagnostic is dev-only by the same `__DEV__` gate objectui#5454 put
    // in front of the probe. A gate that changed the ANSWER would be a fork.
    //
    // The dynamic import lives in the test BODY, not a hook: it has to read
    // module state that only exists after `resetModules` + `stubEnv`, which is
    // the case `object-ui/no-dynamic-import-in-test-hook` exempts.
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const warn = spyWarn();
      const [core, prod, ctx, rec, expr] = await Promise.all([
        import('@object-ui/core'),
        import('../SchemaRenderer'),
        import('../context/SchemaRendererContext'),
        import('../context/RecordContext'),
        import('../hooks/useExpression'),
      ]);
      core.ComponentRegistry.register(NAME, Probe as never, { namespace: 'element', skipFallback: true } as never);
      const mountProd = (schema: Record<string, unknown>, record: Record<string, unknown>) => render(
        <expr.PredicateScopeProvider scope={APP_SCOPE}>
          <ctx.SchemaRendererContext.Provider value={{ dataSource: ADAPTER } as never}>
            <rec.RecordContextProvider objectName="showcase_task" recordId={String(record.id)} data={record}>
              <prod.SchemaRenderer schema={{ type: TYPE, ...schema } as never} />
            </rec.RecordContextProvider>
          </ctx.SchemaRendererContext.Provider>
        </expr.PredicateScopeProvider>,
      );

      // The repro shape: same constant-false, same hidden block.
      mountProd({ properties: { visible: "data.status == 'draft'" } }, DRAFT);
      expect(shown()).toBe(false);
      cleanup();
      // The genuine adapter read: same interpolation.
      mountProd({ properties: { content: '${data.total}' } }, DRAFT);
      expect(screen.getByTestId('probe')).toHaveAttribute('data-content', '99');
      cleanup();
      // The canonical spelling: same two verdicts.
      mountProd({ properties: { visible: "record.status == 'draft'" } }, DRAFT);
      expect(shown()).toBe(true);
      cleanup();
      mountProd({ properties: { visible: "record.status == 'draft'" } }, PUBLISHED);
      expect(shown()).toBe(false);
      // …and none of this module's output, on any of them.
      expect(warn.mock.calls.map(c => String(c[0])).filter(m => m.includes(ADAPTER_ONLY_DATA_PREDICATE_PREFIX))).toHaveLength(0);
      core.ComponentRegistry.unregister?.(NAME, 'element');
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
