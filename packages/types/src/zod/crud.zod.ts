/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - CRUD Component Zod Validators
 * 
 * Zod validation schemas for CRUD operations.
 * Following @objectstack/spec UI specification format.
 * 
 * Enhanced in Phase 2 with ajax, confirm, dialog actions, chaining, and conditional execution.
 * 
 * @module zod/crud
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema, SchemaNodeSchema } from './base.zod.js';

/**
 * Action Execution Mode Schema
 */
export const ActionExecutionModeSchema = z.enum(['sequential', 'parallel']).describe('Action execution mode for chaining');

/**
 * Action Callback Schema
 */
export const ActionCallbackSchema = z.object({
  type: z.enum(['toast', 'message', 'redirect', 'reload', 'custom', 'ajax', 'dialog']).describe('Callback type'),
  message: z.string().optional().describe('Message to display'),
  url: z.string().optional().describe('Redirect URL'),
  api: z.string().optional().describe('API endpoint for ajax callback'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional().describe('HTTP method for ajax callback'),
  dialog: SchemaNodeSchema.optional().describe('Dialog schema to open'),
  handler: z.string().optional().describe('Custom callback handler expression'),
});

/**
 * The wire shape of an action's execution gate: a boolean, a bare CEL string
 * (`${…}` templates included), or the spec Expression envelope
 * `{ dialect?, source }` that `objectstack build` emits. These are the three
 * arms `ActionRunner` actually honours (`@object-ui/core`
 * `hasDeclaredPredicate` + `evaluateCondition`), so an authored gate that
 * parses here is a gate that runs. Module-local on purpose — it restates no TS
 * interface of its own, so it is not a mirror the parity census should track.
 *
 * RETIRED (objectui#3917): this key used to take `ActionConditionSchema`, an
 * `{ expression, then, else }` branch DSL with ZERO consumers — the runtime read
 * the same key as the predicate above, and a `source`-less object normalizes to
 * "no gate declared", so the branch was accepted here and then silently ignored
 * at execution (the action ran unconditionally). Retiring it flips the parse
 * verdict BOTH ways: the branch object is now refused, and the predicate forms
 * the runtime has always honoured are now accepted — before this, `condition`
 * required `expression`, so every live predicate spelling was refused.
 */
const ActionConditionPredicateSchema = z.union([
  z.boolean(),
  z.string(),
  z.object({ dialect: z.string().optional(), source: z.string() }),
]);

/**
 * Action Schema - Enhanced with Phase 2 features
 */
export const ActionSchema: z.ZodType<any> = z.lazy(() => BaseSchema.extend({
  type: z.literal('action'),
  label: z.string().describe('Action label'),
  level: z.enum(['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'default']).optional().default('default').describe('Action type/level'),
  icon: z.string().optional().describe('Icon to display (lucide-react icon name)'),
  variant: z.enum(['default', 'outline', 'ghost', 'link']).optional().describe('Action variant'),
  disabled: z.boolean().optional().describe('Whether action is disabled'),
  actionType: z.enum(['button', 'link', 'dropdown', 'ajax', 'confirm', 'dialog']).optional().describe('Action type'),
  api: z.string().optional().describe('API endpoint to call (for ajax actions)'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional().default('POST').describe('HTTP method'),
  data: z.any().optional().describe('Request body/data'),
  headers: z.record(z.string(), z.string()).optional().describe('Request headers'),
  // RETIRED (objectui#4314): the structured confirm object is a tombstone.
  // The TS twin (`crud.ts`) types it `?: never`; here any authored value is a
  // loud parse rejection (absent stays valid), mirroring how `@objectstack/spec`
  // retires keys. One confirm spelling: `confirmText` below.
  confirm: z.never().optional().describe('RETIRED (objectui#4314) — author confirmText instead'),
  confirmText: z.string().optional().describe('Confirmation message — shows a confirm dialog before executing'),
  dialog: z.object({
    title: z.string().optional().describe('Dialog title'),
    content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Dialog content'),
    size: z.enum(['sm', 'default', 'lg', 'xl', 'full']).optional().describe('Dialog size'),
    actions: z.array(ActionSchema).optional().describe('Dialog actions'),
  }).optional().describe('Dialog configuration (for dialog actions)'),
  successMessage: z.string().optional().describe('Success message after execution'),
  errorMessage: z.string().optional().describe('Error message on failure'),
  onSuccess: ActionCallbackSchema.optional().describe('Success callback'),
  onFailure: ActionCallbackSchema.optional().describe('Failure callback'),
  chain: z.array(ActionSchema).optional().describe('Action chaining - actions to execute after this one'),
  chainMode: ActionExecutionModeSchema.optional().default('sequential').describe('Chain execution mode'),
  condition: ActionConditionPredicateSchema.optional().describe('Execution gate — the action runs only while this predicate holds'),
  reload: z.boolean().optional().default(true).describe('Whether to reload data after action'),
  close: z.boolean().optional().default(true).describe('Whether to close dialog/modal after action'),
  onClick: z.any().optional().describe('Custom click handler'),
  redirect: z.string().optional().describe('Redirect URL after success'),
  tracking: z.object({
    enabled: z.boolean().optional().describe('Enable tracking'),
    event: z.string().optional().describe('Event name'),
    metadata: z.record(z.string(), z.any()).optional().describe('Additional metadata'),
  }).optional().describe('Action logging/tracking'),
  timeout: z.number().optional().describe('Timeout in milliseconds'),
  retry: z.object({
    maxAttempts: z.number().optional().describe('Maximum retry attempts'),
    delay: z.number().optional().describe('Delay between retries (in ms)'),
  }).optional().describe('Retry configuration'),
}));

/**
 * Detail Schema
 */
export const DetailSchema = BaseSchema.extend({
  type: z.literal('detail'),
  title: z.string().optional().describe('Detail title'),
  api: z.string().optional().describe('API endpoint to fetch detail data'),
  resourceId: z.union([z.string(), z.number()]).optional().describe('Resource ID to display'),
  groups: z.array(z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    fields: z.array(z.object({
      name: z.string(),
      label: z.string().optional(),
      type: z.enum(['text', 'image', 'link', 'badge', 'date', 'datetime', 'json', 'html', 'custom']).optional(),
      format: z.string().optional(),
      render: SchemaNodeSchema.optional(),
    })),
  })).optional().describe('Field groups for organized display'),
  actions: z.array(ActionSchema).optional().describe('Actions available in detail view'),
  tabs: z.array(z.object({
    key: z.string(),
    label: z.string(),
    content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]),
  })).optional().describe('Tabs for additional content'),
  showBack: z.boolean().optional().default(true).describe('Show back button'),
  onBack: z.any().optional().describe('Custom back action'),
  loading: z.boolean().optional().default(true).describe('Whether to show loading state'),
});

