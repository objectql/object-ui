/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { icons } from 'lucide-react';
import { ViewSwitcher } from '../ViewSwitcher';
import type { ViewSwitcherSchema, ViewType } from '@object-ui/types';

// Mock @object-ui/react to avoid circular dependency issues; mirrors
// ObjectView.test.tsx, including the data-invalidation bus that
// @object-ui/components imports at module-eval time.
vi.mock('@object-ui/react', async () => {
  const React = await import('react');
  return {
    SchemaRenderer: ({ schema }: any) => (
      <div data-testid="schema-renderer" data-schema-type={schema?.type}>
        {schema?.type}
      </div>
    ),
    SchemaRendererContext: React.createContext(null),
    subscribeDataChanges: () => () => {},
    notifyDataChanged: () => {},
  };
});

// Every member of `ViewType`. Declared as `ViewType[]` rather than inferred, so
// adding a member to the union without extending this list is a compile error
// here too — the same guard `DEFAULT_VIEW_LABELS` / `DEFAULT_VIEW_ICONS` get
// from being `Record<ViewType, ...>` (#2916).
const ALL_VIEW_TYPES: ViewType[] = [
  'list',
  'detail',
  'grid',
  'kanban',
  'calendar',
  'timeline',
  'map',
  'gallery',
  'gantt',
  'chart',
  'tree',
];

function schemaFor(types: ViewType[]): ViewSwitcherSchema {
  return {
    type: 'view-switcher',
    variant: 'buttons',
    views: types.map(type => ({ type })),
  };
}

function schemaForNamed(entries: Array<[string, string]>): ViewSwitcherSchema {
  return {
    type: 'view-switcher',
    variant: 'buttons',
    views: entries.map(([type, icon]) => ({ type: type as ViewType, icon })),
  };
}

/** Buttons of ONE render, scoped to its own container so probe and control cannot see each other. */
const buttonsIn = (container: HTMLElement): HTMLButtonElement[] =>
  Array.from(container.querySelectorAll('button'));

/**
 * Read a sibling source file, from the repo root or from the package directory.
 *
 * NOT `new URL('../x', import.meta.url)`: Vite rewrites `import.meta.url` to a
 * SERVER-ROOT-relative path, so that form resolved to `/packages/plugin-view/
 * src/ObjectView.tsx` — an absolute path missing the repo root, ENOENT for the
 * whole suite. The two candidates below mirror the pair
 * `ObjectView.hostOnlyViewTypes.test.tsx` already uses for the same reason; the
 * first is the canonical repo-root invocation (objectui#3378).
 */
const readSibling = (file: string): string => {
  const candidates = [
    resolve(process.cwd(), 'packages/plugin-view/src', file),
    resolve(process.cwd(), 'src', file),
  ];
  const found = candidates.find(candidate => existsSync(candidate));
  if (!found) {
    throw new Error(
      `cannot locate plugin-view/src/${file} from ${process.cwd()} — tried:\n  ${candidates.join('\n  ')}`,
    );
  }
  return readFileSync(found, 'utf8');
};

/**
 * The `key: value` pairs of one named const object literal, read out of source:
 * a quoted string for the icon-NAME map, a bare identifier for the
 * icon-COMPONENT map. Read from source because both maps are module-private and
 * stay that way — exporting them would widen the package's surface for the sake
 * of a test. A parse that finds nothing is caught by the precondition test.
 */
function parseMapEntries(source: string, declaration: string): Array<[string, string]> {
  const start = source.indexOf(declaration);
  if (start === -1) return [];
  const open = start + declaration.length;
  const close = source.indexOf('};', open);
  if (close === -1) return [];
  return [...source.slice(open, close).matchAll(/^\s*(\w+)\s*:\s*(?:'([\w-]+)'|(\w+))\s*,\s*$/gm)]
    .map(m => [m[1], (m[2] ?? m[3]) as string] as [string, string]);
}

