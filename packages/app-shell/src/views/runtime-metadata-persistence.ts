// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ADR-0034 — Runtime metadata persistence seam (first code).
 *
 * Runtime editing of **views / reports / dashboards** historically writes
 * to bespoke per-type tables (`sys_view` / `sys_report` / `sys_dashboard`)
 * with immediate, unversioned writes. ADR-0034 unifies this with studio's
 * `/meta` per-item **draft → publish → version** model.
 *
 * This module is the single **seam** that both paths flow through, gated by
 * a feature flag:
 *
 *   • **flag OFF (default)** → reproduces today's behaviour exactly: writes
 *     to `sys_*` via the existing data-source / adapter. Zero behaviour
 *     change. Safe to merge and unit-test now.
 *   • **flag ON** → routes to `metadataClient.save(type, name, body,
 *     { mode: 'draft' })` (save-as-draft) and `metadataClient.publish(...)`.
 *
 * Scope of THIS change (deliberately small / low-risk):
 *   • The seam is wired into **ReportView** and **DashboardView** only.
 *   • **ObjectView (view)** is NOT wired yet — its `toSysViewPayload` +
 *     create-vs-update + debounce logic is more involved. The `view` branch
 *     below is written for the future, but ObjectView still runs its own
 *     legacy path today. See the `'view'` TODO in {@link persistRuntimeMetadata}.
 *   • No draft/publish UI is added here. No `sys_*` table is removed. No
 *     data migration is performed.
 *
 * The flag is read in exactly ONE place ({@link isViaMeta}) so the
 * mechanism can be swapped later (e.g. for a server-pushed runtime-config
 * capability) without touching call sites.
 */

/**
 * Underlying flag value, read once at module init from the Vite-time env var
 * `VITE_RUNTIME_EDIT_VIA_META`. Exported as the canonical, documented name
 * for the ADR; consumers that only need the static value can read this.
 *
 * NOTE: prefer {@link isViaMeta} internally so tests can flip the flag via
 * `vi.stubEnv('VITE_RUNTIME_EDIT_VIA_META', 'true')` without relying on
 * module-load timing.
 *
 * Default: `false` (legacy `sys_*` path).
 */
export const RUNTIME_EDIT_VIA_META: boolean =
  readViaMetaEnv();

/**
 * Read the raw env flag. Centralised so the source of truth is one place.
 *
 * In production the value comes from Vite's `import.meta.env` (inlined at
 * build time). We also consult `process.env` as a fallback so the flag is
 * togglable in Node/unit-test contexts (`vi.stubEnv`) where `import.meta.env`
 * is not patched.
 */
function readViaMetaEnv(): boolean {
  try {
    if ((import.meta as any).env?.VITE_RUNTIME_EDIT_VIA_META === 'true') return true;
  } catch {
    // import.meta.env unavailable in this context — fall through.
  }
  try {
    if (typeof process !== 'undefined' && process.env?.VITE_RUNTIME_EDIT_VIA_META === 'true') {
      return true;
    }
  } catch {
    // no process — ignore.
  }
  return false;
}

/**
 * Whether runtime edits should route through the `/meta` draft/publish
 * model. Reads the env flag live (not the captured constant) so unit tests
 * can toggle it with `vi.stubEnv`. This is the ONLY place the flag is
 * consulted — replace the body here to swap the flag mechanism later.
 */
export function isViaMeta(): boolean {
  return readViaMetaEnv();
}

/** The three runtime-editable artifact types ADR-0034 unifies. */
export type RuntimeArtifactType = 'view' | 'report' | 'dashboard';

/**
 * Everything the seam might need to persist any of the three artifact types,
 * passed by the call site. All optional so each call site only supplies what
 * its path needs (report/dashboard need `adapter`; view needs `dataSource` +
 * `toSysViewPayload`; the flag-on path needs `metadataClient`).
 */
