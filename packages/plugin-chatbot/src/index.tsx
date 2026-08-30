/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import { cn } from "@object-ui/components"
import { Button, Input, ScrollArea, Avatar, AvatarFallback, AvatarImage } from "@object-ui/components"
import { Send } from "lucide-react"
// The package's single chat message contract. A SECOND, minimal `ChatMessage`
// used to be declared right here and exported from this barrel under the
// natural name; it is retired — see the documented re-export at the bottom of
// this file (objectui#4383).
import type { ChatMessage } from "./ChatbotEnhanced"

// Chatbot container props
export interface ChatbotProps extends React.HTMLAttributes<HTMLDivElement> {
  messages?: ChatMessage[]
  placeholder?: string
  onSendMessage?: (message: string) => void
  disabled?: boolean
  showTimestamp?: boolean
  userAvatarUrl?: string
  userAvatarFallback?: string
  assistantAvatarUrl?: string
  assistantAvatarFallback?: string
  maxHeight?: string
}

// Chatbot container component
const Chatbot = React.forwardRef<HTMLDivElement, ChatbotProps>(
  (
    {
      className,
      messages = [],
      placeholder = "Type your message...",
      onSendMessage,
      disabled = false,
      showTimestamp = false,
      userAvatarUrl,
      userAvatarFallback = "You",
      assistantAvatarUrl,
      assistantAvatarFallback = "AI",
      maxHeight = "500px",
      ...props
    },
    ref
  ) => {
    const [inputValue, setInputValue] = React.useState("")
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)

    // Auto-scroll to bottom when new messages arrive
    React.useEffect(() => {
      if (scrollRef.current) {
        const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollElement) {
          scrollElement.scrollTop = scrollElement.scrollHeight
        }
      }
    }, [messages])

    const handleSend = () => {
      if (inputValue.trim() && onSendMessage) {
        onSendMessage(inputValue.trim())
        setInputValue("")
        inputRef.current?.focus()
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col border rounded-lg bg-background overflow-hidden",
          className
        )}
        style={{ maxHeight }}
        {...props}
      >
        {/* Messages area */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No messages yet. Start a conversation!
              </div>
            ) : (
              messages.map((message) => (
                <ChatMessageItem
                  key={message.id}
                  message={message}
                  showTimestamp={showTimestamp}
                  userAvatarUrl={userAvatarUrl}
                  userAvatarFallback={userAvatarFallback}
                  assistantAvatarUrl={assistantAvatarUrl}
                  assistantAvatarFallback={assistantAvatarFallback}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={disabled || !inputValue.trim()}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }
)
Chatbot.displayName = "Chatbot"

// Individual message component
export interface ChatMessageProps {
  message: ChatMessage
  showTimestamp?: boolean
  userAvatarUrl?: string
  userAvatarFallback?: string
  assistantAvatarUrl?: string
  assistantAvatarFallback?: string
}

const ChatMessageItem: React.FC<ChatMessageProps> = ({
  message,
  showTimestamp,
  userAvatarUrl,
  userAvatarFallback,
  assistantAvatarUrl,
  assistantAvatarFallback,
}) => {
  const isUser = message.role === "user"
  const isSystem = message.role === "system"

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </div>
      </div>
    )
  }

  const avatar = isUser 
    ? (message.avatar || userAvatarUrl)
    : (message.avatar || assistantAvatarUrl)
  
  const avatarFallback = isUser
    ? (message.avatarFallback || userAvatarFallback)
    : (message.avatarFallback || assistantAvatarFallback)

  return (
    <div
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={avatar} />
        <AvatarFallback className="text-xs">{avatarFallback}</AvatarFallback>
      </Avatar>

      <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-lg px-4 py-2 max-w-[70%] break-words",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        {showTimestamp && message.timestamp && (
          <span className="text-xs text-muted-foreground">
            {message.timestamp}
          </span>
        )}
      </div>
    </div>
  )
}

// Typing indicator component
export interface TypingIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  avatarSrc?: string
  avatarFallback?: string
}

const TypingIndicator = React.forwardRef<HTMLDivElement, TypingIndicatorProps>(
  ({ className, avatarSrc, avatarFallback = "AI", ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex gap-3", className)} {...props}>
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarSrc} />
          <AvatarFallback className="text-xs">{avatarFallback}</AvatarFallback>
        </Avatar>
        <div className="flex items-center bg-muted rounded-lg px-4 py-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></span>
          </div>
        </div>
      </div>
    )
  }
)
TypingIndicator.displayName = "TypingIndicator"

