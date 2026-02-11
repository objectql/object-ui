/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Theme } from '@object-ui/types';
import {
  hexToHSL,
  toCSSColor,
  generateColorVars,
  generateTypographyVars,
  generateBorderRadiusVars,
  generateShadowVars,
  generateAnimationVars,
  generateZIndexVars,
  generateThemeVars,
  mergeThemes,
  resolveThemeInheritance,
  resolveMode,
  contrastRatio,
  meetsContrastLevel,
} from '../ThemeEngine';

// ============================================================================
// Test Fixtures
// ============================================================================

const baseTheme: Theme = {
  name: 'default',
  label: 'Default',
  mode: 'auto',
  colors: {
    primary: '#3B82F6',
    secondary: '#64748B',
    accent: '#F59E0B',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    background: '#FFFFFF',
    surface: '#F8FAFC',
    text: '#0F172A',
    textSecondary: '#64748B',
    border: '#E2E8F0',
    disabled: '#94A3B8',
  },
  typography: {
    fontFamily: {
      base: 'Inter, sans-serif',
      heading: 'Inter, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
    letterSpacing: {
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
    },
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px',
  },
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  },
  animation: {
    duration: { fast: '150ms', base: '300ms', slow: '500ms' },
    timing: { ease: 'cubic-bezier(0.4, 0, 0.2, 1)', linear: 'linear' },
  },
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1100,
    fixed: 1200,
    modalBackdrop: 1300,
    modal: 1400,
    popover: 1500,
    tooltip: 1600,
  },
};

// ============================================================================
// hexToHSL
// ============================================================================

describe('hexToHSL', () => {
  it('should convert #000000 to "0 0% 0%"', () => {
    expect(hexToHSL('#000000')).toBe('0 0% 0%');
  });

  it('should convert #FFFFFF to "0 0% 100%"', () => {
    expect(hexToHSL('#FFFFFF')).toBe('0 0% 100%');
  });

  it('should convert #FF0000 to red HSL', () => {
    expect(hexToHSL('#FF0000')).toBe('0 100% 50%');
  });

  it('should convert #3B82F6 (blue)', () => {
    const result = hexToHSL('#3B82F6');
    expect(result).toBeTruthy();
    expect(result).toMatch(/^\d+ \d+% \d+%$/);
  });

  it('should handle shorthand hex #F00', () => {
    expect(hexToHSL('#F00')).toBe('0 100% 50%');
  });

  it('should handle hex without #', () => {
    expect(hexToHSL('FF0000')).toBe('0 100% 50%');
  });

  it('should return null for invalid hex', () => {
    expect(hexToHSL('not-a-color')).toBeNull();
    expect(hexToHSL('#GGHHII')).toBeNull();
    expect(hexToHSL('')).toBeNull();
  });
});

// ============================================================================
// toCSSColor
// ============================================================================

describe('toCSSColor', () => {
  it('should convert hex to HSL', () => {
    expect(toCSSColor('#FF0000')).toBe('0 100% 50%');
  });

  it('should pass through rgb() values', () => {
    expect(toCSSColor('rgb(255, 0, 0)')).toBe('rgb(255, 0, 0)');
  });

  it('should pass through hsl() values', () => {
    expect(toCSSColor('hsl(0, 100%, 50%)')).toBe('hsl(0, 100%, 50%)');
  });

  it('should pass through oklch() values', () => {
    expect(toCSSColor('oklch(0.7 0.15 30)')).toBe('oklch(0.7 0.15 30)');
  });
});

// ============================================================================
// generateColorVars
// ============================================================================

