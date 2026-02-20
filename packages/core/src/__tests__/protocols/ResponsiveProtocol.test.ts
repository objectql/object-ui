import { describe, it, expect } from 'vitest';
import type { SpecResponsiveConfig } from '@object-ui/types';
import {
  getVisibilityClasses,
  getColumnClasses,
  getOrderClasses,
  shouldHideAtBreakpoint,
  resolveResponsiveConfig,
  BREAKPOINT_VALUES,
} from '../../protocols/ResponsiveProtocol';

describe('ResponsiveProtocol', () => {
  // ==========================================================================
  // BREAKPOINT_VALUES
  // ==========================================================================
  describe('BREAKPOINT_VALUES', () => {
    it('should export correct pixel values for all breakpoints', () => {
      expect(BREAKPOINT_VALUES.xs).toBe(0);
      expect(BREAKPOINT_VALUES.sm).toBe(640);
      expect(BREAKPOINT_VALUES.md).toBe(768);
      expect(BREAKPOINT_VALUES.lg).toBe(1024);
      expect(BREAKPOINT_VALUES.xl).toBe(1280);
      expect(BREAKPOINT_VALUES['2xl']).toBe(1536);
    });
  });

  // ==========================================================================
  // resolveResponsiveConfig
  // ==========================================================================
  describe('resolveResponsiveConfig', () => {
    it('should apply defaults for empty config', () => {
      const config = {} as SpecResponsiveConfig;
      const resolved = resolveResponsiveConfig(config);

      expect(resolved.breakpoint).toBeUndefined();
      expect(resolved.hiddenOn).toEqual([]);
      expect(resolved.columns).toEqual({});
      expect(resolved.order).toEqual({});
    });

    it('should preserve explicit values', () => {
      const config = {
        breakpoint: 'md',
        hiddenOn: ['sm'],
        columns: { xs: 1, md: 2 },
        order: { xs: 2, md: 1 },
      } as SpecResponsiveConfig;
      const resolved = resolveResponsiveConfig(config);

      expect(resolved.breakpoint).toBe('md');
      expect(resolved.hiddenOn).toEqual(['sm']);
      expect(resolved.columns).toEqual({ xs: 1, md: 2 });
      expect(resolved.order).toEqual({ xs: 2, md: 1 });
    });
  });

  // ==========================================================================
  // getVisibilityClasses
  // ==========================================================================
  describe('getVisibilityClasses', () => {
    it('should return empty array for no visibility config', () => {
      const config = {} as SpecResponsiveConfig;
      expect(getVisibilityClasses(config)).toEqual([]);
    });

    it('should return hidden + breakpoint:block for minimum breakpoint', () => {
      const config = { breakpoint: 'md' } as SpecResponsiveConfig;
      const classes = getVisibilityClasses(config);

      expect(classes).toContain('hidden');
      expect(classes).toContain('md:block');
    });

    it('should not add hidden class for xs breakpoint', () => {
      const config = { breakpoint: 'xs' } as SpecResponsiveConfig;
      const classes = getVisibilityClasses(config);

      expect(classes).not.toContain('hidden');
    });

    it('should generate toggle classes for hiddenOn', () => {
      const config = { hiddenOn: ['sm'] } as SpecResponsiveConfig;
      const classes = getVisibilityClasses(config);

      expect(classes).toContain('sm:hidden');
      expect(classes).toContain('md:block');
    });

    it('should handle hiddenOn at xs breakpoint', () => {
      const config = { hiddenOn: ['xs'] } as SpecResponsiveConfig;
      const classes = getVisibilityClasses(config);

      expect(classes).toContain('hidden');
      expect(classes).toContain('sm:block');
    });
  });

  // ==========================================================================
  // getColumnClasses
  // ==========================================================================
  describe('getColumnClasses', () => {
    it('should return empty array when no columns set', () => {
      const config = {} as SpecResponsiveConfig;
      expect(getColumnClasses(config)).toEqual([]);
    });

    it('should return grid-cols classes for each breakpoint', () => {
      const config = {
        columns: { xs: 1, md: 2, xl: 4 },
      } as SpecResponsiveConfig;
      const classes = getColumnClasses(config);

      expect(classes).toContain('grid-cols-1');
      expect(classes).toContain('md:grid-cols-2');
      expect(classes).toContain('xl:grid-cols-4');
    });

    it('should omit prefix for xs breakpoint', () => {
      const config = { columns: { xs: 3 } } as SpecResponsiveConfig;
      const classes = getColumnClasses(config);

      expect(classes).toEqual(['grid-cols-3']);
    });
  });

  // ==========================================================================
  // getOrderClasses
  // ==========================================================================
  describe('getOrderClasses', () => {
    it('should return empty array when no order set', () => {
      const config = {} as SpecResponsiveConfig;
      expect(getOrderClasses(config)).toEqual([]);
    });

    it('should return order classes for each breakpoint', () => {
      const config = {
        order: { xs: 2, lg: 1 },
      } as SpecResponsiveConfig;
      const classes = getOrderClasses(config);

      expect(classes).toContain('order-2');
      expect(classes).toContain('lg:order-1');
    });
  });

  // ==========================================================================
  // shouldHideAtBreakpoint
  // ==========================================================================
  describe('shouldHideAtBreakpoint', () => {
    it('should hide below minimum breakpoint', () => {
      const config = { breakpoint: 'md' } as SpecResponsiveConfig;

      expect(shouldHideAtBreakpoint(config, 600)).toBe(true); // below 768
      expect(shouldHideAtBreakpoint(config, 768)).toBe(false); // at 768
      expect(shouldHideAtBreakpoint(config, 1024)).toBe(false); // above 768
    });

    it('should hide at breakpoints in hiddenOn list', () => {
      const config = { hiddenOn: ['sm', 'lg'] } as SpecResponsiveConfig;

      expect(shouldHideAtBreakpoint(config, 700)).toBe(true); // sm range
      expect(shouldHideAtBreakpoint(config, 800)).toBe(false); // md range
      expect(shouldHideAtBreakpoint(config, 1100)).toBe(true); // lg range
    });

    it('should return false when no config constraints', () => {
      const config = {} as SpecResponsiveConfig;
      expect(shouldHideAtBreakpoint(config, 500)).toBe(false);
    });

    it('should not hide at xs width when no constraints', () => {
      const config = {} as SpecResponsiveConfig;
      expect(shouldHideAtBreakpoint(config, 0)).toBe(false);
    });
  });
});
