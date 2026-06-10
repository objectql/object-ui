/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * MetadataClient
 *
 * Thin, framework-agnostic HTTP client for the ObjectStack metadata
 * API (`/api/v1/meta/*`). Used by the platform Setup app surfaces in
 * `@object-ui/plugin-designer` (Object Manager, Field Designer, etc.)
 * so they can read and write protocol metadata without depending on
 * `ObjectStackAdapter` (which is a generic data-source binding and
 * carries a lot of view/dashboard-specific behaviour we don't need
 * here).
 *
 * Endpoints (see `packages/rest/src/rest-server.ts`):
 *   GET    /api/v1/meta                  — list all metadata types
 *   GET    /api/v1/meta/:type            — list items of a type
 *   GET    /api/v1/meta/:type/:name      — get one item (returns the
 *                                          unwrapped item content)
 *   PUT    /api/v1/meta/:type/:name      — save (overlay) one item
 *                                          honours `If-Match` for OCC
 *   DELETE /api/v1/meta/:type/:name      — reset overlay to artifact
 *   GET    /api/v1/meta/:type/:name/history — durable change log
 *
 * The client deliberately keeps the response shape opaque (typed as
 * `unknown`/generic `T`) so callers explicitly narrow per-metadata-
 * type, mirroring the framework's "single Zod source per type" rule.
 */

export interface MetadataClientConfig {
  /** Base URL of the ObjectStack server (no trailing slash needed). */
  baseUrl: string;
  /**
   * Optional environment ID to scope reads/writes to a tenant. When
   * provided, requests use the scoped path
   * `/api/v1/environments/:environmentId/meta/...` and overlays are
   * persisted in the environment's own metadata store.
   */
  environmentId?: string;
  /** Optional custom fetch implementation (defaults to `globalThis.fetch`). */
  fetch?: typeof fetch;
  /** Additional headers (e.g. auth) included on every request. */
  headers?: Record<string, string>;
}

export interface MetadataListOptions {
  /** Filter by source package id (matches the `package` query param). */
  packageId?: string;
}

/**
 * A pending DRAFT metadata item (ADR-0033), as returned by {@link MetadataClient.listDrafts}.
 * Light header — no body — carrying the owning package so the console can group
 * pending changes by app package.
 */
