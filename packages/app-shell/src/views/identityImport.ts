// Identity import adapter — framework#2782.
//
// `sys_user` cannot go through the generic `/api/v1/data/sys_user/import`
// route: a plain data-layer insert bypasses better-auth's password hashing and
// never creates the credential account, so imported "users" could never sign
// in. The server exposes a dedicated, platform-admin-gated endpoint instead
// (`POST /api/v1/auth/admin/import-users`) whose payload is deliberately
// byte-compatible with the generic import request.
//
// This module wraps the regular dataSource so the stock ImportWizard drives
// that endpoint unchanged: `importRecords` is overridden to (1) split rows
// into ≤500-row batches — the endpoint's hard cap, because password-related
// work is CPU-bound server-side — and (2) inject the admin's chosen password
// policy. The endpoint is idempotent on upsert (matched by email/phone), so
// re-running a failed batch is safe.
//
// Password policies (framework#2820): `none` (default — identity only, users
// first sign in via phone OTP / magic link / reset link and set a password
// afterwards), `invite` (adds a set-your-password email / invitation SMS per
// created row), `temporary` (per-row one-time passwords returned ONLY in the
// response — the result step must surface them immediately; they are never
// persisted anywhere, client or server).

import type { ImportRecordsResult, ImportRequestOptions, ImportRowResult } from '@object-ui/types';

export const IDENTITY_IMPORT_OBJECT = 'sys_user';

/** Server-side hard cap on rows per identity import request. */
export const IDENTITY_IMPORT_BATCH_SIZE = 500;

export type IdentityPasswordPolicy = 'none' | 'invite' | 'temporary';

/** Row results from the identity endpoint may carry a one-time password. */
export type IdentityImportRowResult = ImportRowResult & {
  temporaryPassword?: string;
  /** The row's sign-in identity (email or phone), enriched from the source
   *  rows by the adapter so the one-time-password reveal is usable. */
  identity?: string;
};

interface IdentityImportResponse {
  success: boolean;
  error?: { code?: string; message?: string };
  data?: {
    summary: {
      total: number;
      created: number;
      updated: number;
      skipped: number;
      errors: number;
      dryRun: boolean;
    };
    rows: Array<{
      row: number;
      ok: boolean;
      action?: 'created' | 'updated' | 'skipped' | 'failed';
      id?: string;
      field?: string;
      code?: string;
      error?: string;
      temporaryPassword?: string;
    }>;
  };
}

/** Split rows into endpoint-sized batches (pure; exported for tests). */
export function splitIntoBatches<T>(rows: T[], size = IDENTITY_IMPORT_BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < rows.length; i += size) batches.push(rows.slice(i, i + size));
  return batches;
}

/**
 * Map the wizard's generic write options onto the identity endpoint's
 * `mode` / `matchBy`. Throws early (before any batch is sent) on options the
 * identity pipeline doesn't support, so the wizard surfaces one clear error
 * instead of a half-imported file.
 */
export function resolveIdentityWriteOptions(request: ImportRequestOptions): {
  mode: 'insert' | 'upsert';
  matchBy?: 'email' | 'phone';
} {
  const writeMode = request.writeMode ?? 'insert';
  if (writeMode === 'update') {
    throw new Error('Identity import supports the insert and upsert write modes only.');
  }
  if (writeMode === 'insert') return { mode: 'insert' };
  const match = (request.matchFields ?? [])[0];
  if (match === 'email') return { mode: 'upsert', matchBy: 'email' };
  if (match === 'phone_number') return { mode: 'upsert', matchBy: 'phone' };
  throw new Error('Identity import matches existing users by "email" or "phone_number" only.');
}

/**
 * Merge per-batch endpoint responses into one wizard-shaped
 * {@link ImportRecordsResult}, renumbering each batch's 1-based rows onto the
 * whole file (pure; exported for tests).
 */
export function mergeIdentityBatchResults(
  responses: Array<NonNullable<IdentityImportResponse['data']>>,
  batches: Array<Array<Record<string, unknown>>>,
  meta: { dryRun: boolean; writeMode: 'insert' | 'upsert' },
): ImportRecordsResult {
  let total = 0, created = 0, updated = 0, skipped = 0, errors = 0;
  const results: IdentityImportRowResult[] = [];
  let offset = 0;
  for (let b = 0; b < responses.length; b++) {
    const { summary, rows } = responses[b];
    const sourceRows = batches[b] ?? [];
    total += summary.total;
    created += summary.created;
    updated += summary.updated;
    skipped += summary.skipped;
    errors += summary.errors;
    for (const r of rows) {
      if (!r) continue;
      // Enrich with the row's sign-in identity so the one-time-password
      // reveal (and its CSV) pairs each password with a recognizable account.
      const source = sourceRows[r.row - 1] as { email?: unknown; phone_number?: unknown; phoneNumber?: unknown; phone?: unknown } | undefined;
      const identity = [source?.email, source?.phone_number, source?.phoneNumber, source?.phone]
        .find((v): v is string => typeof v === 'string' && v.trim().length > 0);
      results.push({
        row: offset + r.row,
        ok: r.ok,
        action: r.action,
        ...(r.id ? { id: r.id } : {}),
        ...(r.field ? { field: r.field } : {}),
        ...(r.code ? { code: r.code } : {}),
        ...(r.error ? { error: r.error } : {}),
        ...(r.temporaryPassword ? { temporaryPassword: r.temporaryPassword } : {}),
        ...(identity ? { identity: identity.trim() } : {}),
      });
    }
    offset += sourceRows.length || summary.total;
  }
  return {
    object: IDENTITY_IMPORT_OBJECT,
    dryRun: meta.dryRun,
    writeMode: meta.writeMode,
    total,
    ok: total - errors,
    errors,
    created,
    updated,
    skipped,
    results,
  };
}

