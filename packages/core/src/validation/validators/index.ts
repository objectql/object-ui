/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Validators
 * 
 * Validators for the spec-owned object-level rule vocabulary.
 * 
 * @module validators
 * @packageDocumentation
 */

export {
  ObjectValidationEngine,
  defaultObjectValidationEngine,
  validateRecord,
  type ObjectValidationContext,
  type ObjectValidationResult,
  type ValidationExpressionEvaluator,
} from './object-validation-engine.js';
