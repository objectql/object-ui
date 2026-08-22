/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * `record:alert` binds the row the THREE canonical ways (objectui#4807)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * `record:alert` was the last predicate face in the repo still handing
 * `useCondition` a ROOT-ONLY bag (`{ record }`) instead of the shared
 * `usePredicateRecordContext(record)` that objectui#4075 / #4077 put under the
 * four generic action renderers and app-shell's `DeclaredActionsBar`. The
 * consequence was user-visible, and it is what this file measures:
 *
 *   • row-action shorthand (`status == 'x'`) resolved NOTHING, so the
 *     evaluator threw `status is not defined`. This call site is FAIL-SOFT —
 *     the legacy `${…}` path answers a throw with its own source text, which is
 *     a non-empty (truthy) string — so an author-declared gate came out as
 *     SHOWN on every row. A banner the author gated was permanently on screen,
 *     with nothing but a console line to say so.
 *   • legacy `data.*` did not throw at all, which is worse than it sounds: the
 *     ambient scope app-shell mounts (`providers/ExpressionProvider.tsx`) puts
 *     `data: {}` in the bag, so `data.status` resolved to `undefined` against
 *     the wrong object and the comparison was a constant `false` — the banner
 *     was permanently OFF screen instead. Same defect, opposite polarity.
 *
 * objectui#5330 (maintainer, 2026-08-20) ruled **B**: `record.*` is the canon;
 * the row-action shorthand and legacy `data.*` are DEPRECATED but kept behind a
 * survey-sized window. So all three must resolve, and the pins below name
 * `record.*` as the one an author should write today.
 *
 * ── Why groups B and C mount different shapes ──────────────────────────────
 *
 * There are TWO gates on the way to this banner and they live at different
 * tiers, each with its own binding:
 *
 *   1. `SchemaRenderer`'s node chain. It hoists `properties.visible` onto the
 *      node and evaluates it on an evaluator that binds `record` (root-only)
 *      and, deliberately, `data` = the DATA-SOURCE ADAPTER — see the docblock
 *      on `SchemaRenderer.tsx`'s `evaluatedSchema`, which states that binding
 *      and why the row must not overwrite it.
 *   2. `record-alert.tsx`'s own `useCondition`, one layer below. THIS is the
 *      tier objectui#4075's rule governs and the tier this card fixes.
 *
 * The two compose as AND (pinned in `record-alert.visibleWhen.evidence.test.tsx`
 * group 4). Group B therefore holds gate 1 open with a declared
 * `visibleWhen: cel('true')` — the node chain tests `visibleWhen` FIRST and
 * returns without ever consulting `visible` — so that every verdict it records
 * is gate 2's, i.e. this renderer's. Group C then drops the isolation and mounts
 * the plain authored shape, so the end-to-end user-visible outcome is pinned too.
 *
 * Group C covers the canon and the shorthand only. The legacy `data.*` spelling
 * is NOT asserted end-to-end, and that is deliberate: through the plain shape
 * gate 1 decides it on the adapter binding above, one tier up and out of this
 * card's reach. Fixing this renderer does not (and must not) move that. See the
 * out-of-scope finding filed alongside this change.
 *
 * ── Non-vacuity ────────────────────────────────────────────────────────────
 *
 * This renderer has four `return null` paths (dismissed, empty record, the
 * props gate, and the node gate above it), so "nothing rendered" is not by
 * itself "the gate said no". Group A is the control: it proves the harness
 * really mounts and paints the banner, and that this exact channel can hide it.
 * Every verdict below is asserted on what a USER sees — is the banner's text in
 * the document — never on computed styles or a predicate's return value.
 */

import * as React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, type RenderResult } from '@testing-library/react';
import { RecordContextProvider, SchemaRenderer, PredicateScopeProvider } from '@object-ui/react';
import '../../index';

/**
 * The ambient scope app-shell actually mounts on a record page, reproduced from
 * `packages/app-shell/src/providers/ExpressionProvider.tsx` (`data` defaults to
 * `{}` and is `{}` at both of its call sites). The absence of `record` here — and
 * the PRESENCE of an unrelated `data` — are properties of production, not
 * omissions in the fixture: they are precisely what made the two deprecated
 * spellings fail in opposite directions.
 */
const APP_SCOPE = {
  current_user: { id: 'u1', name: 'Ada', email_verified: true },
  user: { id: 'u1', email_verified: true },
  ctx: { user: { id: 'u1' } },
  os: { user: { id: 'u1' } },
  app: {},
  data: {},
  features: { multiOrgEnabled: true },
};

const IN_REVIEW = { id: 'r1', status: 'in_review' };
const DONE = { id: 'r1', status: 'done' };
const TITLE = 'Awaiting review';

const cel = (source: string) => ({ dialect: 'cel', source });

/** Holds SchemaRenderer's node gate open so the verdict recorded is this renderer's. */
const NODE_GATE_OPEN = { visibleWhen: cel('true') };

/**
 * The three spellings objectui#5330 ruled on, written the way an author writes
 * them: a BARE expression string, which is the spec spelling and which
 * `SchemaRenderer`'s per-value `properties` evaluation passes through untouched
 * (only `${…}` values are interpolated there).
 */
