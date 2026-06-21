// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { DatasetPreview } from './DatasetPreview';

// Mock the data adapter the preview pulls from AdapterProvider.
const { queryDataset } = vi.hoisted(() => ({ queryDataset: vi.fn() }));
vi.mock('../../../providers/AdapterProvider', () => ({
  useAdapter: () => ({ queryDataset }),
}));

afterEach(() => {
  cleanup();
  queryDataset.mockReset();
});

const baseProps = { type: 'dataset', name: 'sales', locale: 'en-US' as const };

const draft = {
  name: 'sales',
  label: 'Sales',
  object: 'opportunity',
  include: ['account'],
  dimensions: [{ name: 'region', field: 'account.region' }],
  measures: [{ name: 'revenue', aggregate: 'sum', field: 'amount' }],
};

describe('DatasetPreview', () => {
  it('auto-runs the draft and renders the result table', async () => {
    queryDataset.mockResolvedValue({ rows: [{ region: 'NA', revenue: 100 }, { region: 'EU', revenue: 50 }], fields: [] });
    render(<DatasetPreview {...baseProps} draft={draft} />);

    // Posted the inline draft + derived selection.
    await waitFor(() => expect(queryDataset).toHaveBeenCalledWith(draft, { dimensions: ['region'], measures: ['revenue'] }));
    // Rows render.
    expect(await screen.findByText('NA')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('EU')).toBeInTheDocument();
  });

  it('renders display labels for headers and currency-formatted measures', async () => {
    queryDataset.mockResolvedValue({
      rows: [{ region: 'NA', revenue: 1000 }],
      object: 'opportunity',
      fields: [
        { name: 'region', type: 'string', label: 'Region' },
        { name: 'revenue', type: 'number', label: 'Revenue', format: '0,0', currency: 'USD' },
      ],
    });
    render(<DatasetPreview {...baseProps} draft={draft} />);
    // Headers use the server field label, not the raw dimension/measure name.
    expect(await screen.findByRole('columnheader', { name: 'Region' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Revenue' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'revenue' })).not.toBeInTheDocument();
    // Amount carries the declared currency symbol (never a bare number).
    expect(screen.getByText('$1,000')).toBeInTheDocument();
  });

  it('formats an amount with no declared currency as a plain number (no $)', async () => {
    queryDataset.mockResolvedValue({
      rows: [{ region: 'NA', revenue: 1234 }],
      object: 'opportunity',
      fields: [
        { name: 'region', type: 'string', label: 'Region' },
        { name: 'revenue', type: 'number', label: 'Revenue', format: '0,0' },
      ],
    });
    render(<DatasetPreview {...baseProps} draft={draft} />);
    expect(await screen.findByText('1,234')).toBeInTheDocument();
    expect(screen.queryByText('$1,234')).not.toBeInTheDocument();
  });

  it('surfaces a server/compile error as an alert (no silent fallback)', async () => {
    queryDataset.mockRejectedValue(new Error('relationship "account" is not declared in the dataset\'s `include`'));
    render(<DatasetPreview {...baseProps} draft={draft} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/not declared/);
  });

  it('prompts to add a measure when none are defined', () => {
    render(<DatasetPreview {...baseProps} draft={{ ...draft, measures: [] }} />);
    expect(screen.getByText(/Add a measure/i)).toBeInTheDocument();
    expect(queryDataset).not.toHaveBeenCalled();
  });

  it('prompts to pick a base object when object is missing', () => {
    render(<DatasetPreview {...baseProps} draft={{ ...draft, object: undefined }} />);
    expect(screen.getByText(/Pick a base object/i)).toBeInTheDocument();
    expect(queryDataset).not.toHaveBeenCalled();
  });
});
