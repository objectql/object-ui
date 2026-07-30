// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The wire shape of `GET /api/v1/share-links/:token/resolve`, and the one place
 * that folds it into what {@link ../pages/SharedRecordPage} renders.
 *
 * Separate from the page because it is pure — the page's own module pulls in the
 * chat renderer and the whole app-shell graph, which a shape test should not have
 * to load.
 */

export interface ShareLink {
  id: string;
  token: string;
  object_name: string;
  record_id: string;
  permission: 'view' | 'comment' | 'edit';
  audience: string;
  expires_at?: string | null;
  label?: string | null;
}

/** What the page renders. Note `redactedFields` — see {@link normalizeResolvedShare}. */
export interface ResolvedShare {
  link: ShareLink;
  record: Record<string, unknown>;
  redactedFields?: string[];
}

/**
 * The resolve payload AS IT ARRIVES — `redactFields`, the server's spelling.
 * Keeping this named apart from {@link ResolvedShare} is what stops the enveloped
 * branch from silently skipping the rename, which is what it did before
 * objectstack#3983.
 */
export interface WireResolvedShare {
  record?: unknown;
  link: ShareLink;
  redactFields?: string[];
}

/** Either producer's body: enveloped (`{ success, data }`) or bare. */
export type ResolveResponseBody = { data?: WireResolvedShare } & Partial<WireResolvedShare>;

/**
 * Fold either producer's resolve body into {@link ResolvedShare}.
 *
 * Two producers serve this route: the sharing plugin's routes and the runtime
 * dispatcher's `/share-links` domain (the designed primary surface for cloud's
 * per-environment kernels). Both answer the same three fields; only the envelope
 * differs, and the dispatcher has always enveloped them — objectstack#3983 moved
 * the plugin onto the same shape, so the bare branch is what a pre-#3983 server
 * still sends.
 *
 * The rename is the point. The wire spells it `redactFields`; the page reads
 * `redactedFields`. Only the BARE branch used to do that mapping — the enveloped
 * one handed `body.data` straight through — so on the dispatcher path
 * `redactedFields` was always `undefined` and the "fields are hidden by the owner"
 * notice never rendered, on exactly the pages where fields WERE being stripped.
 */
export function normalizeResolvedShare(body: ResolveResponseBody): ResolvedShare {
  const wire = (body.data ?? body) as WireResolvedShare;
  return {
    record: (wire.record ?? {}) as Record<string, unknown>,
    link: wire.link,
    redactedFields: wire.redactFields,
  };
}
