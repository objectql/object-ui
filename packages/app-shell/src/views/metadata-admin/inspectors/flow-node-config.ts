// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * flow-node-config — declarative, spec-precise config-field schema per flow
 * node type.
 *
 * Node types and the structured config blocks below mirror the authoritative
 * `@objectstack/spec` FlowNode schema (automation/flow.zod.ts): the type enum
 * is the spec's `FlowNodeAction`, and spec-schematized blocks — `waitEventConfig`
 * (wait), `connectorConfig` (connector_action), `boundaryConfig`
 * (boundary_event) and the node-level `timeoutMs` — are edited as precise form
 * fields rather than free JSON.
 *
 * Each field declares a `path` into the node object. Most CRUD/script/http
 * fields live under `['config', key]` (the spec's freeform, type-specific
 * config record); spec-structured blocks live at the node top level, e.g.
 * `['waitEventConfig', 'eventType']`. Only fields whose path is rooted at
 * `config` "own" a config key — any *other* config keys remain editable in the
 * optional Advanced block so authors are never locked out.
 *
 * Field kinds: scalar (text / expression / number / boolean / select),
 * `textarea` (script code, request body) and `keyValue` for flat object maps
 * (e.g. record field values, connector input). Deeply nested / array values
 * still fall back to the optional Advanced block.
 *
 * The field labels/help/options here are English (the source of truth). A zh-CN
 * overlay lives in `../i18n` (FLOW_FIELD_ZH) and is applied at render by
 * {@link localizeFlowFields} — which also localizes the engine-published
 * `configSchema` fields, since built-in nodes share the same field ids.
 */

import { flowFieldZh, isZhLocale } from '../i18n';

export type FlowConfigFieldKind =
  | 'text'
  | 'expression'
  | 'number'
  | 'boolean'
  | 'select'
  | 'textarea'
  | 'keyValue'
  | 'stringList'
  | 'numberList'
  | 'objectList'
  | 'reference';

/**
 * What a `reference` field points at — the picker's data source. Most kinds
 * render an *editable* combobox (suggestions + free text), so an unknown /
 * not-yet-created value is never rejected and an empty catalog degrades to a
 * plain text box.
 *
 *   • `object`        → a business object, by API name (`client.list('object')`)
 *   • `object-field`  → a field of some object; the object is resolved via
 *                       {@link FlowReferenceSpec.objectSource}
 *   • `flow`          → a flow, by name (`client.list('flow')`)
 *   • `org-membership-level`
 *                     → a better-auth org-membership tier. A FIXED three-value
 *                       enum (owner/admin/member) rendered as a STRICT select
 *                       (framework #3508): there is no `role` metadata type to
 *                       list (ADR-0090 D3), and free text is how dirty values
 *                       like `sales_manager` got stored.
 *   • `user` / `team` / `department` / `position` → a DATA-record lookup on
 *                       the matching directory object (`sys_user` / `sys_team`
 *                       / `sys_business_unit` / `sys_position`) via the
 *                       DataSource adapter — NOT the metadata registry, which
 *                       lists no records (framework #3508). `position` commits
 *                       the machine NAME (`sys_user_position` routes by name,
 *                       ADR-0090 D3); the others commit the row id. See
 *                       `KIND_TO_RECORD_LOOKUP`, which mirrors the spec's
 *                       `APPROVER_VALUE_BINDINGS`.
 *   • `manager`       → auto-resolved at runtime (submitter's manager) — a
 *                       disabled cell, no value to author
 *   • `queue`         → declared-but-unenforced in the runtime (framework
 *                       #3508): free text + warning, not offered for new rows
 *   • `node`          → another node in *this* flow, by id (read from the draft)
 *   • `connector`     → an installed connector (`client.list('connector')`)
 *   • `email-template`→ an email template (`client.list('email_template')`)
 *
 * Kinds that have no catalog in the current tenant simply degrade to a plain
 * text box (record lookups also keep a manual-entry escape hatch) — the author
 * is never trapped.
 */
export type ReferenceKind =
  | 'object'
  | 'object-field'
  | 'flow'
  | 'org-membership-level'
  | 'position'
  | 'node'
  | 'user'
  | 'team'
  | 'queue'
  | 'department'
  | 'manager'
  | 'connector'
  | 'connector-action'
  | 'email-template';

export interface FlowReferenceSpec {
  /**
   * Concrete reference kind. Omit when the kind is *polymorphic* — chosen at
   * render time from a sibling value (see {@link kindFrom}).
   */
  kind?: ReferenceKind;
  /**
   * For `object-field` only: where to find the target object's name.
   *   • `'$trigger'` (default) → the flow trigger object, read from the start
   *     node's `config.objectName` (the record an approval / record node acts on).
   *   • any other string       → a sibling config key on the *same* node holding
   *     the object name (e.g. CRUD nodes resolve from their own `objectName`).
   */
  objectSource?: string;
  /**
   * For `connector-action` only: the sibling key (on this node's
   * `connectorConfig` block) holding the chosen connector's name. Defaults to
   * `'connectorId'`. The picker lists THAT connector's actions (from the runtime
   * connector descriptors); with no connector chosen it degrades to free text.
   */
  connectorSource?: string;
  /**
   * Polymorphic reference: the kind is selected at render time by the value of
   * a sibling field/column named `kindFrom`, looked up in {@link map}. A value
   * with no mapping (or an empty sibling) falls back to free text. Used by the
   * approval node's `approvers[].value` (kind follows the row's `type`) and the
   * script node's `template` (follows `actionType`).
   */
  kindFrom?: string;
  map?: Record<string, ReferenceKind>;
  /**
   * Where each discriminator value's candidates actually live, keyed like
   * {@link map} — published by the spec as `xRef.sources` (framework #3508
   * follow-up) and carried through by `json-schema-to-fields`.
   *
   * {@link map} only ever named a picker KIND. It never said what backs that
   * picker, so this package had to keep its own copy of the data contract —
   * and the first copy pointed every directory kind at the metadata REGISTRY
   * (`GET /api/v1/meta/:type`), which cannot list `sys_user` / `sys_team` /
   * `sys_business_unit` / `sys_position` ROWS. Candidates came back empty and
   * the control silently degraded to free text (framework#3508). Reading the
   * source off the schema means a new approver type can no longer leave a
   * stale mirror behind here.
   *
   * Absent when the server predates the annotation — consumers keep a local
   * fallback for that case.
   */
  sources?: Record<string, RefValueSource>;
}

