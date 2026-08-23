// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Runtime configuration pushed by the server at boot.
 *
 * The SPA fetches `GET /api/v1/runtime/config` once before first paint
 * (`initRuntimeConfig()`) and exposes the response through a module-level
 * singleton (`config` + `getRuntimeConfig()`). Modules that need to know
 * about the upstream cloud URL or capability flags read from here —
 * NEVER from `window.location.hostname` or Vite-time env vars, since
 * those don't reflect the runtime the SPA is actually attached to (e.g.
 * a tenant ObjectOS runtime pointing at a separate cloud control plane).
 *
 * The runtime-config shape lives in app-shell because the Console SPA in
 * `apps/console` consumes app-shell code.
 *
 * Server-side producers of this payload — anchored by exported symbol +
 * package rather than by file path, because the previous path list went stale
 * (the framework implementation moved packages; the cloud repo deleted its
 * dead forked per-environment stack). Nothing imports across the repo
 * boundary, so this list is the only link between the two sides of the shape:
 *
 *   - `RuntimeConfigPlugin` from `@objectstack/cloud-connection` (framework)
 *     — the open implementation. Serves `GET /api/v1/runtime/config` and the
 *     legacy `GET /api/v1/studio/runtime-config` alias, and owns the
 *     `branding` / `features` shape mirrored below.
 *   - `RuntimeConfigPlugin` from `@objectstack/objectos-runtime` (cloud) —
 *     subclasses the open plugin to inject cloud plan policy, i.e. which plan
 *     unlocks `aiStudio` / `customDomain` / `sso`.
 *   - `createStudioRuntimeConfigPlugin` from `@objectstack/service-cloud`
 *     (cloud) — the multi-environment control-plane handshake.
 */

import { sharedGetJson } from '@object-ui/types';

export interface RuntimeFeatures {
  /** "Install to this runtime" button is meaningful on this runtime. */
  installLocal: boolean;
  /** `/api/v1/marketplace/*` is reachable from this runtime. */
  marketplace: boolean;
  /**
   * AI-driven metadata authoring ("online development") is offered by this
   * runtime. Default true; the capability is still gated server-side by the
   * presence of the metadata-authoring agent. When false, the SPA hides the
   * AI authoring affordances (generic data-chat assistant is unaffected).
   */
  aiStudio: boolean;
  /**
   * Auto-publish AI-built apps in the author's own environment. When true, the
   * Studio chat fires the publish-drafts call automatically the moment the
   * agent drafts an app, so the user refreshes and sees it live WITH its sample
   * data — no manual "go home and publish" step. Server-derived from the plan
   * (env-revertible via `OS_AI_AUTOPUBLISH_DISABLED`). Default true.
   */
  autoPublishAiBuilds: boolean;
  /**
   * Branded subdomains + custom (BYO-DNS) domains are available on this
   * environment's plan. Optional commercial flag — absent on self-hosted /
   * vanilla runtimes (treated as off). When false the SPA hides custom-domain
   * settings (or shows them as an upgrade affordance). Server-derived from the
   * plan entitlements (cloud ADR-0011/0012).
   */
  customDomain?: boolean;
  /**
   * SSO / SAML enterprise login is available on this environment's plan.
   * Optional commercial flag — absent on self-hosted / vanilla runtimes
   * (treated as off). Server-derived from the plan entitlements.
   */
  sso?: boolean;
}

/**
 * Product lifecycle stage. Surfaced as a small chip next to the product
 * wordmark: `'preview'` → "Preview", `'beta'` → "Beta"; `'ga'` hides it.
 * Defaults to `'preview'` while the whole platform is pre-GA — operators flip
 * it to `'ga'` at launch (via `OS_PRODUCT_STAGE` / `RuntimeConfigPlugin`) with
 * no code change.
 */
export type PlatformStage = 'preview' | 'beta' | 'ga';

export interface RuntimeBranding {
  /** Product name shown in browser title, splash, account chrome. */
  productName: string;
  /** Short variant for PWA shortName / compact spots. */
  productShortName: string;
  /** Product lifecycle stage — drives the top-bar preview/beta badge. */
  stage?: PlatformStage;
  /** Absolute or relative URL for the product logo. */
  logoUrl?: string;
  /** Absolute or relative URL for the favicon. */
  faviconUrl?: string;
  /** Primary brand hex color (e.g. '#4F46E5'). */
  brandColor?: string;
  /** PWA manifest description. */
  pwaDescription?: string;
  /** PWA theme color hex. */
  pwaThemeColor?: string;
}

