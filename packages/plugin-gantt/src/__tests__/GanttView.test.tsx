/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { GanttView, type GanttTask } from '../GanttView';

const mockTasks: GanttTask[] = [
  {
    id: '1',
    title: 'Design Phase',
    start: new Date('2024-01-15'),
    end: new Date('2024-02-15'),
    progress: 75,
  },
  {
    id: '2',
    title: 'Development',
    start: new Date('2024-02-01'),
    end: new Date('2024-03-15'),
    progress: 30,
  },
];

describe('GanttView accessibility', () => {
  it('renders aria-label on navigation buttons', () => {
    render(<GanttView tasks={mockTasks} />);
    expect(screen.getByLabelText('Previous period')).toBeInTheDocument();
    expect(screen.getByLabelText('Next period')).toBeInTheDocument();
  });

  it('renders aria-label on zoom buttons', () => {
    render(<GanttView tasks={mockTasks} />);
    expect(screen.getByLabelText('Zoom out')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
  });

  it('renders aria-label on create button', () => {
    render(<GanttView tasks={mockTasks} />);
    expect(screen.getByLabelText('Create new task')).toBeInTheDocument();
  });
});

describe('GanttView mobile date badge', () => {
  it('renders date range text below task title', () => {
    render(<GanttView tasks={mockTasks} />);
    // The mobile date badge shows start → end dates
    const startDate = mockTasks[0].start.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
    const endDate = mockTasks[0].end.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
    const dateText = `${startDate} → ${endDate}`;
    expect(screen.getByText(dateText)).toBeInTheDocument();
  });

  it('renders mobile date badge with sm:hidden class', () => {
    render(<GanttView tasks={mockTasks} />);
    const startDate = mockTasks[0].start.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
    const endDate = mockTasks[0].end.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
    const dateText = `${startDate} → ${endDate}`;
    const badge = screen.getByText(dateText);
    expect(badge.className).toContain('sm:hidden');
  });
});