/**
 * How a polymorphic reference's candidates are sourced, per discriminator
 * value. Mirrors the spec's `APPROVER_VALUE_SOURCES` projection.
 *
 * `data` means the DATA API (`/api/v1/data/:object`) — named in deliberate
 * contrast to `meta`, the registry this used to query by mistake. The other
 * variants are not pickers at all: a closed `enum`, an `auto`-resolved value, a
 * `trigger-field` name, a CEL `expression`, or an `unsupported` type the
 * runtime never resolves.
 */
export type RefValueSource =
  | { source: 'data'; object: string; valueField: string }
  | { source: 'enum'; values: string[] }
  | { source: 'auto' | 'trigger-field' | 'expression' | 'unsupported' };

/** Column descriptor for an `objectList` repeater row. */
export interface FlowConfigColumn {
  key: string;
  label: string;
  /**
   * Scalar cells (`text`/`expression`/`boolean`/`select`/`reference`) plus the
   * three *nested-list* kinds — a cell that is itself a repeater
   * (repeater-in-repeater). `stringList`/`numberList` hold a primitive array;
   * `objectList` holds an array-of-objects whose own shape is in {@link columns}.
   */
  kind:
    | 'text'
    | 'expression'
    | 'boolean'
    | 'select'
    | 'reference'
    | 'stringList'
    | 'numberList'
    | 'objectList';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  /** For `kind: 'reference'` — the picker data source (may be polymorphic). */
  ref?: FlowReferenceSpec;
  /**
   * For `kind: 'objectList'` — the nested repeater's own column schema. Recursive:
   * a nested `objectList` column may itself carry `columns`, so an engine-published
   * array-of-objects-of-…-arrays renders inline instead of dropping to Advanced JSON.
   */
  columns?: FlowConfigColumn[];
}

export interface FlowConfigField {
  /**
   * Stable field identity — used as the React key and as the `showWhen.field`
   * reference. Distinct from the storage path so nested-path fields stay
   * unambiguous (e.g. `wait.timerDuration`).
   */
  id: string;
  /**
   * Location of this value on the node object. `['config', 'objectName']`
   * writes `node.config.objectName`; `['waitEventConfig', 'eventType']` writes
   * the spec's top-level `node.waitEventConfig.eventType`.
   */
  path: string[];
  /**
   * Optional secondary read location used when `path` holds no value — lets the
   * inspector tolerate a looser on-disk shape the engine also accepts (e.g. a
   * `wait` node authored with `config.eventType` instead of the spec-canonical
   * `waitEventConfig.eventType`). Reads fall back to it; the inspector writes the
   * canonical `path` and prunes the fallback (migrate-on-edit).
   */
  fallbackPath?: string[];
  /** Human-readable field label (English — repo is English-only). */
  label: string;
  kind: FlowConfigFieldKind;
  placeholder?: string;
  /** Options for `select` fields. */
  options?: Array<{ value: string; label: string }>;
  /** One-line helper hint shown under the control. */
  help?: string;
  /** Spec default, used when resolving `showWhen` against an unset controller. */
  defaultValue?: string;
  /**
   * Conditional visibility: only render this field when the controlling field
   * (referenced by its `id`) currently resolves to one of `equals`. A field is
   * always shown if it already holds a stored value, so existing config is
   * never hidden.
   */
  showWhen?: { field: string; equals: string[] };
  /** Column schema for `objectList` fields (array-of-objects repeater). */
  columns?: FlowConfigColumn[];
  /**
   * For a `keyValue` field that shares its map with typed sibling fields: the
   * keys those siblings own, which this editor must neither show nor overwrite
   * (#4305). A connector action whose descriptor publishes an `inputSchema` gets
   * a typed field per declared key, and the repeater stays behind — bound to the
   * SAME `connectorConfig.input` map — for the undeclared extras only. The host
   * inspector filters the value it passes down and merges the commit back, so
   * the stored map round-trips whole.
   */
  omitKeys?: string[];
  /** Reference target for `reference` fields — drives the combobox data source. */
  ref?: FlowReferenceSpec;
  /**
   * Data-picker brace mode override (#1934). Defaults by kind (`expression` →
   * bare CEL, `text` / `textarea` → `{var}` template). Two overrides:
   *   • `'expression'` on a code field (e.g. a script body) so the picker inserts
   *     bare references, not `{var}` — `{x}` is a syntax error in a JS/TS script.
   *   • `'template'` on an *expression* field (e.g. a loop/map `collection`) whose
   *     value is really an `interpolate()` single-brace template — it keeps the
   *     mono expression styling and the data-picker, but the picker inserts
   *     `{var}` and the CEL predicate brace-trap is suppressed (`{leadList}` is a
   *     legal template here, not a malformed condition).
   */
  refMode?: 'expression' | 'template';
}

/** Convenience: a `['config', key]`-rooted field (the common case). */
function cfg(
  key: string,
  label: string,
  kind: FlowConfigFieldKind,
  extra: Partial<FlowConfigField> = {},
): FlowConfigField {
  return { id: key, path: ['config', key], label, kind, ...extra };
}

/** Convenience: a top-level node field at `[block, key]` (spec-structured). */
function at(
  block: string,
  key: string,
  label: string,
  kind: FlowConfigFieldKind,
  extra: Partial<FlowConfigField> = {},
): FlowConfigField {
  return { id: `${block}.${key}`, path: [block, key], label, kind, ...extra };
}

/** Reusable HTTP method options. */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m }));

/**
 * Config groups keyed by the spec `FlowNodeAction` type. CRUD/script/http
 * fields live under `config`; wait/connector/boundary use the spec's
 * top-level structured blocks.
 */
