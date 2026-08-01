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
    expect(spec!.message).toContain('Your free plan includes one production environment');
    expect(spec!.cta).toEqual({ label: 'Upgrade plan', url: '/settings/billing' });
  });

  it('names a paid plan in the plan-locked copy', () => {
    const spec = entitlementDialogFromError({ code: 'DEV_ENV_PLAN_LOCKED', plan: 'team' });
    expect(spec!.message).toContain('Your team plan includes');
  });

  it('maps DEV_ENV_LIMIT to an upgrade dialog (limit-reached title)', () => {
    const spec = entitlementDialogFromError({ code: 'DEV_ENV_LIMIT', upgrade_url: '/u' });
    expect(spec!.title).toBe('Development environment limit reached');
    expect(spec!.cta!.url).toBe('/u');
    expect(spec!.message).toContain('Capacity scales with AI seats');
  });

  it('quotes the seat-pool usage when the server reports counts', () => {
    const spec = entitlementDialogFromError({ code: 'DEV_ENV_LIMIT', current: 3, limit: 3 });
    expect(spec!.message).toContain('using 3 of 3 development environments');
  });

  // cloud#948 nested every coded error under `error: { … }`. Reading `code` off
  // the top level made this mapper return null against an up-to-date control
  // plane, degrading the friendly dialog to a generic red toast.
  it('reads the nested cloud#948 error envelope', () => {
    const spec = entitlementDialogFromError({
      success: false,
      error: {
        code: 'DEV_ENV_PLAN_LOCKED',
        message: 'Development environments are a paid feature. …',
        httpStatus: 403,
        plan: 'free',
        upgrade_url: '/settings/billing',
      },
    });
    expect(spec).not.toBeNull();
    expect(spec!.code).toBe('DEV_ENV_PLAN_LOCKED');
    expect(spec!.cta).toEqual({ label: 'Upgrade plan', url: '/settings/billing' });
  });

  it('still reads the legacy flat body (older control planes)', () => {
    const spec = entitlementDialogFromError({
      success: false,
      error: 'Development environments are a paid feature. …',
      code: 'DEV_ENV_PLAN_LOCKED',
      upgrade_url: '/legacy',
    });
    expect(spec!.cta!.url).toBe('/legacy');
  });

  // cloud#959 — the dialog is a paid-conversion surface, so its copy comes from
  // the Console's own locale bundle rather than the (possibly older, possibly
  // English-only) control plane.
  it('renders localized copy when a translator is supplied, ignoring server prose', () => {
    const zh = (key: string, o?: any) =>
      ({
        'environment.entitlement.planLockedTitle': '开发环境是付费功能',
        'environment.entitlement.planLockedBody': `${o?.plan}包含一个生产环境。升级后即可添加开发环境。`,
        'environment.entitlement.freePlan': '免费版',
        'environment.entitlement.upgradeCta': '升级套餐',
      })[key] ?? key;
    const spec = entitlementDialogFromError(
      { error: { code: 'DEV_ENV_PLAN_LOCKED', message: 'Development environments are a paid feature.' } },
      zh,
    );
    expect(spec!.title).toBe('开发环境是付费功能');
    expect(spec!.message).toBe('免费版包含一个生产环境。升级后即可添加开发环境。');
    expect(spec!.cta!.label).toBe('升级套餐');
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

  // The lowercase-`your` sentence users reported (cloud#959) came from this
  // builder, not from the control plane.
  it('opens the sentence with a capital letter', () => {
    const spec = upgradeDialogSpec(base({ plan: 'free' }));
    expect(spec.message.startsWith('Your ')).toBe(true);
  });

  it('reads identically to the reactive DEV_ENV_PLAN_LOCKED dialog', () => {
    const proactive = upgradeDialogSpec(base({ plan: 'free', upgradeUrl: '/settings/billing' }));
    const reactive = entitlementDialogFromError({
      error: { code: 'DEV_ENV_PLAN_LOCKED', plan: 'free', upgrade_url: '/settings/billing' },
    });
    expect(reactive).toEqual(proactive);
  });

  it('localizes through the supplied translator', () => {
    const zh = (key: string, o?: any) =>
      ({
        'environment.entitlement.planLockedTitle': '开发环境是付费功能',
        'environment.entitlement.planLockedBody': `${o?.plan}包含一个生产环境。`,
        'environment.entitlement.freePlan': '免费版',
        'environment.entitlement.upgradeCta': '升级套餐',
      })[key] ?? key;
    const spec = upgradeDialogSpec(base({ plan: 'free' }), zh);
    expect(spec.title).toBe('开发环境是付费功能');
    expect(spec.message).toBe('免费版包含一个生产环境。');
  });
});
