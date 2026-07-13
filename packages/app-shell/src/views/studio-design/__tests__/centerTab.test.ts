/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0057 P3c — the folded Interfaces pillar's canvas|properties auto-switch:
 * react to inspector-target EDGES, never fight a manual choice in steady state.
 */
import { describe, it, expect } from 'vitest';
import { nextCenterTab } from '../centerTab';

describe('nextCenterTab', () => {
  it('jumps to Properties when an inspector target appears', () => {
    expect(nextCenterTab('canvas', false, true)).toBe('properties');
  });

  it('returns to Canvas when the target clears', () => {
    expect(nextCenterTab('properties', true, false)).toBe('canvas');
    // Even from canvas (user had flipped back manually) a clear is a no-op
    // landing on canvas — never on properties.
    expect(nextCenterTab('canvas', true, false)).toBe('canvas');
  });

  it('preserves a manual choice in steady state', () => {
    // Selection still live, user flipped back to Canvas → stays on Canvas.
    expect(nextCenterTab('canvas', true, true)).toBe('canvas');
    expect(nextCenterTab('properties', true, true)).toBe('properties');
    // No target at all → wherever the user is.
    expect(nextCenterTab('properties', false, false)).toBe('properties');
    expect(nextCenterTab('canvas', false, false)).toBe('canvas');
  });
});
