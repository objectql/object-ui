// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Nav-leaf → design-surface resolution for the Studio Interfaces pillar.
 *
 * The Interfaces pillar's rail is NOT a per-type list (the Data / Automations /
 * Access rails are — `object` / `flow` / `permission`). It is the current
 * package's App `navigation` tree: every leaf is rendered, and the one that
 * `resolveSurface` can bind to a `{type,name}` opens that item's design surface
 * (`getMetadataPreview` canvas + `getMetadataInspector` / default inspector).
 * A leaf that resolves to `null` renders DISABLED — correct for the nav
 * variants whose target is not an authorable metadata item (`url` points out of
 * the product, `separator` is a divider, `component` names a first-party UI
 * shipped in code), and a dead entry for any variant that does have one.
 *
 * Extracted from `StudioDesignSurface.tsx` so the binding is unit-testable
 * without mounting the pillar — the same reason `packageSurfaces.ts` and
 * `centerTab.ts` live beside it.
 */

/** One rail entry / canvas target. */
export interface Surface {
  type: string;
  name: string;
  label: string;
  /** Lucide icon name from the object's metadata (`icon` field); falls back per getIcon. */
  icon?: string;
}

export interface NavNode {
  id?: string;
  label?: string;
  type?: string;
  icon?: string;
  children?: NavNode[];
  pageName?: string;
  page?: string;
  objectName?: string;
  object?: string;
  dashboardName?: string;
  dashboard?: string;
  reportName?: string;
  report?: string;
  viewName?: string;
  view?: string;
  /**
   * `ActionNavItemSchema.actionDef` — a `.strict()` object of exactly
   * `{ actionName, params? }`. The spec answers `action` / `name` / `args` /
   * `input` here as REJECTED spellings with a redirect (objectstack#4001), so
   * they are authoring errors, never second spellings to read (Commandment
   * #0.1): this type declares the canonical key alone.
   */
  actionDef?: { actionName?: string; params?: Record<string, unknown> };
  [k: string]: unknown;
}

/** Resolve a leaf nav node → the surface {type,name} it binds to. */
export function resolveSurface(node: NavNode): Surface | null {
  const label = String(node.label ?? '');
  switch (node.type) {
    case 'page':
      return node.pageName || node.page ? { type: 'page', name: String(node.pageName || node.page), label } : null;
    case 'object':
      return node.objectName || node.object
        ? { type: 'object', name: String(node.objectName || node.object), label }
        : null;
    case 'dashboard':
      return node.dashboardName || node.dashboard
        ? { type: 'dashboard', name: String(node.dashboardName || node.dashboard), label }
        : null;
    case 'report':
      return node.reportName || node.report
        ? { type: 'report', name: String(node.reportName || node.report), label }
        : null;
    case 'view':
      return node.viewName || node.view ? { type: 'view', name: String(node.viewName || node.view), label } : null;
    // A nav action is a GLOBAL action by construction: `ActionNavItemSchema` is
    // `.strict()` with exactly `{ actionName, params? }` and carries no
    // `objectName`, so an object-scoped action is not addressable from the nav
    // (see `useNavActionDispatch`, which resolves the name against `action`
    // metadata at click time). That makes this leaf the design-time half of a
    // surface the running app already dispatches (framework#4509) — before
    // this case it rendered permanently disabled in the rail while the same
    // entry worked in the shipped sidebar.
    //
    // Object-scoped actions keep their own home, the object's Actions tab
    // (`ObjectActionsPanel`, objectui#2330) — this case cannot reach them and
    // must not try to.
    case 'action':
      return node.actionDef?.actionName
        ? { type: 'action', name: String(node.actionDef.actionName), label }
        : null;
    default:
      return null;
  }
}

/**
 * Walk the nav tree for the leaf that binds to `{type,name}`, returning its
 * resolved Surface (carrying the node's label so the canvas title / highlight
 * match). Backs the `?surface=` deep-link restore — a shared URL only names
 * the target, so we re-derive the label from the live tree.
 */
export function findSurfaceInTree(nodes: NavNode[], target: { type: string; name: string }): Surface | null {
  for (const node of nodes) {
    if (node.type === 'group' || node.children?.length) {
      const hit = findSurfaceInTree(node.children ?? [], target);
      if (hit) return hit;
    } else {
      const s = resolveSurface(node);
      if (s && s.type === target.type && s.name === target.name) return s;
    }
  }
  return null;
}
