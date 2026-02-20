/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SchemaNode } from '@object-ui/core';

/** Context passed to all bridge functions */
export interface BridgeContext {
  /** Current user context for permission checks */
  user?: Record<string, any>;
  /** App-level variables */
  variables?: Record<string, any>;
  /** Registered object definitions for field metadata lookup */
  objectDefs?: Record<string, ObjectDefLite>;
}

/** Lightweight object definition for field metadata resolution */
export interface ObjectDefLite {
  name: string;
  label?: string;
  fields: Array<{
    name: string;
    label?: string;
    type: string;
    required?: boolean;
    options?: Array<{ label: string; value: string }>;
  }>;
}

/** A bridge function transforms a spec schema into a SchemaNode tree */
export type BridgeFn<T = any> = (
  spec: T,
  context: BridgeContext,
) => SchemaNode;
