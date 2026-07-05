/**
 * useObjectActions Hook
 *
 * Provides action handlers for CRUD operations on an object, backed by
 * the ActionRunner from @object-ui/core via the useActionRunner hook.
 *
 * Supports:
 * - create: Open create dialog
 * - delete: Delete a record with confirmation
 * - navigate: Route to a specific view or record
 * - refresh: Trigger a data refresh
 */

import { useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useActionRunner } from '@object-ui/react';
import { useObjectTranslation } from '@object-ui/i18n';
import { toast } from 'sonner';
import type { ActionDef, ActionResult } from '@object-ui/core';

interface ObjectActionConfig {
  objectName: string;
  objectLabel?: string;
  dataSource: any;
  onEdit?: (record: any) => void;
  onRefresh?: () => void;
  /** Optional shadcn-style confirm handler — falls back to window.confirm */
  onConfirm?: (message: string, options?: { title?: string; confirmText?: string; cancelText?: string }) => Promise<boolean>;
  /** Optional toast handler — falls back to sonner */
  onToast?: (message: string, options?: { type?: string }) => void;
}

interface ObjectActions {
  /** Run an action by schema or type string */
  execute: (action: ActionDef) => Promise<ActionResult>;
  /** Create new record — opens the create dialog */
  create: () => void;
  /** Delete a record by id */
  deleteRecord: (recordId: string) => Promise<ActionResult>;
  /** Navigate to a view */
  navigateToView: (viewId: string) => void;
  /** Navigate to a record detail */
  navigateToRecord: (recordId: string) => void;
  /** Whether an action is currently executing */
  loading: boolean;
  /** Last error message */
  error: string | null;
}

export function useObjectActions({
  objectName,
  objectLabel,
  dataSource,
  onEdit,
  onRefresh,
  onConfirm,
  onToast,
}: ObjectActionConfig): ObjectActions {
  const navigate = useNavigate();
  const { appName } = useParams();
  const { t } = useObjectTranslation();
  const baseUrl = `/apps/${appName}`;

  const { execute, loading, error, runner } = useActionRunner({
    context: {
      objectName,
      objectLabel: objectLabel || objectName,
      baseUrl,
    },
    onConfirm,
    onToast,
  });

  // Register custom handlers
  useEffect(() => {
    // Handler: create
    runner.registerHandler('create', async () => {
      onEdit?.(null);
      return { success: true };
    });

    // Handler: delete
    runner.registerHandler('delete', async (action: any) => {
      // Accept several param shapes used across call sites:
      //   { params: { recordId } }       — toolbar / programmatic deletes
      //   { params: { record } }         — ObjectGrid row dropdown
      //   { params: { records: [...] } } — bulk delete (multi-row)
      //   { recordId } (legacy)          — pre-params shape
      const records = Array.isArray(action.params?.records)
        ? action.params.records.filter((r: any) => r?.id != null)
        : null;

      // Bulk path — delete every record in parallel and report a summary.
      if (records && records.length > 1) {
        const results = await Promise.allSettled(
          records.map((r: any) => dataSource.delete(objectName, r.id)),
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        const succeeded = results.length - failed;
        onRefresh?.();
        if (failed === 0) {
          toast.success(
            t('objectActions.bulkDeleteSuccess', {
              count: succeeded,
              label: objectLabel || objectName,
              defaultValue: `Deleted ${succeeded} ${objectLabel || objectName} records`,
            }),
          );
          // `silent`: the handler already toasted the localized summary above;
          // without this the runner's post-execution hook adds a second, generic
          // "Action completed successfully" toast (double success toast).
          return { success: true, reload: true, silent: true };
        }
        toast.error(
          t('objectActions.bulkDeletePartial', {
            succeeded,
            failed,
            defaultValue: `${succeeded} deleted, ${failed} failed`,
          }),
        );
        // The toast above is the authoritative feedback (it carries the
        // succeeded/failed summary the runner can't reconstruct). Return
        // WITHOUT `error` so the ActionRunner post-execution hook — this runner
        // has a toastHandler (onToast) — doesn't fire a second, duplicate toast.
        return { success: false };
      }

      const recordId =
        action.params?.recordId ??
        action.params?.record?.id ??
        records?.[0]?.id ??
        action.recordId;
      if (!recordId) return { success: false, error: t('objectActions.noRecordId') };

      try {
        await dataSource.delete(objectName, recordId);
        onRefresh?.();
        toast.success(t('objectActions.deleteSuccess', { label: objectLabel || objectName }));
        // `silent`: handler owns the localized success toast above — suppress the
        // runner's generic duplicate (see the bulk branch).
        return { success: true, reload: true, silent: true };
      } catch (err: any) {
        toast.error(t('objectActions.deleteFailed', { label: objectLabel || objectName }), {
          description: err.message,
        });
        // Keep the richer toast above (label + error description) and return
        // WITHOUT `error` so the ActionRunner post-execution hook doesn't toast
        // the raw message a second time. See the bulk branch for the rationale.
        return { success: false };
      }
    });

    // Handler: navigate
    runner.registerHandler('navigate', async (action: any) => {
      const url = action.params?.url || action.url;
      if (url) {
        navigate(url.startsWith('/') ? url : `${baseUrl}/${url}`);
      }
      return { success: true };
    });

    // Handler: refresh
    runner.registerHandler('refresh', async () => {
      onRefresh?.();
      return { success: true, reload: true };
    });
  }, [runner, objectName, dataSource, onEdit, onRefresh, navigate, baseUrl, t, objectLabel]);

  const create = useCallback(() => {
    onEdit?.(null);
  }, [onEdit]);

  const deleteRecord = useCallback(
    async (recordId: string) => {
      return execute({
        type: 'delete',
        confirmText: t('objectActions.deleteConfirm'),
        params: { recordId },
      });
    },
    [execute, t],
  );

  const navigateToView = useCallback(
    (viewId: string) => {
      navigate(`${baseUrl}/${objectName}/view/${viewId}`);
    },
    [navigate, baseUrl, objectName],
  );

  const navigateToRecord = useCallback(
    (recordId: string) => {
      navigate(`${baseUrl}/${objectName}/record/${encodeURIComponent(recordId)}`);
    },
    [navigate, baseUrl, objectName],
  );

  return {
    execute,
    create,
    deleteRecord,
    navigateToView,
    navigateToRecord,
    loading,
    error,
  };
}
