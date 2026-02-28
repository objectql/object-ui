import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ReportViewer, ReportConfigPanel } from '@object-ui/plugin-report';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { Pencil, BarChart3, Loader2 } from 'lucide-react';
import { MetadataToggle, MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { useMetadata } from '../context/MetadataProvider';
import { useAdapter } from '../context/AdapterProvider';
import type { DataSource } from '@object-ui/types';

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
  const { reportName } = useParams<{ reportName: string }>();
  const { showDebug, toggleDebug } = useMetadataInspector();
  const adapter = useAdapter();
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  // Version counter — incremented on save to refresh the stable config reference
  const [configVersion, setConfigVersion] = useState(0);
  
  // Find report definition from API-driven metadata
  const { reports, objects, loading, refresh } = useMetadata();
  const initialReport = reports?.find((r: any) => r.name === reportName);
  const [reportData, setReportData] = useState(initialReport);

  // Local schema state for live preview — initialized from metadata
  const [editSchema, setEditSchema] = useState<any>(null);

  // State for report runtime data
  const [reportRuntimeData, setReportRuntimeData] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Derive available fields from object schema for filter/sort editors
  // Uses live editSchema when available to respond to objectName changes
  const availableFields = useMemo(() => {
    const liveReport = editSchema || reportData;
    const objName = liveReport?.objectName || liveReport?.dataSource?.object || liveReport?.dataSource?.resource;
    if (objName && objects?.length) {
      const objDef = objects.find((o: any) => o.name === objName);
      if (objDef?.fields) {
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
      }
    }
    return FALLBACK_FIELDS;
  }, [editSchema, reportData, objects]);

  // ---- Save helper --------------------------------------------------------
  const saveSchema = useCallback(
    async (schema: any) => {
      try {
        if (adapter) {
          await adapter.update('sys_report', reportName!, schema);
          refresh().catch(() => {});
        }
      } catch (err) {
        console.warn('[ReportView] Auto-save failed:', err);
      }
    },
    [adapter, reportName, refresh],
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
            <EmptyTitle>Report Not Found</EmptyTitle>
            <EmptyDescription>
              The report &quot;{reportName}&quot; could not be found.
              It may have been removed or renamed.
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
  const mapReportForViewer = (src: any) => {
    const mapped: any = { ...src };
    if (!mapped.title && mapped.label) {
      mapped.title = mapped.label;
    }
    // Map spec 'columns' (field/label/aggregate) → ReportSchema 'fields' (name/label/aggregation)
    if (!mapped.fields && Array.isArray(mapped.columns)) {
      mapped.fields = mapped.columns.map((col: any) => ({
        name: col.field || col.name,
        label: col.label,
        type: col.type,
        format: col.format,
        renderAs: col.renderAs,
        colorMap: col.colorMap,
        ...(col.aggregate ? { aggregation: col.aggregate, showInSummary: true } : {}),
      }));
    }
    // Always regenerate sections from current fields so that live config
    // changes (e.g. field picker updates) are immediately reflected in
    // the preview.  This fixes the linkage bug where config panel edits
    // did not update the rendered report.
    if (mapped.fields && Array.isArray(mapped.fields) && mapped.fields.length > 0) {
      const hasSummaryFields = mapped.fields.some((f: any) => f.showInSummary || f.aggregation);
      const reportType = mapped.reportType || 'tabular';
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
          format: f.format,
          renderAs: f.renderAs,
          colorMap: f.colorMap,
        })),
      });
      // Generate chart section from chartConfig if configured
      if (mapped.chartConfig?.chartType) {
        sections.push({
          type: 'chart',
          title: 'Chart',
          chart: {
            type: 'chart',
            chartType: mapped.chartConfig.chartType,
            xAxisField: mapped.chartConfig.xAxisField,
            yAxisFields: mapped.chartConfig.yAxisFields,
          },
        });
      }
      // Preserve any user-defined chart sections from the original schema
      if (Array.isArray(src.sections)) {
        const chartSections = src.sections.filter((s: any) => s.type === 'chart' && !mapped.chartConfig?.chartType);
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
  const reportForViewer = mapReportForViewer(previewReport);
  const viewerSchema = {
      type: 'report-viewer',
      report: reportForViewer, // The report definition
      data: reportRuntimeData, // Runtime data fetched from the data source
      showToolbar: true,
      allowExport: true,
      loading: dataLoading, // Loading state for data fetching
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-4 p-4 sm:p-6 border-b shrink-0">
        <div className="min-w-0 flex-1">
           <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate">{previewReport.title || previewReport.label || 'Report Viewer'}</h1>
           {previewReport.description && (
             <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{previewReport.description}</p>
           )}
        </div>
        <div className="shrink-0 flex items-center gap-1.5">
           <button
             type="button"
             onClick={handleOpenConfigPanel}
             className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
             data-testid="report-edit-button"
           >
             <Pencil className="h-3.5 w-3.5" />
             Edit
           </button>
           <MetadataToggle open={showDebug} onToggle={toggleDebug} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col sm:flex-row relative">
         <div className="flex-1 min-w-0 overflow-auto p-4 sm:p-6 lg:p-8 bg-muted/5">
            <div className="max-w-5xl mx-auto shadow-sm border rounded-lg sm:rounded-xl bg-background overflow-hidden min-h-150">
                <ReportViewer schema={viewerSchema} />
            </div>
         </div>

         {/* Right-side config panel — inline, matching DashboardView pattern */}
         <ReportConfigPanel
           open={configPanelOpen}
           onClose={handleCloseConfigPanel}
           config={reportConfig}
           onSave={handleReportConfigSave}
           onFieldChange={handleReportFieldChange}
           availableFields={availableFields}
         />

         <MetadataPanel
            open={showDebug}
            sections={[{ title: 'Report Configuration', data: previewReport }]}
         />
      </div>
    </div>
  );
}
