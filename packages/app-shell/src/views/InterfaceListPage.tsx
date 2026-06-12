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
import { ListView } from '@object-ui/plugin-list';
import { useAdapter } from '@object-ui/react';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { Database } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { useMetadata } from '../providers/MetadataProvider';

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
  if (sourceView) {
    return (
      views[`${objectDef.name}.${sourceView}`]
      ?? views[sourceView]
      ?? (sourceView === 'default' || sourceView === 'list' ? objectDef?.list : undefined)
    );
  }
  return objectDef?.list ?? Object.values(views)[0];
}

export function InterfaceListPage({ page, className }: InterfaceListPageProps) {
  const { t } = useObjectTranslation();
  const { objects } = useMetadata();
  const dataSource = useAdapter();

  const cfg = page?.interfaceConfig || {};
  const objectDef = React.useMemo(
    () => (objects || []).find((o: any) => o.name === cfg.source),
    [objects, cfg.source],
  );
  const viewDef = React.useMemo(
    () => resolveSourceView(objectDef, cfg.sourceView),
    [objectDef, cfg.sourceView],
  );

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
  }, [objectDef, viewDef, cfg]);

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
        <ListView schema={schema} dataSource={dataSource} />
      </div>
    </div>
  );
}
