---
title: "Navigation Components"
---

Components for user navigation and flow control.

## Button `button`

Clickable button for actions.

```typescript
interface ButtonSchema {
  type: 'button';
  label: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  icon?: string;
  iconPosition?: 'left' | 'right';
  onClick?: string | ActionConfig; // Expression or Action
  disabled?: boolean | string; // Boolean or Expression
  loading?: boolean | string; // Boolean or Expression
}
```

## Link `link`

Hyperlink for navigation.

```typescript
interface LinkSchema {
  type: 'link';
  text: string;
  href: string;
  target?: '_blank' | '_self' | '_parent' | '_top';
  external?: boolean; // Show external icon
}
```

## Breadcrumb `breadcrumb`

Displays the path to the current resource.

```typescript
interface BreadcrumbSchema {
  type: 'breadcrumb';
  items: {
    label: string;
    href?: string;
    icon?: string;
  }[];
  separator?: string; // Default: "/"
}
```

## Pagination `pagination`

Controls for navigating through paginated data.

```typescript
interface PaginationSchema {
  type: 'pagination';
  total: number;
  pageSize: number;
  current: number;
  onChange: string; // Action to handle page change
  showSizeChanger?: boolean;
}
```

## Steps `steps`

Progress tracking through a sequence of steps.

```typescript
interface StepsSchema {
  type: 'steps';
  items: {
    title: string;
    description?: string;
    icon?: string;
  }[];
  current: number; // 0-based index
  status?: 'process' | 'finish' | 'error' | 'wait';
  direction?: 'horizontal' | 'vertical';
}
```

## Dropdown `dropdown`

Toggleable menu for actions.

```typescript
interface DropdownSchema {
  type: 'dropdown';
  trigger: Schema; // The element to click (e.g., Button or Icon)
  items: MenuItemSchema[];
}

interface MenuItemSchema {
  label: string;
  icon?: string;
  onClick?: string; // Action
  disabled?: boolean;
  shortcut?: string;
  dangerous?: boolean; // Red text styling
  items?: MenuItemSchema[]; // Submenu
}
```
