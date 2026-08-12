/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `@object-ui/plugin-chatbot` — one name, one chat message contract
 * (objectui#4383).
 *
 * The barrel used to export TWO different `ChatMessage` types: a minimal one
 * it declared itself (`id`/`role`/`content`/`timestamp`/`avatar`/
 * `avatarFallback`) and the enhanced one `<ChatbotEnhanced>` actually renders,
 * re-exported under the alias `ChatbotEnhancedMessage`. The natural name
 * resolved to the narrow shape, so the next importer who reached for
 * `ChatMessage` got the wrong contract and the compiler could not object —
 * both shapes existed on purpose, and every construction site spreads the
 * extra keys conditionally (`...(x ? { toolInvocations } : {})`), which
 * defeats excess-property checking. That is how app-shell's `AiChatPage` ended
 * up unable to read `toolInvocations` off its own function's return value
 * (objectui#4040, re-pointed at the enhanced type in PR #4379 without touching
 * the collision itself).
 *
 * The pins below are what makes the convergence hold. They are COMPILE-TIME
 * assertions: a violation is a `tsc` error under this package's
 * `tsconfig.test.json`, not a runtime failure — vitest erases them entirely,
 * so `pnpm test` proves nothing about them and only `pnpm --filter
 * @object-ui/plugin-chatbot type-check` can. The runtime block at the bottom is
 * a cheap net over the same fact for the vitest run.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The name the barrel publishes — what any importer gets by default. */
import type { ChatMessage as BarrelChatMessage, ChatbotEnhancedMessage } from '../index';
/** The shape `<ChatbotEnhanced>` renders and the mappers produce. */
import type { ChatMessage as EnhancedChatMessage } from '../ChatbotEnhanced';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
/** The `unknown` erasure the `any` probe reports `false` for (objectui#3155). */
type IsUnknown<T> = [unknown] extends [T] ? ([T] extends [unknown] ? true : false) : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;
/** objectstack#4075: an index signature absorbs every excess key. */
type HasIndexSignature<T> = string extends keyof T ? true : false;
type Has<T, K extends string> = K extends keyof T ? true : false;

/**
 * The retired shape, transcribed verbatim from the declaration this change
 * deleted from `src/index.tsx`. It exists here ONLY so the negative pin below
 * can name what must never come back — nothing imports it.
 */
interface RetiredMinimalChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  avatar?: string;
  avatarFallback?: string;
}