const CANON = "record.status == 'in_review'";
const SHORTHAND = "status == 'in_review'";
const LEGACY = "data.status == 'in_review'";

function alertNode(visible?: string, extra: Record<string, unknown> = {}) {
  return {
    type: 'record:alert',
    properties: { title: TITLE, ...(visible === undefined ? {} : { visible }) },
    ...extra,
  };
}

function mount(node: unknown, record: Record<string, unknown>): RenderResult {
  return render(
    <PredicateScopeProvider scope={APP_SCOPE}>
      <RecordContextProvider objectName="showcase_task" recordId="r1" data={record}>
        <SchemaRenderer schema={node as never} />
      </RecordContextProvider>
    </PredicateScopeProvider>,
  );
}

/** What the user sees: is the banner's own text in the document? */
const bannerInDocument = (r: RenderResult) => r.queryByText(TITLE) !== null;

/** Mount the same node against both rows and report the pair of verdicts. */
function verdicts(node: unknown): { onMatchingRow: boolean; onOtherRow: boolean } {
  const onMatchingRow = bannerInDocument(mount(node, IN_REVIEW));
  cleanup();
  const onOtherRow = bannerInDocument(mount(node, DONE));
  cleanup();
  return { onMatchingRow, onOtherRow };
}

afterEach(() => cleanup());

describe('#4807 group A — controls: the harness paints the banner, and this channel can hide it', () => {
  it('with no predicate declared, the banner is on screen for every row', () => {
    // If this goes red, nothing below means anything: a `false` verdict there
    // would be "never rendered", not "the gate said no".
    expect(bannerInDocument(mount(alertNode(), IN_REVIEW))).toBe(true);
    cleanup();
    expect(bannerInDocument(mount(alertNode(), DONE))).toBe(true);
  });

  it('a constant `properties.visible` decides it in both directions', () => {
    // The paired control for group B: same key, same tier, same mount — so a
    // hidden verdict below is this gate's answer and not an inert surface.
    expect(bannerInDocument(mount(alertNode('false', NODE_GATE_OPEN), DONE))).toBe(false);
    cleanup();
    expect(bannerInDocument(mount(alertNode('true', NODE_GATE_OPEN), DONE))).toBe(true);
  });
});

describe('#4807 group B — all THREE bindings resolve on this renderer own gate', () => {
  // The two rows differ ONLY in `status`, so a pair of opposite verdicts IS the
  // binding: the predicate reached the row. A pair of EQUAL verdicts means the
  // author's gate was never consulted, whichever way it landed.

  it('canon `record.*` — the spelling objectui#5330 ruled canonical', () => {
    expect(verdicts(alertNode(CANON, NODE_GATE_OPEN))).toEqual({
      onMatchingRow: true,
      onOtherRow: false,
    });
  });

  it('row-action shorthand `status` — deprecated by objectui#5330, still resolves', () => {
    // Before objectui#4807 both mounts were `true`: `status` was unbound, the
    // evaluator threw, and this fail-soft call site turned the throw into SHOWN.
    expect(verdicts(alertNode(SHORTHAND, NODE_GATE_OPEN))).toEqual({
      onMatchingRow: true,
      onOtherRow: false,
    });
  });

  it('legacy `data.*` — deprecated by objectui#5330, still resolves', () => {
    // Before objectui#4807 both mounts were `false`, not `true`: the ambient
    // `data: {}` from app-shell answered instead of the row, so the comparison
    // was constantly false and the banner never appeared at all.
    expect(verdicts(alertNode(LEGACY, NODE_GATE_OPEN))).toEqual({
      onMatchingRow: true,
      onOtherRow: false,
    });
  });

  it('the row wins over an ambient `record` / `data` the host also supplied', () => {
    // `usePredicateRecordContext` writes `record` and `data` AFTER the spread
    // for this reason; APP_SCOPE carries a `data` of its own, and a host may
    // carry a `record` too. Pinned on the user-visible verdict so the
    // precedence cannot regress silently.
    const hostScope = { ...APP_SCOPE, record: DONE, data: DONE };
    const withHostScope = (record: Record<string, unknown>) =>
      render(
        <PredicateScopeProvider scope={hostScope}>
          <RecordContextProvider objectName="showcase_task" recordId="r1" data={record}>
            <SchemaRenderer schema={alertNode(CANON, NODE_GATE_OPEN) as never} />
          </RecordContextProvider>
        </PredicateScopeProvider>,
      );
    expect(bannerInDocument(withHostScope(IN_REVIEW))).toBe(true);
    cleanup();
    expect(bannerInDocument(withHostScope(DONE))).toBe(false);
  });
});

describe('#4807 group C — end to end, on the plain authored node', () => {
  // No `visibleWhen` isolation here: this is the shape an author writes, and
  // these are the verdicts a user gets.

  it('canon `record.*` gates the banner on the row', () => {
    expect(verdicts(alertNode(CANON))).toEqual({ onMatchingRow: true, onOtherRow: false });
  });

  it('row-action shorthand gates the banner on the row', () => {
    // THE defect of objectui#4807 as a user met it: this pair used to be
    // `{ true, true }` — an author-declared gate that never once hid the banner.
    expect(verdicts(alertNode(SHORTHAND))).toEqual({ onMatchingRow: true, onOtherRow: false });
  });
});
