/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectView Component
 *
 * A complete object management interface that combines multi-view data display
 * (grid, kanban, calendar, gallery, timeline, gantt, map) with ObjectForm
 * for create/edit operations.
 *
 * Features:
 * - Multi-view type rendering via SchemaRenderer
 * - Named listViews support (e.g., "All", "My Records", "Active")
 * - Navigation config for row click behavior (page/drawer/modal/none/new_window)
 * - Direct data fetching for all view types
 * - Integrated search, filter, and sort controls
 * - ViewSwitcher for toggling between view types
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import type {
  ObjectViewSchema,
  ObjectGridSchema,
  ObjectFormSchema,
  DataSource,
  ViewSwitcherSchema,
  ViewType,
  NamedListView,
  ViewNavigationConfig,
  ObjectMapConfig,
} from '@object-ui/types';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { ObjectForm } from '@object-ui/plugin-form';
import {
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  NavigationOverlay,
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
  useIsMobile,
} from '@object-ui/components';
import { Plus } from 'lucide-react';
import { useObjectTranslation, createSafeTranslation } from '@object-ui/i18n';
import { buildExpandFields, normalizeListViewSchema, mergeFilterNodes, columnIdentity } from '@object-ui/core';
import { SchemaRenderer as ImportedSchemaRenderer } from '@object-ui/react';
import { ViewSwitcher } from './ViewSwitcher';
import { deriveRecordSurface } from './recordSurface';

/**
 * SchemaRenderer from @object-ui/react, used to render sub-view schemas.
 */
const SchemaRendererComponent: React.FC<any> = ImportedSchemaRenderer;

/**
 * The `case 'map'` branch below builds an `object-map` schema by flattening
 * `viewOptions.map`'s CONTENTS to the top level. Whitelisted to these keys —
 * `ObjectMapConfigSchema`'s shape minus `style` — rather than the whole bag:
 * `style` is ALSO `BaseSchema.style` (inline CSS, legal on every node), and
 * spreading the raw `map` block collapsed the two namespaces onto one key
 * (objectui#5177).
 *
 * HAND-LISTED, not derived at runtime — deliberately, and only here (`plugin-
 * map`'s own `FLAT_MAP_CONFIG_KEYS` in `ObjectMap.tsx` DOES derive from
 * `ObjectMapConfigSchema.shape`, and should stay that way): this file is
 * reachable from `examples/console-starter`'s own `src/`, so it is part of the
 * import graph `vite-alias-closure.test.ts` walks. That walker resolves a bare
 * `@object-ui/*` specifier with plain `index.<ext>` conventions and cannot find
 * `@object-ui/types/zod`'s actual barrel file (`zod/index.zod.ts` — a
 * non-standard name) — a REAL runtime import of it here reproducibly fails
 * that gate (measured on objectui#5177's first PR, PR #5231, CI run
 * 32160288416), even though Vite's own alias table already resolves the
 * specifier correctly (`examples/console-starter/vite.config.ts` has carried
 * an explicit `@object-ui/types/zod` entry since PR #5156). `ObjectMap.tsx`
 * gets away with the runtime import only because nothing in
 * console-starter's graph reaches `@object-ui/plugin-map` today.
 *
 * Anti-drift is a TEST, not this comment: `ObjectView.mapFlatten.test.tsx`
 * pins this exact list against `ObjectMapConfigSchema.shape` — imported only
 * from that TEST file, which the alias-closure walker explicitly excludes
 * from traversal — so a key added to or removed from the declaration still
 * fails here, loudly and by name, without reintroducing the runtime edge that
 * breaks the walker.
 */
export const FLAT_MAP_CONFIG_KEYS = [
  'latitudeField',
  'longitudeField',
  'locationField',
  'titleField',
  'descriptionField',
  'zoom',
  'center',
] as const satisfies readonly (keyof Omit<ObjectMapConfig, 'style'>)[];

/** Pick only the declared flat map keys present on an authored `map` block. */
function pickFlatMapConfig(mapConfig: unknown): Record<string, unknown> {
  if (!mapConfig || typeof mapConfig !== 'object') return {};
  const source = mapConfig as Record<string, unknown>;
  return Object.fromEntries(FLAT_MAP_CONFIG_KEYS.filter((key) => key in source).map((key) => [key, source[key]]));
}

/**
 * `table.columns` as a FIELD-NAME list — the shape the non-grid field slot
 * declares (objectui#5269).
 *
 * `ObjectGridSchema.columns` is `string[] | ListColumn[]`, but the slot the
 * non-grid branch forwards into is a names slot: both segments ahead of the
 * `table` one declare `string[]` (`NamedListView.columns`, the `views` prop),
 * and its consumers treat every entry as a field name — `ObjectKanban` indexes
 * the record by it (`resolveKanbanCardFields` casts straight to `string[]`).
 * Handing a `ListColumn[]` down raw would therefore arrive as a non-empty card
 * field list naming nothing, which renders WORSE than the empty one this card
 * fixes: `ObjectKanban` skips its `highlightFields` fallback whenever the list
 * is non-empty. That is the objectui#5270 failure again — a value forwarded
 * into a slot whose declared shape it does not have — and it is answered the
 * same way, at the boundary.
 *
 * `columnIdentity` is the repo's single converged reader for "which field does
 * this column entry name" (objectui#3104), and it is what `ObjectGrid` already
 * applies to the SAME `table.columns` value on the grid path (its `$select`
 * derivation) and what `ObjectTree` applies downstream. So this narrows a
 * declared union to the branch this slot can hold; it does not widen the set
 * of accepted spellings, and it keeps the two paths resolving one value the
 * same way.
 *
 * `undefined` — never `[]` — when nothing resolves, so the `||` chain falls
 * through to the deprecated `table.fields` instead of stopping on a truthy
 * empty array.
 */
function tableColumnFieldNames(columns: unknown): string[] | undefined {
  if (!Array.isArray(columns) || columns.length === 0) return undefined;
  const names = columns.map(columnIdentity).filter((n): n is string => !!n);
  return names.length > 0 ? names : undefined;
}

/**
 * Record-create verb, shared with the runtime object pages: both surfaces
 * resolve `console.objectView.new` ("New" / 新建) so the Studio grid toolbar
 * and the running app never disagree (framework#2615 P3). Falls back to
 * English when no I18nProvider is mounted (standalone usage) — via the
 * key-identity probe, not a caught throw.
 */
function useCreateVerb(): string {
  // No try/catch: `useObjectTranslation` is provider-safe (optional context
  // read + react-i18next global-instance fallback) and never throws, so the
  // key-identity probe below is the whole "no provider" path. Wrapping a hook
  // in try/catch violates rules-of-hooks — a throw after it ran would desync
  // hook order on the next render (objectui#2879, same class as #2595/#2596).
  const { t } = useObjectTranslation();
  const value = t('console.objectView.new');
  return value === 'console.objectView.new' ? 'New' : value;
}

/**
 * English fallbacks for the headings this view resolves through `t()`
 * (objectui#3459 for the split-mode record-detail heading, objectui#3462 for
 * the create/edit/view form titles — both following #3426's shape).
 *
 * Every entry must exist HERE as well as in the locale packs: a provider-less
 * host never reaches the packs, and `createSafeTranslation`'s fallback is what
 * interpolates the placeholder.
 *
 * ── Why these keys, and not new ones ──────────────────────────────────────
 * `detail.recordDetailWithLabel` is borrowed from the `detail.*` namespace
 * rather than minted as `view.recordDetail`: `NavigationOverlay` — the very
 * component that heading is handed to — already resolves that namespace, as do
 * `ListView` / `ObjectGrid` / `ObjectKanban` / `ObjectTree`, and one heading on
 * one control should not get several translations that can drift apart.
 *
 * `form.createTitle` / `form.editTitle` are reused for the same reason, and are
 * not new: all ten packs already carry them, and `app-shell` already heads the
 * PAGE-mode record form with exactly these (`RecordFormPage.tsx`,
 * `AppContent.tsx`). The drawer / modal / popover titles below are the same
 * heading on a different surface, so they resolve the same keys — minting a
 * parallel `console.objectView.*` family would have guaranteed the two spellings
 * drift (zh already distinguishes 新建 from 创建). Only the third verb,
 * `form.viewTitle`, had no sibling; it was added to all ten packs.
 *
 * Note the placeholder is `{{object}}`, not `{{label}}` — that is the variable
 * the existing `form.*Title` family declares, and the pack-vs-en placeholder
 * parity guard compares placeholder sets per key.
 *
 * `detail.recordDetailWithLabel` doubles as the probe key: under a provider
 * `t()` returns the pack's template (≠ the key) so the real translator is used;
 * with no provider the key comes back unchanged and this map supplies the
 * English.
 */
