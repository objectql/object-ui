/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - View Data Provider
 *
 * Resolves @objectstack/spec ViewData discriminated union into
 * a unified data access interface. Supports three data modes:
 *
 * 1. 'object' — Metadata-driven via ObjectStack API (object name → fields/records)
 * 2. 'api' — Custom REST API endpoints (read/write URLs)
 * 3. 'value' — Static data (pre-loaded items array)
 *
 * @module data-scope
 * @packageDocumentation
 */

import {
  collectSavedViews,
  composeElementDataSource,
  elementDataSourceViewNotFoundMessage,
  resolveSavedView,
  type ElementDataSourceConfig,
  type ElementSavedView,
} from './element-data-source.js';

/** ViewData union — matches @objectstack/spec ViewDataSchema */
export type ViewDataConfig =
  | { provider: 'object'; object: string }
  | {
      provider: 'api';
      read: { url: string; method?: string; headers?: Record<string, string> };
      write?: { url: string; method?: string; headers?: Record<string, string> };
    }
  | { provider: 'value'; items: any[] };

/**
 * Re-exported from `./element-data-source.js`, where the binding's type now
 * lives alongside the logic that consumes it. Kept on this module path because
 * that is where it was declared before objectstack#5576.
 */
export type { ElementDataSourceConfig };

/** Fetcher interface — consumers provide the actual fetch implementation */
export interface DataFetcher {
  /** Fetch records for an object */
  fetchRecords(
    object: string,
    options?: {
      filter?: Record<string, any>;
      sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
      limit?: number;
      offset?: number;
      fields?: string[];
    },
  ): Promise<{ records: any[]; total: number }>;

  /** Fetch object metadata (fields, etc.) */
  fetchMetadata?(object: string): Promise<{
    name: string;
    label?: string;
    fields: Array<{
      name: string;
      label?: string;
      type: string;
      required?: boolean;
    }>;
  }>;

  /** Fetch from a custom API URL */
  fetchUrl?(
    url: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
    },
  ): Promise<any>;

  /**
   * Fetch the object's saved views, so an `ElementDataSource.view` name can be
   * resolved to real columns / filter / sort (objectstack#5576).
   *
   * Optional because most fetchers only read records. A fetcher WITHOUT it
   * cannot honour a named view, and {@link ViewDataProvider.resolveElementDataSource}
   * says so in `error` rather than dropping the key — the whole point of #5576
   * is that a `view` the runtime cannot apply must never look applied.
   *
   * Either shape stored views come in is accepted: a map keyed by view id, or
   * the array of overlay rows an adapter's `listViews()` returns.
   */
  fetchViews?(
    object: string,
  ): Promise<Record<string, ElementSavedView> | ElementSavedView[]>;
}

/** Resolved data result */
export interface ResolvedData {
  /** Data records */
  records: any[];
  /** Total record count (for pagination) */
  total: number;
  /** Object metadata (if available) */
  metadata?: {
    name: string;
    label?: string;
    fields: Array<{
      name: string;
      label?: string;
      type: string;
      required?: boolean;
    }>;
  };
  /** Provider type */
  provider: 'object' | 'api' | 'value';
  /** Loading state */
  loading: boolean;
  /** Error */
  error?: string;
}

