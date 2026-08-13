/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BaseSchema } from '@object-ui/types';

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

/**
 * A bridge function transforms a spec schema into a schema node tree.
 *
 * Returns **`BaseSchema`**, not `SchemaNode` (objectui#4580, ruling Q4-B).
 * Once core's `SchemaNode` became `@object-ui/types`' union
 * (`BaseSchema | string | number | boolean | null | undefined`), declaring the
 * return as `SchemaNode` made every caller re-ask a question no bridge has ever
 * answered "yes" to: *is this a bare string / null?* Both shipped bridges end
 * in a single `return node` on an object literal — `bridges/list-view.ts:226`
 * and `bridges/form-view.ts:195` — so the wider declaration described nothing
 * real while forcing a narrowing at every read.
 *
 * That cost was measured, not assumed: round 1 of this card recorded **272**
 * mechanical errors across five spec-bridge suites, all of them TS18049
 * (`'node' is possibly 'null' or 'undefined'`) and TS2339
 * (`Property 'formType' does not exist on type
 * 'string | number | boolean | BaseSchema'`) — the union being destructured by
 * tests reading properties off a node the bridge always produces.
 *
 * This is a type ANNOTATION only: no runtime behaviour changes, and the emitted
 * JavaScript is byte-identical (proven by bundle sha256 on this PR).
 */
export type BridgeFn<T = any> = (
  spec: T,
  context: BridgeContext,
) => BaseSchema;
