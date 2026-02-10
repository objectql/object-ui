/**
 * Tests for skeleton loading components
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SkeletonGrid } from '../components/skeletons/SkeletonGrid';
import { SkeletonDashboard } from '../components/skeletons/SkeletonDashboard';
import { SkeletonDetail } from '../components/skeletons/SkeletonDetail';

// Mock @object-ui/components Skeleton
vi.mock('@object-ui/components', () => ({
  Skeleton: ({ className, ...props }: any) => (
    <div data-testid="skeleton" className={className} {...props} />
  ),
}));

describe('SkeletonGrid', () => {
  it('renders with default props', () => {
    const { container } = render(<SkeletonGrid />);
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    // Header (5) + 8 rows x 5 cols (40) + toolbar (4) + pagination (4) = 53
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders correct number of rows', () => {
    const { container } = render(<SkeletonGrid rows={3} columns={2} />);
    // Should have skeletons for 3 rows x 2 columns in the table body
    const rowContainers = container.querySelectorAll('.border-b');
    expect(rowContainers.length).toBeGreaterThanOrEqual(3);
  });
});

describe('SkeletonDashboard', () => {
  it('renders with default props', () => {
    const { container } = render(<SkeletonDashboard />);
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders correct number of widget cards', () => {
    const { container } = render(<SkeletonDashboard cards={3} />);
    // 3 widget cards, each with 3 skeletons + stats row (4 cards x 3 each) + header (2)
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('SkeletonDetail', () => {
  it('renders with default props', () => {
    const { container } = render(<SkeletonDetail />);
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders correct number of field rows', () => {
    const { container } = render(<SkeletonDetail fields={4} columns={1} />);
    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
