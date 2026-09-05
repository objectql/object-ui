// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * One named, importable authoring-face type per `plugin-chatbot` registration
 * (objectui#7655, under the objectui#6169 / #6172 family ruling: every
 * component node has exactly one named, importable authoring-face type).
 *
 * ## What was wrong
 *
 * `packages/plugin-chatbot/src/renderer.tsx` registers three components —
 * `chatbot`, `chatbot-enhanced`, `chatbot-floating` — and `@object-ui/types`
 * published ONE face for the family, `ChatbotSchema`, with `type` pinned to
 * `'chatbot'`. An author annotating a `chatbot-floating` node either dropped to
 * untyped JSON or annotated with `ChatbotSchema` and lied about `type`; the
 * docs' floating example had to be a `json` fence because no `tsx` fence could
 * compile. The two registrations' real key sets lived in anonymous
 * `ChatbotSchema & { ... }` intersections local to the renderer.
 *
 * ## The shape, and why not the smaller diff
 *
 * One interface per registration — `ChatbotEnhancedSchema`,
 * `ChatbotFloatingSchema` — not `ChatbotSchema['type']` widened to the union
 * of the three keys. The union would give three nodes ONE type and re-open what
 * #6169 closed: a single interface declaring keys only some of its own `type`
 * values read. Each new face declares what ITS registration reads, censused per
 * key on the PR's base with lit controls, and the twenty keys all three read
 * are picked off `ChatbotSchema` by name (`ChatbotSharedKey`) so they stay one
 * declaration.
 *
 * ## Two channels, stated so nobody reads the wrong one
 *
 * The `export type assertion…` blocks below are COMPILE-TIME: they are checked
 * by `tsc -p tsconfig.test.json` (this package's `type-check` script chains it)
 * and are erased before vitest runs. A green vitest run says nothing about
 * them — the same instrument split `zod-mirror-parity.test.ts` documents, and
 * the same one `chatbot-authoring-face-keys.test.ts` (objectui#6169) uses for
 * its `@ts-expect-error` pins. The `it` blocks are the RUNTIME channel: the Zod
 * twins' accept sets.
 *
 * ## `displayMode` and `floatingConfig` live on BOTH faces; `displayMode` is a tombstone on both
 *
 * `ChatbotSchema` keeps `floatingConfig` exactly as it had it, and
 * `ChatbotFloatingSchema` declares the same member. `displayMode` was carried
 * the same way — declared verbatim on both faces, untouched by this card —
 * until objectui#7654 RETIRED it (maintainer ruling B, 2026-09-05): it is a
 * `?: never` tombstone on both faces now, the designer control and the
 * `defaultProps` seed in the `chatbot-floating` registration are gone, and the
 * key stays UNMIRRORED on both twins. The runtime pin below still asserts it
 * parses green with any value, as a tripwire for the moment objectui#6152
 * mints an arm; the tombstone's own pins are in
 * `chatbot-display-mode-retired.test.ts`.
 *
 * ## The census counts NAMED reads; the floating registration has a second channel
 *
 * `assertionFloatingDeclaresWhatItReads` pins the named-read instrument —
 * `schema.KEY` inside the `chatbot-floating` registration body — and nothing
 * else. That registration also ends its `FloatingChatbot` element with a raw
 * `{...props}` spread, so every authored key `SchemaRenderer` forwards reaches
 * the panel's `ChatbotEnhanced` unfiltered: `processVisibility`, `surface` and
 * `showAvatars` are LIVE on a `chatbot-floating` node today (measured through
 * the real host with lit/dark pairs, `chatbot-enhanced`'s `toDomProps`-filtered
 * spread as the control — pinned as a tripwire in `plugin-chatbot`'s
 * `renderer.authoring-faces-7655.test.tsx`). The face does not declare them:
 * that channel is accidental and is carded for a declare-vs-fence ruling
 * (objectui#7708).
 */

import { describe, it, expect } from 'vitest';
import type { BaseSchema } from '../base';
import type {
  ChatMessage,
  ChatbotEnhancedSchema,
  ChatbotFloatingSchema,
  ChatbotSchema,
  ChatbotSharedKey,
  FloatingChatbotConfig,
} from '../complex';
import {
  ChatbotEnhancedSchema as ChatbotEnhancedZod,
  ChatbotFloatingSchema as ChatbotFloatingZod,
  ChatbotSchema as ChatbotZod,
  ComplexSchema as ComplexZod,
} from '../zod/complex.zod';
import type { ExpressionWire } from '../expression';

/* ── Type-level helpers (the `tsc` channel) ──────────────────────────────── */

/** Invariant equality — `extends` both ways would accept a narrowing. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

/** Declared keys, read past `BaseSchema`'s `[key: string]: any` index signature. */
type WithoutIndexSignature<D> = {
  [K in keyof D as string extends K ? never : number extends K ? never : K]: D[K];
};
type DeclaredKeys<D> = Extract<keyof WithoutIndexSignature<D>, string>;
/**
 * Every face's declared keys are `BaseSchema`'s plus exactly its own census, so
 * each pin below is spelled `BaseKeys | <census>`. A union rather than a
 * subtraction on purpose: `placeholder` is declared on the base AND redeclared
 * on `ChatbotSchema` (hence picked onto both new faces), and a subtraction
 * would silently drop it from the census it belongs to — measured, not
 * assumed, with a compiler probe before this file was written.
 */
type BaseKeys = DeclaredKeys<BaseSchema>;

/** The twenty keys every registration reads, spelled out so the alias is pinned to a list and not to itself. */
type SharedKeys =
  | 'messages' | 'placeholder' | 'api' | 'conversationId' | 'systemPrompt' | 'model'
  | 'streamingEnabled' | 'headers' | 'requestBody' | 'maxToolRoundtrips' | 'onError'
  | 'showTimestamp' | 'userAvatarUrl' | 'userAvatarFallback' | 'assistantAvatarUrl'
  | 'assistantAvatarFallback' | 'autoResponse' | 'autoResponseText' | 'autoResponseDelay'
  | 'onSend';

/* ── The discriminants: one node, one type ───────────────────────────────── */

export type assertionOneDiscriminantPerFace = [
  Expect<Equal<ChatbotSchema['type'], 'chatbot'>>,
  Expect<Equal<ChatbotEnhancedSchema['type'], 'chatbot-enhanced'>>,
  Expect<Equal<ChatbotFloatingSchema['type'], 'chatbot-floating'>>,
];

/* ── The census, as EXACT key sets (both directions) ─────────────────────── */

export type assertionSharedKeyAliasIsTheCensus = Expect<Equal<ChatbotSharedKey, SharedKeys>>;

/** `chatbot-enhanced`: the shared twenty + `maxHeight`, `processVisibility`, and its four own keys. */
export type assertionEnhancedDeclaresWhatItReads = Expect<
  Equal<
    DeclaredKeys<ChatbotEnhancedSchema>,
    BaseKeys | SharedKeys | 'maxHeight' | 'processVisibility' | 'enableMarkdown' | 'enableFileUpload' | 'surface' | 'onClear'
  >
>;

/**
 * `chatbot-floating`, NAMED reads only: the shared twenty + its three own keys +
 * the two keys it declares alongside `ChatbotSchema`. NO `maxHeight`,
 * `processVisibility` or `surface` — no named read; the raw-spread channel is NOT
 * what this pin measures (see the header).
 */
export type assertionFloatingDeclaresWhatItReads = Expect<
  Equal<
    DeclaredKeys<ChatbotFloatingSchema>,
    BaseKeys | SharedKeys | 'enableMarkdown' | 'enableFileUpload' | 'onClear' | 'displayMode' | 'floatingConfig'
  >
>;

/**
 * `chatbot` keeps its WHOLE face — the six legacy keys (`loading` … `height`),
 * the `onSendMessage` and (since objectui#7654) `displayMode` tombstones, and
 * `floatingConfig` — exactly where they were. A `?: never` member is still a
 * declared key, so the census does not move when a key is tombstoned. This
 * card declared faces; it retired and moved nothing.
 */
export type assertionChatbotKeepsItsWholeFace = Expect<
  Equal<
    DeclaredKeys<ChatbotSchema>,
    | BaseKeys | SharedKeys | 'loading' | 'onSendMessage' | 'showAvatars' | 'userAvatar' | 'assistantAvatar'
    | 'markdown' | 'processVisibility' | 'height' | 'maxHeight' | 'displayMode' | 'floatingConfig'
  >
>;

/**
 * The two floating keys stay TYPED on `ChatbotSchema`. Read off the member,
 * not the key set: a member that fell off the declaration would not go missing
 * here — it would read as `any` through `BaseSchema`'s index signature, wrong
 * values would compile, and the objectui#7669 `triggerIcon` tombstone would lose
 * its reach on `chatbot` nodes (all three measured on #7655's first cut, which
 * moved the keys). `Equal` is what catches the `any`. `displayMode` reads as
 * `undefined` since objectui#7654 tombstoned it (`?: never` without
 * `exactOptionalPropertyTypes` is `never | undefined`, which collapses) — a
 * reading `Equal` still tells apart from the `any` a deletion would leave.
 */
export type assertionFloatingKeysStayTypedOnChatbot = [
  Expect<Equal<ChatbotSchema['displayMode'], undefined>>,
  Expect<Equal<ChatbotSchema['floatingConfig'], FloatingChatbotConfig | undefined>>,
];

/* ── One declaration per shared key: a pick, not a copy ──────────────────── */

export type assertionSharedKeysAreOneDeclaration = [
  Expect<Equal<ChatbotEnhancedSchema['onSend'], ChatbotSchema['onSend']>>,
  Expect<Equal<ChatbotFloatingSchema['onSend'], ChatbotSchema['onSend']>>,
  Expect<Equal<ChatbotEnhancedSchema['messages'], ChatMessage[]>>,
  Expect<Equal<ChatbotFloatingSchema['requestBody'], ChatbotSchema['requestBody']>>,
  Expect<Equal<ChatbotEnhancedSchema['maxToolRoundtrips'], ChatbotSchema['maxToolRoundtrips']>>,
  Expect<Equal<ChatbotEnhancedSchema['processVisibility'], ChatbotSchema['processVisibility']>>,
];

/* ── `displayMode` / `floatingConfig`: one type, both faces ─────────────── */

export type assertionFloatingKeysHaveOneTypeOnBothFaces = [
  Expect<Equal<ChatbotFloatingSchema['displayMode'], ChatbotSchema['displayMode']>>,
  Expect<Equal<ChatbotFloatingSchema['floatingConfig'], ChatbotSchema['floatingConfig']>>,
  // Both faces carry the objectui#7654 tombstone, so both read `undefined`.
  Expect<Equal<ChatbotFloatingSchema['displayMode'], undefined>>,
  Expect<Equal<ChatbotFloatingSchema['floatingConfig'], FloatingChatbotConfig | undefined>>,
];

/* ── `surface` has one vocabulary; `disabled` stays the inherited union ──── */

export type assertionSurfaceVocabulary = Expect<
  Equal<ChatbotEnhancedSchema['surface'], 'card' | 'plain' | undefined>
>;

/**
 * Neither face redeclares `disabled` (objectui#6169, #7087): the host evaluates
 * it for every node type, and a `boolean` redeclaration would narrow away the
 * expression-string half. `visible` beside it is the twin control, so a face
 * that dropped both keys cannot pass vacuously.
 */
export type assertionDisabledStaysTheBaseUnion = [
  // `boolean | string` until objectui#7530 declared the CEL envelope on the base union.
  Expect<Equal<ChatbotEnhancedSchema['disabled'], boolean | ExpressionWire | undefined>>,
  Expect<Equal<ChatbotFloatingSchema['disabled'], boolean | ExpressionWire | undefined>>,
  Expect<Equal<ChatbotEnhancedSchema['visible'], BaseSchema['visible']>>,
  Expect<Equal<ChatbotFloatingSchema['visible'], BaseSchema['visible']>>,
];

/* ── Runtime: the TypeScript face accepts what it declares, refuses the lie ─ */

const baseMessages: ChatMessage[] = [{ id: '1', role: 'user', content: 'hi' }];

describe('the two faces annotate the nodes their registrations render (objectui#7655)', () => {
  it('a fully authored `chatbot-enhanced` node type-checks against `ChatbotEnhancedSchema`', () => {
    const node: ChatbotEnhancedSchema = {
      type: 'chatbot-enhanced',
      messages: baseMessages,
      api: '/api/v1/ai/chat',
      requestBody: { tenant: 'acme' },
      maxHeight: '600px',
      processVisibility: 'debug',
      enableMarkdown: true,
      enableFileUpload: true,
      surface: 'plain',
      onClear: () => undefined,
      onSend: (content, messages) => {
        expect(typeof content).toBe('string');
        expect(Array.isArray(messages)).toBe(true);
      },
    };
    expect(node.type).toBe('chatbot-enhanced');
    expect(node.surface).toBe('plain');
    node.onSend?.('hello', baseMessages);
  });

  it('a fully authored `chatbot-floating` node type-checks against `ChatbotFloatingSchema`', () => {
    const node: ChatbotFloatingSchema = {
      type: 'chatbot-floating',
      messages: baseMessages,
      floatingConfig: { position: 'bottom-left', defaultOpen: true, panelHeight: 520, title: 'Support' },
      enableMarkdown: false,
      onClear: () => undefined,
    };
    expect(node.floatingConfig?.title).toBe('Support');
  });

  it('the lie the card was filed on is now a `tsc` error: `ChatbotSchema` cannot annotate the other two nodes, and vice versa', () => {
    const wrongOnChatbot: ChatbotSchema = {
      // @ts-expect-error `ChatbotSchema` pins `type` to `'chatbot'` — annotate with `ChatbotFloatingSchema`
      type: 'chatbot-floating',
      messages: baseMessages,
    };
    const wrongOnEnhanced: ChatbotEnhancedSchema = {
      // @ts-expect-error `ChatbotEnhancedSchema` pins `type` to `'chatbot-enhanced'`
      type: 'chatbot',
      messages: baseMessages,
    };
    const wrongOnFloating: ChatbotFloatingSchema = {
      // @ts-expect-error `ChatbotFloatingSchema` pins `type` to `'chatbot-floating'`
      type: 'chatbot-enhanced',
      messages: baseMessages,
    };
    expect([wrongOnChatbot, wrongOnEnhanced, wrongOnFloating]).toHaveLength(3);
  });

  it('a wrong-typed value on a DECLARED key is refused — the field is no longer `any` through the index signature', () => {
    const enhanced: ChatbotEnhancedSchema = {
      type: 'chatbot-enhanced',
      messages: baseMessages,
      // @ts-expect-error `enableFileUpload` is declared `boolean`
      enableFileUpload: 'yes',
    };
    const floating: ChatbotFloatingSchema = {
      type: 'chatbot-floating',
      messages: baseMessages,
      // @ts-expect-error `panelHeight` is a number of pixels, not a CSS length
      floatingConfig: { panelHeight: '520px' },
    };
    // …and on `ChatbotSchema` too: a wrong value on a key it declares as a
    // union is refused there, not swallowed as `any`. (`displayMode` used to
    // be this pin's key; it is a tombstone since objectui#7654, and a tombstone
    // refuses PRESENCE, which is a different pin — see
    // `chatbot-display-mode-retired.test.ts`.)
    const chatbot: ChatbotSchema = {
      type: 'chatbot',
      messages: baseMessages,
      // @ts-expect-error `processVisibility` is the typed union on `ChatbotSchema`
      processVisibility: 'bogus',
    };
    expect(enhanced.type).toBe('chatbot-enhanced');
    expect(floating.type).toBe('chatbot-floating');
    expect(chatbot.type).toBe('chatbot');
  });
});

/* ── Runtime: the Zod twins, in lockstep with the declarations ───────────── */

describe('`ChatbotEnhancedSchema` (zod) validates what the face declares', () => {
  const node = {
    type: 'chatbot-enhanced',
    messages: [{ id: '1', role: 'user', content: 'hi' }],
  };

  it('parses a fully authored node green', () => {
    const result = ChatbotEnhancedZod.safeParse({
      ...node,
      api: '/api/v1/ai/chat',
      requestBody: { tenant: 'acme' },
      maxHeight: '600px',
      processVisibility: 'summary',
      enableMarkdown: true,
      enableFileUpload: false,
      surface: 'plain',
    });
    expect(result.success).toBe(true);
  });

  it('refuses the other two discriminants — the twin is for THIS node', () => {
    for (const type of ['chatbot', 'chatbot-floating']) {
      const result = ChatbotEnhancedZod.safeParse({ ...node, type });
      expect(result.success, type).toBe(false);
      expect(result.error?.issues.some((i) => i.path.join('.') === 'type'), type).toBe(true);
    }
  });

  it("refuses a `surface` outside 'card' | 'plain', and a non-boolean `enableMarkdown` — mirrored, not passed through", () => {
    const surface = ChatbotEnhancedZod.safeParse({ ...node, surface: 'frameless' });
    expect(surface.success).toBe(false);
    expect(surface.error?.issues.some((i) => i.path.join('.') === 'surface')).toBe(true);

    const markdown = ChatbotEnhancedZod.safeParse({ ...node, enableMarkdown: 'yes' });
    expect(markdown.success).toBe(false);
    expect(
      markdown.error?.issues.some((i) => i.path.join('.') === 'enableMarkdown' && i.code === 'invalid_type'),
    ).toBe(true);
  });

  it('mirrors `requestBody` under the key the renderer reads, and refuses a non-object', () => {
    // `ChatbotSchema`'s twin mirrors this under `body`, colliding with the base
    // children slot; the two new twins do not copy that collision.
    expect(ChatbotEnhancedZod.shape.requestBody).toBeDefined();
    const result = ChatbotEnhancedZod.safeParse({ ...node, requestBody: 'tenant=acme' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.join('.') === 'requestBody')).toBe(true);
  });

  it('`onClear` is a RUNTIME SLOT the twin refuses by name (objectui#6124), like `onError` and `onSend`', () => {
    for (const key of ['onClear', 'onError', 'onSend']) {
      const result = ChatbotEnhancedZod.safeParse({ ...node, [key]: () => undefined });
      expect(result.success, key).toBe(false);
      const issue = result.error?.issues.find((i) => String(i.path[0]) === key);
      expect(issue?.code, key).toBe('custom');
      expect(issue?.message, key).toContain(`\`${key}\` is a RUNTIME SLOT`);
    }
  });
});

describe('`ChatbotFloatingSchema` (zod) validates what the face declares, and leaves the two shared floating keys unmirrored', () => {
  const node = {
    type: 'chatbot-floating',
    messages: [{ id: '1', role: 'user', content: 'hi' }],
  };

  it('parses a fully authored floating node green', () => {
    const result = ChatbotFloatingZod.safeParse({
      ...node,
      floatingConfig: { position: 'bottom-left', defaultOpen: true, panelWidth: 400, panelHeight: 520, title: 'Support', triggerSize: 56 },
      enableMarkdown: true,
      enableFileUpload: true,
      requestBody: { tenant: 'acme' },
    });
    expect(result.success).toBe(true);
  });

  it('refuses the other two discriminants', () => {
    for (const type of ['chatbot', 'chatbot-enhanced']) {
      const result = ChatbotFloatingZod.safeParse({ ...node, type });
      expect(result.success, type).toBe(false);
    }
  });

  it('TRIPWIRE — `displayMode` stays unmirrored here as on `ChatbotSchema`: any value still parses green (retired by objectui#7654; the `retirementTombstone()` half is owed when objectui#6152 mints an arm)', () => {
    // objectui#7654 retired the key (maintainer ruling B, 2026-09-05): a
    // `?: never` tombstone on both TypeScript faces, designer control and seed
    // removed. The RUNTIME face was deliberately left alone — the key has no
    // mirror arm on either twin and `BaseSchema` is `.passthrough()`, so a
    // stored document carrying it parses exactly as it did before the ruling.
    // The SHAPE pin is the assertion that fires if objectui#6152 mints a
    // house-style (non-strict) arm for the key; the parse-green line after it
    // only fires for a `.strict()` mirror (objectui#7678 item 2). Red here is
    // the signal to add the `retirementTombstone()` half at the same time, not
    // to delete the pin. The tombstone's own pins are in
    // `chatbot-display-mode-retired.test.ts`.
    expect((ChatbotFloatingZod.shape as Record<string, unknown>).displayMode).toBeUndefined();
    expect(ChatbotFloatingZod.safeParse({ ...node, displayMode: 'anything-at-all' }).success).toBe(true);
    // Lit control on the same instrument: a key the twin DOES declare is in its
    // shape and DOES refuse a wrong value, so "undefined" above is a reading.
    expect(ChatbotFloatingZod.shape.enableMarkdown).toBeDefined();
    expect(ChatbotFloatingZod.safeParse({ ...node, enableMarkdown: 'anything-at-all' }).success).toBe(false);
  });

  it('`floatingConfig` has no mirror here either — the objectui#6152 axis is not widened into', () => {
    expect((ChatbotFloatingZod.shape as Record<string, unknown>).floatingConfig).toBeUndefined();
    // Rides through unvalidated, wrong shape and all — byte for byte the
    // outcome on `ChatbotSchema`'s twin, which has no arm for it either.
    expect(ChatbotFloatingZod.safeParse({ ...node, floatingConfig: { panelHeight: '520px' } }).success).toBe(true);
  });

  it('`onClear` / `onError` / `onSend` are refused by name here too', () => {
    for (const key of ['onClear', 'onError', 'onSend']) {
      const result = ChatbotFloatingZod.safeParse({ ...node, [key]: () => undefined });
      expect(result.success, key).toBe(false);
      expect(result.error?.issues.find((i) => String(i.path[0]) === key)?.code, key).toBe('custom');
    }
  });
});

describe('the census is structural: picked off `ChatbotSchema`, never copied', () => {
  const shared: readonly ChatbotSharedKey[] = [
    'messages', 'placeholder', 'api', 'conversationId', 'systemPrompt', 'model', 'streamingEnabled',
    'headers', 'maxToolRoundtrips', 'onError', 'showTimestamp', 'userAvatarUrl', 'userAvatarFallback',
    'assistantAvatarUrl', 'assistantAvatarFallback', 'autoResponse', 'autoResponseText',
    'autoResponseDelay', 'onSend',
  ];

  it('every shared arm on the two twins carries `ChatbotSchema`\'s own description — one spelling', () => {
    const describe_ = (shape: Record<string, { description?: string }>, key: string) => shape[key]?.description;
    for (const key of shared) {
      expect(describe_(ChatbotEnhancedZod.shape, key), key).toBe(describe_(ChatbotZod.shape, key));
      expect(describe_(ChatbotFloatingZod.shape, key), key).toBe(describe_(ChatbotZod.shape, key));
      expect(describe_(ChatbotZod.shape, key), key).toBeDefined();
    }
  });

  it('the keys a registration never reads are NOT on its twin — with `ChatbotSchema` as the lit control', () => {
    const enhanced = ChatbotEnhancedZod.shape as Record<string, unknown>;
    const floating = ChatbotFloatingZod.shape as Record<string, unknown>;
    const chatbot = ChatbotZod.shape as Record<string, unknown>;
    for (const legacy of ['loading', 'showAvatars', 'userAvatar', 'assistantAvatar', 'markdown', 'height', 'onSendMessage']) {
      expect(enhanced[legacy], legacy).toBeUndefined();
      expect(floating[legacy], legacy).toBeUndefined();
      expect(chatbot[legacy], legacy).toBeDefined();
    }
    for (const enhancedOnly of ['maxHeight', 'processVisibility', 'surface']) {
      expect(enhanced[enhancedOnly], enhancedOnly).toBeDefined();
      expect(floating[enhancedOnly], enhancedOnly).toBeUndefined();
    }
  });

  it('`ComplexSchema` routes each discriminant to its own arm', () => {
    const messages = [{ id: '1', role: 'user', content: 'hi' }];
    expect(ComplexZod.safeParse({ type: 'chatbot-floating', messages }).success).toBe(true);
    expect(ComplexZod.safeParse({ type: 'chatbot-enhanced', messages }).success).toBe(true);
    // Routed to the ENHANCED arm — a `surface` refusal can only come from there.
    const routed = ComplexZod.safeParse({ type: 'chatbot-enhanced', messages, surface: 'frameless' });
    expect(routed.success).toBe(false);
    expect(routed.error?.issues.some((i) => i.path.join('.') === 'surface')).toBe(true);
  });
});