describe('ViewSwitcher default view labels and icons', () => {
  it('renders a non-empty label and an icon for every ViewType', () => {
    render(<ViewSwitcher schema={schemaFor(ALL_VIEW_TYPES)} />);

    for (const type of ALL_VIEW_TYPES) {
      // A missing entry falls back to the raw type key for the label and to no
      // icon at all, which is what a hole in either Record<ViewType, ...> map
      // looked like on screen.
      const button = screen
        .getAllByRole('button')
        .find(b => b.textContent?.trim().toLowerCase() === type || b.textContent?.trim() === type);
      expect(button, `no button rendered for view type "${type}"`).toBeDefined();
      expect(button!.querySelector('svg'), `view type "${type}" rendered without an icon`).not.toBeNull();
    }
  });

  it('labels the chart view "Chart" rather than falling back to the type key', () => {
    render(<ViewSwitcher schema={schemaFor(['chart'])} />);

    expect(screen.getByText('Chart')).toBeInTheDocument();
    expect(screen.queryByText('chart')).toBeNull();
  });

  it('still lets an explicit label and icon override the defaults', () => {
    const { container } = render(
      <ViewSwitcher
        schema={{
          type: 'view-switcher',
          variant: 'buttons',
          views: [{ type: 'chart', label: 'Revenue', icon: 'chart-pie' }],
        }}
      />
    );

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.queryByText('Chart')).toBeNull();
    // The icon half of the same override, asserted rather than assumed. This
    // fixture read `pie-chart` until objectui#5586: a deprecated lucide alias
    // that is absent from the runtime `icons` record, so the override rendered
    // a label and NO icon — and the test stayed green because it only ever
    // looked at the label. `chart-pie` is the spelling the record carries.
    expect(
      container.querySelector('button svg'),
      'the explicit `icon` override rendered no icon at all',
    ).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// objectui#5586 — a name that stopped resolving renders NOTHING at all.
//
// `ViewSwitcher` turns an icon NAME into a component by looking it up in
// lucide's runtime `icons` record, and draws nothing when the lookup misses.
// lucide retires a spelling by dropping it from that record while KEEPING it as
// a deprecated named export, so a retired name still imports, still
// type-checks, and still renders when used as a COMPONENT — and silently
// resolves to nothing when used as a STRING. That is how a major lucide bump
// took the `chart` and `gantt` icons out of the switcher with nothing going
// red: `packages/plugin-view` names the same glyphs both ways.
//
// So the pin is over EVERY name the two maps supply, not over the two that
// happened to break — a pin scoped to those two would not have caught this bug
// and would not catch the next bump. Both maps are annotated
// `Record<ViewType, …>`, so their key set IS the union and this coverage widens
// by itself when a view type is added.
// ---------------------------------------------------------------------------

/** `ObjectView`'s producer map: view type → icon NAME, resolved at render time. */
const HOST_ICON_NAMES = parseMapEntries(
  readSibling('ObjectView.tsx'),
  'const iconMap: Record<ViewType, string> = {',
);

/** `ViewSwitcher`'s own fallback map: view type → icon COMPONENT, imported by name. */
const DEFAULT_ICON_COMPONENTS = parseMapEntries(
  readSibling('ViewSwitcher.tsx'),
  'const DEFAULT_VIEW_ICONS: Record<ViewType, LucideIcon> = {',
);

describe('every icon name plugin-view supplies still resolves (objectui#5586)', () => {
  it('both source reads found a real, TOTAL map — the precondition for "every"', () => {
    // A parse that quietly found nothing would leave every assertion below
    // vacuously green, which is the failure mode a widened pin invites. The
    // key-set comparison carries the totality claim too: both maps are
    // `Record<ViewType, …>`, so the compiler will not let a view type land
    // without an entry. Re-annotated to `Record<string, …>`, "every name"
    // would quietly shrink to "every name someone remembered".
    expect(
      HOST_ICON_NAMES.map(([type]) => type).sort(),
      'cannot read `iconMap` out of ObjectView.tsx — the declaration moved, was re-annotated, or\n'
        + 'no longer covers every ViewType. Fix the reader or the map; do not delete the pin.',
    ).toEqual([...ALL_VIEW_TYPES].sort());
    expect(
      DEFAULT_ICON_COMPONENTS.map(([type]) => type).sort(),
      'cannot read `DEFAULT_VIEW_ICONS` out of ViewSwitcher.tsx — same reading.',
    ).toEqual([...ALL_VIEW_TYPES].sort());
  });

  it('renders an icon for every name `ObjectView` supplies', () => {
    const { container } = render(<ViewSwitcher schema={schemaForNamed(HOST_ICON_NAMES)} />);

    for (const [type, icon] of HOST_ICON_NAMES) {
      const button = buttonsIn(container).find(b => b.textContent?.trim().toLowerCase() === type);
      expect(button, `no button rendered for view type "${type}"`).toBeDefined();
      expect(
        button!.querySelector('svg'),
        `\`${type}: '${icon}'\` renders NO icon. The name is resolved through lucide's runtime\n`
          + '`icons` record, and a spelling lucide keeps only as a DEPRECATED NAMED EXPORT is absent\n'
          + 'from that record — that it imports and type-checks elsewhere says nothing about this\n'
          + 'path. Replace it with a spelling the record carries (objectui#5586).',
      ).not.toBeNull();
    }
  });

  it('renders NO icon for a name that does not resolve — the control', () => {
    // Same component, same schema shape, same container-scoped query as the
    // assertion above, so it fails on exactly what that one passes on. Without
    // it, "every button has an svg" would hold just as well against a build
    // whose icon slot always rendered something — and an always-filled slot is
    // not what `{Icon ? <Icon /> : null}` does. This is also the precise shape
    // the two broken names had on screen: a label, and nothing beside it.
    const { container } = render(
      <ViewSwitcher schema={schemaForNamed([['grid', 'no-such-lucide-icon']])} />,
    );

    const button = buttonsIn(container).find(b => b.textContent?.trim() === 'Grid');
    expect(button, 'no button rendered for the control view').toBeDefined();
    expect(button!.querySelector('svg')).toBeNull();
  });

  it('names only live `icons` keys in `DEFAULT_VIEW_ICONS`', () => {
    // The other half of the same class, and NOT implied by the render test
    // above: these entries are imported components, so a retired alias goes on
    // rendering here while the string beside it in `iconMap` renders nothing.
    // Record membership is what keeps the two halves from drifting — a
    // spelling that is dead for the lookup does not get to look alive in the
    // defaults and be copied back into the string map, which is how
    // `bar-chart-3` and `gantt-chart` got there.
    const retired = DEFAULT_ICON_COMPONENTS.filter(
      ([, ident]) => !Object.prototype.hasOwnProperty.call(icons, ident),
    );

    expect(
      retired,
      'These `DEFAULT_VIEW_ICONS` entries name lucide exports that are NOT keys of the runtime\n'
        + '`icons` record — i.e. deprecated aliases. They keep rendering, so nothing else goes red.\n'
        + 'Replace each with the name the record carries (objectui#5586).',
    ).toEqual([]);
  });

  it('rejects an identifier the record does not carry — the control', () => {
    // Same record, same membership predicate as the assertion above: without
    // it, "no entry is missing from `icons`" would also pass if the predicate
    // said yes to everything.
    expect(Object.prototype.hasOwnProperty.call(icons, 'NoSuchLucideIcon')).toBe(false);
  });
});
