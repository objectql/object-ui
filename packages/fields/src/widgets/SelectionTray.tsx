/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage, cn } from '@object-ui/components';
import { X } from 'lucide-react';
import {
  getPersonName,
  getPersonInitials,
  getPersonAvatarUrl,
  getPersonId,
} from './personDisplay';

/**
 * "Selected" transfer-box area (穿梭框式已选区): live echo of the current
 * multi-selection as removable avatar chips. Reusable kernel — the future
 * org-tree tier composes the same tray beside its right-hand list. Purely
 * presentational: it takes the resolved records + an onRemove callback, and
 * accepts already-translated `label`/`emptyText` so it stays i18n-agnostic.
 */
export interface SelectionTrayProps {
  /** Full record objects for the current selection. */
  records: any[];
  /** Remove a selected record by its id. */
  onRemove: (id: any) => void;
  displayField?: string;
  avatarField?: string;
  idField?: string;
  /** Header label, e.g. "Selected (3)" — omit to hide the header. */
  label?: string;
  /** Shown when the selection is empty. */
  emptyText?: string;
  className?: string;
}

export function SelectionTray({
  records,
  onRemove,
  displayField = 'name',
  avatarField = 'image',
  idField = 'id',
  label,
  emptyText,
  className,
}: SelectionTrayProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} data-testid="selection-tray">
      {label && <div className="text-xs font-medium text-muted-foreground">{label}</div>}
      {records.length === 0 ? (
        <div className="text-xs text-muted-foreground">{emptyText ?? ''}</div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {records.map(record => {
            const id = getPersonId(record, idField);
            const name = getPersonName(record, displayField);
            const avatarUrl = getPersonAvatarUrl(record, avatarField);
            const initials = getPersonInitials(name);
            return (
              <span
                key={String(id)}
                data-testid="selection-chip"
                className="inline-flex items-center gap-1.5 rounded-full border bg-background py-0.5 pl-0.5 pr-1.5 text-sm"
              >
                <Avatar className="size-6 shrink-0">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
                  <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                </Avatar>
                <span className="max-w-[10rem] truncate">{name || '—'}</span>
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  aria-label={`Remove ${name}`}
                  className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
