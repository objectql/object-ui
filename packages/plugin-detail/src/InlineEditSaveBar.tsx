/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * InlineEditSaveBar — the record-level sticky Save/Cancel bar for inline edit
 * (objectui#2407 P1). Reads the shared `InlineEditContext` (draft / editing /
 * saving / error) and commits the WHOLE draft in ONE atomic write, so
 * cross-field validation runs against a consistent record instead of the old
 * per-field save-on-blur loop.
 *
 * Two persistence modes:
 *   - **DataSource mode** (record page): one `dataSource.update(obj, id, draft,
 *     { ifMatch: data.updated_at })` → `refresh()`. A `409 CONCURRENT_UPDATE`
 *     opens `<ConcurrentUpdateDialog>` (reload / overwrite), reusing the OCC UX
 *     that previously lived in `record:details`.
 *   - **Callback mode** (standalone drawer): loops a caller-supplied
 *     `onFieldSave(field, value)` over the draft, preserving the drawer's
 *     existing per-field persistence contract with plugin-gantt/calendar/kanban.
 *
 * The bar renders nothing unless the record is actively being edited.
 */

import * as React from 'react';
import { Button, cn } from '@object-ui/components';
import { Check, X, Loader2 } from 'lucide-react';
import { useInlineEdit } from '@object-ui/react';
import { useDetailTranslation } from './useDetailTranslation';
import {
  ConcurrentUpdateDialog,
  isConcurrentUpdateError,
  type ConcurrentUpdateConflict,
} from './ConcurrentUpdateDialog';

export interface InlineEditSaveBarProps {
  /** DataSource for the atomic-update path (record page). */
  dataSource?: any;
  /** Object machine name for the atomic-update path. */
  objectName?: string;
  /** Record id for the atomic-update path. */
  recordId?: string | number | null;
  /** Current server record — supplies `updated_at` for the OCC `ifMatch` token. */
  data?: any;
  /** Re-fetch the record after a successful save / reload. */
  refresh?: () => void | Promise<void>;
  /** Map a field machine name to a user-facing label (for the conflict dialog). */
  fieldLabelFor?: (name: string) => string | undefined;
  /**
   * Callback-persistence mode (drawer): when provided, the save loops this
   * per-field callback over the draft instead of issuing a DataSource update.
   * Takes precedence over the DataSource path.
   */
  onFieldSave?: (field: string, value: any) => void | Promise<void>;
  /** When true, disables Save and shows a lock hint (e.g. approval-locked). */
  locked?: boolean;
  /** Tooltip/label explaining why the record is locked. */
  lockedHint?: string;
  className?: string;
}

/** Strip noisy backend prefixes so the inline error reads cleanly. */
function cleanError(err: any): string {
  const raw = err?.message || err?.error || String(err ?? 'Save failed');
  return String(raw)
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^[A-Z][A-Z0-9_]+:\s*/, '');
}

/**
 * Issue a partial-record update through whichever method the DataSource
 * exposes. Mirrors the update/updateOne/patch fallback + `ifMatch` OCC token
 * that `record:details` used for its per-field save.
 */
async function updateVia(
  ds: any,
  objectName: string,
  recordId: string | number,
  patch: Record<string, any>,
  opts?: { ifMatch?: string },
): Promise<void> {
  if (typeof ds?.update === 'function') {
    await ds.update(objectName, recordId, patch, opts);
  } else if (typeof ds?.updateOne === 'function') {
    await ds.updateOne(objectName, recordId, patch, opts);
  } else if (typeof ds?.patch === 'function') {
    await ds.patch(objectName, recordId, patch, opts);
  } else {
    throw new Error(
      '[InlineEditSaveBar] DataSource exposes no update/updateOne/patch method; cannot persist inline edit',
    );
  }
}

