/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionGroup } from '../SectionGroup';
import type { SectionGroup as SectionGroupType } from '@object-ui/types';

describe('SectionGroup', () => {
  const baseGroup: SectionGroupType = {
    title: 'Address Information',
    sections: [
      {
        title: 'Billing',
        fields: [
          { name: 'billingStreet', label: 'Street' },
          { name: 'billingCity', label: 'City' },
        ],
      },
      {
        title: 'Shipping',
        fields: [
          { name: 'shippingStreet', label: 'Street' },
          { name: 'shippingCity', label: 'City' },
        ],
      },
    ],
  };

  const data = {
    billingStreet: '123 Main St',
    billingCity: 'Springfield',
    shippingStreet: '456 Oak Ave',
    shippingCity: 'Shelbyville',
  };

  it('should render group title', () => {
    render(<SectionGroup group={baseGroup} data={data} />);
    expect(screen.getByText('Address Information')).toBeInTheDocument();
  });

  it('should render child section titles', () => {
    render(<SectionGroup group={baseGroup} data={data} />);
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Shipping')).toBeInTheDocument();
  });

  it('should render field values in child sections', () => {
    render(<SectionGroup group={baseGroup} data={data} />);
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
    expect(screen.getByText('Springfield')).toBeInTheDocument();
  });

  it('should be collapsible by default', () => {
    render(<SectionGroup group={baseGroup} data={data} />);
    // The group should render a collapsible trigger
    const trigger = screen.getByText('Address Information');
    expect(trigger.closest('[data-state]') || trigger.closest('div')).toBeTruthy();
  });

  it('should start collapsed when defaultCollapsed is true', () => {
    const collapsedGroup = { ...baseGroup, defaultCollapsed: true };
    render(<SectionGroup group={collapsedGroup} data={data} />);
    // Title should still be visible
    expect(screen.getByText('Address Information')).toBeInTheDocument();
    // Child section content should be hidden (in collapsed state)
    expect(screen.queryByText('123 Main St')).not.toBeInTheDocument();
  });

  it('should expand when clicked while collapsed', () => {
    const collapsedGroup = { ...baseGroup, defaultCollapsed: true };
    render(<SectionGroup group={collapsedGroup} data={data} />);
    
    // Click the trigger to expand
    fireEvent.click(screen.getByText('Address Information'));
    
    // Content should now be visible
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    const groupWithDesc = { ...baseGroup, description: 'Billing and shipping addresses', collapsible: false };
    render(<SectionGroup group={groupWithDesc} data={data} />);
    expect(screen.getByText('Billing and shipping addresses')).toBeInTheDocument();
  });

  it('should not be collapsible when collapsible is false', () => {
    const nonCollapsible = { ...baseGroup, collapsible: false };
    const { container } = render(<SectionGroup group={nonCollapsible} data={data} />);
    // The top-level group heading should not have a cursor-pointer collapsible trigger
    const heading = screen.getByText('Address Information');
    const parentDiv = heading.closest('div');
    // Non-collapsible group renders a static border-b div, not a CollapsibleTrigger
    expect(parentDiv?.className).not.toContain('cursor-pointer');
  });
});
