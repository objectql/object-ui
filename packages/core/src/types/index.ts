/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * One `SchemaNode` (objectui#4580).
 *
 * This package used to hand-declare `interface SchemaNode { type: string; …
 * [key: string]: any }` here, while `@object-ui/types` exported
 * `type SchemaNode = BaseSchema | string | number | boolean | null | undefined`
 * — two different types under one name, from two packages the same consumers
 * import together. Which declaration a call site got depended on which package
 * it happened to import from, and #4548's option-A canary measured **19 of 35**
 * errors as exactly that collision:
 *
 * ```
 * Type 'import(".../packages/types/dist/base").SchemaNode' is not assignable to
 * type 'import(".../packages/core/dist/types/index").SchemaNode'
 * ```
 *
 * PR #4578 sidestepped it — `SchemaRenderer` states its own component-level
 * union rather than picking a side — and left the reconciliation to this card.
 *
 * **`@object-ui/types`' union wins**, per #4580's ruling 1: it is the spec of
 * record (its own doc comment names `'Plain string'` a valid node), and it is
 * the side the measured collisions resolve toward. The declaration is RE-EXPORTED
 * rather than restated, so there is exactly one declaration left to disagree
 * with — a structural copy would reproduce the defect the moment either side
 * moved. This package already depends on `@object-ui/types`, so the edge exists
 * and adds no cycle, and core's own entry surface is unchanged (`dist/index.d.ts`
 * is byte-identical across the change — measured, both rounds).
 *
 * The collision is only observable from a package that resolves BOTH through
 * `node_modules`; the pin therefore lives in `@object-ui/react`
 * (`src/__tests__/SchemaNode.reconciliation.test.ts`), not here.
 */
export type { SchemaNode } from '@object-ui/types';

import type { SchemaNode } from '@object-ui/types';

/**
 * ⛔ Deliberately NOT reconciled with `@object-ui/types`' `ComponentRendererProps`
 * (objectui#4594). The two declarations differ — types' is generic
 * (`< TSchema extends BaseSchema = BaseSchema >`), this one is not — but that
 * card measured **zero consumers** of this declaration, so reconciling it here
 * would be an unmeasured change riding a card that was scoped to `SchemaNode`.
 * It stays dual-declared until #4594 is dispatched on its own evidence.
 */
export interface ComponentRendererProps {
  schema: SchemaNode;
  [key: string]: any;
}
