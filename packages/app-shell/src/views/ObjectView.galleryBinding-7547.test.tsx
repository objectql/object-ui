/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7547 — the object page must not invent a GALLERY cover binding.
 *
 * The third sibling of `ObjectView.calendarBinding-7029` (calendar) and
 * `ObjectView.ganttBinding-7070` (gantt dates) next door, and the last member
 * of that class this face still carried: `imageField` was floored at `'image'`
 * for EVERY object view, declared or not.
 *
 * ⚠️ WHAT MAKES THIS ONE DIFFERENT, and why it still had to go. For calendar
 * and gantt the fabrication produced a WRONG SCREEN — records piled onto
 * today's cell, a chart drawn on names nobody wrote. Gallery does not:
 * `ObjectGallery` resolves the cover per record and collapses the cover area
 * when no record yields one, so the invented `'image'` degraded to a gallery of
 * coverless cards. The defect is one layer up, in the GATE.
 * `ListView.availableViews` asks `schema.options?.gallery?.imageField`, and a
 * key this file always supplied made that check answer YES for every object
 * view whitelisting `gallery` — so ADR-0047's whitelist ∩ resolvable, the
 * mechanism that exists to stop a visualization being offered with nothing
 * behind it, was answering about a name this face wrote. Gallery was offered
 * without a block and looked fine only because the renderer degrades politely.
 * A coincidence, not a design.
 *
 * ⚠️ THE PREMISE WAS MEASURED BEFORE THE DELETION — the discipline objectui#7070
 * wrote down. #7029's mechanic is only correct where the read site's own answer
 * is honest. `ObjectGallery` keeps its own `coverField … ?? 'image'` rung, and
 * that is CORRECT there: it is the component's decision about an unconfigured
 * record, and it is honest because the cover area collapses when the guess
 * yields nothing (`ObjectGallery.tsx`, the `anyItemHasCover` memo). What this
 * face must not do is pre-empt that decision and light the capability gate on
 * the way past.
 *
 * REVERSE VERIFICATION — direction predicted before running, then observed:
 * restore `imageField: viewDef.gallery?.imageField || viewDef.gallery?.coverField
 * || 'image'` and the "invents NO cover field" cases below go RED (they read the
 * fabricated name) while every declared-config CONTROL stays GREEN in either
 * world — the fabricated value is only ever observable when the view declared
 * nothing. That asymmetry is the point: a fix that emitted an empty config for
 * EVERY view would also pass an absence-only test.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { galleryViewOptions } from './ObjectView';

describe('galleryViewOptions — the object page forwards, it does not invent (objectui#7547)', () => {
  it('invents NO cover field for a view that declares no gallery config', () => {
    // THE DEFECT. This used to return `{ imageField: 'image', coverField:
    // undefined, titleField: 'name' }` — a complete-looking cover binding for a
    // view that configured nothing, which is what lit the Gallery toggle on
    // every object view in the product.
    expect(galleryViewOptions({})).toEqual({ titleField: 'name' });
    expect(galleryViewOptions(undefined)).toEqual({ titleField: 'name' });
    expect(galleryViewOptions({ label: 'All', columns: ['name'] })).toEqual({ titleField: 'name' });
  });

  it('invents no cover field for a view whose neighbouring blocks ARE declared', () => {
    // A view bound for kanban/calendar must not acquire a gallery cover by
    // proximity — the Gallery toggle it would light has nothing behind it.
    const out = galleryViewOptions({
      kanban: { groupByField: 'stage' },
      calendar: { startDateField: 'start_date' },
    });
    expect(out).not.toHaveProperty('imageField');
    expect(out).not.toHaveProperty('coverField');
  });

  it('invents no cover field for an EMPTY gallery block', () => {
    // The half-written declaration: `allowedVisualizations: ['gallery']` with
    // nothing under `gallery:`. It must stay half-written all the way down.
    const out = galleryViewOptions({ gallery: {} });
    expect(out).not.toHaveProperty('imageField');
    expect(out).not.toHaveProperty('coverField');
  });

  it('invents no cover field for a gallery block that declares only PRESENTATION', () => {
    // `cardSize` / `visibleFields` are gallery keys that say nothing about a
    // cover binding. They must survive, and they must not answer the gate.
    const out = galleryViewOptions({ gallery: { cardSize: 'large', visibleFields: ['name'] } });
    expect(out).toMatchObject({ cardSize: 'large', visibleFields: ['name'] });
    expect(out).not.toHaveProperty('imageField');
    expect(out).not.toHaveProperty('coverField');
  });

  it('CONTROL: a declared `coverField` cross-fills the legacy `imageField`', () => {
    // The spec spelling is `coverField`; `ObjectGallery` still consults the
    // legacy `imageField`, and `ListView`'s gate reads `imageField` out of this
    // bag. Cross-filling a DECLARED name is forwarding, not inventing.
    const out = galleryViewOptions({ gallery: { coverField: 'photo' } });
    expect(out.coverField).toBe('photo');
    expect(out.imageField).toBe('photo');
  });

  it('CONTROL: a declared legacy `imageField` cross-fills `coverField`', () => {
    const out = galleryViewOptions({ gallery: { imageField: 'logo' } });
    expect(out.imageField).toBe('logo');
    expect(out.coverField).toBe('logo');
  });

  it('CONTROL: both spellings declared — each keeps its own value', () => {
    // The pre-#7547 precedence, unchanged: `imageField` prefers itself then
    // `coverField`, `coverField` prefers itself then `imageField`. Only the
    // `'image'` tail was removed, so a view declaring both is unaffected.
    const out = galleryViewOptions({ gallery: { imageField: 'logo', coverField: 'photo' } });
    expect(out.imageField).toBe('logo');
    expect(out.coverField).toBe('photo');
  });

  it('CONTROL: forwards a fully declared block verbatim — every spec key survives', () => {
    // A bare whitelist here would drop the presentation keys; the spread is
    // load-bearing, the same way it is in `ganttViewOptions`.
    const out = galleryViewOptions({
      gallery: {
        coverField: 'photo',
        coverFit: 'contain',
        cardSize: 'small',
        visibleFields: ['name', 'owner'],
        titleField: 'subject',
      },
    });
    expect(out).toMatchObject({
      coverField: 'photo',
      imageField: 'photo',
      coverFit: 'contain',
      cardSize: 'small',
      visibleFields: ['name', 'owner'],
      titleField: 'subject',
    });
  });

  it('keeps the `name` title floor — a display default is not a binding', () => {
    // Deliberately NOT removed by this card, and the same rung
    // `ganttViewOptions` and `timelineViewOptions` carry.
    expect(galleryViewOptions({}).titleField).toBe('name');
    expect(galleryViewOptions({ gallery: { titleField: 'subject' } }).titleField).toBe('subject');
  });
});

