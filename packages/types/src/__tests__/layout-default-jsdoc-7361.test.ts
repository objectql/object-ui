// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The `@default` documentation on `layout.ts` members agrees with the value the
 * renderer actually applies (objectui#7361 rows 1-2, objectui#7734 row 3,
 * objectui#7735 rows 4-7).
 *
 * Three published docblocks described a default that at least one consuming
 * renderer does not apply:
 *
 *   | member                      | tag said   | renderer applies                   |
 *   |-----------------------------|------------|------------------------------------|
 *   | `ContainerSchema.maxWidth`  | `'lg'`     | `container.tsx`: `?? 'xl'`         |
 *   | `FlexLayoutProps.align`     | `'center'` | `flex.tsx`: `|| 'start'`,          |
 *   |                             |            | `stack.tsx`: `|| 'stretch'`        |
 *   | `FlexLayoutProps.direction` | `'row'`    | `flex.tsx`: `|| 'row'`,            |
 *   |                             |            | `stack.tsx`: `|| 'col'`            |
 *
 * objectui#7735 added four more rows, and they were found only because that card
 * changed the COMPARATOR. Its ruling made the renderer the single authoritative
 * default and stripped every `.default()` off the zod mirror; the first report
 * of it checked each tag against the value the MIRROR used to write, which is
 * the wrong reference — the two agreeing proves only that the docs copied the
 * mirror. Re-measured against the renderer, four more tags misdescribed it:
 *
 *   | member                      | tag said     | the renderer applies                  |
 *   |-----------------------------|--------------|---------------------------------------|
 *   | `GridSchema.columns`        | `3`          | `grid.tsx`: `let baseCols = 2`        |
 *   | `TextSchema.variant`        | `'body'`     | `text.tsx`: none — absence is not     |
 *   |                             |              | `body` (objectui#6942)                |
 *   | `ResizableSchema.withHandle`| `true`       | forwarded bare; `undefined` draws     |
 *   |                             |              | NO grip                               |
 *   | `PageNodeSchema.template`   | `'default'`  | `page.tsx`: null template falls       |
 *   |                             |              | through to the `pageType` switch      |
 *
 * Every one of the four had matched the mirror exactly, which is why a
 * mirror-referenced check called the whole face clean.
 *
 * The renderers are the authority — they are what runs — so the tags moved, not
 * the reads. Changing the reads to match the tags would relayout every existing
 * page that omits either key, which is a behaviour change and a separate ruling.
 *
 * `FlexLayoutProps.align` and `FlexLayoutProps.direction` are the structurally
 * interesting rows. Each member is declared ONCE (objectui#6151 — see the
 * interface docblock for why `StackSchema` cannot derive them with an `Omit`),
 * but `flex` and `stack` deliberately diverge on both: that divergence is most of
 * what distinguishes the two component types. So no single `@default` value can
 * be correct there, and the fix is the absence of a tag plus prose naming both
 * consumers — not a second wrong single value. `direction` is the sharper case:
 * its tag was not wrong for everybody the way `align`'s `'center'` was — `flex`
 * really does apply `'row'` — which is exactly why "a shared member's tag is only
 * conditionally true" is the defect, not "the value is wrong".
 *
 * The criterion is DIVERGENCE, not sharedness. `FlexLayoutProps.justify` is
 * shared by the same two consumers and both read `|| 'start'`, so its tag is
 * correct and must stay — it is pinned below as a negative control, and it is
 * what stops this row-by-row fix from generalising into "shared members carry no
 * tags".
 *
 * ## Why this pin reads both sides off disk
 *
 * Every expected value below is DERIVED: the renderer's fallback is extracted
 * from the renderer source with a narrow regex, and compared against the
 * docblock text extracted from `layout.ts`. Nothing is written from memory, so
 * the pin turns red if EITHER side moves — a renderer changing its fallback
 * without the docblock following is the same defect this card fixed, in the
 * other direction.
 *
 * The regexes are guarded by explicit positive controls: a regex that quietly
 * matches nothing would make every assertion below vacuously true, which is the
 * failure mode this pin exists to prevent.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8');

const TYPES = 'packages/types/src/layout.ts';
const CONTAINER = 'packages/components/src/renderers/layout/container.tsx';
const FLEX = 'packages/components/src/renderers/layout/flex.tsx';
const STACK = 'packages/components/src/renderers/layout/stack.tsx';

/** The fallback each renderer applies when the authored key is absent. */
const CONTAINER_MAXWIDTH = /schema\.maxWidth\s*\?\?\s*'([^']+)'/;
const FLEX_ALIGN = /schema\.align\s*\|\|\s*'([^']+)'/;
const STACK_ALIGN = /schema\.align\s*\|\|\s*'([^']+)'/;
const FLEX_DIRECTION = /schema\.direction\s*\|\|\s*'([^']+)'/;
const STACK_DIRECTION = /schema\.direction\s*\|\|\s*'([^']+)'/;
const FLEX_JUSTIFY = /schema\.justify\s*\|\|\s*'([^']+)'/;
const STACK_JUSTIFY = /schema\.justify\s*\|\|\s*'([^']+)'/;

