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
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ListView } from '@object-ui/plugin-list';
import { useAdapter, SchemaRenderer, useNavigationOverlay } from '@object-ui/react';
import { Empty, EmptyTitle, EmptyDescription, NavigationOverlay } from '@object-ui/components';
import { Database } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { useMetadata } from '../providers/MetadataProvider';
import { parseUserFilterParams, applyUserFilterParams } from './userFilterUrlState';
import { RecordDetailView } from './RecordDetailView';

interface InterfaceListPageProps {
  page: any;
  className?: string;
  /** Design-mode only: persist toolbar edits (sort, column order) back to the
   * page's interfaceConfig metadata (Airtable parity — the toolbar IS the
   * authoring surface). Receives a partial interfaceConfig patch. */
  onConfigChange?: (patch: Record<string, unknown>) => void;
  /** When the host overlays an edit-in-studio affordance at the page's
   * top-right (PageView's pencil), reserve right padding on the header so the
   * toolbar buttons don't sit under it. */
  reserveEditAffordance?: boolean;
}

/**
 * Resolve the source list view from the merged object definition.
 * Views merged from ADR-0017 ViewItems are keyed `<object>.<key>`;
 * the page author writes the bare key (`sourceView: 'default'`).
 */
/** A view "carries columns" only when its column list is actually non-empty. */
function hasColumns(v: any): boolean {
  return Array.isArray(v?.columns) && v.columns.length > 0;
}

function resolveSourceView(objectDef: any, sourceView?: string): any | undefined {
  const views: Record<string, any> = objectDef?.listViews || objectDef?.list_views || {};
  // ADR-0017 expansion can serve a default-view item with an empty config
  // while the full body lives on `objectDef.list` — prefer candidates that
  // actually carry columns over hollow name matches. An empty `columns: []`
  // is truthy in JS but renders a column-less grid, so check for non-empty.
  const candidates = sourceView
    ? [
        views[`${objectDef?.name}.${sourceView}`],
        views[sourceView],
        ...(sourceView === 'default' || sourceView === 'list' ? [objectDef?.list] : []),
      ]
    : [objectDef?.list, ...Object.values(views)];
  const present = candidates.filter(Boolean);
  return present.find(hasColumns) ?? present[0];
}

/**
 * Default column set when the resolved view carries none — mirrors
 * ObjectView's data-mode fallback so an interface page never renders a
 * column-less grid. Priority: the `highlightFields` semantic role
 * (ADR-0085), else the first business fields (system/audit columns
 * excluded).
 */
const SYSTEM_FIELDS = new Set([
  'id', 'created_at', 'createdAt', 'updated_at', 'updatedAt',
  'deleted_at', 'deletedAt', 'created_by', 'createdBy',
  'updated_by', 'updatedBy', '_version', '_rev',
]);
export function defaultColumnsFromObject(objectDef: any): string[] {
  const curated = objectDef?.highlightFields;
  if (Array.isArray(curated) && curated.length > 0) {
    return curated.filter((n: string) => objectDef.fields?.[n]);
  }
  const fields = objectDef?.fields;
  if (fields && typeof fields === 'object') {
    return Object.entries(fields)
      .filter(([name, f]: [string, any]) => f && !f.hidden && !SYSTEM_FIELDS.has(name))
      .map(([name]) => name)
      .slice(0, 6);
  }
  return [];
}

/**
 * Default visualization bindings derived from the object's fields.
 *
 * ADR-0047: an interface page sets `appearance.allowedVisualizations` to
 * whitelist renderers, but a viz only renders when its field binding
 * resolves (kanban needs a group field, calendar a date, gallery a cover).
 * The page config has nowhere to set those, so — like `defaultColumnsFromObject`
 * — we auto-pick a sensible binding from the object (Airtable does the same
 * when you switch to Kanban). Without this, a whitelisted kanban is silently
 * dropped from the switcher and the author gets no feedback.
 */
function firstFieldMatching(
  objectDef: any,
  pred: (name: string, f: any) => boolean,
): string | undefined {
  const fields = objectDef?.fields;
  if (!fields || typeof fields !== 'object') return undefined;
  const hit = Object.entries(fields).find(
    ([name, f]: [string, any]) => f && !f.hidden && !SYSTEM_FIELDS.has(name) && pred(name, f),
  );
  return hit?.[0];
}

