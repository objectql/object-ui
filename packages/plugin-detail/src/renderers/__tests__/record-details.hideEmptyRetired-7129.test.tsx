/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `DetailViewSection.hideEmpty` is RETIRED — the four parties agree (objectui#7129).
 *
 * ## What was wrong
 *
 * One key, four contracts, three different answers (measured on PR #7123 and
 * filed as this card's decision):
 *
 * | party                                     | said                       |
 * |-------------------------------------------|----------------------------|
 * | `@objectstack/spec` `RecordDetailsProps`   | ⛔ REFUSED it (17.2.0; see the 2026-09-05 note below) |
 * | `@object-ui/types` `DetailViewSection`     | ✅ declared it              |
 * | `./zod/views.zod.ts` `DetailViewSectionSchema` | ⛔ absent               |
 * | `RecordDetailsRenderer`                    | ✅ honoured it              |
 *
 * The declaration was the only thing that made the key writable, and on any
 * spec-validated page it never reached the renderer at all — so the "author
 * escape hatch" the 2026-08-31 ruling described existed only where nothing
 * validated. The maintainer converged the four on the spec's answer
 * (2026-09-01, 总监批 #28): retire the declaration and the read, keep the spec
 * refusing, keep the mirror absent. `DetailSection`'s auto-hide heuristic
 * (4 fields / 25% empty; 3 / 20% on mobile) is now the WHOLE contract.
 *
 * ## ⚠️ 2026-09-05 — the spec moved back, and this file now records a DIVERGENCE
 *
 * `@objectstack/spec` 17.3.0 RE-DECLARES `hideEmpty` on the `record:details`
 * section entry (measured: the entry went 4 → 12 member keys, `hideEmpty` among
 * the eight gained, lost set empty). One clause of the ruling — "keep the spec
 * refusing" — therefore describes nothing any more, through no act of this
 * repo.
 *
 * objectui's own three parties are UNCHANGED and still agree: the type does not
 * declare it, the mirror omits it, the renderer does not read it. 1/4 below is
 * pointed at the measured upstream truth so the divergence is a stated fact
 * rather than a red test; every other assertion is untouched.
 *
 * ⇒ Whether objectui re-adopts the key is a MAINTAINER decision (it reverses
 * the ruling and re-adds a deleted control) and is reported on objectui#7122,
 * NOT taken here. If it is re-adopted, this file is the checklist: three
 * parties to move, not one.
 *
 * ## Why one file
 *
 * Alignment is a claim about FOUR sources at once, and each of them is green on
 * its own while the set disagrees — which is exactly how the divergence
 * survived. Pinning them separately reproduces that blind spot; pinning them
 * together makes any one party moving back a single red test.
 *
 * ⚠️ Two same-named keys are NOT in scope here and must stay untouched:
 *   - `record:reference_rail`'s own `hideEmpty` prop (`../record-reference-rail.tsx`)
 *     — a different surface, a different renderer, still live and still
 *     registered as an input in `../../index.tsx`;
 *   - the `detail.hideEmptyFields` i18n label (the "Show N empty fields"
 *     toggle's copy, in all ten locale packs) — a PREFIX match on the name,
 *     not this key.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as React from 'react';
import { RecordContextProvider } from '@object-ui/react';
import { RecordDetailsProps } from '@objectstack/spec/ui';
import { DetailViewSectionSchema } from '@object-ui/types/zod';
import type { DetailViewSection } from '@object-ui/types';
import { RecordDetailsRenderer } from '../record-details';

/* ── Party 3: `@object-ui/types` no longer DECLARES it ────────────────────── */

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

type Declares<K extends string> = K extends keyof DetailViewSection ? true : false;

/**
 * Erased at runtime, so `tsc` is the only thing that can see it — this package's
 * `tsconfig.test.json` is what compiles it, reading `@object-ui/types` through
 * the workspace dependency's BUILT `.d.ts` (its `paths` are empty). Re-adding
 * `hideEmpty?: boolean` to `DetailViewSection` turns this red and nothing else
 * in this file moves.
 */
export type assertionHideEmptyIsNotDeclared = Assert<Equal<Declares<'hideEmpty'>, false>>;

/**
 * Non-vacuity for the assertion above: a sibling key the interface DOES declare
 * resolves `true` through the same `Declares<…>`, so `false` above is a
 * measurement and not a broken conditional.
 */
export type assertionDeclaresProbeWorks = Assert<Equal<Declares<'showBorder'>, true>>;

/* ── The three runtime parties ────────────────────────────────────────────── */

const objectSchema = {
  fields: {
    industry: { type: 'text', label: 'Industry' },
    stage: { type: 'text', label: 'Stage' },
    amount: { type: 'text', label: 'Amount' },
    close_date: { type: 'text', label: 'Close Date' },
  },
};

beforeEach(() => {
  // `useRecordEditable` probes `POST /api/v1/security/explain` for the
  // ROW-level verdict, and happy-dom resolves that relative URL to a REAL
  // socket, which the repo's network-escape guard fails the file for
  // (objectui#6640). Serve it from a double instead. Its answer is orthogonal
  // to everything below — this file observes an EMPTY section's skeleton, and
  // the inline-edit affordance is not part of that.
  //
  // ⛔ Not `KNOWN_ESCAPES`: that list only shrinks, and its
  // `record-details.emptySectionDefault.test.tsx` entry is the older sibling
  // this file deliberately does not join.
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ allowed: true }),
    text: async () => '{"allowed":true}',
  })) as never);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DetailViewSection.hideEmpty is retired in objectui — and the spec re-declared it at 17.3.0 (#7129)', () => {
  it('1/4 — ⚠️ `@objectstack/spec` 17.3.0 DECLARES the key again: the fourth party moved', () => {
    // ⭐ READ THIS BEFORE CHANGING ANYTHING ELSE IN THIS FILE.
    //
    // This assertion is inverted from what it said at 17.2.0, and the inversion
    // is NOT objectui following the spec back. It records that the ruling's
    // fourth party changed its answer underneath the ruling.
    //
    // The 2026-09-01 ruling (总监批 #28) converged four disagreeing contracts on
    // the spec's answer, in these words: "retire the declaration and the read,
    // keep the spec refusing, keep the mirror absent". `@objectstack/spec`
    // 17.3.0 then re-declared `hideEmpty` on the `record:details` section entry
    // — measured, as one of eight keys the entry gained (4 → 12 members, lost
    // set empty). So the clause "keep the spec refusing" is no longer a
    // description of anything, through no act of this repo.
    //
    // ⛔ What has NOT changed, and what this file still pins in full: objectui's
    // three parties still agree the key is retired. 2/4 (the mirror omits it),
    // 3/4 (the type does not declare it) and 4/4 (nothing reads it, end to end)
    // are untouched below. Authoring `hideEmpty` on this renderer still does
    // nothing, which is the behaviour the ruling ordered.
    //
    // ⇒ Whether objectui should now re-adopt the key is a MAINTAINER decision —
    // it would reverse a five-day-old ruling and re-add a control the ruling
    // deleted — and it is reported on objectui#7122 rather than taken here. The
    // assertion is pointed at the measured truth so that the divergence is a
    // stated, pinned fact instead of a red test somebody eventually deletes.
    const parsed = RecordDetailsProps.safeParse({
      sections: [{ label: 'Contact', fields: ['phone'], hideEmpty: true }],
    });

    expect(parsed.success).toBe(true);
    // Value reachability, not just key presence: a declared-but-unusable key
    // would leave the divergence smaller than this comment claims.
    expect(
      (parsed.data as { sections?: { hideEmpty?: boolean }[] })?.sections?.[0]?.hideEmpty,
    ).toBe(true);

    // CONTROL, and it is what stops this from reading as "the spec went soft":
    // the section object is still STRICT, so an undeclared key is still refused
    // by name. `hideEmpty` parses because it was DECLARED, not because
    // unrecognized keys stopped being refused.
    const undeclared = RecordDetailsProps.safeParse({
      sections: [{ label: 'Contact', fields: ['phone'], __objectui_7129_probe__: true }],
    });
    expect(undeclared.success).toBe(false);
    expect(undeclared.error?.issues.map((i) => i.code)).toContain('unrecognized_keys');
    const refused = undeclared.error?.issues.flatMap(
      (i) => (i as unknown as { keys?: string[] }).keys ?? [],
    );
    expect(refused).toContain('__objectui_7129_probe__');

    // CONTROL: a declared section key parses AND its value survives, so the
    // reading above is about the section object the probe built and not about
    // a probe that built one wrong.
    const control = RecordDetailsProps.safeParse({
      sections: [{ label: 'Contact', fields: ['phone'], columns: 2 }],
    });
    expect(control.success).toBe(true);
    expect((control.data as { sections?: { columns?: number }[] })?.sections?.[0]?.columns).toBe(2);
  });

  it('2/4 — the `DetailViewSectionSchema` zod mirror OMITS the key', () => {
    const mirrored = Object.keys(DetailViewSectionSchema.shape);

    expect(mirrored).not.toContain('hideEmpty');
    // CONTROL: the mirror really was read — `headerColor` is one it does carry.
    expect(mirrored).toContain('headerColor');
  });

  // 3/4 is the compile-time pair above; `vitest` proves nothing about it.

  it('4/4 — `record:details` no longer READS the key: an authored one is inert end to end', () => {
    // An all-empty section is the case `DetailSection`'s heuristic reserves and
    // the case the old read overrode: authored `hideEmpty: true` used to make
    // the whole section disappear. It must now render its skeleton.
    //
    // ⚠️ Deliberately end-to-end rather than "the renderer does not read it".
    // Measured on this card's ablation: `RecordDetailsRenderer` spreads `...s`,
    // so deleting its explicit `hideEmpty: s.hideEmpty` slot left the value
    // still reaching `DetailSection` and this suite GREEN. The read that
    // decided anything was `DetailSection`'s, and restoring THAT is what turns
    // this red. A pin written against the renderer's slot alone would have
    // been a pin that cannot fail.
    render(
      <RecordContextProvider
        objectName="crm_opportunity"
        recordId="O1"
        data={{ industry: 'Manufacturing' }}
        objectSchema={objectSchema}
      >
        <RecordDetailsRenderer
          schema={
            {
              sections: [
                { name: 'deal_terms', label: 'Deal Terms', fields: ['stage', 'amount', 'close_date'], hideEmpty: true },
              ],
            } as never
          }
        />
      </RecordContextProvider>,
    );

    expect(screen.getByText('Deal Terms')).toBeInTheDocument();
    for (const label of ['stage', 'amount', 'close_date']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryAllByTitle('No value')).toHaveLength(3);
  });
});