describe('generateColorVars', () => {
  it('should generate --primary from colors.primary', () => {
    const vars = generateColorVars({ primary: '#3B82F6' });
    expect(vars['--primary']).toBeTruthy();
  });

  it('should map error → --destructive', () => {
    const vars = generateColorVars({ primary: '#000', error: '#EF4444' });
    expect(vars['--destructive']).toBeTruthy();
  });

  it('should map surface → --card', () => {
    const vars = generateColorVars({ primary: '#000', surface: '#F8FAFC' });
    expect(vars['--card']).toBeTruthy();
  });

  it('should map text → --foreground', () => {
    const vars = generateColorVars({ primary: '#000', text: '#0F172A' });
    expect(vars['--foreground']).toBeTruthy();
  });

  it('should map textSecondary → --muted-foreground', () => {
    const vars = generateColorVars({ primary: '#000', textSecondary: '#64748B' });
    expect(vars['--muted-foreground']).toBeTruthy();
  });

  it('should skip undefined color fields', () => {
    const vars = generateColorVars({ primary: '#000' });
    expect(Object.keys(vars)).toHaveLength(1);
  });

  it('should generate all vars for a complete palette', () => {
    const vars = generateColorVars(baseTheme.colors);
    expect(Object.keys(vars).length).toBeGreaterThanOrEqual(10);
  });
});

// ============================================================================
// generateTypographyVars
// ============================================================================

describe('generateTypographyVars', () => {
  it('should generate --font-sans from fontFamily.base', () => {
    const vars = generateTypographyVars({ fontFamily: { base: 'Inter' } });
    expect(vars['--font-sans']).toBe('Inter');
  });

  it('should generate --font-heading', () => {
    const vars = generateTypographyVars({ fontFamily: { heading: 'Georgia' } });
    expect(vars['--font-heading']).toBe('Georgia');
  });

  it('should generate --font-mono', () => {
    const vars = generateTypographyVars({ fontFamily: { mono: 'Fira Code' } });
    expect(vars['--font-mono']).toBe('Fira Code');
  });

  it('should generate font size vars', () => {
    const vars = generateTypographyVars({
      fontSize: { xs: '0.75rem', base: '1rem', '2xl': '1.5rem' },
    });
    expect(vars['--font-size-xs']).toBe('0.75rem');
    expect(vars['--font-size-base']).toBe('1rem');
    expect(vars['--font-size-2xl']).toBe('1.5rem');
  });

  it('should generate font weight vars as strings', () => {
    const vars = generateTypographyVars({
      fontWeight: { bold: 700, normal: 400 },
    });
    expect(vars['--font-weight-bold']).toBe('700');
    expect(vars['--font-weight-normal']).toBe('400');
  });

  it('should generate line height vars', () => {
    const vars = generateTypographyVars({
      lineHeight: { tight: '1.25', normal: '1.5' },
    });
    expect(vars['--line-height-tight']).toBe('1.25');
    expect(vars['--line-height-normal']).toBe('1.5');
  });

  it('should generate letter spacing vars', () => {
    const vars = generateTypographyVars({
      letterSpacing: { tight: '-0.025em', wide: '0.025em' },
    });
    expect(vars['--letter-spacing-tight']).toBe('-0.025em');
    expect(vars['--letter-spacing-wide']).toBe('0.025em');
  });

  it('should handle complete typography config', () => {
    const vars = generateTypographyVars(baseTheme.typography!);
    expect(Object.keys(vars).length).toBeGreaterThanOrEqual(10);
  });
});

// ============================================================================
// generateBorderRadiusVars
// ============================================================================

describe('generateBorderRadiusVars', () => {
  it('should map base → --radius', () => {
    const vars = generateBorderRadiusVars({ base: '0.25rem' });
    expect(vars['--radius']).toBe('0.25rem');
  });

  it('should map all radius keys', () => {
    const vars = generateBorderRadiusVars(baseTheme.borderRadius!);
    expect(vars['--radius-none']).toBe('0');
    expect(vars['--radius-sm']).toBe('0.125rem');
    expect(vars['--radius']).toBe('0.25rem');
    expect(vars['--radius-lg']).toBe('0.5rem');
    expect(vars['--radius-full']).toBe('9999px');
  });

  it('should skip undefined radius values', () => {
    const vars = generateBorderRadiusVars({ lg: '0.5rem' });
    expect(Object.keys(vars)).toHaveLength(1);
  });
});

// ============================================================================
// generateShadowVars
// ============================================================================

