/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Axe-core accessibility test suite for ObjectUI Shadcn components.
 *
 * Tests core UI primitives against WCAG 2.1 AA standards using axe-core.
 * Part of Q1 2026 roadmap §1.4 Test Coverage Improvement.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import React from 'react';
import {
  Button,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Label,
  Skeleton,
} from '@object-ui/components';

/**
 * Helper to assert no axe violations.
 * Works with vitest-axe's AxeResults format.
 */
async function expectNoViolations(container: HTMLElement) {
  const results = await axe(container);
  const violations = results.violations || [];
  if (violations.length > 0) {
    const messages = violations.map(
      (v: any) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instance(s))`
    );
    throw new Error(`Expected no accessibility violations, but found ${violations.length}:\n${messages.join('\n')}`);
  }
}

describe('Accessibility — axe-core (WCAG 2.1 AA)', () => {
  it('Button should have no a11y violations', async () => {
    const { container } = render(<Button>Click me</Button>);
    await expectNoViolations(container);
  });

  it('Icon-only Button with aria-label should have no violations', async () => {
    const { container } = render(
      <Button aria-label="Close" size="icon">
        ✕
      </Button>
    );
    await expectNoViolations(container);
  });

  it('Badge should have no a11y violations', async () => {
    const { container } = render(<Badge>Status</Badge>);
    await expectNoViolations(container);
  });

  it('Card with proper heading hierarchy should have no violations', async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description text</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card content</p>
        </CardContent>
      </Card>
    );
    await expectNoViolations(container);
  });

  it('Input with associated Label should have no violations', async () => {
    const { container } = render(
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="Enter email" />
      </div>
    );
    await expectNoViolations(container);
  });

  it('Input with aria-label should have no violations', async () => {
    const { container } = render(
      <Input aria-label="Search" type="search" placeholder="Search..." />
    );
    await expectNoViolations(container);
  });

  it('Skeleton should have no a11y violations', async () => {
    const { container } = render(
      <div role="status" aria-label="Loading">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
    await expectNoViolations(container);
  });

  it('Multiple Buttons in a group should have no violations', async () => {
    const { container } = render(
      <div role="group" aria-label="Actions">
        <Button variant="default">Save</Button>
        <Button variant="outline">Cancel</Button>
        <Button variant="destructive">Delete</Button>
      </div>
    );
    await expectNoViolations(container);
  });

  it('Form with proper labels should have no violations', async () => {
    const { container } = render(
      <form aria-label="Login form">
        <div>
          <Label htmlFor="username">Username</Label>
          <Input id="username" type="text" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" />
        </div>
        <Button type="submit">Sign In</Button>
      </form>
    );
    await expectNoViolations(container);
  });
});
