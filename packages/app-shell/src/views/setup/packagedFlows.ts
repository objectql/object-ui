// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The reading rules behind Setup › Packaged automation (ADR-0126 §7.4) — which
 * flows the page lists, and how it reads the two responses it depends on.
 *
 * Separate from `PackagedAutomationPage.tsx` because these are not components:
 * the scoping rule is the part of that page most worth testing directly, and
 * it costs a full DOM render to reach through the UI. It runs in the `unit`
 * project from here.
 */

/**
 * One row of `GET /api/v1/automation/_status`.
 *
 * A read projection over what the engine's `getFlowRuntimeStates()` returns —
 * every field optional because older backends answer with fewer of them, and
 * this page must degrade rather than throw. Only `name` and `enabled` are read.
 */
export interface FlowRuntimeStateRow {
  name?: unknown;
  enabled?: unknown;
  [key: string]: unknown;
}

/** A packaged flow as the page renders it. */
export interface PackagedFlowRow {
  /** Machine name — the key every automation route takes. */
  name: string;
  /** Display name; falls back to the machine name when the item has none. */
  label: string;
  /** Activation state as the engine reports it. */
  enabled: boolean;
}

/**
 * Is this `flow` metadata item shipped by a CODE PACKAGE?
 *
 * A clause-for-clause transcription of `isCodeArtifactBody`
 * (`@objectstack/objectql` `registry.ts`, ADR-0029 D9.6) — the server's own
 * answer to "does a code package ship this name?". It cannot be imported here
 * (objectql is a server package), and the shortened variants already present
 * in this repo are wrong in exactly the direction that matters on this page:
 *
 *   - **truthy `_packageId` is not enough.** A TENANT-authored overlay bound
 *     to a package carries a real package id too — on the save path and on the
 *     boot-time rehydration of `sys_metadata` alike. cloud#970 measured a
 *     Studio-authored artifact reading back as a code artifact after a kernel
 *     rebuild, which is the same misread this page would make.
 *   - **`_packageId === 'sys_metadata'`** is the sentinel for an overlay bound
 *     to no package at all — runtime-authored, never packaged.
 *   - **`_provenance`** is the axis that actually separates the two (ADR-0010:
 *     `'package'` for loader-introduced items, `'org'` for tenant-authored).
 *
 * Erring either way is a real defect, not cosmetics: a tenant's own flow shown
 * on that page offers an install-wide switch for something Studio owns, and a
 * packaged flow filtered out leaves an admin with no off-switch at all.
 */
export function isPackagedFlowItem(item: unknown): boolean {
  const it = item as { _packageId?: unknown; _provenance?: unknown } | null | undefined;
  const packageId = it?._packageId;
  if (typeof packageId !== 'string' || !packageId || packageId === 'sys_metadata') return false;
  return it?._provenance !== 'org';
}

/**
 * Join the engine's runtime states with the `flow` metadata list, scoped to
 * the packaged ones.
 *
 * The runtime list is the SPINE — it holds every flow the engine can actually
 * toggle or clone — and the metadata list answers two things it does not
 * carry: whether a package shipped the flow, and the flow's display label.
 * A packaged flow that the engine never registered is therefore not listed:
 * both actions the page offers go through the engine, and a row with two dead
 * controls tells an admin less than no row.
 */
export function joinPackagedFlows(
  runtime: readonly FlowRuntimeStateRow[],
  metaItems: readonly unknown[],
): PackagedFlowRow[] {
  const packaged = new Map<string, Record<string, unknown>>();
  for (const raw of metaItems) {
    const item = raw as Record<string, unknown> | null;
    const name = item?.name;
    if (typeof name !== 'string' || !name) continue;
    if (!isPackagedFlowItem(item)) continue;
    packaged.set(name, item as Record<string, unknown>);
  }

  const rows: PackagedFlowRow[] = [];
  for (const state of runtime) {
    const name = state?.name;
    if (typeof name !== 'string' || !name) continue;
    const item = packaged.get(name);
    if (!item) continue;
    const label = item.label;
    rows.push({
      name,
      label: typeof label === 'string' && label ? label : name,
      // `enabled` is TRUE unless the engine says otherwise: an older backend
      // that omits the field has no ledger to disable anything with.
      enabled: state.enabled !== false,
    });
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label) || a.name.localeCompare(b.name));
}

/**
 * The `data` object of a transport envelope, or `{}`.
 *
 * A parsed HTTP body is never a value the type system has vouched for, so it
 * arrives as `unknown` and is narrowed here once rather than cast at each read.
 */
export function envelopeData(json: unknown): Record<string, unknown> {
  const data = (json as { data?: unknown } | null | undefined)?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return data as Record<string, unknown>;
}

/**
 * Did the transport envelope itself report a refusal under a 2xx?
 *
 * `!res.ok` is the usual signal; this is the other one, and both mean the
 * request was refused before anything changed.
 */
export function envelopeRefused(json: unknown): boolean {
  return (json as { success?: unknown } | null | undefined)?.success === false;
}

/** The runtime-state list out of `GET /automation/_status`, wrapped or bare. */
export function readRuntimeStates(payload: unknown): FlowRuntimeStateRow[] {
  const p = payload as
    | { data?: { flows?: unknown }; flows?: unknown }
    | null
    | undefined;
  const list = p?.data?.flows ?? p?.flows ?? [];
  return Array.isArray(list) ? (list as FlowRuntimeStateRow[]) : [];
}

/** The `flow` metadata list — bare array or `{ items }`, as this route answers. */
export function readMetadataItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const items = (payload as { items?: unknown } | null | undefined)?.items;
  return Array.isArray(items) ? items : [];
}
