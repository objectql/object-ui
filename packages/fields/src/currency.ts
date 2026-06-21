/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Licensed under the MIT license found in the LICENSE file.
 */

/**
 * `resolveFieldCurrency` now lives in `@object-ui/i18n` (co-located with
 * `useLocalization`, which supplies the tenant default). This module re-exports
 * it so the long-standing `@object-ui/fields` import path keeps working for
 * every field/cell renderer that already depends on it.
 */
export { resolveFieldCurrency } from '@object-ui/i18n';
