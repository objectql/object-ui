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
}) => {
  const tableSchema = {
    type: 'object-data-table',
    objectName,
    filter,
    columns: columns?.map((c) => ({ accessorKey: c, header: c })),
    pagination: true,
    searchable: false,
    pageSize: maxRows,
  };

  const body = (
    <div className={cn('overflow-auto', className)} data-testid="drill-down-body">
      <ObjectDataTable schema={tableSchema} dataSource={dataSource} />
    </div>
  );

  if (target === 'dialog') {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-4xl">
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
