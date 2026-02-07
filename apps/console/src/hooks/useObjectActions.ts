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

import { useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useActionRunner } from '@object-ui/react';
import type { ActionResult } from '@object-ui/core';

interface ObjectActionConfig {
  objectName: string;
  objectLabel?: string;
  dataSource: any;
  onEdit?: (record: any) => void;
  onRefresh?: () => void;
}

interface ObjectActions {
  /** Run an action by schema or type string */
  execute: (action: any) => Promise<ActionResult>;
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
}: ObjectActionConfig): ObjectActions {
  const navigate = useNavigate();
  const { appName } = useParams();
  const baseUrl = `/apps/${appName}`;

  const context = useMemo(
    () => ({
      objectName,
      objectLabel: objectLabel || objectName,
      baseUrl,
    }),
    [objectName, objectLabel, baseUrl],
  );

  const { execute, loading, error, runner } = useActionRunner(context);

  // Register custom handlers
  useMemo(() => {
    // Handler: create
    runner.registerHandler('create', async () => {
      onEdit?.(null);
      return { success: true };
    });

    // Handler: delete
    runner.registerHandler('delete', async (action) => {
      const recordId = action.params?.recordId || action.recordId;
      if (!recordId) return { success: false, error: 'No record ID provided' };

      try {
        await dataSource.delete(objectName, recordId);
        onRefresh?.();
        return { success: true, reload: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    // Handler: navigate
    runner.registerHandler('navigate', async (action) => {
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
  }, [runner, objectName, dataSource, onEdit, onRefresh, navigate, baseUrl]);

  const create = useCallback(() => {
    onEdit?.(null);
  }, [onEdit]);

  const deleteRecord = useCallback(
    async (recordId: string) => {
      return execute({ type: 'delete', params: { recordId } });
    },
    [execute],
  );

  const navigateToView = useCallback(
    (viewId: string) => {
      navigate(`${baseUrl}/${objectName}/view/${viewId}`);
    },
    [navigate, baseUrl, objectName],
  );

  const navigateToRecord = useCallback(
    (recordId: string) => {
      navigate(`${baseUrl}/${objectName}/record/${recordId}`);
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
