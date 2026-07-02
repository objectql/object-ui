/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DataSource, QueryParams } from '@object-ui/types';

/**
 * useRecordQuery — the shared record-query kernel behind record pickers.
 *
 * Encapsulates the query/pagination/search/sort loop that was previously
 * duplicated (and independently tuned) inside `RecordPickerDialog.fetchRecords`
 * and `LookupField.fetchLookupData`:
 *
 * - builds the `QueryParams` (`$top`/`$skip`/`$search`/`$searchFields`/
 *   `$orderby`/`$filter`/`$expand`),
 * - issues `dataSource.find(objectName, params)` and normalises the result
 *   (`{ data, total }`, tolerating a bare array),
 * - owns `records`/`loading`/`error`/`total` plus the `page`/`search`/`sort`
 *   controls, with a debounced search path,
 * - clears itself when `enabled` goes false (e.g. a dialog closing).
 *
 * The caller keeps ownership of *selection* state and of record→option mapping;
 * this hook only answers "what records match the current query". It is the
 * reusable core the search-first PeoplePicker (and a future org-tree tier)
 * compose on top of.
 *
 * Effect shape intentionally mirrors the original components to preserve
 * behaviour: the fetch effect keys on page/sort/filter/expand (NOT `search`,
 * which drives its own debounced fetch), and state resets live in a separate
 * `enabled`-keyed effect so they never cascade into a fetch (React #185).
 */
export interface UseRecordQueryOptions {
  /** Backing data source. When absent/invalid the hook stays idle. */
  dataSource?: DataSource | null;
  /** Object/resource name to query (e.g. `sys_user`). */
  objectName?: string | null;
  /**
   * Gate fetching. When false no request is issued and query state is cleared.
   * Typically wired to a dialog's `open`, plus any "dependencies satisfied"
   * guard. Default `true`.
   */
  enabled?: boolean;
  /** `$top` — page size. Default 50. */
  pageSize?: number;
  /**
   * When true, use page-based pagination (`$skip = (page - 1) * pageSize`).
   * When false (default) a single page of `pageSize` records is fetched.
   */
  paginate?: boolean;
  /**
   * `$filter` — already merged by the caller (base `lookup_filters`, dependent
   * lookup chain, candidate hygiene like `banned != true`, …). Compared by
   * value, so a referentially-new-but-equal object each render will not loop.
   */
  filter?: Record<string, any>;
  /** `$expand` — related entities to include (e.g. `['primary_business_unit_id']`). */
  expand?: string[];
  /** `$searchFields` — narrow the server searchable set (ADR-0061). */
  searchFields?: string[];
  /** Debounce applied to {@link UseRecordQueryResult.setSearch}, in ms. Default 300. */
  debounceMs?: number;
}

export interface RecordQuerySort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface UseRecordQueryResult {
  /** Records returned by the current query. */
  records: any[];
  loading: boolean;
  error: string | null;
  /** Total matching records (server-reported, else the current page length). */
  total: number;
  /** `ceil(total / pageSize)`, at least 1. */
  totalPages: number;
  page: number;
  search: string;
  sort: RecordQuerySort | null;
  /** Jump to a page (1-indexed). No-op unless `paginate` is set. */
  setPage: (page: number) => void;
  /** Set the search term; debounced, and resets to page 1. */
  setSearch: (query: string) => void;
  /** Toggle sort on a field (new field → asc, same field → flip); resets to page 1. */
  toggleSort: (field: string) => void;
  /** Set the sort directly (or clear with `null`); resets to page 1. */
  setSort: (sort: RecordQuerySort | null) => void;
  /** Clear query state (search/page/sort/records/error). */
  reset: () => void;
  /** Imperatively refetch with the current params. */
  refetch: () => void;
}

