/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * RecordDetailDrawer — the drill-to-record surface for dashboard table / list
 * widgets.
 *
 * When a row in a table / list widget is clicked (and drill-down is enabled),
 * this opens a side drawer (or dialog) showing that single record's fields,
 * read-only. It mirrors Salesforce's list-view row → record preview and Power
 * BI's "see records" row drill: the row already *is* a record, so there is no
 * filter to derive — we just present the record we already fetched.
 *
 * The record object is supplied directly by the table (it was fetched with all
 * columns), so the drawer renders without an additional round-trip. Field
 * labels and value formatting come from the shared {@link recordFields} helpers
 * so a value reads identically in the table cell and in this drawer.
 */

import React, { useMemo } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@object-ui/components';
import { useSafeFieldLabel, useLocalization } from '@object-ui/i18n';
import {
  indexObjectFields,
  buildFieldMeta,
  renderFieldValue,
  isSystemField,
  isNumericFieldMeta,
} from './recordFields';

export interface RecordDetailDrawerProps {
  /** The record to display, or `null` when nothing is selected. */
  record: Record<string, any> | null;
  /** Object the record belongs to (drives label translation + field meta). */
  objectName?: string;
  /** Object schema (field metadata) for labels / formatting. Optional. */
  objectSchema?: any;
  /**
   * Optional whitelist of field accessors to show (e.g. `drillDown.columns`).
   * When omitted, all non-system fields are shown in schema declaration order
   * (falling back to the record's own keys when no schema is available).
   */
  fields?: string[];
  /** Explicit drawer/dialog title; defaults to the record's display name. */
  title?: string;
  /** Where to open. Defaults to `'drawer'` (right-side Sheet). */
  target?: 'drawer' | 'dialog';
  /** Called when the drawer requests to close. */
  onClose: () => void;
}

/** Candidate fields, in priority order, used to title the drawer. */
const NAME_FIELDS = ['name', 'title', 'label', 'subject', 'display_name', 'full_name'];

function resolveRecordTitle(record: Record<string, any>, explicit?: string): string {
  if (explicit && explicit.trim()) return explicit;
  for (const f of NAME_FIELDS) {
    const v = record[f];
    if (typeof v === 'string' && v.trim()) return v;
  }
  // Last resort: a record id keeps the drawer from being titled "Record".
  const id = record.id ?? record._id;
  return id != null ? String(id) : 'Record';
}

export const RecordDetailDrawer: React.FC<RecordDetailDrawerProps> = ({
  record,
  objectName,
  objectSchema,
  fields,
  title,
  target = 'drawer',
  onClose,
}) => {
  const { fieldLabel, fieldOptionLabel } = useSafeFieldLabel();
  const { currency: tenantCurrency } = useLocalization();

  const rows = useMemo(() => {
    if (!record) return [];
    const fieldsByName = indexObjectFields(objectSchema);

    // Which fields, in which order: explicit whitelist → schema declaration
    // order → record's own keys. System / audit fields are hidden unless the
    // author explicitly listed them.
    let keys: string[];
    if (fields && fields.length > 0) {
      keys = fields;
    } else if (Object.keys(fieldsByName).length > 0) {
      keys = Object.keys(fieldsByName).filter((k) => !isSystemField(k, fieldsByName[k]));
    } else {
      keys = Object.keys(record).filter((k) => !k.startsWith('_') && !isSystemField(k));
    }

    return keys.map((key) => {
      const def = fieldsByName[key];
      const humanized = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
      const label = objectName ? fieldLabel(objectName, key, humanized) : humanized;
      const fieldMeta = buildFieldMeta({ accessorKey: key, label, def, objectName, fieldOptionLabel });
      return {
        key,
        label,
        node: renderFieldValue(record[key], fieldMeta, tenantCurrency),
        numeric: isNumericFieldMeta(fieldMeta),
      };
    });
  }, [record, objectSchema, objectName, fields, fieldLabel, fieldOptionLabel, tenantCurrency]);

  if (!record) return null;

  const heading = resolveRecordTitle(record, title);

  const body = (
    <dl className="divide-y divide-border/60" data-testid="record-detail-body">
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-3 gap-3 py-2.5">
          <dt className="text-xs font-medium text-muted-foreground self-center">{row.label}</dt>
          <dd className={`col-span-2 text-sm break-words ${row.numeric ? 'tabular-nums' : ''}`}>
            {row.node === '' || row.node == null
              ? <span className="text-muted-foreground/60">—</span>
              : row.node}
          </dd>
        </div>
      ))}
    </dl>
  );

  if (target === 'dialog') {
    return (
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{heading}</DialogTitle></DialogHeader>
          <div className="max-h-[70vh] overflow-auto">{body}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg flex flex-col">
        <SheetHeader><SheetTitle>{heading}</SheetTitle></SheetHeader>
        <div className="flex-1 overflow-auto mt-2 pr-1">{body}</div>
      </SheetContent>
    </Sheet>
  );
};
