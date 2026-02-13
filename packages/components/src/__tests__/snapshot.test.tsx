/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Snapshot Tests — Critical UI Components
 *
 * Captures render snapshots of Button, Badge, Card, Empty, and Spinner
 * with all major variant permutations to detect unintended visual regressions.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
  Spinner,
} from '../index';

// ─── Button Snapshots ───────────────────────────────────────────────────

describe('Button snapshots', () => {
  const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;

  variants.forEach((variant) => {
    it(`renders variant="${variant}"`, () => {
      const { container } = render(
        <Button variant={variant}>Click me</Button>,
      );
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  it('renders disabled state', () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders size="sm"', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders size="lg"', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders size="icon"', () => {
    const { container } = render(
      <Button size="icon" aria-label="Icon button">
        ★
      </Button>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ─── Badge Snapshots ────────────────────────────────────────────────────

describe('Badge snapshots', () => {
  const variants = ['default', 'secondary', 'destructive', 'outline'] as const;

  variants.forEach((variant) => {
    it(`renders variant="${variant}"`, () => {
      const { container } = render(
        <Badge variant={variant}>Label</Badge>,
      );
      expect(container.firstChild).toMatchSnapshot();
    });
  });

  it('renders with custom className', () => {
    const { container } = render(
      <Badge className="custom-class">Custom</Badge>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ─── Card Snapshots ─────────────────────────────────────────────────────

describe('Card snapshots', () => {
  it('renders with header, content, and footer', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>A brief description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card body content</p>
        </CardContent>
        <CardFooter>
          <Button>Action</Button>
        </CardFooter>
      </Card>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders header-only card', () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Minimal Card</CardTitle>
        </CardHeader>
      </Card>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders content-only card', () => {
    const { container } = render(
      <Card>
        <CardContent>Just content</CardContent>
      </Card>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders with custom className', () => {
    const { container } = render(
      <Card className="w-96 shadow-lg">
        <CardContent>Styled card</CardContent>
      </Card>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ─── Empty State Snapshots ──────────────────────────────────────────────

describe('Empty state snapshots', () => {
  it('renders full empty state with media, title, description, and content', () => {
    const { container } = render(
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <span>📭</span>
          </EmptyMedia>
          <EmptyTitle>No results found</EmptyTitle>
          <EmptyDescription>
            Try adjusting your search or filter criteria.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline">Clear filters</Button>
        </EmptyContent>
      </Empty>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders minimal empty state with title only', () => {
    const { container } = render(
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Nothing here yet</EmptyTitle>
        </EmptyHeader>
      </Empty>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders empty media with default variant', () => {
    const { container } = render(
      <EmptyMedia>
        <span>🔍</span>
      </EmptyMedia>,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

// ─── Spinner Snapshots ──────────────────────────────────────────────────

describe('Spinner snapshots', () => {
  it('renders default spinner', () => {
    const { container } = render(<Spinner />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders with custom className', () => {
    const { container } = render(<Spinner className="h-8 w-8" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
