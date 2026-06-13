/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Smoke tests for the AI-Elements-composed ChatbotEnhanced. Heavier
 * interaction tests (streaming, tool-call rendering) live in the app-level
 * e2e suite — these only validate the public surface stays stable.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ChatbotEnhanced, type ChatMessage } from '../ChatbotEnhanced';

describe('ChatbotEnhanced (AI Elements composition)', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders the empty conversation state with suggestion chips', () => {
    const onSendMessage = vi.fn();
    render(
      <ChatbotEnhanced
        suggestions={["Show me today's tasks", 'Summarise this account']}
        onSendMessage={onSendMessage}
      />
    );

    expect(screen.getByText(/Summarise this account/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Show me today's tasks/i));
    expect(onSendMessage).toHaveBeenCalledWith("Show me today's tasks");
  });

  it('renders user and assistant messages', () => {
    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'Hello' },
      { id: 'a1', role: 'assistant', content: 'Hi! How can I help?' },
    ];
    render(<ChatbotEnhanced messages={messages} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText(/How can I help/i)).toBeInTheDocument();
  });

  it('shows an error banner with a retry affordance', () => {
    const onReload = vi.fn();
    render(
      <ChatbotEnhanced
        messages={[{ id: 'a1', role: 'assistant', content: 'oops' }]}
        error={new Error('network down')}
        onReload={onReload}
      />
    );
    expect(screen.getByText(/Response failed/i)).toBeInTheDocument();
    expect(screen.getByText(/network down/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Retry/i));
    expect(onReload).toHaveBeenCalled();
  });

  it('shows an assistant thinking row while waiting for a response', () => {
    render(
      <ChatbotEnhanced
        messages={[{ id: 'u1', role: 'user', content: 'Find recent deals' }]}
        isLoading
      />
    );

    expect(screen.getByText('Find recent deals')).toBeInTheDocument();
    expect(screen.getByText(/Assistant is responding/i)).toBeInTheDocument();
  });

  it('renders thinking dots inside an empty streaming assistant message', () => {
    render(
      <ChatbotEnhanced
        messages={[
          { id: 'u1', role: 'user', content: 'Find recent deals' },
          { id: 'a1', role: 'assistant', content: '', streaming: true },
        ]}
        isLoading
      />
    );

    expect(screen.getByText(/Assistant is responding/i)).toBeInTheDocument();
    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
    expect(screen.queryByText('Regenerate')).not.toBeInTheDocument();
  });

  it('turns the submit control into a stop control while streaming', () => {
    const onStop = vi.fn();
    render(
      <ChatbotEnhanced
        messages={[{ id: 'u1', role: 'user', content: 'Find recent deals' }]}
        isLoading
        onStop={onStop}
      />
    );

    expect(screen.queryByLabelText('Submit')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Stop response'));
    expect(onStop).toHaveBeenCalled();
  });

  it('exposes a copy action on assistant messages', () => {
    render(
      <ChatbotEnhanced
        messages={[{ id: 'a1', role: 'assistant', content: 'copy me' }]}
      />
    );
    const copyBtn = screen.getByText('Copy').closest('button')!;
    fireEvent.click(copyBtn);
    expect((navigator.clipboard.writeText as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'copy me'
    );
  });

  it('summarizes tool invocations and hides reasoning by default', () => {
    render(
      <ChatbotEnhanced
        messages={[
          {
            id: 'a1',
            role: 'assistant',
            content: 'Found 3 deals.',
            reasoning: 'Picked the query_data tool because the user asked for deals.',
            toolInvocations: [
              {
                toolCallId: 'tc1',
                toolName: 'query_data',
                args: { objectName: 'deal', limit: 3 },
                result: { count: 3 },
                state: 'output-available',
              },
            ],
            sources: [
              { id: 's1', title: 'CRM docs', url: 'https://docs.example.com/crm' },
            ],
          },
        ]}
      />
    );
    expect(screen.queryByText(/Agent activity/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Query data/i)).toBeInTheDocument();
    expect(screen.getByText(/Completed/i)).toBeInTheDocument();
    expect(screen.queryByText(/query_data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Picked the query_data tool/i)).not.toBeInTheDocument();
    // Sources trigger renders count
    expect(screen.getByText(/Used 1 sources/i)).toBeInTheDocument();
  });

  it('renders raw tool invocations and reasoning in debug mode', () => {
    render(
      <ChatbotEnhanced
        processVisibility="debug"
        messages={[
          {
            id: 'a1',
            role: 'assistant',
            content: 'Found 3 deals.',
            reasoning: 'Picked the query_data tool because the user asked for deals.',
            toolInvocations: [
              {
                toolCallId: 'tc1',
                toolName: 'query_data',
                args: { objectName: 'deal', limit: 3 },
                result: { count: 3 },
                state: 'output-available',
              },
            ],
          },
        ]}
      />
    );
    expect(screen.getAllByText(/query_data/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Completed/i)).toBeInTheDocument();
    expect(screen.getByText(/Picked the query_data tool/i)).toBeInTheDocument();
  });

  it('hides raw tool JSON for drafting tools in summary mode but keeps the Review affordance', () => {
    const draftTool: ChatMessage = {
      id: 'a1',
      role: 'assistant',
      content: 'Built your sales CRM.',
      toolInvocations: [
        {
          toolCallId: 'tc1',
          toolName: 'apply_blueprint',
          state: 'output-available',
          args: { blueprint: { summary: 'sales', objects: [{ name: 'opportunity_secret_field' }] } },
          result: { status: 'drafted', drafted: [{ type: 'object', name: 'opportunity' }] },
          draftReview: { items: [{ type: 'object', name: 'opportunity' }], summary: 'drafted 1 artifact(s)' },
        },
      ],
    };
    const onReviewDraft = vi.fn();
    const { rerender } = render(
      <ChatbotEnhanced messages={[draftTool]} onReviewDraft={onReviewDraft} />,
    );
    // Consumer surface (summary): the friendly card + Review affordance render,
    // but the raw blueprint PARAMETERS / drafted RESULT JSON stay hidden.
    expect(screen.getByText(/Apply blueprint/i)).toBeInTheDocument();
    expect(screen.queryByText('Parameters')).not.toBeInTheDocument();
    expect(screen.queryByText('Result')).not.toBeInTheDocument();
    expect(screen.queryByText(/opportunity_secret_field/)).not.toBeInTheDocument();
    expect(screen.getByText(/Review/i)).toBeInTheDocument();

    // Developer surface (debug): the raw PARAMETERS JSON is revealed.
    rerender(<ChatbotEnhanced processVisibility="debug" messages={[draftTool]} onReviewDraft={onReviewDraft} />);
    expect(screen.getByText('Parameters')).toBeInTheDocument();
  });

  it('renders a model picker and forwards changes', () => {
    const onModelChange = vi.fn();
    render(
      <ChatbotEnhanced
        models={[
          { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' },
          { id: 'claude-3-5-sonnet', label: 'Claude 3.5', provider: 'anthropic' },
        ]}
        selectedModelId="gpt-4o-mini"
        onModelChange={onModelChange}
      />
    );
    const picker = screen.getByLabelText(/Model/i) as HTMLSelectElement;
    fireEvent.change(picker, { target: { value: 'claude-3-5-sonnet' } });
    expect(onModelChange).toHaveBeenCalledWith('claude-3-5-sonnet');
  });
});

describe('ChatbotEnhanced — auto-publish drafts (self-use magic moment)', () => {
  const userMsg: ChatMessage = { id: 'u1', role: 'user', content: 'build a todo app' };
  // A whole-app build: the backend marks it `autoPublishable` (apply_blueprint).
  const draftMsg = (packageId: string): ChatMessage => ({
    id: 'a1',
    role: 'assistant',
    content: 'Built your app.',
    toolInvocations: [
      {
        toolCallId: 'tc1',
        toolName: 'apply_blueprint',
        state: 'output-available',
        draftReview: { items: [{ type: 'object', name: 'task' }], packageId, autoPublishable: true },
      },
    ],
  });
  // An incremental edit: NOT auto-publishable — stays a draft for review.
  const editMsg = (packageId: string): ChatMessage => ({
    id: 'e1',
    role: 'assistant',
    content: 'Drafted a field.',
    toolInvocations: [
      {
        toolCallId: 'tc-edit',
        toolName: 'add_field',
        state: 'output-available',
        draftReview: { items: [{ type: 'object', name: 'task' }], packageId },
      },
    ],
  });

  it('auto-fires onPublishDrafts for a NEW draft once the turn finishes', () => {
    const onPublishDrafts = vi.fn();
    const { rerender } = render(
      <ChatbotEnhanced autoPublishDrafts isLoading messages={[userMsg]} onPublishDrafts={onPublishDrafts} />,
    );
    // Draft streams in but the turn is still running → hold off.
    rerender(
      <ChatbotEnhanced autoPublishDrafts isLoading messages={[userMsg, draftMsg('app.todo')]} onPublishDrafts={onPublishDrafts} />,
    );
    expect(onPublishDrafts).not.toHaveBeenCalled();
    // Turn finished → publish exactly once, with the drafted package id.
    rerender(
      <ChatbotEnhanced autoPublishDrafts isLoading={false} messages={[userMsg, draftMsg('app.todo')]} onPublishDrafts={onPublishDrafts} />,
    );
    expect(onPublishDrafts).toHaveBeenCalledTimes(1);
    expect(onPublishDrafts).toHaveBeenCalledWith('app.todo');
  });

  it('does NOT auto-publish drafts already present when the chat mounts', () => {
    const onPublishDrafts = vi.fn();
    const { rerender } = render(
      <ChatbotEnhanced autoPublishDrafts isLoading={false} messages={[draftMsg('app.old')]} onPublishDrafts={onPublishDrafts} />,
    );
    rerender(
      <ChatbotEnhanced autoPublishDrafts isLoading={false} messages={[draftMsg('app.old')]} onPublishDrafts={onPublishDrafts} />,
    );
    expect(onPublishDrafts).not.toHaveBeenCalled();
  });

  it('does NOT auto-publish an incremental edit (not autoPublishable) — it stays a draft', () => {
    const onPublishDrafts = vi.fn();
    const { rerender } = render(
      <ChatbotEnhanced autoPublishDrafts isLoading messages={[userMsg]} onPublishDrafts={onPublishDrafts} />,
    );
    // Even with auto-publish ON and the turn finished, an edit must not fire —
    // destructive/incremental changes go live only on explicit review.
    rerender(
      <ChatbotEnhanced autoPublishDrafts isLoading={false} messages={[userMsg, editMsg('com.workspace')]} onPublishDrafts={onPublishDrafts} />,
    );
    expect(onPublishDrafts).not.toHaveBeenCalled();
  });

  it('does not auto-publish when autoPublishDrafts is off', () => {
    const onPublishDrafts = vi.fn();
    const { rerender } = render(
      <ChatbotEnhanced isLoading messages={[userMsg]} onPublishDrafts={onPublishDrafts} />,
    );
    rerender(
      <ChatbotEnhanced isLoading={false} messages={[userMsg, draftMsg('app.todo')]} onPublishDrafts={onPublishDrafts} />,
    );
    expect(onPublishDrafts).not.toHaveBeenCalled();
  });

  it('publishes the same draft tool call at most once across re-renders', () => {
    const onPublishDrafts = vi.fn();
    const withDraft = [userMsg, draftMsg('app.todo')];
    const { rerender } = render(
      <ChatbotEnhanced autoPublishDrafts isLoading messages={[userMsg]} onPublishDrafts={onPublishDrafts} />,
    );
    rerender(<ChatbotEnhanced autoPublishDrafts isLoading={false} messages={withDraft} onPublishDrafts={onPublishDrafts} />);
    rerender(<ChatbotEnhanced autoPublishDrafts isLoading={false} messages={withDraft} onPublishDrafts={onPublishDrafts} />);
    expect(onPublishDrafts).toHaveBeenCalledTimes(1);
  });

  it('shows "Published" only on the published draft, not later edits into the same package', async () => {
    // Regression: the published badge is keyed per draft (toolCallId), not per
    // package. After a build auto-publishes com.workspace, a later edit into the
    // same package is a fresh pending draft and must still offer "Publish".
    const onPublishDrafts = vi.fn().mockResolvedValue(true);
    const { rerender } = render(
      <ChatbotEnhanced autoPublishDrafts isLoading messages={[userMsg]} onPublishDrafts={onPublishDrafts} />,
    );
    rerender(
      <ChatbotEnhanced autoPublishDrafts isLoading={false} messages={[userMsg, draftMsg('com.workspace')]} onPublishDrafts={onPublishDrafts} />,
    );
    await waitFor(() => expect(onPublishDrafts).toHaveBeenCalledTimes(1));
    await screen.findByText('Published'); // the build card flips to published
    // A later incremental edit into the SAME package — still pending.
    rerender(
      <ChatbotEnhanced autoPublishDrafts isLoading={false} messages={[userMsg, draftMsg('com.workspace'), editMsg('com.workspace')]} onPublishDrafts={onPublishDrafts} />,
    );
    expect(screen.getAllByText('Published')).toHaveLength(1); // only the build card
    expect(screen.getByText('Publish')).toBeInTheDocument(); // the edit card still needs publishing
  });

  it('auto-publishes a SECOND build into the SAME package (distinct tool call)', () => {
    // Regression: dedup must be per draft tool call, not per packageId — both
    // builds target com.workspace; keying by packageId would skip the second.
    const onPublishDrafts = vi.fn();
    const build = (callId: string, name: string): ChatMessage => ({
      id: 'a-' + callId,
      role: 'assistant',
      content: 'built',
      toolInvocations: [
        {
          toolCallId: callId,
          toolName: 'apply_blueprint',
          state: 'output-available',
          draftReview: { items: [{ type: 'object', name }], packageId: 'com.workspace', autoPublishable: true },
        },
      ],
    });
    const { rerender } = render(
      <ChatbotEnhanced autoPublishDrafts isLoading messages={[userMsg]} onPublishDrafts={onPublishDrafts} />,
    );
    rerender(
      <ChatbotEnhanced autoPublishDrafts isLoading={false} messages={[userMsg, build('tc1', 'task')]} onPublishDrafts={onPublishDrafts} />,
    );
    expect(onPublishDrafts).toHaveBeenCalledTimes(1);
    // Second build into the same workspace package, new tool call → fires again.
    rerender(
      <ChatbotEnhanced autoPublishDrafts isLoading={false} messages={[userMsg, build('tc1', 'task'), build('tc2', 'customer')]} onPublishDrafts={onPublishDrafts} />,
    );
    expect(onPublishDrafts).toHaveBeenCalledTimes(2);
    expect(onPublishDrafts).toHaveBeenLastCalledWith('com.workspace');
  });
});

describe('ChatbotEnhanced — streaming build preview (live build tree)', () => {
  const buildMsg = (phase: 'structure' | 'data' | 'done'): ChatMessage => ({
    id: 'a1',
    role: 'assistant',
    content: '',
    streaming: phase !== 'done',
    buildProgress: {
      phase,
      appLabel: 'CRM',
      items: [
        { type: 'object', name: 'customer' },
        { type: 'view', name: 'customer.list' },
        { type: 'seed', name: 'customer_sample' },
      ],
      done: 3,
      total: 6,
    },
  });

  it('renders a live build tree (not thinking dots) while a build streams', () => {
    render(<ChatbotEnhanced isLoading messages={[buildMsg('data')]} />);
    expect(screen.getByTestId('build-progress')).toBeInTheDocument();
    expect(screen.getByText(/Building CRM/i)).toBeInTheDocument();
    // Artifacts are grouped by type with friendly labels.
    expect(screen.getByText('Objects')).toBeInTheDocument();
    expect(screen.getByText('Views')).toBeInTheDocument();
    expect(screen.getByText('Sample data')).toBeInTheDocument();
    // The artifact names render (seeds without the _sample suffix).
    expect(screen.getAllByText(/customer/).length).toBeGreaterThan(0);
  });

  it('collapses to a "Built" summary when the build is done', () => {
    render(<ChatbotEnhanced messages={[buildMsg('done')]} />);
    expect(screen.getByText(/Built CRM/i)).toBeInTheDocument();
  });

  it('offers "Open app" on a finished build that created an app, wired to onOpenBuiltApp', () => {
    const onOpenBuiltApp = vi.fn();
    const doneWithApp: ChatMessage = {
      ...buildMsg('done'),
      buildProgress: {
        ...buildMsg('done').buildProgress!,
        items: [...buildMsg('done').buildProgress!.items, { type: 'app', name: 'crm' }],
      },
    };
    render(<ChatbotEnhanced messages={[doneWithApp]} onOpenBuiltApp={onOpenBuiltApp} />);
    const btn = screen.getByTestId('build-progress-open-app');
    fireEvent.click(btn);
    expect(onOpenBuiltApp).toHaveBeenCalledWith('crm');
  });

  it('shows no Open-app action while streaming or without an app artifact', () => {
    const onOpenBuiltApp = vi.fn();
    const { rerender } = render(
      <ChatbotEnhanced isLoading messages={[buildMsg('data')]} onOpenBuiltApp={onOpenBuiltApp} />,
    );
    expect(screen.queryByTestId('build-progress-open-app')).not.toBeInTheDocument();
    // Done but no `app` item → still no button (nothing to open).
    rerender(<ChatbotEnhanced messages={[buildMsg('done')]} onOpenBuiltApp={onOpenBuiltApp} />);
    expect(screen.queryByTestId('build-progress-open-app')).not.toBeInTheDocument();
  });
});

/**
 * ADR-0038 L3 — the build-health line under a Published card: the host's
 * onPublishDrafts may return `{ ok, health }` (seedApplied + runtime probes)
 * and the chat must show what the publish ACTUALLY did, not just "Published".
 */
describe('ChatbotEnhanced — publish build-health line (ADR-0038)', () => {
  const userMsg: ChatMessage = { id: 'u1', role: 'user', content: 'build it' };
  const draftMsg = (packageId: string): ChatMessage => ({
    id: 'a1',
    role: 'assistant',
    content: 'Built your app.',
    toolInvocations: [
      {
        toolCallId: 'tc-health',
        toolName: 'apply_blueprint',
        state: 'output-available',
        draftReview: { items: [{ type: 'object', name: 'task' }], packageId, autoPublishable: true },
      },
    ],
  });

  it('renders rows-seeded + verified counts and runtime issues from a structured outcome', async () => {
    const onPublishDrafts = vi.fn().mockResolvedValue({
      ok: true,
      health: {
        seededRows: 12,
        checked: { seeds: 2, views: 3, widgets: 4 },
        issues: [
          { severity: 'error', code: 'empty_query', message: 'widget "w1" returns NO data' },
          { severity: 'warning', code: 'probes_unavailable', message: '1 widget not probed' },
        ],
      },
    });
    const { rerender } = render(
      <ChatbotEnhanced autoPublishDrafts isLoading messages={[userMsg]} onPublishDrafts={onPublishDrafts} />,
    );
    rerender(
      <ChatbotEnhanced autoPublishDrafts isLoading={false} messages={[userMsg, draftMsg('app.todo')]} onPublishDrafts={onPublishDrafts} />,
    );
    await waitFor(() => expect(screen.getByTestId('publish-health')).toBeInTheDocument());
    expect(screen.getByText(/12 sample rows live/i)).toBeInTheDocument();
    // Errors present → the "verified" claim is withheld; the findings show instead.
    expect(screen.queryByText(/verified/i)).not.toBeInTheDocument();
    expect(screen.getByText(/returns NO data/i)).toBeInTheDocument();
    expect(screen.getByText(/not probed/i)).toBeInTheDocument();
  });

  it('claims "verified" only when the probes ran clean', async () => {
    const onPublishDrafts = vi.fn().mockResolvedValue({
      ok: true,
      health: { seededRows: 6, checked: { seeds: 1, views: 2, widgets: 3 }, issues: [] },
    });
    const { rerender } = render(
      <ChatbotEnhanced autoPublishDrafts isLoading messages={[userMsg]} onPublishDrafts={onPublishDrafts} />,
    );
    rerender(
      <ChatbotEnhanced autoPublishDrafts isLoading={false} messages={[userMsg, draftMsg('app.todo')]} onPublishDrafts={onPublishDrafts} />,
    );
    await waitFor(() => expect(screen.getByTestId('publish-health')).toBeInTheDocument());
    expect(screen.getByText(/6 sample rows live · 2 views · 3 widgets · 1 seed verified/i)).toBeInTheDocument();
  });

  it('renders the seed-load failure loudly', async () => {
    const onPublishDrafts = vi.fn().mockResolvedValue({
      ok: true,
      health: { seedError: 'no readable seed bodies' },
    });
    const { rerender } = render(
      <ChatbotEnhanced autoPublishDrafts isLoading messages={[userMsg]} onPublishDrafts={onPublishDrafts} />,
    );
    rerender(
      <ChatbotEnhanced autoPublishDrafts isLoading={false} messages={[userMsg, draftMsg('app.todo')]} onPublishDrafts={onPublishDrafts} />,
    );
    await waitFor(() => expect(screen.getByTestId('publish-health')).toBeInTheDocument());
    expect(screen.getByText(/no readable seed bodies/i)).toBeInTheDocument();
  });

  it('stays silent (no health element) for legacy boolean outcomes', async () => {
    const onPublishDrafts = vi.fn().mockResolvedValue(true);
    const { rerender } = render(
      <ChatbotEnhanced autoPublishDrafts isLoading messages={[userMsg]} onPublishDrafts={onPublishDrafts} />,
    );
    rerender(
      <ChatbotEnhanced autoPublishDrafts isLoading={false} messages={[userMsg, draftMsg('app.todo')]} onPublishDrafts={onPublishDrafts} />,
    );
    // Publish resolves → Published badge, but no health line.
    await waitFor(() => expect(screen.getByText('Published')).toBeInTheDocument());
    expect(screen.queryByTestId('publish-health')).not.toBeInTheDocument();
  });

  it('treats {ok:false} as failure — no Published badge', async () => {
    const onPublishDrafts = vi.fn().mockResolvedValue({ ok: false });
    const { rerender } = render(
      <ChatbotEnhanced autoPublishDrafts isLoading messages={[userMsg]} onPublishDrafts={onPublishDrafts} />,
    );
    rerender(
      <ChatbotEnhanced autoPublishDrafts isLoading={false} messages={[userMsg, draftMsg('app.todo')]} onPublishDrafts={onPublishDrafts} />,
    );
    await waitFor(() => expect(onPublishDrafts).toHaveBeenCalled());
    expect(screen.queryByText('Published')).not.toBeInTheDocument();
  });
});

describe('publishHealthFromResponse', () => {
  it('maps seedApplied + probes through the {success,data} envelope', async () => {
    const { publishHealthFromResponse } = await import('../ChatbotEnhanced');
    const health = publishHealthFromResponse({
      success: true,
      data: {
        seedApplied: { success: true, inserted: 10, updated: 2 },
        probes: {
          checked: { seeds: 2, views: 1, widgets: 3 },
          issues: [{ severity: 'error', code: 'empty_query', message: 'm' }],
        },
      },
    });
    expect(health).toEqual({
      seededRows: 12,
      checked: { seeds: 2, views: 1, widgets: 3 },
      issues: [{ severity: 'error', code: 'empty_query', message: 'm' }],
    });
  });

  it('maps a failed seedApplied to seedError and tolerates a flat body', async () => {
    const { publishHealthFromResponse } = await import('../ChatbotEnhanced');
    const health = publishHealthFromResponse({
      seedApplied: { success: false, errors: ['row 3 rejected'] },
    });
    expect(health).toEqual({ seedError: 'row 3 rejected' });
  });

  it('returns undefined when the server reported neither (older runtimes)', async () => {
    const { publishHealthFromResponse } = await import('../ChatbotEnhanced');
    expect(publishHealthFromResponse({ success: true, data: { publishedCount: 3 } })).toBeUndefined();
  });
});

describe('ChatbotEnhanced — elapsed-time liveness counter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('ticks a m:ss counter on the thinking spinner so a slow turn reads as alive', () => {
    render(<ChatbotEnhanced isLoading messages={[]} />);
    // Mount renders 0:00 immediately…
    expect(screen.getByText('0:00')).toBeInTheDocument();
    // …then advances once a second while the turn is in flight.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('0:03')).toBeInTheDocument();
  });

  it('shows a running counter on an in-flight build panel and freezes it when done', () => {
    const building: ChatMessage[] = [
      {
        id: 'b1',
        role: 'assistant',
        content: '',
        buildProgress: {
          phase: 'structure',
          appLabel: '进销存',
          items: [{ type: 'object', name: 'product' }],
          done: 1,
          total: 4,
        },
      },
    ];
    const { rerender } = render(<ChatbotEnhanced messages={building} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('0:02')).toBeInTheDocument();

    // Build finishes → counter freezes at its last value (no further ticks).
    const done: ChatMessage[] = [
      { ...building[0], buildProgress: { ...building[0].buildProgress!, phase: 'done', done: 4 } },
    ];
    rerender(<ChatbotEnhanced messages={done} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('0:02')).toBeInTheDocument();
  });
});
