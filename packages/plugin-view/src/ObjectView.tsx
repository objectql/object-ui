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

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type {
  ObjectViewSchema,
  ObjectGridSchema,
  ObjectFormSchema,
  DataSource,
  ViewSwitcherSchema,
  FilterUISchema,
  SortUISchema,
  ViewType,
  NamedListView,
  ViewNavigationConfig,
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
  Button,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@object-ui/components';
import { Plus } from 'lucide-react';
import { ViewSwitcher } from './ViewSwitcher';

/**
 * Attempt to import SchemaRenderer from @object-ui/react.
 * Falls back to null if not available.
 */
let SchemaRendererComponent: React.FC<any> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@object-ui/react');
  SchemaRendererComponent = mod.SchemaRenderer || null;
} catch {
  // @object-ui/react not available
}

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
  renderListView?: (props: {
    schema: any;
    dataSource: DataSource;
    onEdit?: (record: Record<string, unknown>) => void;
    onRowClick?: (record: Record<string, unknown>) => void;
    className?: string;
  }) => React.ReactNode;

  /**
   * Toolbar addon: extra elements to render in the toolbar (e.g., MetadataToggle)
   */
  toolbarAddon?: React.ReactNode;
}

type FormMode = 'create' | 'edit' | 'view';

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
  toolbarAddon,
}) => {
  const [objectSchema, setObjectSchema] = useState<Record<string, unknown> | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [selectedRecord, setSelectedRecord] = useState<Record<string, unknown> | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Data fetching state for non-grid views
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter & Sort state
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [sortConfig, setSortConfig] = useState<Array<{ field: string; direction: 'asc' | 'desc' }>>([]);

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
      // Only fetch for non-grid views (ObjectGrid has its own data fetching)
      if (currentViewType === 'grid' && !renderListView) return;
      if (!dataSource || !schema.objectName) return;

      setLoading(true);
      try {
        // Build filter
        const baseFilter = currentNamedViewConfig?.filter || activeView?.filter || schema.table?.defaultFilters || [];
        const userFilter = Object.entries(filterValues)
          .filter(([, v]) => v !== undefined && v !== '' && v !== null)
          .map(([field, value]) => [field, '=', value]);

        let finalFilter: any = [];
        if (baseFilter.length > 0 && userFilter.length > 0) {
          finalFilter = ['and', ...baseFilter, ...userFilter];
        } else if (userFilter.length === 1) {
          finalFilter = userFilter[0];
        } else if (userFilter.length > 1) {
          finalFilter = ['and', ...userFilter];
        } else {
          finalFilter = baseFilter;
        }

        // Build sort
        const sort = sortConfig.length > 0
          ? sortConfig.map(s => ({ field: s.field, order: s.direction }))
          : (currentNamedViewConfig?.sort || activeView?.sort || schema.table?.defaultSort || undefined);

        const results = await dataSource.find(schema.objectName, {
          $filter: finalFilter.length > 0 ? finalFilter : undefined,
          $orderby: sort,
          $top: 100,
        });

        let items: any[] = [];
        if (Array.isArray(results)) {
          items = results;
        } else if (results && typeof results === 'object') {
          if (Array.isArray((results as any).data)) {
            items = (results as any).data;
          } else if (Array.isArray((results as any).records)) {
            items = (results as any).records;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.objectName, dataSource, currentViewType, filterValues, sortConfig, refreshKey, currentNamedViewConfig, activeView, renderListView]);

  // Determine layout mode
  const layout = schema.layout || 'drawer';

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
      const recordId = record._id || record.id;
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
      const recordId = record._id || record.id;
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
        const recordId = record._id || record.id;
        const url = `/${schema.objectName}/${recordId}`;
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
        const recordId = record._id || record.id;
        if (schema.onNavigate) {
          schema.onNavigate(recordId as string | number, 'view');
        }
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

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
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
        };
        return {
          type: v.type as ViewType,
          label: v.label,
          icon: iconMap[v.type] || 'table',
        };
      }),
    };
  }, [hasMultiView, viewsPropResolved, activeView, schema.objectName]);

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

  // --- FilterUI schema (auto-generated from objectSchema or filterableFields) ---
  const filterSchema: FilterUISchema | null = useMemo(() => {
    if (schema.showFilters === false) return null;

    // If filterableFields specified, use only those
    const filterableFieldNames = schema.filterableFields;
    const fields = (objectSchema as any)?.fields || {};

    const fieldEntries = filterableFieldNames
      ? filterableFieldNames.map(name => [name, fields[name] || { label: name }] as [string, any])
      : Object.entries(fields).filter(([, f]: [string, any]) => !f.hidden).slice(0, 8);

    const filterableFieldDefs = fieldEntries.map(([key, f]: [string, any]) => {
      const fieldType = f.type || 'text';
      let filterType: 'text' | 'number' | 'select' | 'date' | 'boolean' = 'text';
      let options: Array<{ label: string; value: any }> | undefined;

      if (fieldType === 'number' || fieldType === 'currency' || fieldType === 'percent') {
        filterType = 'number';
      } else if (fieldType === 'boolean' || fieldType === 'toggle') {
        filterType = 'boolean';
      } else if (fieldType === 'date' || fieldType === 'datetime') {
        filterType = 'date';
      } else if (fieldType === 'select' || f.options) {
        filterType = 'select';
        options = (f.options || []).map((o: any) =>
          typeof o === 'string' ? { label: o, value: o } : { label: o.label, value: o.value },
        );
      }
      return {
        field: key,
        label: f.label || key,
        type: filterType,
        placeholder: `Filter ${f.label || key}...`,
        ...(options ? { options } : {}),
      };
    });

    if (filterableFieldDefs.length === 0) return null;

    return {
      type: 'filter-ui' as const,
      layout: 'popover' as const,
      showClear: true,
      showApply: true,
      filters: filterableFieldDefs,
      values: filterValues,
    };
  }, [schema.showFilters, schema.filterableFields, objectSchema, filterValues]);

  // --- SortUI schema ---
  const showSort = (schema as ObjectViewSchema).showSort;
  const sortSchema: SortUISchema | null = useMemo(() => {
    if (showSort === false) return null;

    const fields = (objectSchema as any)?.fields || {};
    const sortableFields = Object.entries(fields)
      .filter(([, f]: [string, any]) => !f.hidden)
      .slice(0, 10)
      .map(([key, f]: [string, any]) => ({ field: key, label: f.label || key }));

    if (sortableFields.length === 0) return null;

    return {
      type: 'sort-ui' as const,
      variant: 'dropdown' as const,
      multiple: false,
      fields: sortableFields,
      sort: sortConfig,
    };
  }, [objectSchema, sortConfig, showSort]);

  // --- Generate view component schema for non-grid views ---
  const generateViewSchema = useCallback((viewType: string): any => {
    const baseProps: Record<string, any> = {
      objectName: schema.objectName,
      fields: currentNamedViewConfig?.columns || activeView?.columns || schema.table?.fields,
      className: 'h-full w-full',
      showSearch: activeView?.showSearch ?? schema.showSearch ?? false,
      showSort: activeView?.showSort ?? schema.showSort ?? false,
      showFilters: activeView?.showFilters ?? schema.showFilters ?? false,
      striped: activeView?.striped ?? false,
      bordered: activeView?.bordered ?? false,
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
      case 'kanban':
        return {
          type: 'object-kanban',
          ...baseProps,
          groupBy: viewOptions.kanban?.groupField || 'status',
          groupField: viewOptions.kanban?.groupField || 'status',
          titleField: viewOptions.kanban?.titleField || 'name',
          cardFields: baseProps.fields || [],
          ...(viewOptions.kanban || {}),
        };
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
          imageField: viewOptions.gallery?.imageField,
          titleField: viewOptions.gallery?.titleField || 'name',
          subtitleField: viewOptions.gallery?.subtitleField,
          ...(viewOptions.gallery || {}),
        };
      case 'timeline':
        return {
          type: 'object-timeline',
          ...baseProps,
          dateField: viewOptions.timeline?.dateField || 'created_at',
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
        return {
          type: 'object-map',
          ...baseProps,
          locationField: viewOptions.map?.locationField || 'location',
          ...(viewOptions.map || {}),
        };
      default:
        return null;
    }
  }, [schema.objectName, schema.table?.fields, currentNamedViewConfig, activeView]);

  // Build grid schema (default content renderer)
  const gridSchema: ObjectGridSchema = useMemo(() => ({
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
    defaultFilters: currentNamedViewConfig?.filter || activeView?.filter || schema.table?.defaultFilters,
    defaultSort: currentNamedViewConfig?.sort || activeView?.sort || schema.table?.defaultSort,
    pageSize: schema.table?.pageSize,
    selectable: schema.table?.selectable,
    striped: activeView?.striped ?? schema.table?.striped,
    bordered: activeView?.bordered ?? schema.table?.bordered,
    className: schema.table?.className,
  }), [schema, operations, currentNamedViewConfig, activeView]);

  // Build form schema
  const buildFormSchema = (): ObjectFormSchema => {
    const recordId = selectedRecord
      ? ((selectedRecord._id || selectedRecord.id) as string | number | undefined)
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
      groups: schema.form?.groups,
      layout: schema.form?.layout,
      columns: schema.form?.columns,
      showSubmit: schema.form?.showSubmit,
      submitText: schema.form?.submitText,
      showCancel: schema.form?.showCancel,
      cancelText: schema.form?.cancelText,
      showReset: schema.form?.showReset,
      initialValues: schema.form?.initialValues,
      readOnly: schema.form?.readOnly || formMode === 'view',
      className: schema.form?.className,
      onSuccess: handleFormSuccess,
      onCancel: handleFormCancel,
    };
  };

  // Get form title based on mode
  const getFormTitle = (): string => {
    if (schema.form?.title) return schema.form.title;
    const objectLabel = (objectSchema?.label as string) || schema.objectName;
    switch (formMode) {
      case 'create': return `Create ${objectLabel}`;
      case 'edit': return `Edit ${objectLabel}`;
      case 'view': return `View ${objectLabel}`;
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

  // Compute merged filters for the list
  const mergedFilters = useMemo(() => {
    const hasUserFilters = Object.keys(filterValues).some(
      k => filterValues[k] !== undefined && filterValues[k] !== '' && filterValues[k] !== null,
    );
    if (hasUserFilters) {
      return Object.entries(filterValues)
        .filter(([, v]) => v !== undefined && v !== '' && v !== null)
        .map(([field, value]) => ({ field, operator: 'equals' as const, value }));
    }
    return currentNamedViewConfig?.filter || activeView?.filter || schema.table?.defaultFilters;
  }, [filterValues, currentNamedViewConfig, activeView, schema.table?.defaultFilters]);

  const mergedSort = useMemo(() => {
    return sortConfig.length > 0
      ? sortConfig
      : currentNamedViewConfig?.sort || activeView?.sort || schema.table?.defaultSort;
  }, [sortConfig, currentNamedViewConfig, activeView, schema.table?.defaultSort]);

  // --- Content renderer ---
  const renderContent = () => {
    const key = `${schema.objectName}-${activeNamedView || activeView?.id || 'default'}-${currentViewType}-${refreshKey}`;

    // If a custom renderListView is provided, use it
    if (renderListView) {
      return renderListView({
        schema: {
          type: 'list-view',
          objectName: schema.objectName,
          viewType: currentViewType as any,
          fields: currentNamedViewConfig?.columns || activeView?.columns || schema.table?.fields,
          filters: mergedFilters,
          sort: mergedSort,
          // Propagate appearance/view-config properties for live preview
          rowHeight: activeView?.rowHeight,
          densityMode: activeView?.densityMode,
          groupBy: activeView?.groupBy,
          options: currentNamedViewConfig?.options || activeView,
          // Propagate toolbar toggle flags
          showSearch: activeView?.showSearch ?? schema.showSearch,
          showFilters: activeView?.showFilters ?? schema.showFilters,
          showSort: activeView?.showSort ?? schema.showSort,
          // Propagate display properties
          striped: activeView?.striped ?? (schema as any).striped,
          bordered: activeView?.bordered ?? (schema as any).bordered,
          color: activeView?.color ?? (schema as any).color,
        },
        dataSource,
        onEdit: handleEdit,
        onRowClick: handleRowClick,
        className: 'h-full',
      });
    }

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
                  Create
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
    : layout;

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
      <div className="mb-4 shrink-0">
        {renderToolbar()}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        {renderContent()}
      </div>

      {/* Form (drawer or modal) */}
      {formLayout === 'drawer' && renderDrawerForm()}
      {formLayout === 'modal' && renderModalForm()}
    </div>
  );
};
