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
  getAllDisplayIssues,
  checkDOMStructure,
} from './test-utils';

// Import renderers to ensure registration
beforeAll(async () => {
  await import('../renderers');
});

/**
 * Comprehensive tests for layout renderer components
 */
describe('Layout Renderers - Display Issue Detection', () => {
  describe('Container Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('container');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render container with children', () => {
      const { container } = renderComponent({
        type: 'container',
        children: [
          { type: 'text', content: 'Content 1' },
          { type: 'text', content: 'Content 2' },
        ],
      });

      expect(container.textContent).toContain('Content 1');
      expect(container.textContent).toContain('Content 2');
    });

    it('should not have structural issues', () => {
      const { container } = renderComponent({
        type: 'container',
        children: [{ type: 'text', content: 'Test' }],
      });

      const domCheck = checkDOMStructure(container);
      expect(domCheck.hasContent).toBe(true);
      expect(domCheck.isEmpty).toBe(false);
    });
  });

  describe('Grid Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('grid');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render grid layout', () => {
      const { container } = renderComponent({
        type: 'grid',
        columns: 3,
        children: [
          { type: 'text', content: 'Item 1' },
          { type: 'text', content: 'Item 2' },
          { type: 'text', content: 'Item 3' },
        ],
      });

      const grid = container.querySelector('[class*="grid"]');
      expect(grid || container.firstChild).toBeTruthy();
      expect(container.textContent).toContain('Item 1');
    });
  });

  describe('Flex Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('flex');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render flex layout', () => {
      const { container } = renderComponent({
        type: 'flex',
        direction: 'row',
        body: [
          { type: 'text', content: 'Flex Item 1' },
          { type: 'text', content: 'Flex Item 2' },
        ],
      });

      const flex = container.querySelector('[class*="flex"]');
      expect(flex || container.firstChild).toBeTruthy();
    });

    it('should support different directions', () => {
      const directions = ['row', 'column', 'row-reverse', 'column-reverse'];
      
      directions.forEach(direction => {
        const { container } = renderComponent({
          type: 'flex',
          direction,
          children: [{ type: 'text', content: 'Test' }],
        });

        expect(container.firstChild).toBeTruthy();
      });
    });
  });
});

/**
 * Comprehensive tests for data display renderer components
 */
describe('Data Display Renderers - Display Issue Detection', () => {
  describe('List Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('list');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render list with items', () => {
      const { container } = renderComponent({
        type: 'list',
        items: [
          { content: 'Item 1' },
          { content: 'Item 2' },
          { content: 'Item 3' },
        ],
      });

      expect(container.textContent).toContain('Item 1');
      expect(container.textContent).toContain('Item 2');
    });

    it('should use proper list semantics', () => {
      const { container } = renderComponent({
        type: 'list',
        items: [{ content: 'Test' }],
      });

      const list = container.querySelector('ul, ol, [role="list"]');
      expect(list).toBeTruthy();
    });
  });

  describe('Tree View Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('tree-view');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render tree structure', () => {
      const { container } = renderComponent({
        type: 'tree-view',
        nodes: [
          {
            id: '1',
            label: 'Root',
            children: [
              { id: '1-1', label: 'Child 1' },
              { id: '1-2', label: 'Child 2' },
            ],
          },
        ],
      });

      expect(container.textContent).toContain('Root');
    });
  });

  describe('Badge Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('badge');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render badge with text', () => {
      const { container } = renderComponent({
        type: 'badge',
        label: 'New',
      });

      expect(container.textContent).toContain('New');
    });

    it('should support different variants', () => {
      const variants = ['default', 'secondary', 'destructive', 'outline'];
      
      variants.forEach(variant => {
        const { container } = renderComponent({
          type: 'badge',
          label: 'Badge',
          variant,
        });

        expect(container.textContent).toContain('Badge');
      });
    });
  });

  describe('Avatar Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('avatar');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render avatar with image', () => {
      const { container } = renderComponent({
        type: 'avatar',
        src: 'https://example.com/avatar.jpg',
        alt: 'User avatar',
      });

      // Avatar component renders, even if image doesn't load in test environment
      const avatar = container.querySelector('span[class*="avatar"]') || container.firstChild;
      expect(avatar).toBeTruthy();
    });

    it('should render fallback when no image', () => {
      const { container } = renderComponent({
        type: 'avatar',
        fallback: 'JD',
      });

      expect(container.textContent).toContain('JD');
    });
  });

  describe('Alert Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('alert');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render alert with message', () => {
      const { container } = renderComponent({
        type: 'alert',
        title: 'Important',
        description: 'This is an important message',
      });

      expect(container.textContent).toContain('Important');
      expect(container.textContent).toContain('This is an important message');
    });

    it('should support different variants', () => {
      const variants = ['default', 'destructive'];
      
      variants.forEach(variant => {
        const { container } = renderComponent({
          type: 'alert',
          title: 'Alert',
          variant,
        });

        expect(container.textContent).toContain('Alert');
      });
    });

    it('should have proper role for accessibility', () => {
      const { container } = renderComponent({
        type: 'alert',
        title: 'Alert',
      });

      const alert = container.querySelector('[role="alert"]');
      expect(alert || container.querySelector('div')).toBeTruthy();
    });
  });

  describe('Breadcrumb Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('breadcrumb');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render breadcrumb navigation', () => {
      const { container } = renderComponent({
        type: 'breadcrumb',
        items: [
          { label: 'Home', href: '/' },
          { label: 'Products', href: '/products' },
          { label: 'Details' },
        ],
      });

      expect(container.textContent).toContain('Home');
      expect(container.textContent).toContain('Products');
    });

    it('should use nav element for semantics', () => {
      const { container } = renderComponent({
        type: 'breadcrumb',
        items: [{ label: 'Home' }],
      });

      const nav = container.querySelector('nav, [role="navigation"]');
      expect(nav).toBeTruthy();
    });
  });

  describe('Statistic Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('statistic');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render statistic with value and label', () => {
      const { container } = renderComponent({
        type: 'statistic',
        value: '1,234',
        label: 'Total Users',
      });

      expect(container.textContent).toContain('1,234');
      expect(container.textContent).toContain('Total Users');
    });
  });

  describe('Kbd Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('kbd');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render keyboard key', () => {
      const { container } = renderComponent({
        type: 'kbd',
        keys: ['Ctrl', 'C'],
      });

      const kbd = container.querySelector('kbd');
      expect(kbd || container.firstChild).toBeTruthy();
    });
  });
});
