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
 * ## ⭐ What the 2026-09-09 family retirement did to this file
 *
 * Three of the four registrations this file measured RETIRED — the bare
 * `kanban` node key (objectui#8802) and the `kanban-ui` / `kanban-enhanced`
 * variants (objectui#8257) — and the zod `'kanban'` arm retired with the first
 * of them. ⛔ The MECHANISM the file exists to guard did not retire with them,
 * so the legs were re-based rather than deleted:
 *
 *   - the per-registration reachability probes collapse to the ONE surviving
 *     key, `'object-kanban'`;
 *   - `KanbanRenderer` is still a live component (`ObjectKanban` renders it),
 *     so its identity-forward probe is kept and driven DIRECTLY instead of
 *     through a registry key that no longer exists;
 *   - suite 3's derivation survives intact and its VERDICT flips, which is the
 *     honest reading: the three forwarded keys had exactly one declaring face,
 *     the `'kanban'` arm, and with the arm gone they have NONE. Recorded as an
 *     assertion so the state cannot drift back silently, and reported on the
 *     retirement PR rather than repaired here — declaring them on
 *     `ObjectKanbanSchema` would WIDEN a published accept set, which is a
 *     ruling and not a repair.
 *
 * ## Suite 1 — runtime reachability, per registration
 *
 * The two lazy board chunks are replaced by prop recorders; three spies are
 * authored on the schema; the question is which of them reach the board.
 *
 *   - `KanbanRenderer` rendered directly (`../index.tsx`): all three arrive BY
 *     IDENTITY. This is the probe whose controls are lit — `onCardMove` and
 *     `onQuickAdd`, both kept as #6124 runtime slots, come out live on it, and
 *     `onCardClick` comes out live beside them off the same forward block.
 *   - `'object-kanban'` (registered to `ObjectKanbanRenderer` → `ObjectKanban`
 *     → `KanbanRenderer`): `onQuickAdd` arrives by identity — the lit control
 *     ON THIS KEY, proving the schema-spread channel reaches the board here —
 *     while `onCardClick` AND `onCardMove` are BOTH replaced by
 *     `ObjectKanban`'s own functions (`ObjectKanban.tsx`, the
 *     `<KanbanRenderer schema={{ ...effectiveSchema, onCardClick: …,
 *     onCardMove: handleCardMove }} />` literal). The two keys have the SAME
 *     reachability here, so "`ObjectKanban` overrides it" cannot retire one
 *     without retiring the other.
 *
 * ## Suite 2 — the prop channel, which only `onCardClick` has
 *
 * `SchemaRenderer` spreads every non-metadata schema key as a React prop
 * (`packages/react/src/SchemaRenderer.tsx`, the `...componentProps` line of its
 * `createElement` call), and `ObjectKanbanComponentProps` DECLARES
 * `onCardClick` — there is no `onCardMove` prop. So on the `'object-kanban'` key an
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
 * `../index.tsx`. Nothing here is a list a re-key can hold constant: the read
 * site is measured, and each key's declaration status on the surviving
 * `object-kanban` face is measured beside it.
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
import { ObjectKanbanSchema as ObjectKanbanZod } from '@object-ui/types/zod';
import { KanbanRenderer } from '../index';
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
 * Render `KanbanRenderer` DIRECTLY with an authored board and return the props
 * its board implementation was handed last.
 *
 * ⚠️ Direct rather than through a registry key, and that is a re-based
 * instrument rather than a weakened one: `kanban-ui` — the key this probe used
 * to reach the component through — RETIRED (objectui#8257). The component is
 * unchanged, still exported, and still rendered by `ObjectKanban`, so the
 * forward block being measured is identical; what is gone is one lookup hop.
 */
async function kanbanRendererProps(schemaKeys: Record<string, unknown>) {
  const before = recorded.impl.length;
  const { unmount } = render(
    <SchemaRendererProvider dataSource={undefined}>
      <KanbanRenderer schema={{ type: 'object-kanban', columns: STATIC_COLUMNS, quickAdd: true, ...schemaKeys }} />
    </SchemaRendererProvider>,
  );
  return lastBoardProps('impl', before, unmount);
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
  it('KanbanRenderer forwards onCardClick, onCardMove and onQuickAdd by identity', async () => {
    // ⚠️ Driven DIRECTLY rather than through a registry key: `kanban-ui`
    // retired (objectui#8257). The component is unchanged and still live —
    // `ObjectKanban` renders it — so the forward block this leg measures is the
    // same one it always measured.
    const spies = authored();
    const props = await kanbanRendererProps(spies);
    expect({
      onCardClick: props.onCardClick === spies.onCardClick,
      onCardMove: props.onCardMove === spies.onCardMove,
      onQuickAdd: props.onQuickAdd === spies.onQuickAdd,
    }).toEqual({ onCardClick: true, onCardMove: true, onQuickAdd: true });
  });

  it.each(['object-kanban'])(
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

  it('the three RETIRED registrations resolve to nothing, and the survivor still does', () => {
    // Replaces the `'kanban-enhanced'` reachability leg, whose subject retired
    // (objectui#8257). Stated as a reading with its own firing control rather
    // than as three bare `false`s.
    expect({
      kanban: ComponentRegistry.has('kanban'),
      kanbanUi: ComponentRegistry.has('kanban-ui'),
      kanbanEnhanced: ComponentRegistry.has('kanban-enhanced'),
      objectKanban: ComponentRegistry.has('object-kanban'),
    }).toEqual({ kanban: false, kanbanUi: false, kanbanEnhanced: false, objectKanban: true });
  });
});

describe("ObjectKanban's own onCardClick wrapper CALLS the authored handler (objectui#7664)", () => {
  it("on the `'object-kanban'` key, an onCardClick authored on the DOCUMENT is run by the wrapper", async () => {
    const onCardClick = vi.fn();
    const card = { id: '1', title: 'One' };
    const props = await boardPropsViaSchemaRenderer({
      type: 'object-kanban',
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

describe('the handler keys KanbanRenderer forwards, and where they are declared (objectui#7664)', () => {
  const INDEX_TSX = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.tsx');

  /** The `schema.on*` reads inside the `KanbanRenderer` component body, read off the source. */
  function forwardedByKanbanRenderer(): string[] {
    const src = readFileSync(INDEX_TSX, 'utf8');
    const start = src.indexOf('export const KanbanRenderer');
    // The component body ends at the `kanban-ui` retirement tombstone that
    // follows it. The `it` below is this extraction's own anti-vacuity control:
    // a marker that stopped matching would make `end` -1 and throw, and a
    // marker that matched too early would drop keys from the measured set.
    const end = src.indexOf('⛔ The `kanban-ui` node type key is RETIRED', start);
    if (start === -1 || end === -1) throw new Error('KanbanRenderer body not found in index.tsx');
    return [...src.slice(start, end).matchAll(/schema\.(on[A-Z][A-Za-z0-9]*)\b/g)]
      .map((m) => m[1])
      .sort();
  }

  it('the read site is measured, not listed: KanbanRenderer forwards exactly these three', () => {
    expect(forwardedByKanbanRenderer()).toEqual(['onCardClick', 'onCardMove', 'onQuickAdd']);
  });

  it('⚠️ none of the three is declared on the surviving `object-kanban` face — the retirement moved this reading, and it is recorded rather than repaired', () => {
    // ⭐ This leg USED to assert `declared: true, guidance: true` against the
    // zod `'kanban'` arm, which carried all three as objectui#6124 RUNTIME
    // SLOTS. objectui#8802 retired that arm with the bare node key, and the
    // surviving `ObjectKanbanSchema` never declared them — so the honest
    // reading today is the opposite one, and it is pinned so it cannot drift
    // back in silence.
    //
    // ⛔ NOT repaired here: adding the three to `ObjectKanbanSchema` WIDENS a
    // published accept set, which is a ruling, not a repair. Reported on the
    // retirement PR for the maintainer.
    const shape = ObjectKanbanZod.shape as Record<string, { description?: string } | undefined>;
    const forwarded = forwardedByKanbanRenderer();
    expect(forwarded.map((key) => ({ key, declared: key in shape }))).toEqual(
      ['onCardClick', 'onCardMove', 'onQuickAdd'].map((key) => ({ key, declared: false })),
    );
    // Firing control on the SAME instrument: a key this face really does
    // declare reads `true`, so the three `false`s above are readings and not a
    // shape lookup that answers `false` to everything (an unwrapped
    // `.superRefine()` result, say, whose `.shape` is undefined).
    expect('groupBy' in shape).toBe(true);
  });
});