/**
 * The SPA's server-pushed runtime configuration — which cloud to talk to, which
 * features are on, and how the product is branded.
 *
 * Named `AppShellRuntimeConfig`, not `RuntimeConfig`: `@objectstack/spec/kernel`
 * exports a `RuntimeConfig` that configures the ObjectStack ENGINE
 * (`engine`, `engineConfig`, `resourceLimits`). The two share not one key —
 * they are unrelated things that happened to pick the same noun
 * (objectstack#4115). `__tests__/spec-symbol-parity.test.ts` pins that the spec
 * does not own this name.
 */
export interface AppShellRuntimeConfig {
  /**
   * Upstream cloud base URL — the SPA dispatches install + env listing
   * directly against this origin. Empty string ⇒ same-origin (i.e. the
   * runtime we're attached to *is* the cloud).
   */
  cloudUrl: string;
  /** Single-environment runtime (CLI `os serve`, etc.). */
  singleEnvironment: boolean;
  defaultOrgId?: string | null;
  defaultEnvironmentId?: string | null;
  features: RuntimeFeatures;
  branding: RuntimeBranding;
}

const defaults: AppShellRuntimeConfig = {
  cloudUrl: '',
  singleEnvironment: false,
  defaultOrgId: null,
  defaultEnvironmentId: null,
  features: { installLocal: false, marketplace: true, aiStudio: true, autoPublishAiBuilds: true, customDomain: false, sso: false },
  // `stage: 'preview'` while the whole platform is pre-GA, so the badge shows
  // out of the box on any runtime that hasn't sent an explicit stage yet.
  branding: { productName: 'ObjectOS', productShortName: 'ObjectOS', stage: 'preview', brandColor: '#4F46E5', pwaThemeColor: '#4f46e5' },
};

/** Valid {@link PlatformStage} values, for validating server-pushed config. */
const PLATFORM_STAGES: readonly PlatformStage[] = ['preview', 'beta', 'ga'];

function isPlatformStage(value: unknown): value is PlatformStage {
  return typeof value === 'string' && (PLATFORM_STAGES as readonly string[]).includes(value);
}

let current: AppShellRuntimeConfig = { ...defaults };
let initialised = false;

/** Apply a partial update over the singleton. */
function applyUpdate(patch: Partial<AppShellRuntimeConfig>): void {
  current = {
    ...current,
    ...patch,
    features: {
      ...current.features,
      ...(patch.features ?? {}),
    },
    branding: {
      ...current.branding,
      ...(patch.branding ?? {}),
    },
  };
}

/**
 * Fetch the server-pushed runtime config and merge it into the singleton.
 * Must be awaited before first render so consumers see definitive values
 * on first paint. Safe to call more than once (subsequent calls re-fetch
 * and re-merge).
 *
 * `baseUrl` lets callers in dev (Vite proxy) override the fetch origin.
 * In production both Console SPA and tenant runtime share an origin so
 * the default (relative `/api/v1/...`) works.
 *
 * Goes through {@link sharedGetJson} because this is NOT the page's first ask
 * for this URL (objectui#5544): the inline branding script in
 * `apps/console/index.html` starts the identical request during HTML parse, well
 * before this module chunk is even fetched. Both were measured on prod and
 * staging, and this one is on the critical path — the console awaits it before
 * `createRoot().render()`. Joining the earlier request removes a whole
 * control-plane round trip AND lets this await settle sooner, since it inherits
 * a request that started first. In-flight only: with nothing in flight this
 * fetches normally, and the repeat-call contract above is unchanged, because the
 * registry entry is gone by the time any later call arrives.
 */
