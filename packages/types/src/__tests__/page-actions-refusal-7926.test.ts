/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `actions` on a `page` NODE is refused at parse, and `content/docs/guide/layout.md`
 * no longer teaches it (objectui#7926, maintainer ruling 2026-09-09, decision batch
 * #107 item 2 — option A; B "declare + render" and C "docs only" were both refused).
 *
 * ## What was wrong
 *
 * `PageNodeSchema` never declared `actions` and `PageRenderer` never read it, but
 * `BaseSchema` is `.passthrough()`, so an authored array parsed GREEN and drew
 * NOTHING — and, until objectui#7933 replaced the renderer's hand-maintained
 * destructure with `toDomProps`, it reached the wrapper element as
 * `actions="[object Object],[object Object]"`. Three passages of the layout guide
 * taught exactly that document.
 *
 * ## The two halves, and which file owns which
 *
 * This file owns the CONTRACT half: the key is refused by name, the refusal is
 * TARGETED (the node stays open), and no fence on the guide authors it any more.
 * The RENDER half — "the rewritten passages each draw at least one button" — is
 * `packages/components/src/__tests__/guide-layout-page-buttons-7926.test.tsx`,
 * because it needs the real registry. The ruling names both, and the render one is
 * the load-bearing half: a docs edit that still draws nothing passes this file.
 *
 * ## ⛔ Why NOT `.strict()` on the node
 *
 * The ruling required a CENSUS before the refusal, so a strict node could not take
 * a living key with it. Measured over this tree at `8fda00905`: 91 authored
 * `page`-tagged objects read, 8 sites unreadable (7 elided doc fences, 1 literal
 * with a spread member) — a blind-spot reading, because a zero without one is not
 * a measured zero. On a real `page` NODE only two undeclared keys survive
 * passthrough: `actions` (3 sites, all of them the guide passages this card
 * rewrites) and `breadcrumbs` (1 site, no reader either — its own question, NOT
 * ruled on here). Every other undeclared key the same grep found belongs to a
 * DIFFERENT declaration that merely spells `type: 'page'`: nav items, spec `page`
 * list views, `registerMetadataResource` rows. None of them is parsed by this
 * schema — and `page-app-dashboard-spec-parity.test.ts` PINS the node staying open
 * to unknown renderer props, so `.strict()` would have reddened a living pin.
 * `the refusal is targeted, not a strict node` below is that census as an
 * assertion.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PageNodeSchema } from '../zod/layout.zod.js';
import type { PageNodeSchema as TsPageNodeSchema } from '../layout.js';

const GUIDE_PATH = resolve(__dirname, '../../../../content/docs/guide/layout.md');

/** The document the guide used to teach, verbatim in shape. */
const RETIRED_DOC = {
  type: 'page',
  title: 'Products',
  actions: [
    { type: 'button', label: 'Add Product', variant: 'default', icon: 'plus' },
    { type: 'button', label: 'Export', variant: 'outline', icon: 'download' },
  ],
};