/**
 * CRUD Dialog Schema
 */
export const CRUDDialogSchema = BaseSchema.extend({
  type: z.literal('crud-dialog'),
  title: z.string().optional().describe('Dialog title'),
  description: z.string().optional().describe('Dialog description'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Dialog content'),
  size: z.enum(['sm', 'default', 'lg', 'xl', 'full']).optional().default('default').describe('Dialog size'),
  actions: z.array(ActionSchema).optional().describe('Dialog actions/buttons'),
  open: z.boolean().optional().describe('Whether dialog is open'),
  onClose: z.any().optional().describe('Close handler'),
  closeOnOutsideClick: z.boolean().optional().default(true).describe('Whether clicking outside closes dialog'),
  closeOnEscape: z.boolean().optional().default(true).describe('Whether pressing Escape closes dialog'),
  showClose: z.boolean().optional().default(true).describe('Show close button'),
});

/**
 * Union of all CRUD schemas
 */
export const CRUDComponentSchema = z.union([
  ActionSchema,
  DetailSchema,
  CRUDDialogSchema,
]);

/**
 * Export type inference helpers
 */
export type ActionExecutionModeSchemaType = z.infer<typeof ActionExecutionModeSchema>;
export type ActionCallbackSchemaType = z.infer<typeof ActionCallbackSchema>;
export type ActionSchemaType = z.infer<typeof ActionSchema>;
export type DetailSchemaType = z.infer<typeof DetailSchema>;
export type CRUDDialogSchemaType = z.infer<typeof CRUDDialogSchema>;
