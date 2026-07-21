/**
 * Object Data Page — the parameterized bare data surface (ADR-0055, #2251).
 *
 * Route: `/apps/:appName/:objectName/data` (± `filter[<field>]=<value>` and
 * `uf_<field>` search params).
 *
 * Where ObjectView anchors to a saved list view (default or `/view/:viewId`),
 * this surface is deliberately UNANCHORED — "the URL is the view":
 *
 *   • no saved-view filter is baked in: URL `filter[...]` conditions apply on
 *     top of everything the user is allowed to see (row-level security is the
 *     server-enforced baseline, never a view);
 *   • URL conditions render as visible, removable chips (unlike Odoo's
 *     invisible action domain);
 *   • no saved-view tab bar — switching to a saved view is an explicit
 *     navigation to `/view/:viewId` ("Save as view" is the exit);
 *   • nothing here writes back to any saved view;
 *   • the visualization switcher (grid/kanban/...) is ListView-internal, so
 *     switching presentation never touches the URL — filter state survives;
 *   • the common filter bar (ADR-0047 `userFilters` + `uf_*` persistence) is
 *     auto-derived from the object's enum-ish fields, since there is no view
 *     to author it on (ADR-0053 puts userFilters on views/pages).
 *
 * Field-level security: auto-derived columns, the filter bar, and URL filter
 * predicates are all trimmed to readable fields client-side; the server is
 * the enforcement point (it must drop predicates on unreadable fields).
 */

import * as React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ListView } from '@object-ui/plugin-list';
import { useNavigationOverlay } from '@object-ui/react';
import {
  Button,
  Empty,
  EmptyTitle,
  EmptyDescription,
  NavigationOverlay,
} from '@object-ui/components';
import { Database, Lock, Plus, Save, X } from 'lucide-react';
import { useObjectTranslation, useObjectLabel } from '@object-ui/i18n';
import { usePermissions, useFieldPermissions } from '@object-ui/permissions';
import { useAuth, useIsWorkspaceAdmin } from '@object-ui/auth';
import { parseUserFilterParams, applyUserFilterParams } from './userFilterUrlState';
import {
  parseUrlFilterTriples,
  groupFilterChips,
  deleteFieldFilterParams,
  type FilterTriple,
} from './drillUrlFilters';
import {
  defaultColumnsFromObject,
  defaultKanbanFromObject,
  defaultCalendarFromObject,
  defaultGalleryFromObject,
} from './InterfaceListPage';
import { RecordDetailView } from './RecordDetailView';
import { PageHeader } from '../layout/PageHeader';
import { getIcon } from '../utils/getIcon';
import { useMetadataClient } from './metadata-admin/useMetadata';
import { createRuntimeMetadata, viewEnvelope } from './runtime-metadata-persistence';
import { CreateViewDialog } from './CreateViewDialog';
import {
  usePreviewDrafts,
  PREVIEW_QUERY_FLAG,
  PREVIEW_QUERY_VALUE,
} from '../preview/PreviewModeContext';

/** Field types the auto-derived user-filter bar offers as dropdowns. */
const USER_FILTER_TYPES = new Set(['select', 'multiselect', 'radio', 'enum', 'boolean']);
const MAX_USER_FILTERS = 4;

