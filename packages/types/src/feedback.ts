/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Feedback Component Schemas
 * 
 * Type definitions for feedback and status indication components.
 * 
 * @module feedback
 * @packageDocumentation
 */

import type { BaseSchema } from './base.js';

/**
 * Loading/Spinner component
 */
export interface LoadingSchema extends BaseSchema {
  type: 'loading';
  /**
   * Loading text/message
   */
  label?: string;
  /**
   * Spinner size
   * @default 'default'
   */
  size?: 'sm' | 'default' | 'lg';
  /**
   * Spinner variant
   * @default 'spinner'
   */
  variant?: 'spinner' | 'dots' | 'pulse';
  /**
   * Whether to show fullscreen overlay
   * @default false
   */
  fullscreen?: boolean;
}

/**
 * Progress bar component
 */
export interface ProgressSchema extends BaseSchema {
  type: 'progress';
  /**
   * Progress value (0-100)
   */
  value?: number;
  /**
   * Maximum value
   * @default 100
   */
  max?: number;
  /**
   * Progress bar variant
   * @default 'default'
   */
  variant?: 'default' | 'success' | 'warning' | 'error';
  /**
   * Show percentage label
   * @default false
   */
  showLabel?: boolean;
  /**
   * Progress bar size
   * @default 'default'
   */
  size?: 'sm' | 'default' | 'lg';
  /**
   * Indeterminate/loading state
   * @default false
   */
  indeterminate?: boolean;
}

/**
 * Skeleton loading placeholder
 */
export interface SkeletonSchema extends BaseSchema {
  type: 'skeleton';
  /**
   * Skeleton variant
   * @default 'text'
   */
  variant?: 'text' | 'circular' | 'rectangular';
  /**
   * Width
   */
  width?: string | number;
  /**
   * Height
   */
  height?: string | number;
  /**
   * Number of lines (for text variant)
   * @default 1
   */
  lines?: number;
  /**
   * Enable animation
   * @default true
   */
  animate?: boolean;
}

/**
 * Toast notification (declarative schema)
 */
export interface ToastSchema extends BaseSchema {
  type: 'toast';
  /**
   * Toast title
   */
  title?: string;
  /**
   * Toast description
   */
  description?: string;
  /**
   * Toast variant
   * @default 'default'
   */
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  /**
   * Auto-dismiss duration in milliseconds
   * @default 5000
   */
  duration?: number;
  /**
   * Toast position
   * @default 'bottom-right'
   */
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  /**
   * Action button
   */
  action?: {
    label: string;
    onClick: () => void;
  };
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `toast` renderer takes `({ schema })` and never reads it. The zod twin
   * refuses it by name; author behaviour as a node type (`{ "type": "toast" }`,
   * an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onDismiss?: never;
  /**
   * Label for the trigger button this component renders in place.
   *
   * The `toast` node renders a `<Button>`; clicking it raises the toast. The
   * renderer has always read this key (`renderers/feedback/toast.tsx`) and the
   * registration has always offered it as an authoring input — this
   * declaration is the third surface catching up (objectui#6496).
   * @default 'Show Toast'
   */
  buttonLabel?: string;
  /**
   * Variant for the trigger button this component renders in place.
   *
   * The renderer passes this value STRAIGHT THROUGH to `<Button variant={…}>`,
   * so the vocabulary is `ButtonProps['variant']` — the six keys of
   * `buttonVariants`' `variant` group (`components/src/ui/button.tsx`) — and
   * not an open string. A value outside the six is not merely unusual: `cva`
   * contributes NO variant class for an unrecognised key and falls back to
   * `defaultVariants` only when the value is absent OR falsy, so
   * `buttonVariant: 'primary'` renders a button with no background and no text
   * colour while `buttonVariant: ''` silently renders the default look. Pinned against the
   * Button itself in
   * `components/src/__tests__/toast-button-variant-parity.test.ts`.
   */
  buttonVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
}

/**
 * Toaster container (for toast management)
 */
export interface ToasterSchema extends BaseSchema {
  type: 'toaster';
  /**
   * Toast position
   * @default 'bottom-right'
   */
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  /**
   * Maximum number of toasts to show
   * @default 5
   */
  limit?: number;
}

/**
 * Spinner component
 */
export interface SpinnerSchema extends BaseSchema {
  type: 'spinner';
  /**
   * Spinner size
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Empty state component
 */
export interface EmptySchema extends BaseSchema {
  type: 'empty';
  /**
   * Empty state title
   */
  title?: string;
  /**
   * Empty state description
   */
  description?: string;
  /**
   * Icon to display
   */
  icon?: string;
}

/**
 * Sonner toast component (using sonner library)
 */
export interface SonnerSchema extends BaseSchema {
  type: 'sonner';
  /**
   * Toast message/title
   */
  message?: string;
  /**
   * Toast title (alias for message)
   */
  title?: string;
  /**
   * Toast description
   */
  description?: string;
  /**
   * Toast variant
   * @default 'default'
   */
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  /**
   * Button label to trigger toast
   */
  buttonLabel?: string;
  /**
   * Button variant
   */
  buttonVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
}

/**
 * Union type of all feedback schemas
 */
export type FeedbackSchema =
  | LoadingSchema
  | ProgressSchema
  | SkeletonSchema
  | ToastSchema
  | ToasterSchema
  | SpinnerSchema
  | EmptySchema
  | SonnerSchema;
