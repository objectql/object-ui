/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Action Runner
 * 
 * Executes actions defined in ActionSchema and EventHandler.
 *
 * Dispatches every `@objectstack/spec` `ActionType` — `script`, `url`, `modal`,
 * `flow`, `api`, `form` — plus the one declared renderer-local alias,
 * `navigation` (see `ObjectUiLocalActionType`). The table that does it is typed
 * against that vocabulary, so this list cannot go stale the way the old comment
 * had (it still claimed five types after `form` shipped).
 *
 * Features: conditional execution, confirmation, toast notifications,
 * redirect handling, action chaining, custom handler registration.
 */

import type { RunnableActionType } from '@object-ui/types';
import type { ActionInput as SpecActionInput } from '@objectstack/spec/ui';
import { ExpressionEvaluator } from '../evaluator/ExpressionEvaluator';
import { toPredicateInput } from '../evaluator/predicateInput';
import { globalUndoManager, type UndoableOperation } from './UndoManager';
import { warnOnUnknownActionKeys } from './actionKeys';

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  reload?: boolean;
  close?: boolean;
  redirect?: string;
  /** Modal schema to render (for type: 'modal') */
  modal?: any;
  /**
   * Suppress the automatic success toast for this result. A handler sets this
   * when the action only HANDED OFF to a follow-up UI rather than completing —
   * e.g. a `flow` action that paused at a screen and opened the flow-runner. The
   * action hasn't "completed yet", so a "success" toast on open would be
   * misleading; the follow-up surface owns its own completion messaging.
   */
  silent?: boolean;
  /**
   * An undoable operation captured by the handler (e.g. an `undoable` update
   * action's prior field values). When present, the runner pushes it onto the
   * global UndoManager and the success toast offers an "Undo" affordance.
   */
  undo?: UndoableOperation;
}

export interface ActionContext {
  data?: Record<string, any>;
  record?: any;
  selectedRecords?: Record<string, any>[];
  /** Live page-variable snapshot (ADR-0049), published by PageVariableActionBridge. */
  pageVariables?: Record<string, any>;
  user?: any;
  [key: string]: any;
}

/**
 * API configuration for complex requests.
 */
export interface ApiConfig {
  /** API endpoint URL */
  url: string;
  /** HTTP method */
  method?: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (will be JSON-stringified if object) */
  body?: any;
  /** Query parameters */
  queryParams?: Record<string, string>;
  /** Response type */
  responseType?: 'json' | 'text' | 'blob';
}

/**
 * Action definition accepted by the runner.
 * Compatible with both UIActionSchema (spec v2.0.1) and legacy crud.ts ActionSchema.
 */
export interface ActionDef {
  /** Action type identifier — a `RunnableActionType` (the spec's six plus the
   *  `navigation` alias of `url`) or a custom type with a registered handler. */
  type?: string;
  /**
   * Legacy action type field.
   *
   * @deprecated objectui dialect — use the spec spelling `type`. Both are read,
   * `type` first (objectstack#4075 step 2).
   */
  actionType?: string;
  /** Action name (from UIActionSchema) */
  name?: string;
  /** Display label */
  label?: string;
  /** Confirmation text — shows a confirm dialog before executing */
  confirmText?: string;
  /** Structured confirmation (from crud.ts) */
  confirm?: { title?: string; message?: string; confirmText?: string; cancelText?: string };
  /**
   * Condition predicate — the action executes only while it holds.
   *
   * A boolean, a bare CEL string, a `${…}` template, or the normalized
   * `{ dialect, source }` envelope `objectstack build` emits. Declared and
   * FALSE skips the action; not declared at all (absent / empty predicate)
   * executes. `boolean` is spelled out here because the execution gate now
   * honours `condition: false` as the verdict it plainly is (objectui#3872) —
   * the same widening `disabled` already carries below.
   */
  condition?: string | boolean;
  /** Disabled expression — if truthy, skip action */
  disabled?: string | boolean;
  /**
   * API endpoint (string URL or complex config).
   *
   * @deprecated objectui dialect — the spec spells an `api` action's endpoint
   * `target` (with the verb in `method`). `executeAPI` resolves
   * `api || endpoint || target`, so `target` alone is sufficient. The
   * `ApiConfig` object form has no spec counterpart and is objectui-only
   * (objectstack#4075 step 2).
   */
  api?: string | ApiConfig;
  /**
   * API endpoint URL.
   *
   * @deprecated objectui dialect — this was the "spec v2.0.1 alias", but spec 17
   * spells it `target`. `executeAPI` resolves `api || endpoint || target`
   * (objectstack#4075 step 2).
   */
  endpoint?: string;
  /** HTTP method */
  method?: string;
  /**
   * Navigation target — a nested envelope carrying the `navigation` alias's own
   * spelling (`to` / `external` / `newTab` / `replace`).
   *
   * @deprecated objectui dialect — the spec has no nested navigation envelope;
   * it spells a navigation action `{ type: 'url', target, openIn }`.
   * `executeNavigation` reads `navigate.to || navigate.target || navigate.redirect`,
   * falling back to the same keys on the action itself, so a flat `target` works
   * today (objectstack#4075 step 2).
   */
  navigate?: any;
  /** onClick callback (legacy) */
  onClick?: () => void | Promise<void>;
  /** Whether to reload data after success */
  reload?: boolean;
  /** Whether to close dialog after success */
  close?: boolean;
  /** Redirect URL expression */
  redirect?: string;
  /** Toast configuration */
  toast?: { showOnSuccess?: boolean; showOnError?: boolean; duration?: number };
  /** Success message (from UIActionSchema) */
  successMessage?: string;
  /** Error message (from UIActionSchema) */
  errorMessage?: string;
  /** Whether to refresh data after execution (from UIActionSchema) */
  refreshAfter?: boolean;
  /** Single-record update actions: offer an Undo affordance on success. */
  undoable?: boolean;
  /** Params object (for custom handlers) */
  params?: Record<string, any>;
  /** ActionParam definitions to collect from user before execution (from spec ActionSchema.params) */
  actionParams?: ActionParamDef[];
  /**
   * Result dialog spec — when present and the action succeeds, the runner
   * suppresses the successMessage toast and asks the consumer to open a
   * reveal dialog rendering `result.data` (see ResultDialogSpec).
   */
  resultDialog?: ResultDialogSpec;
  /**
   * The one handler slot: script name/expression for `type: 'script'`, URL for
   * `'url'`, flow name for `'flow'`, modal/page for `'modal'`, endpoint for
   * `'api'`, FormView name for `'form'`.
   *
   * The `execute` alias was REMOVED in @objectstack/spec 17 (#3855) and is not
   * read here (#3856) — don't re-add it. Two handler slots is how one action ran
   * one script server-side and a different one client-side (#3713).
   */
  target?: string;
  /**
   * Action body (spec `ActionSchema.body` — `HookBodySchema`). Opaque here:
   * bodies are a SERVER-side execution surface and this runner never
   * interprets one.
   *
   * L2 (`language: 'js'`) is defined as a function body run inside an isolated
   * VM enforcing declared capabilities, `timeoutMs` and `memoryMb`. A browser
   * has no such isolate, so "enforcing" those client-side would be decoration.
   * L1 (`language: 'expression'`) is formula-engine (CEL) source, a different
   * dialect from this package's `${…}` ExpressionEvaluator — running it here
   * would diverge silently rather than fail.
   *
   * Consumers dispatch bodies by registering a `script` handler that POSTs to
   * `/api/v1/actions/{object}/{action}`; the server runs the body through its
   * sandbox. Build that handler with `createServerActionHandler` (#2904) —
   * app-shell's `useConsoleActionRuntime` and `RecordDetailView` both do.
   */
  body?: unknown;
  /** For type: 'url' — where to open `target`. `'new-tab'` forces a new
   *  browser tab/window, `'self'` forces same-page navigation. When omitted,
   *  external URLs open in a new tab and relative URLs navigate in place.
   *  This is the public, static "open in new tab" switch (ActionSchema.openIn),
   *  distinct from the async-handler `opensInNewTab` pre-open dance. */
  openIn?: 'self' | 'new-tab';
  /** Modal schema to open (for type: 'modal') */
  modal?: any;
  /** Chained actions to execute after this one */
  chain?: ActionDef[];
  /** Chain execution mode */
  chainMode?: 'sequential' | 'parallel';
  /** Callback on success */
  onSuccess?: ActionDef | ActionDef[];
  /** Callback on failure */
  onFailure?: ActionDef | ActionDef[];
  /** When true, the runner pre-opens about:blank synchronously on click so the
   *  handler can drive it to a returned `redirectUrl` after an awaited fetch
   *  without tripping popup blockers. Used by actions like `sso_as_owner`. */
  opensInNewTab?: boolean;
  /** Zero-roundtrip new-tab target: a path template (`{recordId}` placeholder)
   *  the handler navigates the pre-opened tab to IMMEDIATELY on click, skipping
   *  the action POST entirely. Only valid with `opensInNewTab`; the endpoint
   *  must perform all auth/authz itself (e.g. the cloud `/sso-open` endpoint,
   *  which re-runs every check the POST half would have done). */
  newTabUrl?: string;

