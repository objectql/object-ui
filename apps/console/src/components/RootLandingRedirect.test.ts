// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { resolveLandingPath } from './RootLandingRedirect';

describe('resolveLandingPath', () => {
  it('routes to the App marked isDefault (isDefault now ROUTES, not just badges)', () => {
    expect(
      resolveLandingPath([
        { name: 'crm' },
        { name: 'cloud_control', isDefault: true },
        { name: 'setup' },
      ]),
    ).toBe('/apps/cloud_control');
  });

  it('prefers isDefault over the single-visible-app rule', () => {
    expect(
      resolveLandingPath([{ name: 'a', isDefault: true }, { name: 'b' }, { name: 'c' }]),
    ).toBe('/apps/a');
  });

  it('lands directly in the single visible App when none is isDefault', () => {
    expect(resolveLandingPath([{ name: 'only_app' }])).toBe('/apps/only_app');
  });

  it('ignores hidden/inactive Apps when counting "single visible"', () => {
    expect(
      resolveLandingPath([
        { name: 'main' },
        { name: 'secret', hidden: true },
        { name: 'off', active: false },
      ]),
    ).toBe('/apps/main');
  });

  it('falls back to /home for a multi-app deployment with no isDefault (legacy behavior)', () => {
    expect(resolveLandingPath([{ name: 'a' }, { name: 'b' }])).toBe('/home');
  });

  it('falls back to /home when there are no apps', () => {
    expect(resolveLandingPath([])).toBe('/home');
    expect(resolveLandingPath(null)).toBe('/home');
    expect(resolveLandingPath(undefined)).toBe('/home');
  });

  it('ignores entries without a name', () => {
    expect(resolveLandingPath([{ isDefault: true }, { name: 'real' }])).toBe('/apps/real');
  });
});
