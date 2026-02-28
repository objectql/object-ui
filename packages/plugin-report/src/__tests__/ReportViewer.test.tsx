/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReportViewer } from '../ReportViewer';
import { formatValue } from '../formatValue';
import type { ReportViewerSchema } from '@object-ui/types';

describe('ReportViewer', () => {
  it('should render empty state when no report is provided', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
    };

    render(<ReportViewer schema={schema} />);
    
    expect(screen.getByText('No report to display')).toBeInTheDocument();
  });

  it('should render report with title and description', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'Sales Report',
        description: 'Monthly sales analysis',
        fields: [],
        sections: [],
      },
      showToolbar: true,
    };

    render(<ReportViewer schema={schema} />);
    
    expect(screen.getByText('Sales Report')).toBeInTheDocument();
    expect(screen.getByText('Monthly sales analysis')).toBeInTheDocument();
  });

  it('should render export and print buttons when enabled', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'Test Report',
        showExportButtons: true,
        fields: [],
        sections: [],
      },
      showToolbar: true,
      allowExport: true,
      allowPrint: true,
    };

    render(<ReportViewer schema={schema} />);
    
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('Print')).toBeInTheDocument();
  });

  it('should render skeleton loading state', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'Test Report',
        fields: [],
        sections: [],
      },
      loading: true,
    };

    const { container } = render(<ReportViewer schema={schema} />);
    
    // Skeleton elements should be rendered (animate-pulse class from Skeleton component)
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render report data in table when no sections defined', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'User Report',
        fields: [
          { name: 'name', label: 'Name' },
          { name: 'email', label: 'Email' },
        ],
      },
      data: [
        { name: 'John Doe', email: 'john@example.com' },
        { name: 'Jane Smith', email: 'jane@example.com' },
      ],
    };

    render(<ReportViewer schema={schema} />);
    
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('should format numbers with thousand separators in table', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'Sales Report',
        fields: [
          { name: 'deal', label: 'Deal' },
          { name: 'amount', label: 'Amount', type: 'number' },
        ],
      },
      data: [
        { deal: 'Big Deal', amount: 150000 },
      ],
    };

    render(<ReportViewer schema={schema} />);
    
    expect(screen.getByText('150,000')).toBeInTheDocument();
  });

  it('should format dates in table cells', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'Sales Report',
        fields: [
          { name: 'deal', label: 'Deal' },
          { name: 'closeDate', label: 'Close Date', type: 'date' },
        ],
      },
      data: [
        { deal: 'Big Deal', closeDate: '2024-01-15T00:00:00.000Z' },
      ],
    };

    render(<ReportViewer schema={schema} />);
    
    expect(screen.getByText('2024-01-15')).toBeInTheDocument();
  });

  it('should render badge for fields with renderAs=badge', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'Pipeline Report',
        fields: [
          { name: 'deal', label: 'Deal' },
          { name: 'stage', label: 'Stage', renderAs: 'badge', colorMap: { 'Closed Won': 'bg-green-100 text-green-800' } },
        ],
      },
      data: [
        { deal: 'Big Deal', stage: 'Closed Won' },
      ],
    };

    render(<ReportViewer schema={schema} />);
    
    const badge = screen.getByText('Closed Won');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('bg-green-100');
  });

  it('should format summary card values', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'Sales Report',
        fields: [
          { name: 'amount', label: 'Amount', type: 'number', aggregation: 'sum', showInSummary: true },
        ],
        sections: [
          { type: 'summary', title: 'Key Metrics' },
        ],
      },
      data: [
        { amount: 150000 },
        { amount: 502000 },
      ],
    };

    render(<ReportViewer schema={schema} />);
    
    // 150000 + 502000 = 652000 → "652,000"
    expect(screen.getByText('652,000')).toBeInTheDocument();
  });

  it('should right-align number columns in table', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'Sales Report',
        fields: [],
        sections: [
          {
            type: 'table',
            title: 'Details',
            columns: [
              { name: 'deal', label: 'Deal' },
              { name: 'amount', label: 'Amount', type: 'number' },
            ],
          },
        ],
      },
      data: [
        { deal: 'Deal A', amount: 1000 },
      ],
    };

    const { container } = render(<ReportViewer schema={schema} />);
    
    const headerCells = container.querySelectorAll('th');
    // The "Amount" header should have text-right class
    expect(headerCells[1].className).toContain('text-right');
  });

  it('should not duplicate title for header sections', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'Sales Report',
        fields: [],
        sections: [
          { type: 'header', title: 'Report Header' },
        ],
      },
      showToolbar: false,
    };

    const { container } = render(<ReportViewer schema={schema} />);
    
    // Header title should appear once (as the header section content), not twice
    const headerElements = screen.getAllByText('Report Header');
    expect(headerElements).toHaveLength(1);
  });

  it('should add hover and zebra stripe classes to table rows', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'Test Report',
        fields: [
          { name: 'name', label: 'Name' },
        ],
      },
      data: [
        { name: 'Row 1' },
        { name: 'Row 2' },
      ],
    };

    const { container } = render(<ReportViewer schema={schema} />);
    
    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0].className).toContain('hover:bg-muted/50');
    expect(rows[0].className).toContain('even:bg-muted/20');
  });

  it('should have overflow-x-auto on table container', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'Test Report',
        fields: [
          { name: 'name', label: 'Name' },
        ],
      },
      data: [
        { name: 'Row 1' },
      ],
    };

    const { container } = render(<ReportViewer schema={schema} />);
    
    const tableContainer = container.querySelector('.overflow-x-auto');
    expect(tableContainer).toBeInTheDocument();
  });

  it('should render grouped table with group headers when groupBy is configured', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'Grouped Report',
        fields: [
          { name: 'name', label: 'Name' },
          { name: 'region', label: 'Region' },
          { name: 'amount', label: 'Amount', type: 'number' },
        ],
        groupBy: [
          { field: 'region', sort: 'asc' },
        ],
        sections: [
          {
            type: 'table',
            title: 'Details',
            columns: [
              { name: 'name', label: 'Name' },
              { name: 'region', label: 'Region' },
              { name: 'amount', label: 'Amount', type: 'number' },
            ],
          },
        ],
      },
      data: [
        { name: 'Deal A', region: 'East', amount: 100 },
        { name: 'Deal B', region: 'West', amount: 200 },
        { name: 'Deal C', region: 'East', amount: 300 },
      ],
    };

    render(<ReportViewer schema={schema} />);

    // Should render group headers
    expect(screen.getByText('region: East (2)')).toBeInTheDocument();
    expect(screen.getByText('region: West (1)')).toBeInTheDocument();
    // Data rows should still be present
    expect(screen.getByText('Deal A')).toBeInTheDocument();
    expect(screen.getByText('Deal B')).toBeInTheDocument();
    expect(screen.getByText('Deal C')).toBeInTheDocument();
  });

  it('should render table without grouping when groupBy is empty', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'Flat Report',
        fields: [
          { name: 'name', label: 'Name' },
        ],
        groupBy: [],
        sections: [
          {
            type: 'table',
            title: 'Details',
            columns: [
              { name: 'name', label: 'Name' },
            ],
          },
        ],
      },
      data: [
        { name: 'Item 1' },
        { name: 'Item 2' },
      ],
    };

    const { container } = render(<ReportViewer schema={schema} />);

    // Should render rows without group headers
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    // No group header rows (rows with bg-muted/60)
    const groupHeaders = container.querySelectorAll('.bg-muted\\/60');
    expect(groupHeaders).toHaveLength(0);
  });

  it('should apply conditional formatting styles to table cells', () => {
    const schema: ReportViewerSchema = {
      type: 'report-viewer',
      report: {
        type: 'report',
        title: 'CF Report',
        fields: [
          { name: 'name', label: 'Name' },
          { name: 'status', label: 'Status' },
        ],
        conditionalFormatting: [
          { field: 'status', operator: 'equals', value: 'Won', backgroundColor: '#bbf7d0' },
        ] as any,
        sections: [
          {
            type: 'table',
            title: 'Details',
            columns: [
              { name: 'name', label: 'Name' },
              { name: 'status', label: 'Status' },
            ],
          },
        ],
      },
      data: [
        { name: 'Deal A', status: 'Won' },
        { name: 'Deal B', status: 'Lost' },
      ],
    };

    const { container } = render(<ReportViewer schema={schema} />);
    // The cell with 'Won' should have a green background
    const cells = container.querySelectorAll('td');
    const wonCell = Array.from(cells).find((td) => td.textContent === 'Won');
    expect(wonCell).toBeDefined();
    expect(wonCell?.style.backgroundColor).toBe('rgb(187, 247, 208)');

    // The cell with 'Lost' should NOT have background styling
    const lostCell = Array.from(cells).find((td) => td.textContent === 'Lost');
    expect(lostCell?.style.backgroundColor).toBe('');
  });
});

