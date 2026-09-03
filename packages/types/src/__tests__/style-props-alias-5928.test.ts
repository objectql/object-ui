/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `StylePropsSchema` is renamed to `ClassNameStylePropsSchema`, and the old name
 * stays LIVE as a deprecated alias for one release (objectui#5928).
 *
 * ## What this file exists to prove
 *
 * The rename moves a name on a PUBLISHED surface (`@object-ui/types/zod`). The
 * alias is the mechanism that keeps the rename from narrowing that surface, so the
 * alias has to be checked the way a published export is checked — by IMPORTING it
 * through the published barrel and using it — not by the type-checker's silence. A
 * `tsc` run stays green on an alias that was dropped from the barrel, because
 * nothing in this package imports it; only a runtime import of the published path
 * can report that the name is gone.
 *
 * Both faces are pinned here:
 *   - the alias resolves to the SAME object as the new name (`toBe`), so the two
 *     spellings cannot drift into two schemas, and
 *   - it VALIDATES, so the export is a live zod schema and not an inert re-export
 *     of something that lost its identity through the rename.
 *
 * The other half of the card — that the old name never was a mirror of the
 * like-named TS `StyleProps` — is measured in `zod-mirror-parity.test.ts`
 * (`NAME_NON_PAIRS`).
 */

import { describe, it, expect } from 'vitest';

// The PUBLISHED path (`@object-ui/types/zod` resolves to this barrel), deliberately
// not `../zod/base.zod.js`: an alias that survives in the source file but is missing
// from the barrel is exactly the regression this file must catch.
import { ClassNameStylePropsSchema, StylePropsSchema } from '../zod/index.zod.js';

describe('ClassNameStylePropsSchema (objectui#5928)', () => {
  it('the deprecated `StylePropsSchema` alias is the SAME object, not a copy', () => {
    expect(StylePropsSchema).toBe(ClassNameStylePropsSchema);
  });

  it('the alias is a live schema — importing the old name still validates', () => {
    const ok = StylePropsSchema.safeParse({ className: 'p-4 text-sm', style: { color: 'red', zIndex: 10 } });
    expect(ok.success).toBe(true);

    // A refusal through the old name, addressed to the key that is wrong — the
    // accept set the alias carries is the schema's, not a passthrough of anything.
    const bad = StylePropsSchema.safeParse({ className: 42 });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0]?.path).toEqual(['className']);
  });

  it('the renamed const carries exactly the two keys the name claims', () => {
    // The rename was justified by a measurement (2 keys, both CSS passthrough
    // attributes). Pinned so the name cannot outlive what it describes: a third key
    // arriving here makes `ClassNameStyleProps…` a lie and must be a decision.
    expect(Object.keys(ClassNameStylePropsSchema.shape).sort()).toEqual(['className', 'style']);
  });
});
