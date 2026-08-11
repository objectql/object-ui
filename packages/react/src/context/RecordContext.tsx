/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * RecordContext — shared record state for `record:*` namespace renderers
 * inside a `PageSchema` (type='record'). The page host (e.g. RecordDetailView)
 * mounts <RecordContextProvider> once; each `record:details / record:related_list
 * / record:highlights / record:activity / record:chatter / record:path` renderer
 * inside the page consumes data via `useRecordContext()` instead of having to
 * receive props from the schema tree.
 */

import React from 'react';

/**
 * Shared registry of field names currently surfaced by `record:highlights`
 * on the page. Populated by RecordHighlightsRenderer, consumed by
 * RecordDetailsRenderer for highlight↔body dedup.
 *
 * Lives in a separate context so highlight registration doesn't invalidate
 * the main RecordContext consumers.
 */
interface HighlightRegistry {
  getNames: () => ReadonlySet<string>;
  subscribe: (listener: () => void) => () => void;
  register: (instanceId: string, names: string[]) => void;
  unregister: (instanceId: string) => void;
}

const HighlightFieldsContext = React.createContext<HighlightRegistry | null>(null);

export const HighlightFieldsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const registry = React.useMemo<HighlightRegistry>(() => {
    const map = new Map<string, string[]>();
    let names: ReadonlySet<string> = EMPTY_SET;
    const listeners = new Set<() => void>();
    const recompute = () => {
      const next = new Set<string>();
      for (const list of map.values()) for (const n of list) next.add(n);
      // Skip notify if shallow-equal to previous (avoid spurious updates).
      if (next.size === names.size) {
        let same = true;
        for (const n of next) if (!names.has(n)) { same = false; break; }
        if (same) return;
      }
      names = next;
      listeners.forEach((l) => l());
    };
    return {
      getNames: () => names,
      subscribe: (l) => {
        listeners.add(l);
        return () => { listeners.delete(l); };
      },
      register: (id, list) => {
        const prev = map.get(id);
        if (
          prev &&
          prev.length === list.length &&
          prev.every((n, i) => n === list[i])
        ) {
          return;
        }
        map.set(id, [...list]);
        recompute();
      },
      unregister: (id) => {
        if (map.delete(id)) recompute();
      },
    };
  }, []);

  return (
    <HighlightFieldsContext.Provider value={registry}>
      {children}
    </HighlightFieldsContext.Provider>
  );
};

/** Subscribe to the live highlight-field set. Empty when no provider. */
export function useHighlightFieldNames(): ReadonlySet<string> {
  const ctx = React.useContext(HighlightFieldsContext);
  return React.useSyncExternalStore(
    ctx ? ctx.subscribe : NOOP_SUBSCRIBE,
    ctx ? ctx.getNames : GET_EMPTY,
    ctx ? ctx.getNames : GET_EMPTY,
  );
}

/**
 * Register a list of field names as currently surfaced by a
 * `record:highlights` instance. Re-registers when the joined name list
 * changes; unregisters on unmount.
 */
export function useRegisterHighlightFields(instanceId: string, names: string[]): void {
  const ctx = React.useContext(HighlightFieldsContext);
  const key = names.join('|');
  React.useEffect(() => {
    if (!ctx) return;
    ctx.register(instanceId, key.length === 0 ? [] : key.split('|'));
    return () => ctx.unregister(instanceId);
  }, [ctx, instanceId, key]);
}

const NOOP_SUBSCRIBE = (_: () => void) => () => {};
const GET_EMPTY: () => ReadonlySet<string> = () => EMPTY_SET;
const EMPTY_SET: ReadonlySet<string> = new Set<string>();

export interface RecordContextValue<TData = any, TObjectSchema = any> {
  /** Object machine name, e.g. "crm_opportunity". */
  objectName: string;
  /** Primary key value of the record being displayed. */
  recordId: string | number | null | undefined;
  /** Optional datasource id; mirrors the page-level datasource override. */
  dataSource?: string;
  /** Loaded record data (flat record map). Undefined while loading. */
  data?: TData;
  /** Resolved object metadata schema (fields, label, etc.). */
  objectSchema?: TObjectSchema;
  /** Re-fetch the record from the source. */
  refresh?: () => void | Promise<void>;
  /**
   * Optional system-level header actions (Edit / Share / Delete) that the
   * host (e.g. RecordDetailView) wants to inject into the page header
   * regardless of whether the page schema is synthesised or authored.
   *
   * `PageHeaderRenderer` appends these AFTER any authored
   * `page:header.actions`, deduplicating by `name`. Hosts pass `undefined`
   * to opt out entirely (e.g. embedded previews).
   */
  headerSystemActions?: any[];
  /**
   * Controlled favourite state for the record-header star (rendered by
   * `RecordTitleChip` via `PageHeaderRenderer`). When the host provides
   * this, the chip mirrors it instead of managing its own local state.
   */
  isFavorite?: boolean;
  /**
   * Called when the user toggles the record-header favourite star. Hosts
   * persist the change (e.g. through `useFavorites`) and update
   * `isFavorite` accordingly.
   */
  onToggleFavorite?: () => void;
  /**
   * When true, the record is rendered inside a host overlay (drawer,
   * modal, split-pane preview) rather than as a standalone route. Header
   * affordances such as the auto "back to list" button should suppress
   * themselves in this mode because the user already has Close / Expand
   * controls in the overlay chrome.
   */
  embedded?: boolean;
}

const RecordContext = React.createContext<RecordContextValue | null>(null);

export interface RecordContextProviderProps extends RecordContextValue {
  children: React.ReactNode;
}

export const RecordContextProvider: React.FC<RecordContextProviderProps> = ({
  children,
  ...value
}) => {
  // Memoize so consumers that rely on referential equality don't re-render
  // on unrelated parent renders.
  const memo = React.useMemo<RecordContextValue>(() => value, [
    value.objectName,
    value.recordId,
    value.dataSource,
    value.data,
    value.objectSchema,
    value.refresh,
    value.embedded,
    value.headerSystemActions,
    value.isFavorite,
    value.onToggleFavorite,
  ]);
  return <RecordContext.Provider value={memo}>{children}</RecordContext.Provider>;
};

/**
 * Read the current record context. Returns `null` when called outside a
 * <RecordContextProvider> — record:* renderers should treat that as "no
 * record bound" rather than throwing, so they can still render statically
 * inside the Studio designer/palette.
 */
export function useRecordContext<TData = any, TObjectSchema = any>():
  RecordContextValue<TData, TObjectSchema> | null {
  return React.useContext(RecordContext) as RecordContextValue<TData, TObjectSchema> | null;
}
