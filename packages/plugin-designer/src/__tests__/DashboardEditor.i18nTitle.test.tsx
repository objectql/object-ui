/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4163 part 1 — the three `widget.title` reads in `DashboardEditor`,
 * and they are NOT the same kind of read.
 *
 * Two are DISPLAY (the widget card in the list, and the preview pane's tile):
 * a map has to resolve to the locale's string or React renders
 * `[object Object]`.
 *
 * The third is an AUTHORING WRITE — the property panel's single-line title
 * `<input>` — and it is the one where following rc.6's widening mechanically
 * would have destroyed data rather than merely looked wrong. Resolving a map
 * into the input and writing `e.target.value` back collapses every other locale
 * on the first keystroke. This file's round-trip pin is the acceptance test for
 * the conservative branch PR #4169 established on `DashboardWidgetInspector`
 * and objectui#4163's dispatch ruling extends here: an inline map survives an
 * unrelated edit-and-save untouched.
 *
 * Part 2 of #4163 (what Studio SHOULD offer for authoring a per-locale label)
 * is unclaimed and pending design; these pins describe the placeholder, and
 * they are written so that the real answer replaces them deliberately.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DashboardComponentSchema } from '@object-ui/types';
import { DashboardEditor } from '../DashboardEditor';

const MAP_TITLE = { en: 'Pipeline', 'zh-CN': '销售漏斗' };

function schemaWith(title: unknown): DashboardComponentSchema {
  return {
    type: 'dashboard',
    name: 'sales',
    title: 'Sales dashboard',
    widgets: [
      // Cast at the fixture boundary only — the point is what a spec-valid
      // authored map does at the read/write sites.
      { id: 'w1', type: 'bar', title: title as never },
      { id: 'w2', type: 'metric', title: 'Revenue' },
    ],
  } as DashboardComponentSchema;
}

describe('DashboardEditor — display reads of a map-valued widget title (#4163)', () => {
  it('renders the resolved locale string on the widget card', () => {
    render(<DashboardEditor schema={schemaWith(MAP_TITLE)} onChange={() => {}} />);
    const card = screen.getByTestId('dashboard-widget-w1');
    expect(card.textContent).toContain('Pipeline');
  });

  it('never renders the stringified object anywhere in the editor', () => {
    const { container } = render(
      <DashboardEditor schema={schemaWith(MAP_TITLE)} onChange={() => {}} />,
    );
    expect(container.innerHTML).not.toContain('[object Object]');
  });

  it('leaves a plain-string title exactly as authored', () => {
    // Non-vacuity: a resolver returning '' for everything passes the assertion
    // above and fails this one.
    render(<DashboardEditor schema={schemaWith(MAP_TITLE)} onChange={() => {}} />);
    expect(screen.getByTestId('dashboard-widget-w2').textContent).toContain('Revenue');
  });
});

/**
 * The schema from the most recent `onChange` call.
 *
 * Index arithmetic rather than `calls.at(-1)`: the repo compiles at
 * `target`/`lib` `ES2020` (root `tsconfig.json`), and `Array.prototype.at` is
 * ES2022 — so `.at()` type-checks nowhere in this repo even though every
 * runtime it ships on has it. It passes `vitest` (esbuild strips types without
 * checking them) and fails `tsc -p tsconfig.test.json`, which is the half of
 * `type-check` that compiles tests. Left as a named helper so the constraint is
 * stated once instead of re-learned at the next call site.
 */
function lastSchema(onChange: ReturnType<typeof vi.fn>): DashboardComponentSchema {
  const calls = onChange.mock.calls;
  return calls[calls.length - 1][0] as DashboardComponentSchema;
}

describe('DashboardEditor — the title INPUT is a write path, not a display (#4163)', () => {
  /** Select the widget so the property panel mounts. */
  function openPanelFor(schema: DashboardComponentSchema, widgetTestId: string) {
    const onChange = vi.fn();
    render(<DashboardEditor schema={schema} onChange={onChange} />);
    fireEvent.click(screen.getByTestId(widgetTestId));
    return onChange;
  }

  it('shows a map-valued title resolved, and READ-ONLY', () => {
    openPanelFor(schemaWith(MAP_TITLE), 'dashboard-widget-w1');
    const input = screen.getByTestId('widget-prop-title') as HTMLInputElement;
    expect(input.value).toBe('Pipeline');
    expect(input.readOnly).toBe(true);
  });

  it('⛔ a keystroke on a map-valued title writes NOTHING — the other locales survive', () => {
    // The data-loss pin. Without the guard this emits
    // `{ title: 'Pipelinex' }`, and `zh-CN` is gone forever on the next save.
    const onChange = openPanelFor(schemaWith(MAP_TITLE), 'dashboard-widget-w1');
    const input = screen.getByTestId('widget-prop-title');
    fireEvent.change(input, { target: { value: 'Pipelinex' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('an inline map survives an UNRELATED edit-and-save round trip untouched', () => {
    // The ruling's acceptance criterion, end to end: the author changes
    // something else entirely on the same widget, and the stored map comes back
    // byte-identical rather than flattened to one locale.
    const onChange = openPanelFor(schemaWith(MAP_TITLE), 'dashboard-widget-w1');
    fireEvent.change(screen.getByTestId('widget-prop-color'), { target: { value: 'blue' } });

    expect(onChange).toHaveBeenCalled();
    const saved = lastSchema(onChange);
    const widget = saved.widgets!.find((w) => w.id === 'w1')!;
    expect(widget.title).toEqual(MAP_TITLE);
    // `toEqual` alone would pass for a rebuilt-but-equal object; this says the
    // OTHER locale is still there, which is the thing that gets lost.
    expect((widget.title as Record<string, string>)['zh-CN']).toBe('销售漏斗');
    expect((widget as { colorVariant?: string }).colorVariant).toBe('blue');
  });

  it('a plain-string title stays fully editable — the guard is narrow', () => {
    // Non-vacuity for the two pins above: a guard that simply disabled the
    // input for everyone would satisfy them and fail here.
    const onChange = openPanelFor(schemaWith(MAP_TITLE), 'dashboard-widget-w2');
    const input = screen.getByTestId('widget-prop-title') as HTMLInputElement;
    expect(input.value).toBe('Revenue');
    expect(input.readOnly).toBe(false);

    fireEvent.change(input, { target: { value: 'Revenue (net)' } });
    expect(onChange).toHaveBeenCalled();
    const saved = lastSchema(onChange);
    expect(saved.widgets!.find((w) => w.id === 'w2')!.title).toBe('Revenue (net)');
  });
});