export interface RuntimePersistCtx {
  /** Studio metadata client — used by the flag-ON `/meta` path. */
  metadataClient?: any;
  /** Generic data source — used by the legacy `sys_view` path. */
  dataSource?: any;
  /** ObjectStack adapter — used by the legacy `sys_report`/`sys_dashboard` path. */
  adapter?: any;
  /** Object a view belongs to — first arg to `updateViewConfig`. */
  objectName?: string;
  /**
   * View-only payload shaper for the CREATE legacy `sys_view` fallback. Used
   * by {@link createRuntimeMetadata} when the data source has no `createView`.
   * Kept as a call-site callback so the complex `toSysViewPayload` logic
   * (default-column derivation, etc.) stays in ObjectView's UI layer; the seam
   * only invokes it.
   */
  toSysViewPayload?: (cfg: any, obj?: string) => any;
}

/**
 * Unwrap a `?state=draft` GET response into its bare body, or `null` when
 * there is nothing pending.
 *
 * The framework wraps draft reads in a `{ type, name, item }` envelope (see
 * {@link MetadataClient.getDraft}); a published/legacy read is the bare body.
 * This accepts either shape and returns `null` for an empty/absent draft so
 * `!!readRuntimeDraft(...)` is a reliable "has pending changes" check. Mirrors
 * studio's `extractDraftBody` in `ResourceEditPage`.
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
 * Create a NEW runtime artifact, routed through the same seam as edits so the
 * flag controls create and update identically (ADR-0034 step / #1517).
 *
 * • flag OFF → reproduces ObjectView's legacy `handleViewCreate` write exactly:
 *   prefer the ADR-0005 overlay API (`dataSource.createView(objectName, body)`),
 *   else fall back to a physical `sys_view` insert
 *   (`dataSource.create('sys_view', toSysViewPayload(body, objectName))`).
 * • flag ON → `metadataClient.save(type, name, body, { mode: 'draft' })` — the
 *   new view is born as an invisible per-item draft, promoted by an explicit
 *   publish.
 *
 * Returns the created artifact's id/name (for auto-activation by the caller),
 * matching the legacy resolution: `created.name ?? name` for the overlay path,
 * `created.id ?? created._id` for the legacy `sys_view` insert.
 *
 * The UI-layer concerns the legacy path had (default-column derivation,
 * kanban/gallery sub-config massaging, auto-activation) stay in ObjectView;
 * only the final write call is centralised here.
 *
 * @param type artifact type (today only `view` has a create path)
 * @param name best-known identifier for the new item (the draft `:name` when
 *   flag ON; also the createView fallback id when the server omits one)
 * @param body the spec/config to persist
 * @param ctx  call-site capabilities (see {@link RuntimePersistCtx})
 */
export async function createRuntimeMetadata(
  type: RuntimeArtifactType,
  name: string,
  body: any,
  ctx: RuntimePersistCtx,
): Promise<string | undefined> {
  if (isViaMeta()) {
    // ── flag ON: create-as-draft via the unified /meta model ──
    await ctx.metadataClient.save(type, name, body, { mode: 'draft' });
    return name;
  }

  // ── flag OFF: legacy create write (today's `handleViewCreate` behaviour) ──
  switch (type) {
    case 'view': {
      if (typeof ctx.dataSource?.createView === 'function') {
        const created = await ctx.dataSource.createView(ctx.objectName, body);
        return (created as any)?.name ?? name;
      }
      if (ctx.dataSource?.create) {
        const payload = ctx.toSysViewPayload
          ? ctx.toSysViewPayload(body, ctx.objectName)
          : body;
        const created = await ctx.dataSource.create('sys_view', payload);
        return (created as any)?.id ?? (created as any)?._id;
      }
      return undefined;
    }
    // report/dashboard creation is not (yet) a runtime path — only update is.
    default:
      return undefined;
  }
}

/**
 * Read the pending draft body for a runtime artifact (for the "unpublished
 * changes" indicator and resume-on-open). Returns the bare body, or `null`
 * when nothing is pending.
 *
 * • flag OFF → always `null`: the legacy `sys_*` model has no draft concept.
 * • flag ON  → `metadataClient.get(type, name, { state: 'draft' })`, unwrapped.
 */