const VIEW_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'detail.recordDetailWithLabel': '{{label}} Detail',
  // Byte-for-byte the strings `getFormTitle` used to build with a template
  // literal, so an English session and every e2e spec that addresses this
  // chrome by name see no change at all.
  'form.createTitle': 'Create {{object}}',
  'form.editTitle': 'Edit {{object}}',
  'form.viewTitle': 'View {{object}}',
};

const useObjectViewTranslation = createSafeTranslation(
  VIEW_DEFAULT_TRANSLATIONS,
  'detail.recordDetailWithLabel',
);

export interface ObjectViewProps {
  /**
   * The schema configuration for the view
   */
  schema: ObjectViewSchema;

  /**
   * Data source (ObjectQL or ObjectStack adapter).
   * If not provided, falls back to SchemaRendererProvider context.
   */
  dataSource: DataSource;

  /**
   * Additional CSS class
   */
  className?: string;

  /**
   * Views available for the ViewSwitcher.
   * Each view defines a type (grid, kanban, calendar, etc.) and display columns/config.
   * If not provided, uses schema.listViews or falls back to default grid view.
   */
  views?: Array<{
    id: string;
    label: string;
    type: ViewType;
    columns?: string[];
    sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
    filter?: any[];
    [key: string]: any;
  }>;

  /**
   * The currently active view ID.
   * Used for controlled ViewSwitcher state.
   */
  activeViewId?: string;

  /**
   * Callback when the active view changes
   */
  onViewChange?: (viewId: string) => void;

  /**
   * Callback when a row is clicked (for record detail navigation)
   */
  onRowClick?: (record: Record<string, unknown>) => void;

  /**
   * Callback when edit is triggered on a record
   */
  onEdit?: (record: Record<string, unknown>) => void;

  /**
   * Render a custom ListView implementation for multi-view support.
   * When provided, this replaces the default view rendering for the content area.
   */
  /**
   * ADR-0053: when the host (app-shell ObjectView) already renders the view
   * switcher (ViewTabBar), set this so the inner view doesn't render its own
   * duplicate named-view tab row. Standalone consumers leave it unset.
   */
  hideNamedViewTabs?: boolean;

  renderListView?: (props: {
    schema: any;
    dataSource: DataSource;
    onEdit?: (record: Record<string, unknown>) => void;
    onRowClick?: (record: Record<string, unknown>) => void;
    className?: string;
    /** Current refresh counter — increment signals that a mutation occurred */
    refreshKey?: number;
    /** Same handler the built-in toolbar's "+ New" button uses — forward it
     * into the custom list view's own add-record affordance (e.g. ListView's
     * `addRecord.enabled` toolbar button) so callers can fold record creation
     * into their list's toolbar instead of the separate `showCreate` row. */
    onAddRecord?: () => void;
  }) => React.ReactNode;

  /**
   * Toolbar addon: extra elements to render in the toolbar (e.g., MetadataToggle)
   */
  toolbarAddon?: React.ReactNode;

  /**
   * Callback when the "+" create view button is clicked in ViewSwitcher.
   */
  onCreateView?: () => void;

  /**
   * Callback when a per-view action is triggered in ViewSwitcher.
   */
  onViewAction?: (action: string, viewType: ViewType) => void;
}

type FormMode = 'create' | 'edit' | 'view';

/**
 * HOST-COMPOSITION SURFACE on the `object-view` node — the keys the
 * `renderListView` delegation branch reads off the node that are deliberately
 * NOT declared members of `ObjectViewSchema`, and ⛔ not to be taught as
 * schema keys anywhere in the docs (objectui#5097).
 *
 * ## The verdict
 *
 * The delegation branch in `renderContent` below reads 31 distinct keys off
 * the object-view node through `(schema as any).K` and forwards them to the
 * host's list renderer. Four of them — `data`, `navigation`,
 * `searchableFields`, `filterableFields`, listed in
 * {@link OBJECT_VIEW_DECLARED_FORWARDED_KEYS} — are declared members of
 * `ObjectViewSchema`. The other 27, listed here, are not, and stay that way:
 * they are HOST-COMPOSITION surface, not authored surface. This constant is
 * their single home; the branch is fenced by `#region` markers so the pin in
 * `src/__tests__/objectViewHostSurface.test.tsx` fails BY NAME when a read is
 * added or removed without touching this list.
 *
 * ## The ruling that made it deliberate
 *
 * Maintainer, 2026-08-18, on objectui#5097, verbatim 「同意」: the 27 keys are
 * HOST surface, exempted with reasons — not authored surface. Basis: measured
 * reachability. The delegation branch is entered ONLY when a host passes the
 * `renderListView` prop; the registered renderer does not pass it; so the
 * schema-registration path documented to authors cannot reach these keys at
 * all, and declaring them on `ObjectViewSchema` would promise authors a
 * surface that does nothing on their path.
 *
 * ⛔ Do not declare these on `ObjectViewSchema`, and ⛔ do not delete a read as
 * a tidy-up — deleting a read is what silently blanks a stored app-shell
 * document, and it is exactly what a reader of "not authored surface" is most
 * likely to think is the clean finish. The structural follow-through (typing
 * this block as an explicit host-side prop contract, so host surface and
 * authored surface are separated in types, and retiring the `(schema as any)`
 * reads) is owned by the objectui#5043 family track, not by this exemption.
 *
 * ## Who supplies the prop — what makes "host surface" checkable
 *
 * Every in-tree non-test supplier lives in `@object-ui/app-shell`, and there
 * are TWO of them. Re-measured on `main` at `e03dfa5ea`; both were already
 * present at the ruling's base `9fbb9b52f`, which named only the first:
 *
 *   - `packages/app-shell/src/views/ObjectView.tsx:1718` — the React host
 *     defines the callback; it is passed at `:2481` and `:2524`.
 *   - `packages/app-shell/src/views/studio-design/StudioDesignSurface.tsx:2575`
 *     — the Studio design surface, as `renderListView={renderStudioGridList}`.
 *
 * The registered renderer is `ObjectViewRenderer` (`./index.tsx:58`), which
 * renders `ObjectView` with `schema` and `dataSource` only and passes no
 * `renderListView`. It is registered twice — under `object-view`
 * (`./index.tsx:66`) and under the alias `view` (`./index.tsx:100`) — and
 * neither registration can reach this branch.
 *
 * ## What the contract says about these keys
 *
 * Nothing at all, and that is the shape of the answer here — unlike the
 * sibling `object-grid` exemption (objectui#5091, PR #5241), where the spec
 * answered `unrecognized_keys` by name. `@objectstack/spec`'s
 * `ComponentPropsMap` carries no `object-view` entry, so the repo-wide
 * `registry-inputs-spec-parity` gate — which derives its expectations FROM
 * `ComponentPropsMap` — never covers this node in either direction and is owed
 * nothing here. The node's published authoring surface is the registry
 * `inputs` list at `./index.tsx:71-86` (15 names; the alias `view` declares no
 * `inputs` at all), and none of the 27 appears on either registration.
 *
 * ## The one asymmetry — `conditionalFormatting` — RESOLVED (objectui#5248)
 *
 * As ruled on 2026-08-18, 26 of the 27 were read ONLY inside the host-only
 * branch, and `conditionalFormatting` had a SECOND read site in
 * `generateViewSchema`'s kanban branch — reachable through the REGISTERED
 * renderer, so for that one key the ruling's "the authored path cannot reach
 * it" basis was narrower than for its 26 neighbours. objectui#5097 recorded the
 * gap rather than acting on it and filed the contract question as
 * objectui#5248.
 *
 * That question is now answered, and the gap is closed. Maintainer ruling of
 * 2026-08-19 (verbatim 「全部接受」, recorded on objectui#5248): a conditional —
 * Option 2 gated on a liveness check, Option 1 (declare the key) had the check
 * found real authored usage. The liveness check came back EMPTY:
 *
 *   - objectui `content/docs/**`, `skills/**`, `examples/**`, `apps/**`:
 *     `conditionalFormatting` occurs in exactly two files, on `object-grid`
 *     (`content/docs/plugins/plugin-grid.mdx`) and on `list-view`
 *     (`skills/objectui/guides/schema-expressions.md`) — both DECLARED homes,
 *     neither an object-view node.
 *   - objectstack: no authored `object-view` node exists at all (two prose
 *     mentions repo-wide), against 54 files carrying `object-form` and 19
 *     carrying `object-grid` as the control.
 *   - No in-repo fixture or catalog schema carries both an object-view node and
 *     the key: the only files carrying both are this one, its pin test, the
 *     type declarations, app-shell's host (which reads the key into the
 *     delegated `list-view` node, not onto the object-view node) and prose.
 *
 * So the fallback read was dropped from the kanban branch (see
 * `kanbanConditionalFormatting`). Every one of the 27 is now read ONLY inside
 * the `#region` fence, and the exemption's stated basis holds for all of them
 * without exception. The pin in `objectViewHostSurface.test.tsx` asserts the
 * resolution directly: ZERO exempt keys are read outside the fence.
 */
