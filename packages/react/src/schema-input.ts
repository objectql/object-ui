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
 * It exists because the two competing repo-wide `SchemaNode` spellings
 * (`@object-ui/core`'s interface vs `@object-ui/types`' union) have not been
 * reconciled; that reconciliation is tracked separately. When it lands, the
 * call sites using this can go back to forwarding directly.
 */
export function toRenderableSchema(
  node: BaseSchema | string | number | boolean | null | undefined,
): SchemaRendererProps['schema'] {
  return typeof node === 'number' || typeof node === 'boolean' ? String(node) : node;
}

