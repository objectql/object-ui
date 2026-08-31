/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - ADR-0049 retirement tombstone helper
 *
 * @module zod/tombstone
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Declare an ADR-0049 RETIREMENT TOMBSTONE: a key that stays declared but is
 * unwritable, so an authored value is REFUSED loudly instead of being silently
 * stripped the way an undeclared key would be (the convention `crud.zod.ts`
 * `confirm` established; objectui#5474's ruling records loud refusal as the
 * intended outcome).
 *
 * `guidance` is written ONCE and carried into BOTH author-facing channels:
 *
 *   1. `.describe()` — schema METADATA, which feeds generated JSON-Schema and
 *      the docs surface. This is where the text already lived.
 *   2. `z.never({ error })` — the parse-time ISSUE MESSAGE, which is what an
 *      author who trips the tombstone actually reads. Without it zod emits its
 *      own generic `"Invalid input: expected never, received string"`, which
 *      names WHICH key is wrong (via the issue path) but says nothing about why
 *      it was retired or what to write instead — so half of the loud refusal's
 *      payload was being dropped (objectui#6105). `DashboardConfigSchema.aria`
 *      (`complex.zod.ts`, objectui#5852) landed the spelling by hand first;
 *      this is that spelling as one shared mechanism.
 *
 * ONE argument feeding TWO channels is the point: the message an author reads
 * and the text generated docs publish cannot drift apart, because there is only
 * one string.
 *
 * ## What this deliberately does NOT change: the accept set
 *
 * `z.never({ error })` customises the MESSAGE only. The issue `code` stays
 * `invalid_type` and the issue `path` still names the key — exactly what a bare
 * `z.never()` reports — and `z.input` still types the key `never`, so `tsc`
 * refuses it at the authoring site before anything runs. Nothing that parsed
 * green parses red, or the reverse. Pinned member-by-member against the
 * pre-change readings in `../__tests__/static-table-narrow-surface.test.ts`.
 *
 * ## Not `@objectstack/spec`'s `retiredKey`
 *
 * The spec has a same-shaped helper (`shared/retired-key.ts`) for keys removed
 * from the SPEC, and it deliberately prefixes its describe text with
 * `[REMOVED] `. This one must not: these describe strings are already-published
 * metadata and stay byte-identical through this conversion. Same shape,
 * different describe contract — do not swap one for the other.
 *
 * Internal to this package's zod modules — deliberately NOT re-exported from
 * `index.zod.ts`, since nothing outside `@object-ui/types` declares these
 * schemas.
 */
export function retirementTombstone(guidance: string) {
  return z.never({ error: guidance }).optional().describe(guidance);
}