describe("the barrel's ChatMessage IS the enhanced shape", () => {
  it('is pinned at compile time', () => {
    // Probe hygiene: an `any`/`unknown` on either side would make every
    // `Equal` below answer whatever it is asked, so check the probes first.
    type _BarrelNotAny = Assert<Equal<IsAny<BarrelChatMessage>, false>>;
    type _BarrelNotUnknown = Assert<Equal<IsUnknown<BarrelChatMessage>, false>>;
    type _EnhancedNotAny = Assert<Equal<IsAny<EnhancedChatMessage>, false>>;

    // The whole point of the card: the natural name resolves to the enhanced
    // contract. Before the fix this was `false` — the barrel declared its own
    // minimal interface — and this line alone turned `tsc` red.
    type _BarrelIsEnhanced = Assert<Equal<BarrelChatMessage, EnhancedChatMessage>>;

    // ...and the disambiguating alias kept for compat denotes the SAME type,
    // so the two spellings are one contract rather than two shapes again.
    type _AliasIsEnhanced = Assert<Equal<ChatbotEnhancedMessage, EnhancedChatMessage>>;
    type _AliasIsBarrel = Assert<Equal<ChatbotEnhancedMessage, BarrelChatMessage>>;

    // The negative half. `Equal` is structural, so re-declaring the retired
    // members anywhere in the barrel's `ChatMessage` — not just restoring the
    // literal interface — trips this.
    type _NotTheRetiredShape = Assert<
      Equal<Equal<BarrelChatMessage, RetiredMinimalChatMessage>, false>
    >;

    // The mechanism from objectstack#4075: with `[k: string]: unknown` on the
    // message type, EVERY structural comparison above answers "identical",
    // however far the barrel drifts. Pin its absence or the pins are theatre.
    type _NoIndexSignature = Assert<Equal<HasIndexSignature<BarrelChatMessage>, false>>;

    // The keys the retired shape did NOT have — i.e. exactly what an importer
    // reaching for `ChatMessage` used to lose. Named individually so a future
    // narrowing says WHICH capability it dropped instead of "types differ".
    type _HasStreaming = Assert<Has<BarrelChatMessage, 'streaming'>>;
    type _HasToolInvocations = Assert<Has<BarrelChatMessage, 'toolInvocations'>>;
    type _HasReasoning = Assert<Has<BarrelChatMessage, 'reasoning'>>;
    type _HasSources = Assert<Has<BarrelChatMessage, 'sources'>>;
    type _HasTraceId = Assert<Has<BarrelChatMessage, 'traceId'>>;
    type _HasBuildProgress = Assert<Has<BarrelChatMessage, 'buildProgress'>>;
    type _HasBlueprintProgress = Assert<Has<BarrelChatMessage, 'blueprintProgress'>>;
    type _HasCharts = Assert<Has<BarrelChatMessage, 'charts'>>;

    // The retirement is a WIDENING, which is what makes it safe for existing
    // callers: every field of the retired shape survives with the same type,
    // and everything added is optional — so anything that used to be a valid
    // `ChatMessage` still is. If a future edit makes one of the added keys
    // required, this is the line that fails.
    type _RetiredStillAssignable = Assert<
      RetiredMinimalChatMessage extends BarrelChatMessage ? true : false
    >;
    type _IdSurvives = Assert<Equal<BarrelChatMessage['id'], string>>;
    type _RoleSurvives = Assert<
      Equal<BarrelChatMessage['role'], 'user' | 'assistant' | 'system'>
    >;
    type _ContentSurvives = Assert<Equal<BarrelChatMessage['content'], string>>;
    type _TimestampSurvives = Assert<Equal<BarrelChatMessage['timestamp'], string | undefined>>;
    type _AvatarSurvives = Assert<Equal<BarrelChatMessage['avatar'], string | undefined>>;
    type _AvatarFallbackSurvives = Assert<
      Equal<BarrelChatMessage['avatarFallback'], string | undefined>
    >;

    expect(true).toBe(true);
  });
});

describe('the barrel no longer declares a message shape of its own', () => {
  // A runtime net over the pins above, for the `pnpm test` lane that erases
  // them. It reads the source rather than the type because the failure to
  // catch is a DECLARATION reappearing in this module: that is what split the
  // name in two, and it is the one edit `tsc` reports only in the type-check
  // job.
  const BARREL = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'index.tsx');
  const source = readFileSync(BARREL, 'utf8');

  it('finds the barrel it is guarding', () => {
    // If the file moves or is renamed, fail here rather than pass vacuously.
    expect(source).toContain('export type { ChatMessage }');
  });

  it('declares no local ChatMessage type', () => {
    expect(
      /^\s*(export\s+)?(interface|type)\s+ChatMessage\b/m.test(source),
      'packages/plugin-chatbot/src/index.tsx declares a `ChatMessage` of its own again. ' +
        'The barrel must RE-EXPORT the one from `./ChatbotEnhanced` — a second declaration ' +
        'is how the name came to mean two different shapes (objectui#4383).',
    ).toBe(false);
  });

  it('re-exports the message contract from ChatbotEnhanced', () => {
    expect(source).toMatch(/export type \{ ChatMessage \} from '\.\/ChatbotEnhanced';/);
    expect(source).toMatch(
      /export type \{ ChatMessage as ChatbotEnhancedMessage \} from '\.\/ChatbotEnhanced';/,
    );
  });
});
