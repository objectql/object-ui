/**
 * Adapter: merge stack-level views into object definitions.
 *
 * Views are defined at the stack level (views[].listViews) but the runtime
 * expects listViews on each object definition. This bridges the gap until
 * the runtime/provider layer handles it natively.
 *
 * @param objects - Object definitions from composed stack
 * @param views   - View definitions containing listViews keyed by object name
 * @returns Objects with listViews merged in from matching views
 */
export function mergeViewsIntoObjects(objects: any[], views: any[]): any[] {
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
    const v = viewsByObject[obj.name];
    if (!v) return obj;
    return { ...obj, listViews: { ...(obj.listViews || {}), ...v } };
  });
}
