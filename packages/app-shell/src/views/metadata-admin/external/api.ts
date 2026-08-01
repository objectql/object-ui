// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Thin REST client for the External Datasource Federation routes
 * (ADR-0015 §6.2, framework `registerExternalDatasourceRoutes`).
 *
 * Mounted server-side under `/api/v1/datasources/:name/external/*`:
 *
 *   GET  /tables[?schema=]              → { tables: RemoteTable[] }
 *   POST /tables/:remote/draft          → { draft: ObjectDraft }
 *   POST /refresh-catalog               → { catalog: ExternalCatalog }
 *   POST /validate                      → { ok, results: SchemaValidationResult[] }
 *
 * Every route degrades to `503 external_service_unavailable` when the host
 * has not wired the `external-datasource` service — callers surface that as a
 * "federation not enabled on this server" hint rather than a hard error.
 *
 * All calls go through `createAuthenticatedFetch()` so the Bearer token,
 * `X-Tenant-ID`, and `Accept-Language` are injected exactly like every other
 * app-shell REST call (RecordDetailView, ObjectView, …).
 */

import { createAuthenticatedFetch } from '@object-ui/auth';
import type {
  GenerateDraftOpts,
  ObjectDraft,
  RemoteTable,
  SchemaValidationResult,
} from '@objectstack/spec/contracts';
import type { ExternalCatalog } from '@objectstack/spec/data';

// ---------------------------------------------------------------------------
// Contract types — RE-EXPORTED from `@objectstack/spec`, not mirrored.
//
// These nine used to be hand-written copies under the spec's own names, with a
// comment claiming they were "kept local so app-shell does not take a build
// dependency on the framework spec package". That reason was already false:
// `@objectstack/spec` is a direct dependency of this package (package.json),
// and the copies had drifted (objectstack#4115) — `SchemaDiffEntryKind` was
// missing `index_mismatch` and `unmapped_index`, so a validate run that
// reported an index divergence hit a `kind` this UI could not name, and
// `ExternalColumn.primaryKey` was optional here while the server always sends
// it (the spec schema defaults it to `false`).
//
// The wire shapes are produced by the framework parsing with these very
// schemas, so the spec's types are the accurate ones by construction. Import
// them; do not re-describe them.
// ---------------------------------------------------------------------------

/**
 * Introspection + drafting contracts (ADR-0015 §6.2), owned by
 * `@objectstack/spec/contracts`.
 */
export type {
  RemoteTable,
  GenerateDraftOpts,
  ObjectDraft,
  SchemaValidationResult,
} from '@objectstack/spec/contracts';

/**
 * Schema-divergence vocabulary, owned by `@objectstack/spec/shared` — shared
 * with the framework's `external-errors` module so a diff `kind` this UI
 * renders is exactly a `kind` the server can emit.
 */
export type { SchemaDiffEntry, SchemaDiffEntryKind } from '@objectstack/spec/shared';

/**
 * Catalog-snapshot shapes, owned by `@objectstack/spec/data` (the
 * `ExternalCatalogSchema` family the refresh-catalog route parses with).
 */
export type { ExternalCatalog, ExternalColumn, ExternalTable } from '@objectstack/spec/data';

/**
 * Raised when the server replies `503 external_service_unavailable` — the
 * federation service is not wired into this host. Callers render a friendly
 * "enable federation on the server" message instead of a generic failure.
 */
export class ExternalServiceUnavailableError extends Error {
  constructor() {
    super('external_service_unavailable');
    this.name = 'ExternalServiceUnavailableError';
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const authFetch = createAuthenticatedFetch();

function serverBase(): string {
  const raw = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SERVER_URL ?? '';
  return raw.replace(/\/+$/, '');
}

function externalBase(datasource: string): string {
  return `${serverBase()}/api/v1/datasources/${encodeURIComponent(datasource)}/external`;
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (res.status === 503) {
    // Body is `{ error: 'external_service_unavailable' }` — treat distinctly.
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    const code =
      body && typeof body === 'object' && 'error' in body
        ? String((body as Record<string, unknown>).error)
        : '';
    if (code === 'external_service_unavailable') throw new ExternalServiceUnavailableError();
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body && typeof body === 'object' && 'error' in body) {
        detail = String((body as Record<string, unknown>).error);
      }
    } catch {
      /* keep status-text detail */
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

/** List remote tables, optionally filtered to a single remote schema. */
export async function listRemoteTables(
  datasource: string,
  opts: { schema?: string } = {},
): Promise<RemoteTable[]> {
  const qs = opts.schema ? `?schema=${encodeURIComponent(opts.schema)}` : '';
  const res = await authFetch(`${externalBase(datasource)}/tables${qs}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const data = await jsonOrThrow<{ tables: RemoteTable[] }>(res);
  return data.tables ?? [];
}

/** Generate an Object draft (structured + `*.object.ts` source) from a table. */
export async function generateObjectDraft(
  datasource: string,
  remoteName: string,
  opts: GenerateDraftOpts = {},
): Promise<ObjectDraft> {
  const res = await authFetch(
    `${externalBase(datasource)}/tables/${encodeURIComponent(remoteName)}/draft`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    },
  );
  const data = await jsonOrThrow<{ draft: ObjectDraft }>(res);
  return data.draft;
}

/** Refresh and return the cached remote-schema snapshot. */
export async function refreshCatalog(datasource: string): Promise<ExternalCatalog> {
  const res = await authFetch(`${externalBase(datasource)}/refresh-catalog`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  const data = await jsonOrThrow<{ catalog: ExternalCatalog }>(res);
  return data.catalog;
}

/** Validate every federated Object bound to this datasource. */
export async function validateDatasource(
  datasource: string,
): Promise<{ ok: boolean; results: SchemaValidationResult[] }> {
  const res = await authFetch(`${externalBase(datasource)}/validate`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  return jsonOrThrow<{ ok: boolean; results: SchemaValidationResult[] }>(res);
}

/**
 * Persist a generated Object draft as a real `object` metadata item
 * (PUT `/api/v1/meta/object/:name`, mirroring `MetadataClient.save`). The
 * draft's `definition` is the parseable ObjectSchema body.
 */
export async function importObjectDraft(draft: ObjectDraft): Promise<void> {
  const res = await authFetch(
    `${serverBase()}/api/v1/meta/object/${encodeURIComponent(draft.name)}`,
    {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(draft.definition),
    },
  );
  await jsonOrThrow<unknown>(res);
}
