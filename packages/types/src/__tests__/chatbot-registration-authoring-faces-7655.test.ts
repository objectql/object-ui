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
 * ## `displayMode` is carried, not decided (objectui#7654)
 *
 * The key crossed from `ChatbotSchema` onto `ChatbotFloatingSchema` UNCHANGED —
 * same type, still unmirrored — because the designer control and the
 * `defaultProps` seed that carry it are the `chatbot-floating` registration's.
 * Its fate is a maintainer decision parked on objectui#7654. The runtime pin
 * below asserts it STILL parses green with any value, as a tripwire: whoever
 * mirrors, retires or wires it must flip that pin deliberately, with #7654's
 * ruling in hand, rather than have it change under them.
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

/** `chatbot-floating`: the shared twenty + its three own keys + the two carried keys. NO `maxHeight`, `processVisibility` or `surface`. */
export type assertionFloatingDeclaresWhatItReads = Expect<
  Equal<
    DeclaredKeys<ChatbotFloatingSchema>,
    BaseKeys | SharedKeys | 'enableMarkdown' | 'enableFileUpload' | 'onClear' | 'displayMode' | 'floatingConfig'
  >
>;

/**
 * `chatbot` keeps every member it had EXCEPT the two that moved. The six legacy
 * keys (`loading` … `height`) and the `onSendMessage` tombstone stay exactly
 * where they were — this card declared faces, it retired nothing.
 */
export type assertionChatbotKeepsItsOwnFaceMinusTheTwoMoved = Expect<
  Equal<
    DeclaredKeys<ChatbotSchema>,
    | BaseKeys | SharedKeys | 'loading' | 'onSendMessage' | 'showAvatars' | 'userAvatar' | 'assistantAvatar'
    | 'markdown' | 'processVisibility' | 'height' | 'maxHeight'
  >
>;

/** The two keys are not on `ChatbotSchema` any more — a move, so declared on exactly one face. */
export type assertionMovedKeysLeftChatbot = Expect<
  Equal<Extract<DeclaredKeys<ChatbotSchema>, 'displayMode' | 'floatingConfig'>, never>
>;

/* ── One declaration per shared key: a pick, not a copy ──────────────────── */

export type assertionSharedKeysAreOneDeclaration = [
  Expect<Equal<ChatbotEnhancedSchema['onSend'], ChatbotSchema['onSend']>>,
  Expect<Equal<ChatbotFloatingSchema['onSend'], ChatbotSchema['onSend']>>,
  Expect<Equal<ChatbotEnhancedSchema['messages'], ChatMessage[]>>,
  Expect<Equal<ChatbotFloatingSchema['requestBody'], ChatbotSchema['requestBody']>>,
  Expect<Equal<ChatbotEnhancedSchema['maxToolRoundtrips'], ChatbotSchema['maxToolRoundtrips']>>,
  Expect<Equal<ChatbotEnhancedSchema['processVisibility'], ChatbotSchema['processVisibility']>>,
];

/* ── `displayMode` carried UNCHANGED; `floatingConfig` keeps its shape ───── */

export type assertionCarriedKeysUnchanged = [
  Expect<Equal<ChatbotFloatingSchema['displayMode'], 'inline' | 'floating' | undefined>>,
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
  Expect<Equal<ChatbotEnhancedSchema['disabled'], boolean | string | undefined>>,
  Expect<Equal<ChatbotFloatingSchema['disabled'], boolean | string | undefined>>,
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
      displayMode: 'floating',
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
    expect(enhanced.type).toBe('chatbot-enhanced');
    expect(floating.type).toBe('chatbot-floating');
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

describe('`ChatbotFloatingSchema` (zod) validates what the face declares, and carries what it carries', () => {
  const node = {
    type: 'chatbot-floating',
    messages: [{ id: '1', role: 'user', content: 'hi' }],
  };

  it('parses a fully authored floating node green', () => {
    const result = ChatbotFloatingZod.safeParse({
      ...node,
      floatingConfig: { position: 'bottom-left', defaultOpen: true, panelWidth: 400, panelHeight: 520, title: 'Support', triggerSize: 56 },
      displayMode: 'floating',
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

  it('TRIPWIRE — `displayMode` is carried UNMIRRORED: any value still parses green (objectui#7654 decides its fate, not this card)', () => {
    // Declared on the face with its original `'inline' | 'floating'` type,
    // deliberately NOT given a mirror arm: on `ChatbotSchema` it was
    // declared-but-unmirrored, and it crossed in that exact state. A value the
    // declaration would refuse rides through `.passthrough()` here, as it did
    // before. If this goes red, someone mirrored, retired or wired the key —
    // flip this pin with #7654's ruling in hand, never silently.
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
    // pre-#7655 outcome on `ChatbotSchema`.
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