/** The body of a named `export interface`, so member lookups cannot stray. */
function interfaceBody(src: string, name: string): string {
  const start = src.indexOf(`export interface ${name}`);
  expect(start, `interface ${name} not found in ${TYPES}`).toBeGreaterThan(-1);
  const open = src.indexOf('{', start);
  const end = src.indexOf('\n}', open);
  expect(end, `interface ${name} is unterminated`).toBeGreaterThan(open);
  return src.slice(start, end);
}

/** The docblock immediately preceding `member` inside an interface body. */
function docblockFor(body: string, member: string): string {
  const idx = body.search(new RegExp(`\\n\\s*${member}\\?:`));
  expect(idx, `member ${member} not found`).toBeGreaterThan(-1);
  const before = body.slice(0, idx);
  const open = before.lastIndexOf('/**');
  const close = before.lastIndexOf('*/');
  expect(open, `no docblock before ${member}`).toBeGreaterThan(-1);
  expect(close).toBeGreaterThan(open);
  return before.slice(open, close + 2);
}

/** Every `@default` BLOCK tag in a docblock (an inline mention is not a tag). */
function defaultTags(doc: string): string[] {
  return [...doc.matchAll(/^\s*\*\s*@default\s+(.*)$/gm)].map((m) => m[1].trim());
}

