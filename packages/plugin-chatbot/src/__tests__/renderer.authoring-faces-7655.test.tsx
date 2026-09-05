/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The `chatbot-enhanced` and `chatbot-floating` registrations type their
 * `schema` against the PUBLISHED faces (objectui#7655) — and the one runtime
 * consequence of doing so is pinned.
 *
 * ## The four things this file pins
 *
 *   1. **The registrations consume the published faces.** Read off the
 *      renderer's own source: each registration's parameter annotation names
 *      `ChatbotEnhancedSchema` / `ChatbotFloatingSchema`, and no anonymous
 *      `ChatbotSchema & { ... }` intersection is left in the file. A source pin
 *      rather than a type pin because `ComponentRegistry` is untyped — the
 *      registered component's props type is not recoverable from the registry.
 *   2. **One vocabulary, two spellings, pinned equal.** `ChatbotEnhanced.tsx`
 *      owns `ChatbotSurface` and `ChatbotProcessVisibility` as component props;
 *      `@object-ui/types` declares the same unions on the face. Neither can
 *      widen without the other or this goes red at `tsc -p tsconfig.test.json`
 *      (compile-time — erased before vitest runs).
 *   3. **`chatbot-floating` consumes the host's evaluated `disabled` verdict.**
 *      Before #7655 it wrote `disabled={schema.disabled}` and then spread
 *      `{...props}` AFTER it — and `SchemaRenderer` always includes
 *      `disabled: verdict || undefined` in those props, so the raw read was
 *      overridden on every render. Typing the face honestly (`disabled` stays
 *      `BaseSchema`'s `boolean | string`, objectui#7087) means the raw union
 *      cannot be forwarded into the panel's `boolean` prop, so the registration
 *      now names the verdict the way its two siblings do. The render cases
 *      below measure the OUTCOME through the real SDUI host — the composer is
 *      disabled when the node says so and enabled when it does not — which is
 *      what must not move.
 *   4. **`chatbot-floating` has a second channel the named-read census cannot
 *      see — TRIPWIRE, not contract.** The registration ends its
 *      `FloatingChatbot` element with a raw `{...props}` spread, LAST, where
 *      its two siblings spread `toDomProps(props)` FIRST. So three keys
 *      `ChatbotFloatingSchema` does NOT declare — and the named-read census in
 *      `@object-ui/types`' `chatbot-registration-authoring-faces-7655.test.ts`
 *      correctly reads 0 for — still reach the panel's `ChatbotEnhanced`:
 *      `showAvatars`, `surface`, `processVisibility`. The cases below pin that
 *      MEASUREMENT (lit/dark pairs on a floating node, `chatbot-enhanced` as the
 *      control) so the face's docblock cannot rot silently. They do not make the
 *      channel a contract: fencing the spread like the siblings, or declaring
 *      the keys, is objectui#7708's ruling, and whichever lands flips these
 *      pins with it — deliberately, never silently.
 *
 * The runtime cases render through `SchemaRenderer`, not the bare component,
 * for the reason `renderer.surface.test.tsx` gives: what is measured is what
 * an AUTHOR gets.
 */

import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { toDomProps } from '@object-ui/core';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import type { ChatbotEnhancedSchema } from '@object-ui/types';
import type { ChatbotProcessVisibility, ChatbotSurface } from '../ChatbotEnhanced';
// Side-effect import: this is what registers the chat components.
import '../renderer';

/* ── 2. One vocabulary, two spellings (the `tsc` channel) ────────────────── */

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

export type assertionSurfaceIsOneContract = Expect<
  Equal<ChatbotSurface, NonNullable<ChatbotEnhancedSchema['surface']>>
>;
export type assertionProcessVisibilityIsOneContract = Expect<
  Equal<ChatbotProcessVisibility, NonNullable<ChatbotEnhancedSchema['processVisibility']>>
>;

/* ── 1. The registrations consume the published faces ────────────────────── */

const RENDERER = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'renderer.tsx'), 'utf8');

