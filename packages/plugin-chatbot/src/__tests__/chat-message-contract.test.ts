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
/** The OTHER side of the seam: the JSON/SDUI authoring contract. */
import type { ChatMessage as AuthoredChatMessage } from '@object-ui/types';
import type { authoredToRuntimeMessage, toRuntimeMessages } from '../chatMessageAdapter';

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

describe('the authoring ↔ runtime seam is an adapter, not a cast', () => {
  it('is pinned at compile time', () => {
    // objectui#4399. `renderer.tsx` used to hand `@object-ui/types` messages to
    // components typed with the shape above via three `messages as any`. These
    // pins are what makes the replacement load-bearing: without the first one
    // the adapter could quietly start returning something else, and without the
    // second the adapter could become dead code without anyone noticing.

    // Probe hygiene first — same reason as the block above.
    type _AuthoredNotAny = Assert<Equal<IsAny<AuthoredChatMessage>, false>>;
    type _AuthoredNotUnknown = Assert<Equal<IsUnknown<AuthoredChatMessage>, false>>;

    // 1. The adapter's output IS the runtime contract — not a lookalike, not a
    //    widened cousin. A narrowing anywhere in `chatMessageAdapter.ts` (say a
    //    return type of `Omit<ChatMessage, 'charts'>`) turns this line red.
    type _OutputIsRuntime = Assert<
      Equal<ReturnType<typeof authoredToRuntimeMessage>, EnhancedChatMessage>
    >;
    type _ArrayOutputIsRuntime = Assert<
      Equal<ReturnType<typeof toRuntimeMessages>, EnhancedChatMessage[]>
    >;

    // 2. …and the conversion is NECESSARY: the authoring shape is not directly
    //    assignable to the runtime one. If this ever flips to `true` the two
    //    contracts have converged and the adapter is ceremony — which is a
    //    review conversation, not something to discover by deleting it.
    type _DriftIsReal = Assert<
      Equal<AuthoredChatMessage extends EnhancedChatMessage ? true : false, false>
    >;

    // 3. The specific drifts, named individually, so a future vocabulary move
    //    says WHICH one moved instead of "types differ". Each of these is a
    //    decision recorded in `chatMessageAdapter.ts`.
    type _AuthoringHasToolRole = Assert<
      Equal<AuthoredChatMessage['role'], 'user' | 'assistant' | 'system' | 'tool'>
    >;
    type _RuntimeHasNoToolRole = Assert<
      Equal<Extract<EnhancedChatMessage['role'], 'tool'>, never>
    >;
    type _AuthoringTimestampAcceptsDate = Assert<
      Equal<AuthoredChatMessage['timestamp'], string | Date | undefined>
    >;
    type _RuntimeTimestampIsString = Assert<
      Equal<EnhancedChatMessage['timestamp'], string | undefined>
    >;
    // The fourth drift, which the issue's table did not list: the authoring
    // tool-state vocabulary carries three legacy spellings the runtime dropped.
    type _LegacyToolStatesAreAuthorable = Assert<
      Equal<
        Extract<
          NonNullable<NonNullable<AuthoredChatMessage['toolInvocations']>[number]['state']>,
          'partial-call' | 'call' | 'result'
        >,
        'partial-call' | 'call' | 'result'
      >
    >;
    type _RuntimeHasNoLegacyToolStates = Assert<
      Equal<
        Extract<
          NonNullable<NonNullable<EnhancedChatMessage['toolInvocations']>[number]['state']>,
          'partial-call' | 'call' | 'result'
        >,
        never
      >
    >;

    expect(true).toBe(true);
  });
});

describe('the three renderer call sites go through the adapter', () => {
  // The runtime net over the block above, for the `pnpm test` lane that erases
  // type assertions. The failure it catches is a cast coming BACK: `as any` on
  // this prop compiles forever and silently re-erases every drift the pins
  // above name (objectui#4399).
  const RENDERER = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'renderer.tsx');
  const source = readFileSync(RENDERER, 'utf8');

  it('finds the renderer it is guarding', () => {
    expect(source).toContain("ComponentRegistry.register('chatbot'");
  });

  it('passes no cast to a `messages` prop', () => {
    const casts = source.match(/messages=\{[^}]*\bas\s+(any|unknown)\b/g) ?? [];
    expect(
      casts,
      'packages/plugin-chatbot/src/renderer.tsx casts a `messages` prop again. The ' +
        '@object-ui/types ↔ plugin ChatMessage seam is `toRuntimeMessages` in ' +
        'chatMessageAdapter.ts — a cast there erases every narrowing decision it ' +
        'records (objectui#4399).',
    ).toEqual([]);
  });

  it('feeds all three registered chat components from the adapter', () => {
    expect(source).toMatch(/import \{ toRuntimeMessages \} from '\.\/chatMessageAdapter';/);
    // `chatbot`, `chatbot-enhanced`, `chatbot-floating` — one seam each.
    expect(source.match(/toRuntimeMessages\(messages\)/g) ?? []).toHaveLength(3);
    expect(source.match(/messages=\{runtimeMessages\}/g) ?? []).toHaveLength(3);
  });
});

describe('the Date → ISO absorption is expressed once', () => {
  // The placement half of the ruling: the adapter must not become a THIRD
  // dialect. `normalizeMessages` owned this coercion inline; it now consumes
  // the adapter's `toRuntimeTimestamp`. Two copies of the ternary is the state
  // this guards against — they drift, and the one a message went through is
  // then a function of which mode the chat is in.
  const HOOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'useObjectChat.ts');
  const source = readFileSync(HOOK, 'utf8');

  it('finds the hook it is guarding', () => {
    expect(source).toContain('function normalizeMessages');
  });

  it('routes the hook through the adapter instead of restating the coercion', () => {
    expect(source).toMatch(/import \{ toRuntimeTimestamp \} from '\.\/chatMessageAdapter';/);
    expect(source).toContain('timestamp: toRuntimeTimestamp(msg.timestamp)');
    expect(
      source.includes('toISOString()'),
      'useObjectChat.ts converts a timestamp itself again. That conversion is the ' +
        'seam\'s decision and lives in `toRuntimeTimestamp` (objectui#4399); a second ' +
        'copy here is the third dialect the card exists to prevent.',
    ).toBe(false);
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