const FLOW_NODE_CONFIG: Record<string, FlowConfigField[]> = {
  // Trigger — the start node IS the flow trigger (spec: `'start' // Trigger`).
  // The trigger CATEGORY is flow-level (`flow.type`); the start node's `config`
  // carries the trigger PARAMETERS. Keys match real production metadata:
  // record-change starts use objectName + criteria; scheduled starts use a cron
  // `schedule`. All optional and shown together (no category gating) so every
  // real start node renders without falling back to JSON.
  start: [
    cfg('triggerType', 'Trigger', 'select', {
      help: 'When this flow starts. Record triggers fire on data changes; schedule triggers fire on a cron.',
      options: [
        { value: 'record-after-create', label: 'Record created' },
        { value: 'record-after-update', label: 'Record updated' },
        { value: 'record-after-write', label: 'Record created or updated' },
        { value: 'record-before-update', label: 'Record before update' },
        { value: 'record-after-delete', label: 'Record deleted' },
        { value: 'schedule', label: 'Schedule (cron)' },
        { value: 'time_relative', label: 'Time-relative (date sweep)' },
        { value: 'manual', label: 'Manual / autolaunched' },
        { value: 'webhook', label: 'Webhook / API' },
        { value: 'event', label: 'Platform event' },
      ],
    }),
    cfg('objectName', 'Object', 'reference', {
      ref: { kind: 'object' },
      placeholder: 'crm_lead',
      help: 'Target object for record / scheduled-scan triggers.',
      showWhen: { field: 'triggerType', equals: ['record-after-create', 'record-after-update', 'record-after-write', 'record-before-update', 'record-after-delete', 'schedule', 'webhook', 'event'] },
    }),
    cfg('condition', 'Entry condition', 'expression', {
      placeholder: 'status == "qualifying" && previous.status != "qualifying"',
      help: 'CEL predicate — the flow runs only when this is true (for time-relative sweeps it gates each matched record). Leave empty to run on every event. On a "created or updated" trigger, `previous == null` selects the create path.',
      showWhen: { field: 'triggerType', equals: ['record-after-create', 'record-after-update', 'record-after-write', 'record-before-update', 'record-after-delete', 'schedule', 'time_relative', 'webhook', 'event'] },
    }),
    // Schedule descriptor — author the canonical nested `config.schedule` object
    // the runtime actually reads (resolveTriggerBinding → normalizeSchedule). This
    // field used to write a FLAT `config.cron`, which the backend never reads — so
    // designer-authored scheduled flows silently never bound. `fallbackPath`
    // migrates an existing flat `config.cron` to `config.schedule.expression` on
    // first edit; reading `.expression` also renders an object-shaped schedule as
    // its cron string instead of "[object Object]". Any sibling keys the runtime
    // set (`type`, `timezone`) are preserved through edits (setAtPath merges).
    {
      id: 'schedule.expression',
      path: ['config', 'schedule', 'expression'],
      fallbackPath: ['config', 'cron'],
      label: 'Cron schedule',
      kind: 'text',
      placeholder: '0 7 * * *',
      help: 'Cron expression — when the flow runs. A time-relative sweep defaults to daily if left empty.',
      showWhen: { field: 'triggerType', equals: ['schedule', 'time_relative'] },
    },
    // Time-relative trigger (#1874) — a `config.timeRelative` descriptor sweeps an
    // object on a schedule (daily by default) and launches the flow once per record
    // whose date field falls in the window. All fields live under the nested
    // `config.timeRelative` block (which the whole group "owns", so it never leaks
    // to Advanced JSON — same pattern as the approval `escalation.*` block).
    {
      id: 'timeRelative.object',
      path: ['config', 'timeRelative', 'object'],
      label: 'Sweep object',
      kind: 'reference',
      ref: { kind: 'object' },
      placeholder: 'contracts',
      help: 'Object whose records are swept each run.',
      showWhen: { field: 'triggerType', equals: ['time_relative'] },
    },
    {
      id: 'timeRelative.dateField',
      path: ['config', 'timeRelative', 'dateField'],
      label: 'Date field',
      kind: 'text',
      placeholder: 'end_date',
      help: 'The date / datetime field compared against today.',
      showWhen: { field: 'triggerType', equals: ['time_relative'] },
    },
    {
      id: 'timeRelative.withinDays',
      path: ['config', 'timeRelative', 'withinDays'],
      label: 'Within days',
      kind: 'number',
      placeholder: '30',
      help: 'Range mode: fire while the date is within N days of today (negative = overdue lookback). Leave empty if using Offset days.',
      showWhen: { field: 'triggerType', equals: ['time_relative'] },
    },
    {
      id: 'timeRelative.offsetDays',
      path: ['config', 'timeRelative', 'offsetDays'],
      label: 'Offset days',
      kind: 'numberList',
      placeholder: '60',
      help: 'Offset mode: fire when the date is exactly today + each offset (e.g. 60, 30, 7). Leave empty if using Within days.',
      showWhen: { field: 'triggerType', equals: ['time_relative'] },
    },
    {
      id: 'timeRelative.filter',
      path: ['config', 'timeRelative', 'filter'],
      label: 'Extra filter',
      kind: 'keyValue',
      help: 'Optional filter ANDed with the date window (e.g. status = active).',
      showWhen: { field: 'triggerType', equals: ['time_relative'] },
    },
    {
      id: 'timeRelative.maxRecords',
      path: ['config', 'timeRelative', 'maxRecords'],
      label: 'Max records / run',
      kind: 'number',
      placeholder: '1000',
      help: 'Cap on records launched per sweep (default 1000).',
      showWhen: { field: 'triggerType', equals: ['time_relative'] },
    },
    // Legacy `criteria` key — rendered only when present so older metadata never
    // falls back to raw JSON. Prefer `condition` above for new flows. (There is no
    // legacy `schedule` text field: the `schedule.expression` field above owns the
    // whole `config.schedule` block and reads its `.expression`, so a bare-string
    // or object-shaped schedule renders through it — a raw text field on
    // `config.schedule` would print "[object Object]" for the object shape.)
    cfg('criteria', 'Entry condition (legacy)', 'expression', {
      placeholder: 'status == "active"',
      help: 'Legacy key — prefer "Entry condition" (condition).',
      showWhen: { field: '__legacy__', equals: [] },
    }),
  ],
  end: [
    cfg('outcome', 'Outcome', 'text', { placeholder: 'success · failure' }),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'result' }),
  ],
  decision: [
    cfg('conditions', 'Branches', 'objectList', {
      // framework#4414: the default/else path is the out-edge marked
      // `isDefault`, not the branch itself — a `true` branch is how you ask for
      // one, and FlowEdgeInspector.applyBranch() writes the marker. Saying
      // "a `true` branch IS the default path" conflated the two, which is the
      // reading that let a decision ship with a guard that did not guard.
      help: 'Each branch has a label, a CEL expression (no {braces}), and a target node. Branches are tried in order and the first match wins. A branch whose expression is "true" is the catch-all: picking its target marks that out-edge as the default path, taken only when no other branch matched. Picking a target wires the branch’s outgoing edge (creating or updating it); clearing it detaches that edge.',
      columns: [
        { key: 'label', label: 'Label', kind: 'text', placeholder: 'Has deals' },
        { key: 'expression', label: 'Expression', kind: 'expression', placeholder: 'expiring_deals.length > 0' },
        // #1942 — virtual column: derived from / applied to the out-edges by
        // FlowNodeInspector (flow-decision-edges), never stored on the branch.
        { key: 'target', label: 'Target', kind: 'reference', placeholder: 'next node', ref: { kind: 'node' } },
      ],
    }),
    // Render-only for a stored legacy value (`__legacy__` never matches, so it
    // is not offered for new authoring). The old help said "Prefer Branches
    // above", which reads as "this works, but the other is better" — it does
    // not work at all: framework#4414 confirmed the decision executor never
    // reads `config.condition`. The key is the trigger gate on a `start` node
    // and inert on every other node type, and `os validate` now reports it as
    // `flow-inert-node-condition`.
    cfg('condition', 'Condition (single)', 'expression', {
      placeholder: 'amount > 10000',
      help: 'Inert — nothing reads this. The engine only honours `condition` on a Start node (the trigger gate); on a Decision it gates nothing. Shown so a stored value is not invisible. Move the predicate to a branch above, or to the outgoing edge’s own condition, then clear this.',
      showWhen: { field: '__legacy__', equals: [] },
    }),
  ],
  assignment: [
    cfg('assignments', 'Assignments', 'keyValue', {
      help: 'Set variables: each key is a variable, each value an expression or literal.',
    }),
  ],
  loop: [
    cfg('collection', 'Collection', 'expression', { placeholder: '{leadList}', refMode: 'template', help: 'Expression resolving to the items to iterate.' }),
    cfg('iteratorVariable', 'Item variable', 'text', { placeholder: 'currentItem' }),
  ],
  // Sequential multi-instance (ADR-0037 A2): a per-item subflow, one at a time;
  // each item may durably pause (e.g. a per-item approval).
  map: [
    cfg('collection', 'Collection', 'expression', { placeholder: '{items}', refMode: 'template', help: 'Expression resolving to the array to process, one item at a time.' }),
    cfg('flowName', 'Per-item flow', 'reference', { ref: { kind: 'flow' }, placeholder: 'one_task_signoff', help: 'Subflow run for each item — it may pause (e.g. an approval).' }),
    cfg('iteratorVariable', 'Item variable', 'text', { placeholder: 'item' }),
    cfg('itemObject', 'Item object', 'reference', { ref: { kind: 'object' }, placeholder: 'showcase_task', help: 'When items are records, the object they belong to (exposes each item as the child’s record).' }),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'results', help: 'Each item’s subflow output, collected in order.' }),
  ],
  create_record: [
    cfg('objectName', 'Object', 'reference', { ref: { kind: 'object' }, placeholder: 'contract' }),
    cfg('fields', 'Field values', 'keyValue', { help: 'Field values to write on the new record.' }),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'newRecord' }),
  ],
  update_record: [
    cfg('objectName', 'Object', 'reference', { ref: { kind: 'object' }, placeholder: 'contract' }),
    cfg('filter', 'Filter', 'keyValue', { help: 'Field/value pairs identifying the record(s) to update (e.g. id → {recordId}).' }),
    cfg('fields', 'Field values', 'keyValue', { help: 'Field values to write.' }),
  ],
  delete_record: [
    cfg('objectName', 'Object', 'reference', { ref: { kind: 'object' }, placeholder: 'contract' }),
    cfg('filter', 'Filter', 'keyValue', { help: 'Field/value pairs identifying the record(s) to delete.' }),
  ],
  get_record: [
    cfg('objectName', 'Object', 'reference', { ref: { kind: 'object' }, placeholder: 'contract' }),
    cfg('filter', 'Filter', 'keyValue', { help: 'Field/value pairs to match (e.g. status → active). Operator values like {"$ne": null} are preserved.' }),
    cfg('limit', 'Limit', 'number', { placeholder: '100' }),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'records' }),
  ],
  http_request: [
    cfg('method', 'Method', 'select', { options: HTTP_METHODS, defaultValue: 'GET' }),
    cfg('url', 'URL', 'text', { placeholder: 'https://api.example.com/v1/contracts' }),
    cfg('headers', 'Headers', 'keyValue', { help: 'Request headers (e.g. Authorization, Content-Type).' }),
    cfg('body', 'Body', 'textarea', { placeholder: '{ "key": "value" }', help: 'Request payload (JSON or expression).' }),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'response' }),
    { id: 'timeoutMs', path: ['timeoutMs'], label: 'Timeout (ms)', kind: 'number', placeholder: '30000' },
  ],
  // Script — one thing: call a registered function (framework#1870).
  // `function` + `inputs` + `outputVariable` is the whole authorable surface,
  // reconciled against the spec-published `ScriptConfigSchema` (framework#4278).
  //
  // framework#4343 retired the other dispatch branches, and the form follows.
  // None of them ran: `actionType: 'email' | 'slack'` were logger-backed stubs
  // that reported success and delivered nothing (with `template` / `recipients`
  // / `variables` addressing a message no channel sent), inline `script` was
  // never executed (the built-in runtime has no server-side JS sandbox), and
  // any other `actionType` was a second spelling of `function`. Real delivery
  // is a `notify` node; Slack is a connector (or an `http` webhook).
  //
  // The five keys stay as legacy render-only fields (`__legacy__` never
  // matches, so they are never OFFERED) because a stored node must still show
  // everything it carries — the rule this group already followed for the
  // `code` / `sms` / `notification` action types #3099 dropped. Each carries
  // the replacement in its help text; `os migrate meta --from 16` rewrites the
  // stored metadata.
  script: [
    cfg('function', 'Function', 'text', {
      placeholder: 'score_lead',
      help: 'Registered function to call — declared via defineStack({ functions }). Required: it is what this step runs.',
    }),
    cfg('inputs', 'Inputs', 'keyValue', {
      help: 'Values passed to the function; {var} references resolve against the live flow variables.',
    }),
    cfg('outputVariable', 'Output variable', 'text', {
      placeholder: 'aiResult',
      help: "Flow variable the function's return value is bound to, for later steps.",
    }),
    cfg('actionType', 'Action type (retired)', 'text', {
      help: 'Retired in spec 17 — "email"/"slack" never delivered anything, and any other value was just the function name. Use a notify node for messages, a Slack connector for Slack, or move the name into Function.',
      showWhen: { field: '__legacy__', equals: [] },
    }),
    cfg('template', 'Template (retired)', 'text', {
      help: 'Retired in spec 17 — it fed a side effect that never rendered or sent a message. A notify node carries its own title/message.',
      showWhen: { field: '__legacy__', equals: [] },
    }),
    cfg('recipients', 'Recipients (retired)', 'stringList', {
      help: 'Retired in spec 17 — these addresses were logged, never messaged. Use a notify node, whose recipients reach the messaging service.',
      showWhen: { field: '__legacy__', equals: [] },
    }),
    cfg('variables', 'Template variables (retired)', 'keyValue', {
      help: 'Retired in spec 17 — injected into a template nothing rendered. A notify node carries structured data in payload.',
      showWhen: { field: '__legacy__', equals: [] },
    }),
    cfg('script', 'Code (not executed, retired)', 'textarea', {
      placeholder: 'return { ok: true };',
      help: 'Retired in spec 17 — inline scripts were NEVER executed by the built-in runtime (no server-side sandbox). Move the logic into a registered function and name it in Function.',
      refMode: 'expression',
      showWhen: { field: '__legacy__', equals: [] },
    }),
    { id: 'timeoutMs', path: ['timeoutMs'], label: 'Timeout (ms)', kind: 'number', placeholder: '30000' },
  ],
  // Screen — collect input (a flat `fields` list) OR render an object's full
  // create/edit form (`objectName`, master-detail). `title`/`description`
  // head the screen (description interpolates {var}); `waitForInput` forces a
  // pause on a field-less message/confirmation screen. All optional and shown
  // together so neither a message screen nor an object-form step needs JSON.
  screen: [
    cfg('title', 'Title', 'text', { placeholder: 'Request a discount', help: 'Heading shown above the screen.' }),
    cfg('description', 'Description', 'textarea', {
      placeholder: 'Enter the deal amount and the discount you want.',
      help: 'Body text. Interpolates {var} references (e.g. {approval_path}).',
    }),
    cfg('fields', 'Fields', 'objectList', {
      help: 'Input fields collected on this screen. Leave empty for a message-only screen.',
      columns: [
        { key: 'name', label: 'Name', kind: 'text', placeholder: 'discount' },
        { key: 'label', label: 'Label', kind: 'text', placeholder: 'Discount %' },
        { key: 'type', label: 'Type', kind: 'text', placeholder: 'number' },
        { key: 'required', label: 'Required', kind: 'boolean' },
        { key: 'visibleWhen', label: 'Visible when', kind: 'expression', placeholder: 'stage == "review"' },
      ],
    }),
    cfg('waitForInput', 'Wait for input', 'boolean', {
      help: 'Pause to show this screen even with no fields (a message / confirmation). A field-less screen with this off is a server pass-through.',
    }),
    cfg('objectName', 'Object form', 'reference', {
      ref: { kind: 'object' },
      placeholder: 'crm_account',
      help: 'Render this object\u2019s full create/edit form (incl. master-detail) instead of a flat field list.',
    }),
    cfg('idVariable', 'Saved-record variable', 'text', {
      placeholder: 'account_id',
      help: 'Object form only: variable bound to the saved record\u2019s id, for later steps.',
    }),
    cfg('mode', 'Form mode', 'select', {
      options: [
        { value: 'create', label: 'Create' },
        { value: 'edit', label: 'Edit' },
      ],
      defaultValue: 'create',
      help: 'Object form only.',
    }),
    cfg('defaults', 'Form defaults', 'keyValue', {
      help: 'Object form only: prefilled values (e.g. account \u2192 {account_id}).',
    }),
  ],
  // Approval node (ADR-0019). The node opens an approval request on entry,
  // suspends the run, and resumes down its `approve` / `reject` out-edge once a
  // decision is recorded. Config mirrors `@objectstack/spec`
  // ApprovalNodeConfigSchema; entry criteria and on-approve / on-reject actions
  // are NOT here — they live on the graph (the edge into this node, and the
  // nodes wired to its `approve` / `reject` out-edges).
  approval: [
    cfg('approvers', 'Approvers', 'objectList', {
      help: 'Who may act on this step. Wire the node’s out-edges with labels "approve" and "reject".',
      columns: [
        {
          key: 'type',
          label: 'Type',
          kind: 'select',
          // OFFLINE FALLBACK ONLY. `FlowNodeInspector` renders
          // `serverFields ?? fieldsForNodeType(...)`, so against a real backend
          // the approval node's fields come from the engine-published
          // configSchema and this list is never read — it covers the preview
          // gallery and any stack whose server publishes no schema.
          //
          // That is why the ordering below is ALSO carried by the spec's
          // `ApproverType` enum (framework#3508 follow-up): stating it only
          // here left the live picker in enum order with `user` first, the
          // exact opposite of the intent. Indirect bindings lead and the
          // literal `user` binding comes last — binding a specific person is
          // the least portable choice (env moves, people leave). Keep the two
          // in sync; the spec is the source of truth.
          //
          // Both paths also drop the spec's NON_AUTHORABLE_APPROVER_TYPES —
          // `role` (deprecated spelling of `org_membership_level`, ADR-0090 D3)
          // and `queue` (declared-but-unenforced; the runtime resolves it to
          // nobody, framework#3508). A stored row of either still renders,
          // flagged "(deprecated)", but neither is offered for new authoring.
          options: [
            { value: 'manager', label: 'Manager' },
            { value: 'position', label: 'Position' },
            { value: 'department', label: 'Department' },
            { value: 'team', label: 'Team' },
            { value: 'field', label: 'Field' },
            // #3447: CEL over current.* / trigger.* / vars.*, resolved at node
            // entry — the value cell switches to the expression input.
            { value: 'expression', label: 'Expression (CEL)' },
            { value: 'org_membership_level', label: 'Organization membership (owner/admin/member)' },
            { value: 'user', label: 'User' },
          ],
        },
        {
          // Polymorphic: the picker follows the row's `type` — record lookups
          // for the directory kinds, a strict select for the membership tier,
          // an auto-resolved cell for `manager`, an object-field picker for
          // `field` (framework #3508). Unmapped/empty types fall back to free
          // text — except `expression` (#3447), which the cell special-cases
          // into the CEL expression input (it is a discriminator value, not a
          // reference kind, so it deliberately has no `map` entry).
          key: 'value',
          label: 'Value',
          kind: 'reference',
          placeholder: 'User id / membership tier / position / team / department / field — per `type`',
          ref: {
            kindFrom: 'type',
            objectSource: '$trigger',
            // `role` maps to the same picker as `org_membership_level`, and
            // `queue` stays mapped (free text + warning): the designer no
            // longer offers either, but stored rows must keep rendering for
            // the length of the deprecation window.
            map: {
              user: 'user',
              position: 'position',
              org_membership_level: 'org-membership-level',
              role: 'org-membership-level',
              team: 'team',
              department: 'department',
              manager: 'manager',
              field: 'object-field',
              queue: 'queue',
            },
          },
        },
        {
          // #3447: expression-only — how the expression's resolved ids expand
          // into people. Dead config on other types (linted server-side).
          key: 'resolveAs',
          label: 'Resolve as',
          kind: 'select',
          options: [
            { value: 'user', label: 'User ids (default)' },
            { value: 'department', label: 'Department ids → members' },
            { value: 'position', label: 'Position names → holders' },
            { value: 'team', label: 'Team ids → members' },
          ],
        },
        {
          // Group label for `per_group` sign-off (#3266): approvers sharing a
          // label form one group; the node advances when EACH group reaches
          // `minApprovals`. Ignored by other behaviors.
          key: 'group',
          label: 'Group',
          kind: 'text',
          placeholder: 'legal / finance — for per-group sign-off',
        },
      ],
    }),
    cfg('behavior', 'Behavior', 'select', {
      options: [
        { value: 'first_response', label: 'First response wins' },
        { value: 'unanimous', label: 'Unanimous (all approve)' },
        { value: 'quorum', label: 'Quorum (M of N approve)' },
        { value: 'per_group', label: 'Per group (each group signs off)' },
      ],
      defaultValue: 'first_response',
      help: 'How multiple approvers combine. Any rejection is a veto in every mode.',
    }),
    cfg('minApprovals', 'Min approvals', 'number', {
      placeholder: '1',
      help: 'Approvals required — total for quorum, per group for per_group. Clamped server-side so it can never deadlock.',
    }),
    cfg('lockRecord', 'Lock record', 'boolean', {
      help: 'Lock the triggering record from edits while this node is pending.',
    }),
    cfg('approvalStatusField', 'Status field', 'reference', {
      ref: { kind: 'object-field', objectSource: '$trigger' },
      placeholder: 'approval_status',
      help: 'Business-object field to mirror request status onto (pending/approved/rejected). Should be readonly.',
    }),
    // #3447: empty-slate policy — load-bearing for expression approvers, whose
    // slate is runtime data and may legitimately resolve to nobody.
    cfg('onEmptyApprovers', 'If no approver resolves', 'select', {
      options: [
        { value: 'admin_rescue', label: 'Hold for admin takeover (default)' },
        { value: 'fail', label: 'Fail the node (config bug)' },
        { value: 'auto_approve', label: 'Auto-approve (waves through!)' },
      ],
      defaultValue: 'admin_rescue',
      help: 'What an empty resolved approver slate does at node entry. Auto-approve silently waves the record through — opt in deliberately.',
    }),
    // Per-node SLA escalation (spec ApprovalEscalationSchema, nested under
    // config.escalation). Sub-fields reveal once escalation is enabled.
    { id: 'escalation.enabled', path: ['config', 'escalation', 'enabled'], label: 'SLA escalation', kind: 'boolean', defaultValue: 'false', help: 'Escalate when a decision is not recorded within the timeout.' },
    { id: 'escalation.timeoutHours', path: ['config', 'escalation', 'timeoutHours'], label: 'Timeout (hours)', kind: 'number', placeholder: '24', showWhen: { field: 'escalation.enabled', equals: ['true'] } },
    {
      id: 'escalation.action', path: ['config', 'escalation', 'action'], label: 'On timeout', kind: 'select', defaultValue: 'notify',
      options: [
        { value: 'notify', label: 'Notify' },
        { value: 'reassign', label: 'Reassign' },
        { value: 'auto_approve', label: 'Auto-approve' },
        { value: 'auto_reject', label: 'Auto-reject' },
      ],
      showWhen: { field: 'escalation.enabled', equals: ['true'] },
    },
    { id: 'escalation.escalateTo', path: ['config', 'escalation', 'escalateTo'], label: 'Escalate to', kind: 'reference', ref: { kind: 'position' }, placeholder: 'position machine name / user id', showWhen: { field: 'escalation.enabled', equals: ['true'] } },
    { id: 'escalation.notifySubmitter', path: ['config', 'escalation', 'notifySubmitter'], label: 'Notify submitter', kind: 'boolean', showWhen: { field: 'escalation.enabled', equals: ['true'] } },
    // ADR-0044 send-back-for-revision guard. Surfaces from the engine's
    // published configSchema when online; this hardcoded copy keeps it visible
    // offline / on an older backend. Only meaningful once the node has a
    // `revise` out-edge (author one via the canvas "add revision loop").
    cfg('maxRevisions', 'Max revisions', 'number', {
      placeholder: '3',
      defaultValue: '3',
      help: 'Max send-backs for revision before the request auto-rejects (0 disables send-back). Needs a "revise" out-edge to take effect.',
    }),
  ],
  wait: [
    at('waitEventConfig', 'eventType', 'Wait for', 'select', {
      options: [
        { value: 'timer', label: 'Timer' },
        { value: 'signal', label: 'Signal' },
        { value: 'webhook', label: 'Webhook' },
        { value: 'manual', label: 'Manual' },
        { value: 'condition', label: 'Condition' },
      ],
      defaultValue: 'timer',
      fallbackPath: ['config', 'eventType'],
    }),
    at('waitEventConfig', 'timerDuration', 'Duration', 'text', {
      placeholder: 'PT1H · P3D',
      help: 'ISO 8601 duration (e.g. PT1H, P3D).',
      showWhen: { field: 'waitEventConfig.eventType', equals: ['timer'] },
      fallbackPath: ['config', 'timerDuration'],
    }),
    at('waitEventConfig', 'signalName', 'Signal name', 'text', {
      placeholder: 'contract.renewed',
      showWhen: { field: 'waitEventConfig.eventType', equals: ['signal', 'webhook'] },
      fallbackPath: ['config', 'signalName'],
    }),
    // `waitEventConfig.timeoutMs` / `.onTimeout` were REMOVED here (#3101,
    // framework#4158): `wait` never had a timeout. `onTimeout` had zero readers
    // — neither 'fail' nor 'continue' ever happened — and `timeoutMs`'s only
    // reader used it as the timer DURATION when `timerDuration` was absent, so
    // it did something, just not what it said. Both are `retiredKey()`
    // tombstones on `FlowNodeSchema` since spec 17.0.0-rc.1, so a value written
    // here is now REJECTED at load: keeping the fields would let an author
    // produce metadata their own runtime refuses. Use `Duration` above — it
    // accepts a bare number as milliseconds, making the old `timeoutMs: 60000`
    // and `timerDuration: '60000'` the same wait. Stored flows are converted by
    // framework's D2 conversion; the designer just stops offering the entry.
  ],
  subflow: [
    cfg('flowName', 'Flow', 'reference', { ref: { kind: 'flow' }, placeholder: 'escalation_flow' }),
    cfg('input', 'Input mapping', 'keyValue', { help: 'Values passed to the subflow\u2019s input variables.' }),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'subResult' }),
    { id: 'timeoutMs', path: ['timeoutMs'], label: 'Timeout (ms)', kind: 'number', placeholder: '60000' },
  ],
  // `notify` — outbound notification (ADR-0012), dispatched via the messaging
  // service. Config keys mirror the built-in node's server descriptor
  // (service-automation `notify-node.ts` configSchema): title + ≥1 recipient
  // are required at execute time; channels default to inbox. Surfaced here as a
  // first-class static editor so the node is authorable offline, not only when
  // the running engine publishes its descriptor (framework#1878/#1895).
  notify: [
    cfg('recipients', 'Recipients', 'stringList', { help: 'User id(s) / audience selector(s) to notify. At least one is required.' }),
    cfg('title', 'Title', 'text', { placeholder: 'Your request was approved', help: 'Notification title (required).' }),
    cfg('message', 'Message', 'textarea', { placeholder: 'Supports {var} template references.', help: 'Notification body.' }),
    cfg('channels', 'Channels', 'stringList', { help: 'Channels to fan out to (default: inbox — e.g. inbox · email · push).' }),
    cfg('topic', 'Topic', 'text', { placeholder: 'notify', help: 'Event topic (default: "notify").' }),
    cfg('severity', 'Severity', 'select', {
      options: [
        { value: 'info', label: 'Info' },
        { value: 'warning', label: 'Warning' },
        { value: 'critical', label: 'Critical' },
      ],
      help: 'Notification severity.',
    }),
    // Click-through target (#2675): deep-link the notification to a record.
    cfg('sourceObject', 'Link object', 'text', { placeholder: 'sys_approval_request', help: 'Object of the record the notification links to (requires Link record id).' }),
    cfg('sourceId', 'Link record id', 'text', { help: 'Record id the notification links to (requires Link object).' }),
    cfg('url', 'Click-through URL', 'text', { help: 'Explicit link; overrides the one synthesized from Link object/record.' }),
  ],
  connector_action: [
    at('connectorConfig', 'connectorId', 'Connector', 'reference', { ref: { kind: 'connector' }, placeholder: 'slack · email · salesforce' }),
    // actionId is polymorphic on the chosen connector: the picker lists THAT
    // connector's actions (runtime descriptors), degrading to free text if none.
    // (a deliberate open extension point) — stays free text.
    at('connectorConfig', 'actionId', 'Action', 'reference', { ref: { kind: 'connector-action', connectorSource: 'connectorId' }, placeholder: 'sendMessage · send' }),
    at('connectorConfig', 'input', 'Input', 'keyValue', { help: 'Mapped inputs for the connector action.' }),
    { id: 'timeoutMs', path: ['timeoutMs'], label: 'Timeout (ms)', kind: 'number', placeholder: '30000' },
  ],
  // ADR-0031 structured constructs. Their bodies are nested regions
  // (config.branches / config.try / config.catch) — sub-graphs the flat field
  // kinds can't model; authors edit them in the JSON source editor. Only the
  // scalar knobs surface here.
  parallel: [],
  try_catch: [
    cfg('errorVariable', 'Error variable', 'text', {
      placeholder: '$error',
      help: 'Variable the caught error is bound to inside the catch region.',
    }),
  ],
  // Legacy BPMN interop pair — kept so imported flows still render an
  // inspector, but no longer offered by the palette / type picker (the engine
  // has no executor; ADR-0031 makes them import/export-only).
  parallel_gateway: [],
  join_gateway: [],
  boundary_event: [
    at('boundaryConfig', 'attachedToNodeId', 'Attached to', 'reference', { ref: { kind: 'node' }, placeholder: 'host node id', help: 'Host node this boundary event monitors.' }),
    at('boundaryConfig', 'eventType', 'Event type', 'select', {
      options: [
        { value: 'error', label: 'Error' },
        { value: 'timer', label: 'Timer' },
        { value: 'signal', label: 'Signal' },
        { value: 'cancel', label: 'Cancel' },
      ],
      defaultValue: 'error',
    }),
    at('boundaryConfig', 'interrupting', 'Interrupting', 'boolean', { help: 'Cancel the host activity when this event fires.' }),
    at('boundaryConfig', 'errorCode', 'Error code', 'text', {
      placeholder: 'TIMEOUT (empty = all)',
      showWhen: { field: 'boundaryConfig.eventType', equals: ['error'] },
    }),
    at('boundaryConfig', 'timerDuration', 'Duration', 'text', {
      placeholder: 'PT1H',
      showWhen: { field: 'boundaryConfig.eventType', equals: ['timer'] },
    }),
    at('boundaryConfig', 'signalName', 'Signal name', 'text', {
      placeholder: 'contract.cancelled',
      showWhen: { field: 'boundaryConfig.eventType', equals: ['signal'] },
    }),
  ],

  /**
   * Legacy generic "action" group — retained for flows authored before the
   * spec node types were adopted. Never auto-migrated to a spec type (the old
   * `action` could mean create/update/query/email/webhook); authors re-pick a
   * precise type explicitly.
   */
  legacy_action: [
    cfg('action', 'Action', 'text', { placeholder: 'sendEmail · createTask · update · query' }),
    cfg('objectName', 'Object', 'reference', { ref: { kind: 'object' }, placeholder: 'contract' }),
    cfg('recordId', 'Record', 'expression', { placeholder: 'record.id' }),
    cfg('params', 'Parameters', 'keyValue', { help: 'Action inputs. Values auto-typed: 3 \u2192 number, true \u2192 boolean.' }),
    cfg('fields', 'Field values', 'keyValue' ),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'result' }),
  ],
};

