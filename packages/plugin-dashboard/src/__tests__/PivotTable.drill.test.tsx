/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { PivotTable } from '../PivotTable';

const data = [
  { stage: 'won', source: 'web', amount: 100 },
  { stage: 'won', source: 'event', amount: 50 },
  { stage: 'lost', source: 'web', amount: 25 },
];

const baseSchema: any = {
  type: 'pivot',
  rowField: 'stage',
  columnField: 'source',
  valueField: 'amount',
  aggregation: 'sum',
  showRowTotals: true,
  showColumnTotals: true,
  data,
};

describe('PivotTable drill-down', () => {
  it('does not render interactive cells when drillDown is omitted', () => {
    render(<PivotTable schema={baseSchema} />);
    // No element with role="button"
    expect(screen.queryAllByRole('button').length).toBe(0);
  });

  it('does not call onDrillDown when drillDown.enabled !== true', () => {
    const onDrillDown = vi.fn();
    render(<PivotTable schema={baseSchema} onDrillDown={onDrillDown} />);
    expect(screen.queryAllByRole('button').length).toBe(0);
    expect(onDrillDown).not.toHaveBeenCalled();
  });

  it('emits cell payload with rowKey/colKey/value/scope on click', () => {
    const onDrillDown = vi.fn();
    render(
      <PivotTable
        schema={{ ...baseSchema, drillDown: { enabled: true } }}
        onDrillDown={onDrillDown}
      />,
    );
    const cell = screen.getByLabelText('Drill into stage=won, source=web');
    fireEvent.click(cell);
    expect(onDrillDown).toHaveBeenCalledTimes(1);
    expect(onDrillDown.mock.calls[0][0]).toMatchObject({
      scope: 'cell',
      rowKey: 'won',
      colKey: 'web',
      value: 100,
    });
  });

  it('row header click emits scope=row payload', () => {
    const onDrillDown = vi.fn();
    render(
      <PivotTable
        schema={{ ...baseSchema, drillDown: { enabled: true } }}
        onDrillDown={onDrillDown}
      />,
    );
    fireEvent.click(screen.getByLabelText('Drill into stage: won'));
    expect(onDrillDown.mock.calls[0][0]).toMatchObject({ scope: 'row', rowKey: 'won' });
  });

  it('column header click emits scope=column payload', () => {
    const onDrillDown = vi.fn();
    render(
      <PivotTable
        schema={{ ...baseSchema, drillDown: { enabled: true } }}
        onDrillDown={onDrillDown}
      />,
    );
    fireEvent.click(screen.getByLabelText('Drill into source: event'));
    expect(onDrillDown.mock.calls[0][0]).toMatchObject({ scope: 'column', colKey: 'event' });
  });

  it('Enter key on a cell triggers drill', () => {
    const onDrillDown = vi.fn();
    render(
      <PivotTable
        schema={{ ...baseSchema, drillDown: { enabled: true } }}
        onDrillDown={onDrillDown}
      />,
    );
    const cell = screen.getByLabelText('Drill into stage=lost, source=web');
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(onDrillDown).toHaveBeenCalledTimes(1);
    expect(onDrillDown.mock.calls[0][0]).toMatchObject({ scope: 'cell', rowKey: 'lost', colKey: 'web' });
  });

  it('passes rowLabels to drill payload as rowLabel', () => {
    const onDrillDown = vi.fn();
    render(
      <PivotTable
        schema={{ ...baseSchema, drillDown: { enabled: true } }}
        rowLabels={{ won: 'Won', lost: 'Lost' }}
        columnLabels={{ web: 'Web', event: 'Event' }}
        onDrillDown={onDrillDown}
      />,
    );
    fireEvent.click(screen.getByLabelText('Drill into stage=won, source=web'));
    expect(onDrillDown.mock.calls[0][0]).toMatchObject({ rowLabel: 'Won', colLabel: 'Web' });
  });
});
