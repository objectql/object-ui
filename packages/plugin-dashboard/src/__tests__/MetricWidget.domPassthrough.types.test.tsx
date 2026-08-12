/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4426 — `MetricWidgetProps` / `MetricCardProps` declare the DOM
 * pass-through their spread accepts.
 *
 * Both components end their prop list with `...domProps` spread onto the Shadcn
 * `Card`, and objectui#4357 (PR #4428) kept that spread deliberately — it is
 * their only accessibility pass-through. But neither interface extended
 * `React.HTMLAttributes`, so what the runtime accepted the TYPE refused:
 *
 * ```
 * probe.tsx(23,52): error TS2322: Type '{ label: string; value: number; id: string;
 *   role: string; "aria-label": string; }' is not assignable to type
 *   'IntrinsicAttributes & MetricWidgetProps & SchemaHostProps'.
 * ```
 *
 * A JS consumer, and every SDUI author going through `SchemaRenderer` (untyped
 * at that boundary), got the pass-through; a TypeScript consumer importing the
 * component directly needed a cast.
 *
 * ## Why this file is listed in `tsconfig.typetests.json`
 *
 * Half of what it asserts is COMPILE-TIME ONLY, and this package's tests are
 * compiled by nothing: `tsconfig.json` is the build and excludes `**\/*.test.tsx`,
 * `@object-ui/plugin-dashboard` is the sole remaining `TEST_DEBT` entry in
 * `scripts/check-type-check-coverage.mjs` (6 errors, objectui#4118), and vitest
 * erases types before running. That is objectui#3181 exactly — a provably-false
 * `Assert<Equal<1, 2>>` in an unlisted test file passes `pnpm type-check` at
 * exit 0. Listing this file in the narrow type-assertion project is the rescue
 * hatch that guard sanctions for a package still in `TEST_DEBT`; it retires
 * itself when #4118 lands and the whole tree compiles.
 *
 * ## Directions, written before the run
 *
 * - The POSITIVE cases (both `it` blocks, and the `Accepts` assertions) are RED
 *   before the widening — the JSX literal fails excess-property checking on
 *   `id` / `role` / `aria-label` — and GREEN after it.
 * - The NEGATIVE cases are the widening's boundary and are GREEN on BOTH sides,
 *   because on both sides the bogus prop IS rejected. `@ts-expect-error` is how
 *   a rejection is asserted; the directive goes unused — and therefore RED — the
 *   day someone "fixes" this class of complaint with `[key: string]: any`.
 * - `RendererKeysStayPrivate` is likewise GREEN on both sides. It is the #4357
 *   half of the contract, restated from the type side: the seven schema-shaped
 *   keys the renderer injects are destructured out and must never become part of
 *   the exported props interface, or this widening would re-declare as public
 *   contract precisely what that PR stripped from the DOM.
 */

import * as React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { I18nProvider } from '@object-ui/i18n';
import { MetricWidget, type MetricWidgetProps } from '../MetricWidget';
import { MetricCard, type MetricCardProps } from '../MetricCard';
import type { SchemaHostProps } from '../schemaHostProps';

afterEach(cleanup);

/* ── Compile-time assertion helpers (the repo idiom — see
 *    `packages/app-shell/src/views/metadata-admin/previews/flow-designer-edge.types.test.ts`)
 */
type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

function wrap(ui: React.ReactElement) {
  return render(
    <I18nProvider config={{ defaultLanguage: 'en', detectBrowserLanguage: false, resources: {} }}>
      {ui}
    </I18nProvider>,
  );
}

describe('MetricWidgetProps / MetricCardProps declare their DOM pass-through (#4426)', () => {
  it('is pinned at compile time', () => {
    // Guard against the probe lying: were either side `any`, every assertion
    // below would pass while proving nothing (the objectstack#4171 failure
    // mode, and the reason `flow-designer-edge.types.test.ts` opens the same
    // way).
    type _WidgetNotAny = Assert<Equal<IsAny<MetricWidgetProps>, false>>;
    type _CardNotAny = Assert<Equal<IsAny<MetricCardProps>, false>>;

    // ── The declaration this issue is about ──────────────────────────────
    // The four keys #4428 measured as still flowing through the spread.
    type DomIdentity = 'id' | 'role' | 'aria-label' | 'aria-describedby' | 'tabIndex';
    type _WidgetAcceptsDomIdentity = Assert<Extends<DomIdentity, keyof MetricWidgetProps>>;
    type _CardAcceptsDomIdentity = Assert<Extends<DomIdentity, keyof MetricCardProps>>;

    // ── NEGATIVE: the widening is not an open door ───────────────────────
    // `[key: string]: any` would make `keyof` collapse to `string | number`,
    // and every one of these would flip to `true`.
    type _WidgetRejectsBogus = Assert<Equal<Extends<'bogusProp', keyof MetricWidgetProps>, false>>;
    type _CardRejectsBogus = Assert<Equal<Extends<'bogusProp', keyof MetricCardProps>, false>>;

    // ── NEGATIVE: the #4357 half, restated from the type side ────────────
    // The schema-shaped keys `SchemaRenderer` injects are stripped, not passed
    // through. They stay in `SchemaHostProps`, intersected in at each
    // component's own signature — the renderer's private door. Declaring any of
    // them on the exported props interface would re-assert as public contract
    // exactly what PR #4428 removed from the DOM.
    type RendererKeys = keyof SchemaHostProps;
    type _WidgetKeepsRendererKeysPrivate =
      Assert<Equal<Extract<keyof MetricWidgetProps, RendererKeys>, never>>;
    type _CardKeepsRendererKeysPrivate =
      Assert<Equal<Extract<keyof MetricCardProps, RendererKeys>, never>>;

    // ── The two carve-outs, pinned so they cannot drift silently ─────────
    // `MetricCard.title` stays the HEADING (`I18nLabel` — a string or an inline
    // per-locale map), not HTML's tooltip string. Dropping the `Omit` does not
    // merely change this type, it stops the interface compiling at all; the pin
    // is here so the NEXT reader learns which `title` won and why.
    type _CardTitleTakesAnI18nMap =
      Assert<Extends<{ en: 'Revenue'; 'zh-CN': '收入' }, NonNullable<MetricCardProps['title']>>>;
    // `MetricWidget.onClick` narrows the inherited `MouseEventHandler` to a
    // zero-arg handler, because the same handler is wired to Enter/Space where
    // there is no mouse event to hand over.
    type _WidgetOnClickIsZeroArg =
      Assert<Equal<NonNullable<MetricWidgetProps['onClick']>, () => void>>;

    expect(true).toBe(true);
  });

  it('a direct TypeScript consumer can put DOM identity and ARIA on a MetricWidget', () => {
    // This JSX is the issue's own repro. Before the widening it is
    // `error TS2322` on `id` / `role` / `aria-label`; the runtime behaviour was
    // already correct, which is the whole defect.
    const { container } = wrap(
      <MetricWidget
        label="Total Revenue"
        value={1930000}
        id="revenue"
        role="region"
        aria-label="Revenue KPI"
        aria-describedby="revenue-desc"
        tabIndex={0}
        data-testid="revenue-kpi"
        className="kpi-tile"
      />,
    );

    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('id')).toBe('revenue');
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('Revenue KPI');
    expect(el.getAttribute('aria-describedby')).toBe('revenue-desc');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('data-testid')).toBe('revenue-kpi');
    expect(el.className).toContain('kpi-tile');
    // Zero runtime change: the KPI still renders exactly as before.
    expect(container.textContent).toContain('Total Revenue');
    expect(container.textContent).toContain('1,930,000');
  });

  it('and on a MetricCard, whose own `title` stays the heading', () => {
    const { container } = wrap(
      <MetricCard
        title="Total Revenue"
        value="1,930,000"
        id="revenue-card"
        role="region"
        aria-label="Revenue KPI"
        aria-describedby="revenue-desc"
        tabIndex={0}
        data-testid="revenue-card"
      />,
    );

    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('id')).toBe('revenue-card');
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('Revenue KPI');
    expect(el.getAttribute('aria-describedby')).toBe('revenue-desc');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('data-testid')).toBe('revenue-card');
    // `title` is consumed as the heading and never becomes a tooltip attribute —
    // which is why `MetricCardProps` omits the inherited DOM `title` rather than
    // declaring one it would silently drop.
    expect(el.getAttribute('title')).toBeNull();
    expect(container.textContent).toContain('Total Revenue');
  });

  it('still rejects an undeclared prop — the widening opened no index signature', () => {
    // GREEN on both sides of the change, by design: the assertion is that the
    // rejection HAPPENS. If a future edit adds `[key: string]: any`, these
    // directives become unused and tsc turns this file red.
    wrap(
      // @ts-expect-error — `bogusProp` is not a declared prop of MetricWidget
      <MetricWidget label="Total Revenue" value={1930000} bogusProp="nope" />,
    );
    cleanup();
    wrap(
      // @ts-expect-error — `bogusProp` is not a declared prop of MetricCard
      <MetricCard title="Total Revenue" value={1930000} bogusProp="nope" />,
    );
    cleanup();

    // MEASURED, and NOT what the first draft of this file asserted. A
    // `@ts-expect-error` on `schema={…}` here is an UNUSED directive (TS2578):
    // both components are declared `MetricWidgetProps & SchemaHostProps` at
    // their own signature, so the renderer's seven keys ARE accepted by the
    // component — that intersection is PR #4428's shape and is kept deliberately,
    // because `SchemaRenderer` has to be able to inject them. What must stay
    // true is the narrower claim `_WidgetKeepsRendererKeysPrivate` pins above:
    // they are not declared on the EXPORTED props interface, so they never
    // become part of the documented authoring surface, and they are still
    // destructured out before the spread and never reach the DOM (#4357's pin,
    // `MetricWidget.domProps.test.tsx`). Accepted-and-dropped, not declared.
    expect(true).toBe(true);
  });
});