export function useRecordQuery(options: UseRecordQueryOptions): UseRecordQueryResult {
  const {
    dataSource,
    objectName,
    enabled = true,
    pageSize = 50,
    paginate = false,
    filter,
    expand,
    searchFields,
    debounceMs = 300,
  } = options;

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(1);
  const [search, setSearchState] = useState('');
  const [sort, setSortState] = useState<RecordQuerySort | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable signatures for object/array inputs so the fetch effect keys on their
  // *value*, not a fresh reference every render.
  const filterSignature = useMemo(
    () => (filter && Object.keys(filter).length ? JSON.stringify(filter) : ''),
    [filter],
  );
  const expandSignature = useMemo(() => (expand?.length ? expand.join(',') : ''), [expand]);
  const searchFieldsSignature = useMemo(
    () => (searchFields?.length ? searchFields.join(',') : ''),
    [searchFields],
  );

  const canQuery =
    !!enabled && !!dataSource && typeof dataSource.find === 'function' && !!objectName;

  // Core fetch. Takes the controlled inputs as arguments so the debounced
  // search path and the effect path share one implementation.
  const runQuery = useCallback(
    async (searchTerm: string, pageArg: number, sortArg: RecordQuerySort | null) => {
      if (!canQuery || !dataSource || !objectName) return;

      setLoading(true);
      setError(null);

      try {
        const params: QueryParams = { $top: pageSize };
        if (paginate) params.$skip = (pageArg - 1) * pageSize;
        if (searchTerm && searchTerm.trim()) params.$search = searchTerm.trim();
        if (searchFields && searchFields.length > 0) params.$searchFields = searchFields;
        if (sortArg) params.$orderby = { [sortArg.field]: sortArg.direction };
        if (filter && Object.keys(filter).length > 0) params.$filter = filter;
        if (expand && expand.length > 0) params.$expand = expand;

        const result = await dataSource.find(objectName, params);
        const data: any[] = result?.data ?? (result as any) ?? [];

        setRecords(data);
        setTotal(result?.total ?? data.length);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setRecords([]);
      } finally {
        setLoading(false);
      }
    },
    // filter/expand/searchFields are referenced via their signatures below so
    // this callback stays stable across referentially-new-but-equal props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canQuery, dataSource, objectName, pageSize, paginate, filterSignature, expandSignature, searchFieldsSignature],
  );

  // Fetch on enable and whenever page/sort/filter/expand change. `search` is
  // intentionally excluded — it has its own debounced path in `setSearch`.
  useEffect(() => {
    if (canQuery) {
      runQuery(search, page, sort);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canQuery, page, sort, runQuery]);

  // Reset query state when disabled — separate from the fetch effect so resets
  // don't re-trigger a fetch (React #185).
  useEffect(() => {
    if (!enabled) {
      setRecords([]);
      setError(null);
      setSearchState('');
      setPageState(1);
      setSortState(null);
    }
  }, [enabled]);

  // Clean up the debounce timer on unmount.
  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );

  const setSearch = useCallback(
    (query: string) => {
      setSearchState(query);
      setPageState(1);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        runQuery(query, 1, sort);
      }, debounceMs);
    },
    [runQuery, sort, debounceMs],
  );

  const setPage = useCallback((next: number) => {
    setPageState(next);
  }, []);

  const toggleSort = useCallback((field: string) => {
    setSortState(prev =>
      prev && prev.field === field
        ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' },
    );
    setPageState(1);
  }, []);

  const setSort = useCallback((next: RecordQuerySort | null) => {
    setSortState(next);
    setPageState(1);
  }, []);

  const reset = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setRecords([]);
    setError(null);
    setSearchState('');
    setPageState(1);
    setSortState(null);
  }, []);

  const refetch = useCallback(() => {
    runQuery(search, page, sort);
  }, [runQuery, search, page, sort]);

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  return {
    records,
    loading,
    error,
    total,
    totalPages,
    page,
    search,
    sort,
    setPage,
    setSearch,
    toggleSort,
    setSort,
    reset,
    refetch,
  };
}