  // ── Spec-owned keys, promoted from the index signature ─────────────────────
  //
  // objectstack#4075 step 2. Step 1's inventory found 18 keys that
  // `@objectstack/spec`'s `ActionSchema` owns and that authored metadata
  // carries today, but that `ActionDef` never declared — so they reached
  // readers only through `[key: string]: any`, and the two `ActionEngine`
  // actually reads (`visible`, `locations`) had to be read through an `as any`
  // cast. Declaring them is what removes those casts.
  //
  // Every type below is DERIVED from the spec via `SpecActionInput[...]`, never
  // hand-copied: a hand-written duplicate of a spec shape is a second contract
  // that drifts silently, which is the failure this whole issue is about.
  //
  // Derived from `z.input` (`ActionInput`), not `z.infer` (`Action`), and the
  // difference is load-bearing rather than stylistic. `ActionSchema` is a
  // `ZodPipe` whose transforms narrow the authored shape — `visible` is authored
  // as `string | { dialect, source }` but INFERS to the object form alone. This
  // runner consumes authored/stored rows, which #3903 established are rehydrated
  // UNPARSED, so it sees the input shape. Deriving from `Action` would have
  // type-errored the raw-string predicate that `ActionEngine` explicitly
  // supports and that `ActionEngine.visibility.test.ts` pins.
  //
  // `shortcut` and `bulkEnabled` land here as `undefined`, not as a usable type
  // — that is correct and deliberate. Spec 17 retired both as `retiredKey()`
  // tombstones (`z.never()`), so authoring either is a hard parse rejection.
  // Deriving rather than hand-writing turns that rejection into a COMPILE error
  // for free; hand-copying would have re-legitimized two dead keys.

  /** Where this action renders (`record_header`, `list_toolbar`, …). Read by
   *  `ActionEngine.registerActions` to seed the location filter. */
  locations?: SpecActionInput['locations'];
  /**
   * Visibility predicate, evaluated against the runner's context.
   *
   * The `boolean` arm is objectui's own, deliberately wider than the spec:
   * `ActionSchema.visible` admits only a CEL string or a `{ dialect, source }`
   * envelope, while `ActionEngine.getActionsForLocation` also honours a literal
   * `visible: true` / `false` (pinned by `ActionEngine.visibility.test.ts`).
   * Declared rather than left to the index signature so the tolerance is
   * auditable instead of invisible — but it IS a dialect, and objectstack#4075
   * step 3 has to decide whether the spec adopts the boolean or objectui drops
   * it. Do not widen this further.
   */
  visible?: SpecActionInput['visible'] | boolean;
  /** System permissions the caller must ALL hold for the action to be offered
   *  (ADR-0066 D4 UI half — the server enforces the source of truth). */
  requiredPermissions?: SpecActionInput['requiredPermissions'];
  /** Icon name for the rendered control. */
  icon?: SpecActionInput['icon'];
  /** Visual emphasis of the rendered control (`primary`, `danger`, …). */
  variant?: SpecActionInput['variant'];
  /** Sort weight among sibling actions. */
  order?: SpecActionInput['order'];
  /** Which renderer surfaces the action (`action:button`, `action:menu`, …). */
  component?: SpecActionInput['component'];
  /** Object this action is declared against. */
  objectName?: SpecActionInput['objectName'];
  /** AI affordance metadata (tool exposure, prompts). */
  ai?: SpecActionInput['ai'];
  /** Accessibility overrides for the rendered control. */
  aria?: SpecActionInput['aria'];
  /** Extra properties merged into the request body alongside the collected params. */
  bodyExtra?: SpecActionInput['bodyExtra'];
  /** How collected params are shaped into the request body (`flat` or nested). */
  bodyShape?: SpecActionInput['bodyShape'];
  /** Execution mode of the action. */
  mode?: SpecActionInput['mode'];
  /** Field on the record supplying the record id sent to the endpoint. */
  recordIdField?: SpecActionInput['recordIdField'];
  /** Request-parameter name carrying the record id. */
  recordIdParam?: SpecActionInput['recordIdParam'];
  /** Auth/tenancy feature the action requires before it is offered. */
  requiresFeature?: SpecActionInput['requiresFeature'];
  /**
   * @deprecated Retired in `@objectstack/spec` 17 as a `retiredKey()` tombstone —
   * authoring it is a hard parse rejection, so this resolves to `undefined` and
   * assigning a value is a compile error. A HOST may still pass a shortcut
   * explicitly via `ActionEngine.registerAction(action, { shortcut })`; it is
   * only no longer sourced from authored metadata. No replacement key.
   */
  shortcut?: SpecActionInput['shortcut'];
  /**
   * @deprecated Retired in `@objectstack/spec` 17 as a `retiredKey()` tombstone —
   * authoring it is a hard parse rejection, so this resolves to `undefined` and
   * assigning a value is a compile error. Use the list view's `bulkActions` /
   * `bulkActionDefs` instead; `ActionEngine.registerAction(action, { bulkEnabled })`
   * remains available to a HOST passing it explicitly.
   */
  bulkEnabled?: SpecActionInput['bulkEnabled'];

  /** Any additional properties */
  [key: string]: any;
}

/**
 * A handler registered with {@link ActionRunner} — the client-side action
 * dispatch seam: given an authored `ActionDef` and the invocation context,
 * produce an `ActionResult`.
 *
 * NOT the spec's `ActionHandler` (`@objectstack/spec/ui`), whose name this type
 * carried until objectstack#4115. That one is the SERVER-side objectql action
 * handler — a different calling convention entirely (`(ctx) => unknown`, with
 * validated params and a trusted engine facade on `ctx`) and a different
 * execution site.
 */
export type ActionRunnerHandler = (
  action: ActionDef,
  context: ActionContext
) => Promise<ActionResult> | ActionResult;

/**
 * Confirmation handler — replaces window.confirm.
 * Consumers can provide an async implementation (e.g., Shadcn AlertDialog).
 */
export type ConfirmationHandler = (message: string, options?: {
  title?: string;
  confirmText?: string;
  cancelText?: string;
}) => Promise<boolean>;

/**
 * Toast handler — consumers can wire to Sonner or any toast library.
 */
export type ToastHandler = (message: string, options?: {
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  /** When set, the toast offers an "Undo" affordance (the runner has already
   *  pushed the operation onto the global UndoManager). */
  undo?: { label?: string };
}) => void;

/**
 * Modal handler — consumers provide to render modal dialogs.
 */
export type ModalHandler = (schema: any, context: ActionContext) => Promise<ActionResult>;

/**
 * Navigation handler — consumers provide for SPA-aware routing.
 */
