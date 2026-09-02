// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Package-list helpers shared by the Studio package switcher and the builder
 * landing page.
 *
 * Writability is the SERVER's verdict, not a shape we derive. Every row of
 * `GET /api/v1/packages` carries a top-level `writable: boolean` computed by
 * `isWritablePackage` (ADR-0070 D2, objectstack#14375) — the same predicate the
 * server's authoring (`saveMetaItem`) and lifecycle (`DELETE` / `disable`) gates
 * enforce, so the badge and the gate cannot disagree. Read it; do not re-derive
 * it.
 *
 * The `scope !== 'project'` expression below is ONLY the fallback for servers
 * that predate that field, and it is WRONG for one row: a `type: module`
 * sub-package of a multi-package artifact (ADR-0130 D4) normally omits `scope`
 * — the schema default is applied at PARSE time, while the artifact load path
 * deliberately hands the RAW manifest body to `registerApp`, so the served row
 * has no `scope` key at all. The heuristic reads that as a writable database
 * base, yet the server refuses every write to it (it is in `engine.manifests`).
 * Nothing in the raw row separates it from a scope-less Studio-created base,
 * which really is writable — only the server's `engine.manifests` does, which is
 * why the client cannot compute this and a "missing scope means read-only" rule
 * would have flipped every Studio base read-only.
 *
 * Kernel packages (scope `system` / `cloud`) are hidden here whatever their
 * verdict says: that filter is about visibility, not writability.
 */

import { deriveNamespaceFromPackageId, validateObjectNamespacePrefix } from '@objectstack/spec/kernel';

export interface PkgEntry {
  id: string;
  name: string;
  writable: boolean;
  /**
   * The package's object-name namespace (framework#2694): every object in the
   * package must be named `<namespace>_*`. An explicit `manifest.namespace`
   * wins; otherwise it is back-derived from the id (same rule the kernel uses),
   * so authoring surfaces can prefix object names before publish rejects them.
   */
  namespace: string | null;
}

export function parsePackages(payload: unknown): PkgEntry[] {
  const root = (payload as { data?: unknown })?.data ?? payload;
  const raw = Array.isArray(root) ? root : ((root as { packages?: unknown[] })?.packages ?? []);
  const out: PkgEntry[] = [];
  for (const p of raw as Array<Record<string, unknown>>) {
    if (!p || typeof p !== 'object') continue;
    const m = (p.manifest ?? {}) as Record<string, unknown>;
    const id = String(m.id ?? p.id ?? '');
    if (!id) continue;
    const scope = typeof m.scope === 'string' ? m.scope : '';
    if (scope === 'system' || scope === 'cloud') continue; // kernel — not app packages
    const namespace =
      typeof m.namespace === 'string' && m.namespace ? m.namespace : deriveNamespaceFromPackageId(id);
    // Server first, heuristic only when the key is absent (see the module doc).
    // A non-boolean value is not a verdict, so it falls back too.
    const writable = typeof p.writable === 'boolean' ? p.writable : scope !== 'project';
    out.push({ id, name: String(m.name ?? id), writable, namespace });
  }
  return out;
}

export async function fetchPackages(): Promise<PkgEntry[]> {
  const res = await fetch('/api/v1/packages', {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parsePackages(await res.json());
}

/**
 * The duplicate operation's OWN result, which travels inside the dispatcher
 * envelope's `data` — not at the top level.
 *
 * `POST /packages/:id/duplicate` is served only by the runtime dispatcher, and
 * that door always wraps (`deps.success(result)` → `{ success: true, data }`).
 * So a top-level `success` read is reading the ENVELOPE, whose value is `true`
 * by construction on a 200. The operation's verdict is one level down, and it
 * is a real three-state: the server computes it as
 * `failed.length === 0 && copied.length > 0`, which leaves TWO reachable
 * outcomes that answer HTTP 200 with `data.success === false`:
 *
 *  1. PARTIAL — some items failed to copy. `failed[]` carries a per-item
 *     `error` string and is the ONLY place the reason is ever stated; a
 *     generic `HTTP nnn` here tells the author nothing.
 *  2. EMPTY — nothing was copied at all (e.g. a source package whose rows are
 *     outside this caller's scope). `failed[]` is empty in this arm — nothing
 *     is named as having failed — so the counts are the only signal.
 *
 * Those two are exhaustive for `success === false`: with no failures AND at
 * least one copy the server would have said `true`.
 */
interface DuplicateOutcome {
  success?: boolean;
  copiedCount?: number;
  failedCount?: number;
  failed?: Array<{ type?: string; name?: string; error?: string }>;
}

/** Per-item failures named in full before the message summarizes the rest. */
const DUPLICATE_FAILURE_DETAIL_LIMIT = 5;

/**
 * Turn a false operation verdict into something the Studio author can act on.
 * The counts say how far the copy got; `failed[].error` says why each item did
 * not make it. Both arms are reachable on a 200 — see {@link DuplicateOutcome}.
 */
function describeDuplicateFailure(outcome: DuplicateOutcome): string {
  const failed = Array.isArray(outcome.failed) ? outcome.failed : [];
  const failedCount = typeof outcome.failedCount === 'number' ? outcome.failedCount : failed.length;
  const copiedCount = typeof outcome.copiedCount === 'number' ? outcome.copiedCount : 0;
  if (failedCount > 0) {
    const shown = failed
      .slice(0, DUPLICATE_FAILURE_DETAIL_LIMIT)
      .map((f) => `${f.type || 'item'}/${f.name || '?'}: ${f.error || 'copy failed'}`);
    const rest = failed.length - shown.length;
    const detail = shown.length ? ` ${shown.join('; ')}${rest > 0 ? `; +${rest} more` : ''}` : '';
    return `Partial duplicate: ${copiedCount} item(s) copied, ${failedCount} failed.${detail}`;
  }
  return (
    'Nothing was copied: the duplicate is empty (0 items copied, 0 reported as failed). ' +
    "The source package may have no active items, or its rows may be outside this session's scope."
  );
}

/**
 * Duplicate a package into a NEW writable base (ADR-0070 D4 — the Airtable
 * "duplicate base" gesture; POST /packages/:id/duplicate). This is how a
 * read-only code package becomes a customizable starting point: objects are
 * re-namespaced and intra-package references rewritten server-side.
 *
 * Rejects on a transport/error-envelope failure AND on a false operation
 * verdict, which a 200 can carry. Unwrapping before reading that verdict is
 * the same order `revertCommit` uses for the sibling commit-revert route in
 * `preview/commitHistory.ts`.
 */
export async function duplicatePackage(sourceId: string, targetId: string, targetName?: string): Promise<void> {
  const res = await fetch(`/api/v1/packages/${encodeURIComponent(sourceId)}/duplicate`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ targetPackageId: targetId, ...(targetName ? { targetName } : {}) }),
  });
  const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    // The error envelope IS top-level (`{ success: false, error }`) — no `data`
    // to unwrap on this arm.
    const message = (payload?.error as { message?: string } | undefined)?.message;
    throw new Error(message || `HTTP ${res.status}`);
  }
  // Unwrap FIRST, then read the operation's flag. The `?? payload` arm mirrors
  // the commit-revert helper: it would classify a hypothetical bare (unwrapped)
  // answer instead of reading it as success. Against today's single wrapping
  // surface only the `data` arm is live.
  const inner = ((payload?.data as Record<string, unknown> | undefined) ?? payload ?? undefined) as
    | DuplicateOutcome
    | undefined;
  if (inner?.success === false) {
    throw new Error(describeDuplicateFailure(inner));
  }
}

