/**
 * Expression Visibility Tests
 *
 * Validates that expression-based visibility evaluation works correctly
 * in the console's navigation and component rendering.
 *
 * Covers:
 * - evaluateVisibility with boolean, string, and template expressions
 * - ExpressionProvider context propagation
 * - Navigation item visibility based on user role expressions
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ExpressionEvaluator } from '@object-ui/core';
import { ExpressionProvider, evaluateVisibility, useExpressionContext } from '../context/ExpressionProvider';

// ---------------------------------------------------------------------------
// evaluateVisibility unit tests
// ---------------------------------------------------------------------------

describe('evaluateVisibility', () => {
  const adminEvaluator = new ExpressionEvaluator({
    user: { name: 'Admin', email: 'admin@test.com', role: 'admin' },
    app: { name: 'crm' },
    data: { status: 'open', amount: 5000 },
  });

  const viewerEvaluator = new ExpressionEvaluator({
    user: { name: 'Viewer', email: 'viewer@test.com', role: 'viewer' },
    app: { name: 'crm' },
    data: { status: 'closed', amount: 100 },
  });

  it('returns true for undefined/null expressions', () => {
    expect(evaluateVisibility(undefined, adminEvaluator)).toBe(true);
    expect(evaluateVisibility(null as any, adminEvaluator)).toBe(true);
  });

  it('handles boolean values directly', () => {
    expect(evaluateVisibility(true, adminEvaluator)).toBe(true);
    expect(evaluateVisibility(false, adminEvaluator)).toBe(false);
  });

  it('handles string boolean values', () => {
    expect(evaluateVisibility('true', adminEvaluator)).toBe(true);
    expect(evaluateVisibility('false', adminEvaluator)).toBe(false);
  });

  it('evaluates template expressions for user role', () => {
    expect(evaluateVisibility("${user.role === 'admin'}", adminEvaluator)).toBe(true);
    expect(evaluateVisibility("${user.role === 'admin'}", viewerEvaluator)).toBe(false);
  });

  it('evaluates template expressions for data values', () => {
    expect(evaluateVisibility("${data.status === 'open'}", adminEvaluator)).toBe(true);
    expect(evaluateVisibility("${data.status === 'open'}", viewerEvaluator)).toBe(false);
  });

  it('evaluates numeric comparison expressions', () => {
    expect(evaluateVisibility('${data.amount > 1000}', adminEvaluator)).toBe(true);
    expect(evaluateVisibility('${data.amount > 1000}', viewerEvaluator)).toBe(false);
  });

  it('defaults to visible on expression evaluation error', () => {
    // Invalid expression should not crash and defaults to visible
    expect(evaluateVisibility('${invalid..syntax}', adminEvaluator)).toBe(true);
  });

  it('returns true for plain strings without template syntax', () => {
    expect(evaluateVisibility('some-string', adminEvaluator)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ExpressionProvider integration tests
// ---------------------------------------------------------------------------

describe('ExpressionProvider', () => {
  function ContextReader() {
    const ctx = useExpressionContext();
    return (
      <div>
        <span data-testid="user-role">{ctx.user.role}</span>
        <span data-testid="app-name">{ctx.app.name}</span>
        <span data-testid="has-evaluator">{ctx.evaluator ? 'yes' : 'no'}</span>
      </div>
    );
  }

  it('provides expression context to children', () => {
    render(
      <ExpressionProvider
        user={{ name: 'Test', role: 'admin' }}
        app={{ name: 'sales' }}
        data={{}}
      >
        <ContextReader />
      </ExpressionProvider>,
    );

    expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
    expect(screen.getByTestId('app-name')).toHaveTextContent('sales');
    expect(screen.getByTestId('has-evaluator')).toHaveTextContent('yes');
  });

  it('provides fallback context when used outside provider', () => {
    render(<ContextReader />);

    // Should not crash — falls back to empty context
    expect(screen.getByTestId('has-evaluator')).toHaveTextContent('yes');
  });
});

// ---------------------------------------------------------------------------
// Navigation visibility simulation
// ---------------------------------------------------------------------------

describe('Navigation item visibility', () => {
  const navItems = [
    { id: 'contacts', label: 'Contacts', type: 'object', objectName: 'contact' },
    { id: 'admin', label: 'Admin Panel', type: 'page', visible: "${user.role === 'admin'}" },
    { id: 'reports', label: 'Reports', type: 'dashboard', visible: true },
    { id: 'hidden', label: 'Hidden', type: 'page', visible: false },
    { id: 'conditional', label: 'High Value', type: 'object', visibleOn: '${data.amount > 1000}' },
  ];

  it('filters navigation items based on admin role', () => {
    const evaluator = new ExpressionEvaluator({
      user: { role: 'admin' },
      app: {},
      data: { amount: 5000 },
    });

    const visible = navItems.filter(
      (item) => evaluateVisibility((item as any).visible ?? (item as any).visibleOn, evaluator),
    );

    expect(visible.map((v) => v.id)).toEqual([
      'contacts', 'admin', 'reports', 'conditional',
    ]);
  });

  it('filters navigation items based on viewer role', () => {
    const evaluator = new ExpressionEvaluator({
      user: { role: 'viewer' },
      app: {},
      data: { amount: 500 },
    });

    const visible = navItems.filter(
      (item) => evaluateVisibility((item as any).visible ?? (item as any).visibleOn, evaluator),
    );

    expect(visible.map((v) => v.id)).toEqual([
      'contacts', 'reports',
    ]);
  });
});