export type NavigationHandler = (url: string, options?: {
  external?: boolean;
  newTab?: boolean;
  replace?: boolean;
}) => void;

/**
 * Param collection handler — consumers provide to show a dialog
 * for collecting ActionParam values before action execution.
 * Returns collected values, or null if cancelled.
 */
export type ParamCollectionHandler = (
  params: ActionParamDef[],
  action?: ActionDef,
) => Promise<Record<string, any> | null>;

/**
 * Result dialog spec — declarative description of how to render a
 * one-shot reveal of an action's API response. Mirrors
 * `Action.resultDialog` in @objectstack/spec.
 *
 * When set on an action and the action succeeds, the runner suppresses
 * the success toast and awaits a ResultDialogHandler instead. Used for
 * values the user must copy NOW (2FA secret, OAuth client_secret, backup
 * codes).
 */
export interface ResultDialogFieldSpec {
  path: string;
  label?: string;
  format?: 'qrcode' | 'code-list' | 'secret' | 'text' | 'json';
}
export interface ResultDialogSpec {
  title?: string;
  description?: string;
  acknowledge?: string;
  format?: 'qrcode' | 'code-list' | 'secret' | 'text' | 'json';
  fields?: ResultDialogFieldSpec[];
}

/**
 * Result dialog handler — consumers provide to render the post-success
 * reveal dialog. Returns a promise that resolves when the user
 * acknowledges. Errors / rejections are treated as acknowledge for
 * cleanup purposes (the action already succeeded).
 */
export type ResultDialogHandler = (
  spec: ResultDialogSpec,
  data: unknown,
  action?: ActionDef,
) => Promise<void>;

/**
 * One entry of a param's option list, as the RESOLVED param carries it.
 *
 * `label` / `value` are the two keys this layer itself reads and rewrites (i18n
 * translation of the label, value matching). Everything else an option declares
 * rides along in the catch-all and reaches the widgets untouched: per-option
 * `visibleWhen` (the CEL predicate `resolveVisibleOptions()` filters on —
 * ADR-0058 / #2284), `color`, `icon`, `disabled`.
 *
 * The catch-all is deliberate rather than a closed key list (objectui#3559).
 * A field's option vocabulary is owned by the field metadata (`@objectstack/spec`'s
 * `SelectOptionSchema`) and read by the option widgets; a param's option list is
 * only a CONDUIT between the two. When this type restated that vocabulary as
 * `{ label, value }`, the resolver dutifully rebuilt every inherited option to
 * match and a field's `visibleWhen` stopped narrowing the dialog's list — the
 * same field metadata behaving two ways on two surfaces. Naming the two keys
 * this layer uses and passing the rest through is what keeps that from
 * recurring; it is NOT an invitation to author new resolved-only option keys
 * (the spec's schema is the authoring gate, and it is `.strict()`).
 */
export type ActionParamOption = {
  label: string;
  value: string;
  [key: string]: unknown;
};

/**
 * ActionParam definition accepted by the runner.
 * Compatible with @objectstack/spec ActionParam.
 *
 * The RESOLVED shape — what `resolveActionParams()` emits and `ActionParamDialog`
 * reads, after a field-backed param's `{ field }` reference has been inlined.
 * The AUTHORING counterpart is `@object-ui/types`' `ActionParam` (objectui#3174).
 *
 * `validation?: string` used to sit here too, and was removed by objectui#3201:
 * no producer ever wrote it (it was never a key of `resolveActionParams()`'s
 * `RawActionParam`, and the runtime field metadata a field-backed param inherits
 * from carries no `validation` either) and no consumer ever read it —
 * `paramToField()` did not map it, so it never reached the field widgets, whose
 * rules `buildValidationRules()` builds from `required` / `minLength` /
 * `maxLength` / `pattern`. Declaring it on the resolved side only invited the
 * authoring side to declare it back.
 */
export interface ActionParamDef {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: ActionParamOption[];
  defaultValue?: unknown;
  helpText?: string;
  placeholder?: string;
  /**
   * Visibility predicate (CEL) evaluated against the same scope as action
   * `visible` (`current_user` / `app` / `data` / `features`). When it evaluates
   * false the param dialog omits this param — used to hide a param the backend
   * only accepts under an opt-in capability (e.g. `create_user.phoneNumber`
   * gated on `features.phoneNumber`). Absent = always visible.
   */
  visible?: string;

  // ── Widget config (shared form field-widget renderer) ─────────────
  // `ActionParamDialog` renders every param through the same field widgets
  // the object form uses (ADR-0059), so params carry the widget-relevant
  // config for their type. Mirrors `ActionParamSchema` in @objectstack/spec.
  /** Accepted upload types (MIME types / extensions) for `file`/`image` params. */
  accept?: string[];
  /** Max upload size in bytes for `file`/`image` params. */
  maxSize?: number;
  /** Allow multiple values (file/image/lookup/user params → array value). */
  multiple?: boolean;

  // ── Lookup-/reference-type metadata ───────────────────────────────
  // Populated by `resolveActionParams()` when a field-backed param resolves
  // to a `lookup` or `reference` field. Forwarded to `<LookupField>` inside
  // `ActionParamDialog` so the user gets a real record picker (popover +
  // RecordPickerDialog) instead of a plain text input.
  /** Object name the lookup picker queries (`reference_to` on the field). */
  referenceTo?: string;
  /** Field on the referenced record used as the human label (default `name`). */
  displayField?: string;
  /** Field used as the option value (default `id`). */
  idField?: string;
  /** Optional secondary line shown under the label in the picker. */
  descriptionField?: string;
  /** Template (e.g. `{first_name} {last_name}`) used to build the label. */
  titleFormat?: string;
  /** Column definitions surfaced in the enterprise `RecordPickerDialog`. */
  lookupColumns?: unknown[];
  /** Server-side filters applied when querying lookup candidates. */
  lookupFilters?: unknown[];
  /** Page size for the typeahead popover. */
  lookupPageSize?: number;
  /** Form-field dependencies that gate / parameterise the picker query. */
  dependsOn?: unknown[];
}

/**
 * Bind the server-CEL-parity `os.user` identity alias into an action context
 * (#2358 trap 1). `@objectstack/spec` documents the canonical CEL identity
 * scope as `os.user.*` (server formula / validation / sharing), while client
 * contexts historically only bound `user`. Deriving the alias here means an
 * action `visible` predicate authored as `os.user.role == "admin"` evaluates
 * identically on client and server instead of throwing (and being fail-closed
 * hidden). `os.user` always tracks `context.user`; other consumer-provided
 * keys under `os` are preserved.
 */
function withIdentityAlias(context: ActionContext): ActionContext {
  const user = context.user;
  if (user === undefined) return context;
  const os = context.os;
  if (os && typeof os === 'object' && os.user === user) return context;
  return { ...context, os: { ...(os && typeof os === 'object' ? os : {}), user } };
}

