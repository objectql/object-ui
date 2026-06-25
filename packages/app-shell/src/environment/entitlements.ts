/**
 * Environment entitlement logic — the React-free decision layer behind the
 * state-aware "create environment" affordance and the entitlement-error dialog.
 *
 * The Console environment list (`sys_environment`) renders a single
 * `create_environment` toolbar action. Whether that should read "Set up your
 * production environment", "Add development environment", or open an upgrade
 * prompt depends on org state the action metadata can't express (does the org
 * already own its one production env? is its plan allowed development envs?).
 * This module turns the org-scoped capacity summary
 * (GET /cloud/environment-entitlements) — with a row-derived fallback — into
 * that decision, and maps the cloud env-create 403 bodies to a friendly dialog
 * so a confused user never sees a raw red error toast.
 *
 * Kept dependency-free so it is trivially unit-testable.
 */

export type EntitlementErrorCode = 'DEV_ENV_PLAN_LOCKED' | 'DEV_ENV_LIMIT' | 'PRODUCTION_ENV_LIMIT';

const ENTITLEMENT_ERROR_CODES = new Set<string>([
  'DEV_ENV_PLAN_LOCKED',
  'DEV_ENV_LIMIT',
  'PRODUCTION_ENV_LIMIT',
]);

export function isEntitlementErrorCode(code: unknown): code is EntitlementErrorCode {
  return typeof code === 'string' && ENTITLEMENT_ERROR_CODES.has(code);
}

/** A CTA link rendered in the entitlement dialog. */
export interface EntitlementCta {
  label: string;
  /** Absolute (http/mailto) or a control-plane-relative path (e.g. `/settings/billing`). */
  url: string;
}

/** Declarative spec the {@link EnvironmentEntitlementDialog} renders. */
export interface EntitlementDialogSpec {
  code: string;
  title: string;
  message: string;
  /** Primary CTA (e.g. Upgrade plan). */
  cta?: EntitlementCta;
  /** Secondary CTA (e.g. Contact sales). */
  secondaryCta?: EntitlementCta;
}

export const DEFAULT_UPGRADE_URL = '/settings/billing';

/**
 * Map a cloud env-create 403 body
 * (`{ error, code, upgrade_url, contact_url, plan, current, limit }`) to a
 * dialog spec. Returns `null` for any non-entitlement error so the caller falls
 * back to its normal error handling (a red toast). This is the safety net: it
 * fires regardless of whether the up-front state-aware presentation was right.
 */
export function entitlementDialogFromError(body: any): EntitlementDialogSpec | null {
  const code = body?.code;
  if (!isEntitlementErrorCode(code)) return null;
  const serverMessage =
    typeof body?.error === 'string' && body.error ? body.error
      : typeof body?.message === 'string' ? body.message : '';
  const upgradeUrl =
    typeof body?.upgrade_url === 'string' && body.upgrade_url ? body.upgrade_url : DEFAULT_UPGRADE_URL;
  const contactUrl = typeof body?.contact_url === 'string' && body.contact_url ? body.contact_url : '';

  if (code === 'PRODUCTION_ENV_LIMIT') {
    return {
      code,
      title: 'You already have your production environment',
      message:
        serverMessage ||
        'Each organization includes exactly one production environment. Create a separate organization for another, or contact us about an Enterprise arrangement.',
      cta: contactUrl ? { label: 'Contact sales', url: contactUrl } : undefined,
    };
  }
  // DEV_ENV_PLAN_LOCKED / DEV_ENV_LIMIT — both resolve via an upgrade CTA.
  return {
    code,
    title:
      code === 'DEV_ENV_PLAN_LOCKED'
        ? 'Development environments are a paid feature'
        : 'Development environment limit reached',
    message:
      serverMessage ||
      (code === 'DEV_ENV_PLAN_LOCKED'
        ? 'Your free plan includes one production environment. Upgrade to add development environments — build in dev, then publish to production.'
        : 'Capacity scales with AI seats. Add an AI seat, or archive an unused development environment to free one up.'),
    cta: { label: 'Upgrade plan', url: upgradeUrl },
  };
}

/** Server summary shape (GET /cloud/environment-entitlements → `data`). */
export interface EnvironmentEntitlementsSummary {
  plan?: string;
  hasProductionEnv?: boolean;
  production?: { used: number; limit: number; canCreate: boolean };
  development?: { used: number; limit: number; canCreate: boolean };
  seatCount?: number;
  upgradeUrl?: string;
  contactSalesUrl?: string;
}

/** Combined client state (authoritative summary, or a row-derived fallback). */
export interface EnvironmentEntitlementsState {
  /** True once a usable signal exists (summary OR derived rows). */
  ready: boolean;
  hasProductionEnv: boolean;
  /** Authoritative dev-create capability; `undefined` when unknown (no summary). */
  canCreateDevelopmentEnv?: boolean;
  plan?: string;
  upgradeUrl: string;
  contactSalesUrl?: string;
  /** Where the signal came from — telemetry + degradation note + tests. */
  source: 'summary' | 'derived' | 'unknown';
}

export type EnvironmentCtaKind = 'setup_production' | 'add_development' | 'upgrade_for_development';

/**
 * Decide which toolbar affordance to present:
 *   • no production env          → set up production (the create POST makes one;
 *                                  the critical historical-data path — never errors)
 *   • has prod + dev allowed     → add development (POST makes a dev env)
 *   • has prod + dev NOT allowed → upgrade prompt (no POST)
 *   • has prod + dev unknown     → add development (let the POST + dialog decide)
 */
export function decideEnvironmentCta(state: EnvironmentEntitlementsState): EnvironmentCtaKind {
  if (!state.hasProductionEnv) return 'setup_production';
  if (state.canCreateDevelopmentEnv === false) return 'upgrade_for_development';
  return 'add_development';
}

/**
 * The proactive (pre-POST) upgrade dialog shown when a free-plan org clicks
 * "Add environment" but development envs aren't in its plan. Mirrors the copy
 * of the reactive DEV_ENV_PLAN_LOCKED error so both paths read identically.
 */
export function upgradeDialogSpec(state: EnvironmentEntitlementsState): EntitlementDialogSpec {
  const planLabel = state.plan && state.plan !== 'free' ? `your ${state.plan} plan` : 'your free plan';
  return {
    code: 'DEV_ENV_PLAN_LOCKED',
    title: 'Development environments are a paid feature',
    message: `${planLabel} includes one production environment. Upgrade to add development environments — build in dev, then publish to production.`,
    cta: { label: 'Upgrade plan', url: state.upgradeUrl || DEFAULT_UPGRADE_URL },
  };
}
