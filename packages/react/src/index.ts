/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export * from './SchemaRenderer';
export * from './hooks'; // will be empty for now
export * from './context'; // will be empty for now
export * from './LazyPluginLoader';
export * from './spec-bridge';
export * from './data-invalidation';

// i18n utilities
export { resolveI18nLabel } from './utils/i18n';

// Write-error surfacing utilities (shared by drag-write plugins so a failed
// PATCH — e.g. an RLS 403 — is never silently swallowed).
export { extractWriteErrorMessage, isPermissionError } from './utils/error-message';

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

