import { describe, it, expect, beforeAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';

describe('New Components Registration', () => {
  // Import all renderers to register them
  beforeAll(async () => {
    await import('./renderers');
  });

  describe('Form Components', () => {
    it('should register date-picker component', () => {
      const component = ComponentRegistry.getConfig('date-picker');
      expect(component).toBeDefined();
      expect(component?.label).toBe('Date Picker');
    });

    it('should register file-upload component', () => {
      const component = ComponentRegistry.getConfig('file-upload');
      expect(component).toBeDefined();
      expect(component?.label).toBe('File Upload');
    });
  });

  describe('Data Display Components', () => {
    it('should register list component', () => {
      const component = ComponentRegistry.getConfig('list');
      expect(component).toBeDefined();
      expect(component?.label).toBe('List');
    });

    it('should register tree-view component', () => {
      const component = ComponentRegistry.getConfig('tree-view');
      expect(component).toBeDefined();
      expect(component?.label).toBe('Tree View');
    });

    it('should register markdown component', () => {
      const component = ComponentRegistry.getConfig('markdown');
      expect(component).toBeDefined();
      expect(component?.label).toBe('Markdown');
    });
  });

  describe('Layout Components', () => {
    it('should register grid component', () => {
      const component = ComponentRegistry.getConfig('grid');
      expect(component).toBeDefined();
      expect(component?.label).toBe('Grid Layout');
    });

    it('should register flex component', () => {
      const component = ComponentRegistry.getConfig('flex');
      expect(component).toBeDefined();
      expect(component?.label).toBe('Flex Layout');
    });

    it('should register container component', () => {
      const component = ComponentRegistry.getConfig('container');
      expect(component).toBeDefined();
      expect(component?.label).toBe('Container');
    });
  });

  describe('Feedback Components', () => {
    it('should register loading component', () => {
      const component = ComponentRegistry.getConfig('loading');
      expect(component).toBeDefined();
      expect(component?.label).toBe('Loading');
    });
  });
});
