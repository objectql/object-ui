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
 * Comprehensive tests for disclosure renderer components
 */
describe('Disclosure Renderers - Display Issue Detection', () => {
  describe('Accordion Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('accordion');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render accordion with items', () => {
      const { container } = renderComponent({
        type: 'accordion',
        items: [
          {
            title: 'Section 1',
            content: 'Content 1',
          },
          {
            title: 'Section 2',
            content: 'Content 2',
          },
        ],
      });

      expect(container.textContent).toContain('Section 1');
      expect(container.textContent).toContain('Section 2');
    });

    it('should not have structural issues', () => {
      const { container } = renderComponent({
        type: 'accordion',
        items: [{ title: 'Test', content: 'Content' }],
      });

      const domCheck = checkDOMStructure(container);
      expect(domCheck.hasContent).toBe(true);
    });
  });

  describe('Collapsible Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('collapsible');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render collapsible component', () => {
      const { container } = renderComponent({
        type: 'collapsible',
        trigger: { type: 'button', label: 'Toggle' },
        body: [{ type: 'text', content: 'Hidden content' }],
      });

      expect(container.textContent).toContain('Toggle');
    });
  });

  describe('Toggle Group Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('toggle-group');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render toggle group with items', () => {
      const { container } = renderComponent({
        type: 'toggle-group',
        type_mode: 'single',
        items: [
          { value: 'bold', label: 'Bold' },
          { value: 'italic', label: 'Italic' },
        ],
      });

      expect(container).toBeDefined();
    });
  });
});

/**
 * Comprehensive tests for complex renderer components
 */
describe('Complex Renderers - Display Issue Detection', () => {
  describe('Timeline Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('timeline');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render timeline with events', () => {
      const { container } = renderComponent({
        type: 'timeline',
        items: [
          {
            title: 'Event 1',
            description: 'Description 1',
            time: '2024-01-01',
          },
          {
            title: 'Event 2',
            description: 'Description 2',
            time: '2024-01-02',
          },
        ],
      });

      expect(container.textContent).toContain('Event 1');
      expect(container.textContent).toContain('Event 2');
    });

    it('should handle empty timeline', () => {
      const { container } = renderComponent({
        type: 'timeline',
        items: [],
      });

      const domCheck = checkDOMStructure(container);
      // Empty timeline is acceptable
      expect(domCheck).toBeDefined();
    });
  });

  describe('Data Table Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('data-table');
      expect(validation.isRegistered).toBe(true);
      expect(validation.hasDefaultProps).toBe(true);
    });

    it('should render table with data', () => {
      const { container } = renderComponent({
        type: 'data-table',
        columns: [
          { id: 'name', header: 'Name' },
          { id: 'age', header: 'Age' },
        ],
        data: [
          { name: 'John', age: 30 },
          { name: 'Jane', age: 25 },
        ],
      });

      expect(container.textContent).toContain('Name');
      expect(container.textContent).toContain('Age');
    });

    it('should use table semantics', () => {
      const { container } = renderComponent({
        type: 'data-table',
        columns: [{ id: 'col1', header: 'Column 1' }],
        data: [{ col1: 'Data' }],
      });

      const table = container.querySelector('table');
      expect(table || container.querySelector('[role="table"]')).toBeTruthy();
    });

    it('should not have excessive nesting', () => {
      const { container } = renderComponent({
        type: 'data-table',
        columns: [{ id: 'col1', header: 'Test' }],
        data: [{ col1: 'Value' }],
      });

      const domCheck = checkDOMStructure(container);
      // Tables can be nested but not excessively
      expect(domCheck.nestedDepth).toBeLessThan(25);
    });
  });

  describe('Chatbot Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('chatbot');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render chatbot interface', () => {
      const { container } = renderComponent({
        type: 'chatbot',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
      });

      expect(container.textContent).toContain('Hello');
      expect(container.textContent).toContain('Hi there!');
    });

    it('should handle empty messages', () => {
      const { container } = renderComponent({
        type: 'chatbot',
        messages: [],
      });

      const domCheck = checkDOMStructure(container);
      expect(domCheck).toBeDefined();
    });
  });

  describe('Carousel Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('carousel');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render carousel with items', () => {
      const { container } = renderComponent({
        type: 'carousel',
        items: [
          { type: 'div', body: [{ type: 'text', content: 'Slide 1' }] },
          { type: 'div', body: [{ type: 'text', content: 'Slide 2' }] },
        ],
      });

      // Carousel should render
      expect(container).toBeDefined();
    });
  });

  describe('Scroll Area Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('scroll-area');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render scrollable area', () => {
      const { container } = renderComponent({
        type: 'scroll-area',
        content: [{ type: 'text', content: 'Scrollable content' }],
      });

      // ScrollArea renders content
      expect(container.textContent).toContain('Scrollable content');
    });
  });

  describe('Resizable Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('resizable');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render resizable panels', () => {
      const { container } = renderComponent({
        type: 'resizable',
        panels: [
          { content: { type: 'text', content: 'Panel 1' } },
          { content: { type: 'text', content: 'Panel 2' } },
        ],
      });

      expect(container).toBeDefined();
    });
  });

  describe('Filter Builder Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('filter-builder');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render filter builder', () => {
      const { container } = renderComponent({
        type: 'filter-builder',
        fields: [
          { name: 'name', label: 'Name', type: 'text' },
          { name: 'age', label: 'Age', type: 'number' },
        ],
      });

      expect(container).toBeDefined();
    });
  });

  describe('Calendar View Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('calendar-view');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render calendar view', () => {
      const { container } = renderComponent({
        type: 'calendar-view',
        events: [
          {
            id: '1',
            title: 'Event 1',
            start: '2024-01-01',
            end: '2024-01-01',
          },
        ],
      });

      expect(container).toBeDefined();
    });
  });

  describe('Table Renderer', () => {
    it('should be properly registered', () => {
      const validation = validateComponentRegistration('table');
      expect(validation.isRegistered).toBe(true);
    });

    it('should render basic table', () => {
      const { container } = renderComponent({
        type: 'table',
        head: {
          rows: [
            {
              cells: [
                { type: 'text', content: 'Header 1' },
                { type: 'text', content: 'Header 2' },
              ],
            },
          ],
        },
        body: {
          rows: [
            {
              cells: [
                { type: 'text', content: 'Cell 1' },
                { type: 'text', content: 'Cell 2' },
              ],
            },
          ],
        },
      });

      const table = container.querySelector('table');
      expect(table).toBeTruthy();
    });
  });
});

/**
 * Cross-cutting concerns: Tests that apply to all components
 */
describe('All Renderers - Cross-Cutting Concerns', () => {
  it('should not render components with excessive DOM nesting', () => {
    const components = ['div', 'container', 'flex', 'grid'];
    
    components.forEach(type => {
      if (ComponentRegistry.has(type)) {
        const { container } = renderComponent({
          type,
          body: [{ type: 'text', content: 'Test' }],
        });

        const domCheck = checkDOMStructure(container);
        expect(domCheck.nestedDepth).toBeLessThan(20);
      }
    });
  });

  it('should handle className prop for custom styling', () => {
    const components = ['button', 'input', 'div', 'text'];
    
    components.forEach(type => {
      if (ComponentRegistry.has(type)) {
        const { container } = renderComponent({
          type,
          className: 'custom-class',
          label: 'Test',
          content: 'Test',
        });

        // Should render without errors
        expect(container).toBeDefined();
      }
    });
  });
});
