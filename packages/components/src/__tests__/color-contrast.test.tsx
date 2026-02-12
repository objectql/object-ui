/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * WCAG 2.1 AA Color Contrast Tests.
 *
 * Verifies that key color combinations used in ObjectUI meet WCAG AA
 * contrast ratio requirements:
 * - 4.5:1 for normal text (< 18pt or < 14pt bold)
 * - 3:1 for large text (≥ 18pt or ≥ 14pt bold)
 *
 * Tests both light and dark theme color values.
 * Part of P2.3 Accessibility & Inclusive Design roadmap.
 */

import { describe, it, expect } from 'vitest';

/**
 * Calculate relative luminance per WCAG 2.1.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
function contrastRatio(
  fg: [number, number, number],
  bg: [number, number, number]
): number {
  const l1 = relativeLuminance(...fg);
  const l2 = relativeLuminance(...bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG AA thresholds
const AA_NORMAL_TEXT = 4.5;
const AA_LARGE_TEXT = 3.0;

// ── Light Theme Colors (based on Shadcn/Tailwind defaults) ──

const light = {
  background: [255, 255, 255] as [number, number, number],       // hsl(0 0% 100%)
  foreground: [10, 10, 10] as [number, number, number],           // hsl(0 0% 3.9%)
  muted: [245, 245, 245] as [number, number, number],             // hsl(0 0% 96.1%)
  mutedForeground: [115, 115, 115] as [number, number, number],   // hsl(0 0% 45.1%)
  primary: [24, 24, 27] as [number, number, number],              // hsl(240 5.9% 10%)
  primaryForeground: [250, 250, 250] as [number, number, number], // hsl(0 0% 98%)
  destructive: [239, 68, 68] as [number, number, number],         // hsl(0 84.2% 60.2%) — red-500
  destructiveForeground: [255, 255, 255] as [number, number, number],
  card: [255, 255, 255] as [number, number, number],
  cardForeground: [10, 10, 10] as [number, number, number],
  border: [229, 229, 229] as [number, number, number],            // hsl(0 0% 89.8%)
  accent: [245, 245, 245] as [number, number, number],
  accentForeground: [24, 24, 27] as [number, number, number],
};

// ── Dark Theme Colors (based on Shadcn/Tailwind defaults) ──

const dark = {
  background: [10, 10, 10] as [number, number, number],           // hsl(0 0% 3.9%)
  foreground: [250, 250, 250] as [number, number, number],        // hsl(0 0% 98%)
  muted: [38, 38, 38] as [number, number, number],                // hsl(0 0% 14.9%)
  mutedForeground: [163, 163, 163] as [number, number, number],   // hsl(0 0% 63.9%)
  primary: [250, 250, 250] as [number, number, number],           // hsl(0 0% 98%)
  primaryForeground: [24, 24, 27] as [number, number, number],    // hsl(240 5.9% 10%)
  destructive: [239, 68, 68] as [number, number, number],          // hsl(0 84.2% 60.2%) — red-500 (same in dark)
  destructiveForeground: [250, 250, 250] as [number, number, number],
  card: [10, 10, 10] as [number, number, number],
  cardForeground: [250, 250, 250] as [number, number, number],
  border: [38, 38, 38] as [number, number, number],
  accent: [38, 38, 38] as [number, number, number],
  accentForeground: [250, 250, 250] as [number, number, number],
};

describe('WCAG 2.1 AA Color Contrast — Light Theme', () => {
  it('foreground on background meets AA for normal text (4.5:1)', () => {
    const ratio = contrastRatio(light.foreground, light.background);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('primary foreground on primary meets AA for normal text', () => {
    const ratio = contrastRatio(light.primaryForeground, light.primary);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('destructive foreground on destructive meets AA for large text (3:1)', () => {
    const ratio = contrastRatio(light.destructiveForeground, light.destructive);
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
  });

  it('muted foreground on background meets AA for large text (3:1)', () => {
    const ratio = contrastRatio(light.mutedForeground, light.background);
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
  });

  it('muted foreground on muted background meets AA for large text (3:1)', () => {
    const ratio = contrastRatio(light.mutedForeground, light.muted);
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
  });

  it('card foreground on card background meets AA for normal text', () => {
    const ratio = contrastRatio(light.cardForeground, light.card);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('accent foreground on accent background meets AA for normal text', () => {
    const ratio = contrastRatio(light.accentForeground, light.accent);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('foreground on muted background meets AA for normal text', () => {
    const ratio = contrastRatio(light.foreground, light.muted);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('primary on background meets AA for normal text', () => {
    const ratio = contrastRatio(light.primary, light.background);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('destructive on background meets AA for large text', () => {
    const ratio = contrastRatio(light.destructive, light.background);
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
  });
});

describe('WCAG 2.1 AA Color Contrast — Dark Theme', () => {
  it('foreground on background meets AA for normal text (4.5:1)', () => {
    const ratio = contrastRatio(dark.foreground, dark.background);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('primary foreground on primary meets AA for normal text', () => {
    const ratio = contrastRatio(dark.primaryForeground, dark.primary);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('destructive foreground on destructive meets AA for large text (3:1)', () => {
    const ratio = contrastRatio(dark.destructiveForeground, dark.destructive);
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
  });

  it('muted foreground on background meets AA for large text (3:1)', () => {
    const ratio = contrastRatio(dark.mutedForeground, dark.background);
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
  });

  it('muted foreground on muted background meets AA for large text (3:1)', () => {
    const ratio = contrastRatio(dark.mutedForeground, dark.muted);
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
  });

  it('card foreground on card background meets AA for normal text', () => {
    const ratio = contrastRatio(dark.cardForeground, dark.card);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('accent foreground on accent background meets AA for normal text', () => {
    const ratio = contrastRatio(dark.accentForeground, dark.accent);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('foreground on muted background meets AA for normal text', () => {
    const ratio = contrastRatio(dark.foreground, dark.muted);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('primary on background meets AA for normal text', () => {
    const ratio = contrastRatio(dark.primary, dark.background);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('destructive on background meets AA for large text', () => {
    const ratio = contrastRatio(dark.destructive, dark.background);
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
  });
});

describe('WCAG 2.1 AA Color Contrast — Utility Validation', () => {
  it('contrastRatio returns 21:1 for black on white', () => {
    const ratio = contrastRatio([0, 0, 0], [255, 255, 255]);
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('contrastRatio returns 1:1 for same color', () => {
    const ratio = contrastRatio([128, 128, 128], [128, 128, 128]);
    expect(ratio).toBeCloseTo(1, 1);
  });

  it('relativeLuminance returns 0 for black', () => {
    expect(relativeLuminance(0, 0, 0)).toBe(0);
  });

  it('relativeLuminance returns 1 for white', () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 4);
  });
});
