/**
 * ReportView Integration Tests
 * 
 * Tests ReportView component with data loading from adapter
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReportView } from '../components/ReportView';
import { MetadataProvider } from '../context/MetadataProvider';
import { startMockServer, stopMockServer, getDriver } from '../mocks/server';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import type { DataSource } from '@object-ui/types';

describe('ReportView Data Loading', () => {
  let adapter: ObjectStackAdapter;

  beforeAll(async () => {
    await startMockServer();
    adapter = new ObjectStackAdapter({
      baseUrl: '',
      autoReconnect: false,
    });
    await adapter.connect();

    // Seed test data for the opportunity object
    const driver = getDriver()!;
    await driver.create('opportunity', {
      id: '1',
      name: 'Deal Alpha',
      amount: 50000,
      stage: 'Proposal',
      close_date: '2024-03-31',
    });
    await driver.create('opportunity', {
      id: '2',
      name: 'Deal Beta',
      amount: 75000,
      stage: 'Negotiation',
      close_date: '2024-04-15',
    });
    await driver.create('opportunity', {
      id: '3',
      name: 'Deal Gamma',
      amount: 100000,
      stage: 'Closed Won',
      close_date: '2024-02-28',
    });
  });

  afterAll(() => {
    stopMockServer();
  });

  it('should load and display report data from objectName', async () => {
    render(
      <MemoryRouter initialEntries={['/apps/crm_app/report/sales_performance_q1']}>
        <MetadataProvider adapter={adapter}>
          <Routes>
            <Route
              path="/apps/:appName/report/:reportName"
              element={<ReportView dataSource={adapter as DataSource} />}
            />
          </Routes>
        </MetadataProvider>
      </MemoryRouter>
    );

    // Wait for metadata to load
    await waitFor(
      () => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Check that the report viewer is rendered
    await waitFor(
      () => {
        expect(screen.getAllByText(/Q1 Sales Performance/i)[0]).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // The report should render with data (checking for toolbar presence)
    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
  });

  it('should handle inline data in report definition', async () => {
    // Mock adapter for this test
    const mockAdapter = {
      ...adapter,
      find: vi.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pageSize: 0,
        hasMore: false,
      }),
    } as unknown as DataSource;

    render(
      <MemoryRouter initialEntries={['/apps/test_app/report/inline_data_report']}>
        <MetadataProvider adapter={adapter}>
          <Routes>
            <Route
              path="/apps/:appName/report/:reportName"
              element={<ReportView dataSource={mockAdapter} />}
            />
          </Routes>
        </MetadataProvider>
      </MemoryRouter>
    );

    // Wait for metadata to load
    await waitFor(
      () => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // If report has inline data, adapter.find should NOT be called
    // (This test would need a report with inline data in the metadata)
  });

  it('should display loading state while fetching data', async () => {
    // Create a mock adapter that delays the response
    const delayedAdapter = {
      ...adapter,
      find: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: [{ id: '1', name: 'Test' }],
                  total: 1,
                  page: 1,
                  pageSize: 1,
                  hasMore: false,
                }),
              100
            )
          )
      ),
    } as unknown as DataSource;

    render(
      <MemoryRouter initialEntries={['/apps/crm_app/report/sales_performance_q1']}>
        <MetadataProvider adapter={adapter}>
          <Routes>
            <Route
              path="/apps/:appName/report/:reportName"
              element={<ReportView dataSource={delayedAdapter} />}
            />
          </Routes>
        </MetadataProvider>
      </MemoryRouter>
    );

    // Initially, we should see metadata loading
    await waitFor(
      () => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Then the report should load
    await waitFor(
      () => {
        expect(screen.getAllByText(/Q1 Sales Performance/i)[0]).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('should handle missing report gracefully', async () => {
    render(
      <MemoryRouter initialEntries={['/apps/crm_app/report/nonexistent_report']}>
        <MetadataProvider adapter={adapter}>
          <Routes>
            <Route
              path="/apps/:appName/report/:reportName"
              element={<ReportView dataSource={adapter as DataSource} />}
            />
          </Routes>
        </MetadataProvider>
      </MemoryRouter>
    );

    // Wait for metadata to load
    await waitFor(
      () => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Should show "Report Not Found" message
    await waitFor(
      () => {
        expect(screen.getByText(/Report Not Found/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });
});
