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
 * Minimal translator — structurally `useObjectTranslation()`'s `t`, passed IN
 * rather than imported so this module stays dependency-free and the specs stay
 * unit-testable without an i18n provider. Omit it and the English defaults are
 * used (with `{{token}}` interpolation applied locally).
 */
export type EntitlementTranslate = (key: string, options?: Record<string, any>) => string;

/** English default + `{{token}}` interpolation, for callers with no `t`. */
function fallbackTranslate(key: string, options?: Record<string, any>): string {
  const raw = typeof options?.defaultValue === 'string' ? options.defaultValue : key;
  return raw.replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(options?.[name] ?? ''));
}

/**
 * The plan phrase interpolated into the plan-locked copy — "free plan" /
 * "team plan" in English, 「免费版」/「team 版」in Chinese.
 */
function planPhrase(t: EntitlementTranslate, plan: unknown): string {
  return typeof plan === 'string' && plan && plan !== 'free'
    ? t('environment.entitlement.namedPlan', { plan, defaultValue: '{{plan}} plan' })
    : t('environment.entitlement.freePlan', { defaultValue: 'free plan' });
}

/**
 * Read the coded-error fields off a cloud error body, tolerating BOTH shapes:
 *
 *   • nested (cloud#948 and later) — `{ success, error: { code, message, … } }`
 *   • flat (older control planes)  — `{ success, error: '…', code, … }`
 *
 * The nested envelope moved `code` a level down, which made this mapper return
 * `null` for every entitlement 403 — so the friendly upgrade dialog silently
 * degraded to a generic red toast against an up-to-date control plane. Control
 * planes upgrade independently of the Console, so both shapes stay supported.
 */
function entitlementErrorFields(body: any): any {
  const nested = body?.error;
  return nested && typeof nested === 'object' ? nested : body;
}

/**
 * Map a cloud env-create 403 body to a dialog spec. Returns `null` for any
 * non-entitlement error so the caller falls back to its normal error handling
 * (a red toast). This is the safety net: it fires regardless of whether the
 * up-front state-aware presentation was right.
 *
 * The copy is the CONSOLE's, not the server's: a control plane may be older
 * than the Console (or newer), and its prose is only localized from cloud#959
 * on. Rendering our own localized strings — from the same code + counts the
 * server reports — keeps this dialog in the user's language either way, and
 * keeps it identical to the proactive prompt in {@link upgradeDialogSpec}.
 */
export function entitlementDialogFromError(body: any, t: EntitlementTranslate = fallbackTranslate): EntitlementDialogSpec | null {
  const fields = entitlementErrorFields(body);
  const code = fields?.code;
  if (!isEntitlementErrorCode(code)) return null;
  const upgradeUrl =
    typeof fields?.upgrade_url === 'string' && fields.upgrade_url ? fields.upgrade_url : DEFAULT_UPGRADE_URL;
  const contactUrl = typeof fields?.contact_url === 'string' && fields.contact_url ? fields.contact_url : '';

  if (code === 'PRODUCTION_ENV_LIMIT') {
    return {
      code,
      title: t('environment.entitlement.productionLimitTitle', {
        defaultValue: 'You already have your production environment',
      }),
      message: t('environment.entitlement.productionLimitBody', {
        defaultValue:
          'Each organization includes exactly one production environment. Create a separate organization for another, or contact us about an Enterprise arrangement.',
      }),
      cta: contactUrl
        ? { label: t('environment.entitlement.contactSalesCta', { defaultValue: 'Contact sales' }), url: contactUrl }
        : undefined,
    };
  }

  const upgradeCta = {
    label: t('environment.entitlement.upgradeCta', { defaultValue: 'Upgrade plan' }),
    url: upgradeUrl,
  };

  if (code === 'DEV_ENV_PLAN_LOCKED') {
    return {
      code,
      title: t('environment.entitlement.planLockedTitle', {
        defaultValue: 'Development environments are a paid feature',
      }),
      message: t('environment.entitlement.planLockedBody', {
        plan: planPhrase(t, fields?.plan),
        defaultValue:
          'Your {{plan}} includes one production environment. Upgrade to add development environments — build in dev, then publish to production.',
      }),
      cta: upgradeCta,
    };
  }

  // DEV_ENV_LIMIT — a paid org that exhausted its seat-scaled pool. Quote the
  // usage when the server reported it; the counts carry the same information
  // the server's own prose did.
  const used = Number(fields?.current);
  const limit = Number(fields?.limit);
  const hasCounts = Number.isFinite(used) && Number.isFinite(limit);
  return {
    code,
    title: t('environment.entitlement.limitTitle', { defaultValue: 'Development environment limit reached' }),
    message: hasCounts
      ? t('environment.entitlement.limitBodyWithCount', {
          used,
          limit,
          defaultValue:
            'You are using {{used}} of {{limit}} development environments. Capacity scales with AI seats — add an AI seat, or archive an unused development environment to free one up.',
        })
      : t('environment.entitlement.limitBody', {
          defaultValue:
            'Capacity scales with AI seats. Add an AI seat, or archive an unused development environment to free one up.',
        }),
    cta: upgradeCta,
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
export function upgradeDialogSpec(
  state: EnvironmentEntitlementsState,
  t: EntitlementTranslate = fallbackTranslate,
): EntitlementDialogSpec {
  return {
    code: 'DEV_ENV_PLAN_LOCKED',
    title: t('environment.entitlement.planLockedTitle', {
      defaultValue: 'Development environments are a paid feature',
    }),
    message: t('environment.entitlement.planLockedBody', {
      plan: planPhrase(t, state.plan),
      defaultValue:
        'Your {{plan}} includes one production environment. Upgrade to add development environments — build in dev, then publish to production.',
    }),
    cta: {
      label: t('environment.entitlement.upgradeCta', { defaultValue: 'Upgrade plan' }),
      url: state.upgradeUrl || DEFAULT_UPGRADE_URL,
    },
  };
}
