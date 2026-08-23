/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * No layout renderer puts an authored schema prop on the DOM (objectui#5574).
 *
 * ## What this measures that the sweep gate cannot
 *
 * `packages/app-shell/src/__tests__/widget-dom-leak-sweep.test.tsx` is the gate
 * for this class, and it is the stronger instrument for the OPEN TAIL: it plants
 * canary keys no schema declares (`zzcanary`, a flattened `props` container, an
 * injected adapter) on one node per registered type. What it does not plant are
 * the renderer's OWN DECLARED PROPS — its canary node authors no `align`, no
 * `gap`, no `padding`. Adding them there would rewrite the measured attribute set
 * of all 115 renderers still ledgered, i.e. destroy the arrival reading that file
 * exists to preserve.
 *
 * So the declared-prop half is measured HERE instead, at catalog scale, on real
 * authored nodes. That is not a hypothetical distinction: every one of the 1194
 * attributes objectui#5574 measured was a DECLARED prop being consumed off
 * `schema` AND forwarded to the element — `align`, `gap`, `justify`, `direction`,
 * `padding`, `maxWidth`, `content`, `value`. A regression that re-spread only the
 * declared keys would pass the sweep gate and fail here.
 *
 * ## The reading this pins
 *
 * Before the fix, rendering every catalog node of these five types through the
 * real `SchemaRenderer` and reading the DOM:
 *
 *     text[content]      522     container[padding]   14
 *     flex[align]        198     container[maxwidth]   6
 *     flex[gap]          193     flex[direction]       5
 *     stack[gap]         153     stack[align]          4
 *     flex[justify]       98     text[value]           1
 *                                              TOTAL 1194
 *
 * `grid` read ZERO in that same run, across 26 nodes, because objectui#4787 /
 * PR #5573 had already converged it on `toDomProps`. That is what made the
 * reading trustworthy rather than merely alarming — a fixed renderer read clean
 * and its unfixed siblings did not, so the instrument was demonstrably not blind.
 *
 * ## Designing against the failure mode this test could have
 *
 * A zero here means nothing on its own: a renderer that renders NOTHING spreads
 * nothing and reads clean, and so does a walk that found no nodes. Both are how
 * a broken instrument reports a healthy tree. Two guards, and they are the
 * reason this file is not just an `expect([]).toEqual([])`:
 *
 *   1. NODE COUNTS are asserted, per type, against the census below. If the
 *      catalog grows this fails and the number gets updated; if the walk breaks,
 *      or a renderer starts returning `null`, it fails and cannot read as clean.
 *   2. The JUDGE is self-checked against a deliberately leaking element, so a
 *      zero can never come from an attribute reader that reports nothing.
 *
 * The 176 `text` nodes that render NO element are recorded rather than hidden:
 * `text` returns a bare fragment when a node carries neither designer id nor
 * className, and 176 catalog nodes take that path. They were never evidence of
 * safety, which is the phantom-clean class objectui#5574's first pass found
 * seven real leaks behind.
 *
 * Module-scope import of `@object-ui/components`, not `beforeAll` (AGENTS.md
 * §测试纪律): registering the renderers is an unbounded module load and must not
 * be billed to a bounded hook timeout.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@object-ui/components';
import { SchemaRenderer } from '@object-ui/react';
import { allExamples } from '../src/index.js';

type Node = Record<string, unknown>;

/**
 * The four renderers objectui#5574 converged, plus `grid` — kept in the same
 * list, not as a courtesy but because a control that runs somewhere else is not
 * a control. It reads clean in every configuration of this test, so on its own
 * it discriminates nothing; what it does is carry PR #5573's fix forward under
 * the same instrument that grades the other four.
 */
const MEASURED_TYPES = ['flex', 'stack', 'container', 'grid', 'text'] as const;

/**
 * Nodes of each type in the catalog today, and how many of them render no
 * element at all. Asserted, so a zero leak reading is always accompanied by
 * proof that something was actually rendered to read.
 *
 * These move when the CATALOG is authored, not when a renderer changes —
 * objectui#5574's own measurement drifted by 9 `flex[gap]` between two readings
 * purely because PR #5826 re-authored nine `space-x-*` nodes as `gap`. A diff
 * that changes these numbers and nothing else is an example being added; update
 * them. A diff that changes them while touching a renderer is the thing this
 * guard is for.
 */
const NODE_CENSUS: Readonly<Record<string, { rendered: number; noElement: number }>> = {
  flex: { rendered: 248, noElement: 0 },
  stack: { rendered: 153, noElement: 0 },
  container: { rendered: 15, noElement: 0 },
  grid: { rendered: 26, noElement: 0 },
  text: { rendered: 699, noElement: 176 },
};

/**
 * Attributes that are legitimately on a host element, so the judge ignores them.
 * Deliberately NOT a list of what to catch — the set of keys an author may write
 * is unbounded, which is the whole argument of
 * `packages/core/src/utils/dom-props.ts`. Everything not named here is reported.
 */
function isLegitimate(name: string): boolean {
  return (
    name === 'class' ||
    name === 'style' ||
    name === 'id' ||
    name === 'role' ||
    name === 'tabindex' ||
    name.startsWith('data-') ||
    name.startsWith('aria-')
  );
}

/** Every attribute on `host` the SDUI DOM contract does not allow there. */
function illegitimateAttributes(host: Element): string[] {
  return Array.from(host.attributes)
    .map((attribute) => attribute.name)
    .filter((name) => !isLegitimate(name))
    .sort();
}

function collect(node: unknown, out: Node[] = []): Node[] {
  if (Array.isArray(node)) {
    for (const item of node) collect(item, out);
    return out;
  }
  if (node && typeof node === 'object') {
    const record = node as Node;
    if (
      typeof record.type === 'string' &&
      (MEASURED_TYPES as readonly string[]).includes(record.type)
    ) {
      out.push(record);
    }
    for (const value of Object.values(record)) collect(value, out);
  }
  return out;
}

describe('schema-catalog — no layout renderer leaks an authored prop to the DOM (#5574)', () => {
  it('the judge reports a real leak — a zero below is a reading, not a blind spot', () => {
    // Rendered directly rather than through the registry: this checks the
    // ATTRIBUTE READER, and it must keep working even if every renderer in the
    // repo is fixed. Without it, `illegitimateAttributes` could return `[]`
    // unconditionally and every assertion in this file would still pass.
    const { container } = render(
      <div className="c" id="i" data-obj-id="d" align="start" gap={4} content="x" />,
    );
    expect(illegitimateAttributes(container.firstElementChild!)).toEqual([
      'align',
      'content',
      'gap',
    ]);
  });

  it('every catalog node of these five types renders, and none leaks', () => {
    const leaks: string[] = [];
    const rendered = new Map<string, number>();
    const noElement = new Map<string, number>();
    const bump = (map: Map<string, number>, key: string) =>
      map.set(key, (map.get(key) ?? 0) + 1);

    for (const example of allExamples()) {
      for (const node of collect(example.schema)) {
        const type = String(node.type);
        bump(rendered, type);
        const { container, unmount } = render(<SchemaRenderer schema={node as never} />);
        const host = container.firstElementChild;
        if (!host) {
          bump(noElement, type);
          unmount();
          continue;
        }
        for (const name of illegitimateAttributes(host)) {
          leaks.push(`${example.id} :: ${type}[${name}]`);
        }
        unmount();
      }
    }

    // Asserted BEFORE the leak reading, so a walk that rendered nothing fails
    // as a broken instrument rather than passing as a clean tree.
    const census = Object.fromEntries(
      MEASURED_TYPES.map((type) => [
        type,
        { rendered: rendered.get(type) ?? 0, noElement: noElement.get(type) ?? 0 },
      ]),
    );
    expect(
      census,
      'the catalog node census moved. If this diff only adds/removes examples, ' +
        'update NODE_CENSUS. If it touches a renderer, a node stopped rendering ' +
        'an element — and a renderer that renders nothing reads CLEAN below.',
    ).toEqual(NODE_CENSUS);

    expect(
      leaks,
      'an authored schema prop reached the DOM as an HTML attribute. These keys ' +
        'are CONSUMED off `schema` by the renderer; forwarding them as well is ' +
        'the objectui#3291 leak. Route the spread through `toDomProps` — never ' +
        'widen the whitelist and never add an exemption here.',
    ).toEqual([]);
  }, 120000);
});
