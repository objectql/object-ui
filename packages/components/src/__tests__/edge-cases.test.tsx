/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * P3.1 Component Quality Audit - Edge Cases
 *
 * Tests key components with edge-case data: null/undefined children,
 * overflow text, empty content, large datasets, and special characters.
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
  CardContent,
  Input,
  Separator,
  Skeleton,
  Progress,
  Alert,
  AlertTitle,
  AlertDescription,
  Label,
} from '../index';

describe('P3.1 Edge Cases', () => {
  // ---------------------------------------------------------------
  // Null / undefined / empty children
  // ---------------------------------------------------------------
  describe('null and empty children', () => {
    it('Badge renders with empty string', () => {
      const { container } = render(<Badge>{''}</Badge>);
      expect(container.firstElementChild).toBeInTheDocument();
    });

    it('Badge renders with null child', () => {
      const { container } = render(<Badge>{null}</Badge>);
      expect(container.firstElementChild).toBeInTheDocument();
    });

    it('Badge renders with undefined child', () => {
      const { container } = render(<Badge>{undefined}</Badge>);
      expect(container.firstElementChild).toBeInTheDocument();
    });

    it('Button renders with empty string', () => {
      render(<Button>{''}</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('Card renders with no children', () => {
      const { container } = render(<Card />);
      expect(container.firstElementChild).toBeInTheDocument();
    });

    it('CardTitle renders empty', () => {
      const { container } = render(<CardTitle />);
      expect(container.firstElementChild).toBeInTheDocument();
    });

    it('Alert renders with no children', () => {
      render(<Alert />);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('AlertTitle renders with empty string', () => {
      const { container } = render(<AlertTitle>{''}</AlertTitle>);
      expect(container.firstElementChild).toBeInTheDocument();
    });

    it('AlertDescription renders with no children', () => {
      const { container } = render(<AlertDescription />);
      expect(container.firstElementChild).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Very long text / overflow
  // ---------------------------------------------------------------
  describe('overflow and long text', () => {
    const longText = 'A'.repeat(10000);

    it('Badge handles very long text without crashing', () => {
      const { container } = render(<Badge>{longText}</Badge>);
      expect(container.textContent).toHaveLength(10000);
    });

    it('Button handles very long text without crashing', () => {
      render(<Button>{longText}</Button>);
      expect(screen.getByRole('button').textContent).toHaveLength(10000);
    });

    it('CardTitle handles very long text', () => {
      const { container } = render(<CardTitle>{longText}</CardTitle>);
      expect(container.textContent).toHaveLength(10000);
    });

    it('Input handles very long value', () => {
      render(<Input defaultValue={longText} data-testid="inp" />);
      expect(screen.getByTestId('inp')).toHaveValue(longText);
    });

    it('Label handles very long text', () => {
      const { container } = render(<Label>{longText}</Label>);
      expect(container.textContent).toHaveLength(10000);
    });
  });

  // ---------------------------------------------------------------
  // Special characters / unicode / emoji
  // ---------------------------------------------------------------
  describe('special characters and unicode', () => {
    it('Badge renders emoji', () => {
      const { container } = render(<Badge>🚀🎉✨</Badge>);
      expect(container.textContent).toBe('🚀🎉✨');
    });

    it('Button renders RTL text', () => {
      render(<Button>مرحبا</Button>);
      expect(screen.getByRole('button').textContent).toBe('مرحبا');
    });

    it('CardTitle renders HTML entities as text', () => {
      const { container } = render(<CardTitle>{'<script>alert("xss")</script>'}</CardTitle>);
      expect(container.textContent).toBe('<script>alert("xss")</script>');
      expect(container.querySelector('script')).toBeNull();
    });

    it('Input handles emoji value', () => {
      render(<Input defaultValue="Hello 🌍" data-testid="inp" />);
      expect(screen.getByTestId('inp')).toHaveValue('Hello 🌍');
    });

    it('Alert handles multi-language text', () => {
      render(
        <Alert>
          <AlertTitle>日本語タイトル</AlertTitle>
          <AlertDescription>中文描述 и русский текст</AlertDescription>
        </Alert>
      );
      expect(screen.getByText('日本語タイトル')).toBeInTheDocument();
      expect(screen.getByText('中文描述 и русский текст')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Numeric edge cases
  // ---------------------------------------------------------------
  describe('numeric edge cases', () => {
    it('Progress handles value of 0', () => {
      render(<Progress value={0} data-testid="prog" />);
      expect(screen.getByTestId('prog')).toBeInTheDocument();
    });

    it('Progress handles value of 100', () => {
      render(<Progress value={100} data-testid="prog" />);
      expect(screen.getByTestId('prog')).toBeInTheDocument();
    });

    it('Progress handles negative value gracefully', () => {
      render(<Progress value={-10} data-testid="prog" />);
      expect(screen.getByTestId('prog')).toBeInTheDocument();
    });

    it('Progress handles value > 100 gracefully', () => {
      render(<Progress value={200} data-testid="prog" />);
      expect(screen.getByTestId('prog')).toBeInTheDocument();
    });

    it('Progress handles undefined value', () => {
      render(<Progress value={undefined} data-testid="prog" />);
      expect(screen.getByTestId('prog')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------
  // Multiple instances
  // ---------------------------------------------------------------
  describe('multiple component instances', () => {
    it('renders many Badges without interference', () => {
      const { container } = render(
        <div>
          {Array.from({ length: 100 }, (_, i) => (
            <Badge key={i}>Badge {i}</Badge>
          ))}
        </div>
      );
      const badges = container.querySelectorAll('[class*="inline-flex"]');
      expect(badges.length).toBe(100);
    });

    it('renders many Buttons without interference', () => {
      render(
        <div>
          {Array.from({ length: 50 }, (_, i) => (
            <Button key={i}>Btn {i}</Button>
          ))}
        </div>
      );
      expect(screen.getAllByRole('button')).toHaveLength(50);
    });

    it('renders many Inputs without interference', () => {
      render(
        <div>
          {Array.from({ length: 50 }, (_, i) => (
            <Input key={i} data-testid={`inp-${i}`} defaultValue={`val-${i}`} />
          ))}
        </div>
      );
      expect(screen.getByTestId('inp-0')).toHaveValue('val-0');
      expect(screen.getByTestId('inp-49')).toHaveValue('val-49');
    });
  });

  // ---------------------------------------------------------------
  // Separator edge cases
  // ---------------------------------------------------------------
  describe('Separator edge cases', () => {
    it('renders multiple separators', () => {
      const { container } = render(
        <div>
          <Separator />
          <Separator />
          <Separator />
        </div>
      );
      expect(container.querySelectorAll('[data-orientation]')).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------
  // Skeleton edge cases
  // ---------------------------------------------------------------
  describe('Skeleton edge cases', () => {
    it('renders with custom dimensions via className', () => {
      const { container } = render(<Skeleton className="w-[200px] h-[20px]" />);
      expect(container.firstElementChild!.className).toContain('w-[200px]');
      expect(container.firstElementChild!.className).toContain('h-[20px]');
    });

    it('renders with children', () => {
      const { container } = render(<Skeleton>Loading...</Skeleton>);
      expect(container.textContent).toBe('Loading...');
    });
  });

  // ---------------------------------------------------------------
  // Card with complex nested content
  // ---------------------------------------------------------------
  describe('Card with complex nested content', () => {
    it('renders deeply nested structure', () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>
              <Badge>New</Badge> Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Button>Action 1</Button>
              <Button>Action 2</Button>
            </div>
          </CardContent>
        </Card>
      );
      expect(container.textContent).toContain('New');
      expect(container.textContent).toContain('Dashboard');
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });
  });
});
