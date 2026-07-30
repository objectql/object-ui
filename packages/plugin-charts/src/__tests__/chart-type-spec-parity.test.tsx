/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Chart type ↔ spec vocabulary parity + behavior (#2942).
 *
 * 7 of the 19 `ChartTypeSchema` values (the single-value and tabular
 * families) used to fall through the cartesian component map's `|| BarChart`
 * into a bar shell whose series marks all returned null — grid, axes,
 * tooltip and legend rendered with NO data marks, indistinguishable from an
 * empty dataset. Reachable because `ChartRenderer` reads
 * `schema.chartType ?? spec.chartType`, bypassing `normalizeChartSchema`'s
 * `RENDERABLE` gate.
 *
 * Contract under test:
 * - parity: RENDERABLE ∪ SINGLE_VALUE ∪ TABULAR covers every spec value, and
 *   the only renderer-local dialect is the documented `combo`;
 * - behavior: a single-value type renders the number, a tabular type renders
 *   the ownership notice, an out-of-spec type is named — never a silent
 *   empty plot.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ChartTypeSchema } from '@objectstack/spec/ui';
import AdvancedChartImpl from '../AdvancedChartImpl';
import { RENDERABLE, SINGLE_VALUE_CHART_TYPES, TABULAR_CHART_TYPES } from '../normalizeChartSchema';

const specNames: string[] = (() => {
  const raw = (ChartTypeSchema as unknown as { options?: readonly string[] }).options;
  return Array.isArray(raw) ? [...raw] : [];
})();

describe('plugin-charts covers the spec chart-type vocabulary', () => {
  it('reads a non-empty enum from the spec', () => {
    expect(specNames, 'could not read ChartTypeSchema.options from the spec').not.toEqual([]);
  });

  it('every spec chart type lands on a real branch (series, single-value, or tabular)', () => {
    const uncovered = specNames.filter(
      (name) => !RENDERABLE.has(name) && !SINGLE_VALUE_CHART_TYPES.has(name) && !TABULAR_CHART_TYPES.has(name),
    );
    expect(
      uncovered,
      'these validate against ChartTypeSchema and would draw a silent empty plot',
    ).toEqual([]);
  });

  it("the only renderer-local dialect is the documented 'combo'", () => {
    const implemented = [...RENDERABLE, ...SINGLE_VALUE_CHART_TYPES, ...TABULAR_CHART_TYPES];
    const dialect = implemented.filter((name) => !specNames.includes(name));
    // `combo` is tracked in #2945 ("promote or delete"); anything else
    // appearing here is NEW dialect and needs the same decision first.
    expect(dialect).toEqual(['combo']);
  });
});

describe('non-series chart families render honestly', () => {
  const data = [{ label: 'Total', value: 1234 }];
  const series = [{ dataKey: 'value', label: 'Total revenue' }];

  it('a single-value type (kpi) renders the number, not an empty bar shell', () => {
    render(<AdvancedChartImpl chartType={'kpi' as never} data={data} xAxisKey="label" series={series} />);
    const card = screen.getByTestId('advanced-chart-single-value');
    expect(card.textContent).toContain('1,234');
    expect(card.textContent).toContain('Total revenue');
  });

  it('every single-value family renders the same card', () => {
    for (const t of SINGLE_VALUE_CHART_TYPES) {
      const { unmount, getByTestId } = render(
        <AdvancedChartImpl chartType={t as never} data={data} xAxisKey="label" series={series} />,
      );
      expect(getByTestId('advanced-chart-single-value'), `type '${t}'`).toBeInTheDocument();
      unmount();
    }
  });

  it("a tabular type ('table') names the owning component instead of an empty plot", () => {
    render(<AdvancedChartImpl chartType={'table' as never} data={data} xAxisKey="label" series={series} />);
    expect(screen.getByTestId('advanced-chart-tabular-notice').textContent).toContain('table');
  });

  it('an out-of-spec type is named rather than guessed at', () => {
    render(<AdvancedChartImpl chartType={'sunburst' as never} data={data} xAxisKey="label" series={series} />);
    expect(screen.getByTestId('advanced-chart-unknown-type').textContent).toContain('sunburst');
  });
});
