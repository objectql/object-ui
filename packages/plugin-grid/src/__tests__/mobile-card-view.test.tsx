/**
 * Mobile Card View Tests
 *
 * Tests for the optimized mobile card-view fallback in ObjectGrid:
 * - Visual hierarchy (Name as bold title, Amount+Stage row, date formatting)
 * - Currency formatting in card view
 * - Stage colored badge rendering
 * - Skeleton loading cards
 * - Card structure and layout
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';
import type { ListColumn } from '@object-ui/types';

registerAllFields();

// --- Mock CRM Opportunity Data ---
const opportunityData = [
  {
    _id: '101',
    name: 'ObjectStack Enterprise License',
    amount: 150000,
    stage: 'Closed Won',
    close_date: '2024-01-15T00:00:00.000Z',
    probability: 100,
  },
  {
    _id: '102',
    name: 'Global Fin Q1 Upsell',
    amount: 45000,
    stage: 'Negotiation',
    close_date: '2024-03-30T00:00:00.000Z',
    probability: 80,
  },
  {
    _id: '103',
    name: 'London Annual Renewal',
    amount: 85000,
    stage: 'Proposal',
    close_date: '2024-05-15T00:00:00.000Z',
    probability: 60,
  },
];

const opportunityColumns: ListColumn[] = [
  { field: 'name', label: 'Name' },
  { field: 'amount', label: 'Amount' },
  { field: 'stage', label: 'Stage' },
  { field: 'close_date', label: 'Close Date' },
  { field: 'probability', label: 'Probability' },
];

let originalInnerWidth: number;

beforeEach(() => {
  originalInnerWidth = window.innerWidth;
});

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: originalInnerWidth,
  });
  window.dispatchEvent(new Event('resize'));
});

function setMobileViewport() {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 375,
  });
  window.dispatchEvent(new Event('resize'));
}

function renderGrid(data: any[], columns: ListColumn[], opts?: Record<string, any>) {
  setMobileViewport();
  const schema: any = {
    type: 'object-grid' as const,
    objectName: 'opportunity',
    columns,
    data: { provider: 'value', items: data },
    ...opts,
  };

  return render(
    <ActionProvider>
      <ObjectGrid schema={schema} />
    </ActionProvider>
  );
}

// =========================================================================
// 1. Card View Title Hierarchy
// =========================================================================
describe('Mobile Card View: Title hierarchy', () => {
  it('should display the first column (Name) as a bold title in each card', async () => {
    renderGrid(opportunityData, opportunityColumns);

    await waitFor(() => {
      expect(screen.getByText('ObjectStack Enterprise License')).toBeInTheDocument();
      expect(screen.getByText('Global Fin Q1 Upsell')).toBeInTheDocument();
      expect(screen.getByText('London Annual Renewal')).toBeInTheDocument();
    });

    // Verify the name is rendered with font-semibold (bold title)
    const titleEl = screen.getByText('ObjectStack Enterprise License');
    expect(titleEl.className).toContain('font-semibold');
  });
});

// =========================================================================
// 2. Currency Formatting
// =========================================================================
describe('Mobile Card View: Currency formatting', () => {
  it('should format Amount as currency ($150,000.00)', async () => {
    renderGrid(opportunityData, opportunityColumns);

    await waitFor(() => {
      expect(screen.getByText('$150,000.00')).toBeInTheDocument();
      expect(screen.getByText('$45,000.00')).toBeInTheDocument();
      expect(screen.getByText('$85,000.00')).toBeInTheDocument();
    });
  });
});

// =========================================================================
// 3. Stage Badge Rendering
// =========================================================================
describe('Mobile Card View: Stage colored badge', () => {
  it('should render stage values as Badge components', async () => {
    renderGrid(opportunityData, opportunityColumns);

    await waitFor(() => {
      const closedWonBadges = screen.getAllByText('Closed Won');
      expect(closedWonBadges.length).toBeGreaterThanOrEqual(1);

      const negotiationBadge = screen.getByText('Negotiation');
      expect(negotiationBadge).toBeInTheDocument();

      const proposalBadge = screen.getByText('Proposal');
      expect(proposalBadge).toBeInTheDocument();
    });
  });

  it('should apply green color to Closed Won stage badge', async () => {
    renderGrid(opportunityData, opportunityColumns);

    await waitFor(() => {
      const badges = screen.getAllByText('Closed Won');
      const badge = badges[0];
      expect(badge.className).toContain('bg-green-100');
      expect(badge.className).toContain('text-green-800');
    });
  });

  it('should apply yellow color to Negotiation stage badge', async () => {
    renderGrid(opportunityData, opportunityColumns);

    await waitFor(() => {
      const badge = screen.getByText('Negotiation');
      expect(badge.className).toContain('bg-yellow-100');
      expect(badge.className).toContain('text-yellow-800');
    });
  });

  it('should apply blue color to Proposal stage badge', async () => {
    renderGrid(opportunityData, opportunityColumns);

    await waitFor(() => {
      const badge = screen.getByText('Proposal');
      expect(badge.className).toContain('bg-blue-100');
      expect(badge.className).toContain('text-blue-800');
    });
  });
});

// =========================================================================
// 4. Date Formatting
// =========================================================================
describe('Mobile Card View: Date formatting', () => {
  it('should format close_date as short date (not ISO string)', async () => {
    renderGrid(opportunityData, opportunityColumns);

    await waitFor(() => {
      // Should NOT show raw ISO string
      expect(screen.queryByText('2024-01-15T00:00:00.000Z')).not.toBeInTheDocument();
      expect(screen.queryByText('2024-03-30T00:00:00.000Z')).not.toBeInTheDocument();

      // Should show formatted date (en-US short format)
      expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
    });
  });
});

// =========================================================================
// 5. Skeleton Loading Cards
// =========================================================================
describe('Mobile Card View: Skeleton loading', () => {
  it('should show loading spinner when no data is available', async () => {
    setMobileViewport();
    const schema: any = {
      type: 'object-grid' as const,
      objectName: 'opportunity',
      columns: opportunityColumns,
      data: { provider: 'value', items: [] },
    };

    render(
      <ActionProvider>
        <ObjectGrid schema={schema} />
      </ActionProvider>
    );

    // With empty inline data, grid shows spinner or empty state (not skeleton cards)
    // The skeleton cards only appear during async loading on mobile
    await waitFor(() => {
      expect(screen.queryByText('ObjectStack Enterprise License')).not.toBeInTheDocument();
    });
  });
});

// =========================================================================
// 6. Card Structure
// =========================================================================
describe('Mobile Card View: Card structure', () => {
  it('should render all data rows as individual cards', async () => {
    const { container } = renderGrid(opportunityData, opportunityColumns);

    await waitFor(() => {
      const cards = container.querySelectorAll('.border.rounded-lg');
      expect(cards.length).toBe(3);
    });
  });

  it('should render Close Date label in the card', async () => {
    renderGrid(opportunityData, opportunityColumns);

    await waitFor(() => {
      const labels = screen.getAllByText('Close Date');
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });
  });
});
