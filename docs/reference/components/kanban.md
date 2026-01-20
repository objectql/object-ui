---
title: "Kanban Component"
---

Board view for managing items in columns.

## Kanban `kanban`

Draggable board for task management.

```typescript
interface KanbanSchema {
  type: 'kanban';
  data: any[]; // The flat list of items
  groupBy: string; // Field to group by (e.g., "status")
  columns?: {
    id: string; // correspond to value in groupBy field
    title: string;
    color?: string;
  }[];
  cardTemplate: Schema; // Template for rendering each card item (usually a Card component)
  
  onDragEnd?: string; // Action triggered when item status changes
}
```
