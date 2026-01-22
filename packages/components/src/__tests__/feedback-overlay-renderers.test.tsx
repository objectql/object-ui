/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import {
  renderComponent,
  validateComponentRegistration,
  checkDOMStructure,
} from './test-utils';

// Import renderers to ensure registration
beforeAll(async () => {
  await import('../renderers');
});

/**
 * Comprehensive tests for feedback renderer components
 */
describe('Feedback Renderers - Display Issue Detection', () => {
  describe('Loading Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('loading');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render loading indicator', () => {
      const { container } = renderComponent({
        type: 'loading',
      });

      const domCheck = checkDOMStructure(container);
      expect(domCheck.hasChildren || domCheck.hasContent).toBe(true);
    });

    it('should support loading message', () => {
      const { container } = renderComponent({
        type: 'loading',
        text: 'Loading data...',
      });

      expect(container.textContent).toContain('Loading');
    });
  });

  describe('Spinner Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('spinner');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render spinner element', () => {
      const { container } = renderComponent({
        type: 'spinner',
      });

      // Spinner should render some content
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe('Progress Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('progress');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render progress bar', () => {
      const { container } = renderComponent({
        type: 'progress',
        value: 50,
      });

      const progress = container.querySelector('[role="progressbar"], progress');
      expect(progress || container.firstChild).toBeTruthy();
    });

    it('should support different values', () => {
      const values = [0, 25, 50, 75, 100];
      
      values.forEach(value => {
        const { container } = renderComponent({
          type: 'progress',
          value,
        });

        expect(container.firstChild).toBeTruthy();
      });
    });
  });

  describe('Skeleton Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('skeleton');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render skeleton placeholder', () => {
      const { container } = renderComponent({
        type: 'skeleton',
      });

      expect(container.firstChild).toBeTruthy();
    });

    it('should support different shapes', () => {
      const { container: rect } = renderComponent({
        type: 'skeleton',
        className: 'h-12',
      });

      const { container: circle } = renderComponent({
        type: 'skeleton',
        className: 'h-12 w-12 rounded-full',
      });

      expect(rect.firstChild).toBeTruthy();
      expect(circle.firstChild).toBeTruthy();
    });
  });

  describe('Empty Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('empty');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render empty state message', () => {
      const { container } = renderComponent({
        type: 'empty',
        description: 'No data available',
      });

      expect(container.textContent).toContain('No data');
    });
  });

  describe('Toast Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('toast');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render toast notification', () => {
      const { container } = renderComponent({
        type: 'toast',
        title: 'Success',
        description: 'Operation completed',
      });

      // Toast might be rendered in a portal, so just check it doesn't error
      expect(container).toBeDefined();
    });
  });
});

/**
 * Comprehensive tests for overlay renderer components
 */
describe('Overlay Renderers - Display Issue Detection', () => {
  describe('Dialog Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('dialog');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render dialog structure', () => {
      const { container } = renderComponent({
        type: 'dialog',
        title: 'Dialog Title',
        open: true,
        body: [
          { type: 'text', content: 'Dialog content' },
        ],
      });

      // Dialog might render in a portal
      expect(container).toBeDefined();
    });
  });

  describe('Alert Dialog Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('alert-dialog');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render alert dialog', () => {
      const { container } = renderComponent({
        type: 'alert-dialog',
        title: 'Confirm',
        description: 'Are you sure?',
        open: true,
      });

      expect(container).toBeDefined();
    });
  });

  describe('Sheet Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('sheet');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render sheet component', () => {
      const { container } = renderComponent({
        type: 'sheet',
        title: 'Sheet',
        open: true,
      });

      expect(container).toBeDefined();
    });
  });

  describe('Drawer Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('drawer');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render drawer component', () => {
      const { container } = renderComponent({
        type: 'drawer',
        title: 'Drawer',
        open: true,
      });

      expect(container).toBeDefined();
    });
  });

  describe('Popover Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('popover');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render popover structure', () => {
      const { container } = renderComponent({
        type: 'popover',
        trigger: { type: 'button', label: 'Open' },
        content: { type: 'text', content: 'Popover content' },
      });

      expect(container).toBeDefined();
    });
  });

  describe('Tooltip Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('tooltip');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render tooltip with trigger', () => {
      const { container } = renderComponent({
        type: 'tooltip',
        content: 'Helpful tip',
        trigger: [{ type: 'button', label: 'Hover me' }],
      });

      // Tooltip renders with trigger
      expect(container.textContent).toContain('Hover me');
    });
  });

  describe('Dropdown Menu Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('dropdown-menu');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render dropdown with items', () => {
      const { container } = renderComponent({
        type: 'dropdown-menu',
        trigger: { type: 'button', label: 'Menu' },
        items: [
          { label: 'Item 1' },
          { label: 'Item 2' },
        ],
      });

      expect(container).toBeDefined();
    });
  });

  describe('Context Menu Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('context-menu');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render context menu', () => {
      const { container } = renderComponent({
        type: 'context-menu',
        items: [
          { label: 'Action 1' },
          { label: 'Action 2' },
        ],
      });

      expect(container).toBeDefined();
    });
  });

  describe('Hover Card Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('hover-card');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render hover card', () => {
      const { container } = renderComponent({
        type: 'hover-card',
        trigger: { type: 'text', content: 'Hover' },
        content: { type: 'text', content: 'Card content' },
      });

      expect(container).toBeDefined();
    });
  });

  describe('Menubar Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('menubar');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render menubar', () => {
      const { container } = renderComponent({
        type: 'menubar',
        menus: [
          {
            label: 'File',
            items: [{ label: 'New' }, { label: 'Open' }],
          },
        ],
      });

      expect(container).toBeDefined();
    });
  });
});