export interface MetadataDraftHeader {
  type: string;
  name: string;
  packageId: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface MetadataSaveOptions {
  /**
   * Optimistic concurrency token (the `checksum` returned by the last
   * read). When present, sent as the `If-Match` header so concurrent
   * edits get a 409 instead of overwriting each other.
   */
  ifMatch?: string;
  /** Optional actor id, sent as `X-Actor` for history attribution. */
  actor?: string;
  /**
   * Bypass destructive-change protection (Phase 3a). The server returns
   * `409 destructive_change` with `issues[]` if a write would drop or
   * narrow data; setting `force: true` adds `?force=true` to the request
   * so the operator can confirm and proceed.
   */
  force?: boolean;
  /**
   * Save mode — `'draft'` writes a pending draft row (invisible to the
   * runtime until `publish()` is called); `'publish'` writes directly
   * to the active overlay. Omit (or set `'publish'`) for the legacy
   * "save = live" behaviour.
   */
  mode?: 'draft' | 'publish';
  /**
   * Software-package id to bind the saved row to (sent as the `package`
   * query param → `sys_metadata.package_id`). Set when authoring inside a
   * Studio package workspace. Omit for an env-local overlay.
   */
  packageId?: string;
}

export interface MetadataGetOptions {
  /**
   * Read a specific overlay state. `'draft'` returns the pending draft
   * body (no fallback to the published overlay or the registry); omit
   * to read the active (published) value.
   */
  state?: 'active' | 'draft';
}

export interface MetadataDeleteOptions extends MetadataSaveOptions {
  /**
   * Target state. `'draft'` discards the pending draft (keeps the
   * published overlay intact). Omit to reset the active overlay back
   * to the artifact default (the legacy behaviour).
   */
  state?: 'active' | 'draft';
}

/** Layered view of a metadata item — Phase 3a `?layers=true`. */
export interface MetadataLayered<T = unknown> {
  /** Code-level (artifact) item; null if the item only exists as an overlay. */
  code: T | null;
  /** Org/environment overlay (just the saved delta or full overlay row). */
  overlay: T | null;
  /** Overlay scope (`organization` | `environment` | `package` | null). */
  overlayScope: string | null;
  /** Merged effective view — what the runtime actually sees. */
  effective: T | null;
  /**
   * Load-time validation result for `effective` (server-computed via
   * the same Zod registry used at save time). Undefined for types
   * without a registered Zod schema. Surfaced by the Studio as a
   * banner + inline field errors so operators can spot bad metadata
   * without having to hit Save.
   */
  _diagnostics?: MetadataDiagnostics;
  // ── ADR-0010 Phase 1 — protection envelope ──
  /** 4-state lock: `none` / `no-overlay` / `no-delete` / `full`. */
  lock?: 'none' | 'no-overlay' | 'no-delete' | 'full';
  /** Human-readable reason for the lock (tooltip text). */
  lockReason?: string;
  /** Which layer set the lock: artifact / package / overlay / env-forced. */
  lockSource?: 'artifact' | 'package' | 'overlay' | 'env-forced';
  /** Optional docs URL for the lock reason (rendered as "View docs →"). */
  lockDocsUrl?: string;
  /** Origin of the item: `package` (loader) | `org` (tenant) | `env-forced`. */
  provenance?: 'package' | 'org' | 'env-forced';
  /** Owning package id (denormalised from the loader tag). */
  packageId?: string;
  /** Owning package version. */
  packageVersion?: string;
  /** True when the editor should allow Save (PUT). */
  editable?: boolean;
  /** True when the editor should allow Delete. */
  deletable?: boolean;
  /** True when "Reset to package default" applies (has overlay + artifact). */
  resettable?: boolean;
}

/**
 * One row in the metadata protection-audit trail
 * (ADR-0010 §3.6 / Phase 4.1). Mirrors `sys_metadata_audit` columns
 * the API exposes.
 */
export interface MetadataAuditEntry {
  /** Stable audit-row id (uuid). */
  id: unknown;
  /** ISO timestamp when the attempt happened. */
  occurredAt: string;
  /** Who attempted the operation (`x-actor` header or `'system'`). */
  actor: string;
  /** Code path that recorded the row (e.g. `protocol.saveMetaItem`). */
  source: string | null;
  /** Which lifecycle op was attempted. */
  operation: 'save' | 'publish' | 'rollback' | 'delete' | 'reset';
  /** Decision: allowed / denied / forced (admin override). */
  outcome: 'allowed' | 'denied' | 'forced';
  /** Machine-readable reason code (`item_locked`, `ok`, …). */
  code: string;
  /** Effective lock at the moment of the attempt. */
  lockState: 'none' | 'no-overlay' | 'no-delete' | 'full' | null;
  /** True when admin forced the write through despite the lock. */
  lockOverridden: boolean;
  /** Request-id for trace correlation (if propagated). */
  requestId: string | null;
  /** Free-text note (often the lock reason). */
  note: string | null;
}

/** Response shape for `MetadataClient.audit()`. */
export interface MetadataAuditResponse {
  events: MetadataAuditEntry[];
}

/**
 * Load-time validation envelope attached to metadata items by the
 * framework. Mirrors `MetadataValidationResult` in the kernel spec.
 */
export interface MetadataDiagnostics {
  valid: boolean;
  errors?: Array<{ path: string; message: string; code?: string }>;
  warnings?: Array<{ path: string; message: string }>;
}

/** Options for the cross-type `/meta/diagnostics` sweep call. */
export interface MetadataDiagnosticsOptions {
  /** Restrict the sweep to a single metadata type (e.g. `'view'`). */
  type?: string;
  /**
   * `'error'` (default) returns only items that fail validation.
   * `'warning'` also includes items whose only diagnostics are warnings.
   */
  severity?: 'error' | 'warning';
  /** Restrict to items owned by this package id. */
  packageId?: string;
}

/** One row in the `/meta/diagnostics` response. */
export interface MetadataDiagnosticsEntry {
  type: string;
  name: string;
  diagnostics: MetadataDiagnostics;
}

/** Top-level envelope returned by `/meta/diagnostics`. */
export interface MetadataDiagnosticsSummary {
  entries: MetadataDiagnosticsEntry[];
  /** Number of `entries` returned (post-filter). */
  total: number;
  /** How many metadata types the sweep visited. */
  scannedTypes: number;
  /** How many individual items were validated. */
  scannedItems: number;
  /**
   * Per-type aggregate stats — count of items and the list of
   * packages contributing to each type. Computed in the same sweep
   * so a single call serves both the diagnostics governance page and
   * the directory tile counts / package filter.
   *
   * Optional for backward compatibility with older framework
   * versions that do not yet emit it; clients should fall back to
   * an empty record.
   */
  stats?: Record<string, { count: number; locked?: number; packages: string[] }>;
}

/** Reference back-pointer — Phase 3a `/references`. */
export interface MetadataReference {
  /** Referencing item's metadata type. */
  fromType: string;
  /** Referencing item's name. */
  fromName: string;
  /** JSON path within the referencing item that holds the reference. */
  path: string;
  /** The actual value seen at `path` (the referenced name). */
  value: string;
}

export interface MetadataHistoryOptions {
  /** Only return events after this sequence number. */
  sinceSeq?: number;
  /** Limit the number of events returned. */
  limit?: number;
}

export interface MetadataError extends Error {
  status: number;
  code?: string;
  body?: unknown;
}

const META_PREFIX = '/meta';
const API_PREFIX = '/api/v1';

function buildBase(config: MetadataClientConfig): string {
  const trimmed = config.baseUrl.replace(/\/+$/, '');
  const scoped = config.environmentId
    ? `${API_PREFIX}/environments/${encodeURIComponent(config.environmentId)}${META_PREFIX}`
    : `${API_PREFIX}${META_PREFIX}`;
  // Allow baseUrl to already include `/api/v1`; collapse the duplicate.
  if (/\/api\/v\d+$/i.test(trimmed)) {
    const stripped = trimmed.replace(/\/api\/v\d+$/i, '');
    const scopedNoApi = config.environmentId
      ? `${API_PREFIX}/environments/${encodeURIComponent(config.environmentId)}${META_PREFIX}`
      : `${API_PREFIX}${META_PREFIX}`;
    return `${stripped}${scopedNoApi}`;
  }
  return `${trimmed}${scoped}`;
}

async function parseError(res: Response): Promise<MetadataError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = await res.text().catch(() => undefined);
  }
  const message =
    (body && typeof body === 'object' && 'error' in (body as Record<string, unknown>)
      ? String((body as Record<string, unknown>).error)
      : undefined) ?? `Metadata request failed: ${res.status} ${res.statusText}`;
  const err = new Error(message) as MetadataError;
  err.status = res.status;
  err.body = body;
  if (body && typeof body === 'object' && 'code' in (body as Record<string, unknown>)) {
    err.code = String((body as Record<string, unknown>).code);
  }
  return err;
}

