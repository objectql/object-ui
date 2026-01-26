# @object-ui/plugin-chatbot

Chatbot interface plugin for Object UI.

## Installation

```bash
npm install @object-ui/plugin-chatbot
```

## Usage

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

## Schema-Driven Usage

This plugin automatically registers with ObjectUI's component registry when imported:

```tsx
import '@object-ui/plugin-chatbot';

const schema = {
  component: 'chatbot',
  messages: [
    { id: '1', role: 'assistant', content: 'Hello!' }
  ],
  placeholder: 'Type your message...',
  autoResponse: true
};
```

## License

MIT © ObjectStack Inc.
