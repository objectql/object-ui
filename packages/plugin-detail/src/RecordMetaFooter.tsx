/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@object-ui/components';
import { getCellRenderer, resolveCellRendererType } from '@object-ui/fields';
import type { FieldMetadata } from '@object-ui/types';
import { useDetailTranslation } from './useDetailTranslation';

/**
 * Audit field names auto-injected by the framework's `applySystemFields`.
 * Kept in sync with `AUDIT_FIELD_NAMES` in `RecordDetailView`.
 */
const AUDIT_FIELDS = {
  createdAt: 'created_at',
  createdBy: 'created_by',
  updatedAt: 'updated_at',
  updatedBy: 'updated_by',
} as const;

export interface RecordMetaFooterProps {
  /** The current record data; expected to contain audit fields when available. */
  data: Record<string, any> | null | undefined;
  /** Resolved object schema (used to read reference_to for created_by/updated_by). */
  objectSchema?: any;
  /** Object name for future i18n hooks (currently unused). */
  objectName?: string;
  className?: string;
}

interface TFn {
  (key: string, options?: Record<string, unknown>): string;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatRelativeTime(date: Date, t: TFn): string {
  const ms = Date.now() - date.getTime();
  // Future timestamps (clock skew, scheduled records) — fall through to "just now".
  const elapsed = Math.max(0, Math.floor(ms / 1000));
  if (elapsed < 60) return t('detail.justNow');
  const minutes = Math.floor(elapsed / 60);
  if (minutes < 60) return t('detail.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('detail.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('detail.daysAgo', { count: days });
}

function formatAbsolute(date: Date): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

interface UserRefProps {
  value: unknown;
  objectSchema?: any;
  fieldName: string;
}

/**
 * Renders a created_by/updated_by value using the same cell renderer pipeline
 * as DetailSection so reference resolution (ID → display name) is consistent.
 */
const UserRef: React.FC<UserRefProps> = ({ value, objectSchema, fieldName }) => {
  if (value === null || value === undefined || value === '') return null;
  const fieldDef = objectSchema?.fields?.[fieldName];
  // created_by / updated_by are ALWAYS user references on ObjectStack, but many
  // fetched schemas omit the audit system fields from `fields`. Without a
  // fallback the field degrades to `type: 'text'` and the footer prints the raw
  // user id (objectui#2688) — so default the reference target to `sys_user`.
  const refTarget = fieldDef?.reference_to || fieldDef?.reference || 'sys_user';
  const enrichedField: Record<string, any> = {
    name: fieldName,
    type: fieldDef?.type || 'lookup',
    reference_to: refTarget,
    ...(fieldDef?.reference_field && { reference_field: fieldDef.reference_field }),
  };
  const resolvedType = resolveCellRendererType(enrichedField as { type?: string }) || enrichedField.type;
  if (resolvedType) {
    const cellRenderer = getCellRenderer(resolvedType);
    if (cellRenderer) {
      // createElement over a JSX tag: the registry returns a STABLE component
      // reference, but a locally-assigned capitalized tag reads as "component
      // created during render" to the hooks lint (state would reset if it
      // were). Direct invocation makes the stable-reference intent explicit.
      return (
        <span className="inline-flex items-center [&_a]:text-inherit [&_a]:hover:underline">
          {React.createElement(cellRenderer, {
            value,
            field: enrichedField as unknown as FieldMetadata,
          })}
        </span>
      );
    }
  }
  return <span>{String(value)}</span>;
};

interface MetaEntryProps {
  label: string;
  user?: unknown;
  date?: Date | null;
  objectSchema?: any;
  userField: string;
  t: TFn;
}

const MetaEntry: React.FC<MetaEntryProps> = ({ label, user, date, objectSchema, userField, t }) => {
  if (!user && !date) return null;
  const dateNode = date ? (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <time
            dateTime={date.toISOString()}
            className="cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-2"
          >
            {formatRelativeTime(date, t)}
          </time>
        </TooltipTrigger>
        <TooltipContent side="top">{formatAbsolute(date)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground/70">{label}</span>
      {user ? <UserRef value={user} objectSchema={objectSchema} fieldName={userField} /> : null}
      {user && dateNode ? <span className="text-muted-foreground/40">·</span> : null}
      {dateNode}
    </span>
  );
};

/**
 * RecordMetaFooter — minimal one-line provenance footer for a record.
 *
 * Replaces the old card-style "System Information" section. Shows
 * `created_by` / `updated_by` (via the reference cell renderer so user IDs
 * resolve to names) plus relative timestamps, with absolute dates on hover.
 *
 * Renders nothing when no audit fields are present. The "Updated" segment
 * is suppressed when the record has never been updated (updated_at equals
 * created_at) to avoid redundant noise.
 */
export const RecordMetaFooter: React.FC<RecordMetaFooterProps> = ({
  data,
  objectSchema,
  objectName: _objectName,
  className,
}) => {
  const { t } = useDetailTranslation();
  if (!data) return null;

  const createdAt = toDate(data[AUDIT_FIELDS.createdAt]);
  const updatedAt = toDate(data[AUDIT_FIELDS.updatedAt]);
  const createdBy = data[AUDIT_FIELDS.createdBy];
  const updatedBy = data[AUDIT_FIELDS.updatedBy];

  const hasCreated = !!(createdAt || createdBy);
  // Treat updated_at within ~2s of created_at as "never touched" — covers
  // server-side timestamp jitter where create/update fire in the same tx.
  const updateIsSameAsCreate =
    createdAt && updatedAt && Math.abs(updatedAt.getTime() - createdAt.getTime()) < 2000;
  const sameUser =
    createdBy != null && updatedBy != null && String(createdBy) === String(updatedBy);
  const hasUpdated =
    !!(updatedAt || updatedBy) && !(updateIsSameAsCreate && (sameUser || !updatedBy));

  if (!hasCreated && !hasUpdated) return null;

  return (
    <div
      className={cn(
        'mt-6 pt-3 border-t border-border/40',
        'flex flex-wrap items-center gap-x-4 gap-y-1',
        'text-xs text-muted-foreground',
        className,
      )}
      data-testid="record-meta-footer"
    >
      {hasCreated && (
        <MetaEntry
          // No actor (system/seeded rows) → the "by"-less label; "Created
          // by · 5m ago" read as a dangling phrase.
          label={createdBy ? t('detail.createdBy') : t('detail.created')}
          user={createdBy}
          date={createdAt}
          objectSchema={objectSchema}
          userField={AUDIT_FIELDS.createdBy}
          t={t}
        />
      )}
      {hasUpdated && (
        <MetaEntry
          label={updatedBy ? t('detail.updatedBy') : t('detail.updated')}
          user={updatedBy}
          date={updatedAt}
          objectSchema={objectSchema}
          userField={AUDIT_FIELDS.updatedBy}
          t={t}
        />
      )}
    </div>
  );
};