describe('generateShadowVars', () => {
  it('should map base → --shadow', () => {
    const vars = generateShadowVars({ base: '0 1px 3px 0 rgb(0 0 0 / 0.1)' });
    expect(vars['--shadow']).toBe('0 1px 3px 0 rgb(0 0 0 / 0.1)');
  });

  it('should map all shadow keys', () => {
    const vars = generateShadowVars(baseTheme.shadows!);
    expect(vars['--shadow-none']).toBe('none');
    expect(vars['--shadow-inner']).toBeTruthy();
    expect(vars['--shadow-lg']).toBeTruthy();
  });
});

// ============================================================================
// generateAnimationVars
// ============================================================================

describe('generateAnimationVars', () => {
  it('should generate duration vars', () => {
    const vars = generateAnimationVars({
      duration: { fast: '150ms', base: '300ms', slow: '500ms' },
    });
    expect(vars['--duration-fast']).toBe('150ms');
    expect(vars['--duration-base']).toBe('300ms');
    expect(vars['--duration-slow']).toBe('500ms');
  });

  it('should generate timing vars', () => {
    const vars = generateAnimationVars({
      timing: { ease: 'cubic-bezier(0.4, 0, 0.2, 1)', linear: 'linear' },
    });
    expect(vars['--timing-ease']).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    expect(vars['--timing-linear']).toBe('linear');
  });
});

// ============================================================================
// generateZIndexVars
// ============================================================================

describe('generateZIndexVars', () => {
  it('should generate z-index vars as strings', () => {
    const vars = generateZIndexVars({
      base: 0,
      modal: 1400,
      tooltip: 1600,
    });
    expect(vars['--z-base']).toBe('0');
    expect(vars['--z-modal']).toBe('1400');
    expect(vars['--z-tooltip']).toBe('1600');
  });

  it('should handle all z-index keys', () => {
    const vars = generateZIndexVars(baseTheme.zIndex!);
    expect(Object.keys(vars)).toHaveLength(8);
  });
});

// ============================================================================
// generateThemeVars (integration)
// ============================================================================

describe('generateThemeVars', () => {
  it('should generate vars from a minimal theme', () => {
    const minimal: Theme = {
      name: 'minimal',
      label: 'Minimal',
      colors: { primary: '#3B82F6' },
    };
    const vars = generateThemeVars(minimal);
    expect(vars['--primary']).toBeTruthy();
    expect(Object.keys(vars).length).toBe(1);
  });

  it('should generate vars from a complete theme', () => {
    const vars = generateThemeVars(baseTheme);
    // Colors + Typography + BorderRadius + Shadows + Animation + ZIndex
    expect(Object.keys(vars).length).toBeGreaterThan(40);
  });

  it('should include customVars with -- prefix', () => {
    const theme: Theme = {
      name: 'custom',
      label: 'Custom',
      colors: { primary: '#000' },
      customVars: {
        '--sidebar-width': '280px',
        'header-height': '64px',
      },
    };
    const vars = generateThemeVars(theme);
    expect(vars['--sidebar-width']).toBe('280px');
    expect(vars['--header-height']).toBe('64px');
  });
});

// ============================================================================
// mergeThemes
// ============================================================================

