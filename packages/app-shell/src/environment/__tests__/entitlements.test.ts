/**
 * Unit coverage for the React-free environment entitlement decision layer:
 *   - entitlementDialogFromError: cloud 403 body → friendly dialog spec (or null)
 *   - decideEnvironmentCta: org state → which toolbar affordance
 *   - upgradeDialogSpec: proactive upgrade prompt
 */

import { describe, it, expect } from 'vitest';
import {
  isEntitlementErrorCode,
  entitlementDialogFromError,
  decideEnvironmentCta,
  upgradeDialogSpec,
  type EnvironmentEntitlementsState,
} from '../entitlements';

const base = (over: Partial<EnvironmentEntitlementsState>): EnvironmentEntitlementsState => ({
  ready: true,
  hasProductionEnv: true,
  upgradeUrl: '/settings/billing',
  source: 'summary',
  ...over,
});

describe('isEntitlementErrorCode', () => {
  it('recognizes only the three entitlement codes', () => {
    expect(isEntitlementErrorCode('DEV_ENV_PLAN_LOCKED')).toBe(true);
    expect(isEntitlementErrorCode('DEV_ENV_LIMIT')).toBe(true);
    expect(isEntitlementErrorCode('PRODUCTION_ENV_LIMIT')).toBe(true);
    expect(isEntitlementErrorCode('SOMETHING_ELSE')).toBe(false);
    expect(isEntitlementErrorCode(undefined)).toBe(false);
  });
});

describe('entitlementDialogFromError', () => {
  it('returns null for non-entitlement errors (so a normal toast still fires)', () => {
    expect(entitlementDialogFromError({ error: 'Boom' })).toBeNull();
    expect(entitlementDialogFromError(null)).toBeNull();
    expect(entitlementDialogFromError({ code: 'VALIDATION' })).toBeNull();
  });

  it('maps DEV_ENV_PLAN_LOCKED to an upgrade dialog with the server upgrade_url', () => {
    const spec = entitlementDialogFromError({
      error: 'Development environments are a paid feature...',
      code: 'DEV_ENV_PLAN_LOCKED',
      upgrade_url: '/settings/billing',
      plan: 'free',
    });
    expect(spec).not.toBeNull();
    expect(spec!.code).toBe('DEV_ENV_PLAN_LOCKED');
    expect(spec!.title).toBe('Development environments are a paid feature');
    expect(spec!.message).toContain('paid feature'); // server message preserved
    expect(spec!.cta).toEqual({ label: 'Upgrade plan', url: '/settings/billing' });
  });

  it('maps DEV_ENV_LIMIT to an upgrade dialog (limit-reached title)', () => {
    const spec = entitlementDialogFromError({ code: 'DEV_ENV_LIMIT', upgrade_url: '/u' });
    expect(spec!.title).toBe('Development environment limit reached');
    expect(spec!.cta!.url).toBe('/u');
  });

  it('maps PRODUCTION_ENV_LIMIT to a contact-sales dialog (no upgrade CTA)', () => {
    const spec = entitlementDialogFromError({
      code: 'PRODUCTION_ENV_LIMIT',
      error: 'You already have your production environment.',
      contact_url: 'mailto:sales@objectos.ai',
    });
    expect(spec!.cta).toEqual({ label: 'Contact sales', url: 'mailto:sales@objectos.ai' });
  });

  it('falls back to a default upgrade_url when the server omits one', () => {
    const spec = entitlementDialogFromError({ code: 'DEV_ENV_PLAN_LOCKED' });
    expect(spec!.cta!.url).toBe('/settings/billing');
    expect(spec!.message).toBeTruthy(); // default copy when server message absent
  });
});

describe('decideEnvironmentCta', () => {
  it('no production env → set up production (the never-error path)', () => {
    expect(decideEnvironmentCta(base({ hasProductionEnv: false }))).toBe('setup_production');
  });
  it('has prod + dev allowed → add development', () => {
    expect(decideEnvironmentCta(base({ canCreateDevelopmentEnv: true }))).toBe('add_development');
  });
  it('has prod + dev NOT allowed → upgrade prompt (no POST)', () => {
    expect(decideEnvironmentCta(base({ canCreateDevelopmentEnv: false }))).toBe('upgrade_for_development');
  });
  it('has prod + dev unknown (no summary) → add development (POST + dialog decides)', () => {
    expect(decideEnvironmentCta(base({ canCreateDevelopmentEnv: undefined, source: 'derived' }))).toBe('add_development');
  });
});

describe('upgradeDialogSpec', () => {
  it('builds a DEV_ENV_PLAN_LOCKED prompt pointing at the upgrade url', () => {
    const spec = upgradeDialogSpec(base({ plan: 'free', upgradeUrl: '/settings/billing', canCreateDevelopmentEnv: false }));
    expect(spec.code).toBe('DEV_ENV_PLAN_LOCKED');
    expect(spec.cta).toEqual({ label: 'Upgrade plan', url: '/settings/billing' });
    expect(spec.message).toContain('free plan');
  });
});
