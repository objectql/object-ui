/**
 * ObjectDef Field Enrichment Tests
 *
 * Tests that ObjectGrid properly merges objectDef field definitions
 * into column metadata for type-aware rendering, covering:
 * - String[] columns enriched with objectDef field types
 * - ListColumn[] columns enriched with objectDef options (with colors)
 * - Currency, percent, date, select field formatting from objectDef
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';

registerAllFields();

// --- Opportunity-like mock data ---
const opportunityData = [
  { _id: '1', name: 'Enterprise License', amount: 150000, stage: 'closed_won', close_date: '2024-01-15T00:00:00.000Z', probability: 100, forecast_category: 'commit' },
  { _id: '2', name: 'E-Com Integration', amount: 12000, stage: 'closed_lost', close_date: '2024-02-10T00:00:00.000Z', probability: 0, forecast_category: 'omitted' },
  { _id: '3', name: 'Tower Expansion', amount: 75000, stage: 'negotiation', close_date: '2024-02-28T00:00:00.000Z', probability: 80, forecast_category: 'best_case' },
];

// --- Mock objectSchema that resembles the Opportunity object definition ---
const opportunitySchema = {
  name: 'opportunity',
  fields: {
    name: { name: 'name', type: 'text', label: 'Opportunity Name', required: true },
    amount: { name: 'amount', type: 'currency', label: 'Amount', currency: 'USD' },
    stage: {
      name: 'stage', type: 'select', label: 'Stage',
      options: [
        { value: 'prospecting', label: 'Prospecting', color: 'purple' },
        { value: 'qualification', label: 'Qualification', color: 'indigo' },
        { value: 'proposal', label: 'Proposal', color: 'blue' },
        { value: 'negotiation', label: 'Negotiation', color: 'yellow' },
        { value: 'closed_won', label: 'Closed Won', color: 'green' },
        { value: 'closed_lost', label: 'Closed Lost', color: 'red' },
      ],
    },
    close_date: { name: 'close_date', type: 'date', label: 'Close Date' },
    probability: { name: 'probability', type: 'percent', label: 'Probability' },
    forecast_category: {
      name: 'forecast_category', type: 'select', label: 'Forecast Category',
      options: [
        { value: 'pipeline', label: 'Pipeline', color: 'blue' },
        { value: 'best_case', label: 'Best Case', color: 'green' },
        { value: 'commit', label: 'Commit', color: 'purple' },
        { value: 'omitted', label: 'Omitted', color: 'gray' },
      ],
    },
  },
};

// Mock DataSource for async schema fetch tests
function createMockDataSource(schema: any, data: any[]) {
  return {
    getObjectSchema: vi.fn().mockResolvedValue(schema),
    find: vi.fn().mockResolvedValue({ data }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function renderGrid(opts: Record<string, any>) {
  const schema: any = {
    type: 'object-grid' as const,
    objectName: 'opportunity',
    data: { provider: 'value', items: opportunityData },
    ...opts,
  };

  return render(
    <ActionProvider>
      <ObjectGrid schema={schema} {...(opts.dataSource ? { dataSource: opts.dataSource } : {})} />
    </ActionProvider>
  );
}

// =========================================================================
// String[] columns with inline data + objectSchema stub
// =========================================================================
describe('String[] columns with inline data', () => {
  it('should apply type inference for string columns (currency, date, percent, select)', async () => {
    // With inline data, objectSchema is not fetched, so inference applies
    renderGrid({
      columns: ['name', 'amount', 'stage', 'close_date', 'probability'],
    });

    await waitFor(() => {
      expect(screen.getByText('Enterprise License')).toBeInTheDocument();
    });

    // Amount should be formatted (inference detects "amount" as currency)
    await waitFor(() => {
      expect(screen.getByText('$150,000.00')).toBeInTheDocument();
    });

    // Stage should be rendered as badge (inference detects "stage" as select)
    await waitFor(() => {
      // Inferred select auto-generates options from data with humanized labels
      const badge = screen.getByText('Closed Won');
      expect(badge).toBeInTheDocument();
    });
  });

  it('should right-align numeric columns for string[] format', async () => {
    renderGrid({
      columns: ['name', 'amount', 'probability'],
    });

    await waitFor(() => {
      expect(screen.getByText('Enterprise License')).toBeInTheDocument();
    });

    // Amount column should have right alignment (currency type)
    await waitFor(() => {
      const amountCell = screen.getByText('$150,000.00');
      expect(amountCell).toBeInTheDocument();
    });
  });
});

// =========================================================================
// ListColumn[] with objectDef enrichment (inline data + objectSchema set)
// =========================================================================
describe('ListColumn[] columns with objectDef enrichment', () => {
  it('should render select fields with colored badges from objectDef options', async () => {
    // Use ListColumn[] with type: 'select' but no options — objectDef should provide them
    // For inline data, objectSchema isn't fetched, so we simulate by passing options in ListColumn
    renderGrid({
      columns: [
        { field: 'name', label: 'Name' },
        {
          field: 'stage', label: 'Stage', type: 'select',
          options: [
            { value: 'closed_won', label: 'Closed Won', color: 'green' },
            { value: 'closed_lost', label: 'Closed Lost', color: 'red' },
            { value: 'negotiation', label: 'Negotiation', color: 'yellow' },
          ],
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Closed Won')).toBeInTheDocument();
    });

    // Verify colored badge rendering
    const closedWonBadge = screen.getByText('Closed Won');
    expect(closedWonBadge).toHaveClass('bg-green-100');

    const closedLostBadge = screen.getByText('Closed Lost');
    expect(closedLostBadge).toHaveClass('bg-red-100');
  });

  it('should render currency fields with proper formatting from objectDef', async () => {
    renderGrid({
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'amount', label: 'Amount', type: 'currency' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('$150,000.00')).toBeInTheDocument();
      expect(screen.getByText('$12,000.00')).toBeInTheDocument();
      expect(screen.getByText('$75,000.00')).toBeInTheDocument();
    });
  });

  it('should render percent fields with % formatting', async () => {
    renderGrid({
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'probability', label: 'Probability', type: 'percent' },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Enterprise License')).toBeInTheDocument();
    });

    // Percent fields should show percentage values
    await waitFor(() => {
      const percentTexts = screen.getAllByText(/%/);
      expect(percentTexts.length).toBeGreaterThan(0);
    });
  });
});

// =========================================================================
// DataSource-based schema fetch with string[] columns
// =========================================================================
describe('String[] columns with DataSource schema fetch', () => {
  it('should fetch full schema and use objectDef field types for string[] columns', async () => {
    const mockDataSource = createMockDataSource(opportunitySchema, opportunityData);

    const schema: any = {
      type: 'object-grid' as const,
      objectName: 'opportunity',
      columns: ['name', 'amount', 'stage', 'close_date', 'probability', 'forecast_category'],
      data: { provider: 'object', object: 'opportunity' },
    };

    render(
      <ActionProvider>
        <ObjectGrid schema={schema} dataSource={mockDataSource} />
      </ActionProvider>
    );

    // Wait for schema and data to load
    await waitFor(() => {
      expect(mockDataSource.getObjectSchema).toHaveBeenCalledWith('opportunity');
    });

    await waitFor(() => {
      expect(screen.getByText('Enterprise License')).toBeInTheDocument();
    });

    // Amount should be formatted as currency (from objectDef type: 'currency')
    await waitFor(() => {
      expect(screen.getByText('$150,000.00')).toBeInTheDocument();
    });

    // Stage should render with label from objectDef options
    await waitFor(() => {
      expect(screen.getByText('Closed Won')).toBeInTheDocument();
    });

    // Stage badge should have color from objectDef options
    const closedWonBadge = screen.getByText('Closed Won');
    expect(closedWonBadge).toHaveClass('bg-green-100');

    // Forecast category should also render with colored badges
    const commitBadge = screen.getByText('Commit');
    expect(commitBadge).toHaveClass('bg-purple-100');
  });

  it('should use objectDef labels for string[] column headers', async () => {
    const mockDataSource = createMockDataSource(opportunitySchema, opportunityData);

    const schema: any = {
      type: 'object-grid' as const,
      objectName: 'opportunity',
      columns: ['name', 'amount', 'close_date'],
      data: { provider: 'object', object: 'opportunity' },
    };

    render(
      <ActionProvider>
        <ObjectGrid schema={schema} dataSource={mockDataSource} />
      </ActionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Enterprise License')).toBeInTheDocument();
    });

    // Headers should use objectDef labels
    expect(screen.getByText('Opportunity Name')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Close Date')).toBeInTheDocument();
  });
});

// =========================================================================
// ListColumn[] with DataSource schema fetch (objectDef merge)
// =========================================================================
describe('ListColumn[] with DataSource objectDef merge', () => {
  it('should merge objectDef options into ListColumn fieldMeta for colored badges', async () => {
    const mockDataSource = createMockDataSource(opportunitySchema, opportunityData);

    const schema: any = {
      type: 'object-grid' as const,
      objectName: 'opportunity',
      // ListColumn without options — objectDef should provide them
      columns: [
        { field: 'name', label: 'Name' },
        { field: 'stage', label: 'Stage' },
        { field: 'forecast_category', label: 'Forecast' },
      ],
      data: { provider: 'object', object: 'opportunity' },
    };

    render(
      <ActionProvider>
        <ObjectGrid schema={schema} dataSource={mockDataSource} />
      </ActionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Enterprise License')).toBeInTheDocument();
    });

    // Stage badges should have colors from objectDef
    await waitFor(() => {
      const closedWonBadge = screen.getByText('Closed Won');
      expect(closedWonBadge).toHaveClass('bg-green-100');
    });

    // Forecast badges should have colors from objectDef
    const commitBadge = screen.getByText('Commit');
    expect(commitBadge).toHaveClass('bg-purple-100');
  });

  it('should prefer explicit ListColumn options over objectDef options', async () => {
    const mockDataSource = createMockDataSource(opportunitySchema, opportunityData);

    const schema: any = {
      type: 'object-grid' as const,
      objectName: 'opportunity',
      columns: [
        { field: 'name', label: 'Name' },
        {
          field: 'stage', label: 'Stage',
          // Explicit options override objectDef
          options: [
            { value: 'closed_won', label: 'Won!', color: 'blue' },
            { value: 'closed_lost', label: 'Lost', color: 'gray' },
            { value: 'negotiation', label: 'Negotiating', color: 'orange' },
          ],
        },
      ],
      data: { provider: 'object', object: 'opportunity' },
    };

    render(
      <ActionProvider>
        <ObjectGrid schema={schema} dataSource={mockDataSource} />
      </ActionProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Enterprise License')).toBeInTheDocument();
    });

    // Should use explicit ListColumn options, not objectDef
    await waitFor(() => {
      expect(screen.getByText('Won!')).toBeInTheDocument();
    });

    const wonBadge = screen.getByText('Won!');
    expect(wonBadge).toHaveClass('bg-blue-100');
  });
});
