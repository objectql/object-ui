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
import { handlerKeyRefusal, retirementTombstone } from './tombstone.zod.js';
import type { ActionSchema as ActionDeclaration } from '../crud.js';

/**
 * Action Execution Mode Schema
 */
export const ActionExecutionModeSchema = z.enum(['sequential', 'parallel']).describe('Action execution mode for chaining');

// `ActionCallbackSchema` — the mirror of the Phase-2 `ActionCallback` object the legacy
// `ActionSchema.onSuccess` / `onFailure` keys carried — was DELETED by objectui#7068
// (the objectui#7664 route for a standalone retired pair: const, TS declaration and
// barrel exports gone, parity-ledger rows removed, absence pinned in
// `../__tests__/action-callback-retired-7068.test.ts`). The two keys below stay
// declared as named refusals — see their comment.

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
 *
 * INPUT FACE: both type arguments carry this mirror's existing TypeScript
 * declaration (objectui#7760, maintainer ruling, decision batch #69) — the annotation
 * still breaks the recursion in the initializer below, but it no longer publishes
 * `unknown` as what an author may write here. ⛔ Runtime accept set unchanged; ⛔ the
 * declaration unchanged. The reasoning lives once, on `SchemaNodeSchema` in
 * `base.zod.ts` — read it there before changing this line.
 */
export const ActionSchema: z.ZodType<ActionDeclaration, ActionDeclaration> = z.lazy(() => BaseSchema.extend({
  type: z.literal('action'),
  label: z.string().describe('Action label'),
  level: z.enum(['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'default']).optional().describe('Action type/level'),
  icon: z.string().optional().describe('Icon to display (lucide-react icon name)'),
  variant: z.enum(['default', 'outline', 'ghost', 'link']).optional().describe('Action variant'),
  actionType: z.enum(['button', 'link', 'dropdown', 'ajax', 'confirm', 'dialog']).optional().describe('Action type'),
  api: z.string().optional().describe('API endpoint to call (for ajax actions)'),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional().describe('HTTP method'),
  data: z.any().optional().describe('Request body/data'),
  headers: z.record(z.string(), z.string()).optional().describe('Request headers'),
  // RETIRED (objectui#4314): the structured confirm object is a tombstone.
  // The TS twin (`crud.ts`) types it `?: never`; here any authored value is a
  // loud parse rejection (absent stays valid), mirroring how `@objectstack/spec`
  // retires keys. One confirm spelling: `confirmText` below.
  // This key ESTABLISHED the convention and was the last one still answering
  // with zod's generic `expected never`; objectui#6931 routes it through
  // `retirementTombstone()` so the refusal carries the remedy it teaches.
  confirm: retirementTombstone('RETIRED (objectui#4314) — author confirmText instead'),
  confirmText: z.string().optional().describe('Confirmation message — shows a confirm dialog before executing'),
  dialog: z.object({
    title: z.string().optional().describe('Dialog title'),
    content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Dialog content'),
    size: z.enum(['sm', 'default', 'lg', 'xl', 'full']).optional().describe('Dialog size'),
    actions: z.array(ActionSchema).optional().describe('Dialog actions'),
  }).optional().describe('Dialog configuration (for dialog actions)'),
  successMessage: z.string().optional().describe('Success message after execution'),
  errorMessage: z.string().optional().describe('Error message on failure'),
  // ADR-0049 RETIREMENT TOMBSTONES (objectui#7068, maintainer ruling option 1 of
  // 2026-09-05). Both keys carried a Phase-2 `ActionCallback` object that no renderer
  // or runner ever read and that the spec refuses at publish (`onSuccess`: wrong
  // block shape; `onFailure`: no such key). A plain deletion here would NOT refuse
  // them: `BaseSchema` is `.passthrough()`, so an authored callback would be KEPT
  // unvalidated and silently inert. The tombstones refuse BY NAME — one string, both
  // channels (parse-time message and `.describe()`), see `./tombstone.zod.ts`; the
  // TS twins are `?: never` (`../crud.ts`). Pinned in
  // `../__tests__/action-callback-retired-7068.test.ts`.
  onSuccess: retirementTombstone(
    'RETIRED (objectui#7068) — `onSuccess` is no longer part of this legacy ActionSchema; nothing reads '
    + 'it. It carried a Phase-2 `ActionCallback` object (`{ type: \'toast\' | \'message\' | \'redirect\' | '
    + '\'reload\' | \'custom\' | \'ajax\' | \'dialog\', message?, url?, api?, method?, dialog?, handler? }`) that '
    + 'no renderer or runner ever consumed — the THIRD meaning of this key — and that `@objectstack/spec`\'s '
    + 'ActionSchema refuses at publish (`invalid_type` at `onSuccess.navigate` plus `unrecognized_keys`). '
    + 'Post-success navigation is the spec\'s `onSuccess` block, `{ navigate, openIn }`, declared on '
    + 'UIActionSchema (objectui#5934); a success notice is `successMessage`. Retired under ADR-0049 '
    + 'enforce-or-remove with no deprecation window (maintainer ruling option 1, 2026-09-05).',
  ),
  onFailure: retirementTombstone(
    'RETIRED (objectui#7068) — `onFailure` is no longer part of this legacy ActionSchema; nothing reads '
    + 'it. It carried the same Phase-2 `ActionCallback` object `onSuccess` carried, and '
    + '`@objectstack/spec`\'s ActionSchema declares no `onFailure` at all (an authored one is refused at '
    + 'publish as an unrecognized key). A failure notice is `errorMessage`. Retired under ADR-0049 '
    + 'enforce-or-remove with no deprecation window (maintainer ruling option 1, 2026-09-05).',
  ),
  chain: z.array(ActionSchema).optional().describe('Action chaining - actions to execute after this one'),
  chainMode: ActionExecutionModeSchema.optional().describe('Chain execution mode'),
  condition: ActionConditionPredicateSchema.optional().describe('Execution gate — the action runs only while this predicate holds'),
  reload: z.boolean().optional().describe('Whether to reload data after action'),
  close: z.boolean().optional().describe('Whether to close dialog/modal after action'),
  // RUNTIME SLOT (objectui#7344): `ActionRunner` awaits `action.onClick()` and
  // the action renderers guard `typeof action.onClick === 'function'`. The
  // `z.any()` this replaces accepted an authored string or object that then
  // reached that call (objectui#7069's mirror-wider-than-declared direction).
  onClick: handlerKeyRefusal('onClick', 'runtime-slot', 'Custom click handler'),
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
  showBack: z.boolean().optional().describe('Show back button'),
  // RUNTIME SLOT (objectui#7344): `register('detail', DetailView)` — the same
  // `handleBack` that calls `onBack()` for `detail-view`. Was `z.any()`.
  onBack: handlerKeyRefusal('onBack', 'runtime-slot', 'Custom back action'),
  loading: z.boolean().optional().describe('Whether to show loading state'),
});

/**
 * CRUD Dialog Schema
 */
export const CRUDDialogSchema = BaseSchema.extend({
  type: z.literal('crud-dialog'),
  title: z.string().optional().describe('Dialog title'),
  description: z.string().optional().describe('Dialog description'),
  content: z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)]).optional().describe('Dialog content'),
  size: z.enum(['sm', 'default', 'lg', 'xl', 'full']).optional().describe('Dialog size'),
  actions: z.array(ActionSchema).optional().describe('Dialog actions/buttons'),
  open: z.boolean().optional().describe('Whether dialog is open'),
  // RETIRED (objectui#7344): no renderer is registered for `crud-dialog`;
  // nothing reads the key. Was `z.any()`.
  onClose: handlerKeyRefusal('onClose', 'retired', 'Close handler'),
  closeOnOutsideClick: z.boolean().optional().describe('Whether clicking outside closes dialog'),
  closeOnEscape: z.boolean().optional().describe('Whether pressing Escape closes dialog'),
  showClose: z.boolean().optional().describe('Show close button'),
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
export type ActionSchemaType = z.infer<typeof ActionSchema>;
export type DetailSchemaType = z.infer<typeof DetailSchema>;
export type CRUDDialogSchemaType = z.infer<typeof CRUDDialogSchema>;
