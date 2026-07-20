/**
 * Marketplace REST helper.
 *
 * Thin fetch wrapper around the tenant runtime's marketplace proxy
 * (`/api/v1/marketplace/*`). The proxy forwards to the configured
 * cloud control plane (`OS_CLOUD_URL`) — only browse endpoints are
 * exposed. Install is performed against the cloud action endpoint
 * directly (via `installPackage()` below), which requires the user
 * to have a cloud session.
 *
 * See:
 *   cloud/packages/service-cloud/src/routes/marketplace.ts
 *   framework/packages/runtime/src/cloud/marketplace-proxy-plugin.ts
 */

import { getCloudBase } from '../../runtime-config';
import { TokenStorage } from '@object-ui/auth';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
const API_BASE = `${SERVER_URL}/api/v1/marketplace`;

/**
 * Attach the Bearer token to same-origin `/api/v1/cloud-connection/*` calls.
 *
 * objectui authenticates with a Bearer token (better-auth, stored in
 * localStorage by `@object-ui/auth` and normally injected by the app's
 * `createAuthenticatedFetch` wrapper). These marketplace routes use raw
 * `fetch()` and so bypass that wrapper — relying on `credentials: 'include'`
 * (the session cookie) alone is NOT enough on a tenant runtime: after
 * platform SSO the env's session cookie is not reliably presented, so the
 * cloud-connection route's `resolveEnvSession` finds no session and returns
 * 401 "Sign in to this environment." even though the user is signed in.
 * Injecting the Bearer (which the server's `getSession` accepts) fixes it.
 * `credentials: 'include'` is kept so the cookie still rides along when set.
 */
