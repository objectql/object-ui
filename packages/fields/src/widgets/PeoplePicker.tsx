/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  useIsMobile,
} from '@object-ui/components';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import type { DataSource, LookupFilterDef } from '@object-ui/types';
import { useRecordQuery } from './useRecordQuery';
import { lookupFiltersToRecord } from './RecordPickerDialog';
import { getPersonId } from './personDisplay';
import { PersonRow } from './PersonRow';
import { SelectionTray } from './SelectionTray';
import { getRecentLookupIds, pushRecentLookupId } from './recentLookups';
import { useFieldTranslation } from './useFieldTranslation';

/**
 * PeoplePicker — the Tier 0, search-first user picker (issue #2112).
 *
 * A single-column picker: search box → recent contacts → rich candidate rows
 * (avatar + name + department·email) → a live SelectionTray for multi-select.
 * Composed from the reusable {@link useRecordQuery} kernel and
 * {@link SelectionTray}; a future org-tree tier reuses both beside a left tree.
 *
 * Container is responsive: a centered Dialog on desktop, a bottom Sheet on
 * mobile (<768px). Interaction: full keyboard model (↑/↓ move the cursor, ↵
 * toggles/commits, Backspace on an empty search removes the last chip, Esc
 * closes), matched-term highlighting in rows, skeletons on first load with no
 * flash-to-empty on refetch, and friendly empty / error+retry states.
 *
 * Candidate hygiene (e.g. `banned != true`), the department `$expand`, and the
 * avatar/subtitle field config are supplied by the caller (UserField). Pinyin /
 * employee-id search is server-side and transparent — the client only sends the
 * term.
 */
export interface PeoplePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  multiple?: boolean;

  dataSource: DataSource;
  /** Object to query — `sys_user` for user fields. */
  objectName: string;

  displayField?: string;
  idField?: string;
  /** Dotted field paths for the row subtitle, e.g. `['primary_business_unit_id.name','email']`. */
  subtitleFields?: string[];
  avatarField?: string;
  /** Related entities to expand (e.g. `['primary_business_unit_id']` for the department name). */
  expand?: string[];
  /** Narrow the server searchable set (ADR-0061). */
  searchFields?: string[];
  pageSize?: number;
  /** Base candidate filters (e.g. exclude banned users). */
  lookupFilters?: LookupFilterDef[];

  /** Current selection (id, or id[] when `multiple`). */
  value?: any;
  onSelect: (value: any) => void;
  onSelectRecords?: (records: any[]) => void;

  /**
   * Render as an inline combobox anchored to {@link trigger} — a Popover
   * dropdown on desktop, a bottom Sheet on mobile — instead of a centered
   * modal Dialog. In inline mode multi-select commits live on each toggle
   * (the caller's field chips are the selection), so there's no staging tray
   * or confirm button.
   */
  inline?: boolean;
  /** The element the inline dropdown/sheet anchors to (the field trigger). */
  trigger?: React.ReactNode;
}

const DEFAULT_PAGE_SIZE = 25;
const SKELETON_ROWS = 6;

