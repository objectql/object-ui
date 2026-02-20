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

/** ViewData union — matches @objectstack/spec ViewDataSchema */
export type ViewDataConfig =
  | { provider: 'object'; object: string }
  | {
      provider: 'api';
      read: { url: string; method?: string; headers?: Record<string, string> };
      write?: { url: string; method?: string; headers?: Record<string, string> };
    }
  | { provider: 'value'; items: any[] };

/** Element-level data source — matches @objectstack/spec ElementDataSourceSchema */
export interface ElementDataSourceConfig {
  object: string;
  view?: string;
  filter?: Record<string, any>;
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
  limit?: number;
}

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
      const records = Array.isArray(data)
        ? data
        : Array.isArray(data?.records)
          ? data.records
          : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.items)
              ? data.items
              : [];
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

  /** Resolve element-level data source */
  async resolveElementDataSource(
    config: ElementDataSourceConfig,
  ): Promise<ResolvedData> {
    return this.resolve(
      { provider: 'object', object: config.object },
      {
        filter: config.filter,
        sort: config.sort,
        limit: config.limit,
      },
    );
  }

}
