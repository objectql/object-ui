/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BaseSchema } from '@object-ui/types';
import type { SchemaRendererProps } from './SchemaRenderer.js';

/**
 * Narrow a loosely-typed metadata node onto {@link SchemaRendererProps.schema}.
 *
 * `@object-ui/types` declares `SchemaNode` as
 * `BaseSchema | string | number | boolean | null | undefined`, and a lot of
 * metadata plumbing (page regions, header-bar actions, detail tabs, view
 * configs) is typed with it. `SchemaRenderer` deliberately does NOT declare the
 * `number` / `boolean` members — nobody should be invited to author them — so
 * forwarding such a value needs one honest step in between.
 *
 * This is that step, and it is a TOTAL function rather than a cast: it maps the
 * two primitive members onto their text form, which is precisely what the
 * renderer's own defensive branch does with them. So it changes no behaviour and
 * tells no lie — the value a caller forwards renders identically whether or not
 * it passes through here.
 *
 * The bridge is PERMANENT — not scaffolding awaiting a merge. The two competing
 * repo-wide `SchemaNode` spellings ARE reconciled (objectui#4580, PR #4608):
 * `@object-ui/core` stopped hand-declaring its own interface and now re-exports
 * `@object-ui/types`' union, so one declaration is left to disagree with. That
 * reconciliation resolved in favour of the UNION, while `SchemaRenderer`'s prop
 * stays deliberately narrow (objectui#4548 ruling Q2 — it declares no `number`
 * or `boolean`), so a `SchemaNode` is now LESS assignable to that prop than it
 * was, not more. This step therefore bridges two intentionally different types,
 * and it stays. ⛔ Do not "tidy" a call site back into a direct forward: the
 * five `apps/site` sites that were forwarding directly when PR #4608 landed are
 * what kept `Build Docs` red on `main` for ~5 hours — each one a TS2322 naming
 * `number` against this function's return type — until PR #4621 routed all five
 * through here (objectui#4617). An earlier revision of this paragraph said the
 * reconciliation was still pending and invited exactly that edit.
 */
export function toRenderableSchema(
  node: BaseSchema | string | number | boolean | null | undefined,
): SchemaRendererProps['schema'] {
  return typeof node === 'number' || typeof node === 'boolean' ? String(node) : node;
}