export function PeoplePicker({
  open,
  onOpenChange,
  title,
  multiple = false,
  dataSource,
  objectName,
  displayField = 'name',
  idField = 'id',
  subtitleFields,
  avatarField = 'image',
  expand,
  searchFields,
  pageSize = DEFAULT_PAGE_SIZE,
  lookupFilters,
  value,
  onSelect,
  onSelectRecords,
  inline = false,
  trigger,
}: PeoplePickerProps) {
  const { t } = useFieldTranslation();
  const isMobile = useIsMobile();

  const baseFilter = useMemo<Record<string, any> | undefined>(
    () => (lookupFilters?.length ? lookupFiltersToRecord(lookupFilters) : undefined),
    [lookupFilters],
  );

  // Auto-expand relation subtitles (e.g. `primary_business_unit_id.name` needs
  // `$expand: ['primary_business_unit_id']`) unless the caller passed `expand`.
  const effectiveExpand = useMemo<string[] | undefined>(() => {
    if (expand && expand.length) return expand;
    const rels = new Set<string>();
    (subtitleFields ?? []).forEach(f => {
      if (f.includes('.')) rels.add(f.split('.')[0]);
    });
    return rels.size ? Array.from(rels) : undefined;
  }, [expand, subtitleFields]);

  // Main candidate query (search + candidate hygiene).
  const query = useRecordQuery({
    dataSource,
    objectName,
    enabled: open,
    pageSize,
    filter: baseFilter,
    expand: effectiveExpand,
    searchFields,
  });

  // Recent ids captured once per open.
  const recentIds = useMemo(
    () => (open ? getRecentLookupIds(objectName) : []),
    [open, objectName],
  );

  // The current value's ids, for hydrating the SelectionTray on edit.
  const valueIds = useMemo<any[]>(() => {
    if (multiple) return Array.isArray(value) ? value : [];
    return value != null && value !== '' ? [value] : [];
  }, [multiple, value]);

  // One extra query resolves both recents and the current selection to records.
  const seedIds = useMemo(
    () => Array.from(new Set([...valueIds, ...recentIds].map(v => v))),
    [valueIds, recentIds],
  );
  const seedQuery = useRecordQuery({
    dataSource,
    objectName,
    enabled: open && seedIds.length > 0,
    pageSize: Math.max(1, seedIds.length),
    filter: { [idField]: { $in: seedIds } },
    expand: effectiveExpand,
  });

  const recordsById = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of seedQuery.records) m.set(String(getPersonId(r, idField)), r);
    return m;
  }, [seedQuery.records, idField]);

  // --- selection state (full records so the tray can show avatar + name) ---
  const [selectedRecords, setSelectedRecords] = useState<any[]>([]);
  const seededRef = useRef(false);
  // On open, seedQuery.loading is still false for one render (its fetch is
  // kicked off in an effect that runs after this one), so an eager seed would
  // read an empty recordsById, seed nothing, and lock — wiping an existing
  // selection on confirm. Only seed after we've observed the fetch start.
  const sawSeedLoadingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      seededRef.current = false;
      sawSeedLoadingRef.current = false;
      setSelectedRecords([]);
    }
  }, [open]);

  // Seed the tray from the current value once its records resolve (once per open).
  useEffect(() => {
    if (!open || seededRef.current) return;
    if (valueIds.length === 0) {
      seededRef.current = true;
      return;
    }
    if (seedQuery.loading) {
      sawSeedLoadingRef.current = true;
      return;
    }
    // The seed fetch hasn't started yet this open — wait for it before locking.
    if (!sawSeedLoadingRef.current) return;
    const seeded = valueIds.map(id => recordsById.get(String(id))).filter(Boolean);
    setSelectedRecords(seeded);
    seededRef.current = true;
  }, [open, valueIds, seedQuery.loading, recordsById]);

  const selectedIds = useMemo(
    () => new Set(selectedRecords.map(r => String(getPersonId(r, idField)))),
    [selectedRecords, idField],
  );

  const commit = useCallback(
    (ids: any[], records: any[]) => {
      onSelect(multiple ? ids : (ids[0] ?? null));
      onSelectRecords?.(records);
      ids.forEach(id => pushRecentLookupId(objectName, id));
      onOpenChange(false);
    },
    [multiple, objectName, onSelect, onSelectRecords, onOpenChange],
  );

  // Inline mode has no confirm step — push the value out on every change.
  const commitLive = useCallback(
    (records: any[]) => {
      onSelect(records.map(r => getPersonId(r, idField)));
      onSelectRecords?.(records);
    },
    [onSelect, onSelectRecords, idField],
  );

  const handleRowSelect = useCallback(
    (record: any) => {
      const id = getPersonId(record, idField);
      if (!multiple) {
        commit([id], [record]);
        return;
      }
      const key = String(id);
      const exists = selectedRecords.some(r => String(getPersonId(r, idField)) === key);
      const next = exists
        ? selectedRecords.filter(r => String(getPersonId(r, idField)) !== key)
        : [...selectedRecords, record];
      setSelectedRecords(next);
      // Inline: commit live (chips live in the field), stay open for more.
      // Modal: stage in the tray until Confirm.
      if (inline) {
        if (!exists) pushRecentLookupId(objectName, id);
        commitLive(next);
      }
    },
    [multiple, idField, commit, selectedRecords, inline, objectName, commitLive],
  );

  const handleRemove = useCallback(
    (id: any) => {
      const key = String(id);
      const next = selectedRecords.filter(r => String(getPersonId(r, idField)) !== key);
      setSelectedRecords(next);
      if (inline) commitLive(next);
    },
    [idField, selectedRecords, inline, commitLive],
  );

  const handleConfirm = useCallback(() => {
    commit(selectedRecords.map(r => getPersonId(r, idField)), selectedRecords);
  }, [commit, selectedRecords, idField]);

  const hasSearch = query.search.trim().length > 0;

  // Recent contacts (only when not searching), in MRU order.
  const recentRecords = useMemo(() => {
    if (hasSearch) return [];
    return recentIds.map(id => recordsById.get(String(id))).filter(Boolean);
  }, [hasSearch, recentIds, recordsById]);

  // Candidate list; drop recents when idle to avoid showing them twice.
  const resultRecords = useMemo(() => {
    if (hasSearch) return query.records;
    const recentSet = new Set(recentIds.map(String));
    return query.records.filter(r => !recentSet.has(String(getPersonId(r, idField))));
  }, [hasSearch, query.records, recentIds, idField]);

  // Flat, in-display-order list the keyboard cursor walks.
  const navList = useMemo(
    () => [...recentRecords, ...resultRecords],
    [recentRecords, resultRecords],
  );

  // --- keyboard cursor ---
  const [activeIndex, setActiveIndex] = useState(-1);
  // Reset the cursor when the query changes (results replaced).
  useEffect(() => {
    setActiveIndex(-1);
  }, [query.search, query.records]);
  // Keep it in range if the list shrinks.
  useEffect(() => {
    setActiveIndex(i => (i >= navList.length ? navList.length - 1 : i));
  }, [navList.length]);

  const onSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(i => (navList.length ? Math.min(navList.length - 1, i + 1) : -1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(i => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < navList.length) {
          e.preventDefault();
          handleRowSelect(navList[activeIndex]);
        }
      } else if (
        e.key === 'Backspace' &&
        query.search.length === 0 &&
        multiple &&
        selectedRecords.length > 0
      ) {
        handleRemove(getPersonId(selectedRecords[selectedRecords.length - 1], idField));
      }
    },
    [navList, activeIndex, handleRowSelect, query.search, multiple, selectedRecords, handleRemove, idField],
  );

  const initialLoading =
    query.loading && !query.error && query.records.length === 0 && recentRecords.length === 0;
  const refetching = query.loading && !initialLoading;
  const isEmpty =
    !query.loading &&
    !query.error &&
    resultRecords.length === 0 &&
    recentRecords.length === 0;

  const renderRow = (record: any, index: number) => {
    const id = getPersonId(record, idField);
    return (
      <PersonRow
        key={String(id)}
        record={record}
        displayField={displayField}
        subtitleFields={subtitleFields}
        avatarField={avatarField}
        selected={selectedIds.has(String(id))}
        active={index === activeIndex}
        highlightQuery={query.search}
        onSelect={handleRowSelect}
      />
    );
  };

  const titleText = title || t('lookup.selectRecord');

  // Container-agnostic body — rendered inside a Dialog (desktop) or Sheet (mobile).
  const body = (
    <>
      {/* Search */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          autoFocus={!isMobile}
          value={query.search}
          onChange={e => query.setSearch(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder={t('table.search')}
          className="px-8"
          role="combobox"
          aria-expanded
          aria-controls="people-picker-list"
          data-testid="people-picker-search"
        />
        {query.loading && (
          <Loader2
            className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
      </div>

      {/* Candidate area */}
      <ScrollArea className="min-h-0 flex-1" data-testid="people-picker-list">
        <div
          id="people-picker-list"
          role="listbox"
          aria-busy={query.loading}
          className={cn('flex flex-col gap-0.5 pr-2 transition-opacity', refetching && 'opacity-70')}
        >
          {query.error ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <AlertCircle className="size-5 text-destructive" aria-hidden />
              <span className="max-w-xs">{query.error}</span>
              <Button type="button" variant="outline" size="sm" onClick={query.refetch}>
                {t('lookup.retry')}
              </Button>
            </div>
          ) : initialLoading ? (
            Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-1.5">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))
          ) : (
            <>
              {recentRecords.length > 0 && (
                <>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {t('lookup.recentlyUsed')}
                  </div>
                  {recentRecords.map((r, i) => renderRow(r, i))}
                  {resultRecords.length > 0 && (
                    <div className="mt-1 flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground">
                      <span>{t('lookup.allResults')}</span>
                      <span className="font-normal opacity-70">· {query.total}</span>
                    </div>
                  )}
                </>
              )}

              {resultRecords.map((r, i) => renderRow(r, recentRecords.length + i))}

              {isEmpty && (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t('lookup.noRecords')}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Multi-select tray + confirm — modal only; inline commits live and
          shows the selection as chips in the caller's field. */}
      {multiple && !inline && (
        <>
          <SelectionTray
            records={selectedRecords}
            onRemove={handleRemove}
            onClear={() => setSelectedRecords([])}
            clearLabel={t('lookup.clear')}
            displayField={displayField}
            avatarField={avatarField}
            idField={idField}
            label={t('table.selected', { count: selectedRecords.length })}
            className={cn('border-t pt-3')}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={handleConfirm}>
              {t('common.confirm')}
            </Button>
          </div>
        </>
      )}
    </>
  );

  // Inline combobox: anchored Popover on desktop, bottom Sheet (opened from the
  // same trigger) on mobile. The trigger is the caller's field control.
  if (inline) {
    if (isMobile) {
      return (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent
            side="bottom"
            className="flex h-[85vh] flex-col gap-3"
            data-testid="people-picker-sheet"
          >
            <SheetHeader className="text-left">
              <SheetTitle>{titleText}</SheetTitle>
            </SheetHeader>
            {body}
          </SheetContent>
        </Sheet>
      );
    }
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="start"
          className="flex max-h-[min(28rem,60vh)] w-[var(--radix-popover-trigger-width)] min-w-72 flex-col gap-3 p-3"
          data-testid="people-picker-inline"
        >
          {body}
        </PopoverContent>
      </Popover>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex h-[85vh] flex-col gap-3"
          data-testid="people-picker-sheet"
        >
          <SheetHeader className="text-left">
            <SheetTitle>{titleText}</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[80vh] flex-col gap-3 sm:max-w-lg"
        data-testid="people-picker-dialog"
      >
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
