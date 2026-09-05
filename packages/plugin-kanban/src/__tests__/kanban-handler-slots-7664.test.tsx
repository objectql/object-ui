/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Which authored `on*` keys reach a registered kanban board — measured, per
 * registration — and the guard that a bare deletion of one of them goes red on
 * (objectui#7664; the contract-review remediation of PR #7743).
 *
 * ## What went wrong, and why a hand-written ledger could not see it
 *
 * The first cut of this card removed `onCardClick` from the successor
 * `'kanban'` arm outright, on the recorded rationale "the object-bound board
 * owns the click". `BaseSchema` is `.passthrough()`, so a removed key is not
 * refused — it stops being judged and the value is KEPT. Measured on the built
 * dist at that head, `{ type: 'kanban', columns: [], onCardClick: { action:
 * 'toast' } }` went from REFUSED to ACCEPTED, with the value surviving into the
 * parsed output, while `onCardMove` / `onQuickAdd` / `onColumnAdd` /
 * `draggable` stayed REFUSED. Every ratchet stayed green because the #6124
 * ledger lists keys BY NAME and by hand: substituting one entry for another
 * holds its length constant and no assertion is derived from the read site.
 * Suite 3 below is that missing derivation.
 *
 * ## Suite 1 — runtime reachability, per registration
 *
 * The two lazy board chunks are replaced by prop recorders; three spies are
 * authored on the schema; the question is which of them reach the board.
 *
 *   - `'kanban-ui'` (`KanbanRenderer`, `../index.tsx`): all three arrive BY
 *     IDENTITY. This is the probe whose controls are lit — `onCardMove` and
 *     `onQuickAdd`, both kept as #6124 runtime slots by this PR, come out live
 *     on it, and `onCardClick` comes out live beside them off the same
 *     forward block.
 *   - `'kanban'` and `'object-kanban'` (both registered to
 *     `ObjectKanbanRenderer` → `ObjectKanban` → `KanbanRenderer`):
 *     `onQuickAdd` arrives by identity — the lit control ON THIS KEY, proving
 *     the schema-spread channel reaches the board here — while `onCardClick`
 *     AND `onCardMove` are BOTH replaced by `ObjectKanban`'s own functions
 *     (`ObjectKanban.tsx`, the `<KanbanRenderer schema={{ ...effectiveSchema,
 *     onCardClick: …, onCardMove: handleCardMove }} />` literal). The two keys
 *     have the SAME reachability on this key, so "`ObjectKanban` overrides it"
 *     cannot retire one without retiring the other.
 *   - `'kanban-enhanced'`: `onCardMove` / `onQuickAdd` arrive; `onCardClick` is
 *     not forwarded there at all.
 *
 * ## Suite 2 — the prop channel, which only `onCardClick` has
 *
 * `SchemaRenderer` spreads every non-metadata schema key as a React prop
 * (`packages/react/src/SchemaRenderer.tsx`, the `...componentProps` line of its
 * `createElement` call), and `ObjectKanbanComponentProps` DECLARES
 * `onCardClick` — there is no `onCardMove` prop. So on the `'kanban'` key an
 * authored `onCardClick` is not merely overridden: `ObjectKanban`'s own
 * wrapper CALLS it. Suite 2 invokes the function the board was handed and
 * measures that the authored one runs, with the identity check from suite 1 as
 * the control that the wrapper is genuinely interposed.
 *
 * ⇒ On every channel measured, `onCardClick` is at least as live as
 * `onCardMove`. Its #6124 disposition is RUNTIME SLOT, not `?: never`.
 *
 * ## Suite 3 — derived from the read site, so a deletion cannot hide
 *
 * The `schema.on*` reads inside `KanbanRenderer`'s body are extracted from
 * `../index.tsx` and each is required to be a declared member of the zod
 * `'kanban'` arm carrying the RUNTIME SLOT guidance. Nothing here is a list a
 * re-key can hold constant: remove a forwarded key from the arm and the
 * assertion goes red naming it.
 *
 * ## Predictions, written before the first run (red-first)
 *
 * On the tree before the remediation (`bd1fc7111` merged with `main`):
 *   - suites 1 and 2 pass unchanged — the forwards and the prop wiring are not
 *     what this card moved;
 *   - suite 3 fails on exactly one key, `onCardClick`: forwarded by
 *     `KanbanRenderer`, absent from `KanbanSchema.shape`.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import { KanbanSchema as KanbanZod } from '@object-ui/types/zod';
import '../index';

/** Every props object either board implementation was rendered with, in order. */
const recorded = vi.hoisted(() => ({
  impl: [] as Array<Record<string, unknown>>,
  enhanced: [] as Array<Record<string, unknown>>,
}));

// Both lazy chunks are replaced by prop recorders: the question this file asks
// is what reaches the board's props, not what the board draws with them.
vi.mock('../KanbanImpl', () => ({
  default: (props: Record<string, unknown>) => {
    recorded.impl.push(props);
    return null;
  },
}));
vi.mock('../KanbanEnhanced', () => ({
  default: (props: Record<string, unknown>) => {
    recorded.enhanced.push(props);
    return null;
  },
}));

const STATIC_COLUMNS = [{ id: 'todo', title: 'To Do', cards: [{ id: '1', title: 'One' }] }];

function authored() {
  return { onCardClick: vi.fn(), onCardMove: vi.fn(), onQuickAdd: vi.fn() };
}

/** Wait for one more board render to be recorded, then return the props it got. */
async function lastBoardProps(log: 'impl' | 'enhanced', before: number, unmount: () => void) {
  await waitFor(() => expect(recorded[log].length).toBeGreaterThan(before));
  const received = recorded[log][recorded[log].length - 1];
  unmount();
  return received;
}

/**
 * Render the REGISTERED renderer for `type` directly with an authored board,
 * and return the props its board implementation was handed last. The provider
 * is what `ObjectKanbanRenderer`'s `useSchemaContext()` requires; its
 * `dataSource` is explicitly `undefined` because these boards author their
 * lanes statically and nothing here fetches. (The prop is required and typed
 * `any`, so the value has to be spelled rather than omitted.)
 */
async function boardPropsFor(type: string, log: 'impl' | 'enhanced', schemaKeys: Record<string, unknown>) {
  const Renderer = ComponentRegistry.get(type) as React.ComponentType<Record<string, unknown>>;
  expect(Renderer, `\`${type}\` is not registered`).toBeDefined();
  const before = recorded[log].length;
  const { unmount } = render(
    <SchemaRendererProvider dataSource={undefined}>
      <Renderer schema={{ type, columns: STATIC_COLUMNS, quickAdd: true, ...schemaKeys }} />
    </SchemaRendererProvider>,
  );
  return lastBoardProps(log, before, unmount);
}

/**
 * The production path: author the key on the DOCUMENT and let `SchemaRenderer`
 * route it. This is the channel that turns an authored `onCardClick` into a
 * React prop on the registered renderer.
 */
async function boardPropsViaSchemaRenderer(schema: Record<string, unknown>) {
  const before = recorded.impl.length;
  const { unmount } = render(
    <SchemaRendererProvider dataSource={undefined}>
      <SchemaRenderer schema={schema as never} />
    </SchemaRendererProvider>,
  );
  return lastBoardProps('impl', before, unmount);
}

describe('which authored handler keys reach a registered kanban board (objectui#7664)', () => {
  it("`'kanban-ui'` (KanbanRenderer) forwards onCardClick, onCardMove and onQuickAdd by identity", async () => {
    const spies = authored();
    const props = await boardPropsFor('kanban-ui', 'impl', spies);
    expect({
      onCardClick: props.onCardClick === spies.onCardClick,
      onCardMove: props.onCardMove === spies.onCardMove,
      onQuickAdd: props.onQuickAdd === spies.onQuickAdd,
    }).toEqual({ onCardClick: true, onCardMove: true, onQuickAdd: true });
  });

  it.each(['kanban', 'object-kanban'])(
    "`'%s'` (ObjectKanban) passes onQuickAdd through and replaces BOTH onCardClick and onCardMove with its own",
    async (type) => {
      const spies = authored();
      const props = await boardPropsFor(type, 'impl', spies);
      expect({
        onQuickAdd: props.onQuickAdd === spies.onQuickAdd,
        onCardClick: props.onCardClick === spies.onCardClick,
        onCardMove: props.onCardMove === spies.onCardMove,
        onCardClickType: typeof props.onCardClick,
        onCardMoveType: typeof props.onCardMove,
      }).toEqual({
        onQuickAdd: true,
        onCardClick: false,
        onCardMove: false,
        onCardClickType: 'function',
        onCardMoveType: 'function',
      });
    },
  );

  it("`'kanban-enhanced'` forwards onCardMove and onQuickAdd; onCardClick is not forwarded there", async () => {
    const spies = authored();
    const props = await boardPropsFor('kanban-enhanced', 'enhanced', spies);
    expect({
      onCardMove: props.onCardMove === spies.onCardMove,
      onQuickAdd: props.onQuickAdd === spies.onQuickAdd,
      onCardClick: props.onCardClick,
    }).toEqual({ onCardMove: true, onQuickAdd: true, onCardClick: undefined });
  });
});

describe("ObjectKanban's own onCardClick wrapper CALLS the authored handler (objectui#7664)", () => {
  it("on the `'kanban'` key, an onCardClick authored on the DOCUMENT is run by the wrapper", async () => {
    const onCardClick = vi.fn();
    const card = { id: '1', title: 'One' };
    const props = await boardPropsViaSchemaRenderer({
      type: 'kanban',
      columns: STATIC_COLUMNS,
      onCardClick,
    });

    // Control: the board did NOT get the authored function itself — the
    // wrapper is genuinely interposed, so a call reaching the spy can only
    // have arrived through it.
    expect(props.onCardClick).not.toBe(onCardClick);
    (props.onCardClick as (c: unknown, e?: unknown) => void)(card);
    expect(onCardClick).toHaveBeenCalledWith(card);
  });
});

describe("every handler key KanbanRenderer forwards is declared on the 'kanban' arm (objectui#7664)", () => {
  const INDEX_TSX = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.tsx');

  /** The `schema.on*` reads inside the `KanbanRenderer` component body, read off the source. */
  function forwardedByKanbanRenderer(): string[] {
    const src = readFileSync(INDEX_TSX, 'utf8');
    const start = src.indexOf('export const KanbanRenderer');
    const end = src.indexOf("ComponentRegistry.register(\n  'kanban-ui'", start);
    if (start === -1 || end === -1) throw new Error('KanbanRenderer body not found in index.tsx');
    return [...src.slice(start, end).matchAll(/schema\.(on[A-Z][A-Za-z0-9]*)\b/g)]
      .map((m) => m[1])
      .sort();
  }

  it('the read site is measured, not listed: KanbanRenderer forwards exactly these three', () => {
    expect(forwardedByKanbanRenderer()).toEqual(['onCardClick', 'onCardMove', 'onQuickAdd']);
  });

  it('each forwarded key is a declared arm member carrying the RUNTIME SLOT guidance — a bare deletion goes red here', () => {
    const shape = KanbanZod.shape as Record<string, { description?: string } | undefined>;
    const readings = forwardedByKanbanRenderer().map((key) => ({
      key,
      declared: key in shape,
      guidance: shape[key]?.description?.includes('RUNTIME SLOT') ?? false,
    }));
    expect(readings).toEqual(
      ['onCardClick', 'onCardMove', 'onQuickAdd'].map((key) => ({ key, declared: true, guidance: true })),
    );
  });
});
