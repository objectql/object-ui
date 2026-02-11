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

  it('should resolve ariaLabel from I18nLabel object', () => {
    render(
      <SchemaRenderer
        schema={{
          type: 'test-widget',
          ariaLabel: { key: 'dialog.close', defaultValue: 'Close dialog' },
        }}
      />
    );
    const el = screen.getByTestId('test-widget');
    expect(el).toHaveAttribute('aria-label', 'Close dialog');
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
