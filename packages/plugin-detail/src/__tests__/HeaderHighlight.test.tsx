/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeaderHighlight } from '../HeaderHighlight';
import type { HighlightField } from '@object-ui/types';

describe('HeaderHighlight', () => {
  const fields: HighlightField[] = [
    { name: 'revenue', label: 'Annual Revenue' },
    { name: 'employees', label: 'Employees' },
    { name: 'industry', label: 'Industry' },
  ];

  const data = {
    revenue: '$5M',
    employees: 150,
    industry: 'Technology',
  };

  it('should render highlight fields with labels and values', () => {
    render(<HeaderHighlight fields={fields} data={data} />);
    expect(screen.getByText('Annual Revenue')).toBeInTheDocument();
    expect(screen.getByText('$5M')).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('Industry')).toBeInTheDocument();
    expect(screen.getByText('Technology')).toBeInTheDocument();
  });

  it('should not render when no data is provided', () => {
    const { container } = render(<HeaderHighlight fields={fields} />);
    expect(container.innerHTML).toBe('');
  });

  it('should not render when fields array is empty', () => {
    const { container } = render(<HeaderHighlight fields={[]} data={data} />);
    expect(container.innerHTML).toBe('');
  });

  it('should hide fields with null or empty values', () => {
    const sparseData = { revenue: '$5M', employees: null, industry: '' };
    render(<HeaderHighlight fields={fields} data={sparseData} />);
    expect(screen.getByText('$5M')).toBeInTheDocument();
    expect(screen.queryByText('Employees')).not.toBeInTheDocument();
    expect(screen.queryByText('Industry')).not.toBeInTheDocument();
  });

  it('should not render when all field values are empty', () => {
    const emptyData = { revenue: null, employees: undefined, industry: '' };
    const { container } = render(<HeaderHighlight fields={fields} data={emptyData} />);
    expect(container.innerHTML).toBe('');
  });

  it('should render icon when provided', () => {
    const fieldsWithIcon: HighlightField[] = [
      { name: 'revenue', label: 'Revenue', icon: '💰' },
    ];
    render(<HeaderHighlight fields={fieldsWithIcon} data={{ revenue: '$5M' }} />);
    expect(screen.getByText('💰')).toBeInTheDocument();
  });
});
