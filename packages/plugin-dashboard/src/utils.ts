/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** Returns true when the widget data config uses provider: 'object' (async data source). */
export function isObjectProvider(widgetData: unknown): widgetData is { provider: 'object'; object?: string; aggregate?: any; filter?: any } {
  return (
    widgetData != null &&
    typeof widgetData === 'object' &&
    !Array.isArray(widgetData) &&
    (widgetData as any).provider === 'object'
  );
}