export const OBJECT_VIEW_HOST_COMPOSITION_KEYS = [
  'addDeleteRecordsInline',
  'addRecord',
  'addRecordViaForm',
  'allowExport',
  'allowPrinting',
  'aria',
  'bulkActions',
  'clickIntoRecordDetails',
  'collapseAllByDefault',
  'color',
  'compactToolbar',
  'conditionalFormatting',
  'emptyState',
  'fieldTextColor',
  'hiddenFields',
  'inlineEdit',
  'pagination',
  'prefixField',
  'resizable',
  'rowActionDefs',
  'rowActions',
  'selection',
  'sharing',
  'showDescription',
  'showRecordCount',
  'userFilters',
  'wrapHeaders',
] as const;

/**
 * The other four keys the same branch reads through `(schema as any)`: these
 * ARE declared members of `ObjectViewSchema` (`data` via `BaseSchema`), so
 * they are authored surface and are NOT part of the objectui#5097 exemption.
 * They are listed so the pin can assert the split, not just the exempt half —
 * a read that moves from this list into the one above is a key losing its
 * declaration, and must fail loudly.
 */
export const OBJECT_VIEW_DECLARED_FORWARDED_KEYS = [
  'data',
  'filterableFields',
  'navigation',
  'searchableFields',
] as const;

/**
 * ObjectView Component
 *
 * Renders a complete object management interface with multi-view rendering
 * and integrated CRUD operations.
 *
 * @example Basic usage (grid only)
 * ```tsx
 * <ObjectView
 *   schema={{
 *     type: 'object-view',
 *     objectName: 'users',
 *     layout: 'drawer',
 *     showSearch: true,
 *     showFilters: true,
 *   }}
 *   dataSource={dataSource}
 * />
 * ```
 *
 * @example Named listViews
 * ```tsx
 * <ObjectView
 *   schema={{
 *     type: 'object-view',
 *     objectName: 'contacts',
 *     listViews: {
 *       all: { label: 'All Contacts', type: 'grid', columns: ['name', 'email', 'phone'] },
 *       board: { label: 'By Status', type: 'kanban', options: { kanban: { groupField: 'status' } } },
 *       calendar: { label: 'Meetings', type: 'calendar', options: { calendar: { startDateField: 'meeting_date' } } },
 *     },
 *     defaultListView: 'all',
 *   }}
 *   dataSource={dataSource}
 * />
 * ```
 *
 * @example With navigation config
 * ```tsx
 * <ObjectView
 *   schema={{
 *     type: 'object-view',
 *     objectName: 'accounts',
 *     navigation: { mode: 'drawer', width: '600px' },
 *   }}
 *   dataSource={dataSource}
 * />
 * ```
 */