/**
 * Did this action declare a gate at all — i.e. is there a CONDITION for the
 * evaluator to reach a verdict on? (objectui#3848 for `disabled`, objectui#3872
 * for `condition`)
 *
 * ## One definition, two gates — why this is not two helpers
 *
 * `execute` has two predicate gates, and both need this ONE question answered
 * before evaluating. They need it for OPPOSITE reasons, which is exactly why the
 * question has to be asked separately from the verdict:
 *
 *   - `disabled` (objectui#3848): an EMPTY predicate must not be handed to
 *     `evaluateCondition`, whose answer for "no condition" is `true` = BLOCKED.
 *   - `condition` (objectui#3872): a DECLARED-FALSE predicate must not be
 *     skipped by a truthiness test. `if (action.condition)` never asked whether
 *     a gate was declared, so `condition: false` — the most explicit "never
 *     execute" an author can write — landed on `if (false)`, the evaluator was
 *     never consulted, and the action RAN. Measured on `origin/main` @
 *     `2937bcf7d`: `condition: false` → `{"success":true}`, handler ran, while
 *     the semantically identical `{ dialect: 'cel', source: 'false' }` was
 *     refused. Asking "declared?" routes `false` to `evaluateCondition`, which
 *     short-circuits booleans (`if (typeof condition === 'boolean') return
 *     condition`) and blocks.
 *
 * The scope of "empty predicate" below is objectui#3850's ruling (`''` /
 * whitespace-only / empty-`source` envelope are NOT declared), so both gates
 * read the same one. A second module-private twin of the same question in this
 * one file is the drift the closing scope note refuses; the name is therefore
 * key-neutral, and the `disabled` gate's semantics and message are unchanged by
 * objectui#3872.
 *
 * `ExpressionEvaluator.evaluateCondition` documents and implements one default
 * for "there is no condition here": it returns `true`, meaning
 * *visible/enabled*. That default is correct on `visible` / `enabled`, and
 * INVERTED on `disabled`, where `true` means "blocked". So the execution gate
 * must decide "is there a condition?" itself, BEFORE evaluating — asking
 * `!= null && !== false` (what it used to ask) hands every empty predicate to a
 * function whose answer for "nothing to evaluate" is the strongest possible
 * "yes, disabled". Measured consequence: `disabled: ''` returned
 * `{ success: false, error: 'Action is disabled' }` and the handler never ran.
 *
 * The shapes `evaluateCondition` itself calls "no condition" are `null` /
 * `undefined` / `''` / a whitespace-only string (`if (!trimmed) return true`) /
 * an envelope whose `source` is blank. This gate excludes exactly those:
 *
 *   - `toPredicateInput` is core's single predicate normalizer and already maps
 *     `''`, `null`, `undefined`, an empty-`source` envelope, and any
 *     non-predicate junk (`0`, `{}`) to `undefined` = "nothing to evaluate".
 *   - the whitespace-only string is the one shape it does NOT collapse (it
 *     wraps it as `'${   }'`), so it is named here. This is the same blank-source
 *     rule core's other predicate entry already applies —
 *     `evalRowPredicate` (`evaluator/listConditional.ts`) returns its fallback
 *     for `!source.trim()`.
 *
 * ## Why the gate normalizes but the VERDICT still reads the raw value
 *
 * `evaluateCondition(toPredicateInput(raw))` is NOT interchangeable with
 * `evaluateCondition(raw)` for a string that is ALREADY a `${…}` template:
 * `toPredicateInput` assumes a bare expression and wraps unconditionally, so
 * `'${x}'` becomes `'${${x}}'`, which no longer matches the single-template
 * fast path, fails to parse, and comes back as the original NON-EMPTY STRING —
 * `Boolean(…)` = `true`. A `${…}`-spelled `disabled` predicate evaluated that
 * way is therefore ALWAYS "disabled", whatever it says. Measured on this tree:
 * `disabled: '${user.role === "guest"}'` (false, admin context) → blocked.
 * On `condition` the same trap points the other way — a constant `true` would
 * make every template-spelled `condition` always EXECUTE — so that gate also
 * normalizes only to decide declaredness and evaluates the RAW value, keeping
 * the verdict `ActionRunner.test.ts` has pinned for that spelling all along.
 *
 * So the value handed to the evaluator is left exactly as it was. Every
 * non-empty shape — boolean, bare CEL, `${…}` template, `{ dialect, source }`
 * envelope — keeps the verdict it reaches today, and this change can only stop
 * blocking things, never start. The double-wrap itself is a defect of
 * `toPredicateInput`, live at the action renderers and `ActionEngine` (which do
 * compose it that way) and filed separately; `SchemaRenderer` and `page:header`
 * both evaluate the raw value and both pin the correct verdict for that
 * spelling, which is the behaviour preserved here.
 *
 * Scope note: `hasDeclaredVisibilityGate`
 * (`components/renderers/action/visibility-gate.ts`, `!= null && !== ''`) is
 * the renderer-side spelling of this question. It is deliberately NOT reused or
 * moved: it lives in a package that depends on this one, it does not cover the
 * empty-`source` envelope (objectui#3850) or the whitespace string, and
 * objectui#3850 is the queued ruling on unifying the scope of "empty
 * predicate" across the sites. Kept module-private until that lands — one
 * definition, one module, no new exported dialect of the same question.
 *
 * Nor is the `visible`-filter template in `ActionEngine.getActionsForLocation`
 * copied wholesale: its non-predicate branch keeps a historical
 * `Boolean(raw)` coercion, so `0` there means "hidden" — fail-CLOSED on junk,
 * the opposite of what this module already committed to for `disabled`
 * (`catch { isDisabled = false }`). A value that is not a predicate at all must
 * not decide an action's fate, on either key, so `0` / `{}` are "no gate" here.
 */
function hasDeclaredPredicate(value: unknown): boolean {
  if (typeof value === 'string' && value.trim() === '') return false;
  return toPredicateInput(value) !== undefined;
}

export class ActionRunner {
  private handlers = new Map<string, ActionRunnerHandler>();
  private scripts = new Map<string, ActionRunnerHandler>();
  private evaluator: ExpressionEvaluator;
  private context: ActionContext;
  private confirmHandler: ConfirmationHandler;
  private toastHandler: ToastHandler | null;
  private modalHandler: ModalHandler | null;
  private navigationHandler: NavigationHandler | null;
  private paramCollectionHandler: ParamCollectionHandler | null;
  private resultDialogHandler: ResultDialogHandler | null;

  /**
   * Built-in dispatch, one entry per runnable action type.
   *
   * A table rather than a `switch` because the type annotation is the guard:
   * `Record<RunnableActionType, …>` stops compiling the moment
   * `@objectstack/spec` adds an `ActionType` this runner has no executor for.
   * That is the whole Tier-2 failure class for actions — a spec name that
   * validates at save and then does nothing at run time (#2942) — converted
   * into a build error. It also rejects the reverse: an executor keyed by a
   * name that is neither in the spec nor a declared local alias.
   *
   * `navigation` is that declared alias (see `ObjectUiLocalActionType`); it
   * shares `url`'s navigator.
   */
  private readonly builtinExecutors: Record<
    RunnableActionType,
    (action: ActionDef) => Promise<ActionResult>
  > = {
    script: (action) => this.executeScript(action),
    url: (action) => this.executeUrl(action),
    modal: (action) => this.executeModal(action),
    flow: (action) => this.executeFlow(action),
    api: (action) => this.executeAPI(action),
    form: (action) => this.executeForm(action),
    navigation: (action) => this.executeNavigation(action),
  };

  constructor(context: ActionContext = {}) {
    this.context = withIdentityAlias(context);
    this.evaluator = new ExpressionEvaluator(this.context);
    // Default confirmation: window.confirm (can be overridden)
    this.confirmHandler = async (message: string) => window.confirm(message);
    this.toastHandler = null;
    this.modalHandler = null;
    this.navigationHandler = null;
    this.paramCollectionHandler = null;
    this.resultDialogHandler = null;
  }

  /**
   * Set a custom confirmation handler (e.g., Shadcn AlertDialog).
   */
  setConfirmHandler(handler: ConfirmationHandler): void {
    this.confirmHandler = handler;
  }

  /**
   * Set a custom toast handler (e.g., Sonner).
   */
  setToastHandler(handler: ToastHandler): void {
    this.toastHandler = handler;
  }

  /**
   * Set a modal handler (e.g., render a Dialog via React state).
   */
  setModalHandler(handler: ModalHandler): void {
    this.modalHandler = handler;
  }

  /**
   * Set a navigation handler (e.g., React Router navigate).
   */
  setNavigationHandler(handler: NavigationHandler): void {
    this.navigationHandler = handler;
  }

  /**
   * Set a param collection handler — shows a dialog to collect
   * ActionParam values before action execution.
   */
  setParamCollectionHandler(handler: ParamCollectionHandler): void {
    this.paramCollectionHandler = handler;
  }

