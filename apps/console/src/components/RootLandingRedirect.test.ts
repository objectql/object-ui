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

  it('⛔ counts an UNPUBLISHED App as visible — `_unpublished` is a server gate, not a landing filter', () => {
    // objectstack#6955 (#4829 A1). `hidden` and `_unpublished` split into two
    // keys with two enforcement points: the REST metadata gate already
    // withholds unpublished apps from everyone who should not see them, so an
    // app that reaches this resolver is one the viewer is entitled to. Adding
    // an `_unpublished !== true` clause above would flip this to '/apps/main' —
    // silently landing a builder somewhere other than the app they are building.
    //
    // Declared as a const rather than inline so the extra key is not
    // excess-property-checked against `LandingApp`: the resolver deliberately
    // does not declare a field it must not read.
    const apps = [{ name: 'main' }, { name: 'draft_app', _unpublished: true }];
    expect(resolveLandingPath(apps)).toBe('/home');
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
