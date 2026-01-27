/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState, useCallback, useMemo } from 'react';
import { ActionRunner, type ActionContext, type ActionResult } from '@object-ui/core';

/**
 * Hook for executing actions with loading state
 * 
 * @example
 * ```tsx
 * const { execute, loading, error, result } = useActionRunner({ data: formData });
 * 
 * const handleClick = () => {
 *   execute({
 *     type: 'action',
 *     api: '/api/save',
 *     successMessage: 'Saved successfully!'
 *   });
 * };
 * ```
 */
export function useActionRunner(context: ActionContext = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  const runner = useMemo(
    () => new ActionRunner(context),
    [JSON.stringify(context)]
  );

  const execute = useCallback(
    async (action: any): Promise<ActionResult> => {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const actionResult = await runner.execute(action);
        setResult(actionResult);

        if (!actionResult.success) {
          setError(actionResult.error || 'Action failed');
        }

        return actionResult;
      } catch (err) {
        const errorMessage = (err as Error).message;
        setError(errorMessage);
        const failureResult = { success: false, error: errorMessage };
        setResult(failureResult);
        return failureResult;
      } finally {
        setLoading(false);
      }
    },
    [runner]
  );

  const updateContext = useCallback(
    (newContext: Partial<ActionContext>) => {
      runner.updateContext(newContext);
    },
    [runner]
  );

  return {
    execute,
    loading,
    error,
    result,
    updateContext,
    runner
  };
}
