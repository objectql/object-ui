/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigRow } from '../custom/config-row';
import { SectionHeader } from '../custom/section-header';

describe('ConfigRow', () => {
  it('should render label and value', () => {
    render(<ConfigRow label="Color" value="Blue" />);
    expect(screen.getByText('Color')).toBeDefined();
    expect(screen.getByText('Blue')).toBeDefined();
  });

  it('should render as div when not clickable', () => {
    const { container } = render(<ConfigRow label="Label" value="Value" />);
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('div')).not.toBeNull();
  });

  it('should render as button when onClick is provided', () => {
    const onClick = vi.fn();
    const { container } = render(<ConfigRow label="Label" value="Value" onClick={onClick} />);
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should render children instead of value when provided', () => {
    render(
      <ConfigRow label="Custom">
        <span data-testid="custom-child">Custom Content</span>
      </ConfigRow>,
    );
    expect(screen.getByTestId('custom-child')).toBeDefined();
    expect(screen.getByText('Custom Content')).toBeDefined();
  });

  it('should apply custom className', () => {
    const { container } = render(<ConfigRow label="Label" className="custom-class" />);
    expect(container.firstElementChild?.className).toContain('custom-class');
  });
});

describe('SectionHeader', () => {
  it('should render title text', () => {
    render(<SectionHeader title="Data" />);
    expect(screen.getByText('Data')).toBeDefined();
  });

  it('should render as div when not collapsible', () => {
    const { container } = render(<SectionHeader title="Data" testId="section" />);
    const element = screen.getByTestId('section');
    expect(element.tagName).toBe('DIV');
  });

  it('should render as button when collapsible', () => {
    render(<SectionHeader title="Data" collapsible testId="section" />);
    const element = screen.getByTestId('section');
    expect(element.tagName).toBe('BUTTON');
  });

  it('should set aria-expanded when collapsible', () => {
    render(<SectionHeader title="Data" collapsible collapsed={false} testId="section" />);
    const element = screen.getByTestId('section');
    expect(element.getAttribute('aria-expanded')).toBe('true');
  });

  it('should set aria-expanded=false when collapsed', () => {
    render(<SectionHeader title="Data" collapsible collapsed testId="section" />);
    const element = screen.getByTestId('section');
    expect(element.getAttribute('aria-expanded')).toBe('false');
  });

  it('should call onToggle when collapsible button is clicked', () => {
    const onToggle = vi.fn();
    render(<SectionHeader title="Data" collapsible onToggle={onToggle} testId="section" />);
    fireEvent.click(screen.getByTestId('section'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should apply custom className', () => {
    render(<SectionHeader title="Data" collapsible className="custom-class" testId="section" />);
    const element = screen.getByTestId('section');
    expect(element.className).toContain('custom-class');
  });
});