/** Extract records array from various common API response shapes */
function extractRecords(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * Resolves ViewData configuration into actual data via a pluggable fetcher.
 *
 * @example
 * ```ts
 * const provider = new ViewDataProvider(myFetcher);
 * const data = await provider.resolve({ provider: 'object', object: 'Account' });
 * ```
 */
export class ViewDataProvider {
  private fetcher: DataFetcher | null = null;

  constructor(fetcher?: DataFetcher) {
    this.fetcher = fetcher ?? null;
  }

  /** Set the data fetcher implementation */
  setFetcher(fetcher: DataFetcher): void {
    this.fetcher = fetcher;
  }

  /** Resolve ViewData config into actual data */
  async resolve(
    config: ViewDataConfig,
    options?: {
      filter?: Record<string, any>;
      sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
      limit?: number;
      offset?: number;
      fields?: string[];
    },
  ): Promise<ResolvedData> {
    switch (config.provider) {
      case 'value':
        return this.resolveValue(config);
      case 'api':
        return this.resolveApi(config);
      case 'object':
        return this.resolveObject(config, options);
      default:
        return {
          records: [],
          total: 0,
          provider: 'value' as const,
          loading: false,
          error: `Unknown data provider: ${(config as any).provider}`,
        };
    }
  }

  /** Resolve static value data */
  private resolveValue(config: {
    provider: 'value';
    items: any[];
  }): ResolvedData {
    const items = Array.isArray(config.items) ? config.items : [];
    return {
      records: items,
      total: items.length,
      provider: 'value',
      loading: false,
    };
  }

  /** Resolve API-based data */
  private async resolveApi(config: {
    provider: 'api';
    read: { url: string; method?: string; headers?: Record<string, string> };
  }): Promise<ResolvedData> {
    if (!this.fetcher?.fetchUrl) {
      return {
        records: [],
        total: 0,
        provider: 'api',
        loading: false,
        error: 'No fetchUrl implementation available for API data provider',
      };
    }

    try {
      const data = await this.fetcher.fetchUrl(config.read.url, {
        method: config.read.method,
        headers: config.read.headers,
      });

      // Handle common response shapes
      const records = extractRecords(data);
      const total = data?.total ?? data?.count ?? records.length;

      return {
        records,
        total,
        provider: 'api',
        loading: false,
      };
    } catch (error) {
      return {
        records: [],
        total: 0,
        provider: 'api',
        loading: false,
        error: (error as Error).message,
      };
    }
  }

  /** Resolve object-based data (metadata-driven) */
  private async resolveObject(
    config: { provider: 'object'; object: string },
    options?: {
      filter?: Record<string, any>;
      sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
      limit?: number;
      offset?: number;
      fields?: string[];
    },
  ): Promise<ResolvedData> {
    if (!this.fetcher) {
      return {
        records: [],
        total: 0,
        provider: 'object',
        loading: false,
        error: 'No data fetcher configured for object data provider',
      };
    }

    try {
      // Fetch metadata if available
      let metadata: ResolvedData['metadata'];
      if (this.fetcher.fetchMetadata) {
        metadata = await this.fetcher.fetchMetadata(config.object);
      }

      // Fetch records
      const result = await this.fetcher.fetchRecords(config.object, options);

      return {
        records: result.records,
        total: result.total,
        metadata,
        provider: 'object',
        loading: false,
      };
    } catch (error) {
      return {
        records: [],
        total: 0,
        provider: 'object',
        loading: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Resolve an element-level data source (`PageComponentSchema.dataSource`).
   *
   * `view` is HONOURED here, not dropped. Until objectstack#5576 this method
   * forwarded `filter`/`sort`/`limit` and silently discarded `view`, so a page
   * component that named a saved view got every record the object had — the
   * declared binding was inert while looking applied.
   *
   * Three outcomes, all explicit:
   *  - no `view` → unchanged behaviour, the binding's own keys are forwarded;
   *  - `view` resolved → its columns become the `fields` projection and its
   *    filter/sort/limit the baseline the binding's keys compose with (see
   *    {@link composeElementDataSource} for the per-key rule);
   *  - `view` unresolvable, or the fetcher cannot list views at all → an
   *    `error` naming the view and what the object does have. NOT an empty
   *    result, and NOT a silent fall back to the unfiltered object.
   */
  async resolveElementDataSource(
    config: ElementDataSourceConfig,
  ): Promise<ResolvedData> {
    let view: ElementSavedView | undefined;

    if (config.view) {
      if (!this.fetcher?.fetchViews) {
        return {
          records: [],
          total: 0,
          provider: 'object',
          loading: false,
          error:
            `dataSource.view "${config.view}" cannot be resolved: this data ` +
            `fetcher does not implement fetchViews().`,
        };
      }
      let views: Record<string, ElementSavedView>;
      try {
        views = collectSavedViews(await this.fetcher.fetchViews(config.object));
      } catch (error) {
        return {
          records: [],
          total: 0,
          provider: 'object',
          loading: false,
          error: (error as Error).message,
        };
      }
      view = resolveSavedView(views, config.view, config.object);
      if (!view) {
        return {
          records: [],
          total: 0,
          provider: 'object',
          loading: false,
          error: elementDataSourceViewNotFoundMessage(
            config.object,
            config.view,
            Object.keys(views),
          ),
        };
      }
    }

    const composed = composeElementDataSource(config, view);
    const fields = Array.isArray(composed.columns)
      ? composed.columns.filter((c): c is string => typeof c === 'string' && !!c)
      : undefined;

    return this.resolve(
      { provider: 'object', object: composed.object },
      {
        // `DataFetcher.fetchRecords`'s `filter` is declared
        // `Record<string, any>`, which predates the three filter shapes that
        // legitimately circulate here: a MongoDB-style condition object, an
        // ObjectQL AST node array, and a spec `ViewFilterRule[]`. The last two
        // are arrays, so a saved view's filter does not fit the declared option
        // — the cast is that gap, not a coercion. Widening the declared option
        // is a separate change with its own consumers.
        filter: composed.filter as Record<string, any> | undefined,
        sort: composed.sort as Array<{ field: string; order: 'asc' | 'desc' }> | undefined,
        limit: composed.limit,
        ...(fields && fields.length > 0 ? { fields } : {}),
      },
    );
  }

}
