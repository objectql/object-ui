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
import { MetricCard } from '../MetricCard';

describe('MetricCard', () => {
  it('should render metric card with title and value', () => {
    render(<MetricCard title="Total Users" value="1,234" />);
    
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
  });

  it('should render trend indicator when trend is provided', () => {
    render(
      <MetricCard
        title="Revenue"
        value="$45,231"
        trend="up"
        trendValue="+12%"
        description="vs last month"
      />
    );
    
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('$45,231')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('should render description without trend', () => {
    render(
      <MetricCard
        title="Active Sessions"
        value="432"
        description="current users online"
      />
    );
    
    expect(screen.getByText('Active Sessions')).toBeInTheDocument();
    expect(screen.getByText('432')).toBeInTheDocument();
    expect(screen.getByText('current users online')).toBeInTheDocument();
  });

  it('should handle numeric values', () => {
    render(<MetricCard title="Count" value={1234} />);
    
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('1234')).toBeInTheDocument();
  });
});
