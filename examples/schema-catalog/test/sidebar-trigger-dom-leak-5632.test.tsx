/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `ui:sidebar-trigger` puts nothing authored on the DOM, and still renders the
 * button it always rendered (objectui#5632, the `ui:sidebar-trigger` slice of
 * objectui#5574).
 *
 * ## The two mechanisms this one target carried
 *
 * Its ledger row was the only one in the family with FOURTEEN attributes where
 * the shape it derives from leaks thirteen, and the extra one was `schema`
 * ITSELF — the node `SchemaRenderer` injects on every single render. That is a
 * second defect sitting on top of the group's, not a variant of it:
 *
 *   1. the bare spread the group records. `{...props}` reached `SidebarTrigger`,
 *      which spreads its own rest onto the `Button` it renders.
 *   2. `schema` was never destructured off the bag. Every other registration in
 *      `renderers/navigation/sidebar.tsx` names it (`({ schema, ...props })`)
 *      because it needs `schema.body`; this one renders no children, named only
 *      `className`, and so the injected node rode the same spread.
 *
 * Both close with one filter, because a whitelist does not have to enumerate
 * what it drops. Which is also why re-ledgering `schema` would be the wrong
 * repair, and why the sweep gate now carries an inverted case refusing it.
 *
 * ## Why the FORM-CONTROL declaration and not the bare `toDomProps`
 *
 * The host is the `<button>` `SidebarTrigger` renders. HTML defines `name`
 * there, so `@object-ui/test-support`'s judge counts an authored `name` as
 * LEGITIMATE on it — which is exactly why the row was thirteen-plus-`schema`
 * and never listed `name` at all. A bare `toDomProps` would therefore have
 * un-named this control while every number the sweep gate watches stayed
 * still. Measured, not reasoned: the judge self-check below shows the same bag
 * reported differently on a `<button>` and on a `<div>`.
 *
 * ## What this file measures that the sweep gate cannot
 *
 * The same split the three probes next door describe
 * (`layout-dom-leak-5574.test.tsx`, `form-control-dom-leak-5632.test.tsx`,
 * `svg-host-dom-leak-5632.test.tsx`). `packages/app-shell/src/__tests__/widget-dom-leak-sweep.test.tsx`
 * is the gate for this class and the stronger instrument for the OPEN TAIL. It
 * reports attributes that ARRIVE illegitimately and has no case at all for one
 * that STOPS arriving — so the whole legitimate half of this host is invisible
 * to it in BOTH directions, `name` included. Everything below the leak
 * assertion is that half.
 *
 * ## Designing against the failure mode this test could have
 *
 * A zero means nothing on its own — a renderer that renders NOTHING spreads
 * nothing and reads clean, and this card's own documented failure is sixteen
 * phantom-clean targets, four of them `useSidebar` throws caught by an
 * attribute-clean error boundary. Four guards:
 *
 *   1. The REAL MARKUP is asserted first, every time, and it is asserted as
 *      markup rather than as "an element exists": a `<button>` carrying the
 *      primitive's own `data-sidebar="trigger"` hook and the "Toggle Sidebar"
 *      accessible name. An error boundary satisfies none of that.
 *   2. The LEGITIMATE attribute set is pinned as a full set, not a spot check.
 *      A filter that drops everything — the caricature that must not read as
 *      success — reddens here even though its leak reading is a perfect zero.
 *   3. The BEHAVIOUR is pinned: the trigger still toggles the sidebar. An
 *      over-broad filter that strips a handler or the ARIA passes the leak
 *      assertion and fails this one.
 *   4. The JUDGE is self-checked in the direction this file depends on — that
 *      it is ELEMENT-AWARE about `name`. A judge that reported `name` nowhere
 *      would pass every assertion below while hiding the one behaviour a bare
 *      `toDomProps` would have destroyed.
 *
 * `document.cookie` is cleared before each case: `SidebarProvider` PERSISTS the
 * open state to `sidebar_state` on every toggle and reads it back on mount
 * (objectui#4234), so a case that clicks the trigger would otherwise decide the
 * starting state of the next one.
 *
 * Module-scope import of `@object-ui/components`, not `beforeAll` (AGENTS.md
 * §测试纪律): registering the renderers is an unbounded module load and must not
 * be billed to a bounded hook timeout.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@object-ui/components';
import { SidebarProvider, Sidebar } from '@object-ui/components';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import { findLeaks, leakReport } from '@object-ui/test-support';

/**
 * The canary families the sweep gate plants, kept identical on purpose so the
 * two instruments report the same vocabulary: the keys `SchemaRenderer`
 * injects, the authored SDUI metadata that survives its strip list, the open
 * tail of keys no component declares, and the authored `props` container.
 */
const CANARY_NODE = {
  type: 'sidebar-trigger',
  id: 'canary-node',
  name: 'canary_node',
  className: 'authored-class',
  bind: 'data.revenue',
  events: { onClick: [{ action: 'navigate', params: { url: '/x' } }] },
  ariaLabel: 'Canary label',
  ariaDescribedBy: 'canary-desc',
  zzcanary: 'CANARY-STR',
  zzcanaryobj: { nested: true },
  zzcanarynum: 42,
  zzcanaryCamel: 'CANARY-CAMEL',
  reference_to: 'contacts',
  props: { colorVariant: 'success', zzcanaryprop: 'CANARY-PROP' },
} as const;

/** The injected data-source ADAPTER — one more family, and one the node cannot carry. */
const FAKE_ADAPTER = {
  find: async () => [],
  findOne: async () => null,
  aggregate: async () => [],
  count: async () => 0,
  getObject: async () => null,
};

/**
 * Renders one node through the real SDUI path inside the React host this
 * renderer requires, and returns the trigger element — after proving it is the
 * trigger's REAL markup and not an error boundary.
 *
 * `SidebarProvider` is a REACT host, deliberately not a `ui:sidebar-provider`
 * SCHEMA node: that node is a swept target of its own and wrapping in it would
 * attribute its leaks to the target inside.
 */
function renderTrigger(node: Record<string, unknown>, extra?: ReactNode) {
  const view = render(
    <SidebarProvider>
      <SchemaRendererProvider dataSource={FAKE_ADAPTER as never}>
        <div data-probe-root="">
          <SchemaRenderer schema={node as never} dataSource={FAKE_ADAPTER as never} />
        </div>
      </SchemaRendererProvider>
      {extra}
    </SidebarProvider>,
  );

  const host = view.container.querySelector('[data-probe-root]')?.firstElementChild;

  // Guard 1. Asserted BEFORE anything is read off the element, and asserted as
  // MARKUP: `SchemaErrorBoundary`'s alert is attribute-clean, and so is a
  // renderer made to bail early.
  expect(host, 'ui:sidebar-trigger rendered no element at all').toBeTruthy();
  expect(host!.tagName, 'the trigger must render a real <button>').toBe('BUTTON');
  expect(
    host!.getAttribute('data-sidebar'),
    "the primitive's own behaviour hook is missing — this is not SidebarTrigger's markup",
  ).toBe('trigger');
  expect(
    host!.textContent,
    'the trigger lost its accessible name; a nameless icon button is not a pass',
  ).toContain('Toggle Sidebar');
  expect(view.container.textContent ?? '').not.toContain('failed to render');

  return { view, host: host as Element };
}

/** Every attribute on the trigger, `name="value"`, sorted. */
function attributesOf(host: Element): string[] {
  return Array.from(host.attributes)
    .map((attribute) => `${attribute.name}="${attribute.value}"`)
    .sort();
}

/** Leaked attribute NAMES, deduped and sorted — the ledger's own unit. */
function leakedNames(host: Element): string[] {
  return [...new Set(findLeaks(host).map((leak) => leak.attribute))].sort();
}

beforeEach(() => {
  document.cookie = 'sidebar_state=; path=/; max-age=0';
});

describe('schema-catalog — ui:sidebar-trigger leaks nothing and still works (#5632)', () => {
  it('the judge is element-aware about `name` — a zero below is a reading, not a blind spot', () => {
    // Rendered directly rather than through the registry: this checks the
    // JUDGE, and it must keep working even if every renderer in the repo is
    // fixed. Without it `findLeaks` could return `[]` unconditionally and every
    // assertion in this file would still pass.
    //
    // The bag is spread rather than written as JSX attributes, which is not a
    // typing dodge but the defect's own shape: `<button schema={…}>` does not
    // type-check, and a bare spread of an untyped record is exactly how these
    // attributes reached real elements without anyone hearing about it.
    const bag: Record<string, unknown> = {
      schema: { type: 'sidebar-trigger' },
      name: 'canary_node',
      id: 'i',
      className: 'c',
      'data-sidebar': 'trigger',
      'aria-label': 'A',
      bind: 'data.x',
      zzcanary: 'S',
    };

    // On a BUTTON host `name` is a real attribute, so only the three undeclared
    // keys are leaks. This is the half objectui#5632 depends on: it is why the
    // ledger row listed thirteen-plus-`schema` and never `name`, and therefore
    // why converging this renderer on the bare `toDomProps` would have been
    // invisible to the gate that grades it.
    const button = render(<button {...bag} />);
    expect(leakedNames(button.container.firstElementChild!)).toEqual([
      'bind',
      'schema',
      'zzcanary',
    ]);
    button.unmount();

    // On a `<div>` the SAME bag leaks `name` too — the judge answers per
    // element rather than from one flat list. A judge that did not would report
    // the same set for both, and this file would be vacuous exactly where the
    // target lives.
    const div = render(<div {...bag} />);
    expect(leakedNames(div.container.firstElementChild!)).toEqual([
      'bind',
      'name',
      'schema',
      'zzcanary',
    ]);
    div.unmount();
  });

  it('the full canary set reaches the renderer and none of it reaches the DOM', () => {
    const { view, host } = renderTrigger({ ...CANARY_NODE });
    expect(
      leakReport('ui:sidebar-trigger', findLeaks(host)),
      'an authored or injected schema key reached the DOM as an attribute. ' +
        'Route the spread through the form-control DOM declaration ' +
        '(`packages/components/src/lib/form-control-dom-props.ts`) — never ' +
        'widen that list to reach one host, and never re-ledger the row in ' +
        '`widget-dom-leak-sweep.test.tsx`. A key that genuinely belongs on this ' +
        'element is DECLARED and forwarded BY NAME (objectui#4435), the way ' +
        '`style` is.',
    ).toBe('');
    view.unmount();
  });

  /**
   * Guard 2 — the other direction, which no leak gate can assert: the
   * attributes that SHOULD be on this element still are, as a FULL SET.
   *
   * This is the assertion a "drops everything" filter fails. Its leak reading
   * is a perfect zero; what it cannot produce is `name`, `id`, the resolved
   * `aria-*` pair, the `data-obj-*` designer attributes, or a `class` carrying
   * both the primitive's computed utilities and the authored override.
   *
   * These are the same eight attributes, byte for byte, that the pre-fix tree
   * produced — the leak set went 14 → 0 underneath an unchanged legitimate set.
   */
  it('the legitimate attributes on this host are exactly these, and none was filtered away', () => {
    const { view, host } = renderTrigger({ ...CANARY_NODE });
    const attributes = attributesOf(host);

    expect(attributes.map((attribute) => attribute.slice(0, attribute.indexOf('=')))).toEqual([
      // The camelCase `ariaDescribedBy` / `ariaLabel` the author wrote are
      // meaningless to assistive technology; `SchemaRenderer` resolves them to
      // these hyphenated forms, and the open `aria-` family carries them
      // through the filter.
      'aria-describedby',
      'aria-label',
      'class',
      // The designer's own attributes, carried by the open `data-` family.
      'data-obj-id',
      'data-obj-type',
      // `SidebarTrigger`'s own behaviour hook, which the renderer never touches.
      'data-sidebar',
      'id',
      // The one that makes this a form control rather than a container, and the
      // one a bare `toDomProps` would have taken.
      'name',
    ]);

    expect(attributes).toContain('aria-label="Canary label"');
    expect(attributes).toContain('aria-describedby="canary-desc"');
    expect(attributes).toContain('data-obj-id="canary-node"');
    expect(attributes).toContain('data-obj-type="sidebar-trigger"');
    expect(attributes).toContain('data-sidebar="trigger"');
    expect(attributes).toContain('id="canary-node"');
    expect(attributes).toContain('name="canary_node"');

    // `className` is on the pass-through list, so it is the one key that could
    // be written twice — once by the renderer and once out of the filtered bag.
    // It is not: the renderer destructures it, and `SidebarTrigger` MERGES it
    // into its own `cn("h-7 w-7", …)`. Both halves asserted, because the
    // sibling slice measured what happens when only one arrives: `ui:spinner`
    // rendered with lucide's classes and none of its own, and did not spin.
    const className = host.getAttribute('class') ?? '';
    expect(className.split(/\s+/)).toContain('authored-class');
    expect(className.split(/\s+/)).toContain('h-7');
    expect(className.split(/\s+/)).toContain('w-7');

    view.unmount();
  });

  /**
   * Guard 3 — the non-regression axis, taken from a plausible WRONG FIX rather
   * than from the bug's shape. The filter is a whitelist, so the way to get
   * this wrong is to over-filter: strip the handler channel, the ARIA, or a
   * `data-*` the sidebar's own machinery reads. None of that moves the leak
   * reading, and all of it breaks the button.
   */
  it('the trigger still toggles the sidebar, from the DOM the sidebar itself reads', () => {
    const { view, host } = renderTrigger({ ...CANARY_NODE }, <Sidebar />);

    const state = () => view.container.querySelector('[data-state]')?.getAttribute('data-state');
    expect(state(), 'the sidebar did not mount, so a toggle proves nothing').toBe('expanded');

    fireEvent.click(host);
    expect(
      state(),
      'clicking the trigger no longer collapses the sidebar — the click channel ' +
        'was filtered away, or the trigger stopped being a button',
    ).toBe('collapsed');

    fireEvent.click(host);
    expect(state()).toBe('expanded');

    view.unmount();
  });

  /**
   * The declared channels a whitelist must not silently close. `role` and
   * `tabIndex` are on the SDUI pass-through list; `style` is NOT, and is
   * forwarded BY NAME for exactly that reason (objectui#4435). All three
   * reached the DOM before this slice, so all three are non-regressions rather
   * than new behaviour — and `style` is the one an unthinking `toDomProps`
   * conversion drops without a word.
   */
  it('the declared pass-through channels still arrive, `style` included', () => {
    const { view, host } = renderTrigger({
      type: 'sidebar-trigger',
      id: 'styled-node',
      className: 'authored-class',
      style: { marginTop: '4px' },
      role: 'button',
      tabIndex: 3,
    });

    const attributes = attributesOf(host);
    expect(attributes).toContain('style="margin-top: 4px;"');
    expect(attributes).toContain('role="button"');
    expect(attributes).toContain('tabindex="3"');
    // …and the injected node still does not ride along with them.
    expect(leakedNames(host)).toEqual([]);

    view.unmount();
  });
});