/** The body of one `ComponentRegistry.register('<key>', ...)` call, up to the next registration. */
function registration(key: string): string {
  const start = RENDERER.indexOf(`ComponentRegistry.register('${key}',`);
  if (start < 0) throw new Error(`no registration for ${key}`);
  const next = RENDERER.indexOf('ComponentRegistry.register(', start + 1);
  return RENDERER.slice(start, next < 0 ? undefined : next);
}

describe('the registrations type `schema` as the published faces (objectui#7655)', () => {
  it("`chatbot-enhanced` names `ChatbotEnhancedSchema`; `chatbot-floating` names `ChatbotFloatingSchema`", () => {
    expect(registration('chatbot-enhanced')).toContain('schema: ChatbotEnhancedSchema;');
    expect(registration('chatbot-floating')).toContain('schema: ChatbotFloatingSchema;');
    // Lit control: the `chatbot` registration still names its own face.
    expect(registration('chatbot')).toContain('schema: ChatbotSchema;');
  });

  it('no anonymous `ChatbotSchema & { ... }` intersection is left in the renderer', () => {
    // Code only: strip line and block comments before counting, since the
    // registrations' own comments recount the history in those exact words.
    const code = RENDERER.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code.match(/ChatbotSchema\s*&\s*\{/g) ?? []).toEqual([]);
  });

  it('`chatbot-floating` consumes the host verdict, not the raw `schema.disabled`', () => {
    const floating = registration('chatbot-floating').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(floating).toContain('disabled: hostDisabled');
    expect(floating).toContain('disabled={hostDisabled}');
    expect(floating).not.toContain('schema.disabled');
  });
});

/* ── 3. The `disabled` outcome, through the real host ────────────────────── */

const FAKE_ADAPTER = {
  find: async () => [],
  findOne: async () => null,
  aggregate: async () => [],
  count: async () => 0,
  getObject: async () => null,
};

beforeAll(() => {
  (globalThis as Record<string, unknown>).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
    (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};
  }
});

afterEach(() => {
  cleanup();
});

/** Renders a `chatbot-floating` node with the panel open and returns its composer. */
async function renderFloatingComposer(extra: Record<string, unknown>): Promise<HTMLTextAreaElement> {
  render(
    <SchemaRendererProvider dataSource={FAKE_ADAPTER as never}>
      <SchemaRenderer
        schema={{
          type: 'plugin-chatbot:chatbot-floating',
          id: 'chat-node',
          messages: [],
          floatingConfig: { defaultOpen: true, title: 'Chat' },
          ...extra,
        } as never}
        dataSource={FAKE_ADAPTER as never}
      />
    </SchemaRendererProvider>,
  );
  // The panel mounts through a portal onto `document.body`, so query the body.
  await waitFor(() => {
    if (!document.body.querySelector('textarea')) {
      throw new Error(`the floating panel never reached its composer. Body was:\n${document.body.innerHTML.slice(0, 600)}`);
    }
  });
  return document.body.querySelector('textarea') as HTMLTextAreaElement;
}

describe('chatbot-floating: `disabled` is the host-evaluated verdict (objectui#7655)', () => {
  it('an authored `disabled: true` disables the composer', async () => {
    const composer = await renderFloatingComposer({ disabled: true });
    expect(composer).toBeDisabled();
  });

  it('an UNAUTHORED `disabled` leaves the composer enabled — the absent case is unchanged', async () => {
    const composer = await renderFloatingComposer({});
    expect(composer).toBeEnabled();
  });

  it('an authored `disabled: false` leaves the composer enabled', async () => {
    const composer = await renderFloatingComposer({ disabled: false });
    expect(composer).toBeEnabled();
  });
});

/* ── 4. The raw spread is a second channel — TRIPWIRE for objectui#7708 ── */

/** An assistant turn with a tool result: `processVisibility: 'debug'` shows the raw tool name; `'summary'` (the default) does not. */
const ASSISTANT_WITH_TOOL = [
  {
    id: 'a1',
    role: 'assistant',
    content: 'seed reply',
    toolInvocations: [{ toolCallId: 't1', toolName: 'search_records', state: 'result', args: { q: 'x' }, result: { rows: 3 } }],
  },
];