describe('objectui#7926 — the `page` node refuses `actions` (contract half)', () => {
  it('the key is DECLARED, which is what makes the refusal loud rather than a strip', () => {
    // The whole defect was that it was NOT in the shape: an undeclared key on a
    // `.passthrough()` object is kept in silence. A refusal has to be declared.
    expect(Object.keys(PageNodeSchema.shape)).toContain('actions');
  });

  it('refuses the retired document at parse, at the `actions` path', () => {
    const r = PageNodeSchema.safeParse(RETIRED_DOC);
    expect(r.success).toBe(false);
    const issues = r.success ? [] : r.error.issues;
    expect(issues.map((i) => i.path.join('.'))).toContain('actions');
  });

  it('the refusal message carries the remedy, not just a type name', () => {
    const r = PageNodeSchema.safeParse(RETIRED_DOC);
    const issue = (r.success ? [] : r.error.issues).find((i) => i.path.join('.') === 'actions');
    expect(issue).toBeDefined();
    const message = issue!.message;
    // Named subject + the two doors an author actually has. NOT the whole
    // sentence: pinning prose byte-for-byte turns every wording fix red for no
    // gain (AGENTS.md — assert the named subject, not the copy).
    expect(message).toContain('actions');
    expect(message).toContain('body');
    expect(message).toContain('page:header');
    // Zod's own default for a `never` arm says none of this.
    expect(message).not.toBe('Invalid input: expected never, received array');
  });

  it('POSITIVE CONTROL — the same document without `actions` parses green', () => {
    // Without this leg, a schema that refused EVERY page document would pass the
    // assertions above.
    const { actions, ...withoutActions } = RETIRED_DOC;
    expect(actions).toBeDefined();
    expect(PageNodeSchema.safeParse(withoutActions).success).toBe(true);
  });

  it('the remedy the message names actually parses — buttons as nodes in `body`', () => {
    const r = PageNodeSchema.safeParse({
      type: 'page',
      title: 'Products',
      body: [
        {
          type: 'flex',
          justify: 'end',
          gap: 2,
          children: [
            { type: 'button', label: 'Add Product', variant: 'default', icon: 'plus' },
            { type: 'button', label: 'Export', variant: 'outline', icon: 'download' },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it('the refusal is TARGETED, not a strict node — the census leg', () => {
    // `page-app-dashboard-spec-parity.test.ts` pins this same fact from the other
    // side ("the component envelope still passes unknown renderer props
    // through"). It is restated here because THIS card is the one that would
    // break it: the cheap way to refuse `actions` is `.strict()`, and the census
    // is the reason that is the wrong shape.
    expect(PageNodeSchema.safeParse({ type: 'page', someRendererProp: 42 }).success).toBe(true);
    // `breadcrumbs` is the OTHER undeclared key the census found on a real page
    // node. It has no reader either, and objectui#7926 does NOT rule on it — so
    // it must still parse. If a later card retires it, this line is the one that
    // says so out loud instead of the change happening by accident here.
    expect(
      PageNodeSchema.safeParse({
        type: 'page',
        breadcrumbs: [{ label: 'Home', href: '/' }],
      }).success,
    ).toBe(true);
  });

  it('the TypeScript twin refuses it too', () => {
    // `?: never` — the pair `zod-mirror-parity.test.ts` compares. The `@ts-expect-error`
    // IS the assertion: it fails to compile (packages/types `type-check`) if the
    // key ever becomes assignable again.
    const page: TsPageNodeSchema = {
      type: 'page',
      title: 'Products',
      // @ts-expect-error `actions` is refused by name on the page node (objectui#7926)
      actions: [{ type: 'button', label: 'Add Product' }],
    };
    expect(page.type).toBe('page');
  });
});

describe('objectui#7926 — the guide no longer authors `actions` on a `page` node', () => {
  /** Every ```json fence on the page, as {startLine, parsed|null}. */
  const fences = (() => {
    const src = readFileSync(GUIDE_PATH, 'utf8');
    const out: Array<{ line: number; doc: unknown; body: string }> = [];
    const re = /```json\n([\s\S]*?)```/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const line = src.slice(0, m.index).split('\n').length;
      let doc: unknown;
      try {
        doc = JSON.parse(m[1]);
      } catch {
        doc = null; // elided fragment (`[...]`), counted as blind below
      }
      out.push({ line, doc, body: m[1] });
    }
    return out;
  })();

  const isPageNode = (d: unknown): d is Record<string, unknown> =>
    !!d && typeof d === 'object' && (d as Record<string, unknown>).type === 'page';

  it('LIT CONTROL — the scan can see JSON fences, page nodes, and an `actions` key', () => {
    // Three separate ways this scan could report a vacuous zero, so three
    // controls. The last one is the important one: `page:header`'s `actions` is
    // the READ action-id channel (objectui#7182) and it must STILL be here — a
    // refusal that took it with it would be the collateral damage the census
    // exists to prevent.
    expect(fences.length).toBeGreaterThan(5);
    expect(fences.filter((f) => isPageNode(f.doc)).length).toBeGreaterThan(3);
    expect(
      fences.some(
        (f) =>
          !!f.doc &&
          typeof f.doc === 'object' &&
          (f.doc as Record<string, unknown>).type === 'page-header' &&
          Array.isArray((f.doc as Record<string, unknown>).actions),
      ),
    ).toBe(true);
  });

  it('no `page` node on the page carries `actions`', () => {
    const offenders = fences
      .filter((f) => isPageNode(f.doc) && 'actions' in (f.doc as Record<string, unknown>))
      .map((f) => `${GUIDE_PATH}:${f.line}`);
    expect(offenders).toEqual([]);
  });

  it('BLIND SPOT — the fences this scan could not parse are counted, not ignored', () => {
    // A zero with no blind-spot reading is not a measured zero (objectui#7933's
    // requirement, carried into this card by its dispatch). The COUNT is pinned,
    // not the line numbers — a line list would redden on every unrelated edit
    // above it, and a permanently red pin is one nobody reads.
    const blind = fences.filter((f) => f.doc === null);
    expect(blind).toHaveLength(4);
    // …and each is blind for the DECLARED reason, an author's `[...]` elision —
    // never because a real document stopped parsing. That is the half that makes
    // the count above mean something.
    for (const f of blind) {
      expect({ line: f.line, elided: f.body.includes('...') }).toEqual({
        line: f.line,
        elided: true,
      });
    }
  });

  it('every `page` node the guide teaches declares its content under `body`', () => {
    // The positive form of the same fact: the passages were not merely stripped
    // of `actions`, they were REWRITTEN onto the key that renders.
    const pages = fences.filter((f) => isPageNode(f.doc));
    for (const f of pages) {
      const doc = f.doc as Record<string, unknown>;
      expect({ line: f.line, hasBody: 'body' in doc }).toEqual({ line: f.line, hasBody: true });
    }
  });
});