export async function initRuntimeConfig(baseUrl: string = ''): Promise<void> {
  const base = (baseUrl || '').replace(/\/+$/, '');
  try {
    const body = await sharedGetJson<Partial<AppShellRuntimeConfig> | null>(
      `${base}/api/v1/runtime/config`,
      { credentials: 'include', headers: { Accept: 'application/json' } },
    );
    if (!body || typeof body !== 'object') return;
    applyUpdate({
      cloudUrl: typeof body.cloudUrl === 'string' ? body.cloudUrl.replace(/\/+$/, '') : current.cloudUrl,
      singleEnvironment: !!body.singleEnvironment,
      defaultOrgId: body.defaultOrgId ?? current.defaultOrgId ?? null,
      defaultEnvironmentId: body.defaultEnvironmentId ?? current.defaultEnvironmentId ?? null,
      features: body.features
        ? {
          installLocal: !!body.features.installLocal,
          marketplace: body.features.marketplace !== false,
          aiStudio: body.features.aiStudio !== false,
          autoPublishAiBuilds: body.features.autoPublishAiBuilds !== false,
          // Commercial flags default OFF unless the server explicitly grants
          // them — never show a paid surface on an unknown/older runtime.
          customDomain: body.features.customDomain === true,
          sso: body.features.sso === true,
        }
        : current.features,
      branding: body.branding
        ? {
          productName:
            typeof body.branding.productName === 'string' && body.branding.productName.trim()
              ? body.branding.productName.trim()
              : current.branding.productName,
          productShortName:
            typeof body.branding.productShortName === 'string' && body.branding.productShortName.trim()
              ? body.branding.productShortName.trim()
              : current.branding.productShortName,
          // Only a recognised stage overrides the default; anything else
          // (missing, typo'd) preserves the current value so the badge never
          // vanishes on a malformed payload.
          stage: isPlatformStage(body.branding.stage) ? body.branding.stage : current.branding.stage,
          logoUrl: typeof body.branding.logoUrl === 'string' && body.branding.logoUrl.trim()
            ? body.branding.logoUrl.trim()
            : current.branding.logoUrl,
          faviconUrl: typeof body.branding.faviconUrl === 'string' && body.branding.faviconUrl.trim()
            ? body.branding.faviconUrl.trim()
            : current.branding.faviconUrl,
          brandColor: typeof body.branding.brandColor === 'string' && body.branding.brandColor.trim()
            ? body.branding.brandColor.trim()
            : current.branding.brandColor,
          pwaDescription: typeof body.branding.pwaDescription === 'string' && body.branding.pwaDescription.trim()
            ? body.branding.pwaDescription.trim()
            : current.branding.pwaDescription,
          pwaThemeColor: typeof body.branding.pwaThemeColor === 'string' && body.branding.pwaThemeColor.trim()
            ? body.branding.pwaThemeColor.trim()
            : current.branding.pwaThemeColor,
        }
        : current.branding,
    });
  } catch {
    // Endpoint missing or network failure ⇒ keep defaults. Older runtimes
    // pre-dating this endpoint simply behave as before.
  } finally {
    initialised = true;
  }
}

/** Read-only accessor. Returns the current snapshot. */
export function getRuntimeConfig(): AppShellRuntimeConfig {
  return current;
}

/**
 * Product name shown in browser title, splash, account chrome.
 * Falls back to `'ObjectOS'` when the server hasn't been contacted yet.
 * Operators override via `OS_PRODUCT_NAME` env var or
 * `new RuntimeConfigPlugin({ productName: 'Acme Studio' })`.
 */
export function getProductName(): string {
  return current.branding?.productName || 'ObjectOS';
}

export function getProductShortName(): string {
  return current.branding?.productShortName || getProductName();
}

/**
 * Product lifecycle stage — drives the top-bar preview/beta badge. Defaults to
 * `'preview'` until the server (or an operator override) says otherwise, so the
 * whole platform reads as preview out of the box; set `'ga'` to hide the badge.
 */
export function getPlatformStage(): PlatformStage {
  return current.branding?.stage ?? 'preview';
}

export function getBrandColor(): string {
  return current.branding?.brandColor || '#4F46E5';
}

export function getLogoUrl(): string | undefined {
  return current.branding?.logoUrl;
}

export function getFaviconUrl(): string | undefined {
  return current.branding?.faviconUrl;
}

export function getPwaDescription(): string {
  return current.branding?.pwaDescription || `${getProductName()} — runtime console`;
}

export function getPwaThemeColor(): string {
  return current.branding?.pwaThemeColor || getBrandColor();
}

/** Whether `initRuntimeConfig()` has run at least once. */
export function isRuntimeConfigInitialised(): boolean {
  return initialised;
}

