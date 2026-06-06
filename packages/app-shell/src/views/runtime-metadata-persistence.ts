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
   * View-only payload shaper. NOT used by the view UPDATE path (which goes
   * through `updateViewConfig` with the raw draft); reserved for wiring the
   * view CREATE legacy `sys_view` fallback through the seam later, so the
   * complex `toSysViewPayload` logic can stay in ObjectView.
   */
  toSysViewPayload?: (cfg: any, obj?: string) => any;
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