export interface IdentityImportDataSourceOptions {
  /** The regular dataSource — reads (and everything else) pass through. */
  base: unknown;
  /** Authenticated fetch (Bearer + tenant headers), e.g. createAuthenticatedFetch(). */
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** Server origin (VITE_SERVER_URL); '' for same-origin. */
  baseUrl: string;
  /** Read the admin's currently selected password policy at send time. */
  getPasswordPolicy: () => IdentityPasswordPolicy;
}

/**
 * Wrap a dataSource so the ImportWizard writes through the identity endpoint.
 *
 * Also *removes* the async-job and undo surfaces: identity import is
 * synchronous-only server-side (batching happens here instead) and undo would
 * mean bulk-deleting users — the wizard feature-detects these methods, so
 * clearing them cleanly hides the corresponding UI.
 */
export function createIdentityImportDataSource(opts: IdentityImportDataSourceOptions): unknown {
  const { base, authFetch, baseUrl, getPasswordPolicy } = opts;

  const importRecords = async (
    _objectName: string,
    request: ImportRequestOptions,
  ): Promise<ImportRecordsResult> => {
    const { mode, matchBy } = resolveIdentityWriteOptions(request);
    const passwordPolicy = getPasswordPolicy();
    const rows = Array.isArray(request.rows) ? request.rows : [];
    if (rows.length === 0) {
      throw new Error('Identity import needs mapped rows (rows[]) — file uploads are parsed client-side.');
    }

    const batches = splitIntoBatches(rows);
    const responses: Array<NonNullable<IdentityImportResponse['data']>> = [];
    for (const batch of batches) {
      const res = await authFetch(`${baseUrl}/api/v1/auth/admin/import-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: 'json',
          rows: batch,
          mode,
          ...(matchBy ? { matchBy } : {}),
          passwordPolicy,
          ...(request.dryRun ? { dryRun: true } : {}),
          ...(request.mappingName ? { mappingName: request.mappingName } : {}),
          ...(request.trimWhitespace !== undefined ? { trimWhitespace: request.trimWhitespace } : {}),
          ...(request.nullValues ? { nullValues: request.nullValues } : {}),
        }),
      });
      const body = (await res.json().catch(() => null)) as IdentityImportResponse | null;
      if (!res.ok || !body?.success || !body.data) {
        const message = body?.error?.message ?? `Identity import failed with status ${res.status}`;
        // Abort the remaining batches: the request-level failure (bad policy,
        // missing email service, …) would repeat identically for every batch.
        throw new Error(message);
      }
      responses.push(body.data);
    }

    return mergeIdentityBatchResults(
      responses,
      batches as Array<Array<Record<string, unknown>>>,
      { dryRun: request.dryRun === true, writeMode: mode },
    );
  };

  // Spread first, then null the surfaces identity import must not offer —
  // a plain spread would copy the generic job/undo methods along.
  return {
    ...(base as Record<string, unknown>),
    importRecords,
    createImportJob: undefined,
    getImportJobProgress: undefined,
    getImportJobResults: undefined,
    listImportJobs: undefined,
    cancelImportJob: undefined,
    undoImportJob: undefined,
  };
}

/** Rows that carry a one-time password, for the result-step reveal. */
export function collectTemporaryPasswords(
  result: ImportRecordsResult | undefined,
): Array<{ row: number; identity: string; temporaryPassword: string }> {
  if (!result?.results) return [];
  const out: Array<{ row: number; identity: string; temporaryPassword: string }> = [];
  for (const r of result.results as IdentityImportRowResult[]) {
    if (r?.temporaryPassword) {
      out.push({ row: r.row, identity: r.identity ?? `#${r.row}`, temporaryPassword: r.temporaryPassword });
    }
  }
  return out;
}

/** CSV for the one-time-password handout (client memory only — never persisted). */
export function buildTemporaryPasswordCsv(
  entries: Array<{ row: number; identity: string; temporaryPassword: string }>,
): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = ['row,identity,temporary_password'];
  for (const e of entries) lines.push(`${e.row},${esc(e.identity)},${esc(e.temporaryPassword)}`);
  return lines.join('\n');
}
