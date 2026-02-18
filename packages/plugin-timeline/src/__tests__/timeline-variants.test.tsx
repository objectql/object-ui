/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  Timeline,
  TimelineItem,
  TimelineMarker,
  timelineItemVariants,
  timelineMarkerVariants,
} from '../index';

describe('TimelineItem density variants', () => {
  it('renders with default density (mb-10)', () => {
    const { container } = render(
      <Timeline>
        <TimelineItem data-testid="item">Content</TimelineItem>
      </Timeline>
    );
    const item = container.querySelector('li');
    expect(item?.className).toContain('mb-10');
    expect(item?.className).toContain('ml-6');
  });

  it('renders with compact density (mb-3)', () => {
    const { container } = render(
      <Timeline>
        <TimelineItem density="compact">Content</TimelineItem>
      </Timeline>
    );
    const item = container.querySelector('li');
    expect(item?.className).toContain('mb-3');
    expect(item?.className).toContain('ml-6');
  });

  it('renders with comfortable density (mb-6)', () => {
    const { container } = render(
      <Timeline>
        <TimelineItem density="comfortable">Content</TimelineItem>
      </Timeline>
    );
    const item = container.querySelector('li');
    expect(item?.className).toContain('mb-6');
    expect(item?.className).toContain('ml-6');
  });

  it('allows className override', () => {
    const { container } = render(
      <Timeline>
        <TimelineItem density="compact" className="custom-class">Content</TimelineItem>
      </Timeline>
    );
    const item = container.querySelector('li');
    expect(item?.className).toContain('custom-class');
    expect(item?.className).toContain('mb-3');
  });

  it('cva function produces expected classes', () => {
    expect(timelineItemVariants({ density: 'default' })).toContain('mb-10');
    expect(timelineItemVariants({ density: 'compact' })).toContain('mb-3');
    expect(timelineItemVariants({ density: 'comfortable' })).toContain('mb-6');
  });
});

describe('TimelineMarker semantic color variants', () => {
  it('renders with default variant', () => {
    const { container } = render(<TimelineMarker />);
    const marker = container.firstChild as HTMLElement;
    expect(marker.className).toContain('bg-blue-200');
    expect(marker.className).toContain('border-blue-400');
  });

  it('renders with success variant', () => {
    const { container } = render(<TimelineMarker variant="success" />);
    const marker = container.firstChild as HTMLElement;
    expect(marker.className).toContain('bg-emerald-200');
    expect(marker.className).toContain('border-emerald-500');
  });

  it('renders with warning variant', () => {
    const { container } = render(<TimelineMarker variant="warning" />);
    const marker = container.firstChild as HTMLElement;
    expect(marker.className).toContain('bg-amber-200');
    expect(marker.className).toContain('border-amber-500');
  });

  it('renders with danger variant', () => {
    const { container } = render(<TimelineMarker variant="danger" />);
    const marker = container.firstChild as HTMLElement;
    expect(marker.className).toContain('bg-red-200');
    expect(marker.className).toContain('border-red-500');
  });

  it('renders with info variant', () => {
    const { container } = render(<TimelineMarker variant="info" />);
    const marker = container.firstChild as HTMLElement;
    expect(marker.className).toContain('bg-purple-200');
    expect(marker.className).toContain('border-purple-500');
  });

  it('renders with todo status variant', () => {
    const { container } = render(<TimelineMarker variant="todo" />);
    const marker = container.firstChild as HTMLElement;
    expect(marker.className).toContain('bg-slate-200');
    expect(marker.className).toContain('border-slate-400');
  });

  it('renders with in-progress status variant', () => {
    const { container } = render(<TimelineMarker variant="in-progress" />);
    const marker = container.firstChild as HTMLElement;
    expect(marker.className).toContain('bg-blue-200');
    expect(marker.className).toContain('border-blue-500');
  });

  it('renders with done status variant', () => {
    const { container } = render(<TimelineMarker variant="done" />);
    const marker = container.firstChild as HTMLElement;
    expect(marker.className).toContain('bg-emerald-200');
    expect(marker.className).toContain('border-emerald-500');
  });

  it('cva function produces expected classes for status variants', () => {
    expect(timelineMarkerVariants({ variant: 'todo' })).toContain('bg-slate-200');
    expect(timelineMarkerVariants({ variant: 'in-progress' })).toContain('bg-blue-200');
    expect(timelineMarkerVariants({ variant: 'done' })).toContain('bg-emerald-200');
  });

  it('applies common base classes', () => {
    const { container } = render(<TimelineMarker variant="default" />);
    const marker = container.firstChild as HTMLElement;
    expect(marker.className).toContain('rounded-full');
    expect(marker.className).toContain('border-2');
    expect(marker.className).toContain('absolute');
  });

  it('allows className override', () => {
    const { container } = render(<TimelineMarker variant="success" className="extra-class" />);
    const marker = container.firstChild as HTMLElement;
    expect(marker.className).toContain('extra-class');
    expect(marker.className).toContain('bg-emerald-200');
  });
});
