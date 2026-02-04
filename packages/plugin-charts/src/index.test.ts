/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';

describe('Plugin Charts', () => {
  // Import all renderers to register them
  beforeAll(async () => {
    await import('./index');
  }, 30000);

  describe('bar-chart component', () => {
    it('should be registered in ComponentRegistry', () => {
      const chartBarRenderer = ComponentRegistry.get('bar-chart');
      expect(chartBarRenderer).toBeDefined();
    });

    it('should have proper metadata', () => {
      const config = ComponentRegistry.getConfig('bar-chart');
      expect(config).toBeDefined();
      expect(config?.label).toBe('Bar Chart');
      expect(config?.category).toBe('plugin');
      expect(config?.inputs).toBeDefined();
      expect(config?.defaultProps).toBeDefined();
    });

    it('should have expected inputs', () => {
      const config = ComponentRegistry.getConfig('bar-chart');
      const inputNames = config?.inputs?.map((input: any) => input.name) || [];
      
      expect(inputNames).toContain('data');
      expect(inputNames).toContain('dataKey');
      expect(inputNames).toContain('xAxisKey');
      expect(inputNames).toContain('height');
      expect(inputNames).toContain('color');
    });

    it('should have data as required input', () => {
      const config = ComponentRegistry.getConfig('bar-chart');
      const dataInput = config?.inputs?.find((input: any) => input.name === 'data');
      
      expect(dataInput).toBeDefined();
      expect(dataInput?.required).toBe(true);
      expect(dataInput?.type).toBe('array');
    });

    it('should have sensible default props', () => {
      const config = ComponentRegistry.getConfig('bar-chart');
      const defaults = config?.defaultProps;
      
      expect(defaults).toBeDefined();
      expect(defaults?.dataKey).toBe('value');
      expect(defaults?.xAxisKey).toBe('name');
      expect(defaults?.height).toBe(400);
      expect(defaults?.color).toBe('#8884d8');
      expect(defaults?.data).toBeDefined();
      expect(Array.isArray(defaults?.data)).toBe(true);
      expect(defaults?.data.length).toBeGreaterThan(0);
    });
  });

  describe('chart (advanced) component', () => {
    it('should be registered in ComponentRegistry', () => {
      const chartRenderer = ComponentRegistry.get('chart');
      expect(chartRenderer).toBeDefined();
    });

    it('should have proper metadata', () => {
      const config = ComponentRegistry.getConfig('chart');
      expect(config).toBeDefined();
      expect(config?.label).toBe('Chart');
      expect(config?.category).toBe('plugin');
      expect(config?.inputs).toBeDefined();
      expect(config?.defaultProps).toBeDefined();
    });

    it('should have expected inputs', () => {
      const config = ComponentRegistry.getConfig('chart');
      const inputNames = config?.inputs?.map((input: any) => input.name) || [];
      
      expect(inputNames).toContain('chartType');
      expect(inputNames).toContain('data');
      expect(inputNames).toContain('config');
      expect(inputNames).toContain('xAxisKey');
      expect(inputNames).toContain('series');
      expect(inputNames).toContain('className');
    });

    it('should have chartType as enum input', () => {
      const config = ComponentRegistry.getConfig('chart');
      const chartTypeInput = config?.inputs?.find((input: any) => input.name === 'chartType');
      
      expect(chartTypeInput).toBeDefined();
      expect(chartTypeInput?.type).toBe('enum');
      expect(chartTypeInput?.enum).toBeDefined();
      expect(Array.isArray(chartTypeInput?.enum)).toBe(true);
      
      const enumValues = chartTypeInput?.enum?.map((e: any) => e.value) || [];
      expect(enumValues).toContain('bar');
      expect(enumValues).toContain('line');
      expect(enumValues).toContain('area');
    });

    it('should have data and series as required inputs', () => {
      const config = ComponentRegistry.getConfig('chart');
      const dataInput = config?.inputs?.find((input: any) => input.name === 'data');
      const seriesInput = config?.inputs?.find((input: any) => input.name === 'series');
      
      expect(dataInput?.required).toBe(true);
      expect(seriesInput?.required).toBe(true);
    });

    it('should have sensible default props', () => {
      const config = ComponentRegistry.getConfig('chart');
      const defaults = config?.defaultProps;
      
      expect(defaults).toBeDefined();
      expect(defaults?.chartType).toBe('bar');
      expect(defaults?.xAxisKey).toBe('name');
      expect(defaults?.data).toBeDefined();
      expect(Array.isArray(defaults?.data)).toBe(true);
      expect(defaults?.data.length).toBeGreaterThan(0);
      expect(defaults?.config).toBeDefined();
      expect(typeof defaults?.config).toBe('object');
      expect(defaults?.series).toBeDefined();
      expect(Array.isArray(defaults?.series)).toBe(true);
      expect(defaults?.series.length).toBeGreaterThan(0);
    });
  });
});
