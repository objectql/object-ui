/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `object-grid` — the three keys ruled NON-AUTHOR SURFACE stay unlisted, and
 * stay read (objectui#5091).
 *
 * ## The card, and the ruling
 *
 * objectui#5091 found four keys `ObjectGrid` reads through `(schema as any)`
 * that `GRID_QUERY_INPUTS` does not publish. `inputs` is not documentation: it
 * is the published AUTHORING surface, serialized by `sdui-parser`'s
 * `gen-manifest.ts` into `sdui.manifest.json` (the save gate and parser
 * whitelist) and into `sdui-intrinsics.d.ts`, and read by the designer panel.
 * A key the renderer honours and `inputs` omits therefore draws `unknown-prop`
 * from the parser on a key that works — objectui#4648's complaint.
 *
 * The maintainer ruled per key on 2026-08-18. THREE of them — `columnState`,
 * `hideRowHeightToggle`, `maxInlineRowActions` — are NOT authoring surface and
 * stay out of the manifest and the docs: a cast read of theirs is deliberate,
 * not missed. This file is where that word "deliberate" is said to the tooling,
 * so the next census re-files the card only if something really changed.
 *
 * (The fourth, `rowActionDefs`, was ruled INTO the manifest on the reading that
 * it is the symmetric partner of the declared `bulkActionDefs`. It is not
 * declared here: the spec's `ObjectGridPropsSchema` is a `strictObject` that
 * accepts `bulkActionDefs` and REJECTS `rowActionDefs` by name, and
 * `app-shell/src/views/ObjectView.tsx:1924` DERIVES the grid's `rowActionDefs`
 * from `objectDef.actions` filtered by `locations: ['list_item']` rather than
 * passing an authored key through — so the two are asymmetric by construction,
 * and declaring it here would publish a key the save gate refuses. That is back
 * with the maintainer on objectui#5091; this file states only what was ruled
 * AND holds.)
 *
 * ## The shape of the pin — four assertions per key, and why each is needed
 *
 * Reusable as-is for the same census one and two packages over (objectui#5097
 * on `record:*` / `view:object`, objectui#5102):
 *
 *   1. NOT PUBLISHED, on every tag the renderer is registered under. One
 *      renderer registered twice is two chances to disagree with itself.
 *   2. THE CONTRACT REJECTS IT BY NAME. `ComponentPropsMap['object-grid']` is
 *      strict, so the key comes back in `unrecognized_keys` — asserted as a KEY
 *      verdict (the fixture is otherwise legal), never as a whole-document
 *      `success`, which would confuse "this key is refused" with "this document
 *      is well-formed". This is the half that makes the exemption checkable
 *      rather than an opinion: publishing the key would put the manifest at
 *      odds with the gate that stores the document.
 *   3. THE PARSER SAYS SO OUT LOUD, through the real validator over a manifest
 *      built from the LIVE registry — never a hand-written one that could agree
 *      with itself. `unknown-prop` on these keys is the intended, ruled outcome,
 *      not a defect; pinning it is what stops a later "tidy-up" from declaring
 *      them to silence a warning.
 *   4. THE RENDERER STILL READS IT. The ruling kept every read site; only the
 *      status changed. Deleting a read is the one move that would make an
 *      author's stored document quietly do nothing, and it is exactly what a
 *      reader who sees "non-author surface" might think is the tidy finish.
 *
 * The control in 1-3 is `bulkActionDefs`: declared, spec-accepted, clean
 * through the parser. Without it, all three assertions would pass just as
 * happily against a registry that published nothing at all.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { ComponentPropsMap } from '@objectstack/spec/ui';
import { manifestFromConfigs, validateTree } from '@object-ui/sdui-parser';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';

import { ObjectGrid } from '../ObjectGrid';
// Module scope, not a hook: this import IS the registration (AGENTS.md's
// test-discipline section — an unbounded module load must not be billed to a
// bounded window).
import '../index';

registerAllFields();

/** The two tags this one renderer is published under. */
const GRID_TAGS = [
  { label: 'object-grid', type: 'object-grid', namespace: undefined },
  { label: 'view:grid', type: 'grid', namespace: 'view' },
] as const;

/**
 * The three keys ruled NON-AUTHOR SURFACE, each with the producer that writes
 * it. The producer is the evidence: "non-author" is a claim about who WRITES
 * the key, so a reader can check it rather than trust it.
 */
const NON_AUTHOR_KEYS = [
  {
    key: 'columnState',
    producer: 'app-shell/src/views/ObjectView.tsx:1848 in, :1867 back out via persistViewPatch',
    sample: { order: ['name'] },
  },
  {
    key: 'hideRowHeightToggle',
    producer: 'plugin-list/src/ListView.tsx:1866 — the embedding view owns density',
    sample: true,
  },
  {
    key: 'maxInlineRowActions',
    producer: 'apps/console/src/dev/DevRowActions.tsx:51 — an embedder layout call',
    sample: 2,
  },
] as const;

/** The declared control: ruled-in surface, spec-accepted, parser-clean. */
const DECLARED_CONTROL = 'bulkActionDefs';

const declaredInputNames = (type: string, namespace?: string): string[] =>
  ((ComponentRegistry.getConfig(type, namespace) as any)?.inputs ?? []).map((i: any) => i.name);

/**
 * A manifest built the way `gen-manifest.ts` and the JSX-page compiler build
 * theirs — from the live registry — so these verdicts are the ones a real
 * author gets, not the ones a fixture was written to produce.
 */
const liveManifest = () =>
  manifestFromConfigs(
    ComponentRegistry.getKnownTypes().map((type) => {
      const meta = ComponentRegistry.getMeta(type);
      return { type, namespace: meta?.namespace, isContainer: meta?.isContainer, inputs: meta?.inputs };
    }) as unknown as Parameters<typeof manifestFromConfigs>[0],
  );

/** Diagnostics a one-node `object-grid` document draws for `props`. */
const diagnose = (props: Record<string, unknown>) =>
  validateTree(
    { type: 'object-grid', objectName: 'account', ...props } as never,
    liveManifest(),
  ).diagnostics;

/** The spec's verdict on ONE key added to an otherwise legal grid document. */
const specVerdict = (key: string, value: unknown) =>
  (ComponentPropsMap as Record<string, any>)['object-grid'].safeParse({
    objectName: 'account',
    [key]: value,
  });

describe('the three ruled non-author keys are not published (objectui#5091)', () => {
  it.each(GRID_TAGS)('$label publishes none of them', ({ type, namespace }) => {
    const declared = declaredInputNames(type, namespace);
    for (const { key, producer } of NON_AUTHOR_KEYS) {
      expect(
        declared,
        [
          `\`${type}\` publishes \`${key}\` as authoring surface. The 2026-08-18 ruling on`,
          'objectui#5091 put it out of the manifest deliberately: it is written by the HOST',
          `(${producer}), and the spec's \`ObjectGridPropsSchema\` rejects it by name, so an`,
          'author who accepted the offer could not save the document.',
        ].join('\n'),
      ).not.toContain(key);
    }
  });

  it.each(GRID_TAGS)('$label does publish the declared control, so absence means something', ({ type, namespace }) => {
    // Without this, "not published" would pass against an empty registration.
    expect(declaredInputNames(type, namespace)).toContain(DECLARED_CONTROL);
  });
});

describe('the contract rejects the three by name — the exemption is checkable (objectui#5091)', () => {
  it.each(NON_AUTHOR_KEYS)('the spec refuses $key as an unrecognized key', ({ key, sample }) => {
    const result = specVerdict(key, sample);
    expect(result.success, `\`@objectstack/spec\` now ACCEPTS object-grid.${key} — re-open the ruling`).toBe(false);
    // A KEY verdict, not a document verdict: the rest of the fixture is legal,
    // so the only thing that can be reported is this key's rejection.
    const unrecognized = (result as { error: { issues: Array<{ code: string; keys?: string[] }> } }).error.issues
      .filter((issue) => issue.code === 'unrecognized_keys')
      .flatMap((issue) => issue.keys ?? []);
    expect(unrecognized).toContain(key);
  });

  it(`accepts the declared control ${DECLARED_CONTROL}`, () => {
    // The control that separates "this key is refused" from "this schema
    // refuses everything". A FULL parse, because the claim here is that the
    // whole document is legal — the asymmetry the ruling rests on.
    const result = specVerdict(DECLARED_CONTROL, []);
    expect(result.success).toBe(true);
  });
});

describe('the parser reports them as unknown props — the ruled outcome (objectui#5091)', () => {
  it.each(NON_AUTHOR_KEYS)('$key draws unknown-prop from the real validator', ({ key, sample }) => {
    const codes = diagnose({ [key]: sample }).filter((d) => d.code === 'unknown-prop');
    expect(
      codes.map((d) => d.message).join('\n'),
      `\`${key}\` no longer draws \`unknown-prop\`. If that is deliberate it means the key was`
        + ' declared — which the 2026-08-18 ruling forbids for this key.',
    ).toContain(key);
  });

  it('a declared key draws nothing, so the diagnosis is not vacuous', () => {
    // `rowHeight` is declared and its value is legal, so a clean run here is
    // what proves the three above are reporting the KEY and not the fixture.
    expect(diagnose({ rowHeight: 'compact' }).filter((d) => d.code === 'unknown-prop')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The reads themselves — unchanged by the ruling, and the half a reader of
// "non-author surface" is most likely to delete.
// ---------------------------------------------------------------------------

const rows = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
];

function makeAdapter(objectSchema?: Record<string, unknown>) {
  return {
    find: vi.fn().mockResolvedValue({ data: rows, total: rows.length }),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue({
      name: 'test_object',
      fields: { id: { type: 'text' }, name: { type: 'text' }, email: { type: 'text' } },
      ...objectSchema,
    }),
  };
}

function renderGrid(extra: Record<string, unknown>, objectSchema?: Record<string, unknown>) {
  const schema = {
    type: 'object-grid',
    objectName: 'test_object',
    columns: [{ field: 'name', label: 'Name' }, { field: 'email', label: 'Email' }],
    data: { provider: 'value', items: rows },
    ...extra,
  } as any;
  // `dataSource` is a PROP of this component, not something it reads from the
  // provider context (`ObjectGrid.tsx:371`) — the provider is what threads it
  // through in the `SchemaRenderer` path. Passing it here is what lets the grid
  // fetch `objectSchema` for inline data (`ObjectGrid.tsx:967`), which is where
  // the object's action declarations come from.
  return render(
    <ActionProvider>
      <ObjectGrid schema={schema} dataSource={makeAdapter(objectSchema) as any} />
    </ActionProvider>,
  );
}

const settled = async () => {
  await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
};

beforeEach(() => {
  // The `columnState` seed falls back to localStorage per storage key; a
  // leaked entry would make the next case pass for the wrong reason.
  localStorage.clear();
});

describe('the renderer still reads all three (objectui#5091 kept every read site)', () => {
  it('columnState.order still reorders the columns', async () => {
    const { container } = renderGrid({ id: 'ordered', columnState: { order: ['email', 'name'] } });
    await settled();
    const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent?.trim());
    // The two data columns, in the order the HOST's saved state asked for.
    expect(headers.filter((h) => h === 'Name' || h === 'Email')).toEqual(['Email', 'Name']);
  });

  it('columnState absent leaves the authored column order alone', async () => {
    const { container } = renderGrid({ id: 'unordered' });
    await settled();
    const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent?.trim());
    expect(headers.filter((h) => h === 'Name' || h === 'Email')).toEqual(['Name', 'Email']);
  });

  it('hideRowHeightToggle still hides the toolbar toggle a declared rowHeight offers', async () => {
    const shown = renderGrid({ id: 'toggle-on', rowHeight: 'compact' });
    await settled();
    expect(screen.getByTitle(/^Row height:/)).toBeInTheDocument();
    shown.unmount();

    renderGrid({ id: 'toggle-off', rowHeight: 'compact', hideRowHeightToggle: true });
    await settled();
    expect(screen.queryByTitle(/^Row height:/)).toBeNull();
  });

  it('maxInlineRowActions still widens the inline-button budget', async () => {
    const actions = [
      { name: 'approve', label: 'Approve', variant: 'primary' },
      { name: 'reject', label: 'Reject', variant: 'primary' },
    ];
    const rowActions = ['approve', 'reject'];

    // Default budget (the `?? 1` at the read site): one primary inline, the
    // other folded into the "⋮" menu, which renders nothing until it is opened.
    const single = renderGrid({ id: 'budget-default', rowActions }, { actions });
    await settled();
    await waitFor(() => expect(screen.getAllByTestId('row-action-inline-approve').length).toBe(rows.length));
    expect(screen.queryAllByTestId('row-action-inline-reject')).toEqual([]);
    single.unmount();

    // The host raises the budget to two: both render inline.
    renderGrid({ id: 'budget-two', rowActions, maxInlineRowActions: 2 }, { actions });
    await settled();
    await waitFor(() => expect(screen.getAllByTestId('row-action-inline-reject').length).toBe(rows.length));
    expect(screen.getAllByTestId('row-action-inline-approve').length).toBe(rows.length);
  });
});
