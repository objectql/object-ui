/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0057 P3c — the `/ai` page's "collapse to dock" landing: back through
 * history when react-router has an in-app entry to return to, else /home
 * (deep link / fresh tab — nothing behind us worth going "back" to).
 */
import { describe, it, expect } from 'vitest';
import { resolveCollapseToDockTarget } from '../AiChatPage';

describe('resolveCollapseToDockTarget', () => {
  it('goes back when react-router stamped a positive history index', () => {
    expect(resolveCollapseToDockTarget(1)).toBe(-1);
    expect(resolveCollapseToDockTarget(7)).toBe(-1);
  });

  it('lands on /home when this page is the entry point (idx 0)', () => {
    expect(resolveCollapseToDockTarget(0)).toBe('/home');
  });

  it('lands on /home when the index is missing or not a number', () => {
    expect(resolveCollapseToDockTarget(undefined)).toBe('/home');
    expect(resolveCollapseToDockTarget(null)).toBe('/home');
    expect(resolveCollapseToDockTarget('2')).toBe('/home');
    expect(resolveCollapseToDockTarget(NaN)).toBe('/home');
  });
});