export { Chatbot, TypingIndicator }

// Export the composable chat hook for custom integrations
export { useObjectChat } from './useObjectChat';
export type { UseObjectChatOptions, UseObjectChatReturn } from './useObjectChat';
/**
 * What `useObjectChat` emits from `messages` and `onSend` — neither the
 * `@object-ui/types` AUTHORING contract (which the hook used to declare while
 * API mode cast RUNTIME values into it) nor the runtime one (which would be a
 * lie about local mode's authored `'tool'` role and legacy tool states). See
 * the type's own doc for the survey that decided it (objectui#4424).
 */
export type { ObjectChatMessage } from './useObjectChat';
// ADR-0057 #8 — the AI-usage-indicator refresh seam (emitted on turn-finish / 429).
export { AI_USAGE_REFRESH_EVENT, emitAiUsageRefresh } from './useObjectChat';

// Export the agent catalog hook (talks to @objectstack/service-ai)
export { useAgents, resolveDefaultAgentName, PLATFORM_DEFAULT_AGENT, agentHasCapability } from './useAgents';
export type {
  UseAgentsOptions,
  UseAgentsReturn,
  AgentDescriptor,
  AgentCapabilities,
} from './useAgents';

// Export the AI-model picker allowlist hook (ADR-0028; GET /api/v1/ai/models).
export { useAiModels } from './useAiModels';
export type { UseAiModelsOptions, UseAiModelsReturn } from './useAiModels';

// Agent alias resolution — friendly console routes (`/ai/build`, `/ai/ask`) ↔
// built-in agent ids, robust across the Path A rename.
export {
  AGENT_ALIAS_GROUPS,
  agentAliasGroup,
  agentRouteName,
  resolveAgentParam,
  isBuiltinAgentName,
  isBuildAgent,
  isAskAgent,
} from './agentAliases';

// Export floating chatbot components
export { FloatingChatbot } from './FloatingChatbot';
export type { FloatingChatbotProps } from './FloatingChatbot';
export { FloatingChatbotProvider, useFloatingChatbot } from './FloatingChatbotProvider';
export type {
  FloatingChatbotProviderProps,
  FloatingChatbotState,
  FloatingChatbotActions,
  FloatingChatbotContextValue,
} from './FloatingChatbotProvider';
export { FloatingChatbotTrigger } from './FloatingChatbotTrigger';
export type { FloatingChatbotTriggerProps } from './FloatingChatbotTrigger';
export { FloatingChatbotPanel } from './FloatingChatbotPanel';
export type { FloatingChatbotPanelProps } from './FloatingChatbotPanel';

// Export renderer to register the component with ObjectUI
export * from './renderer';

// Shared composition layer over the vendored AI Elements (used by both
// Studio's sidebar panel and Console's floating chatbot).
export { ChatbotEnhanced, publishHealthFromResponse } from './ChatbotEnhanced';
export type {
  ChatbotEnhancedProps,
  ChatToolInvocation as ChatbotEnhancedToolInvocation,
  ChatSource as ChatbotEnhancedSource,
  ChatbotLabels,
  ToolDecisionState,
  PublishHealth,
  PublishOutcome,
} from './ChatbotEnhanced';

/**
 * The chat message contract of `@object-ui/plugin-chatbot` — the shape
 * `<ChatbotEnhanced>` renders and `uiMessagesToChatMessages()` produces.
 *
 * This barrel used to DECLARE a second, minimal `ChatMessage` of its own
 * (`id`/`role`/`content`/`timestamp`/`avatar`/`avatarFallback` only) while the
 * enhanced shape was re-exported from the same module under the alias
 * `ChatbotEnhancedMessage`. One natural name, two contracts: an importer who
 * reached for `ChatMessage` silently got the narrow one, and the mismatch
 * compiled because every construction site spreads the extra keys
 * conditionally (`...(x ? { toolInvocations } : {})`), which defeats
 * excess-property checking — so the declared type was narrower than every
 * value flowing through it (objectui#4040; corrected for app-shell's
 * `AiChatPage` in PR #4379, but the barrel itself was left as-is).
 *
 * The minimal declaration is retired rather than renamed: nothing produced it,
 * no importer asked for it, and every field it had is present with the same
 * type on the enhanced shape, which adds only OPTIONAL keys on top. So
 * `ChatMessage` now denotes one contract everywhere in this package
 * (objectui#4383). Pinned at compile time in
 * `__tests__/chat-message-contract.test.ts`.
 *
 * `<Chatbot>` renders only the core fields; the enhanced surface (tool calls,
 * reasoning, sources, build progress, charts) is `<ChatbotEnhanced>`.
 */