function withEnvAuth(headers: Record<string, string>): Record<string, string> {
  const token = TokenStorage.get();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

/**
 * Per-locale overrides for translatable package fields. Mirrors
 * `PackageTranslation` from @objectstack/spec/cloud — duplicated here
 * to avoid pulling the spec package into the app-shell bundle.
 * See framework/packages/spec/src/cloud/package.zod.ts.
 */
export interface MarketplacePackageTranslation {
  displayName?: string;
  description?: string;
  readme?: string;
  tagline?: string;
  screenshotCaptions?: Record<string, string>;
}

export type MarketplacePackageTranslations = Record<string, MarketplacePackageTranslation>;

export interface MarketplacePackageSummary {
  id: string;
  manifest_id: string;
  display_name: string;
  description?: string | null;
  category?: string | null;
  tags?: string | null;
  icon_url?: string | null;
  homepage_url?: string | null;
  license?: string | null;
  publisher?: string | null;
  is_starter?: boolean;
  created_at?: string;
  updated_at?: string;
  /**
   * Locale-keyed overrides for display_name / description / readme.
   * Optional on the wire: older control planes / older runtimes may not
   * project this column yet. UI should fall back to the base field.
   */
  translations?: MarketplacePackageTranslations | null;
  latest_version: MarketplacePackageVersion | null;
}

export interface MarketplacePackageDetail extends MarketplacePackageSummary {
  readme?: string | null;
}

/** Structured permission grants a plugin requests (ADR-0025 §3.2). */
export interface PluginPermissions {
  services?: string[];
  hooks?: string[];
  network?: string[];
  fs?: string[];
}

export interface MarketplacePackageVersion {
  id: string;
  version: string;
  status?: string;
  is_prerelease?: boolean;
  published_at?: string | null;
  // Human-authored "what changed in this version" notes (ADR-0010 version
  // lifecycle / UX#6). Distinct from the package-level description; shown per
  // version in the detail page's version history.
  release_notes?: string | null;
  listing_status?: string;
  reviewed_at?: string | null;

  // Plugin distribution disclosure (ADR-0025 PD4 §3.11). Present only for
  // code-bearing versions; the control plane exposes verification STATUS,
  // never the raw signatures.
  artifact_kind?: string;
  /** True when this version carries executable code (a `plugin` artifact). */
  contains_code?: boolean;
  /** Trust tier the plugin runs under: 'node' | 'sandbox' | 'worker'. */
  runtime?: string;
  /** Dependency packaging: 'bundled' | 'manifest-deps'. */
  packaging?: string;
  /** Structured permission set the plugin asks the installer to grant. */
  permissions?: PluginPermissions | null;
  /** Compatibility ranges ({ platform, protocol }). */
  engines?: { platform?: string; protocol?: string } | null;
  /** Whether the artifact carries a verified publisher signature. */
  signed?: boolean;
  /** Whether the marketplace counter-signed (reviewed + approved) this version. */
  platform_verified?: boolean;
}

export interface MarketplaceListResponse {
  items: MarketplacePackageSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface MarketplaceDetailResponse {
  package: MarketplacePackageDetail;
  versions: MarketplacePackageVersion[];
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'omit',
    headers: { 'Accept': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const code = payload?.error?.code ?? payload?.code ?? `HTTP_${res.status}`;
    const message = payload?.error?.message ?? payload?.error ?? res.statusText;
    const err = new Error(typeof message === 'string' ? message : `${code}`);
    (err as any).code = code;
    (err as any).status = res.status;
    throw err;
  }
  // Cloud helpers return `{ success: true, data: ... }`; unwrap when present.
  return (payload?.data ?? payload) as T;
}

export async function listMarketplacePackages(params: { q?: string; category?: string; limit?: number; offset?: number } = {}): Promise<MarketplaceListResponse> {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (params.category) usp.set('category', params.category);
  if (params.limit != null) usp.set('limit', String(params.limit));
  if (params.offset != null) usp.set('offset', String(params.offset));
  const qs = usp.toString();
  return call<MarketplaceListResponse>(`/packages${qs ? `?${qs}` : ''}`);
}

export async function getMarketplacePackage(id: string): Promise<MarketplaceDetailResponse> {
  return call<MarketplaceDetailResponse>(`/packages/${encodeURIComponent(id)}`);
}

/**
 * Install a package into an environment by calling the cloud's
 * `install_package` action **directly** (not via the proxy). Requires the
 * caller's browser to have a valid cloud session cookie — typically
 * because the user has signed into cloud at least once and the cookie
 * domain covers this origin. When that's not the case the call fails
 * with 401; the UI can then surface a "Sign in on cloud" link.
 *
 * `cloudBaseUrl` is supplied by the server at boot via
 * `/api/v1/runtime/config` (see `runtime-config.ts`); we read it through
 * `getCloudBase()` rather than hardcoding `VITE_CLOUD_URL` or sniffing
 * `window.location.hostname`. When the runtime *is* the cloud,
 * `getCloudBase()` returns `''` and we fall back to same-origin.
 */

export interface InstallResponse {
  installation?: { id: string; environment_id: string; package_id: string; version: string };
  message?: string;
  [k: string]: any;
}

export async function installPackage(input: {
  packageId: string;
  environmentId: string;
  seedSampleData?: boolean;
}): Promise<InstallResponse> {
  const cloudBase = getCloudBase();

  // ── In-environment (tenant runtime) path ──────────────────────────────
  // When `getCloudBase()` is non-empty we're a *tenant runtime* (e.g.
  // crm.objectos.app) whose marketplace browses a *separate* cloud origin.
  // POSTing the install straight to `${cloudBase}/api/v1/actions/...` is a
  // cross-origin, credentialed request that the browser blocks with
  // "Failed to fetch" (no CORS allowance + cross-site cookie). Instead we
  // call the SAME-ORIGIN `/api/v1/cloud-connection/install` route that the
  // cloud-owned runtime plugin mounts: it authorizes via the environment's
  // own session and forwards to cloud server-to-server (no CORS, no leaked
  // cross-site cookie). The target environment is the current one, resolved
  // by hostname on the server. See
  // docs/design/cloud-account-binding-marketplace-install.md (cloud repo).
  if (cloudBase) {
    const res = await fetch(`/api/v1/cloud-connection/install`, {
      method: 'POST',
      credentials: 'include',
      headers: withEnvAuth({ 'Accept': 'application/json', 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        package_id: input.packageId,
        seed_sample_data: !!input.seedSampleData,
      }),
    });
    let payload: any = null;
    try { payload = await res.json(); } catch { /* empty */ }
    if (!res.ok || payload?.success === false) {
      const code = payload?.error?.code ?? payload?.code ?? `HTTP_${res.status}`;
      const message = payload?.error?.message ?? payload?.error ?? payload?.message ?? res.statusText;
      const err = new Error(typeof message === 'string' ? message : `${code}`);
      (err as any).code = code;
      (err as any).status = res.status;
      throw err;
    }
    return (payload?.data ?? payload) as InstallResponse;
  }

  // ── Cloud control-plane path (runtime IS cloud) ───────────────────────
  // Same-origin direct call to the install action.
  const base = SERVER_URL;
  const res = await fetch(`${base}/api/v1/actions/sys_package/install_package`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recordId: input.packageId,
      params: {
        environment_id: input.environmentId,
        seed_sample_data: !!input.seedSampleData,
      },
    }),
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const code = payload?.code ?? payload?.error?.code ?? `HTTP_${res.status}`;
    const message = payload?.error ?? payload?.message ?? res.statusText;
    const err = new Error(typeof message === 'string' ? message : `${code}`);
    (err as any).code = code;
    (err as any).status = res.status;
    throw err;
  }
  return (payload?.data ?? payload) as InstallResponse;
}

