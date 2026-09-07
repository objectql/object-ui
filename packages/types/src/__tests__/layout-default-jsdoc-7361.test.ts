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