const SELECT_TYPES = new Set(['select', 'multiselect', 'radio', 'enum', 'boolean']);
const DATE_TYPES = new Set(['date', 'datetime', 'time']);
const IMAGE_TYPES = new Set(['image', 'file', 'attachment', 'avatar', 'photo']);

export function defaultKanbanFromObject(objectDef: any): { groupField: string; groupByField: string } | undefined {
  const field =
    firstFieldMatching(objectDef, (_n, f) => SELECT_TYPES.has(f.type)) ??
    firstFieldMatching(objectDef, (n) => /status|stage|state|priority|category|kind/i.test(n));
  // ListView reads `groupField` to render and `groupByField || groupField`
  // to decide the viz is available — set both so it resolves either way.
  return field ? { groupField: field, groupByField: field } : undefined;
}

function defaultDateField(objectDef: any): string | undefined {
  return (
    firstFieldMatching(objectDef, (_n, f) => DATE_TYPES.has(f.type)) ??
    firstFieldMatching(objectDef, (n) => /date|due|start|end|deadline|schedule/i.test(n))
  );
}

export function defaultCalendarFromObject(objectDef: any): { startDateField: string } | undefined {
  const field = defaultDateField(objectDef);
  return field ? { startDateField: field } : undefined;
}

export function defaultGalleryFromObject(objectDef: any): { coverField: string } | undefined {
  const field = firstFieldMatching(objectDef, (_n, f) => IMAGE_TYPES.has(f.type));
  return field ? { coverField: field } : undefined;
}

const LOCATION_TYPES = new Set(['location', 'geo', 'geolocation', 'geopoint', 'point']);

// Gantt needs BOTH a start and an end date. Prefer name-disambiguated fields
// (start_date / end_date / due_date), else fall back to the first two date
// fields. Returns undefined unless two distinct dates resolve.
export function defaultGanttFromObject(objectDef: any): { startDateField: string; endDateField: string; progressField?: string } | undefined {
  const start =
    firstFieldMatching(objectDef, (n, f) => DATE_TYPES.has(f.type) && /start|begin|kickoff/i.test(n)) ??
    firstFieldMatching(objectDef, (_n, f) => DATE_TYPES.has(f.type));
  if (!start) return undefined;
  const end =
    firstFieldMatching(objectDef, (n, f) => DATE_TYPES.has(f.type) && n !== start && /end|due|finish|deadline|close/i.test(n)) ??
    firstFieldMatching(objectDef, (_n, f) => DATE_TYPES.has(f.type) && _n !== start);
  if (!end) return undefined;
  const progress = firstFieldMatching(objectDef, (n, f) => (f.type === 'number' || f.type === 'percent') && /progress|percent|complete/i.test(n));
  return { startDateField: start, endDateField: end, ...(progress ? { progressField: progress } : {}) };
}

// Map needs a location/geo field (or address). Auto-derive from a location-typed
// field, else a field whose name looks geographic.
export function defaultMapFromObject(objectDef: any): { locationField: string } | undefined {
  const field =
    firstFieldMatching(objectDef, (_n, f) => LOCATION_TYPES.has(f.type)) ??
    firstFieldMatching(objectDef, (n) => /location|address|geo|coords?|place|venue/i.test(n));
  return field ? { locationField: field } : undefined;
}

