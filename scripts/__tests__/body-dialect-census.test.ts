/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Pins for `scripts/body-dialect-census.mjs` (objectui#6771, ruling step 1).
 *
 * Two things are pinned here, and they fail for different reasons:
 *
 * 1. **The instrument.** Every assertion in the first block corresponds to a
 *    bug the first draft of the census actually had, and each one failed the
 *    same way: it returned a SILENT ZERO with exit 0. A census that reads zero
 *    because it is blind is indistinguishable from a corpus that is clean —
 *    which is the exact failure mode the card's own history is made of.
 *
 * 2. **The population.** The `body`-only key list is read back off the renderer
 *    sources, so it cannot go stale the way the card body's "10" did. If
 *    someone teaches `badge` to read `children`, or adds a `sidebar-*`
 *    registration, this goes red rather than the census quietly measuring the
 *    wrong set.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  scanNodes,
  keepFencedCodeOnly,
  BODY_ONLY,
  RULED_BUT_NOT_A_READER,
  BODY_ONLY_UNRULED,
} from '../body-dialect-census.mjs';

const REPO_ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(REPO_ROOT, p), 'utf8');

const keysOf = (text: string, type: string) => {
  const node = scanNodes(text).find((n: { type: string }) => n.type === type);
  return node ? [...(node.keys as Set<string>)] : null;
};

describe('the scanner sees the shapes authored metadata actually uses', () => {
  it('reads QUOTED keys — the JSON corpus is the whole point', () => {
    // REGRESSION: the first draft consumed a quoted key as a string value
    // before ever testing it as a key, because the string branch ran first.
    // JSON spells every key quoted, so the entire `.json` corpus — including
    // the four authored sidebar fixtures that turned out to hold 56 of the 56
    // `body` nodes in this repo — read as ZERO. Exit 0, no error, no hint.
    expect(keysOf('{"type": "badge", "body": []}', 'badge')).toEqual(['type', 'body']);
    expect(keysOf("{ type: 'badge', body: [] }", 'badge')).toEqual(['type', 'body']);
  });

  it('attributes a child key to the node that owns it, not to an ancestor', () => {
    // `body` two levels down belongs to the inner node. Without this, one
    // authored `body` would score against every enclosing node as well.
    const text = '{"type":"card","children":[{"type":"badge","body":[]}]}';
    expect(keysOf(text, 'card')).toEqual(['type', 'children']);
    expect(keysOf(text, 'badge')).toEqual(['type', 'body']);
  });

  it('does NOT score a key that only appears in a comment — prose is not a call site', () => {
    expect(scanNodes("// a node written { type: 'badge', body: [] }\n")).toEqual([]);
    expect(scanNodes("/* { type: 'badge', body: [] } */")).toEqual([]);
  });

  it('survives a regex literal after `=>`, which otherwise blinds the rest of the file', () => {
    // REGRESSION: `/^ {3}\S.*\(type "/` in a real test file was not recognised
    // as a regex because `>` was missing from the "value position" set. Its `{`
    // opened a phantom object frame and its lone `"` opened a runaway string,
    // so every node AFTER it vanished — the file scored 0 of its 3 nodes.
    const text = String.raw`
      const f = (l) => /^ {3}\S.*\(type "/.test(l);
      const node = { type: 'badge', body: [] };
    `;
    expect(keysOf(text, 'badge')).toEqual(['type', 'body']);
  });

  it('keeps Markdown fenced code and drops Markdown prose', () => {
    // REGRESSION: a ```json fence is THREE backticks. The scanner treats a
    // backtick as a template-literal delimiter, so the first two paired off and
    // the third swallowed the whole snippet — EVERY doc example read as zero.
    // That population is not incidental: ruling step 5 migrates the teaching
    // corpus in the same commit.
    const md = ['Prose mentioning `type: "badge"` inline.', '', '```json', '{ "type": "badge", "body": [] }', '```', ''].join('\n');
    const kept = keepFencedCodeOnly(md);
    expect(keysOf(kept, 'badge')).toEqual(['type', 'body']);
    // …and the prose mention is gone, not counted.
    expect(kept).not.toContain('Prose mentioning');
    // Line numbers survive the blanking, so reported positions stay true.
    expect(kept.split('\n').length).toBe(md.split('\n').length);
  });

  it('CONTROL — a corpus-shaped input returns hits, so a zero elsewhere is readable', () => {
    // Without this, every "0" in the census is indistinguishable from a
    // scanner that resolved nothing at all.
    const nodes = scanNodes(read('examples/schema-catalog/src/schemas/components-basic-sidebar/basic-sidebar.json'));
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes.filter((n: { keys: Set<string> }) => n.keys.has('body')).length).toBeGreaterThan(0);
  });
});