describe('formatValue', () => {
  it('should return empty string for null/undefined', () => {
    expect(formatValue(null)).toBe('');
    expect(formatValue(undefined)).toBe('');
    expect(formatValue('')).toBe('');
  });

  it('should format numbers with thousand separators', () => {
    expect(formatValue(652000, { name: 'amount', type: 'number' })).toBe('652,000');
    expect(formatValue(1234567, { name: 'amount', type: 'number' })).toBe('1,234,567');
  });

  it('should format currency values', () => {
    expect(formatValue(652000, { name: 'amount', type: 'number', format: 'currency' })).toBe('¥652,000');
    expect(formatValue(1234, { name: 'amount', type: 'number', format: 'currency_usd' })).toBe('$1,234');
  });

  it('should format percentage values', () => {
    expect(formatValue(85.5, { name: 'rate', type: 'number', format: 'percent' })).toBe('85.5%');
  });

  it('should format ISO date strings', () => {
    expect(formatValue('2024-01-15T00:00:00.000Z', { name: 'date', type: 'date' })).toBe('2024-01-15');
  });

  it('should auto-detect ISO date strings even without type hint', () => {
    expect(formatValue('2024-01-15T00:00:00.000Z')).toBe('2024-01-15');
  });

  it('should return string as-is for plain text', () => {
    expect(formatValue('Hello World', { name: 'text', type: 'string' })).toBe('Hello World');
  });

  it('should format numeric values even without type hint', () => {
    expect(formatValue(1500)).toBe('1,500');
  });
});
