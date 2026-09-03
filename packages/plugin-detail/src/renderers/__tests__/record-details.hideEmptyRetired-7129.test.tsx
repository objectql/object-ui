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
 * | `@objectstack/spec` `RecordDetailsProps`   | ⛔ REFUSES the key          |
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

describe('DetailViewSection.hideEmpty is retired — all four parties agree (#7129)', () => {
  it('1/4 — `@objectstack/spec` REFUSES the key on a `record:details` section', () => {
    const parsed = RecordDetailsProps.safeParse({
      sections: [{ label: 'Contact', fields: ['phone'], hideEmpty: true }],
    });

    // Envelope, not a bare failure: the code, and the key it names.
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((i) => i.code)).toContain('unrecognized_keys');
    const refused = parsed.error?.issues.flatMap(
      (i) => (i as unknown as { keys?: string[] }).keys ?? [],
    );
    expect(refused).toContain('hideEmpty');

    // CONTROL: a declared section key parses AND its value survives, so the
    // refusal above is about `hideEmpty` and not about a section object the
    // probe built wrong.
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

  it('4/4 — `RecordDetailsRenderer` no longer READS the key', () => {
    // An all-empty section is the case `DetailSection`'s heuristic reserves and
    // the case the old read overrode: authored `hideEmpty: true` used to make
    // the whole section disappear. It must now render its skeleton.
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
