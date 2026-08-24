/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { icons } from 'lucide-react';
import '../renderers/basic/icon';

// ---------------------------------------------------------------------------
// objectui#5622 — the `icon` renderer's OWN declared default has to resolve.
//
// Two metadata spots feed the designer: the registration's `icon` meta (the
// glyph on the palette entry) and the glyph INPUT's `defaultValue` (what an
// `icon` dropped from that palette renders before anyone types a name). Both
// are looked up in lucide's runtime `icons` record by `IconRenderer`, which
// `console.warn`s and draws a visible placeholder on a miss.
//
// ⚠️ That input is keyed `icon` since objectui#5631 — it was `name` until the
// glyph key migrated off the SDUI identity key. Only the SELECTOR below moved;
// this file's subject is still objectui#5622's retired-spelling question.
//
// lucide retires a spelling by dropping it from that record while keeping it as
// a deprecated named export, and `smile` was retired — so the palette entry's
// glyph was blank AND the component started at a default that rendered nothing.
// The two spots must hold together: repairing one alone leaves the other broken.
//
// ⚠️ MEMBERSHIP, not resolvability. `Smile === FaceSlightlySmiling` is TRUE on
// the installed lucide — the retired spelling names the very same glyph object,
// so an assertion that reaches for the export, or renders it and looks, passes
// on the broken name. Absence from the record is the only difference.
//
// Read off the REGISTRY rather than out of source: the registry entry is the
// artifact the designer palette actually consumes.
//
// ⚠️ NOT retired by objectui#5633's repo-level gate
// (`scripts/check-lucide-icon-record-names.mjs`), deliberately. That gate judges
// names reaching a resolver it can SEE reading the record, and this repository
// contains no first-party consumer of a registration's `icon` meta at all —
// measured: `getMeta(...).icon` is read nowhere under `packages/**` or `apps/**`.
// The palette that renders it lives outside this repo, so the claim this pin
// makes is one the gate has no measured basis to generalise. It also asserts
// something no membership check can: that the palette glyph and the dropped
// default stay the SAME name.
// ---------------------------------------------------------------------------

/**
 * The transform `IconRenderer` applies before its record lookup, copied because
 * it is module-private there. Copied EXACTLY — a pin that normalised names
 * differently from the consumer would answer a question nobody asks.
 */
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}
const iconNameMap: Record<string, string> = { Home: 'House' };
const recordKeyFor = (name: string): string => {
  const pascal = toPascalCase(name);
  return iconNameMap[pascal] ?? pascal;
};

const meta = ComponentRegistry.getMeta('icon', 'ui');
const glyphInput = meta?.inputs?.find(input => input.name === 'icon');

/** Both declared spellings, each labelled by the surface it drives. */
const DECLARED_DEFAULTS: Array<[string, string | undefined]> = [
  ['registration `icon` (the palette entry glyph)', meta?.icon],
  ['`icon` input `defaultValue` (what a dropped `icon` renders)', glyphInput?.defaultValue as string | undefined],
];

describe('the `ui:icon` renderer\'s declared default is a live `icons` key (objectui#5622)', () => {
  it('both declared spellings were actually found — the precondition', () => {
    // A registry read that came back `undefined` would leave the assertion
    // below vacuously green on `undefined !== a retired name`, which is the
    // failure mode this shape invites.
    expect(meta, '`ui:icon` is not registered — the import above no longer registers it.').toBeDefined();
    expect(
      glyphInput,
      'the `icon` input is gone from the `ui:icon` registration — fix the reader or the registration.',
    ).toBeDefined();
    for (const [surface, spelling] of DECLARED_DEFAULTS) {
      expect(typeof spelling, `${surface} declares no icon name at all`).toBe('string');
    }
  });

  it('names only live `icons` keys, on BOTH surfaces', () => {
    const retired = DECLARED_DEFAULTS.filter(
      ([, spelling]) =>
        typeof spelling === 'string'
        && !Object.prototype.hasOwnProperty.call(icons, recordKeyFor(spelling)),
    );

    expect(
      retired,
      'The `ui:icon` registration declares a default that is NOT a key of lucide\'s runtime `icons`\n'
        + 'record — i.e. a deprecated alias. `IconRenderer` returns `null` and warns on that lookup,\n'
        + 'so the palette glyph is blank and a freshly dropped `icon` renders nothing. The name still\n'
        + 'imports and type-checks as a component, so nothing else goes red. Replace it with the\n'
        + 'spelling the record carries — in BOTH spots (objectui#5622).',
    ).toEqual([]);
  });

  it('keeps the palette glyph and the dropped default the same name', () => {
    // The defect was one name in two places; the repair is only correct if they
    // stay one name. Split them and the palette advertises a glyph the dropped
    // component does not render.
    expect(meta?.icon).toBe(glyphInput?.defaultValue);
  });

  it('rejects a name the record does not carry — the control', () => {
    // Same record, same membership predicate, same `recordKeyFor` transform as
    // the assertion above, so it fails on exactly what that one passes on.
    expect(
      Object.prototype.hasOwnProperty.call(icons, recordKeyFor('no-such-lucide-icon')),
    ).toBe(false);
  });

  it('rejects the spelling that shipped here — the control that matters', () => {
    // The control above would also pass against a predicate that merely asked
    // "is this importable from lucide-react". `Smile` is: it imports, it
    // type-checks, and it IS `FaceSlightlySmiling`. Membership is the only
    // thing that separates them, and this is the exact spelling that shipped.
    expect(Object.prototype.hasOwnProperty.call(icons, recordKeyFor('smile'))).toBe(false);
  });
});
