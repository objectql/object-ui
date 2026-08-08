# @object-ui/collaboration

Real-time collaboration for Object UI — live cursors, presence tracking, comment threads, and conflict resolution.

## Features

- 🖱️ **Live Cursors** - Display remote user cursors in real time with `LiveCursors`
- 👥 **Presence Avatars** - Show active users with `PresenceAvatars`
- 💬 **Comment Threads** - Threaded comments with @mentions via `CommentThread`
- 🔄 **Realtime Subscriptions** - WebSocket data subscriptions with `useRealtimeSubscription`
- 👁️ **Presence Tracking** - Track who's viewing or editing with `usePresence`
- ⚔️ **Conflict Resolution** - Version history and merge conflicts with `useConflictResolution`
- 🎯 **Type-Safe** - Full TypeScript support with exported types

## Installation

```bash
npm install @object-ui/collaboration
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0

## Quick Start

```tsx
import {
  usePresence,
  useRealtimeSubscription,
  LiveCursors,
  PresenceAvatars,
  CommentThread,
} from '@object-ui/collaboration';

function CollaborativeEditor() {
  const { users, updatePresence } = usePresence({
    channel: 'document-123',
  });

  const { data, connectionState } = useRealtimeSubscription({
    channel: 'document-123',
    event: 'update',
  });

  return (
    <div>
      <PresenceAvatars users={users} />
      <LiveCursors users={users} />
      <Editor data={data} onCursorMove={(pos) => updatePresence({ cursor: pos })} />
      <CommentThread threadId="thread-1" />
    </div>
  );
}
```

## API

### useRealtimeSubscription

Hook for WebSocket data subscriptions:

```tsx
const { data, connectionState, error } = useRealtimeSubscription({
  channel: 'orders',
  event: 'update',
});
```

### usePresence

Hook for tracking user presence:

```tsx
const { users, updatePresence } = usePresence({
  channel: 'document-123',
  user: { id: 'user-1', name: 'Alice' },
});
```

### useConflictResolution

Hook for version history and conflict management:

```tsx
const { versions, conflicts, resolve } = useConflictResolution({
  resourceId: 'doc-123',
});
```

### LiveCursors

Displays remote user cursors on the page:

```tsx
<LiveCursors users={presenceUsers} />
```

### PresenceAvatars

Shows avatar badges for active users:

```tsx
<PresenceAvatars users={presenceUsers} maxVisible={5} />
```

### CommentThread

Threaded comment component with @mentions:

```tsx
<CommentThread
  threadId="thread-1"
  comments={comments}
  onSubmit={(comment) => saveComment(comment)}
/>
```

## Links

- 📦 [npm package](https://www.npmjs.com/package/@object-ui/collaboration)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
