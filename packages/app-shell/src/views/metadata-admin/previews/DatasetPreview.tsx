// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DatasetPreview — runs the live `dataset` draft (ADR-0021) against the server
 * and shows the resulting rows, so authors can see their semantic layer work
 * before saving.
 *
 * It posts the (possibly unsaved) draft inline to
 * `POST /api/v1/analytics/dataset/query` via the AdapterProvider data source
 * (`adapter.queryDataset`). The server compiles the dataset → Cube, applies the
 * tenant/RLS read scope (ADR-0021 D-C), and returns chart-ready rows.
 *
 * Unlike the legacy single-object aggregation, dataset queries are cross-object
 * and only run server-side — so a failure is surfaced as an error banner (the
 * compile error, e.g. "relationship not declared in include") rather than
 * silently falling back to wrong numbers.
 */

import * as React from 'react';
import { Loader2, BarChart3, AlertTriangle, PackageOpen } from 'lucide-react';
import { useAdapter } from '../../../providers/AdapterProvider.js';
import type { MetadataPreviewProps } from '../preview-registry.js';
import { PreviewShell, PreviewEmptyState, PreviewErrorBoundary } from './PreviewShell.js';
import {
  formatMeasure,
  formatDimensionValue,
  buildDatasetFieldHelpers,
  type DatasetResultField,
} from '@object-ui/core';
import { builtinAggregateLabels, useSafeFieldLabel, useSafeTranslate, useDisplayLocale } from '@object-ui/i18n';

// Lazy-loaded so the (recharts-backed) chart bundle only loads when a dataset
// preview actually renders a chart — keeps the metadata-admin bundle small.
const ChartRenderer = React.lazy(() =>
  import('@object-ui/plugin-charts').then((m) => ({ default: m.ChartRenderer })),
);

type Row = Record<string, unknown>;
type PreviewState =
  | { status: 'idle' | 'loading'; rows: Row[]; error?: undefined }
  | { status: 'ok'; rows: Row[]; fields?: DatasetResultField[]; object?: string; error?: undefined }
  | { status: 'error'; rows: Row[]; error: string }
  // The deployment has no analytics capability (framework#3891) — not an
  // authoring mistake, so it reads as a "this needs installing" empty state
  // rather than a red banner blaming the dataset the author just wrote.
  | { status: 'not-installed'; rows: Row[]; error?: undefined };

