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
 */

export type FlowConfigFieldKind =
  | 'text'
  | 'expression'
  | 'number'
  | 'boolean'
  | 'select'
  | 'textarea'
  | 'keyValue'
  | 'stringList'
  | 'objectList'
  | 'reference';

/**
 * What a `reference` field points at — the picker's data source. The control
 * is always an *editable* combobox (suggestions + free text), so an unknown /
 * not-yet-created value is never rejected and an empty catalog degrades to a
 * plain text box.
 *
 *   • `object`        → a business object, by API name (`client.list('object')`)
 *   • `object-field`  → a field of some object; the object is resolved via
 *                       {@link FlowReferenceSpec.objectSource}
 *   • `flow`          → a flow, by name (`client.list('flow')`)
 *   • `role`          → a security role (`client.list('role')`)
 *   • `node`          → another node in *this* flow, by id (read from the draft)
 *   • `user` / `team` / `queue` / `department` → the matching metadata list
 *                       (`client.list(kind)`); empty in dev, populated per tenant
 *   • `connector`     → an installed connector (`client.list('connector')`)
 *   • `email-template`→ an email template (`client.list('email_template')`)
 *
 * Kinds that have no catalog in the current tenant simply degrade to a plain
 * text box — the control is always an editable combobox, never a hard dropdown.
 */
export type ReferenceKind =
  | 'object'
  | 'object-field'
  | 'flow'
  | 'role'
  | 'node'
  | 'user'
  | 'team'
  | 'queue'
  | 'department'
  | 'connector'
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
   * Polymorphic reference: the kind is selected at render time by the value of
   * a sibling field/column named `kindFrom`, looked up in {@link map}. A value
   * with no mapping (or an empty sibling) falls back to free text. Used by the
   * approval node's `approvers[].value` (kind follows the row's `type`) and the
   * script node's `template` (follows `actionType`).
   */
  kindFrom?: string;
  map?: Record<string, ReferenceKind>;
}

