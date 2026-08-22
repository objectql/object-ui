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

import type {
  GetMetaItemLayeredResponse,
  RuntimeAuthoringIssue,
} from '@objectstack/spec/api';

/**
 * One advisory finding the framework's runtime authoring gate produced for a
 * save that SUCCEEDED (objectstack#7435, landed as `89d7b35a7`).
 *
 * Re-exported from `@objectstack/spec` rather than restated: this is the D3
 * finding shape, declared once as `RuntimeAuthoringIssueSchema` and shared with
 * the 422 `issues[]` so the two cannot drift apart. Hand-copying the six keys
 * here is exactly the fork `check:spec-symbol-derivation` exists to reject, and
 * it is the same discipline `DroppedFieldsEvent` already follows one module over.
 *
 * `severity` carries the spec's full `error | warning | info` union. On THIS
 * channel it is never `'error'` — an error-severity finding is a 422 and never
 * reaches a 2xx body — but the union is copied whole rather than narrowed,
 * because a consumer-side re-spelling of a producer's enum is the drift the
 * gate above is about.
 */
export type { RuntimeAuthoringIssue };

/**
 * Emitted after a {@link MetadataClient.save} whose response carried a
 * non-empty `advisories` array. The save SUCCEEDED — the row persisted and the
 * server returned 200 — so this is advisory, never a failure.
 *
 * Deliberately the same shape of seam as `ObjectStackAdapter.onWriteWarning`
 * (#3431/#3455): a successful write whose response carries something the author
 * needs to be told, surfaced to the shell as an event so the data layer never
 * imports a toaster. The difference is only which door produced it — that one
 * is record CRUD, this one is the metadata save door.
 */
export interface MetadataSaveAdvisoryEvent {
  /** Metadata type saved (e.g. `'flow'`). */
  type: string;
  /** Item name saved. */
  name: string;
  /**
   * The save mode the call used. `'draft'` writes are **never gated** — the
   * framework returns at `runtime-authoring-gate.ts`'s D1 early-return
   * (`if (args.state !== 'active') return null`), so a draft save produces no
   * findings at all and this event never fires for one. Carried anyway so a
   * consumer reading the event can tell which door it came through.
   */
  mode: 'draft' | 'publish';
  /** The findings. Never empty — the event is not emitted otherwise. */
  advisories: RuntimeAuthoringIssue[];
}

/** Event listener type for save-advisory events. */
export type MetadataSaveAdvisoryListener = (event: MetadataSaveAdvisoryEvent) => void;

/**
 * Read the `advisories` array off a save response, defensively.
 *
 * The server omits the key entirely on a clean save, so `undefined` is the
 * common case and means "nothing to say". Anything that is not an array of
 * objects carrying the six required keys is dropped rather than rendered: a
 * half-shaped finding would print blanks at the author, and this channel must
 * never turn a successful save into noise.
 */
export function readSaveAdvisories(body: unknown): RuntimeAuthoringIssue[] {
  if (!body || typeof body !== 'object') return [];
  const raw = (body as { advisories?: unknown }).advisories;
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is RuntimeAuthoringIssue => {
    if (!f || typeof f !== 'object') return false;
    const c = f as Record<string, unknown>;
    return (
      typeof c.rule === 'string' &&
      typeof c.path === 'string' &&
      typeof c.where === 'string' &&
      typeof c.message === 'string' &&
      typeof c.hint === 'string' &&
      typeof c.severity === 'string'
    );
  });
}

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
  /**
   * ADR-0037 Live Canvas — render the world **as-if-published**. When true,
   * `list()` and `get()` append `?preview=draft`, which the framework
   * dispatcher maps to `getMetaItems/getMetaItem({ previewDrafts: true })`:
   * pending ADR-0033 drafts overlay the active registry (draft wins by name,
   * draft-only items surface). Reads only — writes are unaffected, and
   * nothing the preview shows is live until Publish.
   */
  previewDrafts?: boolean;
  /**
   * Called after a {@link MetadataClient.save} whose 2xx response carried a
   * non-empty `advisories` array (objectstack#7435). The save already
   * succeeded; this is how the shell learns there is something to tell the
   * author instead of the findings being discarded client-side.
   *
   * Set on the CONFIG rather than exposed as a `subscribe()` method on purpose:
   * console metadata clients are minted per-component by `useMetadataClient`,
   * so there is no long-lived instance to subscribe to — but every one of them
   * is built by the single `createConsoleMetadataClient` factory, which is
   * where this gets wired exactly once for every save call site in the app.
   *
   * A throw from this callback is swallowed — an advisory channel must never
   * be able to fail a save that the server already committed.
   */
  onSaveAdvisory?: MetadataSaveAdvisoryListener;
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

