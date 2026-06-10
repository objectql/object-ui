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
 * Server-side: see
 *   cloud/packages/service-cloud/src/multi-environment-plugins.ts
 *   cloud/packages/service-cloud/src/single-environment-plugin.ts
 *   framework/packages/runtime/src/cloud/runtime-config-plugin.ts
 */

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
}

export interface RuntimeBranding {
  /** Product name shown in browser title, splash, account chrome. */
  productName: string;
  /** Short variant for PWA shortName / compact spots. */
  productShortName: string;
}

export interface RuntimeConfig {
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

const defaults: RuntimeConfig = {
  cloudUrl: '',
  singleEnvironment: false,
  defaultOrgId: null,
  defaultEnvironmentId: null,
  features: { installLocal: false, marketplace: true, aiStudio: true, autoPublishAiBuilds: true },
  branding: { productName: 'ObjectOS', productShortName: 'ObjectOS' },
};

let current: RuntimeConfig = { ...defaults };
let initialised = false;

/** Apply a partial update over the singleton. */
function applyUpdate(patch: Partial<RuntimeConfig>): void {
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
 */
export async function initRuntimeConfig(baseUrl: string = ''): Promise<void> {
  const base = (baseUrl || '').replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/api/v1/runtime/config`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return;
    const body = (await res.json()) as Partial<RuntimeConfig> | null;
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
export function getRuntimeConfig(): RuntimeConfig {
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

/** Test/dev helper. */
export function resetRuntimeConfigForTesting(): void {
  current = {
    ...defaults,
    features: { ...defaults.features },
    branding: { ...defaults.branding },
  };
  initialised = false;
}