export const ObjectView: React.FC<ObjectViewProps> = ({
  schema,
  dataSource,
  className,
  views: viewsProp,
  activeViewId,
  onViewChange,
  onRowClick,
  onEdit: onEditProp,
  renderListView,
  hideNamedViewTabs,
  toolbarAddon,
  onCreateView,
  onViewAction,
}) => {
  const createVerb = useCreateVerb();
  // Headings this view owns: the split-mode record-detail panel (see the split
  // branch far below) and the create/edit/view form titles (`getFormTitle`).
  // Declared with the other top-level hooks so it stays above every conditional
  // return — rules-of-hooks.
  const { t: tView } = useObjectViewTranslation();
  const [objectSchema, setObjectSchema] = useState<Record<string, unknown> | null>(null);
  // Assigned in the render body (not in an effect) so the fetchData effect always
  // reads the latest objectSchema without needing it as a dependency. This matches
  // the same pattern used in ObjectCalendar's objectSchemaRef.
  const objectSchemaRef = useRef<Record<string, unknown> | null>(null);
  objectSchemaRef.current = objectSchema;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [selectedRecord, setSelectedRecord] = useState<Record<string, unknown> | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // P2: Auto-subscribe to DataSource mutation events for non-grid views.
  // When a DataSource implements onMutation(), ObjectView auto-refreshes
  // its own data fetch (for non-grid view types like kanban, calendar, etc.)
  // whenever a create/update/delete occurs on the same objectName.
  //
  // ListView-driven configurations already manage refreshKey via
  // form success / delete handlers. To avoid double refreshes and
  // duplicate find() calls, skip auto-subscription when renderListView is provided.
  useEffect(() => {
    if (!dataSource?.onMutation || !schema.objectName) return;
    if (renderListView) return;
    const unsub = dataSource.onMutation((event: any) => {
      if (event.resource === schema.objectName) {
        setRefreshKey(prev => prev + 1);
      }
    });
    return unsub;
  }, [dataSource, schema.objectName, renderListView]);

  // Data fetching state for non-grid views
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // NOTE: this component used to carry its own filter/sort BAR — `filterValues`
  // and `sortConfig` state, a `filter-ui` schema and a `sort-ui` schema. None of
  // it was ever connected: no setter was called and neither schema was rendered,
  // so both states stayed at their initial empty value for the component's whole
  // life. It was removed rather than wired, because the real filter and sort UI
  // belongs to the renderer this component delegates to — `showFilters`,
  // `showSort` and `filterableFields` are forwarded downstream (see `baseProps`
  // and the list-view schema below) and `ListView` implements them. Wiring the
  // local copy would have produced a SECOND filter bar competing with that one.
  //
  // The dead state was not harmless: every merge path here had a branch keyed on
  // it that could never run, and those branches read as live code. Two separate
  // "bugs" reported against them during objectui#3081 were unreachable for this
  // reason — see the correction in that PR.

  // --- Named listViews ---
  const namedListViews = schema.listViews;
  const hasNamedViews = namedListViews != null && Object.keys(namedListViews).length > 0;
  const [activeNamedView, setActiveNamedView] = useState<string>(() => {
    if (schema.defaultListView && namedListViews?.[schema.defaultListView]) {
      return schema.defaultListView;
    }
    if (namedListViews) {
      const keys = Object.keys(namedListViews);
      return keys[0] || '';
    }
    return '';
  });

  // Get current named view config
  const currentNamedViewConfig: NamedListView | null = useMemo(() => {
    if (!hasNamedViews || !activeNamedView) return null;
    return namedListViews![activeNamedView] || null;
  }, [hasNamedViews, activeNamedView, namedListViews]);

  // --- Multi-view type state (prop-based views) ---
  const viewsPropResolved = useMemo(() => {
    if (viewsProp && viewsProp.length > 0) return viewsProp;
    return null;
  }, [viewsProp]);

  const hasMultiView = viewsPropResolved != null && viewsPropResolved.length > 0;
  const currentActiveViewId = activeViewId || viewsPropResolved?.[0]?.id;
  const activeView = viewsPropResolved?.find(v => v.id === currentActiveViewId) || viewsPropResolved?.[0];

  // Current view type from named view, multi-view prop, or default
  const currentViewType: string = useMemo(() => {
    if (currentNamedViewConfig?.type) return currentNamedViewConfig.type;
    if (activeView?.type) return activeView.type;
    return schema.defaultViewType || 'grid';
  }, [currentNamedViewConfig, activeView, schema.defaultViewType]);

  // Navigation config
  const navigationConfig: ViewNavigationConfig | undefined = schema.navigation;

  // Fetch object schema from ObjectQL/ObjectStack
  useEffect(() => {
    let isMounted = true;
    const fetchObjectSchema = async () => {
      try {
        const schemaData = await dataSource.getObjectSchema(schema.objectName);
        if (isMounted) setObjectSchema(schemaData);
      } catch (err) {
        console.error('Failed to fetch object schema:', err);
      }
    };
    if (schema.objectName && dataSource) {
      fetchObjectSchema();
    }
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource]);

  // Fetch data for non-grid view types (grid handles its own data via ObjectGrid)
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      // When renderListView is provided, the custom list view (e.g. ListView)
      // handles its own data fetching — skip to avoid duplicate requests and
      // unnecessary re-renders that can cause duplicate records in child views.
      if (renderListView) return;
      // Only fetch for non-grid views (ObjectGrid has its own data fetching)
      if (currentViewType === 'grid') return;
      if (!dataSource || !schema.objectName) return;

      setLoading(true);
      try {
        // `mergeFilterNodes` rescues an OBJECT source: `table.defaultFilters` is
        // declared `Record<string, any>`, and the `baseFilter.length > 0` test
        // this replaced read false for it — so a view's default filter was
        // dropped and every record came back. The grid path (ObjectGrid) always
        // assigned it directly and was unaffected, so the same view filtered
        // correctly as a grid and returned everything as a calendar/kanban/
        // gallery. It also keeps each source as its own child of the `and`
        // rather than spreading it, which is what a `ViewFilterRule[]` needs.
        // The `table` segment reads the CANONICAL key first and the deprecated
        // one only as its alias (objectui#5102). The two view segments ahead of
        // it are untouched — this extends the last segment only.
        const finalFilter = mergeFilterNodes(
          currentNamedViewConfig?.filter || activeView?.filter
            || schema.table?.filter || schema.table?.defaultFilters,
        );

        const sort = currentNamedViewConfig?.sort || activeView?.sort
          || schema.table?.sort || schema.table?.defaultSort || undefined;

        // Auto-inject $expand for lookup/master_detail fields.
        // Use a ref instead of the state variable to avoid re-running this effect
        // every time the object schema loads — that would cause a double-fetch and
        // duplicate events in child views like the calendar.
        const expand = buildExpandFields((objectSchemaRef.current as any)?.fields);
        const results = await dataSource.find(schema.objectName, {
          // `mergeFilterNodes` returns a node or `undefined`; the old
          // `.length > 0` here was the second place an object filter was lost.
          $filter: finalFilter,
          $orderby: sort,
          $top: 100,
          ...(expand.length > 0 ? { $expand: expand } : {}),
        });

        let items: any[] = [];
        if (Array.isArray(results)) {
          items = results;
        } else if (results && typeof results === 'object') {
          if (Array.isArray((results as any).data)) {
            items = (results as any).data;
          } else if (Array.isArray((results as any).records)) {
            items = (results as any).records;
          } else if (Array.isArray((results as any).value)) {
            items = (results as any).value;
          }
        }

        if (isMounted) setData(items);
      } catch (err) {
        console.error('ObjectView data fetch error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
    // objectSchema intentionally omitted from deps — read via ref to prevent double-fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.objectName, dataSource, currentViewType, refreshKey, currentNamedViewConfig, activeView, renderListView]);

  // Determine layout mode. #2578: default the record surface from how heavy the
  // object is — a field-heavy object opens create/edit/detail as a full page, a
  // light one as a drawer. Mobile always pages. An explicit `schema.layout` (or
  // a per-view navigation config, handled in handleRowClick) still wins.
  const isMobile = useIsMobile();
  const layout = schema.layout || deriveRecordSurface(objectSchema, { viewport: isMobile ? 'mobile' : 'desktop' });

  // Determine enabled operations
  const operations = schema.operations || schema.table?.operations || {
    create: true,
    read: true,
    update: true,
    delete: true,
  };

  // Handle create action
  const handleCreate = useCallback(() => {
    if (layout === 'page' && schema.onNavigate) {
      schema.onNavigate('new', 'edit');
    } else {
      setFormMode('create');
      setSelectedRecord(null);
      setIsFormOpen(true);
    }
  }, [layout, schema]);

  // Handle edit action
  const handleEdit = useCallback((record: Record<string, unknown>) => {
    if (onEditProp) {
      onEditProp(record);
      return;
    }
    if (layout === 'page' && schema.onNavigate) {
      const recordId = record.id || record._id;
      schema.onNavigate(recordId as string | number, 'edit');
    } else {
      setFormMode('edit');
      setSelectedRecord(record);
      setIsFormOpen(true);
    }
  }, [layout, schema, onEditProp]);

  // Handle view action (read a record)
  const handleView = useCallback((record: Record<string, unknown>) => {
    if (layout === 'page' && schema.onNavigate) {
      const recordId = record.id || record._id;
      schema.onNavigate(recordId as string | number, 'view');
    } else {
      setFormMode('view');
      setSelectedRecord(record);
      setIsFormOpen(true);
    }
  }, [layout, schema]);

  // Handle row click - respects NavigationConfig
  const handleRowClick = useCallback((record: Record<string, unknown>) => {
    if (onRowClick) {
      onRowClick(record);
      return;
    }

    // Check NavigationConfig
    if (navigationConfig) {
      if (navigationConfig.mode === 'none' || navigationConfig.preventNavigation) {
        return; // Do nothing
      }
      if (navigationConfig.mode === 'new_window' || navigationConfig.openNewTab) {
        const recordId = record.id || record._id;
        const url = `/${schema.objectName}/${encodeURIComponent(String(recordId))}`;
        window.open(url, '_blank');
        return;
      }
      if (navigationConfig.mode === 'drawer') {
        setFormMode('view');
        setSelectedRecord(record);
        setIsFormOpen(true);
        return;
      }
      if (navigationConfig.mode === 'modal') {
        setFormMode('view');
        setSelectedRecord(record);
        setIsFormOpen(true);
        return;
      }
      if (navigationConfig.mode === 'page') {
        const recordId = record.id || record._id;
        if (schema.onNavigate) {
          schema.onNavigate(recordId as string | number, 'view');
        }
        return;
      }
      if (navigationConfig.mode === 'split' || navigationConfig.mode === 'popover') {
        setFormMode('view');
        setSelectedRecord(record);
        setIsFormOpen(true);
        return;
      }
    }

    // Default behavior
    if (operations.read !== false) {
      handleView(record);
    }
  }, [onRowClick, navigationConfig, operations.read, handleView, schema]);

  // Handle delete action
  const handleDelete = useCallback((_record: Record<string, unknown>) => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // Handle bulk delete action
  const handleBulkDelete = useCallback((_records: Record<string, unknown>[]) => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // Handle form submission
  const handleFormSuccess = useCallback(() => {
    setIsFormOpen(false);
    setSelectedRecord(null);
    setRefreshKey(prev => prev + 1);
  }, []);

  // Handle form cancellation
  const handleFormCancel = useCallback(() => {
    setIsFormOpen(false);
    setSelectedRecord(null);
  }, []);

  // --- ViewSwitcher schema (for multi-view prop views) ---
  const viewSwitcherSchema: ViewSwitcherSchema | null = useMemo(() => {
    if (!hasMultiView || !viewsPropResolved || viewsPropResolved.length <= 1) return null;
    return {
      type: 'view-switcher' as const,
      variant: 'tabs',
      position: 'top',
      persistPreference: true,
      storageKey: `view-pref-${schema.objectName}`,
      defaultView: (activeView?.type || 'grid') as ViewType,
      activeView: (activeView?.type || 'grid') as ViewType,
      views: viewsPropResolved.map(v => {
        const iconMap: Record<string, string> = {
          kanban: 'kanban',
          calendar: 'calendar',
          map: 'map',
          gallery: 'layout-grid',
          timeline: 'activity',
          gantt: 'gantt-chart',
          grid: 'table',
          list: 'list',
          detail: 'file-text',
          chart: 'bar-chart-3',
        };
        return {
          type: v.type as ViewType,
          label: v.label,
          icon: iconMap[v.type] || 'table',
        };
      }),
      allowCreateView: schema.allowCreateView,
      viewActions: schema.viewActions,
    };
  }, [hasMultiView, viewsPropResolved, activeView, schema.objectName, schema.allowCreateView, schema.viewActions]);

  // Handle view type change from ViewSwitcher → map back to view ID
  const handleViewTypeChange = useCallback((viewType: ViewType) => {
    if (!viewsPropResolved) return;
    const matched = viewsPropResolved.find(v => v.type === viewType);
    if (matched && onViewChange) {
      onViewChange(matched.id);
    }
  }, [viewsPropResolved, onViewChange]);

  // Handle named view change
  const handleNamedViewChange = useCallback((viewKey: string) => {
    setActiveNamedView(viewKey);
  }, []);


  // --- Generate view component schema for non-grid views ---
  const generateViewSchema = useCallback((viewType: string): any => {
    const baseProps: Record<string, any> = {
      objectName: schema.objectName,
      // objectui#5269 — the `table` segment reads the CANONICAL key first.
      //
      // `ObjectGridSchema.columns` is the canonical spelling and `fields` is
      // its `@deprecated` alias ("@deprecated Use columns instead"), and
      // `ObjectViewSchema.table` is `Partial< Omit< ObjectGridSchema, … > >`,
      // so `table: { columns: [...] }` is the shape the type recommends. It
      // reached the grid path (which forwards `table.columns` into its own
      // `columns` slot) and stopped here: this line read the deprecated half
      // alone, so an author who wrote the canonical key on a non-grid view got
      // an empty field list from a compile-clean, semantically correct schema.
      // Same user-visible shape as objectui#5102, different mechanism — not a
      // whitelist that knows only legacy spellings, but one that disagreed
      // with itself between two rendering paths.
      //
      // Forwarding, not translation, exactly as objectui#5102 settled it: the
      // value is handed on unchanged and the two segments ahead of `table`
      // keep their precedence. Both spellings stay working; only the ORDER
      // between them is stated, canonical first.
      //
      // Reach, measured rather than assumed: of the surfaces this `baseProps`
      // feeds, `object-kanban` consumes it (via `cardFields`, below) and
      // `object-tree` consumes it (as its own `fields`). `object-gallery` /
      // `object-calendar` / `object-timeline` / `object-gantt` / `object-map`
      // read NO field list off their schema at all, so the value is inert
      // there — before this change and after it.
      //
      // The `table` segment arrives through `tableColumnFieldNames` because
      // THIS slot is a names slot and `table.columns` is a union — see that
      // function for why raw forwarding would regress the `ListColumn[]` half.
      // The delegated `list-view` slot below declares the same union, so it
      // takes the value raw; each site gets the shape its slot declares.
      fields: currentNamedViewConfig?.columns || activeView?.columns
        || tableColumnFieldNames(schema.table?.columns) || schema.table?.fields,
      className: 'h-full w-full',
      showSearch: activeView?.showSearch ?? schema.showSearch ?? false,
      showSort: activeView?.showSort ?? schema.showSort ?? false,
      showFilters: activeView?.showFilters ?? schema.showFilters ?? false,
      color: activeView?.color,
    };

    // Resolve type-specific options from current named view or active view
    // Per @objectstack/spec, type-specific config MUST be nested under the view type key
    const viewOptions = currentNamedViewConfig?.options || activeView || {};

    // Dev-mode warning for flat property access violations
    if (process.env.NODE_ENV === 'development') {
        const flatKeys = ['startDateField', 'endDateField', 'dateField', 'groupBy', 'groupField',
            'locationField', 'imageField', 'dependenciesField', 'progressField', 'titleField',
            'subtitleField', 'latitudeField', 'longitudeField'];
        const nestedConfig = viewOptions[viewType] || {};
        const found = flatKeys.filter(k => k in viewOptions && !(k in nestedConfig));
        if (found.length > 0) {
            console.warn(
                `[Spec Compliance] View options use flat properties ${JSON.stringify(found)}. ` +
                `Move them under options.${viewType} per @objectstack/spec protocol.`
            );
        }
    }

    switch (viewType) {
      case 'kanban': {
        // Per @objectstack/spec, kanban-specific config lives under view.kanban.*
        // `groupByField` is the canonical name (spec); `groupField` is a legacy alias.
        // `kanban.columns` (when provided) lists the FIELDS to render on each card —
        // these are NOT lanes; lanes are derived from the groupBy field's options.
        const kanbanCfg = viewOptions.kanban || {};
        const groupBy =
          kanbanCfg.groupByField ||
          kanbanCfg.groupField ||
          'status';
        // Card display fields: prefer explicit kanban.columns, fall back to the
        // view's outer columns. Strip out these from the spread below so they
        // don't leak into schema.columns (which the kanban component interprets
        // as LANES).
        const cardFields: string[] =
          (Array.isArray(kanbanCfg.columns) && kanbanCfg.columns.length > 0
            ? kanbanCfg.columns
            : baseProps.fields) || [];
        const { columns: _kanbanColumns, groupByField: _gbf, groupField: _gf, titleField: _tf, conditionalFormatting: _kanbanCf, ...restKanban } = kanbanCfg;
        // Forward conditional formatting to kanban (issue #1584): nested
        // `options.kanban.conditionalFormatting` wins, then the view-level rule.
        // Those are the two places the key is DECLARED — `ObjectKanbanSchema`
        // for the nested block, the named/active view for the other.
        //
        // objectui#5248 — a THIRD fallback used to sit at the end of this chain,
        // `(schema as any).conditionalFormatting`, reading the key off the
        // object-view node itself. It was the ONLY read of one of the 27
        // objectui#5097 host-composition keys outside the `#region` fence below,
        // and the only one on a path the REGISTERED renderer can reach
        // (`generateViewSchema` runs precisely when no host supplied
        // `renderListView`). That made the exemption's stated basis — "the
        // authored path cannot reach these keys" — false for this one key.
        //
        // The maintainer ruled on 2026-08-19 (verbatim 「全部接受」, recorded on
        // objectui#5248): a conditional, Option 2 gated on a liveness check.
        // The check came back EMPTY — no authored document in either repo puts
        // `conditionalFormatting` on an object-view node (objectui: it appears
        // in `content/docs` only on `object-grid`, and in `skills/` only on
        // `list-view`; objectstack: `object-view` is not authored anywhere, 2
        // prose mentions and no node, while `object-form` appears in 54 files
        // and `object-grid` in 19). So the fallback was dropped: the key is now
        // genuinely host-only, and the objectui#5097 basis holds for all 27.
        //
        // ⛔ Do not restore this fallback as a convenience. Authoring
        // kanban conditional formatting has two declared homes; a top-level key
        // that nothing declares, nothing publishes in the registry `inputs` and
        // tsc cannot see (BaseSchema's index signature) is precisely the
        // "renderer reads it, manifest denies it" condition objectui#4648 /
        // objectui#5091 exist to close. The host `renderListView` delegation
        // below still reads and forwards the key — that half is NOT narrowed.
        const kanbanConditionalFormatting =
          kanbanCfg.conditionalFormatting ??
          activeView?.conditionalFormatting;
        return {
          type: 'object-kanban',
          ...baseProps,
          groupBy,
          groupField: groupBy,
          titleField: kanbanCfg.titleField || 'name',
          cardFields,
          ...restKanban,
          ...(kanbanConditionalFormatting ? { conditionalFormatting: kanbanConditionalFormatting } : {}),
        };
      }
      case 'calendar':
        return {
          type: 'object-calendar',
          ...baseProps,
          startDateField: viewOptions.calendar?.startDateField || 'start_date',
          endDateField: viewOptions.calendar?.endDateField || 'end_date',
          titleField: viewOptions.calendar?.titleField || 'name',
          ...(viewOptions.calendar || {}),
        };
      case 'gallery':
        return {
          type: 'object-gallery',
          ...baseProps,
          // `coverField` is the spec key; `imageField` is the legacy alias that
          // ObjectGallery still consults as a flat prop.
          imageField: viewOptions.gallery?.coverField || viewOptions.gallery?.imageField,
          titleField: viewOptions.gallery?.titleField || 'name',
          ...(viewOptions.gallery || {}),
        };
      case 'timeline':
        return {
          type: 'object-timeline',
          ...baseProps,
          // `startDateField` is the spec key; `dateField` is the legacy alias.
          startDateField: viewOptions.timeline?.startDateField || viewOptions.timeline?.dateField || 'created_at',
          titleField: viewOptions.timeline?.titleField || 'name',
          ...(viewOptions.timeline || {}),
        };
      case 'gantt':
        return {
          type: 'object-gantt',
          ...baseProps,
          startDateField: viewOptions.gantt?.startDateField || 'start_date',
          endDateField: viewOptions.gantt?.endDateField || 'end_date',
          progressField: viewOptions.gantt?.progressField || 'progress',
          dependenciesField: viewOptions.gantt?.dependenciesField || 'dependencies',
          ...(viewOptions.gantt || {}),
        };
      case 'map':
        // Whitelisted flatten (objectui#5177) — see `FLAT_MAP_CONFIG_KEYS`.
        // `viewOptions.map` is an untyped bag (`NamedListView.options`); a raw
        // spread here forwarded every key the author wrote, including `style`,
        // which `ObjectMap`'s `FlatMapConfigKeys` declares OUT of this flat form.
        return {
          type: 'object-map',
          ...baseProps,
          locationField: viewOptions.map?.locationField || 'location',
          ...pickFlatMapConfig(viewOptions.map),
        };
      case 'tree':
        return {
          type: 'object-tree',
          ...baseProps,
          // Single-parent pointer field; auto-detected from the object's
          // `tree`/self-reference field when not specified.
          parentField: viewOptions.tree?.parentField,
          labelField: viewOptions.tree?.labelField || viewOptions.tree?.titleField || 'name',
          // The view's columns double as the tree-grid's flat columns.
          fields: viewOptions.tree?.fields || baseProps.fields,
          defaultExpandedDepth: viewOptions.tree?.defaultExpandedDepth,
          ...(viewOptions.tree || {}),
        };
      case 'chart': {
        // Aggregated chart of the object's records, delegating to the same
        // object-chart component the dashboard uses.
        const chartCfg = viewOptions.chart || {};
        // ADR-0021 (#1890): dataset-bound chart — the single author-facing shape.
        if (chartCfg.dataset) {
          const dims: string[] = Array.isArray(chartCfg.dimensions) ? chartCfg.dimensions : [];
          const vals: string[] = Array.isArray(chartCfg.values) ? chartCfg.values : [];
          return {
            type: 'object-chart',
            dataset: chartCfg.dataset,
            dimensions: dims,
            values: vals,
            chartType: chartCfg.chartType || 'bar',
            xAxisKey: dims[0],
            series: vals.map((v: string) => ({ dataKey: v, label: v })),
            className: 'h-[400px] w-full',
          };
        }
        // Legacy inline aggregate (deprecated — pre-ADR-0021 metadata).
        const valueField = (Array.isArray(chartCfg.yAxisFields) && chartCfg.yAxisFields[0])
          || chartCfg.valueField || 'value';
        const categoryField = chartCfg.xAxisField || chartCfg.categoryField || 'name';
        return {
          type: 'object-chart',
          objectName: schema.objectName,
          chartType: chartCfg.chartType || 'bar',
          aggregate: {
            field: valueField,
            function: chartCfg.aggregation || 'count',
            groupBy: categoryField,
          },
          xAxisKey: categoryField,
          series: [{ dataKey: valueField, label: valueField }],
          className: 'h-[400px] w-full',
        };
      }
      default:
        return null;
    }
    // `schema.table?.columns` joins the list with the read added for
    // objectui#5269: a memo that reads a key but does not depend on it keeps
    // serving the field list the author has already replaced.
  }, [schema.objectName, schema.table?.columns, schema.table?.fields, currentNamedViewConfig, activeView]);

  // Build grid schema (default content renderer)
  //
  // objectui#5102: `table` is documented as "inherits from ObjectGridSchema",
  // but this whitelist forwarded only the DEPRECATED half of four pairs —
  // `pageSize` / `selectable` / `defaultFilters` / `defaultSort` — and dropped
  // their canonical successors `pagination` / `selection` / `filter` / `sort`
  // on the floor. An author who wrote the canonical shape the type recommends
  // got a compile-clean, semantically correct, RUNTIME-INERT view.
  //
  // ObjectGrid already reads both spellings of all four and already resolves
  // them canonical-first (`schema.pagination?.pageSize ?? schema.pageSize`;
  // `if (schema.selection?.type) … else if (schema.selectable !== undefined)`;
  // `schemaFilter !== undefined ? … : schema.defaultFilters`;
  // `schemaSort ?? (schema.defaultSort ? [schema.defaultSort] : undefined)`).
  // So the fix is forwarding, not translation — and the precedence is not a
  // free choice here: emitting both slots lets ObjectGrid's existing
  // canonical-wins rule decide, which is the only answer that keeps the two
  // layers saying the same thing.
  //
  // objectui#5270: the two segments AHEAD of `table` had a second, separate
  // problem — an ARITY mismatch, not a spelling one. Both of them carry an
  // ARRAY of sort keys (`NamedListView.sort` is `Array< { field, order } >`;
  // the `views` prop declares an array too) and both were being written into
  // `defaultSort`, which is declared a SINGLE `{ field, order }`. Neither of
  // ObjectGrid's two readers survives that:
  //
  //   header  `parseSchemaSort(schemaSort ?? [schema.defaultSort])` becomes
  //           `parseSchemaSort([[{ field, order }]])`. The outer array is
  //           iterated and each entry must be a string or an object with a
  //           string `field`; a nested ARRAY is neither, so the entry is
  //           dropped and the result is `[]` — no arrow, the view arrives
  //           looking unsorted.
  //   fetch   `` `${(schema.defaultSort as any).field} ${….order}` `` reads two
  //           missing keys off an array and sends the literal string
  //           `"undefined undefined"` as `$orderby`.
  //
  // So the view's sort now rides the CANONICAL slot, which is declared
  // `string | SortConfig[]` and therefore already holds the arity a view
  // carries. That is also the shape the shared sort sink accepts
  // (`convertSortToQueryParams`, `string | SortConfig[]` — objectui#4869), so
  // this converges on the normalized dialect instead of introducing another.
  // Precedence is unchanged: ObjectGrid resolves `sort ?? defaultSort`, so a
  // view sort still outranks a `table.defaultSort`, and `table.sort` still
  // outranks it too — the same order `mergedSort` and the non-grid fetch use.
  const gridSchema: ObjectGridSchema = useMemo(() => {
    // The two segments ahead of the `table` one, resolved once.
    //
    // `viewFilter` keeps riding the LEGACY slot it rides today:
    // `filter`/`defaultFilters` are not interchangeable downstream —
    // ObjectGrid lowers the canonical slot through `toFilterNode` and
    // raw-assigns the legacy one — so moving a named-view filter across would
    // change the wire shape of a path objectui#5270 does not own. The sort
    // pair has no such asymmetry: both slots reach `$orderby` unlowered, and
    // only the canonical one can hold more than a single key.
    const viewFilter = currentNamedViewConfig?.filter || activeView?.filter;
    const viewSort = currentNamedViewConfig?.sort || activeView?.sort;

    return {
      type: 'object-grid',
      objectName: schema.objectName,
      title: schema.table?.title,
      description: schema.table?.description,
      fields: currentNamedViewConfig?.columns || activeView?.columns || schema.table?.fields,
      columns: currentNamedViewConfig?.columns || activeView?.columns || schema.table?.columns,
      operations: {
        ...operations,
        create: false, // Create is handled by the view's create button
      },
      defaultFilters: viewFilter || schema.table?.defaultFilters,
      // Legacy slot, `table` segment ONLY (objectui#5270). The view segments
      // moved to the canonical `sort` below because this one holds a single
      // `{ field, order }` and they carry arrays; ObjectGrid resolves
      // `sort ?? defaultSort`, so a view sort still outranks this default.
      defaultSort: schema.table?.defaultSort,
      // Canonical `table` keys, at last forwarded. `filter` carries the
      // `table` segment ONLY: the view segment resolved above already occupies
      // the legacy slot, and ObjectGrid prefers this slot over that one — so
      // handing it `table.filter` while a named view is active would let the
      // table default outrank the view, inverting the precedence the two
      // untouched segments exist to express.
      filter: viewFilter ? undefined : schema.table?.filter,
      // `sort` carries the WHOLE chain instead — view segments first, then the
      // `table` one. Same precedence as `mergedSort` and the non-grid fetch
      // express; what changes is only WHICH slot a view's sort arrives in, and
      // this is the one whose declared arity can hold it.
      sort: viewSort || schema.table?.sort,
      pagination: schema.table?.pagination,
      selection: schema.table?.selection,
      pageSize: schema.table?.pageSize,
      selectable: schema.table?.selectable,
      className: schema.table?.className,
    };
  }, [schema, operations, currentNamedViewConfig, activeView]);

  // Build form schema
  const buildFormSchema = (): ObjectFormSchema => {
    const recordId = selectedRecord
      ? ((selectedRecord.id || selectedRecord._id) as string | number | undefined)
      : undefined;

    return {
      type: 'object-form',
      objectName: schema.objectName,
      mode: formMode,
      recordId,
      title: schema.form?.title,
      description: schema.form?.description,
      fields: schema.form?.fields,
      customFields: schema.form?.customFields,
      // #2545: `sections` is the spec-aligned key (it used to be dropped
      // here); `groups` is its deprecated legacy alias, normalized to
      // sections inside ObjectForm.
      sections: schema.form?.sections,
      groups: schema.form?.groups,
      layout: schema.form?.layout,
      columns: schema.form?.columns,
      showSubmit: schema.form?.showSubmit,
      submitText: schema.form?.submitText,
      showCancel: schema.form?.showCancel,
      cancelText: schema.form?.cancelText,
      showReset: schema.form?.showReset,
      initialValues: schema.form?.initialValues,
      // framework#1894 / #2998: forward the spec-aligned structured
      // `buttons`/`defaults`; ObjectForm folds them onto the flat props above
      // (an explicitly-set flat key still wins).
      buttons: schema.form?.buttons,
      defaults: schema.form?.defaults,
      readOnly: schema.form?.readOnly || formMode === 'view',
      className: schema.form?.className,
      // Master-detail by config: a form view can declare inline child
      // collections; ObjectForm renders them as an atomic master-detail form
      // (no bespoke page). ObjectForm skips them in view mode.
      subforms: schema.form?.subforms,
      onSuccess: handleFormSuccess,
      onCancel: handleFormCancel,
    };
  };

  // Get form title based on mode.
  //
  // objectui#3462: the three verbs used to be string-built (`` `View ${label}` ``),
  // so a zh session reading a drawer opened by a row click was headed
  // "View 联系人" — an English verb glued onto a localized label. They resolve
  // `form.{create,edit,view}Title` now, which is the SAME key family `app-shell`
  // already uses for the page-mode record form, so the four surfaces cannot
  // drift. German compounds and ja/zh particle order all sit inside the
  // template, which is why this is a key and not a verb lookup + concatenation.
  //
  // Two branches stay literal on purpose:
  //   - `schema.form?.title` — the author wrote a title, so use the author's.
  //   - `default` — returns the object label alone, no verb to translate.
  const getFormTitle = (): string => {
    if (schema.form?.title) return schema.form.title;
    const objectLabel = (objectSchema?.label as string) || schema.objectName;
    switch (formMode) {
      case 'create': return tView('form.createTitle', { object: objectLabel });
      case 'edit': return tView('form.editTitle', { object: objectLabel });
      case 'view': return tView('form.viewTitle', { object: objectLabel });
      default: return objectLabel;
    }
  };

  // Determine form container width from navigation config
  const formWidthClass = useMemo(() => {
    const w = navigationConfig?.width;
    if (!w) return '';
    if (typeof w === 'number') return `max-w-[${w}px]`;
    return `max-w-[${w}]`;
  }, [navigationConfig]);

  // Render the form in a drawer
  const renderDrawerForm = () => (
    <Drawer open={isFormOpen} onOpenChange={setIsFormOpen} direction="right">
      <DrawerContent className={cn('w-full sm:max-w-2xl', formWidthClass)}>
        <DrawerHeader>
          <DrawerTitle>{getFormTitle()}</DrawerTitle>
          {schema.form?.description && (
            <DrawerDescription>{schema.form.description}</DrawerDescription>
          )}
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <ObjectForm schema={buildFormSchema()} dataSource={dataSource} />
        </div>
      </DrawerContent>
    </Drawer>
  );

  // Render the form in a modal
  const renderModalForm = () => (
    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
      <DialogContent className={cn('max-w-2xl max-h-[90vh] overflow-y-auto', formWidthClass)}>
        <DialogHeader>
          <DialogTitle>{getFormTitle()}</DialogTitle>
          {schema.form?.description && (
            <DialogDescription>{schema.form.description}</DialogDescription>
          )}
        </DialogHeader>
        <ObjectForm schema={buildFormSchema()} dataSource={dataSource} />
      </DialogContent>
    </Dialog>
  );

  // The filter and sort this component hands to the renderer it delegates to.
  //
  // Both used to open with a branch keyed on the local filter/sort state — and
  // the filter one REPLACED the view's own filter with the user's rather than
  // combining them, which would have been a bug had the state ever been
  // written. It never was (see the note by the state declarations), so both
  // branches were dead. They are gone rather than corrected: the delegated
  // renderer owns the filter/sort UI and does its own combining.
  //
  // The `table` segment of both chains reads the canonical key first and the
  // deprecated one as its alias (objectui#5102). Both land on `list-view`'s
  // own `filter` / `sort` keys below, so a canonical value arrives in the slot
  // that already matches its shape.
  const mergedFilters = currentNamedViewConfig?.filter
    || activeView?.filter
    || schema.table?.filter
    || schema.table?.defaultFilters;

  const mergedSort = currentNamedViewConfig?.sort
    || activeView?.sort
    || schema.table?.sort
    || schema.table?.defaultSort;

  // --- Content renderer ---
  const renderContent = () => {
    const key = `${schema.objectName}-${activeNamedView || activeView?.id || 'default'}-${currentViewType}-${refreshKey}`;

    // If a custom renderListView is provided, use it
    // #region object-view HOST-COMPOSITION SURFACE (objectui#5097)
    //
    // 31 of the values assembled below are read off the object-view node with
    // `(schema as any).K`. Four are declared members of `ObjectViewSchema`;
    // the other 27 are NOT, deliberately: the maintainer ruling of 2026-08-18
    // on objectui#5097 (verbatim 「同意」) ruled them HOST-COMPOSITION surface,
    // not authored surface, because this branch is entered only when a HOST
    // passes `renderListView` and the registered renderer never does.
    //
    // ⛔ Do not declare these keys on `ObjectViewSchema`, ⛔ do not teach them
    // as schema keys in the docs, and ⛔ do not delete a read as a tidy-up — a
    // deleted read silently blanks a stored app-shell document.
    //
    // The list, the two supplier `file:line`s, the contract's (non-)verdict and
    // the now-resolved `conditionalFormatting` asymmetry (objectui#5248) live
    // with `OBJECT_VIEW_HOST_COMPOSITION_KEYS` at the top of this file. The
    // `#region` fence is load-bearing: `src/__tests__/objectViewHostSurface.test.tsx`
    // re-derives the read set from between these two markers, so adding or
    // removing a read here fails that pin BY NAME — and since objectui#5248 it
    // also fails if any exempt key is read OUTSIDE the fence, which is where
    // the author-reachable paths live.
    if (renderListView) {
      return renderListView({
        schema: {
          type: 'list-view',
          objectName: schema.objectName,
          viewType: currentViewType as any,
          // Active view's display label — ListView appends it to export
          // download filenames.
          label: (currentNamedViewConfig as any)?.label ?? activeView?.label,
          // Spec-canonical key (#2890) — the view configs this reads from are
          // already `columns`-keyed, so emitting `fields` here was a pure
          // canonical→legacy downgrade.
          //
          // objectui#5269: the `table` segment reads the canonical key first
          // here too. This slot is `list-view`'s `columns`, declared
          // `string[] | ListColumn[]` — the same union `table.columns` carries
          // — so the canonical value arrives in a slot already shaped to hold
          // it, and `ListView` reads it (`schema.columns`, its whole column
          // set). The deprecated `table.fields` stays a working alias.
          columns: currentNamedViewConfig?.columns || activeView?.columns
            || schema.table?.columns || schema.table?.fields,
          filter: mergedFilters,
          sort: mergedSort,
          // Propagate appearance/view-config properties for live preview
          rowHeight: activeView?.rowHeight,
          densityMode: activeView?.densityMode,
          groupBy: activeView?.groupBy,
          groupBy2: activeView?.groupBy2,
          grouping: activeView?.grouping,
          options: currentNamedViewConfig?.options || activeView,
          // Toolbar policy — one vocabulary (#2890). The host node and the
          // active view may still carry the legacy bare `show*` flags, so both
          // go through `normalizeListViewSchema` (the single fold) and merge,
          // view over host. `densityMode`/`rowHeight` above take the same route
          // once step 2's fold runs at the ListView boundary.
          userActions: {
            ...(normalizeListViewSchema(schema ?? {}) as { userActions?: object }).userActions,
            ...(normalizeListViewSchema(activeView ?? {}) as { userActions?: object }).userActions,
          },
          compactToolbar: activeView?.compactToolbar ?? (schema as any).compactToolbar,
          allowExport: activeView?.allowExport ?? (schema as any).allowExport,
          // Propagate display properties
          color: activeView?.color ?? (schema as any).color,
          // Propagate view-config properties (Bug 4 / items 14-22)
          inlineEdit: activeView?.inlineEdit ?? (schema as any).inlineEdit,
          wrapHeaders: activeView?.wrapHeaders ?? (schema as any).wrapHeaders,
          clickIntoRecordDetails: activeView?.clickIntoRecordDetails ?? (schema as any).clickIntoRecordDetails,
          addRecordViaForm: activeView?.addRecordViaForm ?? (schema as any).addRecordViaForm,
          addDeleteRecordsInline: activeView?.addDeleteRecordsInline ?? (schema as any).addDeleteRecordsInline,
          collapseAllByDefault: activeView?.collapseAllByDefault ?? (schema as any).collapseAllByDefault,
          fieldTextColor: activeView?.fieldTextColor ?? (schema as any).fieldTextColor,
          prefixField: activeView?.prefixField ?? (schema as any).prefixField,
          showDescription: activeView?.showDescription ?? (schema as any).showDescription,
          // ViewData source override (spec `data` key) — e.g. gantt views fed
          // by a composite api endpoint; without this pick the api provider
          // never reaches the renderer.
          data: (currentNamedViewConfig as any)?.data ?? (activeView as any)?.data ?? (schema as any).data,
          // Propagate new spec properties (P0/P1/P2)
          navigation: activeView?.navigation ?? (schema as any).navigation,
          selection: activeView?.selection ?? (schema as any).selection,
          pagination: activeView?.pagination ?? (schema as any).pagination,
          searchableFields: activeView?.searchableFields ?? (schema as any).searchableFields,
          filterableFields: activeView?.filterableFields ?? (schema as any).filterableFields,
          resizable: activeView?.resizable ?? (schema as any).resizable,
          hiddenFields: activeView?.hiddenFields ?? (schema as any).hiddenFields,
          rowActions: activeView?.rowActions ?? (schema as any).rowActions,
          rowActionDefs: (activeView as any)?.rowActionDefs ?? (schema as any).rowActionDefs,
          bulkActions: activeView?.bulkActions ?? (schema as any).bulkActions,
          sharing: activeView?.sharing ?? (schema as any).sharing,
          addRecord: activeView?.addRecord ?? (schema as any).addRecord,
          conditionalFormatting: activeView?.conditionalFormatting ?? (schema as any).conditionalFormatting,
          userFilters: activeView?.userFilters ?? (schema as any).userFilters,
          showRecordCount: activeView?.showRecordCount ?? (schema as any).showRecordCount,
          allowPrinting: activeView?.allowPrinting ?? (schema as any).allowPrinting,
          emptyState: activeView?.emptyState ?? (schema as any).emptyState,
          aria: activeView?.aria ?? (schema as any).aria,
          // Propagate refresh signal so ListView re-fetches after mutations
          refreshTrigger: refreshKey,
        },
        dataSource,
        onEdit: handleEdit,
        onRowClick: handleRowClick,
        className: 'h-full',
        refreshKey,
        onAddRecord: handleCreate,
      });
    }
    // #endregion object-view HOST-COMPOSITION SURFACE (objectui#5097)

    // For non-grid views, use SchemaRenderer with generated schema
    if (currentViewType !== 'grid') {
      const viewSchema = generateViewSchema(currentViewType);
      if (viewSchema && SchemaRendererComponent) {
        return (
          <SchemaRendererComponent
            key={key}
            schema={viewSchema}
            dataSource={dataSource}
            data={data}
            loading={loading}
          />
        );
      }
      // Fallback: if SchemaRenderer is not available or schema not generated
      if (!SchemaRendererComponent) {
        return (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <p>SchemaRenderer not available. Install @object-ui/react to render {currentViewType} views.</p>
          </div>
        );
      }
    }

    // Default: use ObjectGrid
    return (
      <ObjectGrid
        key={key}
        schema={gridSchema}
        dataSource={dataSource}
        onRowClick={handleRowClick}
        onEdit={operations.update !== false ? handleEdit : undefined}
        onDelete={operations.delete !== false ? handleDelete : undefined}
        onBulkDelete={operations.delete !== false ? handleBulkDelete : undefined}
      />
    );
  };

  // --- Named list views tabs ---
  const renderNamedViewTabs = () => {
    // ADR-0053: host owns the switcher (ViewTabBar) — don't duplicate it.
    if (hideNamedViewTabs) return null;
    if (!hasNamedViews) return null;
    const entries = Object.entries(namedListViews!);
    if (entries.length <= 1) return null;

    return (
      <Tabs value={activeNamedView} onValueChange={handleNamedViewChange} className="w-full">
        <TabsList className="w-auto">
          {entries.map(([key, view]) => (
            <TabsTrigger key={key} value={key} className="text-sm">
              {view.label || key}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    );
  };

  // Render toolbar — only named view tabs; filter/sort/search is handled by ListView
  const renderToolbar = () => {
    const showCreateButton = schema.showCreate !== false && operations.create !== false;
    const showViewSwitcherToggle = schema.showViewSwitcher === true; // Changed: default to false (hidden)

    const namedViewTabs = renderNamedViewTabs();

    // Hide toolbar entirely if there is nothing to show
    if (!namedViewTabs && !showViewSwitcherToggle && !showCreateButton && !toolbarAddon) return null;

    return (
      <div className="flex flex-col gap-3">
        {/* Named view tabs (if any) */}
        {namedViewTabs}

        {/* ViewSwitcher + action buttons row */}
        {(showViewSwitcherToggle || showCreateButton || toolbarAddon) && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {showViewSwitcherToggle && viewSwitcherSchema && (
                <ViewSwitcher
                  schema={viewSwitcherSchema}
                  onViewChange={handleViewTypeChange}
                  onCreateView={onCreateView}
                  onViewAction={onViewAction}
                  className="overflow-x-auto"
                />
              )}
            </div>

            {/* Right side: Actions */}
            <div className="flex items-center gap-2">
              {toolbarAddon}
              {showCreateButton && (
                <Button size="sm" onClick={handleCreate}>
                  <Plus className="h-4 w-4" />
                  {createVerb}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Determine which form container to render
  const formLayout = navigationConfig?.mode === 'modal' ? 'modal'
    : navigationConfig?.mode === 'drawer' ? 'drawer'
    : navigationConfig?.mode === 'split' ? 'split'
    : navigationConfig?.mode === 'popover' ? 'popover'
    : layout;

  // Build the record detail content for NavigationOverlay (split/popover modes)
  const renderOverlayDetail = (_record: Record<string, unknown>) => (
    <div className="space-y-3">
      <ObjectForm schema={buildFormSchema()} dataSource={dataSource} />
    </div>
  );

  // Shared handler for NavigationOverlay onOpenChange — close form when overlay is dismissed
  const handleOverlayOpenChange = useCallback((open: boolean) => {
    if (!open) handleFormCancel();
  }, [handleFormCancel]);

  // Computed once so a `null` toolbar (nothing to show — no named views, no
  // view switcher, no create button, no addon) doesn't still leave behind an
  // empty `mb-4` spacer div above the content.
  const toolbar = renderToolbar();

  // For split mode, wrap content inside NavigationOverlay with mainContent
  if (formLayout === 'split') {
    const objectLabel = (objectSchema?.label as string) || schema.objectName;
    return (
      <div className={cn('flex flex-col h-full min-w-0 overflow-hidden', className)}>
        {(schema.title || schema.description) && (
          <div className="mb-4 shrink-0">
            {schema.title && <h2 className="text-2xl font-bold tracking-tight">{schema.title}</h2>}
            {schema.description && <p className="text-muted-foreground mt-1">{schema.description}</p>}
          </div>
        )}
        {toolbar && <div className="mb-4 shrink-0">{toolbar}</div>}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          {isFormOpen && selectedRecord ? (
            <NavigationOverlay
              isOpen={isFormOpen}
              selectedRecord={selectedRecord}
              mode="split"
              close={handleFormCancel}
              setIsOpen={handleOverlayOpenChange}
              width={navigationConfig?.width}
              isOverlay={true}
              /* Keyed, not string-built (objectui#3459). This value is handed
                 to `NavigationOverlay`'s `title` prop, so the overlay's own
                 `detail.recordDetail` default never applies — whatever this
                 resolves to IS the visible `h3` heading of the split panel.
                 Interpolating through `detail.recordDetailWithLabel` instead of
                 splicing the label into an English template lets each pack
                 choose its own word order (de hyphenates, ja/zh need a
                 possessive particle). English output is byte-identical
                 (`Contacts Detail`), with or without an `I18nProvider`. */
              title={tView('detail.recordDetailWithLabel', { label: objectLabel })}
              mainContent={<div className="h-full overflow-auto">{renderContent()}</div>}
            >
              {renderOverlayDetail}
            </NavigationOverlay>
          ) : (
            renderContent()
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full min-w-0 overflow-hidden', className)}>
      {/* Title and description */}
      {(schema.title || schema.description) && (
        <div className="mb-4 shrink-0">
          {schema.title && (
            <h2 className="text-2xl font-bold tracking-tight">{schema.title}</h2>
          )}
          {schema.description && (
            <p className="text-muted-foreground mt-1">{schema.description}</p>
          )}
        </div>
      )}

      {/* Toolbar */}
      {toolbar && <div className="mb-4 shrink-0">{toolbar}</div>}

      {/* Content */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {renderContent()}
      </div>

      {/* Form (drawer or modal) */}
      {formLayout === 'drawer' && renderDrawerForm()}
      {formLayout === 'modal' && renderModalForm()}
      {/* Popover mode — uses NavigationOverlay Dialog fallback (no popoverTrigger) */}
      {formLayout === 'popover' && isFormOpen && selectedRecord && (
        <NavigationOverlay
          isOpen={isFormOpen}
          selectedRecord={selectedRecord}
          mode="popover"
          close={handleFormCancel}
          setIsOpen={handleOverlayOpenChange}
          width={navigationConfig?.width}
          isOverlay={true}
          title={getFormTitle()}
        >
          {renderOverlayDetail}
        </NavigationOverlay>
      )}
    </div>
  );
};