export const PACKAGE_ID_RE = /^[a-z][a-z0-9_.-]*(\.[a-z0-9_-]+)+$/;

/**
 * Object-namespace format (framework#2694 / `@objectstack/spec/kernel`): a
 * lowercase letter followed by 1–19 letters/digits/underscores (2–20 chars).
 * `deriveNamespaceFromPackageId` already sanitizes to this shape; the authoring
 * dialogs validate the user's edits against the same rule.
 */
export const NAMESPACE_RE = /^[a-z][a-z0-9_]{1,19}$/;

/**
 * Prefix an object name with the package namespace so it can't be authored
 * prefix-less (framework#2694 rejects those at publish with code
 * `NAMESPACE_PREFIX`). The compliance decision is the spec-owned rule
 * (`validateObjectNamespacePrefix`) — a `null` verdict means already-compliant
 * or exempt (e.g. `sys_*`), which we leave untouched (never double-prefix).
 * With no namespace we can't prefix, so the name passes through unchanged (the
 * server-side gate stays the backstop).
 */
export function prefixObjectName(rawName: string, namespace: string | null | undefined): string {
  if (!namespace) return rawName;
  return validateObjectNamespacePrefix(rawName, namespace) ? `${namespace}_${rawName}` : rawName;
}

/**
 * Normalize raw package-id keystrokes to the allowed alphabet, and SAY when
 * something was dropped — the wizard used to strip illegal characters
 * silently (`bad id!!` → `badid`), which reads as the input eating keys.
 * The `stripped` flag drives an inline notice; PACKAGE_ID_RE stays the
 * format authority (reverse-domain, e.g. `com.example.myapp`).
 */
export function sanitizePackageId(raw: string): { value: string; stripped: boolean } {
  const value = raw.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  // Lowercasing is benign normalization; only actually-dropped characters warrant the notice.
  return { value, stripped: value.length !== raw.length };
}
