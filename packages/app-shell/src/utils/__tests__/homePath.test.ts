/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * objectui#7256 — `resolveDeclaredHomePath`, the ONE reader of the product's
 * declared landing (`app.isDefault`).
 *
 * The defect this policy closes: the console chrome named `/home` literally, so
 * a deployment that declares a landing showed two homes. On cloud's control
 * plane the second one is the environment launcher — "Build an app" / "Start
 * from a template" act on an environment the control plane does not have, and
 * its "Your apps" tiles are the control plane's own internal management apps.
 *
 * `null` (not `/home`) is the "no declaration" answer on purpose: the two
 * callers layer DIFFERENT things on it — `/`'s resolver has a
 * single-visible-app emptiness heuristic to try next, the chrome has nothing —
 * so the fallback cannot be baked in here without one of them inheriting the
 * other's policy.
 */
import { describe, it, expect } from 'vitest';
import { HOME_LAUNCHER_PATH, resolveDeclaredHomePath } from '../homePath';

describe('resolveDeclaredHomePath', () => {
  it('answers the declared app root — cloud control plane, the card shape', () => {
    // The control plane's real list: `cloud_control` declares `isDefault`, and
    // its first nav item is the Welcome page — which is what makes
    // `/apps/cloud_control` resolve to the welcome landing.
    expect(
      resolveDeclaredHomePath([
        { name: 'cloud_control', isDefault: true },
        { name: 'account' },
      ]),
    ).toBe('/apps/cloud_control');
  });

  it('names the app ROOT, never a page inside it', () => {
    // `AppContent.resolveLandingRoute()` owns "where does an app open".
    // Naming a page here would fork that policy and drift when nav re-orders.
    const path = resolveDeclaredHomePath([{ name: 'cloud_control', isDefault: true }]);
    expect(path).toBe('/apps/cloud_control');
    expect(path).not.toContain('/page/');
  });

  it('answers null when no app declares a landing — the ordinary environment', () => {
    expect(resolveDeclaredHomePath([{ name: 'crm' }, { name: 'setup' }])).toBeNull();
    expect(resolveDeclaredHomePath([{ name: 'crm', isDefault: false }])).toBeNull();
  });

  it('answers null for empty / absent lists rather than guessing', () => {
    expect(resolveDeclaredHomePath([])).toBeNull();
    expect(resolveDeclaredHomePath(null)).toBeNull();
    expect(resolveDeclaredHomePath(undefined)).toBeNull();
  });

  it('ignores a declaration with no name — an unroutable app is no declaration', () => {
    expect(resolveDeclaredHomePath([{ isDefault: true }, { name: 'crm' }])).toBeNull();
    expect(
      resolveDeclaredHomePath([{ isDefault: true }, { name: 'crm', isDefault: true }]),
    ).toBe('/apps/crm');
  });

  it('takes the first declaration when a deployment declares more than one', () => {
    expect(
      resolveDeclaredHomePath([
        { name: 'first', isDefault: true },
        { name: 'second', isDefault: true },
      ]),
    ).toBe('/apps/first');
  });

  it('reads `isDefault` strictly, so a truthy non-true value is not a declaration', () => {
    // Metadata arrives off the wire; `isDefault: 'false'` (a string) must not
    // route. The `/` resolver has always compared with `=== true`.
    expect(
      resolveDeclaredHomePath([{ name: 'crm', isDefault: 'false' as unknown as boolean }]),
    ).toBeNull();
  });

  it('keeps the launcher path spelled once', () => {
    expect(HOME_LAUNCHER_PATH).toBe('/home');
  });
});