  /**
   * Set a result dialog handler — shows a one-shot reveal dialog after
   * a successful action whose spec declares `resultDialog`. Used for
   * values the user must copy now (2FA codes, OAuth client_secret).
   */
  setResultDialogHandler(handler: ResultDialogHandler): void {
    this.resultDialogHandler = handler;
  }

  registerHandler(actionName: string, handler: ActionRunnerHandler): void {
    this.handlers.set(actionName, handler);
  }

  unregisterHandler(actionName: string): void {
    this.handlers.delete(actionName);
  }

  /**
   * Register a named script handler. When a `script` action's
   * `target`/`execute` matches the registered name, the handler runs
   * instead of the expression evaluator. Lets dashboards/views wire
   * symbolic action names (e.g. 'export_dashboard_pdf') to JS callbacks.
   */
  registerScript(scriptName: string, handler: ActionRunnerHandler): void {
    this.scripts.set(scriptName, handler);
  }

  unregisterScript(scriptName: string): void {
    this.scripts.delete(scriptName);
  }

  async execute(action: ActionDef): Promise<ActionResult> {
    try {
      // `ActionDef` accepts any key of any type, so a typo (`targt`) and a
      // retired key (`execute`) both reach here having type-checked. Neither
      // binds a handler, and binding no handler silently is the #2169 "Mark Done
      // does nothing" shape. Dev-only, warn-once, changes nothing (#4075 step 1).
      warnOnUnknownActionKeys(action);

      // Resolve the action type
      const actionType = action.type || action.actionType || action.name || '';

      // Conditional execution. Ask "is a `condition` gate DECLARED?" — not "is
      // the raw value truthy?" (objectui#3872). Truthiness cannot answer that
      // question, and on this key it answered it in the OVER-PERMISSIVE
      // direction: `condition: false` (the most explicit "never execute" an
      // author can write, and what a template that switches an action off
      // emits) fell on `if (false)`, so the evaluator was never consulted and
      // the action executed anyway — while the semantically identical
      // `{ dialect: 'cel', source: 'false' }` was refused. `evaluateCondition`
      // short-circuits booleans, so once the gate asks the right question the
      // verdict needs no boolean branch of its own. See `hasDeclaredPredicate`
      // for the shared "declared?" scope (objectui#3850) and for why the verdict
      // still reads the RAW value (`toPredicateInput` double-wraps an
      // already-`${…}` string into a constant true — objectui#3871 — which on
      // THIS key would mean "always execute").
      if (hasDeclaredPredicate(action.condition)) {
        const shouldExecute = this.evaluator.evaluateCondition(action.condition);
        if (!shouldExecute) {
          return { success: false, error: 'Action condition not met' };
        }
      }

      // Ask "is a `disabled` gate DECLARED?" — not "is the key present and not
      // `false`?" (objectui#3848). The old test let every EMPTY predicate reach
      // `evaluateCondition`, whose answer for "no condition" is `true`, which on
      // this key means BLOCKED: `disabled: ''` / `'   '` /
      // `{ dialect: 'cel', source: '' }` all returned `Action is disabled` with
      // the handler never invoked. See `hasDeclaredPredicate` above for why the
      // gate normalizes to decide but the verdict below still reads the RAW
      // value (`toPredicateInput` double-wraps an already-`${…}` string).
      if (hasDeclaredPredicate(action.disabled)) {
        // `disabled` may be a boolean, a CEL string, or the normalized envelope
        // `{ dialect, source }` (what `objectstack build` emits). The previous
        // code only evaluated the STRING form and treated any object as truthy,
        // so an envelope-disabled action was ALWAYS "disabled" — silently
        // blocking every execution (param dialog never opened, handler never
        // ran). `evaluateCondition` already handles boolean/string/envelope;
        // and the renderers are authoritative for the visual disabled state, so
        // any eval failure here defaults to NOT-disabled (don't false-block).
        let isDisabled = false;
        try {
          isDisabled = this.evaluator.evaluateCondition(action.disabled as never);
        } catch {
          isDisabled = false;
        }
        if (isDisabled) {
          return { success: false, error: 'Action is disabled' };
        }
      }

      // Confirmation (structured or simple)
      const confirmMessage = action.confirm?.message || action.confirmText;
      if (confirmMessage) {
        const confirmed = await this.confirmHandler(
          this.evaluator.evaluate(confirmMessage) as string,
          action.confirm ? {
            title: action.confirm.title,
            confirmText: action.confirm.confirmText,
            cancelText: action.confirm.cancelText,
          } : undefined,
        );
        if (!confirmed) {
          return { success: false, error: 'Action cancelled by user' };
        }
      }

      // Param collection: if the action defines ActionParam[] to collect,
      // show a dialog to gather user input before executing.
      // Spec defines this as `params: ActionParam[]`; ActionRunner historically
      // used `actionParams` to disambiguate from the static-params object that
      // some custom handlers consume. Accept both — when `params` is an array,
      // treat it as the input-collection definition.
      const paramDefs: ActionParamDef[] | undefined =
        action.actionParams && Array.isArray(action.actionParams) ? action.actionParams
          : (Array.isArray(action.params) ? (action.params as unknown as ActionParamDef[]) : undefined);
      if (paramDefs && paramDefs.length > 0) {
        if (this.paramCollectionHandler) {
          const collected = await this.paramCollectionHandler(paramDefs, action);
          if (collected === null) {
            return { success: false, error: 'Action cancelled by user (params)' };
          }
          // Merge collected params into action.params as a values map for downstream consumers.
          // Preserve any pre-attached row context (`_rowRecord`) used by list_item
          // actions so downstream handlers (apiHandler) can inject the row id.
          const priorParams: Record<string, any> = Array.isArray(action.params) ? {} : (action.params as Record<string, any> || {});
          const rowRecord = priorParams._rowRecord;
          action.params = { ...priorParams, ...collected };
          if (rowRecord !== undefined) (action.params as Record<string, any>)._rowRecord = rowRecord;
        }
      }

      // Check for a registered custom handler first
      if (actionType && this.handlers.has(actionType)) {
        const handler = this.handlers.get(actionType)!;
        const result = await handler(action, this.context);
        await this.handlePostExecution(action, result);
        return result;
      }

      // Built-in action execution by type.
      let result: ActionResult;
      const builtin = actionType
        ? this.builtinExecutors[actionType as RunnableActionType]
        : undefined;

      if (builtin) {
        result = await builtin(action);
      } else if (action.navigate) {
        // Legacy fallback: check for navigate, api, or onClick
        result = await this.executeNavigation(action);
      } else if (action.api || action.endpoint) {
        result = await this.executeAPI(action);
      } else if (action.onClick) {
        await action.onClick();
        result = { success: true };
      } else {
        result = await this.executeActionSchema(action);
      }

      await this.handlePostExecution(action, result);
      return result;
    } catch (error) {
      const result: ActionResult = { success: false, error: (error as Error).message };
      await this.handlePostExecution(action, result);
      return result;
    }
  }

  /**
   * Execute multiple actions in sequence or parallel.
   */
  async executeChain(
    actions: ActionDef[],
    mode: 'sequential' | 'parallel' = 'sequential'
  ): Promise<ActionResult> {
    if (actions.length === 0) {
      return { success: true };
    }

    if (mode === 'parallel') {
      const results = await Promise.allSettled(
        actions.map(a => this.execute(a))
      );
      const failures = results.filter(
        r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      );
      if (failures.length > 0) {
        const firstFail = results.find(
          r => r.status === 'fulfilled' && !r.value.success
        ) as PromiseFulfilledResult<ActionResult> | undefined;
        return {
          success: false,
          error: firstFail?.value?.error || 'One or more parallel actions failed',
        };
      }
      const lastResult = results[results.length - 1];
      return lastResult.status === 'fulfilled'
        ? lastResult.value
        : { success: false, error: 'Action failed' };
    }

    // Sequential execution — stop on first failure
    let lastResult: ActionResult = { success: true };
    for (const action of actions) {
      lastResult = await this.execute(action);
      if (!lastResult.success) {
        return lastResult;
      }
    }
    return lastResult;
  }

