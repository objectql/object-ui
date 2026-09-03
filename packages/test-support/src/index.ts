/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `@object-ui/test-support` — the surface.
 *
 * This package is `private: true` and is never published, so this index is not
 * public API; it is the ONE specifier other packages' test suites import. The
 * indirection is the objectui#4325 lesson applied ahead of time: a deep
 * subpath into another package (`@object-ui/fields/widgets/MarkdownContent`)
 * resolved only through this repo's vitest alias, was TS2882 for `tsc`, and was
 * ruled out rather than minted as permanent public API. A package's surface is
 * its index — including this one.
 */

export {
  ATTRIBUTE_TO_IDL_ALIAS,
  GLOBAL_HTML_ATTRIBUTES,
  HAPPY_DOM_IDL_GAPS,
  OPEN_PREFIXES,
  SVG_ATTRIBUTES,
  findLeaks,
  isKnownAttribute,
  leakReport,
} from './dom-leak-judge';
export type { Leak } from './dom-leak-judge';

export {
  RETIRED_DESCRIPTION_PREFIX,
  authorableShapeKeys,
  isShapeKeyTombstoned,
  listedShapeKeys,
  resolvePropsShape,
  shapeMemberTypeName,
  tombstoneEvidence,
  tombstonedShapeKeys,
} from './spec-tombstones';

export { enumOptions, shapeEnumOptions } from './spec-enum-options';

/**
 * The array-element reader (objectui#5872 class (2)). Stands on the same
 * `spec-zod-wrappers.ts` walk `enumOptions` does; the walk itself is NOT
 * exported, because it is plumbing between the two readers rather than
 * something a gate should hold.
 */
export { arrayElementSchema } from './spec-array-element';

/**
 * The Zod wrapper-key vocabulary (objectui#6923). The DATA lives in
 * `zod-wrapper-keys.json` so that `node scripts/check-*.mjs` can read the same
 * bytes through `@object-ui/test-support/zod-wrapper-keys` — the one thing this
 * package's `.` entry, being TypeScript source, cannot offer a bare-node
 * consumer. `zod-wrapper-keys.ts` carries the reasoning; read it before
 * touching either side.
 */
export { ZOD_WRAPPER_KEYS } from './zod-wrapper-keys';
