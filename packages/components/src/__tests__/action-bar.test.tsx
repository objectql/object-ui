/**
 * Tests for ActionBar (action:bar) renderer
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import { renderComponent, validateComponentRegistration } from './test-utils';

// Ensure action renderers are loaded (side-effect imports via vitest.setup.tsx)

describe('ActionBar (action:bar)', () => {
  describe('registration', () => {
    it('is registered in ComponentRegistry', () => {
      const reg = validateComponentRegistration('action:bar');
      expect(reg.isRegistered).toBe(true);
      expect(reg.hasRenderer).toBe(true);
      expect(reg.hasLabel).toBe(true);
      expect(reg.hasInputs).toBe(true);
      expect(reg.hasDefaultProps).toBe(true);
    });
  });

  describe('rendering', () => {
    it('renders nothing when actions array is empty', () => {
      const { container } = renderComponent({
        type: 'action:bar',
        actions: [],
      });
      expect(container.innerHTML).toBe('');
    });

    it('renders action buttons for provided actions', () => {
      const { container } = renderComponent({
        type: 'action:bar',
        actions: [
          { name: 'save', label: 'Save', type: 'script', component: 'action:button' },
          { name: 'cancel', label: 'Cancel', type: 'script', component: 'action:button' },
        ],
      });
      expect(container.textContent).toContain('Save');
      expect(container.textContent).toContain('Cancel');
    });

    it('renders with role="toolbar" and aria-label', () => {
      const { container } = renderComponent({
        type: 'action:bar',
        actions: [
          { name: 'test', label: 'Test', type: 'script' },
        ],
      });
      const toolbar = container.querySelector('[role="toolbar"]');
      expect(toolbar).toBeTruthy();
      expect(toolbar?.getAttribute('aria-label')).toBe('Actions');
    });

    it('filters actions by location', () => {
      const { container } = renderComponent({
        type: 'action:bar',
        location: 'list_toolbar',
        actions: [
          { name: 'toolbar_action', label: 'Toolbar Action', type: 'script', locations: ['list_toolbar'] },
          { name: 'header_action', label: 'Header Action', type: 'script', locations: ['record_header'] },
          { name: 'both_action', label: 'Both Action', type: 'script', locations: ['list_toolbar', 'record_header'] },
        ],
      });
      expect(container.textContent).toContain('Toolbar Action');
      expect(container.textContent).not.toContain('Header Action');
      expect(container.textContent).toContain('Both Action');
    });

    it('shows actions without locations when filtering by location', () => {
      const { container } = renderComponent({
        type: 'action:bar',
        location: 'record_header',
        actions: [
          { name: 'no_loc', label: 'No Location', type: 'script' },
          { name: 'has_loc', label: 'Has Location', type: 'script', locations: ['list_toolbar'] },
        ],
      });
      // Action without locations should show in any location
      expect(container.textContent).toContain('No Location');
      expect(container.textContent).not.toContain('Has Location');
    });

    it('renders all actions when no location filter is set', () => {
      const { container } = renderComponent({
        type: 'action:bar',
        actions: [
          { name: 'a1', label: 'Action 1', type: 'script', locations: ['list_toolbar'] },
          { name: 'a2', label: 'Action 2', type: 'script', locations: ['record_header'] },
        ],
      });
      expect(container.textContent).toContain('Action 1');
      expect(container.textContent).toContain('Action 2');
    });
  });

  describe('overflow', () => {
    it('groups excess actions into overflow menu when maxVisible is exceeded', () => {
      const { container } = renderComponent({
        type: 'action:bar',
        maxVisible: 2,
        actions: [
          { name: 'a1', label: 'Action 1', type: 'script' },
          { name: 'a2', label: 'Action 2', type: 'script' },
          { name: 'a3', label: 'Action 3', type: 'script' },
          { name: 'a4', label: 'Action 4', type: 'script' },
        ],
      });
      // First 2 should be visible as buttons
      expect(container.textContent).toContain('Action 1');
      expect(container.textContent).toContain('Action 2');
      // Remaining 2 should be in a dropdown (rendered as action:menu trigger)
      const toolbar = container.querySelector('[role="toolbar"]');
      expect(toolbar).toBeTruthy();
      // There should be 3 children: 2 inline buttons + 1 menu trigger
      const children = toolbar!.children;
      expect(children.length).toBe(3);
    });

    it('does not show overflow when actions fit within maxVisible', () => {
      const { container } = renderComponent({
        type: 'action:bar',
        maxVisible: 5,
        actions: [
          { name: 'a1', label: 'Action 1', type: 'script' },
          { name: 'a2', label: 'Action 2', type: 'script' },
        ],
      });
      const toolbar = container.querySelector('[role="toolbar"]');
      expect(toolbar!.children.length).toBe(2);
    });
  });

  describe('styling', () => {
    it('applies custom className', () => {
      const { container } = renderComponent({
        type: 'action:bar',
        className: 'my-custom-bar',
        actions: [
          { name: 'test', label: 'Test', type: 'script' },
        ],
      });
      const toolbar = container.querySelector('[role="toolbar"]');
      expect(toolbar?.className).toContain('my-custom-bar');
    });

    it('supports vertical direction', () => {
      const { container } = renderComponent({
        type: 'action:bar',
        direction: 'vertical',
        actions: [
          { name: 'test', label: 'Test', type: 'script' },
        ],
      });
      const toolbar = container.querySelector('[role="toolbar"]');
      expect(toolbar?.className).toContain('flex-col');
    });

    it('defaults to horizontal direction', () => {
      const { container } = renderComponent({
        type: 'action:bar',
        actions: [
          { name: 'test', label: 'Test', type: 'script' },
        ],
      });
      const toolbar = container.querySelector('[role="toolbar"]');
      expect(toolbar?.className).toContain('flex-row');
    });
  });
});