/**
 * Helper: list environments visible to the current cloud user (active
 * organisation). Used to populate the install dialog's environment picker.
 * Calls cloud directly — same auth model as `installPackage`.
 */
export interface CloudEnvironment {
  id: string;
  display_name?: string;
  hostname?: string;
  organization_id?: string;
  plan?: string;
  status?: string;
}

export async function listCloudEnvironments(): Promise<CloudEnvironment[]> {
  const base = getCloudBase() || SERVER_URL;
  const res = await fetch(`${base}/api/v1/data/sys_environment?limit=200`, {
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const err = new Error(`HTTP_${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  const payload: any = await res.json().catch(() => ({}));
  // Cloud's data API returns `{ object, records, total, hasMore }`.
  // We keep `data` / `items` as fallbacks for older builds.
  const rows = payload?.records ?? payload?.data ?? payload?.items ?? payload ?? [];
  return Array.isArray(rows) ? (rows as CloudEnvironment[]) : [];
}

/**
 * List orgs in which the current cloud user has an `owner` or `admin`
 * role on `sys_member`. Used to filter the install dialog's env picker
 * — only envs whose `organization_id` is in this set are installable
 * (the backend enforces the same gate; this is the UX mirror).
 *
 * Returns an empty set on 401 / network failure so the install dialog
 * can render a clean "no installable environments" state.
 *
 * Hardening: we *always* re-filter rows by the caller's session
 * `user_id` because the data API currently returns sys_member rows
 * without per-caller scoping. Without this, the dialog would pick up
 * every org in the system and offer their envs as install targets.
 */
export async function listInstallableOrgIds(): Promise<Set<string>> {
  const base = getCloudBase() || SERVER_URL;
  let meId: string | null = null;
  try {
    const meRes = await fetch(`${base}/api/v1/auth/get-session`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (meRes.ok) {
      const meBody: any = await meRes.json().catch(() => ({}));
      meId = meBody?.user?.id ?? null;
    }
  } catch {
    /* fall through — meId stays null and we return empty set */
  }
  if (!meId) return new Set();

  const url = `${base}/api/v1/data/sys_member?limit=200`;
  // Assigned in the try below before the read; the only fall-through path is a
  // successful fetch (both the !ok branch and the catch return early).
  let payload: any;
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return new Set();
    payload = await res.json().catch(() => ({}));
  } catch {
    return new Set();
  }
  const rows: any[] = payload?.records ?? payload?.data ?? payload?.items ?? payload ?? [];
  if (!Array.isArray(rows)) return new Set();
  const ids = new Set<string>();
  for (const row of rows) {
    const rowUserId = String(row?.user_id ?? row?.userId ?? '');
    if (rowUserId !== meId) continue;
    const role = String(row?.role ?? '').toLowerCase();
    const orgId = row?.organization_id ?? row?.organizationId;
    if (orgId && (role === 'owner' || role === 'admin')) {
      ids.add(String(orgId));
    }
  }
  return ids;
}

export function cloudInstallDeepLink(packageId: string): string {
  const base = getCloudBase() || 'https://cloud.objectos.app';
  return `${base}/apps/cloud-control/sys_package/${encodeURIComponent(packageId)}`;
}

/**
 * Deep-link to the cloud upgrade entry point: the environments list, where each
 * environment's "Upgrade Plan" action opens Stripe checkout. Surfaced from the
 * tenant SPA when an AI quota refusal (429) offers an upgrade / top-up CTA.
 * Centralized so the target can be re-pointed (dedicated pricing or credit-pack
 * page) as the cloud billing UI evolves. Same `cloud-control` app slug as
 * cloudInstallDeepLink above.
 */
export function cloudPricingDeepLink(): string {
  const base = getCloudBase() || 'https://cloud.objectos.app';
  return `${base}/apps/cloud-control/sys_environment`;
}

/**
 * Look up whether a package is already installed in the given environment.
 * Returns the installed version string when an `enabled=true` row exists,
 * or `null` when no install row is found.
 *
 * Used by `MarketplacePackagePage` to flip the primary CTA from
 * "Install to Cloud" → "Installed" on initial render — without it, the
 * button keeps inviting users to install a package that's already
 * installed and the install call surfaces a confusing "already exists"
 * error.
 */
export interface CloudInstallationInfo {
  installationId: string;
  version: string;
  withSampleData: boolean;
}

export async function getCloudInstalledVersion(
  packageId: string,
  environmentId: string,
): Promise<string | null> {
  const info = await getCloudInstallationInfo(packageId, environmentId);
  return info ? info.version : null;
}

/**
 * Richer companion to {@link getCloudInstalledVersion}. Returns the
 * full installation handle (id, version, sample-data flag) so the
 * Marketplace UI can render reseed / purge actions.
 */
export async function getCloudInstallationInfo(
  packageId: string,
  environmentId: string,
): Promise<CloudInstallationInfo | null> {
  if (!packageId) return null;

  // ── In-environment (tenant runtime) path ──────────────────────────────
  // When `getCloudBase()` is non-empty we're a tenant runtime browsing a
  // *separate* cloud origin. A direct `${cloudBase}/api/v1/data/...` read is
  // a cross-origin, cross-site-cookie request the browser blocks — the exact
  // reason `installPackage()` routes through the same-origin proxy. Mirror it
  // here: the cloud-owned runtime plugin's `/cloud-connection/installation`
  // route resolves the env by hostname and queries the control plane
  // server-to-server. Without this, the "Installed" CTA never flips and an
  // already-installed package keeps inviting another install.
  const cloudBase = getCloudBase();
  if (cloudBase) {
    try {
      const res = await fetch(
        `/api/v1/cloud-connection/installation?package_id=${encodeURIComponent(packageId)}`,
        { credentials: 'include', headers: withEnvAuth({ 'Accept': 'application/json' }) },
      );
      if (!res.ok) return null;
      const payload: any = await res.json().catch(() => ({}));
      const data: any = payload?.data ?? payload ?? {};
      if (!data.installed) return null;
      return {
        installationId: String(data.installationId ?? ''),
        version: String(data.version ?? 'installed'),
        withSampleData: data.withSampleData === true,
      };
    } catch {
      return null;
    }
  }

  // ── Cloud control-plane path (runtime IS cloud) ───────────────────────
  // Use the dedicated installed-state route, NOT the generic
  // `/api/v1/data/sys_package_installation`. The control plane does not expose
  // sys_package_installation rows through the generic data API (the row exists
  // but the read returns empty), and that row carries `package_version_id`, not
  // a version string. The dedicated route reads the control DB directly and
  // resolves the human-readable version — and now enforces org membership for
  // user-mode callers. Same response shape as the tenant proxy above.
  if (!environmentId) return null;
  const base = SERVER_URL;
  try {
    const res = await fetch(
      `${base}/api/v1/cloud/environments/${encodeURIComponent(environmentId)}/installations/${encodeURIComponent(packageId)}`,
      { credentials: 'include', headers: { 'Accept': 'application/json' } },
    );
    if (!res.ok) return null;
    const payload: any = await res.json().catch(() => ({}));
    const data: any = payload?.data ?? payload ?? {};
    if (!data.installed) return null;
    return {
      installationId: String(data.installationId ?? ''),
      version: String(data.version ?? 'installed'),
      withSampleData: data.withSampleData === true,
    };
  } catch {
    return null;
  }
}

/** POST /api/v1/cloud/installations/:id/reseed-sample-data */
export async function reseedSampleData(installationId: string): Promise<{ ok: boolean; error?: string }> {
  if (!installationId) return { ok: false, error: 'installation id required' };
  const base = getCloudBase() || SERVER_URL;
  try {
    const res = await fetch(`${base}/api/v1/cloud/installations/${encodeURIComponent(installationId)}/reseed-sample-data`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    });
    const payload: any = await res.json().catch(() => ({}));
    if (!res.ok || payload?.success === false) {
      return { ok: false, error: payload?.error || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}

/** POST /api/v1/cloud/installations/:id/purge-sample-data */
export async function purgeSampleData(installationId: string): Promise<{ ok: boolean; deleted?: number; error?: string }> {
  if (!installationId) return { ok: false, error: 'installation id required' };
  const base = getCloudBase() || SERVER_URL;
  try {
    const res = await fetch(`${base}/api/v1/cloud/installations/${encodeURIComponent(installationId)}/purge-sample-data`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    });
    const payload: any = await res.json().catch(() => ({}));
    if (!res.ok || payload?.success === false) {
      return { ok: false, error: payload?.error || `HTTP ${res.status}` };
    }
    return { ok: true, deleted: Number(payload?.data?.deleted ?? 0) };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Network error' };
  }
}

// ────────────────────────────────────────────────────────────────────
// Local install (this runtime's kernel — not a cloud environment)
// ────────────────────────────────────────────────────────────────────
//
// Architecturally distinct from cloud install:
//   - Single target = the local kernel; no env picker.
//   - Same-origin POST against the local runtime (no CORS).
//   - Local AuthPlugin session is sufficient — no cloud account required.
//   - Manifest is cached on disk so the app keeps working offline.
//
// Backend: framework/packages/runtime/src/cloud/marketplace-install-local-plugin.ts

export interface LocalInstallEntry {
  packageId: string;
  versionId: string;
  manifestId: string;
  version: string;
  installedAt: string;
  installedBy: string | null;
  /** Whether the bundled seed datasets are currently loaded in the local
   *  kernel DB. True after install (with seed) or reseed; false after purge. */
  withSampleData?: boolean;
}

export interface LocalInstallResult {
  manifestId: string;
  version: string;
  versionId: string;
  installedAt: string;
  hotLoaded: boolean;
  upgradedFrom: string | null;
  note?: string;
}

/**
 * Org-scoped catalog (ADR-0007 step ②). The caller's own organization's
 * packages (visibility org/private) — discoverable + installable from inside
 * the environment via the same-origin /cloud-connection/org-packages proxy,
 * distinct from the public marketplace browse. `connected: false` → not
 * cloud-bound (self-hosted), so there is no org catalog to show.
 */
export interface OrgPackageSummary {
  id: string;
  manifest_id: string;
  display_name: string;
  description?: string | null;
  category?: string | null;
  icon_url?: string | null;
  visibility?: string;
  latest_version?: string | null;
}
export interface OrgPackagesResult {
  connected: boolean;
  items: OrgPackageSummary[];
}
export async function listOrgPackages(): Promise<OrgPackagesResult> {
  try {
    const res = await fetch(`${SERVER_URL}/api/v1/cloud-connection/org-packages`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { connected: false, items: [] };
    const payload: any = await res.json().catch(() => ({}));
    const data: any = payload?.data ?? {};
    const items: OrgPackageSummary[] = Array.isArray(data.items) ? data.items : [];
    return { connected: data.connected === true, items };
  } catch {
    return { connected: false, items: [] };
  }
}

export async function installLocal(input: {
  packageId: string;
  versionId?: string;
}): Promise<LocalInstallResult> {
  const res = await fetch(`${API_BASE}/install-local`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      packageId: input.packageId,
      ...(input.versionId ? { versionId: input.versionId } : {}),
    }),
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const code = payload?.error?.code ?? `HTTP_${res.status}`;
    const message = payload?.error?.message ?? res.statusText;
    const err = new Error(typeof message === 'string' ? message : `${code}`);
    (err as any).code = code;
    (err as any).status = res.status;
    throw err;
  }
  return (payload?.data ?? payload) as LocalInstallResult;
}

export async function listLocalInstalls(): Promise<LocalInstallEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/install-local`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return [];
    const payload: any = await res.json().catch(() => ({}));
    const items = payload?.data?.items ?? payload?.items ?? [];
    return Array.isArray(items) ? (items as LocalInstallEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Cloud-managed installed list (ADR-0007 step ①).
 *
 * For a cloud-connected environment, the authoritative "what's installed"
 * lives in the control plane's `sys_package_installation`, NOT the runtime's
 * local `.objectstack/installed-packages/` cache. A tenant SPA can't read the
 * control plane cross-origin, so the env's own runtime proxies it at the
 * same-origin `/api/v1/cloud-connection/installed` route. This surfaces
 * packages installed via ANY path (CLI `--env --install`, marketplace, REST).
 *
 * `connected: false` means this runtime is self-hosted / not cloud-bound — the
 * caller should fall back to {@link listLocalInstalls}.
 */
export interface InstalledPackagesResult {
  connected: boolean;
  items: LocalInstallEntry[];
}

export async function listInstalledPackages(): Promise<InstalledPackagesResult> {
  try {
    const res = await fetch(`${SERVER_URL}/api/v1/cloud-connection/installed`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { connected: false, items: [] };
    const payload: any = await res.json().catch(() => ({}));
    const data: any = payload?.data ?? {};
    const pkgs: any[] = Array.isArray(data.packages) ? data.packages : [];
    const items: LocalInstallEntry[] = pkgs.map((p) => {
      const manifestId = String(p.packageId ?? p.package_id ?? '');
      return {
        packageId: manifestId,
        versionId: String(p.package_version_id ?? ''),
        manifestId,
        version: String(p.version ?? 'installed'),
        installedAt: String(p.installed_at ?? p.installedAt ?? ''),
        installedBy: (p.installed_by ?? p.installedBy ?? null) as string | null,
        withSampleData: p.with_sample_data === true || p.withSampleData === true,
      };
    });
    return { connected: data.connected === true, items };
  } catch {
    return { connected: false, items: [] };
  }
}

export async function uninstallLocal(manifestId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/install-local/${encodeURIComponent(manifestId)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const payload: any = await res.json().catch(() => ({}));
    const message = payload?.error?.message ?? res.statusText;
    throw new Error(typeof message === 'string' ? message : `HTTP_${res.status}`);
  }
}

export interface LocalSampleDataResult {
  manifestId: string;
  inserted?: number;
  updated?: number;
  deleted?: number;
  skipped?: number;
  errors?: number;
  withSampleData: boolean;
}

async function postLocalSampleAction(manifestId: string, action: 'reseed' | 'purge'): Promise<LocalSampleDataResult> {
  const path = action === 'reseed' ? 'reseed-sample-data' : 'purge-sample-data';
  const res = await fetch(`${API_BASE}/install-local/${encodeURIComponent(manifestId)}/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Accept': 'application/json' },
  });
  const payload: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = payload?.error?.message ?? res.statusText;
    const err = new Error(typeof message === 'string' ? message : `HTTP_${res.status}`);
    (err as any).code = payload?.error?.code ?? `HTTP_${res.status}`;
    throw err;
  }
  return (payload?.data ?? payload) as LocalSampleDataResult;
}

export function reseedLocalSampleData(manifestId: string): Promise<LocalSampleDataResult> {
  return postLocalSampleAction(manifestId, 'reseed');
}

export function purgeLocalSampleData(manifestId: string): Promise<LocalSampleDataResult> {
  return postLocalSampleAction(manifestId, 'purge');
}
