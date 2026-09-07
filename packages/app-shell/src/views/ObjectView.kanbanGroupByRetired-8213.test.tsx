/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#8213 — the object page wrote a THIRD spelling of the kanban lane
 * key into the view-level config it hands to `list-view`.
 *
 * `kanbanViewOptions` emitted `{ groupBy: lane, groupByField: lane }`: the
 * spec's own `groupByField`, and beside it `groupBy`, which
 * `@objectstack/spec`'s strict `KanbanConfigSchema` refuses BY NAME. Upstream
 * already knows the OTHER legacy spelling by name — probing `groupField`
 * answers "Did you mean `groupField` → `groupByField`?" — and knows nothing at
 * all about `groupBy`. objectui#8193 had moved this producer onto the canonical
 * key and deliberately left this half for a card of its own, because dropping
 * it needed a census first.
 *
 * ⭐ WHAT THIS FILE ASSERTS, AND WHY IT IS NOT A SOURCE-TEXT SNAPSHOT. Every arm
 * below RUNS the producer and asks `KanbanConfigSchema` about the object it
 * actually returned. Nothing here greps `ObjectView.tsx`, so a reformat, a
 * rename of the local `lane` variable, or a move of the expression cannot make
 * these arms lie in either direction: the claim is about emitted KEYS, and the
 * only way to satisfy it is to emit them.
 *
 * ⚠️ THE CLAIM IS NARROWER THAN "THE EMITTED BAG VALIDATES", and saying so is
 * the point of the ratchet arm. The producer also emits `titleField` and
 * `cardFields`, and `KanbanConfigSchema` — which declares exactly
 * `groupByField` / `summarizeField` / `columns` — refuses BOTH of those by name
 * as well. They are a different question and stay:
 *   - `cardFields` is a DECLARED deprecated alias of the spec's `columns` in
 *     this repo's own `KanbanConfig` mirror (`@object-ui/types`), i.e. drift
 *     this repo has taken a documented position on;
 *   - `titleField` is live and undeclared anywhere — `ListView` destructures it
 *     out of the merged config and forwards it onto the generated
 *     `object-kanban` node.
 * Neither is a second spelling of a key this expression already writes
 * correctly, which is all objectui#8213 was. So the honest assertion is not
 * "nothing is refused" but "the refused set is EXACTLY the two known ones" —
 * which reddens for a fourth undeclared key, and would have reddened for
 * `groupBy`.
 *
 * ⚠️ NO ARM HERE ASSERTS THE `...restKanban` OVERRIDE, deliberately. `ListView`
 * spreads the rest of the merged kanban config AFTER its own `groupBy:
 * laneField`, so a surviving `groupBy` wins over the lane it just resolved.
 * That override is real, but it cannot be pinned FROM THIS PRODUCER: every bag
 * this producer can build has `groupBy` and `groupByField` holding the same
 * value by construction, so an override row driven by it passes with or without
 * the fix — a test that cannot fail. Distinguishing the two spellings needs a
 * hand-built `plugin-list` fixture (`options.kanban.groupBy: 'a'` against
 * `kanban.groupByField: 'b'`), which is a `plugin-list` change on its own card.
 * What this deletion does is remove the only producer in this repo that fed the
 * override; the override itself is untouched.
 *
 * REVERSE VERIFICATION — direction predicted before running, then observed:
 * restore `{ groupBy: lane, groupByField: lane }` in `kanbanViewOptions` and
 * the two discriminating arms plus the ratchet arm go RED by name, while every
 * CONTROL (the schema refusing a bogus key, the schema accepting the canonical
 * config, the lane still resolving) stays GREEN in both worlds. That asymmetry
 * is what makes the controls worth their lines: an instrument that refused
 * everything would satisfy the discriminating arms for the wrong reason.
 */

import { describe, it, expect } from 'vitest';
import { KanbanConfigSchema } from '@objectstack/spec/ui';
import { kanbanViewOptions } from './ObjectView';

/** An object whose lifecycle field the ADR-0085 detector finds by name. */
const OBJECT_WITH_STAGE = {
  name: 'deal',
  fields: { name: { type: 'text' }, stage: { type: 'select' } },
};

/** Every spelling of the ONE lane concept this repo has ever produced. */
const LANE_SPELLINGS = ['groupByField', 'groupField', 'groupBy'] as const;

/**
 * Key-level judgement only. The producer never emits the spec's REQUIRED
 * `columns`, so a full parse of its output is red in every world; reading
 * `unrecognized_keys` is what separates "this key is refused by name" from that
 * orthogonal noise. Same discipline the card's own four probes used.
 */
const refusedKeys = (bag: Record<string, unknown>): string[] => {
  const r = KanbanConfigSchema.safeParse(bag);
  if (r.success) return [];
  return r.error.issues
    .flatMap((i: any) => (i.code === 'unrecognized_keys' ? (i.keys as string[]) : []))
    .sort();
};

/** The lane keys actually PRESENT on a bag, by name, in sorted order. */
const laneKeysOf = (bag: Record<string, unknown>) =>
  LANE_SPELLINGS.filter((k) => k in bag).sort();

/** The two keys the producer emits that the spec refuses and this card keeps. */
const KNOWN_REFUSED_RESIDUAL = ['cardFields', 'titleField'];

