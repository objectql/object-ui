/**
 * Interface List Page — ADR-0047 interface mode.
 *
 * Renders a page whose `interfaceConfig` binds a single source view into an
 * author-curated list surface. Where ObjectView (data mode) shows ALL of an
 * object's list views as switcher tabs and lets users create views, this
 * surface is deliberately closed:
 *
 *   • the page REFERENCES one view (`interfaceConfig.sourceView`) — columns,
 *     base filter and sort are inherited, never restated (the iron rule);
 *   • end users get exactly the `userFilters` the author enabled;
 *   • the visualization comes from `appearance.allowedVisualizations`
 *     (a single entry renders no switcher);
 *   • `userActions` toggles map onto the toolbar — advanced filtering and
 *     view management are absent by default.
 */

import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListView } from '@object-ui/plugin-list';
import { useAdapter } from '@object-ui/react';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { Database } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { useMetadata } from '../providers/MetadataProvider';
import { parseUserFilterParams, applyUserFilterParams } from './userFilterUrlState';

interface InterfaceListPageProps {
  page: any;
  className?: string;
}

/**
 * Resolve the source list view from the merged object definition.
 * Views merged from ADR-0017 ViewItems are keyed `<object>.<key>`;
 * the page author writes the bare key (`sourceView: 'default'`).
 */
function resolveSourceView(objectDef: any, sourceView?: string): any | undefined {
  const views: Record<string, any> = objectDef?.listViews || objectDef?.list_views || {};
  // ADR-0017 expansion can serve a default-view item with an empty config
  // while the full body lives on `objectDef.list` — prefer candidates that
  // actually carry columns over hollow name matches.
  const candidates = sourceView
    ? [
        views[`${objectDef?.name}.${sourceView}`],
        views[sourceView],
        ...(sourceView === 'default' || sourceView === 'list' ? [objectDef?.list] : []),
      ]
    : [objectDef?.list, ...Object.values(views)];
  const present = candidates.filter(Boolean);
  return present.find((v: any) => v?.columns) ?? present[0];
}