/**
 * MetadataClient — read/write protocol metadata via the framework REST API.
 *
 * @example
 * ```ts
 * const client = new MetadataClient({ baseUrl: 'http://localhost:3000' });
 * const objects = await client.list<{ name: string; label?: string }>('object');
 * const account = await client.get<{ fields: Record<string, unknown> }>('object', 'account');
 * await client.save('object', 'account', { ...account, label: 'Customer' });
 * ```
 */
export class MetadataClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly headers: Record<string, string>;

  constructor(config: MetadataClientConfig) {
    this.base = buildBase(config);
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.headers = { Accept: 'application/json', ...(config.headers ?? {}) };
  }

  /** Update the client's environment scope at runtime. */
  withEnvironment(environmentId: string | undefined): MetadataClient {
    return new MetadataClient({
      baseUrl: this.base
        .replace(/\/api\/v\d+(?:\/environments\/[^/]+)?\/meta$/, '')
        .replace(/\/+$/, ''),
      environmentId,
      fetch: this.fetchImpl,
      headers: this.headers,
    });
  }

  /** List all registered metadata types (returns the registry rows). */
  async listTypes(): Promise<unknown[]> {
    const res = await this.fetchImpl(this.base, { method: 'GET', headers: this.headers, cache: 'no-store' });
    if (!res.ok) throw await parseError(res);
    const data = await res.json();
    if (Array.isArray(data)) return data;
    // Framework REST returns `{ types: string[], entries: TypeEntry[] }`
    // where `entries` is the rich per-type registry row. Older / scoped
    // shapes may use `items`. Prefer `entries` (rich), fall back to
    // `items` (legacy), then synthesize stub entries from `types[]`
    // if neither is present.
    if (data && Array.isArray((data as any).entries)) return (data as any).entries;
    if (data && Array.isArray((data as any).items)) return (data as any).items;
    if (data && Array.isArray((data as any).types)) {
      return (data as any).types.map((t: string) => ({ type: t }));
    }
    return [];
  }

  /** List items of a metadata type (e.g. `object`, `field`, `view`). */
  async list<T = unknown>(type: string, options: MetadataListOptions = {}): Promise<T[]> {
    const qs = options.packageId
      ? `?package=${encodeURIComponent(options.packageId)}`
      : '';
    const url = `${this.base}/${encodeURIComponent(type)}${qs}`;
    const res = await this.fetchImpl(url, { method: 'GET', headers: this.headers, cache: 'no-store' });
    if (!res.ok) throw await parseError(res);
    const data = await res.json();
    if (Array.isArray(data)) return data as T[];
    if (data && Array.isArray((data as { items?: unknown[] }).items)) {
      return (data as { items: T[] }).items;
    }
    return [];
  }

  /**
   * List pending DRAFT items (ADR-0033) — what an AI authored but nobody
   * published yet. `list()` only sees published/active metadata, so a
   * just-built app package looks empty there; this surfaces the drafts so the
   * console can show a "pending changes" view and draft-aware package contents.
   * Optionally narrow by `packageId` and/or `type`. Returns light headers
   * (no body) carrying `packageId` for grouping.
   */
  async listDrafts(
    options: { packageId?: string; type?: string } = {},
  ): Promise<MetadataDraftHeader[]> {
    const params: string[] = [];
    if (options.packageId) params.push(`packageId=${encodeURIComponent(options.packageId)}`);
    if (options.type) params.push(`type=${encodeURIComponent(options.type)}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    const url = `${this.base}/_drafts${qs}`;
    const res = await this.fetchImpl(url, { method: 'GET', headers: this.headers, cache: 'no-store' });
    if (!res.ok) throw await parseError(res);
    const data = (await res.json()) as
      | MetadataDraftHeader[]
      | { drafts?: MetadataDraftHeader[]; data?: { drafts?: MetadataDraftHeader[] } };
    if (Array.isArray(data)) return data;
    return data?.drafts ?? data?.data?.drafts ?? [];
  }

  /**
   * Get a single metadata item. Returns the unwrapped item content
   * (matching the framework REST handler which calls `res.json(item)`).
   * Returns `null` on 404 to keep the call-site ergonomic.
   */
  async get<T = unknown>(
    type: string,
    name: string,
    options: MetadataGetOptions = {},
  ): Promise<T | null> {
    const qs = options.state === 'draft' ? '?state=draft' : '';
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}${qs}`;
    const res = await this.fetchImpl(url, { method: 'GET', headers: this.headers, cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  }

  /**
   * Read the pending draft body for an item (`?state=draft`). Returns
   * `null` when there is no draft pending. Draft reads do NOT fall
   * back to the published overlay or the artifact registry — a `null`
   * unambiguously means "nothing to publish".
   *
   * Note: the framework wraps draft responses in an envelope
   * `{ type, name, item }` (matching `getMetaItem`); callers should
   * read `.item` to get the body. The legacy `get()` returns the
   * unwrapped body, so this method preserves that asymmetry by
   * returning whatever the server sent.
   */
  async getDraft<T = unknown>(type: string, name: string): Promise<T | null> {
    return this.get<T>(type, name, { state: 'draft' });
  }

  /**
   * Save (PUT) a metadata item. The framework accepts both the bare
   * item payload and the `{ item: ... }` / `{ metadata: ... }`
   * envelopes; we send bare for consistency. Pass `mode: 'draft'` to
   * stage the change without publishing (Studio's "Save" button).
   */
  async save<T = unknown>(
    type: string,
    name: string,
    item: unknown,
    options: MetadataSaveOptions = {},
  ): Promise<T> {
    const params: string[] = [];
    if (options.force) params.push('force=true');
    if (options.mode === 'draft') params.push('mode=draft');
    if (options.packageId) params.push(`package=${encodeURIComponent(options.packageId)}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}${qs}`;
    const headers: Record<string, string> = {
      ...this.headers,
      'Content-Type': 'application/json',
    };
    if (options.ifMatch) headers['If-Match'] = options.ifMatch;
    if (options.actor) headers['X-Actor'] = options.actor;
    const res = await this.fetchImpl(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(item),
    });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  }

  /**
   * Publish a single pending draft BY REFERENCE — promotes the draft row for
   * `(type, name)` into the active overlay and drops the draft. Works for ANY
   * draft, including ones with no `packageId` binding (which the package-scoped
   * `/packages/:id/publish-drafts` flow cannot reach). Use this to publish the
   * exact set returned by {@link listDrafts} without needing a package.
   *
   * Returns the server result. For `seed` drafts the protocol also materializes
   * the rows and reports under `seedApplied` — a data problem never fails the
   * publish, so callers should check `seedApplied?.success` and warn the user
   * rather than assume the data went live.
   */
  async publishDraft(
    type: string,
    name: string,
  ): Promise<{
    success?: boolean;
    seedApplied?: { success: boolean; inserted?: number; updated?: number; error?: string; errors?: unknown[] };
  } & Record<string, unknown>> {
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/publish`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{}',
    });
    if (!res.ok) throw await parseError(res);
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    // Tolerate the dispatcher's `{ success, data: {...} }` envelope.
    const inner = (body as any)?.data && typeof (body as any).data === 'object' ? (body as any).data : body;
    return inner as any;
  }

  /**
   * Get the 3-state layered view of a metadata item (Phase 3a). Returns
   * `code` (the artifact / fallback default), `overlay` (the saved
   * customisation, if any), and `effective` (what the runtime sees).
   */
  async layered<T = unknown>(type: string, name: string): Promise<MetadataLayered<T>> {
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}?layers=true`;
    const res = await this.fetchImpl(url, { method: 'GET', headers: this.headers, cache: 'no-store' });
    if (res.status === 404) {
      return { code: null, overlay: null, overlayScope: null, effective: null };
    }
    if (!res.ok) throw await parseError(res);
    const body = (await res.json()) as MetadataLayered<T> & Record<string, unknown>;
    const hasEnvelope =
      body && (('code' in body) || ('overlay' in body) || ('effective' in body));
    if (!hasEnvelope) {
      return {
        code: null,
        overlay: null,
        overlayScope: null,
        effective: body as unknown as T,
      };
    }
    return {
      code: body.code ?? null,
      overlay: body.overlay ?? null,
      overlayScope: body.overlayScope ?? null,
      effective: body.effective ?? null,
      ...(body._diagnostics ? { _diagnostics: body._diagnostics as MetadataDiagnostics } : {}),
      // ADR-0010 Phase 4 — pass through the metadata-protection envelope so
      // the editor can render lock affordances without a second round trip.
      ...(body.lock !== undefined ? { lock: body.lock as MetadataLayered['lock'] } : {}),
      ...(body.lockReason !== undefined ? { lockReason: body.lockReason as string } : {}),
      ...(body.lockSource !== undefined ? { lockSource: body.lockSource as MetadataLayered['lockSource'] } : {}),
      ...(body.lockDocsUrl !== undefined ? { lockDocsUrl: body.lockDocsUrl as string } : {}),
      ...(body.provenance !== undefined ? { provenance: body.provenance as MetadataLayered['provenance'] } : {}),
      ...(body.packageId !== undefined ? { packageId: body.packageId as string } : {}),
      ...(body.packageVersion !== undefined ? { packageVersion: body.packageVersion as string } : {}),
      ...(body.editable !== undefined ? { editable: body.editable as boolean } : {}),
      ...(body.deletable !== undefined ? { deletable: body.deletable as boolean } : {}),
      ...(body.resettable !== undefined ? { resettable: body.resettable as boolean } : {}),
    };
  }

  /**
   * Cross-type sweep of load-time validation results — calls
   * `GET /meta/diagnostics`. Returns every entry the framework
   * considers invalid (or, when `severity: 'warning'`, also entries
   * with only warnings).
   *
   * Used by the Studio's governance overview page and by the
   * directory page to show "N invalid" badges per metadata type.
   */
  async diagnostics(
    options: MetadataDiagnosticsOptions = {},
  ): Promise<MetadataDiagnosticsSummary> {
    const params: string[] = [];
    if (options.type) params.push(`type=${encodeURIComponent(options.type)}`);
    if (options.severity) params.push(`severity=${encodeURIComponent(options.severity)}`);
    if (options.packageId) params.push(`package=${encodeURIComponent(options.packageId)}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    const url = `${this.base}/diagnostics${qs}`;
    const res = await this.fetchImpl(url, { method: 'GET', headers: this.headers, cache: 'no-store' });
    if (res.status === 404) {
      // Older server without the sweep endpoint — caller should treat
      // as "no diagnostics available", not as an error.
      return { entries: [], total: 0, scannedTypes: 0, scannedItems: 0, stats: {} };
    }
    if (!res.ok) throw await parseError(res);
    const data = (await res.json()) as Partial<MetadataDiagnosticsSummary>;
    return {
      entries: Array.isArray(data.entries) ? data.entries : [],
      total: typeof data.total === 'number' ? data.total : 0,
      scannedTypes: typeof data.scannedTypes === 'number' ? data.scannedTypes : 0,
      scannedItems: typeof data.scannedItems === 'number' ? data.scannedItems : 0,
      stats: data.stats && typeof data.stats === 'object' ? data.stats : {},
    };
  }

  /**
   * Find every metadata item that references this one (Phase 3a). Useful
   * for pre-delete impact analysis: "Are any views pointing at this
   * object before I drop it?".
   */
  async references(type: string, name: string): Promise<MetadataReference[]> {
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/references`;
    const res = await this.fetchImpl(url, { method: 'GET', headers: this.headers, cache: 'no-store' });
    if (res.status === 404) return [];
    if (!res.ok) throw await parseError(res);
    const data = await res.json();
    return Array.isArray(data) ? (data as MetadataReference[]) : (data?.items ?? []);
  }

  /**
   * Reset a metadata customization overlay back to the artifact default.
   * Idempotent: returns the result even when no overlay row existed.
   * Pass `state: 'draft'` to discard the pending draft only (keeps the
   * published overlay intact) — useful for a Studio "Discard draft" button.
   */
  async reset<T = unknown>(
    type: string,
    name: string,
    options: MetadataDeleteOptions = {},
  ): Promise<T> {
    const qs = options.state === 'draft' ? '?state=draft' : '';
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}${qs}`;
    const headers: Record<string, string> = { ...this.headers };
    if (options.ifMatch) headers['If-Match'] = options.ifMatch;
    if (options.actor) headers['X-Actor'] = options.actor;
    const res = await this.fetchImpl(url, { method: 'DELETE', headers });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  }

  /**
   * Promote the pending draft of an item to the active overlay
   * (POST `/meta/:type/:name/publish`). Returns
   * `{ success, version, seq, message }`. Throws a `404 no_draft` if
   * nothing is pending and `409 metadata_conflict` if the published
   * overlay moved while the draft was sitting.
   */
  async publish<T = unknown>(
    type: string,
    name: string,
    options: { actor?: string; message?: string } = {},
  ): Promise<T> {
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/publish`;
    const headers: Record<string, string> = {
      ...this.headers,
      'Content-Type': 'application/json',
    };
    if (options.actor) headers['X-Actor'] = options.actor;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(options.message ? { message: options.message } : {}),
    });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  }

  /**
   * Restore an item to a previous version (POST `/meta/:type/:name/rollback`).
   * The server reads the history row at `toVersion`, writes its body back
   * as the active overlay with `operation_type='revert'`. Returns
   * `{ success, version, seq, restoredFromVersion, message }`. Throws
   * `404 version_not_found` for unknown versions and `409 version_not_restorable`
   * when the target version is a delete tombstone.
   */
  async rollback<T = unknown>(
    type: string,
    name: string,
    toVersion: number,
    options: { actor?: string; message?: string } = {},
  ): Promise<T> {
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/rollback`;
    const headers: Record<string, string> = {
      ...this.headers,
      'Content-Type': 'application/json',
    };
    if (options.actor) headers['X-Actor'] = options.actor;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        toVersion,
        ...(options.message ? { message: options.message } : {}),
      }),
    });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  }

  /**
   * Compute a structured top-level key diff between two history versions
   * (GET `/meta/:type/:name/diff?from=&to=`). Returns
   * `{ added, removed, changed }` where each entry carries a `path` and
   * the relevant value(s). Useful for "what changed in this draft?" and
   * pre-rollback previews.
   */
  async diff<T = unknown>(
    type: string,
    name: string,
    fromVersion?: number,
    toVersion?: number,
  ): Promise<T> {
    const params = new URLSearchParams();
    if (fromVersion !== undefined) params.set('from', String(fromVersion));
    if (toVersion !== undefined) params.set('to', String(toVersion));
    const qs = params.toString();
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/diff${qs ? `?${qs}` : ''}`;
    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: this.headers,
      cache: 'no-store',
    });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  }

  /** Fetch the durable history (change log) for one metadata item. */
  async history<T = unknown>(
    type: string,
    name: string,
    options: MetadataHistoryOptions = {},
  ): Promise<T> {
    const params = new URLSearchParams();
    if (options.sinceSeq !== undefined) params.set('sinceSeq', String(options.sinceSeq));
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    const qs = params.toString();
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/history${qs ? `?${qs}` : ''}`;
    const res = await this.fetchImpl(url, { method: 'GET', headers: this.headers, cache: 'no-store' });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  }

  /**
   * Fetch the protection-audit trail for one metadata item
   * (ADR-0010 §3.6 / Phase 4.1). Shows every save/publish/rollback/
   * delete/reset attempt — allowed, denied, or forced — so the
   * Studio "审计日志 / Audit log" tab can render who tried what
   * and whether a lock blocked it.
   */
  async audit(
    type: string,
    name: string,
    options: { limit?: number } = {},
  ): Promise<MetadataAuditResponse> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    const qs = params.toString();
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/audit${qs ? `?${qs}` : ''}`;
    const res = await this.fetchImpl(url, { method: 'GET', headers: this.headers, cache: 'no-store' });
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as MetadataAuditResponse;
  }
}
