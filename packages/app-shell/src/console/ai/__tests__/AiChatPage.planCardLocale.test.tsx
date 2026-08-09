// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Which locale each string on the plan / confirm cards follows (objectui#3837).
 *
 * One gate, two rules (#772/#2884, stated in `AiChatPage`'s own comment above
 * `convZh`): what a card SENDS to the agent follows the CONVERSATION's language
 * — the cloud confirm gate's approval pattern only recognises Chinese and
 * English — and what a card DISPLAYS follows the console UI locale, like every
 * other label in the console.
 *
 * `planBuildingLabel` (#2632) was on the wrong side of that line: gated on
 * `convZh`, it rendered a hard-coded `正在搭建…` for any Chinese thread, so an
 * English console showed one Chinese badge among English labels, and the ten
 * packs' `console.ai.planBuilding` was unreachable for the very readers it was
 * translated for (#3546 slice four measured it; PR #3839 backfilled the key).
 *
 * The pane is rendered for real — real `I18nProvider`, real locale packs, real
 * `isConversationZh` probe — with `ChatbotEnhanced` replaced by a prop recorder,
 * because the props ChatPane hands down ARE where the two rules live.
 *
 * Note which cases can discriminate: only a UI locale that DIFFERS from the
 * conversation's language can. `zh` UI + `zh` conversation reads the same string
 * either way (the pack value is byte-identical to the deleted literal, and the
 * containment pin in `packages/i18n/.../console-namespace-3546.test.tsx` is why),
 * so it is kept as the invariance half, not as evidence of the fix.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

/** Props of the last `ChatbotEnhanced` render — the surface under assertion. */
let captured: Record<string, unknown> = {};

vi.mock('@object-ui/plugin-chatbot', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ChatbotEnhanced: (props: Record<string, unknown>) => {
      captured = props;
      return null;
    },
    // No transport in a unit test: the conversation this pane reasons about
    // arrives through `initialMessages` (the hydrated history), which is the
    // half of `convZh` a fresh page load actually reads.
    useObjectChat: () => ({
      messages: [],
      isLoading: false,
      error: undefined,
      sendMessage: vi.fn(),
      stop: vi.fn(),
      reload: vi.fn(),
      clear: vi.fn(),
      setMessages: vi.fn(),
    }),
    useAiModels: () => ({ models: [], defaultModelId: undefined }),
  };
});

// The pane reads `apps` for the bound-package chip and the adapter for the
// Excel→App bar; neither is part of this invariant, and both otherwise want a
// live backend.
vi.mock('../../../providers/MetadataProvider', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useMetadata: () => ({ apps: [] }) };
});
vi.mock('../../../providers/AdapterProvider', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useAdapter: () => null };
});

import { I18nProvider } from '@object-ui/i18n';
import type { AgentDescriptor } from '@object-ui/plugin-chatbot';
import { ChatPane } from '../AiChatPage';
import type { HydratedUIMessage } from '../../../hooks/useChatConversation';

// jsdom has no matchMedia — `useIsMobile` (mobile canvas overlay) needs a stub.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

const CJK = /[一-鿿]/;

function userTurn(text: string): HydratedUIMessage[] {
  return [{ id: 'm1', role: 'user', parts: [{ type: 'text', text }] }] as HydratedUIMessage[];
}

/** A Chinese thread and an English one — the two conversation languages the gate knows. */
const ZH_THREAD = userTurn('帮我做一个客户管理应用');
const EN_THREAD = userTurn('Build me a CRM app');

function renderPane(uiLocale: string, initialMessages: HydratedUIMessage[]) {
  // Unmount any previous tree first: a still-mounted pane re-renders on its own
  // effects and would overwrite `captured` with ITS props after this render.
  cleanup();
  captured = {};
  render(
    <I18nProvider config={{ defaultLanguage: uiLocale, detectBrowserLanguage: false }}>
      <MemoryRouter initialEntries={['/ai/build/conv-1']}>
        <ChatPane
          agents={[{ name: 'build', label: 'Builder' } as unknown as AgentDescriptor]}
          agentsLoading={false}
          agentsError={undefined}
          activeAgent="build"
          chatApi="/api/v1/ai/agents/build/chat"
          apiBase="/api/v1/ai"
          conversationId="conv-1"
          initialMessages={initialMessages}
          pendingFirstMessageRef={{ current: null }}
          onSent={vi.fn()}
          onShare={vi.fn()}
        />
      </MemoryRouter>
    </I18nProvider>,
  );
  return captured;
}

beforeEach(() => {
  // The provider persists the last language (objectstack#5406); without this a
  // stale locale leaks into the next case.
  window.localStorage.clear();
});
afterEach(() => cleanup());

describe('#3837 — plan-card labels follow the UI locale, sent messages follow the conversation', () => {
  it('en UI + Chinese thread: the Building badge is English, like every other label on the card', () => {
    const props = renderPane('en', ZH_THREAD);
    // The discriminating assertion: before the fix this was '正在搭建…'.
    expect(props.planBuildingLabel).toBe('Building…');
    // …and the card it sits on has no other Chinese in it, which is the actual
    // user-visible complaint (#2458 item 4 is this in the other direction).
    const chineseLabels = Object.entries(props)
      .filter(([k, v]) => k.endsWith('Label') && typeof v === 'string' && CJK.test(v))
      .map(([k]) => k);
    expect(chineseLabels).toEqual([]);
  });

  it('de UI + Chinese thread: the badge comes from the German pack, not from a two-way ternary', () => {
    // The removed gate could only ever choose between Chinese and the UI locale,
    // so a third locale is the cleanest proof that the PACK now answers.
    expect(renderPane('de', ZH_THREAD).planBuildingLabel).toBe('Wird erstellt…');
  });

  it('zh UI: the badge is the zh pack value — now the only source of that string', () => {
    // Cannot discriminate before/after (the deleted literal was byte-identical
    // by design) — it pins that the fix did not change what a zh reader sees.
    expect(renderPane('zh', ZH_THREAD).planBuildingLabel).toBe('正在搭建…');
    expect(renderPane('zh', EN_THREAD).planBuildingLabel).toBe('正在搭建…');
  });

  it('the three OUTBOUND messages still follow the conversation, not the UI (#772/#2884 intact)', () => {
    // The other half of the gate must be untouched: these are sent INTO the
    // thread and the cloud confirm gate matches them by language.
    const zhUnderEn = renderPane('en', ZH_THREAD);
    expect(zhUnderEn.planApproveMessage).toBe('确认，开始搭建。');
    expect(zhUnderEn.planApproveDefaultsMessage).toBe('确认搭建，未决问题按你的合理假设和默认处理。');
    expect(zhUnderEn.changesConfirmMessage).toBe('确认修改，应用你刚才提议的改动。');

    // An English thread is read under a NON-Chinese, non-English console on
    // purpose: `outbound-agent-messages.test.ts` guarantees no pack but `en` and
    // `zh` defines these keys, so `de` proves the English default — the wording
    // the cloud gate matches — is what a non-Chinese thread sends. (A `zh`
    // console is the one combination that does not hold; measured while writing
    // this test and filed separately — it is the sent-message half of the gate,
    // not the label half this PR narrows.)
    const enUnderDe = renderPane('de', EN_THREAD);
    expect(enUnderDe.planApproveMessage).toBe('Looks good — build it as proposed.');
    expect(enUnderDe.planApproveDefaultsMessage).toBe(
      'Build it with your best assumptions; use sensible defaults for the open questions.',
    );
    expect(enUnderDe.changesConfirmMessage).toBe('Confirm — apply the change you just proposed.');
  });
});
