/**
 * composeStacks — Merge multiple ObjectStack definitions into one.
 *
 * Replaces manual spread/flatMap merging with a single, declarative call:
 *
 *   const merged = composeStacks([crmConfig, todoConfig, kitchenSinkConfig]);
 *
 * Features:
 * - Concatenates objects, views, actions, apps, dashboards, reports, pages
 * - Merges manifest.data arrays from all stacks
 * - Handles duplicate object names via `objectConflict` option
 * - Merges stack-level views (listViews) into corresponding objects
 * - Merges stack-level actions into objects via explicit `objectName` field
 *
 * Note: Uses Record<string, any> because inputs can be raw defineStack output,
 * plugin getConfig() results, or partial stacks with only views/actions.
 */

export interface ComposeStacksOptions {
  /** How to resolve two objects with the same `name`. Default: 'override' (last wins). */
  objectConflict?: 'override' | 'error';
}

/** A partial or full stack definition used as input to composeStacks. */
export type StackInput = Record<string, any>;

/**
 * Compose multiple stack definitions into a single merged definition.
 *
 * @param stacks  Array of raw stack configs (from defineStack or plugin getConfig)
 * @param options Composition options
 * @returns       A merged stack definition (unvalidated — call defineStack if needed)
 */
export function composeStacks(
  stacks: StackInput[],
  options: ComposeStacksOptions = {},
): Record<string, any> {
  const { objectConflict = 'override' } = options;

  // ── Collect arrays ──────────────────────────────────────────────────────
  const allObjects: any[] = [];
  const allViews: any[] = [];
  const allActions: any[] = [];
  const allApps: any[] = [];
  const allDashboards: any[] = [];
  const allReports: any[] = [];
  const allPages: any[] = [];
  const allData: any[] = [];

  for (const stack of stacks) {
    if (Array.isArray(stack.objects)) allObjects.push(...stack.objects);
    if (Array.isArray(stack.views)) allViews.push(...stack.views);
    if (Array.isArray(stack.actions)) allActions.push(...stack.actions);
    if (Array.isArray(stack.apps)) allApps.push(...stack.apps);
    if (Array.isArray(stack.dashboards)) allDashboards.push(...stack.dashboards);
    if (Array.isArray(stack.reports)) allReports.push(...stack.reports);
    if (Array.isArray(stack.pages)) allPages.push(...stack.pages);
    if (Array.isArray(stack.manifest?.data)) allData.push(...stack.manifest.data);
  }

  // ── Deduplicate objects ─────────────────────────────────────────────────
  const objectMap = new Map<string, any>();
  for (const obj of allObjects) {
    const name = obj?.name;
    if (!name) {
      objectMap.set(`__unnamed_${objectMap.size}`, obj);
      continue;
    }
    if (objectMap.has(name)) {
      if (objectConflict === 'error') {
        throw new Error(`composeStacks: duplicate object name "${name}"`);
      }
      // 'override' — last wins
    }
    objectMap.set(name, obj);
  }
  let objects = Array.from(objectMap.values());

  // ── Merge listViews into objects (temporary — will move to runtime) ─────
  objects = mergeViewsIntoObjects(objects, allViews);

  // ── Merge actions into objects via objectName ───────────────────────────
  objects = mergeActionsIntoObjects(objects, allActions);

  return {
    objects,
    views: allViews,
    actions: allActions,
    apps: allApps,
    dashboards: allDashboards,
    reports: allReports,
    pages: allPages,
    manifest: {
      data: allData,
    },
  };
}

// ---------------------------------------------------------------------------
// Internal: merge stack-level views into object definitions.
// Views are defined at the stack level (views[].listViews) but the runtime
// protocol expects listViews on each object.  This is a temporary adapter
// that should eventually move to the runtime/provider layer.
// ---------------------------------------------------------------------------
function mergeViewsIntoObjects(objects: any[], views: any[]): any[] {
  const viewsByObject: Record<string, Record<string, any>> = {};
  for (const view of views) {
    if (!view.listViews) continue;
    for (const [viewName, listView] of Object.entries(view.listViews as Record<string, any>)) {
      const objectName = listView?.data?.object;
      if (!objectName) continue;
      if (!viewsByObject[objectName]) viewsByObject[objectName] = {};
      viewsByObject[objectName][viewName] = listView;
    }
  }
  return objects.map((obj: any) => {
    const views = viewsByObject[obj.name];
    if (!views) return obj;
    return { ...obj, listViews: { ...(obj.listViews || {}), ...views } };
  });
}

// ---------------------------------------------------------------------------
// Internal: merge stack-level actions into object definitions via objectName.
// Each action MUST declare objectName for reliable matching. This replaces the
// previous heuristic name-prefix matching.
// ---------------------------------------------------------------------------
function mergeActionsIntoObjects(objects: any[], actions: any[]): any[] {
  if (actions.length === 0) return objects;

  const actionsByObject: Record<string, any[]> = {};
  for (const action of actions) {
    const target = action.objectName;
    if (!target) continue;
    if (!actionsByObject[target]) actionsByObject[target] = [];
    actionsByObject[target].push(action);
  }

  return objects.map((obj: any) => {
    const objActions = actionsByObject[obj.name];
    if (!objActions) return obj;
    return { ...obj, actions: [...(obj.actions || []), ...objActions] };
  });
}
