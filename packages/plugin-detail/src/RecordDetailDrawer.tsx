/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * RecordDetailDrawer
 *
 * A standardized right-side drawer that renders {@link DetailView} for a
 * single record. Used by plugin-gantt, plugin-calendar and plugin-kanban
 * to provide a consistent "click row/event/card → side drawer with
 * inline edit + delete" UX without each plugin re-implementing the same
 * Sheet + typed-fields-from-objectSchema scaffolding.
 *
 * Field list is derived from the supplied objectSchema (so dates render
 * as date pickers, lookups stay readonly etc.). System/audit fields
 * (id, created_at, ...) are filtered out by default.
 */

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@object-ui/components';
import type { DataSource } from '@object-ui/types';
import { InlineEditProvider } from '@object-ui/react';
import { DetailView } from './DetailView';
import { InlineEditSaveBar } from './InlineEditSaveBar';
import { useDetailTranslation } from './useDetailTranslation';

/**
 * Field names hidden from the quick-look drawer / inline edit form.
 *
 * Scope: this is the DRAWER allow-list — used to keep the slim sheet UI
 * focused on author-defined business fields. The full record detail page
 * (`RecordDetailView`) surfaces audit fields via a compact
 * `<RecordMetaFooter>` (single-line, muted) rather than a heavy panel, so
 * users can still see who/when created or last touched a record.
 *
 * Keep this in sync with the audit fields auto-injected by the
 * framework's `applySystemFields` (created_at/created_by/updated_at/
 * updated_by) plus the legacy/tenant identifiers.
 */
const DEFAULT_SYSTEM_FIELDS = new Set([
  'id', '_id', '__v', 'created_at', 'updated_at', 'createdAt', 'updatedAt',
  'created_by', 'updated_by', 'organization_id', 'tenant_id', 'owner_id',
  'deleted_at', 'is_deleted',
]);

export interface RecordDetailDrawerProps {
  /** Whether the drawer is currently open. */
  open: boolean;
  /** Called when the user dismisses the drawer (overlay click, Esc, after delete). */
  onClose: () => void;
  /** Drawer header title (typically the record's primary label). */
  title: string;
  /** The record being displayed. */
  record: Record<string, any>;
  /** Logical object name used by the data source. */
  objectName: string;
  /** Record id (string-coerced before issuing update/delete). */
  recordId: string | number;
  /** Active data source — used for inline updates and deletion. */
  dataSource?: DataSource;
  /**
   * Optional objectSchema (as returned by `dataSource.getObjectSchema`).
   * When provided the drawer infers field types so dates / picklists /
   * currency render with their proper widgets.
   */
  objectSchema?: { fields?: Record<string, any> } | null;
  /**
   * Drawer width — accepts any CSS width value. Defaults to
   * `min(960px, 60vw)` which fills ~60% of typical desktop viewports
   * (the prior `max-w-2xl` cap felt cramped on wide screens).
   *
   * Note: when `resizable` is true (the default), this is only used
   * as the initial width — the user's drag-resized width takes over
   * and is persisted to localStorage keyed by `objectName`.
   */
  width?: string | number;
  /** Number of columns the field grid should use. Default `2`. */
  columns?: number;
  /**
   * Optional override for the SYSTEM_FIELDS filter. Defaults to a
   * standard set (id, timestamps, audit fields).
   */
  systemFields?: Set<string>;
  /**
   * Persist an inline field edit. Plugins usually update local state
   * here so the drawer stays in sync after the network round-trip.
   */
  onFieldSave?: (field: string, value: unknown) => void | Promise<void>;
  /**
   * Persist record deletion. Plugins are expected to remove the record
   * from their local state; the drawer auto-closes after this resolves.
   */
  onDelete?: () => void | Promise<void>;
  /**
   * Allow the user to drag the left edge to resize the drawer width.
   * Resized width is persisted per-objectName in localStorage. Default `true`.
   */
  resizable?: boolean;
  /**
   * Optional URL to the full record page. When provided, the drawer
   * shows an "Open in new tab" button in the header that opens this
   * URL in a new browser tab. The drawer itself stays open.
   * Typically `/console/apps/{appName}/{objectName}/record/{recordId}`.
   */
  fullPageHref?: string;
}

const MIN_WIDTH_PX = 480;
const MAX_WIDTH_VW = 95;

