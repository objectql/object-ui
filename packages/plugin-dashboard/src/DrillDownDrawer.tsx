/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * DrillDownDrawer — opens a side drawer (or dialog) that lists the
 * underlying records behind a clicked pivot cell / chart segment.
 *
 * Composition: <Sheet> + <ObjectDataTable>. The data table receives
 * the merged filter (widget filter ∧ drill filter) and the data source
 * inherited from the schema renderer context.
 */

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  cn,
} from '@object-ui/components';
import { SchemaRenderer } from '@object-ui/react';
import { ObjectDataTable } from './ObjectDataTable';

export interface DrillDownDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Drawer/dialog header. */
  title: string;
  /** "drawer" (right-side Sheet) or "dialog" (centered Dialog). */
  target?: 'drawer' | 'dialog';
  /** Object name to query. */
  objectName: string;
  /** Filter applied to the drilled list. */
  filter?: Record<string, unknown>;
  /** Optional inline data source override (otherwise inherited via context). */
  dataSource?: any;
  /** Optional column whitelist. */
  columns?: string[];
  /** Optional max rows. */
  maxRows?: number;
  /** Optional className on the inner container. */
  className?: string;
  /**
   * M3: drill into an analytical `SpecReport` instead of the raw record list.
   * When provided the drawer body renders a `spec-report` schema via
   * `SchemaRenderer`. The widget's `filter` is merged in as an `$and` so the
   * metric's scope flows into the report. The report itself can drill
   * further (into a list / record) via its own row-click protocol.
   */
  report?: Record<string, unknown>;
}

export const DrillDownDrawer: React.FC<DrillDownDrawerProps> = ({
  open,
  onClose,
  title,
  target = 'drawer',
  objectName,
  filter,
  dataSource,
  columns,
  maxRows,
  className,
  report,
}) => {
  const isReportDrill = report && typeof report === 'object'
    && (Array.isArray((report as any).columns) || 'objectName' in (report as any));

  const body = (
    <div className={cn('overflow-auto', className)} data-testid="drill-down-body">
      {isReportDrill
        ? (() => {
            const existingFilter = (report as any).filter;
            const mergedFilter = existingFilter
              ? (filter ? { $and: [existingFilter, filter] } : existingFilter)
              : filter;
            const reportSchema = {
              ...(report as Record<string, unknown>),
              type: 'spec-report',
              report: { ...(report as Record<string, unknown>), filter: mergedFilter },
              filter: mergedFilter,
            };
            return <SchemaRenderer schema={reportSchema as any} />;
          })()
        : (
          <ObjectDataTable
            schema={{
              type: 'object-data-table',
              objectName,
              filter,
              columns: columns?.map((c) => ({ accessorKey: c, header: c })),
              pagination: true,
              searchable: false,
              pageSize: maxRows,
              // Complete the drill chain: a row in this filtered record list
              // opens that record. Dialog target so it stacks over this drawer.
              // Mirrors the chart / KPI drill tables — every drill-through list
              // (pivot, dataset, chart, metric) lands on a clickable record.
              drillDown: { enabled: true, mode: 'record', target: 'dialog' },
            }}
            dataSource={dataSource}
          />
        )}
    </div>
  );

  if (target === 'dialog') {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl flex flex-col">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden mt-2">{body}</div>
      </SheetContent>
    </Sheet>
  );
};
