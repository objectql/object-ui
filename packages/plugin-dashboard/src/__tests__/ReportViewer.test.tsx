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
    
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Print')).toBeInTheDocument();
  });

  it('should render loading state', () => {
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

    render(<ReportViewer schema={schema} />);
    
    expect(screen.getByText('Loading report data...')).toBeInTheDocument();
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
});
