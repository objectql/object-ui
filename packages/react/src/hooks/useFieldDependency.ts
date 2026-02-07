/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * useFieldDependency
 *
 * A hook for evaluating FormField.dependsOn and FormField.visibleOn at runtime.
 * When a parent field (dependsOn) changes value, dependent fields can:
 *   1. Re-evaluate their visibility via visibleOn expressions
 *   2. Clear their value (optional, via resetOnChange)
 *   3. Reload options (for select/lookup fields whose options depend on the parent)
 *
 * @module hooks/useFieldDependency
 */

import { useMemo, useCallback } from 'react';
import { ExpressionEvaluator } from '@object-ui/core';

/**
 * Field dependency configuration
 */
export interface FieldDependencyConfig {
  /** Field name */
  name: string;
  /** Parent field name this field depends on */
  dependsOn?: string;
  /** Visibility condition expression (e.g., "${data.country === 'US'}") */
  visibleOn?: string;
  /** Whether the field is explicitly hidden */
  hidden?: boolean;
  /** Whether to reset the field value when the parent changes */
  resetOnChange?: boolean;
}

/**
 * Field dependency evaluation result
 */
export interface FieldDependencyResult {
  /** Whether the field should be visible */
  isVisible: boolean;
  /** The resolved parent field value (from dependsOn) */
  parentValue: unknown;
  /** Whether the parent field value has changed (useful for option reloading) */
  parentFieldName: string | undefined;
}

/**
 * Evaluate visibility for a single field given form data.
 */
export function evaluateFieldVisibility(
  config: FieldDependencyConfig,
  formData: Record<string, any>
): boolean {
  // Explicitly hidden fields are always hidden
  if (config.hidden) {
    return false;
  }

  // No visibleOn expression → always visible
  if (!config.visibleOn) {
    return true;
  }

  try {
    const evaluator = new ExpressionEvaluator({ data: formData, form: formData });
    const result = evaluator.evaluateCondition(config.visibleOn);
    return result;
  } catch {
    // On evaluation failure, default to visible
    return true;
  }
}

/**
 * Evaluate dependencies for multiple fields at once.
 * Returns a map of fieldName → isVisible.
 */
export function evaluateFieldDependencies(
  fields: FieldDependencyConfig[],
  formData: Record<string, any>
): Record<string, boolean> {
  const result: Record<string, boolean> = {};

  for (const field of fields) {
    result[field.name] = evaluateFieldVisibility(field, formData);
  }

  return result;
}

export interface UseFieldDependencyOptions {
  /** Field dependency configurations */
  fields: FieldDependencyConfig[];
  /** Current form data (watched values) */
  formData: Record<string, any>;
}

/**
 * Hook for evaluating field dependencies in a form.
 *
 * @example
 * ```tsx
 * const { getFieldVisibility, getFieldsToReset } = useFieldDependency({
 *   fields: [
 *     { name: 'country', visibleOn: undefined },
 *     { name: 'state', dependsOn: 'country', visibleOn: "${data.country !== ''}" },
 *     { name: 'city', dependsOn: 'state', visibleOn: "${data.state !== ''}" },
 *   ],
 *   formData: watchedValues,
 * });
 * ```
 */
export function useFieldDependency(options: UseFieldDependencyOptions) {
  const { fields, formData } = options;

  /** Map of fieldName → isVisible, memoized on formData changes */
  const visibilityMap = useMemo(
    () => evaluateFieldDependencies(fields, formData),
    [fields, formData]
  );

  /** Check if a specific field is visible */
  const getFieldVisibility = useCallback(
    (fieldName: string): boolean => {
      return visibilityMap[fieldName] ?? true;
    },
    [visibilityMap]
  );

  /**
   * Get fields that should be reset when a parent field changes.
   * Call this when you detect a parent field value change.
   */
  const getDependentFields = useCallback(
    (parentFieldName: string): string[] => {
      return fields
        .filter((f) => f.dependsOn === parentFieldName)
        .map((f) => f.name);
    },
    [fields]
  );

  /**
   * Get parent value for a dependent field.
   */
  const getParentValue = useCallback(
    (fieldName: string): unknown => {
      const field = fields.find((f) => f.name === fieldName);
      if (!field?.dependsOn) return undefined;
      return formData[field.dependsOn];
    },
    [fields, formData]
  );

  return {
    visibilityMap,
    getFieldVisibility,
    getDependentFields,
    getParentValue,
  };
}
