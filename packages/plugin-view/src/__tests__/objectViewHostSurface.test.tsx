/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `object-view` — the 27 keys ruled HOST-COMPOSITION SURFACE stay undeclared,
 * and stay read (objectui#5097).
 *
 * ## The card, and the ruling
 *
 * objectui#5097 measured 31 distinct keys that `ObjectView`'s `renderListView`
 * delegation branch reads off the object-view node through `(schema as any).K`
 * and forwards to the host's list renderer. Four are declared members of
 * `ObjectViewSchema`; 27 are not.
 *
 * The maintainer ruled on 2026-08-18 (verbatim 「同意」) that the 27 are HOST
 * surface, exempted with reasons — not authored surface — on a MEASURED
 * REACHABILITY basis: the branch runs only when a host passes `renderListView`,
 * and the registered renderer never does, so the schema-registration path
 * documented to authors cannot reach these keys at all. Declaring them would
 * promise authors a surface that does nothing on their path.
 *
 * This file is where that word "deliberate" is said to the tooling, so the next
 * census re-files the card only if something really changed.
 *
 * ## Why this pins the PROPERTY, not the enumeration
 *
 * The sibling exemption for `object-grid` (objectui#5091, PR #5241) could
 * afford four assertions per key: there were three keys. Twenty-seven of them
 * written out four times over would be noise nobody re-reads, and noise is how
 * a stale list survives. So the three things that actually carry the ruling are
 * pinned as properties instead:
 *
 *   1. THE SET IS WHAT THE DOC SAYS IT IS. The key set is re-derived from the
 *      `#region` fence in `ObjectView.tsx` at test time and compared with
 *      `OBJECT_VIEW_HOST_COMPOSITION_KEYS`, so adding or removing a read
 *      without touching the list fails BY NAME. A hand-copied list in a test
 *      would only ever agree with itself.
 *   2. THE RULING'S BASIS HOLDS. The registered renderer passes no
 *      `renderListView`, so the branch is unreachable from the authored path.
 *      If a future change starts supplying it, 27 keys are silently promoted to
 *      the authored path — that must fail loudly, here, rather than be found by
 *      the next census.
 *   3. THE READS STILL HAPPEN. Deleting a read is the one move that silently
 *      blanks a stored app-shell document, and it is exactly what a reader of
 *      "not authored surface" is most likely to think is the tidy finish.
 *
 * ## What is NOT owed here, and why
 *
 * PR #5241's assertions 2 and 3 — "the spec rejects the key by name", "the real
 * validator answers `unknown-prop`" — do not transfer, because
 * `@objectstack/spec` carries no `object-view` entry in `ComponentPropsMap` at
 * all. That absence is itself pinned below: it is what makes the repo-wide
 * `registry-inputs-spec-parity` gate (which derives its expectations FROM
 * `ComponentPropsMap`) inapplicable to this node in either direction, so the
 * exemption owes that gate nothing. If the spec ever starts modelling
 * `object-view`, this exemption needs re-reading, and the pin says so.
 */

import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { render } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import { ComponentPropsMap } from '@objectstack/spec/ui';
import type { ObjectViewSchema } from '@object-ui/types';

import {
  ObjectView,
  OBJECT_VIEW_HOST_COMPOSITION_KEYS,
  OBJECT_VIEW_DECLARED_FORWARDED_KEYS,
} from '../ObjectView';
// Module scope, not a hook: this import IS the registration.
import '../index';

// The source is read from disk rather than imported: the claim being pinned is
// about the READS in the file, and `import.meta.url` is not a file URL under
// this runner. Both candidates are covered so the pin holds whether vitest is
// invoked from the repo root or from the package.
const SOURCE_PATH = [
  resolve(process.cwd(), 'src/ObjectView.tsx'),
  resolve(process.cwd(), 'packages/plugin-view/src/ObjectView.tsx'),
].find((candidate) => existsSync(candidate));
if (!SOURCE_PATH) throw new Error('objectViewHostSurface pin cannot locate plugin-view/src/ObjectView.tsx');
const SOURCE = readFileSync(SOURCE_PATH, 'utf8');
const REGION_OPEN = '// #region object-view HOST-COMPOSITION SURFACE (objectui#5097)';
const REGION_CLOSE = '// #endregion object-view HOST-COMPOSITION SURFACE (objectui#5097)';

/**
 * Comments removed before any read is derived. Not defensive tidiness: the
 * exemption block deliberately SPELLS the cast form out in prose to explain
 * itself, and the first run of this pin duly reported a host key named `K`.
 * A derivation that reads its own documentation is not a derivation.
 * Line comments are cut only where `//` is not preceded by `:`, so a URL in a
 * string literal cannot swallow the rest of its line.
 */
const stripComments = (code: string): string =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');

/** Every cast read of a key off `schema` in a slice of CODE, distinct, sorted. */
const castReadsIn = (slice: string): string[] =>
  [
    ...new Set(
      [...stripComments(slice).matchAll(/\(schema as any\)\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
    ),
  ].sort();

const regionSlice = (): string => {
  const start = SOURCE.indexOf(REGION_OPEN);
  const end = SOURCE.indexOf(REGION_CLOSE);
  expect(
    start >= 0 && end > start,
    'The `#region object-view HOST-COMPOSITION SURFACE` fence in ObjectView.tsx is gone or reordered.\n'
      + 'It is load-bearing, not decoration: it is how this pin knows which reads the objectui#5097\n'
      + 'exemption covers. Restore it rather than deleting this test.',
  ).toBe(true);
  return SOURCE.slice(start, end);
};

// ---------------------------------------------------------------------------
// 1. The set is what the doc says it is.
// ---------------------------------------------------------------------------

describe('the forwarded key set equals the documented exemption (objectui#5097)', () => {
  // Widened to `string[]` deliberately: the constants are `as const`, and
  // comparing them against a set DERIVED from the source is the whole point —
  // narrowed literal types would make the compiler, not the file, the authority
  // on which keys exist.
  const exempt: string[] = [...OBJECT_VIEW_HOST_COMPOSITION_KEYS].sort();
  const declared: string[] = [...OBJECT_VIEW_DECLARED_FORWARDED_KEYS].sort();

  it('the fence reads exactly the 27 exempt keys plus the 4 declared ones', () => {
    expect(castReadsIn(regionSlice())).toEqual([...exempt, ...declared].sort());
  });

  it('subtracting the declared members leaves exactly the exempt list — by name', () => {
    const read = castReadsIn(regionSlice());
    expect(
      read.filter((k) => !declared.includes(k)),
      'A `(schema as any)` read inside the objectui#5097 fence was added or removed without\n'
        + 'updating OBJECT_VIEW_HOST_COMPOSITION_KEYS. That list is the exemption record the next\n'
        + 'census reads; a read it does not name is an undocumented host key, and a name with no\n'
        + 'read is a stale exemption. Update the list AND its comment block, in the same change.',
    ).toEqual(exempt);
  });

  it('the exemption covers 27 keys, the count the ruling was made on', () => {
    expect(OBJECT_VIEW_HOST_COMPOSITION_KEYS).toHaveLength(27);
    expect(OBJECT_VIEW_DECLARED_FORWARDED_KEYS).toHaveLength(4);
    // Disjoint: a key cannot be both declared surface and exempt host surface.
    expect(exempt.filter((k) => declared.includes(k))).toEqual([]);
  });

  it('NO exempt key is read outside the fence — the objectui#5248 resolution', () => {
    // This assertion used to read `.toEqual(['conditionalFormatting'])`.
    //
    // objectui#5097 measured one asymmetry: `generateViewSchema`'s kanban
    // branch read `conditionalFormatting` off the object-view node too, and
    // that branch runs exactly when no host supplied `renderListView` — i.e. on
    // the path the REGISTERED renderer takes. For that one key the ruling's
    // "the authored path cannot reach it" basis was narrower than for its 26
    // neighbours, and objectui#5248 was filed to settle it.
    //
    // Maintainer ruling 2026-08-19 (verbatim 「全部接受」): Option 2, gated on a
    // liveness check — which came back empty (no authored document in either
    // repo puts the key on an object-view node), so the fallback read was
    // dropped rather than the key declared. The set of exempt keys read outside
    // the fence is therefore EMPTY, and the exemption's basis now holds for all
    // 27 without exception. That is what this pins.
    //
    // ⛔ Do not "fix" a failure here by re-listing a key. A key read out here is
    // author-reachable; putting it back on this list is how the exemption stops
    // describing anything.
    const outside = castReadsIn(SOURCE.replace(regionSlice(), ''));
    expect(
      outside,
      'A host-composition key is read outside the objectui#5097 fence again. Reads out there are on\n'
        + 'the AUTHOR-reachable path, which is the basis the exemption rests on — so this is a\n'
        + 'contract change, not a refactor. objectui#5248 closed the one asymmetry that existed\n'
        + '(the kanban branch\'s `conditionalFormatting` fallback); re-opening one needs a ruling,\n'
        + 'not an edit to this expectation.',
    ).toEqual([]);
  });

  it('`conditionalFormatting` in particular is no longer read outside the fence (objectui#5248)', () => {
    // Named separately from the property above: the property would also pass if
    // the whole file stopped using the cast form, and this key is the one the
    // ruling is about. Its read inside the fence is asserted by the tests above
    // and by the delegation test at the bottom of this file — the key stays
    // host surface, it just stopped being author-reachable.
    expect(castReadsIn(SOURCE.replace(regionSlice(), ''))).not.toContain('conditionalFormatting');
    expect(castReadsIn(regionSlice())).toContain('conditionalFormatting');
  });
});

// ---------------------------------------------------------------------------
// 2. The ruling's basis: the registered renderer cannot reach the branch.
// ---------------------------------------------------------------------------

describe("the registered renderer cannot reach the delegation branch — the ruling's basis (objectui#5097)", () => {
  const registered = ComponentRegistry.get('object-view') as React.FC<{ schema: unknown }>;

  it('is registered, and the `view` alias is the same renderer', () => {
    expect(registered).toBeTypeOf('function');
    // One renderer under two tags is two chances to disagree with itself.
    expect(ComponentRegistry.get('view')).toBe(registered);
  });

  it('passes ObjectView no `renderListView`, so the branch never runs', () => {
    let passed: Record<string, unknown> | null = null;
    let renderedType: unknown = null;
    // The renderer is called as a plain function inside a probe component: it
    // holds exactly one hook (`useContext`), the call happens once, and the
    // element it returns is inspected and then discarded rather than mounted —
    // so this asserts what the registration PASSES without paying for an
    // ObjectView mount or a data fetch.
    const Probe: React.FC = () => {
      const element = registered({
        schema: { type: 'object-view', objectName: 'task' },
      }) as React.ReactElement;
      renderedType = element.type;
      passed = element.props as Record<string, unknown>;
      return null;
    };
    render(<Probe />);

    expect(renderedType).toBe(ObjectView);
    expect(
      passed,
      'The registered `object-view` renderer now supplies `renderListView`. That single prop is the\n'
        + "whole basis of the 2026-08-18 ruling on objectui#5097: it promotes 27 keys from host\n"
        + 'composition surface to the AUTHORED path, where nothing declares them and tsc cannot see\n'
        + 'them. Re-open objectui#5097 before landing this.',
    ).not.toHaveProperty('renderListView');
  });

  it('publishes none of the 27 on either tag, while publishing the declared control', () => {
    const inputsOf = (type: string): string[] =>
      ((ComponentRegistry.getConfig(type) as { inputs?: Array<{ name: string }> } | undefined)?.inputs ?? [])
        .map((i) => i.name);

    for (const tag of ['object-view', 'view']) {
      for (const key of OBJECT_VIEW_HOST_COMPOSITION_KEYS) {
        expect(
          inputsOf(tag),
          `\`${tag}\` now publishes \`${key}\` as authoring surface — the objectui#5097 ruling keeps it`
            + ' off the authored path.',
        ).not.toContain(key);
      }
    }
    // The control: without it, "publishes none of them" would pass just as
    // happily against a registration that publishes nothing at all.
    expect(inputsOf('object-view')).toEqual(
      expect.arrayContaining(['navigation', 'searchableFields', 'filterableFields']),
    );
  });

  it('the spec models no `object-view`, so the parity gate is owed nothing', () => {
    expect(
      Object.keys(ComponentPropsMap),
      '`@objectstack/spec` now models `object-view`. The objectui#5097 exemption was ruled on the\n'
        + 'basis that the contract has no verdict on this node at all — with a props schema present,\n'
        + 'the repo-wide registry-inputs-spec-parity gate starts covering it and the 27 keys need\n'
        + 're-reading against the spec.',
    ).not.toContain('object-view');
  });
});

// ---------------------------------------------------------------------------
// 3. The reads themselves — unchanged by the ruling, and the half a reader of
//    "not authored surface" is most likely to delete.
// ---------------------------------------------------------------------------

/** One plausible sentinel per forwarded key, distinct enough to trace. */
const SENTINELS: Record<string, unknown> = {
  addDeleteRecordsInline: true,
  addRecord: { enabled: true },
  addRecordViaForm: true,
  allowExport: true,
  allowPrinting: true,
  aria: { label: 'Tasks' },
  bulkActions: ['delete'],
  clickIntoRecordDetails: true,
  collapseAllByDefault: true,
  color: '#112233',
  compactToolbar: true,
  conditionalFormatting: [{ field: 'stage', operator: 'eq', value: 'won', color: '#ff0000' }],
  emptyState: { title: 'Nothing here yet' },
  fieldTextColor: { name: '#0000ff' },
  hiddenFields: ['secret'],
  inlineEdit: true,
  pagination: { pageSize: 25 },
  prefixField: 'name',
  resizable: true,
  rowActionDefs: [{ name: 'archive', label: 'Archive' }],
  rowActions: ['edit'],
  selection: { mode: 'multiple' },
  sharing: { enabled: true },
  showDescription: true,
  showRecordCount: true,
  userFilters: [{ field: 'owner', operator: 'eq', value: 'me' }],
  wrapHeaders: true,
  // The four declared members ride the same branch.
  data: { api: '/api/tasks' },
  navigation: { mode: 'drawer' },
  searchableFields: ['name'],
  filterableFields: ['stage'],
};

describe('every forwarded key still reaches the host renderer (objectui#5097)', () => {
  const forwardedSchema = (): Record<string, unknown> => {
    const seen: Array<Record<string, unknown>> = [];
    const ds = {
      find: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      getObjectSchema: vi.fn().mockResolvedValue({ name: 'task', fields: {} }),
    };
    render(
      <ObjectView
        schema={{ type: 'object-view', objectName: 'task', ...SENTINELS } as unknown as ObjectViewSchema}
        dataSource={ds as never}
        renderListView={({ schema: s }: { schema: Record<string, unknown> }) => {
          seen.push(s);
          return <div data-testid="delegated" />;
        }}
      />,
    );
    expect(seen.length).toBeGreaterThan(0);
    return seen[0];
  };

  it('forwards all 31 reads — 27 exempt plus 4 declared — by name', () => {
    const forwarded = forwardedSchema();
    const keys = [...OBJECT_VIEW_HOST_COMPOSITION_KEYS, ...OBJECT_VIEW_DECLARED_FORWARDED_KEYS];
    const got = Object.fromEntries(keys.map((k) => [k, forwarded[k]]));
    const want = Object.fromEntries(keys.map((k) => [k, SENTINELS[k]]));
    expect(
      got,
      'A key on the objectui#5097 exemption list stopped reaching the host list renderer. The ruling\n'
        + 'kept every read: "not authored surface" is a statement about who WRITES the key, never a\n'
        + 'licence to stop reading it. A dropped read silently blanks that setting in every stored\n'
        + 'app-shell document that carries it.',
    ).toEqual(want);
  });
});
