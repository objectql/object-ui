/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TenantScopedQueryConfig } from '@object-ui/types';

export interface TenantScopedQueryProps {
  /** Base query/filter */
  filter?: Record<string, unknown>[];
  /** Tenant ID to scope to */
  tenantId: string;
  /** Scoped query configuration */
  config: TenantScopedQueryConfig;
  /** Object name for exclusion check */
  objectName?: string;
}

/**
 * Applies tenant scoping to a query filter.
 * Returns the original filter with tenant isolation applied.
 */
export function TenantScopedQuery({
  filter = [],
  tenantId,
  config,
  objectName,
}: TenantScopedQueryProps): Record<string, unknown>[] {
  // Skip scoping for excluded objects
  if (objectName && config.excludedObjects?.includes(objectName)) {
    return filter;
  }

  if (!config.autoFilter) {
    return filter;
  }

  // Add tenant filter condition
  const tenantFilter = {
    field: config.tenantField,
    operator: '=',
    value: tenantId,
  };

  return [...filter, tenantFilter];
}
