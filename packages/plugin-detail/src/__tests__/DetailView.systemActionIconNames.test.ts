/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { icons } from 'lucide-react';

// ---------------------------------------------------------------------------
// objectui#5622 — a system action's icon NAME that stopped resolving draws a
// label with nothing beside it.
//
// `DetailView` builds its overflow items as an `action:bar` schema, and the
// `packages/components` action renderers turn each `icon` STRING into a
// component through `renderers/action/resolve-icon.ts`, which reads lucide's
// runtime `icons` record and returns `null` on a miss. lucide retires a
// spelling by DROPPING IT FROM THAT RECORD while keeping it as a deprecated
// named export — so a retired name still imports, still type-checks, and still
// renders anywhere it is used as a COMPONENT, and silently resolves to nothing
// here. That is how `icon: 'edit'` took the icon off the mobile Edit entry with
// nothing going red.
//
// ⚠️ MEMBERSHIP is what this pins, deliberately — not "does the name resolve to
// something". `Edit === SquarePen` is TRUE on the installed lucide: the retired
// alias is the very same component object under a dead name, so any assertion
// that reaches for the export, or renders the glyph and looks at it, passes on
// the broken spelling. Only absence from the record tells the two apart.
//
// The pin is over EVERY `icon:` literal this file supplies, not over the one
// that broke — a pin scoped to `edit` would not have caught this and would not
// catch the next lucide bump.
// ---------------------------------------------------------------------------

/**
 * Read a sibling source file, from the repo root or from the package directory.
 *
 * NOT `new URL('../x', import.meta.url)`: Vite rewrites `import.meta.url` to a
 * SERVER-ROOT-relative path, which is ENOENT for the whole suite. Same pair as
 * `plugin-view/src/__tests__/ViewSwitcher.test.tsx` uses, for the same reason;
 * the first candidate is the canonical repo-root invocation (objectui#3378).
 */
function readSibling(file: string): string {
  const candidates = [
    resolve(process.cwd(), 'packages/plugin-detail/src', file),
    resolve(process.cwd(), 'src', file),
  ];
  const found = candidates.find(candidate => existsSync(candidate));
  if (!found) {
    throw new Error(
      `cannot locate plugin-detail/src/${file} from ${process.cwd()} — tried:\n  ${candidates.join('\n  ')}`,
    );
  }
  return readFileSync(found, 'utf8');
}

/**
 * `[action name, icon name]` for every system action item pushed in
 * `DetailView.tsx`, read out of source: the items are built inside a `useMemo`
 * in a component that needs a whole console host to render, and exporting them
 * for a test would widen the package's surface. A parse that quietly found
 * nothing is caught by the precondition test below.
 */
function parseSystemActionIcons(source: string): Array<[string, string]> {
  return source
    .split('items.push({')
    .slice(1)
    .map(chunk => {
      const name = /^\s*name:\s*'([\w-]+)'/m.exec(chunk);
      const icon = /^\s*icon:\s*'([\w-]+)'/m.exec(chunk);
      return name && icon ? ([name[1], icon[1]] as [string, string]) : null;
    })
    .filter((entry): entry is [string, string] => entry !== null);
}

/**
 * The transform `resolve-icon.ts` applies before its record lookup, copied
 * because it is module-private there. Copied EXACTLY: a pin that normalised
 * names differently from the consumer would answer a question nobody asks.
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

const SYSTEM_ACTION_ICONS = parseSystemActionIcons(readSibling('DetailView.tsx'));

describe('every icon name DetailView supplies is a live `icons` key (objectui#5622)', () => {
  it('the source read found the system action items — the precondition for "every"', () => {
    // A parse that found nothing would leave the assertion below vacuously
    // green, which is the failure mode a source-reading pin invites.
    expect(
      SYSTEM_ACTION_ICONS.length,
      'cannot read the `items.push({ … })` system actions out of DetailView.tsx — the block moved\n'
        + 'or was restructured. Fix the reader; do not delete the pin.',
    ).toBeGreaterThanOrEqual(3);

    expect(
      SYSTEM_ACTION_ICONS.map(([name]) => name),
      'the reader no longer reaches the mobile Edit action — the entry objectui#5622 repaired.',
    ).toContain('sys_edit_mobile');
  });

  it('names only live `icons` keys', () => {
    const retired = SYSTEM_ACTION_ICONS.filter(
      ([, icon]) => !Object.prototype.hasOwnProperty.call(icons, recordKeyFor(icon)),
    );

    expect(
      retired,
      'These `DetailView` action icons name spellings that are NOT keys of lucide\'s runtime\n'
        + '`icons` record — i.e. deprecated aliases. `resolve-icon.ts` reads that record and returns\n'
        + '`null` on a miss, so each of these draws a label with NO icon. They still import and\n'
        + 'type-check wherever they are used as components, so nothing else goes red. Replace each\n'
        + 'with the spelling the record carries (objectui#5622).',
    ).toEqual([]);
  });

  it('rejects a name the record does not carry — the control', () => {
    // Same record, same membership predicate, same `recordKeyFor` transform as
    // the assertion above, so it fails on exactly what that one passes on:
    // without it, "no icon is missing from `icons`" would hold just as well if
    // the predicate said yes to everything.
    expect(
      Object.prototype.hasOwnProperty.call(icons, recordKeyFor('no-such-lucide-icon')),
    ).toBe(false);
  });

  it('rejects a name lucide keeps ONLY as a deprecated export — the control that matters', () => {
    // The control above would also pass against a predicate that merely asked
    // "is this importable from lucide-react". `Edit` is: it imports, it
    // type-checks, and it IS `SquarePen` — the same object under a dead name.
    // Membership is the only thing that separates them, and this is the exact
    // spelling that shipped broken.
    expect(Object.prototype.hasOwnProperty.call(icons, 'Edit')).toBe(false);
  });
});
