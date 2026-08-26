/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Declaration pin — `bind`, the data-scope vocabulary read across the repo and
 * declared by no schema shape (objectui#6357).
 *
 * ## What was wrong
 *
 * Ten production sites read `bind` off a schema node and NOTHING declared it.
 * It resolved as `any` through `BaseSchema`'s index signature, while three
 * separate documents taught it as an authorable key of every node — this
 * repo's own `AGENTS.md` §4 ("Every node in the UI tree follows this shape
 * (`@object-ui/types`)", `bind?: string`), the PUBLISHED agent-facing
 * `skills/objectui/rules/protocol.md` ("Every UI component node MUST follow
 * this shape"), and `content/docs/fields/grid.mdx`.
 *
 * The census that chose this home, measured on `origin/main` `c5037fd29`:
 *
 *   - **9** reads of `useDataScope(schema.bind)` — `components`' `list` and
 *     `tree-view`, and the `object-*` widgets in `plugin-charts`,
 *     `plugin-dashboard` (×2), `plugin-grid`, `plugin-kanban`, `plugin-list`,
 *     `plugin-timeline`;
 *   - **1** non-hook read — `plugin-grid/src/index.tsx`'s `gridNeedsDataSource`
 *     predicate, where `schema?.bind != null` is one of the escape hatches that
 *     makes a missing data-source adapter legitimate rather than a defect;
 *   - **2** DOM-strip destructures — `MetricWidget` / `MetricCard`, which
 *     destructure `bind` out so `SchemaRenderer`'s spread cannot write
 *     `bind="data.revenue"` onto the DOM (objectui#4357).
 *
 * ## Why `BaseSchema` and not nine per-component declarations
 *
 * Because per-component buys NOTHING extra — see the ceiling below, which is
 * symmetric: neither half can refuse the key on a non-reader either way. It
 * costs nine copies of one key for zero enforcement, and the class had already
 * generated FOUR local declarations before this one existed — three spelled
 * `string`, one spelled `unknown`. `schemaHostProps.ts`'s own header names the
 * hazard: "two copies of one key list is how a list becomes two disagreeing
 * lists". Exactly ONE of the four was a true duplicate of a base member —
 * `ObjectPivotTable`'s, whose `PivotTableSchema & {…}` intersection does extend
 * `BaseSchema`; it is removed by this card. The other three are load-bearing:
 * their containing types never reference `BaseSchema`, so deleting the member
 * deletes the declaration rather than inheriting it. They are ratcheted below.
 *
 * `placeholder` is the standing precedent for a cross-cutting key declared here
 * and honoured by a subset: every node may write it, only inputs read it.
 *
 * ## The ceiling, stated rather than assumed (objectui#5155 / objectui#6269)
 *
 * Same ceiling as objectui#5903's gantt pin and objectui#6170's timeline pin.
 * `BaseSchema` carries `[key: string]: any` on the TS side and is
 * `.passthrough()` on the zod side, so:
 *
 *   - an UNDECLARED key is still accepted by both halves. Declaring `bind` did
 *     NOT buy rejection of `bindTo`, and the counter-probe below pins that
 *     honestly rather than letting a reader assume otherwise;
 *   - a DECLARED key IS validated. `bind: 42` type-checked and parsed green
 *     before this card and is refused by both halves now — the accept-set
 *     narrowing this card lands;
 *   - on the TS side a read site can never be the detector, because the index
 *     signature types `schema.bind` as `any` either way. So the compile-time
 *     pin is the `@ts-expect-error` block at the bottom: remove the
 *     declaration and the member resolves to `any`, the wrong-typed assignment
 *     starts succeeding, and the now-unused directive fails the build (TS2578)
 *     NAMING the key. `tsconfig.test.json` compiles this file, so that is real
 *     enforcement and not decoration (objectui#3009).
 *
 * The narrowing only refuses what already crashed: `useDataScope` is
 * `(path?: string)` and resolves via `path.split('.')`, so a non-string `bind`
 * threw a TypeError at render time.
 *
 * ## What this pin deliberately does NOT cover
 *
 * `data-table` does not call `useDataScope`, so a `bind` on it is ignored and
 * the table renders its header over an empty body — no error, no warning. That
 * is recorded in `protocol.md` and already pinned in
 * `components/src/__tests__/skill-guide-data-table-binding.test.tsx`. Declaring
 * the key here neither causes nor cures it: `bind` was accepted on every node
 * before this declaration existed, via the index signature and `.passthrough()`.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BaseSchema } from '../zod/base.zod.js';
import type { BaseSchema as BaseSchemaTS } from '../base.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');

const MINIMAL = { type: 'list' } as const;

describe('BaseSchema (zod) — `bind` is mirrored and validated', () => {
  it('declares `bind` in the mirror shape', () => {
    // The pair `base.zod.ts#BaseSchema` carries no `KnownDrift` /
    // `UnmirroredDeclared` entry, so `zod-mirror-parity.test.ts` independently
    // reddens by name if the TS declaration ever outruns this member. This
    // asserts the member directly so the failure is readable here too.
    expect(Object.keys(BaseSchema.shape)).toContain('bind');
  });

  it('accepts the path forms the readers resolve', () => {
    for (const bind of ['customerNames', 'app.settings.users', 'rows']) {
      expect(BaseSchema.safeParse({ ...MINIMAL, bind }).success, bind).toBe(true);
    }
  });

  it('refuses a non-string `bind` — the accept-set narrowing this card lands', () => {
    // Green before this card (`.passthrough()` waved it through); it then threw
    // `path.split is not a function` inside `useDataScope` at render time.
    for (const bind of [42, true, { path: 'customers' }, ['customers']]) {
      expect(BaseSchema.safeParse({ ...MINIMAL, bind }).success, JSON.stringify(bind)).toBe(false);
    }
  });

  it('still accepts a MISSPELLING — the ceiling, pinned honestly', () => {
    // Counter-probe against reading the two assertions above as more than they
    // are. `.passthrough()` accepts any undeclared key, so `bindTo` is waved
    // through exactly as `bind` used to be. Closing THAT is objectui#5155 /
    // objectui#6269, not this card; if it is ever closed, this expectation is
    // the one that must be revisited deliberately rather than silently.
    expect(BaseSchema.safeParse({ ...MINIMAL, bindTo: 'customers' }).success).toBe(true);
  });

  it('leaves `bind` optional — every node that never binds still parses', () => {
    expect(BaseSchema.safeParse(MINIMAL).success).toBe(true);
  });
});

describe('BaseSchema (TS) — compile-time pin on `bind`', () => {
  it('refuses a wrong-typed `bind`', () => {
    // This directive fails the build (TS2578, "unused '@ts-expect-error'") the
    // moment `bind` stops being declared, because the member then resolves to
    // `any` through the index signature and the assignment starts succeeding.
    // That failure is the signal this card exists to create.

    // @ts-expect-error — `bind` is declared `string | undefined`.
    const bind: BaseSchemaTS['bind'] = 42;

    expect(bind).toBe(42);
  });

  it('accepts a well-typed `bind`', () => {
    // Counter-probe for the directive above: without this, a declaration
    // narrowed to `never` would satisfy it.
    const node: BaseSchemaTS = { type: 'list', bind: 'customerNames' };
    expect(node.bind).toBe('customerNames');
  });
});

/**
 * ONE declaration, not N.
 *
 * The card's own warning is that guessing the home "would produce the second
 * declaration this class keeps generating" — and two had already appeared
 * before anyone declared the key centrally. This scan is the guard against the
 * third: a schema-side `bind?:` member anywhere outside its home reads as a
 * local re-declaration, which is how the two disagreeing spellings (`string`
 * vs `unknown`) came to exist in the first place.
 */
describe('`bind` is declared in exactly one place (objectui#6357)', () => {
  /**
   * Every allowed non-home declaration, WITH ITS REASON.
   *
   * None of the three is a schema shape, which is why none of them inherits the
   * declaration and none could simply be deleted. Two are hand-rolled inline
   * `schema` prop types with no `BaseSchema` in their ancestry — a real defect,
   * but objectui#5155 / objectui#6269's, filed and not fixed here. The third is
   * a DOM-strip props type. An entry here is a declared decision; a file that is
   * in neither this map nor the home fails the scan.
   */
  const ALLOWED = new Map<string, string>([
    [
      'packages/plugin-dashboard/src/schemaHostProps.ts',
      'DOM-strip props type, not a schema shape — all seven members are `unknown` by design, '
        + 'because the type exists to be destructured out and never read (objectui#4357).',
    ],
    [
      'packages/plugin-dashboard/src/ObjectDataTable.tsx',
      'RATCHET, not an endorsement. `ObjectDataTableProps.schema` is an inline object type that '
        + 'never references `BaseSchema`, so this member is load-bearing rather than duplicated — '
        + 'removing it would not inherit the declaration, it would delete it. The disconnected '
        + 'hand-rolled schema prop type is objectui#5155 / objectui#6269 territory, not this card.',
    ],
    [
      'packages/plugin-list/src/ObjectGallery.tsx',
      'RATCHET, same shape as the entry above — `ObjectGalleryProps.schema` is a hand-rolled inline '
        + 'type with no `BaseSchema` in its ancestry and (unlike that one) no index signature, so '
        + 'dropping the member is a compile error rather than an inheritance.',
    ],
  ]);

  const HOME = 'packages/types/src/base.ts';

  it('no schema shape re-declares `bind` outside `BaseSchema`', async () => {
    const { execFileSync } = await import('node:child_process');
    // `git grep` over TRACKED files only, so an untracked scratch file or a
    // stray build artefact cannot fail this. `-n` for a readable failure.
    let out = '';
    try {
      out = execFileSync(
        'git',
        ['grep', '-n', '-F', '--', 'bind?:', 'packages'],
        { cwd: REPO_ROOT, encoding: 'utf8' },
      );
    } catch (err: any) {
      // `git grep` exits 1 on "no matches" — which would mean the home
      // declaration itself vanished. Fall through to the assertions below,
      // which then fail naming it.
      out = err?.stdout ?? '';
    }

    const hits = out
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(0, line.indexOf(':')));

    // Counter-probe: a filter over an empty scan passes vacuously.
    expect(hits, 'the scan found nothing at all — check the pattern').not.toHaveLength(0);
    expect(hits, `\`${HOME}\` must declare \`bind\``).toContain(HOME);

    const strays = [...new Set(hits)].filter((f) => f !== HOME && !ALLOWED.has(f));
    expect(
      strays,
      'a second `bind?:` declaration appeared — declare it once on `BaseSchema`, '
        + 'or add the file to ALLOWED above with its reason',
    ).toEqual([]);
  });

  it('the readers still read the key this declaration is about', () => {
    // The declaration is only worth its doc comment while the reads exist. One
    // representative per package, so a rename that leaves the key undeclared
    // again cannot pass quietly.
    const readers = [
      'packages/components/src/renderers/data-display/list.tsx',
      'packages/components/src/renderers/data-display/tree-view.tsx',
      'packages/plugin-charts/src/ObjectChart.tsx',
      'packages/plugin-dashboard/src/ObjectDataTable.tsx',
      'packages/plugin-dashboard/src/ObjectPivotTable.tsx',
      'packages/plugin-grid/src/ObjectGrid.tsx',
      'packages/plugin-kanban/src/ObjectKanban.tsx',
      'packages/plugin-list/src/ObjectGallery.tsx',
      'packages/plugin-timeline/src/ObjectTimeline.tsx',
    ];
    for (const rel of readers) {
      const src = readFileSync(join(REPO_ROOT, rel), 'utf8');
      expect(src, `${rel} no longer reads \`schema.bind\``).toContain('useDataScope(schema.bind)');
    }
    expect(readers).toHaveLength(9);
  });
});
