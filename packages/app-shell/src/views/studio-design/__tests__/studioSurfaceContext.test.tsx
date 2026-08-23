// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * cloud#1610 (send half) — the Studio copilot derives WHAT the user is
 * discussing from the URL alone: the `:tab` route segment is the pillar, the
 * `?surface=type:name` deep-link (which every pillar already mirrors) is the
 * artifact WITH its type discriminator. Pinned by rendering the real
 * StudioCopilotConversation and asserting the surfaceContext it hands the
 * ChatPane — the URL is the single source of truth, so this contract is
 * exactly "route in → context out".
 */
import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let capturedProps: Record<string, unknown> = {};

vi.mock('../../../console/ai/AiChatPage.js', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return {
    ...mod,
    ChatPane: (props: Record<string, unknown>) => {
      capturedProps = props;
      return <div data-testid="pane" />;
    },
  };
});
vi.mock('@object-ui/auth', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useAuth: () => ({ user: { id: 'u1' } }) };
});
vi.mock('@object-ui/plugin-chatbot', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useAgents: () => ({
      agents: [{ name: 'metadata_assistant', label: 'Build', capabilities: ['build'] }],
      isLoading: false,
      loading: false,
      error: undefined,
      refetch: vi.fn(),
    }),
  };
});

import { StudioCopilotConversation } from '../StudioAiCopilot';

afterEach(() => {
  cleanup();
  capturedProps = {};
});

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/studio/:packageId/:tab"
          element={<StudioCopilotConversation packageId="app.k9" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Studio copilot surfaceContext (cloud#1610 send half)', () => {
  it('pillar + typed artifact come straight from the URL', () => {
    renderAt('/studio/app.k9/interfaces?surface=dashboard:sales_overview');
    expect(capturedProps.surfaceContext).toEqual({
      pillar: 'interfaces',
      artifact: { type: 'dashboard', name: 'sales_overview' },
    });
  });

  it('a pillar with no selected artifact still names the pillar', () => {
    renderAt('/studio/app.k9/data');
    expect(capturedProps.surfaceContext).toEqual({ pillar: 'data' });
  });

  it('an artifact name containing colons keeps everything after the FIRST one', () => {
    renderAt('/studio/app.k9/interfaces?surface=object:k9_task.member_list');
    expect(capturedProps.surfaceContext).toEqual({
      pillar: 'interfaces',
      artifact: { type: 'object', name: 'k9_task.member_list' },
    });
  });

  it('a malformed surface param degrades to pillar-only, never a broken artifact', () => {
    renderAt('/studio/app.k9/access?surface=nonsense');
    expect(capturedProps.surfaceContext).toEqual({ pillar: 'access' });
  });
});