describe('the instrument can answer both ways on this exact call (objectui#8213)', () => {
  it('CONTROL: the strict schema refuses an unknown key BY NAME on the producer output', () => {
    // Fires. Without it, every empty refusal below is indistinguishable from a
    // schema that has stopped judging this call shape at all.
    const emitted = kanbanViewOptions({ kanban: { groupByField: 'stage' } }, OBJECT_WITH_STAGE);
    expect(refusedKeys({ ...emitted, zzzBogusKey: 'x' })).toContain('zzzBogusKey');
  });

  it('CONTROL: the strict schema refuses NOTHING in a canonical config', () => {
    // Accepts. Without it, "refused" could just mean "refuses everything".
    expect(refusedKeys({ groupByField: 'stage', columns: ['name'] })).toEqual([]);
  });

  it('CONTROL: `groupBy` is still not a key the spec declares', () => {
    // The premise tripwire. objectui#7685 moved the resolved spec pin while
    // this card was open, so the measurement was re-run on the installed
    // version — if a later bump ever DECLARES `groupBy`, this reddens first and
    // every arm below stops meaning what it says.
    expect(Object.keys((KanbanConfigSchema as any).shape)).not.toContain('groupBy');
  });
});

describe('the object page emits ONE lane spelling — the spec\'s (objectui#8213)', () => {
  // THE DISCRIMINATING ARMS. Each ran with `groupBy` in the emitted bag before
  // this card, on every path that resolves a lane.
  it('for a view that declared the canonical key', () => {
    const emitted = kanbanViewOptions({ kanban: { groupByField: 'stage' } }, OBJECT_WITH_STAGE);
    expect(laneKeysOf(emitted)).toEqual(['groupByField']);
    expect(refusedKeys(emitted)).not.toContain('groupBy');
  });

  it('for a view that declared the LEGACY alias', () => {
    // The alias READ is untouched by this card: the value arrives legacy and
    // leaves canonical, and leaves under one key only.
    const emitted = kanbanViewOptions({ kanban: { groupField: 'stage' } }, OBJECT_WITH_STAGE);
    expect(laneKeysOf(emitted)).toEqual(['groupByField']);
  });

  it('for a lane the ADR-0085 detector supplied', () => {
    // The commonest case in the product — a view with no kanban block at all.
    const emitted = kanbanViewOptions({}, OBJECT_WITH_STAGE);
    expect(laneKeysOf(emitted)).toEqual(['groupByField']);
  });

  it('and emits no lane key at all when no lane resolves', () => {
    // Absence stays absence: a producer that always emitted a lane key — even
    // an empty one — would light the capability gate for every object view.
    const emitted = kanbanViewOptions({}, { name: 'note', fields: { body: { type: 'text' } } });
    expect(laneKeysOf(emitted)).toEqual([]);
  });
});

describe('the one reader of `groupBy` still gets the same value (objectui#8213)', () => {
  it('carries the lane under `groupByField`, the rung the collectors read first', () => {
    // The census question, stated as a property rather than as a claim about
    // call sites. `ListView`'s two projection/expand collectors list
    // `v.groupByField, v.groupField, v.groupBy` as candidates for the SAME lane
    // value; deleting the third is only safe because the first carries it. If a
    // future edit moved the value onto `groupBy` alone, this reddens.
    expect(kanbanViewOptions({}, OBJECT_WITH_STAGE).groupByField).toBe('stage');
  });

  it('CONTROL: a lane really did resolve, so the arm above is not an empty agreeing with an empty', () => {
    const emitted = kanbanViewOptions({}, OBJECT_WITH_STAGE);
    expect(Object.keys(emitted).length).toBeGreaterThan(0);
    expect(emitted.groupByField).toBeTruthy();
  });
});

describe('the RATCHET on what the spec still refuses here (objectui#8213)', () => {
  // ⭐ THE DURABLE ARM. Not "the emitted bag validates" — it does not, and this
  // file's header says why. This is the exact refused SET, so `groupBy` cannot
  // come back and a FOURTH undeclared key cannot join quietly.
  it('refuses exactly the two known residual keys, and nothing else', () => {
    const emitted = kanbanViewOptions({ kanban: { groupByField: 'stage' } }, OBJECT_WITH_STAGE);
    expect(refusedKeys(emitted)).toEqual(KNOWN_REFUSED_RESIDUAL);
  });

  it('holds on the detector path and the no-lane path too', () => {
    expect(refusedKeys(kanbanViewOptions({}, OBJECT_WITH_STAGE))).toEqual(KNOWN_REFUSED_RESIDUAL);
    expect(
      refusedKeys(kanbanViewOptions({}, { name: 'note', fields: { body: { type: 'text' } } })),
    ).toEqual(KNOWN_REFUSED_RESIDUAL);
  });

  it('CONTROL: the residual set is what it says it is, and `groupBy` is not in it', () => {
    // Guards the ratchet against being satisfied by a residual list that
    // quietly grew to include the very key this card retired.
    expect(KNOWN_REFUSED_RESIDUAL).not.toContain('groupBy');
    expect(KNOWN_REFUSED_RESIDUAL.length).toBe(2);
  });
});
