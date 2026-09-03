// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `MetadataLayered.overlayScope` ↔ spec vocabulary pin (objectui#4982).
 *
 * The field was declared `string | null` under a doc comment naming the
 * vocabulary as `organization | environment | package`. All three spellings are
 * rejected by the producer's own schema, `package` was never a scope on this
 * field at all, and `string` meant no compiler anywhere in the repo had an
 * opinion — so the wrong comment was the only description of the vocabulary a
 * reader (or an agent) had. It is now derived from
 * `GetMetaItemLayeredResponseSchema`, and this file is what keeps it derived.
 *
 * ## Why the pin is split across two mechanisms
 *
 * There is no runtime witness to compare by reference here, so the strongest
 * form used elsewhere in the repo — `expect(local).toBe(spec)` on a re-exported
 * zod object (`packages/types/src/__tests__/spec-subschema-parity.test.ts`) —
 * has nothing to assert: the binding is a TYPE alias, and the shipped module
 * imports no spec VALUE. Manufacturing one (exporting a copy of the enum's
 * options from this package purely so a test could pin it) would create exactly
 * the fork the derivation guard rejects, so it is deliberately not done.
 *
 * What replaces it, at the same strength:
 *
 *   1. The `satisfies` block below, in BOTH directions. This package's
 *      `tsconfig.json` includes the whole of `src` (tests included), so
 *      `pnpm --filter @object-ui/data-objectstack type-check` compiles this
 *      file — these are enforcement, not decoration (the objectui#3009
 *      distinction).
 *   2. The `@ts-expect-error` line. Reverting the field to `string | null` makes
 *      `'organization'` assignable again, the directive stops suppressing
 *      anything, and `tsc` fails it as TS2578. That is the one line that turns a
 *      revert of this fix red.
 *   3. `LAYER_SCOPE_ZH` in `@object-ui/app-shell`'s metadata-admin `i18n.ts`,
 *      whose key type is `NonNullable<MetadataOverlayScope>` — a scope the spec
 *      adds fails to compile there until it has a zh-CN label, which is the
 *      user-visible half of this bug.
 */
import { describe, it, expect } from 'vitest';
import { enumOptions } from '@object-ui/test-support';
import { GetMetaItemLayeredResponseSchema } from '@objectstack/spec/api';
import type { MetadataLayered, MetadataOverlayScope } from './metadata-client';

// ── Compile-time: the alias IS the spec's vocabulary, both directions ────────

// Every value the producer can send flows into the alias. A narrower
// restatement (say, dropping `env`) fails here.
const _specCovers = null as unknown as 'org' | 'env' | null satisfies MetadataOverlayScope;
// …and the alias is no WIDER than that. This is the line that fails the day the
// spec adds a scope — deliberately, because a new scope needs a zh-CN label
// (see mechanism 3 above) rather than silently reaching the badge.
const _noWider = null as unknown as MetadataOverlayScope satisfies 'org' | 'env' | null;
// The interface field is the alias, not a widened `string`.
const _fieldIsAlias = null as unknown as MetadataLayered['overlayScope'] satisfies MetadataOverlayScope;
const _org: MetadataLayered['overlayScope'] = 'org';
const _env: MetadataLayered['overlayScope'] = 'env';
const _none: MetadataLayered['overlayScope'] = null;
// @ts-expect-error — objectui#4982: the spelling the old comment claimed is not
// a value this field can hold. Reverting the narrowing to `string | null` makes
// this assignment legal and the directive unused, which `tsc` reports as TS2578.
const _notASpecScope: MetadataLayered['overlayScope'] = 'organization';

// ── Runtime: what the producer's schema actually declares ────────────────────

const specOverlayScope = GetMetaItemLayeredResponseSchema.shape.overlayScope;

describe('MetadataLayered.overlayScope tracks the spec enum (objectui#4982)', () => {
  it('the producer vocabulary is exactly org | env, plus null', () => {
    // Read through `@object-ui/test-support` rather than `.unwrap().options`
    // (objectui#5872 class (4)). The bare spelling was a SEVENTH way to ask this
    // question and the only one with neither a cast nor a guard: it answered
    // correctly only while `overlayScope` stayed wrapped exactly once and Zod
    // kept `.options` where it is. `enumOptions` walks the wrappers and answers
    // `[]` when it cannot read — and `[]` fails this assertion, which is the
    // non-vacuity duty that reader's docblock leaves with every caller.
    expect(enumOptions(specOverlayScope)).toEqual(['org', 'env']);
    expect(specOverlayScope.safeParse(null).success).toBe(true);
  });

  it('rejects all three spellings the old doc comment claimed', () => {
    // Not "these are wrong today" — they were never right. `package` in
    // particular is a scope this field has never carried in any spec release.
    for (const claimed of ['organization', 'environment', 'package']) {
      expect(
        specOverlayScope.safeParse(claimed).success,
        `spec unexpectedly accepts '${claimed}' — re-read the derivation`,
      ).toBe(false);
    }
  });
});