/**
 * Options for {@link MetadataClient.save} — a WRITE OVER HTTP to
 * `/api/v1/meta/:type/:name`.
 *
 * NOT the spec's `MetadataSaveOptions` (`@objectstack/spec/system` and
 * `/kernel`), whose name this interface wore until objectui#3160
 * (objectstack#4115 ledger batch 6). Both spec copies describe writing a
 * metadata item to a FILE — `format: json|yaml|ts`, `path`, `indent`,
 * `prettify`, `sortKeys`, `backup`, `atomic`, `loader`. Not one of those keys
 * exists here, and not one of these exists there: this is the REST client's
 * request envelope — optimistic concurrency (`ifMatch` → `If-Match`), the
 * destructive-change override, the ADR-0033 draft/publish mode, and the
 * owning package. Same words, different layer.
 */
export interface MetadataClientSaveOptions {
  /**
   * Optimistic concurrency token (the `checksum` returned by the last
   * read). When present, sent as the `If-Match` header so concurrent
   * edits get a 409 instead of overwriting each other.
   */
  ifMatch?: string;
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
  /**
   * Software-package id to scope resolution (sent as the `package` query
   * param → server prefer-local, ADR-0048). Set when reading one item that
   * may collide by name across installed packages (e.g. the Studio editor
   * passes the edited item's owning package). Omit for context-free reads.
   */
  packageId?: string;
}

export interface MetadataDeleteOptions extends MetadataClientSaveOptions {
  /**
   * Target state. `'draft'` discards the pending draft (keeps the
   * published overlay intact). Omit to reset the active overlay back
   * to the artifact default (the legacy behaviour).
   */
  state?: 'active' | 'draft';
}

/**
 * Which layer an overlay was saved at — `'org'` for a tenant overlay, `'env'`
 * for an environment-level one, `null` exactly when `overlay` is null.
 *
 * DERIVED from `@objectstack/spec`, not restated: the vocabulary lives once, in
 * `GetMetaItemLayeredResponseSchema`'s `overlayScope`
 * (`z.enum(['org', 'env']).nullable()`), and this alias indexes the published
 * response type so a scope the spec adds arrives here with no edit. Restating
 * the union locally is the fork `scripts/check-spec-symbol-derivation.mjs`
 * exists to reject, and the mirror-image mistake — a consumer re-spelling a
 * producer's enum — is what this field carried until objectui#4982.
 *
 * What it carried: `string | null`, under a comment naming the vocabulary as
 * `organization | environment | package`. Not one of those three spellings is a
 * value the producer emits (`metadata-protocol`'s two assignment sites write
 * `'org'` / `'env'`); the schema rejects all three by name, and `package` is
 * not a scope this field has ever had. Because the declared type was `string`
 * the compiler had no opinion, so the wrong comment was the only description of
 * the vocabulary — a planted premise rather than stale prose, and the reason
 * the Studio's layer badge shipped the raw value straight to screen.
 */
export type MetadataOverlayScope = GetMetaItemLayeredResponse['overlayScope'];

