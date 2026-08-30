/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `box` is the class-transparent neutral container — the contract the
 * 2026-08-29 maintainer ruling minted it with (objectui#3965, 方案 A), pinned
 * clause by clause:
 *
 *   1. renders `children`;
 *   2. authored `className` passes through VERBATIM;
 *   3. zero injected classes.
 *
 * Why each clause is asserted the way it is:
 *
 * - Clause 2 is asserted as STRING EQUALITY on the DOM `class` attribute, not
 *   `toContain`. Every replacement the `div` deprecation notice names fails
 *   exactly this assertion — `container` injects `w-full max-w-xl mx-auto
 *   sm:p-3 md:p-4`, `flex`/`stack` inject a display mode and gaps, `grid`
 *   injects `grid grid-cols-*`, `card` injects border/shadow (measured through
 *   the real `SchemaRenderer`, recorded in
 *   `examples/schema-catalog/test/deprecated-component-types.test.ts`). A
 *   `toContain` would stay green under every one of those injections; equality
 *   is the clause.
 *
 * - Clause 3 also needs the NO-className arm: with nothing authored, the
 *   element must carry no class attribute at all. An injected default (like
 *   `div`'s designer `defaultProps`) would surface here first.
 *
 * - `box` reads `children` ONLY — never `schema.body`. That is deliberate and
 *   load-bearing, not an omission: `div`'s `children || body` fallback is what
 *   made a mechanical `div`→X swap silently DROP content on `body`-authoring
 *   nodes while the element count stayed unchanged (the failure both
 *   superseded rulings on objectui#3965 died on). Content moves into
 *   `children` at migration time — the objectui#6771 B-ruling direction. The
 *   `div` control render beside it proves the fixture is renderable and the
 *   difference is this renderer's read, not a broken fixture.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SchemaRenderer, AdapterCtx } from '@object-ui/react';
// Module scope, not a hook — this import IS the registration (objectui#3010/#3021).
import '../index';

const renderNode = (schema: unknown) =>
  render(
    <AdapterCtx.Provider value={null as never}>
      <SchemaRenderer schema={schema as never} />
    </AdapterCtx.Provider>,
  );

describe('box — the class-transparent neutral container (objectui#3965)', () => {
  it('renders children (clause 1)', () => {
    const { container } = renderNode({
      type: 'box',
      children: [
        { type: 'text', content: 'box-child-one' },
        { type: 'text', content: 'box-child-two' },
      ],
    });
    expect(container.textContent).toContain('box-child-one');
    expect(container.textContent).toContain('box-child-two');
  });

  it('authored className passes through verbatim — equality, not containment (clauses 2+3)', () => {
    const authored = 'p-4 border rounded-lg bg-muted custom-box-marker';
    const { container } = renderNode({
      type: 'box',
      className: authored,
      children: [{ type: 'text', content: 'marker-content' }],
    });
    const el = container.querySelector('.custom-box-marker');
    expect(el, 'the box element resolved by its authored class').toBeTruthy();
    // VERBATIM: byte-equal to what was authored. Any injected class — a
    // display mode, a width, a padding ramp, a default — fails this line.
    expect(el!.getAttribute('class')).toBe(authored);
    expect(el!.tagName).toBe('DIV');
  });

  it('with no authored className the element carries no class attribute at all (clause 3)', () => {
    const { container } = renderNode({
      type: 'box',
      children: [{ type: 'text', content: 'bare-box-content' }],
    });
    // Locate by content: the box div is the innermost DIV containing the text.
    const candidates = [...container.querySelectorAll('div')].filter(
      (d) => d.textContent === 'bare-box-content',
    );
    expect(candidates.length).toBeGreaterThan(0);
    const boxEl = candidates[candidates.length - 1];
    expect(boxEl.getAttribute('class'), 'zero injected classes').toBeNull();
  });

  it('reads `children` only — `body` is deliberately not a content channel', () => {
    // The div control FIRST: proves this exact fixture shape renders content
    // through the `children || body` reader, so the empty box below is a
    // measurement of box's deliberate read, not of a broken fixture.
    const bodyFixture = (type: string) => ({
      type,
      body: [{ type: 'text', content: 'body-authored-content' }],
    });
    const divControl = renderNode(bodyFixture('div'));
    expect(divControl.container.textContent).toContain('body-authored-content');
    divControl.unmount();

    const { container } = renderNode(bodyFixture('box'));
    expect(container.textContent).not.toContain('body-authored-content');
  });
});