describe('layout.ts `@default` docs agree with the renderer fallbacks (objectui#7361)', () => {
  const types = read(TYPES);

  describe('positive controls — the regexes match today', () => {
    it('finds the fallback each of the three renderers applies', () => {
      expect(CONTAINER_MAXWIDTH.exec(read(CONTAINER))).not.toBeNull();
      expect(FLEX_ALIGN.exec(read(FLEX))).not.toBeNull();
      expect(STACK_ALIGN.exec(read(STACK))).not.toBeNull();
      expect(FLEX_DIRECTION.exec(read(FLEX))).not.toBeNull();
      expect(STACK_DIRECTION.exec(read(STACK))).not.toBeNull();
      expect(FLEX_JUSTIFY.exec(read(FLEX))).not.toBeNull();
      expect(STACK_JUSTIFY.exec(read(STACK))).not.toBeNull();
    });

    it('each extracted fallback is a member of the union the type declares', () => {
      const maxWidth = CONTAINER_MAXWIDTH.exec(read(CONTAINER))![1];
      const flexAlign = FLEX_ALIGN.exec(read(FLEX))![1];
      const stackAlign = STACK_ALIGN.exec(read(STACK))![1];
      const flexDirection = FLEX_DIRECTION.exec(read(FLEX))![1];
      const stackDirection = STACK_DIRECTION.exec(read(STACK))![1];
      const container = interfaceBody(types, 'ContainerSchema');
      const flexProps = interfaceBody(types, 'FlexLayoutProps');
      expect(container).toContain(`'${maxWidth}'`);
      expect(flexProps).toContain(`'${flexAlign}'`);
      expect(flexProps).toContain(`'${stackAlign}'`);
      expect(flexProps).toContain(`'${flexDirection}'`);
      expect(flexProps).toContain(`'${stackDirection}'`);
    });
  });

  describe('row 1 — ContainerSchema.maxWidth', () => {
    it('carries exactly one `@default`, and it is the value container.tsx applies', () => {
      const applied = CONTAINER_MAXWIDTH.exec(read(CONTAINER))![1];
      const doc = docblockFor(interfaceBody(types, 'ContainerSchema'), 'maxWidth');
      expect(defaultTags(doc)).toEqual([`'${applied}'`]);
    });

    it('names the read site so the next reader can re-derive it', () => {
      const doc = docblockFor(interfaceBody(types, 'ContainerSchema'), 'maxWidth');
      expect(doc).toContain('container.tsx');
      expect(doc).toContain('??');
    });
  });

  describe('row 2 — FlexLayoutProps.align (shared member, two divergent consumers)', () => {
    const flexAlign = FLEX_ALIGN.exec(read(FLEX))![1];
    const stackAlign = STACK_ALIGN.exec(read(STACK))![1];

    it('the two consumers really do diverge — the reason a single tag cannot be right', () => {
      expect(flexAlign).not.toEqual(stackAlign);
    });

    it('publishes NO single-value `@default` block tag', () => {
      const doc = docblockFor(interfaceBody(types, 'FlexLayoutProps'), 'align');
      expect(defaultTags(doc)).toEqual([]);
    });

    it('names BOTH consumers and the fallback each one applies', () => {
      const doc = docblockFor(interfaceBody(types, 'FlexLayoutProps'), 'align');
      expect(doc).toContain('flex.tsx');
      expect(doc).toContain('stack.tsx');
      expect(doc).toContain(`'${flexAlign}'`);
      expect(doc).toContain(`'${stackAlign}'`);
    });

    it('no longer publishes the value neither renderer applies', () => {
      const doc = docblockFor(interfaceBody(types, 'FlexLayoutProps'), 'align');
      expect(defaultTags(doc)).not.toContain("'center'");
    });
  });

  describe('row 3 — FlexLayoutProps.direction (shared member, two divergent consumers)', () => {
    const flexDirection = FLEX_DIRECTION.exec(read(FLEX))![1];
    const stackDirection = STACK_DIRECTION.exec(read(STACK))![1];

    it('the two consumers really do diverge — the reason a single tag cannot be right', () => {
      expect(flexDirection).not.toEqual(stackDirection);
    });

    it('publishes NO single-value `@default` block tag', () => {
      const doc = docblockFor(interfaceBody(types, 'FlexLayoutProps'), 'direction');
      expect(defaultTags(doc)).toEqual([]);
    });

    it('names BOTH consumers and the fallback each one applies', () => {
      const doc = docblockFor(interfaceBody(types, 'FlexLayoutProps'), 'direction');
      expect(doc).toContain('flex.tsx');
      expect(doc).toContain('stack.tsx');
      expect(doc).toContain(`'${flexDirection}'`);
      expect(doc).toContain(`'${stackDirection}'`);
    });

    it('no longer publishes the value only ONE of the two consumers applies', () => {
      const doc = docblockFor(interfaceBody(types, 'FlexLayoutProps'), 'direction');
      expect(defaultTags(doc)).not.toContain(`'${flexDirection}'`);
    });
  });

  describe('negative controls — neighbouring `@default` tags are untouched', () => {
    it('ContainerSchema.centered still reads `@default true`', () => {
      const doc = docblockFor(interfaceBody(types, 'ContainerSchema'), 'centered');
      expect(defaultTags(doc)).toEqual(['true']);
    });

    /**
     * The load-bearing control. `justify` is shared by the same two consumers as
     * `align` and `direction`, so it is what makes the criterion DIVERGENCE and
     * not sharedness: both renderers read `|| 'start'`, so one tag IS right for
     * both and must stay. Derived off disk like the rows above, so it turns red
     * if the consumers ever diverge here — at which point the tag becomes a
     * fourth instance of this defect rather than a control.
     */
    it('FlexLayoutProps.justify keeps its tag — its two consumers AGREE', () => {
      const flexJustify = FLEX_JUSTIFY.exec(read(FLEX))![1];
      const stackJustify = STACK_JUSTIFY.exec(read(STACK))![1];
      expect(flexJustify).toEqual(stackJustify);
      const doc = docblockFor(interfaceBody(types, 'FlexLayoutProps'), 'justify');
      expect(defaultTags(doc)).toEqual([`'${flexJustify}'`]);
    });

    it('FlexLayoutProps.gap still reads `@default 2`', () => {
      const doc = docblockFor(interfaceBody(types, 'FlexLayoutProps'), 'gap');
      expect(defaultTags(doc)).toEqual(['2']);
    });
  });
});

/**
 * objectui#7735 rows. Same rule as above and the same two-sided derivation, but
 * these four renderers do not express their default as `schema.x ?? 'lit'`, so
 * each row extracts the shape that renderer actually uses. That is why they are
 * written out one at a time instead of swept: `let baseCols = 2` is an
 * initialiser, `withHandle` is a bare forward whose default is the absence of a
 * grip, and `template` resolves through a registry lookup that returns `null`.
 * A generic `schema.x || 'lit'` sweep is blind to all three — measured: it
 * scores `grid.columns` as "read, no literal fallback" and finds nothing to
 * compare, which is exactly how these four stayed invisible.
 */
