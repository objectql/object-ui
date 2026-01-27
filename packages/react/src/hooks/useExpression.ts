/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import { ExpressionEvaluator } from '@object-ui/core';

/**
 * Hook for evaluating expressions with dynamic context
 * 
 * @example
 * ```tsx
 * const isVisible = useExpression('${data.age >= 18}', { data });
 * const label = useExpression('Hello ${user.name}!', { user });
 * ```
 */
export function useExpression(
  expression: string | boolean | number | null | undefined,
  context: Record<string, any> = {}
): any {
  const evaluator = useMemo(
    () => new ExpressionEvaluator(context),
    [JSON.stringify(context)]
  );

  return useMemo(
    () => evaluator.evaluate(expression),
    [evaluator, expression]
  );
}

/**
 * Hook for evaluating conditional expressions
 * Returns a boolean value
 * 
 * @example
 * ```tsx
 * const isVisible = useCondition('${data.status === "active"}', { data });
 * ```
 */
export function useCondition(
  condition: string | boolean | undefined,
  context: Record<string, any> = {}
): boolean {
  const evaluator = useMemo(
    () => new ExpressionEvaluator(context),
    [JSON.stringify(context)]
  );

  return useMemo(
    () => evaluator.evaluateCondition(condition),
    [evaluator, condition]
  );
}