/**
 * ADR-0010 §3.6 — the four-state metadata protection lock
 * (`none` / `no-overlay` / `no-delete` / `full`), read from
 * `GetMetaItemLayeredResponseSchema`'s own `z.enum` rather than spelled out
 * again here (objectui#5024).
 *
 * It used to be written out twice in this file, 42 lines apart: once as
 * {@link MetadataLayered.lock} (optional) and once as
 * {@link MetadataAuditEntry.lockState} (nullable), identical in every other
 * respect and compared by no gate. A fifth state added to one would have left
 * the other compiling — the same "declared N times, diffed by nothing" failure
 * objectui#4972 and objectui#4984 record for other vocabularies.
 *
 * Deriving beats a local alias the two merely share. The producer of these
 * values is the framework, and `packages/spec` already declares the vocabulary,
 * so the copies were restating a schema that existed rather than filling a gap.
 * The card that reported this recorded the opposite — "`@objectstack/spec` 也没
 * 有对应的 `z.enum` 可派生" — and so did the audit panel's neighbouring comment;
 * both predate the enum, which ships in `@objectstack/spec` 17.1.0. This is the
 * same treatment {@link MetadataOverlayScope} above already gets, and it closes
 * the cross-repo half of the drift, not just the in-repo half.
 *
 * ⚠️ This types what this repo may WRITE. It does NOT constrain what a server
 * may SEND: {@link MetadataClient.layered} casts the wire value through
 * unchecked, so every reader must still handle a value outside these four. The
 * lock banner in `ResourceEditPage` is the worked example.
 */
export type MetadataLockState = GetMetaItemLayeredResponse['lock'];

/**
 * Layered view of a metadata item — the body of
 * `GET /meta/:type/:name/layers` (`GetMetaItemLayeredResponseSchema`).
 *
 * A subset by design: the response also carries `type` / `name`, which the
 * caller already knows because it passed them in, so
 * {@link MetadataClient.layered} does not hand them back.
 */
export interface MetadataLayered<T = unknown> {
  /** Code-level (artifact) item; null if the item only exists as an overlay. */
  code: T | null;
  /** Org/environment overlay (just the saved delta or full overlay row). */
  overlay: T | null;
  /**
   * Which layer {@link MetadataLayered.overlay} came from, or null when there
   * is no overlay. Spec-derived — see {@link MetadataOverlayScope}.
   */
  overlayScope: MetadataOverlayScope;
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
  lock?: MetadataLockState;
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
  /**
   * Who attempted the operation — the identity the request was authorized
   * as, or `'system'` for internal machine writes (objectstack#7941).
   */
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
  lockState: MetadataLockState | null;
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

/** A single field-anchored spec-validation issue (server `error.details.issues`). */
export interface MetadataValidationIssue {
  /** Dot-path to the offending field, e.g. `fields.amount.type` (`''` = root). */
  path: string;
  message: string;
  code?: string;
}

export interface MetadataError extends Error {
  status: number;
  code?: string;
  body?: unknown;
  /** Structured spec-validation issues, when the failure was a validation error. */
  issues?: MetadataValidationIssue[];
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
  const bodyObj = body && typeof body === 'object' ? (body as Record<string, any>) : undefined;
  // The dispatcher error shape is `{ success:false, error:{ message, code,
  // details:{ code, issues } } }` — `error` is an OBJECT. Older/other surfaces
  // send `error` as a plain string or a top-level `message`. Accept all three
  // (reading `.message` off the object case, not `String(object)` which yields
  // "[object Object]").
  const errNode = bodyObj?.error;
  const message =
    (errNode && typeof errNode === 'object' ? errNode.message : errNode) ??
    bodyObj?.message ??
    `Metadata request failed: ${res.status} ${res.statusText}`;
  const err = new Error(String(message)) as MetadataError;
  err.status = res.status;
  err.body = body;
  // Field-anchored spec-validation issues. Two live server shapes carry them:
  // the REST server puts them at top-level `body.issues` (with `error` a string),
  // the HTTP dispatcher nests them under `error.details.issues` (with `error` an
  // object). Accept both (plus a defensive `error.issues`) so the caller can
  // point at the offending field regardless of which transport served the error.
  const details = errNode && typeof errNode === 'object' ? errNode.details : undefined;
  const issues =
    details?.issues ??
    (errNode && typeof errNode === 'object' ? errNode.issues : undefined) ??
    bodyObj?.issues;
  if (Array.isArray(issues)) err.issues = issues as MetadataValidationIssue[];
  const code =
    details?.code ??
    (errNode && typeof errNode === 'object' ? errNode.code : undefined) ??
    bodyObj?.code;
  if (code != null) err.code = String(code);
  return err;
}

/**
 * Is this the single-item response envelope, as opposed to a metadata document?
 *
 * Matched by the PRESENCE of the three keys `GetMetaItemResponseSchema`
 * declares — `type: string`, `name: string`, and an `item` slot — never by
 * guessing from the payload's contents. The distinction matters in both
 * directions:
 *
 *  - A metadata document may legitimately carry its own `type` and `name`
 *    (a view is `{ name, type: 'grid', … }`). Without an `item` key it is the
 *    body, and unwrapping it would destroy it.
 *  - A document could carry an `item` property of its own. Without the
 *    envelope's identity keys it is likewise left whole.
 *
 * Key COUNT is deliberately not part of the test: a real envelope also spreads
 * `MetadataProtectionEnvelopeFields` (`lock`, `provenance`, …), so it routinely
 * has more than three keys.
 */
function isMetaItemEnvelope(
  value: unknown,
): value is { type: string; name: string; item: unknown } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const env = value as Record<string, unknown>;
  return typeof env.type === 'string' && typeof env.name === 'string' && 'item' in env;
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
  /** ADR-0037: when true, reads render the draft-overlaid world. */
  readonly previewDrafts: boolean;
  /** #4133 — sink for post-save advisory findings; see the config field. */
  private readonly onSaveAdvisory: MetadataSaveAdvisoryListener | undefined;

