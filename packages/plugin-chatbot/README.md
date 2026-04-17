# @object-ui/plugin-chatbot

Chatbot interface plugin for Object UI with full AI SDUI support.

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
using `@ai-sdk/react` for streaming, tool-calling, and production-grade chat:

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

<!-- release-metadata:v3.3.0 -->

## Compatibility

- **React:** 18.x or 19.x
- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/plugins/plugin-chatbot)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/plugin-chatbot)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT © ObjectStack Inc.