export function DatasetPreview({ draft }: MetadataPreviewProps) {
  const adapter = useAdapter();
  const { fieldLabel } = useSafeFieldLabel();
  // objectui#7534 — the locale bundle's built-in aggregate labels; `@object-ui/
  // core` is i18n-free, so the layer holding the provider resolves them.
  const tt = useSafeTranslate();
  // The display locale the measure / dimension cells below format in
  // (objectui#4575, completing objectui#4566's channel). Deliberately NOT the
  // `locale` PROP in scope: that one is the metadata designer's own chrome
  // language (`useMetadataLocale()`, which resolves to exactly 'en-US' or
  // 'zh-CN'), while these numbers must match what the report and dashboard
  // render for the same dataset — which is `useDisplayLocale()`.
  const displayLocale = useDisplayLocale();

  const objectName = (draft as Record<string, unknown>).object as string | undefined;

  const measureNames = React.useMemo(() => {
    const m = Array.isArray((draft as any).measures) ? ((draft as any).measures as Array<Record<string, unknown>>) : [];
    return m.map((x) => String(x?.name ?? '')).filter(Boolean);
  }, [draft]);

  const dimensionNames = React.useMemo(() => {
    const d = Array.isArray((draft as any).dimensions) ? ((draft as any).dimensions as Array<Record<string, unknown>>) : [];
    return d.map((x) => String(x?.name ?? '')).filter(Boolean);
  }, [draft]);

  const canRun = !!objectName && measureNames.length > 0;

  const [state, setState] = React.useState<PreviewState>({ status: 'idle', rows: [] });

  const run = React.useCallback(async () => {
    if (!canRun) return;
    setState({ status: 'loading', rows: [] });
    try {
      const result = await (adapter as unknown as {
        queryDataset: (d: unknown, s: unknown) => Promise<{ rows: Row[]; fields?: DatasetResultField[]; object?: string }>;
      }).queryDataset(draft, { dimensions: dimensionNames, measures: measureNames });
      setState({
        status: 'ok',
        rows: Array.isArray(result?.rows) ? result.rows : [],
        fields: Array.isArray(result?.fields) ? result.fields : [],
        object: result?.object,
      });
    } catch (e) {
      if ((e as { code?: string })?.code === 'ANALYTICS_NOT_INSTALLED') {
        setState({ status: 'not-installed', rows: [] });
        return;
      }
      setState({ status: 'error', rows: [], error: String((e as Error)?.message ?? e) });
    }
  }, [adapter, draft, dimensionNames, measureNames, canRun]);

  // Auto-run a live preview whenever the meaningful selection signature changes.
  const signature = `${objectName ?? ''}|${dimensionNames.join(',')}|${measureNames.join(',')}`;
  React.useEffect(() => {
    if (canRun) void run();
    // Intentionally keyed on `signature` only — re-run when the dataset's
    // object/dimensions/measures change, not on every unrelated draft edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (!objectName) {
    return (
      <PreviewShell>
        <PreviewEmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title="Pick a base object"
          description="Set the dataset's `object` to preview it against live data."
        />
      </PreviewShell>
    );
  }

  if (measureNames.length === 0) {
    return (
      <PreviewShell>
        <PreviewEmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title="Add a measure"
          description="A dataset needs at least one measure (e.g. revenue = sum(amount)) to preview."
        />
      </PreviewShell>
    );
  }

  // Display labels + currency-aware formatting, shared with the dashboard widget
  // and the report renderer (@object-ui/core). Falls back to the raw name / plain
  // number when the server result carries no field metadata.
  const resultFields = state.status === 'ok' ? state.fields : undefined;
  const resultObject = state.status === 'ok' ? state.object : undefined;
  // objectui#7534 — a preview column the analytics service minted as a
  // built-in default measure carries `builtinAggregate` and a hard-coded
  // English `label`; resolve it through the shared seam (#7258) so the author
  // previewing a dataset on a zh console reads the same caption the published
  // widget will show.
  const { measureField, headerLabel } = buildDatasetFieldHelpers(
    resultFields,
    resultObject,
    fieldLabel,
    builtinAggregateLabels(tt),
  );
  const columns = [...dimensionNames, ...measureNames];

  // A ratio/percent measure (format like `0.0%`) on the same axis as a
  // magnitude measure (currency in the hundred-thousands) renders as an
  // invisible sliver. When the selection MIXES the two scales, plot the ratio
  // measures as a line on a secondary (right) Y axis via the `combo` chart —
  // bars (magnitude) keep the left axis. Same-scale selections stay a plain bar.
  const isRatioMeasure = (m: string) => {
    const f = measureField(m)?.format;
    return typeof f === 'string' && f.includes('%');
  };
  const ratioMeasures = measureNames.filter(isRatioMeasure);
  const mixedScale = ratioMeasures.length > 0 && ratioMeasures.length < measureNames.length;

  return (
    <PreviewShell hint={`dataset · ${objectName}${dimensionNames.length ? ' · by ' + dimensionNames.join(', ') : ''}`}>
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={state.status === 'loading'}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            {state.status === 'loading'
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <BarChart3 className="h-3.5 w-3.5" />}
            Run preview
          </button>
          <span className="text-[11px] text-muted-foreground">
            {measureNames.length} measure{measureNames.length === 1 ? '' : 's'} · {dimensionNames.length} dimension{dimensionNames.length === 1 ? '' : 's'}
          </span>
        </div>

        {state.status === 'error' && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="break-words">{state.error}</span>
          </div>
        )}

        {state.status === 'not-installed' && (
          <PreviewEmptyState
            icon={<PackageOpen className="h-8 w-8" />}
            title="Analytics capability not installed"
            description="This deployment has no analytics service, so dataset previews can't run. Install @objectstack/service-analytics and mount AnalyticsServicePlugin — the dataset definition itself is fine."
          />
        )}

        {state.status === 'ok' && state.rows.length === 0 && (
          <PreviewEmptyState
            icon={<BarChart3 className="h-8 w-8" />}
            title="No rows"
            description="The dataset returned no rows for the current scope."
          />
        )}

        {state.rows.length > 0 && dimensionNames.length >= 1 && (
          <PreviewErrorBoundary fallbackHint="Couldn't render the chart for this result — the table below still shows the data.">
            <React.Suspense fallback={<div className="h-[260px] flex items-center justify-center text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>}>
              <div className="rounded-md border p-2">
                <ChartRenderer
                  schema={{
                    data: state.rows as Array<Record<string, unknown>>,
                    xAxisKey: dimensionNames[0],
                    chartType: mixedScale ? 'combo' : 'bar',
                    series: measureNames.map((m) => ({
                      dataKey: m,
                      label: headerLabel(m),
                      chartType: mixedScale ? (isRatioMeasure(m) ? 'line' : 'bar') : ('bar' as const),
                    })),
                  } as any}
                />
                {mixedScale && (
                  <p className="mt-1 px-1 text-[10px] text-muted-foreground">
                    Ratio measures ({ratioMeasures.map(headerLabel).join(', ')}) use the right axis.
                  </p>
                )}
              </div>
            </React.Suspense>
          </PreviewErrorBoundary>
        )}

        {state.rows.length > 0 && (
          <div className="overflow-auto max-h-[60vh] rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{headerLabel(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row, i) => (
                  <tr key={i} className="border-t">
                    {columns.map((c) => (
                      <td key={c} className="px-2 py-1 tabular-nums whitespace-nowrap">
                        {measureNames.includes(c)
                          ? formatMeasure(row[c], measureField(c)?.format, measureField(c)?.currency, measureField(c)?.percentScale, displayLocale)
                          : formatDimensionValue(row[c], displayLocale)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PreviewShell>
  );
}
