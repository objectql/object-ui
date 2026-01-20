---
title: "Plugin Kanban"
---

Kanban board component with drag-and-drop powered by @dnd-kit.

## Installation

```bash
npm install @object-ui/plugin-kanban
```

## Usage

### Basic Usage

```tsx
// Import once in your app entry point
import '@object-ui/plugin-kanban'

// Use in schemas
const schema = {
  type: 'kanban',
  columns: [
    {
      id: 'todo',
      title: 'To Do',
      cards: [
        { id: '1', title: 'Task 1', description: 'Do something' }
      ]
    },
    {
      id: 'done',
      title: 'Done',
      cards: []
    }
  ],
  onCardMove: (cardId, fromCol, toCol, index) => {
    console.log(`Card ${cardId} moved`)
  }
}
```

## Features

- **Drag and drop cards** between columns
- **Column limits** (WIP limits)
- **Card badges** for status/priority
- **Keyboard navigation**
- **Lazy-loaded** (~100-150 KB loads only when rendered)

## Schema API

```typescript
{
  type: 'kanban',
  columns?: KanbanColumn[],
  onCardMove?: (cardId, fromColumnId, toColumnId, newIndex) => void,
  className?: string
}

interface KanbanColumn {
  id: string
  title: string
  cards: KanbanCard[]
  limit?: number              // Max cards allowed
  className?: string
}

interface KanbanCard {
  id: string
  title: string
  description?: string
  badges?: Array<{
    label: string
    variant?: 'default' | 'secondary' | 'destructive' | 'outline'
  }>
}
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `columns` | KanbanColumn[] | Array of column definitions |
| `onCardMove` | function | Callback when a card is moved |
| `className` | string | Additional Tailwind CSS classes |

### Column Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique column identifier |
| `title` | string | Column title |
| `cards` | KanbanCard[] | Cards in this column |
| `limit` | number | Max cards allowed (WIP limit) |
| `className` | string | Additional Tailwind CSS classes |

### Card Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique card identifier |
| `title` | string | Card title |
| `description` | string | Card description |
| `badges` | Badge[] | Status/priority badges |

## Examples

### Project Task Board

```tsx
const taskBoard = {
  type: 'kanban',
  columns: [
    {
      id: 'backlog',
      title: 'Backlog',
      cards: [
        {
          id: 'task-1',
          title: 'Design new homepage',
          description: 'Create mockups for the new landing page',
          badges: [
            { label: 'Design', variant: 'default' },
            { label: 'High Priority', variant: 'destructive' }
          ]
        }
      ]
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      limit: 3,  // WIP limit
      cards: [
        {
          id: 'task-2',
          title: 'Implement authentication',
          description: 'Add OAuth2 login flow',
          badges: [
            { label: 'Backend', variant: 'secondary' }
          ]
        }
      ]
    },
    {
      id: 'review',
      title: 'Code Review',
      cards: []
    },
    {
      id: 'done',
      title: 'Done',
      cards: []
    }
  ],
  onCardMove: (cardId, fromCol, toCol, index) => {
    // Update backend/state
    console.log(`Moved ${cardId} from ${fromCol} to ${toCol}`)
  }
}
```

### Support Ticket Board

```tsx
const ticketBoard = {
  type: 'kanban',
  columns: [
    {
      id: 'new',
      title: 'New Tickets',
      cards: [
        {
          id: 'ticket-1',
          title: 'Login not working',
          description: 'User cannot log in with Google',
          badges: [
            { label: 'Bug', variant: 'destructive' },
            { label: 'P1', variant: 'destructive' }
          ]
        }
      ]
    },
    {
      id: 'assigned',
      title: 'Assigned',
      limit: 5,
      cards: []
    },
    {
      id: 'resolved',
      title: 'Resolved',
      cards: []
    }
  ],
  className: 'min-h-[600px]'
}
```

### Sales Pipeline

```tsx
const salesPipeline = {
  type: 'kanban',
  columns: [
    {
      id: 'leads',
      title: 'Leads',
      cards: [
        {
          id: 'lead-1',
          title: 'Acme Corp',
          description: '$50,000 - Enterprise plan',
          badges: [
            { label: 'Hot Lead', variant: 'destructive' }
          ]
        }
      ]
    },
    {
      id: 'qualified',
      title: 'Qualified',
      cards: []
    },
    {
      id: 'proposal',
      title: 'Proposal Sent',
      cards: []
    },
    {
      id: 'won',
      title: 'Won',
      cards: []
    }
  ]
}
```

## Card Badges

Use badges to show card status, priority, or categories:

```tsx
const card = {
  id: 'task-1',
  title: 'Important Task',
  badges: [
    { label: 'Frontend', variant: 'default' },
    { label: 'Urgent', variant: 'destructive' },
    { label: 'Reviewed', variant: 'secondary' },
    { label: 'Blocked', variant: 'outline' }
  ]
}
```

### Badge Variants

- `default` - Blue badge
- `secondary` - Gray badge
- `destructive` - Red badge
- `outline` - Outlined badge

## Column Limits (WIP Limits)

Set maximum cards per column to enforce work-in-progress limits:

```tsx
const column = {
  id: 'in-progress',
  title: 'In Progress',
  limit: 3,  // Max 3 cards
  cards: [...]
}
```

When the limit is reached, the column shows visual feedback.

## Event Handling

Handle card movements to update your backend or state:

```tsx
const schema = {
  type: 'kanban',
  columns: [...],
  onCardMove: (cardId, fromColumnId, toColumnId, newIndex) => {
    // Update database
    await updateCardColumn(cardId, toColumnId, newIndex)
    
    // Update local state
    setCards(prev => moveCard(prev, cardId, toColumnId, newIndex))
  }
}
```

## Bundle Size

The plugin uses lazy loading to optimize bundle size:

- **Initial load**: ~0.2 KB (entry point)
- **Lazy chunk**: ~100-150 KB (loaded when kanban is rendered)
- **Includes @dnd-kit** for drag-and-drop functionality

## Accessibility

The kanban board includes:

- **Keyboard navigation** - Move cards with keyboard
- **Screen reader support** - ARIA labels for all interactions
- **Focus management** - Clear focus indicators

## TypeScript Support

```typescript
import type { KanbanSchema, KanbanCard, KanbanColumn } from '@object-ui/plugin-kanban'

const column: KanbanColumn = {
  id: 'todo',
  title: 'To Do',
  cards: [],
  limit: 5
}

const kanbanSchema: KanbanSchema = {
  type: 'kanban',
  columns: [column]
}
```

## Related Documentation

- [Plugin System Overview](../guide/plugins.md)
- [Lazy-Loaded Plugins Architecture](../lazy-loaded-plugins.md)
- [Package README](https://github.com/objectstack-ai/objectui/tree/main/packages/plugin-kanban)