const GRID_BASE_COLS = /let baseCols = (\d+);/;
const TEXT_VARIANT_CONDITIONAL = /schema\.variant \? VARIANT_CLASS\[schema\.variant\] : undefined/;
const RESIZABLE_FORWARDS_BARE = /withHandle=\{schema\.withHandle\}/;
const RESIZABLE_GRIP_GATE = /\{withHandle && \(/;
const PAGE_TEMPLATE_NULL = /if \(!schema\.template\) return null;/;

const GRID = 'packages/components/src/renderers/layout/grid.tsx';
const TEXT = 'packages/components/src/renderers/basic/text.tsx';
const RESIZABLE = 'packages/components/src/renderers/complex/resizable.tsx';
const RESIZABLE_UI = 'packages/components/src/ui/resizable.tsx';
const PAGE = 'packages/components/src/renderers/layout/page.tsx';

describe('layout.ts `@default` docs agree with the renderer, re-measured (objectui#7735)', () => {
  const types = read(TYPES);

  describe('positive controls — every extraction still matches', () => {
    it('each renderer still writes the shape its row is derived from', () => {
      expect(GRID_BASE_COLS.exec(read(GRID)), GRID).not.toBeNull();
      expect(TEXT_VARIANT_CONDITIONAL.exec(read(TEXT)), TEXT).not.toBeNull();
      expect(RESIZABLE_FORWARDS_BARE.exec(read(RESIZABLE)), RESIZABLE).not.toBeNull();
      expect(RESIZABLE_GRIP_GATE.exec(read(RESIZABLE_UI)), RESIZABLE_UI).not.toBeNull();
      expect(PAGE_TEMPLATE_NULL.exec(read(PAGE)), PAGE).not.toBeNull();
    });

    it('each member is still declared where this file looks for it', () => {
      expect(() => docblockFor(interfaceBody(types, 'GridSchema'), 'columns')).not.toThrow();
      expect(() => docblockFor(interfaceBody(types, 'TextSchema'), 'variant')).not.toThrow();
      expect(() => docblockFor(interfaceBody(types, 'ResizableSchema'), 'withHandle')).not.toThrow();
      expect(() => docblockFor(interfaceBody(types, 'PageNodeSchema'), 'template')).not.toThrow();
    });
  });

  describe('row 4 — GridSchema.columns (a value tag, corrected)', () => {
    it('carries exactly one `@default`, and it is grid.tsx\'s own initialiser', () => {
      const applied = GRID_BASE_COLS.exec(read(GRID))![1];
      const doc = docblockFor(interfaceBody(types, 'GridSchema'), 'columns');
      expect(defaultTags(doc)).toEqual([applied]);
    });

    it('no longer publishes `3`, the value only the mirror ever wrote', () => {
      const doc = docblockFor(interfaceBody(types, 'GridSchema'), 'columns');
      expect(defaultTags(doc)).not.toContain('3');
    });

    it('names the read site so the next reader can re-derive it', () => {
      const doc = docblockFor(interfaceBody(types, 'GridSchema'), 'columns');
      expect(doc).toContain('grid.tsx');
      expect(doc).toContain('baseCols');
    });
  });

  /**
   * The three rows below take objectui#7361's `align` shape: where the renderer
   * applies NO value, the honest documentation is the absence of a tag plus
   * prose naming the read site — not a second value that happens to describe
   * the observable effect.
   */
  describe('row 5 — TextSchema.variant (the renderer applies none)', () => {
    it('publishes NO `@default` block tag', () => {
      expect(defaultTags(docblockFor(interfaceBody(types, 'TextSchema'), 'variant'))).toEqual([]);
    });

    it('names the read site and the rule it belongs to', () => {
      const doc = docblockFor(interfaceBody(types, 'TextSchema'), 'variant');
      expect(doc).toContain('text.tsx');
      expect(doc).toContain('6942');
    });

    /**
     * The discrimination control, and it is not hypothetical here: this
     * docblock's prose QUOTES the retired tag, so the text `@default 'body'`
     * is present in the file while the member publishes no tag. `defaultTags`
     * matches `@default` only as a BLOCK tag — immediately after the `*` — so
     * a backtick-quoted mention is invisible to it. Without this control, an
     * assertion that the tag list is empty could be passing because the
     * extractor had quietly stopped matching anything at all.
     */
    it('the prose mentions the retired tag, and the extractor is not fooled by it', () => {
      const doc = docblockFor(interfaceBody(types, 'TextSchema'), 'variant');
      expect(doc).toContain("@default 'body'");
      expect(defaultTags(doc)).toEqual([]);
      // …and the extractor really can see a real tag in a neighbouring member.
      expect(defaultTags(docblockFor(interfaceBody(types, 'IconSchema'), 'size'))).toEqual(['24']);
    });

    it('the renderer really does apply nothing on absence', () => {
      // A conditional read, not a fallback: no `||`/`??` with a literal on this
      // key anywhere in the file. If one ever appears, this row needs re-reading.
      expect(read(TEXT)).not.toMatch(/schema\.variant\s*(\|\||\?\?)\s*'/);
    });
  });

  describe('row 6 — ResizableSchema.withHandle (forwarded bare; absence draws no grip)', () => {
    it('publishes NO `@default` block tag', () => {
      expect(defaultTags(docblockFor(interfaceBody(types, 'ResizableSchema'), 'withHandle'))).toEqual([]);
    });

    it('no longer publishes `true`, which is the opposite of what happens', () => {
      expect(defaultTags(docblockFor(interfaceBody(types, 'ResizableSchema'), 'withHandle'))).not.toContain('true');
    });

    it('names both halves of the mechanism', () => {
      const doc = docblockFor(interfaceBody(types, 'ResizableSchema'), 'withHandle');
      expect(doc).toContain('resizable.tsx');
      expect(doc).toContain('undefined');
    });

    it('the renderer really does forward it without a fallback', () => {
      expect(read(RESIZABLE)).not.toMatch(/schema\.withHandle\s*(\|\||\?\?)/);
    });
  });

  describe('row 7 — PageNodeSchema.template (absence dispatches on pageType)', () => {
    it('publishes NO `@default` block tag', () => {
      expect(defaultTags(docblockFor(interfaceBody(types, 'PageNodeSchema'), 'template'))).toEqual([]);
    });

    it("no longer publishes `'default'`", () => {
      expect(defaultTags(docblockFor(interfaceBody(types, 'PageNodeSchema'), 'template'))).not.toContain("'default'");
    });

    it('names the resolver and what absence falls through to', () => {
      const doc = docblockFor(interfaceBody(types, 'PageNodeSchema'), 'template');
      expect(doc).toContain('resolveTemplate');
      expect(doc).toContain('pageType');
    });

    /**
     * The load-bearing half of this row. `'default'` is a REAL key in
     * `TEMPLATE_REGISTRY`, so the mirror's `.default('default')` did not merely
     * document the wrong thing — it made a parsed page take the template branch
     * and skip the `pageType` dispatch. If that registry entry ever disappears
     * the row stops being about a behaviour change and the prose needs redoing.
     */
    it("`'default'` really is a template the registry resolves", () => {
      expect(read(PAGE)).toMatch(/'default':\s*FullWidthTemplate/);
    });
  });
});

/**
 * objectui#8318 rows — the seven keys the re-test found LIVE.
 *
 * ## Why these rows exist at all
 *
 * objectui#8318 classified 16 of objectui#7735's 41 de-defaulted keys as "no
 * registered renderer reads the key at all", so that `@default` on them
 * describes nothing that runs. Its exemplar was `CardSchema.variant`, measured
 * as "both files registering `card` contain no read of `schema.variant`".
 *
 * That sentence is true and the conclusion does not follow. `SchemaRenderer`
 * hands a node's REMAINING keys to the component as React props (the strip list
 * is the destructure just above `...componentProps`), so a renderer can consume
 * a key WITHOUT NAMING IT and a `schema.KEY` grep cannot see that channel —
 * objectui#8410. The triage seat inverted the burden of proof and required a
 * three-question re-test of all 16: (a) is the key among `SchemaRenderer`'s
 * stripped metadata keys, (b) does the registering renderer destructure and
 * forward the rest-spread, (c) does the primitive actually consume the prop.
 *
 * The re-test found the classification wrong for SEVEN keys, and the reason is
 * duller than the spread channel: the original sweep looked only inside
 * `packages/components/src/renderers/`. Every reader below is a DIRECT
 * `schema.KEY` / `action.KEY` read, in a package that sweep never opened —
 * `packages/plugin-detail`, `packages/runner`, `packages/core/src/actions`.
 * Each one applies EXACTLY the value its `@default` publishes, which is why
 * these are pinnable as agreement rows rather than corrections: nothing about
 * the documentation moves, but from here CI notices if either side does.
 *
 *   | member                     | tag          | the reader, and what it applies         |
 *   |----------------------------|--------------|-----------------------------------------|
 *   | `ActionSchema.method`      | `'POST'`     | `ActionRunner.executeAPI`: `|| 'POST'`  |
 *   | `ActionSchema.chainMode`   | `'sequential'`| `handlePostExecution`: `|| 'sequential'`|
 *   | `ActionSchema.reload`      | `true`       | `executeActionSchema`: `!== false`      |
 *   | `ActionSchema.close`       | `true`       | `executeActionSchema`: `!== false`      |
 *   | `DetailSchema.showBack`    | `true`       | `DetailView`: `(schema.showBack ?? true)`|
 *   | `DetailViewSchema.showBack`| `true`       | the same two read sites                 |
 *   | `AppComponentSchema.layout`| `"sidebar"`  | `LayoutRenderer`: `app.layout \|\| 'sidebar'`|
 *
 * `DetailSchema.showBack` and `DetailViewSchema.showBack` share one reader
 * because `plugin-detail` registers BOTH node types onto `DetailView`
 * (`register('detail', DetailView)` and `register('detail-view',
 * DetailViewRenderer)`, the latter a gate wrapper around the same component).
 * That is the `FlexLayoutProps.align` shape from the top of this file with the
 * sign flipped: two declarations, one consumer, and the two tags AGREE — so
 * unlike `align` a single value IS right for both, and both rows are pinned to
 * the same derivation. If the two node types ever diverge, this pin is what
 * says so.
 *
 * ## What is deliberately NOT pinned here, and why
 *
 * `DetailSchema.loading` and `DetailViewSchema.loading` are ALSO live —
 * `DetailView` reads `schema.loading` at the skeleton gate — but their tag says
 * `true` while the read is a bare `||` disjunct, so an omitted key renders NO
 * skeleton and the effective default is `false`. That is a genuine objectui#7735
 * instance hiding inside the population objectui#8318 called referent-less, and
 * it is the sharpest thing the re-test found. It is not pinned because BOTH
 * possible fixes are somebody's ruling — correct the tag to `false`, or give the
 * reader the `?? true` the tag promises (a behaviour change) — and a pin on
 * either side of an open question pre-empts it. Pinning the tag as it stands
 * would pin the defect; pinning the reader as it stands would redden the fix.
 *
 * The other nine keys stay unpinned for the opposite reason: the re-test could
 * not find a reader for them, and "no reader" is the input to objectui#8318's
 * own question 1 (is the tag wrong, or is the key dead?), which is order-locked
 * behind this measurement and reserved to the maintainer. The absence of a
 * `crud-dialog` renderer is already recorded on the tree — see the header of
 * `handler-keys-string-any-mirrors-7344.test.ts` and `crud.zod.ts` — and is not
 * duplicated here.
 *
 * ## Derivation
 *
 * Same two-sided rule as every row above: the reader's fallback is extracted
 * from the reader's own source, the tag from the declaring `.ts`, and the two
 * are compared. Two extractions here are NEGATION-shaped (`x !== false`), where
 * the applied default is the negation of the compared literal rather than the
 * literal itself; the helper below does that conversion in one place so the row
 * assertions stay readable. Two others match in more than one place, and the
 * pin requires every site to agree — a fallback that disagrees with itself is
 * not a fallback, and `@default` would have no single referent to describe.
 *
 * Quote style differs between the declaring files (`'POST'` vs `"sidebar"`), so
 * the comparison strips the outer quotes. Quoting is not the contract; the
 * value is. Exactly-one-tag is asserted separately, so a second tag cannot hide.
 */
const CRUD = 'packages/types/src/crud.ts';
const VIEWS = 'packages/types/src/views.ts';
const APP = 'packages/types/src/app.ts';
const ACTION_RUNNER = 'packages/core/src/actions/ActionRunner.ts';
const DETAIL_VIEW = 'packages/plugin-detail/src/DetailView.tsx';
const PLUGIN_DETAIL_INDEX = 'packages/plugin-detail/src/index.tsx';
const LAYOUT_RENDERER = 'packages/runner/src/LayoutRenderer.tsx';

/** `action.method || 'POST'` — both branches of `executeAPI`. */
const ACTION_METHOD = /action\.method \|\| '([^']+)'/g;
/** `action.chainMode || 'sequential'` — the chain dispatch. */
const ACTION_CHAIN_MODE = /action\.chainMode \|\| '([^']+)'/g;
/** `result.reload = action.reload !== false` — a NEGATION-shaped default. */
const ACTION_RELOAD = /result\.reload = action\.reload !== (true|false);/g;
/** `result.close = action.close !== false` — the same shape. */
const ACTION_CLOSE = /result\.close = action\.close !== (true|false);/g;
/** `(schema.showBack ?? true)` — both read sites in `DetailView`. */
const DETAIL_SHOW_BACK = /\(schema\.showBack \?\? (true|false)\)/g;
/** `app.layout || 'sidebar'` — the app-shell layout selector. */
const APP_LAYOUT = /app\.layout \|\| '([^']+)'/g;

