---
title: "Layout Components"
---

Layout components are the structural building blocks of an Object UI application. They define how other components are arranged and positioned.

## Div `div`

A basic container component, similar to the HTML `<div>`.

```typescript
interface DivSchema {
  type: 'div';
  className?: string; // Tailwind classes
  children?: SchemaNode[];
}
```

## Container `container`

A responsive container that centers content and adds horizontal padding.

```typescript
interface ContainerSchema {
  type: 'container';
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'; // Default: 'xl'
  padding?: number; // 0-16
  centered?: boolean; // Default: true
  children?: SchemaNode[];
}
```

## Grid `grid`

CSS Grid layout component for arranging items in columns.

```typescript
interface GridSchema {
  type: 'grid';
  columns?: number; // 1-12
  gap?: number; // 0-16
  children?: SchemaNode[];
}
```

## Flex `flex`

Flexbox layout component for linear arrangements.

```typescript
interface FlexSchema {
  type: 'flex';
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  gap?: number; // 0-16
  wrap?: boolean | 'wrap' | 'nowrap' | 'wrap-reverse';
  children?: SchemaNode[];
}
```

## Card `card`

A versatile container for distinct pieces of information.

```typescript
interface CardSchema {
  type: 'card';
  title?: string;
  description?: string;
  header?: SchemaNode[]; // Custom header content
  children?: SchemaNode[]; // Main content
  footer?: SchemaNode[]; // Footer content
  variant?: 'default' | 'outline' | 'ghost';
  hoverable?: boolean;
  clickable?: boolean;
}
```

## Tabs `tabs`

Switch between different views within the same context.

```typescript
interface TabsSchema {
  type: 'tabs';
  orientation?: 'horizontal' | 'vertical';
  defaultValue?: string; // Initial active tab
  items: {
    value: string;
    label: string;
    icon?: string;
    disabled?: boolean;
    children: SchemaNode[];
  }[];
}
```

## ScrollArea `scroll-area`

A container with custom styled scrollbars.

```typescript
interface ScrollAreaSchema {
  type: 'scroll-area';
  orientation?: 'horizontal' | 'vertical' | 'both';
  maxHeight?: string | number;
  width?: string | number;
  children?: SchemaNode[];
}
```

## Resizable `resizable`

Resizable panel groups.

```typescript
interface ResizableSchema {
  type: 'resizable';
  direction?: 'horizontal' | 'vertical';
  panels: {
    id: string; // Unique ID
    defaultSize?: number; // Percentage
    minSize?: number;
    maxSize?: number;
    content: SchemaNode[];
  }[];
}
```

## Separator `separator`

A visual divider between content.

```typescript
interface SeparatorSchema {
  type: 'separator';
  orientation?: 'horizontal' | 'vertical';
}
```