/**
 * Maps legacy / alias designer node types onto a spec config group. The spec
 * `FlowNodeAction` types resolve to themselves; older designer types resolve to
 * the closest spec group. Legacy generic `action` resolves to `legacy_action`
 * (kept deliberately distinct — never silently rewritten to a CRUD type).
 */
const TYPE_ALIASES: Record<string, string> = {
  action: 'legacy_action',
  http: 'http_request',
  branch: 'decision',
  gateway: 'decision',
  condition: 'decision',
  timer: 'wait',
  delay: 'wait',
  flow: 'subflow',
  invoke: 'subflow',
  task: 'legacy_action',
  user_task: 'screen',
  service_task: 'connector_action',
  script_task: 'script',
  notification: 'connector_action',
  signal: 'boundary_event',
  webhook: 'connector_action',
  for_each: 'loop',
};

/** Resolve the config fields for a node type (alias-aware). */
export function fieldsForNodeType(type?: string): FlowConfigField[] {
  if (!type) return [];
  const canonical = TYPE_ALIASES[type] ?? type;
  return FLOW_NODE_CONFIG[canonical] ?? [];
}

/** A field that edits `node.config.<key>` rather than a spec-structured sibling block. */
function isConfigRooted(field: FlowConfigField): boolean {
  return field.path[0] === 'config';
}