  /**
   * Post-execution: emit toast notifications, handle chaining, callbacks.
   */
  private async handlePostExecution(action: ActionDef, result: ActionResult): Promise<void> {
    // resultDialog SUPPRESSES the successMessage toast — these are one-shot
    // reveals (2FA codes, fresh OAuth secrets) where a toast would let the
    // user dismiss the value before copying it. The reveal dialog itself
    // requires explicit acknowledgement; we await it here so refreshAfter
    // / chain steps don't fire until the user closes the dialog.
    const hasResultDialog = !!(action.resultDialog && result.success);

    // Toast notifications
    if (this.toastHandler) {
      const showToast = action.toast ?? { showOnSuccess: true, showOnError: true };
      const duration = action.toast?.duration;

      if (result.success && !hasResultDialog && !result.silent && showToast.showOnSuccess !== false) {
        // Prefer a DYNAMIC message the server returned (result.data.message)
        // over the static action.successMessage. Server-driven actions like
        // check_app_updates / publish / install compute a real outcome
        // ("2 app updates available: CRM 1.0.0→1.0.1", "Published v1.2.0")
        // that the static label can't express; without this the user only ever
        // sees a generic "Done". Falls back to the static label, then a default.
        const dyn = (result.data && typeof result.data === 'object'
          && typeof (result.data as { message?: unknown }).message === 'string')
          ? String((result.data as { message?: unknown }).message).trim()
          : '';
        const message = dyn || action.successMessage || 'Action completed successfully';
        // Undoable action: register the captured operation on the global
        // UndoManager and surface an "Undo" affordance on the toast (the
        // consumer's toast handler wires the button to UndoManager).
        if (result.undo) {
          try { globalUndoManager.push(result.undo); } catch { /* non-fatal */ }
        }
        this.toastHandler(message, { type: 'success', duration, undo: result.undo ? {} : undefined });
      }

      if (!result.success && showToast.showOnError !== false && result.error) {
        // `result.error` is typed as a string, but a handler bug can leak an
        // error OBJECT (e.g. the ObjectStack `{ code, message }` envelope)
        // through here — and a non-string toast payload is rendered as a React
        // child, crashing the page (React #31). Coerce defensively at this
        // single sink so no handler can take the whole page down.
        const raw: unknown = action.errorMessage || result.error;
        const message = typeof raw === 'string'
          ? raw
          : (raw && typeof (raw as { message?: unknown }).message === 'string')
            ? (raw as { message: string }).message
            : 'Action failed';
        this.toastHandler(message, { type: 'error', duration });
      }
    }

    // Open the reveal dialog. If no handler is registered we still mark the
    // execution successful but log — better to lose the value visibility
    // than to silently re-toast and dismiss it.
    if (hasResultDialog) {
      if (this.resultDialogHandler) {
        try {
          await this.resultDialogHandler(action.resultDialog!, result.data, action);
        } catch (err) {
          // Acknowledgement failure is non-fatal; the underlying action already
          // succeeded. Log so consumers can wire it through their error reporter.
          // eslint-disable-next-line no-console
          console.warn('[ActionRunner] resultDialog handler rejected; treating as acknowledged', err);
        }
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          '[ActionRunner] action.resultDialog set but no resultDialogHandler registered — the response value will not be shown to the user.',
          { action: action.name, data: result.data }
        );
      }
    }

    // Apply refreshAfter from UIActionSchema
    if (action.refreshAfter && result.success) {
      result.reload = true;
    }

    // Execute chained actions
    if (action.chain && action.chain.length > 0 && result.success) {
      const chainResult = await this.executeChain(
        action.chain,
        action.chainMode || 'sequential'
      );
      // Merge chain result
      if (!chainResult.success) {
        result.success = false;
        result.error = chainResult.error;
      }
      if (chainResult.data) result.data = chainResult.data;
      if (chainResult.redirect) result.redirect = chainResult.redirect;
      if (chainResult.reload) result.reload = true;
    }

