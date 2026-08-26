/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6038, census site 2 — a `page:tabs` item's `visibleWhen` that FAULTS
 * is reported, through the same reporter and the same rate limit as the node
 * gate in `SchemaRenderer`.
 *
 * ## Why this file exists at all
 *
 * The card is written about `evaluateVisibilityPredicate`'s `__DEV__`
 * short-circuit, and the dispatch's census clause is explicit that the shape —
 * "a predicate evaluation caught and swallowed" — is what has to be covered,
 * not the symbol. `PageTabsRenderer.isItemVisible` is that shape under another
 * name: it calls the same `evaluateCondition`, on the same canonical key
 * (`visibleWhen`), with the same fail-open contract its own comment declares
 * ("the same semantics SchemaRenderer applies to component-level
 * `visibleWhen`").
 *
 * It was in fact the WORSE of the two. The node gate at least reported in a
 * development build; an item-level `visibleWhen` that faulted here was silent
 * in BOTH builds — and its false verdict removes an entire tab, header and
 * panel, rather than one block. A tab that quietly stops disappearing (or
 * quietly stops appearing) is the failure an author is least likely to notice,
 * because a tab strip looks correct in every arrangement.
 *
 * ## One reporter, one rate limit — not one per package
 *
 * The report goes through `reportUnresolvableVisibilityPredicate`, exported
 * from `@object-ui/react` for this card. A local copy would mean a second
 * dedupe `Set`, and one authored predicate would then be entitled to one line
 * per package instead of one line. The last case here is what pins that.
 *
 * ## Reverse verification (direction predicted BEFORE running)
 *
 * Dropping the `onFault` option from `isItemVisible` turns RED exactly the
 * report cases and leaves every VERDICT case green — the tabs render
 * identically either way, which is this card's observability-only constraint
 * restated on this surface.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import {
  SchemaRenderer,
  UNRESOLVABLE_VISIBILITY_PREFIX,
  __resetVisibilityPredicateWarnings,
} from '@object-ui/react';
import '../renderers';

const tabsSchema = (items: any[]) => ({ type: 'page:tabs', id: 'tabs', items });

/** Faults on every dialect this surface accepts (measured on the built evaluator). */
const FAULT_BARE = 'nosuchroot.x > 1';
const FAULT_BARE_2 = 'anotherbadroot.y == 3';

type WarnSpy = { mock: { calls: unknown[][] } };
const spyWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {});
const reports = (warn: WarnSpy): string[] =>
  warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes(UNRESOLVABLE_VISIBILITY_PREFIX));
const allWarnings = (warn: WarnSpy): string[] => warn.mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  __resetVisibilityPredicateWarnings();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('objectui#6038 — a faulting `page:tabs` item predicate is reported', () => {
  it('POSITIVE CONTROL: the spy observes a line carrying the prefix', () => {
    // Without it, the `toHaveLength(0)` cases below are equally green on a
    // capture that observes nothing.
    const warn = spyWarn();
    console.warn(`${UNRESOLVABLE_VISIBILITY_PREFIX} - synthetic control line`);
    expect(reports(warn)).toHaveLength(1);
  });

  it('DEGENERATE CONTROL: unrelated console output does not satisfy the pin', () => {
    const warn = spyWarn();
    console.warn('[object-ui] an entirely unrelated warning');
    expect(allWarnings(warn)).toHaveLength(1);
    expect(reports(warn)).toHaveLength(0);
  });

  it('THE acceptance criterion: a faulting item `visibleWhen` warns, and the tab still renders', () => {
    const warn = spyWarn();
    const { getByText } = render(
      <SchemaRenderer
        schema={tabsSchema([
          { label: 'Details', value: 'details', children: [] },
          { label: 'Contracts', value: 'contracts', visibleWhen: FAULT_BARE, children: [] },
        ])}
      />,
    );
    // VERDICT UNCHANGED — fail-open, so the tab is still there. This card does
    // not get to move that; it only gets to say so.
    expect(getByText('Contracts')).toBeTruthy();

    const lines = reports(warn);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('page:tabs');
    expect(lines[0]).toContain('visibleWhen');
    expect(lines[0]).toContain(FAULT_BARE);
    expect(lines[0]).toContain('Reason:');
  });

  it('a HEALTHY item predicate stays silent, on both verdicts', () => {
    // The half that makes the loud half mean something: a false predicate is a
    // verdict, not a fault, and must print nothing.
    const warn = spyWarn();
    // THREE items, two of them surviving: `alwaysShowStrip` defaults to false,
    // so a strip down to a single tab hides its header entirely and renders the
    // panel bare — the assertion below would then be measuring that rule
    // instead of this one. (Measured: this case first failed on exactly that.)
    const { getByText, queryByText } = render(
      <SchemaRenderer
        schema={tabsSchema([
          { label: 'Details', value: 'details', visibleWhen: '1 == 1', children: [] },
          { label: 'Related', value: 'related', children: [] },
          { label: 'Contracts', value: 'contracts', visibleWhen: '1 == 2', children: [] },
        ])}
      />,
    );
    expect(getByText('Details')).toBeTruthy();
    expect(getByText('Related')).toBeTruthy();
    expect(queryByText('Contracts')).toBeNull();
    expect(allWarnings(warn)).toHaveLength(0);
  });

  it('deduped per predicate SOURCE: eight tabs sharing one broken predicate produce ONE line', () => {
    // The "not per call-site instance" half — eight distinct items, eight
    // evaluations, one authored mistake.
    const warn = spyWarn();
    render(
      <SchemaRenderer
        schema={tabsSchema(
          Array.from({ length: 8 }, (_, i) => ({
            label: `Tab ${i}`,
            value: `t${i}`,
            visibleWhen: FAULT_BARE,
            children: [],
          })),
        )}
      />,
    );
    expect(reports(warn)).toHaveLength(1);
    expect(allWarnings(warn)).toHaveLength(1);
  });

  it('a SECOND distinct predicate source still warns — a dedupe that suppressed everything would look identical', () => {
    const warn = spyWarn();
    render(
      <SchemaRenderer
        schema={tabsSchema([
          { label: 'A', value: 'a', visibleWhen: FAULT_BARE, children: [] },
          { label: 'B', value: 'b', visibleWhen: FAULT_BARE_2, children: [] },
        ])}
      />,
    );
    const lines = reports(warn);
    expect(lines).toHaveLength(2);
    expect(lines.some((l) => l.includes(FAULT_BARE))).toBe(true);
    expect(lines.some((l) => l.includes(FAULT_BARE_2))).toBe(true);
  });

  it('ONE rate limit across packages: the node gate and the tab gate share a dedupe `Set`', () => {
    // The property the shared export exists for. The SAME predicate source on
    // the SAME node type must not be entitled to a second line just because a
    // second package evaluated it. Here the tab strip reports first; a node
    // gate of type `page:tabs` carrying the same `visibleWhen` source then
    // finds the entry already present.
    //
    // (A different node TYPE legitimately reports again — the key is
    // (type, key, source), and two types are two places an author has to go
    // and fix. This case holds the type fixed, which is what isolates the
    // cross-package question from the key-shape question.)
    const warn = spyWarn();
    render(
      <SchemaRenderer
        schema={tabsSchema([{ label: 'A', value: 'a', visibleWhen: FAULT_BARE, children: [] }])}
      />,
    );
    expect(reports(warn)).toHaveLength(1);
    cleanup();
    render(<SchemaRenderer schema={{ type: 'page:tabs', id: 'other', visibleWhen: FAULT_BARE, items: [] } as any} />);
    expect(reports(warn)).toHaveLength(1);
  });
});
