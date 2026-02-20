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
import { SchemaRendererContext } from '../context/SchemaRendererContext';

// Simple test component
const TestComponent = (props: any) => (
  <div data-testid="test-component" data-disabled={props.disabled || undefined}>
    {props.content || props.label || 'Test'}
  </div>
);

describe('SchemaRenderer Expression Integration', () => {
  beforeEach(() => {
    ComponentRegistry.register('test-component', TestComponent);
  });

  afterEach(() => {
    ComponentRegistry.unregister?.('test-component');
  });

  describe('visible / hidden expressions', () => {
    it('renders when visible is true', () => {
      render(<SchemaRenderer schema={{ type: 'test-component', visible: true }} />);
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
    });

    it('does not render when visible is false', () => {
      const { container } = render(<SchemaRenderer schema={{ type: 'test-component', visible: false }} />);
      expect(container.innerHTML).toBe('');
    });

    it('evaluates visible expression string', () => {
      render(
        <SchemaRendererContext.Provider value={{ dataSource: { role: 'admin' } }}>
          <SchemaRenderer schema={{ type: 'test-component', visible: '${data.role === "admin"}' }} />
        </SchemaRendererContext.Provider>
      );
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
    });

    it('hides when visible expression evaluates to false', () => {
      const { container } = render(
        <SchemaRendererContext.Provider value={{ dataSource: { role: 'viewer' } }}>
          <SchemaRenderer schema={{ type: 'test-component', visible: '${data.role === "admin"}' }} />
        </SchemaRendererContext.Provider>
      );
      expect(container.innerHTML).toBe('');
    });

    it('hides when hidden is true', () => {
      const { container } = render(<SchemaRenderer schema={{ type: 'test-component', hidden: true }} />);
      expect(container.innerHTML).toBe('');
    });

    it('shows when hidden is false', () => {
      render(<SchemaRenderer schema={{ type: 'test-component', hidden: false }} />);
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
    });

    it('hides with hiddenOn expression', () => {
      const { container } = render(
        <SchemaRendererContext.Provider value={{ dataSource: { status: 'draft' } }}>
          <SchemaRenderer schema={{ type: 'test-component', hiddenOn: '${data.status === "draft"}' }} />
        </SchemaRendererContext.Provider>
      );
      expect(container.innerHTML).toBe('');
    });

    it('visible takes precedence over hidden', () => {
      render(<SchemaRenderer schema={{ type: 'test-component', visible: true, hidden: true }} />);
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
    });
  });

  describe('disabled expressions', () => {
    it('passes disabled=true when disabled expression is true', () => {
      render(<SchemaRenderer schema={{ type: 'test-component', disabled: true }} />);
      expect(screen.getByTestId('test-component')).toHaveAttribute('data-disabled', 'true');
    });

    it('evaluates disabled expression string', () => {
      render(
        <SchemaRendererContext.Provider value={{ dataSource: { status: 'locked' } }}>
          <SchemaRenderer schema={{ type: 'test-component', disabled: '${data.status === "locked"}' }} />
        </SchemaRendererContext.Provider>
      );
      expect(screen.getByTestId('test-component')).toHaveAttribute('data-disabled', 'true');
    });

    it('does not set disabled when expression is false', () => {
      render(
        <SchemaRendererContext.Provider value={{ dataSource: { status: 'active' } }}>
          <SchemaRenderer schema={{ type: 'test-component', disabled: '${data.status === "locked"}' }} />
        </SchemaRendererContext.Provider>
      );
      expect(screen.getByTestId('test-component')).not.toHaveAttribute('data-disabled');
    });

    it('evaluates disabledOn expression', () => {
      render(
        <SchemaRendererContext.Provider value={{ dataSource: { readOnly: true } }}>
          <SchemaRenderer schema={{ type: 'test-component', disabledOn: '${data.readOnly}' }} />
        </SchemaRendererContext.Provider>
      );
      expect(screen.getByTestId('test-component')).toHaveAttribute('data-disabled', 'true');
    });
  });

  describe('defaults', () => {
    it('renders by default when no visibility props are set', () => {
      render(<SchemaRenderer schema={{ type: 'test-component' }} />);
      expect(screen.getByTestId('test-component')).toBeInTheDocument();
    });

    it('is not disabled by default', () => {
      render(<SchemaRenderer schema={{ type: 'test-component' }} />);
      expect(screen.getByTestId('test-component')).not.toHaveAttribute('data-disabled');
    });
  });
});