    // Execute onSuccess/onFailure callbacks
    if (result.success && action.onSuccess) {
      const callbacks = Array.isArray(action.onSuccess) ? action.onSuccess : [action.onSuccess];
      await this.executeChain(callbacks, 'sequential');
    }
    if (!result.success && action.onFailure) {
      const callbacks = Array.isArray(action.onFailure) ? action.onFailure : [action.onFailure];
      await this.executeChain(callbacks, 'sequential');
    }
  }

  /**
   * Execute script action — evaluates client-side expression via ExpressionEvaluator.
   * Supports ${} template expressions referencing data, record, user context.
   */
  private async executeScript(action: ActionDef): Promise<ActionResult> {
    // `target` is the only handler slot. The `execute` alias was removed in
    // @objectstack/spec 17 (#3855), which rejects an authored `execute` at parse
    // with the rename prescription — so parsed metadata cannot carry it and a
    // `target || execute` fallback could only ever evaluate to `target` (#3856).
    const script = action.target;
    if (!script) {
      // A spec `body` IS a script — this runner just cannot run one (see the
      // `body` field docs). Saying "no script provided" would send the author
      // hunting for a missing field they actually wrote, so name the real
      // cause and the remedy instead. Checked before the retired `execute` key:
      // a `body` action ignores `target`, so "rename it" would be wrong advice.
      if (action.body != null) {
        return {
          success: false,
          error:
            'Action body must be executed server-side — this client runner does not interpret ' +
            '`body` (sandboxed JS needs an isolated VM; expression bodies use the formula engine). ' +
            'Register a `script` handler that POSTs to /api/v1/actions/{object}/{action} — ' +
            'build one with createServerActionHandler from @object-ui/core.',
        };
      }
      // ActionDef is open-ended (`[key: string]: any`), so hand-authored
      // metadata that never passed through the spec parser still compiles with
      // the retired key. Carry the same prescription the spec's tombstone does,
      // for the same reason: a bare "no script provided" reads as "you forgot a
      // field" to an author who did write one.
      if (typeof action.execute === 'string') {
        return {
          success: false,
          error:
            '`execute` was removed in @objectstack/spec 17 — rename the key to `target`. ' +
            'The value (a script name or expression) is unchanged. ' +
            'Run `os migrate meta --from 16` to rewrite it automatically.',
        };
      }
      return { success: false, error: 'No script provided for script action' };
    }

    // Named script registry wins over the expression evaluator. This lets
    // dashboards/views bind a symbolic action name (e.g. 'export_dashboard_pdf')
    // to a JS callback without piping the literal through ExpressionEvaluator.
    const named = this.scripts.get(script);
    if (named) {
      try {
        return await named(action, this.context);
      } catch (error) {
        return { success: false, error: `Script execution failed: ${(error as Error).message}` };
      }
    }

    try {
      let result = this.evaluator.evaluate(`\${${script}}`);
      // The expression itself is synchronous, but a formula function it calls
      // may kick off an async write and return a Promise. Await it so the
      // caller's success/failure — and the post-execution toast — reflects
      // whether that write actually completed, not just that we called it.
      if (result != null && typeof (result as any).then === 'function') {
        result = await result;
      }
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: `Script execution failed: ${(error as Error).message}` };
    }
  }

  /**
   * Execute URL action — navigate to a URL.
   * Uses navigationHandler for SPA routing, falls back to window.location.
   */
  private async executeUrl(action: ActionDef): Promise<ActionResult> {
    const rawUrl = action.target || action.redirect;
    if (!rawUrl) {
      return { success: false, error: 'No URL provided for url action' };
    }
    return this.navigateTo(action, rawUrl, action);
  }

  /**
   * The one navigator behind `type: 'url'` and its `navigation` alias.
   *
   * Both names mean "go to a location", and they had two implementations that
   * drifted: only this one interpolated `${param.X}`, promoted `/api/…` to the
   * `apiBase`, short-circuited a redirect-dance URL to a full-page load, and
   * honoured `openIn`. A `navigation` action was quietly the weaker of the two
   * (#2944 item 3). Sharing the body is what keeps the alias honest.
   *
   * `action` supplies the interpolation context (`params`) and `openIn`;
   * `source` supplies the navigation modifiers, which live on the nested
   * `action.navigate` block for the legacy shape and on the action itself
   * otherwise.
   */
  private async navigateTo(
    action: ActionDef,
    rawUrl: unknown,
    source: ActionDef,
  ): Promise<ActionResult> {
    // Apply target ${param.X} / ${ctx.X} interpolation FIRST — the
    // ExpressionEvaluator that follows would otherwise see unresolved
    // `param.provider` and either error or substitute undefined. Doing it
    // here also URL-encodes values (required for query-position params
    // like `?provider=foo+bar`).
    const interpolated = this.interpolateTarget(rawUrl as string, action);
    let url = this.evaluator.evaluate(interpolated) as string;

    if (!this.isValidUrl(url)) {
      return {
        success: false,
        error: 'Invalid URL scheme. Only http://, https://, and relative URLs are allowed.',
      };
    }

    // Promote same-origin-style `/api/...` paths to absolute when an
    // `apiBase` is provided in context (typical of split SPA + backend
    // dev setups). Without this, `window.location.href = "/api/..."`
    // hits the SPA host (e.g. Vite at :5173), the router has no match,
    // and the browser silently falls back to the home page instead of
    // following better-auth's 302 to the IdP.
    const apiBase = typeof this.context.apiBase === 'string' ? this.context.apiBase.replace(/\/+$/, '') : '';
    if (apiBase && /^\/(api|_auth|_account)\//.test(url)) {
      url = `${apiBase}${url}`;
    }

    // `source.external` is the `navigation` shape's explicit override; the
    // scheme heuristic covers every other case.
    const isExternal =
      Boolean(source.external) || url.startsWith('http://') || url.startsWith('https://');
    // Same-origin API endpoints (most commonly the auth provider's
    // `/api/v1/auth/sign-in/social` redirect dance) issue server-side
    // 302s that must be followed by the *browser*, not the SPA router.
    // Pushing `/api/...` into React Router lands on no matching route
    // and silently falls back to the default page, so the OAuth flow
    // never starts. Short-circuit to a full-page navigation here.
    // For absolute URLs (now also produced by the apiBase prefix above),
    // we need full-page navigation for any URL that is going to issue a
    // server-side redirect dance — better-auth's `/sign-in/social` is the
    // canonical case. Detect "looks like a same-origin API path" both for
    // bare-relative input AND for the apiBase-prefixed form.
    const isApiCall = /\/(api|_auth|_account)\//.test(url) && (isExternal || url.startsWith('/'));
    if (isApiCall) {
      window.location.href = url;
      return { success: true };
    }
    // `openIn` is the first-class, declarative switch (ActionSchema.openIn);
    // it wins over the legacy `navigate.newTab` / `params.newTab` escape
    // hatches and the external-URL heuristic.
    const openIn = source.openIn ?? action.openIn;
    const newTab =
      openIn === 'new-tab' ? true
        : openIn === 'self' ? false
          : (source.newTab ?? action.params?.newTab ?? isExternal);

    // History semantics, the one thing the `navigation` shape carries that
    // `ActionSchema` has no field for. Omitted from the handler call when
    // unset so hosts see the same options object they always did.
    const replace = source.replace ?? action.replace;

    if (this.navigationHandler) {
      this.navigationHandler(url, {
        external: isExternal,
        newTab,
        ...(replace === undefined ? {} : { replace: Boolean(replace) }),
      });
      return { success: true };
    }

    if (newTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      return { success: true, redirect: url };
    }

    return { success: true };
  }

  /**
   * Execute modal action — open a dialog.
   * Delegates to the registered modalHandler; returns modal schema if no handler.
   */
  private async executeModal(action: ActionDef): Promise<ActionResult> {
    const modalSchema = action.modal || action.target || action.params?.schema;
    if (!modalSchema) {
      return { success: false, error: 'No modal schema or target provided for modal action' };
    }

    if (this.modalHandler) {
      return await this.modalHandler(modalSchema, this.context);
    }

    // Return the modal schema for the consumer to render
    return { success: true, modal: modalSchema };
  }

  /**
   * Execute flow action — trigger a workflow/automation.
   * Delegates to a registered 'flow' handler; otherwise returns not-implemented.
   */
  private async executeFlow(action: ActionDef): Promise<ActionResult> {
    const flowName = action.target || action.name;
    if (!flowName) {
      return { success: false, error: 'No flow target provided for flow action' };
    }

    // Check for a registered flow handler (consumers register via registerHandler)
    if (this.handlers.has('flow')) {
      const handler = this.handlers.get('flow')!;
      return await handler(action, this.context);
    }

    return {
      success: false,
      error: `Flow handler not registered. Cannot execute flow: ${flowName}`,
    };
  }

  /**
   * Terminal fallback for a dispatch the switch above did not recognize: no
   * known `type`, no registered handler, no `navigate` / `api` / `endpoint` /
   * `onClick`. Some schema-only shapes are still runnable here — an action
   * whose whole payload is a `redirect`, or an explicit `reload` / `close`
   * directive — so this stays a real execution path.
   *
   * What it must never do is report success for an action it did not run. It
   * used to return `{ success: true, reload: true, close: true }` for a
   * COMPLETELY EMPTY schema, which is how a legacy string row action —
   * dispatched as `{ type: '<action name>' }`, the name landing in the `type`
   * slot — reached the user as a green "Action completed successfully" toast
   * having issued zero requests (objectui#2960). An unresolvable dispatch is a
   * wiring bug; surface it instead of laundering it into a success.
   */
  private async executeActionSchema(action: ActionDef): Promise<ActionResult> {
    const hasApi = !!(action.api || action.endpoint);
    // `reload`/`close` default to true downstream, so only an EXPLICIT `true`
    // counts as declared intent — otherwise every empty schema would look like
    // it asked for a reload and slip back through this guard.
    const declaresBehavior =
      hasApi || !!action.onClick || !!action.redirect
      || action.reload === true || action.close === true;
    if (!declaresBehavior) {
      const label = action.name || action.type || action.actionType || 'action';
      return {
        success: false,
        error: `Action "${label}" is not executable: no handler is registered under that name and it declares no api, endpoint, navigate, redirect or onClick.`,
      };
    }

    const result: ActionResult = { success: true };

    if (hasApi) {
      const apiResult = await this.executeAPI(action);
      if (!apiResult.success) return apiResult;
      result.data = apiResult.data;
    }

    if (action.onClick) {
      await action.onClick();
    }

    result.reload = action.reload !== false;
    result.close = action.close !== false;

    if (action.redirect) {
      result.redirect = this.evaluator.evaluate(action.redirect) as string;
    }

    return result;
  }

  /**
   * `form` action — open a FormView as a routed page (`/forms/:name`, per the
   * spec). `target` is the FormView name. Without this case the action fell
   * through to `executeActionSchema` and silently no-opped (the "Log Time does
   * nothing" report). The current record id is forwarded as `?recordId=` for
   * hosts that support it; the form route ignores unknown query params.
   */
  private async executeForm(action: ActionDef): Promise<ActionResult> {
    const name = this.evaluator.evaluate(action.target) as string;
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'No form target (FormView name) provided for form action' };
    }
    const recordId =
      (this.context.record && (this.context.record as { id?: unknown }).id) ??
      (this.context.data && (this.context.data as { id?: unknown }).id);
    const base = `/forms/${name}`;
    const to = recordId != null ? `${base}?recordId=${encodeURIComponent(String(recordId))}` : base;

    if (this.navigationHandler) {
      this.navigationHandler(to, { external: false });
      return { success: true };
    }
    return { success: true, redirect: to };
  }

  /**
   * `navigation` — objectui's alias of the spec's `url` (`ObjectUiLocalActionType`).
   *
   * Kept because `{ type: 'navigation', to: … }` is authored today
   * (`element:button` CTAs) and because deleting the case would not fail loudly:
   * the action would land in `executeActionSchema` and report success while
   * navigating nowhere. All it does now is resolve the alias's own spelling of
   * the target and hand off to the shared navigator, so the two names cannot
   * drift apart again. Prefer `type: 'url'` + `openIn` in new metadata.
   */
  private async executeNavigation(action: ActionDef): Promise<ActionResult> {
    const nav = (action.navigate || action) as ActionDef;
    const rawUrl = nav.to || nav.target || nav.redirect;
    if (!rawUrl) {
      return { success: false, error: 'No URL provided for navigation action' };
    }
    return this.navigateTo(action, rawUrl, nav);
  }

  /**
   * Execute API action — supports both simple string endpoint and complex ApiConfig.
   */
  private async executeAPI(action: ActionDef): Promise<ActionResult> {
    // Resolve the endpoint: api (string/object), endpoint, or target
    const apiConfig = action.api || action.endpoint || action.target;

    if (!apiConfig) {
      return { success: false, error: 'No API endpoint provided' };
    }

    try {
      let url: string;
      let method: string;
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      let body: any = undefined;
      let responseType: 'json' | 'text' | 'blob' = 'json';

      if (typeof apiConfig === 'string') {
        // Simple string endpoint
        url = this.interpolateTarget(apiConfig, action);
        method = action.method || 'POST';
        body = JSON.stringify(action.params || this.context.data || {});
      } else {
        // Complex ApiConfig
        const config = apiConfig as ApiConfig;
        url = this.interpolateTarget(config.url, action);
        method = config.method || action.method || 'POST';
        headers = { ...headers, ...config.headers };
        responseType = config.responseType || 'json';

        // Build query params
        if (config.queryParams) {
          const searchParams = new URLSearchParams(config.queryParams);
          url = `${url}${url.includes('?') ? '&' : '?'}${searchParams.toString()}`;
        }

        // Build body
        if (config.body) {
          body = typeof config.body === 'string'
            ? config.body
            : JSON.stringify(config.body);
        } else if (method !== 'GET' && method !== 'HEAD') {
          body = JSON.stringify(action.params || this.context.data || {});
        }
      }

      const fetchInit: RequestInit = { method, headers };
      if (body && method !== 'GET' && method !== 'HEAD') {
        fetchInit.body = body;
      }

      const response = await fetch(url, fetchInit);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      let data: any;
      switch (responseType) {
        case 'text':
          data = await response.text();
          break;
        case 'blob':
          data = await response.blob();
          break;
        default:
          data = await response.json();
      }

      return { success: true, data };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Validate URL to prevent javascript: or data: protocol injection.
   */
  private isValidUrl(url: unknown): boolean {
    return typeof url === 'string' && (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('/') ||
      url.startsWith('./')
    );
  }

  /**
   * Substitute `${param.X}` and `${ctx.X}` tokens in an action target.
   *
   * Used by executeUrl and executeAPI so metadata can produce dynamic
   * URLs without coupling to the wider ExpressionEvaluator surface
   * (which would also evaluate operators, member access, etc. — overkill
   * and unsafe for URL-position values).
   *
   * Every substituted value is `encodeURIComponent`'d, since the only
   * legitimate use case so far (better-auth `/sign-in/social?provider=…`)
   * places interpolated values in URL query positions. Callers MUST
   * therefore put tokens after a `?` or `&` — using `${param.x}` inside a
   * path segment will produce percent-encoded slashes, which is the
   * correct behaviour for opaque IDs but would break a literal path
   * fragment.
   *
   * `ctx.origin`, `ctx.user.*`, `ctx.org.*`, `ctx.recordId` are surfaced
   * implicitly from the runner's ActionContext + window, and
   * `ctx.selection.ids` / `ctx.selection.count` reflect the grid's current
   * checkbox selection (`context.selectedRecords`) — `${ctx.selection.ids}`
   * comma-joins the ids via the standard `String(array)` behaviour, so a
   * list_toolbar url/api action can carry the selection without any bulk
   * plumbing (objectui#3139). In an aggregate bulk dispatch,
   * `${param._selectedIds}` interpolates the same ids from the injected
   * param. Consumers can extend by stuffing extra keys under
   * `context.ctx = {...}` before calling `runner.execute()`.
   */
  private interpolateTarget(target: string, action: ActionDef): string {
    if (typeof target !== 'string' || target.indexOf('${') === -1) return target;
    const params = (action.params && typeof action.params === 'object' && !Array.isArray(action.params))
      ? (action.params as Record<string, unknown>)
      : {};
    const ctx = this.buildInterpolationContext();
    return target.replace(/\$\{(param|ctx)\.([\w.]+)\}/g, (_match, scope: string, path: string) => {
      const root = scope === 'param' ? params : ctx;
      const value = readPath(root, path);
      if (value == null) return '';
      return encodeURIComponent(String(value));
    });
  }

  /**
   * Assemble the `ctx` namespace exposed to target interpolation.
   * Built-in keys: origin, user, org, recordId. Anything the consumer
   * placed under context.ctx is merged on top.
   */
  private buildInterpolationContext(): Record<string, unknown> {
    const ctx: Record<string, unknown> = {
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      // Backend API origin (typically `import.meta.env.VITE_SERVER_URL`
      // passed in from the host app). Empty string means "same-origin",
      // which collapses `${ctx.apiBase}/api/...` to a regular relative
      // path — exactly the production-deployment behaviour.
      apiBase: typeof this.context.apiBase === 'string'
        ? this.context.apiBase.replace(/\/+$/, '')
        : '',
      user: this.context.user ?? {},
      org: this.context.org ?? this.context.organization ?? {},
      recordId: this.context.record?.id ?? this.context.recordId,
      // Current list selection (published by the grid as `selectedRecords`).
      // `${ctx.selection.ids}` in a url/api target comma-joins the ids —
      // String(array) — giving toolbar actions selection access without any
      // bulk-executor involvement (objectui#3139). Empty when nothing is
      // selected, so authors can treat "" as "no selection".
      selection: {
        ids: Array.isArray(this.context.selectedRecords)
          ? this.context.selectedRecords
              .map((r: Record<string, unknown> | null | undefined) => r?.id)
              .filter((v: unknown) => v != null)
              .map(String)
          : [],
        count: Array.isArray(this.context.selectedRecords)
          ? this.context.selectedRecords.length
          : 0,
      },
    };
    if (this.context.ctx && typeof this.context.ctx === 'object') {
      Object.assign(ctx, this.context.ctx);
    }
    return ctx;
  }

  updateContext(newContext: Partial<ActionContext>): void {
    this.context = withIdentityAlias({ ...this.context, ...newContext });
    // Feed the merged (re-aliased) context so a refreshed `user` also
    // refreshes the derived `os.user` binding in the evaluator scope.
    this.evaluator.updateContext(this.context);
  }

  getContext(): ActionContext {
    return this.context;
  }

  /**
   * Get the expression evaluator (for components that need to evaluate visibility, etc.)
   */
  getEvaluator(): ExpressionEvaluator {
    return this.evaluator;
  }
}

/**
 * Convenience function to execute a single action with a one-off runner.
 */
export async function executeAction(
  action: ActionDef,
  context: ActionContext = {}
): Promise<ActionResult> {
  const runner = new ActionRunner(context);
  return await runner.execute(action);
}

/**
 * Dot-path read used by target interpolation. Plain reduce — kept inline
 * to avoid pulling lodash for a 3-line helper.
 */
function readPath(root: unknown, path: string): unknown {
  if (root == null) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, root);
}