describe('the measured population is read off the renderers, not off the card body', () => {
  const sidebarSrc = () => read('packages/components/src/renderers/navigation/sidebar.tsx');

  it('`BODY_ONLY` is 12 keys — the ruled 13 minus `sidebar-trigger`', () => {
    // The card body says 10 and the ruling's step 2 repeats it; the census pin
    // in `container-declaration-ratchet.test.tsx` says 13. Both are counts of
    // slightly different things. What the retirement actually costs is measured
    // per RENDERER READ, and that set is 12.
    expect(BODY_ONLY.length).toBe(12);
    expect(BODY_ONLY).toContain('badge');
    expect(BODY_ONLY).toContain('alert');
    // The bare family name is present. A `sidebar-[a-z-]+` pattern REQUIRES a
    // suffix and silently drops it — the original miscount, recorded on the
    // card 2026-08-29, and the census query has the same shape.
    expect(BODY_ONLY).toContain('sidebar');
    expect(BODY_ONLY.filter((k) => k.startsWith('sidebar')).length).toBe(10);
  });

  it('`badge` and `alert` read `body` and never `children`', () => {
    for (const [file, type] of [
      ['packages/components/src/renderers/data-display/badge.tsx', 'badge'],
      ['packages/components/src/renderers/data-display/alert.tsx', 'alert'],
    ] as const) {
      const src = read(file);
      expect(src, `${type} stopped reading schema.body`).toContain('renderChildren(schema.body)');
      expect(src, `${type} now reads schema.children — it is no longer body-only`).not.toContain('schema.children');
    }
  });

  it('`sidebar-trigger` is ruled but reads NO child list, so retirement costs it nothing', () => {
    expect(RULED_BUT_NOT_A_READER).toEqual(['sidebar-trigger']);
    const src = sidebarSrc();
    // It is registered…
    expect(src).toContain("ComponentRegistry.register('sidebar-trigger'");
    // …and there are exactly 10 `renderChildren(schema.body)` reads across the
    // 11 `sidebar-*` registrations. The one without is `sidebar-trigger`, whose
    // renderer never receives `schema` at all.
    expect(src.match(/ComponentRegistry\.register\('sidebar/g)?.length).toBe(11);
    expect(src.match(/renderChildren\(schema\.body\)/g)?.length).toBe(10);
    const trigger = src.slice(src.indexOf("register('sidebar-trigger'"));
    expect(trigger).not.toContain('schema.body');
    expect(trigger).not.toContain('schema.children');
  });

  it('⚠️ `tooltip` is a `body`-only reader that the ruled 13 does NOT include', () => {
    // Measured, and it matters: `tooltip` renders `renderChildren(schema.body)`
    // and never `schema.children`, so direction B removes its only rich-content
    // key too — yet it is absent from the ruling's step 2 list. It is also the
    // ONE registration in the tree that DECLARES `body` as an authorable input,
    // which makes it the most discoverable spelling of `body` on the whole
    // authoring surface.
    expect(BODY_ONLY_UNRULED).toEqual(['tooltip']);
    const src = read('packages/components/src/renderers/overlay/tooltip.tsx');
    expect(src).toContain('renderChildren(schema.body)');
    expect(src).not.toContain('schema.children');
    expect(src).toMatch(/name:\s*'body'/);
  });

  it('the two published keys are exactly `badge` and `alert`', () => {
    // ADR-0080's allow-list. Retiring `body` on these two is a reject-direction
    // change on PUBLISHED contract; on the 11 bare `sidebar-*` it is internal.
    // `PUBLIC_BLOCKS` carries the namespaced `page:sidebar`, a different type —
    // so grepping the list for "sidebar" would wrongly score the bare family.
    const src = read('packages/core/src/registry/public-blocks.ts');
    expect(src).toMatch(/^\s*'badge',$/m);
    expect(src).toMatch(/^\s*'alert',$/m);
    expect(src).toMatch(/^\s*'page:sidebar',$/m);
    for (const key of BODY_ONLY.filter((k) => k.startsWith('sidebar'))) {
      expect(src, `bare \`${key}\` became public — the census cost split changed`).not.toMatch(
        new RegExp(`^\\s*'${key}',$`, 'm'),
      );
    }
  });
});

describe('the census stays re-runnable', () => {
  it('is wired into the root package.json, like every other script here', () => {
    // A census that gates a multi-day retirement has to be repeatable after the
    // next corpus change, by someone who was not here. Same convention as the
    // `check:*` gates: the entry point is pinned, not just documented.
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['census:body-dialect']).toBe('node scripts/body-dialect-census.mjs');
  });
});

describe('the `body` consumers the ruling does not enumerate', () => {
  it('three generic readers outside the renderer tree still resolve `body`', () => {
    // Recorded because ruling steps 2-5 name renderers, the published type and
    // the tier — and these three are none of those. They read `body` for ANY
    // node type, so they outlive the per-registration convergence and would
    // keep the dialect alive after step 2 lands.
    expect(read('packages/core/src/validation/schema-validator.ts')).toContain(
      'schema.children || schema.body',
    );
    expect(read('packages/vscode-extension/src/providers/SchemaValidator.ts')).toContain('schema.body');
    expect(read('packages/vscode-extension/src/providers/PreviewProvider.ts')).toContain('schema.body');
  });

  it('the platform SHIPS the dialect it is being asked to refuse', () => {
    // The sharpest census finding. Ruling step 5's principle is that "the
    // platform never refuses a spelling it still ships" — and today these
    // PRODUCERS emit `body` into metadata a user then owns:
    //
    //   - `objectui init` scaffolds every new project's app in `body`
    //   - the VS Code extension's new-file templates do the same
    //   - two registrations ship `body` inside their own `defaultProps`
    //
    // So step 4 (tier teaches `children` only) cannot land before these move,
    // or every freshly scaffolded project fails validation on day one.
    expect(read('packages/cli/src/commands/init.ts')).toMatch(/^\s*body:/m);
    expect(read('packages/vscode-extension/src/extension.ts')).toMatch(/^\s*body:/m);
    expect(read('packages/components/src/renderers/complex/carousel.tsx')).toContain("body: [{ type: 'text'");
  });
});