/**
 * Resolve the upstream cloud base URL the SPA should target. When the
 * runtime says it *is* the cloud (`cloudUrl: ''`) the SPA stays on the
 * current origin. Otherwise this returns the server-supplied URL with no
 * trailing slash.
 */
export function getCloudBase(): string {
  return current.cloudUrl ?? '';
}

/**
 * Is a marketplace catalog reachable from this runtime? (objectui#5504)
 *
 * Reads the server's OWN answer — `features.marketplace`, which
 * `RuntimeConfigPlugin` derives per request from the serving app's route
 * table (objectstack#8356), i.e. "is a `/api/v1/marketplace/*` browse surface
 * actually mounted here". On a runtime deployed with `OS_CLOUD_URL=off`
 * (`none` / `local` / `disabled` alike) the host mounts no marketplace proxy,
 * so the flag arrives `false` while `/api/v1/runtime/config` itself is still
 * served — the EE image wires runtime-config unconditionally and the
 * cloud-dependent surfaces only when `resolveCloudUrl()` is truthy.
 *
 * ⛔ Never infer this from the SHAPE OF A FAILURE. A 404/503 from the
 * marketplace route is equally what a control plane that is merely DOWN
 * produces, and a page that concludes "disabled by configuration" from it
 * tells an operator their config is the problem while their control plane
 * burns. The flag is a property of the runtime's own routing table; a broken
 * upstream leaves it `true` and the load failure stays a load failure.
 *
 * Fails OPEN (`!== false`): a runtime predating `/api/v1/runtime/config`, or
 * one whose config fetch failed, keeps the default `true` and the marketplace
 * stays exactly as visible as it was before this gate existed. Withholding a
 * working capability on an unanswered question is the worse direction.
 */
export function isMarketplaceEnabled(): boolean {
  return current.features?.marketplace !== false;
}

/**
 * Is AI-driven metadata authoring ("online development") offered by this
 * runtime? (objectui#5521 / objectui#5577)
 *
 * Reads the server's OWN answer — `features.aiStudio`, which the runtime
 * derives per request from the same resolution that decides whether the
 * metadata-authoring agent is mounted at all. On the composed hosted-SaaS shape
 * it arrives `false` while the ToolRegistry holds zero authoring handlers and
 * `/api/v1/meta/*` answers 403, so the SPA withholds the authoring entry points
 * instead of offering a front door the backend refuses.
 *
 * Distinct from the PER-PRINCIPAL authoring capability (`useCanAuthorMetadata`):
 * this is the DEPLOYMENT's answer ("is authoring offered here at all"), that one
 * is the caller's ("may THIS principal author"). Both gates are real and neither
 * substitutes for the other.
 *
 * ⛔ Never infer this from the SHAPE OF A FAILURE. A 403/404 from `/api/v1/meta/*`
 * is equally what a permission denial — or a control plane that is merely DOWN —
 * produces, and a page that concludes "authoring is disabled on this runtime"
 * from it tells an operator their deployment is the problem while the real one is
 * their credentials or their upstream. The flag is a property of the runtime's
 * own capability set; a broken upstream leaves it `true` and the failure stays a
 * failure.
 *
 * Fails OPEN (`!== false`): a runtime predating `/api/v1/runtime/config`, or one
 * whose config fetch failed, keeps the default `true` and the AI authoring
 * affordances stay exactly as visible as they were before this gate existed.
 * Withholding a working capability on an unanswered question is the worse
 * direction — the server refuses the write regardless.
 *
 * `features?.` is load-bearing, not decoration. It is why this doctrine belongs
 * in ONE place instead of being retyped per call site: a caller reached through a
 * PARTIAL runtime-config snapshot (a host, or a sibling suite standing the module
 * in as `getRuntimeConfig: () => ({ branding })`) sees `features` genuinely
 * absent, and reading `.aiStudio` off `undefined` is a TypeError — a crash, not a
 * fail-open. PR #5575 measured that exact un-chained shape crashing 29 tests
 * across 4 suites before it was corrected.
 */
export function isAiStudioEnabled(): boolean {
  return current.features?.aiStudio !== false;
}

/** Test/dev helper. */
export function resetRuntimeConfigForTesting(): void {
  current = {
    ...defaults,
    features: { ...defaults.features },
    branding: { ...defaults.branding },
  };
  initialised = false;
}
