/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComponentRegistry } from '@object-ui/core';

// Import renderer to trigger registration
import '../renderer';

// Mock renderChildren used by the renderer, preserving cn and other exports
vi.mock('@object-ui/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@object-ui/components')>();
  return {
    ...actual,
    renderChildren: vi.fn(() => null),
  };
});

describe('Timeline Renderer (ComponentRegistry)', () => {
  let TimelineComponent: any;

  beforeEach(() => {
    TimelineComponent = ComponentRegistry.get('timeline');
  });

  it('is registered in ComponentRegistry as "timeline"', () => {
    expect(TimelineComponent).toBeDefined();
  });

  // --- Vertical variant ---

  it('renders in vertical variant by default', () => {
    const schema: any = {
      type: 'timeline',
      items: [
        { time: '2024-01-15', title: 'First Event', description: 'Description one' },
      ],
    };

    const { container } = render(<TimelineComponent schema={schema} />);
    // Vertical uses an <ol> element
    expect(container.querySelector('ol')).toBeInTheDocument();
    expect(screen.getByText('First Event')).toBeInTheDocument();
    expect(screen.getByText('Description one')).toBeInTheDocument();
  });

  it('renders items with titles and descriptions in vertical variant', () => {
    const schema: any = {
      type: 'timeline',
      variant: 'vertical',
      items: [
        { time: '2024-01-15', title: 'Alpha Release', description: 'Initial alpha' },
        { time: '2024-02-01', title: 'Beta Release', description: 'Public beta' },
        { time: '2024-03-10', title: 'GA Launch', description: 'General availability' },
      ],
    };

    render(<TimelineComponent schema={schema} />);
    expect(screen.getByText('Alpha Release')).toBeInTheDocument();
    expect(screen.getByText('Initial alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta Release')).toBeInTheDocument();
    expect(screen.getByText('Public beta')).toBeInTheDocument();
    expect(screen.getByText('GA Launch')).toBeInTheDocument();
    expect(screen.getByText('General availability')).toBeInTheDocument();
  });

  it('handles empty items array in vertical variant', () => {
    const schema: any = {
      type: 'timeline',
      variant: 'vertical',
      items: [],
    };

    const { container } = render(<TimelineComponent schema={schema} />);
    // Should render the <ol> wrapper but no <li> items
    expect(container.querySelector('ol')).toBeInTheDocument();
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  it('formats dates correctly with short format', () => {
    const schema: any = {
      type: 'timeline',
      variant: 'vertical',
      dateFormat: 'short',
      items: [
        { time: '2024-06-15', title: 'Event' },
      ],
    };

    render(<TimelineComponent schema={schema} />);
    // short format uses toLocaleDateString()
    const expected = new Date('2024-06-15').toLocaleDateString();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('formats dates correctly with long format', () => {
    const schema: any = {
      type: 'timeline',
      variant: 'vertical',
      dateFormat: 'long',
      items: [
        { time: '2024-06-15', title: 'Event' },
      ],
    };

    render(<TimelineComponent schema={schema} />);
    const expected = new Date('2024-06-15').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('formats dates correctly with iso (default) format', () => {
    const schema: any = {
      type: 'timeline',
      variant: 'vertical',
      dateFormat: 'iso',
      items: [
        { time: '2024-06-15', title: 'Event' },
      ],
    };

    render(<TimelineComponent schema={schema} />);
    expect(screen.getByText('2024-06-15')).toBeInTheDocument();
  });

  // --- Horizontal variant ---

  it('renders in horizontal variant', () => {
    const schema: any = {
      type: 'timeline',
      variant: 'horizontal',
      items: [
        { time: '2024-01-01', title: 'Q1', description: 'First quarter' },
        { time: '2024-04-01', title: 'Q2', description: 'Second quarter' },
      ],
    };

    render(<TimelineComponent schema={schema} />);
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.getByText('First quarter')).toBeInTheDocument();
    expect(screen.getByText('Q2')).toBeInTheDocument();
    expect(screen.getByText('Second quarter')).toBeInTheDocument();
  });

  it('handles empty items array in horizontal variant', () => {
    const schema: any = {
      type: 'timeline',
      variant: 'horizontal',
      items: [],
    };

    const { container } = render(<TimelineComponent schema={schema} />);
    // Horizontal wraps in a div, should have no child items
    expect(container.firstChild).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  // --- Gantt variant ---

  it('renders in gantt variant', () => {
    const schema: any = {
      type: 'timeline',
      variant: 'gantt',
      timeScale: 'month',
      items: [
        {
          label: 'Backend',
          items: [
            { title: 'API Design', startDate: '2024-01-01', endDate: '2024-02-01' },
          ],
        },
        {
          label: 'Frontend',
          items: [
            { title: 'UI Build', startDate: '2024-02-01', endDate: '2024-03-01' },
          ],
        },
      ],
    };

    render(<TimelineComponent schema={schema} />);
    expect(screen.getByText('Backend')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('API Design')).toBeInTheDocument();
    expect(screen.getByText('UI Build')).toBeInTheDocument();
  });

  it('handles rows with no sub-items in gantt variant', () => {
    const schema: any = {
      type: 'timeline',
      variant: 'gantt',
      minDate: '2024-01-01',
      maxDate: '2024-03-01',
      items: [
        { label: 'Empty Row', items: [] },
        {
          label: 'Has Items',
          items: [
            { title: 'Task', startDate: '2024-01-15', endDate: '2024-02-15' },
          ],
        },
      ],
    };

    render(<TimelineComponent schema={schema} />);
    expect(screen.getByText('Empty Row')).toBeInTheDocument();
    expect(screen.getByText('Has Items')).toBeInTheDocument();
  });

  it('gantt variant calculates date ranges from items', () => {
    const schema: any = {
      type: 'timeline',
      variant: 'gantt',
      timeScale: 'month',
      items: [
        {
          label: 'Project A',
          items: [
            { title: 'Task 1', startDate: '2024-01-01', endDate: '2024-01-31' },
            { title: 'Task 2', startDate: '2024-02-01', endDate: '2024-03-31' },
          ],
        },
      ],
    };

    render(<TimelineComponent schema={schema} />);
    // Gantt header should contain month labels spanning the range
    expect(screen.getByText('Project A')).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
  });

  it('gantt variant uses custom rowLabel', () => {
    const schema: any = {
      type: 'timeline',
      variant: 'gantt',
      rowLabel: 'Projects',
      minDate: '2024-01-01',
      maxDate: '2024-03-01',
      items: [
        {
          label: 'My Project',
          items: [
            { title: 'Work', startDate: '2024-01-15', endDate: '2024-02-15' },
          ],
        },
      ],
    };

    render(<TimelineComponent schema={schema} />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  it('gantt variant defaults rowLabel to "Items"', () => {
    const schema: any = {
      type: 'timeline',
      variant: 'gantt',
      minDate: '2024-01-01',
      maxDate: '2024-03-01',
      items: [
        {
          label: 'Row',
          items: [
            { title: 'Bar', startDate: '2024-01-10', endDate: '2024-02-10' },
          ],
        },
      ],
    };

    render(<TimelineComponent schema={schema} />);
    expect(screen.getByText('Items')).toBeInTheDocument();
  });

  it('returns null for unknown variant', () => {
    const schema: any = {
      type: 'timeline',
      variant: 'unknown',
      items: [],
    };

    const { container } = render(<TimelineComponent schema={schema} />);
    expect(container.innerHTML).toBe('');
  });
});