/**
 * Every capture of `re` in `src`, asserted non-empty and unanimous.
 *
 * The non-empty half is the positive control this file requires of every
 * extraction: a regex that quietly stopped matching would make its row
 * vacuously true. The unanimity half is a claim about the code — where a
 * fallback is written more than once, all of its spellings must agree, or
 * "the value the renderer applies" is not a single value for `@default` to
 * describe.
 */
function soleCapture(src: string, re: RegExp, where: string): string {
  const found = [...src.matchAll(new RegExp(re.source, 'g'))].map((m) => m[1]);
  expect(found.length, `no match for ${re.source} in ${where}`).toBeGreaterThan(0);
  expect(new Set(found).size, `${re.source} disagrees with itself in ${where}: ${found.join(', ')}`).toBe(1);
  return found[0];
}

/** The default a `x !== <literal>` read applies when the key is absent. */
const negationDefault = (compared: string): string => String(compared === 'false');

/** A `@default` tag's value with any outer quoting removed. */
const unquote = (tag: string): string => tag.replace(/^['"]|['"]$/g, '');

/** The single `@default` a member publishes, unquoted. */
function soleDefaultTag(body: string, member: string): string {
  const tags = defaultTags(docblockFor(body, member));
  expect(tags, `${member} should publish exactly one @default`).toHaveLength(1);
  return unquote(tags[0]);
}

describe('objectui#8318 — the `@default`s the "no renderer reads it" list got wrong', () => {
  const crud = read(CRUD);
  const views = read(VIEWS);
  const app = read(APP);

  describe('positive controls — every extraction still matches, and each reader is still wired', () => {
    it('each reader still writes the shape its row is derived from', () => {
      const runner = read(ACTION_RUNNER);
      expect(soleCapture(runner, ACTION_METHOD, ACTION_RUNNER)).toBeTruthy();
      expect(soleCapture(runner, ACTION_CHAIN_MODE, ACTION_RUNNER)).toBeTruthy();
      expect(soleCapture(runner, ACTION_RELOAD, ACTION_RUNNER)).toBeTruthy();
      expect(soleCapture(runner, ACTION_CLOSE, ACTION_RUNNER)).toBeTruthy();
      expect(soleCapture(read(DETAIL_VIEW), DETAIL_SHOW_BACK, DETAIL_VIEW)).toBeTruthy();
      expect(soleCapture(read(LAYOUT_RENDERER), APP_LAYOUT, LAYOUT_RENDERER)).toBeTruthy();
    });

    it('each member is still declared where this file looks for it', () => {
      expect(() => docblockFor(interfaceBody(crud, 'ActionSchema'), 'method')).not.toThrow();
      expect(() => docblockFor(interfaceBody(crud, 'ActionSchema'), 'chainMode')).not.toThrow();
      expect(() => docblockFor(interfaceBody(crud, 'ActionSchema'), 'reload')).not.toThrow();
      expect(() => docblockFor(interfaceBody(crud, 'ActionSchema'), 'close')).not.toThrow();
      expect(() => docblockFor(interfaceBody(crud, 'DetailSchema'), 'showBack')).not.toThrow();
      expect(() => docblockFor(interfaceBody(views, 'DetailViewSchema'), 'showBack')).not.toThrow();
      expect(() => docblockFor(interfaceBody(app, 'AppComponentSchema'), 'layout')).not.toThrow();
    });

    /**
     * The row-8/9 rows are only about ONE reader because both node types are
     * registered onto it. If that ever stops being true the two `showBack`
     * declarations acquire separate consumers and the rows below stop being
     * derivable from a single file.
     */
    it('`detail` and `detail-view` both still resolve to `DetailView`', () => {
      const index = read(PLUGIN_DETAIL_INDEX);
      expect(index).toContain("ComponentRegistry.register('detail', DetailView");
      expect(index).toContain("ComponentRegistry.register('detail-view', DetailViewRenderer");
      expect(read(PLUGIN_DETAIL_INDEX)).toMatch(/<DetailView schema=\{bound as DetailViewSchema\}/);
    });
  });

  describe('row 8 — ActionSchema.method', () => {
    it("publishes the verb `executeAPI` falls back to", () => {
      const applied = soleCapture(read(ACTION_RUNNER), ACTION_METHOD, ACTION_RUNNER);
      expect(soleDefaultTag(interfaceBody(crud, 'ActionSchema'), 'method')).toBe(applied);
    });

    it('the fallback is a member of the union the type declares', () => {
      const applied = soleCapture(read(ACTION_RUNNER), ACTION_METHOD, ACTION_RUNNER);
      expect(interfaceBody(crud, 'ActionSchema')).toContain(`'${applied}'`);
    });
  });

  describe('row 9 — ActionSchema.chainMode', () => {
    it('publishes the mode the chain dispatch falls back to', () => {
      const applied = soleCapture(read(ACTION_RUNNER), ACTION_CHAIN_MODE, ACTION_RUNNER);
      expect(soleDefaultTag(interfaceBody(crud, 'ActionSchema'), 'chainMode')).toBe(applied);
    });

    it('the fallback is a member of the union `ActionExecutionMode` declares', () => {
      const applied = soleCapture(read(ACTION_RUNNER), ACTION_CHAIN_MODE, ACTION_RUNNER);
      expect(crud).toMatch(new RegExp(`export type ActionExecutionMode[^;]*'${applied}'`));
    });
  });

  describe('row 10 — ActionSchema.reload (a negation-shaped default)', () => {
    it('publishes what `action.reload !== false` yields on absence', () => {
      const compared = soleCapture(read(ACTION_RUNNER), ACTION_RELOAD, ACTION_RUNNER);
      expect(soleDefaultTag(interfaceBody(crud, 'ActionSchema'), 'reload')).toBe(negationDefault(compared));
    });

    /**
     * The discrimination control for the negation shape. `!== false` and
     * `!== true` are one character apart and mean opposite things, so the row
     * above is only a measurement if the helper really distinguishes them.
     */
    it('the helper reads the negation in the right direction', () => {
      expect(negationDefault('false')).toBe('true');
      expect(negationDefault('true')).toBe('false');
    });
  });

  describe('row 11 — ActionSchema.close (the same shape)', () => {
    it('publishes what `action.close !== false` yields on absence', () => {
      const compared = soleCapture(read(ACTION_RUNNER), ACTION_CLOSE, ACTION_RUNNER);
      expect(soleDefaultTag(interfaceBody(crud, 'ActionSchema'), 'close')).toBe(negationDefault(compared));
    });

    /**
     * `reload` and `close` are read a second time, TOGETHER, by the
     * executability guard just above the result assembly — an action that
     * declares neither a handler nor an api is refused rather than reported as
     * a silent success. That read is why an EXPLICIT `true` is not redundant
     * with the default, and it is the reason both keys are live rather than
     * merely present.
     */
    it('both keys are also read by the executability guard', () => {
      expect(read(ACTION_RUNNER)).toMatch(/action\.reload === true \|\| action\.close === true/);
    });
  });

  describe('rows 12-13 — DetailSchema.showBack and DetailViewSchema.showBack (two declarations, one reader)', () => {
    it('DetailSchema.showBack publishes what `DetailView` applies', () => {
      const applied = soleCapture(read(DETAIL_VIEW), DETAIL_SHOW_BACK, DETAIL_VIEW);
      expect(soleDefaultTag(interfaceBody(crud, 'DetailSchema'), 'showBack')).toBe(applied);
    });

    it('DetailViewSchema.showBack publishes the same value', () => {
      const applied = soleCapture(read(DETAIL_VIEW), DETAIL_SHOW_BACK, DETAIL_VIEW);
      expect(soleDefaultTag(interfaceBody(views, 'DetailViewSchema'), 'showBack')).toBe(applied);
    });

    /**
     * The load-bearing half: the two declarations must keep AGREEING, because
     * they are consumed by one component. `FlexLayoutProps.align` is what
     * happens when that stops being true and a single tag is kept anyway.
     */
    it('the two declarations agree with each other', () => {
      expect(soleDefaultTag(interfaceBody(crud, 'DetailSchema'), 'showBack'))
        .toBe(soleDefaultTag(interfaceBody(views, 'DetailViewSchema'), 'showBack'));
    });
  });

  describe('row 14 — AppComponentSchema.layout', () => {
    it('publishes the strategy `LayoutRenderer` falls back to', () => {
      const applied = soleCapture(read(LAYOUT_RENDERER), APP_LAYOUT, LAYOUT_RENDERER);
      expect(soleDefaultTag(interfaceBody(app, 'AppComponentSchema'), 'layout')).toBe(applied);
    });

    it('the fallback is a member of the union the type declares', () => {
      const applied = soleCapture(read(LAYOUT_RENDERER), APP_LAYOUT, LAYOUT_RENDERER);
      expect(interfaceBody(app, 'AppComponentSchema')).toContain(`'${applied}'`);
    });

    /**
     * The reader is typed by the declaration it describes, which is what makes
     * it the right authority for this tag rather than a look-alike `layout` on
     * some other schema (`DetailViewSchema.layout` and `ObjectForm`'s both
     * exist and mean something else).
     */
    it('the reader is typed by AppComponentSchema, not a look-alike', () => {
      expect(read(LAYOUT_RENDERER)).toMatch(/app:\s*AppComponentSchema/);
    });
  });
});