  constructor(config: MetadataClientConfig) {
    this.base = buildBase(config);
    this.fetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.headers = { Accept: 'application/json', ...(config.headers ?? {}) };
    this.previewDrafts = config.previewDrafts === true;
    this.onSaveAdvisory = config.onSaveAdvisory;
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
      previewDrafts: this.previewDrafts,
      // #4133: the advisory sink must survive the clone. `useMetadataClient`
      // routes EVERY environment-scoped console client through here, so
      // dropping it would silently disable the channel for exactly the
      // multi-environment tenants the gate is loudest for.
      ...(this.onSaveAdvisory ? { onSaveAdvisory: this.onSaveAdvisory } : {}),
    });
  }

  /**
   * Derive a client whose reads render the draft-overlaid world (or not).
   * Same base/fetch/headers; used by the app-shell to switch the whole
   * renderer tree into ADR-0037 preview mode off one URL flag.
   */
  withPreviewDrafts(previewDrafts: boolean): MetadataClient {
    if (previewDrafts === this.previewDrafts) return this;
    // Preserve the environment scope baked into the base path (unlike
    // `withEnvironment`, which exists to REPLACE it).
    const envMatch = this.base.match(/\/api\/v\d+\/environments\/([^/]+)\/meta$/);
    return new MetadataClient({
      baseUrl: this.base
        .replace(/\/api\/v\d+(?:\/environments\/[^/]+)?\/meta$/, '')
        .replace(/\/+$/, ''),
      ...(envMatch ? { environmentId: decodeURIComponent(envMatch[1]) } : {}),
      fetch: this.fetchImpl,
      headers: this.headers,
      previewDrafts,
      // #4133: carried for the same reason as in `withEnvironment` — preview
      // mode swaps the whole renderer tree's client, and writes are unaffected
      // by ADR-0037, so the save door behind this clone still advises.
      ...(this.onSaveAdvisory ? { onSaveAdvisory: this.onSaveAdvisory } : {}),
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
    const params: string[] = [];
    if (options.packageId) params.push(`package=${encodeURIComponent(options.packageId)}`);
    if (this.previewDrafts) params.push('preview=draft');
    const qs = params.length ? `?${params.join('&')}` : '';
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
   * Fetch a single metadata item and return the response body EXACTLY as the
   * server sent it — envelope and all.
   *
   * The one transport both {@link get} (which unwraps) and {@link getDraft}
   * (which does not) sit on, so the two can differ in what they hand back
   * without differing in how they ask. Private on purpose: the envelope is a
   * wire detail, and the two published contracts above are the supported ways
   * to read an item.
   */
  private async readItemResponse<T = unknown>(
    type: string,
    name: string,
    options: MetadataGetOptions = {},
  ): Promise<T | null> {
    const params: string[] = [];
    if (options.state === 'draft') params.push('state=draft');
    // `state=draft` reads the raw draft row explicitly; the overlay flag is
    // redundant (and the dispatcher resolves `state` first), so skip it.
    else if (this.previewDrafts) params.push('preview=draft');
    if (options.packageId) params.push(`package=${encodeURIComponent(options.packageId)}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}${qs}`;
    const res = await this.fetchImpl(url, { method: 'GET', headers: this.headers, cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw await parseError(res);
    return (await res.json()) as T;
  }

  /**
   * Get a single metadata item. Returns the unwrapped item CONTENT — the
   * metadata document itself, so `obj.fields` / `obj.label` are reachable
   * directly.
   *
   * The framework answers `GET /meta/:type/:name` with the spec-declared
   * envelope `{ type, name, item, …protection fields }`
   * (`GetMetaItemResponseSchema`; objectstack#5563 collapsed this read to that
   * ONE shape), so the envelope is unwrapped here — at the client boundary,
   * once — rather than by each caller.
   *
   * **This method used to return the envelope while promising the body**
   * (objectui#4271). Nothing detected the disagreement, because the test
   * doubles across the repo were written against this docblock: every consumer
   * reading `obj.fields` got `undefined` in production and a field list in
   * unit tests. The visible cost was the entire field half of the permission
   * matrix reporting "No fields registered for this object." for every object,
   * plus dead RLS CEL autocomplete, an inert report drill-down and a designer
   * that saved the envelope back over the object body.
   *
   * A response that is NOT the envelope (an older server answering the bare
   * document, or a body of its own shape) passes through untouched, and `null`
   * still comes back on 404 to keep the call site ergonomic.
   */
  async get<T = unknown>(
    type: string,
    name: string,
    options: MetadataGetOptions = {},
  ): Promise<T | null> {
    const resp = await this.readItemResponse<unknown>(type, name, options);
    if (isMetaItemEnvelope(resp)) return (resp.item ?? null) as T | null;
    return resp as T | null;
  }

  /**
   * Read the pending draft body for an item (`?state=draft`). Returns
   * `null` when there is no draft pending. Draft reads do NOT fall
   * back to the published overlay or the artifact registry — a `null`
   * unambiguously means "nothing to publish".
   *
   * Note: this method hands back the `{ type, name, item }` envelope the
   * framework sends, NOT the body — callers read `.item`. That asymmetry with
   * {@link get} is deliberate and long-standing (the draft envelope's identity
   * and protection carriers are part of what a draft reader inspects), so it
   * is preserved by reading the transport directly instead of going through
   * `get()`'s unwrap. `unwrapDraftBody` (app-shell) and `unwrapViewDraft`
   * (this package) are the shared helpers for taking the body out.
   */
  async getDraft<T = unknown>(
    type: string,
    name: string,
    options: { packageId?: string } = {},
  ): Promise<T | null> {
    return this.readItemResponse<T>(type, name, {
      state: 'draft',
      ...(options.packageId ? { packageId: options.packageId } : {}),
    });
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
    options: MetadataClientSaveOptions = {},
  ): Promise<T> {
    if (!name || !String(name).trim()) {
      // The `PUT /meta/:type/:name` route rejects a missing `:name` segment
      // with 405. Fail with a clear contextual error at the call boundary
      // instead of firing a malformed request at the server (#2767).
      throw new Error(
        `MetadataClient.save: name must be non-empty (type="${type}").` +
          ' The PUT /meta/:type/:name route requires a name segment.',
      );
    }
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
    const res = await this.fetchImpl(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(item),
    });
    if (!res.ok) throw await parseError(res);
    const body = await res.json();
    // #4133 — the runtime authoring gate's advisory findings (objectstack#7435).
    // The server emits `advisories` ONLY when non-empty, so a clean save costs
    // nothing here. Everything below is best-effort by construction: the save
    // has already been committed server-side and returning it must not depend
    // on anything the advisory channel does.
    if (this.onSaveAdvisory) {
      try {
        const advisories = readSaveAdvisories(body);
        if (advisories.length > 0) {
          this.onSaveAdvisory({
            type,
            name,
            mode: options.mode === 'draft' ? 'draft' : 'publish',
            advisories,
          });
        }
      } catch {
        /* an advisory must never turn a committed save into a thrown error */
      }
    }
    return body as T;
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
   * Get the 3-state layered view of a metadata item: `code` (the packaged
   * artifact baseline), `overlay` (the tenant customisation row alone) and
   * `effective` (the merged value the runtime sees).
   *
   * Reads **`GET /meta/:type/:name/layers`** — the path the framework declares
   * for this projection, with a response schema of its own
   * (`GetMetaItemLayeredResponseSchema`, objectstack#5882 ruling B). It used to
   * be reached by hanging a `layers` flag on the ordinary item read, which made
   * one route answer two unrelated representations while `packages/spec`
   * declared only one of them. That spelling still answers this same body
   * inside its deprecation window (the response carries RFC 9745
   * `Deprecation: true` and an RFC 8288 `Link: rel="successor-version"` back to
   * this path) and is scheduled for removal upstream, so nothing here may
   * depend on it — the repo-wide ratchet is
   * `scripts/__tests__/layered-read-declared-path-4016.test.ts`.
   *
   * The request is built here rather than delegated to `@objectstack/client`
   * because the SDK expresses no layered read in EITHER spelling: the
   * framework's REST route ledger records this route as `server-only`,
   * "consumed by objectui over plain HTTP", and whether the SDK should express
   * it is an open upstream product call.
   *
   * One behaviour delta rides along with the path, and it is the server's
   * choice rather than ours: the retired flag FELL THROUGH to the plain item
   * read on a backend whose protocol implementation had no layered support,
   * answering the `{ type, name, item }` envelope. A dedicated path refuses to
   * answer a different resource under this one's declared shape, so it returns
   * 501 `NOT_IMPLEMENTED` instead — which surfaces here as a thrown error
   * rather than a view with `code` and `overlay` silently blank.
   */
  async layered<T = unknown>(
    type: string,
    name: string,
    options: { packageId?: string } = {},
  ): Promise<MetadataLayered<T>> {
    // ADR-0048 — `?package=` scopes resolution to one installed package (the
    // editor passes the edited item's owning package, not the Studio app's).
    // It leads the query string now that the flag it used to trail is gone:
    // keeping the `&` would have appended it to the last PATH segment
    // (`…/layers&package=crm`), which matches no route — a 404 that this
    // method turns into an empty-but-successful layered view.
    const qs = options.packageId ? `?package=${encodeURIComponent(options.packageId)}` : '';
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/layers${qs}`;
    const res = await this.fetchImpl(url, { method: 'GET', headers: this.headers, cache: 'no-store' });
    if (res.status === 404) {
      return { code: null, overlay: null, overlayScope: null, effective: null };
    }
    if (!res.ok) throw await parseError(res);
    const body = (await res.json()) as MetadataLayered<T> & Record<string, unknown>;
    const hasEnvelope =
      body && (('code' in body) || ('overlay' in body) || ('effective' in body));
    // Left standing, but no longer reachable from a conforming server: the only
    // producer of a 200 body WITHOUT these keys was the retired flag's
    // fall-through to the plain item read, and the declared path answers 501
    // there. Kept out of this migration's scope on purpose — deleting it is a
    // behaviour change for a non-conforming backend, not part of moving the
    // request — and filed as objectui#4983 for removal once the upstream
    // deprecation window closes.
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
    options: { message?: string } = {},
  ): Promise<T> {
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/publish`;
    const headers: Record<string, string> = {
      ...this.headers,
      'Content-Type': 'application/json',
    };
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
    options: { message?: string } = {},
  ): Promise<T> {
    const url = `${this.base}/${encodeURIComponent(type)}/${encodeURIComponent(name)}/rollback`;
    const headers: Record<string, string> = {
      ...this.headers,
      'Content-Type': 'application/json',
    };
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
