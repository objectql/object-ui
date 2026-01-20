---
title: "Feedback Components"
---

Components for user feedback and interaction states.

## Alert `alert`

Important status message.

```typescript
interface AlertSchema {
  type: 'alert';
  title?: string;
  description: string;
  variant?: 'default' | 'destructive' | 'info' | 'warning' | 'success';
  icon?: string; // Optional icon override
  closable?: boolean;
}
```

## Progress `progress`

Visual indicator of completion percentage.

```typescript
interface ProgressSchema {
  type: 'progress';
  value: number; // 0-100
  max?: number; // default 100
  showLabel?: boolean; // Show "50%"
  color?: string;
}
```

## Skeleton `skeleton`

Loading placeholder for content.

```typescript
interface SkeletonSchema {
  type: 'skeleton';
  width?: string | number;
  height?: string | number;
  shape?: 'rectangle' | 'circle';
  count?: number; // Number of lines
}
```

## Spinner `spinner`

Loading indicator.

```typescript
interface SpinnerSchema {
  type: 'spinner';
  size?: 'sm' | 'md' | 'lg';
  label?: string; // "Loading..." text
}
```

## Toast `toast`

Transient notification. (Usually triggered via Action, but can be declared).

```typescript
interface ToastAction {
  type: 'toast';
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
}
```