export async function readRuntimeDraft<T = Record<string, unknown>>(
  type: RuntimeArtifactType,
  name: string,
  ctx: RuntimePersistCtx,
): Promise<T | null> {
  if (!isViaMeta()) return null;
  const resp = await ctx.metadataClient.get(type, name, { state: 'draft' });
  return unwrapDraftBody(resp) as T | null;
}

/**
 * Discard the pending draft of a runtime artifact (Studio's "Discard draft").
 * The published overlay is untouched.
 *
 * • flag OFF → **no-op**: there is no draft to discard in the legacy model.
 * • flag ON  → `metadataClient.reset(type, name, { state: 'draft' })`.
 */
export async function discardRuntimeDraft(
  type: RuntimeArtifactType,
  name: string,
  ctx: RuntimePersistCtx,
): Promise<void> {
  if (!isViaMeta()) return;
  await ctx.metadataClient.reset(type, name, { state: 'draft' });
}

/**
 * Persist a runtime edit of a view / report / dashboard.
 *
 * • flag OFF → legacy `sys_*` write (behaviour identical to before this seam).
 * • flag ON  → `metadataClient.save(type, name, body, { mode: 'draft' })`
 *   (save-as-draft; an explicit publish promotes it — see
 *   {@link publishRuntimeMetadata}).
 *
 * @param type artifact type
 * @param name artifact name (the `:name` in `/meta/:type/:name`)
 * @param body the spec/schema/config to persist
 * @param ctx  call-site capabilities (see {@link RuntimePersistCtx})
 */
export async function persistRuntimeMetadata(
  type: RuntimeArtifactType,
  name: string,
  body: any,
  ctx: RuntimePersistCtx,
): Promise<void> {
  if (isViaMeta()) {
    // ── flag ON: unified studio path ──
    // Default to a per-item DRAFT (invisible to other users until publish).
    // `MetadataClient.save(type, name, item, { mode })` is the real write API
    // (PUT /meta/:type/:name) — the same one studio's editor uses.
    await ctx.metadataClient.save(type, name, body, { mode: 'draft' });
    return;
  }

  // ── flag OFF: legacy per-type tables (today's behaviour) ──
  switch (type) {
    case 'view': {
      // ObjectView's UPDATE path goes through the adapter's `updateViewConfig`
      // (the ADR-0005 overlay API), NOT a raw `sys_view` write — only the
      // CREATE legacy fallback touches the physical table. So the flag-OFF
      // view branch mirrors that update call exactly. The view CREATE path
      // (`createView` + default-columns / kanban / gallery massaging) is more
      // involved and is NOT wired to the seam yet (see ADR-0034 rollout).
      await ctx.dataSource.updateViewConfig(ctx.objectName, name, body);
      return;
    }
    case 'report': {
      await ctx.adapter.update('sys_report', name, body);
      return;
    }
    case 'dashboard': {
      if (ctx.adapter?.updateDashboard) {
        await ctx.adapter.updateDashboard(name, body);
      } else {
        await ctx.adapter.update('sys_dashboard', name, body);
      }
      return;
    }
  }
}

/**
 * Publish a previously-staged runtime edit.
 *
 * • flag OFF → **no-op**: the legacy `sys_*` model has no draft concept;
 *   writes were already live, so there is nothing to publish.
 * • flag ON  → `metadataClient.publish(type, name)` promotes the pending
 *   draft to the active overlay and records a version.
 *
 * This change does NOT add publish UI — that is a later, flag-gated step.
 */
export async function publishRuntimeMetadata(
  type: RuntimeArtifactType,
  name: string,
  ctx: RuntimePersistCtx,
): Promise<void> {
  if (!isViaMeta()) {
    // Legacy model: save was already live; nothing to publish.
    return;
  }
  await ctx.metadataClient.publish(type, name);
}
