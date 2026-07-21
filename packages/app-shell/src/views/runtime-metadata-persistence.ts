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

import { slugify } from './metadata-admin/createDerive';

/** The runtime-editable artifact types ADR-0034 unifies. `page` (a record
 *  `PageSchema`) joins the original three (#1541): a record page is edited in
 *  the browser and staged/published through the same `/meta` draft model. */
export type RuntimeArtifactType = 'view' | 'report' | 'dashboard' | 'page';

/**
 * The metadata `name` (the `:name` in `/meta/page/:name`) for an object's
 * record page. Prefer an already-assigned record page's name; otherwise mint
 * the convention `<object>_record`. Editing the synthesized default for the
 * first time materialises a real named page under this key so it has something
 * to draft / publish / version against.
 */
export function recordPageName(objectName: string, existingName?: string | null): string {
  return existingName || `${objectName}_record`;
}

/**
 * Wrap an edited `PageSchema` as a persistable **record page** body: ensures the
 * `name` / `object` / `pageType: 'record'` / `kind: 'full'` identity fields the
 * resolver (`usePageAssignment`) matches on, so a published page overrides the
 * synthesized default for that object on the next render.
 */
export function recordPageEnvelope(
  objectName: string,
  schema: Record<string, any>,
  name?: string,
): Record<string, any> {
  return {
    ...schema,
    type: 'page',
    name: recordPageName(objectName, name ?? (schema?.name as string | undefined)),
    object: objectName,
    pageType: 'record',
    kind: 'full',
  };
}

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
 * The canonical runtime-created **list view** body (ADR-0017 ViewItem). The
 * same shape Studio's create flow emits (`metadata-admin/anchors.ts`
 * `createBuildBody`), so a view born from the record-list "Add View" dialog is
 * indistinguishable from one authored in the designer.
 */
export interface ViewEnvelope {
  /** Globally-unique qualified id `<object>.<key>` — used as BOTH the URL
   *  segment and the body identity (see {@link viewEnvelope}). */
  name: string;
  object: string;
  viewKind: 'list';
  label: string;
  config: Record<string, any>;
}

/**
 * Derive the machine **key** (the bare `<key>` half of `<object>.<key>`) for a
 * runtime-created view.
 *
 * Order of preference:
 *   1. An explicit machine name the user typed (the CreateViewDialog now
 *      collects one, sanitized). A fully-qualified `<object>.<key>` that slips
 *      in is reduced to its `<key>` so we never double-qualify.
 *   2. `slugify(label)` for Latin labels.
 *   3. A unique last-resort fallback — reached only for a non-Latin (CJK/…)
 *      label with no machine name (`slugify` returns empty for those, #2767 P5).
 *      The dialog requires manual entry in that case, so this is defence in
 *      depth, not the common path.
 */
export function deriveViewKey(opts: {
  name?: string | null;
  label?: string | null;
  type?: string | null;
}): string {
  const explicit = String(opts.name ?? '').trim();
  if (explicit) {
    return explicit.includes('.')
      ? explicit.slice(explicit.lastIndexOf('.') + 1)
      : explicit;
  }
  const fromLabel = slugify(String(opts.label ?? ''));
  if (fromLabel) return fromLabel;
  const type = String(opts.type ?? '').trim() || 'view';
  return `${type}_${Date.now().toString(36)}`;
}

/**
 * Wrap an assembled list-view `spec` (type / columns / sub-config / filter …)
 * as a canonical {@link ViewEnvelope} ready for the `/meta` draft seam.
 *
 * **Identity is unified** (#2767 P1): the returned `name` is the qualified
 * `<object>.<key>`, and callers MUST pass it as BOTH the URL segment and the
 * body — `createRuntimeMetadata('view', env.name, env)`. The server keys the
 * `sys_metadata` row by the URL segment, so a split (bare key as segment,
 * qualified name in the body) writes a row the draft → read → publish loop
 * can't find (404), and a later Studio save forks a second row for the same
 * view. One name, used everywhere, keeps the tab id, the row key, and
 * `body.name` identical.
 *
 * The object binding is stamped under `config.data` so `listViews()` can match
 * the view to its object after publish (it filters on `config.data.object` /
 * top-level `object`).
 */
export function viewEnvelope(
  objectName: string | undefined,
  spec: Record<string, any>,
  opts: { name?: string | null; label?: string | null } = {},
): ViewEnvelope {
  const object = String(objectName ?? '');
  const label = String(opts.label ?? spec?.label ?? '').trim();
  const key = deriveViewKey({ name: opts.name, label, type: spec?.type });
  const qualifiedName = object ? `${object}.${key}` : key;
  // `name` / `label` live at the envelope top level (the canonical ViewItem
  // shape) — strip them from the nested config so the two don't drift.
  const config: Record<string, any> = { ...(spec ?? {}) };
  delete config.name;
  delete config.label;
  config.data = { provider: 'object', ...(spec?.data ?? {}), object };
  return { name: qualifiedName, object, viewKind: 'list', label, config };
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
  if (!name || !String(name).trim()) {
    // Defence in depth against the empty-`:name` 405 (#2767): the server's
    // `PUT /meta/:type/:name` route rejects a missing segment. `viewEnvelope`
    // already guarantees a non-empty qualified name, so hitting this means a
    // caller bypassed it — fail loud rather than emit a malformed URL.
    throw new Error(
      `createRuntimeMetadata: name must be non-empty (type="${type}").` +
        ' The server PUT /meta/:type/:name route requires a name segment.',
    );
  }
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
