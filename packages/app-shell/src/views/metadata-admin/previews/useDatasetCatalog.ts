// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * useDatasetCatalog — loads the analytics dataset catalog for the Report
 * inspector's dataset binding controls (ADR-0021 single-form).
 *
 * A 9.0 report binds a semantic-layer `dataset` and selects its `values`
 * (measure names) grouped by `rows` (dimension names) — so the editor needs
 * (a) the list of datasets to bind, and (b) the bound dataset's
 * dimensions/measures to offer as picker options.
 *
 * Mirrors {@link useObjectFields}: defensive (a 404 or transport error
 * resolves to an empty catalog with `error` set, the inspector falls back to
 * manual entry) and override-friendly (hosts that already hold the catalog
 * pass it to keep the inspector network-free, e.g. tests and the runtime
 * config panel).
 */

import * as React from 'react';
import { useMetadataClient } from '../useMetadata';

export interface DatasetDimensionInfo {
  /** Dimension name (snake_case, referenced by `report.rows`). */
  name: string;
  /** Raw field type id when declared (e.g. 'text', 'date'). */
  type?: string;
}

export interface DatasetMeasureInfo {
  /** Measure name (snake_case, referenced by `report.values`). */
  name: string;
  /** Aggregate function (sum / avg / count / …) — display hint only. */
  aggregate?: string;
}

export interface DatasetCatalogEntry {
  /** Dataset unique name (what `report.dataset` stores). */
  name: string;
  /** Human label (falls back to the name). */
  label: string;
  dimensions: DatasetDimensionInfo[];
  measures: DatasetMeasureInfo[];
}

export interface UseDatasetCatalogResult {
  datasets: DatasetCatalogEntry[];
  loading: boolean;
  error: string | null;
}

function resolveLabel(label: unknown, fallback: string): string {
  if (typeof label === 'string' && label) return label;
  if (label && typeof label === 'object') {
    const def = (label as { default?: unknown }).default;
    if (typeof def === 'string' && def) return def;
  }
  return fallback;
}

/** Normalize a raw dataset document into a catalog entry. */
export function toCatalogEntry(doc: Record<string, unknown>): DatasetCatalogEntry | null {
  const name = typeof doc.name === 'string' ? doc.name : '';
  if (!name) return null;
  const dimensions: DatasetDimensionInfo[] = Array.isArray(doc.dimensions)
    ? (doc.dimensions as Array<Record<string, unknown>>)
        .filter((d) => d && typeof d.name === 'string' && d.name)
        .map((d) => ({
          name: d.name as string,
          type: typeof d.type === 'string' ? (d.type as string) : undefined,
        }))
    : [];
  const measures: DatasetMeasureInfo[] = Array.isArray(doc.measures)
    ? (doc.measures as Array<Record<string, unknown>>)
        .filter((m) => m && typeof m.name === 'string' && m.name)
        .map((m) => ({
          name: m.name as string,
          aggregate: typeof m.aggregate === 'string' ? (m.aggregate as string) : undefined,
        }))
    : [];
  return { name, label: resolveLabel(doc.label, name), dimensions, measures };
}

export function useDatasetCatalog(
  /**
   * Pre-resolved catalog. When supplied the hook skips the network fetch
   * entirely and returns this list verbatim.
   */
  override?: DatasetCatalogEntry[],
): UseDatasetCatalogResult {
  const client = useMetadataClient();
  const [state, setState] = React.useState<UseDatasetCatalogResult>({
    datasets: override ?? [],
    loading: !override,
    error: null,
  });

  React.useEffect(() => {
    if (override) {
      setState({ datasets: override, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    client
      .list<Record<string, unknown>>('dataset')
      .then((docs) => {
        if (cancelled) return;
        const datasets = (Array.isArray(docs) ? docs : [])
          .map(toCatalogEntry)
          .filter((e): e is DatasetCatalogEntry => e !== null);
        setState({ datasets, loading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ datasets: [], loading: false, error: err?.message ?? String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [client, override]);

  return state;
}

export interface UseDatasetSemanticsResult {
  dimensions: DatasetDimensionInfo[];
  measures: DatasetMeasureInfo[];
  loading: boolean;
  error: string | null;
}

/**
 * Resolve the bound dataset's dimensions/measures from the catalog, lazily
 * hydrating via `client.get('dataset', name)` when the list endpoint returned
 * a summary without them (some servers list names only).
 */
export function useDatasetSemantics(
  name: string | undefined,
  catalog: UseDatasetCatalogResult,
): UseDatasetSemanticsResult {
  const client = useMetadataClient();
  const entry = name ? catalog.datasets.find((d) => d.name === name) : undefined;
  const needsFetch =
    !!name && !catalog.loading &&
    (!entry || (entry.dimensions.length === 0 && entry.measures.length === 0));

  const [fetched, setFetched] = React.useState<{
    name: string;
    entry: DatasetCatalogEntry | null;
    error: string | null;
  } | null>(null);

  React.useEffect(() => {
    if (!needsFetch || !name) return;
    if (fetched?.name === name) return;
    let cancelled = false;
    client
      .get<Record<string, unknown>>('dataset', name)
      .then((doc) => {
        if (cancelled) return;
        setFetched({ name, entry: doc ? toCatalogEntry(doc) : null, error: doc ? null : 'Dataset not found' });
      })
      .catch((err) => {
        if (cancelled) return;
        setFetched({ name, entry: null, error: err?.message ?? String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [client, name, needsFetch, fetched]);

  const resolved = needsFetch && fetched?.name === name ? fetched.entry : entry;
  return {
    dimensions: resolved?.dimensions ?? [],
    measures: resolved?.measures ?? [],
    loading: catalog.loading || (needsFetch && fetched?.name !== name),
    error: (needsFetch && fetched?.name === name ? fetched.error : null) ?? catalog.error,
  };
}
