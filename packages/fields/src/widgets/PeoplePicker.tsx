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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  ScrollArea,
} from '@object-ui/components';
import { Search, Loader2 } from 'lucide-react';
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
 * A single-column dialog: search box → recent contacts → rich candidate rows
 * (avatar + name + department·email) → a live SelectionTray for multi-select.
 * Composed from the reusable {@link useRecordQuery} kernel and
 * {@link SelectionTray}; a future org-tree tier reuses both beside a left tree.
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
}

const DEFAULT_PAGE_SIZE = 25;

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
}: PeoplePickerProps) {
  const { t } = useFieldTranslation();

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

  useEffect(() => {
    if (!open) {
      seededRef.current = false;
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
    if (seedQuery.loading) return;
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

  const handleRowSelect = useCallback(
    (record: any) => {
      const id = getPersonId(record, idField);
      if (!multiple) {
        commit([id], [record]);
        return;
      }
      setSelectedRecords(prev => {
        const key = String(id);
        return prev.some(r => String(getPersonId(r, idField)) === key)
          ? prev.filter(r => String(getPersonId(r, idField)) !== key)
          : [...prev, record];
      });
    },
    [multiple, idField, commit],
  );

  const handleRemove = useCallback(
    (id: any) => {
      const key = String(id);
      setSelectedRecords(prev => prev.filter(r => String(getPersonId(r, idField)) !== key));
    },
    [idField],
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

  const isEmpty =
    !query.loading && resultRecords.length === 0 && recentRecords.length === 0;

  const renderRow = (record: any) => {
    const id = getPersonId(record, idField);
    return (
      <PersonRow
        key={String(id)}
        record={record}
        displayField={displayField}
        subtitleFields={subtitleFields}
        avatarField={avatarField}
        selected={selectedIds.has(String(id))}
        onSelect={handleRowSelect}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title || t('lookup.selectRecord')}</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            autoFocus
            value={query.search}
            onChange={e => query.setSearch(e.target.value)}
            placeholder={t('table.search')}
            className="pl-8"
            data-testid="people-picker-search"
          />
        </div>

        {/* Candidate area */}
        <ScrollArea className="min-h-0 flex-1" data-testid="people-picker-list">
          <div className="flex flex-col gap-0.5 pr-2">
            {query.loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {t('lookup.loading')}
              </div>
            )}

            {!query.loading && recentRecords.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                  {t('lookup.recentlyUsed')}
                </div>
                {recentRecords.map(renderRow)}
                {resultRecords.length > 0 && (
                  <div className="mt-1 px-2 py-1 text-xs font-medium text-muted-foreground">
                    {t('lookup.allResults')}
                  </div>
                )}
              </>
            )}

            {!query.loading && resultRecords.map(renderRow)}

            {isEmpty && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t('lookup.noRecords')}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Multi-select tray + confirm */}
        {multiple && (
          <>
            <SelectionTray
              records={selectedRecords}
              onRemove={handleRemove}
              displayField={displayField}
              avatarField={avatarField}
              idField={idField}
              label={t('table.selected', { count: selectedRecords.length })}
              className={cn('border-t pt-3')}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" onClick={handleConfirm}>
                {t('common.confirm')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
