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
  /**
   * The surface-binding target keys — CANONICAL SPELLINGS ONLY (objectui#4881).
   *
   * Every `NavigationItemSchema` member is a
   * `strictObject(navItemSurface(variant), ...)`, and the bare spellings
   * `page` / `object` / `dashboard` / `report` / `view` sit in neither any
   * variant's shape nor `NAV_ITEM_ALIASES`. Measured on `@objectstack/spec`
   * 17.0.0: each of them comes back `unrecognized_keys` from
   * `NavigationItemSchema` and from `AppSchema` — so a node carrying one
   * cannot be saved, and reading it here would only ever accept a dialect the
   * schema refuses (Commandment #0.1). Same reading, same reason, as
   * `AppNavCanvas`'s `navKind` (objectui#3275).
   */
  pageName?: string;
  objectName?: string;
  dashboardName?: string;
  reportName?: string;
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

/**
 * Resolve a leaf nav node → the surface {type,name} it binds to.
 *
 * Each case reads its variant's CANONICAL target key and nothing else. There
 * is deliberately no `view` case either: `NavigationItemSchema` is a
 * nine-member discriminated union (object / dashboard / page / url / report /
 * action / component / separator / group) with no `view` member, and
 * `viewName` is an optional key ON `ObjectNavItemSchema` ("which list view to
 * open"), not a navigation type. Measured on spec 17.0.0, `type: 'view'` fails
 * the discriminator outright (`invalid_union` at `type`), so such a leaf can
 * never reach a saved app and had no reachable branch to resolve.
 */
export function resolveSurface(node: NavNode): Surface | null {
  const label = String(node.label ?? '');
  switch (node.type) {
    case 'page':
      return node.pageName ? { type: 'page', name: String(node.pageName), label } : null;
    case 'object':
      return node.objectName ? { type: 'object', name: String(node.objectName), label } : null;
    case 'dashboard':
      return node.dashboardName ? { type: 'dashboard', name: String(node.dashboardName), label } : null;
    case 'report':
      return node.reportName ? { type: 'report', name: String(node.reportName), label } : null;
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
