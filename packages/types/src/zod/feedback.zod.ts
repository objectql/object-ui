/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Feedback Component Zod Validators
 * 
 * Zod validation schemas for feedback and status indication components.
 * Following @objectstack/spec UI specification format.
 * 
 * @module zod/feedback
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod';

/**
 * Loading Schema - Loading indicator component
 */
export const LoadingSchema = BaseSchema.extend({
  type: z.literal('loading'),
  label: z.string().optional().describe('Loading label text'),
  size: z.enum(['sm', 'default', 'lg']).optional().describe('Loading indicator size'),
  variant: z.enum(['spinner', 'dots', 'pulse']).optional().describe('Loading variant'),
  fullscreen: z.boolean().optional().describe('Whether to show fullscreen overlay'),
});

/**
 * Progress Schema - Progress bar component
 */
export const ProgressSchema = BaseSchema.extend({
  type: z.literal('progress'),
  value: z.number().optional().describe('Progress value'),
  max: z.number().optional().describe('Maximum value'),
  variant: z.enum(['default', 'success', 'warning', 'error']).optional().describe('Progress variant'),
  showLabel: z.boolean().optional().describe('Show progress label'),
  size: z.enum(['sm', 'default', 'lg']).optional().describe('Progress bar size'),
  indeterminate: z.boolean().optional().describe('Indeterminate progress'),
});

/**
 * Skeleton Schema - Skeleton loading placeholder
 */
export const SkeletonSchema = BaseSchema.extend({
  type: z.literal('skeleton'),
  variant: z.enum(['text', 'circular', 'rectangular']).optional().describe('Skeleton variant'),
  width: z.union([z.string(), z.number()]).optional().describe('Skeleton width'),
  height: z.union([z.string(), z.number()]).optional().describe('Skeleton height'),
  lines: z.number().optional().describe('Number of text lines'),
  animate: z.boolean().optional().describe('Enable animation'),
});

/**
 * Toast Schema - Toast notification component
 */
export const ToastSchema = BaseSchema.extend({
  type: z.literal('toast'),
  title: z.string().optional().describe('Toast title'),
  description: z.string().optional().describe('Toast description'),
  variant: z.enum(['default', 'success', 'warning', 'error', 'info']).optional().describe('Toast variant'),
  duration: z.number().optional().describe('Auto-dismiss duration (ms)'),
  position: z.enum([
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ]).optional().describe('Toast position'),
  action: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Action button'),
  onDismiss: z.function().optional().describe('Dismiss handler'),
});

/**
 * Toaster Schema - Toast container component
 */
export const ToasterSchema = BaseSchema.extend({
  type: z.literal('toaster'),
  position: z.enum([
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ]).optional().describe('Toaster position'),
  limit: z.number().optional().describe('Maximum number of toasts'),
});

/**
 * Spinner Schema - Spinner component
 */
export const SpinnerSchema = BaseSchema.extend({
  type: z.literal('spinner'),
  size: z.enum(['sm', 'md', 'lg', 'xl']).optional().describe('Spinner size'),
});

/**
 * Empty Schema - Empty state component
 */
export const EmptySchema = BaseSchema.extend({
  type: z.literal('empty'),
  title: z.string().optional().describe('Empty state title'),
  description: z.string().optional().describe('Empty state description'),
  icon: z.string().optional().describe('Empty state icon'),
});

/**
 * Sonner Schema - Sonner toast component
 */
export const SonnerSchema = BaseSchema.extend({
  type: z.literal('sonner'),
  message: z.string().optional().describe('Toast message'),
  title: z.string().optional().describe('Toast title'),
  description: z.string().optional().describe('Toast description'),
  variant: z.enum(['default', 'success', 'warning', 'error', 'info']).optional().describe('Toast variant'),
  buttonLabel: z.string().optional().describe('Action button label'),
  buttonVariant: z.string().optional().describe('Action button variant'),
});

/**
 * Feedback Schema Union - All feedback component schemas
 */
export const FeedbackSchema = z.union([
  LoadingSchema,
  ProgressSchema,
  SkeletonSchema,
  ToastSchema,
  ToasterSchema,
  SpinnerSchema,
  EmptySchema,
  SonnerSchema,
]);
