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

/**
 * One `ComponentRendererProps` (objectui#4594).
 *
 * This package used to hand-declare `interface ComponentRendererProps
 * { schema: SchemaNode; [key: string]: any }` here — two lines below `SchemaNode`
 * and against `@object-ui/types`' generic
 * `ComponentRendererProps< TSchema extends BaseSchema = BaseSchema >`. Same name,
 * two packages the same consumers import together: the second such pair in this
 * one file, and the third across this fault line after `SchemaNode` (#4580) and
 * `ComponentInput` (#4972).
 *
 * **`@object-ui/types`' generic declaration wins**, and is RE-EXPORTED rather
 * than restated, so there is exactly one declaration left to disagree with — a
 * structural copy would reproduce the defect the moment either side moved.
 *
 * Reconciled now, at **zero consumers** — re-verified on the merged ref rather
 * than inherited from the card: repo-wide, `ComponentRendererProps` occurred only
 * at the two declarations, each package's own entry re-export, and one line of
 * `packages/components/CHANGELOG.md` recording that nothing used it. Zero
 * consumers is why this is cheap today and would not stay cheap: the day someone
 * imports it, which declaration they get decides whether a primitive node is
 * admissible.
 *
 * ## What the re-export moves, and how that was measured
 *
 * It is NOT surface-neutral, and the gauge that would have said so is vacuous.
 * `core/src/index.ts` is a 95-line `export *` barrel; `core/dist/index.d.ts` is
 * therefore byte-identical under ANY change to a re-exported module and cannot
 * fail for this change class (objectui#5673 — which is also why the sentence
 * above `SchemaNode` citing that byte-identity is not repeated here).
 *
 * Measured instead by resolving the symbol through the TypeScript CHECKER from
 * `core/dist/index.d.ts`, over a `dist/` + `tsconfig.tsbuildinfo` clean rebuild
 * on both legs (the build info lives outside `dist/`, so composite `tsc` skips
 * emit if it survives and two stale trees compare equal for free):
 *
 * ```
 * before   ComponentRendererProps            schema: BaseSchema | string | number | boolean | null | undefined
 * after    ComponentRendererProps<TSchema>   schema: TSchema  (TSchema extends BaseSchema = BaseSchema)
 * ```
 *
 * So `schema` NARROWS back to the object form — core's copy had silently widened
 * when #4608 made `SchemaNode` a re-export of types' union, which is the interim
 * state this card closes — and the type gains a parameter. Nothing downstream
 * can observe either move, because nothing imports it.
 *
 * The collision is only observable from a package that resolves BOTH through
 * `node_modules`; the pin therefore lives in `@object-ui/react`
 * (`src/__tests__/ComponentRendererProps.reconciliation.test.ts`), not here —
 * same position, same reason, as `SchemaNode`'s pin above.
 */
export type { ComponentRendererProps } from '@object-ui/types';
