---
title: "Data Display Components"
---

Components for presenting data in various formats.

## Tag `tag`

Small label for categorization.

```typescript
interface TagSchema {
  type: 'tag';
  label: string;
  color?: string; // "default", "blue", "green", "red", etc. or hex
  variant?: 'solid' | 'outline' | 'subtle';
  icon?: string;
  closable?: boolean;
  onClose?: string; // Action
}
```

## Badge `badge`

Notification indicator or status marker.

```typescript
interface BadgeSchema {
  type: 'badge';
  content?: string | number; // "New", "99+"
  color?: 'default' | 'secondary' | 'destructive' | 'outline';
  dot?: boolean; // Show only a dot
}
```

## Avatar `avatar`

User or entity profile image.

```typescript
interface AvatarSchema {
  type: 'avatar';
  src?: string;
  fallback: string; // Initials "JD"
  size?: 'sm' | 'md' | 'lg';
  shape?: 'circle' | 'square';
  status?: 'online' | 'offline' | 'busy'; // Status dot
}
```

## List `list`

Simple vertical list of items.

```typescript
interface ListSchema {
  type: 'list';
  items: any[];
  renderItem: Schema; // Template schema for each item
  bordered?: boolean;
  size?: 'sm' | 'default' | 'lg';
}
```

## Table `table`

Structured data grid. (Note: Full Grid is a complex component, this is a simple display table).

```typescript
interface TableSchema {
  type: 'table';
  columns: {
    title: string;
    field: string;
    width?: number | string;
    align?: 'left' | 'center' | 'right';
    render?: Schema; // Cell template
  }[];
  data: any[]; // Or bound via context
  bordered?: boolean;
  striped?: boolean;
}
```

## Timeline `timeline`

Vertical display of events over time.

```typescript
interface TimelineSchema {
  type: 'timeline';
  items: {
    title: string;
    description?: string;
    time: string;
    icon?: string;
    color?: string;
  }[];
  mode?: 'left' | 'right' | 'alternate';
}
```

## Statistics `statistic`

Display numerical values prominently.

```typescript
interface StatisticSchema {
  type: 'statistic';
  title?: string;
  value: string | number;
  prefix?: string | Schema; // Icon (trend up/down)
  suffix?: string | Schema;
  precision?: number; // Decimal places
  trend?: 'up' | 'down' | 'neutral';
}
```

## Tree `tree`

Hierarchical list structure.

```typescript
interface TreeSchema {
  type: 'tree';
  data: any[];
  items?: {
    title: string;
    key: string;
    children?: string; // Field name for children array
    icon?: string;
  }[]; // Or use a recursive render template
  checkable?: boolean;
  draggable?: boolean;
  defaultExpandAll?: boolean;
}
```