/**
 * Merge the engine-published field set with the hand-written group for a node
 * type (framework#4045).
 *
 * A published `configSchema` describes **`node.config` and nothing else** — that
 * is what the descriptor's contract says (ADR-0018) and what
 * {@link jsonSchemaToFlowFields} produces, since it roots every field it emits
 * at `['config', key]`. But several node types keep part (or all) of their
 * contract in a spec-structured SIBLING block on the node — `connectorConfig`
 * (connector_action), `waitEventConfig` (wait), `boundaryConfig`
 * (boundary_event) — or at the node top level (`timeoutMs`, four types).
 *
 * Replacing the whole group with the server's therefore deletes editors the
 * server never claimed to describe. That is not hypothetical: `connector_action`
 * shipped a `configSchema` declaring `connectorId`/`actionId`/`input` as CONFIG
 * keys, and against a live backend it replaced this table's `connectorConfig.*`
 * fields — connector and action pickers included — so an author writing a
 * connector node online filled in keys the executor never reads, and the node
 * refused to dispatch. framework#4210 retired that schema; this merge is what
 * stops the next one from doing the same to `wait` or `boundary_event`.
 *
 * So the server owns the config-rooted fields (it is the authority on what the
 * executor reads), and the hand-written non-config fields are always preserved,
 * in their declared order, after them. When no schema is published the
 * hand-written group is used whole, unchanged.
 */
