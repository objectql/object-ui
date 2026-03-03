/**
 * RecordDetailView — Action button integration tests
 *
 * Validates that action buttons in the detail page header are wired to
 * ActionProvider and that the full action chain works:
 * - API actions use dataSource.update() via the registered handler
 * - Actions with params show a param collection dialog
 * - Actions with confirmText show a confirmation dialog
 * - Toast notifications are displayed on success/error
 * - Data refreshes after successful action execution
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RecordDetailView } from '../components/RecordDetailView';

// Mock sonner toast
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  }),
}));

// ─── Test Data ───────────────────────────────────────────────────────────────

function createMockDataSource() {
  return {
    async getObjectSchema() {
      return {
        name: 'opportunity',
        label: 'Opportunity',
        fields: {
          name: { name: 'name', label: 'Name', type: 'text' },
          stage: { name: 'stage', label: 'Stage', type: 'select' },
          amount: { name: 'amount', label: 'Amount', type: 'currency' },
        },
      };
    },
    findOne: vi.fn().mockResolvedValue({
      id: 'opp-1',
      name: 'Acme Deal',
      stage: 'proposal',
      amount: 50000,
    }),
    find: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn().mockResolvedValue({ id: '1' }),
    update: vi.fn().mockResolvedValue({ id: 'opp-1' }),
    delete: vi.fn().mockResolvedValue(true),
  } as any;
}

const opportunityActions = [
  {
    name: 'opportunity_change_stage',
    label: 'Change Stage',
    icon: 'arrow-right-circle',
    type: 'api' as const,
    target: 'opportunity_change_stage',
    locations: ['record_header' as const],
    params: [
      {
        name: 'new_stage', label: 'New Stage', type: 'select' as const, required: true,
        options: [
          { label: 'Prospecting', value: 'prospecting' },
          { label: 'Qualification', value: 'qualification' },
          { label: 'Proposal', value: 'proposal' },
          { label: 'Negotiation', value: 'negotiation' },
          { label: 'Closed Won', value: 'closed_won' },
          { label: 'Closed Lost', value: 'closed_lost' },
        ],
      },
    ],
    refreshAfter: true,
    successMessage: 'Stage updated successfully',
  },
  {
    name: 'opportunity_mark_won',
    label: 'Mark as Won',
    icon: 'trophy',
    type: 'api' as const,
    target: 'opportunity_mark_won',
    locations: ['record_header' as const],
    variant: 'primary' as const,
    confirmText: 'Mark this opportunity as Closed Won?',
    refreshAfter: true,
    successMessage: 'Opportunity marked as won!',
  },
];

const mockObjectsWithActions = [
  {
    name: 'opportunity',
    label: 'Opportunity',
    fields: {
      name: { name: 'name', label: 'Name', type: 'text' },
      stage: { name: 'stage', label: 'Stage', type: 'select' },
      amount: { name: 'amount', label: 'Amount', type: 'currency' },
    },
    actions: opportunityActions,
  },
];

function renderDetailWithActions(ds?: any) {
  const dataSource = ds ?? createMockDataSource();
  const onEdit = vi.fn();
  return {
    dataSource,
    onEdit,
    ...render(
      <MemoryRouter initialEntries={['/opportunity/record/opp-1']}>
        <Routes>
          <Route
            path="/:objectName/record/:recordId"
            element={
              <RecordDetailView
                dataSource={dataSource}
                objects={mockObjectsWithActions}
                onEdit={onEdit}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    ),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('RecordDetailView — Action buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders action buttons in the detail header', async () => {
    renderDetailWithActions();

    // Wait for record to load
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Acme Deal');
    });

    // Action buttons should be visible
    expect(screen.getByRole('button', { name: /Change Stage/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mark as Won/i })).toBeInTheDocument();
  });

  it('shows confirmation dialog for Mark as Won action', async () => {
    const user = userEvent.setup();
    renderDetailWithActions();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Acme Deal');
    });

    // Click Mark as Won
    await user.click(screen.getByRole('button', { name: /Mark as Won/i }));

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText('Mark this opportunity as Closed Won?')).toBeInTheDocument();
    });
  });

  it('calls dataSource.update when confirmation is accepted', async () => {
    const user = userEvent.setup();
    const ds = createMockDataSource();
    renderDetailWithActions(ds);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Acme Deal');
    });

    // Click Mark as Won
    await user.click(screen.getByRole('button', { name: /Mark as Won/i }));

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Mark this opportunity as Closed Won?')).toBeInTheDocument();
    });

    // Click Continue (confirm)
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // dataSource.update should be called with the correct params
    await waitFor(() => {
      expect(ds.update).toHaveBeenCalledWith('opportunity', 'opp-1', { stage: 'closed_won' });
    }, { timeout: 3000 });
  });

  it('does not call dataSource.update when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    const ds = createMockDataSource();
    renderDetailWithActions(ds);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Acme Deal');
    });

    // Click Mark as Won
    await user.click(screen.getByRole('button', { name: /Mark as Won/i }));

    // Wait for confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Mark this opportunity as Closed Won?')).toBeInTheDocument();
    });

    // Click Cancel
    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    // dataSource.update should NOT be called
    // (wait a tick to ensure no async calls happen)
    await new Promise(r => setTimeout(r, 100));
    expect(ds.update).not.toHaveBeenCalled();
  });

  it('shows param collection dialog for Change Stage action', async () => {
    const user = userEvent.setup();
    renderDetailWithActions();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Acme Deal');
    });

    // Click Change Stage
    await user.click(screen.getByRole('button', { name: /Change Stage/i }));

    // Param dialog should appear with the select field
    await waitFor(() => {
      expect(screen.getByText('Action Parameters')).toBeInTheDocument();
      expect(screen.getByText('New Stage')).toBeInTheDocument();
    });
  });

  it('shows toast on successful action execution', async () => {
    const user = userEvent.setup();
    const ds = createMockDataSource();
    renderDetailWithActions(ds);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Acme Deal');
    });

    // Click Mark as Won
    await user.click(screen.getByRole('button', { name: /Mark as Won/i }));

    // Confirm
    await waitFor(() => {
      expect(screen.getByText('Mark this opportunity as Closed Won?')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    // Toast should be called with success message
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Opportunity marked as won!');
    });
  });
});
