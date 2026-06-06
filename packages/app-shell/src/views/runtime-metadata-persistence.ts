// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0034 — Runtime metadata persistence seam.
 *
 * Runtime editing of **views / reports / dashboards** is unified with studio's
 * `/meta` per-item **draft → publish → version** model. A runtime edit stages a
 * per-item **draft** (invisible to other users, live in the editor's own
 * preview); an explicit **publish** promotes it to the active overlay and
 * records a version.
 *
 * This module is the single seam every runtime persistence call flows through,
 * so the call sites (ObjectView / ReportView / DashboardView / RuntimeDraftBar)
 * stay decoupled from the `MetadataClient` shape.
 *
 * The bespoke per-type tables (`sys_view` / `sys_report` / `sys_dashboard`) and
 * their shape adapters have been retired — there is no longer a feature flag or
 * a legacy write path here.
 */

/** The three runtime-editable artifact types ADR-0034 unifies. */
export type RuntimeArtifactType = 'view' | 'report' | 'dashboard';

/** Everything the seam needs to persist any of the three artifact types. */
export interface RuntimePersistCtx {
  /** Studio metadata client — the `/meta` draft/publish/version API. */
  metadataClient: any;
}

/**
 * Unwrap a `?state=draft` GET response into its bare body, or `null` when
 * there is nothing pending.
 *
 * The framework wraps draft reads in a `{ type, name, item }` envelope; a
 * published read is the bare body. This accepts either shape and returns
 * `null` for an empty/absent draft so `!!readRuntimeDraft(...)` is a reliable
 * "has pending changes" check. Mirrors studio's `extractDraftBody`.
 */
export function unwrapDraftBody(
  resp: unknown,
): Record<string, unknown> | null {
  if (!resp || typeof resp !== 'object') return null;
  const env = resp as Record<string, unknown>;
  if ('item' in env) {
    const body = env.item;
    if (!body || typeof body !== 'object') return null;
    return Object.keys(body as object).length > 0
      ? (body as Record<string, unknown>)
      : null;
  }
  return Object.keys(env).length > 0 ? env : null;
}

/**
 * Persist a runtime edit of a view / report / dashboard as a per-item DRAFT
 * (invisible to other users until {@link publishRuntimeMetadata}).
 */
export async function persistRuntimeMetadata(
  type: RuntimeArtifactType,
  name: string,
  body: any,
  ctx: RuntimePersistCtx,
): Promise<void> {
  await ctx.metadataClient.save(type, name, body, { mode: 'draft' });
}

/**
 * Create a NEW runtime artifact as a per-item draft. Returns its name (for the
 * caller's auto-activation). UI-layer concerns (default columns, kanban/gallery
 * sub-config, auto-activation) stay in the call site.
 */
export async function createRuntimeMetadata(
  type: RuntimeArtifactType,
  name: string,
  body: any,
  ctx: RuntimePersistCtx,
): Promise<string | undefined> {
  await ctx.metadataClient.save(type, name, body, { mode: 'draft' });
  return name;
}

/**
 * Read the pending draft body for a runtime artifact (for the "unpublished
 * changes" indicator and resume-on-open). Returns the bare body, or `null`
 * when nothing is pending.
 */
export async function readRuntimeDraft<T = Record<string, unknown>>(
  type: RuntimeArtifactType,
  name: string,
  ctx: RuntimePersistCtx,
): Promise<T | null> {
  const resp = await ctx.metadataClient.get(type, name, { state: 'draft' });
  return unwrapDraftBody(resp) as T | null;
}

/**
 * Discard the pending draft of a runtime artifact (Studio's "Discard draft").
 * The published overlay is untouched.
 */
export async function discardRuntimeDraft(
  type: RuntimeArtifactType,
  name: string,
  ctx: RuntimePersistCtx,
): Promise<void> {
  await ctx.metadataClient.reset(type, name, { state: 'draft' });
}

/**
 * Publish a previously-staged runtime edit: promote the pending draft to the
 * active overlay and record a version.
 */
export async function publishRuntimeMetadata(
  type: RuntimeArtifactType,
  name: string,
  ctx: RuntimePersistCtx,
): Promise<void> {
  await ctx.metadataClient.publish(type, name);
}