export function mergeServerFlowFields(
  serverFields: FlowConfigField[] | null | undefined,
  type?: string,
): FlowConfigField[] {
  const handWritten = fieldsForNodeType(type);
  if (!serverFields) return handWritten;
  // A sibling-block field the server also described (by id) is not duplicated —
  // the server's config-rooted version is dropped in favour of the structured
  // editor, since a `config`-rooted duplicate would write where nothing reads.
  const serverConfigFields = serverFields.filter(isConfigRooted);
  const preserved = handWritten.filter((f) => !isConfigRooted(f));
  const preservedKeys = new Set(preserved.map((f) => f.path[f.path.length - 1]));
  return [
    ...serverConfigFields.filter((f) => !preservedKeys.has(f.path[f.path.length - 1])),
    ...preserved,
  ];
}

/** Overlay a column's zh label / option labels (English is the fallback). */
function localizeColumn(
  col: FlowConfigColumn,
  cz: { label?: string; opts?: Record<string, string> } | undefined,
): FlowConfigColumn {
  if (!cz) return col;
  const out: FlowConfigColumn = { ...col };
  if (cz.label) out.label = cz.label;
  if (col.options && cz.opts) {
    out.options = col.options.map((o) => ({ ...o, label: cz.opts![o.value] ?? o.label }));
  }
  return out;
}

