/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4357 — `MetricWidget` / `MetricCard` ended their prop lists with
 * `...props` and spread the whole thing onto the Shadcn `Card`. Reached through
 * `SchemaRenderer` (every KPI tile is), the renderer hands a component its
 * widget schema plus the schema's own keys, so SDUI metadata landed on the DOM:
 * React passes unknown lowercase attributes straight through and stringifies
 * object values.
 *
 * MEASURED at the `SchemaRenderer` call site (`packages/react/src/SchemaRenderer.tsx`,
 * the `React.createElement(Component, …)` block) — the props a widget receives
 * that are NOT DOM attributes, and the attribute each one emitted before the fix:
 *
 *   | prop             | emitted as                    | what it is                          |
 *   |------------------|-------------------------------|-------------------------------------|
 *   | `schema`         | `schema="[object Object]"`    | the node, injected on EVERY render  |
 *   | `events`         | `events="[object Object]"`    | SDUI action metadata                |
 *   | `props`          | `props="[object Object]"`     | the props container (spread already)|
 *   | `bind`           | `bind="data.revenue"`         | SDUI data-binding path              |
 *   | `ariaLabel`      | `arialabel="…"`               | camelCase twin of `aria-label`      |
 *   | `ariaDescribedBy`| `ariadescribedby="…"`         | camelCase twin of `aria-describedby`|
 *
 * The line the fix draws is "is this an HTML attribute name": the six above are
 * not (the renderer already emits the two dashed `aria-*` forms itself), so they
 * are destructured out. Everything that IS one keeps flowing through the spread —
 * `id`, `name`, `role`, `disabled`, `aria-*`, `data-*`, `className` — because the
 * spread is genuine DOM/aria passthrough and stays.
 *
 * WHY THE ASSERTION IS `container.innerHTML` AND NOT THE HEADING. This defect's
 * cost was never a visible one; it was that it POISONED the assertion this area
 * attracts. #4163 pinned `not.toContain('[object Object]')` on
 * `DashboardGridLayout`, and #4032 wanted the same pin on the metric path but
 * could not write it — the card carried `schema="[object Object]"` before and
 * after any i18n fix, so the pin would have been red for a reason unrelated to
 * labels, and the tempting repair (loosen it) throws the real pin away. #4032
 * asserted on the card heading instead, with a comment pointing here. That
 * workaround is now removed: the container assertion below is the one that could
 * not be written, and `DashboardRenderer.metricI18n.test.tsx` asserts on the
 * container again.
 *
 * DIRECTIONS, written before the run: (a)–(d) RED before the fix — (a)/(c)/(d)
 * by `MetricWidget`, (b) by `MetricCard`; (e)/(f) GREEN on both sides, they are
 * the acceptance boundary (nothing else about the render may move).
 */

import * as React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { I18nProvider } from '@object-ui/i18n';
import type { DashboardComponentSchema } from '@object-ui/types';
import { SchemaRenderer } from '@object-ui/react';
// Both widgets are resolved from the registry, populated as a side effect of
// the package barrel. Imported at MODULE scope (never in a hook) per AGENTS.md's
// flaky-test rule: the cost lands in the import phase, unbounded by any timeout.
import { DashboardRenderer } from '../index';

afterEach(cleanup);

/** Every SDUI key at once, so one render measures the whole surface. */
const SCHEMA_METADATA = {
  id: 'revenue',
  name: 'revenue_kpi',
  bind: 'data.revenue',
  events: { onClick: [{ action: 'navigate', params: { url: '/deals' } }] },
  ariaLabel: 'Revenue KPI',
  ariaDescribedBy: 'desc-1',
  role: 'group',
} as const;

/** Attribute names that must never appear — none of them is an HTML attribute. */
const LEAKED_ATTRIBUTES = ['schema', 'events', 'props', 'bind', 'arialabel', 'ariadescribedby'];

