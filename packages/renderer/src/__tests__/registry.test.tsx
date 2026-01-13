import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ComponentRegistry } from '../registry';
import type { ComponentRenderer, ComponentMeta } from '../registry';

describe('@object-ui/renderer - Registry', () => {
  beforeEach(() => {
    // Clear registry before each test
    const allTypes = ComponentRegistry.getAllTypes();
    allTypes.forEach((type) => {
      // We cannot remove from registry, so we'll work with what we have
    });
  });

  describe('ComponentRegistry', () => {
    it('should register a component', () => {
      const TestComponent: ComponentRenderer = ({ schema }) => (
        <div data-testid="test-component">{schema.type}</div>
      );

      ComponentRegistry.register('test', TestComponent);

      expect(ComponentRegistry.has('test')).toBe(true);
      expect(ComponentRegistry.get('test')).toBe(TestComponent);
    });

    it('should register a component with metadata', () => {
      const TestComponent: ComponentRenderer = ({ schema }) => (
        <div>{schema.type}</div>
      );

      const meta: ComponentMeta = {
        label: 'Test Component',
        icon: 'test-icon',
        inputs: [
          {
            name: 'label',
            type: 'string',
            label: 'Label',
            required: true,
          },
        ],
      };

      ComponentRegistry.register('test-with-meta', TestComponent, meta);

      const config = ComponentRegistry.getConfig('test-with-meta');
      expect(config).toBeDefined();
      expect(config?.label).toBe('Test Component');
      expect(config?.icon).toBe('test-icon');
      expect(config?.inputs).toHaveLength(1);
    });

    it('should return undefined for unregistered component', () => {
      expect(ComponentRegistry.get('non-existent')).toBeUndefined();
      expect(ComponentRegistry.has('non-existent')).toBe(false);
    });

    it('should get all registered component types', () => {
      const TestComponent1: ComponentRenderer = ({ schema }) => <div>{schema.type}</div>;
      const TestComponent2: ComponentRenderer = ({ schema }) => <div>{schema.type}</div>;

      ComponentRegistry.register('type1', TestComponent1);
      ComponentRegistry.register('type2', TestComponent2);

      const types = ComponentRegistry.getAllTypes();
      expect(types).toContain('type1');
      expect(types).toContain('type2');
    });

    it('should get all registered component configs', () => {
      const TestComponent: ComponentRenderer = ({ schema }) => <div>{schema.type}</div>;
      ComponentRegistry.register('config-test', TestComponent, {
        label: 'Config Test',
      });

      const configs = ComponentRegistry.getAllConfigs();
      const testConfig = configs.find((c) => c.type === 'config-test');

      expect(testConfig).toBeDefined();
      expect(testConfig?.label).toBe('Config Test');
    });

    it('should warn when overwriting existing component', () => {
      const TestComponent1: ComponentRenderer = ({ schema }) => <div>v1</div>;
      const TestComponent2: ComponentRenderer = ({ schema }) => <div>v2</div>;

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      ComponentRegistry.register('overwrite-test', TestComponent1);
      ComponentRegistry.register('overwrite-test', TestComponent2);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Component type "overwrite-test" is already registered. Overwriting.'
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
