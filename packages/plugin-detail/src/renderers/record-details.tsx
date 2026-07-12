/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:details` — page-level record component that renders the canonical
 * field-detail block. Reads the bound record from <RecordContextProvider> and
 * synthesizes a DetailViewSchema for the existing DetailView component.
 */

import React from 'react';
import { useRecordContext, useHighlightFieldNames, useSafeFieldLabel } from '@object-ui/react';
import { useFieldPermissions, usePermissions } from '@object-ui/permissions';
import type { RecordDetailsComponentProps } from '@object-ui/types';
import { DetailView } from '../DetailView';
import {
  ConcurrentUpdateDialog,
  isConcurrentUpdateError,
  type ConcurrentUpdateConflict,
} from '../ConcurrentUpdateDialog';

/** Normalize a field entry (string | {field} | {name}) to its machine name. */
const fieldName = (entry: any): string | null => {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object') return entry.field || entry.name || null;
  return null;
};

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordDetailsRendererProps {
  schema?: RecordDetailsComponentProps & Record<string, any>;
  className?: string;
  [k: string]: any;
}

export const RecordDetailsRenderer: React.FC<RecordDetailsRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  // ── Hooks (unconditional — before ANY early return) ──────────────────────
  // Rules of hooks: every hook below MUST run on every render, whether or not
  // a record is bound and whether or not the viewer has permission. Returning
  // early *between* hooks — the designer placeholder (`!ctx`) or the
  // permission-denied notice — changes the hook count between renders and
  // throws React error #310 ("Rendered fewer hooks than expected"). That is
  // precisely the crash a related-list row click produced: `onRowClick` flips
  // the bound record / permission state, `ctx` (or `perms.can(...)`) toggles,
  // and the previously-mounted `record:details` re-renders with fewer hooks.
  // Keep all hooks here; move all conditional returns below them.
  const ctx = useRecordContext();
  const { designer } = splitDesigner(props);

  const objectName = ctx?.objectName || '';
  const perms = usePermissions();
  const { readableFields } = useFieldPermissions(objectName);
  const { sectionLabel } = useSafeFieldLabel();

  // Phase N.4b: field names registered live by a mounted `record:highlights`
  // instance via HighlightFieldsContext (used to dedupe them out of the grid).
  const liveHighlightNames = useHighlightFieldNames();

  /**
   * Optimistic Concurrency Control state for inline edits: a `409
   * CONCURRENT_UPDATE` opens a resolution dialog instead of silently retrying
   * or overwriting.
   */
  const [conflict, setConflict] = React.useState<ConcurrentUpdateConflict | null>(null);
  const [conflictBusy, setConflictBusy] = React.useState(false);

  const fieldLabelFor = React.useCallback(
    (name: string): string | undefined => {
      const all: any[] = [
        ...(Array.isArray(schema.fields) ? (schema.fields as any[]) : []),
        ...((Array.isArray(schema.sections) ? (schema.sections as any[]) : [])
          .flatMap((s: any) => (Array.isArray(s?.fields) ? s.fields : []))),
      ];
      for (const f of all) {
        const fname = typeof f === 'string' ? f : (f?.name || f?.field);
        if (fname === name) {
          const label = typeof f === 'object' ? (f?.label as string | undefined) : undefined;
          return label;
        }
      }
      return undefined;
    },
    [schema.fields, schema.sections]
  );

  /**
   * Persist a single inline-edited field through the bound DataSource and
   * trigger a context refresh so the new value re-hydrates from the server
   * after save. Without this wiring the DetailView only updated its own
   * local `data` state — the change would visibly stick until the user
   * reloaded the page, then silently revert because nothing was sent to
   * the backend.
   *
   * Passes the record's `updated_at` as `ifMatch` so the server can reject the
   * write with `409 CONCURRENT_UPDATE` when a concurrent writer has bumped the
   * row; on conflict we open a resolution dialog.
   */
  const handleInlineFieldSave = React.useCallback(
    async (field: string, value: any) => {
      const ds: any = ctx?.dataSource;
      const recordId = ctx?.recordId;
      const objName = ctx?.objectName;
      if (!ds || !recordId || !objName) return;
      const ifMatch =
        typeof (ctx?.data as any)?.updated_at === 'string'
          ? ((ctx?.data as any).updated_at as string)
          : undefined;
      const opts = ifMatch ? { ifMatch } : undefined;
      try {
        if (typeof ds.update === 'function') {
          await ds.update(objName, recordId, { [field]: value }, opts);
        } else if (typeof ds.updateOne === 'function') {
          await ds.updateOne(objName, recordId, { [field]: value }, opts);
        } else if (typeof ds.patch === 'function') {
          await ds.patch(objName, recordId, { [field]: value }, opts);
        } else {
          console.warn('[record:details] DataSource exposes no update/updateOne/patch method; cannot persist inline edit');
          return;
        }
        if (typeof ctx?.refresh === 'function') {
          await ctx.refresh();
        }
      } catch (err) {
        if (isConcurrentUpdateError(err)) {
          const current = err.currentRecord ?? null;
          setConflict({
            field,
            label: fieldLabelFor(field),
            pendingValue: value,
            currentValue: current ? (current as Record<string, unknown>)[field] : undefined,
            currentVersion: err.currentVersion,
            currentRecord: current,
          });
          // Re-throw so DetailView rolls back its optimistic local state.
          // The dialog drives the eventual resolution (reload / overwrite).
          throw err;
        }
        console.error('[record:details] Inline-edit save failed', err);
        // Re-throw so DetailView can roll back the optimistic local state and
        // surface the failure to the user. Without this the value would
        // appear to stick until the next reload, masking backend rejections
        // (e.g. RECORD_LOCKED while an approval is in progress).
        throw err;
      }
    },
    [ctx?.dataSource, ctx?.recordId, ctx?.objectName, ctx?.data, ctx?.refresh, fieldLabelFor]
  );

  const closeConflict = React.useCallback(() => {
    setConflict(null);
    setConflictBusy(false);
  }, []);

  const handleConflictReload = React.useCallback(async () => {
    setConflictBusy(true);
    try {
      if (typeof ctx?.refresh === 'function') {
        await ctx.refresh();
      }
    } finally {
      closeConflict();
    }
  }, [ctx?.refresh, closeConflict]);

  const handleConflictOverwrite = React.useCallback(async () => {
    if (!conflict) {
      closeConflict();
      return;
    }
    const ds: any = ctx?.dataSource;
    const recordId = ctx?.recordId;
    const objName = ctx?.objectName;
    if (!ds || !recordId || !objName) {
      closeConflict();
      return;
    }
    setConflictBusy(true);
    try {
      // Re-key the write against the latest known server version. The
      // server's `currentVersion` from the 409 is now the freshest
      // token we hold, so passing it through still uses OCC — it just
      // means "I've seen this newer version, apply my change on top".
      const opts = conflict.currentVersion
        ? { ifMatch: conflict.currentVersion }
        : undefined;
      if (typeof ds.update === 'function') {
        await ds.update(objName, recordId, { [conflict.field]: conflict.pendingValue }, opts);
      } else if (typeof ds.updateOne === 'function') {
        await ds.updateOne(objName, recordId, { [conflict.field]: conflict.pendingValue }, opts);
      } else if (typeof ds.patch === 'function') {
        await ds.patch(objName, recordId, { [conflict.field]: conflict.pendingValue }, opts);
      }
      if (typeof ctx?.refresh === 'function') {
        await ctx.refresh();
      }
    } catch (err) {
      console.error('[record:details] Overwrite-on-conflict failed', err);
    } finally {
      closeConflict();
    }
  }, [conflict, ctx?.dataSource, ctx?.recordId, ctx?.objectName, ctx?.refresh, closeConflict]);

  // ── Conditional returns (safe now — all hooks above have run) ────────────

  // Studio designer / palette: render an empty shell when no record bound.
  if (!ctx) {
    return (
      <div
        className={className}
        data-record-details-placeholder
        {...designer}
      >
        <div className="text-xs text-muted-foreground italic px-3 py-2 border border-dashed rounded">
          record:details — bind a record to preview
        </div>
      </div>
    );
  }

  const required: string[] = Array.isArray((schema as any).requiredPermissions)
    ? (schema as any).requiredPermissions
    : [];
  if (required.length > 0 && objectName) {
    const ok = required.every((p) => perms.can(objectName, p as any));
    if (!ok) {
      return (
        <div className={className} {...designer} role="status" aria-live="polite">
          <p className="text-sm text-muted-foreground italic">
            Insufficient permissions to view details.
          </p>
        </div>
      );
    }
  }

  const layout: 'vertical' | 'horizontal' =
    schema.layout === 'inline' || schema.layout === 'compact' ? 'horizontal' : 'vertical';

  const enforceFLS = (schema as any).enforceFieldSecurity === true;
  const redact: string[] = Array.isArray((schema as any).redactFields)
    ? (schema as any).redactFields
    : [];
  const filterList = (list: any[] | undefined): any[] | undefined => {
    if (!list) return list;
    if (!enforceFLS && redact.length === 0) return list;
    const names = list.map(fieldName).filter((n): n is string => !!n);
    const allowed = new Set(
      (enforceFLS && objectName ? readableFields(names) : names)
        .filter((n) => !redact.includes(n)),
    );
    return list.filter((e) => {
      const n = fieldName(e);
      return n ? allowed.has(n) : true;
    });
  };

  // Normalise field entries to the DetailViewField shape that DetailSection
  // expects. Schemas authored against `@objectstack/spec` declare fields as
  // bare strings (`fields: ['first_name', ...]`), but DetailSection reads
  // `field.name` / `field.label`, so we must coerce string → object form
  // before handing the schema to DetailView. Object entries pass through.
  const normaliseField = (entry: any): any => {
    if (typeof entry === 'string') return { name: entry };
    if (entry && typeof entry === 'object' && !entry.name && entry.field) {
      return { ...entry, name: entry.field };
    }
    return entry;
  };
  const normaliseList = (list: any[] | undefined): any[] | undefined =>
    Array.isArray(list) ? list.map(normaliseField) : list;

  // Phase N.4: dedupe with the highlight strip — when authors include a
  // field in `record:highlights` we drop it from the details grid so it
  // isn't shown twice. The synth pipeline passes the highlight list via
  // `hideFields`; authors can also set it directly on the schema. We also
  // merge in any field names registered live via HighlightFieldsContext
  // (see `liveHighlightNames` above) to cover hand-authored Lightning pages
  // that don't go through the synth dedup path.
  const hideFieldNames = new Set<string>(
    (Array.isArray((schema as any).hideFields) ? (schema as any).hideFields : [])
      .map((n: any) => (typeof n === 'string' ? n : fieldName(n)))
      .filter((n: any): n is string => !!n),
  );
  for (const n of liveHighlightNames) hideFieldNames.add(n);

  // Phase P.0: also hide the field that's already shown as the page H1
  // title. The header chip resolves the title from objectSchema.primaryField
  // → common display fields (name/full_name/title/subject/display_name).
  // Repeating that same value in the body grid is pure duplication —
  // every record detail page used to show "客户名称: Acme Corporation"
  // immediately below an H1 that said "Acme Corporation". Authors who
  // want the field anyway can override via the schema (we only add it
  // when the field exists in the data and the dedup wouldn't empty the
  // section).
  const objSchema: any = (ctx as any).objectSchema;
  const data: any = ctx.data ?? {};
  const titleCandidates = [
    objSchema?.primaryField,
    'name',
    'full_name',
    'title',
    'subject',
    'display_name',
    'label',
  ].filter((n): n is string => typeof n === 'string' && n.length > 0);
  for (const candidate of titleCandidates) {
    if (data[candidate] !== undefined && data[candidate] !== null && data[candidate] !== '') {
      hideFieldNames.add(candidate);
      break;
    }
  }

  const dropHidden = (list: any[] | undefined): any[] | undefined => {
    if (!list || hideFieldNames.size === 0) return list;
    return list.filter((e) => {
      const n = fieldName(e);
      return n ? !hideFieldNames.has(n) : true;
    });
  };

  const filteredFields = dropHidden(normaliseList(filterList(schema.fields as any[])));
  const filteredSections = Array.isArray(schema.sections)
    ? (schema.sections as any[]).map((s) => {
        const rawTitle = s.title ?? s.label;
        // Translate the section label when authors provided a stable `name`.
        // Convention: `{ns}.objects.{objectName}._sections.{name}.label`.
        // Falls back to the raw English label when no translation exists.
        const translatedTitle = s.name && objectName
          ? sectionLabel(objectName, s.name, rawTitle ?? s.name)
          : rawTitle;
        return ({
        ...s,
        title: translatedTitle,
        // Titled sections get a Card wrapper for visual grouping. Untitled
        // flat sections stay borderless so the page chrome alone provides
        // containment. Authors can override explicitly via `showBorder`.
        showBorder: s.showBorder ?? (translatedTitle ? true : false),
        // Phase N: default to hide-empty so pages don't render as label
        // graveyards on first load. Authors can opt back in to showing
        // empty rows by setting `hideEmpty: false` explicitly. The
        // "显示 N 个空字段" toggle in DetailSection still works as the
        // user-facing escape hatch.
        hideEmpty: s.hideEmpty ?? true,
        fields: dropHidden(normaliseList(filterList(s.fields))),
      });
      })
    : schema.sections;

  // Inline-edit by default, but gated by the object's lifecycle: system /
  // append-only / better-auth objects are not user-editable, so the per-field
  // double-click / pencil affordances must not be offered on them. This mirrors
  // resolveCrudAffordances (app-shell/utils/crudAffordances.ts) — duplicated
  // here because plugin-detail cannot depend on app-shell; keep the two in
  // lockstep. Previously this gate was carried only by the `sys_inline_edit`
  // header button (removed in #2401); now that double-click is the entry point
  // the object-editability check has to live at the field-render source.
  // Authors can still force-disable with `inlineEdit: false`.
  const NON_EDITABLE_BUCKETS = new Set(['system', 'append-only', 'better-auth']);
  const managedBy = objSchema?.managedBy as string | undefined;
  const userEditOverride = (objSchema?.userActions as { edit?: boolean } | undefined)?.edit;
  const objectInlineEditable =
    userEditOverride ?? !(managedBy != null && NON_EDITABLE_BUCKETS.has(managedBy));
  const inlineEditDefault = (schema.inlineEdit ?? true) && objectInlineEditable;

  const synthesized: any = {
    type: 'detail-view',
    objectName: ctx.objectName,
    resourceId: ctx.recordId as any,
    data: ctx.data,
    layout,
    columns: schema.columns,
    sections: filteredSections,
    fields: filteredFields,
    showBack: false,
    // Suppress DetailView's own Airtable-style header chip. When
    // record:details is composed under a Lightning page:header the inner
    // title/star/copy chip would duplicate the surrounding page header.
    showHeader: schema.showHeader ?? false,
    inlineEdit: inlineEditDefault,
  };

  return (
    <div className={className} {...designer}>
      <DetailView
        schema={synthesized}
        dataSource={ctx.dataSource as any}
        inlineEdit={inlineEditDefault}
        onFieldSave={handleInlineFieldSave}
      />
      <ConcurrentUpdateDialog
        open={!!conflict}
        conflict={conflict}
        busy={conflictBusy}
        onCancel={closeConflict}
        onReload={handleConflictReload}
        onOverwrite={handleConflictOverwrite}
      />
    </div>
  );
};

export default RecordDetailsRenderer;
