---
title: "Overlay Components"
---

Content displayed above the main layer.

## Dialog `dialog`

Modal window for tasks or alerts.

```typescript
interface DialogSchema {
  type: 'dialog';
  title?: string;
  description?: string;
  content: Schema; // The body content
  footer?: Schema; // Custom footer buttons actions
  trigger?: Schema; // Element that opens dialog
  open?: boolean; // Controlled state
  onOpenChange?: string; // Action
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}
```

## Drawer `drawer`

Slide-out panel from the edge of the screen.

```typescript
interface DrawerSchema {
  type: 'drawer';
  title?: string;
  description?: string;
  content: Schema;
  footer?: Schema;
  trigger?: Schema;
  open?: boolean; // Controlled state
  onOpenChange?: string; // Action
  position?: 'left' | 'right' | 'top' | 'bottom';
  size?: string; // e.g., "500px", "50%"
}
```

## Tooltip `tooltip`

Contextual hint on hover.

```typescript
interface TooltipSchema {
  type: 'tooltip';
  content: string; // The tooltip text
  trigger: Schema; // The element wrapped
  side?: 'top' | 'right' | 'bottom' | 'left';
}
```

## Popover `popover`

Content floating near a trigger element, for more complex interaction than Tooltip.

```typescript
interface PopoverSchema {
  type: 'popover';
  content: Schema; // Arbitrary content
  trigger: Schema;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}
```
