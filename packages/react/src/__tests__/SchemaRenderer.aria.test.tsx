/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer } from '../SchemaRenderer';
// No `BaseSchema` import any more: the keyed-`ariaLabel` fixture below was the
// only thing that needed it, for an `as unknown as BaseSchema` cast that
// objectui#4581 made unnecessary by declaring the vocabulary the renderer
// resolves.

// A simple test component that forwards ARIA attributes
const TestWidget: React.FC<any> = (props) => (
  <div
    data-testid="test-widget"
    aria-label={props['aria-label']}
    aria-describedby={props['aria-describedby']}
    role={props['role']}
  >
    {props.content || 'Test'}
  </div>
);

describe('SchemaRenderer AriaProps injection', () => {
  beforeEach(() => {
    ComponentRegistry.register('test-widget', TestWidget);
  });

  afterEach(() => {
    ComponentRegistry.unregister?.('test-widget');
  });

  it('should inject aria-label from ariaLabel string', () => {
    render(
      <SchemaRenderer
        schema={{
          type: 'test-widget',
          ariaLabel: 'Close dialog',
        }}
      />
    );
    const el = screen.getByTestId('test-widget');
    expect(el).toHaveAttribute('aria-label', 'Close dialog');
  });

  it('should resolve ariaLabel from a KeyedI18nLabel object', () => {
    render(
      <SchemaRenderer
        schema={{
          type: 'test-widget',
          // No cast: `BaseSchema.ariaLabel` declares `string | KeyedI18nLabel`
          // (objectui#4581), which is the vocabulary the renderer actually
          // resolves — `SchemaRenderer.tsx:111` calls `resolveKeyedI18nLabel`.
          // This fixture carried `as unknown as BaseSchema` while the
          // declaration said the narrower `string` (objectui#4548).
          ariaLabel: { key: 'dialog.close', defaultValue: 'Close dialog' },
        }}
      />
    );
    const el = screen.getByTestId('test-widget');
    expect(el).toHaveAttribute('aria-label', 'Close dialog');
  });

  it('should resolve a KeyedI18nLabel carrying params', () => {
    render(
      <SchemaRenderer
        schema={{
          type: 'test-widget',
          // `params` is the limb the withdrawn `string | I18nLabel` spelling
          // REJECTED outright (PR #4593's probe, #4580 ruling Q2-B). Without a
          // `t`, this package's resolver falls back to `defaultValue` — the
          // point here is that the shape is authorable at all.
          ariaLabel: {
            key: 'greeting.hello',
            defaultValue: 'Hello, Ada',
            params: { name: 'Ada' },
          },
        }}
      />
    );
    const el = screen.getByTestId('test-widget');
    expect(el).toHaveAttribute('aria-label', 'Hello, Ada');
  });

  it('should inject aria-describedby from ariaDescribedBy', () => {
    render(
      <SchemaRenderer
        schema={{
          type: 'test-widget',
          ariaDescribedBy: 'help-text-1',
        }}
      />
    );
    const el = screen.getByTestId('test-widget');
    expect(el).toHaveAttribute('aria-describedby', 'help-text-1');
  });

  it('should inject role from schema', () => {
    render(
      <SchemaRenderer
        schema={{
          type: 'test-widget',
          role: 'navigation',
        }}
      />
    );
    const el = screen.getByTestId('test-widget');
    expect(el).toHaveAttribute('role', 'navigation');
  });

  it('should inject all ARIA props together', () => {
    render(
      <SchemaRenderer
        schema={{
          type: 'test-widget',
          ariaLabel: 'Main nav',
          ariaDescribedBy: 'nav-desc',
          role: 'navigation',
        }}
      />
    );
    const el = screen.getByTestId('test-widget');
    expect(el).toHaveAttribute('aria-label', 'Main nav');
    expect(el).toHaveAttribute('aria-describedby', 'nav-desc');
    expect(el).toHaveAttribute('role', 'navigation');
  });

  it('should not inject ARIA attrs when not in schema', () => {
    render(
      <SchemaRenderer
        schema={{
          type: 'test-widget',
          content: 'Hello',
        }}
      />
    );
    const el = screen.getByTestId('test-widget');
    expect(el).not.toHaveAttribute('aria-label');
    expect(el).not.toHaveAttribute('aria-describedby');
  });
});