describe('mergeThemes', () => {
  const parent: Theme = {
    name: 'parent',
    label: 'Parent',
    colors: { primary: '#000', secondary: '#111' },
    typography: {
      fontFamily: { base: 'Arial' },
      fontSize: { base: '1rem', lg: '1.125rem' },
    },
    borderRadius: { sm: '2px', lg: '8px' },
    zIndex: { base: 0, modal: 1400 },
  };

  it('should override top-level scalar fields', () => {
    const merged = mergeThemes(parent, { label: 'Child', description: 'A child theme' } as Partial<Theme>);
    expect(merged.label).toBe('Child');
    expect(merged.description).toBe('A child theme');
    expect(merged.name).toBe('parent');
  });

  it('should deep-merge colors', () => {
    const merged = mergeThemes(parent, {
      colors: { primary: '#FFF', accent: '#F00' },
    } as Partial<Theme>);
    expect(merged.colors.primary).toBe('#FFF');
    expect(merged.colors.secondary).toBe('#111'); // from parent
    expect(merged.colors.accent).toBe('#F00'); // from child
  });

  it('should deep-merge typography.fontFamily', () => {
    const merged = mergeThemes(parent, {
      typography: {
        fontFamily: { heading: 'Georgia' },
      },
    } as Partial<Theme>);
    expect(merged.typography?.fontFamily?.base).toBe('Arial'); // from parent
    expect(merged.typography?.fontFamily?.heading).toBe('Georgia'); // from child
  });

  it('should deep-merge typography.fontSize', () => {
    const merged = mergeThemes(parent, {
      typography: {
        fontSize: { base: '1.125rem', xl: '1.5rem' },
      },
    } as Partial<Theme>);
    expect(merged.typography?.fontSize?.base).toBe('1.125rem'); // overridden
    expect(merged.typography?.fontSize?.lg).toBe('1.125rem'); // from parent
    expect(merged.typography?.fontSize?.xl).toBe('1.5rem'); // from child
  });

  it('should deep-merge borderRadius', () => {
    const merged = mergeThemes(parent, {
      borderRadius: { sm: '4px', xl: '16px' },
    } as Partial<Theme>);
    expect(merged.borderRadius?.sm).toBe('4px'); // overridden
    expect(merged.borderRadius?.lg).toBe('8px'); // from parent
    expect(merged.borderRadius?.xl).toBe('16px'); // new
  });

  it('should deep-merge zIndex', () => {
    const merged = mergeThemes(parent, {
      zIndex: { tooltip: 9999 },
    } as Partial<Theme>);
    expect(merged.zIndex?.base).toBe(0);
    expect(merged.zIndex?.modal).toBe(1400);
    expect(merged.zIndex?.tooltip).toBe(9999);
  });

  it('should preserve parent when child has no field', () => {
    const merged = mergeThemes(parent, { colors: { primary: '#FFF' } } as Partial<Theme>);
    expect(merged.borderRadius).toEqual(parent.borderRadius);
    expect(merged.typography).toBeDefined();
  });
});

// ============================================================================
// resolveThemeInheritance
// ============================================================================

describe('resolveThemeInheritance', () => {
  it('should return the theme as-is when no extends', () => {
    const theme: Theme = { name: 'solo', label: 'Solo', colors: { primary: '#000' } };
    const registry = new Map([['solo', theme]]);
    expect(resolveThemeInheritance(theme, registry)).toBe(theme);
  });

  it('should merge parent when extends is set', () => {
    const parent: Theme = {
      name: 'parent',
      label: 'Parent',
      colors: { primary: '#000', secondary: '#111' },
      borderRadius: { lg: '8px' },
    };
    const child: Theme = {
      name: 'child',
      label: 'Child',
      colors: { primary: '#FFF' },
      extends: 'parent',
    };
    const registry = new Map([['parent', parent], ['child', child]]);
    const resolved = resolveThemeInheritance(child, registry);
    expect(resolved.colors.primary).toBe('#FFF');
    expect(resolved.colors.secondary).toBe('#111');
    expect(resolved.borderRadius?.lg).toBe('8px');
  });

  it('should resolve multi-level inheritance', () => {
    const grandparent: Theme = {
      name: 'gp',
      label: 'Grandparent',
      colors: { primary: '#000', accent: '#AAA' },
    };
    const parent: Theme = {
      name: 'parent',
      label: 'Parent',
      colors: { primary: '#111' },
      extends: 'gp',
    };
    const child: Theme = {
      name: 'child',
      label: 'Child',
      colors: { primary: '#FFF' },
      extends: 'parent',
    };
    const registry = new Map([
      ['gp', grandparent],
      ['parent', parent],
      ['child', child],
    ]);
    const resolved = resolveThemeInheritance(child, registry);
    expect(resolved.colors.primary).toBe('#FFF'); // child
    expect(resolved.colors.accent).toBe('#AAA'); // grandparent
  });

  it('should handle missing parent gracefully', () => {
    const child: Theme = {
      name: 'orphan',
      label: 'Orphan',
      colors: { primary: '#000' },
      extends: 'nonexistent',
    };
    const registry = new Map([['orphan', child]]);
    const resolved = resolveThemeInheritance(child, registry);
    expect(resolved.name).toBe('orphan');
    expect(resolved.colors.primary).toBe('#000');
  });

  it('should detect and break circular inheritance', () => {
    const a: Theme = { name: 'a', label: 'A', colors: { primary: '#000' }, extends: 'b' };
    const b: Theme = { name: 'b', label: 'B', colors: { primary: '#111' }, extends: 'a' };
    const registry = new Map([['a', a], ['b', b]]);
    // Should not infinite loop
    const resolved = resolveThemeInheritance(a, registry);
    expect(resolved.name).toBeDefined();
  });
});

