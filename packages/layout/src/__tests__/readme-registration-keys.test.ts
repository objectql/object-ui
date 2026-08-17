/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `packages/layout/README.md`'s `## Registration` section names exactly the keys
 * `registerLayout()` registers (objectui#4860).
 *
 * ## Why this file exists
 *
 * The same key list is published in THREE places, and until this pin two of them
 * were held to source and this one was not:
 *
 *   - `content/docs/guide/layout.md`'s "registers five keys — …" sentence, held
 *     by `guide-layout-sidebar-nav-doc.test.ts` (objectui#4840);
 *   - `src/index.ts` itself — the keys' existence — held by
 *     `app-shell-not-a-component-key.test.tsx` (objectui#4841, one key) and
 *     the repo-level `scripts/__tests__/side-effects-declaration-consistency.test.ts`
 *     (a count FLOOR, not a census — objectui#3943 converged the former
 *     `side-effects-manifest.test.ts` into it);
 *   - this README's `## Registration` paragraph — nothing.
 *
 * The asymmetry was measured, not theorised. objectui#4841 deregistered
 * `app-shell`, and the guide's key list went red and forced the page to be
 * edited; the README's list named the same retired key and no test noticed. It
 * was corrected by hand in PR #4859 — which is exactly the failure mode, because
 * "someone read it" is not a mechanism. This README is the npm landing page for
 * `@object-ui/layout`; a key listed here that nothing registers is a reader
 * authoring `{ "type": "<that key>" }` and getting the renderer's red
 * `Unknown component type` panel (OBJUI-001) instead of a component.
 *
 * ## Direction — deliberately BOTH
 *
 * Two separate defects, so two separate tests with two separate messages:
 *
 *   - README names a key the barrel does not register → it teaches a node type
 *     that does not resolve (the objectui#4841 shape, and objectui#3899's
 *     phantom `sidebar-nav` before it);
 *   - the barrel registers a key the README does not name → the landing page
 *     hides a live authoring surface, which is how a key ends up documented
 *     nowhere and then "cleaned up" as dead.
 *
 * Order is NOT compared. The list happening to run in registration order is a
 * nicety, not a contract, and a pin that reddens on a reordered sentence would
 * be a pin readers learn to edit around.
 *
 * ## The expected list is READ OUT OF the source, never listed here
 *
 * Hardcoding the five keys in this file would reproduce the very defect the pin
 * is against: objectui#3899's own prose confidently listed a `sidebar-nav` key
 * this package has never registered. So both sides are parsed on every run, and
 * a red test here is always "fix the README (or the barrel)", never "update the
 * test".
 *
 * That parse has a dependency worth naming, because it is easy to break from the
 * other side: the source reader is a regex for `ComponentRegistry` + `.register(`,
 * so a register call QUOTED VERBATIM inside a comment in `src/index.ts` would be
 * collected as a live registration. `src/index.ts` describes the removed
 * `app-shell` call in prose for precisely this reason (objectui#4841 wrote that
 * note); this pin is a third beneficiary of that discipline, and anyone tempted
 * to paste a real call into a comment there breaks this file too.
 *
 * ## Scan surface — deliberately narrow
 *
 * This file reads `packages/layout/README.md`'s `## Registration` sentence and
 * `packages/layout/src/index.ts`'s register calls, and nothing else.
 *
 * A NEW file rather than an extension of `readme-app-shell-example.test.ts`
 * (objectui#4817), which reads the same README: that file states its scan
 * surface as the `<AppShell …>` opening tags and the `AppShellProps` table, and
 * reads only the README and `AppShell.tsx`. The Registration list is a fact
 * about `src/index.ts`, a source this package's README pins otherwise never
 * open, so it gets its own file the way `readme-sidebar-nav-example.test.ts`
 * (objectui#3999) has one — one pin per documented concern is this package's
 * existing shape.
 *
 * Not judged here, though both are adjacent and both are already covered:
 *
 *   - the `### AppShell` section's paragraph stating that `app-shell` was
 *     retired and now reports `Unknown component type`. Re-registering the key
 *     turns `app-shell-not-a-component-key.test.tsx` red by name, and turns the
 *     second test below red as well (a live key the README does not list), so the
 *     paragraph cannot go stale unnoticed.
 *   - the `### SidebarNav` note that `SidebarNav` is not on the registry. Its
 *     surface is `readme-sidebar-nav-example.test.ts`.
 *
 * The reader below is this repo's fourth copy of the same three-line
 * `ComponentRegistry.register` regex (the others are in
 * `guide-layout-sidebar-nav-doc.test.ts`, `app-shell-not-a-component-key.test.tsx`
 * and `scripts/__tests__/side-effects-declaration-consistency.test.ts`).
 * Extracting a shared helper is raised as a
 * side option on objectui#4860 and is deliberately NOT taken here: it would edit
 * three pin files to serve one, and each of those files is self-contained on
 * purpose — a pin that imports its own reader from a shared module can be
 * silently neutered from outside the file it defends.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** `packages/layout` — two levels up from `src/__tests__`. */
const PKG_DIR = resolve(__dirname, '../..');
const README = readFileSync(join(PKG_DIR, 'README.md'), 'utf8');
const LAYOUT_INDEX_SRC = readFileSync(join(PKG_DIR, 'src', 'index.ts'), 'utf8');

/**
 * The sentence that publishes the key list, and the parenthesised list itself.
 *
 * Whitespace between the anchor words is `\s+` rather than a literal space: the
 * list is markdown prose that gets re-wrapped whenever its length changes, and
 * it already wraps mid-list on this tree. Where the line breaks fall is not a
 * fact this file should have an opinion about — `guide-layout-sidebar-nav-doc.test.ts`
 * learned the same lesson when a rewrap reddened it for no drift at all.
 *
 * `[^)]*` for the list body, so the wrap costs nothing and the match stops at
 * the closing paren.
 */
const REGISTRATION_SENTENCE = /registers\s+its\s+component\s+keys\s*\(([^)]*)\)/g;

/** Component keys `registerLayout()` registers, read out of the source. */
function registeredKeys(): string[] {
  return [...LAYOUT_INDEX_SRC.matchAll(/ComponentRegistry\.register\(\s*'([^']+)'/g)].map(
    (match) => match[1],
  );
}

/** Component keys the README's `## Registration` sentence names. */
function documentedKeys(): string[] {
  const matches = [...README.matchAll(REGISTRATION_SENTENCE)];
  if (matches.length === 0) {
    throw new Error(
      [
        'packages/layout/README.md no longer carries its "registers its component keys (…)"',
        'sentence, so this pin has nothing to compare (objectui#4860). If the Registration',
        'section was reworded, re-point REGISTRATION_SENTENCE at the new wording — do not',
        'delete the pin, or the npm landing page goes back to being the one copy of this key',
        'list that nothing checks.',
      ].join('\n'),
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `packages/layout/README.md now has ${matches.length} "registers its component keys (…)" sentences; this pin would judge only the first. Merge them, or teach this reader about both.`,
    );
  }
  return [...matches[0][1].matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

describe("the README's Registration list names exactly the registered keys (objectui#4860)", () => {
  it('names no key `registerLayout()` does not register', () => {
    const registered = registeredKeys();
    expect(
      registered.length,
      'no `ComponentRegistry.register` call parsed out of src/index.ts — the assertion below would prove nothing',
    ).toBeGreaterThan(1);

    const documented = documentedKeys();
    expect(
      documented.filter((key) => !registered.includes(key)),
      [
        'The `## Registration` list in packages/layout/README.md names a component key that',
        '`registerLayout()` does not register. This README is the npm landing page for',
        '@object-ui/layout: a reader who authors `{ "type": "<the listed key>" }` gets the',
        "renderer's red `Unknown component type` panel (OBJUI-001) and no component at all.",
        '',
        'This is exactly how the list rotted before — objectui#4841 deregistered `app-shell`',
        'while the README went on listing it, and only the guide (objectui#4840) went red.',
        '',
        'The expected list is READ OUT OF packages/layout/src/index.ts on every run, so this is',
        'never "update the test": drop the key from the README, or register it.',
        `Registered: ${registered.join(', ')}`,
      ].join('\n'),
    ).toEqual([]);
  });

  it('and names every key `registerLayout()` does register', () => {
    const registered = registeredKeys();
    const documented = documentedKeys();
    expect(
      documented.length,
      'no backticked key parsed out of the README `## Registration` sentence — the assertion below would prove nothing',
    ).toBeGreaterThan(1);

    expect(
      registered.filter((key) => !documented.includes(key)),
      [
        'packages/layout/src/index.ts registers a component key the `## Registration` list in',
        'packages/layout/README.md does not name. The landing page is where a consumer looks',
        'for the authorable node types of this package, so an unlisted key is a live authoring',
        'surface nobody can discover — and the first thing that happens to an undocumented key',
        'is that someone retires it as dead.',
        '',
        'The list is READ OUT OF the source on every run: add the key to the README sentence,',
        'or stop registering it.',
        `Registered: ${registered.join(', ')}`,
        `Documented: ${documented.join(', ')}`,
      ].join('\n'),
    ).toEqual([]);
  });

  it('and both sides really parsed — neither list is empty, and neither repeats itself', () => {
    // Two set-difference assertions are BOTH trivially green on two empty lists,
    // which is the shape a pin fails in without ever going red: a regex that
    // stops matching (the README reworded, a register call written with double
    // quotes) would silently turn the tests above into no-ops. The floors are
    // asserted here as their own visible fact rather than only as `expect`
    // messages, so "the readers still read something" cannot be deleted by
    // accident along with a message nobody looks at.
    const registered = registeredKeys();
    const documented = documentedKeys();

    expect(registered.length, 'no register call parsed out of src/index.ts').toBeGreaterThan(1);
    expect(
      documented.length,
      'no backticked key parsed out of the README Registration sentence',
    ).toBeGreaterThan(1);

    // A repeated entry keeps both set differences empty while the two lists are
    // not the same list, so it is the one drift the pair above cannot see.
    expect(
      documented.length,
      `The README Registration list names a key twice: ${documented.join(', ')}`,
    ).toBe(new Set(documented).size);
    expect(
      registered.length,
      `src/index.ts registers a key twice: ${registered.join(', ')}`,
    ).toBe(new Set(registered).size);
  });
});
