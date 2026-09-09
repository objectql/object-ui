/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#8253 — `TreeViewConfig`'s key census is total over its readers, and
 * the module-local copy it replaced is GONE rather than shadowed.
 *
 * ## The card
 *
 * `tree` is a host-composition-only view type (objectui#5321 ruling B): on
 * neither authored union, reached only when a host passes a `views` prop. The
 * per-view `tree` block that path reads had NO exported type — its only
 * description was the module-local `interface TreeConfig` in
 * `plugin-tree/src/ObjectTree.tsx`. The live host is the console, which stores
 * view records and passes them as `views`, so a real consumer wrote this block
 * against nothing and a misspelled key was stored, dropped and never reported.
 * Ruled option (a) on objectui#8253 (decision batch #78, 2026-09-07, maintainer
 * 「同意」): export the config, import it at the reader, ⛔ no second copy.
 *
 * ## What this file owns, and what it deliberately does not
 *
 * It owns the DERIVED half — the part a type-level pin cannot see:
 *
 *   - the private interface is gone from the reader;
 *   - the reader imports the exported name instead;
 *   - the resolver's local `ResolvedTreeConfig` is `Pick`ed off the one
 *     declaration rather than hand-written beside it;
 *   - all four reader sites are where this census says they are.
 *
 * It does NOT own reachability through the published `exports` map. That is
 * unassertable from inside this package — `tsconfig.test.json` here sets
 * `"paths": {}` AND there is no self-link in `packages/types/node_modules`, so
 * `@object-ui/types` is not a specifier this project can resolve at all. It is
 * pinned from a CONSUMER instead, in
 * `plugin-tree/src/ObjectTree.hostConfigExported-8253.test.ts`, whose own
 * `"paths": {}` sends the specifier through the workspace dependency to
 * `packages/types/dist/index.d.ts`. Two files, two halves, neither redundant.
 *
 * ## Every zero below has a firing control
 *
 * A `not.toMatch` is worth nothing until the same instrument is shown matching
 * something that IS there. Each negative assertion is paired with a positive
 * one on the same regex family and the same file.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { TreeViewConfig } from '../index';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), 'utf8');

const RESOLVER = 'packages/plugin-tree/src/ObjectTree.tsx';
const VIEW_BRANCH = 'packages/plugin-view/src/ObjectView.tsx';
const LIST_BRANCH = 'packages/plugin-list/src/ListView.tsx';
const CONSOLE_COMPOSITION = 'packages/app-shell/src/views/ObjectView.tsx';

/** The declared keys, as a value — so the runtime census and the type agree. */
const DECLARED = [
  'parentField',
  'labelField',
  'titleField',
  'fields',
  'defaultExpandedDepth',
] as const;

/* -------------------------------------------------------------------------- */
/* Compile-time: the value list above IS the type's key set, not a copy of it. */
/* -------------------------------------------------------------------------- */

type Assert<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

// Without this, `DECLARED` is a second hand-maintained key list — the exact
// artefact this card removed from `ObjectTree.tsx`. It is checked in BOTH
// directions, so a key added to the interface without being added here fails
// as loudly as the reverse.
type _CensusMatchesType = Assert<Equal<(typeof DECLARED)[number], keyof TreeViewConfig>>;

describe('the module-local copy is gone, not shadowed (objectui#8253)', () => {
  const src = read(RESOLVER);

  // ⚠️ Anchored at the start of a line, and that is load-bearing rather than
  // tidy. The first spelling of this pin was an unanchored
  // `/interface\s+TreeConfig\b/`, and it went RED on a green tree: the
  // replacement docblock in `ObjectTree.tsx` says the words "interface
  // TreeConfig" while EXPLAINING that the interface is gone. An unanchored
  // regex over a source file cannot tell a declaration from prose about a
  // declaration. A declaration starts its line; a docblock line starts with
  // ` * `.
  const DECLARATION = (name: string) =>
    new RegExp(String.raw`^\s*(export\s+)?interface\s+${name}\b`, 'm');

  it('declares no private `TreeConfig` interface any more', () => {
    expect(src).not.toMatch(DECLARATION('TreeConfig'));
  });

  it('CONTROL: the same instrument still finds an interface that IS there', () => {
    // `TreeNode` is declared in the same file, two statements from where
    // `TreeConfig` stood. If the regex family has stopped matching interface
    // declarations at all, this fails and the negative above stops counting.
    expect(src).toMatch(DECLARATION('TreeNode'));
  });

  it('CONTROL: and the anchor is what does the work', () => {
    // Pins the trap itself, so the next person to "simplify" this regex is
    // told why it is shaped this way: the prose IS in the file, and only the
    // anchor keeps it from reading as a declaration.
    expect(src).toMatch(/interface TreeConfig/);
    expect(src).not.toMatch(DECLARATION('TreeConfig'));
  });

  it('imports the exported type from the package entry', () => {
    expect(src).toContain("TreeViewConfig } from '@object-ui/types'");
  });

  it('derives its resolved form from the one declaration instead of restating it', () => {
    // `ResolvedTreeConfig` may add REQUIREDNESS (the resolver floors
    // `labelField` and `fields`) but must not respell a key or a key's type —
    // a structurally-equal hand-written twin type-checks fine and would defeat
    // the export entirely.
    expect(src).toMatch(/Required<Pick<TreeViewConfig,\s*'labelField' \| 'fields'>>/);
    expect(src).toMatch(/Pick<TreeViewConfig,\s*'parentField' \| 'defaultExpandedDepth'>/);
  });

  it('CONTROL: and the resolver still returns that type', () => {
    // Proves the derived type is WIRED IN, not merely declared and orphaned.
    expect(src).toMatch(/function getTreeConfig\(schema: any\): ResolvedTreeConfig/);
  });
});