export type { ChatMessage } from './ChatbotEnhanced';

/**
 * @deprecated Use `ChatMessage`. This alias now denotes the SAME type — it is
 * kept only so importers that spelled the disambiguating name while the barrel
 * still carried two shapes (e.g. app-shell's `AiChatPage`, PR #4379) keep
 * compiling. New code should import `ChatMessage` (objectui#4383).
 */
export type { ChatMessage as ChatbotEnhancedMessage } from './ChatbotEnhanced';

// Re-export the vendored Vercel AI Elements (MIT, src/elements/) so app
// authors who want to compose their own chat surface don't have to reach
// into deep paths. Wrappers (e.g. ConsoleFloatingChatbot) should consume
// these instead of dropping back to the legacy primitives.
export * as AIElements from './elements';

// UIMessage (AI SDK v6) → ChatMessage adapter. Apps that hold raw
// `useChat` state can convert it to the shape `<ChatbotEnhanced>` expects.
export {
  uiMessageToChatMessage,
  uiMessagesToChatMessages,
  detectDraftResult,
  detectProposedPlan,
  detectBuilderHandoff,
  detectRecordHandoff,
  detectProposedChanges,
  detectReplayOutcome,
  detectAuthoringVerdict,
  detectBuiltAppPackage,
  buildProgressFromDraftReview,
} from './mapMessages';
export type {
  DraftReview,
  ProposedPlan,
  BuilderHandoff,
  ProposedChanges,
  ReplayOutcome,
} from './mapMessages';

// `@object-ui/types` ChatMessage (the JSON/SDUI AUTHORING contract) → the
// runtime `ChatMessage` above. Exported for the same reason as the mappers on
// the line before: a host that holds authored messages and renders these
// components hits the drift (`role: 'tool'`, `timestamp: Date`, legacy tool
// states) and would otherwise reach for `as any` — which is exactly the defect
// objectui#4399 removed from this package's own three renderers. Every
// narrowing decision it makes is documented in `chatMessageAdapter.ts`.
export {
  authoredToRuntimeMessage,
  toRuntimeMessages,
  toRuntimeRole,
  toRuntimeTimestamp,
  toRuntimeToolInvocation,
  toRuntimeToolState,
} from './chatMessageAdapter';

/**
 * The seam's INPUT contract: the authoring shape widened by the render-only
 * keys an API-mode value already carries. A host converting its own messages
 * with `toRuntimeMessages` never needs to name this — `ChatMessage` from
 * `@object-ui/types` is assignable to it — but a host that HOLDS such values
 * (having driven `useChat` itself, say) can now say so instead of casting
 * (objectui#4424).
 */
export type { SeamChatMessage, SeamToolInvocation } from './chatMessageAdapter';

// Display helpers used internally by ChatbotEnhanced. Exported so app
// authors composing their own chat surface get the same pretty tool-call
// rendering and friendly error summaries for free.
export {
  humanizeToolName,
  unwrapToolResult,
  summarizeChatError,
} from './tool-display';

// HITL (Human-In-The-Loop) pending-actions inbox. Talks to
// `@objectstack/service-ai` at `/api/v1/ai/pending-actions/*`. Shared
// between Console's workspace inbox page and Studio's assistant
// builder panel.
export { usePendingActions } from './usePendingActions';
export type {
  UsePendingActionsOptions,
  UsePendingActionsReturn,
  PendingActionRow,
  PendingActionStatus,
  ApproveOutcome,
  RejectOutcome,
} from './usePendingActions';
export { AiPendingActionsInbox } from './AiPendingActionsInbox';
export type { AiPendingActionsInboxProps } from './AiPendingActionsInbox';

// Inline HITL bridge for the chat surface. Indexes pending-action ids
// produced by the framework's tool result envelope and wires the inline
// approve / reject buttons to the REST endpoints above.
export { useHitlInChat } from './useHitlInChat';
export type {
  UseHitlInChatOptions,
  UseHitlInChatReturn,
  ContinueContext,
} from './useHitlInChat';