/** Column descriptor for an `objectList` repeater row. */
export interface FlowConfigColumn {
  key: string;
  label: string;
  kind: 'text' | 'expression' | 'boolean' | 'select' | 'reference';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  /** For `kind: 'reference'` — the picker data source (may be polymorphic). */
  ref?: FlowReferenceSpec;
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
  /** Reference target for `reference` fields — drives the combobox data source. */
  ref?: FlowReferenceSpec;
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
        { value: 'record-before-update', label: 'Record before update' },
        { value: 'record-after-delete', label: 'Record deleted' },
        { value: 'record-change', label: 'Record changed (any)' },
        { value: 'schedule', label: 'Schedule (cron)' },
        { value: 'manual', label: 'Manual / autolaunched' },
        { value: 'webhook', label: 'Webhook / API' },
        { value: 'event', label: 'Platform event' },
      ],
    }),
    cfg('objectName', 'Object', 'reference', {
      ref: { kind: 'object' },
      placeholder: 'crm_lead',
      help: 'Target object for record / scheduled-scan triggers.',
    }),
    cfg('condition', 'Entry condition', 'expression', {
      placeholder: 'status == "qualifying" && previous.status != "qualifying"',
      help: 'CEL predicate — the flow runs only when this is true. Leave empty to run on every event.',
    }),
    cfg('cron', 'Cron schedule', 'text', {
      placeholder: '0 7 * * *',
      help: 'Cron expression for scheduled triggers.',
      showWhen: { field: 'triggerType', equals: ['schedule'] },
    }),
    // Legacy keys — rendered only when present so older metadata never falls
    // back to raw JSON. Prefer `condition` / `cron` above for new flows.
    cfg('criteria', 'Entry condition (legacy)', 'expression', {
      placeholder: 'status == "active"',
      help: 'Legacy key — prefer "Entry condition" (condition).',
      showWhen: { field: '__legacy__', equals: [] },
    }),
    cfg('schedule', 'Cron schedule (legacy)', 'text', {
      placeholder: '0 9 * * *',
      help: 'Legacy key — prefer "Cron schedule" (cron).',
      showWhen: { field: '__legacy__', equals: [] },
    }),
  ],
  end: [
    cfg('outcome', 'Outcome', 'text', { placeholder: 'success · failure' }),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'result' }),
  ],
  decision: [
    cfg('conditions', 'Branches', 'objectList', {
      help: 'Each branch has a label and a CEL expression (spec decision shape). A branch whose expression is "true" is the default/else path.',
      columns: [
        { key: 'label', label: 'Label', kind: 'text', placeholder: 'Has deals' },
        { key: 'expression', label: 'Expression', kind: 'expression', placeholder: 'expiring_deals.length > 0' },
      ],
    }),
    cfg('condition', 'Condition (single)', 'expression', {
      placeholder: 'amount > 10000',
      help: 'Legacy single-branch condition (CEL). Prefer Branches above; per-edge conditions also live on the outgoing edges.',
      showWhen: { field: '__legacy__', equals: [] },
    }),
  ],
  assignment: [
    cfg('assignments', 'Assignments', 'keyValue', {
      help: 'Set variables: each key is a variable, each value an expression or literal.',
    }),
  ],
  loop: [
    cfg('collection', 'Collection', 'expression', { placeholder: '{leadList}', help: 'Expression resolving to the items to iterate.' }),
    cfg('iteratorVariable', 'Item variable', 'text', { placeholder: 'currentItem' }),
  ],
  // Sequential multi-instance (ADR-0037 A2): a per-item subflow, one at a time;
  // each item may durably pause (e.g. a per-item approval).
  map: [
    cfg('collection', 'Collection', 'expression', { placeholder: '{items}', help: 'Expression resolving to the array to process, one item at a time.' }),
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
  // Script — overloaded in real metadata. Two observed shapes, discriminated by
  // `actionType`: notification (actionType: email/sms/... → template/recipients/
  // variables) and code (no actionType → script/outputVariables). The form adapts
  // on actionType; unknown values still show the code fields so nothing is lost.
  script: [
    cfg('actionType', 'Action type', 'select', {
      options: [
        { value: 'code', label: 'Code' },
        { value: 'email', label: 'Email' },
        { value: 'sms', label: 'SMS' },
        { value: 'notification', label: 'Notification' },
      ],
      defaultValue: 'code',
      help: 'How this step runs. Leave as Code for a raw script.',
    }),
    cfg('template', 'Template', 'reference', {
      // Polymorphic: an email step picks from the email-template catalog; sms /
      // notification have no flat catalog yet, so they degrade to free text.
      ref: { kindFrom: 'actionType', map: { email: 'email-template' } },
      placeholder: 'case_escalated',
      help: 'Message template id.',
      showWhen: { field: 'actionType', equals: ['email', 'sms', 'notification'] },
    }),
    cfg('recipients', 'Recipients', 'stringList', {
      help: 'One recipient per row (user id, field ref, or address).',
      showWhen: { field: 'actionType', equals: ['email', 'sms', 'notification'] },
    }),
    cfg('variables', 'Template variables', 'keyValue', {
      help: 'Values injected into the template.',
      showWhen: { field: 'actionType', equals: ['email', 'sms', 'notification'] },
    }),
    cfg('script', 'Code', 'textarea', {
      placeholder: 'return { ok: true };',
      help: 'Script body (JS/TS).',
      showWhen: { field: 'actionType', equals: ['code'] },
    }),
    cfg('outputVariables', 'Output variables', 'stringList', {
      help: 'Names of variables this script writes back.',
      showWhen: { field: 'actionType', equals: ['code'] },
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
          options: [
            { value: 'user', label: 'User' },
            { value: 'role', label: 'Role' },
            { value: 'team', label: 'Team' },
            { value: 'department', label: 'Department' },
            { value: 'manager', label: 'Manager' },
            { value: 'field', label: 'Field' },
            { value: 'queue', label: 'Queue' },
          ],
        },
        {
          // Polymorphic: the picker follows the row's `type`. `manager` takes no
          // value (resolved from the submitter's manager_id) so it stays unmapped
          // → free text; unmapped/empty types likewise fall back to free text.
          key: 'value',
          label: 'Value',
          kind: 'reference',
          placeholder: 'user id / role / field — per type',
          ref: {
            kindFrom: 'type',
            objectSource: '$trigger',
            map: {
              user: 'user',
              role: 'role',
              team: 'team',
              department: 'department',
              field: 'object-field',
              queue: 'queue',
            },
          },
        },
      ],
    }),
    cfg('behavior', 'Behavior', 'select', {
      options: [
        { value: 'first_response', label: 'First response wins' },
        { value: 'unanimous', label: 'Unanimous (all approve)' },
      ],
      defaultValue: 'first_response',
      help: 'How multiple approvers combine.',
    }),
    cfg('lockRecord', 'Lock record', 'boolean', {
      help: 'Lock the triggering record from edits while this node is pending.',
    }),
    cfg('approvalStatusField', 'Status field', 'reference', {
      ref: { kind: 'object-field', objectSource: '$trigger' },
      placeholder: 'approval_status',
      help: 'Business-object field to mirror request status onto (pending/approved/rejected). Should be readonly.',
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
    { id: 'escalation.escalateTo', path: ['config', 'escalation', 'escalateTo'], label: 'Escalate to', kind: 'reference', ref: { kind: 'role' }, placeholder: 'user id / role / manager level', showWhen: { field: 'escalation.enabled', equals: ['true'] } },
    { id: 'escalation.notifySubmitter', path: ['config', 'escalation', 'notifySubmitter'], label: 'Notify submitter', kind: 'boolean', showWhen: { field: 'escalation.enabled', equals: ['true'] } },
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
    }),
    at('waitEventConfig', 'timerDuration', 'Duration', 'text', {
      placeholder: 'PT1H · P3D',
      help: 'ISO 8601 duration (e.g. PT1H, P3D).',
      showWhen: { field: 'waitEventConfig.eventType', equals: ['timer'] },
    }),
    at('waitEventConfig', 'signalName', 'Signal name', 'text', {
      placeholder: 'contract.renewed',
      showWhen: { field: 'waitEventConfig.eventType', equals: ['signal', 'webhook'] },
    }),
    at('waitEventConfig', 'timeoutMs', 'Timeout (ms)', 'number', { placeholder: '3600000' }),
    at('waitEventConfig', 'onTimeout', 'On timeout', 'select', {
      options: [
        { value: 'fail', label: 'Fail' },
        { value: 'continue', label: 'Continue' },
      ],
      defaultValue: 'fail',
    }),
  ],
  subflow: [
    cfg('flowName', 'Flow', 'reference', { ref: { kind: 'flow' }, placeholder: 'escalation_flow' }),
    cfg('input', 'Input mapping', 'keyValue', { help: 'Values passed to the subflow\u2019s input variables.' }),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'subResult' }),
    { id: 'timeoutMs', path: ['timeoutMs'], label: 'Timeout (ms)', kind: 'number', placeholder: '60000' },
  ],
  connector_action: [
    at('connectorConfig', 'connectorId', 'Connector', 'reference', { ref: { kind: 'connector' }, placeholder: 'slack · email · salesforce' }),
    // actionId is polymorphic on the chosen connector and has no flat catalog
    // (a deliberate open extension point) — stays free text.
    at('connectorConfig', 'actionId', 'Action', 'text', { placeholder: 'sendMessage · send' }),
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

/** Read the current value at a field's node path. */
export function getFieldValue(node: Record<string, unknown> | null | undefined, field: FlowConfigField): unknown {
  let cur: unknown = node;
  for (const seg of field.path) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) cur = (cur as Record<string, unknown>)[seg];
    else return undefined;
  }
  return cur;
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
