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
import { ReportBuilder } from '../ReportBuilder';
import type { ReportBuilderSchema } from '@object-ui/types';

describe('ReportBuilder', () => {
  it('should render report builder with title', () => {
    const schema: ReportBuilderSchema = {
      type: 'report-builder',
      availableFields: [],
    };

    render(<ReportBuilder schema={schema} />);
    
    expect(screen.getByText('Report Builder')).toBeInTheDocument();
    expect(screen.getByText('Configure your report settings and fields')).toBeInTheDocument();
  });

  it('should render with initial report configuration', () => {
    const schema: ReportBuilderSchema = {
      type: 'report-builder',
      report: {
        type: 'report',
        title: 'Sales Report',
        description: 'Monthly sales data',
        fields: [],
      },
      availableFields: [],
    };

    render(<ReportBuilder schema={schema} />);
    
    const titleInput = screen.getByDisplayValue('Sales Report');
    expect(titleInput).toBeInTheDocument();
    
    const descInput = screen.getByDisplayValue('Monthly sales data');
    expect(descInput).toBeInTheDocument();
  });

  it('should render save and cancel buttons', () => {
    const schema: ReportBuilderSchema = {
      type: 'report-builder',
      availableFields: [],
    };

    render(<ReportBuilder schema={schema} />);
    
    expect(screen.getByText('Save Report')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should display empty state when no fields selected', () => {
    const schema: ReportBuilderSchema = {
      type: 'report-builder',
      availableFields: [
        { name: 'revenue', label: 'Revenue', type: 'number' },
        { name: 'units', label: 'Units Sold', type: 'number' },
      ],
    };

    render(<ReportBuilder schema={schema} />);
    
    expect(screen.getByText('No fields selected. Click "Add Field" to get started.')).toBeInTheDocument();
  });

  it('should render preview section when enabled', () => {
    const schema: ReportBuilderSchema = {
      type: 'report-builder',
      availableFields: [],
      showPreview: true,
    };

    render(<ReportBuilder schema={schema} />);
    
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });
});