export function InterfaceListPage({ page, className }: InterfaceListPageProps) {
  const { t } = useObjectTranslation();
  const { objects } = useMetadata();
  const dataSource = useAdapter();
  const [, setSearchParams] = useSearchParams();

  // ADR-0047 filter persistence: restore `uf_*` URL params once at mount,
  // mirror every selection change back (replace — no history spam).
  const [initialUfSelections] = React.useState<Record<string, string[]> | undefined>(
    () => parseUserFilterParams(new URLSearchParams(window.location.search)),
  );
  const handleUserFilterSelectionsChange = React.useCallback(
    (selections: Record<string, Array<string | number | boolean>>) => {
      setSearchParams(prev => applyUserFilterParams(prev, selections), { replace: true });
    },
    [setSearchParams],
  );

  const cfg = page?.interfaceConfig || {};
  const objectDef = React.useMemo(
    () => (objects || []).find((o: any) => o.name === cfg.source),
    [objects, cfg.source],
  );
  const resolvedView = React.useMemo(
    () => resolveSourceView(objectDef, cfg.sourceView),
    [objectDef, cfg.sourceView],
  );

  // The view list endpoint can serve hollow expansion items (no columns);
  // the full body lives behind the per-view overlay API — the same
  // hydration ObjectView performs. Only fetch when the resolution came up
  // hollow.
  //
  // IMPORTANT: the deps are SCALARS, not the objectDef/resolvedView object
  // identities. `useMetadata().objects` is rebuilt per render, so identity
  // deps re-fire this effect on every render — and the unconditional
  // `setHydratedView(null)` then ping-pongs with the async `setHydratedView
  // (full)` into an infinite render/refetch loop the moment anything (e.g.
  // a `uf_*` URL write) re-renders this component after hydration settled.
  const objectDefName: string | undefined = objectDef?.name;
  const resolvedViewHollow = !!resolvedView && !resolvedView.columns;
  const resolvedViewKey = resolvedView?.name
    ?? (cfg.sourceView ? `${cfg.source}.${cfg.sourceView}` : undefined);
  const [hydratedView, setHydratedView] = React.useState<any>(null);
  React.useEffect(() => {
    let cancelled = false;
    setHydratedView(null);
    if (!objectDefName || !cfg.source || !resolvedViewHollow || !resolvedViewKey) return;
    (async () => {
      try {
        const ds: any = dataSource;
        let full: any = null;
        if (typeof ds?.listViewOverrides === 'function') {
          const all = await ds.listViewOverrides(cfg.source);
          full = all?.[resolvedViewKey] ?? null;
        }
        if (!full?.columns && typeof ds?.getView === 'function') {
          full = await ds.getView(cfg.source, resolvedViewKey);
        }
        if (!cancelled && full && typeof full === 'object') setHydratedView(full);
      } catch { /* hollow view stays hollow — renderer falls back to defaults */ }
    })();
    return () => { cancelled = true; };
  }, [objectDefName, cfg.source, cfg.sourceView, resolvedViewHollow, resolvedViewKey, dataSource]);

  const viewDef = React.useMemo(
    () => (hydratedView ? { ...resolvedView, ...hydratedView } : resolvedView),
    [resolvedView, hydratedView],
  );

  // Key the schema on CONTENT, not object identity — `objects` (and thus
  // objectDef/resolvedView) are rebuilt per render, and a new schema
  // identity makes ListView refetch. The serialized view config is small.
  const viewDefJson = JSON.stringify(viewDef ?? null);
  const schema = React.useMemo(() => {
    if (!objectDef) return undefined;
    const view = viewDef || {};
    const appearance = cfg.appearance ?? view.appearance;
    const allowed: string[] = appearance?.allowedVisualizations || [];
    const userActions = cfg.userActions || {};

    // Inherited data semantics (the iron rule: all from the view) + the
    // page's own always-on criteria (`filterBy`).
    const filters = [
      ...(Array.isArray(view.filter) ? view.filter : []),
      ...(Array.isArray(cfg.filterBy) ? cfg.filterBy : []),
    ];

    return {
      type: 'list-view' as const,
      objectName: objectDef.name,
      viewType: (allowed[0] ?? view.type ?? 'grid'),
      fields: view.columns,
      ...(filters.length ? { filters } : {}),
      ...(view.sort?.length ? { sort: view.sort } : {}),
      grouping: view.grouping,
      rowColor: view.rowColor,
      pagination: view.pagination,
      searchableFields: view.searchableFields,
      emptyState: view.emptyState,
      kanban: view.kanban,
      calendar: view.calendar,
      gallery: view.gallery,
      timeline: view.timeline,
      gantt: view.gantt,

      // Presentation policy — the page layer (ADR-0047).
      userFilters: cfg.userFilters ?? view.userFilters,
      appearance,
      showViewSwitcher: allowed.length > 1,
      showRecordCount: cfg.showRecordCount,

      // userActions toggles → toolbar flags. Interface mode is closed by
      // default: the advanced filter builder and view-management tools are
      // only present when the author opted in.
      showSearch: userActions.search !== false,
      showSort: userActions.sort !== false,
      showFilters: userActions.filter === true,
      showDensity: userActions.rowHeight === true,
      showHideFields: false,
      showGroup: false,
      showColor: false,
      allowExport: false,
      inlineEdit: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectDefName, viewDefJson, cfg]);

  if (!objectDef || !schema) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Database className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>{t('empty.objectNotFound', { defaultValue: 'Source object not found' })}</EmptyTitle>
          <EmptyDescription>
            {t('empty.interfacePageSourceMissing', {
              defaultValue: 'This interface page references "{{name}}", which is not available.',
              name: cfg.source || '?',
            })}
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className={className ?? 'h-full flex flex-col'} data-testid="interface-list-page">
      <div className="px-4 pt-4 pb-2 shrink-0">
        <h1 className="text-lg font-semibold leading-tight">
          {typeof page.label === 'string' ? page.label : page.name}
        </h1>
        {typeof page.description === 'string' && page.description && (
          <p className="text-sm text-muted-foreground mt-0.5">{page.description}</p>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <ListView
          schema={schema}
          dataSource={dataSource}
          userFilterSelections={initialUfSelections}
          onUserFilterSelectionsChange={handleUserFilterSelectionsChange}
        />
      </div>
    </div>
  );
}
