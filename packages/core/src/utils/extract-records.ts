/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Extract an array of records from various API response formats.
 * Supports: raw array, { records: [] }, { data: [] }, { value: [] }.
 *
 * This utility normalises the different shapes returned by ObjectStack,
 * OData, and MSW mock endpoints so that every data-fetching component
 * can rely on a single extraction path.
 */
export function extractRecords(results: unknown): any[] {
  if (Array.isArray(results)) {
    return results;
  }
  if (results && typeof results === 'object') {
    if (Array.isArray((results as any).records)) {
      return (results as any).records;
    }
    if (Array.isArray((results as any).data)) {
      return (results as any).data;
    }
    if (Array.isArray((results as any).value)) {
      return (results as any).value;
    }
  }
  return [];
}