export function InterfaceListPage({ page, className, onConfigChange, reserveEditAffordance }: InterfaceListPageProps) {
  const { t } = useObjectTranslation();
  const { objects } = useMetadata();
  const dataSource = useAdapter();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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

  // ── Record open behavior (ADR-0047) — how clicking a record opens its detail.
  // 'drawer' (default) = right-side peek panel rendering the record's detail
  // page; 'page' = full-page navigate to the record route; 'none' = not
  // clickable. Restores record-opening on interface pages (previously a no-op)
  // and makes it author-configurable.
  const recordAction: 'drawer' | 'page' | 'modal' | 'none' =
    cfg.recordAction === 'page' || cfg.recordAction === 'modal' || cfg.recordAction === 'none'
      ? cfg.recordAction
      : 'drawer';
  const recordUrl = React.useCallback(
    (id: string | number) => {
      const seg = window.location.pathname.split('/');
      const appSeg = seg[2] || '';
      return `/apps/${appSeg}/${cfg.source}/record/${encodeURIComponent(String(id))}`;
    },
    [cfg.source],
  );
  const navOverlay = useNavigationOverlay({
    navigation: { mode: recordAction === 'none' ? 'none' : recordAction },
    objectName: cfg.source,
    onNavigate: (id) => navigate(recordUrl(id)),
  });
  const drawerRecordId = searchParams.get('recordId');
  const handleRecordClick = React.useCallback(
    (record: any, event?: any) => {
      if (recordAction === 'none') return;
      const id = record?.id ?? record?._id;
      const isMod = !!(event && (event.metaKey || event.ctrlKey || event.button === 1));
      if (isMod && id != null) { window.open(recordUrl(id), '_blank'); return; }
      // Overlay modes are URL-driven (?recordId=…) so the drawer is shareable
      // and survives refresh — same convention as ObjectView.
      if ((recordAction === 'drawer' || recordAction === 'modal') && id != null) {
        setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('recordId', String(id)); return n; });
        return;
      }
      navOverlay.handleClick(record, event);
    },
    [recordAction, recordUrl, navOverlay, setSearchParams],
  );
  const closeRecordDrawer = React.useCallback(() => {
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('recordId'); return n; });
  }, [setSearchParams]);
  React.useEffect(() => {
    if (drawerRecordId && !navOverlay.isOpen) navOverlay.open({ id: drawerRecordId });
    else if (!drawerRecordId && navOverlay.isOpen) navOverlay.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerRecordId]);

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
  // Hollow = no *non-empty* column list. An empty `columns: []` reads as
  // truthy but renders nothing, so it must still trigger hydration.
  const resolvedViewHollow = !!resolvedView && !hasColumns(resolvedView);
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
        if (!hasColumns(full) && typeof ds?.getView === 'function') {
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
    const allowedSet = new Set(allowed);
    const userActions = cfg.userActions || {};

    // Viz field bindings: the referenced view's config wins; otherwise, when
    // the author whitelisted a viz, derive a sensible default binding from the
    // object so the switcher actually offers (and renders) it. Only derive for
    // whitelisted types — an un-whitelisted viz is never reachable.
    const kanban =
      view.kanban ?? (allowedSet.has('kanban') ? defaultKanbanFromObject(objectDef) : undefined);
    const calendar =
      view.calendar ?? (allowedSet.has('calendar') ? defaultCalendarFromObject(objectDef) : undefined);
    const timeline =
      view.timeline ?? (allowedSet.has('timeline') ? defaultCalendarFromObject(objectDef) : undefined);
    const gallery =
      view.gallery ?? (allowedSet.has('gallery') ? defaultGalleryFromObject(objectDef) : undefined);
    const gantt =
      view.gantt ?? (allowedSet.has('gantt') ? defaultGanttFromObject(objectDef) : undefined);
    // Map binding lives under options.map (locationField); auto-derive when
    // whitelisted so a map interface page renders without hand-wiring.
    const mapCfg =
      (view.options as any)?.map ?? (allowedSet.has('map') ? defaultMapFromObject(objectDef) : undefined);

    // Data semantics — ADR-0047 (revised): the PAGE owns its view metadata.
    // Precedence everywhere: the page's own config → legacy sourceView view
    // (back-compat) → a sensible default derived from the object.
    const filters = [
      ...(Array.isArray(view.filter) ? view.filter : []),
      ...(Array.isArray(cfg.filterBy) ? cfg.filterBy : []),
    ];

    // Columns: the page's own `columns` win; else the legacy referenced view's;
    // else a default from the object so the grid never renders just the
    // row-number column.
    const columns = hasColumns(cfg)
      ? (cfg.columns as any)
      : hasColumns(view)
        ? view.columns
        : defaultColumnsFromObject(objectDef);

    // Sort: the page's own first, then the legacy view's.
    const sort = Array.isArray(cfg.sort) && cfg.sort.length ? cfg.sort : view.sort;

    return {
      type: 'list-view' as const,
      objectName: objectDef.name,
      viewType: (allowed[0] ?? view.type ?? 'grid'),
      fields: columns,
      ...(filters.length ? { filters } : {}),
      ...(sort?.length ? { sort } : {}),
      grouping: view.grouping,
      rowColor: view.rowColor,
      pagination: view.pagination,
      searchableFields: view.searchableFields,
      emptyState: view.emptyState,
      kanban,
      calendar,
      gallery,
      timeline,
      gantt,
      ...((mapCfg || (view.options as any)) ? { options: { ...((view.options as any) ?? {}), ...(mapCfg ? { map: mapCfg } : {}) } } : {}),

      // Presentation policy — the page layer (ADR-0047).
      userFilters: cfg.userFilters ?? view.userFilters,
      appearance,
      showViewSwitcher: allowed.length > 1,
      showRecordCount: cfg.showRecordCount,
      // Add-record entry point (ListView gates the button on addRecord.enabled,
      // independent of the active visualization). Without forwarding this, the
      // panel's "Add Record" config silently did nothing at runtime.
      addRecord: cfg.addRecord,

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
      // Inline record editing is a page-authored property: a list block opts in
      // via `userActions.editInline` (default off). When on, clicking a cell
      // edits it with the dedicated field widgets, same as the object views.
      inlineEdit: userActions.editInline === true,
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

  // Toolbar buttons ARE object actions (ADR-0047): resolve the configured
  // action names against the source object's ActionSchema and render them via
  // the shared action:bar (which handles execution).
  const buttonActions = Array.isArray(cfg.buttons) && cfg.buttons.length
    ? (cfg.buttons as string[])
        .map((name) => (objectDef.actions || []).find((a: any) => a?.name === name))
        .filter(Boolean)
        // The author explicitly chose these as page buttons, so surface them in
        // the toolbar regardless of the action's own `locations` (the action:bar
        // filters by location).
        .map((a: any) => ({ ...a, locations: ['list_toolbar'] }))
    : [];

  return (
    <div className={className ?? 'h-full flex flex-col'} data-testid="interface-list-page">
      <div className={`pl-4 pt-4 pb-2 shrink-0 flex items-start justify-between gap-3 ${reserveEditAffordance ? 'pr-12' : 'pr-4'}`}>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight">
            {typeof page.label === 'string' ? page.label : page.name}
          </h1>
          {typeof page.description === 'string' && page.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{page.description}</p>
          )}
        </div>
        {buttonActions.length > 0 && (
          <div className="shrink-0" data-testid="interface-page-buttons">
            <SchemaRenderer schema={{ type: 'action:bar', location: 'list_toolbar', actions: buttonActions, size: 'sm', variant: 'outline' }} />
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        <ListView
          schema={schema}
          dataSource={dataSource}
          userFilterSelections={initialUfSelections}
          onUserFilterSelectionsChange={handleUserFilterSelectionsChange}
          onSortChange={onConfigChange ? (sort: any) => onConfigChange({ sort }) : undefined}
          onColumnStateChange={onConfigChange ? (st: { order?: string[] }) => { if (st?.order?.length) onConfigChange({ columns: st.order }); } : undefined}
          onRowClick={recordAction === 'none' ? undefined : handleRecordClick}
        />
      </div>
      {navOverlay.isOverlay && (
        <NavigationOverlay
          {...navOverlay}
          setIsOpen={(o: boolean) => { if (!o) closeRecordDrawer(); }}
          title={typeof page.label === 'string' ? page.label : (cfg.source || 'Record')}
        >
          {(record: any) => (
            <RecordDetailView
              objectNameOverride={cfg.source}
              recordIdOverride={String(record?.id ?? record?._id ?? drawerRecordId ?? '')}
              embedded
              dataSource={dataSource}
              objects={objects}
              onEdit={() => {}}
            />
          )}
        </NavigationOverlay>
      )}
    </div>
  );
}
