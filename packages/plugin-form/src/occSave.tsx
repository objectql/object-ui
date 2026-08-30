/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * occSave — Optimistic Concurrency Control for the record edit forms.
 *
 * Every form variant (ObjectForm / ModalForm / DrawerForm / TabbedForm /
 * SplitForm / WizardForm) reads the record with `findOne` and later writes it
 * back with `dataSource.update`. Without a version token that write is
 * last-write-wins: two users editing the same record both get a 200 and the
 * later save silently erases the earlier one. The server already supports
 * conditional writes (`If-Match: <updated_at>` → `409 CONCURRENT_UPDATE`), and
 * the DataSource contract forwards it via `update(..., { ifMatch })` — the
 * forms were the only link in the chain not sending it.
 *
 * `useOccSave` centralises the guarded write:
 *   1. `update` is issued with `ifMatch` = the `updated_at` the form read.
 *   2. On `409 CONCURRENT_UPDATE` a dialog offers **Keep editing** (stay in
 *      the form, draft intact) or **Overwrite** (retry re-keyed to the
 *      server's `currentVersion` — "I know it changed, mine wins").
 *
 * Records without a string `updated_at` (older backends, objects without
 * timestamps) degrade gracefully: no token is sent and behaviour is unchanged.
 * The richer reload-and-compare resolution lives in the record page's inline
 * edit (`plugin-detail`'s ConcurrentUpdateDialog); a modal form has no server
 * rendering of its own to reload into, so it keeps the choice binary.
 */

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  buttonVariants,
  cn,
} from '@object-ui/components';
import { AlertTriangle } from 'lucide-react';
import { createSafeTranslation } from '@object-ui/i18n';
import { declaredUserMessage } from '@object-ui/react';

// Localized strings for the conflict dialog. Falls back to English when no
// i18n provider is mounted (createSafeTranslation handles that).
const useOccTranslation = createSafeTranslation(
  {
    'form.conflictTitle': 'Save conflict',
    'form.conflictMessage':
      'This record was changed by someone else while you were editing. '
      + 'Overwriting will replace their changes with yours.',
    'form.conflictLatestVersion': 'Their save: {{time}}',
    'form.conflictOverwrite': 'Overwrite',
    'form.keepEditing': 'Keep editing',
  },
  'form.conflictTitle',
);

/**
 * The OCC token for a record the form previously read: its `updated_at`.
 * Anything non-string (missing column, pre-OCC backend) yields `undefined`,
 * which downgrades the write to unguarded — exactly the old behaviour.
 */
export function occVersionOf(record: unknown): string | undefined {
  const v = (record as Record<string, unknown> | null | undefined)?.updated_at;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Duck-typed detection of the platform's 409 CONCURRENT_UPDATE, matching
 * `@object-ui/data-objectstack`'s `ConcurrentUpdateError` without depending on
 * that adapter (plugin-form is adapter-agnostic; a custom DataSource may throw
 * its own error object with the same wire `code`).
 */
export function isConcurrentUpdateError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as Record<string, unknown>;
  return e.code === 'CONCURRENT_UPDATE' || e.name === 'ConcurrentUpdateError';
}

export type OccSaveOutcome =
  /** The write landed (guarded, or deliberately overwritten). */
  | { status: 'saved'; result: any }
  /** The user chose to keep editing after a conflict — nothing was written. */
  | { status: 'cancelled' };

export interface OccSaveArgs {
  dataSource: any;
  objectName: string;
  recordId: string | number;
  payload: Record<string, any>;
  /**
   * The record as the form read it (`findOne` result) — supplies the
   * `updated_at` version token. Optional: without it the write is unguarded.
   */
  baseRecord?: unknown;
}

interface ConflictState {
  /** Latest server-side version from the 409, for the overwrite retry. */
  currentVersion?: string;
  /**
   * The refusal text the PRODUCER marked as addressed to the end user
   * (`userMessage`, objectstack#9934), or `undefined` when the 409 carried no
   * marking. Read through `declaredUserMessage`, never duck-typed here: the
   * marking lands in two different places depending on which error the adapter
   * built (a typed member on `ConcurrentUpdateError`, the details bag on
   * `DataApiValidationError`), and that reader is the one place that knows both.
   */
  userMessage?: string;
}

/** Backend ships SQL-style "YYYY-MM-DD HH:mm:ss.SSS"; normalise for Date. */
function formatVersionTime(raw: string | undefined): string | null {
  if (!raw) return null;
  const iso = /\d{4}-\d{2}-\d{2}[ T]/.test(raw) ? raw.replace(' ', 'T') : raw;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
}

/**
 * OCC-guarded record update for the form variants.
 *
 * Returns `{ saveWithOcc, conflictDialog }`: call `saveWithOcc` where the
 * variant issued its raw `dataSource.update`, and render `conflictDialog`
 * anywhere in the variant's tree (it portals). A `cancelled` outcome means the
 * user kept editing — skip the success path and leave the form open.
 */
export function useOccSave(): {
  saveWithOcc: (args: OccSaveArgs) => Promise<OccSaveOutcome>;
  conflictDialog: React.ReactNode;
} {
  const { t } = useOccTranslation();
  const [conflict, setConflict] = React.useState<ConflictState | null>(null);
  // Resolver for the promise `saveWithOcc` awaits while the dialog is open.
  const decisionRef = React.useRef<((overwrite: boolean) => void) | null>(null);

  const settle = React.useCallback((overwrite: boolean) => {
    decisionRef.current?.(overwrite);
    decisionRef.current = null;
    setConflict(null);
  }, []);

  // If the host unmounts mid-conflict (modal torn down), resolve as
  // "keep editing" so the awaiting submit never hangs.
  React.useEffect(() => () => decisionRef.current?.(false), []);

  const saveWithOcc = React.useCallback(
    async ({ dataSource, objectName, recordId, payload, baseRecord }: OccSaveArgs): Promise<OccSaveOutcome> => {
      const ifMatch = occVersionOf(baseRecord);
      try {
        const result = await dataSource.update(
          objectName, recordId, payload, ifMatch ? { ifMatch } : undefined,
        );
        return { status: 'saved', result };
      } catch (err) {
        if (!isConcurrentUpdateError(err)) throw err;
        const currentVersion = (err as { currentVersion?: unknown }).currentVersion;
        // A 409 an author MARKED says something this dialog's canned copy
        // cannot — which record, which team, what to do next. It used to be
        // dropped here, so every conflict read identically no matter what the
        // producer wrote (objectui#5902, inheriting objectui#5210's ruling).
        // Everything unmarked still answers `null`, so objectstack#3821's
        // protection is untouched.
        const marked = declaredUserMessage(err);
        const overwrite = await new Promise<boolean>((resolve) => {
          decisionRef.current = resolve;
          setConflict({
            currentVersion: typeof currentVersion === 'string' ? currentVersion : undefined,
            userMessage: marked ?? undefined,
          });
        });
        if (!overwrite) return { status: 'cancelled' };
        // Re-key against the version the 409 reported: "apply my payload on
        // top of the record I now know about". Without one, fall back to an
        // unguarded write — the user explicitly chose to win.
        const cv = typeof currentVersion === 'string' && currentVersion.length > 0
          ? currentVersion
          : undefined;
        const result = await dataSource.update(
          objectName, recordId, payload, cv ? { ifMatch: cv } : undefined,
        );
        return { status: 'saved', result };
      }
    },
    [],
  );

  const latestTime = formatVersionTime(conflict?.currentVersion);

  const conflictDialog = (
    <AlertDialog open={!!conflict} onOpenChange={(open) => { if (!open) settle(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
            {t('form.conflictTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {/*
              The producer's marking leads, in its own right — and does NOT
              replace the sentence under it. That sentence does two jobs in one
              paragraph: it says why the write was refused, AND it explains what
              the destructive button will do. `userMessage` is a refusal
              message, not affordance copy this surface owns, so evicting the
              paragraph would leave "Overwrite" unexplained on the one surface
              where the choice is irreversible. Rendered verbatim: the author
              already wrote and localized it for their user.
            */}
            {conflict?.userMessage && (
              <span className="mb-2 block font-medium text-foreground">
                {conflict.userMessage}
              </span>
            )}
            {t('form.conflictMessage')}
            {latestTime && (
              <span className="mt-2 block text-xs text-muted-foreground">
                {t('form.conflictLatestVersion', { time: latestTime })}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <button
            type="button"
            className={cn(buttonVariants({ variant: 'outline' }))}
            onClick={() => settle(false)}
          >
            {t('form.keepEditing')}
          </button>
          <button
            type="button"
            className={cn(buttonVariants({ variant: 'destructive' }))}
            onClick={() => settle(true)}
          >
            {t('form.conflictOverwrite')}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { saveWithOcc, conflictDialog };
}