function renderSchema(schema: Record<string, unknown>) {
  return render(
    <I18nProvider config={{ defaultLanguage: 'en', detectBrowserLanguage: false, resources: {} }}>
      <SchemaRenderer schema={schema as never} />
    </I18nProvider>,
  );
}

function card(container: HTMLElement): HTMLElement {
  const el = container.firstElementChild;
  if (!el) throw new Error('nothing rendered');
  return el as HTMLElement;
}

function attributeNames(el: HTMLElement): string[] {
  return Array.from(el.attributes).map((a) => a.name);
}

describe('MetricWidget / MetricCard — schema-shaped props stay off the DOM (#4357)', () => {
  it('(a) MetricWidget: the metric container carries no stringified schema', () => {
    const { container } = renderSchema({
      type: 'metric',
      label: 'Total Revenue',
      value: 1930000,
      ...SCHEMA_METADATA,
      props: { colorVariant: 'success' },
    });

    // THE pin — the assertion this defect used to block, on the container.
    expect(container.innerHTML).not.toContain('[object Object]');
    expect(attributeNames(card(container))).not.toContain('schema');
  });

  it('(b) MetricCard: same, through its own registry type', () => {
    const { container } = renderSchema({
      type: 'metric-card',
      title: 'Total Revenue',
      value: 1930000,
      ...SCHEMA_METADATA,
    });

    expect(container.innerHTML).not.toContain('[object Object]');
    expect(attributeNames(card(container))).not.toContain('schema');
  });

  it('(c) neither component emits any of the six measured non-DOM props', () => {
    for (const schema of [
      { type: 'metric', label: 'Total Revenue', value: 1930000, ...SCHEMA_METADATA, props: { colorVariant: 'success' } },
      { type: 'metric-card', title: 'Total Revenue', value: 1930000, ...SCHEMA_METADATA, props: {} },
    ]) {
      const { container } = renderSchema(schema);
      const names = attributeNames(card(container));
      for (const leaked of LEAKED_ATTRIBUTES) {
        expect(names, `${schema.type} emitted ${leaked}=`).not.toContain(leaked);
      }
      cleanup();
    }
  });

  it('(d) the dashboard KPI path — the container assertion #4032 could not write', () => {
    const schema = {
      type: 'dashboard',
      name: 'sales',
      widgets: [{ id: 'revenue', type: 'metric', title: 'Total Revenue', options: { value: 1930000 } }],
    } as unknown as DashboardComponentSchema;

    const { container } = render(
      <I18nProvider config={{ defaultLanguage: 'en', detectBrowserLanguage: false, resources: {} }}>
        <DashboardRenderer schema={schema} />
      </I18nProvider>,
    );

    expect(container.innerHTML).not.toContain('[object Object]');
  });

  it('(e) genuine DOM / aria passthrough survives — the spread is not removed', () => {
    const { container } = renderSchema({
      type: 'metric',
      label: 'Total Revenue',
      value: 1930000,
      ...SCHEMA_METADATA,
      className: 'kpi-tile',
    });

    const el = card(container);
    // Authored DOM identity and ARIA, plus the renderer's own data attributes.
    expect(el.getAttribute('id')).toBe('revenue');
    expect(el.getAttribute('name')).toBe('revenue_kpi');
    expect(el.getAttribute('role')).toBe('group');
    expect(el.getAttribute('aria-label')).toBe('Revenue KPI');
    expect(el.getAttribute('aria-describedby')).toBe('desc-1');
    expect(el.getAttribute('data-obj-id')).toBe('revenue');
    expect(el.getAttribute('data-obj-type')).toBe('metric');
    expect(el.className).toContain('kpi-tile');
  });

  it('(f) rendered output is otherwise byte-identical — label and formatted value', () => {
    const { container } = renderSchema({
      type: 'metric',
      label: 'Total Revenue',
      value: 1930000,
      ...SCHEMA_METADATA,
    });

    expect(container.textContent).toContain('Total Revenue');
    // The KPI formatter's own contract: thousands separators, no decimals.
    expect(container.textContent).toContain('1,930,000');
  });
});