describe('no invented gallery cover name survives in the source (objectui#7547)', () => {
  const SOURCE = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'ObjectView.tsx'),
    'utf8',
  );

  /**
   * Executable lines only. The prose above this file's own seams names
   * `'image'` repeatedly — that is the record of what was deleted, and a scan
   * that counted it would be red on a correct tree. Same filter, and same
   * reason, as the objectui#7029 and objectui#7070 scans next door.
   */
  const CODE = SOURCE.split('\n').filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l));

  it("the fabricated 'image' floor is gone from this face's CODE", () => {
    // A structural tripwire, not a restatement of the cases above: this is what
    // a copy-paste from a sibling branch would reintroduce, and it is invisible
    // to a behavioural test on any object that happens to carry a real `image`
    // field.
    expect(CODE.filter((l) => l.includes("'image'"))).toEqual([]);
  });

  it('CONTROL (machinery): the scan can see a literal that IS there', () => {
    // Anchored on `'name'`, which is DELIBERATELY permanent here — the
    // display-name floor, not a fabricated binding, so no future card of this
    // family retires it and this control cannot go red as a side effect.
    expect(CODE.filter((l) => l.includes("'name'")).length).toBeGreaterThan(0);
  });

  it('CONTROL (same class): the scan still sees a REMAINING fabricated field name', () => {
    // Can the filter see the specific thing it hunts — a one-rung `|| 'literal'`
    // binding floor? Anchored on the CHART branch's measure floor
    // (`chartConfig.yAxisFields[0] || 'value'`), which is the same class and is
    // still there: retiring it needs a refusal path `ObjectChart` does not have,
    // so #7547 measured it and reported it rather than deciding it here.
    //
    // ⚠️ TO WHOEVER RETIRES `'value'`: this going red is the mechanic working.
    // RE-ANCHOR onto whatever fabrication legitimately remains — do not delete
    // this case, and do not weaken it to the machinery control above. If nothing
    // of this class remains in this face, convert it into the assertion that
    // NONE remains, so the scan keeps making a claim about the tree.
    expect(CODE.filter((l) => /\|\| 'value'/.test(l)).length).toBeGreaterThan(0);
  });

  it('CONTROL: the scan reads CODE, not the prose that records the deletion', () => {
    // The filter's own correctness. The seam comments above `galleryViewOptions`
    // name the deleted literal; if the filter ever stopped stripping comment
    // lines, the case above would go red on a CORRECT tree and invite someone to
    // weaken it.
    expect(SOURCE.includes("`'image'`")).toBe(true);
    expect(CODE.filter((l) => l.includes("'image'"))).toEqual([]);
  });
});
