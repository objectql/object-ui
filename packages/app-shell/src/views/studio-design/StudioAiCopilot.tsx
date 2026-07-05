// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import React from 'react';
import { useAuth } from '@object-ui/auth';
import { Button } from '@object-ui/components';
import { Sparkles, PanelLeftClose } from 'lucide-react';
import { useAgents, resolveDefaultAgentName, isBuildAgent } from '@object-ui/plugin-chatbot';
import { useChatConversation } from '../../hooks/useChatConversation';
import { ChatPane, resolveApiBase, type PendingFirstMessage } from '../../console/ai/AiChatPage';

export interface StudioAiCopilotProps {
  /** The package the Studio surface is editing — scopes the build agent to it. */
  packageId: string;
  /** UI locale (from the Studio surface) for the panel chrome. */
  locale?: string;
}

/**
 * The Studio design surface's left AI copilot (ADR-0080 `aiSlot`). It embeds the
 * SAME build-agent chat as the full-page `/ai/build` surface (ChatPane), but
 * scoped to the package the user is designing (`editPackageId`), so "add a field
 * / add a view / add an automation" acts on THIS app without leaving the design
 * surface — the iterate copilot ADR-0080 calls for.
 *
 * Open-core: the chat UI ships in OSS app-shell but is INERT without a served
 * agent. We gate on the live agent catalog (`useAgents`) — an env that serves a
 * `build` agent (the cloud AI Studio) lights the copilot up; a community env
 * with no agent renders nothing, leaving the plain three-zone surface. Same
 * "cloud fills it" contract as the floating chat FAB, with no injected prop
 * threaded through the console.
 */
export function StudioAiCopilot({ packageId, locale }: StudioAiCopilotProps): React.ReactElement | null {
  const zh = (locale ?? '').toLowerCase().startsWith('zh');
  const { user } = useAuth();
  const userId = user?.id;
  const apiBase = React.useMemo(() => resolveApiBase(), []);
  const [collapsed, setCollapsed] = React.useState(false);

  const { agents, isLoading: agentsLoading, error: agentsError } = useAgents({ apiBase });

  // Prefer the build agent (metadata authoring); fall back to the platform default.
  const activeAgent = React.useMemo(() => {
    if (agents.length === 0) return undefined;
    const build = agents.find((a) => isBuildAgent(a.name));
    return build?.name ?? resolveDefaultAgentName(agents, undefined);
  }, [agents]);

  const chatApi = activeAgent
    ? `${apiBase}/agents/${encodeURIComponent(activeAgent)}/chat`
    : undefined;

  // One durable conversation per (user, package, agent) — reopening Studio on the
  // same app resumes the same design chat.
  const { conversationId, initialMessages } = useChatConversation({
    userId: activeAgent ? userId : undefined,
    scope: activeAgent ? `studio:${packageId}:${activeAgent}` : undefined,
    apiBase,
    activeId: undefined,
    forceNew: false,
  });

  const pendingFirstMessageRef = React.useRef<PendingFirstMessage | null>(null);

  // No agent served (community edition / misconfigured) → no copilot, plain surface.
  if (!agentsLoading && agents.length === 0) return null;

  if (collapsed) {
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center gap-2 border-r bg-muted/40 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          title={zh ? '展开 AI 副驾' : 'Expand AI copilot'}
          aria-label={zh ? '展开 AI 副驾' : 'Expand AI copilot'}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </aside>
    );
  }

  return (
    <aside className="flex w-96 shrink-0 flex-col overflow-hidden border-r bg-muted/30">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          {zh ? 'AI 副驾' : 'AI copilot'}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(true)}
          title={zh ? '收起' : 'Collapse'}
          aria-label={zh ? '收起 AI 副驾' : 'Collapse AI copilot'}
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <ChatPane
          key={`${chatApi ?? 'local'}:${conversationId ?? 'pending'}`}
          agents={agents}
          agentsLoading={agentsLoading}
          agentsError={agentsError}
          activeAgent={activeAgent}
          chatApi={chatApi}
          apiBase={apiBase}
          conversationId={conversationId}
          editPackageId={packageId}
          initialMessages={initialMessages}
          pendingFirstMessageRef={pendingFirstMessageRef}
          onSent={() => {}}
          onShare={() => {}}
          showDebug={false}
        />
      </div>
    </aside>
  );
}