export const InlineEditSaveBar: React.FC<InlineEditSaveBarProps> = ({
  dataSource,
  objectName,
  recordId,
  data,
  refresh,
  fieldLabelFor,
  onFieldSave,
  locked = false,
  lockedHint,
  className,
}) => {
  const { t } = useDetailTranslation();
  const inline = useInlineEdit();
  const [conflict, setConflict] = React.useState<ConcurrentUpdateConflict | null>(null);
  const [conflictBusy, setConflictBusy] = React.useState(false);

  const canAtomic = !!dataSource && !!objectName && recordId != null;

  /**
   * Build the conflict payload for `<ConcurrentUpdateDialog>` from a 409. A
   * single-field draft shows the classic per-field before/after; a multi-field
   * draft shows a record-level summary (the dialog JSON-stringifies objects).
   */
  const buildConflict = React.useCallback(
    (draft: Record<string, any>, err: any): ConcurrentUpdateConflict => {
      const keys = Object.keys(draft);
      const current = (err?.currentRecord ?? null) as Record<string, unknown> | null;
      if (keys.length === 1) {
        const f = keys[0];
        return {
          field: f,
          label: fieldLabelFor?.(f),
          pendingValue: draft[f],
          currentValue: current ? current[f] : undefined,
          currentVersion: err?.currentVersion,
          currentRecord: current,
        };
      }
      const currentSubset = current
        ? Object.fromEntries(keys.map((k) => [k, current[k]]))
        : undefined;
      return {
        field: keys.join(', '),
        label: t('detail.concurrentUpdateRecordLabel', { defaultValue: 'this record' }),
        pendingValue: draft,
        currentValue: currentSubset,
        currentVersion: err?.currentVersion,
        currentRecord: current,
      };
    },
    [fieldLabelFor, t],
  );

  const handleSave = React.useCallback(async () => {
    if (!inline) return;
    const draft = inline.draft;
    const entries = Object.entries(draft);
    // No edits staged → just leave edit mode (matches the old empty-save path).
    if (entries.length === 0) {
      inline.reset();
      return;
    }
    inline.setSaving(true);
    inline.setError(null);
    try {
      if (onFieldSave) {
        // Callback mode (drawer): persist each edited field sequentially so a
        // single backend rejection short-circuits, preserving the caller's
        // per-field contract.
        for (const [field, value] of entries) {
          await onFieldSave(field, value);
        }
      } else if (canAtomic) {
        // DataSource mode (record page): ONE atomic write of only the edited
        // keys, OCC-guarded by the record's current updated_at.
        const ifMatch =
          typeof data?.updated_at === 'string' ? (data.updated_at as string) : undefined;
        await updateVia(dataSource, objectName!, recordId!, draft, ifMatch ? { ifMatch } : undefined);
        await refresh?.();
      }
      inline.reset();
    } catch (err) {
      if (isConcurrentUpdateError(err) && canAtomic) {
        // Stay in edit mode; the dialog drives reload / overwrite.
        setConflict(buildConflict(draft, err));
      } else {
        inline.setError(cleanError(err));
      }
    } finally {
      inline.setSaving(false);
    }
  }, [inline, onFieldSave, canAtomic, data, dataSource, objectName, recordId, refresh, buildConflict]);

  const closeConflict = React.useCallback(() => {
    setConflict(null);
    setConflictBusy(false);
  }, []);

  const handleConflictReload = React.useCallback(async () => {
    setConflictBusy(true);
    try {
      await refresh?.();
    } finally {
      // Discard the pending draft — the user chose the server's version.
      inline?.reset();
      closeConflict();
    }
  }, [refresh, inline, closeConflict]);

  const handleConflictOverwrite = React.useCallback(async () => {
    if (!conflict || !canAtomic) {
      closeConflict();
      return;
    }
    setConflictBusy(true);
    try {
      // Re-key the write against the version the server reported in the 409 —
      // "I've seen the newer record, apply my whole draft on top of it."
      const draft = inline?.draft ?? {};
      const opts = conflict.currentVersion ? { ifMatch: conflict.currentVersion } : undefined;
      await updateVia(dataSource, objectName!, recordId!, draft, opts);
      await refresh?.();
      inline?.reset();
    } catch (err) {
      inline?.setError(cleanError(err));
    } finally {
      closeConflict();
    }
  }, [conflict, canAtomic, inline, dataSource, objectName, recordId, refresh, closeConflict]);

  // Render nothing unless a provider is present and the record is being edited.
  if (!inline || !inline.editing) return null;

  return (
    <>
      <div
        className={cn(
          'sticky bottom-0 z-30 mt-4 flex flex-wrap items-center justify-end gap-2 rounded-md border bg-background/95 px-3 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80',
          className,
        )}
        role="region"
        aria-label={t('detail.editFieldsInline')}
      >
        {inline.error && (
          <div
            role="alert"
            className="mr-auto max-w-md rounded-md border border-destructive/20 bg-destructive/10 px-2 py-1 text-xs text-destructive"
          >
            {inline.error}
          </div>
        )}
        {/* The lock REASON is surfaced by DetailView's approval-lock band; here
            we only disable Save so a locked record can't be written. */}
        <Button
          variant="ghost"
          size="sm"
          onClick={inline.cancel}
          disabled={inline.saving}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          <span>{t('detail.cancel')}</span>
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={inline.saving || locked}
          className="gap-2"
          title={locked ? lockedHint : undefined}
        >
          {inline.saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          <span>{inline.saving ? t('detail.saving') : t('detail.save')}</span>
        </Button>
      </div>
      <ConcurrentUpdateDialog
        open={!!conflict}
        conflict={conflict}
        busy={conflictBusy}
        onCancel={closeConflict}
        onReload={handleConflictReload}
        onOverwrite={handleConflictOverwrite}
      />
    </>
  );
};

export default InlineEditSaveBar;