/** Overlay a field's zh label / help / option / column labels. The raw node
 *  type wins over its alias, so a type with its OWN server field set (e.g.
 *  `notify`, which aliases to `connector_action` for the offline client fields)
 *  still gets its own translations. */
function localizeField(rawType: string, canonicalType: string, field: FlowConfigField): FlowConfigField {
  const z = flowFieldZh(rawType, field.id) ?? flowFieldZh(canonicalType, field.id);
  if (!z) return field;
  const out: FlowConfigField = { ...field };
  if (z.label) out.label = z.label;
  if (z.help) out.help = z.help;
  if (field.options && z.opts) {
    out.options = field.options.map((o) => ({ ...o, label: z.opts![o.value] ?? o.label }));
  }
  if (field.columns && z.cols) {
    out.columns = field.columns.map((c) => localizeColumn(c, z.cols![c.key]));
  }
  return out;
}

/**
 * Localize a resolved flow-field list for the active locale. English is a
 * no-op (the table is authored in English); for zh-CN each field's label /
 * help / options / column labels are overlaid from `FLOW_FIELD_ZH`, falling
 * back to English for any field not covered (e.g. plugin nodes). Keyed by the
 * canonical node type so it works for both the hardcoded table and the
 * engine-published `configSchema` fields (which share field ids).
 */
