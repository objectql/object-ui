// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The `@default` documentation on two `layout.ts` members agrees with the value
 * the renderer actually applies (objectui#7361).
 *
 * Two published docblocks described a default no renderer ever applied:
 *
 *   | member                     | tag said   | renderer applies                    |
 *   |----------------------------|------------|-------------------------------------|
 *   | `ContainerSchema.maxWidth` | `'lg'`     | `container.tsx`: `?? 'xl'`          |
 *   | `FlexLayoutProps.align`    | `'center'` | `flex.tsx`: `|| 'start'`,           |
 *   |                            |            | `stack.tsx`: `|| 'stretch'`         |
 *
 * The renderers are the authority — they are what runs — so the tags moved, not
 * the reads. Changing the reads to match the tags would relayout every existing
 * page that omits either key, which is a behaviour change and a separate ruling.
 *
 * `FlexLayoutProps.align` is the structurally interesting half. The member is
 * declared ONCE (objectui#6151 — see the interface docblock for why `StackSchema`
 * cannot derive it with an `Omit`), but `flex` and `stack` deliberately diverge
 * on it: that divergence is most of what distinguishes the two component types.
 * So no single `@default` value can be correct there, and the fix is the absence
 * of a tag plus prose naming both consumers — not a second wrong single value.
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
    });

    it('each extracted fallback is a member of the union the type declares', () => {
      const maxWidth = CONTAINER_MAXWIDTH.exec(read(CONTAINER))![1];
      const flexAlign = FLEX_ALIGN.exec(read(FLEX))![1];
      const stackAlign = STACK_ALIGN.exec(read(STACK))![1];
      const container = interfaceBody(types, 'ContainerSchema');
      const flexProps = interfaceBody(types, 'FlexLayoutProps');
      expect(container).toContain(`'${maxWidth}'`);
      expect(flexProps).toContain(`'${flexAlign}'`);
      expect(flexProps).toContain(`'${stackAlign}'`);
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

  describe('negative controls — neighbouring `@default` tags are untouched', () => {
    it('ContainerSchema.centered still reads `@default true`', () => {
      const doc = docblockFor(interfaceBody(types, 'ContainerSchema'), 'centered');
      expect(defaultTags(doc)).toEqual(['true']);
    });

    it('FlexLayoutProps.justify still reads `@default \'start\'`', () => {
      const doc = docblockFor(interfaceBody(types, 'FlexLayoutProps'), 'justify');
      expect(defaultTags(doc)).toEqual(["'start'"]);
    });

    it('FlexLayoutProps.gap still reads `@default 2`', () => {
      const doc = docblockFor(interfaceBody(types, 'FlexLayoutProps'), 'gap');
      expect(defaultTags(doc)).toEqual(['2']);
    });
  });
});