describe('every declared key has a reader (objectui#8253)', () => {
  const resolver = read(RESOLVER);
  /** `getTreeConfig`'s body — the block the ruling scoped the census to. */
  const fn = (() => {
    const from = resolver.slice(resolver.indexOf('function getTreeConfig'));
    return from.slice(0, from.indexOf('\n}\n') + 3);
  })();

  it('the resolver body was actually located', () => {
    // The slice above is derived from source text; if the function is renamed
    // the slice silently becomes the whole file and every assertion under it
    // passes for the wrong reason. Bound it explicitly.
    expect(fn.length).toBeGreaterThan(80);
    expect(fn.length).toBeLessThan(resolver.length / 2);
    expect(fn).toContain('function getTreeConfig');
  });

  it.each(DECLARED)('reads `%s`', (key) => {
    expect(fn).toContain(key);
  });

  it('CONTROL: a key that is neither declared nor read is absent', () => {
    // If this ever appears in the resolver, the census has stopped being total
    // and the type owes a decision — declare the key, or delete the read. That
    // is the card's own rule, applied to itself.
    expect(fn).not.toContain('sortField');
  });
});

describe('`titleField` stays DECLARED — the measurement the ruling asked for', () => {
  // The ruling put this key to a measurement: declare it if the console writes
  // it, else delete the read. The answer came back split, and the READ side
  // decides.
  //
  //   - the console's create-view dialog does NOT offer it: its `tree` slot
  //     collects `parentField` alone (asserted below);
  //   - but the console's own host composition reads it BY NAME, as do the
  //     `ListView` and `ObjectView` tree branches;
  //   - and objectui#6557 pinned the rung as live behaviour in
  //     `app-shell/src/views/ObjectView.titleFieldConvergence.test.tsx`
  //     ("the tree's second view-declared rung … still answers"), a regression
  //     pin landed precisely so a later edit could not collapse the tree's two
  //     view-declared rungs into one.
  //
  // ⇒ Deleting the read would reverse a recorded ruling and redden its pin —
  // a maintainer's call, not a rider on this card. Declaring the key is what
  // makes declared = enforced at all four sites at once.

  it('the console composition reads it', () => {
    expect(read(CONSOLE_COMPOSITION)).toContain('tree?.titleField');
  });

  it('the plugin-view tree branch reads it', () => {
    expect(read(VIEW_BRANCH)).toContain('viewOptions.tree?.titleField');
  });

  it('the plugin-list tree branch reads it', () => {
    expect(read(LIST_BRANCH)).toContain('treeCfg.titleField');
  });

  it("objectui#6557's pin on the rung is still in the tree", () => {
    // Named explicitly: if this file is ever deleted, whoever deletes it is
    // told here that this declaration's justification went with it.
    expect(read('packages/app-shell/src/views/ObjectView.titleFieldConvergence.test.tsx'))
      .toContain('tree.titleField');
  });

  it("CONTROL: the console's create-view dialog still does NOT offer it for `tree`", () => {
    // The other half of the measurement, and the half that would have argued
    // for deleting the read. `titleField` IS collected — for calendar,
    // timeline and gantt — so a zero for the `tree` slot is a reading about
    // the tree slot and not about a broken instrument.
    const dialog = read('packages/app-shell/src/views/CreateViewDialog.tsx');
    const treeSlot = (() => {
      const from = dialog.slice(dialog.indexOf('\n  tree: ['));
      return from.slice(0, from.indexOf('\n  ],') + 5);
    })();

    expect(treeSlot).toContain("key: 'parentField'");
    expect(treeSlot).not.toContain("key: 'titleField'");
    // FIRING CONTROL: the same instrument, on a slot that does collect it.
    expect(dialog).toContain("key: 'titleField'");
  });
});
