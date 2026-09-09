/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ⭐ THE BADGE-FIT CENSUS — "do not assume A is free", measured (objectui#8464).
 *
 * The card's fix option A is "route the summary chip through `getCellRenderer`,
 * as `HeaderHighlight` does", with the warning that a Badge is a much smaller
 * surface than a cell, that some renderers may not fit inside one, and that this
 * needs measuring per kind rather than assuming. This file IS that measurement,
 * and it is an instrument rather than a grep: every registered field type is
 * rendered through `getCellRenderer` INSIDE the real chip Badge — same element,
 * same `variant`, same class string as `DetailView` uses — against the object
 * value the defect is about, and the DOM the pill received is counted.
 *
 * The answer: **A for the 38 kinds that fit, with a stated rule for the 15 that
 * do not.** The refused set is `CHIP_UNFIT_RENDERER_TYPES` in
 * `../summaryChipRenderers`, and `THE SET MATCHES THE MEASUREMENT` below fails
 * if the constant and this table ever disagree.
 *
 * ## The table, as measured on `ed971e8fc` for `{ id: 'acct-1', name: 'Acme Corp' }`
 *
 * | class                    | types                                                       | what the pill received                              |
 * |--------------------------|-------------------------------------------------------------|-----------------------------------------------------|
 * | ✅ plain inline text      | the other 38                                                | `Acme Corp`, or the JSON literal for the seven behind objectui#8481's declared json-literal fence, or a value-independent face |
 * | ⛔ a pill inside a pill   | `select` `status` `multiselect` `radio` `checkboxes` `tags`   | `SelectCellRenderer`'s own `Badge` — one `rounded-full` node nested in the chip's own |
 * | ⛔ an avatar composite    | `user`                                                      | TWO `rounded-full` nodes and the initials glued on: `ACAcme Corp` |
 * | ⛔ an image and no text   | `image` `avatar` `signature`                                | an `<img>`, `textContent === ''` |
 * | ⛔ a "No value" face      | `boolean` `toggle` `datetime` `repeater`, and `date`         | the shared `EmptyValue` (and `formatDate`'s own em-dash for `date`, objectui#8581) |
 *
 * The last class is not a layout objection. A chip is drawn only AFTER
 * `hasCellValue` has called the value FILLED, so a renderer that answers "No
 * value" one band later re-opens exactly the cross-band contradiction
 * objectui#8394 closed. `date` is in the refused set for that reason even though
 * its dash is not the shared affordance and this census records it as text.
 *
 * ## ⚠️ What this census does NOT measure
 *
 * PIXELS. happy-dom reports `clientWidth: 0` and never fires container-size
 * effects, so nothing here can see a renderer that fits structurally and clips
 * visually. That half is objectui#4054 — "a `record:highlights` chip clips
 * multi-element cell renderers with NO ellipsis" — which says in its own words
 * that "a DOM-only probe reports this surface healthy" and needs
 * `getBoundingClientRect()` plus a screenshot. Its own analysis also records
 * that `lookup` / `user` / `file` carry their own `truncate` and are unaffected,
 * and names the `MapPin`-plus-text row (this repo's `location`) as a candidate.
 * ⇒ the structural verdicts below are sound; a `location` chip's clipping
 * behaviour is #4054's question, not this card's.
 *
 * ## ⚠️ Counting, not navigating
 *
 * Nested pills are counted by CLASS TOKEN over every descendant. `.rounded-full`
 * matches TWO nodes per avatar (Radix `Avatar.Root` AND `AvatarFallback`);
 * objectui#8596's census navigated with `querySelector` and never noticed.
 * `user`'s row below asserts the count is exactly 2 — the fact a navigation
 * cannot express.
 *
 * ⚠️ A matrix pin over an EMPTY set passes. `assertCensusComplete` asserts the
 * exact expected size before a single cell is rendered, and a meta-test proves
 * that guard throws when the set is emptied.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import * as React from 'react';
import { Badge } from '@object-ui/components';
import { getCellRenderer, resolveCellRendererType } from '@object-ui/fields';
import { CHIP_UNFIT_RENDERER_TYPES, chipTakesCellRenderer } from '../summaryChipRenderers';

afterEach(() => cleanup());

/** Every type `getCellRenderer` resolves to a renderer of its own (objectui#8596). */
const REGISTERED_TYPE_COUNT = 53;

/** The object value the defect is about: an expanded reference payload. */
const OBJ = { id: 'acct-1', name: 'Acme Corp' };

/** The chip's own class string, copied from `DetailView`'s summary Badge. */
const CHIP_CLASS = 'text-xs bg-primary/10 text-primary border-transparent hover:bg-primary/15';

type Verdict = 'fit' | 'pill-in-pill' | 'avatar' | 'image-no-text' | 'no-value-face';

/**
 * `text` is what the pill received; `verdict` is why it is or is not allowed.
 * Only `fit` rows may be routed to a cell renderer by the chip.
 */
const CENSUS: ReadonlyArray<readonly [type: string, text: string, verdict: Verdict]> = [
  // ── plain inline text: the coerced name ────────────────────────────────
  ['text', 'Acme Corp', 'fit'],
  ['textarea', 'Acme Corp', 'fit'],
  ['markdown', 'Acme Corp', 'fit'],
  ['html', 'Acme Corp', 'fit'],
  ['richtext', 'Acme Corp', 'fit'],
  ['code', 'Acme Corp', 'fit'],
  ['qrcode', 'Acme Corp', 'fit'],
  ['time', 'Acme Corp', 'fit'],
  ['auto_number', 'Acme Corp', 'fit'],
  ['number', 'Acme Corp', 'fit'],
  ['currency', 'Acme Corp', 'fit'],
  ['percent', 'Acme Corp', 'fit'],
  ['progress', 'Acme Corp', 'fit'],
  ['slider', 'Acme Corp', 'fit'],
  ['rating', 'Acme Corp', 'fit'],
  ['formula', 'Acme Corp', 'fit'],
  ['summary', 'Acme Corp', 'fit'],
  ['lookup', 'Acme Corp', 'fit'],
  ['master_detail', 'Acme Corp', 'fit'],
  ['tree', 'Acme Corp', 'fit'],
  ['email', 'Acme Corp', 'fit'],
  ['url', 'Acme Corp', 'fit'],
  ['phone', 'Acme Corp', 'fit'],
  ['color', 'Acme Corp', 'fit'],
  ['file', 'Acme Corp', 'fit'],
  ['video', 'Acme Corp', 'fit'],
  ['audio', 'Acme Corp', 'fit'],
  // ── plain inline text: objectui#8481's declared json-literal fence ──────
  ['location', '{"id":"acct-1","name":"Acme Corp"}', 'fit'],
  ['geolocation', '{"id":"acct-1","name":"Acme Corp"}', 'fit'],
  ['address', '{"id":"acct-1","name":"Acme Corp"}', 'fit'],
  ['json', '{"id":"acct-1","name":"Acme Corp"}', 'fit'],
  ['object', '{"id":"acct-1","name":"Acme Corp"}', 'fit'],
  ['composite', '{"id":"acct-1","name":"Acme Corp"}', 'fit'],
  ['record', '{"id":"acct-1","name":"Acme Corp"}', 'fit'],
  // ── plain inline text: value-independent faces ─────────────────────────
  ['password', '••••••', 'fit'],
  ['secret', '••••••', 'fit'],
  ['vector', '[Vector]', 'fit'],
  ['grid', '[Grid]', 'fit'],
  // ── refused: a pill inside a pill ──────────────────────────────────────
  ['select', 'Acme Corp', 'pill-in-pill'],
  ['status', 'Acme Corp', 'pill-in-pill'],
  ['multiselect', 'Acme Corp', 'pill-in-pill'],
  ['radio', 'Acme Corp', 'pill-in-pill'],
  ['checkboxes', 'Acme Corp', 'pill-in-pill'],
  ['tags', 'Acme Corp', 'pill-in-pill'],
  // ── refused: an avatar composite ───────────────────────────────────────
  ['user', 'ACAcme Corp', 'avatar'],
  // ── refused: an image and no text ──────────────────────────────────────
  ['image', '', 'image-no-text'],
  ['avatar', '', 'image-no-text'],
  ['signature', '', 'image-no-text'],
  // ── refused: a "No value" face for a value the band above called filled ─
  ['boolean', '—', 'no-value-face'],
  ['toggle', '—', 'no-value-face'],
  ['datetime', '—', 'no-value-face'],
  ['repeater', '—', 'no-value-face'],
  // `date` draws `formatDate`'s OWN em-dash, not the shared affordance
  // (objectui#8581's subject). Recorded as it is, refused for the same reason.
  ['date', '—', 'no-value-face'],
];

function assertCensusComplete(entries: readonly unknown[], expected: number, what: string): void {
  if (entries.length !== expected) {
    throw new Error(
      `${what}: expected exactly ${expected} registered field types, got ${entries.length}. ` +
        'A census over a short or empty set passes without measuring anything.',
    );
  }
}

/** Render one type into the real chip Badge, exactly as `DetailView` builds it. */
function renderChip(type: string) {
  const Renderer = getCellRenderer(resolveCellRendererType({ type }) || type);
  return render(
    <Badge variant="secondary" className={CHIP_CLASS}>
      <Renderer value={OBJ as any} field={{ type, name: type } as any} />
    </Badge>,
  );
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const nestedPills = (chip: HTMLElement) =>
  Array.from(chip.querySelectorAll('*')).filter((e) =>
    (e.getAttribute('class') || '').split(/\s+/).includes('rounded-full'),
  );

describe('objectui#8464 — the Badge-fit census: A is not free, and here is which kinds it costs', () => {
  it('THE CENSUS — the guard refuses a short or EMPTY set (a census over nothing passes)', () => {
    expect(() => assertCensusComplete([], REGISTERED_TYPE_COUNT, 'census')).toThrowError(
      /expected exactly 53 registered field types, got 0/,
    );
    expect(() =>
      assertCensusComplete(CENSUS, REGISTERED_TYPE_COUNT, 'census'),
    ).not.toThrow();
    expect(new Set(CENSUS.map(([t]) => t)).size, 'the census must not repeat a type').toBe(
      REGISTERED_TYPE_COUNT,
    );
  });

  it('THE CENSUS — all 53 registered types draw their measured face inside the chip Badge', async () => {
    assertCensusComplete(CENSUS, REGISTERED_TYPE_COUNT, 'census');
    let measured = 0;
    for (const [type, text] of CENSUS) {
      const { container } = renderChip(type);
      await settle();
      const chip = container.firstElementChild as HTMLElement;
      expect((chip.textContent ?? '').replace(/\s+/g, ' ').trim(), `${type}: the pill's text`).toBe(
        text,
      );
      measured += 1;
      cleanup();
    }
    expect(measured, 'every row was rendered, not skipped').toBe(REGISTERED_TYPE_COUNT);
  });

  it('THE REFUSALS — each refused class is refused for the artefact it actually produced', async () => {
    const refused = CENSUS.filter(([, , v]) => v !== 'fit');
    expect(
      refused.length,
      'fifteen types are refused: 6 pill-in-pill, 1 avatar, 3 image-no-text, 5 no-value-face',
    ).toBe(15);

    for (const [type, , verdict] of refused) {
      const { container } = renderChip(type);
      await settle();
      const chip = container.firstElementChild as HTMLElement;

      if (verdict === 'pill-in-pill') {
        expect(nestedPills(chip).length, `${type}: the option renderer nests its own pill`).toBe(1);
      }
      if (verdict === 'avatar') {
        // ⚠️ TWO nodes, not one — Radix `Avatar.Root` AND `AvatarFallback`.
        expect(nestedPills(chip).length, `${type}: an avatar is two rounded-full nodes`).toBe(2);
      }
      if (verdict === 'image-no-text') {
        expect(chip.querySelectorAll('img').length, `${type}: draws an image`).toBe(1);
        expect(chip.textContent, `${type}: and no text at all`).toBe('');
      }
      if (verdict === 'no-value-face') {
        expect(
          (chip.textContent ?? '').trim(),
          `${type}: answers "no value" for a value hasCellValue called filled`,
        ).toBe('—');
      }
      cleanup();
    }
  });

  it('⭐ THE SET MATCHES THE MEASUREMENT — the constant is derived from this table, not from memory', () => {
    const measuredRefusals = CENSUS.filter(([, , v]) => v !== 'fit').map(([t]) => t).sort();
    expect(
      [...CHIP_UNFIT_RENDERER_TYPES].sort(),
      'CHIP_UNFIT_RENDERER_TYPES must name exactly the kinds this census refused',
    ).toEqual(measuredRefusals);

    // And the predicate the chip actually calls agrees, row by row — so the
    // constant cannot be right while the function reading it is not.
    for (const [type, , verdict] of CENSUS) {
      expect(chipTakesCellRenderer(type), `${type} is routed per its measured verdict`).toBe(
        verdict === 'fit',
      );
    }
  });

  it('THE FIT SIDE IS LOAD-BEARING — the 38 fitting kinds draw text and no artefact', async () => {
    // Refusing EVERY type also satisfies every refusal assertion above; this is
    // the half that is red for it.
    const fitting = CENSUS.filter(([, , v]) => v === 'fit');
    expect(fitting.length, 'the fitting side is not empty').toBe(38);

    for (const [type] of fitting) {
      const { container } = renderChip(type);
      await settle();
      const chip = container.firstElementChild as HTMLElement;
      expect((chip.textContent ?? '').trim().length, `${type}: draws text`).toBeGreaterThan(0);
      expect(nestedPills(chip).length, `${type}: no nested pill`).toBe(0);
      expect(chip.querySelectorAll('img').length, `${type}: no image`).toBe(0);
      expect(
        chip.querySelectorAll('a[href],button,[role="button"],input').length,
        `${type}: no interactive control beside the page title`,
      ).toBe(0);
      cleanup();
    }
  });
});
