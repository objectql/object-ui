/**
 * ObjectUI – Copyright (c) 2024-present ObjectStack Inc.
 * Licensed under MIT.
 */

/**
 * isPlausibleEmail() mirrors the server's `isLikelyEmail` (structure + ASCII)
 * so obviously-bad addresses fail in the preview step instead of only at
 * real-import time (framework#3566).
 */
import { describe, it, expect } from 'vitest';
import { isPlausibleEmail } from './ImportWizard';

describe('isPlausibleEmail', () => {
  it('accepts normal addresses', () => {
    expect(isPlausibleEmail('name@example.com')).toBe(true);
    expect(isPlausibleEmail('first.last@sub.example.co')).toBe(true);
  });

  it('rejects non-ASCII addresses (the reported bug)', () => {
    expect(isPlausibleEmail('735431496@柴仟.com')).toBe(false);
    expect(isPlausibleEmail('ａｂｃ@b.com')).toBe(false);
  });

  it('rejects structurally-broken addresses', () => {
    expect(isPlausibleEmail('no-at.example.com')).toBe(false);
    expect(isPlausibleEmail('a@b')).toBe(false);
    expect(isPlausibleEmail('a@@b.co')).toBe(false);
    expect(isPlausibleEmail('a@.co')).toBe(false);
    expect(isPlausibleEmail('a@b.')).toBe(false);
    expect(isPlausibleEmail('has space@b.co')).toBe(false);
  });

  it('is fast on adversarial input (no backtracking)', () => {
    const t0 = Date.now();
    expect(isPlausibleEmail('!@'.repeat(100_000))).toBe(false);
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
