/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export * from './SchemaRenderer.js';
export * from './schema-input.js';
export * from './hooks/index.js'; // will be empty for now
export * from './context/index.js'; // will be empty for now
export * from './LazyPluginLoader.js';
export * from './spec-bridge/index.js';
export * from './data-invalidation.js';
// PageComponentSchema.dataSource — mapping the spec's per-element data binding
// onto the schema keys each object-bound block reads (objectstack#6953).
export * from './element-data-source/ElementDataSourceGate.js';

// i18n utilities
export { resolveKeyedI18nLabel } from './utils/i18n.js';

// Write-error surfacing utilities (shared by drag-write plugins so a failed
// PATCH — e.g. an RLS 403 — is never silently swallowed).
export { extractWriteErrorMessage, isPermissionError, extractFieldErrors, classifyLoadError } from './utils/error-message.js';
export type { WriteFieldError, LoadErrorKind } from './utils/error-message.js';

// Built-in i18n support
export {
  I18nProvider,
  useObjectTranslation,
  useSafeTranslate,
  useObjectLabel,
  useSafeFieldLabel,
  useI18nContext,
  createI18n,
  getDirection,
  getAvailableLanguages,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatCurrency,
  formatNumber,
  type I18nConfig,
  type I18nProviderProps,
  type TranslationKeys,
  type DateFormatOptions,
  type CurrencyFormatOptions,
  type NumberFormatOptions,
} from '@object-ui/i18n';

