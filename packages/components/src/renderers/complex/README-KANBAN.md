# Kanban Board Component

A fully functional, schema-driven Kanban board component for Object UI with drag-and-drop support.

## Features

- **Multiple Columns**: Create unlimited columns with customizable titles
- **Rich Cards**: Cards support title, description, and multiple badges
- **Drag & Drop**: Smooth drag-and-drop functionality powered by @dnd-kit
- **Reordering**: Reorder cards within the same column
- **Cross-Column Moves**: Move cards between different columns
- **Column Limits**: Optional capacity limits with visual indicators
- **Card Counters**: Shows current count and limit per column
- **Schema-Driven**: Configure entirely through JSON/YAML
- **Event Callbacks**: Custom event handling for card movements

## Usage

### Basic Example

```json
{
  "type": "kanban",
  "className": "w-full h-[600px]",
  "columns": [
    {
      "id": "todo",
      "title": "To Do",
      "cards": [
        {
          "id": "card-1",
          "title": "Task Title",
          "description": "Task description",
          "badges": [
            { "label": "High Priority", "variant": "destructive" }
          ]
        }
      ]
    },
    {
      "id": "in-progress",
      "title": "In Progress",
      "limit": 3,
      "cards": []
    },
    {
      "id": "done",
      "title": "Done",
      "cards": []
    }
  ]
}
```

### With Event Handling

```json
{
  "type": "kanban",
  "columns": [...],
  "onCardMove": "(event) => { console.log('Card moved:', event); }"
}
```

## Schema Reference

### Kanban Props

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"kanban"` | Yes | Component type identifier |
| `columns` | `KanbanColumn[]` | Yes | Array of column configurations |
| `className` | `string` | No | Custom CSS classes |
| `onCardMove` | `function` | No | Callback when a card is moved |

### KanbanColumn

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique column identifier |
| `title` | `string` | Yes | Column header title |
| `cards` | `KanbanCard[]` | Yes | Array of cards in this column |
| `limit` | `number` | No | Maximum number of cards allowed |
| `className` | `string` | No | Custom CSS classes for column |

### KanbanCard

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique card identifier |
| `title` | `string` | Yes | Card title |
| `description` | `string` | No | Card description text |
| `badges` | `Badge[]` | No | Array of badge objects |

### Badge

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `label` | `string` | Yes | Badge text |
| `variant` | `"default" \| "secondary" \| "destructive" \| "outline"` | No | Badge color variant |

## Examples

### Simple Task Board

```json
{
  "type": "kanban",
  "columns": [
    {
      "id": "backlog",
      "title": "📋 Backlog",
      "cards": [
        {
          "id": "1",
          "title": "Setup project",
          "badges": [{ "label": "Setup" }]
        }
      ]
    },
    {
      "id": "doing",
      "title": "🚀 Doing",
      "limit": 2,
      "cards": []
    },
    {
      "id": "done",
      "title": "✅ Done",
      "cards": []
    }
  ]
}
```

### Issue Tracking Board

```json
{
  "type": "kanban",
  "columns": [
    {
      "id": "new",
      "title": "New Issues",
      "cards": [
        {
          "id": "issue-1",
          "title": "Bug: Login fails on Safari",
          "description": "Users can't login using Safari browser",
          "badges": [
            { "label": "Bug", "variant": "destructive" },
            { "label": "P0", "variant": "destructive" }
          ]
        }
      ]
    },
    {
      "id": "investigating",
      "title": "Investigating",
      "limit": 3,
      "cards": []
    },
    {
      "id": "fixed",
      "title": "Fixed",
      "cards": []
    }
  ]
}
```

## Styling

The Kanban component uses Tailwind CSS and can be customized using the `className` prop:

```json
{
  "type": "kanban",
  "className": "w-full h-[800px] bg-gray-50 p-4 rounded-lg",
  "columns": [...]
}
```

Individual columns can also be styled:

```json
{
  "id": "urgent",
  "title": "🔥 Urgent",
  "className": "bg-red-50",
  "cards": [...]
}
```

## Technical Details

- Built with React 18+ and TypeScript
- Uses @dnd-kit for drag-and-drop functionality
- Integrates with Shadcn UI components (Card, Badge, ScrollArea)
- Supports both pointer and touch interactions
- Accessible keyboard navigation (via @dnd-kit)

## Browser Support

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Full support with touch gestures