// ============================================================================
// resolveMode
// ============================================================================

describe('resolveMode', () => {
  it('should return "light" for mode="light"', () => {
    expect(resolveMode('light')).toBe('light');
  });

  it('should return "dark" for mode="dark"', () => {
    expect(resolveMode('dark')).toBe('dark');
  });

  it('should resolve "auto" using systemDark=true', () => {
    expect(resolveMode('auto', true)).toBe('dark');
  });

  it('should resolve "auto" using systemDark=false', () => {
    expect(resolveMode('auto', false)).toBe('light');
  });

  it('should default to "light" when mode is undefined', () => {
    expect(resolveMode(undefined, false)).toBe('light');
  });

  it('should use matchMedia when systemDark is not provided', () => {
    // Mock matchMedia
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
    }));
    expect(resolveMode('auto')).toBe('dark');
    window.matchMedia = original;
  });

  it('should fallback to "light" when no matchMedia', () => {
    const original = window.matchMedia;
    // @ts-expect-error testing fallback
    window.matchMedia = undefined;
    expect(resolveMode('auto')).toBe('light');
    window.matchMedia = original;
  });
});

// ============================================================================
// WCAG Contrast Checking (v2.0.7)
// ============================================================================

describe('contrastRatio', () => {
  it('should return 21 for black and white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('should return 1 for identical colors', () => {
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 1);
  });

  it('should return null for invalid hex', () => {
    expect(contrastRatio('invalid', '#000000')).toBeNull();
    expect(contrastRatio('#000000', 'xyz')).toBeNull();
  });

  it('should handle shorthand hex (#RGB)', () => {
    const ratio = contrastRatio('#000', '#fff');
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('should be order-independent', () => {
    const ratio1 = contrastRatio('#000000', '#336699');
    const ratio2 = contrastRatio('#336699', '#000000');
    expect(ratio1).toBe(ratio2);
  });
});

describe('meetsContrastLevel', () => {
  it('should pass AA for black on white (normal text)', () => {
    expect(meetsContrastLevel('#000000', '#ffffff', 'AA')).toBe(true);
  });

  it('should pass AAA for black on white (normal text)', () => {
    expect(meetsContrastLevel('#000000', '#ffffff', 'AAA')).toBe(true);
  });

  it('should fail AA for similar grays', () => {
    // #777 on #999 gives ~1.6:1 ratio
    expect(meetsContrastLevel('#777777', '#999999', 'AA')).toBe(false);
  });

  it('should use lower threshold for large text (AA)', () => {
    // #767676 on white gives ~4.54:1 (passes AA normal, passes AA large)
    expect(meetsContrastLevel('#767676', '#ffffff', 'AA', false)).toBe(true);
    expect(meetsContrastLevel('#767676', '#ffffff', 'AA', true)).toBe(true);
  });

  it('should use lower threshold for large text (AAA)', () => {
    // Black on white: 21:1 — passes both
    expect(meetsContrastLevel('#000000', '#ffffff', 'AAA', true)).toBe(true);
  });

  it('should return false for invalid colors', () => {
    expect(meetsContrastLevel('invalid', '#ffffff', 'AA')).toBe(false);
  });
});