/** Right-side drawer wrapping {@link DetailView} for a single record. */
export function RecordDetailDrawer({
  open,
  onClose,
  title,
  record,
  objectName,
  recordId,
  dataSource,
  objectSchema,
  width = 'min(960px, 60vw)',
  columns = 2,
  systemFields = DEFAULT_SYSTEM_FIELDS,
  onFieldSave,
  onDelete,
  resizable = true,
  fullPageHref,
}: RecordDetailDrawerProps) {
  const { t } = useDetailTranslation();
  const storageKey = `objectui.drawerWidth.${objectName}`;

  // Resolve the initial width: prefer the persisted user width, otherwise
  // fall back to the prop. Persisted value is stored as an integer pixel
  // count to avoid CSS-string drift between sessions.
  const [pxWidth, setPxWidth] = React.useState<number | null>(() => {
    if (typeof window === 'undefined' || !resizable) return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n >= MIN_WIDTH_PX) return n;
      }
    } catch {
      // ignore localStorage failures (private browsing, etc.)
    }
    return null;
  });

  const widthValue = React.useMemo(() => {
    if (resizable && pxWidth != null) return `${pxWidth}px`;
    return typeof width === 'number' ? `${width}px` : width;
  }, [resizable, pxWidth, width]);

  const widthStyle = widthValue
    ? { width: widthValue, maxWidth: widthValue }
    : undefined;

  // --- Drag-to-resize ---------------------------------------------------
  // We attach pointer listeners on `window` while a drag is active so the
  // gesture continues smoothly even if the cursor leaves the handle.
  const dragStateRef = React.useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizable) return;
    event.preventDefault();
    const containerWidth = pxWidth ?? (typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.6, 960) : 720);
    dragStateRef.current = { startX: event.clientX, startWidth: containerWidth };

    const onMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;
      const delta = state.startX - e.clientX; // dragging left = wider
      const maxPx = typeof window !== 'undefined' ? (window.innerWidth * MAX_WIDTH_VW) / 100 : 1600;
      const next = Math.min(maxPx, Math.max(MIN_WIDTH_PX, state.startWidth + delta));
      setPxWidth(Math.round(next));
    };
    const onUp = () => {
      const state = dragStateRef.current;
      dragStateRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      try {
        // Persist final width — read it from state at flush time.
        setPxWidth((current) => {
          if (current != null) {
            window.localStorage.setItem(storageKey, String(current));
          }
          return current;
        });
      } catch {
        // ignore
      }
      void state;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [resizable, pxWidth, storageKey]);

  // Build typed fields list from objectSchema, falling back to record keys
  // when no schema is available. Lookups are marked readonly because we
  // don't yet wire a relation picker inside the drawer's inline editor —
  // showing them as plain text inputs would let users overwrite the
  // relation with a free-form string.
  const schemaFields: Record<string, any> = (objectSchema?.fields ?? {}) as Record<string, any>;
  const orderedNames = Object.keys(schemaFields).length
    ? Object.keys(schemaFields)
    : Object.keys(record);
  const fields = orderedNames
    .filter((name) => !systemFields.has(name) && !name.startsWith('__'))
    .filter((name) => name in record)
    // Honor `hidden: true` on the schema field def so internal/system fields
    // (e.g. database_url, environment_id, is_system) don't leak into the
    // quick-look drawer.
    .filter((name) => !schemaFields[name]?.hidden)
    .map((name) => {
      const def = schemaFields[name] || {};
      const isLookup =
        def.type === 'lookup' ||
        def.type === 'master_detail' ||
        def.type === 'reference';
      // Carry through the full field metadata so DetailView's inline-edit
      // mode can resolve the correct widget (e.g. a select with options
      // rather than a free-form text input). DetailSection performs the
      // same enrichment when rendering a record detail page; without this
      // fan-out the drawer rendered a plaintext input for every picklist.
      return {
        name,
        label: def.label,
        type: def.type as any,
        readonly: !!def.readonly || isLookup,
        options: def.options,
        currency: def.currency,
        precision: def.precision,
        scale: (def as any).scale,
        format: def.format,
        // Served schemas key the target as `reference` (ObjectStack
        // convention, #2407); the drawer can receive a raw schema from any
        // DataSource, so resolve every spelling.
        reference_to: def.reference_to ?? def.reference ?? def.referenceTo ?? def.target,
        reference_field: def.reference_field ?? def.referenceField,
        required: def.required,
        validation: def.validation,
        placeholder: def.placeholder,
        description: def.description,
      };
    });

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:!max-w-none"
        style={widthStyle}
        // Suppress Radix's default auto-focus on open. The drawer is for
        // browsing/inspecting a record, not for immediate keyboard entry,
        // so auto-focusing the Close button (or the first focusable
        // child) flashes a focus ring on mount which feels jarring.
        // Keyboard users can still Tab in normally.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Drag handle on the left edge — only rendered on >= sm screens
            where pointer-resize is meaningful. */}
        {resizable && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize drawer"
            onPointerDown={handleResizePointerDown}
            className="hidden sm:block absolute left-0 top-0 h-full w-1.5 cursor-col-resize select-none bg-transparent hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
          />
        )}
        {/* Accessible title for screen readers — DetailView's own
            HeaderHighlight renders the visible title, so we hide ours
            visually to avoid the duplicate-heading look. */}
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="px-6 pt-6 pb-6">
          {/* One inline-edit session scoped to this drawer. `canEdit` gates on
              handler presence so an omitted onFieldSave yields a strictly
              read-only drawer (objectui#2407 P1). */}
          <InlineEditProvider canEdit={!!onFieldSave}>
          <DetailView
            dataSource={dataSource}
            // Capability = handler presence: a caller that omits onFieldSave /
            // onDelete gets a strictly read-only drawer (no inline editors, no
            // delete action) — e.g. a gantt row locked via lockField. Hardcoding
            // these on would let the drawer bypass row-level locks.
            inlineEdit={!!onFieldSave}
            schema={{
              type: 'detail-view',
              objectName,
              resourceId: String(recordId),
              data: record,
              showDelete: !!onDelete,
              columns,
              fields,
              // Fold "Open in new tab" into DetailView's unified header
              // overflow menu (the "..." kebab) rather than floating it
              // as a separate icon. This way we never stack a third icon
              // on top of the existing Edit + More-actions + Close X
              // cluster at the top-right of the drawer.
              actions: fullPageHref
                ? [
                    {
                      type: 'action:bar',
                      location: 'record_header',
                      systemActions: [
                        {
                          name: 'sys_open_new_tab',
                          label: t('detail.openInNewTab'),
                          icon: 'external-link',
                          type: 'script',
                          onClick: () =>
                            window.open(fullPageHref, '_blank', 'noopener'),
                        },
                      ],
                    },
                  ]
                : undefined,
            } as any}
            onDelete={onDelete ? async () => {
              try {
                await onDelete();
                onClose();
              } catch (err) {
                console.error('[RecordDetailDrawer] delete failed:', err);
              }
            } : undefined}
          />
          {/* Record-level Save/Cancel bar. Callback mode: loops the caller's
              per-field onFieldSave over the draft, preserving the drawer's
              existing persistence contract (plugin-gantt/calendar/kanban). */}
          <InlineEditSaveBar
            onFieldSave={onFieldSave ? async (field, value) => {
              try {
                await onFieldSave(field, value);
              } catch (err) {
                console.error('[RecordDetailDrawer] inline field save failed:', err);
                // Rethrow so the save bar surfaces the failure inline and keeps
                // the draft — swallowing made a rejected save look successful.
                throw err;
              }
            } : undefined}
          />
          </InlineEditProvider>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default RecordDetailDrawer;

/**
 * Derive a full record-page URL from the current browser location.
 *
 * Used by plugin-gantt / plugin-calendar / plugin-kanban to populate
 * `RecordDetailDrawer.fullPageHref` without each plugin needing direct
 * access to the router. Strips any `/view/{viewId}` suffix so the
 * resulting URL points at the canonical record page.
 *
 * @param objectName - The object name segment in the URL
 *   (e.g. `campaign`, `lead`).
 * @param recordId - The record's primary key, will be URL-encoded.
 * @returns A path like `/console/apps/{app}/{objectName}/record/{id}`,
 *   or `null` when called outside the browser.
 */
export function deriveRecordPageHref(objectName: string, recordId: string | number): string | null {
  if (typeof window === 'undefined') return null;
  const currentPath = window.location.pathname;
  // Strip everything after `/{objectName}` to get the app prefix.
  const marker = `/${objectName}`;
  const idx = currentPath.indexOf(marker);
  const prefix = idx >= 0 ? currentPath.slice(0, idx) : currentPath.replace(/\/$/, '');
  return `${prefix}/${objectName}/record/${encodeURIComponent(String(recordId))}`;
}
