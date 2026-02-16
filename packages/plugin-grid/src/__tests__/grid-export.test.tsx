/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Phase 10 - Grid Export Tests
 *
 * Tests the CSV/JSON export functionality on ObjectGrid component.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';

registerAllFields();

afterEach(() => {
  vi.clearAllMocks();
});

const sampleData = [
  { _id: '1', name: 'Alice', email: 'alice@example.com', status: 'Active' },
  { _id: '2', name: 'Bob', email: 'bob@example.com', status: 'Inactive' },
  { _id: '3', name: 'Charlie', email: 'charlie@example.com', status: 'Active' },
];

describe('Phase 10 - Grid Export', () => {
  it('does not render export button when exportOptions is not configured', () => {
    render(
      <ObjectGrid
        schema={{
          type: 'object-grid',
          objectName: 'contacts',
          data: sampleData,
          columns: ['name', 'email', 'status'],
        }}
      />
    );

    expect(screen.queryByText('Export')).not.toBeInTheDocument();
  });

  it('renders export button when exportOptions is configured', async () => {
    render(
      <ObjectGrid
        schema={{
          type: 'object-grid',
          objectName: 'contacts',
          data: sampleData,
          columns: ['name', 'email', 'status'],
          exportOptions: {
            formats: ['csv', 'json'],
          },
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument();
    });
  });

  it('shows format options when export button is clicked', async () => {
    render(
      <ObjectGrid
        schema={{
          type: 'object-grid',
          objectName: 'contacts',
          data: sampleData,
          columns: ['name', 'email', 'status'],
          exportOptions: {
            formats: ['csv', 'json'],
          },
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => {
      expect(screen.getByText('Export as CSV')).toBeInTheDocument();
      expect(screen.getByText('Export as JSON')).toBeInTheDocument();
    });
  });

  it('defaults to csv and json formats when formats not specified', async () => {
    render(
      <ObjectGrid
        schema={{
          type: 'object-grid',
          objectName: 'contacts',
          data: sampleData,
          columns: ['name', 'email', 'status'],
          exportOptions: {},
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => {
      expect(screen.getByText('Export as CSV')).toBeInTheDocument();
      expect(screen.getByText('Export as JSON')).toBeInTheDocument();
    });
  });
});
