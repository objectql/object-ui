/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7712 — `filter` is DECLARED authoring surface on every tag
 * `ObjectCalendarRenderer` is published under. Sibling of the file with the
 * same name in `@object-ui/plugin-kanban`; same defect, same pin shape, the
 * other half of the card.
 *
 * ## The defect this pins closed
 *
 * `ObjectCalendar.tsx:478` sends the authored key to the query as
 * `$filter: schema.filter`, and `@objectstack/spec`'s
 * `ComponentPropsMap['object-calendar']` declares `filter` — but neither of the
 * two registrations that publish this renderer listed it in `inputs`. Since
 * `sdui-parser`'s `validate.ts:76` reports `unknown-prop` for every key no
 * `inputs` entry claims, the html tier told an author that the one spelling
 * that WORKS is unknown, while the renderer honoured it (objectui#6678's
 * shape). ADR-0049 enforce-or-remove resolves it toward DECLARE: the key has
 * live readers on both ends, so the registrations were the side that was wrong.
 *
 * ## Its relation to objectui#7711, which landed first
 *
 * #7711 retired `getCalendarConfig`'s probe of `schema.filter` for a `calendar`
 * key — the `filter.map` shape objectui#4034 closed, one view over. That left
 * exactly one meaning for the key, which is what makes this declaration
 * writable at all: `filter` is the query filter and nothing else, so it is
 * declared here as `type: 'array'`, the same arm `object-grid` and
 * `object-metric` publish. Had the object-shaped spelling survived, this
 * declaration would have contradicted it — the two cards had to be decided in
 * this order, and were.
 *
 * ## Why a gate did not catch it, and still will not catch the next one
 *
 * The framework's `check:react-blocks-declaration-parity` diffs the manifest
 * `manifestFromConfigs` produces AGAINST the spec's zod schemas — manifest to
 * spec, one direction. A key the SPEC declares and the manifest omits is
 * structurally outside what that ratchet measures. This file is the per-key
 * pin for one of the two instances objectui#7712 names; making the ratchet
 * bidirectional is its own card.
 *
 * ## The rows, and what makes each a reading
 *
 * 1. THE HTML TIER ACCEPTS IT — the real validator over a manifest built from
 *    the LIVE registry (never a hand-written one that could agree with itself),
 *    on every tag the renderer is published under. Red on `origin/main`, green
 *    here.
 * 2. THE CONTROL, on the same call — a prop the component genuinely does not
 *    declare is still reported, so row 1's empty array is a verdict rather than
 *    a validator that reports nothing.
 * 3. THE DECLARATION, read straight off the registry, with `objectName` as its
 *    non-vacuity control.
 * 4. THE CONTRACT AGREES — the spec accepts an authored `filter` on this block
 *    (asserted as a KEY verdict: `filter` is absent from `unrecognized_keys`),
 *    so declaring it restores `declared = enforced` rather than widening past
 *    the contract.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { ComponentPropsMap } from '@objectstack/spec/ui';
import { manifestFromConfigs, validateTree } from '@object-ui/sdui-parser';
// Module scope, not a hook: this import IS the registration (AGENTS.md's
// test-discipline section — an unbounded module load must not be billed to a
// bounded window).
import '../index';

/** The two tags this one renderer is published under. */
const CALENDAR_TAGS = [
  { label: 'object-calendar', type: 'object-calendar', namespace: 'plugin-calendar' },
  { label: 'view:calendar', type: 'calendar', namespace: 'view' },
] as const;

/** A filter in the JSON-rules form `ObjectCalendar` forwards as `$filter`. */
const AUTHORED_FILTER = [{ field: 'status', operator: 'eq', value: 'confirmed' }];

const declaredInputNames = (type: string, namespace?: string): string[] =>
  ((ComponentRegistry.getConfig(type, namespace) as any)?.inputs ?? []).map((i: any) => i.name);

/**
 * A manifest built the way `gen-manifest.ts` and the JSX-page compiler build
 * theirs — from the live registry — so these verdicts are the ones a real
 * author gets, not the ones a fixture was written to produce.
 */
const liveManifest = () =>
  manifestFromConfigs(
    ComponentRegistry.getKnownTypes().map((type) => {
      const meta = ComponentRegistry.getMeta(type);
      return { type, namespace: meta?.namespace, isContainer: meta?.isContainer, inputs: meta?.inputs };
    }) as unknown as Parameters<typeof manifestFromConfigs>[0],
  );

/** `unknown-prop` messages a one-node document draws for `props`. */
const unknownProps = (type: string, props: Record<string, unknown>): string[] =>
  validateTree({ type, objectName: 'event', ...props } as never, liveManifest())
    .diagnostics.filter((d) => d.code === 'unknown-prop')
    .map((d) => d.message);

describe('objectui#7712 — object-calendar publishes the `filter` it reads', () => {
  it.each(CALENDAR_TAGS)('$label — the html tier accepts an authored filter', ({ type }) => {
    expect(
      unknownProps(type, { filter: AUTHORED_FILTER }),
      `<${type}> reports the spec-declared \`filter\` as unknown while ObjectCalendar.tsx sends it as $filter`,
    ).toEqual([]);
  });

  it.each(CALENDAR_TAGS)('$label — control: a genuinely unknown prop is still reported', ({ type }) => {
    expect(unknownProps(type, { bogusProp: AUTHORED_FILTER })).toEqual([
      `<${type}> has no prop "bogusProp"`,
    ]);
  });

  it.each(CALENDAR_TAGS)('$label — the registration declares it', ({ type, namespace }) => {
    const declared = declaredInputNames(type, namespace);
    // Non-vacuity: an empty read (wrong type/namespace) fails both lines rather
    // than silently passing one.
    expect(declared, `${type} inputs`).toContain('objectName');
    expect(declared, `${type} inputs`).toContain('filter');
  });

  it('the spec accepts the key, so this declares rather than widens', () => {
    const parsed = (ComponentPropsMap as Record<string, any>)['object-calendar'].safeParse({
      objectName: 'event',
      filter: AUTHORED_FILTER,
    });
    const unrecognized = parsed.success
      ? []
      : parsed.error.issues.flatMap((issue: any) => issue.keys ?? []);
    expect(unrecognized).not.toContain('filter');
    // The control for that zero: the same strict schema DOES refuse a key it
    // never declared, so "not rejected" is a verdict and not a vacuous read.
    const bogus = (ComponentPropsMap as Record<string, any>)['object-calendar'].safeParse({
      objectName: 'event',
      bogusProp: AUTHORED_FILTER,
    });
    expect(bogus.success).toBe(false);
    expect(bogus.error.issues.flatMap((issue: any) => issue.keys ?? [])).toContain('bogusProp');
  });
});
