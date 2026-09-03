/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#6939, the `kanban` group — `KanbanColumn`'s card list.
 *
 * `packages/types` declared the member as `items`, in both halves of the
 * published surface (`complex.ts` and its zod mirror `complex.zod.ts`), while
 * every board reads `cards`. Re-measured on `origin/main` @ `78a3cc238`, the
 * base of this branch:
 *
 *   - `KanbanImpl.tsx`      12 lines read `.cards`,  0 read `.items`
 *   - `KanbanEnhanced.tsx`   8 lines read `.cards`,  0 read `.items`
 *   - `index.tsx`            `bucketCardsIntoColumns` reads `col.cards` twice,
 *                            each as `col.cards || []`
 *
 * (A same-shaped LIT control on the same two files — `.title` — returns 8 and
 * 3, so the two zeros above are readings and not a mis-shaped probe.)
 *
 * ## Why the render half is the discriminating half, and why it is inverted here
 *
 * objectui#6318's triage: a "correction" that renders identically proves the
 * SCHEMA was the wrong side. The tree-view row of this card cleared that bar by
 * rendering identically. This row clears the STRONGER, opposite-polarity bar —
 * "correcting" the fixtures toward the declaration does not merely change the
 * render, it EMPTIES THE BOARD. Measured through this file's harness on
 * `78a3cc238`, before either declaration was touched:
 *
 *   basic-kanban-board       `cards` 64 elements, "To Do2 … Design new feature …"
 *                            `items` 45 elements, "No cards3 columnsTo Do0 …"
 *   advanced-…-and-limits    `cards` 86 elements, "Backlog2 … User Authentication …"
 *                            `items` 58 elements, "No cards4 columnsBacklog0 …"
 *
 * `column.cards || []` in `bucketCardsIntoColumns` is the mechanism: under the
 * `items` spelling every column buckets to zero cards. So the accepted spelling
 * had to move to `cards` — renaming the twelve read sites instead would have
 * emptied every authored board.
 *
 * ## The accept-set move this pins (Clause-② surface)
 *
 * Before: the two catalog entries FAILED `safeValidateSchema` (": Invalid
 * input") and the `items` spelling PASSED. After: exactly reversed. That is a
 * published mirror's accept/reject behaviour moving, and a renamed member on a
 * published type — pinned in both directions below.
 *
 * ## The harness, and why identity is claimed only within it
 *
 * `kanban` resolves to `KanbanRenderer`, which is
 * `<Suspense><LazyKanban/></Suspense>` over `React.lazy(() =>
 * import('./KanbanImpl'))`. A bare render measures the Suspense fallback — one
 * `<div>` skeleton, empty `textContent`, which is the vacuous identity pin this
 * file must not be (it was the first reading taken here, and it was discarded).
 *
 * `measure()` therefore settles the boundary with `waitFor`, the same way the
 * sibling `catalog-gallery-render.test.tsx` settles it for these very entries
 * (its comment names `kanban` as one of its three `React.lazy` categories).
 * Side-effect-importing the lazy chunk at module scope would be faster, but the
 * only specifier that reaches it — `@object-ui/plugin-kanban/KanbanImpl` — is
 * not in the package's `exports` map and resolves solely through the repo's
 * vitest source alias. objectui#4325 ruled that shape out for
 * `@object-ui/fields`: a package's surface is its index, and one test's preload
 * does not justify minting permanent public API. The witness used here is a
 * column heading, which exists in BOTH the populated and the empty board, so
 * the wait cannot pass for one spelling and time out for the other.
 *
 * Absolute counts are harness-relative; identity within THIS harness is the claim.
 *
 * Three readings per tile, because a count alone cannot tell a swapped element
 * from an equal one: element count, a tag census, and the text — visible text
 * as a literal, plus a SHA-256 over the full `textContent` with the Radix
 * scroll-area `<style>` blocks included.
 */
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { createHash } from 'node:crypto';
import '@object-ui/components';
import '@object-ui/plugin-kanban';
import { SchemaRenderer, SchemaRendererProvider, toRenderableSchema } from '@object-ui/react';
import { safeValidateSchema } from '@object-ui/types/zod';
import { getExample } from '../src/index.js';

const IDS = [
  'plugin-kanban/basic-kanban-board',
  'plugin-kanban/advanced-kanban-with-badges-and-limits',
] as const;

type Reading = {
  elements: number;
  tags: Record<string, number>;
  sha256: string;
  visibleText: string;
};

/** Radix ScrollArea injects this per viewport; folded out of `visibleText`. */
const SCROLL_AREA_STYLE =
  '[data-radix-scroll-area-viewport]{scrollbar-width:none;-ms-overflow-style:none;' +
  '-webkit-overflow-scrolling:touch;}[data-radix-scroll-area-viewport]::-webkit-scrollbar{display:none}';

/**
 * The AUTHORED (`cards`) spelling, measured on `origin/main` @ `78a3cc238`
 * through `measure()` below with both declarations still saying `items`. The
 * repair must not move any of these numbers.
 */
const PRE_REPAIR: Record<(typeof IDS)[number], Reading> = {
  'plugin-kanban/basic-kanban-board': {
    elements: 64,
    tags: { DIV: 52, SPAN: 6, H3: 3, STYLE: 3 },
    sha256: '034c51898d2e87caa57aaced4c1eff31c8b0e9f3832cd55ee2847aa580b084b4',
    visibleText: "To Do2Design new featureCreate mockups and wireframesWrite documentationUpdate API docsIn Progress1Implement featureCode the new componentHigh PriorityDone1Setup projectInitialize repository\n    To pick up a draggable item, press the space bar.\n    While dragging, use the arrow keys to move the item.\n    Press space again to drop the item in its new position, or press escape to cancel.\n  ",
  },
  'plugin-kanban/advanced-kanban-with-badges-and-limits': {
    elements: 86,
    tags: { DIV: 68, SPAN: 10, H3: 4, STYLE: 4 },
    sha256: 'bec0ae1f2c2a0c945ad582232730fe29a25c529f63f2e4996b40c8ef77454d66',
    visibleText: "Backlog2User AuthenticationImplement OAuth2.0BackendHighDark ModeAdd theme switcherUIWork In Progress1 / 3API IntegrationConnect to backend servicesIn ProgressCode Review0No cardsCompleted1Project SetupRepository initialized\n    To pick up a draggable item, press the space bar.\n    While dragging, use the arrow keys to move the item.\n    Press space again to drop the item in its new position, or press escape to cancel.\n  ",
  },
};

/**
 * The `items` spelling, measured in the same run. This is the board the
 * declaration was asking authors to write, and it is empty. Pinned so that the
 * claim "the rename is toward the shape that ships" stays a measurement.
 */
const ITEMS_SPELLING: Record<(typeof IDS)[number], Reading> = {
  'plugin-kanban/basic-kanban-board': {
    elements: 45,
    tags: { DIV: 31, SPAN: 6, H3: 4, P: 1, STYLE: 3 },
    sha256: '2523834600c510b6673b125862cb2041d9b20d3ddc8c0f53292b17f227d73410',
    visibleText: "No cards3 columnsTo Do0In Progress0Done0\n    To pick up a draggable item, press the space bar.\n    While dragging, use the arrow keys to move the item.\n    Press space again to drop the item in its new position, or press escape to cancel.\n  ",
  },
  'plugin-kanban/advanced-kanban-with-badges-and-limits': {
    elements: 58,
    tags: { DIV: 39, SPAN: 9, H3: 5, P: 1, STYLE: 4 },
    sha256: 'acd99051b378a9eaf6e5096604dba293a6b8f14bd0b8af68e511bc2b1269eeb0',
    visibleText: "No cards4 columnsBacklog0Work In Progress0 / 3Code Review0Completed0\n    To pick up a draggable item, press the space bar.\n    While dragging, use the arrow keys to move the item.\n    Press space again to drop the item in its new position, or press escape to cancel.\n  ",
  },
};

/** Render one entry through the provider-wrapped bare renderer and measure it. */
async function measure(schema: unknown): Promise<Reading & { text: string }> {
  const { container, unmount } = render(
    <SchemaRendererProvider dataSource={undefined}>
      <SchemaRenderer schema={toRenderableSchema(schema as never) as never} />
    </SchemaRendererProvider>,
  );
  // A column heading exists in BOTH the populated and the empty board, so this
  // wait is a carrier legal in both states — it cannot pass for one spelling
  // and time out for the other.
  await waitFor(() => expect(container.querySelector('h3')).not.toBeNull());
  const nodes = Array.from(container.querySelectorAll('*'));
  const text = container.textContent ?? '';
  const tags = nodes.reduce<Record<string, number>>((h, el) => ((h[el.tagName] = (h[el.tagName] ?? 0) + 1), h), {});
  const out = {
    elements: nodes.length,
    tags,
    sha256: createHash('sha256').update(text).digest('hex'),
    visibleText: text.split(SCROLL_AREA_STYLE).join(''),
    text,
  };
  unmount();
  return out;
}

/** Report the issues rather than `false`, so a red run says what broke. */
function reasons(schema: unknown): string[] {
  const r = safeValidateSchema(schema);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
}

/** The same document with every column's `cards` renamed back to `items`. */
function toItemsSpelling(schema: unknown): unknown {
  const s = JSON.parse(JSON.stringify(schema)) as { columns: Array<Record<string, unknown>> };
  for (const col of s.columns) {
    col.items = col.cards;
    delete col.cards;
  }
  return s;
}

describe('objectui#6939 — the mirror now accepts the spelling every board reads', () => {
  it.each(IDS)('%s validates under safeValidateSchema', (id) => {
    // Each reported `: Invalid input` on `78a3cc238` — `columns[].items` was
    // required and no authored entry has ever carried it.
    expect(reasons(getExample(id).schema)).toEqual([]);
  });

  it.each(IDS)('%s: the `items` spelling is now REFUSED', (id) => {
    // The other half of the accept-set move. This document PASSED before the
    // rename; a mirror that merely widened would still accept it.
    expect(reasons(toItemsSpelling(getExample(id).schema))).not.toEqual([]);
  });

  it('`cards` is a real declaration, not a passthrough hole', () => {
    // `BaseSchema` is `.passthrough()`, so an unknown key proves nothing here.
    // Every probe below uses the DECLARED key.
    const col = (extra: Record<string, unknown>) => ({
      type: 'kanban',
      columns: [{ id: 'todo', title: 'To Do', ...extra }],
    });
    expect(safeValidateSchema(col({ cards: 'nope' })).success).toBe(false);
    expect(safeValidateSchema(col({ cards: [{ id: '1' }] })).success).toBe(false); // card needs `title`
    expect(safeValidateSchema(col({})).success).toBe(false); // `cards` is required
    // …and the good shape passes, so the three above fail for their own reason.
    expect(safeValidateSchema(col({ cards: [] })).success).toBe(true);
    expect(safeValidateSchema(col({ cards: [{ id: '1', title: 'Task' }] })).success).toBe(true);
  });
});

describe('objectui#6939 — and the repair moved the validator, not the renderer', () => {
  it.each(IDS)('%s renders exactly what it rendered before', async (id) => {
    const after = await measure(getExample(id).schema);
    const before = PRE_REPAIR[id];
    expect(after.elements).toBe(before.elements);
    expect(after.tags).toEqual(before.tags);
    expect(after.visibleText).toBe(before.visibleText);
    expect(after.sha256).toBe(before.sha256);
  });

  it.each(IDS)('%s anti-vacuity: the authored columns AND cards are on screen', async (id) => {
    // A tile that renders nothing satisfies "identical" trivially — and the
    // empty board below is exactly such a tile, so this guard is load-bearing.
    const schema = getExample(id).schema as {
      columns: Array<{ title: string; cards: Array<{ title: string }> }>;
    };
    const m = await measure(schema);
    expect(m.text).not.toContain('failed to render');
    expect(m.text).not.toContain('Unknown component type');
    for (const column of schema.columns) {
      expect(m.visibleText).toContain(column.title);
      for (const card of column.cards) expect(m.visibleText).toContain(card.title);
    }
    // At least one card actually exists, or the loop above is vacuous.
    expect(schema.columns.reduce((n, c) => n + c.cards.length, 0)).toBeGreaterThan(0);
  });

  it.each(IDS)('%s: the `items` spelling still draws an EMPTY board', async (id) => {
    // The discriminator. `bucketCardsIntoColumns` reads `col.cards || []`, so
    // under `items` every column buckets to zero — unchanged by this card,
    // which is why this reading is a carrier legal in both states.
    const m = await measure(toItemsSpelling(getExample(id).schema));
    const expected = ITEMS_SPELLING[id];
    expect(m.elements).toBe(expected.elements);
    expect(m.tags).toEqual(expected.tags);
    expect(m.visibleText).toBe(expected.visibleText);
    expect(m.sha256).toBe(expected.sha256);
    // Named explicitly: no authored card title survives, and every column reads zero.
    expect(m.visibleText).toContain('No cards');
    const schema = getExample(id).schema as { columns: Array<{ cards: Array<{ title: string }> }> };
    for (const column of schema.columns) {
      for (const card of column.cards) expect(m.visibleText).not.toContain(card.title);
    }
  });
});