export function ObjectDataPage({ dataSource, objects }: any) {
  const { appName, objectName } = useParams();
  const { t } = useObjectTranslation();
  const { objectLabel, fieldLabel } = useObjectLabel();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = usePermissions();
  const { canRead } = useFieldPermissions(objectName ?? '');
  const { user } = useAuth();
  const isAdmin = useIsWorkspaceAdmin();
  const metadataClient = useMetadataClient();
  // ADR-0037: enter draft-preview after "Save as view" so the fresh draft is
  // visible; if already previewing, keep the flag off the suffix (it's sticky).
  const previewDrafts = usePreviewDrafts();
  const [showCreateViewDialog, setShowCreateViewDialog] = React.useState(false);

  const objectDef = React.useMemo(
    () => (objects || []).find((o: any) => o.name === objectName),
    [objects, objectName],
  );

  // ADR-0047 filter persistence — same wiring as InterfaceListPage: restore
  // `uf_*` once at mount, mirror selection changes back (replace, no history
  // spam).
  const [initialUfSelections] = React.useState<Record<string, string[]> | undefined>(
    () => parseUserFilterParams(new URLSearchParams(window.location.search)),
  );
  const handleUserFilterSelectionsChange = React.useCallback(
    (selections: Record<string, Array<string | number | boolean>>) => {
      setSearchParams((prev) => applyUserFilterParams(prev, selections), { replace: true });
    },
    [setSearchParams],
  );

  // URL filter triples, trimmed to readable fields. Predicates on unreadable
  // fields are dropped here for UX honesty; the SERVER is the actual
  // enforcement point against filter-oracle probing.
  const filterParamsKey = Array.from(searchParams.entries())
    .filter(([k]) => k.startsWith('filter['))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const urlFilters = React.useMemo(() => {
    const all = parseUrlFilterTriples(new URLSearchParams(filterParamsKey));
    const readable = all.filter(([field]) => canRead(field));
    if (readable.length < all.length) {
      const dropped = all.filter(([field]) => !canRead(field)).map(([field]) => field);
      console.warn(
        `[ObjectDataPage] Dropped URL filter(s) on unreadable field(s): ${dropped.join(', ')}`,
      );
    }
    // Template variables mirror nav `recordId` substitution so shared links
    // can carry `{current_user_id}`.
    return readable.map(([field, op, value]) =>
      value === '{current_user_id}' ? [field, op, user?.id ?? value] : [field, op, value],
    ) as FilterTriple[];
  }, [filterParamsKey, canRead, user?.id]);

  // One display chip per field — a date-bucket drill's two range triples
  // (>= start, < end) collapse into a single "start → end" chip (#1752).
  const filterChips = React.useMemo(() => groupFilterChips(urlFilters), [urlFilters]);

  const removeUrlFilter = React.useCallback(
    (field: string) => {
      // Clears the equality param AND both range-bound operator params for the field.
      setSearchParams((prev) => deleteFieldFilterParams(new URLSearchParams(prev), field));
    },
    [setSearchParams],
  );

  // Auto-derived columns + filter bar, both trimmed by field-level security.
  const columns = React.useMemo(
    () => defaultColumnsFromObject(objectDef).filter((f: string) => canRead(f)),
    [objectDef, canRead],
  );
  const userFilters = React.useMemo(() => {
    const fields = objectDef?.fields;
    if (!fields || typeof fields !== 'object') return undefined;
    const picks = Object.entries(fields)
      .filter(([name, f]: [string, any]) =>
        f && !f.hidden && USER_FILTER_TYPES.has(f.type) && canRead(name))
      .slice(0, MAX_USER_FILTERS)
      .map(([name]) => ({ field: name }));
    return picks.length > 0 ? { element: 'dropdown' as const, fields: picks } : undefined;
  }, [objectDef, canRead]);

  // Record open behavior — URL-driven drawer, same convention as ObjectView
  // and InterfaceListPage (`?recordId=…` is shareable and refresh-safe).
  const recordUrl = React.useCallback(
    (id: string | number) =>
      `/apps/${appName}/${objectName}/record/${encodeURIComponent(String(id))}`,
    [appName, objectName],
  );
  const navOverlay = useNavigationOverlay({
    navigation: { mode: 'drawer' },
    objectName: objectName ?? '',
    onNavigate: (id) => navigate(recordUrl(id)),
  });
  const drawerRecordId = searchParams.get('recordId');
  const handleRecordClick = React.useCallback(
    (record: any, event?: any) => {
      const id = record?.id ?? record?._id;
      const isMod = !!(event && (event.metaKey || event.ctrlKey || event.button === 1));
      if (isMod && id != null) { window.open(recordUrl(id), '_blank'); return; }
      if (id != null) {
        setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('recordId', String(id)); return n; });
      }
    },
    [recordUrl, setSearchParams],
  );
  const closeRecordDrawer = React.useCallback(() => {
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('recordId'); return n; });
  }, [setSearchParams]);
  React.useEffect(() => {
    if (drawerRecordId && !navOverlay.isOpen) navOverlay.open({ id: drawerRecordId });
    else if (!drawerRecordId && navOverlay.isOpen) navOverlay.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerRecordId]);

  // Visualization whitelist: grid always; others only when a field binding
  // resolves from the object. The switcher is ListView-internal, so switching
  // presentation never rewrites the URL — filter params survive by
  // construction (#2251 acceptance).
  const kanban = React.useMemo(() => defaultKanbanFromObject(objectDef), [objectDef]);
  const calendar = React.useMemo(() => defaultCalendarFromObject(objectDef), [objectDef]);
  const gallery = React.useMemo(() => defaultGalleryFromObject(objectDef), [objectDef]);
  const allowedVisualizations = React.useMemo(() => {
    const allowed = ['grid'];
    if (kanban) allowed.push('kanban');
    if (calendar) allowed.push('calendar');
    if (gallery) allowed.push('gallery');
    return allowed;
  }, [kanban, calendar, gallery]);

  const schema = React.useMemo(() => {
    if (!objectDef) return undefined;
    return {
      type: 'list-view' as const,
      objectName: objectDef.name,
      viewType: 'grid' as const,
      fields: columns,
      ...(urlFilters.length ? { filters: urlFilters } : {}),
      kanban,
      calendar,
      gallery,
      userFilters,
      appearance: { allowedVisualizations },
      showViewSwitcher: allowedVisualizations.length > 1,
      // Full list capability — this surface trades the saved-view anchor for
      // the complete toolbar, NOT for a reduced one.
      showSearch: true,
      showSort: true,
      showFilters: true,
      showGroup: true,
      showHideFields: true,
      showDensity: true,
      showRecordCount: true,
      // Deliberately NO onSortChange/onFilterChange persistence hooks: this
      // surface never writes back to any saved view (#2251).
    };
  }, [objectDef, columns, urlFilters, kanban, calendar, gallery, userFilters, allowedVisualizations]);

  // "Save as view" — the one exit into the workspace: materialize the current
  // URL conditions as a new saved view, then navigate to it.
  const handleSaveAsView = React.useCallback(
    async (config: Record<string, any> & { type: string; label: string }) => {
      try {
        const spec: Record<string, any> = {
          ...config,
          columns: Array.isArray(config.columns) && config.columns.length > 0 ? config.columns : columns,
          ...(urlFilters.length ? { filter: urlFilters } : {}),
        };
        // #2767 P1: unified identity — the qualified `<object>.<key>` name is the
        // URL segment AND the body identity. #2767 P4: land on the new draft in
        // preview mode so it's visible and one click from Publish.
        const env = viewEnvelope(objectName ?? '', spec, {
          name: config.name,
          label: config.label,
        });
        const createdId = await createRuntimeMetadata('view', env.name, env, { metadataClient });
        if (createdId) {
          const previewSuffix = previewDrafts
            ? ''
            : `?${PREVIEW_QUERY_FLAG}=${PREVIEW_QUERY_VALUE}`;
          navigate(`../view/${createdId}${previewSuffix}`, { relative: 'path' });
        }
      } catch (err) {
        console.error('[ObjectDataPage] Failed to save view:', err);
      }
    },
    [columns, urlFilters, metadataClient, navigate, objectName, previewDrafts],
  );

  if (!objectDef) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Database className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>{t('console.objectView.objectNotFound')}</EmptyTitle>
          <EmptyDescription>
            {t('console.objectView.objectNotFoundDescription', { objectName })}
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  // Route gate — no read permission renders an explicit denial, never an
  // empty list (#2251 security model). The server-enforced row filter is the
  // real boundary; this is the honest UI for "you can't be here".
  if (!can(objectDef.name, 'read')) {
    return (
      <div className="h-full flex items-center justify-center p-8" data-testid="object-data-403">
        <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>{t('console.objectData.noAccessTitle', { defaultValue: 'Access denied' })}</EmptyTitle>
          <EmptyDescription>
            {t('console.objectData.noAccess', {
              defaultValue: 'You do not have permission to view this data.',
            })}
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background min-w-0 overflow-hidden" data-testid="object-data-page">
      <div className="hidden sm:block">
        <PageHeader
          title={
            <span className="inline-flex items-center gap-2">
              <span className="truncate">{objectLabel(objectDef)}</span>
              <span className="rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('console.objectData.badge', { defaultValue: 'Data' })}
              </span>
            </span>
          }
          description={t('console.objectData.description', {
            defaultValue: 'URL-defined data slice — not bound to any saved view.',
          })}
          icon={React.createElement(getIcon((objectDef as any)?.icon), { className: 'h-4 w-4' })}
          actions={
            <>
              {can(objectDef.name, 'create') && (
                <Button
                  size="sm"
                  onClick={() => navigate('../new', { relative: 'path' })}
                  className="shadow-none gap-1.5 h-8 sm:h-9"
                  data-testid="object-data-new-button"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('console.objectView.new')}</span>
                </Button>
              )}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateViewDialog(true)}
                  className="shadow-none gap-1.5 h-8 sm:h-9"
                  data-testid="object-data-save-as-view"
                >
                  <Save className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t('console.objectData.saveAsView', { defaultValue: 'Save as view' })}
                  </span>
                </Button>
              )}
            </>
          }
        />
      </div>

      {/* URL filter chips — visible + individually removable (unlike Odoo's
          invisible action domain). Removal rewrites the URL, which is the
          single source of truth for this surface. */}
      {urlFilters.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5 border-b px-3 sm:px-4 py-2 shrink-0"
          data-testid="object-data-filter-chips"
        >
          <span className="text-xs text-muted-foreground">
            {t('console.objectData.filteredBy', { defaultValue: 'Filtered by' })}
          </span>
          {filterChips.map(({ field, text }) => (
            <span
              key={field}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-xs"
            >
              <span className="font-medium">{fieldLabel(objectDef.name, field, field)}</span>
              <span className="text-muted-foreground">{text}</span>
              <button
                type="button"
                onClick={() => removeUrlFilter(field)}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                aria-label={t('console.objectData.removeFilter', {
                  defaultValue: 'Remove filter {{field}}',
                  field,
                })}
                data-testid={`object-data-remove-filter-${field}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        {schema && (
          <ListView
            schema={schema as any}
            dataSource={dataSource}
            userFilterSelections={initialUfSelections}
            onUserFilterSelectionsChange={handleUserFilterSelectionsChange}
            onRowClick={handleRecordClick}
          />
        )}
      </div>

      {navOverlay.isOverlay && (
        <NavigationOverlay
          {...navOverlay}
          setIsOpen={(open: boolean) => { if (!open) closeRecordDrawer(); }}
          title={objectLabel(objectDef)}
        >
          {(record: any) => (
            <RecordDetailView
              objectNameOverride={objectDef.name}
              recordIdOverride={String(record?.id ?? record?._id ?? drawerRecordId ?? '')}
              embedded
              dataSource={dataSource}
              objects={objects}
              onEdit={() => {}}
            />
          )}
        </NavigationOverlay>
      )}

      {isAdmin && (
        <CreateViewDialog
          open={showCreateViewDialog}
          onOpenChange={setShowCreateViewDialog}
          onCreate={handleSaveAsView}
          objectDef={objectDef}
        />
      )}
    </div>
  );
}
