/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ResponsiveContainer } from '../ResponsiveContainer';

describe('ResponsiveContainer', () => {
  it('renders children by default', () => {
    render(
      <ResponsiveContainer>
        <span data-testid="content">Hello</span>
      </ResponsiveContainer>,
    );
    expect(screen.getByTestId('content')).toBeTruthy();
  });

  it('hides children when current breakpoint is in hideOn', () => {
    // In happy-dom, default width is 1024 which is 'lg'
    render(
      <ResponsiveContainer hideOn={['lg']}>
        <span data-testid="content">Hidden</span>
      </ResponsiveContainer>,
    );
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('shows fallback when hidden', () => {
    render(
      <ResponsiveContainer hideOn={['lg']} fallback={<span data-testid="fallback">Mobile Only</span>}>
        <span data-testid="content">Desktop</span>
      </ResponsiveContainer>,
    );
    expect(screen.queryByTestId('content')).toBeNull();
    expect(screen.getByTestId('fallback')).toBeTruthy();
  });

  it('shows children when showOn includes current breakpoint', () => {
    render(
      <ResponsiveContainer showOn={['lg']}>
        <span data-testid="content">Desktop Only</span>
      </ResponsiveContainer>,
    );
    expect(screen.getByTestId('content')).toBeTruthy();
  });

  it('hides children when showOn does not include current breakpoint', () => {
    render(
      <ResponsiveContainer showOn={['xs']}>
        <span data-testid="content">Mobile Only</span>
      </ResponsiveContainer>,
    );
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('hides children when below minBreakpoint', () => {
    // 'lg' is 1024, '2xl' is 1536 - in happy-dom window is 1024 so not above 2xl
    render(
      <ResponsiveContainer minBreakpoint="2xl">
        <span data-testid="content">Large Only</span>
      </ResponsiveContainer>,
    );
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('shows children when above minBreakpoint', () => {
    render(
      <ResponsiveContainer minBreakpoint="sm">
        <span data-testid="content">Above SM</span>
      </ResponsiveContainer>,
    );
    expect(screen.getByTestId('content')).toBeTruthy();
  });
});
