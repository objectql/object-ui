/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ADR-0067 — package-scoped commit history reads/writes for the timeline.
 *
 * Each AI build (and Studio batch) lands as one revertible COMMIT on top of
 * the metadata history. The history-not-confirm model: you don't approve each
 * publish — you review this timeline and revert if a change was wrong. These
 * helpers read the timeline (`GET /packages/:id/commits`) and revert one
 * commit (`POST /packages/:id/commits/:cid/revert`). Cookie-authenticated like
 * every console call; tolerant of the `{ data: ... }` / bare envelope shapes.
 */

export interface CommitEntry {
  id: string;
  operation: 'apply' | 'revert';
  message?: string;
  actor?: string;
  aiModel?: string;
  itemCount: number;
  createdAt?: string;
}

export async function fetchCommits(packageId: string): Promise<CommitEntry[]> {
  const res = await fetch(`/api/v1/packages/${encodeURIComponent(packageId)}/commits`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`commits HTTP ${res.status}`);
  const data = (await res.json()) as
    | unknown[]
    | { commits?: unknown[]; data?: { commits?: unknown[] } };
  const list = Array.isArray(data)
    ? data
    : (data as { commits?: unknown[] })?.commits ??
      (data as { data?: { commits?: unknown[] } })?.data?.commits ??
      [];
  return (Array.isArray(list) ? list : []).map((raw) => {
    const c = raw as Record<string, unknown>;
    return {
      id: String(c.id),
      operation: c.operation === 'revert' ? 'revert' : 'apply',
      message: typeof c.message === 'string' ? c.message : undefined,
      actor: typeof c.actor === 'string' ? c.actor : undefined,
      aiModel: typeof c.aiModel === 'string' ? c.aiModel : undefined,
      itemCount: typeof c.itemCount === 'number' ? c.itemCount : 0,
      createdAt: typeof c.createdAt === 'string' ? c.createdAt : undefined,
    } satisfies CommitEntry;
  });
}

export async function revertCommit(packageId: string, commitId: string): Promise<void> {
  const res = await fetch(
    `/api/v1/packages/${encodeURIComponent(packageId)}/commits/${encodeURIComponent(commitId)}/revert`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{}',
    },
  );
  const payload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const inner = (payload?.data as Record<string, unknown> | undefined) ?? payload ?? undefined;
  if (!res.ok || (inner as { success?: boolean })?.success === false) {
    const err = payload?.error as { message?: string } | string | undefined;
    throw new Error(
      (typeof err === 'object' ? err?.message : err) ?? `HTTP ${res.status}`,
    );
  }
}
