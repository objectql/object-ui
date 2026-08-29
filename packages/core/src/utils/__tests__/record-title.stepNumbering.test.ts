/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6634 — the precedence STEP NUMBERS inside `record-title.ts` have to
 * agree with each other.
 *
 * The file states its ADR-0079 ladder three times over — the module docblock,
 * the `getRecordDisplayName` docblock, and the inline `// N.` labels on the
 * branches themselves — and other files cite those numbers BY HAND (objectui#6572
 * corrected `InterfaceListPage`'s prose, which names steps 0/1/2/3/4 and takes
 * them from here). Nothing mechanical noticed when one rung ended up carrying
 * two numbers: the `NAME_ISH_RECORD_KEYS` probe was `4b` in the resolver
 * docblock and on the branch, but `3b` in the
 * `RecordDisplayNameOptions.deriveFromRecordKeys` docblock — 26 lines apart in
 * the same file. `3` is `objectDef.titleFormat` in BOTH ladders, so a reader who
 * carried away `3b` had the record-key probe filed under the legacy template.
 *
 * The numbers live only in comment text, so no behavioural assertion can tell
 * the two states apart — `deriveFromRecordKeys` behaves identically either way.
 * This is the assertion that can. It checks the labels against the file's OWN
 * ladder rather than against a number hard-coded here, so a deliberate
 * renumbering stays legal as long as every label follows it; what fails is a
 * label that disagrees with the ladder it sits under.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** packages/core/src/utils/__tests__ → packages/core/src/utils/record-title.ts */
const SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../record-title.ts');
const src = readFileSync(SOURCE, 'utf8');

/**
 * Every number the file hangs on the type-aware-derivation rung, wherever it
 * states the ladder: `*   4. Type-aware derivation …` (the two precedence
 * docblocks) and `// 4. Type-aware derivation …` (the branch itself).
 */
function derivationStepNumbers(): number[] {
  return [...src.matchAll(/^\s*(?:\*|\/\/)\s+(\d+)\.\s+type-aware derivation/gim)].map((m) =>
    Number(m[1]),
  );
}

/**
 * Every SUB-step label — the `b` variant sitting under a numbered rung. Two
 * spellings are in use and both are collected: the ladder/branch label
 * (`4b. …`) and inline prose (`precedence step 4b`).
 */
function subStepNumbers(): number[] {
  return [
    ...[...src.matchAll(/^\s*(?:\*|\/\/)\s+(\d+)b\.\s/gm)].map((m) => Number(m[1])),
    ...[...src.matchAll(/\bstep (\d+)b\b/g)].map((m) => Number(m[1])),
  ];
}

describe('record-title.ts — internal precedence-step numbering', () => {
  it('gives the type-aware derivation rung ONE number everywhere it states it', () => {
    const numbers = derivationStepNumbers();
    // Control: three sites label that rung today (module docblock, resolver
    // docblock, the branch comment). A drop here means the wording moved and
    // this pin stopped measuring — re-aim the regex, do not delete the test.
    expect(numbers.length).toBeGreaterThanOrEqual(3);
    expect(new Set(numbers).size).toBe(1);
  });

  it('numbers every `b` sub-step under the rung it actually sits below', () => {
    const derivation = derivationStepNumbers();
    expect(derivation.length).toBeGreaterThanOrEqual(3);
    const parent = derivation[0];

    const subSteps = subStepNumbers();
    // Control: three sites carry a sub-step label today (resolver docblock,
    // the branch comment, and `RecordDisplayNameOptions.deriveFromRecordKeys`).
    expect(subSteps.length).toBeGreaterThanOrEqual(3);
    // The regression this file exists for: `3b` in the options docblock while
    // the ladders and the branch said `4b`.
    expect(subSteps.filter((n) => n !== parent)).toEqual([]);
  });

  it('cites that same number in the `deriveTitleField` docblock', () => {
    const cited = /derivation \(precedence step (\d+)\)/i.exec(src);
    // Control: the citation has to still be there for this to be a measurement.
    expect(cited).not.toBeNull();
    expect(Number(cited?.[1])).toBe(derivationStepNumbers()[0]);
  });
});
