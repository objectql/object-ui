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
// objectui#5622 — `VIEW_ICONS` names imported COMPONENTS, so a retired lucide
// alias goes on rendering here and nothing goes red. That is precisely why it
// needs a pin rather than a render test.
//
// lucide retires a spelling by dropping it from its runtime `icons` record
// while KEEPING it as a deprecated named export. `Grid`, `GanttChartSquare` and
// `BarChart3` all imported, all type-checked, and all three were absent from
// that record. Nothing on screen was wrong — but the sibling switcher in
// `packages/plugin-view` supplies the SAME glyphs as STRINGS, which are looked
// up in exactly that record, and a spelling that looks alive in a component map
// is how `bar-chart-3` was copied into the string map next to it (objectui#5586).
//
// So: MEMBERSHIP of the record, not resolvability of the import. `Grid ===
// Grid3x3` and `BarChart3 === ChartColumn` are both TRUE on the installed
// lucide — the retired alias is the same object under a dead name, and any
// assertion that renders the glyph or reaches for the export passes on the
// broken spelling.
// ---------------------------------------------------------------------------

/**
 * Read a sibling source file, from the repo root or from the package directory.
 * NOT `new URL('../x', import.meta.url)` — Vite rewrites `import.meta.url` to a
 * server-root-relative path, ENOENT for the whole suite. Same pair as
 * `plugin-view/src/__tests__/ViewSwitcher.test.tsx`; the first candidate is the
 * canonical repo-root invocation (objectui#3378).
 */
function readSibling(file: string): string {
  const candidates = [
    resolve(process.cwd(), 'packages/plugin-list/src', file),
    resolve(process.cwd(), 'src', file),
  ];
  const found = candidates.find(candidate => existsSync(candidate));
  if (!found) {
    throw new Error(
      `cannot locate plugin-list/src/${file} from ${process.cwd()} — tried:\n  ${candidates.join('\n  ')}`,
    );
  }
  return readFileSync(found, 'utf8');
}

/**
 * `[view type, lucide identifier]` for every entry of the `VIEW_ICONS` map,
 * read out of source — the map is module-private and stays that way. Values are
 * JSX elements (`<Grid3x3 className="h-4 w-4" />`), so the identifier is the
 * element's tag.
 */
function parseViewIconComponents(source: string): Array<[string, string]> {
  const declaration = 'const VIEW_ICONS: Record<ViewType, React.ReactNode> = {';
  const start = source.indexOf(declaration);
  if (start === -1) return [];
  const open = start + declaration.length;
  const close = source.indexOf('};', open);
  if (close === -1) return [];
  return [...source.slice(open, close).matchAll(/^\s*(\w+)\s*:\s*<(\w+)\b/gm)].map(
    m => [m[1], m[2]] as [string, string],
  );
}

/**
 * Every member of `ViewType`, spelled out rather than inferred — adding a
 * member without extending this list is a failure here, the same guard
 * `VIEW_ICONS` gets from being annotated `Record<ViewType, …>`.
 */
const ALL_VIEW_TYPES = [
  'grid',
  'kanban',
  'gallery',
  'calendar',
  'timeline',
  'gantt',
  'map',
  'chart',
  'tree',
];

const VIEW_ICON_COMPONENTS = parseViewIconComponents(readSibling('ViewSwitcher.tsx'));

describe('every icon plugin-list\'s ViewSwitcher supplies is a live `icons` key (objectui#5622)', () => {
  it('the source read found a real, TOTAL map — the precondition for "every"', () => {
    // A parse that quietly found nothing would leave the assertion below
    // vacuously green. The key-set comparison carries the totality claim too:
    // the map is `Record<ViewType, …>`, so the compiler will not let a view
    // type land without an entry — re-annotated to `Record<string, …>`, "every
    // icon" would shrink to "every icon someone remembered".
    expect(
      VIEW_ICON_COMPONENTS.map(([type]) => type).sort(),
      'cannot read `VIEW_ICONS` out of ViewSwitcher.tsx — the declaration moved, was re-annotated,\n'
        + 'or no longer covers every ViewType. Fix the reader or the map; do not delete the pin.',
    ).toEqual([...ALL_VIEW_TYPES].sort());
  });

  it('names only live `icons` keys', () => {
    const retired = VIEW_ICON_COMPONENTS.filter(
      ([, ident]) => !Object.prototype.hasOwnProperty.call(icons, ident),
    );

    expect(
      retired,
      'These `VIEW_ICONS` entries name lucide exports that are NOT keys of the runtime `icons`\n'
        + 'record — i.e. deprecated aliases. They keep rendering, so nothing else goes red, and a\n'
        + 'spelling that is dead for the lookup gets copied into a string map next to it. Replace\n'
        + 'each with the name the record carries (objectui#5622).',
    ).toEqual([]);
  });

  it('rejects an identifier the record does not carry — the control', () => {
    // Same record, same membership predicate as the assertion above, so it
    // fails on exactly what that one passes on.
    expect(Object.prototype.hasOwnProperty.call(icons, 'NoSuchLucideIcon')).toBe(false);
  });

  it('rejects the three spellings that shipped here — the control that matters', () => {
    // The control above would also pass against a predicate that merely asked
    // "is this importable from lucide-react". All three of these are: they
    // import, they type-check, and two of them ARE the replacement object under
    // a dead name. Membership is the only thing that separates them.
    for (const retired of ['Grid', 'GanttChartSquare', 'BarChart3']) {
      expect(
        Object.prototype.hasOwnProperty.call(icons, retired),
        `\`${retired}\` is back in the runtime record — re-check the repair before relaxing this.`,
      ).toBe(false);
    }
  });
});
