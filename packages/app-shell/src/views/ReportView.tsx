import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
const ReportViewer = lazy(() =>
  import('@object-ui/plugin-report').then((m) => ({ default: m.ReportViewer })),
);
const ReportRenderer = lazy(() =>
  import('@object-ui/plugin-report').then((m) => ({ default: m.ReportRenderer })),
);
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
// Runtime report editor — hosts the studio's spec-driven report inspector
// (lives in app-shell to avoid a circular dep on plugin-report).
import { ReportConfigPanel } from './ReportConfigPanel';
import { Pencil, BarChart3, Loader2 } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import { MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { useMetadata } from '../providers/MetadataProvider';
import { useExpressionContext } from '../providers/ExpressionProvider';
import { preferLocal } from '../utils/preferLocal';
import { useAdapter } from '../providers/AdapterProvider';
import { useMetadataClient } from './metadata-admin/useMetadata';
import { persistRuntimeMetadata } from './runtime-metadata-persistence';
import { useAuth } from '@object-ui/auth';
import type { DataSource, ReportViewerSchema } from '@object-ui/types';
import type { DatasetDrillArgs } from '@object-ui/plugin-report';
import { DrillDownDrawer } from '@object-ui/plugin-dashboard';
import { DrillNavigationProvider } from '@object-ui/react';
import { useOpenRecordList } from './useOpenRecordList';

// Fallback fields when no schema is available
const FALLBACK_FIELDS = [
  { value: 'month', label: 'Month', type: 'text' },
  { value: 'revenue', label: 'Revenue', type: 'number' },
  { value: 'count', label: 'Count', type: 'number' },
  { value: 'region', label: 'Region', type: 'text' },
  { value: 'product', label: 'Product', type: 'text' },
  { value: 'source', label: 'Lead Source', type: 'text' },
  { value: 'stage', label: 'Stage', type: 'text' },
  { value: 'amount', label: 'Amount', type: 'number' },
];

export function ReportView({ dataSource }: { dataSource?: DataSource }) {
  const { t } = useObjectTranslation();
  const { reportName } = useParams<{ reportName: string }>();
  const { showDebug } = useMetadataInspector();
  const adapter = useAdapter();
  // ADR-0034: report edits persist via the metadata draft/publish model.
  const metadataClient = useMetadataClient();
  // Editing a report mutates the SHARED definition, so it is an admin-only
  // quick-edit affordance (mirrors ObjectView's view-config gate).
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  // Version counter — incremented on save to refresh the stable config reference
  const [configVersion, setConfigVersion] = useState(0);
  
  // Find report definition from API-driven metadata
  const { reports, objects, loading, refresh } = useMetadata();
  // ADR-0048 Phase 2 — prefer the report owned by the current app's package.
  const { app: activeApp } = useExpressionContext();
  const initialReport = preferLocal(reports as any[], reportName, (activeApp as any)?._packageId);
  const [reportData, setReportData] = useState(initialReport);

  // Local schema state for live preview — initialized from metadata
  const [editSchema, setEditSchema] = useState<any>(null);

  // State for report runtime data
  const [reportRuntimeData, setReportRuntimeData] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Drill-through (ADR-0021 D2): clicking an aggregated row/cell opens the
  // underlying records in an in-place drawer (peek without leaving the report),
  // with an "Open in list →" escape hatch to the full object list page.
  const openRecordList = useOpenRecordList();
  const [drill, setDrill] = useState<{ object: string; filter: Record<string, unknown>; title: string } | null>(null);

  const getFieldsForObject = useCallback(
    (objName: string | undefined) => {
      if (!objName || !objects?.length) return undefined;
      const objDef = objects.find((o: any) => o.name === objName);
      if (!objDef?.fields) return undefined;
      const fields = objDef.fields;
      if (Array.isArray(fields)) {
        return fields.map((f: any) =>
          typeof f === 'string'
            ? { value: f, label: f, type: 'text' }
            : { value: f.name, label: f.label || f.name, type: f.type || 'text' },
        );
      }
      return Object.entries(fields).map(([name, def]: [string, any]) => ({
        value: name,
        label: def.label || name,
        type: def.type || 'text',
      }));
    },
    [objects],
  );

  // ADR-0021 D2 drill-down: open the dataset's object list scoped by
  // `?filter[<field>]=<value>` (the same equality-filter contract the
  // related-list "View All" buttons use).
  //
  // Preferred: the renderer hands us the base `object` + an exact field→RAW
  // `objectFilter` (built from the server's drillRawRows), so we navigate
  // straight away — correct for select/lookup dims, no metadata round-trip.
  //
  // Fallback (older server with no drill metadata): only dimension NAMES +
  // DISPLAY-label bucket values arrive, so resolve them through the dataset
  // definition and reverse-map labels to stored values before filtering:
  //   - select fields  → reverse-map label → option value
  //   - lookup fields  → the label is a record name, not the FK id; skip the
  //     dim (the drill lands on a superset rather than filtering wrongly)
  //   - granularity-bucketed dates → need a range, not equality; skip too
  const handleDatasetDrill = useCallback(
    async ({ dataset, groupKey, object, objectFilter }: DatasetDrillArgs) => {
      try {
        // Drawer header: the clicked group's display values (e.g. "West / Q3").
        const titleParts = Object.values(groupKey).filter((v) => v != null).map((v) => String(v));
        const title = titleParts.join(' / ')
          || String(reportData?.label ?? reportData?.name ?? 'Details');

        // Fast path (ADR-0021 D2): the renderer already resolved the dataset's
        // base object + an exact object FIELD → RAW value filter from the
        // server's drillRawRows — correct for select/lookup dims (a stored
        // value, not a display label) with NO dataset-definition round-trip.
        if (object && objectFilter) {
          setDrill({ object, filter: objectFilter, title });
          return;
        }

        // Fallback (older server with no drill metadata): resolve the dataset's
        // object and reverse-map dimension labels → stored values ourselves.
        const def = await metadataClient.get<Record<string, any>>('dataset', dataset);
        const objectName = typeof def?.object === 'string' ? def.object : undefined;
        if (!objectName) return;
        const dims: Array<Record<string, any>> = Array.isArray(def?.dimensions) ? def.dimensions : [];
        const dimByName = new Map(dims.filter((d) => d?.name).map((d) => [d.name as string, d]));

        // Field defs of the dataset's object — the option value↔label source.
        const objDef = objects?.find((o: any) => o.name === objectName);
        const rawFields = objDef?.fields;
        const fieldDef = (field: string): Record<string, any> | undefined => {
          if (Array.isArray(rawFields)) return rawFields.find((f: any) => f?.name === field);
          if (rawFields && typeof rawFields === 'object') return (rawFields as Record<string, any>)[field];
          return undefined;
        };

        const filter: Record<string, unknown> = {};
        for (const [dim, value] of Object.entries(groupKey)) {
          if (value == null) continue;
          const dimDef = dimByName.get(dim);
          if (dimDef?.dateGranularity) continue;
          const field = (dimDef?.field as string) || dim;
          const fd = fieldDef(field);
          if (fd?.type === 'lookup' || fd?.type === 'master_detail') continue;
          let stored: unknown = value;
          if (Array.isArray(fd?.options)) {
            const opt = fd.options.find(
              (o: any) => o?.label === value || o?.value === value,
            );
            if (opt && opt.value != null) stored = opt.value;
          }
          filter[field] = stored;
        }
        setDrill({ object: objectName, filter, title });
      } catch (err) {
        console.warn('ReportView: drill failed', err);
      }
    },
    [metadataClient, objects, reportData],
  );

  // Derive available fields from object schema for filter/sort editors
  // Uses live editSchema when available to respond to objectName changes
  const availableFields = useMemo(() => {
    const liveReport = editSchema || reportData;
    const objName = liveReport?.objectName || liveReport?.dataSource?.object || liveReport?.dataSource?.resource;
    return getFieldsForObject(objName) ?? FALLBACK_FIELDS;
  }, [editSchema, reportData, getFieldsForObject]);

  // ---- Save helper --------------------------------------------------------
  const saveSchema = useCallback(
    async (schema: any) => {
      try {
        if (metadataClient) {
          // ADR-0034: save stages a per-item draft; an explicit Publish
          // promotes it (RuntimeDraftBar). `sys_report` is retired.
          await persistRuntimeMetadata('report', reportName!, schema, {
            metadataClient,
          });
          refresh().catch(() => {});
        }
      } catch (err) {
        console.warn('[ReportView] Auto-save failed:', err);
      }
    },
    [metadataClient, reportName, refresh],
  );

  // ---- Open / close config panel ------------------------------------------
  const handleOpenConfigPanel = useCallback(() => {
    setEditSchema(reportData);
    setConfigPanelOpen(true);
    setConfigVersion((v) => v + 1);
  }, [reportData]);

  const handleCloseConfigPanel = useCallback(() => {
    setConfigPanelOpen(false);
  }, []);

  // ---- Report config panel handlers --------------------------------------
  // Stabilize config reference: only recompute after explicit actions (panel
  // open, save). configVersion is incremented on those actions.
  // This prevents useConfigDraft from resetting the draft on every live field
  // change (same pattern as DashboardView's dashboardConfig).
  const reportConfig = useMemo(
    () => editSchema || reportData,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [configVersion],
  );

  const handleReportConfigSave = useCallback(
    (config: Record<string, any>) => {
      setEditSchema(config);
      saveSchema(config);
      setConfigVersion((v) => v + 1);
    },
    [saveSchema],
  );

  const handleReportFieldChange = useCallback(
    (field: string, value: any) => {
      setEditSchema((prev: any) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // Sync reportData when metadata finishes loading or reportName changes
  useEffect(() => {
    setReportData(initialReport);
  }, [initialReport]);

  // When metadata refreshes, discard stale editSchema if the config panel
  // is already closed.
  useEffect(() => {
    if (!configPanelOpen) {
      setEditSchema(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReport]);

  // Load report runtime data when report definition changes.
  // Use the live editSchema (when available) so that config panel changes
  // to objectName, filters, or limit are immediately reflected in the preview.
  const dataFetchSource = editSchema || reportData;

  // Memoize serialized dependency keys to avoid re-fetching on every render
  const filtersKey = useMemo(() => JSON.stringify(dataFetchSource?.filters), [dataFetchSource?.filters]);
  const dataSourceKey = useMemo(() => JSON.stringify(dataFetchSource?.dataSource), [dataFetchSource?.dataSource]);
  const inlineDataKey = useMemo(() => JSON.stringify(dataFetchSource?.data), [dataFetchSource?.data]);

  useEffect(() => {
    if (!dataFetchSource || !dataSource) {
      setReportRuntimeData([]);
      return;
    }

    // If report has inline data, use it directly
    if (dataFetchSource.data && Array.isArray(dataFetchSource.data)) {
      setReportRuntimeData(dataFetchSource.data);
      return;
    }

    // If report has a dataSource config, fetch data using it
    if (dataFetchSource.dataSource) {
      const fetchDataFromSource = async () => {
        setDataLoading(true);
        try {
          // Use the dataSource configuration to fetch data
          const resource = dataFetchSource.dataSource.object || dataFetchSource.dataSource.resource;
          if (!resource) {
            console.warn('ReportView: dataSource missing object/resource property');
            setReportRuntimeData([]);
            return;
          }

          const result = await dataSource.find(resource, {
            $filter: dataFetchSource.dataSource.filter,
            $orderby: dataFetchSource.dataSource.sort,
            $top: dataFetchSource.dataSource.limit,
          });

          setReportRuntimeData(result.data || []);
        } catch (error) {
          console.error('ReportView: Failed to load data from dataSource', error);
          setReportRuntimeData([]);
        } finally {
          setDataLoading(false);
        }
      };

      fetchDataFromSource();
      return;
    }

    // If report has an objectName, fetch data from that object
    if (dataFetchSource.objectName) {
      const fetchDataFromObject = async () => {
        setDataLoading(true);
        try {
          const result = await dataSource.find(dataFetchSource.objectName, {
            $filter: dataFetchSource.filters,
            $orderby: dataFetchSource.sort,
            $top: dataFetchSource.limit || 100, // Default limit to avoid fetching too much data
          });

          setReportRuntimeData(result.data || []);
        } catch (error) {
          console.error('ReportView: Failed to load data from objectName', error);
          setReportRuntimeData([]);
        } finally {
          setDataLoading(false);
        }
      };

      fetchDataFromObject();
      return;
    }

    // No data source configured
    setReportRuntimeData([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dataFetchSource?.objectName,
    dataFetchSource?.limit,
    filtersKey,
    dataSourceKey,
    inlineDataKey,
    dataSource,
  ]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!initialReport || !reportData) {
    if (!loading && !initialReport) {
      return (
        <div className="h-full flex items-center justify-center p-8">
           <Empty>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
            </div>
            <EmptyTitle>{t('empty.reportNotFound')}</EmptyTitle>
            <EmptyDescription>
              {t('empty.reportNotFoundDescription', { name: reportName })}
            </EmptyDescription>
          </Empty>
        </div>
      );
    }
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Wrap the report definition in the ReportViewer schema
  // The ReportViewer expects a schema property which is of type ReportViewerSchema
  // That schema has a 'report' property which is the actual report definition (ReportSchema)
  // Map @objectstack/spec report format to @object-ui/types ReportSchema:
  //   - 'label' → 'title'
  //   - 'columns' (with 'field') → 'fields' (with 'name') + auto-generate 'sections'
  //   - Hydrate type/options/referenceTo from the bound object's field metadata
  //     so the type-aware cell renderer can show select badges, lookup links,
  //     boolean ✓/✗, email/url/phone links, etc. instead of raw values.
  const mapReportForViewer = (src: any) => {
    const mapped: any = { ...src };
    if (!mapped.title && mapped.label) {
      mapped.title = mapped.label;
    }

    // Build a lookup of object-field metadata to hydrate column type info.
    const objName = mapped.objectName || mapped.dataSource?.object || mapped.dataSource?.resource;
    const objDef = objName ? objects?.find((o: any) => o.name === objName) : null;
    const objFieldsArr: any[] = Array.isArray(objDef?.fields)
      ? objDef.fields
      : objDef?.fields
        ? Object.entries(objDef.fields).map(([name, def]: [string, any]) => ({ name, ...def }))
        : [];
    const objFieldMap: Record<string, any> = {};
    for (const f of objFieldsArr) {
      if (f && f.name) objFieldMap[f.name] = f;
    }

    const hydrate = (col: any): any => {
      const name = col.name || col.field;
      const meta = name ? objFieldMap[name] : undefined;
      if (!meta) return col;
      // Author-provided values win; only fill in what's missing.
      const out = { ...col };
      if (out.type === undefined && meta.type !== undefined) out.type = meta.type;
      if (out.options === undefined && Array.isArray(meta.options)) out.options = meta.options;
      if (out.referenceTo === undefined) {
        const ref = meta.referenceTo || meta.reference?.to || meta.target;
        if (ref) out.referenceTo = ref;
      }
      if (out.label === undefined && meta.label) out.label = meta.label;
      return out;
    };

    // Map spec 'columns' (field/label/aggregate) → ReportSchema 'fields' (name/label/aggregation)
    if (!mapped.fields && Array.isArray(mapped.columns)) {
      mapped.fields = mapped.columns.map((col: any) => {
        const hydrated = hydrate(col);
        return {
          name: hydrated.field || hydrated.name,
          label: hydrated.label,
          type: hydrated.type,
          options: hydrated.options,
          referenceTo: hydrated.referenceTo,
          format: hydrated.format,
          renderAs: hydrated.renderAs,
          colorMap: hydrated.colorMap,
          ...(hydrated.aggregate ? { aggregation: hydrated.aggregate, showInSummary: true } : {}),
        };
      });
    } else if (Array.isArray(mapped.fields)) {
      mapped.fields = mapped.fields.map(hydrate);
    }
    // Always regenerate sections from current fields so that live config
    // changes (e.g. field picker updates) are immediately reflected in
    // the preview.  This fixes the linkage bug where config panel edits
    // did not update the rendered report.
    if (mapped.fields && Array.isArray(mapped.fields) && mapped.fields.length > 0) {
      const hasSummaryFields = mapped.fields.some((f: any) => f.showInSummary || f.aggregation);
      // Spec key is `type`; legacy renderer used `reportType`. Accept either.
      const reportType = mapped.type || mapped.reportType || 'tabular';
      const sections: any[] = [];
      if (reportType === 'summary' || hasSummaryFields) {
        sections.push({ type: 'summary', title: 'Key Metrics' });
      }
      sections.push({
        type: 'table',
        title: 'Details',
        columns: mapped.fields.map((f: any) => ({
          name: f.name,
          label: f.label,
          type: f.type,
          options: f.options,
          referenceTo: f.referenceTo,
          format: f.format,
          renderAs: f.renderAs,
          colorMap: f.colorMap,
        })),
      });
      // Generate chart section from chart config if configured.
      // Spec keys: type / xAxis / yAxis. Legacy: chartType / xAxisField / yAxisFields[0].
      const chartCfg = mapped.chart || mapped.chartConfig;
      const chartTypeVal = chartCfg?.type || chartCfg?.chartType;
      if (chartTypeVal) {
        const xField = chartCfg.xAxis || chartCfg.xAxisField;
        const yField = chartCfg.yAxis || chartCfg.yAxisFields?.[0];
        sections.push({
          type: 'chart',
          title: 'Chart',
          chart: {
            type: 'chart',
            chartType: chartTypeVal,
            xAxisField: xField,
            yAxisFields: yField ? [yField] : chartCfg.yAxisFields,
          },
        });
      }
      // Preserve any user-defined chart sections from the original schema
      if (Array.isArray(src.sections)) {
        const chartSections = src.sections.filter((s: any) => s.type === 'chart' && !chartTypeVal);
        sections.push(...chartSections);
      }
      mapped.sections = sections;
    } else if (!mapped.sections) {
      // No fields and no sections — leave empty
      mapped.sections = [];
    }
    return mapped;
  };

  // Use live-edited schema for preview (persists after closing panel until metadata refreshes)
  const previewReport = editSchema || reportData;
  // Route any object-backed spec report (matrix/joined/tabular/summary) through
  // the spec ReportRenderer dispatcher. It handles aggregation, charts, KPIs
  // and drill protocol end-to-end. The legacy ReportViewer is only used as a
  // last resort for fully-legacy schemas that lack `objectName` (e.g. inline
  // `fields` + `data` arrays from older app code).
  // ADR-0021 single-form: a report bound to a semantic-layer `dataset` (no
  // `objectName`/`columns`) still routes through the spec ReportRenderer, which
  // dispatches it to the dataset path (queryDataset + grouped table / joined
  // blocks). Without this it would fall to the legacy ReportViewer, which has no
  // data source to fetch from → a blank page.
  const isDatasetBound = Boolean(
    previewReport &&
      (typeof previewReport.dataset === 'string' ||
        (previewReport.type === 'joined' &&
          Array.isArray(previewReport.blocks) &&
          previewReport.blocks.some((b: any) => typeof b?.dataset === 'string'))),
  );
  const useSpecRenderer = isDatasetBound || Boolean(
    previewReport &&
      previewReport.objectName &&
      (previewReport.type === 'matrix' ||
        previewReport.type === 'joined' ||
        previewReport.type === 'summary' ||
        previewReport.type === 'tabular' ||
        previewReport.type === undefined ||
        (Array.isArray(previewReport.groupingsAcross) && previewReport.groupingsAcross.length > 0) ||
        Array.isArray(previewReport.columns)),
  );
  const reportForViewer = mapReportForViewer(previewReport);
  const viewerSchema: ReportViewerSchema = {
      type: 'report-viewer',
      report: reportForViewer, // The report definition
      data: reportRuntimeData, // Runtime data fetched from the data source
      showToolbar: true,
      allowExport: true,
      loading: dataLoading, // Loading state for data fetching
  };

  return (
    <DrillNavigationProvider value={{ openRecordList }}>
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-4 p-4 sm:p-6 border-b shrink-0">
        <div className="min-w-0 flex-1">
           <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate">{previewReport.title || previewReport.label || 'Report Viewer'}</h1>
           {previewReport.description && (
             <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{previewReport.description}</p>
           )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
           {isAdmin && (
           <button
             type="button"
             onClick={handleOpenConfigPanel}
             className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
             data-testid="report-edit-button"
           >
             <Pencil className="h-3.5 w-3.5" />
             {t('common.edit')}
           </button>
           )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col sm:flex-row relative">
         <div className="flex-1 min-w-0 overflow-auto p-4 sm:p-6 lg:p-8 bg-muted/5">
             <div className="w-full shadow-sm border rounded-lg sm:rounded-xl bg-background overflow-hidden min-h-150">
                 <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">{t('common.loading', { defaultValue: 'Loading…' })}</div>}>
                   {useSpecRenderer ? (
                     <div className="p-4 sm:p-6">
                       <ReportRenderer schema={previewReport} dataSource={dataSource as any} rows={reportRuntimeData} onDrill={handleDatasetDrill} />
                     </div>
                   ) : (
                     <ReportViewer schema={viewerSchema} />
                   )}
                 </Suspense>
             </div>
         </div>

         {/* Right-side config panel — studio's spec-driven report inspector,
             hosted locally in app-shell (see ReportConfigPanel). */}
         <ReportConfigPanel
           open={configPanelOpen && isAdmin}
           onClose={handleCloseConfigPanel}
           config={reportConfig}
           onSave={handleReportConfigSave}
           onFieldChange={handleReportFieldChange}
           availableFields={availableFields}
           getFieldsForObject={getFieldsForObject}
           name={reportName}
           metadataClient={metadataClient}
           onAfterChange={() => refresh().catch(() => {})}
         />

         <MetadataPanel
            open={showDebug}
            sections={[{ title: 'Report Configuration', data: previewReport }]}
         />
      </div>
    </div>
    {/* Drill-through drawer: peek the records behind a clicked group, then
        click a row to open a record, or use "Open in list →" to escalate to
        the full object list page. */}
    <DrillDownDrawer
      open={!!drill}
      onClose={() => setDrill(null)}
      title={drill?.title ?? ''}
      objectName={drill?.object ?? ''}
      filter={drill?.filter}
      dataSource={dataSource as any}
    />
    </DrillNavigationProvider>
  );
}
