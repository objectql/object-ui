/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `FloatingChatbotConfig.triggerIcon` is an ADR-0049 RETIREMENT TOMBSTONE
 * (objectui#7654), and — unlike every other tombstone in this package — its
 * refusal is TYPE-LEVEL ONLY. Both halves of that sentence are pinned here.
 *
 * ## What was measured
 *
 * `triggerIcon` was declared `?: string` with `@default 'MessageCircle'` and
 * read by nothing. `FloatingChatbot` destructures six of the interface's seven
 * keys (`position`, `defaultOpen`, `panelWidth`, `panelHeight`, `title`,
 * `triggerSize`) and never this one, and `FloatingChatbotTrigger` takes no icon
 * prop, so the advertised default never rendered. A whole-repo `git grep`
 * census over tracked files, build output excluded, returned the declaration
 * and one historical CHANGELOG line and nothing else; the same pass over
 * `triggerSize` returned ten sites across four files, so the instrument was not
 * blind. It is absent from the `chatbot-floating` registration's `inputs` and
 * from its `defaultProps`, so no designer control offered it and no
 * designer-created node carries it — TypeScript was the only way to reach it.
 *
 * ## Why a tombstone, when the usual reason does not apply
 *
 * The other tombstones here argue from the mirror: an undeclared key is
 * silently STRIPPED by a non-strict `z.object`, so deletion trades one silent
 * no-op for another. That argument needs a mirror, and this key has none (see
 * the runtime section below). The tombstone earns its place on the `tsc`
 * channel alone, measured both ways on the retiring PR's merge-base:
 *
 *   | route      | fresh object literal          | widened (non-fresh) value |
 *   |------------|-------------------------------|---------------------------|
 *   | deleted    | TS2353 excess-property error  | **compiles CLEAN**        |
 *   | tombstoned | TS2322                        | TS2322                    |
 *
 * Excess-property checking only reaches a FRESH literal, so deleting the key
 * would have left the widened path silently accepting it. The declared `never`
 * makes the assignment itself ill-typed, so freshness stops mattering. That
 * contrast is not prose here — it is pinned live: the `bogusUndeclared` control
 * below IS the "deleted" row, carrying no directive because a key this
 * interface does not declare really does ride the widened path unchallenged.
 *
 * The `@ts-expect-error` directives are REAL enforcement: this package
 * type-checks its tests through `tsconfig.test.json`, so re-widening the
 * declaration fails the build on the unused directive. A green `vitest` run is
 * NOT evidence about them — type assertions are erased before it runs.
 */

import { describe, it, expect } from 'vitest';
import type { FloatingChatbotConfig } from '../complex';
import { ChatbotFloatingSchema } from '../zod/complex.zod';

/* ── type-level pins: the `tsc` channel ──────────────────────────────────── */

describe('the `triggerIcon` tombstone makes authoring a `tsc` error', () => {
  it('refuses it in a FRESH object literal', () => {
    const config: FloatingChatbotConfig = {
      title: 'Chat',
      // @ts-expect-error `triggerIcon` is a retirement tombstone (objectui#7654)
      triggerIcon: 'Sparkles',
    };
    expect(config.title).toBe('Chat');
  });

  it('refuses it through a WIDENED value too — the half a deletion would have missed', () => {
    const raw = { title: 'Chat', triggerIcon: 'Sparkles' };
    // @ts-expect-error `triggerIcon` is a retirement tombstone (objectui#7654)
    const config: FloatingChatbotConfig = raw;
    expect(config.title).toBe('Chat');
  });

  it('keeps the six LIVE keys writable — the non-vacuity control', () => {
    // Without this, a change that broke the whole interface would satisfy both
    // assertions above by accident. These six are the keys `FloatingChatbot`
    // actually destructures.
    const config: FloatingChatbotConfig = {
      position: 'bottom-right',
      defaultOpen: false,
      panelWidth: 400,
      panelHeight: 520,
      title: 'Chat',
      triggerSize: 56,
    };
    expect(config.triggerSize).toBe(56);
  });

  it('a key the interface never declared still rides the widened path — the DELETED row', () => {
    // This carries NO directive on purpose. It is the measured contrast that
    // justifies `?: never` over deletion: an undeclared key IS refused in a
    // fresh literal but is NOT refused here. Had `triggerIcon` been deleted
    // rather than tombstoned, it would sit exactly where this line sits.
    const raw = { title: 'Chat', bogusUndeclared: 1 };
    const config: FloatingChatbotConfig = raw;
    expect(config.title).toBe('Chat');
  });
});

/* ── the runtime channel: DELIBERATELY unchanged, and a tripwire if that ends ─ */

describe('there is NO zod refusal, and that is deliberate (objectui#7654)', () => {
  // objectui#7655 moved `floatingConfig` onto `ChatbotFloatingSchema` — the face
  // of the one registration that reads it — so this tripwire parses the node
  // that actually carries the key, through that face's Zod twin.
  const node = {
    type: 'chatbot-floating' as const,
    messages: [{ id: 'm1', role: 'user' as const, content: 'hi' }],
  };

  it('a chatbot-floating node carrying `floatingConfig.triggerIcon` still parses GREEN', () => {
    // `FloatingChatbotConfig` has NO zod mirror: `floatingConfig` sits in the
    // `UnmirroredDeclared` ledger (`zod-mirror-parity.test.ts`,
    // `complex.zod.ts#ChatbotFloatingSchema` since objectui#7655; it was recorded
    // under `ChatbotSchema` before), and `BaseSchema` is `.passthrough()`, so
    // the whole object rides through unvalidated. This was green before the
    // tombstone and is green after it — the retirement changed the TypeScript
    // face only, and this pins that it changed no parse outcome.
    //
    // ⚠️ TRIPWIRE: if objectui#6152 ever mints a `FloatingChatbotConfigSchema`,
    // this goes RED. That is the intended signal, not a nuisance — whoever
    // lands the mirror must add the `retirementTombstone()` half for
    // `triggerIcon` at the same time, and flip this control rather than delete
    // it into a vacuum.
    const result = ChatbotFloatingSchema.safeParse({
      ...node,
      floatingConfig: { title: 'Chat', triggerIcon: 'Sparkles' },
    });
    expect(result.success).toBe(true);
  });

  it('a live `floatingConfig` parses green too — the non-vacuity control', () => {
    const result = ChatbotFloatingSchema.safeParse({
      ...node,
      floatingConfig: { title: 'Chat', triggerSize: 56 },
    });
    expect(result.success).toBe(true);
  });

  it('the mirror really has no `floatingConfig` key at all', () => {
    // The load-bearing fact behind everything above, asserted rather than
    // assumed: a key the mirror declares would appear in its shape.
    const shape = (ChatbotFloatingSchema as unknown as { shape: Record<string, unknown> }).shape;
    expect(shape.floatingConfig).toBeUndefined();
    // Lit control: a key the mirror DOES declare is present, so the reading
    // above is a measurement and not an empty object.
    expect(shape.messages).toBeDefined();
  });
});
