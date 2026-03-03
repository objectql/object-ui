/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
} from '@object-ui/components';
import { SchemaRenderer } from '@object-ui/react';
import {
  Plus,
  ExternalLink,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import type { DataSource } from '@object-ui/types';
import { useDetailTranslation } from './useDetailTranslation';

export interface RelatedListProps {
  title: string;
  type: 'list' | 'grid' | 'table';
  api?: string;
  data?: any[];
  schema?: any;
  columns?: any[];
  className?: string;
  dataSource?: DataSource;
  /** Callback when "New" button is clicked */
  onNew?: () => void;
  /** Callback when "View All" button is clicked */
  onViewAll?: () => void;
  /** Callback when a row Edit action is clicked */
  onRowEdit?: (row: any) => void;
  /** Callback when a row Delete action is clicked */
  onRowDelete?: (row: any) => void;
  /** Page size for pagination (enables pagination when set) */
  pageSize?: number;
  /** Enable column sorting */
  sortable?: boolean;
  /** Enable text filtering */
  filterable?: boolean;
}

export const RelatedList: React.FC<RelatedListProps> = ({
  title,
  type,
  api,
  data = [],
  schema,
  columns,
  className,
  dataSource,
  onNew,
  onViewAll,
  onRowEdit,
  onRowDelete,
  pageSize,
  sortable = false,
  filterable = false,
}) => {
  const [relatedData, setRelatedData] = React.useState(data);
  const [loading, setLoading] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(0);
  const [sortField, setSortField] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [filterText, setFilterText] = React.useState('');
  const [objectSchema, setObjectSchema] = React.useState<any>(null);
  const { t } = useDetailTranslation();

  // Sync internal state when data prop changes (e.g., parent fetches async data)
  React.useEffect(() => {
    setRelatedData(data);
  }, [data]);

  // Auto-fetch object schema when api/dataSource available but columns missing
  React.useEffect(() => {
    if (api && dataSource?.getObjectSchema && !columns?.length) {
      dataSource.getObjectSchema(api).then(setObjectSchema).catch((err: unknown) => {
        console.warn(`[RelatedList] Failed to fetch schema for ${api}:`, err);
      });
    }
  }, [api, dataSource, columns]);

  React.useEffect(() => {
    if (api && !data.length) {
      setLoading(true);
      if (dataSource && typeof dataSource.find === 'function') {
        dataSource.find(api).then((result) => {
          const items = Array.isArray(result)
            ? result
            : Array.isArray((result as any)?.data)
              ? (result as any).data
              : [];
          setRelatedData(items);
          setLoading(false);
        }).catch((err) => {
          console.error('Failed to fetch related data:', err);
          setLoading(false);
        });
      } else {
        fetch(api)
          .then(res => res.json())
          .then(result => {
            const items = Array.isArray(result) ? result : (result?.data || []);
            setRelatedData(items);
          })
          .catch(err => {
            console.error('Failed to fetch related data:', err);
          })
          .finally(() => setLoading(false));
      }
    }
  }, [api, data, dataSource]);

  // Filter data
  const filteredData = React.useMemo(() => {
    if (!filterText) return relatedData;
    const lower = filterText.toLowerCase();
    return relatedData.filter((row) =>
      Object.values(row).some((val) =>
        val !== null && val !== undefined && String(val).toLowerCase().includes(lower)
      )
    );
  }, [relatedData, filterText]);

  // Sort data
  const sortedData = React.useMemo(() => {
    if (!sortField) return filteredData;
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortField, sortDirection]);

  // Paginate data
  const effectivePageSize = pageSize && pageSize > 0 ? pageSize : 0;
  const totalPages = effectivePageSize ? Math.max(1, Math.ceil(sortedData.length / effectivePageSize)) : 1;
  const paginatedData = effectivePageSize
    ? sortedData.slice(currentPage * effectivePageSize, (currentPage + 1) * effectivePageSize)
    : sortedData;

  // Reset to first page when filter/sort changes
  React.useEffect(() => {
    setCurrentPage(0);
  }, [filterText, sortField, sortDirection]);

  const handleSort = React.useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const handleDeleteRow = React.useCallback((row: any) => {
    if (window.confirm(t('detail.deleteRowConfirmation'))) {
      onRowDelete?.(row);
    }
  }, [onRowDelete, t]);

  // Generate effective columns from explicit prop or object schema fields
  const effectiveColumns = React.useMemo(() => {
    if (columns && columns.length > 0) return columns;
    if (!objectSchema?.fields) return [];
    return Object.entries(objectSchema.fields)
      .filter(([key]) => !key.startsWith('_'))
      .map(([key, def]: [string, any]) => ({
        accessorKey: key,
        header: def.label || key,
      }));
  }, [columns, objectSchema]);

  const viewSchema = React.useMemo(() => {
    if (schema) return schema;

    // Auto-generate schema based on type
    switch (type) {
      case 'grid':
      case 'table':
        return {
          type: 'data-table',
          data: paginatedData,
          columns: effectiveColumns,
          pagination: false, // We handle pagination ourselves
          pageSize: effectivePageSize || 10,
        };
      case 'list':
        return {
          type: 'data-list',
          data: paginatedData,
        };
      default:
        return { type: 'div', children: 'No view configured' };
    }
  }, [type, paginatedData, effectiveColumns, schema, effectivePageSize]);

  const recordCountText = relatedData.length === 1
    ? t('detail.relatedRecordOne', { count: relatedData.length })
    : t('detail.relatedRecords', { count: relatedData.length });

  const hasRowActions = !!onRowEdit || !!onRowDelete;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>{title}</span>
            <span className="text-sm font-normal text-muted-foreground">
              {recordCountText}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {onNew && (
              <Button variant="ghost" size="sm" onClick={onNew} className="gap-1 h-7 text-xs">
                <Plus className="h-3.5 w-3.5" />
                {t('detail.new')}
              </Button>
            )}
            {onViewAll && (
              <Button variant="ghost" size="sm" onClick={onViewAll} className="gap-1 h-7 text-xs">
                {t('detail.viewAll')}
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filter bar */}
        {filterable && relatedData.length > 0 && (
          <div className="mb-3">
            <Input
              placeholder={t('detail.filterPlaceholder')}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )}

        {/* Sortable column headers */}
        {sortable && columns && columns.length > 0 && relatedData.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {columns.map((col: any) => {
              const field = col.accessorKey || col.field || col.name;
              if (!field) return null;
              const label = col.header || col.label || field;
              const isActive = sortField === field;
              return (
                <Button
                  key={field}
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-1 h-7 text-xs"
                  onClick={() => handleSort(field)}
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {label}
                  {isActive && (sortDirection === 'asc' ? ' ↑' : ' ↓')}
                </Button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            {t('detail.loading')}
          </div>
        ) : relatedData.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            {t('detail.noRelatedRecords')}
          </div>
        ) : (
          <>
            <SchemaRenderer schema={viewSchema} />

            {/* Row-level actions (rendered as a simple action list below data) */}
            {hasRowActions && paginatedData.length > 0 && (
              <div className="mt-2 space-y-1" data-testid="row-actions">
                {paginatedData.map((row, idx) => (
                  <div key={row.id || idx} className="flex items-center justify-between px-2 py-1 text-xs border-b last:border-b-0">
                    <span className="truncate text-muted-foreground">
                      {row.name || row.title || row.id || `Row ${idx + 1}`}
                    </span>
                    <div className="flex items-center gap-1">
                      {onRowEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1 px-2"
                          onClick={() => onRowEdit(row)}
                        >
                          <Edit className="h-3 w-3" />
                          {t('detail.editRow')}
                        </Button>
                      )}
                      {onRowDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1 px-2 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteRow(row)}
                        >
                          <Trash2 className="h-3 w-3" />
                          {t('detail.deleteRow')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Pagination controls */}
        {effectivePageSize > 0 && sortedData.length > effectivePageSize && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="h-3 w-3" />
              {t('detail.previousPage')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t('detail.pageOf', { current: currentPage + 1, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              {t('detail.nextPage')}
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
