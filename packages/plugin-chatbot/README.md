# @object-ui/plugin-chatbot

Chatbot interface plugin for Object UI with full AI SDUI support, built on
[Vercel AI Elements](https://elements.ai-sdk.dev) (MIT) and
[shadcn/ui](https://ui.shadcn.com) (MIT).

> Why AI Elements? They give us a production-grade, shadcn-style chat
> surface — conversation, message bubbles, streaming reasoning, tool calls,
> sources, code blocks, suggestions — that already matches our Tailwind 4
> design tokens. We vendor them into `src/elements/` so we can ship without a
> network dep, and we wrap them inside `ChatbotEnhanced` to keep the public
> ObjectUI prop API stable. See [Architecture](#architecture) below.

## Installation

```bash
npm install @object-ui/plugin-chatbot
```

## Usage

### Basic (Local/Demo Mode)

```tsx
import { Chatbot } from '@object-ui/plugin-chatbot';

function App() {
  const [messages, setMessages] = useState([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! How can I help you today?'
    }
  ]);

  const handleSend = (content: string) => {
    const newMessage = {
      id: Date.now().toString(),
      role: 'user',
      content
    };
    setMessages([...messages, newMessage]);
  };

  return (
    <Chatbot
      messages={messages}
      onSendMessage={handleSend}
      placeholder="Type your message..."
    />
  );
}
```

### AI Streaming Mode (service-ai)

When `api` is set in the schema, the chatbot connects to a backend SSE endpoint
using `@ai-sdk/react` v4 (Vercel UI Message Stream protocol) for streaming,
tool-calling, and production-grade chat:

```tsx
import '@object-ui/plugin-chatbot';

const schema = {
  type: 'chatbot',
  api: '/api/v1/ai/chat',
  model: 'gpt-4o',
  systemPrompt: 'You are a helpful assistant.',
  streamingEnabled: true,
  conversationId: 'conv-123',
  messages: [
    { id: '1', role: 'assistant', content: 'Hello! Ask me anything.' }
  ],
  placeholder: 'Type your message...',
};
```

### Using the `useObjectChat` Hook

For custom integrations, you can use the `useObjectChat` hook directly:

```tsx
import { useObjectChat } from '@object-ui/plugin-chatbot';

function MyChat() {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    stop,
    reload,
    clear,
    isApiMode,
  } = useObjectChat({
    api: '/api/v1/ai/chat',
    model: 'gpt-4o',
    systemPrompt: 'You are helpful.',
  });

  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      {isLoading && <button onClick={stop}>Stop</button>}
      {error && <button onClick={reload}>Retry</button>}
    </div>
  );
}
```

## Schema-Driven Usage

### Discovering Backend Agents

Use `useAgents` to fetch the list of agents exposed by `@objectstack/service-ai`
at `GET {apiBase}/agents`. This is what the global console FAB uses to populate
its in-header agent picker:

```tsx
import { useAgents } from '@object-ui/plugin-chatbot';

function AgentPicker() {
  const { agents, isLoading, error } = useAgents({
    apiBase: 'http://localhost:3000/api/v1/ai',
    // Optional fallback list shown when the backend is unreachable
    fallback: [{ name: 'data_chat', label: 'Data Chat' }],
  });

  if (isLoading) return <span>Loading agents…</span>;
  if (error) return <span>Backend unreachable</span>;

  return (
    <select>
      {agents.map(a => (
        <option key={a.name} value={a.name}>{a.label}</option>
      ))}
    </select>
  );
}
```

Each agent's chat endpoint is `POST {apiBase}/agents/{name}/chat` — pass that
URL as the `api` option to `useObjectChat` to talk to it.

### Console Integration

The console (`@object-ui/app-shell`) auto-mounts a global floating chatbot
when `useDiscovery().isAiEnabled` is true. Configure the backend in your
console `.env`:

```bash
# AI service endpoint (defaults to ${VITE_SERVER_URL}/api/v1/ai when unset)
VITE_AI_BASE_URL=http://localhost:3000/api/v1/ai
# Default agent to select on first open (must match an agent name returned
# by GET ${VITE_AI_BASE_URL}/agents)
VITE_AI_DEFAULT_AGENT=sales_copilot
```

The picker lets the user switch agents at runtime; switching transparently
remounts the chat hook against the new agent's `/chat` endpoint.

The floating panel is responsive by default. On desktop it uses the configured
`panelWidth` / `panelHeight`; on narrow browser viewports it expands between
safe side gutters, stays above the mobile bottom navigation area, and hides the
FAB while open so the close button in the panel header is the only active
dismiss control.

During a conversation, the chat surface renders an inline assistant responding
indicator while the backend is streaming, keeps message actions quiet until
hover/focus, and summarizes backend failures into a compact retryable notice
with optional technical details. The prompt submit control also becomes a
dedicated stop button while a response is in progress.

This plugin automatically registers with ObjectUI's component registry when imported:

```tsx
import '@object-ui/plugin-chatbot';

// Local/demo mode
const demoSchema = {
  type: 'chatbot',
  messages: [
    { id: '1', role: 'assistant', content: 'Hello!' }
  ],
  placeholder: 'Type your message...',
  autoResponse: true,
};

// AI streaming mode
const aiSchema = {
  type: 'chatbot',
  api: '/api/v1/ai/chat',
  model: 'gpt-4o',
  systemPrompt: 'You are a helpful assistant.',
  streamingEnabled: true,
  messages: [],
  placeholder: 'Ask the AI...',
};
```

## Two Operating Modes

| Feature | Local/Demo Mode | AI Streaming Mode |
|---------|----------------|-------------------|
| `api` | Not set | Set to SSE endpoint |
| Responses | Auto-response (configurable) | Real AI streaming via SSE |
| Streaming | Simulated | Full SSE streaming |
| Tool calling | N/A | Supported via vercel/ai |
| Stop/Reload | Stop cancels timer | Stop interrupts stream |
| Backend | None required | service-ai (IAIService) |

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-chatbot)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-chatbot)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## Architecture

Internally the chatbot is composed from three layers:

```
┌─────────────────────────────────────────────────────┐
│  ChatbotEnhanced (public surface, stable props)     │
│  ├─ Conversation / Message  (AI Elements)           │
│  ├─ PromptInput  (AI Elements)                      │
│  └─ Suggestion / Reasoning / Tool  (AI Elements)    │
├─────────────────────────────────────────────────────┤
│  src/elements/                                      │
│  Vendored Vercel AI Elements + missing shadcn       │
│  primitives (button-group, input-group). Rewritten  │
│  to import from `@object-ui/components`. Do NOT     │
│  edit — re-sync from registry.ai-sdk.dev.           │
├─────────────────────────────────────────────────────┤
│  @object-ui/components (shadcn + Tailwind 4)        │
└─────────────────────────────────────────────────────┘
```

The vendored components are also re-exported under a namespace for advanced
users who want to compose their own chat surface:

```tsx
import { AIElements } from '@object-ui/plugin-chatbot';

<AIElements.Conversation>
  <AIElements.ConversationContent>
    <AIElements.Message from="assistant">
      <AIElements.MessageContent>Hello.</AIElements.MessageContent>
    </AIElements.Message>
  </AIElements.ConversationContent>
</AIElements.Conversation>;
```

### Message mapping helpers

If you wire `@ai-sdk/react`'s `useChat()` directly and want to render its
`UIMessage[]` with `<ChatbotEnhanced>`, use the exported mappers instead
of writing your own — they handle `parts: [{ type: 'text' | 'reasoning'
| 'tool-*' | 'source-*' }]`, the streaming-cursor flag, and the legacy
`msg.toolInvocations` fallback:

```tsx
import { useChat } from '@ai-sdk/react';
import {
  ChatbotEnhanced,
  uiMessagesToChatMessages,
} from '@object-ui/plugin-chatbot';

function MyChat() {
  const { messages, status } = useChat({ api: '/api/chat' });
  const isStreaming = status === 'streaming' || status === 'submitted';
  return (
    <ChatbotEnhanced
      messages={uiMessagesToChatMessages(messages, { isStreaming })}
      onSend={/* … */}
    />
  );
}
```

`uiMessageToChatMessage(msg, { streaming })` is the single-message
variant. Both are also used internally by `useObjectChat`, so the
mapping logic stays consistent across direct and managed usage.

### Surface chrome

`ChatbotEnhanced` defaults to `surface="card"`, which keeps the bordered panel
chrome suitable for dashboards, sidebars, and floating chat windows. Full-page
chat routes can use `surface="plain"` to remove the outer panel border and let
messages, controls, and the prompt input sit in a continuous workspace:

```tsx
<ChatbotEnhanced
  messages={messages}
  surface="plain"
  hideClearBar
/>
```

### Agent process visibility

`ChatbotEnhanced` defaults to an end-user friendly agent process view. Tool
calls are grouped into a compact activity summary, repeated calls collapse into
one row, raw tool names are hidden, and reasoning text is not rendered. This
keeps the final answer as the primary reading target while still showing that
the assistant is doing work.

Use `processVisibility="debug"` for developer or admin trace surfaces that need
the full reasoning panel, raw tool names, tool parameters, and tool results:

```tsx
<ChatbotEnhanced
  messages={messages}
  processVisibility="debug"
/>
```

Use `processVisibility="hidden"` when a host wants to suppress non-interactive
agent activity entirely. Human-in-the-loop approvals and draft review actions
remain visible so users can still complete required decisions.

Console hosts also keep a sanitized browser-side display cache for the active
conversation. If the backend conversation record is available but returns no
message rows on refresh, the UI can restore user/assistant text plus grouped
tool names and states. The cache intentionally omits reasoning, tool
parameters, and raw tool results.

## Bundle considerations

This package depends on `streamdown`, `shiki`, `mermaid`, and `katex`
for code/markdown rendering. Together they weigh ~20 MB minified.

In host apps that don't always show the chat panel (e.g. Console's
opt-in AI sidebar), import this package via `React.lazy` so the heavy
chunks only download when the panel actually opens. See
`packages/app-shell/src/layout/ConsoleFloatingChatbot.tsx` for the
reference lazy-load pattern, and `apps/console/vite.config.ts` for the
`manualChunks` rules that keep the chat-only deps in dedicated,
lazy-loadable chunks.

## License

MIT © ObjectStack Inc.

Third-party code shipped under `src/elements/`:
- **Vercel AI Elements** — MIT © Vercel, Inc.
- **shadcn/ui** primitives (`button-group`, `input-group`) — MIT © shadcn.