/** Renders one node through the real host and returns the root to query — `document.body` (the floating panel portals there). */
async function renderNode(kind: 'chatbot-floating' | 'chatbot-enhanced', extra: Record<string, unknown>): Promise<HTMLElement> {
  render(
    <SchemaRendererProvider dataSource={FAKE_ADAPTER as never}>
      <SchemaRenderer
        schema={{
          type: `plugin-chatbot:${kind}`,
          id: 'chat-node',
          messages: ASSISTANT_WITH_TOOL,
          autoResponse: false,
          ...(kind === 'chatbot-floating' ? { floatingConfig: { defaultOpen: true, title: 'Chat' } } : {}),
          ...extra,
        } as never}
        dataSource={FAKE_ADAPTER as never}
      />
    </SchemaRendererProvider>,
  );
  await waitFor(() => {
    if (!document.body.querySelector('textarea')) {
      throw new Error(`the ${kind} node never reached its composer. Body was:\n${document.body.innerHTML.slice(0, 600)}`);
    }
  });
  return document.body;
}

/** The per-message avatar `MessageAvatar` renders only when `showAvatars` is on. */
const AVATAR = 'div.size-7.rounded-full[aria-hidden="true"]';

describe('chatbot-floating: three undeclared keys are LIVE through the raw spread — tripwire for objectui#7708', () => {
  it('the spread really is the difference: `showAvatars` survives `props` and not `toDomProps(props)`', () => {
    // The mechanism, pinned on the whitelist itself so the render readings
    // below have a stated cause and not just a correlation.
    const props = { showAvatars: true, surface: 'plain', processVisibility: 'debug', className: 'x' };
    expect(toDomProps(props)).not.toHaveProperty('showAvatars');
    expect(toDomProps(props)).not.toHaveProperty('surface');
    expect(toDomProps(props)).not.toHaveProperty('processVisibility');
    expect(toDomProps(props)).toHaveProperty('className', 'x'); // lit control
  });

  it('`showAvatars: true` renders the message avatar on a floating node (lit 1 / dark 0); dark on `chatbot-enhanced` either way', async () => {
    expect((await renderNode('chatbot-floating', { showAvatars: true })).querySelectorAll(AVATAR)).toHaveLength(1);
    cleanup();
    expect((await renderNode('chatbot-floating', {})).querySelectorAll(AVATAR)).toHaveLength(0);
    cleanup();
    expect((await renderNode('chatbot-enhanced', { showAvatars: true })).querySelectorAll(AVATAR)).toHaveLength(0);
  });

  it("`surface: 'plain'` reaches the floating panel (two `.max-w-2xl` wrappers lit / 0 dark) — `chatbot-enhanced` reads it by name, so it lights there too", async () => {
    expect((await renderNode('chatbot-floating', { surface: 'plain' })).querySelectorAll('.max-w-2xl')).toHaveLength(2);
    cleanup();
    expect((await renderNode('chatbot-floating', {})).querySelectorAll('.max-w-2xl')).toHaveLength(0);
    cleanup();
    expect((await renderNode('chatbot-enhanced', { surface: 'plain' })).querySelectorAll('.max-w-2xl')).toHaveLength(2);
  });

  it("`processVisibility: 'debug'` reaches the floating panel (raw tool name shown / hidden at the default) — named read lights `chatbot-enhanced` the same way", async () => {
    expect((await renderNode('chatbot-floating', { processVisibility: 'debug' })).textContent).toContain('search_records');
    cleanup();
    expect((await renderNode('chatbot-floating', {})).textContent).not.toContain('search_records');
    cleanup();
    expect((await renderNode('chatbot-enhanced', { processVisibility: 'debug' })).textContent).toContain('search_records');
    cleanup();
    expect((await renderNode('chatbot-enhanced', {})).textContent).not.toContain('search_records');
  });
});
