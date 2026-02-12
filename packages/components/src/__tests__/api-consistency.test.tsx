/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P3.1 Component Quality Audit - API Consistency
 *
 * Verifies that all exported UI components follow consistent patterns:
 * - Accept className prop for customization
 * - Forward refs where applicable
 * - Support standard HTML attributes
 * - Use consistent variant/size naming via CVA
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Label,
  Separator,
  Skeleton,
  Progress,
  Alert,
  AlertTitle,
  AlertDescription,
} from '../index';

describe('P3.1 API Consistency Audit', () => {
  // ---------------------------------------------------------------
  // className override support
  // ---------------------------------------------------------------
  describe('className override support', () => {
    it('Badge accepts className', () => {
      const { container } = render(<Badge className="custom-badge">tag</Badge>);
      expect(container.firstElementChild!.className).toContain('custom-badge');
    });

    it('Button accepts className', () => {
      render(<Button className="custom-btn">Click</Button>);
      const btn = screen.getByRole('button');
      expect(btn.className).toContain('custom-btn');
    });

    it('Card accepts className', () => {
      const { container } = render(<Card className="custom-card">content</Card>);
      expect(container.firstElementChild!.className).toContain('custom-card');
    });

    it('CardHeader accepts className', () => {
      const { container } = render(<CardHeader className="custom-hdr" />);
      expect(container.firstElementChild!.className).toContain('custom-hdr');
    });

    it('CardTitle accepts className', () => {
      const { container } = render(<CardTitle className="custom-title">T</CardTitle>);
      expect(container.firstElementChild!.className).toContain('custom-title');
    });

    it('CardDescription accepts className', () => {
      const { container } = render(<CardDescription className="custom-desc">D</CardDescription>);
      expect(container.firstElementChild!.className).toContain('custom-desc');
    });

    it('CardContent accepts className', () => {
      const { container } = render(<CardContent className="custom-content" />);
      expect(container.firstElementChild!.className).toContain('custom-content');
    });

    it('CardFooter accepts className', () => {
      const { container } = render(<CardFooter className="custom-footer" />);
      expect(container.firstElementChild!.className).toContain('custom-footer');
    });

    it('Input accepts className', () => {
      render(<Input className="custom-input" data-testid="inp" />);
      expect(screen.getByTestId('inp').className).toContain('custom-input');
    });

    it('Separator accepts className', () => {
      const { container } = render(<Separator className="custom-sep" />);
      expect(container.firstElementChild!.className).toContain('custom-sep');
    });

    it('Skeleton accepts className', () => {
      const { container } = render(<Skeleton className="custom-skel" />);
      expect(container.firstElementChild!.className).toContain('custom-skel');
    });

    it('Alert accepts className', () => {
      render(<Alert className="custom-alert">hi</Alert>);
      expect(screen.getByRole('alert').className).toContain('custom-alert');
    });
  });

  // ---------------------------------------------------------------
  // Variant support
  // ---------------------------------------------------------------
  describe('variant support', () => {
    it('Badge renders default variant without explicit prop', () => {
      const { container } = render(<Badge>tag</Badge>);
      expect(container.firstElementChild!.className).toContain('bg-primary');
    });

    it('Badge renders destructive variant', () => {
      const { container } = render(<Badge variant="destructive">err</Badge>);
      expect(container.firstElementChild!.className).toContain('bg-destructive');
    });

    it('Badge renders outline variant', () => {
      const { container } = render(<Badge variant="outline">out</Badge>);
      expect(container.firstElementChild!.className).toContain('text-foreground');
    });

    it('Button renders default variant without explicit prop', () => {
      render(<Button>Click</Button>);
      expect(screen.getByRole('button').className).toContain('bg-primary');
    });

    it('Button renders destructive variant', () => {
      render(<Button variant="destructive">Del</Button>);
      expect(screen.getByRole('button').className).toContain('bg-destructive');
    });

    it('Button renders ghost variant', () => {
      render(<Button variant="ghost">G</Button>);
      expect(screen.getByRole('button').className).toContain('hover:bg-accent');
    });

    it('Button renders outline variant', () => {
      render(<Button variant="outline">O</Button>);
      expect(screen.getByRole('button').className).toContain('border');
    });

    it('Alert renders default variant', () => {
      render(<Alert>info</Alert>);
      expect(screen.getByRole('alert').className).toContain('bg-background');
    });

    it('Alert renders destructive variant', () => {
      render(<Alert variant="destructive">err</Alert>);
      expect(screen.getByRole('alert').className).toContain('border-destructive');
    });
  });

  // ---------------------------------------------------------------
  // Size variants (Button)
  // ---------------------------------------------------------------
  describe('Button size variants', () => {
    it('renders default size', () => {
      render(<Button>D</Button>);
      expect(screen.getByRole('button').className).toContain('h-10');
    });

    it('renders sm size', () => {
      render(<Button size="sm">S</Button>);
      expect(screen.getByRole('button').className).toContain('h-9');
    });

    it('renders lg size', () => {
      render(<Button size="lg">L</Button>);
      expect(screen.getByRole('button').className).toContain('h-11');
    });

    it('renders icon size', () => {
      render(<Button size="icon">I</Button>);
      expect(screen.getByRole('button').className).toContain('w-10');
    });
  });

  // ---------------------------------------------------------------
  // HTML attribute pass-through
  // ---------------------------------------------------------------
  describe('HTML attribute pass-through', () => {
    it('Button supports disabled attribute', () => {
      render(<Button disabled>Dis</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('Button supports type attribute', () => {
      render(<Button type="submit">Sub</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('Input supports placeholder', () => {
      render(<Input placeholder="Enter..." data-testid="inp" />);
      expect(screen.getByTestId('inp')).toHaveAttribute('placeholder', 'Enter...');
    });

    it('Input supports disabled', () => {
      render(<Input disabled data-testid="inp" />);
      expect(screen.getByTestId('inp')).toBeDisabled();
    });

    it('Badge supports data-* attributes', () => {
      const { container } = render(<Badge data-testid="b1">tag</Badge>);
      expect(container.querySelector('[data-testid="b1"]')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Ref forwarding
  // ---------------------------------------------------------------
  describe('ref forwarding', () => {
    it('Button forwards ref', () => {
      const ref = React.createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Ref</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it('Input forwards ref', () => {
      const ref = React.createRef<HTMLInputElement>();
      render(<Input ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('Card forwards ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Card ref={ref}>C</Card>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('Alert forwards ref', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(<Alert ref={ref}>A</Alert>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  // ---------------------------------------------------------------
  // Composition patterns (Card sub-components)
  // ---------------------------------------------------------------
  describe('Card composition pattern', () => {
    it('renders full Card composition', () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Title</CardTitle>
            <CardDescription>Description</CardDescription>
          </CardHeader>
          <CardContent>Body</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      );
      expect(container.textContent).toContain('Title');
      expect(container.textContent).toContain('Description');
      expect(container.textContent).toContain('Body');
      expect(container.textContent).toContain('Footer');
    });
  });

  // ---------------------------------------------------------------
  // Alert composition pattern
  // ---------------------------------------------------------------
  describe('Alert composition pattern', () => {
    it('renders Alert with title and description', () => {
      render(
        <Alert>
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>You can add components.</AlertDescription>
        </Alert>
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Heads up!')).toBeInTheDocument();
      expect(screen.getByText('You can add components.')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Consistent defaults
  // ---------------------------------------------------------------
  describe('consistent defaults', () => {
    it('Separator defaults to horizontal orientation', () => {
      const { container } = render(<Separator />);
      const sep = container.firstElementChild!;
      expect(sep.getAttribute('data-orientation')).toBe('horizontal');
    });

    it('Separator can be vertical', () => {
      const { container } = render(<Separator orientation="vertical" />);
      const sep = container.firstElementChild!;
      expect(sep.getAttribute('data-orientation')).toBe('vertical');
    });

    it('Progress renders with zero value by default', () => {
      render(<Progress data-testid="prog" />);
      const prog = screen.getByTestId('prog');
      expect(prog).toBeInTheDocument();
    });

    it('Progress accepts value prop', () => {
      render(<Progress value={50} data-testid="prog" />);
      expect(screen.getByTestId('prog')).toBeInTheDocument();
    });

    it('Skeleton renders as a div', () => {
      const { container } = render(<Skeleton />);
      expect(container.firstElementChild!.tagName).toBe('DIV');
      expect(container.firstElementChild!.className).toContain('animate-pulse');
    });
  });
});