export function localizeFlowFields(
  type: string | undefined,
  fields: FlowConfigField[],
  locale?: string,
): FlowConfigField[] {
  if (!type || !isZhLocale(locale)) return fields;
  const canonical = TYPE_ALIASES[type] ?? type;
  return fields.map((f) => localizeField(type, canonical, f));
}

/** Read the current value at a field's node path, falling back to `fallbackPath`. */
export function getFieldValue(node: Record<string, unknown> | null | undefined, field: FlowConfigField): unknown {
  const read = (path: string[]): unknown => {
    let cur: unknown = node;
    for (const seg of path) {
      if (cur && typeof cur === 'object' && !Array.isArray(cur)) cur = (cur as Record<string, unknown>)[seg];
      else return undefined;
    }
    return cur;
  };
  const primary = read(field.path);
  if (primary !== undefined) return primary;
  return field.fallbackPath ? read(field.fallbackPath) : undefined;
}

/**
 * The `config` key this field owns, or `undefined` for fields stored outside
 * `config` (spec-structured blocks, top-level `timeoutMs`). Used by the
 * inspector to compute "extra" config keys for the optional Advanced block —
 * only config-rooted fields suppress an Advanced key.
 */
export function configKeyOf(field: FlowConfigField): string | undefined {
  // Any config-rooted field claims its first config segment — so nested groups
  // (e.g. `['config','escalation','enabled']`) all claim `escalation`, keeping
  // the whole block out of the Advanced editor.
  return field.path.length >= 2 && field.path[0] === 'config' ? field.path[1] : undefined;
}

/**
 * Whether a field should render. Conditional fields show when their controller
 * (by `id`) resolves — via stored value, else spec `defaultValue` — to one of
 * `equals`, OR when the field already holds a stored value (so existing config
 * is never hidden).
 */
export function isFieldVisible(
  field: FlowConfigField,
  node: Record<string, unknown> | null | undefined,
  fields: FlowConfigField[],
): boolean {
  if (!field.showWhen) return true;
  const own = getFieldValue(node, field);
  if (own !== undefined && own !== null && own !== '') return true;
  const controller = fields.find((f) => f.id === field.showWhen!.field);
  if (!controller) return false;
  const raw = getFieldValue(node, controller);
  const resolved = raw === undefined || raw === null || raw === '' ? controller.defaultValue : raw;
  // Boolean controllers (e.g. `escalation.enabled`) compare against 'true'/'false'.
  const value = typeof resolved === 'boolean' ? String(resolved) : resolved;
  return typeof value === 'string' && field.showWhen.equals.includes(value);
}

/** Node types offered in the inspector's type picker (spec `FlowNodeAction`). */
export const FLOW_NODE_TYPE_OPTIONS = [
  'start',
  'create_record',
  'update_record',
  'delete_record',
  'get_record',
  'decision',
  'assignment',
  'loop',
  'http_request',
  'script',
  'screen',
  'approval',
  'wait',
  'subflow',
  'map',
  'connector_action',
  // ADR-0031: structured constructs replace the BPMN gateway/boundary types in
  // the picker — those remain import/export-only (no engine executor).
  'parallel',
  'try_catch',
  'end',
] as const;
