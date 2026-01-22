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

import type { BaseSchema } from './base';

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
   * Dismiss handler
   */
  onDismiss?: () => void;
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
 * Union type of all feedback schemas
 */
export type FeedbackSchema =
  | LoadingSchema
  | ProgressSchema
  | SkeletonSchema
  | ToastSchema
  | ToasterSchema;
