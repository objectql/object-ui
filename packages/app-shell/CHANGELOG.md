# @object-ui/app-shell — Changelog

## 16.0.0

### Minor Changes

- d3e19ed: Adapt to framework 15.1: (1) ADR-0067 D2 all-or-nothing publishes — `formatPublishFailures` renders a rolled-back batch as ONE banner anchored on the causal item (`batch_aborted` entries are summarized, not listed as parallel errors); PackagesPage says "rolled back because X" instead of "{n} failed"; the AI chat publish toast surfaces the real reason instead of a bare count. Pre-15.1 partial-publish responses keep their per-item rendering. (2) ADR-0076 D12 honest discovery — `DiscoveryServiceStatus` gains `handlerReady` + `degraded`/`stub` statuses, new backward-tolerant `isServiceUsable()` helper (absent fields keep the pre-15.1 default; `stub`/`handlerReady:false` gate off; `degraded` stays usable), consumed by `isAuthEnabled`/`isAiEnabled` and `ConditionalAuthWrapper`.
- 5534535: feat(grid): built-in row Edit/Delete honor per-record CEL predicates (#2614)

  The object's `userActions.edit` / `userActions.delete` now also accept an
  object form `{ enabled?, visibleWhen?, disabledWhen? }`. The predicates are
  evaluated per row on the canonical CEL engine (`useRowPredicate`, the same
  machinery custom row actions use): `visibleWhen` false → the built-in
  Edit/Delete item is not rendered for that row (fail-closed); `disabledWhen`
  true → rendered disabled (fail-soft). Wired through ObjectGrid's
  RowActionMenu and the data-table's row overflow menu (the related-list
  path), with the app-shell `crudAffordances` mirror kept in lockstep.
  Omitting the predicates (or using plain booleans) keeps today's behavior
  bit-for-bit; declared predicates evaluate only when a row's menu opens, so
  grid rendering cost is unchanged.

### Patch Changes

- c0bd483: Plan-card approval gives immediate in-card feedback (#2627): clicking
  "Build it" flips the clicked card to a spinning "Building…" badge right away
  (the approval's chat-level effects land at the bottom of the thread, outside
  the viewport, so the card looked untouched for ~10s and users double-clicked).
  The durable Built state still derives from the message stream; an approval
  that never left the client (rate limit / offline) rolls the badge back so the
  button returns. New `planBuildingLabel` prop (AiChatPage passes zh).
- 59d4fa9: fix(detail): show the "Locked for approval" band on request-tracked backends (objectui#2618)

  The DetailView approval-lock band keyed only off the record's own
  `approval_status` field, so it never rendered on backends that track the lock
  via an open approval request and never materialize that field — even though
  the lock was real (writes rejected with `RECORD_LOCKED`). The record-level
  `InlineEditContext` now carries the host's `locked`/`lockedReason` signal
  (the same dual-source `approvalLocked` that already gates `canEdit` in
  `RecordDetailView`), and the band renders from it while keeping `DetailView`
  DataSource-agnostic. Also backfills the approval-lock strings into the detail
  translation defaults so a bare DetailView shows the label, not the raw i18n key.

- 6c53960: fix(studio): approver Type is a real dropdown that drops the deprecated `role` spelling (framework #3133)

  The flow designer's approver `Type` control silently rendered as free text:
  `FlowObjectListField` had no `select` branch, so an objectList column of kind
  `select` (which the approver type is, derived from the spec enum) fell through
  to a plain `<Input>` and its computed options were never shown. Added the
  missing branch — it renders a real dropdown from the column's `options`, and
  keeps a **stored** value that is no longer offered (a deprecated enum member)
  visible-but-flagged so editing a legacy row can't silently blank it.

  With the dropdown live, it honors framework's new `xEnumDeprecated` schema
  annotation (ADR-0090 D3): the deprecated `role` approver type is dropped from
  the options while `org_membership_level` is offered, so Studio no longer walks
  authors into the trap of picking `role` (which resolves against the better-auth
  membership tier and silently matches nobody).

  Also: the `org-membership-level` reference picker is a fixed three-value enum
  (owner/admin/member) instead of the dead `client.list('role')` — the `role`
  metadata type was removed by ADR-0090 D3, so that call returned nothing and the
  Value box degraded to free text.

- 6a8ebb7: chore(metadata-admin): stop surfacing metadata fields the spec dropped (framework#2377)

  `@objectstack/spec` removes a batch of dead, unenforced author-facing metadata
  properties (ADR-0049 enforce-or-remove, framework PR #3176). Two of them were
  still _displayed_ — never enforced, but shown — in the Studio metadata-admin,
  which is the same false affordance on the UI side. Both were read defensively
  off raw documents, so this is a display-only cleanup with no runtime impact:

  - **`dataset` measure `certified`** — `useDatasetCatalog` populated a
    `DatasetMeasureInfo.certified` flag (and `DatasetDefaultInspector` carried it
    in its local `Measure` type) that nothing ever rendered. Dropped both; the
    measure picker/inspector is unchanged otherwise.
  - **`agent.planning.strategy` / `allowReplan`** — `AgentPreview`'s Planning rail
    listed both alongside the one live knob. Narrowed the `KeyVals` keys to
    `['maxIterations']` (the only planning field the runtime reads).

  Test fixtures that set `certified` were updated. No public component API change.

- 33b4995: Welcome-page "Create your environment" deep-links straight into the create
  dialog (#844): `action:button` gains a client-side `autoTrigger` flag (runs
  the action once on mount — same execute path as a click, so param dialogs /
  confirms / entitlement gates still apply), and the environments list consumes
  `?runAction=create_environment` to mark its create action once entitlements
  resolve (upgrade-locked orgs get the upgrade prompt instead; the param is
  stripped after consumption so refresh/back don't re-open). Also localizes the
  EnvironmentListToolbar's state-aware label overrides ({en,zh}) — they were
  hard-coded English inside a zh console.
- Updated dependencies [d3e19ed]
- Updated dependencies [c0bd483]
- Updated dependencies [59d4fa9]
- Updated dependencies [4c7c47f]
- Updated dependencies [210806a]
- Updated dependencies [80977d0]
- Updated dependencies [9d4a429]
- Updated dependencies [b4ef588]
- Updated dependencies [45c6fb4]
- Updated dependencies [ca0f5f0]
- Updated dependencies [077e45b]
- Updated dependencies [022735f]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
- Updated dependencies [195a651]
- Updated dependencies [33b4995]
  - @object-ui/react@16.0.0
  - @object-ui/plugin-chatbot@16.0.0
  - @object-ui/plugin-detail@16.0.0
  - @object-ui/components@16.0.0
  - @object-ui/plugin-designer@16.0.0
  - @object-ui/types@16.0.0
  - @object-ui/plugin-grid@16.0.0
  - @object-ui/plugin-form@16.0.0
  - @object-ui/auth@16.0.0
  - @object-ui/i18n@16.0.0
  - @object-ui/fields@16.0.0
  - @object-ui/layout@16.0.0
  - @object-ui/plugin-calendar@16.0.0
  - @object-ui/plugin-charts@16.0.0
  - @object-ui/plugin-dashboard@16.0.0
  - @object-ui/plugin-editor@16.0.0
  - @object-ui/plugin-kanban@16.0.0
  - @object-ui/plugin-list@16.0.0
  - @object-ui/plugin-report@16.0.0
  - @object-ui/plugin-view@16.0.0
  - @object-ui/collaboration@16.0.0
  - @object-ui/core@16.0.0
  - @object-ui/data-objectstack@16.0.0
  - @object-ui/permissions@16.0.0
  - @object-ui/providers@16.0.0

## 15.0.0

### Patch Changes

- Updated dependencies [bb22788]
  - @object-ui/plugin-detail@15.0.0
  - @object-ui/plugin-calendar@15.0.0
  - @object-ui/plugin-kanban@15.0.0
  - @object-ui/types@15.0.0
  - @object-ui/core@15.0.0
  - @object-ui/i18n@15.0.0
  - @object-ui/react@15.0.0
  - @object-ui/components@15.0.0
  - @object-ui/fields@15.0.0
  - @object-ui/layout@15.0.0
  - @object-ui/data-objectstack@15.0.0
  - @object-ui/auth@15.0.0
  - @object-ui/permissions@15.0.0
  - @object-ui/plugin-charts@15.0.0
  - @object-ui/plugin-chatbot@15.0.0
  - @object-ui/plugin-dashboard@15.0.0
  - @object-ui/plugin-designer@15.0.0
  - @object-ui/plugin-editor@15.0.0
  - @object-ui/plugin-form@15.0.0
  - @object-ui/plugin-grid@15.0.0
  - @object-ui/plugin-list@15.0.0
  - @object-ui/plugin-report@15.0.0
  - @object-ui/plugin-view@15.0.0
  - @object-ui/collaboration@15.0.0
  - @object-ui/providers@15.0.0

## 14.1.0

### Minor Changes

- 82441e4: feat(console-ai): proactive AI usage indicator in the ChatDock (ADR-0057 #8)

  Surfaces remaining AI headroom **before** a send hits the 429 wall, instead of
  only learning the limit reactively.

  - **AiUsageIndicator** — two meters (build + dataChat) as small progress rings in
    the ChatDock header (desktop rail + mobile sheet). Near-full → an amber
    "running low" hint and a popover with "resets tonight / next cycle" plus the
    upgrade / top-up CTA (reusing the 429 deep-link). D5-safe: fractions and
    qualitative words only, never a token number. Hides itself when the usage
    endpoint is absent (older backend / OSS / no seat).
  - **useAiUsage** — fetches the D5-safe per-meter fractions; refetches on the chat
    engine's post-turn / 429 nudge and on tab re-focus; fails soft to nothing.
  - **useObjectChat** emits `AI_USAGE_REFRESH_EVENT` on a rejected send (429) and on
    the turn-finish edge so the ring updates right after the user's action.
  - i18n: `console.ai.usage.*` in en + zh-CN.

  Consumes the cloud `GET /api/v1/ai/usage` endpoint (objectstack-ai/cloud#824).

- 0908391: feat(flow-designer): connector picker lists dispatchable connectors + marks declarative instances (ADR-0096)

  The `connector_action` node's connector picker read `client.list('connector')` —
  the declared `connectors:` metadata, which includes inert catalog descriptors and
  **misses** plugin-registered connectors. It now reads the runtime registry
  (`GET /api/v1/automation/connectors`), i.e. exactly the connectors a
  `connector_action` can dispatch: plugin connectors and materialized declarative
  instances (framework ADR-0096). Declarative instances are annotated `· declarative`
  (from the descriptor's new `origin` field) so authors can tell a materialized
  metadata connector apart from a plugin one. Degrades to empty on fetch failure;
  the field stays free-text editable. Tolerates an older backend with no `origin`.

- 937b8ef: feat(app-shell): C2-β — AccessExplainPanel record 粒度渲染 (framework#2920)

  AccessExplainPanel 现支持记录级解释(ADR-0095):

  - **记录选择器**:选定对象后可输入或从 RecordPickerDialog 选择一条 `recordId`;请求带上 `recordId`。
  - **逐层行级归因**:每层展开该记录的 `record` 归因——outcome 徽标(准入/排除/未评估)、命中的 `rules[]`(权限集 → 岗位 → 共享 → 行规则,含 kind/grants/via/effect 三态圆点)、有效行过滤(rowFilter JSON)、matchesRecord。
  - **顶部记录判定**:`record.visible` 结论横幅 + `decidedBy` 决定性层(该记录为何可见/不可见)。
  - **posture / kernelTier**:principal 卡片显示 posture 档位徽标;每层显示 kernel tier(租户墙 vs 业务 RLS)标签。
  - i18n:en + zh-CN 全量 key。

  **向后兼容**:不带 `recordId` 时行为与对象级完全一致。

- 9530323: Studio object designer: the field inspector's conditional rules (`visibleWhen` / `readonlyWhen` / `requiredWhen`) are now edited with a proper CEL editor — live syntax/semantic validation and autocomplete (object fields after `record.` / `previous.`, the runtime-bound roots `record`/`previous`/`parent`, and the CEL stdlib), backed by the same `@objectstack/formula` validators the server uses. Bare field references are flagged with the exact `record.<field>` fix, the deprecated `conditionalRequired` alias migrates to `requiredWhen` on first edit, and draft validation reports an invalid predicate on any field under its `fields.<field>.<rule>` path before save. (#1582)
- 754549a: Studio formula fields get the CEL editor: the field inspector's formula textarea is now the same lint + autocomplete editor as conditional rules, running in the new `role: 'value'` mode (scope `record`, roots `['record']`) with an inferred result-type affordance — the `@objectstack/formula` verdict dataset measure eligibility keys off. Edits land on the spec's `expression` key (migrating the engine-dead legacy `formula` key) and stamp `Field.returnType` from the proven type. Summary fields drop the dead formula textarea for a structured `summaryOperations` roll-up editor, and `validateMetadataDraft('object')` now lints every formula expression draft-wide.
- cee5d6e: feat(app-shell): CEL authoring safety for RLS policies — lint, field autocomplete, test-run (objectui#2413)

  The permission-set Studio editor's Row-Level Security section
  (`PermissionAdvancedFacets`) let admins author `USING` (read filter) / `CHECK`
  (write filter) predicates as hand-typed CEL with **no validation, no
  autocomplete, and no way to test**. RLS is security-critical: a typo silently
  mis-scopes rows, and some evaluation paths **fail open** — widening access with
  no visible error. The `USING`/`CHECK` editors now run three author-time
  safeties, all delegated to the framework's canonical CEL engine
  (`@objectstack/formula`) so the GUI reaches the **same verdict as the server**
  rather than maintaining a second grammar:

  - **Inline lint** (`CelPredicateField`) — `validateExpression` flags parse
    faults inline (and gates Save), unknown-field near-misses as non-blocking
    "did-you-mean" warnings, and a non-pushdown-able `USING` filter as a
    fail-open blast-radius advisory (`isPushdownableCel`).
  - **Field autocomplete** — `introspectScope` offers the target object's fields
    plus scope vars (`current_user`, `record`, …) and stdlib functions as you
    type, so an identifier that would silently never match is caught early.
  - **Test-run** (`CelTestRunDialog`) — dry-runs a predicate against a sample
    record + `current_user` and shows allow / deny / non-boolean / error before
    shipping.

  The engine loads lazily (dynamic `import`, feature-detected and
  error-swallowing), keeping the CEL parser out of the main bundle; a
  missing/older engine degrades to "no assistance" rather than breaking the
  editor. New bridge: `metadata-admin/celAuthoring.ts`. New `perm.cel.*` i18n keys
  (en + zh-CN).

- eeef906: Studio: CEL lint + field autocomplete for condition predicates (#1582).

  `ConditionBuilder`'s raw-expression escape hatch — a bare `<textarea>` — is
  replaced by `CelPredicateField`, so every surface that authors a condition
  through it gains inline syntax/semantic validation and field-name autocomplete
  on the canonical `@objectstack/formula` engine:

  - field-level `visibleWhen` / `readonlyWhen` / `requiredWhen` (SchemaForm's
    `condition` widget auto-maps `/When$/` properties),
  - action `visible` / `disabled` (ActionDefaultInspector),
  - every other `condition`-widget property (`visibleOn`, `predicate`, …).

  The no-code [subject][op][value] builder path is unchanged; only the "Expression"
  mode is upgraded. An invalid predicate now surfaces a readable inline error
  instead of failing silently at runtime. English + Chinese labels.

  This completes the objectui side of #1582 — the CEL assists it asked for now
  cover the field `*When` inputs (and, since the previous change, view
  `conditionalFormatting` conditions).

- c1df2e1: Studio dashboard widget inspector: visual `filterBindings` editor (#2578
  item 4, framework#2501). When the dashboard declares filters (`dateRange` /
  `globalFilters`), the widget inspector shows a "Dashboard filter bindings"
  section with one row per filter: an **Apply** toggle (unticked writes
  `filterBindings[name] = false`, opting the widget out) and a field picker
  that re-targets the filter to one of THIS widget's fields (empty = default:
  the filter's own field). Previously bindings were only configurable through
  raw JSON metadata. Filter rows come from the same `resolveDashboardFilterDefs`
  normalization the runtime broadcasts from, so the editor offers exactly the
  filters the renderer will apply.
- 471c5d3: feat(detail): editable record highlights on the shared inline-edit draft (objectui#2407 P2)

  The highlights strip is now editable in place and shares ONE draft + ONE atomic
  Save with the details body (building on the P1 `InlineEditContext` / `#2529`
  `InlineFieldInput`).

  - **`HeaderHighlight`** consumes `useInlineEdit()`: hovering a highlight shows a
    pencil and double-click enters the shared record edit session; each editable
    highlight renders the same `<InlineFieldInput>` the body uses (value =
    `draft[name] ?? data[name]`, write via `setField`). Computed
    (`formula`/`summary`/`rollup`/`auto_number`), `readonly`, and system fields
    expose no editor. Empty highlights are kept while editing so they can be
    filled. Compact-layout UX: an actively-edited column widens and renders the
    editor full-width (Salesforce-style expand-on-edit).
  - **`RecordDetailView`** (app-shell) hosts ONE `<InlineEditProvider>` (with the
    object-lifecycle `canEdit` gate) spanning both `record:highlights` and
    `record:details`, plus the single record-level `<InlineEditSaveBar>` — so a
    highlight edit and a body edit commit together in ONE
    `update(obj, id, draft, { ifMatch })`.
  - **`record:details`** drops its P1-local provider/save bar (it would otherwise
    split the draft from the highlights) and just consumes the shared context;
    **`record:highlights`** threads the DataSource through for lookup/user editors.

  Guardrails preserved: computed/readonly/system highlights non-editable; `canEdit`
  gate; OCC (`ifMatch` + `ConcurrentUpdateDialog`); only user-edited keys are sent.

- d50977c: feat(flow-designer): pick the target node per branch in the Decision Branches editor (#1942)

  The decision node's Branches editor gains a **Target** column — a node picker
  scoped to the flow's own nodes — so a business user can author the whole
  decision (conditions _and_ destinations) in one table, mirroring Salesforce
  Flow Decision Outcomes. Completes #1930 (the per-edge Branch picker) from the
  node side.

  - The column is **virtual**: its value is derived from the decision's outgoing
    edges (the routing source of truth) and never persisted on
    `config.conditions`, so it round-trips with the `FlowEdgeInspector` Branch
    picker and canvas rewiring for free.
  - Picking a target creates the branch's out-edge if missing, or updates /
    retargets the existing one in place, carrying the branch's condition, label,
    and default flag. Clearing a target detaches (removes) that branch's edge —
    never the node it pointed at. Custom per-edge guards, fault/back edges, and
    surplus canvas wiring are never touched.
  - A branch list committed with no targets anywhere (e.g. an engine-published
    configSchema form without the column) keeps the legacy #1927 by-order edge
    mirror, byte-for-byte.
  - New pure module `flow-decision-edges.ts` with unit tests for the
    branch→edge reconciliation.

- 77b40db: Flow designer add-node palette follow-ups (#1943): localize the category section headings (Data / Logic / Human / Integration / Flow) to the active console language, and upgrade the "Recently used" list from browser-local storage to per-user cloud sync via `sys_user_preference` (new `FlowPaletteRecentsProvider` / `useFlowPaletteRecents`), with one-shot migration of the legacy localStorage key and a localStorage fallback when offline or outside a provider. Adds a Flow Designer guide to the docs.
- d90d773: Flow builder: add a search box, keyboard navigation, and a "Recently used" group to the Add-node palette (#1943). Typing filters across all categories (label + hint + type, case-insensitive), ↑/↓ + Enter inserts the highlighted node, and the empty-query view is topped by a localStorage MRU of recently inserted node types. Works with the server-merged palette, so plugin-contributed nodes are searchable too.
- ae66bfa: feat(metadata-admin): page variable `source` is a component picker, not free text (#2328)

  When editing a Page in Studio, a variable's **`source`** under Data Context now
  renders as a dropdown of the component `id`s placed on the page, instead of a
  plain text input the author had to type an id into by hand. This mirrors the
  sibling `object` field's `ref:object` picker.

  - New `ref:component` widget in `widgets.tsx` + a `collectPageComponentIds()`
    helper that walks the draft's `regions[].components[]` tree (including nested
    containers), de-duped in document order. Falls back to a free-text input when
    the page has no components yet, and preserves stale/renamed ids.
  - `WidgetContext` gains `componentIds`; `ResourceEditPage` derives it from the
    live page draft so newly-placed components appear immediately.

  Pairs with the framework form-spec change (`@objectstack/spec`) that pins
  `widget: 'ref:component'` on the page `variables.source` sub-field.

- 6c0135c: feat(page-header): metadata-driven multi-button record header (#2361)

  The record detail page header no longer hardcodes a single inline primary
  button (`INLINE_MAX = 1`). It now renders up to `maxVisible` actions
  side-by-side (default 3 desktop / 1 mobile, overridable via
  `maxVisible` / `mobileMaxVisible` on the `page:header` schema) — the same
  contract as `action:bar` — so multi-action objects (e.g. Lead: Convert /
  Assign / Return) can surface several primary buttons at once.

  Which actions claim the inline slots is declared in metadata, mirroring the
  `action:bar` #2339 rules:

  - `order` ascending (unset = 0; lower = more prominent), stable sort;
  - `variant: 'primary'` as a tie-break within equal order (also mapped to the
    Shadcn `default` Button variant instead of leaking through);
  - `component: 'action:menu'` pins an action inside the `⋯` overflow menu
    regardless of the action count.

  The synthesized system actions declare their placement accordingly:
  `sys_edit` gets `order: 100` (behind every authored business action, but
  still inline when slots remain), while `sys_share` / `sys_delete` are pinned
  into the `⋯` menu via `component: 'action:menu'` — Delete never surfaces as
  an inline red button just because an object has few actions.

- f0f10f5: feat(kanban): default lane field honours the ADR-0085 `stageField` role

  Kanban views without an explicit `groupByField`/`groupField` hard-coded their
  lane field to the literal `'status'` (in both app-shell's ObjectView options
  and plugin-list's ListView fallback) — ignoring the object's declared
  lifecycle and even inventing a field the object doesn't have. The default now
  resolves through the shared `stageField` detector:

  1. explicit view config (unchanged, always wins);
  2. the object's `stageField` semantic role;
  3. `stageField: false` → **no default lanes** (the status-shaped field is
     declared non-linear; the board renders its empty state until the view
     picks a lane field explicitly);
  4. else the shared name/type heuristic (status / stage / state / phase by
     name, then status/stage by type) — never a nonexistent field.

  `detectStatusField` moved from `@object-ui/plugin-detail` to
  `@object-ui/types` (new export, with the `StatusFieldSource` input type) so
  plugin-list and app-shell share the exact semantics; plugin-detail re-exports
  it unchanged.

  Also fixes ListView's pre-existing rules-of-hooks error while touching the
  file: `useListFieldLabel` wrapped `useObjectLabel()` in try/catch (hook-order
  desync risk; the hook is provider-safe) — same fix as objectui#2595's
  `useFieldLabel`.

  Behavior change is limited to kanban views with no explicit lane field on
  objects that either declare `stageField` (now honoured), declare
  `stageField: false` (now suppressed), or have no status-shaped field at all
  (previously grouped by a nonexistent `status` into one "undefined" lane; now
  an honest empty state). Objects with a real `status` field — the common case —
  are unchanged.

- 466a5c6: feat(studio-access): package-level OWD overview — audit & batch-edit sharingModel (objectui#2505)

  Add a package-scoped **"Record Sharing Baseline (OWD)"** panel to the Studio
  Access pillar, a sibling surface next to the permission-set rail. It surveys —
  and batch-edits — the org-wide default of every object the package owns, so an
  author no longer has to open each object's Settings page to audit the baseline.

  - **`PackageOwdOverviewPanel`** — a table of object × `sharingModel` ×
    `externalSharingModel` covering the package's objects (published ∪ pending
    drafts). Inline selects reuse the canonical four OWD values and the option
    labels/help copy from `ObjectSettingsPanel`. Save writes one package-scoped
    metadata **draft per changed object** (identical to the per-object Settings
    write); publish flows through the unchanged security-domain gate.
  - `controlled_by_parent` rows show the master link (read-only) instead of an
    external dial; row-level `external ≤ internal` validation (ADR-0090 D11) is
    surfaced inline and blocks Save.
  - New shared **`owd-sharing.ts`** — `OWD_MODELS`, the `OWD_WIDTH` axis,
    `isExternalWider`, `deriveMasterObject`.
  - The Access pillar hosts it via a pinned rail entry + the existing `?surface=`
    deep-link (`owd:overview`); the read-only OWD badge in `PermissionMatrixEditor`
    now links here (plain chip at environment scope, unchanged).
  - Read-only packages render the table non-editable. EN + zh-CN i18n.

- fba6875: Studio: author list/grid `conditionalFormatting` rules with a CEL editor (#1584 / #1582 follow-up).

  `conditionalFormatting` previously had no authoring UI in Studio — a low-code
  author could only hand-write the JSON. Adds a `ConditionalFormattingEditor` to the
  View inspector (`ViewVariantInspector`, list-family views; also hosted by the
  runtime ObjectView's right-rail view editor): an ordered list of rules, each a
  **CEL predicate** authored with `CelPredicateField` (inline lint + field
  autocomplete on the canonical `@objectstack/formula` engine — the same engine the
  runtime and server use) plus background / text / border colors. Rules are
  first-match-wins, so the editor supports move up / down.

  It reads and writes the spec-canonical `{ condition, style }` shape (what the list
  / grid / kanban renderers evaluate since #1584). Legacy rule shapes — native
  `{ field, operator, value }`, top-level color props, or a `{ dialect, source }`
  condition envelope — are normalized to `{ condition, style }` on read, so opening
  an existing rule upgrades it in place. English + Chinese labels included.

- 2fe6659: feat(metadata-admin): create form-family views through the View create UI (#2323)

  `ViewItemSchema` is a discriminated union on `viewKind` (`list` | `form`), but the
  View create form could only ever emit `viewKind: 'list'` — its `createBuildBody`
  hardcoded the family and routed the chosen `kind` straight into `config.type`, so
  form-family views were unreachable through the create UI.

  - **Create schema** now asks for the **view family** up front (`viewKind`:
    List / Form) and offers the layout types appropriate to that family — the
    existing list layouts (grid / kanban / gallery / calendar / timeline / gantt /
    chart) for `list`, and the `FormViewSchema` layouts (simple / tabbed / wizard /
    split / drawer / modal) for `form`.
  - **`createBuildBody`** discriminates on `viewKind`: a form view builds a
    `FormViewSchema` config (`{ type, data, sections: [] }`) instead of the list
    `{ type, columns: [], data }`. Both build outputs validate against the real
    `@objectstack/spec` `ViewItemSchema`.
  - **SchemaForm** flat (create) rendering now honors per-property `visibleOn`, so
    the list-layout picker shows only for List and the form-layout picker only for
    Form. Additive and a no-op when a property has no predicate.

### Patch Changes

- 2efa9fd: Detail-page UX follow-ups from the ADR-0085 PR4 real-backend browser pass (framework#2548):

  - **Highlight strip no longer repeats the record title.** A declared
    `highlightFields` list containing the title field rendered it as the first
    chip — truncated — directly under the identical page H1. `deriveHighlightFields`
    now resolves the title (`primaryField` / `nameField` / deprecated
    `displayNameField`, else the conventional display-field names) via the new
    exported `resolveTitleField` and filters it from declared lists before the
    4-chip cap, matching what the heuristic branch always did. app-shell's
    `RecordDetailView` synthParts (which pre-computes the list and bypasses the
    derivation) applies the same filter.
  - **Per-field currency reaches the renderers.** The spec channel
    (`currencyConfig.defaultCurrency`) was dropped by the highlight-strip and
    detail-section field enrichment, so a spec-authored currency field could
    never show its symbol ("25,000,000" instead of "$25,000,000");
    `resolveFieldCurrency` reads it second after the designer-only bare
    `currency` key.
  - **app-shell approvals fetches send the Bearer token.** The header badge
    poll, home-inbox count, and record-page approvals panel were cookie-only
    (new shared `bearerAuthHeaders()` util) — same split-origin failure mode as
    the console `approvalsApi` fix below.
  - **`fieldGroups[].icon` / `description` reach detail pages.** The shared
    derivation (ADR-0085 §5) already passed them through; the detail synth
    dropped them. Sections now carry both, and `DetailSection` renders a real
    Lucide icon for identifier-shaped names (emoji/text values keep the
    historical text rendering).
  - **Record meta footer stops dangling without an actor.** Seeded/system rows
    with `created_by: null` rendered "Created by · 10m ago"; the footer now
    falls back to actor-less labels ("Created / Updated"), with new i18n keys in
    all six locales (and the zh `createdBy`/`updatedBy` mistranslation fixed:
    创建人/更新人, not 创建于/更新于).
  - **Select badges ellipsize instead of clipping mid-glyph.** In bounded
    containers (highlight-strip columns, grid cells) an overlong option label
    used to be cut at the container edge ("Technolog…"); badges now shrink with
    an inner truncate and expose the full label as a hover title. The highlight
    strip's hover title also prefers the option label over the raw stored value.

  Console app (unversioned): `approvalsApi` now sends the stored Bearer token
  like every other console call — cookie-only auth silently lost the approvals
  surface on split-origin deployments where the SameSite cookie doesn't flow.

- a56c596: chore(app-shell): remove the legacy monolith detail renderer + the `renderViaSchema` kill-switch (ADR-0085 PR4, #2181)

  `RecordDetailView` now always renders through the SchemaRenderer Page
  pipeline (an authored `PageSchema(pageType='record')` when assigned, else
  the `buildDefaultPageSchema` synthesis). The non-schema-driven monolithic
  `DetailView` branch and both of its entry points are gone:

  - `objectDef.detail?.renderViaSchema === false` is no longer read (it was
    the last surviving `detail.*` key — ADR-0085 removed the block from the
    spec, and the key had been kept only as this path's kill-switch);
  - the `?renderViaSchema=0` debug URL param is no longer honored.

  Also drops the legacy-only plumbing: the eager per-record related-lists
  fan-out (`record:related_list` self-fetches lazily on the schema path)
  and the intermediate `DetailViewSchema` translation layer. The
  `DetailView` component itself remains in `@object-ui/plugin-detail`
  (still used internally by the `record:details` renderer).

- d018ef8: fix(attachments): download attachments via authenticated signed URL (framework #2970)

  The framework now requires an authenticated session to download an
  attachments-scope file (the stable `/storage/files/:fileId` endpoint returns
  `401`/`403` for them). `RecordAttachmentsPanel`'s download control no longer
  uses a bare `<a href>` (which cannot carry the console's Bearer token) — it
  fetches a short-lived signed URL from `/storage/files/:fileId/url` with
  `createAuthenticatedFetch`, then opens it. `403 ATTACHMENT_DOWNLOAD_DENIED` and
  `401 AUTH_REQUIRED` map to friendly copy instead of a broken link.

- 2e49595: fix(attachments): authenticated uploads + friendly denial copy in RecordAttachmentsPanel (framework #2755)

  The framework now gates the storage upload routes on an authenticated session
  and enforces parent-derived attachment access. The panel's upload adapter
  accordingly authenticates with the console's Bearer token
  (`createAuthenticatedFetch` — the token console has no session cookie for
  `credentials: 'include'` to carry), and the new fail-closed 403 codes
  (`ATTACHMENT_DELETE_DENIED`, `ATTACHMENT_PARENT_ACCESS`, `PERMISSION_DENIED`)
  map to friendly copy instead of raw server errors. The delete button still
  renders for every row by design — the server is the gate, and the client
  lacks the parent-edit data to pre-compute it. `uploaded_by` is still sent for
  back-compat with older servers; current servers stamp it from the session.

- f4d25f5: feat(app-shell): A4 — permission-provenance tri-state badge (framework#2920)

  The Studio permission-matrix editor's provenance badge was two-state
  (package / custom). It is now a **tri-state — platform / package / admin(custom)**,
  mirroring the unified `sys_*.managed_by` vocabulary landed in framework#2920 so
  the Studio matrix and the Setup record page read the same source-of-truth
  labels.

  - `PermissionMatrixEditor` — `managedBy === 'platform'` renders a **Platform**
    badge; `'package'` (or an active `packageId`) renders **Package**; everything
    else (including legacy `'user'`) falls through to **Custom**.
  - New `perm.badge.platform` i18n key (en + zh-CN).

  The Setup record page surfaces provenance via the framework object's now-`select`
  `managed_by` field (rendered by the generic record renderer), so no record-page
  change is required here.

- 092bd85: Forward the authenticated user's `positions` into the client predicate scope (`current_user.positions`) in the console shell and the record form page. Position-gated select options (`'admin' in current_user.positions`, ADR-0058 / objectui#2284) now hide client-side like they do everywhere else, instead of failing open as visible and only being rejected by the server on submit — `positions` is the actor shape the framework rule-validator actually binds and enforces. Docs, the schema-catalog role-gated example, the skills guide, and inline examples switch the role-gating spelling from `current_user.roles` (never bound server-side, so never enforced) to `current_user.positions`.
- 4afb251: Record-level inline edit polish (objectui#2572, follow-up to #2407) — the five
  rough edges from the live showcase verification pass:

  - **Expanded reference values pass through to the picker.** `InlineFieldInput`
    no longer collapses an `$expand`-ed record object to a bare id before
    handing it to `LookupField` / `UserField` — the picker resolves the display
    name it already carries instead of re-fetching the referenced record via
    `findOne` (or sticking on the placeholder when it can't). `LookupField`
    still hands its Level-2 pickers (PeoplePicker / RecordPickerDialog) bare
    ids, collapsed via the existing `normalizeId`.
  - **Approval-lock preflight.** The record page now re-reads the approval
    state whenever the record is invalidated (a save can _trigger_ an approval
    flow that locks the record), derives one `approvalLocked` signal
    (`approval_status` pending/in_approval OR an open pending request), gates
    the inline-edit session's `canEdit` with it — hiding the pencil affordances
    and no-op'ing `enter()` on a locked record — and drives the save bar's
    `locked`/`lockedHint` so users can't type into a draft that Save would
    reject with `RECORD_LOCKED`.
  - **Numeric field types edit with the real numeric widgets.** `number` /
    `currency` / `percent` route to `NumberField` / `CurrencyField` /
    `PercentField` (the same widgets the form uses) instead of a free-text
    input: numeric keyboard, symbol adornment, fraction↔percent display
    conversion, and numbers (not strings) into the draft. `NumberField` and
    `CurrencyField` now surface metadata `min`/`max` on the input, `NumberField`
    honors an explicit `step` and steps by 1 for `scale: 0` (previously fell
    back to `any`).
  - **Header Edit CTA stands down during an inline session.** The synthesized
    `sys_edit` action carries `disableDuringInlineEdit`, and the `page:header`
    renderer greys such actions out while `InlineEditContext.editing` — the
    classic form-edit surface can no longer be stacked on top of a live inline
    draft.
  - **Keyboard shortcuts for the shared edit session.** `InlineEditSaveBar`
    binds **Esc → cancel** (deferring to any open Radix layer — popover /
    select / dialog — which owns Escape for "close") and **Cmd/Ctrl+Enter →
    save**, both respecting `saving`/`locked`.

- Updated dependencies [82441e4]
- Updated dependencies [2efa9fd]
- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
- Updated dependencies [6b2d74e]
- Updated dependencies [579b24d]
- Updated dependencies [2b30583]
- Updated dependencies [2b30583]
- Updated dependencies [23d65c3]
- Updated dependencies [055e1d2]
- Updated dependencies [9e2d58f]
- Updated dependencies [dea65f7]
- Updated dependencies [f30ff68]
- Updated dependencies [073e7aa]
- Updated dependencies [3e8bf07]
- Updated dependencies [6c0135c]
- Updated dependencies [5b52624]
- Updated dependencies [4afb251]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f94905d]
- Updated dependencies [2712fc1]
- Updated dependencies [f0f10f5]
  - @object-ui/i18n@14.1.0
  - @object-ui/fields@14.1.0
  - @object-ui/core@14.1.0
  - @object-ui/types@14.1.0
  - @object-ui/react@14.1.0
  - @object-ui/auth@14.1.0
  - @object-ui/permissions@14.1.0
  - @object-ui/components@14.1.0
  - @object-ui/data-objectstack@14.1.0
  - @object-ui/layout@14.1.0
  - @object-ui/plugin-editor@14.1.0
  - @object-ui/collaboration@14.1.0
  - @object-ui/providers@14.1.0

## 14.0.0

### Minor Changes

- 06e92ac: feat(console-ai): ChatDock — right-docked AI rail behind a default-off flag (ADR-0057 P3a)

  Stands up the ADR-0057 P3 docked rail as an ADDITIVE, DEFAULT-OFF shell: until an
  operator sets `features.chatDock`, nothing changes and the FAB stays the
  canonical entry.

  - `@object-ui/layout`: `AppShell` gains an optional `rightRail` prop, rendered as
    a flex sibling of the main content so the rail REFLOWS the content beside it
    (VS Code / Cursor idiom), not overlaying it. Absent → unchanged single-pane.
  - `@object-ui/app-shell`: new `ChatDock` — a collapsible, resizable right rail
    that reuses the shared `ChatPane` engine over the P1 `(user, app, product=ask)`
    conversation (the same ambient thread the FAB/`/ai` shows; it's a VIEW, not a
    new conversation). Default COLLAPSED (a fixed edge launcher → zero layout cost
    until invoked); ⌘/Ctrl+Shift+I toggles it. Gated on `useAiSurfaceEnabled` AND
    the flag, so OSS / no-seat runtimes render nothing.
  - `runtime-config`: `chatDock?` rollout flag, parsed default-OFF (opt-in only).

  Live-verified with the flag forced on: the launcher expands to a rail rendering
  the ask chat, the dashboard content reflows narrower beside it, and collapse
  restores the launcher. Unit-tested: width clamp, the composer-safe shortcut
  matcher (⌘⇧I, no collision with the ⌘⇧O/S page shortcuts), and the flag's
  default-off/opt-in parse. FAB retirement (P3b) and `/ai`-as-maximized-dock +
  Studio reflow (P3c) follow.

- 7b4fc36: feat(console-ai): ask→build handoff carries conversation context (ADR-0057 P4 / cloud#817)

  The P4 "Open in Builder →" handoff previously carried only the build prompt + an
  optional package, so the Builder started cold and the user re-explained
  themselves. It now also carries the **source `ask` conversation** as context —
  ADR-0057 P4 / cloud#817 — so the build agent's first turn starts with the thread
  the user already had.

  - `@object-ui/app-shell`: both handoff sites (the full-page `AiChatPage` and the
    console FAB) now append `?parentConversationId=<ask thread id>` to the
    `/ai/build` URL. The build surface reads it and forwards it to `useObjectChat`;
    the existing URL-mirror drops it once the build conversation id is minted, so a
    reload never re-carries it.
  - `@object-ui/plugin-chatbot`: `useObjectChat` accepts `parentConversationId` and
    sends it as `context.parentConversationId` on the **first turn only** (held in a
    ref, consumed once) — the backend redeems it into the turn's context and the
    client owns history from there. New pure helper `withHandoffContext` (unit
    tested) does the non-mutating `context` merge.

  Requires the cloud handoff-context contract (service-ai, cloud#817): the build
  agent redeems `context.parentConversationId` into a single system block on its
  first turn — ownership-checked, and carrying only the user/assistant text the
  user already saw (ADR-0063 governance boundary). Without it the console degrades
  cleanly: the id is sent but ignored, and the handoff is a (working) cold start.

- 7dea792: feat(console-ai): explicit "Open in Builder →" ask→build handoff (ADR-0057 P4)

  When the `ask` agent declines an app-authoring request it now calls the cloud
  `suggest_builder` tool (structured decline). The console renders that as an
  explicit **"Open in Builder →"** action that opens the full-page build surface
  seeded with the handoff prompt — ADR-0063 decline-and-redirect: an explicit,
  user-initiated switch, never a silent re-route into authoring.

  - `@object-ui/plugin-chatbot`: `detectBuilderHandoff` lifts the
    `{ status:'build_handoff', prompt, packageId? }` result onto the tool
    invocation; `ChatbotEnhanced` renders the "Open in Builder →" card and calls a
    new `onOpenBuilder` prop (disabled when no host wires it).
  - `@object-ui/app-shell`: the full-page `AiChatPage` (`ask`) and the console FAB
    wire `onOpenBuilder` to navigate to `/ai/build?package=…&handoffPrompt=…`; the
    build surface seeds that prompt as its first message (auto-sent once the
    conversation is minted), and the URL-mirror strips `?handoffPrompt` so a reload
    never re-sends it. Full ask-conversation context transfer is a later upgrade
    (cloud#817); v1 carries the build prompt + optional package.

  Requires the cloud `suggest_builder` signal (service-ai-studio) to light up; the
  console degrades cleanly (no card) without it.

- cd778d4: feat(console-ai): package binding chip + inert handoff cards + honest send hint (#2458 / ADR-0057 A1.a)

  Three UX improvements from live magic-flow testing:

  - **A1.a — package binding chip** (`app-shell`): the build surface header shows
    the package the conversation is bound to (`📦 <app>`), or **"New app"** when
    unbound — so the edit blast-radius is always visible (Claude-Code-shows-the-repo
    idiom). The magic flow starts unbound and binds the moment its build mints a
    package (`deriveBoundPackageId` reads `?package=` else the latest draft/handoff
    result; unit-tested).
  - **UX#5 — only the latest handoff card is actionable** (`plugin-chatbot`): when
    a thread accumulates several "Open in Builder →" cards, only the newest stays
    clickable; older (superseded) cards' buttons are disabled — derived from
    message order, so it survives the navigation the button triggers and the pane
    remount that follows. A stale prompt in an older card can't be re-fired.
  - **UX#7 — honest send hint** (`plugin-chatbot`): the composer already sends on
    plain Enter (Shift+Enter = newline); dropped the misleading `⌘` glyph from the
    hint so it no longer implies Cmd+Enter.

### Patch Changes

- 443360a: Action params support a `visible` CEL predicate — the param dialog omits a param
  when it evaluates false, against the same scope as action `visible` (features /
  user / app / data). Fixes the create-user form offering a **Phone Number** field
  the default backend rejects ("Phone numbers require the phoneNumber auth plugin"):
  paired with the framework gating that param on `features.phoneNumber`, the form
  now follows the plugin — no phone field unless the opt-in phoneNumber auth plugin
  is loaded. `filterVisibleParams` is exported + unit-tested (feature-off hides,
  feature-on shows, malformed predicate fails open).
- c70bca7: fix(console-ai): Live Canvas is a full-screen, opt-in preview on mobile — not a broken split (#2481)

  On a phone the beside-chat Live Canvas split overflowed the viewport (the chat
  column's fixed min-width plus the preview exceeded the screen, and the resize
  handle is desktop-only, so it was stuck clipped). Under `md` the canvas is now:

  - **Full-width chat, no split** — the build streams in the chat as before.
  - **Opt-in + full-screen** — when the preview is available a floating "Preview
    app" pill appears; tapping it (or a Preview button on a draft card) takes the
    canvas full-screen over the chat. Closing returns to the chat with the
    preview one tap away. The auto-drafted canvas never covers the streaming
    chat unprompted.

  Desktop is unchanged (the resizable beside-chat split). Adds the
  `console.ai.previewApp` string (en/zh).

- d06de4a: feat(console-ai): the ChatDock is now DEFAULT ON (ADR-0057 P3 go-live)

  `features.chatDock` flips from opt-in to opt-out: the right-docked chat rail
  (FAB as launcher, `/ai` as the panel maximized, Studio right dock with center
  `[Canvas | Properties]` tabs) is the console's default chat presentation. The
  flag survives only as a server-side kill-switch — an operator sending
  `chatDock: false` restores the floating-overlay console until the final
  cleanup removes that path (epic #2409).

- 1a12d69: polish(console-ai): ease the dock's canvas auto-maximize, and give Studio its own chat width (ADR-0057 UX follow-ups, #2477)

  - **#4** The rail now eases to its new width (200ms) when the Live Canvas opens
    (auto-maximize) or closes (tuck), instead of snapping. The transition is
    suppressed during a manual resize drag so the width still tracks the pointer
    1:1.
  - **#6** The Studio dock persists its width under its own key, separate from the
    console dock. A wide console chat no longer squeezes the Studio design canvas
    (and vice-versa) — each surface remembers the width that suits it.

- b800960: refactor(console-ai)!: ADR-0057 final cleanup — remove the chatDock flag, the floating-overlay console chat, and the legacy left Studio copilot

  The docked chat is now the console's ONE chat presentation, unconditionally:

  - `features.chatDock` is removed from the runtime config (it had already
    flipped to default-on; the kill-switch is retired with the code path it
    guarded).
  - `ConsoleFloatingChatbot` (the FAB-armed floating overlay) and its
    `agentPicker` helper are deleted; `ConsoleChatbotFab` is now a small
    dependency-free launcher (`{ appLabel, onOpenDock }`) that opens the dock —
    including on `/home`, where it opens the full-page `/ai` surface (the dock
    maximized) since Home has no shell to host a rail.
  - The legacy left `StudioAiCopilot` panel is deleted; the Studio copilot's one
    home is the right `StudioChatDock`. The ADR-0080 `aiSlot` injection seam is
    untouched.
  - The runtime SDUI `type: 'chatbot'` bubble (end-user apps) is unchanged
    (ADR-0057 §4).
  - Fix: the mobile chat sheet no longer shows a "maximize" button. At 85svh the
    sheet is already the maximal mobile chat, and navigating to full-page `/ai`
    from an OPEN Radix sheet tore it down mid-close (the route change unmounts
    the console synchronously, so the scroll-lock/overlay never released and the
    destination landed blank-and-frozen — "tap maximize → the chat's just gone").
    Full-page `/ai` stays reachable via normal navigation.

- 47b497f: feat(console-ai): mobile chat sheet bridges to full-page /ai (conversation history + share) — cleanly (ADR-0057 UX #2477 item 1)

  The mobile chat bottom sheet gets a maximize button back — it opens the
  full-page `/ai`, which on mobile already carries the conversation-history
  sidebar and share, so the sheet doesn't need a second copy of either. This is
  the missing mobile path to switch/resume threads.

  The button navigates **deferred**: an earlier cut jumped straight from the
  click and tore the still-open Radix sheet down mid-close (the route change
  unmounts the console synchronously, leaking the sheet's scroll-lock/overlay
  onto the destination — "tap maximize → the chat's just gone"). Now the click
  only closes the sheet; a `useEffect` fires the navigation once `open` has
  flipped false — after Radix released the body on that commit and before the
  sheet unmounts — so `/ai` lands clean. Applies to both the console sheet
  (→ `/ai`) and the Studio copilot sheet (→ `/ai/build?package=…`, same thread).

  Live Canvas on mobile `/ai` (the beside-chat split has no room on a phone) is
  tracked separately (#2481).

- 804a101: feat(console-ai): ChatDock follow-ups — mobile sheet, wide side-by-side properties, exact collapse landing (ADR-0057 P3)

  - Under `md` the dock presents as a bottom sheet (`ChatDockMobileSheet`) —
    console FAB opens it; Studio gets a mobile-visible edge launcher.
  - The folded Studio layout keeps canvas AND properties side by side on 2xl+
    viewports; tabs (and their auto-switch) only exist where width forces them.
  - Folded tabs mode flattens the source page's nested Source/Props tabs — the
    Properties tab body is the code editor directly.
  - Maximize remembers its origin, so `/ai`'s collapse-to-dock returns to the
    exact page (console or Studio) the user left, immune to history churn.
  - The dock's conversation honors `app.defaultAgent` via the one resolver,
    matching the FAB's behavior.

- 3001e20: feat(console-ai): the FAB becomes the ChatDock launcher when the dock is on (ADR-0057 P3b)

  When `features.chatDock` is enabled, the console FAB opens the docked rail instead
  of the floating overlay — one entry point, the ADR's "FAB → launcher" step. In
  dock mode the FAB stays the lightweight button (it never mounts the heavy floating
  chatbot; the rail loads the chat on demand), and a designer "Ask AI" open signal
  (assistantBus) opens the dock too. With the flag OFF the FAB is unchanged (floating
  overlay). Supersedes P3a's edge launcher (the dock is gated on the same
  `showChatbot`, so the FAB is always present to launch it).

- 159d7db: feat(console-ai): /ai = the ChatDock maximized + Studio right-dock reflow (ADR-0057 P3c)

  The final P3 slice, all behind the default-off `features.chatDock` flag:

  - **/ai ⇄ rail continuity**: the dock header gains a maximize button that opens
    the full-page `/ai` surface, and the `/ai` page gains a collapse-to-dock button
    that returns to the console with the rail expanded — same thread both ways
    (the P1 `(user, app, product)` conversation key). Deep links
    (`/ai/:agent/:conversationId`, ADR-0013) are untouched and keep working.
  - **Studio reflow** (the ADR's decided grid `[left: nav/tree] [center: canvas +
properties] [right: chat]`): the AI copilot leaves the left `w-96` panel and
    renders as the shared right dock (`ChatDockPanel` + `ChatDockLauncher`), same
    package-scoped build thread; the Interfaces pillar's right inspector folds
    into center `[Canvas | Properties]` tabs with select-a-block auto-switch. An
    injected `aiSlot` (cloud seam, ADR-0080) keeps the legacy left panel.
  - **Live Canvas** (ADR-0037): in the rail, the dock auto-maximizes while the
    canvas is open and tucks back on close (manual resize wins); maximized (`/ai`)
    keeps the existing beside-the-chat split.

  With the flag OFF, `/ai` and Studio are pixel-identical to before.

- 1273f1e: fix(console-ai): reliable ask→build handoff auto-send + second-handoff context re-carry (ADR-0057 P4)

  Two follow-ups to the P4 "Open in Builder →" handoff:

  - **Auto-send swallow.** The handoff's auto-sent first message could be dropped on
    a brand-new build conversation: the seed gated on the async-resolved
    `activeAgent`, which can settle _after_ the conversation id is minted, so the
    deferred-send replay ran with an empty pending and never re-fired. The seed now
    gates on the **route** (`agentSegment`, synchronous) and bumps a `pendingSignal`
    that `useDeferredFirstSend` lists in its replay deps, so the seed always fires —
    no more empty build conversation on handoff.

  - **Second-handoff re-carry.** A second "Open in Builder →" into the (singleton)
    build conversation now re-carries the latest ask context. The transport re-arms
    `parentConversationId` on each falsy→truthy transition of the prop (the ask
    thread is a singleton, so the same id repeats — the fresh-arrival signal is the
    transition the URL-mirror produces, not a changed value), and the seed re-arms
    on each new `handoffPrompt`.

  Unit-tested: deferred-send replays a post-id seed via the signal; the transport
  re-carries across a strip→re-supply cycle.

- 48d06da: fix(console-ai): Studio dock remembers a collapse; folded canvas+properties go side-by-side at `xl` (ADR-0057 UX follow-ups, #2477)

  - **Studio dock collapse is now remembered** (per-tab). The right copilot still
    mounts expanded by default, but collapsing it to get the classic three-zone
    canvas no longer re-opens on every pillar / package switch or Studio
    re-entry. Backed by an explicit `'0'`/`'1'` stored flag (a default-expanded
    surface couldn't remember a collapse when "collapsed" meant "key removed"),
    under a Studio-specific key so it never shares state with the console dock.
  - **Folded layout shows canvas + properties side by side from `xl`** (1280),
    lowered from `2xl`. On the common laptop the folded center used to fall into
    tabs, which auto-hide the canvas the moment you select a block — breaking the
    WYSIWYG "edit and watch it apply" loop. The side-by-side inspector is slimmer
    at `xl` (and grows at `2xl`) so the canvas keeps usable width beside the dock.

- 9d0fdb1: feat(console-ai): render agent behavior by declared capability (cloud#816 / ADR-0057 "B+")

  `GET /api/v1/ai/agents` now serves per-agent `capabilities`; the console
  consumes them instead of hard-coding `isBuildAgent(name)`:

  - `@object-ui/plugin-chatbot`: `AgentDescriptor.capabilities` (normalized from
    the catalog) + new `agentHasCapability(agents, name, cap)` — declaration wins
    when present; falls back to the legacy `isBuildAgent(name)` check when absent
    (older server), so shipping order doesn't matter.
  - `@object-ui/app-shell`: the build-doctor drawer + `showDebug` key off
    `'debug'`, the FAB's resume-vs-fresh keys off `'resume'`, HomePage's
    "Build with AI" availability keys off `'authoring'`. The ADR-0063 product-axis
    sites (surface→agent resolver, conversation scope keying, picker availability)
    intentionally stay name-based — capability describes RENDERED behavior, not
    which product an agent is.

  A future skill-driven build variant now needs no console change.

- 9442310: feat(console-ai): key AI chat conversations on `(user, app, product)`, not on surface (ADR-0057 P1)

  The console rendered AI chat through parallel shells that **forked the
  conversation**: the Studio design copilot scoped its thread as
  `studio:${packageId}:${agent}` while the full-page `/ai/build` focus view scoped
  on the agent alone — so opening the _same app_ in both showed an empty "Build
  with AI" copilot beside an active full-page build thread (indistinguishable from
  data loss).

  Per ADR-0057 (**surface = view · conversation = model · product = binding
  axis**), conversations are now keyed on `(user, app, product)`:

  - New pure, unit-tested `chatConversationScope({ appId, product })` +
    `chatProductOfAgent(name)` helper (`hooks/chatScope.ts`) is the single place
    the scope key is formed. `product` is the ADR-0063 axis (`ask` | `build`),
    derived from the resolved agent — never a per-surface choice.
  - `StudioAiCopilot` and the full-page `AiChatPage` both resolve
    `app:${packageId}:${product}` for a package-scoped surface (the Studio copilot
    editing package X and the `/ai/build?package=X` "Edit with AI" focus view now
    resume ONE shared thread). The legacy `studio:` surface prefix is dropped.
  - A generic `/ai/:agent` visit with no `?package=` degrades to the product alone
    (`build` / `ask`) — unchanged behaviour for that surface.

  Enablement stays on the single access-filtered agent-catalog gate
  (`useAiSurfaceEnabled`, ADR-0068) — a seat-less user's empty catalog hides the
  whole AI surface. No layout change.

- 9442310: feat(console-ai): one declarative surface→agent resolver (ADR-0057 P2)

  The console re-implemented the ADR-0063 surface→agent chain in ~5 places, each
  spelled slightly differently — and `ConsoleLayout` carried an AI-Studio-off
  downgrade special case that existed nowhere else. This collapses them into one
  pure, unit-tested resolver so ADR-0063 (exactly two products `ask`/`build`,
  bound by surface — no roster, no per-turn classifier) becomes a **structural**
  guarantee.

  - New `hooks/surfaceAgent.ts`: `resolveSurfaceAgent(surface, { agents,
appDefaultAgent, aiStudioEnabled })` + `SURFACE_DEFAULT`. `app.defaultAgent` is
    **bounded** to ask/build (alias-aware) — a withdrawn tenant custom agent is
    rejected, not passed through, so no roster is representable (ADR-0057 open
    question #4). The AI-Studio-off `build → ask` downgrade is folded in ONCE.
  - `StudioAiCopilot` (studio-build → build) and the console FAB (`default` → ask)
    resolve through it. The FAB keeps #771's "prefer build when the catalog unlocks
    it and nothing pinned a product" by passing that as its default PRODUCT input —
    so the resolver still owns bounding + the downgrade, which now also applies to
    the #771 preference (closing the leak where an authoring-disabled deployment
    could still open build).
  - `ConsoleLayout`'s bespoke `!aiStudioEnabled && isBuildAgent(...)` downgrade is
    deleted; it passes the raw `app.defaultAgent` and the resolver downgrades.

  Ships a unit table proving the ADR-0063 rows: Studio→build, other→ask,
  AI-Studio-off downgrade, `app.defaultAgent` bounded (valid override wins, roster
  rejected), alias-aware catalog resolution, empty catalog → inert (ADR-0025).

- 05e56ca: 导出/导入模板的下载文件名与内容本地化。

  **导出文件名**:CSV/Excel/JSON 导出下载不再是 `<对象名>.<扩展名>`(如 `contracts.csv`),改为「对象显示名-视图名-时间戳.扩展名」(如 `任务-In Progress-20260714-153045.xlsx`);`exportOptions.fileNamePrefix` 配置仍优先(且作为完整前缀,不再追加视图名)。视图名与对象名重复时自动省略;`@object-ui/core` 新增 `buildExportFileName(ext, { prefix, label, objectName, viewLabel }, now?)` 与 `sanitizeFileNameBase(raw)`,ObjectGrid 与 ListView 的所有导出路径(服务端流式与前端兜底)统一走它。app-shell/plugin-view 的 ObjectView 现将当前视图的显示标签写进传给 ListView 的 schema(`label`),使导出文件名能区分同一对象的不同保存视图。

  **导入模板**:「下载模板」修复两处英文漏出——示例行的 select/多选取值改为优先取选项**显示标签**(如 `准备中`)而非 ASCII slug(`prepare`,服务端导入两者都接受);模板文件名本地化为 `{{object}}-导入模板.csv`(新增 i18n key `grid.import.templateFileName`,英文回退 `{{object}}-import-template.csv`)。

- 9d0fdb1: fix(console-ai): second handoff's auto-send no longer dies in the stale-scope pane (#2450)

  Mid ask→build transition, `useChatConversation` briefly still holds the OLD
  scope's conversation id (the same stale window the URL-mirror already guards).
  `<ChatPane>` was fed that raw id, so a DOOMED pane (build chatApi + stale ask id,
  about to remount) could mount — and the deferred first-send replay consumed the
  handoff stash into it, where the send died with the unmount before reaching the
  wire (observed live as "conversation resumes, zero `…/chat` POST").

  Two-layer fix:

  - **Scope-gated pane feed (structural):** the page now hands `<ChatPane>` a
    conversation id/messages ONLY when `conversationScope === chatScope`. During
    the stale window the pane mounts as `…:pending`, holds the stash, and replays
    exactly once in the correctly-scoped pane — extending the existing URL-mirror
    guard to the pane itself.
  - **Targeted stash (defense-in-depth):** the handoff seed is stamped
    `targetAgentRoute: 'build'`; `useDeferredFirstSend` refuses to consume a
    targeted stash in a pane bound to another agent (untargeted user-typed sends
    keep the legacy consume-anywhere behavior).

  Per product decision, a second handoff landing on a conversation with a
  blueprint still Awaiting Approval just auto-sends — the build agent sees the
  pending plan in context and decides merge/supersede itself.

- 9138e68: fix(metadata-admin): authenticate console MetadataClient requests (Bearer token)

  Studio / metadata-admin surfaces issued `/api/v1/meta/*` requests (list types,
  `?package=…` reads, `_drafts`, the `/meta` root) that came back `401
unauthenticated` in the token-based console, while the runtime data adapter's
  reads (`/meta/object|view|app`) succeeded — so the same page showed some
  metadata requests failing and others working.

  Root cause: `useMetadataClient` and `MetadataProvider`'s draft-preview client
  constructed `MetadataClient` without a `fetch`, so it fell back to the bare
  `globalThis.fetch` and sent no `Authorization` header. The console
  authenticates by a Bearer token in localStorage (`auth-session-token`) — there
  is no session cookie — so those requests were unauthenticated. A same-origin
  cookie deployment masks the bug, which is why it went unnoticed and regressed
  twice.

  Both sites (and every future console surface) now construct through a single
  `createConsoleMetadataClient` factory that bakes in `createAuthenticatedFetch`
  (Bearer token + `X-Tenant-ID` + `Accept-Language`), matching the runtime data
  adapter. This is additive for cookie deployments — `credentials` is untouched,
  so a same-origin session cookie still flows. A
  `metadata-client-auth.ratchet.test.ts` guard forbids a bare
  `new MetadataClient(` elsewhere in app-shell so authentication can't silently
  regress again.

- 780b60a: Say "reset to shipped baseline" instead of "delete" when removing a package-owned permission set (ADR-0094).

  Deleting a `sys_permission_set` row whose `managed_by === 'package'` doesn't remove it — the backend drops the environment customization overlay and resets the set to its shipped baseline, so the row stays in the list. The confirmation dialog and success toast now say so (with `resetPackageSetConfirm` / `resetPackageSetSuccess` i18n, en + zh), instead of promising an irreversible delete the user can see doesn't happen. Environment-authored sets keep the plain delete copy. The grid row-delete passes the record through so the check needs no extra fetch; the SDUI header delete falls back to a `findOne` lookup.

- 5971cc4: i18n: translate the Profile page, honor inline i18n label objects under bare
  base-language codes, and localize managed-by badges / record quick actions.

  - `pickLocalized` now upgrades a bare base language (`zh`) to any
    region-qualified key sharing the base (`zh-CN`) — runtime language is
    normalized to the base code while metadata authors write full BCP-47 tags,
    so inline `{ en, 'zh-CN', ... }` label objects previously fell back to
    English.
  - ProfilePage (`account:profile_card` / `/system/profile`): every hardcoded
    string — page title/subtitle, avatar Upload/Replace/Remove, Personal
    Information card, Change/Set Password card — now goes through
    `useObjectTranslation()` with `profile.*` keys (new namespace in all ten
    locale bundles); the lazy-load fallback reuses `common.loading`.
  - `ManagedByBadge` chips/tooltips (Config/System/Append-only/Identity) now
    resolve through new `managedByBadge.*` keys with `{{provider}}`
    interpolation.
  - `record:quick_actions` resolves action labels via the
    `objects.{object}._actions.{action}.label` convention plus `pickLocalized`,
    so object action buttons (Change Password, Enable 2FA, …) localize.
  - `record:details` / `record:related_list` / `record:alert` / `ObjectTree`
    pass inline label objects through `pickLocalized`.
  - Locale bundles: added `managedByBadge` namespace to all ten locales and
    backfilled `list.inlineEditShort` / `inlineEditLabel` /
    `recordEditingTitle` for ja/es/ko/de/fr/pt/ru/ar.

- 2fb38ed: fix(app-shell): propagate action-param `visible` predicate through resolveActionParams

  The create-user phone fix (#2406) gated the `phoneNumber` param with
  `visible: 'features.phoneNumber == true'`, but `resolveActionParam` dropped
  `visible` when flattening raw spec params into `ActionParamDef` — so
  `ActionParamDialog`'s `filterVisibleParams` never saw the predicate and the
  phone field kept rendering even with the phoneNumber auth plugin off.

  Propagate `visible` in all three resolve branches (inline / field-backed /
  missing-field), unwrapping the spec's `{ dialect, source }` ExpressionInput
  envelope to a plain CEL string. Completes the create-user phone fix end to end.

- Updated dependencies [443360a]
- Updated dependencies [c70bca7]
- Updated dependencies [06e92ac]
- Updated dependencies [7b4fc36]
- Updated dependencies [1273f1e]
- Updated dependencies [7dea792]
- Updated dependencies [86c69c3]
- Updated dependencies [bfea27f]
- Updated dependencies [9d0fdb1]
- Updated dependencies [cd778d4]
- Updated dependencies [05e56ca]
- Updated dependencies [408f4ba]
- Updated dependencies [a44e7b6]
- Updated dependencies [eef832b]
- Updated dependencies [b66d8ee]
- Updated dependencies [94d00d4]
- Updated dependencies [5971cc4]
- Updated dependencies [6a74160]
  - @object-ui/core@14.0.0
  - @object-ui/i18n@14.0.0
  - @object-ui/layout@14.0.0
  - @object-ui/plugin-chatbot@14.0.0
  - @object-ui/react@14.0.0
  - @object-ui/types@14.0.0
  - @object-ui/plugin-grid@14.0.0
  - @object-ui/plugin-list@14.0.0
  - @object-ui/plugin-view@14.0.0
  - @object-ui/components@14.0.0
  - @object-ui/plugin-detail@14.0.0
  - @object-ui/auth@14.0.0
  - @object-ui/fields@14.0.0
  - @object-ui/data-objectstack@14.0.0
  - @object-ui/plugin-calendar@14.0.0
  - @object-ui/plugin-charts@14.0.0
  - @object-ui/plugin-dashboard@14.0.0
  - @object-ui/plugin-designer@14.0.0
  - @object-ui/plugin-editor@14.0.0
  - @object-ui/plugin-form@14.0.0
  - @object-ui/plugin-kanban@14.0.0
  - @object-ui/plugin-report@14.0.0
  - @object-ui/collaboration@14.0.0
  - @object-ui/permissions@14.0.0
  - @object-ui/providers@14.0.0

## 13.2.0

### Minor Changes

- 53c40c2: feat: identity import — the stock ImportWizard now drives sys_user bulk import (framework#2782)

  The Users list gets an Import entry for platform admins (gated on
  `features.admin` from `/api/v1/auth/config` plus workspace-admin), wired to
  the dedicated `POST /api/v1/auth/admin/import-users` pipeline instead of the
  generic data import (which would bypass better-auth hashing and produce
  accounts that can never sign in).

  - **plugin-grid**: two generic, backend-agnostic ImportWizard slots —
    `extraOptionsContent` (host-injected options on the preview step) and
    `renderResultExtra` (host-rendered content on the result step).
  - **app-shell**: identity import dataSource adapter — splits files into the
    endpoint's ≤500-row batches (idempotent upsert makes re-runs safe), injects
    the selected password policy, renumbers per-batch results onto the whole
    file, and enriches rows with their sign-in identity. Password policy panel
    (`none` default / `invite` / `temporary`) and a one-shot temporary-password
    reveal with CSV download (client memory only — nothing is persisted).
    Async-job/undo surfaces are hidden for identity import by design.
  - **auth**: `AuthPublicConfig.features.admin` typing.
  - **i18n**: en/zh strings for the identity import panels.

### Patch Changes

- 672f18e: Access pillar: the 已分配用户 section now lists EFFECTIVE holders — direct
  grants ∪ holders of every position bound to the set — with per-row
  attribution badges (直授 / 经岗位 X). Position-held rows are not removable
  here (remove on the position's assignments); an `everyone`-anchor binding
  renders as a note ("every signed-in member holds this set") instead of
  enumerating the tenant (objectui#2382 — the direct-grants-only list told
  admins "0 users" for any normally-administered set). The explain panel's
  user field gains a chevron so "pick another user" is discoverable
  (objectui#2381 — the picker existed but read as static text).
- 603d406: Fix "Create User" (and set_user_password / enable_two_factor /
  create_oauth_application) result dialogs rendering an empty email + temporary
  password: the console `apiHandler` now unwraps the `{ success, data }` response
  envelope so `resultDialog` field paths resolve against the inner `data`,
  matching `flowHandler` / `serverActionHandler` and the documented "path into
  `data`" contract. Paired with framework#2842 (objectui#2396).
- e492b9d: Permission sets — pure separation of **design** (Studio) and **assignment**
  (Setup), per ADR-0056 / epic #2398. A `sys_permission_set` used to render its six
  authorization facets in Setup as raw `[Object]` / JSON textareas, and only
  objects+fields were editable in Studio; this reworks both surfaces.

  **Setup (assign + read-only):**
  - The six facets (`object_permissions`, `field_permissions`, `system_permissions`,
    `row_level_security`, `tab_permissions`, `admin_scope`) now render read-only on
    the `sys_permission_set` record page as a compact summary (counts, or capability
    chips) plus a **“Design in Studio →”** deep-link into the structured editor
    (`/apps/:appName/metadata/permission/:setName`, env scope). No `[Object]`, no
    JSON — in the record view, inline edit, and the create/edit form. Implemented as
    a `permission-facet-link` field widget stamped onto the six fields via the single
    `ObjectStackAdapter.getObjectSchema` choke point and honored by DetailSection +
    the record form.
  - User assignment (add/remove via `sys_user_permission_set`) is surfaced directly
    on the Setup record page.

  **Studio (design every facet):** the permission matrix editor gains structured
  editors for the facets that were JSON-only —
  - **System Capabilities**: a multi-select over the live `sys_capability` registry
    (scope-grouped, labelled chips).
  - **Row-Level Security**: per-policy rows (object · operation · enabled) with CEL
    USING/CHECK.
  - **Tab Visibility**: per-tab `visible | hidden | default_on | default_off`.
  - **Delegated Admin Scope**: business-unit + subtree, manage-assignments /
    -bindings / author-env-sets toggles, and an assignable-permission-sets allowlist.
    Assignment was moved out of the editor (it is now a Setup act) — the editor is
    purely a design surface.

  Storage/types are unchanged; editors read/write the draft’s existing parsed
  fields and tolerate legacy JSON strings on load. Note: env-scope metadata saves of
  these facets do not yet project onto the queryable `sys_permission_set` data
  record the Setup summary reads, so a fresh Studio edit isn’t reflected in Setup’s
  read-only view until the projection refreshes — tracked as a framework follow-up
  (enforcement reads the authoritative metadata).

- 787b0e7: Setup-app UX fixes from a system-settings review:

  - `sys_team` now shows an accurate empty state ("No teams yet" — create one with Create Team, or they arrive via org/SSO provisioning) instead of the generic better-auth "these records … are not added by hand here" copy, which flatly contradicted the visible Create Team button.
  - The form renderer no longer spreads `objectName` / `onDirtyChange` (and other FormSchema-only props) onto its `<form>` DOM element, removing the `React does not recognize the objectName prop` / `Unknown event handler property onDirtyChange` warnings logged on every object list view.

- Updated dependencies [80901aa]
- Updated dependencies [53c40c2]
- Updated dependencies [e492b9d]
  - @object-ui/components@13.2.0
  - @object-ui/auth@13.2.0
  - @object-ui/i18n@13.2.0
  - @object-ui/data-objectstack@13.2.0
  - @object-ui/fields@13.2.0
  - @object-ui/layout@13.2.0
  - @object-ui/plugin-editor@13.2.0
  - @object-ui/react@13.2.0
  - @object-ui/types@13.2.0
  - @object-ui/core@13.2.0
  - @object-ui/permissions@13.2.0
  - @object-ui/collaboration@13.2.0
  - @object-ui/providers@13.2.0

## 13.1.0

### Minor Changes

- 16e2615: ADR-0090 D6 — "why can this user access?" panel in the Studio Access pillar
  (framework#2696).

  New `AccessExplainPanel` (right-side sheet, opened from the Access pillar
  header next to the permission matrix): pick a user (defaults to the calling
  principal), an object and an operation, and it calls the new backend
  `POST /api/v1/security/explain`, rendering the `ExplainDecision` trace — the
  allowed/denied verdict banner, the resolved principal chain (positions →
  permission sets with their `via` attribution), all nine evaluation-pipeline
  layers (required capabilities, object CRUD, FLS, OWD baseline, depth, sharing,
  VAMA bypass, RLS) with per-verdict badges, and the composed row filter for
  reads. A 403 from the manage_users / delegated-admin-scope gate (D12) renders
  as a friendly localized message. Copy ships in EN + ZH via the metadata-admin
  string tables.

- 3334bd4: feat(studio): Capabilities section in the object Settings panel (framework#2707/#2727)

  The `enable.*` record-surface switches went fully live in the framework, but
  only source-mode authors could set them. The Data-pillar object Settings
  panel now exposes them to builders — **live flags only**, each with a
  one-line contract description:

  - Opt-in (spec default off): `trackHistory` (History tab),
    `files` (Attachments panel + server-side attachment gate).
  - Opt-out (spec default on): `feeds` (discussion panel + comment 403 gate),
    `activities` (record timeline mirror), `clone` (clone endpoint 403).

  Checkboxes show the flag's EFFECTIVE runtime value; toggling writes an
  explicit boolean into the `enable` block preserving sibling keys. Dead
  flags (`searchable`/`trash`/`mru`) are deliberately not rendered — Studio
  only offers switches the runtime enforces.

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/core@13.1.0
- @object-ui/i18n@13.1.0
- @object-ui/react@13.1.0
- @object-ui/components@13.1.0
- @object-ui/fields@13.1.0
- @object-ui/layout@13.1.0
- @object-ui/data-objectstack@13.1.0
- @object-ui/auth@13.1.0
- @object-ui/permissions@13.1.0
- @object-ui/plugin-editor@13.1.0
- @object-ui/collaboration@13.1.0
- @object-ui/providers@13.1.0

## 13.0.0

### Major Changes

- 619097e: Adopt `@objectstack/spec` 13 (ADR-0090 Permission Model v2) across the workspace.

  Every workspace package now depends on `@objectstack/spec` ^13.0.0 — the v2 major that renames role → position (D3), removes the profile concept (D2), makes OWD default to `private` when unset (D1), and drops the legacy `read`/`read_write`/`full` sharing aliases (D4). UI fallout fixed in the same sweep:

  - **clientValidation**: the `role` draft-schema loader is now `position` → `PositionSchema` (fixes the `RoleSchema does not exist` build break, #2365); the dead `profile` loader is removed (D2).
  - **Studio previews**: `RolePreview` → `PositionPreview` (flat — positions carry no hierarchy; the old parent-chain breadcrumb and "assign to a Profile" copy are gone). Legacy `role`/`profile` preview keys stay registered for pre-v2 backends.
  - **OWD control** (`ObjectSettingsPanel`): removed the now-dead alias normalization (spec 13 rejects the aliases at authoring time) and the amber "fully public" warning — an unset sharing model now defaults to Private (D1), and the copy says so in both locales.
  - **Fallback schemas / anchors / samples**: `position` replaces the hierarchical `role` fallback schema; `isProfile` dropped from the permission create-anchor and previews samples; permission-set viewer no longer renders a profile badge; console System hub counts `sys_position` instead of the removed `sys_role`.
  - **Studio i18n**: type labels `Role/角色` → `Position/岗位`, `profile` label removed, Access-pillar heading and sharing copy rewritten to the v2 vocabulary.
  - `@object-ui/types` now exports `SubmitBehavior` (was defined but missing from the public surface, breaking `@object-ui/plugin-form`'s re-export under a clean build).
  - **External OWD dial (D11)**: the object Settings sharing card gains an `externalSharingModel` select (portal/partner baseline) with an inline wider-than-internal warning mirroring the publish-time lint.
  - **Permission matrix OWD badges**: every object row now shows its record-level baseline (`OWD Public read`, `Ext Private`, or `OWD Private (default)` for the D1 fail-closed unset case) so grant edits carry their record-reach context.

  The flow designer's approval assignee `role` kind is intentionally unchanged — spec 13 keeps it as the sole D3 exception (better-auth `sys_member.role` org-membership tier).

### Minor Changes

- bc27e53: Book audience mirrors the spec's permission-set gate (ADR-0090).

  `@objectstack/spec` renamed the gated arm of `BookAudience` from
  `{ profile: string }` to `{ permissionSet: string }` — ADR-0090 D2 removed
  the Profile concept, and D9 makes the gate a capability reference (a
  permission-set name the reader must hold, e.g. `crm_admin`). Updated the
  three mirrors: the metadata-admin default JSON schema (`book.audience`
  `oneOf`), the `BookPreview` audience chip, and the book list-column
  renderer. One-step rename, no alias, matching the spec's launch-window
  discipline.

- 9e38270: feat(setup): "Connect an agent" page widget (`mcp:connect-agent`) — framework#2714 Phase 1, #2363

  The interactive body for the plugin-carried Setup page shipped by
  `@objectstack/mcp`: the environment's MCP URL (from `/discovery`), per-client
  connect cards (claude.ai/Desktop, Claude Code incl. the official plugin,
  Cursor one-click deeplink, VS Code, Codex CLI), the SKILL.md download
  (`GET /api/v1/mcp/skill`), and show-once API-key minting for headless
  callers via the existing `POST /api/v1/keys`. Renders a disabled empty state
  when discovery doesn't advertise `routes.mcp` (deployment opted out).
  Translations for all nine locales.

- 98a7cfb: feat(detail): honor object `enable.feeds` / `enable.activities` opt-out gates (framework#2707)

  RecordDetailView rendered the discussion panel and merged the sys_activity
  timeline unconditionally; the object capability flags gating them were dead.
  Both are now honored with opt-OUT semantics (spec default flips to `true`,
  so absent block/flag = unchanged behavior; only an explicit `false`
  disables):

  - `feeds: false` hides the record discussion panel (both the page-schema
    auto-append and the legacy DetailView `discussionSlot`) and skips the
    sys_comment fetch. The server independently rejects new comments for such
    objects (403 FEEDS_DISABLED).
  - `activities: false` skips the sys_activity fetch/merge — the server stops
    mirroring CRUD for such objects, so this also keeps the network quiet.

  Also fixes the long-wrong comment claiming plugin-audit's writers were
  gated by `enable.activities` opt-in (they were unconditional; the new
  contract is opt-out). The History tab gate (`enable.trackHistory === true`)
  is unchanged.

- 5f5ee7b: feat(detail): generic record Attachments panel gated on `enable.files: true` (framework#2727)

  New `RecordAttachmentsPanel` — Salesforce "Notes & Attachments" parity for
  any object that opts in via `enable: { files: true }`:

  - Upload via the canonical presigned three-step storage flow
    (`createObjectStackUploadAdapter`; blob → `sys_file`), then a
    `sys_attachment` join row targeting `(parent_object, parent_id)`.
  - List (name/size/mime), stable download links
    (`/api/v1/storage/files/:fileId` 302-redirect endpoint), delete.
  - Rendered by RecordDetailView in both the page-schema and legacy branches.
    Opt-in: objects without the flag see no panel, and the server
    independently rejects attachment rows targeting them
    (403 FILES_DISABLED).

- aa940a7: Studio form designer: select a field group to edit its properties.

  Field groups (sections) in the Data → Form → Layout designer could previously only be renamed inline — there was no way to reach a group's other properties. Each group header now carries a settings affordance that selects the group into a dedicated **Group properties** inspector in the right rail (mirroring the field inspector): edit the group **name** and its **collapse behaviour** — the spec-canonical `collapse` enum (`none` / collapsible-expanded / collapsible-collapsed) that the form renderer consumes via `@objectstack/spec`'s `deriveFieldGroupLayout`, so the setting takes effect in the actual form/preview.

  `readGroups` now preserves all authored group props (icon/description/collapse/…) instead of narrowing to `{key,label}`, so a read-modify-write round-trip (rename/reorder/inspector edit) never silently drops a property the source set. `icon`/`description` are round-trip-preserved but intentionally not surfaced as editable controls yet, since no renderer consumes them (no dead metadata).

### Patch Changes

- Updated dependencies [9e38270]
- Updated dependencies [ac04b76]
- Updated dependencies [619097e]
  - @object-ui/i18n@13.0.0
  - @object-ui/components@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/fields@13.0.0
  - @object-ui/plugin-calendar@13.0.0
  - @object-ui/plugin-charts@13.0.0
  - @object-ui/plugin-dashboard@13.0.0
  - @object-ui/plugin-designer@13.0.0
  - @object-ui/plugin-detail@13.0.0
  - @object-ui/plugin-form@13.0.0
  - @object-ui/plugin-grid@13.0.0
  - @object-ui/plugin-kanban@13.0.0
  - @object-ui/plugin-list@13.0.0
  - @object-ui/plugin-report@13.0.0
  - @object-ui/plugin-view@13.0.0
  - @object-ui/react@13.0.0
  - @object-ui/layout@13.0.0
  - @object-ui/plugin-chatbot@13.0.0
  - @object-ui/plugin-editor@13.0.0
  - @object-ui/auth@13.0.0
  - @object-ui/collaboration@13.0.0
  - @object-ui/core@13.0.0
  - @object-ui/data-objectstack@13.0.0
  - @object-ui/permissions@13.0.0
  - @object-ui/providers@13.0.0

## 12.1.0

### Minor Changes

- 6eca471: Authorization authoring UX — surface the ADR-0066 security primitives the
  framework now enforces (④ secure-by-default posture, ⑤ per-operation
  requiredPermissions, ⑨ capability-reference lint).

  **Access matrix — private-posture badge (④).** `PermissionMatrixEditor` object
  rows now show an amber **Private** badge when the object declares
  `access: { default: 'private' }`, with a tooltip explaining that a permission
  set's `'*'` wildcard grant does NOT cover the object — without this, an admin
  reading the matrix would assume a wildcard set reaches it while the server
  403s. The object catalog mapping threads `access.default` through
  (`ObjectSummary.accessDefault`).

  **Object designer — Access section (④ + ⑤).** `ObjectDefaultInspector` (shared
  by metadata-admin and the Studio Data-pillar settings tab) gains an "Access"
  section: an exposure-posture select (`public`/`private`, with a warning hint
  that a private object needs an explicit grant before anyone but platform
  admins can use it), and a "Required capabilities" editor for the object-level
  `requiredPermissions` AND-gate. The capability editor supports both shapes —
  `string[]` (all operations) and the per-operation `{read,create,update,delete}`
  map — with a mode toggle that converts losslessly (all→per-op copies the list
  into every operation; per-op→all unions). The per-operation toggle is
  **feature-detected** against the bundled `@objectstack/spec` (it needs the ⑤
  union, spec ≥ 12.7) so the UI never offers a shape client-side validation
  would reject; map-form drafts always render per-operation inputs.

  **Publish — capability-reference lint (⑨).** `usePublishAllDrafts` now runs
  `validateCapabilityReferences` from `@objectstack/lint` over the pending
  object/app/action drafts (declaration side = published permission sets ∪
  pending permission drafts) and surfaces "capability registered nowhere"
  warnings as a post-publish toast. Strictly advisory and fail-safe: the rule is
  feature-detected (no-op until the lint dependency ships it), and any
  client/import/rule failure is swallowed — the lint can never break or block
  publishing.

- e2e0dbe: Dashboard authoring moves entirely into Studio.

  The in-page dashboard **Edit** button and its inline `DashboardConfigPanel` were removed — `DashboardView` is now a pure viewer, so authoring lives in one place: Studio's Interfaces pillar. The top bar's "Design in Studio" icon is now context-aware — on a dashboard route it deep-links straight to that dashboard's design page (`/studio/:packageId/interfaces?surface=dashboard:<name>`) via the new `appStudioSurfacePath` helper, falling back to the package's Data tab elsewhere.

- e35f880: Studio Data tab: metadata-driven config panels for Validations, Hooks and Actions (with add).

  The object **Validations**, **Hooks** and **Actions** sub-tabs are now no-code config panels driven by the corresponding metadata, each able to **create** new entries:

  - **Validations** — the panel covers every spec rule type, not just `script`: `cross_field`, `state_machine`, `format`, `json_schema` and `conditional` are all authorable (previously they were read-only "maintain in code"). The **New** menu adds any type seeded with a valid, never-firing skeleton, and a rule's type can be switched in place; CEL predicates reuse the shared `ConditionBuilder`.
  - **Hooks** — a new curated `HookDefaultInspector` replaces the flat generic form: the target object is an **object picker** (multi-select + `*`, not a free-text box), lifecycle events are grouped checkboxes, and the handler is a **dedicated code editor** (language + body). Advanced props fall through to a `SchemaForm` fed the live `hook` JSONSchema from `/meta/types`.
  - **Actions** — the `ActionDefaultInspector` now receives the live `action` JSONSchema as `serverSchema`, so its "More fields" section can edit any spec property not curated above (nothing is un-editable).

  `DataPillar` resolves the per-type schemas once (via `useMetadataTypes`) and passes them down.

- e1840bf: Signal the platform's preview stage in the UI.

  The console top bar (`AppHeader`) now shows a small **Preview** chip next to the
  product wordmark on every surface (home / app / orgs), so users always know the
  whole platform is pre-GA. It's a new `PreviewBadge` component driven by a
  `branding.stage` field in runtime-config (`'preview' | 'beta' | 'ga'`, exposed
  via `getPlatformStage()`), which defaults to `'preview'` so the badge shows out
  of the box. Operators flip the stage to `'ga'` at launch (`OS_PRODUCT_STAGE` /
  `RuntimeConfigPlugin`) and the badge disappears with no code change; `'beta'`
  renders a "Beta" chip instead. Labels are localized under `topbar.stage.*`.

- 572cc6b: Keep a clickable path back when drilling from a record into a related child record (objectui "点击子表标题跳转后如何返回").

  Clicking a related sub-table row opens the child record's detail page, but that page dropped all trace of where you came from: its breadcrumb only led to the child object's _list_ (never the parent record), and the record body's built-in Back button is suppressed on the schema-rendered surface. From a related-list drill-in the only way back was the browser Back button.

  - **New reserved `?from=` URL param carries the ancestor trail.** When you open a related record (both the synth `RelatedRecordActionsBridge.onView` path and the legacy `RecordDetailView` `onRowClick` path), the parent record is appended to a compact, refresh- and share-safe trail encoded in the URL. Nested drill-ins accumulate (`Account → Invoice → Invoice Line`); depth is capped at 8 and titles truncated so the URL can't grow unbounded, and a trailing self-reference is deduped. Codec (`encodeRecordTrail`/`decodeRecordTrail`/`appendRecordTrail`/`buildRecordTrailHref`) is total — a malformed value yields no ancestor crumbs rather than throwing.
  - **The top-bar breadcrumb renders the trail as clickable segments.** A record route with a `?from=` trail now shows `Account → #parent → Invoice → #child`, each ancestor an `object-list → record` pair that links back, with mid-path crumbs preserving the ancestors above them.
  - **The record body shows an inline "← back to parent" link** derived from the trail's nearest ancestor, so the immediate-parent affordance survives refresh and shared links (previously it relied on in-session history state that nothing populated for this flow).

- c31874d: Record-header actions honour `Action.order`, so approval decisions no longer get buried in the `⋯` overflow menu (objectui#2339 / framework#2670).

  The `action:bar` renderer now stable-sorts its actions by an explicit **`order`** field (lower = higher / more prominent, default `0`) before the inline/overflow split. The sort is stable and treats unset `order` as `0`, so action groups where nobody sets `order` keep their exact registration order — existing toolbars are unaffected. `order` is added to `ActionSchema` in `@object-ui/types`, mirroring `Action.order` in `@objectstack/spec`.

  `RecordDetailView` now assigns the injected **Approve / Reject** decision buttons a strongly-negative `order` (and gives Approve the highlighted `primary` variant), so on a pending-approval record the approver's decision takes the primary-button slot and app `record_header` actions follow it — instead of the app having to hide its own actions to surface the decision.

- bf00df4: The top bar's "Design in Studio" bridge now deep-links pages and reports, not just dashboards.

  Previously only a **dashboard** route deep-linked to its design page in Studio's Interfaces pillar; a **page** or **report** route fell back to the package's generic Data tab, dropping the admin far from the surface they were viewing. The route-type → surface-type mapping now covers all three interface types (`dashboard` / `page` / `report`) via the new `appStudioRoutePath` helper, so e.g. viewing `/apps/:pkg/page/showcase_crm_workbench` and clicking the hammer opens `/studio/:packageId/interfaces?surface=page:showcase_crm_workbench`. Object routes and the app root still open the Data tab.

- d5cb84f: Studio: expose the object record sharing model (OWD) in the Data pillar Settings tab.

  The object designer had no control for an object's `sharingModel` (Org-Wide Default), so record-level isolation was invisible and unconfigurable at design time — an admin who ticked Read/Edit in the permission matrix silently got org-wide read/write, because an unset `sharingModel` falls through to the runtime's fully-public default. `ObjectSettingsPanel` now renders a "Record sharing (OWD)" section with a `sharingModel` selector (`private` / `public_read` / `public_read_write` / `controlled_by_parent`), a per-option description of the runtime effect, and an amber warning when unset that spells out the fully-public default. Legacy aliases (`read` → `public_read`, `read_write`/`full` → `public_read_write`) are normalised to their canonical value for display. Fully localized (en-US / zh-CN).

- 23132ab: Studio Interfaces: move the source-page code editor into a "Source" inspector tab, silence its bogus TypeScript errors, and deep-link menu selection.

  For `kind:'html'`/`kind:'react'` pages (a `source` string, not a block tree), the code editor now lives in a dedicated **Source** tab in the right-hand properties panel while the canvas shows only the live preview; edits flow through the shared draft so the preview stays in sync. The `SourcePageEditor` gains a `mode` prop (`split` | `editor` | `preview`) to render the halves independently, and a `beforeMount` hook disables the Monaco TypeScript worker's semantic/syntax validation (and configures JSX) so JSX-flavoured HTML — intrinsic tags like `<flex>`, no `import React`, `style={{…}}` object literals — no longer floods the gutter with meaningless red squiggles (the live preview and server-side validation remain the source of truth). Selecting a menu now records the open surface as `?surface=<type>:<name>`, so the design target is shareable and survives a reload instead of snapping back to the first nav leaf.

### Patch Changes

- 195121a: Studio form designer + preview now match the runtime form's column density.

  The Data pillar's **Form → Layout** designer laid every section out in a fixed 2-column grid capped at `max-w-3xl`, and **Form → Preview** capped the real `ObjectForm` at `max-w-2xl`. So on a wide screen the studio showed at most 2 columns while the record the end user actually edits spreads to up to 4 — the design surface misrepresented the real layout.

  `ObjectFormDesigner` now derives its column count the same way the runtime form does (`inferColumns` over the object's editable field count, objectui#2578) and lays each section out with the shared container-query grid classes (`containerGridColsFor`) inside a per-section `@container`, so a field-heavy object reaches 4 fields per row on wide screens and collapses to one column when the panel is narrow. Wide widgets (textarea/markdown/html/…) span the full row, mirroring the form. Both the layout and preview canvases were widened to `max-w-6xl` so the container queries can actually reach 4 columns. `containerGridColsFor` is now exported from `@object-ui/plugin-form` as the single source of truth for these grid classes.

- Updated dependencies [6cbccf3]
- Updated dependencies [e1840bf]
- Updated dependencies [c31874d]
  - @object-ui/components@12.1.0
  - @object-ui/fields@12.1.0
  - @object-ui/i18n@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/layout@12.1.0
  - @object-ui/plugin-editor@12.1.0
  - @object-ui/react@12.1.0
  - @object-ui/auth@12.1.0
  - @object-ui/collaboration@12.1.0
  - @object-ui/core@12.1.0
  - @object-ui/data-objectstack@12.1.0
  - @object-ui/permissions@12.1.0
  - @object-ui/providers@12.1.0

## 12.0.0

### Minor Changes

- 68e2d1c: Studio UX audit fixes (objectui#2285) — browser walkthrough of the Studio design surface surfaced one rendering bug and several dead-space/discoverability issues; all fixed and re-verified end to end:

  - **Bug — mobile card view showed `[object Object]` for lookup fields.** `ObjectGrid`'s narrow-viewport card layout dumped raw field values through `String(value)` instead of reusing the type-aware cell renderer the desktop table already used; a lookup's expanded object (`{ id, name }`) rendered as the literal string. Now routed through the shared `coerceToSafeValue` helper (newly exported from `@object-ui/fields`, alongside `pickRecordDisplayName`) and a hoisted `renderRecordDetail`, matching the desktop path.
  - **Studio has no responsive/mobile layout.** Below the mobile breakpoint, each pillar's rail (Objects / Flows / Nav tree / Permission sets) now collapses into a toggleable overlay drawer instead of permanently squeezing the canvas into ~190px, and the top pillar-tab bar scrolls horizontally instead of clipping Automations/Interfaces/Access off-screen.
  - **Records tab / Automations canvas had a dead space band.** `ObjectView`'s built-in "+ New" toolbar row (a separate, mostly-empty flex row above the grid) is now folded into the grid's own toolbar via a new optional `onAddRecord` passthrough on `renderListView`; the Automations canvas container now sizes to the pillar's full height instead of its own intrinsic content height.
  - **Automations "fit view" never actually zoomed in.** `fitToView`'s zoom calculation was hard-capped at 100%, so small (2-4 node) flows stayed stranded in a corner of a mostly-blank canvas even after fitting. Removed the artificial cap (now bounded only by the existing `MAX_ZOOM`) and auto-fit once on mount so opening a flow starts appropriately zoomed instead of a fixed 100%/pan-0,0 default.
  - **Validations tab didn't default-select the first rule**, unlike the Access pillar's Permission Set list — now consistent.
  - **HTML/React "source" pages left the Properties panel permanently empty** (no selectable block exists for raw JSX/HTML pages). It now shows a contextual message pointing at the source editor instead of the generic "click a block" empty state.
  - **Permission matrix column headers (C/R/U/D/Tr/Re/Pu/VA/MA) had no visible legend** — added one above the matrix (the header cells' native tooltips stay as-is).
  - **App Builder landing page** widened and given the same icon-badge treatment as Home's app cards, with a 3-column grid on wide screens instead of a narrow fixed-width column stranded in the corner of the viewport.

### Patch Changes

- 77a0953: Consolidate the record-surface mirror onto `@objectstack/spec/data` (objectui#2269 debt paydown).

  `plugin-view/src/recordSurface.ts` re-exports `deriveRecordSurface` / `deriveRecordFlowSurface` / `countAuthorableFields` / `RECORD_SURFACE_PAGE_THRESHOLD` + types from `@objectstack/spec/data` instead of carrying a hand-kept copy — the local mirror only existed because objectui pinned a spec (`^11.7`) predating those exports, and the pin is now `^12.2`. The objectui-local overlay-size helpers (`deriveOverlaySize` / `overlayWidthFor` / `OverlaySize`, a renderer width concern the protocol doesn't own) stay local but reuse spec's `countAuthorableFields`. `RecordSurface` widens to spec's `'page' | 'modal' | 'drawer'` (the heuristic still only emits page/drawer); `resolvePostCreateTarget`'s `surface` param accepts the wider type and treats `'modal'` like a drawer. Behavior is unchanged (mirror unit tests pass verbatim against the re-exported functions); console production build resolves the subpath import.

- 821500f: Studio source-code editors fall back to the textarea instantly when Monaco can't load (offline / air-gapped / CSP).

  The metadata designer's code surfaces — the JSON **Source** tab (`JsonSourceEditor`) and the `kind:'html'`/`kind:'react'` page editor (`SourcePageEditor`) — lazy-load Monaco from a public CDN (jsdelivr). On installs that block it (the console is meant to embed in any ObjectStack server, many shipping a strict CSP), the loader script fails and the panel sat on Monaco's own "Loading…" for a hard-coded 4 seconds before the textarea fallback engaged. A new shared `useMonacoFallback` hook now watches `loader.init()` and flips to the textarea the moment the CDN load rejects (~immediately), keeping the previous `.view-line` DOM-poll as a backstop for the "resolved but painted nothing" case. On working networks Monaco still loads normally. This also makes the Studio Interfaces pillar's "edit it directly in the code panel on the left" hint (added in #2285) actually point at a populated editor instead of a stuck spinner.

- Updated dependencies [226fde9]
- Updated dependencies [77a0953]
- Updated dependencies [e36a9c7]
- Updated dependencies [e4de456]
- Updated dependencies [68e2d1c]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/components@12.0.0
  - @object-ui/fields@12.0.0
  - @object-ui/plugin-view@12.0.0
  - @object-ui/plugin-detail@12.0.0
  - @object-ui/plugin-form@12.0.0
  - @object-ui/plugin-grid@12.0.0
  - @object-ui/auth@12.0.0
  - @object-ui/collaboration@12.0.0
  - @object-ui/data-objectstack@12.0.0
  - @object-ui/layout@12.0.0
  - @object-ui/permissions@12.0.0
  - @object-ui/plugin-calendar@12.0.0
  - @object-ui/plugin-charts@12.0.0
  - @object-ui/plugin-chatbot@12.0.0
  - @object-ui/plugin-dashboard@12.0.0
  - @object-ui/plugin-designer@12.0.0
  - @object-ui/plugin-editor@12.0.0
  - @object-ui/plugin-kanban@12.0.0
  - @object-ui/plugin-list@12.0.0
  - @object-ui/plugin-report@12.0.0
  - @object-ui/providers@12.0.0
  - @object-ui/react@12.0.0
  - @object-ui/i18n@12.0.0

## 11.5.0

### Minor Changes

- 544d8eb: Add the app → Studio reverse bridge (ADR-0080): workspace admins see a "Design in Studio" entry in the app top bar that deep-links to the running app's owning package on the Studio design surface (`/studio/:packageId/data`). Hidden for non-admins and for apps with no owning package; package writability stays server-side (read-only packages open as browse-only).
- 6fffd3d: Client-side data-invalidation bus — refresh data, don't rebuild UI (objectui#2269 P1).

  - `@object-ui/react` gains the bus: `notifyDataChanged({objectName, recordId?})`, `useDataInvalidation(objectName, recordId?)` (reader nonce), `subscribeDataChanges`, and `useMutationInvalidationBridge(dataSource)` which fans every dataSource write (`MutationEvent`) onto the bus. The bus also dispatches the legacy `objectui:related-changed` window event, so pre-bus listeners keep working.
  - The `key={refreshKey}` remount of `RecordDetailView` (AppContent) and the `key={actionRefreshKey}` remount of `DetailView` (RecordDetailView) are GONE: record data now refetches in place via the bus — scroll, collapsed sections, tabs and in-progress inline edits survive every save/action/undo. All nine action-success bumps became precisely-scoped `notifyDataChanged` calls; undo/redo use the operation's own `objectName`/`recordId`.
  - `RelatedCountStore` is wired to the bus (tab count badges refetch after any change to their object) and its `useSyncExternalStore` snapshot is now a monotonic version — previously it returned the same `Map` reference, so `emit()` never re-rendered subscribers and invalidations left badges stale; `useRelatedCountVersion()` is exported and drives the probe effect's re-fetch.
  - app-shell also gains the reserved URL-param registry (`urlParams.ts` — `form`/`formObject`/`formLink`/`tab`/`recordId`/`palette`/`shortcuts` constants replace scattered string literals) and AGENTS.md Commandment #8 (UI-state classification: state that must survive a data refresh may never live only in an uncontrolled component).

- 9255686: Record detail tabs are URL-addressable (`?tab=`) and survive subtree remounts (objectui#2257, ADR-0054 C3).

  - `buildDefaultTabs` emits STABLE semantic tab values (`details` / `related:<child>` / `related` / `activity` / `history`) instead of leaving the renderer to synthesize index-derived ones.
  - `PageTabsRenderer` honors `item.value`, a host-provided `schema.defaultTab` (validated against actual tabs) and `schema.onTabChange`; index fallback kept for authored schemas without values.
  - app-shell `RecordDetailView` restores the active tab from `?tab=` and writes it back with `replace` (tab switches never stack history), via the pure `withPageTabsUrlSync` page-tree injector (never mutates authored/memoized page schemas). Legacy `DetailView.autoTabs` wired to the same contract (`defaultTab`/`onTabChange`).
  - Fixes the tab strip resetting to Details after save-refresh remounts (`refreshKey`-style) and dev-StrictMode URL churn; enables `?tab=` deep links; invalid values fall back to Details.

- 6c1ad9e: Record task flows open as derived overlays with lossless return (framework#2604, extends framework#2578).

  - **Create/Edit never route** — the global record form is URL-driven (`?form=new` / `?form=<id>`): browser Back closes the overlay with the origin (list scroll/filters, detail state) intact; field-heavy objects derive a full-screen modal (`modalSize:'full'`) via the new `deriveRecordFlowSurface` mirror in plugin-view, light ones keep the auto-sized modal. `editMode:'page'` opt-in unchanged.
  - **Save invariant** — _edit never moves you_ (origin refetches in place); _create lands on the new record's detail_ on its derived surface (drawer over the still-intact list for light objects, detail route for heavy), with `replace:true` so Back skips the transient form entry.
  - **Subtable child create/edit = overlay over the parent detail, never a route** — related-list New/Edit push `?form=…&formObject=<child>&formLink=<fk>:<parentId>`; the one global overlay pre-links the parent (refresh-safe), sizes to the CHILD object, and on save stays on the parent while only the child's related lists refetch. ModalForm now forwards `initialValues` into its master-detail (subforms) branch so pre-links survive for children with inline line items.

- fbec4e1: feat(studio): pick a connector action from the chosen connector (no more hand-typed action ids)

  In a flow's **Connector Action** node, the `actionId` field was a free-text box
  (`sendMessage · send` placeholder) — a typo silently produced a node that fails
  at run time. It was left as text because a connector's actions have "no flat
  catalog"; but each connector already advertises its actions in the runtime
  descriptors (`GET /api/v1/automation/connectors` → `{ name, actions:[{key,label}] }`).

  `actionId` is now a **picker of the chosen connector's actions**, resolved from
  the sibling `connectorId` (mirroring how `object-field` lists the fields of its
  resolved object). New reference kind `connector-action` + `connectorSource` on
  `FlowReferenceSpec`; `useConnectorActionOptions` fetches the descriptors and
  `resolveConnectorName` reads the connector from the node's `connectorConfig`. Like
  every reference in the designer it stays an **editable combobox** — with no
  connector chosen (or none installed) it degrades to free text with a hint
  ("Choose a Connector above to list its actions" / "Actions of <connector>.").

  Closes the last critical hand-typed-identifier gap in flow-node config (the
  object / field / flow / role / connector / template references were already
  pickers). Unit-tested (`resolveConnectorName`, `connectorActionsToOptions`).

- 7a6837c: Studio package-create dogfood follow-ups (objectstack-ai/framework#2615):

  - Read-only packages now gate authoring affordances client-side (Add field, New object/flow/permission set, nav Edit, Save draft, Publish, Create app) with a "switch to a writable package" hint, instead of letting doomed edits pile up until the server 422s (objectui#2259). Records stay fully usable; the field inspector opens read-only.
  - New fields auto-derive their API name from the label while still auto-named — now also for the Data pillar's generic `field_N` names, so relabeling "New field" to "Status" yields a `status` column instead of `field_2` forever (objectui#2260).
  - Publish is review-then-confirm: the header button opens the pending-changes panel, whose footer "Publish N change(s)" fires the atomic package publish; panel entries expand to a per-item field/property diff against the live version (objectui#2261).
  - Create app can scaffold navigation from the package's objects (checkbox, on by default): one spec-valid object menu item per object, closing the "fresh app has zero nav" dead-end (objectui#2262).

- 5ed8d2d: feat(studio): automation enable/disable switch + live status in the Automations rail

  The Automations pillar showed only an icon + label per flow, and no way to turn a
  flow on or off — so an author couldn't tell whether an automation was live, or
  stop one without deleting it (the header even said "Off by default · review before
  enabling", but nothing reflected or controlled it). UX eval #6.

  - **Live status dot** on every flow in the rail — a green "On" / gray "Off",
    fetched from the engine's `GET /api/v1/automation/_status` (persisted `status`
    is intent; this is what's actually enabled + bound to its trigger). Refetched
    after a publish; degrades silently on an older backend. A flow the engine
    doesn't know yet (never published) shows no dot — the amber "unpublished draft"
    chip already covers that.
  - **Enable/Disable switch** in the flow header. It flips the flow's deployment
    `status` (active ↔ obsolete) and saves the draft immediately; the change goes
    live when the package is published (so "review before enabling" is preserved).
    Pairs with framework's engine-side gate (`obsolete`/`invalid` → not bound).

  New `engine.studio.auto.*` i18n keys (en + zh). Unit-tested (`FlowStatusDot`:
  enabled→On, disabled→Off, no-state→nothing, bound-vs-unbound tooltip). Verified in
  a live browser: the rail shows a green "On" against every showcase flow and the
  header switch reads "Enabled".

- 70c4a3f: Studio package-create dogfood follow-ups (framework#2615 — P2 wizard + P3 polish):

  - **Package-id wizard feedback.** The three package wizards (switcher create,
    landing create, landing duplicate) share a new `PackageIdInput`: illegal
    characters are still normalized away, but no longer silently — a notice
    says what was removed — a reverse-domain format hint shows while the id
    doesn't parse, and a CJK-only name that yields no id suggestion is told to
    type one manually instead of leaving the id box mysteriously empty.
  - **Records-grid duplicate "Actions" column.** A field literally named
    `actions` is now dropped from the Studio grid's data columns, so it no
    longer collides with the always-pinned row-actions column (it stays
    editable in the form designer).
  - **Record-create verb consistency.** The `ObjectView` toolbar create button
    resolved a hardcoded English "Create"; it now uses the same
    `console.objectView.new` ("New" / 新建) key as the runtime object pages so
    Studio and the running app agree.
  - **Branded cold-load splash.** The console's pre-auth loading gate rendered a
    bare "Loading…"; it now shows the branded, boot-safe `LoadingScreen`.
  - **Picklist option editor.** Value/label inputs and CJK option labels no
    longer truncate — the six controls that shared one cramped row are split
    into a two-row layout so the inputs get the full panel width.
  - **Draft-save confirmation.** The Data pillar's "Save draft" now shows a
    success toast and a "last saved HH:MM" indicator, matching the App and
    Automations pillars.

### Patch Changes

- ec6bb16: Studio Automations rail now shows authored-but-unpublished (draft) flows.

  The Automations pillar loaded its rail with `client.list('flow', …)` only, which
  returns published/active metadata — so a flow authored (saved as a draft) but not
  yet published was invisible in the rail, even while the "Changes · N" counter
  showed a pending draft existed. Every sibling pillar (Data / Interfaces / Access)
  already merged `client.listDrafts`; Automations was the sole outlier.

  The published ∪ draft merge is extracted into a shared, unit-tested
  `loadPackageSurfaces` helper and adopted by the Automations pillar, which also now
  re-reads on `publishNonce` so drafts that go live collapse back into the published
  rail after a package publish. A draft-only flow now appears in its rail (badged
  "Unpublished draft"), is selectable, and loads its draft body for editing —
  matching the other pillars. Fixes the empty-rail report for writable-base packages
  whose flows are all still drafts.

- 4fbf910: Stop double-firing action toasts on record-detail script actions and the delete handler.

  `ActionRunner.handlePostExecution` already surfaces a result's `error` as a toast
  (and a success toast unless `silent`). Two handlers ALSO toasted themselves while
  returning `{success:false, error}` (or a non-`silent` success), so on a runner
  seeded with `onToast` the same message fired twice:

  - **`RecordDetailView` `serverActionHandler`** (script actions): the HTTP/inner-fail
    branch and the catch branch each called `toast.error` before returning the error.
    #2177 fixed the twin in `useConsoleActionRuntime` (interface pages) but not this
    copy, so record-detail script-action failures (e.g. a `RECORD_LOCKED` from an
    approval-locked record) still showed the error twice for everyone on the published
    console bundle. Both branches now return the error and let the runner toast it once.

  - **`useObjectActions` `delete` handler** (ObjectView list/detail deletes): kept its
    richer localized toast (label + description, or the bulk succeeded/failed summary)
    and now returns WITHOUT `error` on failure so the runner doesn't re-toast it, and
    marks successful deletes `silent` so the runner doesn't append a second generic
    "Action completed successfully" toast.

  Adds `useObjectActions.test.tsx` asserting exactly one toast on delete
  success / failure / partial-bulk-failure.

- 6f15e43: test(studio): extend the create-conformance gate to the inline pillar creators

  `createConformance.test.ts` guards that every authorable type's default
  create-form output passes spec validation — catching the recurring "the designer
  emits a minimal shape the spec rejects, so create→save 422s" dead-end family. But
  it read only the metadata-admin registry, so the Studio's **inline** "New X"
  creators (Data → object, Automations → flow, Interfaces → app, Access →
  permission) — which build their skeletons directly in `StudioDesignSurface.tsx`,
  bypassing the registry — were **uncovered**. A future edit to one of those shapes
  could turn its "New" button into a silent dead-end with nothing to catch it.

  Extracted the four inline skeletons into pure, exported builders
  (`studio-design/skeletons.ts`) consumed by BOTH the pillars and a new gate block,
  so the test can't drift from what the "New" button actually emits. No behavior
  change — the builders return the byte-identical skeletons. The gate now covers all
  create paths (registry + inline); the four inline skeletons validate clean.

- Updated dependencies [544d8eb]
- Updated dependencies [6fffd3d]
- Updated dependencies [9255686]
- Updated dependencies [fae75e2]
- Updated dependencies [1072701]
  - @object-ui/i18n@11.5.0
  - @object-ui/react@11.5.0
  - @object-ui/components@11.5.0
  - @object-ui/types@11.5.0
  - @object-ui/data-objectstack@11.5.0
  - @object-ui/fields@11.5.0
  - @object-ui/layout@11.5.0
  - @object-ui/plugin-editor@11.5.0
  - @object-ui/auth@11.5.0
  - @object-ui/collaboration@11.5.0
  - @object-ui/core@11.5.0
  - @object-ui/permissions@11.5.0
  - @object-ui/providers@11.5.0

## 11.4.0

### Minor Changes

- 8bf6295: feat: adaptive record surface + semantic field span + responsive columns (framework#2578)

  Field-heavy objects (all metadata is AI-authored) now present themselves without
  any authored presentation config:

  - **Adaptive surface** — a record's create/edit/detail opens as a full page when
    the object is field-heavy, or a drawer when it is light. Derived from field
    count (`deriveRecordSurface`), not authored; mobile always pages. Wired into the
    app-shell ObjectView detail navigation (an authored view/object `navigation`
    still wins).
  - **Semantic field span** — `FormField.span` (`auto`/`full`) is a width primitive
    decoupled from the (per-surface derived) column count; legacy `colSpan` is
    clamped so it never overflows. `ObjectForm` now honours per-section `columns`
    and carries `span`/`colSpan` from section defs — fixes the bug where
    `type:'simple'` ignored `section.columns` and grouped fields rendered single
    column.
  - **Responsive columns** — `inferColumns` scales the column CAP with field count
    (≤3→1, ≤8→2, ≤15→3, 16+→4); the ACTUAL column count follows the form's real
    width via CSS container queries, so the same form goes 1→2→3→4 columns as a
    drawer widens or becomes a page.
  - **Runtime overlay width** — `NavigationConfig.size` bucket is resolved to a
    viewport-clamped width at runtime (`overlayWidthFor`); a pixel width is never
    authored (the author cannot know the client viewport).

- 144ab55: Consume the ADR-0085 object semantic roles from `@objectstack/spec@11.7.0`, retiring the per-surface hint dialects:

  - **Single-source fieldGroups derivation**: `plugin-form`'s `deriveFieldGroupSections` and `plugin-detail`'s `deriveFieldGroupDetailSections` are now thin adapters over the spec's `deriveFieldGroupLayout` (ADR-0085 §5) — forms, modals and detail pages render the SAME grouping from one implementation. The canonical `collapse: 'none' | 'expanded' | 'collapsed'` enum is honoured everywhere (deprecated `collapsible`/`collapsed` and `defaultExpanded` spellings still read for pre-11.7 metadata).
  - **`stageField` semantic role**: the detail stepper reads the top-level `stageField`; `stageField: false` now actually suppresses stage detection (previously the `false` handling was wired to the removed `detail.stageField` key, so spec-authored `false` fell through to the name heuristic).
  - **`highlightFields` rename**: default grid columns, card compact views, the detail highlight strip, child-record preview fields and interface-page default columns read the object's `highlightFields` (deprecated `compactLayout` spelling read as fallback for pre-11.7 metadata).
  - **Removed dead reads**: the never-spec-writable `objectDef.views.*` UI hints and the ADR-0085-removed `detail.*` block (`sections`, `sectionGroups`, `highlightFields`, `stageField`, `useFieldGroups`, `showReferenceRail`, `hideReferenceRail`, `hideRelatedTab`, `relatedLayout`) are no longer consulted. Per-page customization goes through an assigned Page schema (`record:reference_rail` remains available there as a renderer capability). `detail.renderViaSchema` survives only as the legacy-renderer kill-switch and is removed together with that path.

- d9f5ccd: feat(studio): package Access door is draft/published, not live (ADR-0086 P2 · D6/D7)

  The package **Access** pillar edited permission sets **live** — it wrote the
  active record directly, unlike the Data and Interfaces pillars which stage a
  draft and publish with the rest of the package. That contradicted ADR-0086 D6
  ("a package's own access is metadata → draft/publish") and left the two doors
  sharing one live write path.

  Now the **package door** (`/studio/:packageId/access`) writes **drafts**:

  - The permission editor's Save (`PermissionMatrixEditPage`, package scope) and
    the "new set" creator both call `client.save(..., { mode: 'draft', packageId })`
    — the framework stamps the draft with the package, and the top-bar **Publish**
    promotes it atomically (materialized into `sys_permission_set` by the framework
    side, ADR-0086 P2 块1). The **environment-admin** door (no `packageId`) is
    unchanged: it stays **live** (config), per D7.
  - Reads are draft-aware: the editor loads any pending draft over the published
    baseline, and the pillar rail merges published ∪ draft sets — so a set created
    or edited as a draft stays visible before publish (matching Data/Interfaces).
    Saving bumps the surface's pending-changes counter; a publish reloads the
    published baseline.
  - The pillar banner no longer claims "saved = live" (it said Publish didn't apply
    here) — it now states edits save as package drafts and go live on Publish.

- 19f2533: Detail-page related lists: `relatedList: 'primary'` → own tab, multi-FK & self-referential related lists, unified picker columns (framework #2579).

  - **plugin-detail** (`buildDefaultTabs`): the default related-list layout is now
    the ADR-0085 prominence rule — lists whose FK declares `relatedList: 'primary'`
    each get their OWN tab; every other related list collapses into a single
    "Related" tab. With no primary lists this is byte-for-byte the previous stacked
    default, so it is opt-in per relationship. `relatedLayout: 'tabs' | 'stack'`
    remain app-level overrides (force all-own-tabs / all-stacked).
  - **app-shell** (`deriveRelatedLists`): emits one related list per eligible FK —
    a child referencing the parent through several relationships (e.g.
    `primary_account` + `partner_account`) now surfaces each, disambiguated by the
    FK label; includes self-referential relationships (hierarchies → a "child"
    list); and carries the `isPrimary` prominence flag through. `RecordDetailView`
    threads `isPrimary` into the synthesized page.
  - **fields** (`deriveLookupColumns`): the lookup-picker default columns now
    prefer the object's ADR-0085 `highlightFields` (then legacy `displayFields`,
    then the field walk) — the same "how to list this object" source the related
    list uses, so a picker and a related list of the same object agree with zero
    per-surface config.

  Pairs with the `@objectstack/spec` change that makes `relatedList` a tri-state
  (`boolean | 'primary'`) and `record:related_list` `columns` optional.

- 17374ce: Studio Data pillar Phase B — Validations & Settings views complete the Data v1 surface (builder-ui pillars):

  - **Validations view**: no-code editing of `ObjectSchema.validations` `script` rules (name / message / CEL fail-condition via the metadata-admin ConditionBuilder, fed the DRAFT field list / severity / active / delete). Non-script rule types (state_machine, format, …) stay visible read-only so the list remains a truthful inventory. New rules default to a VALID never-firing `condition: 'false'` — an empty condition 422s the whole draft save and dead-ends the create flow.
  - **Settings view**: object basics via the shared metadata-admin default inspector (one implementation for both surfaces) plus direct editors for the ADR-0085 semantic roles — `nameField`, `stageField` (incl. the `false` "not a linear flow" state) and ordered `highlightFields` chips.
  - **Draft-only packages fixed in the rail**: the object list now merges `listDrafts()` headers, so a freshly-created writable base shows its draft objects instead of hanging on "加载中…"; the empty state now says the package has no objects yet.

### Patch Changes

- 4f77044: fix(studio): scope the Access matrix by package + slice-merge on save (ADR-0086 P0)

  The Access pillar embedded the permission matrix at **environment scope**: it
  listed every object in the environment (the "84-object leak"), and Save
  overwrote the whole permission set — silently dropping authorization rows other
  packages had contributed.

  Opened inside a package, the matrix now:

  - lists **only the objects that package declares** (`list('object', { packageId })`),
    so a package's Access panel no longer exposes unrelated objects; and
  - saves via **slice-merge** — it re-reads the record and writes back only this
    package's slice, leaving every row contributed by other packages
    byte-for-byte intact.

  The Access rail also hides environment-owned platform-default sets
  (`admin_full_access`, `member_default`, …) from a package's panel once the
  backend tags sets with a record-level `package_id` (framework ADR-0086 P1), with
  a mid-migration guard that shows all sets until that provenance axis is live so
  the rail never goes empty. Behavior is unchanged when the editor is used outside
  a package (no `packageId`): full object list, whole-record save.

- 1813544: feat(studio): Access pillar — the fourth content pillar (permission matrix)

  The pillar builder gains **Access** (builder-ui §7 / ADR-0084's fourth pillar):
  left rail lists the environment's permission sets / profiles (search + inline
  create), and the main zone embeds the existing Salesforce-style
  `PermissionMatrixEditPage` unchanged — objects × CRUD/VAMA/lifecycle plus
  per-object field-level R/W, with its own save and destructive-change guard.

  Deliberate v1 semantics, said out loud in the banner: permissions are
  platform-level authorization objects, not package content — the matrix saves
  the ACTIVE item directly, so the shell's package draft/publish does not apply.

- 2318ea2: fix(studio): scope the Access rail server-side by package (ADR-0086 P1)

  The Access pillar's permission-set rail filtered client-side on a `package_id`
  field read from `client.list('permission')` rows. But the metadata list endpoint
  does not echo the record-level provenance columns — every row comes back with
  `package_id` unset — so the filter's "any set tagged?" guard never fired and the
  rail showed **all** sets, including environment-owned platform defaults
  (`admin_full_access`, `member_default`, …), in a package's Access panel.

  The rail now scopes server-side via `client.list('permission', { packageId })`:
  the metadata API filters `permission` by the `package_id` provenance seeded in
  framework ADR-0086 P1, returning only the sets this package owns. Verified
  against a live showcase backend — the panel lists exactly `showcase_contributor`
  and `showcase_member_default`, and the four platform defaults are excluded.

  Removes the now-unused `scopePermissionSetList` client-side helper. Object-matrix
  scoping and Save slice-merge (ADR-0086 P0) are unchanged.

- 9aec681: fix(app-shell): stop double-toasting failed script/modal action errors

  `serverActionHandler` toasted the action error itself **and** returned
  `{ success: false, error }`, which `ActionRunner.handlePostExecution` also
  surfaces as a toast — so a failed script action (e.g. a validation throw)
  showed two identical red toasts.

  `apiHandler` and `flowHandler` already only return the error and let the
  runner own the toast; `serverActionHandler` now does the same, so a failed
  action toasts exactly once.

- 2edcaff: Drop the `compactLayout` fallback reads (6 sites: ObjectGrid default columns, deriveHighlightFields, RecordDetailView highlight strip + child preview, ObjectView ×2, InterfaceListPage). The deprecated spelling was retired from the spec by framework#2539 (framework#2536) — served metadata carries `highlightFields` only, so the fallbacks could never fire again; keeping them would teach the retired key to the next reader.
- 31f96f7: feat(studio): 复制 (duplicate base) on writable packages in the builder landing

  Writable base cards on the builder landing gain **复制** — a name/id inline form
  that calls `POST /packages/:id/duplicate` (ADR-0070 D4: re-namespaced clone with
  rewritten references) and drops the user straight into the copy's builder — the
  Airtable "duplicate base" gesture. Read-only code packages stay browse-only:
  duplication copies `sys_metadata` rows, which code packages don't have; their
  customization path is template/marketplace install.

- 34b92ac: fix(studio): show a failed flow run's reason in the Runs panel (string errors)

  The Studio flow **Runs** panel (`FlowRunsPanel`) rendered a run-level error as
  `run.error?.message`, but the automation engine sends `ExecutionLog.error` as a
  plain **string** — so `.message` was always `undefined` and the failure reason,
  the single most useful thing about a failed run, was silently dropped. This grew
  important now that runs are durable (framework #2581): a failed run persists with
  its reason, but the panel showed only a red "Failed" badge and no "why".

  The panel now normalizes an error through a small `errorText()` helper that
  accepts **either** a string (the run-level shape) **or** a `{ code, message }`
  object (the step-level shape), and uses it for both the run summary and each
  step row. Verified with a jsdom render test (a failed run's string reason reaches
  the DOM) and live in the browser against a real failed run (`showcase_resilient_sync`):
  the reason now displays where it previously showed nothing.

- 346e78e: feat(home,studio): builder cover on Home + builder→app bridge

  Two entries that wire the application builder into the platform journey the
  Airtable way — Home is the cover, the app is the published front-end:

  - **Home builder cover** (admins/builders only): two guided cards above "Your
    apps" — **Build an app** (start from scratch → `/studio`, pick/create a
    writable package) and **Start with a template** (→ marketplace). End users
    see their apps as before.
  - **打开应用 bridge** in the `/studio` top bar: when the package ships an app,
    one click opens its published front-end (`/apps/<name>`) in a new tab —
    the builder edits the 设计界面, the app is what end users see (Airtable's
    Data ↔ published-Interfaces relationship, our draft→publish included).

- c38d107: Fix view-level `FormField.visibleOn` (CEL) never taking effect (#2212).

  The spec ships `visibleOn` as an Expression object `{ dialect: 'cel', source }`
  (what the `P` template emits) or a bare string, but the whole chain dropped it:

  - `sectionFields.ts` / `ObjectForm.tsx` only accepted the bare-string shape and
    attached a dead `visible()` closure no renderer ever called — the Expression
    object shape was silently discarded.
  - The form renderer destructured `visibleOn` out of the field config and never
    evaluated it.
  - `RecordFormPage` dropped a `simple` form view's `sections` entirely, so
    page-mode create/edit fell back to the raw schema (every field, no authored
    selection/grouping) while the modal path honored the same view.
  - `ObjectForm`'s grouped-sections path matched section fields by name only,
    dropping per-field `visibleOn` overrides.

  `visibleOn` now flows through normalization verbatim (both wire shapes) and is
  evaluated reactively by the form renderer with the canonical expression engine
  (`evalFieldPredicate` — same engine, record scope, and fail-open semantics as
  field-level `visibleWhen`; both predicates must allow a field for it to show).
  Sectioned/flat normalization also copies field-level `visibleWhen` /
  `readonlyWhen` / `requiredWhen` rules it previously lost.

- 98c9855: fix(studio): lookup target picker can see the package's own draft objects

  When designing a set of related objects in one authoring pass, the field
  inspector's lookup "related object" picker only listed **published** objects
  (`list('object')`), so sibling objects still in draft — the ones you're most
  likely to point a new lookup at — were invisible and had to be typed as a raw
  API name, blind. The picker now also merges unpublished object drafts
  (`listDrafts({ type: 'object' })`, labelled "(草稿)"), so a lookup can target a
  sibling object before the package's first publish.

- 363e8b7: Resolve short view names in `/view/<name>` routes instead of silently falling
  back to the default view (#2217).

  Nav items emit their `viewName` verbatim — usually the short form
  (`tabular`) — while canonical view ids are fully qualified
  (`showcase_task.tabular`), so nav-generated view links always rendered the
  default view with no hint anything was wrong. `ObjectView` now resolves the
  requested name in both directions (short → `<object>.<name>`, and qualified →
  bare key for legacy embedded listViews), and logs a warning listing the known
  view ids when nothing matches instead of swallowing the miss.

- 0cf352b: fix(packages): Setup's package list and creator agree with the builder on writability

  Two disagreements between Setup › Packages and the application builder about the
  same package:

  - **Display**: `ScopeBadge` defaulted a missing scope to `project`, so writable
    database bases wore the same badge as read-only code packages. Scope-less
    entries now show **可写/Writable** (emerald), `project` reads **只读 · 代码包 /
    Read-only · code** — matching the builder's labeling.
  - **Semantics**: the create-package dialog hardcoded `scope: 'project'` onto new
    runtime-created bases, which made the builder's switcher/landing mislabel
    Setup-created packages as read-only. New bases are now created scope-less,
    the same shape the builder's own creator produces.

- 7782698: fix(components): page:header record title honours `nameField` via the unified ADR-0079 resolver

  The default console record detail page renders the synthesized `page:header`
  (`buildDefaultPageSchema`, renderViaSchema default-on), whose record-chip title
  chain probed `objSchema.primaryField` (not a spec property — always undefined),
  `titleFormat`, then hardcoded `name`/`full_name`/`title`/`subject`/
  `display_name`/`label` record keys. It never consulted the object's declared
  `nameField`/`displayNameField`, so an object titled by e.g. `subject` rendered
  `<ObjectLabel> <id-prefix>` as its H1 instead of the record's real name.

  `PageHeaderRenderer` now resolves through `getRecordDisplayName(objSchema, data,
{ deriveFromRecordKeys: false })` after the author overrides and before the
  legacy probes — mirroring `DetailView.resolveDisplayTitle` so both headers
  agree. `RecordDetailView`'s `primaryField` derivation and
  `buildDefaultPageSchema`'s highlight-strip dedup also honour
  `nameField`/`displayNameField`.

- 790558b: fix(studio): make the Automations and Interfaces pillars authorable in a fresh package

  Dogfooding a brand-new package end-to-end (design objects → automations →
  interfaces → publish → use) surfaced two blocking dead-ends in the pillar
  Studio, both now fixed:

  - **Automations pillar had no way to create a flow.** For a package with zero
    flows the rail rendered an endless "加载中…" (loading conflated with empty)
    and offered no create affordance, so automations could never be authored.
    It now tracks the list-loaded state (real empty state "还没有自动化 — 点「新建」开始")
    and has a "+ 新建" inline creator that saves a minimal, valid `start → end`
    autolaunched flow skeleton as a draft and opens it in the flow designer.

  - **Interfaces nav items could not be bound to a target — and silently failed
    to save.** Selecting a nav item showed no inspector, and the item shape the
    editor produced (`{ label, object }`, no `id`/`type`) failed the app spec's
    navigation union ("navigation.N: Invalid input"), so the draft never
    persisted and the published app navigation stayed empty. The right panel now
    renders a `StudioNavItemInspector` with a business-friendly object picker
    (populated from the package's published ∪ draft objects) that emits a
    spec-valid `ObjectNavItem` (`{ id, type:'object', objectName, label }`), and
    the nav save drops still-unbound placeholders + backfills a snake_case id so
    one blank item can't fail the whole save.

  Also fills in the Home builder-cover i18n keys (`home.build.*`,
  `home.template.*`) in `en`/`zh` so the "Build an app" / "Start with a template"
  cards resolve real strings instead of falling back to defaults.

- 3c7abf9: feat(studio): Data pillar left rail gains search + inline "new object"

  Closes the two remaining v1 rail gaps from the builder design (§4): the objects rail
  now has a **search** filter and an inline **新建对象** creator (显示名 + auto-derived
  snake_case 标识符 — hand-editable, since CJK labels can't derive one). Creating saves
  the object as a **draft in the current package** (same runtime-create path the classic
  Studio editor uses), seeded with one text field, and lands in 表单 · 布局 — the
  metadata-level designer.

  Draft-only objects (no physical table until the package publish) now get honest
  placeholders instead of broken surfaces: the Records grid explains that data arrives
  after publish (instead of firing SQL at a table that doesn't exist), and 预览 explains
  there is no published definition yet.

- 839f6c2: fix(studio): stamp packageId on pillar draft saves → true package-scoped publish

  Studio pillar draft-saves now pass the active `packageId`, so each draft row is
  stamped with its package binding (`sys_metadata.package_id`) instead of `null`.
  This makes the package-scoped surfaces reliable: the top-bar count + Changes review
  filter via `GET /meta/_drafts?packageId=`, and Publish promotes exactly this
  package's drafts via `POST /packages/:id/publish-drafts` (which matches
  `WHERE package_id = X`). Replaces the previous "publish all pending" fallback that
  was only needed because null-package drafts couldn't be package-filtered or picked
  up by publish-drafts.

- 87e7c23: feat(studio): builder landing + `studio:builder` entry — the builder joins the login journey

  The pillar application builder was a URL-only surface (zero links anywhere pointed at
  `/studio/...`). Now it has a front door wired into the platform journey:

  - **BuilderLanding** — pick or create a writable base package (writable bases lead,
    read-only code packages listed for browsing), then jump into the full-screen pillar
    builder. Served standalone at bare **`/studio`** (bookmarkable) and embeddable via
    the **`studio:builder`** component ref, which the framework's Studio app references
    from its new 「App Builder」 nav entry — so the journey is: login → Home → Studio →
    App Builder → package → build.
  - `/studio/:packageId` now lands on **`data`** (the pillar order's first surface)
    instead of `interfaces`.
  - Package-list parsing/creation is extracted to `packages-io` and shared by the
    landing and the top-bar package switcher.

- 5ba3d0e: feat(studio): WYSIWYG form-layout designer in the Data pillar

  The Data pillar's Form view gains a **布局 (Layout)** designer: the object's default
  form rendered WYSIWYG, where an admin adds **sections**, drag-reorders fields within
  a section and drags them **across** sections, and clicks a field to edit it in the
  **same** protocol inspector the grid uses — one screen, no Data↔Interface switch.

  Sections persist as the object's `fieldGroups`, and membership/order as `field.group`
  plus field order, via the existing draft → publish. The drag/section chrome (dnd-kit)
  is the only new code; the data model and all mutations reuse the existing, tested
  `object-fields-io` helpers (`readGroups`/`addGroup`/`renameGroup`/`removeGroup`/
  `moveGroup`/`clearFieldGroup`/`groupEntries`).

  Also fixes the Data pillar clobbering an in-progress draft when the metadata client
  identity churned (e.g. toggling the live preview): the object baseline is now loaded
  exactly once per selected object.

- c0164ad: fix(studio): surface spec-validation failures on the field at save/publish

  When a Studio metadata draft failed spec validation, the designer got a single
  opaque banner (and, on a partial publish, a false "published!" toast) — the
  server was already returning field-anchored issues, but the client threw them
  away. Two problems, both fixed:

  - **`parseError` (data-objectstack)** read `String(body.error)`, which yields
    `"[object Object]"` for the dispatcher's object-shaped error, and ignored the
    validation `issues`. It now reads the message from either shape (string or
    `{ message }`) and exposes `MetadataError.issues`, accepting all live server
    shapes — top-level `body.issues` (REST server) and `error.details.issues`
    (HTTP dispatcher).

  - **Studio save/publish (app-shell)** now render those issues **field-anchored**.
    A new `formatMetadataError` helper turns a caught error into one line per
    offending field (`• fields.amount.type — Invalid option: …`); the save banners
    render it with `whitespace-pre-line`. `doPublish` no longer claims success when
    the response carries `data.failed[]` — it lists which drafts failed and why
    (the server returns 200 with the failures buried, so the UI used to swallow
    them). `formatPublishFailures` formats those per-draft.

  Verified end-to-end against a live backend: an invalid object draft returns 422
  with field-anchored issues, and the Studio banner shows
  `• fields.amount.type — Invalid option: expected one of "text"|…` instead of a
  generic message. Unit-tested: `parseError` on the dispatcher shape, and the
  `formatMetadataError` / `formatPublishFailures` helpers.

- 7034306: fix(studio): Interfaces designs the CURRENT package's app, not another's

  The Interfaces pillar resolved its app with an unscoped `list('app')` and a
  client-side `.find()` by package — but list rows carry no `packageId`, so the
  match never hit and it fell through to `?? apps[0]`, the first app in the whole
  system. Opening `/studio/<pkg>/interfaces` for a package with no app therefore
  rendered a **different** package's navigation tree (e.g. `showcase_app`), and a
  package that genuinely had no app was stuck on an endless "加载中…".

  Now the query is scoped to the package (`list('app', { packageId })`, matching
  the header's own resolution) with no cross-package fallback; a freshly-created
  (still-draft) app is picked up via `listDrafts({ packageId, type: 'app' })` so it
  stays designable before its first publish. When the package has no app, the nav
  rail and canvas show a real empty state ("这个软件包还没有应用") with a 创建应用
  action wired to the header's existing create flow, and edit mode now renders the
  nav canvas even on an empty tree so the first item can be added.

- 34accfc: fix(studio): close the three journey dead-ends found in UX review

  - **Navigation**: the standalone `/studio` landing gets a slim frame with an
    ObjectOS wordmark → Home, and the builder top bar gets a Home button — the
    builder is no longer a browser-back-only dead end.
  - **Fresh-package empty state**: an empty writable package no longer shows an
    endless 加载中… — the rail says 还没有对象, the main pane explains the first
    act (从第一个对象开始), and the object creator auto-opens.
  - **创建应用 on-ramp**: when the package ships no app, the top-bar bridge slot
    offers 创建应用 (draft `app` item, name + identifier popover) instead of
    nothing; after creation it shows 应用「…」待发布, and flips to 打开应用 once
    the package publish lands.

- 65efc01: feat(studio): package-level draft publish (replaces per-item publish)

  The pillar Studio now publishes at the **package** level, not item-by-item. Edits
  across Data / Automation / Interface accumulate as per-item **drafts**; the top bar
  shows a pending-draft **count**, a **变更** (Changes) review, and one **发布** that
  publishes **all** pending drafts in a single governed pass — reusing
  `usePublishAllDrafts` (per-package `publish-drafts` with structure-before-seeds + the
  ADR-0038 L3 probes, and by-reference for orphan / null-package drafts).

  - The per-pillar **发布** buttons are removed; **保存草稿** stays (drafts accumulate).
  - The Data grid's drag-reorder no longer **auto-publishes** — it saves a draft like
    every other edit, so nothing goes live outside the one package publish.
  - After a publish, pillars re-read the fresh published baseline (a publish nonce),
    and a draft-save refreshes the pending count.

- d8b9547: feat(studio): package switcher + inline "new writable package" in the top bar

  The pillar Studio's top-bar package name becomes a **switcher**: it lists the app's
  packages (kernel/system packages hidden), marks each **可写** (database base) or
  **只读** (code package — the ADR-0070 D4 gate refuses authoring into these), and
  switches by navigation. A **新建软件包** inline form creates a writable base
  (`POST /packages {id,name}` — 名称 + auto-derived, hand-editable package id) and
  jumps straight into its Data pillar.

  The current package also shows a proactive **只读** badge, so users learn the
  package is read-only _before_ hitting the save-time gate. Writability display is a
  heuristic (`scope: 'project'` = code, scope-less = base); the server-side gate stays
  the authority.

- 20c1695: Studio pillars now follow the app's active locale instead of hardcoding Chinese.
  `StudioDesignSurface` pinned `const locale = 'zh-CN'` in its Interfaces / Data /
  Automations pillars, so the builder always rendered Chinese even when the console
  ran in English (while the Home page and the rest of the app followed the active
  locale). Every inline string across the design surface — package switcher,
  publish/app-bridge header, the four pillars (Data, Automations, Interfaces,
  Access), and the nav-item inspector — is now extracted into the metadata-admin
  `engine.studio.*` catalog with English + Chinese entries, and a new
  `useMetadataLocale()` hook threads the live `useObjectTranslation().language`
  (the same source the LocaleSwitcher drives) so switching the console language
  re-renders the Studio in lock-step. `AppNavCanvas` (used by the Studio and the
  metadata-admin App preview) is likewise localized via `engine.appNav.*` — its
  previously hardcoded English "NAVIGATION", "Add nav item", "Remove nav item", and
  empty-state strings now follow the active locale.
- 00e7735: fix(studio): say what the Form preview shows — published definition, not the draft

  The Data pillar's Form view has two sub-modes: **布局** (the WYSIWYG layout designer,
  rendered from the draft) and **预览** (the live runtime ObjectForm). The preview
  renders the **published** definition on purpose — a draft with structural changes has
  no physical columns yet (DDL lands at publish), so a draft-with-data preview would
  break — but the UI never said so: after arranging a draft in 布局, switching to 预览
  silently showed the old shape, reading as "my changes are lost".

  Now the sub-mode captions state their source (布局 = 草稿 · 含未发布改动 / 预览 =
  已发布定义), and when unpublished changes exist the preview shows an amber note:
  confirm the draft in 布局, or publish (top bar) first to see the published effect.
  Publishing stays a deliberate user action — nothing auto-publishes.

- e84d64d: Block record-scoped toolbar actions launched with zero rows selected (#2210).

  A flow/script action that also mounts on list rows (`locations` includes
  `list_item`) has no record to run on when triggered from the list toolbar with
  nothing selected — pre-fix the wizard opened anyway, collected input, and died
  at its first record-bound node ("Update requires an ID or options.multi=true").
  The console runtime now blocks up front with "select a row first", mirroring
  the existing multi-selection guard. Pure object-level toolbar actions
  (`locations: ['list_toolbar']` only) keep triggering without a record.

  The action renderers (button/icon/menu/group) now forward the `locations`
  declaration to the ActionRunner — previously it was dropped by their
  allow-list payloads, so the runtime could not tell the two shapes apart.

- 3106584: Warn when `userFilters` / `quickFilters` on an object list view are
  suppressed instead of dropping them silently (#2219).

  ADR-0053 correctly reserves those fields for page lists (InterfaceListPage
  "filters" mode) and suppresses them on the object default list, but until the
  phase-4 schema guardrail lands the author got zero signal — a valid schema
  and a toolbar with nothing where the filter controls should be. ObjectView
  now logs a one-shot warning per object/view naming the offending fields and
  where they belong.

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [bce581a]
- Updated dependencies [9cd9be1]
- Updated dependencies [5160832]
- Updated dependencies [69d6b94]
- Updated dependencies [c38d107]
- Updated dependencies [243a9ba]
- Updated dependencies [289be5b]
- Updated dependencies [7782698]
- Updated dependencies [19f2533]
- Updated dependencies [790558b]
- Updated dependencies [c0164ad]
- Updated dependencies [09e1b26]
- Updated dependencies [e84d64d]
  - @object-ui/types@11.4.0
  - @object-ui/components@11.4.0
  - @object-ui/fields@11.4.0
  - @object-ui/i18n@11.4.0
  - @object-ui/data-objectstack@11.4.0
  - @object-ui/auth@11.4.0
  - @object-ui/collaboration@11.4.0
  - @object-ui/core@11.4.0
  - @object-ui/layout@11.4.0
  - @object-ui/permissions@11.4.0
  - @object-ui/plugin-editor@11.4.0
  - @object-ui/providers@11.4.0
  - @object-ui/react@11.4.0

## 11.3.0

### Patch Changes

- ca4a795: fix(app-shell): restore admin design surface gated on the removed `user.role='admin'` overwrite

  ADR-0068 (a3a5abff8) stopped the server `customSession` from overwriting
  `user.role = 'admin'` for workspace owners/admins — canonical roles now arrive
  in `user.roles[]` (`org_owner` / `org_admin`) with `user.isPlatformAdmin` as a
  derived alias, and `useIsWorkspaceAdmin()` was introduced to read them. Four
  runtime views were missed in that migration and still gated their admin design
  tools on the now-defunct `user?.role === 'admin'`, so workspace owners/admins
  silently lost:

  - **ObjectView** — the list "+ New view" button plus rename/delete/pin/
    set-default/config/manage-views and the view config panel.
  - **PageView / DashboardView / ReportView** — the inline "Edit"/config entry
    points for the shared page / dashboard / report definitions.

  All four now call `useIsWorkspaceAdmin()` (same helper already adopted by
  AppSidebar, UnifiedSidebar, HomePage, Marketplace…). No behavior change for
  genuine platform admins; restores the surface for org owners/admins.

- Updated dependencies [d88c8ec]
- Updated dependencies [b7237bb]
- Updated dependencies [d23d6eb]
  - @object-ui/components@11.3.0
  - @object-ui/i18n@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/fields@11.3.0
  - @object-ui/layout@11.3.0
  - @object-ui/plugin-editor@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/data-objectstack@11.3.0
  - @object-ui/types@11.3.0
  - @object-ui/auth@11.3.0
  - @object-ui/permissions@11.3.0
  - @object-ui/collaboration@11.3.0
  - @object-ui/providers@11.3.0

## 11.2.0

### Minor Changes

- 490ba55: feat(cloud): state-aware onboarding next-step widget for the Cloud Welcome page

  The Cloud control-plane Welcome page is static SDUI, but the most useful thing it
  can show — "what do I do next?" — depends on live state the metadata can't carry:
  does the caller's org already have its production environment? New signups are
  auto-provisioned one, so a static "Step 1: create an environment" is wrong for
  most first-time users.

  Add `cloud:onboarding-next`, a registered SDUI widget that resolves
  `hasProductionEnv` from the same org-scoped `/cloud/environment-entitlements`
  endpoint the environment list uses, and renders the right primary action:

  - no production env → **Create your environment** (the real first step);
  - has production env → **Open Production** (full-page nav that follows the SSO
    302 into the env) + **Manage environments**;
  - loading → a neutral skeleton (no CTA flash / layout jump);
  - unknown / error → degrades to the open-production actions, so the button
    always works.

  Routes and the SSO endpoint come from the page metadata (`properties`), so the
  Cloud app owns its URLs and copy; the widget owns only the state logic.

- 32dbd6a: feat(detail): `relatedLayout: 'tabs'` — surface related tables as peer tabs via config

  Record detail pages can now show each related table as its own top-level tab
  instead of stacking them all inside a single **Related** tab — no custom page
  required. Set `detail.relatedLayout: 'tabs'` on the object; the synthesized
  record page then emits one tab per related list (label = the related list's
  `title`, falling back to its `objectName`, carrying its `icon`), slotted between
  the **Details** tab and **Activity** / **History**.

  - `buildDefaultPageSchema` (`@object-ui/plugin-detail`): new
    `BuildPageOptions.relatedLayout?: 'stack' | 'tabs'` threaded through
    `buildDefaultTabs` (the single choke point for the related-tab emission).
    `'tabs'` fans the related children out into peer tabs; `'stack'` (default)
    keeps the legacy single **Related** tab — **zero regression** when omitted.
    Still honours `hideRelatedTab` (no related tabs emitted) in both modes.
  - `RecordDetailView` (`@object-ui/app-shell`): reads
    `objectDef.detail.relatedLayout` per object and forwards it to the synth.

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/components@11.2.0
  - @object-ui/core@11.2.0
  - @object-ui/fields@11.2.0
  - @object-ui/layout@11.2.0
  - @object-ui/plugin-editor@11.2.0
  - @object-ui/data-objectstack@11.2.0
  - @object-ui/react@11.2.0
  - @object-ui/types@11.2.0
  - @object-ui/i18n@11.2.0
  - @object-ui/auth@11.2.0
  - @object-ui/permissions@11.2.0
  - @object-ui/collaboration@11.2.0
  - @object-ui/providers@11.2.0

## 11.1.0

### Minor Changes

- 6fb6738: Auth: remediation overlay for the ADR-0069 session gate (enforced MFA / password expiry)

  The ObjectStack backend now blocks logged-in users from protected resources with `403 { error: { code: 'MFA_REQUIRED' | 'PASSWORD_EXPIRED' } }`. The Console now detects this on every API response and raises a full-screen, guided remediation flow instead of leaving the user on failing requests.

  - `@object-ui/auth`: the authenticated fetch wrapper detects the gate and broadcasts it via a tiny module-level emitter; `AuthProvider` exposes `remediationRequired` + `setRemediationRequired`; the `twoFactorClient` plugin is enabled and `enrollTotp` / `verifyTotp` are added to the auth client (`changePassword` already existed).
  - `@object-ui/app-shell`: a `RemediationOverlay` (mounted in `ConsoleShell`) renders the guided flow — change an expired password, or enrol an authenticator (password confirm → QR + backup codes → verify TOTP) — then reloads so the app re-fetches cleanly. Auth + metadata + `me/*` reads stay reachable (server allow-list), so the overlay renders above a normally-loading shell.

### Patch Changes

- e2c9b0d: fix(first-run): two first-time-user friction fixes found via a full ObjectOS Cloud signup walkthrough.

  - **Page-load race**: an app whose landing is a `type:'page'` (SDUI page) flashed a false "page not found" / blank body on the very first render — `PageView` treated the lazily-loading (empty) `pages` array as "page doesn't exist". It now shows a loading state until the `page` metadata type is actually resolved (`getTypeStatus('page')`), then trusts the not-found. This is exactly the post-signup landing, where the app's home page is the first thing rendered.
  - **Redundant launcher hop**: after creating/switching a workspace, the user was hard-reloaded to `/home` (the workspace launcher) even when the workspace has a single app — an extra, contentless layer. `OrganizationsPage` and `WorkspaceSwitcher` now reload to the console ROOT (`resolveRootUrl`), so `RootLandingRedirect` resolves the right landing: a single-app workspace lands straight IN that app; multi-app workspaces still fall back to `/home`.

- 6726a2b: First-run UX polish (objectstack-ai/objectui#2038) — copy improvements found via the ObjectOS Cloud signup walkthrough:

  - **"Organization" → "Workspace"** across the org picker (`organizations.*` strings, en + zh). The create flow + WorkspaceSwitcher already say "workspace"; the picker ("Your Organizations / No organizations yet") was the lone holdout. Now consistent.
  - **Non-admin empty state** — "There are no applications available to you yet. Please contact your workspace administrator." → "Your workspace is being set up — apps your admin shares with you will show up here." (less dead-end, en + zh).
  - **Cold-start reassurance** — new `console.loadingHint` line under the LoadingScreen steps: "Setting up a new environment can take a few moments." (en + zh).
  - **Signup value-prop** — register subtitle "Enter your information to get started" → "Create your account to start building." (en + zh).

- 8e2223c: fix(home): the workspace empty-state title hardcoded "Welcome to ObjectUI" — a stale brand a first-time user sees on their empty `/home`. Read the product name from the runtime-config branding (`getRuntimeConfig().branding.productName`, server-pushed, fallback "ObjectOS") like LoadingScreen does, so it shows the deployment's real product (e.g. "Welcome to ObjectOS Cloud").
- Updated dependencies [6fb6738]
- Updated dependencies [6726a2b]
  - @object-ui/auth@11.1.0
  - @object-ui/i18n@11.1.0
  - @object-ui/components@11.1.0
  - @object-ui/fields@11.1.0
  - @object-ui/react@11.1.0
  - @object-ui/layout@11.1.0
  - @object-ui/plugin-editor@11.1.0
  - @object-ui/types@11.1.0
  - @object-ui/core@11.1.0
  - @object-ui/data-objectstack@11.1.0
  - @object-ui/permissions@11.1.0
  - @object-ui/collaboration@11.1.0
  - @object-ui/providers@11.1.0

## 7.3.0

### Patch Changes

- 17ae00c: feat(studio): remove the "Local / Custom" stopgap scope from the package selector (ADR-0070 D5)

  The package-scope selector no longer offers a synthetic "Local / Custom (this
  env)" entry (the `package_id = null` / `sys_metadata` orphan bucket from
  objectui#1946). That was a deliberate stopgap; ADR-0070 makes every
  runtime-authored item live in a writable **base**, the kernel rejects orphan
  creates (`writable_package_required`), and legacy orphans are adopted into a
  base via "Adopt loose items". With no authoring path producing orphans, the
  bucket has no reason to exist.

  - `buildPackageScopeOptions` now returns only writable bases (drops the appended
    sentinel); `isLocalScope` / `LOCAL_PACKAGE_ID` / `writableBaseOptions` and the
    inline `LOCAL_SCOPE_ID` in `ContextSelectors` are removed.
  - The create-flow and list/home scope filters simplify accordingly (a real base
    is always the active scope; never the null/local sentinel).
  - Read-side `sys_metadata` provenance handling (classifying a row as
    runtime-authored, artifact detection in the editor) is unchanged — the kernel
    still keeps `null` as a legacy read tag.

  Closes the D5 tail of #2278 (the migration tooling it depended on already
  shipped).

- Updated dependencies [788dbf9]
  - @object-ui/fields@7.3.0
  - @object-ui/types@7.3.0
  - @object-ui/core@7.3.0
  - @object-ui/i18n@7.3.0
  - @object-ui/react@7.3.0
  - @object-ui/components@7.3.0
  - @object-ui/layout@7.3.0
  - @object-ui/data-objectstack@7.3.0
  - @object-ui/auth@7.3.0
  - @object-ui/permissions@7.3.0
  - @object-ui/plugin-editor@7.3.0
  - @object-ui/collaboration@7.3.0
  - @object-ui/providers@7.3.0

## 7.2.0

### Minor Changes

- 88a3e39: feat(console): born-with-env eager provisioning for multi-org workspace create

  ObjectStack runs a 1-production-environment-per-organization model: a user who wants
  another production space creates another organization, and each org is born with its
  production environment. The self-service "create workspace" flow now delivers that
  without an onboarding-wizard detour.

  After `createOrganization` succeeds (which already switches the active org),
  `CreateWorkspaceDialog` eagerly `POST`s `/api/v1/cloud/environments` with the new org as
  target so its first environment is provisioned as a production env (allowed on every plan,
  including free), then hands off to the existing switch-and-navigate-home path. The
  provision is best-effort: on failure the onboarding gate provisions the env lazily on
  first navigation, so multi-org still works. The `multiOrgEnabled` enable-gate is unchanged
  (already wired end-to-end via the auth `/config` `features.multiOrgEnabled` flag).

  Adds a gated **"Create workspace"** entry to the org switcher (avatar dropdown) that
  opens the dialog directly — previously a single-org user could never reach it, because
  the only path (`/organizations`) auto-skips to home when you belong to exactly one org.
  The eager provision is idempotent: a control plane that auto-provisions the production
  env on org create resolves it to "already provisioned" rather than erroring.

  Also removes the unreferenced `apps/console` `CreateWorkspaceDialog` duplicate; the live
  component is the app-shell copy used by `OrganizationsPage`.

- e301475: feat(console): hide the AI surface at runtime when the server serves no AI agent (Community Edition)

  A self-host Community Edition runtime (framework + this MIT console, without the
  cloud `@objectstack/service-ai-studio` package) serves no `ask`/`build` agent.
  The console now hides every AI entry point via runtime, server-pushed gating —
  no build-time edition flag, no tree-shake.

  Crucially, gating is driven off the **agent catalog** (`GET /api/v1/ai/agents`),
  not the discovery `services.ai` flag: the open-source framework keeps a headless
  `@objectstack/service-ai` that still reports `services.ai` as available, so a CE
  runtime can report AI "available" while serving zero agents. The catalog is the
  real "is there an agent to answer?" signal.

  - New `useAiSurfaceEnabled()` hook + `RequireAiSurface` route guard (exported).
  - `/ai*` routes redirect to home when no agent is served; the FAB, top-bar AI
    link and the metadata designers' "Ask AI" buttons hide; `AiChatPage` shows a
    graceful "AI unavailable" state instead of an agent-less echo chat.
  - Fully additive for cloud installs — when an agent is served, every AI surface
    renders and works as before.

- 616157a: feat(studio): multi-hop relationship fields in the dataset designer (ADR-0071)

  The dataset designer's field catalog and Included-relationships picker now
  support multi-hop relationship paths (`account.owner.region`), matching the
  framework's multi-hop join support (ADR-0071 P2):

  - `useDatasetFieldCatalog` walks each included path hop-by-hop, fetching every
    object along the chain, so `path.field` options surface for fields two–three
    to-one hops deep (grouped under a chained `Account → Owner → User` heading).
  - The Included-relationships combo offers one level deeper along each
    already-included path (drill `account` → `account.owner`), capped at 3 hops.
  - The author-time "relationship not in Included" warning generalizes to the full
    relationship path (`account.owner`), with one-click "Add it".

  Single-hop datasets are unchanged.

- 6668759: feat(console): entitlement- & state-aware environment actions

  The `sys_environment` list now presents the right create affordance for the
  org's state (born-with-env) instead of POST-then-error:

  - **No production env** (historical orgs) → "Set up your production environment";
    the create POST provisions the org's one production env — this path never errors.
  - **Has prod env, free plan** → an "Add environment" button that opens a friendly
    upgrade prompt (CTA to billing) instead of POSTing into a 403.
  - **Has prod env, paid plan** → "Add development environment" creates a dev env.

  The action runtime's `apiHandler` now also turns the cloud env-create entitlement
  403s (`DEV_ENV_PLAN_LOCKED` / `DEV_ENV_LIMIT` / `PRODUCTION_ENV_LIMIT`) into a
  friendly upgrade/limit dialog with a CTA rather than a red error toast — a safety
  net that covers any path. State is resolved from the new org-scoped
  `GET /cloud/environment-entitlements` summary, with a row-derived `hasProductionEnv`
  fallback so the production-setup path works even against an older control plane.

- 41c60c4: Flow builder: variable data-picker for expression / template config fields. Expression and template surfaces (decision Branches, edge Condition, Assignment values, Screen description, CRUD field values / filter, subflow / script inputs) now show a "{x}" picker listing the references in scope at that node — flow variables, upstream node outputs, the trigger record's fields, and any enclosing loop item — resolved graph-aware by walking the flow back from the node. Selecting a reference inserts the correctly-braced token at the cursor (bare CEL in `expression` fields, `{var}` in template fields), handling the ADR-0032 brace-in-CEL trap for the author. Free-text typing is unchanged and an empty scope degrades to a plain input.
- d23db5c: feat(detail): related-list add-by-picker (generic m2m/junction) + a generic "Assigned Users" management UI on permission sets (assign ai_seat and any role with zero bespoke CRUD; server-side cap errors surface inline).

### Patch Changes

- 81ad9aa: feat(studio): package lifecycle UI — Duplicate base, Adopt loose items, structure-only delete (ADR-0070 D4/D5/D6)

  `PackageDetailSheet` gains the user-facing affordances for the package-as-
  lifecycle-unit work:
  - **Duplicate** → `POST /packages/:id/duplicate` (clone a base into a new
    writable package; D4).
  - **Adopt loose items** → `POST /packages/:id/adopt-orphans` (migrate every
    package-less orphan into this base; D5).
  - **Delete** now asks whether to drop records too (`?keepData`) — structure-only
    vs everything (D4 Q3).

  D6 guardrail test: the scope selector never defaults to the package-less
  `Local / Custom` sentinel (`writableBaseOptions` excludes it; real bases sort
  first).

- 4b1cb7a: feat(studio): package-first create flow — prompt or redirect to a writable base (ADR-0070 D3)

  Studio's create entry points no longer let a new metadata item land in a code
  package or the package-less "Local / Custom" bucket. ResourceListPage's create
  gate (`handleCreate`) now: opens the create-base dialog when no writable base
  exists; redirects into the first base when the active scope is Local/none but
  bases exist; otherwise proceeds normally. Adds package-scope helpers
  (`isLocalScope` / `writableBaseOptions`) with tests, surfaces the kernel's
  `writable_package_required` (422) as an actionable error in ResourceEditPage,
  and exports `CreatePackageDialog` from PackagesPage for reuse.

- 8c2191d: fix(console): polished, localized "Assigned Users" management for permission sets — resolves users to name/email (no raw id), zh/en localized, friendly inline cap message (drops the dev `[Tag]` prefix), people-rows with visible remove + add-via-picker.
- 6028192: fix(console): gate the AI surface on the access-filtered agent catalog (per-user), not the deployment-wide service-ai capability

  `useAiSurfaceEnabled` keys off `GET /api/v1/ai/agents` again (>= 1 agent → AI shows), reverting objectui#1992. The agent-catalog route is now access-filtered server-side (ADR-0049 / ADR-0068): it returns only the agents the caller may chat, so a user WITHOUT the per-user AI seat (`ai_seat`) gets an empty catalog and the whole AI surface (FAB, `/ai` routes, top-bar + designer "Ask AI") hides for them — instead of showing a control that 403s on click. The discovery `services.ai` flag is deployment-wide and cannot express per-user seating, so it is the wrong signal for the AI-seat gate. Community-Edition gating is unaffected: no service-ai → no agents → empty catalog → hidden.

- e575da0: fix(ai): stop the AI composer placeholder doubling to "Ask Ask…" for the Ask agent

  The composer placeholder is `Ask {agent}…`, which reads fine for most agents
  ("Ask Build…") but doubles to "Ask Ask…" for the data-query agent whose label is
  literally "Ask". The Ask agent now uses its purpose-built placeholder
  (`console.ai.askAnything` → "Ask anything…", already localized) instead. Found
  dogfooding the AI Ask flow.

- cde7502: fix(form): create/edit record modal now honors the object's default form view

  The "New <object>" modal (and the modal edit form) rendered every field from
  the raw object schema, in schema order — ignoring the curated sections + field
  selection/order defined in the object's default FORM VIEW. Customizing the form
  view (section grouping, field selection/order) had no effect on the create
  modal; only `tabbed` views were partially honored, while a `simple` view with
  curated sections was dropped entirely.

  New `resolveFormViewLayout(objectDef)` helper resolves the default form view
  (`objectDef.form ?? formViews.default`) into the modal's layout props (curated
  `sections`, `contentLayout: 'tabbed'`, and master-detail `subforms`), mirroring
  the full-screen `RecordFormPage`. It is wired into:

  - the global New/Edit `ModalForm` in `AppContent` (replacing the tabbed-only
    inline logic so `simple` sectioned views are honored too), and
  - `useActionModal` (action-opened forms), which previously passed no
    `fields`/`sections` and so fell back to the whole object schema.

  When the object declares no form view — or one without sections — the modal
  keeps its prior flat-field behavior. Frontend-only.

- 0d8dbda: fix(metadata-admin): dataset filter builder ignores incomplete conditions

  `groupToCondition` emitted a condition for any row that had a `field`, even when
  its value was still blank — producing a silently-wrong filter like
  `{ organization_id: { $eq: "" } }` (matches only empty → excludes everything)
  instead of "no filter". Now rows with an empty/`undefined`/`[]` value are skipped
  (value-less operators like is-empty / is-not-empty are still kept). Applies to both
  the dataset Scope filter and per-measure filters. Found by dogfooding.

- e8c1c85: fix(metadata-admin): re-base a dataset when its base object changes

  A dataset's joins (`include`), dimensions, measures, and filter all reference the
  base object's fields. Changing the base object left those referencing the OLD
  object — stale field refs that silently produce broken/ambiguous queries. Now a
  real object change clears the object-dependent config (selecting the same object
  is a no-op), and a heads-up note appears while there is config that a change would
  clear. Found by dogfooding (G1).

- 0119ff4: Designer derives create defaults from the spec's create seed (/meta/types)

  The metadata create flow now builds a new item's body from the server's authoritative `createSeed` (delivered per type on the `/meta/types` registry entry — the single source of truth in `@objectstack/spec`) instead of the locally hardcoded `createDefaults`, falling back to `createDefaults` when the server provides no seed (older server, or canvas-create types). This closes the drift loop behind the "designer emits a minimal shape the spec rejects → create→save 422" family (dashboard `layout`, action `body`): the structural create defaults now come from the same place the spec validates against, so they cannot diverge. Extracted as the pure, unit-tested `buildCreateModeBody`.

- 8e7c1da: fix(preview): draft-preview bar no longer demands a redundant Publish when nothing is pending

  Under the auto-publish posture an AI build leaves zero pending drafts, yet opening a
  draft preview still showed "Draft preview — Nothing here is live until you publish."
  alongside "Changes (0)" and a Publish button — a self-contradicting, no-op call to
  action. `DraftPreviewBar` now reflects the real pending-draft count: when it is
  known to be zero the bar softens to a neutral preview indicator and drops the
  Publish/Changes affordances; an unknown count (still loading / fetch failed) keeps
  the publish path. `HomePage` (count-gated) and `RuntimeDraftBar` (draft-gated)
  already behaved this way — this aligns the third surface.

- 522a54c: feat(studio): make the flow-canvas error banner clickable

  The inline structural-error banner (ADR-0044 cycle surfacing) is now driven by
  the unified `problems` list, and each row with a concrete target is clickable —
  clicking it selects and pans-to-reveal the offending node/edge (the same reveal
  the Problems panel performs). So the always-visible banner is actionable without
  opening the panel. Drops the now-redundant `validationErrors` string prop: the
  banner, the Problems panel, and the on-canvas badges all share one source.

- cdc6246: Flow builder (#1934): expression problems — ADR-0032 brace/shape errors and scope-aware "unknown reference" warnings — now also surface in the flow **Problems panel** and as on-canvas **node/edge badges** (#1972), not just inline in the inspector. A `{record.x}` brace-in-CEL mistake or a typo'd variable is now visible at the flow level without opening each node. The start node's bare trigger-record fields are excluded from the ref check to avoid false positives (the inline inspector check still covers them).
- 7fe2735: Flow builder data-picker (#1934): the cursor-insertion math is extracted into a pure `insertToken` helper with unit tests (alongside `formatToken`) — bare CEL vs `{var}` template insertion, append / mid-string / selection-replace, and clamping a reversed or out-of-range selection. Pure refactor, no behavior change.
- 3f529a8: refactor(studio): derive the flow red-error highlight from the unified problem list (one validateFlowDraft pass)

  Follow-up to #1972 (Problems panel + badges) and #1976 (clickable banner). The
  flow preview still ran `validateFlowDraft` twice per render — once in
  `buildFlowProblems` (badges / banner / panel) and again in a separate memo that
  derived the red node/edge ring/stroke — with the cycle-highlight logic duplicated
  between them.

  `buildFlowProblems` is now the single validation pass: a new
  `deriveInvalidElements(problems)` produces the red error set (errors only; a
  cycle paints its whole loop via a per-problem `highlight` set while its badge +
  reveal stay on the closing edge). The preview drops its second `validateFlowDraft`
  call. The clickable banner (#1976), badges, and panel are unchanged — all four
  surfaces now derive from one list, so they cannot drift.

- 0b9c96c: Flow builder data-picker follow-ups (#1934): (1) a scope-aware "unknown reference" warning pairs the picker with inline validation — a typed reference whose root isn't in scope at the node is flagged with a nearest-match "did you mean?" hint (conservative: root-only, skips function calls / string literals / runtime globals; non-blocking amber). (2) Assignment values authored in the array form `[{ variable, value }]` now render in the key/value editor (and get the picker) instead of falling back to Advanced JSON; the editor reads both the object-map and array shapes and preserves whichever was authored. (3) A script `code` body (JS/TS, not a `{var}` template) now inserts bare references via a `refMode` field override — `{x}` is a syntax error in a script.
- 47537fe: Flow builder data-picker (#1934): inline validation now also shows on the repeater surfaces that carry the picker — decision **Branches** expressions, screen field **"visible when"**, and key/value **values** — not just single fields. Each shows the ADR-0032 brace error (red) or a scope-aware "unknown reference" warning (amber) via a shared `FlowExprIssue` line. The trigger-record picker also offers `previous.<field>` references on update / change / before-update triggers.
- 17ba30d: feat(studio): on-canvas validation badges + a Problems panel for the flow builder

  Flow validation only surfaced as a top banner ("…N error(s)") that didn't point
  to the offending element — in a non-trivial flow you couldn't tell _which_ node
  or edge was wrong. The simulator's `validateFlowDraft` already detected the
  structural problems (no resolvable entry, unreachable nodes, a decision with no
  default branch, duplicate node ids, dangling edges, un-declared cycles); they
  just weren't shown on the canvas. This was a surfacing gap, not a detection one.

  The flow preview now:

  - renders an error / warning **badge** on each offending node and edge, with the
    issue message(s) as its tooltip;
  - adds a **Problems panel** listing every issue (structural + the server
    `_diagnostics` already attached to the layered record); clicking a row selects
    and reveals (pans to) the node/edge;
  - clears badges + rows as issues are resolved (everything derives from the live
    draft).

  `validateFlowDraft` now tags dangling-edge errors with their endpoints so they
  key to the offending connection, and a new `flow-problems` module maps both
  sources onto concrete canvas elements (node id / stable edge key). Server
  diagnostics reach the preview through a new optional `diagnostics` prop on
  `MetadataPreviewProps`.

- 104d181: fix(studio): flow wait-node inspector tolerates the loose `config` shape

  The wait-node property form read only the spec-canonical
  `waitEventConfig.{eventType,signalName,…}`, but the engine also accepts a looser
  `config.{eventType,…}` shape — which the canonical `showcase_budget_approval`
  (and AI-authored flows) use. So a showcase-shaped wait node opened in the
  designer showed blank "Wait for" / "Signal name" fields.

  Flow config fields gain an optional `fallbackPath`: reads fall back to it (so
  loose-shape wait nodes display, and dependent fields reveal), writes target the
  canonical path and prune the fallback (migrate-on-edit), and the fallback's
  config key is suppressed from the Advanced block. The `wait` fields now fall
  back to `config.*`, so the designer matches the engine's tolerance. Pairs with
  the ADR-0044 revise-loop authoring (#1954).

- 1fa5982: fix(studio): preview joined reports in the report editor (was "design blind")

  Found dogfooding report design in Studio as a business user. The report editor's
  live preview only rendered single dataset-bound reports — a `joined` report
  (which carries its data on `blocks`, with no top-level `dataset`) fell through to
  the "Bind a dataset to preview this report" empty state, so an author building a
  joined report saw nothing and designed blind.

  `ReportPreview` now renders a joined report (≥1 dataset-bound block) through the
  same runtime `ReportRenderer` (→ `DatasetReportRenderer`, which already stacks
  the blocks), keeping the preview pixel-equal with the runtime, and shows a
  joined-aware empty state ("Add a block…") when no block is bound yet.

- Updated dependencies [8e7c1da]
- Updated dependencies [cf746c9]
- Updated dependencies [d23db5c]
  - @object-ui/i18n@7.2.0
  - @object-ui/auth@7.2.0
  - @object-ui/types@7.2.0
  - @object-ui/components@7.2.0
  - @object-ui/fields@7.2.0
  - @object-ui/react@7.2.0
  - @object-ui/collaboration@7.2.0
  - @object-ui/core@7.2.0
  - @object-ui/data-objectstack@7.2.0
  - @object-ui/layout@7.2.0
  - @object-ui/permissions@7.2.0
  - @object-ui/plugin-editor@7.2.0
  - @object-ui/providers@7.2.0

## 7.1.0

### Minor Changes

- 7b5d0f0: Build-history timeline + revert UI for AI builds (ADR-0067)

  The unpublished-app banner gains a **History** button that opens a commit timeline (`GET /packages/:id/commits`): every change an AI build/edit landed, newest-first, with **Revert** per apply commit (`POST /packages/:id/commits/:cid/revert`). The history-not-confirm model — review the timeline and revert, instead of approving each publish.

  - `commitHistory.ts` — `fetchCommits` / `revertCommit` helpers.
  - `CommitTimeline.tsx` — slide-over panel (sibling of `DraftChangesPanel`).
  - `UnpublishedAppBar` — History button + timeline mount (package-scoped).

- 7cd950e: feat(metadata-admin): dataset create opens the rich designer + dual-axis preview

  - **Create → rich designer.** `dataset` joins `object` / `report` in
    `CREATE_MODE_CANVAS_TYPES`, so "New dataset" opens the structured designer
    (base-object picker, joins, dimension/measure editors, live preview) instead
    of the degraded generic SchemaForm. `DatasetDefaultInspector` gains a
    create-mode **Name** field that auto-derives a snake_case identifier from the
    label until edited (mirrors `ReportDefaultInspector` / `ObjectDefaultInspector`),
    so a dataset created through the canvas saves with a valid identity instead of
    dead-ending.
  - **Mixed-scale preview.** When a dataset preview mixes a ratio/percent measure
    (e.g. `utilization`, `0.0%`) with magnitude measures (currency in the
    hundred-thousands), the ratio measures now plot as a line on a secondary
    (right) Y axis via the existing `combo` chart — they're no longer crushed to an
    invisible sliver beside the large bars. Same-scale selections stay a plain bar
    chart.

- fccebfe: feat(metadata-admin): visual filter authoring in the dataset designer

  The dataset designer gains a visual filter editor (reusing the shared
  `FilterBuilder`) for both the dataset-level **Scope filter** (`dataset.filter`)
  and per-measure **Filter** (`measure.filter`) — previously only settable via the
  raw Source/JSON tab. Both are backed by real runtime: the analytics executor ANDs
  the scope filter into every query and runs measure-scoped filters as supplementary
  grouped queries, so e.g. `won_amount = sum(amount) where stage = won` and an
  "exclude archived" dataset scope are now authorable without hand-writing JSON.

  A small, unit-tested converter bridges the builder's flat `{field, op, value}`
  group ⇄ the spec `FilterCondition` (Mongo-style `$and` / `$op`). Conditions it
  can't faithfully round-trip (nested groups, `$or`, multi-operator objects) are
  detected and shown as "edit in Source" rather than being silently rewritten.

- 0acf0c8: feat(metadata-admin): friendlier + safer dataset measure authoring

  The `dataset` designer's measure editor gets three improvements so a business
  user can author measures without spec knowledge and without saving a broken
  dataset:

  - **Display-format picker** — replaces the raw `format` / `currency` numeral
    text inputs with a structured Kind (Raw / Number / Currency / Percent) +
    Decimals + Currency selection and a live sample (e.g. `US$1,234.50`). Parses
    an existing format string back into the picker, so editing an existing measure
    round-trips.
  - **Auto-name from field** — picking a dimension/measure field when the row is
    still unnamed defaults the name to the field's leaf (`account.region` →
    `region`).
  - **Author-time validation** — a `relationship.field` dimension/measure whose
    relationship isn't in `include` now shows an inline warning with a one-click
    "Add it", catching at design time the "relationship not declared in include"
    error that previously only surfaced when the live preview query ran. A derived
    measure with too few operands is flagged too.

- 3e1fcf5: feat(chatbot): reveal the Build/Ask switcher in the app floating assistant when AI dev is unlocked

  The bottom-right FAB assistant bound each app to a single agent and hid the
  agent picker unless `VITE_AI_SHOW_AGENT_PICKER` was set, so a user on an
  AI-unlocked environment could not switch from `ask` (read-only data/query) to
  `build` (authoring) without leaving for the full `/ai` page.

  The picker now auto-reveals when AI development is unlocked for the viewer — the
  live agent catalog serves BOTH an `ask` and a `build` agent (alias-aware, so
  legacy `data_chat`/`metadata_assistant` count) AND authoring isn't
  deployment-disabled (`aiStudio`). Pure end-user apps (only `ask`) stay clean and
  never see a picker. An explicit `showAgentPicker` prop or
  `VITE_AI_SHOW_AGENT_PICKER` still forces it on.

- e2b0072: Flow builder: live preview for Screen nodes (#1944)

  Screen-flow nodes were authored blind — there was no way to see the form an end user would get, and the Debug simulator showed only `paused` when it reached a screen. Add a live preview that renders the screen exactly as it runs.

  The runtime `FlowRunner`'s screen body (flat input fields + object-form mode) is extracted into a shared `ScreenView`, so the preview reuses the **same** renderer as runtime and can't drift (the design↔runtime divergence #1927 fixed). A new `ScreenPreview` builds a `ScreenSpec` from the node's authored `config` and feeds it to `ScreenView`.

  - Reflects `title`, `description` (with `{var}` interpolation), input `fields`, and object-form mode (`objectName` / `mode` / `defaults`, rendered via `plugin-form`'s `ObjectForm`).
  - Updates live as the node config changes.
  - Two homes: the **flow node inspector** (interpolates against the flow's declared variable defaults) and the **Debug simulator** when paused at a screen (interpolates against the live simulated run state, replacing the bare `paused`).

- 780cabc: feat(studio): add a "Local / Custom (this env)" scope to the package selector

  In a self-hosted, metadata-customizable environment (single-tenant — no org
  dimension), the package selector only listed code packages, so metadata authored
  at runtime (`package_id = null` / `sys_metadata` provenance) was filtered out of
  every code-package view and became un-navigable — opening such an item redirected
  to "new". This complements framework #2252 + objectui #1937, which stop runtime
  metadata from being stamped into a loaded code package and keep it editable.

  - Surface a stable, always-present "Local / Custom (this env)" entry in the
    Studio package context-selector (`ContextSelectors`), mapped to the
    `sys_metadata` scope the metadata list/get API already understands.
  - Accept that scope in the metadata-admin pages (`StudioHomePage`,
    `DirectoryPage`, `ResourceListPage`) via a shared `buildPackageScopeOptions`
    helper, so it no longer redirects, and the list shows this environment's
    runtime-authored items (`package_id = null`).
  - On the Studio home grid, the Local scope shows every runtime-creatable type so
    the user can start authoring locally even with zero items yet.

- 93cf2b1: feat(studio): preview record pages against a real sample record

  The Studio page editor's Preview tab rendered a `type: 'record'` page's
  `record:*` blocks (details / highlights / path / alert / quick_actions) as the
  "bind a record to preview" placeholder — the metadata editor has no record
  route, so the author designed blind.

  The preview now fetches a handful of real records of the bound object (with
  lookup / master_detail fields `$expand`ed so they show display names, not raw
  foreign-key IDs), auto-binds the first one, and wraps the canvas in a
  `<RecordContextProvider>` — mirroring the runtime `RecordDetailView`. A
  "Preview record" dropdown lets the author switch records, so `visible` CEL
  expressions (e.g. `record.status == 'in_review'`) and per-record field values
  re-render live.

### Patch Changes

- 68d82ae: New script action seeds a valid body; add create-roundtrip conformance guard

  A new action defaults to `type: 'script'`, which the spec requires to carry an executable `body` or `target` — the create form seeded neither, so "New action → Save" failed validation (422). Seed a no-op L2 body in `createDefaults` so the default create round-trips. Adds a conformance guard that asserts every authorable type's default create-form output passes spec validation (catches the "designer minimal shape ≠ spec required" family before it ships).

- aae8791: Flow Screen preview: render inline master-detail subforms (follow-up to #1944)

  The object-form mode of the Screen-node preview now renders inline master-detail
  child grids, matching runtime. `ScreenPreview` feeds the SAME enriched object
  list the runtime `FlowRunner` uses (`useMetadata().objects`, which derives
  `form.subforms` from `inlineEdit` relationships via `attachInlineSubforms`), so
  e.g. a `showcase_invoice` object-form step previews its **Line Items** grid
  (with live Subtotal/Tax/Total) — only fetched in object-form mode.

  To keep the preview non-persisting — consistent with the flat-field preview
  (disabled Submit) and the simple object-form preview (no Save) — `MasterDetailForm`
  now honours a `showSubmit` flag (default shown; backward-compatible) that
  `ObjectForm` forwards, so the preview hides the master-detail Save bar. Also drops
  a dead `e = formData` assignment in `ObjectForm` (lint `no-useless-assignment`).

- 4014bc9: Flow Screen preview: gate fields by `visibleWhen` (follow-up to #1944)

  The Screen-node preview now evaluates each input field's `visibleWhen` against
  the active variables — reusing the simulator's own condition evaluator
  (`evalCondition`), normalising `{var}` placeholders to bare identifiers — so it
  hides/shows conditional fields exactly as the runtime `screen` executor does
  (which filters server-side before emitting the `ScreenSpec`).

  - Debug simulator (live run state): gates faithfully, e.g. a screen whose
    `opportunityName`/`opportunityAmount` are `visibleWhen: "{createOpportunity} == true"`
    hides them while `createOpportunity` is false.
  - Inspector (no run state): fails open — an unparseable or not-yet-decidable
    condition keeps the field visible, so configured fields are never hidden on
    missing data — and a footnote reports how many fields are gated out.

- d27f045: fix(metadata-admin): remove the unwired "Certified" measure toggle from the dataset designer

  `measure.certified` is dead in the spec liveness ledger (declared but read by
  nothing — no certifier authority, no provenance, not surfaced at point-of-use).
  A self-asserted checkbox the dataset author flips on their own work isn't
  certification — it's a fake trust signal. Drop the toggle (and the create
  default) until real metric governance exists (separate `dataset.certify`
  authority + `certifiedBy`/`certifiedAt` + a badge where reports pick measures).
  The spec field stays (dormant, liveness=dead) so existing data is untouched.

- d23ed60: feat(studio): author the approval revise loop in the flow designer (ADR-0044)

  The ADR-0044 send-back-for-revision loop — an approval node's `revise` out-edge to a wait point, closed by a declared `type: 'back'` edge re-entering the approval (round N+1) — was previously reachable only by hand-editing flow JSON. The flow designer now authors it visually:

  - **Revise branch** — an approval out-edge offers `approve` / `reject` / `revise` via a new Approval-branch picker in the edge inspector; `maxRevisions` surfaces on the approval node's property form (from the engine's published configSchema when online, with a hardcoded fallback offline).
  - **Back-edge authoring** — a new Connection-type select marks an edge as `back` (also `fault` / `conditional`). A back-edge renders distinctly on the canvas as a dashed amber return arc and is excluded from the layered auto-layout (exactly as the engine excludes it from DAG validation), so the loop reads top-to-bottom instead of dragging its target node below the wait point.
  - **Client-side DAG validation** — the simulator's preflight now flags an UNmarked cycle as an error (the graph minus declared back-edges must be a DAG, mirroring `registerFlow`), while a declared revise loop passes and a self-loop is caught.
  - **One-click "add revision loop"** — an amber affordance on an approval node drops the signal `wait` node + the `revise` edge + the declared `back` edge in a single gesture, reproducing the canonical `showcase_budget_approval` shape.

  Refs framework#1770. Follows the flow-builder work in #1927 and #1930.

- 47c6e25: fix(studio/flow): wire decision branches to edges, expand screen config, align simulator with engine

  Four fixes for the Studio Flow Builder, found dogfooding it as a business user:

  - **Decision branches now route.** The "Branches" editor wrote `node.config.conditions`
    but never the outgoing edges, so a decision built entirely in Studio left every
    out-edge unconditional — the engine and simulator (which branch on `edge.condition`)
    ran _all_ branches. Branches now mirror onto the node's out-edges (by order):
    `FlowCanvas.addNode` carries the matching branch onto a newly-connected edge, and
    `FlowNodeInspector` re-syncs existing edges when branches are edited (a `true`
    expression marks the default/else edge).
  - **Screen node config expanded.** The form exposed only `fields`; it now also edits
    `title`, `description` (interpolates `{var}`), `waitForInput`, and the object-form
    keys (`objectName`, `idVariable`, `mode`, `defaults`) — so a message screen or an
    object-form wizard step no longer requires dropping to Advanced JSON.
  - **Simulator applies assignment nodes.** Assignment was a no-op pass-through, so a
    Debug run never reflected `Set variables`. It now normalizes the same shapes the
    engine accepts (`assignments` map/array + flat) and interpolates `{var}`.
  - **Simulator screen-pause parity.** The simulator paused on every screen; it now
    pauses only when the screen collects input (`fields`) or sets `waitForInput`,
    matching the engine's `shouldPause` — a field-less screen passes through.
  - **Palette HTTP de-duplicated.** The base palette hardcoded the deprecated
    `http_request` alias while the engine publishes the canonical `http`, showing
    two HTTP entries. The base now uses `http` (merging into one), aliased to the
    `http_request` config form so the inspector is unchanged.

- 4c2f910: feat(studio): surface flow validation errors inline on the canvas

  The flow designer's structural validation (an un-declared cycle, missing entry node, duplicate ids, dangling edges, …) was only visible in the Debug panel. It now surfaces **inline on the canvas**: an un-declared cycle paints its offending edges + nodes red — using the same `validateFlowDraft` the simulator preflight runs — and an error banner lists the messages, so the author sees a broken graph without opening Debug. Each edge that closes the cycle carries a tooltip pointing at the fix ("mark the edge that closes the loop as a back-edge"). A declared revise loop (ADR-0044 back-edge) is excluded from cycle detection and stays un-flagged.

  Follows #1954 (revise-loop authoring) and #1955 (simulating approval decisions).

- 1b3ccd1: feat(studio): simulate approval decisions in the flow debugger

  The designer-time flow simulator treated an `approval` node as a pass-through that fanned out to every out-edge at once — so an ADR-0044 revise loop couldn't be debugged: it walked approve / reject / revise simultaneously and hit the step ceiling on the back-edge.

  The simulator now models an approval as a durable pause (like `wait` / `screen`): it suspends at the node, and the Debug panel offers the node's out-edge labels (`approve` / `reject` / `revise`) as decision buttons. Resuming routes down ONLY the chosen branch — mirroring how the engine resumes a suspended approval by branch label — so a full revise loop is now walkable in the debugger: revise → wait → resubmit (back-edge) → round 2 → approve. An unmatched decision falls back to fanning out (mirroring the engine's label-fallback), logged so the author notices.

  Follows #1954 (ADR-0044 revise-loop authoring).

- 05584aa: feat(studio/flow): context-aware Start trigger fields + explicit decision-branch binding

  Two flow-builder UX improvements (follow-ups to the decision/screen/simulator fixes in #1927):

  - **Start node trigger fields are now context-aware.** The Start node showed `Object`
    and `Entry condition` (record-trigger config) even on screen / manual flows where
    they don't apply. They're now gated by the chosen `triggerType` — shown for record /
    schedule / webhook / event triggers, hidden for manual / unset (screen wizards). A
    field that already holds a value is never hidden, so existing flows are unaffected.
  - **Decision branches can be bound to edges explicitly.** Selecting a decision out-edge
    now shows a **Branch** picker listing the source decision's branches (label · condition,
    or "· default"). Picking one writes that branch's expression / label (or marks the
    default) onto the edge — so routing stays correct even when edges are connected out of
    branch order, instead of relying solely on the implicit by-order auto-wire. A
    "— Custom —" option preserves manual editing.

  Adds `flow-node-config.test.ts` covering the trigger-field gating.

- 44d4582: fix(studio): localize lookup picker config + keep published org objects editable

  - The lookup field's "Picker config" sub-panel (display/description field,
    selectable-records filters, depends-on, page size, quick-create) was
    hard-coded English in an otherwise-Chinese designer. Routed every literal
    through `t()`/`tFormat()` with new `designer.field.lookup.*` keys (en + zh).
  - A freshly-published org object read back as read-only: after publish its
    active version surfaces in the layered `code` slot tagged with the
    `sys_metadata` provenance sentinel, and `ResourceEditPage` treated any
    non-null `code` as a packaged artifact (needs `allowOrgOverride`, which the
    `object` type lacks). Mirror the server's `isArtifactBacked` — which excludes
    `_packageId === 'sys_metadata'` — so org-authored items stay editable.

- b419a7c: fix(studio): enable report authoring (create flow, chart render, dataset-aware inspector)

  Found dogfooding report design in Studio as a business user — you could not create a report at all, plus several follow-on gaps.

  - **Report create now uses the canvas + `ReportDefaultInspector`.** Only `object` was in `CREATE_MODE_CANVAS_TYPES`, so report-create fell back to a stale name-first form whose create-config (`objectName`, `columns: []`) predates the ADR-0021 dataset-bound model — saving failed server validation (_"a report needs `dataset` + `values`"_) with no field to fix it. Add `'report'` to the canvas set; the inspector exposes an auto-derived snake_case Name in create mode; fix the create-config (drop `objectName`/`columns`, seed `type: 'summary'` + `drilldown: true`).
  - **Preserve `?package=` on post-create navigation** — it was dropped, so the editor reloaded a blank draft in the user's default package.
  - **Render a report's embedded `chart`** in `DatasetReportRenderer` (authorable in Studio but never rendered) via the lazily-registered generic chart component; requests a non-animated render for export/background-tab safety.
  - **Dedicated Chart panel in the inspector** — chart type + dataset-aware X-Axis (dimension) / Y-Axis (measure) dropdowns + title, replacing free-text axis fields and the vague "Chart: Required text value" validation.

- 15f140d: Validation messages name the offending widget + field

  A nested Zod issue (e.g. `widgets.2.layout`) was shown as just its head field label — "Widgets: Invalid input" — so an author couldn't tell which widget or sub-field was at fault. `labelForIssuePath` now appends a readable trail, resolving each array index to the item's stable identity (id/name/title, incl. I18nLabel objects) from the draft: "Widgets → priority_split → layout". Single-segment paths are unchanged.

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0
  - @object-ui/react@7.1.0
  - @object-ui/auth@7.1.0
  - @object-ui/collaboration@7.1.0
  - @object-ui/components@7.1.0
  - @object-ui/data-objectstack@7.1.0
  - @object-ui/fields@7.1.0
  - @object-ui/layout@7.1.0
  - @object-ui/permissions@7.1.0
  - @object-ui/plugin-editor@7.1.0
  - @object-ui/providers@7.1.0
  - @object-ui/i18n@7.1.0

## 7.0.0

### Minor Changes

- a00e16d: feat: evaluate CEL `disabled` on action buttons + record-page Undo wiring

  - **components (page header)**: the `record_header` action toolbar now evaluates
    a CEL `disabled` predicate against the record (boolean was the only honoured
    form before), mirroring its existing `visible` evaluation. An action can now
    grey out conditionally (e.g. "Reassign" on a converted lead) instead of only
    hiding via `visible`.
  - **plugin-grid (row menu)**: `RowActionMenu` items likewise evaluate `disabled`
    (boolean or CEL against the row), and skip the click when disabled.
  - **components (action-button)**: forward `undoable` / `recordIdField` when
    executing, so undoable update actions keep their Undo affordance through the
    `action:button` path.
  - **app-shell (RecordDetailView)**: mount `useGlobalUndo` and wire the record
    action runtime's success toast to offer "Undo" for `undoable` actions
    (capturing the changed fields' prior values from the loaded record).
  - **plugin-detail (record:quick_actions)**: the widget's buttons now evaluate a
    CEL `disabled` and show a spinner + disable while running.

- 11ef5e3: Action modal transport with placement (SDUI opt #2).

  `useActionModal` provides a reusable `onModal` handler that renders an action's modal envelope in the right container by `placement`: `center` (Dialog), `side` (Sheet), `bottom` (Drawer), `fullscreen`. `content` is an arbitrary SchemaNode rendered via `SchemaRenderer`, so a modal action can open any page/form/list; string targets / `{objectName, mode}` keep opening a `ModalForm`. Wired into `RecordDetailView` so `type:'modal'` actions open client-side (previously routed to a server POST).

- f7f325d: feat: action progress state + Undo affordance

  - **core**: `ActionResult.undo` (an `UndoableOperation`) and `ActionDef.undoable`.
    On success the `ActionRunner` pushes the operation onto the global UndoManager
    and the success toast carries an "Undo" affordance (`ToastHandler` gains an
    `undo` option).
  - **app-shell**: the console action runtime mounts `useGlobalUndo` (Ctrl+Z /
    Ctrl+Shift+Z) and renders the toast's "Undo" button; its `apiHandler` resolves
    the row id from the list row record and, for `undoable` actions, captures the
    changed fields' prior values so the update can be reverted.
  - **plugin-detail**: record-header quick-action buttons show a spinner + disable
    while the action runs (a visible progress state for slow/flow actions).

- c12986e: Add resultDialog + target interpolation for one-shot action reveals

  Some platform actions return values the user MUST copy now because the
  server will not surface them again — 2FA TOTP URI + backup codes, freshly
  minted OAuth client_secret, regenerated recovery codes. Previously these
  had to ship as bespoke pages in `apps/account` because actions only
  emitted a fire-and-forget toast.

  **`@object-ui/core` — ActionRunner**

  - New `ActionDef.resultDialog: ResultDialogSpec` field. When set on a
    successful action, the runner suppresses the `successMessage` toast and
    awaits the registered `ResultDialogHandler` instead. Missing handler is
    non-fatal (logs a warning); rejected handler is treated as acknowledged.
  - New `setResultDialogHandler(handler)` setter.
  - New types: `ResultDialogSpec`, `ResultDialogFieldSpec`,
    `ResultDialogHandler`.
  - `executeUrl` and `executeAPI` now run `${param.X}` and `${ctx.X}`
    interpolation against `target` before fetching / navigating. Values are
    `encodeURIComponent`'d, missing keys resolve to empty string. `ctx`
    exposes `origin`, `user`, `org`, `recordId` by default; consumers can
    inject more via `context.ctx`.

  **`@object-ui/react`**

  - `ActionProvider` and `useActionRunner` both gained an `onResultDialog`
    option that wires straight through to the runner.

  **`@object-ui/app-shell`**

  - New `ActionResultDialog` component — promise-based, blocks click-outside
    and Escape (the user MUST click acknowledge), renders five field
    formats: `qrcode` (client-side via the `qrcode` package — never sent
    off-device, so 2FA URIs stay secret), `code-list`, `secret`, `text`,
    `json`. Falls back to `json` when a value's shape doesn't match its
    declared format.
  - `ObjectView` and `RecordDetailView` install the handler and mount the
    dialog automatically, so any action with `resultDialog` declared in
    metadata now works without code changes.
  - New dependency: `qrcode@^1.5.x` for client-side QR rendering.

  Pairs with the framework-side `Action.resultDialog` schema added in
  `@objectstack/spec` and the `sys_two_factor` / `sys_oauth_application` /
  `sys_account` updates in `@objectstack/platform-objects`.

- 0c95963: ADR-0021 single-form: dataset-native report editing + legacy report surface retired.

  - The Studio/runtime report inspector now edits the 9.0 dataset binding (dataset picker + values/rows selectors sourced from the dataset's semantic layer) instead of the removed objectName/columns query form.
  - plugin-report: the pre-9.0 query-form renderers (SpecReportGrid, MatrixRenderer, JoinedReportRenderer), the drill helpers, and the legacy authoring components (ReportBuilder, ReportConfigPanel, ColumnsEditor, GroupingsBuilder, JoinedBlocksEditor, FieldPickerDialog, ChartConfig, ScheduleConfig) are removed. ReportRenderer dispatches dataset-bound reports to DatasetReportRenderer; stored pre-9.0 spec JSON renders through the lossy specReportToPresentation → ReportViewer bridge until migrated.

- 1c25b56: ADR-0032: author-time condition validation in the flow inspectors.

  Flow node and edge condition editors now flag a malformed predicate **as you
  type** — most importantly the `{record.x}` template-brace-in-CEL mistake (#1491),
  which `{…}` parses as a CEL map literal and silently fails — with the same
  corrective message the build and the `validate_expression` agent tool emit.
  Client-side check for now (no CEL parser in the browser); swaps to
  `@objectstack/formula`'s shared `validateExpression` once it is published.

- 30ee761: feat(studio): surface pending drafts on the package detail (ADR-0033)

  After an AI builds an app, its objects/views land as drafts bound to the app package — but Studio's active-only browsers hid them, so the package looked empty and there was no obvious way to find what to review/publish.

  - `MetadataClient.listDrafts({ packageId?, type? })` calls the new `GET /api/v1/meta/_drafts` endpoint, returning pending draft headers (with `packageId`).
  - The package detail sheet (PackagesPage) now shows a **Pending changes** section listing each drafted item, each linking to the existing per-item review/diff (`?review=1`) so the user can publish it. A just-built app package is no longer shown as empty.

- 81c0777: feat(studio): ADR-0033 Phase B — draft review surface (chat → designer → generic diff)

  Closes the AI metadata-authoring loop in Studio. The framework (ADR-0033 Phases A + C) makes the assistant stage every change as a DRAFT; this lets a human see and review those drafts.

  **`@object-ui/plugin-chatbot`**

  - `mapMessages` now detects the framework's draft envelopes — `{ status:'drafted', type, name, … }` (single) and `{ status:'drafted', drafted:[{type,name}] }` (apply_blueprint batch) — and lifts the reviewable targets onto `ChatToolInvocation.draftReview` (mirrors the existing HITL `pendingActionId` path; the Vercel `{type:'text',value}` wrapper is peeled). `blueprint_proposed` is intentionally not surfaced (no draft yet).
  - `ChatbotEnhanced` renders a **"Review N change(s)"** button on drafted tool results, driven by a new `onReviewDraft` callback prop.

  **`@object-ui/app-shell`**

  - `assistantBus` gains a review channel (`requestReview` / `requestAssistantReview`); `ConsoleFloatingChatbot` wires the chat button to it; a small navigator inside `AppContent` (which knows the app base) routes to `/apps/:appName/metadata/:type/:name?review=1`.
  - `ResourceEditPage` honours `?review=1`: it force-reloads the pending draft (covers the case where the AI drafted the item after the page mounted) and opens the review/diff.
  - New **`DraftReviewPanel`** — a generic, type-agnostic draft↔published structural diff (added / changed / removed by key), reusing `LayeredDiff`'s `computeDiffRows`. It gives **every** metadata type (view, dashboard, flow, …) a real "what will publishing change" review, surfaced as a toolbar affordance + sheet whenever a draft exists. The object designer keeps its richer per-field review.

  Nothing is published by any of this — the human still clicks Publish.

- 672f854: feat(studio): add "Publish app" button to publish all package drafts (ADR-0033)

  The package detail's Pending changes section gains a primary **Publish app (N)** button that calls `POST /api/v1/packages/:id/publish-drafts` to promote every drafted item of the app in one shot, then refreshes the pending list. Complements the per-item review/publish links — so after an AI builds an app you can review item-by-item or publish the whole thing at once.

- 893e530: Package documentation portal + nav entry (ADR-0046).

  The `/docs/:name` viewer already existed but had no way in: no index and no
  navigation entry, so a doc was reachable only by typing its exact URL. Adds a
  platform-level docs portal at `/docs` (`DocsIndex`) that lists every installed
  `doc` metadata item grouped by package namespace, each linking to the existing
  viewer. A "Documentation" entry now appears in the home/system navigation
  (`UnifiedSidebar`), visible to all users (not gated behind workspace-admin), so
  docs are discoverable. The viewer route stays app-independent and
  single-coordinate (`/docs/<name>`); per-app deep-links remain opt-in `url` nav
  items pointing at that same global URL. Doc grouping is a pure, unit-tested
  helper (`groupDocsByPackage`).

- 053c948: feat: ADR-0047 — interface pages, visualization switcher, and Airtable-parity filters

  End-user interface/list pages reach full rendering and authoring parity:

  - **Spec tabs + visualization switcher** — `ObjectView` now forwards
    `viewDef.tabs` (stored/served but never rendered) and `viewDef.appearance`
    (`allowedVisualizations` whitelist), turning on the dormant `ViewSwitcher` when
    more than one type is whitelisted; effective options = author whitelist ∩
    capability-resolvable types (kanban needs `groupBy`, calendar a date field, …).
    `ListView` accepts the canonical `ViewFilterRule[]` tab-filter shape.
  - **User filters** — render only when `userFilters` is explicitly configured;
    selections (dropdown values + active tab) mirror into `uf_*` URL params and
    restore on load, so filtered lists survive reload and are shareable.
  - **Toolbar polish** — the visualization switcher becomes a compact right-side
    "Grid ▾" dropdown inside the tool cluster (no extra row); filter tabs and
    dropdown filters are mutually exclusive.
  - **Studio authoring** — a usable, schema-driven interface-page inspector
    (collapsible sections honoured, array-of-enum → multi-select, a None/Tabs/
    Dropdown `filter-mode` selector where None maps to ABSENCE of `userFilters`),
    and the Design/Preview tabs render the live list via `InterfaceListPage`
    (including a non-empty grid when the source view is hollow).

- 053c948: feat(app-shell): ADR-0048 (option A) — package-id app routing + prefer-local resolution

  Apps are now routed by their canonical package id rather than name:

  - **Resolution layer** — new `appRoute` helpers: `appRouteSegment(app)`
    (canonical link segment = package id, name fallback) and
    `matchAppBySegment(apps, seg)` (prefers `_packageId`, falls back to `name`).
    `AppContent` selects the active app via `matchAppBySegment`, so
    `/apps/<packageId>` resolves while `/apps/<appName>` keeps working (a per-tenant
    alias / legacy URL).
  - **Emission layer** — nav generates `/apps/<packageId>` links across app
    switching (AppSwitcher/AppSidebar/CommandPalette), sidebar base paths,
    create/edit-app, and the hidden-app switch, all via `appRouteSegment(app)`.
  - **Prefer-local resolution** — `preferLocal(list, name, ownerPackageId)` resolves
    a bare metadata name to the item whose `_packageId` matches the active app's
    package (falling back to first match), wired at PageView/DashboardView/
    ReportView and AppHeader so two installed packages can ship the same bare name.

- 053c948: feat(console/ai): AI workspace UX — date-grouped conversations, draggable split, keyboard shortcuts

  ChatGPT/Claude-parity polish for the console AI workspace:

  - **Date-grouped conversations** — the flat conversations list groups into
    recency sections (Today / Yesterday / Previous 7 days / Previous 30 days /
    Older) with calendar-day boundaries, via a pure exported
    `groupConversationsByDate()`.
  - **Draggable chat ↔ preview split** — a draggable, double-click-to-reset divider
    between chat and the Live Canvas preview; width persists to `localStorage`,
    clamped so neither pane collapses (chat ≥ 360px, preview ≥ 420px), keyboard-
    accessible (`role="separator"`, ←/→ resize).
  - **Collapsible conversations list** — auto-tucks when the preview opens, with a
    manual toggle.
  - **Keyboard shortcuts** — ⌘⇧O new chat, ⌘⇧S toggle the conversations list.

- 5c23088: **Wire `App.hidden` shell hint — App Switcher + avatar dropdown**

  Honour the new `App.hidden` field from `@objectstack/spec/ui`:

  - **`AppSwitcher.tsx`** — filter `app.hidden === true` out of the top-bar app dropdown so personal-settings-style apps don't appear next to business apps.
  - **`AppHeader.tsx`** — render hidden apps as entries in the avatar / user dropdown (immediately after the hardcoded Profile / Settings items). Uses the app's `icon` + `label` via the existing `getIcon` + `appLabel` utilities, and navigates to `/apps/${app.name}`.

  This is the front-end side of the Account-app split: the `account` app shipped by `@objectstack/platform-objects` declares `hidden: true` and now surfaces through the avatar menu — same pattern as GitHub Settings, Google account chip, and Salesforce Personal Settings.

  No new dependencies; pure metadata-driven wiring.

- 053c948: feat(app-shell): zero-roundtrip `newTabUrl` fast path for `opensInNewTab` actions

  Actions that declare `newTabUrl` (a path template with a `{recordId}` placeholder
  whose target endpoint performs all auth/authz itself) now drive the pre-opened
  popup straight to that URL on click, skipping the action POST entirely — applied
  to both server-action paths (list rows via `useConsoleActionRuntime`, record
  header via `RecordDetailView`). The popup paints the existing spinner page until
  the (possibly slow) endpoint commits its redirect; the URL is resolved absolute
  because `about:blank` gives a bare-relative href no reliable base. The
  popup-blocked toast fallback is unchanged. Removes one full round trip of
  white-screen latency from every such Open click.

- 05ff1fb: Studio: the "New page" form can now create a record page bound to an object.

  The page create form was identity-only (label/name/icon/description), so it couldn't make a `pageType: 'record'` page or bind it to an object — even though the page edit form and protocol schema fully support those fields. Mirror the `view` resource's create config: the page create form now exposes **Object**, **Page type** (default `record`), and **Kind** (`full`/`slotted`), so a record page can be created and bound in Studio (#1541). The block layout is then composed in the editor's PagePreview canvas.

- 7c956d0: Runtime persistence seam: add `'page'` artifact type (record-page draft/publish).

  `RuntimeArtifactType` now includes `'page'`, so a record `PageSchema` stages and publishes through the same ADR-0034 `/meta` draft model as views/reports/dashboards (#1541). New pure helpers `recordPageName(objectName, existing?)` (prefers an assigned page name, else mints `<object>_record`) and `recordPageEnvelope(objectName, schema, name?)` (sets the `name`/`object`/`pageType:'record'`/`kind:'full'` identity fields the resolver matches on) — foundation for the record-page edit loop.

- b0d64c4: Studio: new record pages seed their layout from the object's default detail page.

  Creating a `pageType: 'record'` page bound to an object previously started from a blank canvas. The `page` resource now has a `createSeed` hook that, on create, fetches the bound object and seeds the page's `regions` from `buildDefaultPageSchema(objectDef)` — the same auto-generated detail layout the runtime renders by default. Authors start by tweaking the default page, not rebuilding it. A generic async `createSeed` hook was added to `MetadataResourceConfig` (merged into the create body after `createBuildBody`/`createDefaults`; best-effort). Completes #1541's Studio authoring path.

- 80f9796: Repoint the Console bell to `sys_inbox_message` + `sys_notification_receipt` (ADR-0030)

  The notification bell read the legacy `sys_notification` object's
  `recipient_id`/`is_read`/`title`/`body` columns. ADR-0030 re-modeled
  `sys_notification` into the L2 _event_ (no recipient/read-state), so the bell
  returned nothing — every notification the new pipeline produced was invisible.

  The bell now reads the L5 in-app materialization instead:

  - **List**: `sys_inbox_message` filtered by `user_id` (the `mine` scope), 20
    most-recent, ordered by `created_at`.
  - **Read-state**: joins `sys_notification_receipt` (filtered by `user_id` +
    `channel:'inbox'`). A message is unread until its event has a
    `read`/`clicked`/`dismissed` receipt; the unread count drives the badge.
  - **Mark-read**: `UPDATE`s the existing `delivered` receipt to `read`
    (keyed `(notification_id, user_id, channel)`), inserting only as a fallback
    when no receipt exists. Replaces the old `sys_notification.is_read` write.
  - **Navigation**: follows the materialization's `action_url` (absolute,
    `/apps/...`, or app-relative `/{object}/{id}`), falling back to the legacy
    `source_object`/`source_id` pointer.
  - **"View all"**: routes to `/apps/setup/sys_inbox_message?view=mine`.

  Pairs with the framework ADR-0030 pipeline (`@objectstack/service-messaging`).
  Verified in-browser (showcase Console): a materialized inbox message + its
  `delivered` receipt lit the bell badge; the popover rendered the row;
  "mark all read" flipped the receipt to `read` in place (no duplicate) and
  cleared the badge.

- 5e8965c: Complete the page-editor block configuration and prune shell-only blocks. Adds configurable property panels for the remaining content blocks with authorable properties — `page:accordion`, `record:path`, `record:quick_actions`, `ai:chat_window`, `ai:input` — so every page-content block in the palette is configurable in the UI (pure containers like `page:section` / `element:divider` correctly have no panel). Removes shell-singleton blocks (`app:launcher`, `global:notifications`, `user:profile`) from the page block palette — those are provided by the app shell, not authored as page content.
- 94c58ad: Align the page-editor element palette with reality. Adds the real lightweight-list primitives — `element:definition-list` (compact key/value `<dl>`) and `element:repeater` (data-bound, chrome-free list) — to the block palette with full config panels (object/field pickers for the repeater), and removes three palette entries that have no renderer (`element:form`, `element:filter`, `element:record_picker`) so the palette only offers blocks that actually render.
- c681874: Expand page-editor block configuration. Adds configurable property panels for more blocks (`element:number`, `element:button`, `record:alert`) and introduces array-valued property editors — a `string-list` editor (e.g. `record:highlights` fields) and an add/remove `array` editor (e.g. `page:tabs` items, `record:details` sections) — so these blocks are configurable in the UI instead of only via raw JSON.
- d988090: Schema-driven object/field pickers in the page-editor block inspector. Data-reference block properties are now dropdowns populated from the live metadata instead of free-text: an object picker (e.g. `record:related_list` object, `element:number` object) and cascading field pickers that list the chosen object's actual fields (e.g. `record:related_list` relationship field, `element:number` field, `record:path` status field, `record:highlights`/`record:details` field lists). Resolves the object from the record page's bound object or a sibling block property; degrades gracefully to a text input when the metadata can't be fetched.
- 9049bbe: Add end-user friendly agent process summaries for chatbot tool calls, with a debug mode for raw reasoning and tool details. Console chat surfaces now keep a sanitized browser-side display cache so refreshes can restore user/assistant text plus grouped tool states when the backend returns no message rows.
- 77cc6bb: Cloud Connection bind v2 UX (cloud ADR runtime-identity-binding §2.3): the binding flow becomes one click. `CloudConnectionPanel` drops the environment-id input entirely (registration happens cloud-side at approval), auto-opens the approval page in a popup on Connect (user-code display stays as the popup-blocked fallback), and shows the registered runtime name + runtime id once bound. `DeviceAuthPage` displays the requesting device's context (`runtime_name` / `runtime_version` from the verification URL) plus an "only approve if you started this" warning — the informed-consent surface for the RFC 8628 flow. Two new `auth.device.*` keys across all locales.
- 0ca2040: `cloud-connection:panel` SDUI widget — the RFC 8628 device-code binding state machine for the metadata-driven Cloud Connection Setup page (shipped by `@objectstack/cloud-connection`). status → connect → user-code display + approval link → poll → bound/disconnect; the runtime credential never reaches the browser.
- 04e6168: SDUI: give PageView a console action runtime (#1605). Extract ObjectView's schema-action wiring into a reusable `useConsoleActionRuntime` hook (+ a `ConsoleActionRuntimeProvider` wrapper): confirm / param / result dialogs, the authenticated api / flow / server-action handlers, SPA navigation, the paused screen-flow runner, and a refresh callback. ObjectView now consumes the hook (behaviour unchanged), and PageView wraps its page schema in the runtime — so a page-level `action:button` can collect params, call authenticated API endpoints, show confirm/result dialogs, run screen flows, navigate the SPA, and invalidate embedded data after success. Pages run global (object-less) actions; the hook binds `objectName` only when one is present. This unblocks metadata-driven app home pages (e.g. a "Create environment" primary action) instead of bespoke React components.
- 39c89e7: ADR-0021 D2: true matrix cross-tab + dataset-path drill-down.

  - DatasetReportRenderer pivots `type: 'matrix'` reports into a real rows × columns cross-tab (one dataset query over all dimensions, pivoted client-side; matrix without `columns` degrades to the flat grouped table). Joined blocks pivot too.
  - Drill-down: aggregated rows / matrix cells are clickable when the host passes `onDrill` (and the report doesn't set `drilldown: false`), emitting `{dataset, groupKey, runtimeFilter}`. ReportView resolves the dataset's object + dimension→field mapping (reverse-mapping select option labels back to stored values) and navigates to the object list scoped by `?filter[field]=value`.
  - Studio: the report inspector gains a Columns (across dimensions) list for matrix reports; ReportPreview renders through the same DatasetReportRenderer as the runtime, so the matrix preview is WYSIWYG.

- 1c8f775: Add the External Datasource Federation Studio surface (ADR-0015 P5)

  Federated datasources (`schemaMode !== 'managed'`) now get a dedicated
  panel inside their Studio Preview tab, so connecting a mature external
  database and registering its tables as ObjectStack objects is a
  point-and-click flow instead of a CLI-only one. The panel pairs with the
  framework backend shipped in objectstack-ai/framework#1390
  (`registerExternalDatasourceRoutes` → `/api/v1/datasources/:name/external/*`).

  ObjectStack is metadata-driven: `datasource` is a metadata type, so it is
  browsed and edited through the standard metadata-admin engine
  (`metadata:resource`) reached from the Studio app's left-side menu —
  **not** a hand-written page. The Studio app (framework
  `packages/platform-objects/src/apps/studio.app.ts`, Integration group)
  gains a `Datasources` nav item pointing at
  `metadata:resource?type=datasource`; the federation panel is contributed
  to that standard surface via `registerMetadataPreview('datasource', …)`.

  **`@object-ui/app-shell` — `views/metadata-admin/external/`**

  - `api.ts` — a thin, typed REST client over the four federation routes
    (`tables`, `tables/:remote/draft`, `refresh-catalog`, `validate`) plus an
    `importObjectDraft` helper that PUTs a generated draft to `/meta/object`.
    All calls go through `createAuthenticatedFetch()` (Bearer + `X-Tenant-ID`
    - `Accept-Language`). A `503 external_service_unavailable` reply is mapped
      to a typed `ExternalServiceUnavailableError` so the UI shows a friendly
      "federation not enabled on this server" hint. Contract types are inlined
      (they were added in framework 7.3; objectui pins `@objectstack/spec`
      `^7.2.1`).
  - `SchemaBrowser` — lists remote tables (allowedSchemas-filtered server-side)
    with a text filter, on-demand Refresh (never a timer — warehouse
    introspection is expensive), and a per-table Import action.
  - `ImportObjectDialog` — generates an Object draft, surfaces the
    type-compat matrix's `// REVIEW:` columns and the generated `*.object.ts`
    source, then imports it as a real object. Never mutates the remote schema.
  - `ValidationPanel` — runs validation on demand and renders per-object
    structured schema diffs (missing column, type mismatch, …). Doubles as an
    on-demand drift view.
  - `ExternalDatasourcePanel` — Tables / Validation tabs plus a header strip
    with "Refresh catalog" and the snapshot timestamp.
  - `DatasourcePreview` — registered via `registerMetadataPreview('datasource', …)`,
    it renders the panel automatically inside the standard resource edit
    page's Preview tab when the saved datasource is federated
    (`schemaMode !== 'managed'`), keyed off the item name. This is the only
    wiring needed: no bespoke page, no extra route, no `@object-ui/app-shell`
    surface to re-export — the metadata-admin engine + left-side nav own the
    navigation. Federated datasources are read-only code artifacts (the
    `datasource` type forbids runtime create), which the standard list view
    already reflects (no "Create" button).

  Out of scope (blocked on backend follow-ups): the connection wizard
  (driver/credentials/secrets — belongs in System Settings) and a push-based
  drift inbox (needs an event feed). The framework exposes no
  test-connection, secrets, or drift-feed routes yet.

- d54346c: feat: action/flow completion messaging

  - **core**: `ActionResult.silent` — a handler sets it when the action only
    HANDED OFF to a follow-up UI (rather than completing), so `ActionRunner`
    skips the automatic success toast. Fixes the misleading "Action completed
    successfully" toast that fired the moment a `flow` action opened its wizard.
  - **app-shell**: both flow handlers now return `silent: true` when the flow
    pauses at a screen (the wizard only opened — it hasn't completed). `FlowRunner`
    renders the flow's declared `successMessage` / `errorMessage` (from the
    terminal `AutomationResult`) instead of a generic "Done" / the raw error.

- 12566ea: Flow designer ↔ automation engine alignment + run history panel.

  - **Palette/type-picker:** replace the BPMN `parallel_gateway` / `join_gateway`
    (and `boundary_event` in the picker) with the structured `parallel` and
    `try_catch` constructs the engine actually executes (ADR-0031 keeps the BPMN
    gateway types as import/export interop only — they have no executor, so
    flows authored with them failed at runtime with `NO_EXECUTOR`). Legacy
    gateway nodes still render for imported flows.
  - **Runs panel:** new `FlowRunsPanel` fetches `GET /api/v1/automation/{name}/runs`
    and surfaces run status / duration / per-node step logs in the FlowPreview
    side panel (Variables / Debug / Runs), degrading quietly when the engine is
    offline.
  - **Simulator:** structured containers (`parallel`, `try_catch`) pass through
    honestly as unsupported instead of faking their semantics.

- 4e060b7: Polish the Studio flow-designer canvas visuals

  A refinement pass over the metadata-admin flow designer (`FlowCanvas` +
  `flow-canvas-parts`) — purely presentational, no behavioral or API changes,
  theme-aware (light/dark), and still dependency-free.

  - **Node cards**: the flat 3px left-accent stripe is replaced by a tinted,
    color-coded **icon chip** (the card's primary category cue), with a bolder
    label, refined uppercase type caption, layered hover elevation
    (`-translate-y-0.5` + soft shadow), and clearer selected / run-state rings.
    Per-category `chip` tone tokens (soft bg + inset ring) added alongside the
    existing icon/accent/label tones. Added distinct tones for `loop` (sky),
    `screen`/`user_task` (pink) and `assignment` (purple) — previously they fell
    back to the generic slate "task" tone, so every node type now reads as a
    distinct color in the canvas.
  - **Readable labels**: node width 188→240 and the per-node summary moved from a
    right-hand column onto a second line, so the label now gets the **full card
    width** (it was badly truncated — "Manager Re…", "Budget Ab…"). A native title
    tooltip surfaces the full text on the rare remaining truncation.
  - **No overlap on add**: adding a connected node no longer pins it directly below
    its parent (which stacked every sibling on the same spot) — it's left to the
    layered auto-layout, which slots it beside its siblings.
  - **Canvas surface**: the dot grid now tracks pan **and** zoom (it moves with
    the diagram instead of floating behind a static texture), plus a subtle inset
    vignette for depth.
  - **Edges**: rounded line caps, slightly stronger default stroke, and
    pill-shaped (rounded-full, frosted) branch/condition labels.
  - **Toolbar + add-node palette**: frosted, rounded controls with a primary
    hover affordance; the palette gains an "Add node" header and matching tinted
    icon chips per row.

  Verified in-browser (Studio → flow → designer) in both light and dark themes.

- 5332639: feat(app-shell): render full object forms (incl. master-detail) in screen-flow wizard steps

  `FlowRunner` now renders an `object-form` screen step: when the paused screen
  carries `kind: 'object-form'`, it mounts the real `<ObjectForm>` for the named
  object (auto-routing to `MasterDetailForm` for inline child collections),
  prefilled from the step's `defaults`. The form persists itself (atomic
  master-detail batch), then resumes the run with the saved record id bound to the
  step's `idVariable`. `dataSource`/`objects` are threaded through all three
  `FlowRunner` mount points.

  Also fixes three pre-existing bugs this surfaced (each affects normal forms too):

  - **plugin-form**: `ObjectForm` now forwards `initialValues`/`initialData` when
    routing to `MasterDetailForm`, so prefilled header values are no longer
    dropped on master-detail create forms.
  - **fields**: `PercentField` treated values as `0–1` fractions (`value × 100`),
    so a `0–100` field (e.g. `probability` default `50`) rendered as `5000%` —
    exceeding `max=100`, which makes HTML5 constraint validation mark the field
    `:invalid` and silently block the whole form's submit. It now treats a field
    declaring `max > 1` as the `0–100` whole-number convention, matching the
    read-side formatter.
  - **data-objectstack**: `ObjectStackAdapter.batchTransaction` now sends
    `credentials: 'include'`, so master-detail batch saves authenticate under the
    console's cookie session (previously every batch save 401'd).

- e02aedd: Group the flow add-node palette by category, and offer every node type

  The quick-add palette listed 12 node types as a flat list; `assignment`,
  `screen`, `delete_record` and the parallel gateways could only be reached by
  adding a node and switching its type in the inspector. Building flows, that's a
  real friction point.

  - **Complete**: the palette now offers Delete record, Set variables
    (assignment), Screen, Parallel split and Parallel join too — so every common
    node type is one click away.
  - **Grouped**: items are organised into **Data / Logic / Human / Integration /
    Flow** sections with headers and dividers, so the (now longer) list stays
    scannable. A new `nodeCategory(type)` helper drives the grouping and gives
    engine-only / plugin-contributed node types a sensible section; `mergePalette`
    preserves a base item's category and infers one for engine-only types.

  Verified in-browser: the grouped palette renders all sections with tinted icon
  chips, and the newly-offered types add to the canvas with the correct icon/tone
  and no overlap.

- 7130d4e: Add FlowRunner — render & resume interactive screen-flows

  A `type: 'flow'` action whose run pauses at a `screen` node now opens a
  `FlowRunner` modal that renders the screen's fields, submits the values to the
  framework resume endpoint (`POST /api/v1/automation/{flow}/runs/{runId}/resume`),
  and advances to the next screen or closes + refreshes on completion. Previously
  such flows launched server-side but the screen was never rendered, so the input
  was never collected.

  - New `FlowRunner` component (fields → form → resume loop).
  - `ObjectView` + `RecordDetailView` flow handlers detect a paused-screen launch
    response (`{ status:'paused', runId, screen }`) and open the runner; for
    list_item actions the row's id (`_rowRecord.id`) flows in as the flow's
    `recordId`.

  Pairs with the framework screen-flow runtime (`@objectstack/service-automation`
  - `@objectstack/runtime`). Verified in-browser: showcase task row → "Reassign…"
    → form → submit → the task is reassigned.

- 3fa23a7: feat(header): context-aware Help & Documentation menu + app-scoped docs index

  The top-right "?" was a bare external link to `docs.objectstack.ai`, duplicating
  the left sidebar's in-product `/docs` entry and ignoring the ADR-0046 docs hub.
  It is now an aggregated, context-aware menu:

  - **This app's docs** — shown only when the current app's package owns docs
    (matched by `_packageId`). A single-doc app deep-links straight to the
    viewer; a multi-doc app lands on the new app-scoped index.
  - **All documentation** — the in-product `/docs` portal.
  - **Online documentation** — `docs.objectstack.ai` (opens in a new tab).

  Docs are lazily fetched once on first menu open (names/labels only), so the menu
  adds no cost until used; a failed fetch soft-degrades to the static entries.

  Also adds the app-scoped docs index route **`/apps/:packageId/docs`**
  (`AppDocsIndex`) — the package-scoped sibling of `/docs`, listing just that
  app's docs — which the "This app's docs" entry targets when an app ships more
  than one. New `help.*` strings added to the `en` and `zh` bundles (other
  locales fall back to `en`).

- 9f9d1db: Add an `icon` form widget — a searchable Lucide icon picker for metadata-admin.

  Metadata `icon` fields (page/app/object) were a raw text input where authors had to know and type an exact Lucide name. The new `widget: 'icon'` renders a combobox: the trigger shows a live preview of the current icon, and opening it reveals a search box plus a grid of matching icons (preview + name). Selecting writes the kebab-case name string. Out-of-catalog values (e.g. icons from another library, or typos to fix later) survive — they render on the trigger and stay reachable as a "keep" option so re-opening never silently drops them. Registered as `'icon'` in the metadata-admin `WIDGETS` map; pair with `widget: 'icon'` in the spec `*.form.ts`.

- 0d707b6: `marketplace:installed-list` SDUI widget — the Installed Apps body (control-plane/local dual-source list, refresh, uninstall) extracted from the React route page, which now renders the same component. The page shell ships as metadata with `@objectstack/cloud-connection`'s install-local plugin (cloud ADR-0009 P2a).
- 67dbaa1: interface page: Add-Record config now takes effect; view picker mirrors runtime resolution

  - **Fix: `interfaceConfig.addRecord` did nothing.** `InterfaceListPage` never forwarded `addRecord` into the schema it hands to `ListView`, so the panel's Add-Record toggle/position/mode were silently dropped — the button could never appear on an interface page. Now `addRecord` is passed through (ListView already gates the button on `addRecord.enabled` across all visualizations).
  - **`view-ref` picker no longer mislabels resolvable values.** A stored `sourceView` like the bare `default` was tagged "(not in object)" even though the runtime resolves it. The widget now mirrors `InterfaceListPage.resolveSourceView` (exact name / `<object>.<name>` suffix / `default`-`list` special-case) via an extracted, unit-tested `resolveStoredViewRef`, showing the matched view's label (e.g. "All Tasks → showcase_task.default") instead of a false warning.

- 586770c: metadata editor: `view-ref` widget for picking a source view

  Adds a `view-ref` form widget so `interfaceConfig.sourceView` (and any field with `widget: 'view-ref'`) renders as a dropdown of the source object's views instead of a free-text name the author could mistype. Views come from a new `WidgetContext.objectViews`, which `ResourceEditPage` loads for the page's source object (`interfaceConfig.source` / `object`). A value not in the catalog is still shown so stale/custom names survive; clearing to "None" omits the field (the protocol treats absence as the object's default view). The widget mirrors the existing `field-ref` picker and degrades gracefully when no source object is bound.

  Pairs with the `@objectstack/spec` change that sets `widget: 'view-ref'` + `dependsOn: 'source'` on the page form's `sourceView` field.

- 652f9b2: feat(packages): "Discard changes" and "Delete app" buttons in the package detail sheet

  Adds two one-click package-lifecycle actions next to the existing "Publish app", mirroring the new backend endpoints:

  - **Discard changes (N)** — next to "Publish app" in the Pending changes block. Drops every pending draft via `POST /packages/:id/discard-drafts`, reverting the app to its last published baseline. Non-destructive (published metadata + data untouched), then refreshes the pending list.
  - **Delete app** — in the Actions row. Removes the whole package via `DELETE /packages/:id` (active + draft metadata + drops each object's table). Confirms first ("this cannot be undone"); closes the sheet on success, keeps it open and shows the error on failure.

  Together with "Publish app", this gives the full AI-build review loop a UI: publish to preview → keep, **discard all changes**, or **delete the app**.

- 82195b5: Configurable property panels for page-editor blocks (SDUI). The Studio page editor's block inspector now renders typed, protocol-aligned property fields (editing the block's `properties`) for the minimal SDUI-essential content blocks — `element:text`, `element:image`, `page:header`, `page:card`, `record:related_list` — instead of only the generic `type`/`id`/`className`/`hidden` fields. Previously these properties were editable only via raw JSON.
- f12225b: The Studio page editor can now edit nested sub-blocks inside container blocks. A `page:tabs`/`page:accordion` tab's children, and a `page:card`/`page:section`'s body, are surfaced as indented, selectable sub-blocks — each one can be selected, configured (via the inspector and its object/field pickers), edited, removed, and new ones added — in both full and slotted pages. Addressing is handled by extending the block-path scheme to support object-key hops (e.g. `…components[0].properties.items[0].children[0]`) and a nested sub-path under slot ids. Closes the last gap so a container's contents are fully point-and-click instead of raw JSON.
- 14e3db5: The Studio page editor can now edit slotted record pages. A `kind:'slotted'` page surfaces its 7 canonical slots (header / actions / alerts / highlights / details / tabs / discussion) as editable regions — overridden slots show their blocks (selectable + configurable via the inspector and its object/field pickers), and unoverridden slots show an "inherited — add a block to override" placeholder. Edits write back to `slots`; empty slots are omitted so they keep inheriting the synthesized default. This closes the loop for the most common low-code task — customizing a business object's detail page (highlights/tabs/details) point-and-click instead of by hand-editing JSON.
- 4eb9cb6: feat(plugin-tree): add a `tree` / tree-grid object view type

  Renders a self-referencing object as an indented, expand/collapse tree-grid —
  the right view for arbitrary-depth hierarchies (business unit / org chart,
  category trees, BOMs, nested comments) that fixed-depth grouping can't express.
  New `@object-ui/plugin-tree` package (`object-tree`/`tree`), `tree` added to the
  `ViewType` union, and dispatch wired through plugin-list `ListView` +
  app-shell `ObjectView` (the console path).

- de3224e: feat(metadata): relationship-level `inlineEdit` auto-renders master-detail

  A child object's `master_detail`/`lookup` field can declare `inlineEdit: true`
  (in the data model) to mean "edit me inline within my parent's form". The
  metadata layer now scans for these and merges the resulting child collections
  into each parent object's form view as `subforms` — so the parent's **standard**
  New/Edit form auto-renders an atomic master-detail form with **no view config
  and no bespoke page**. The intent lives once in the data model (where e.g. an AI
  modelling the schema naturally sets it); forms derive the UI.

  `master_detail` children WITHOUT `inlineEdit` are not inlined (so associations
  like comments/attachments stay out of the entry form). An explicit
  `form.subforms` entry overrides the derived one. Optional
  `inlineTitle`/`inlineColumns`/`inlineAmountField` tune the grid.

- 010883d: Migrate the runtime DashboardView "dashboard editor" onto the studio's spec-driven inspectors. A single app-shell `DashboardConfigPanel` now replaces both legacy `plugin-dashboard` panels (the dashboard-level config panel and the per-widget config panel): with no widget selected it hosts a new spec-driven `DashboardDefaultInspector` (registered as the studio default inspector for the `dashboard` type), and with a widget selected it hosts the existing `DashboardWidgetInspector`. Both inspectors edit the full nested Dashboard document directly, so the runtime's widget flatten/unflatten adapters are removed. The panel lives in app-shell to avoid a circular dependency on plugin-dashboard; the `sys_dashboard` persistence path is unchanged.
- 7da8a57: Migrate the runtime ReportView "report editor" onto the studio's spec-driven inspector. The right-rail editor now hosts the same report inspector the metadata studio uses (config fields sourced from `@objectstack/spec` `ReportSchema` / `reportForm`) instead of plugin-report's legacy `buildReportSchema` / `ConfigPanelRenderer` engine, so runtime and studio share one report-editing surface. A new spec-driven `ReportDefaultInspector` is registered as the studio default inspector for the `report` type, and a thin app-shell `ReportConfigPanel` hosts it for the runtime (kept in app-shell to avoid a circular dependency on plugin-report). Field pickers read from the in-memory object definition (no extra network fetch); the `sys_report` persistence path is unchanged.
- 7b71cd8: Unify the runtime ObjectView "view editor" onto the studio's spec-driven inspector. The right-rail view editor now hosts the same `ViewVariantInspector` the metadata studio uses (config fields sourced straight from `@objectstack/spec`) instead of the legacy `buildViewConfigSchema` engine, so runtime and studio share one view-editing surface. A new `view-config-adapter` bridges the runtime's flat view shape and the studio's ViewItem draft, keeping the `sys_view` persistence path untouched; field pickers read from the in-memory object definition (no extra network fetch). The legacy `buildViewConfigSchema` engine and its exports are retired; `ConfigPanelRenderer` is retained for the dashboard/report config panels.
- 8426db7: feat(form): standard New/Edit modal renders form-view subforms (Tier 0)

  The console's standard create/edit record modal now renders inline child
  collections when the object's form view declares `subforms` — master-detail
  entry with **no bespoke page**, persisted as one atomic transaction.

  - `ModalForm` (and the create/edit modal in app-shell `AppContent`) detects
    `subforms` and renders `MasterDetailForm` inside the dialog (it owns its Save
    bar; the modal footer is suppressed); on success the modal closes + refreshes.
  - `AppContent` sources `subforms` from the object's default form view
    (`form.subforms` / `formViews.default.subforms`).
  - `ModalFormSchema` gains `subforms`.

  With this, declaring `formViews.default.subforms: [{ childObject }]` is enough
  to make an object's standard New/Edit screen a master-detail form — completing
  the config-driven master-detail story (Tier 0 → derive everything from the
  relationship + child metadata).

### Patch Changes

- 3b5e293: ADR-0034 step 2: route ObjectView's view-config save through the runtime persistence seam, completing the seam's coverage of all three runtime editors (view/report/dashboard). Corrects the seam's `view` branch to mirror ObjectView's real update path (`dataSource.updateViewConfig(...)`, the ADR-0005 overlay API) rather than a raw `sys_view` write. Behaviour is unchanged while the `VITE_RUNTIME_EDIT_VIA_META` flag is off; flag on routes the view update to the studio `/meta` draft. The view CREATE path (`createView` + default-column/kanban/gallery massaging) and the draft/publish UI remain deferred.
- 02c3c65: ADR-0034 step 1: introduce a flag-gated runtime metadata persistence seam. `persistRuntimeMetadata` / `publishRuntimeMetadata` centralise where the runtime view/report/dashboard editors save. Behind the `VITE_RUNTIME_EDIT_VIA_META` flag (default **off**) they reproduce today's `sys_*` writes exactly (zero behaviour change); flag **on** routes to the studio `/meta` per-item draft/publish model (`MetadataClient.save(..., { mode: 'draft' })` + `publish`). ReportView and DashboardView now save through the seam; ObjectView (view) and the draft/publish UI are deliberately deferred. No `sys_*` table is removed and no data is migrated. Also adds the finalized ADR-0034.
- b8a5d41: ADR-0048: finish sweeping app-entry links onto the canonical package-id route
  segment (follow-up to the home-page fix).

  - `AppManagementPage` (System → Apps) "Open app" button now opens
    `/apps/<packageId>` (`app._packageId ?? app.name`) instead of `/apps/<name>`.
  - `AppContent` current-app sub-routes/redirects (the `metadata/package` →
    `component/developer/packages` redirect, and the record-form `baseUrl`) now
    build against the URL's own `appName` segment instead of `activeApp.name`, so a
    `/apps/<packageId>/…` URL keeps its package-id segment instead of flipping to
    the name form. `requestedAppMissing` (preview-drafts) now resolves the segment
    via `matchAppBySegment` so a package-id URL isn't treated as a missing app.

- 4cd0a0d: ADR-0048 (#1824): the Studio metadata editor's post-save refresh now scopes its
  layered + draft re-read to the same package as the initial load (`?package=`), so
  when two installed packages ship the same `type`/`name` the editor re-reads
  this package's own row after saving — not another package's. The save itself
  already binds the package; this aligns the refresh with it.
- a571911: ADR-0048: the console **home** page now links into apps by their canonical
  package-id route segment, matching the nav. The app grid (`HomePage`) and the
  "add to favorites" href (`AppCard`) were still building `/apps/<app.name>` while
  the sidebar/switcher/command-palette emit `/apps/<packageId>` (via
  `appRouteSegment`). So opening an app from the home page produced a name-form URL
  (e.g. `/apps/studio`) instead of `/apps/com.objectstack.studio`. Both now use
  `appRouteSegment(app)`.
- b99d9bd: ADR-0048: package-scope the Studio metadata editor read. Two installed packages
  may ship metadata with the same `type`/`name`; the editor now resolves the right
  one instead of first-match.

  - `MetadataClient`: `layered()` and `getDraft()` accept `{ packageId }`, and
    `get()` emits the `package` query param (→ server prefer-local, `?package=`).
  - `ResourceListPage`: each item's edit link carries its owning package
    (`?package=<row._packageId>`), so even the unscoped "all" list disambiguates;
    falls back to the workspace suffix for runtime/overlay-only rows.
  - `ResourceEditPage`: reads `?package=` and scopes the layered + draft read to
    that package. (The route's `:appName` is the Studio app, not the edited item's
    owner, so the scope must come from the URL, not the active app.)

- 5a95032: Polish the full-page AI workspace with a responsive conversation drawer, clearer page context, constrained chat width, and accessible conversation row actions.
- 053c948: fix(app-shell): send the current-page object to the AI assistant context

  The floating console assistant forwarded only `appName` + the full objects list,
  never the object the user is actually viewing — so asking it to "analyse this
  object" (especially in a non-English prompt) gave the agent nothing to anchor on
  and it replied that it couldn't find the object. The current object/record are
  now derived from the route (mirroring `useTrackRouteAsRecent`'s URL layout,
  tolerant of a `_console` shell prefix) and passed as `context.objectName` /
  `context.recordId`, so the backend injects that object's schema into the system
  prompt and scopes data queries to it. Pairs with the framework current-object
  resolution fix.

- 40c79df: Improve the floating chatbot flow with responsive panel bounds, safer FAB placement, inline responding and stop states, and clearer retryable error feedback.
- 6c0c92c: fix(app-shell): command palette idempotent open + stable locators (ADR-0054 Phase 1)

  The top-bar "Search… ⌘K" button now opens the command palette directly via a
  shared, idempotent `openCommandPalette()` instead of re-dispatching a synthetic
  `⌘K` `KeyboardEvent` — so it works under automation and in ⌘K-reserving
  browsers. Open state is URL-addressable (`?palette=1`, `?cmdk=1` alias), making
  the palette deep-linkable and restore-on-reload. The dialog and header trigger
  emit stable `data-testid` locators (`overlay:command-palette`,
  `action:command-palette:open`) plus an ARIA name. New `useCommandPalette()` hook
  and `CommandPaletteProvider`; `CommandDialog` gains a `contentProps` passthrough
  for the dialog locator/ARIA. Implements invariants C1/C3/C4 of the UI
  testability contract.

- 97c6831: Localize AI workspace, shell navigation, startup, connection, toast, and chatbot affordance text across core console screens.
- f6044fa: feat(form): subforms in DrawerForm + full-page record form (Tier 0 everywhere)

  Completes config-driven master-detail across all standard create/edit entry
  points (after the modal in the previous change):

  - `DrawerForm` now hosts `MasterDetailForm` inside the drawer when the schema
    declares `subforms` (its own Save bar; closes + refreshes on success).
  - `RecordFormPage` (full-page New/Edit) sources `subforms` from the object's
    form view, so the full-page form renders inline child collections too.
  - `ObjectForm`'s subforms shortcut now defers to the drawer/modal variants for
    those formTypes (so they keep their envelope), and only renders the
    master-detail form directly for inline/simple forms.

  Declaring `formViews.default.subforms: [{ childObject }]` now yields a
  master-detail experience in the modal, drawer, AND full-page form — no bespoke
  page anywhere.

- 6cfa330: feat(dashboard): drill "Open in list" escape hatch + unify report drill

  Adopts the mainstream BI peek-then-escalate drill model. Drill-through opens an
  in-place drawer (keep context) and offers an "Open in list →" affordance to
  escalate to the object's full list page (sort / bulk-select / export / shareable
  URL) — the Looker / Power BI "see records → open in page" pattern.

  - New `DrillNavigationContext` (`@object-ui/react`): the app shell provides
    `openRecordList`; the renderer stays decoupled from console routing.
  - The drill drawers (pivot / dataset / chart / KPI) render the escape hatch when
    a host navigation handler is present, and hide it otherwise (self-contained
    peek). `DashboardView` provides the handler via `useOpenRecordList`.
  - `DrillDownConfig.target` gains `'navigate'` — skip the drawer and open the
    list directly; degrades to `'drawer'` when no host handler is available.
  - `ReportView` drill-through now opens the same in-place drawer (peek records →
    click a row to open a record) instead of navigating away; the escape hatch
    preserves the previous navigate-to-list behavior. Dashboard and report drill
    are now unified.
  - i18n: `dashboard.openInList` (en / zh).

- 23bf869: fix(app-shell): edit-in-studio pencil no longer overlaps interface-page toolbar buttons

  The PageView "Edit in studio" pencil is an absolute overlay at the page's
  top-right. On an interface (list) page whose header surfaces toolbar buttons
  (e.g. an Approvals page's "Mark Done"), the pencil sat on top of the rightmost
  button, clipping its label. PageView now tells InterfaceListPage to reserve
  right padding on its header (`reserveEditAffordance`, only when the pencil is
  shown) so the toolbar clears the affordance. Non-admin / non-editable pages are
  unchanged.

- 70b7780: Metadata editor: a failed LOAD no longer masquerades as field validation errors.

  When the layered/draft fetch fails (network/500/timeout), `ResourceEditPage` previously still rendered the form on empty defaults, so the client Zod validator fired spurious "name/label/regions required" diagnostics — making a transport failure look like a structurally broken item.

  - New `loadFailed` state, set in the load catch block and reset at the start of each load.
  - The validation-diagnostics banner is now gated by `shouldRenderDiagnostics()`, which suppresses the diagnostics block entirely on load failure, so the empty-default form's required-field issues never surface.
  - The top error banner is now explicit: "Failed to load &lt;type&gt;/&lt;name&gt;: &lt;message&gt;" (new `engine.edit.loadFailed` i18n key, en + zh-CN).

  The happy path is unaffected: a genuinely-invalid item that loaded successfully still shows its validation diagnostics.

- fe69471: Flow designer: start a new flow with a trigger, and stop the edge "+" overlapping branch labels

  Two more dogfooding fixes for the Studio flow designer:

  - **Empty flow → Start node.** An empty editable flow's "Add node" inserted a
    generic `task` node; it now seeds a `start` (trigger) node — the canonical
    entry point every flow needs — so the canvas opens on the trigger and the
    author builds forward from there.
  - **Edge insert handle no longer collides with the branch label.** The "insert
    node" `+` button and the branch/condition label pill were both centered on the
    edge midpoint, so on a labeled edge (`approve`, `if …`) the `+` sat on top of
    the label. The `+` now slides to the right of the label when one is present
    (unlabeled edges keep the centered `+`).

  Verified in-browser: labeled edges show the label and a clear, separate insert
  handle; `tsc --noEmit` clean.

- 0032b23: FlowRunner: close the runner when a resume ends in a terminal flow failure.

  The engine consumes a run's suspension before executing downstream nodes
  (resume-once semantics), so a resume whose `AutomationResult` is
  `success: false` can never be retried — the old behavior left the dialog open
  and a second Submit hit "No suspended run". Transport-level failures (network
  / 5xx) still keep the dialog open for retry.

- e8d56ec: fix(form): honour the form view layout in the full-page record form

  `RecordFormPage` hard-coded `formType: 'simple'`, so a record's declared form
  view layout (`tabbed` / `wizard` / `split`) was ignored on the full-page
  create/edit route — `ObjectForm` already renders every variant, the entry point
  just never passed it through. It now reads the object's `form` / `formViews.default`
  `type` + `sections` and forwards them (plus variant props: defaultTab, tabPosition,
  allowSkip, showStepIndicator, split\*). Page-level layouts only — `drawer`/`modal`
  are presentation/open-modes, not record-page layouts, so they fall back to `simple`.

  Refs objectstack-ai/framework#1890

- 0ad72a6: fix: pass full gantt config to renderer, render multi-value lookups in gantt tooltips, persist `bodyExtra` on dataSource actions, and complete zh/en gantt labels

  Four platform gaps that the EHR app previously worked around with `node_modules` patches:

  - **app-shell / ObjectView** — the `config.gantt → renderer props` adapter was a hardcoded 6-field whitelist, so `parentField`/`typeField` (and `baseline*`, `groupByField`, `resourceView`, `tooltipFields`, `quickFilters`, …) never reached the renderer and the chart degraded to a flat list. It now spreads the full `viewDef.gantt` first, then applies the three required defaults last (mirroring the gallery branch).
  - **plugin-gantt / ObjectGantt** — the tooltip value formatter only handled single-object lookups, so a multi-value lookup (a populated `[{name},{name}]` array) fell through to `'—'`. It now maps each array element to its display value and joins them.
  - **app-shell / useConsoleActionRuntime** — `bodyExtra` was merged only on the absolute-HTTP path; the generic `dataSource.update` path ignored it, so a pure-confirmation action (no params array) left an empty payload and persisted nothing. `bodyExtra` is now merged last on that path too, matching the documented semantics.
  - **i18n** — added the gantt labels the 9.x renderer references but the bundles lacked: `toolbar.thisWeek/thisMonth/exportPdf/saveLayout`, `viewMode.year`, `menu.add*/removeDependency/noCandidates`, the `linkType.*` and `conflict.*` blocks, and `readOnly*` — in both `en` (canonical key source) and `zh`.

- e133fae: Gate the runtime report and dashboard editors behind an admin check. Editing a report or dashboard mutates the **shared** definition (it writes the single `sys_report` / `sys_dashboard` record, not a per-user copy), but the edit buttons were shown to every user — so any viewer could change a report/dashboard for everyone. The "Edit" affordance (and its config panel) is now admin-only, matching ObjectView's existing view-config gate. This is the first step of ADR-0034 (runtime edits are an admin quick-edit of the shared definition).
- 18d0339: Relabel metadata-driven UI on a language switch without a page refresh (#1319)

  Switching the UI language left server-resolved metadata labels (object/field/
  view labels, action-dialog text) in the old language until a hard refresh,
  because renderers cache those labels by object name and never refetch on a
  language change.

  **`@object-ui/auth`** — `createAuthenticatedFetch` now folds the active
  `<html lang>` into `Accept-Language` on API calls (never clobbering an explicit
  header), so a switch carries the new locale on every subsequent request.

  **`@object-ui/app-shell`** — `ConnectedShellInner` drops the adapter's
  locale-blind metadata cache in the render phase and remounts the metadata
  subtree via `key={language}`, so every renderer refetches in the new locale.
  The adapter and its connection sit above the key and are preserved — an in-app
  relabel, not a reconnect.

  **`@object-ui/i18n`** — dev-mode missing-key warnings: `createI18n` gains
  `warnMissingKeys` (default on outside production) wiring a deduped i18next
  `missingKeyHandler`. `useObjectLabel`'s convention-key probes are flagged so
  their intentional misses (which fall back to server metadata) stay silent.

  Pairs with the framework-side locale-aware metadata changes in
  `@objectstack/client` / `@objectstack/objectql` / `@objectstack/rest`.

- 59b6bbb: i18n the managed-by empty states for system / append-only / better-auth object lists.

  `resolveManagedByEmptyState` previously hardcoded English titles and messages (e.g. "No identity records", "No events recorded"), so list views for managed objects (identity, audit logs, system-generated records) rendered English regardless of locale. It now takes the `t` translator and resolves `list.managedBy.{system,appendOnly,betterAuth}.{title,message}` (English kept as `defaultValue` fallbacks); `ObjectView` passes its `t` through. Added the keys to the `en` and `zh` locale packs.

- e95cc25: Fix the NavigationSyncEffect baseline race: lazily-loaded `page`/`dashboard` metadata (and the empty cache during `invalidate()` refetch) could seed a partial diff baseline, making platform `sys_` pages look "user added" — the effect then wrote them into every app's navigation, 403ing on ADR-0010 locked apps (red "Failed to update navigation" toasts) and polluting writable apps. The effect now diffs only while both types are `status === 'ready'` (new optional `MetadataContextValue.getTypeStatus`), never treats `sys_`-prefixed artifacts as user creations, and skips apps whose `_lock`/`protection.lock` is `full`/`no-overlay`.
- e265a40: fix(app-shell): resolve 51 react-hooks/rules-of-hooks errors in ObjectView

  ObjectView had a mid-component early return (`if (!objectDef) return …`) sitting before ~50 hooks, which violated the Rules of Hooks and risked a `Rendered fewer hooks than expected` crash if `objectDef` flipped present→absent→present on a live instance (object switch, metadata refresh, reload failure). Split the component so the missing-object empty state lives in a thin `ObjectView` wrapper, while `ObjectViewInner` (mounted only when the definition exists) calls all hooks unconditionally. Behavior is unchanged.

- 42e557a: "Your organization" Install routes by deployment shape: install-local runtimes (runtime-config `features.installLocal`) install via `/marketplace/install-local` into their OWN kernel (the bound oscc\_ credential fetches the org manifest — ADR-0008); cloud-managed environments keep the control-plane `/cloud-connection/install` path. Previously the org Install button always called the control-plane path, which 401s on self-hosted runtimes.
- af74a5d: Add an admin-only "Edit in studio" affordance to the runtime PageView. Custom pages are authored in the metadata studio (canvas + inspector), not at runtime — so instead of embedding the heavyweight page canvas, PageView now shows a lightweight top-right button (admins only) that deep-links to the page's studio editor (`/apps/:app/metadata/page/:name`). This gives view/report/dashboard/page a consistent runtime admin edit entry point.
- 3cc38fe: perf(detail/header): lazy + dedupe related-list fan-out, coalesce header polls

  Opening a record detail fired ~50 concurrent `/api/v1` requests that
  head-of-line-blocked one another on a single control-plane container.

  - `RecordDetailView` no longer eager-preloads reverse-reference children
    when the reference rail renders them (that data was discarded while the
    rail re-fetched the same collections).
  - `record:reference_rail` now gates fetching on visibility
    (`IntersectionObserver`; the rail is `hidden xl:flex`), caps concurrency
    at 3, and fetches once per `(parentId + entries)` via a signature guard,
    applying results through a mounted ref.
  - `AppHeader` inbox/notification, approvals, and activity pollers gained
    in-flight guards so bootstrap effect re-runs coalesce to one request; the
    approvals poll now sends one request with all identities comma-joined
    instead of one per identity.

  Measured locally: opening an environment detail dropped from ~52 to ~17
  requests, related collections from ×3–5 each to ×1, approvals from ×9 to ≤3.

- 053a164: fix(metadata): keep form-family views out of the runtime list-view switcher

  The backend now exposes each view as an independent **ViewItem** (ADR-0017,
  "Object has-many View"): `{ name: '<object>.<key>', object, viewKind:
'list' | 'form', config }`. The Studio preview was already taught this shape,
  but the runtime console path was not — `MetadataProvider.mergeViewsIntoObjects`
  only understood the legacy aggregated container (`{ list, form, listViews,
formViews }`) and ignored `viewKind` entirely. As a result a form-family view
  (e.g. `crm_activity.default`, expanded from `formViews.default`) was neither
  recognized nor excluded: navigating to its `/view/<name>` URL silently fell
  back to the default grid list instead of being treated as a record form.

  `mergeViewsIntoObjects` now recognizes the ViewItem shape and routes by
  `viewKind` — `'list'` → `objectDef.listViews`, `'form'` → `objectDef.formViews`
  — so FORM-family views never enter the list-view switcher (which reads only
  `listViews`). Each item's `config` body is flattened to the renderer shape so
  `type`/`columns`/`calendar`/… survive, the canonical `<object>.<key>` name is
  used as the view id (so `/view/<name>` resolves), and the legacy container is
  skipped for any object that already has expanded ViewItems (no double-listing).
  Objects served only as a legacy container are unaffected.

- db8cd00: feat(app-shell): global settle signal (window.\_\_objectui) + region aria-busy (ADR-0054 Phase 3)

  Adds a single machine-readable "is the app idle?" predicate (ADR-0054 C5). The
  data layer wraps the adapter's `fetch` to count in-flight requests, mirrored onto
  `window.__objectui` with live `idle` / `pendingRequests` getters plus `whenIdle()`
  and `subscribe()`. New `useSettleSignal()` React hook and lower-level exports
  (`getPendingRequests`, `subscribeSettle`, `whenIdle`, `withSettleSignal`,
  `installSettleSignalGlobal`). The list view and record-picker results regions now
  set `aria-busy` while fetching and `data-state="loading|idle"` for region-level
  waiting. Lets an automated (AI) driver wait for settle instead of hardcoding
  timeouts.

- 2f31406: Refine Studio package-scoped navigation and home overview.

  Studio now treats the selected package as the home overview scope, flattens the root Overview sidebar group, hides the duplicate all-metadata sidebar entry, redirects the invalid package metadata route to package management, preserves the selected package across package-management navigation, and adds a localized package-management sidebar label.

- d901f65: feat(app-shell): testability ratchet — ban synthetic-event triggers (ADR-0054 Phase 5)

  Locks in the testability contract so it can't regress. A conformance test (in the
  gating `pnpm test` job) fails the build if a new synthetic-event trigger
  (`dispatchEvent(new KeyboardEvent/MouseEvent/PointerEvent)`) appears anywhere in
  `packages/*/src` or `apps/*/src`; a matching local ESLint rule
  (`object-ui/no-synthetic-event-trigger`) flags it in-editor. The last two
  offenders — the sidebar swipe-to-open gestures (`UnifiedSidebar`, `AppSidebar`)
  — are converted to a direct, idempotent `setOpenMobile(true)` (C1), so the tree
  is clean at zero. Completes the ADR-0054 rollout.

- 8d1195d: Fix `type: 'url'` actions so they actually reach the backend in split-origin dev setups, and so reveal-once result dialogs render.

  - `ActionRunner.executeUrl`: when context provides `apiBase`, relative `/api/...`, `/_auth/...`, and `/_account/...` URLs are now promoted to absolute (`${apiBase}${path}`) before navigation. Same-origin API paths (with or without `apiBase`) trigger a full-page `window.location.href` rather than React-Router push — this is required for server-side OAuth redirect dances (e.g. better-auth `/sign-in/social`) that React Router would otherwise swallow into the SPA's fallback route.
  - `ActionRunner.buildInterpolationContext`: surfaces `ctx.apiBase` for action targets that want to template it explicitly.
  - `ObjectView`: passes `apiBase: import.meta.env.VITE_SERVER_URL` into the toolbar `ActionProvider` context so the above resolves.
  - `action-button` and `action-menu` renderers now forward `resultDialog` when invoking the runner. Previously this field was silently dropped by an explicit whitelist, breaking every "show once, then hide" flow (2FA QR/backup codes, OAuth client_secret, regenerated tokens).

- 5ab52c0: feat(app-shell): useUrlOverlay primitive + URL-addressable keyboard-shortcuts dialog (ADR-0054 Phase 2)

  Adds `useUrlOverlay(key)` — a reusable, router-aware hook that stores a navigable
  overlay's open state in a `?<key>=1` URL param (idempotent open, deep-linkable,
  restore-on-reload, back/forward; `alias`/`value`/`replace` configurable). The
  command palette is refactored onto it (behavior unchanged: `?palette=1`, `?cmdk=1`
  alias). The keyboard-shortcuts dialog becomes URL-addressable (`?shortcuts=1`) and
  gains a click entry in the header Help menu — previously it was only reachable via
  the `?` key (which remains an accelerator). Generalizes ADR-0054 invariants C1/C3
  beyond the Phase 1 reference fix; the shared overlay primitives already carry
  `data-testid` + Radix `data-state`, documented in the README.

- ef3c654: Localize the View variant inspector labels. The inspector (the View "home" panel, also hosted by the runtime ObjectView right-rail view editor after the spec-driven migration) previously rendered hardcoded English labels — "Label", "View type", "Object", the view-type dropdown options, and the "spec schema unavailable" hint. These now route through the metadata-admin i18n catalog (en + zh) so the runtime console and the studio both display localized text.
- Updated dependencies [5976ba3]
- Updated dependencies [a00e16d]
- Updated dependencies [eaccefd]
- Updated dependencies [f7f325d]
- Updated dependencies [c12986e]
- Updated dependencies [71d7ce0]
- Updated dependencies [0c95963]
- Updated dependencies [30ee761]
- Updated dependencies [81c0777]
- Updated dependencies [053c948]
- Updated dependencies [b99d9bd]
- Updated dependencies [053c948]
- Updated dependencies [89e113c]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [c5a7d6f]
- Updated dependencies [40c79df]
- Updated dependencies [9049bbe]
- Updated dependencies [053c948]
- Updated dependencies [053c948]
- Updated dependencies [77cc6bb]
- Updated dependencies [6c0c92c]
- Updated dependencies [97c6831]
- Updated dependencies [cb2fdb1]
- Updated dependencies [a58c6b8]
- Updated dependencies [c3749eb]
- Updated dependencies [39c89e7]
- Updated dependencies [78f9c16]
- Updated dependencies [92449ef]
- Updated dependencies [c09f44e]
- Updated dependencies [f6044fa]
- Updated dependencies [3d036a9]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [e270c7d]
- Updated dependencies [ab168e4]
- Updated dependencies [d54346c]
- Updated dependencies [5332639]
- Updated dependencies [3870c20]
- Updated dependencies [2eb3096]
- Updated dependencies [b88c560]
- Updated dependencies [0ad72a6]
- Updated dependencies [bd398df]
- Updated dependencies [3fa23a7]
- Updated dependencies [18d0339]
- Updated dependencies [66ed3ad]
- Updated dependencies [c6445b6]
- Updated dependencies [80c133c]
- Updated dependencies [5e1b838]
- Updated dependencies [59b6bbb]
- Updated dependencies [d16566f]
- Updated dependencies [69510df]
- Updated dependencies [b148daf]
- Updated dependencies [90acb7f]
- Updated dependencies [7913390]
- Updated dependencies [514f426]
- Updated dependencies [586a027]
- Updated dependencies [00f8d2d]
- Updated dependencies [9aac2b8]
- Updated dependencies [1394e34]
- Updated dependencies [e95cc25]
- Updated dependencies [abe8ebc]
- Updated dependencies [300d755]
- Updated dependencies [3cc38fe]
- Updated dependencies [bd8b054]
- Updated dependencies [053c948]
- Updated dependencies [053c948]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [c849d3b]
- Updated dependencies [7b71cd8]
- Updated dependencies [2270239]
- Updated dependencies [db8cd00]
- Updated dependencies [650bd1f]
- Updated dependencies [f011479]
- Updated dependencies [2f31406]
- Updated dependencies [18728c1]
- Updated dependencies [8426db7]
- Updated dependencies [8d1195d]
- Updated dependencies [9bef806]
  - @object-ui/core@7.0.0
  - @object-ui/components@7.0.0
  - @object-ui/plugin-grid@7.0.0
  - @object-ui/plugin-detail@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/plugin-report@7.0.0
  - @object-ui/data-objectstack@7.0.0
  - @object-ui/plugin-chatbot@7.0.0
  - @object-ui/plugin-list@7.0.0
  - @object-ui/i18n@7.0.0
  - @object-ui/types@7.0.0
  - @object-ui/plugin-form@7.0.0
  - @object-ui/fields@7.0.0
  - @object-ui/plugin-charts@7.0.0
  - @object-ui/plugin-dashboard@7.0.0
  - @object-ui/auth@7.0.0
  - @object-ui/plugin-view@7.0.0
  - @object-ui/layout@7.0.0
  - @object-ui/plugin-calendar@7.0.0
  - @object-ui/plugin-designer@7.0.0
  - @object-ui/plugin-editor@7.0.0
  - @object-ui/plugin-kanban@7.0.0
  - @object-ui/collaboration@7.0.0
  - @object-ui/permissions@7.0.0
  - @object-ui/providers@7.0.0

## 6.2.3

### Patch Changes

- 37fb47e: fix org
  - @object-ui/types@6.2.3
  - @object-ui/core@6.2.3
  - @object-ui/i18n@6.2.3
  - @object-ui/react@6.2.3
  - @object-ui/components@6.2.3
  - @object-ui/fields@6.2.3
  - @object-ui/layout@6.2.3
  - @object-ui/data-objectstack@6.2.3
  - @object-ui/auth@6.2.3
  - @object-ui/permissions@6.2.3
  - @object-ui/plugin-editor@6.2.3
  - @object-ui/collaboration@6.2.3
  - @object-ui/providers@6.2.3

## 6.2.2

### Patch Changes

- c5821ce: `AiChatPage` no longer PATCHes a client-side title-from-first-message
  on the freshly-created conversation. The server (`@objectstack/service-ai`
  ≥ next minor) now generates a concise LLM-summarised title fire-and-forget
  after the first assistant turn lands, and a client-side truncated title
  would race that and win — pinning every conversation row to a 40-char
  substring of the first user message instead of a real summary.

  Drop the PATCH; bump the sidebar list a couple of times (2.5 s + 6 s)
  to pick up the LLM title whenever the model finally responds.

- 3b35084: Fix: floating chatbot now replays persisted conversation history on mount.

  The right-corner floating chatbot (`ConsoleFloatingChatbot`) was passing only
  `conversationId` to its inner `useObjectChat`, dropping the `initialMessages`
  returned by `useChatConversation`. Backend persistence already worked — the
  server-side `ai_conversation` + `ai_message` rows were created and survived a
  page refresh — but the UI started each session with just the static "welcome"
  bubble, making users believe their history had been lost.

  Now matches the `/ai/:conversationId` full-page chat: history is hydrated
  into the chat surface, and the welcome bubble is suppressed when prior turns
  exist (showing it above real user/assistant turns is confusing).

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
  - @object-ui/fields@6.2.2
  - @object-ui/layout@6.2.2
  - @object-ui/plugin-editor@6.2.2
  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2
  - @object-ui/i18n@6.2.2
  - @object-ui/data-objectstack@6.2.2
  - @object-ui/auth@6.2.2
  - @object-ui/permissions@6.2.2
  - @object-ui/collaboration@6.2.2
  - @object-ui/providers@6.2.2

## 6.2.1

### Patch Changes

- bc269b0: fix
  - @object-ui/types@6.2.1
  - @object-ui/core@6.2.1
  - @object-ui/i18n@6.2.1
  - @object-ui/react@6.2.1
  - @object-ui/components@6.2.1
  - @object-ui/fields@6.2.1
  - @object-ui/layout@6.2.1
  - @object-ui/data-objectstack@6.2.1
  - @object-ui/auth@6.2.1
  - @object-ui/permissions@6.2.1
  - @object-ui/plugin-editor@6.2.1
  - @object-ui/collaboration@6.2.1
  - @object-ui/providers@6.2.1

## 6.2.0

### Minor Changes

- fe3c1d3: Metadata Admin engine — unified UI for all 27 metadata types.

  A generic, schema-driven admin shell that replaces the old per-type
  bespoke pages with a single registry-driven engine. Admins can now browse,
  create, override, diff, and roll back every registered metadata type from
  the Setup app → _All Metadata Types_.

  ### New: `@object-ui/app-shell` views/metadata-admin
  - **`MetadataDirectoryPage`** — auto-grouped tile directory by domain, with
    free-text search, domain chips, and a _Writable only_ filter.
  - **`MetadataResourceListPage` / `MetadataResourceEditPage` / `…CreatePage` / `…HistoryPage`** —
    generic CRUD shell. Uses the new `/meta/types` schema field to render
    SchemaForm; uses `?layers=code,overlay,effective` to power a 3-state diff
    tab; uses `/references` to warn before destructive deletes.
  - **`MetadataQuickFind`** — Cmd+Shift+M palette searching across types and
    items.
  - **`PermissionMatrixEditor`** — Salesforce-style matrix custom editor for
    `type=permission`. Objects × CRUD/VAMA/lifecycle columns with cascade
    rules (viewAllRecords ⟹ allowRead, etc.), expandable per-object field
    R/W subtable, bulk-set (R / CRUD / All / None), filter, _only granted_
    toggle, destructive-change confirmation, profile switch.
  - **`DesignerEditorWrapper`** — generic load–edit–save shell that hosts any
    bespoke designer (`ObjectViewConfigurator`, `DashboardEditor`,
    `PageCanvasEditor`, …). Handles dirty tracking, Save / Reset / Refresh /
    History buttons, and the read-only fallback when `allowOrgOverride` is
    false.
  - **`i18n.ts`** — bilingual (`en-US`, `zh-CN`) bundle for built-in type
    labels, domain labels, and engine UI strings, with `detectLocale()` and a
    `t(key)` helper.

  ### New routing variant
  - App nav now supports `{ type: 'component', componentRef, params? }` items.
    `AppContent` resolves them through the existing `ComponentRegistry`.
  - Built-in components registered: `metadata:directory`, `metadata:resource`,
    `metadata:object/edit` (FieldsPage), `metadata:permission/edit`
    (PermissionMatrixEditor), and lazy designer wrappers for view / dashboard
    / page.

  ### Plugin-designer
  - Lazy-exported `ObjectManager`, `FieldDesigner`, `ObjectViewConfigurator`,
    `DashboardEditor`, `PageCanvasEditor`, `MetadataObjectsPage`, and
    `MetadataFieldsPage` so the engine can mount them on demand.

  The temporary `/dev/meta` route is removed. Setup app navigation flows
  through the new component routes.

- ca685ab: Add ChatGPT-style AI chat history surface at `/ai` and `/ai/:conversationId`.
  - New `DefaultAiChatPage` with conversations sidebar (list, create, select, delete) and chat pane on the right.
  - New `ConversationsSidebar` component and `useConversationList` hook for listing and managing `ai_conversations`.
  - `useChatConversation` now accepts an optional `activeId` to hydrate a specific conversation (bypassing the localStorage cache), and guards against duplicate conversation creation when sibling state (e.g. selected agent / scope) changes during the same visit.
  - Deleting the active conversation navigates back to `/ai` so the URL doesn't reference a stale id.
  - Auto-title new conversations from the first user message (truncated to 40 chars) via `PATCH /api/v1/ai/conversations/:id`; resumed conversations are left alone.
  - Manual rename in the sidebar: pencil icon opens an inline editor with optimistic update and rollback on server error.
  - Client-side search input filters the sidebar by title/preview substring.

- 0335ec4: Polish the AI chat surface based on real-world dogfooding feedback.

  **`@object-ui/plugin-chatbot`** — new display helpers shared by `ChatbotEnhanced`:
  - `unwrapToolResult(value)` peels the MCP-style `{ type: 'text', value: '<json>' }`
    envelope that backend tools emit (`@objectstack/service-ai`'s data/metadata
    tools, in particular), and JSON-parses the inner payload. The result panel
    now renders a structured object tree instead of a doubly-escaped wall of
    `\\\"objects\\\":[…]`.
  - `humanizeToolName(name)` converts snake_case / kebab-case / camelCase tool
    ids into sentence case ("list_objects" → "List objects"), preserving known
    acronyms (API, ID, SQL, …). Tool-call cards now show the friendly title with
    the raw id as a small monospace badge for power users.
  - `summarizeChatError(err)` strips the AI SDK's
    `"Failed after N attempts. Last error: "` prefix and keeps the first
    sentence as a headline; the full text is exposed via an optional `details`
    field so the new error banner can render a "Details" disclosure plus a
    prominent Retry button instead of a 300-character single-line wall.

  A new `⌘⏎ to send` hint is shown in the prompt footer (hidden on narrow
  screens). `ToolHeader.title` now accepts `ReactNode` (previously `string`)
  so wrappers can compose richer titles.

  **`@object-ui/app-shell`** — `AiChatPage`:
  - Removes the fake "Hello! I'm X" assistant welcome bubble so the empty-state
    suggestion chips can actually render.
  - Adds per-agent default suggestion sets (`data_chat`, `metadata_assistant`)
    with a generic fallback. New conversations open with three actionable
    starter prompts tailored to the selected agent.
  - Surfaces agent-fetch failures as an inline warning on the agent picker
    instead of hijacking the welcome message.
  - Placeholder text now hints at the first suggestion (e.g. `Ask Data
Assistant…  (try "系统里有多少个用户？")`).

### Patch Changes

- Updated dependencies [fe3c1d3]
- Updated dependencies [ec8dcde]
  - @object-ui/data-objectstack@6.2.0
  - @object-ui/react@6.2.0
  - @object-ui/components@6.2.0
  - @object-ui/fields@6.2.0
  - @object-ui/layout@6.2.0
  - @object-ui/plugin-editor@6.2.0
  - @object-ui/types@6.2.0
  - @object-ui/core@6.2.0
  - @object-ui/i18n@6.2.0
  - @object-ui/auth@6.2.0
  - @object-ui/permissions@6.2.0
  - @object-ui/collaboration@6.2.0
  - @object-ui/providers@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/components@6.1.0
  - @object-ui/data-objectstack@6.1.0
  - @object-ui/fields@6.1.0
  - @object-ui/layout@6.1.0
  - @object-ui/react@6.1.0
  - @object-ui/auth@6.1.0
  - @object-ui/collaboration@6.1.0
  - @object-ui/permissions@6.1.0
  - @object-ui/providers@6.1.0
  - @object-ui/i18n@6.1.0

## 6.0.4

### Patch Changes

- 76e73fe: Gate App Marketplace pages by `useIsWorkspaceAdmin()`. Non-admin members of
  the active organization can no longer load the marketplace catalog, package
  detail, or installed-apps pages — they get an "admin-only" empty state
  instead. The marketplace nav link in the sidebar was already gated; this
  closes the direct-URL gap.
  - @object-ui/types@6.0.4
  - @object-ui/core@6.0.4
  - @object-ui/i18n@6.0.4
  - @object-ui/react@6.0.4
  - @object-ui/components@6.0.4
  - @object-ui/fields@6.0.4
  - @object-ui/layout@6.0.4
  - @object-ui/data-objectstack@6.0.4
  - @object-ui/auth@6.0.4
  - @object-ui/permissions@6.0.4
  - @object-ui/collaboration@6.0.4
  - @object-ui/providers@6.0.4

## 6.0.3

### Patch Changes

- 58f0af6: Fix marketplace install dialog showing "No environments found" even when the
  signed-in user has cloud environments. Cloud's data API returns rows under
  `records`, not `data`/`items`; the dialog now reads the correct key. As a
  hardening pass, also filter `sys_member` rows by the caller's session
  `user_id` so a leaky data endpoint cannot widen the install target list to
  other tenants' organizations.
  - @object-ui/types@6.0.3
  - @object-ui/core@6.0.3
  - @object-ui/i18n@6.0.3
  - @object-ui/react@6.0.3
  - @object-ui/components@6.0.3
  - @object-ui/fields@6.0.3
  - @object-ui/layout@6.0.3
  - @object-ui/data-objectstack@6.0.3
  - @object-ui/auth@6.0.3
  - @object-ui/permissions@6.0.3
  - @object-ui/collaboration@6.0.3
  - @object-ui/providers@6.0.3

## 6.0.2

### Patch Changes

- d0e63f1: Migrate AI chat history from localStorage to the server-backed
  `ai_conversations` / `ai_messages` REST API. The studio `AiChatPanel`,
  the console `ConsoleFloatingChatbot`, and any other consumer of the new
  `useChatConversation` hook (in `@object-ui/app-shell`) now resolve a
  durable conversation id per signed-in user, hydrate prior messages on
  mount, and rotate the conversation on reset. The previous
  `objectstack:ai-chat-messages` localStorage entries are no longer read
  or written.
  - @object-ui/types@6.0.2
  - @object-ui/core@6.0.2
  - @object-ui/i18n@6.0.2
  - @object-ui/react@6.0.2
  - @object-ui/components@6.0.2
  - @object-ui/fields@6.0.2
  - @object-ui/layout@6.0.2
  - @object-ui/data-objectstack@6.0.2
  - @object-ui/auth@6.0.2
  - @object-ui/permissions@6.0.2
  - @object-ui/collaboration@6.0.2
  - @object-ui/providers@6.0.2

## 6.0.1

### Patch Changes

- dbb9a98: cloud
  - @object-ui/types@6.0.1
  - @object-ui/core@6.0.1
  - @object-ui/i18n@6.0.1
  - @object-ui/react@6.0.1
  - @object-ui/components@6.0.1
  - @object-ui/fields@6.0.1
  - @object-ui/layout@6.0.1
  - @object-ui/data-objectstack@6.0.1
  - @object-ui/auth@6.0.1
  - @object-ui/permissions@6.0.1
  - @object-ui/collaboration@6.0.1
  - @object-ui/providers@6.0.1

## 6.0.0

### Major Changes

- 168a4d0: ai

### Patch Changes

- 451bbee: **HITL conversation loop:** `useHitlInChat` now accepts a
  `continueConversation(prompt, ctx)` callback. After the operator approves
  or rejects a tool call from inline chat buttons, the hook synthesises a
  short follow-up user prompt (tagged `[HITL pa_xxx]`, with the executed
  result or rejection reason) and invokes the callback so the LLM
  continues the conversation with full awareness of the outcome.

  `ConsoleFloatingChatbot` wires this callback to `useObjectChat`'s
  `sendMessage`, closing the loop end-to-end. Execution failures stay
  visible in the inline status badge but do NOT continue automatically —
  the operator decides next steps.

  No framework changes required. Internal `idMap` now also tracks the
  tool name so the synthesised prompt is human-readable. New test suite
  `useHitlInChat.test.tsx` covers approve/reject/failed/no-callback
  branches.

- Updated dependencies [451bbee]
  - @object-ui/plugin-chatbot@6.0.0
  - @object-ui/types@6.0.0
  - @object-ui/core@6.0.0
  - @object-ui/i18n@6.0.0
  - @object-ui/react@6.0.0
  - @object-ui/components@6.0.0
  - @object-ui/fields@6.0.0
  - @object-ui/layout@6.0.0
  - @object-ui/data-objectstack@6.0.0
  - @object-ui/auth@6.0.0
  - @object-ui/permissions@6.0.0
  - @object-ui/plugin-calendar@6.0.0
  - @object-ui/plugin-charts@6.0.0
  - @object-ui/plugin-dashboard@6.0.0
  - @object-ui/plugin-designer@6.0.0
  - @object-ui/plugin-detail@6.0.0
  - @object-ui/plugin-form@6.0.0
  - @object-ui/plugin-grid@6.0.0
  - @object-ui/plugin-kanban@6.0.0
  - @object-ui/plugin-list@6.0.0
  - @object-ui/plugin-report@6.0.0
  - @object-ui/plugin-view@6.0.0
  - @object-ui/collaboration@6.0.0
  - @object-ui/providers@6.0.0

## 5.4.2

### Patch Changes

- 3efeecf: ai
  - @object-ui/types@5.4.2
  - @object-ui/core@5.4.2
  - @object-ui/i18n@5.4.2
  - @object-ui/react@5.4.2
  - @object-ui/components@5.4.2
  - @object-ui/fields@5.4.2
  - @object-ui/layout@5.4.2
  - @object-ui/data-objectstack@5.4.2
  - @object-ui/auth@5.4.2
  - @object-ui/permissions@5.4.2
  - @object-ui/collaboration@5.4.2
  - @object-ui/providers@5.4.2

## 5.4.1

### Patch Changes

- 4afe667: ai
  - @object-ui/types@5.4.1
  - @object-ui/core@5.4.1
  - @object-ui/i18n@5.4.1
  - @object-ui/react@5.4.1
  - @object-ui/components@5.4.1
  - @object-ui/fields@5.4.1
  - @object-ui/layout@5.4.1
  - @object-ui/data-objectstack@5.4.1
  - @object-ui/auth@5.4.1
  - @object-ui/permissions@5.4.1
  - @object-ui/collaboration@5.4.1
  - @object-ui/providers@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/auth@5.4.0
  - @object-ui/collaboration@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/data-objectstack@5.4.0
  - @object-ui/fields@5.4.0
  - @object-ui/layout@5.4.0
  - @object-ui/permissions@5.4.0
  - @object-ui/providers@5.4.0
  - @object-ui/react@5.4.0
  - @object-ui/i18n@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/i18n@5.3.2
- @object-ui/react@5.3.2
- @object-ui/components@5.3.2
- @object-ui/fields@5.3.2
- @object-ui/layout@5.3.2
- @object-ui/data-objectstack@5.3.2
- @object-ui/auth@5.3.2
- @object-ui/permissions@5.3.2
- @object-ui/collaboration@5.3.2
- @object-ui/providers@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/i18n@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1
- @object-ui/fields@5.3.1
- @object-ui/layout@5.3.1
- @object-ui/data-objectstack@5.3.1
- @object-ui/auth@5.3.1
- @object-ui/permissions@5.3.1
- @object-ui/collaboration@5.3.1
- @object-ui/providers@5.3.1

## 5.3.0

### Minor Changes

- efb4c00: feat(observability): Sentry integration + bundle splitting for production launch

  **Sentry (opt-in via `VITE_SENTRY_DSN`)**
  - New `initSentry()` / `captureError()` / `setSentryUser()` / `getSentry()`
    helpers exported from `@object-ui/app-shell`.
  - Dynamic-import design: when `VITE_SENTRY_DSN` is unset, `@sentry/react`
    is **never fetched** — zero bundle cost for self-hosted users.
  - `ErrorBoundary.componentDidCatch` now best-effort reports to Sentry.
  - Console app calls `initSentry()` before React mount; never blocks first
    paint.
  - Configurable via:
    - `VITE_SENTRY_DSN` — required to enable
    - `VITE_SENTRY_ENVIRONMENT` — defaults to `MODE`
    - `VITE_SENTRY_RELEASE` — defaults to `VITE_APP_VERSION`
    - `VITE_SENTRY_TRACES_SAMPLE_RATE` — defaults to `0.1`
    - `VITE_SENTRY_REPLAY=true` — opt-in to 10% on-error replay
  - Sensitive URL params (`token`, `access_token`, `apiKey`, etc.) are
    stripped from breadcrumb URLs before send.

  **Bundle splitting**
  - `plugin-dashboard` (8 component types) now lazy-registered via
    `ComponentRegistry.registerLazy()` — only loads on dashboard pages.
  - `plugin-dashboard` and `plugin-report` each get their own chunk
    (previously merged into `plugins-views`).
  - Net first-paint JS reduction: **~200 KB** when the user never visits a
    dashboard or report page.
  - New chunks: `plugin-dashboard` (119 K), `plugin-report` (92 K),
    `vendor-sentry` (346 K raw / 97 K brotli, lazy).
  - `plugins-views` shrinks 387 K → 180 K (now `plugin-list` + `plugin-detail` only).

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/i18n@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0
- @object-ui/fields@5.3.0
- @object-ui/layout@5.3.0
- @object-ui/data-objectstack@5.3.0
- @object-ui/auth@5.3.0
- @object-ui/permissions@5.3.0
- @object-ui/collaboration@5.3.0
- @object-ui/providers@5.3.0

## 5.2.1

### Patch Changes

- 9ccda28: security: force DOMPurify to `^3.4.5` via pnpm override

  Resolves 8 moderate-severity GHSA advisories against the transitive
  `dompurify@3.2.7` pulled in by `monaco-editor`. Vulnerabilities covered:
  - SAFE_FOR_TEMPLATES bypass in RETURN_DOM mode
  - FORBID_TAGS bypassed by function-based ADD_TAGS predicate
  - Prototype Pollution to XSS via CUSTOM_ELEMENT_HANDLING fallback
  - ADD_TAGS function-form short-circuit bypass of FORBID_TAGS
  - ADD_ATTR predicate skipping URI validation
  - USE_PROFILES prototype pollution enabling event handlers
  - mutation-XSS via Re-Contextualization
  - Generic XSS vector

  No API changes; override is transparent to consumers.
  - @object-ui/types@5.2.1
  - @object-ui/core@5.2.1
  - @object-ui/i18n@5.2.1
  - @object-ui/react@5.2.1
  - @object-ui/components@5.2.1
  - @object-ui/fields@5.2.1
  - @object-ui/layout@5.2.1
  - @object-ui/data-objectstack@5.2.1
  - @object-ui/auth@5.2.1
  - @object-ui/permissions@5.2.1
  - @object-ui/collaboration@5.2.1
  - @object-ui/providers@5.2.1

## 5.2.0

### Minor Changes

- 321294c: Cmd-K now shows recently viewed records in its empty state, sourced
  from the existing cloud-synced `sys_user_preference` adapter (already
  wired by `RecentItemsProvider` + `useTrackRouteAsRecent` +
  `RecordDetailView`). Multi-device by construction: open a record on
  laptop, see it in `⌘K → Recently viewed` on phone.
  - Group renders only when input is empty (no competition with search).
  - Limited to the 5 most recent record-type entries.
  - New i18n key `console.commandPalette.recentRecords` (en + zh seeded;
    other locales fall back to `defaultValue: "Recently viewed"`).

- b2d1704: feat(cmdk): record search across objects in the Command Palette
  - New `useRecordSearch` hook in `@object-ui/react` debounces a query, fans out
    to `dataSource.find(name, { $search, $top })` across candidate objects, and
    aggregates hits. Race-safe via a monotonic runId; per-object 404s are
    silently dropped via `Promise.allSettled`.
  - `CommandPalette` (`@object-ui/app-shell`) now accepts a `dataSource` prop;
    when supplied, the palette renders a `Records` group at the top with hits
    scoped to the active app's nav objects. Item `value` embeds the live query
    so cmdk's client-side filter doesn't hide async results.
  - Added `console.commandPalette.records` i18n key (`Records` / `记录`).

- 921bd28: Console now honors `App.homePageId` for the bare `/console/apps/:appName`
  landing route. Previously it always redirected to the first reachable nav
  item, so CRM-style apps with KPI dashboards still landed users on the
  first object list (e.g. Leads) rather than the configured home page.

  The new `resolveLandingRoute` looks up the `homePageId` nav item, builds
  its route (object / view / page / dashboard / report), and falls back to
  the existing `findFirstRoute` only when no `homePageId` is set or it
  resolves to a routeless item type.

- 3ebba63: Fix silent blank page on shorthand record deep-links.

  Three related fixes that all addressed the same UX: a user follows a URL
  shaped `/{object}/{recordId}` and sees a completely blank content area.
  1. **`useNavigationOverlay` produced the broken URL itself.** When
     middle-click / Cmd-click opened a gallery card in a new tab and no
     `onNavigate` was provided, the hook built `/{object}/{id}` — a URL
     shape that does not match any route in the console route table. The
     builder now emits the canonical `/{object}/record/{id}`.
  2. **Shorthand redirect for externally shared links.** Even with the
     producer fixed, links pasted from email / Slack / older builds
     still use the shorthand. The console now intercepts
     `/{:objectName}/:maybeRecordId` and, when the second segment looks
     like a record id (URL-safe slug ≥ 6 chars, not a reserved keyword),
     redirects to `/{objectName}/record/{recordId}` preserving query and
     hash.
  3. **Visible 404 fallback.** Routes that match nothing at all now
     render an explicit "Page not found" empty state with a "Go back"
     action instead of leaving the content area blank. Silent failures
     are now visible failures.

- a4a0e1d: Add `<PresenceProvider>` abstraction with `useTenantPresence()` and
  `useRecordPresence(objectName, recordId)` hooks. The default source is a
  no-op so hooks return `[]` until a host app wires in a realtime
  transport (WebSocket / SSE). Replaces the two architectural TODOs in
  `AppHeader` (tenant scope) and `RecordDetailView` (record scope) that
  were waiting on this abstraction.

  `AppHeader` now falls back to `useTenantPresence()` when the
  `presenceUsers` prop is omitted, and `RecordDetailView` renders
  `<PresenceAvatars>` next to the lifecycle badge when other users are
  viewing the same record. Both code paths render exactly as before when
  no provider is mounted, so this change is non-visual for existing
  consumers.

### Patch Changes

- 9997cae: DataSource: add optional `bulkUpdate(resource, ids, patch)` for "same patch, many rows" interactions (Slack "mark all as read", Linear "archive selected"). The ObjectStack adapter routes to `POST /api/v1/data/:object/updateMany` so the client pays one HTTP/auth/RLS round-trip instead of N parallel PATCHes, eliminating mark-all-read jank on inboxes with 50+ unread.

  AppHeader's `markAllRead` now prefers `bulkUpdate`, with a transparent fallback to the per-id loop for adapters that don't implement the helper.

- 0a644f0: feat(app-shell): CommandPalette searching indicator

  When `useRecordSearch` is mid-flight (debounced fetch across objects
  hasn't returned yet), the palette now surfaces a subtle visual:
  - A small pulsing primary-coloured dot next to the **Records** group
    heading, so the user sees that more results may still appear.
  - A `Searching…` placeholder inside the empty state when the user has
    typed something but no hits exist yet — replaces the static
    "No results found." message until the request settles.

  New i18n key `console.commandPalette.searching` (en + zh).

- 5f71924: feat(app-shell): better default toast UX in ConsoleToaster

  `ConsoleToaster` now ships UX-positive defaults that match the Linear
  / Notion pattern users expect from an enterprise console:
  - `position="top-right"` — keeps the user's primary work area (centre
    - bottom) unobstructed.
  - `closeButton` — every toast has an explicit X so users can dismiss
    rather than wait the duration out.
  - `richColors` — type-aware coloured backgrounds (success / error /
    warning / info) so the kind of message is legible at a glance.
  - `expand` — toast stack expands on hover so users can read multiple
    recent toasts without dismissing.
  - `visibleToasts={4}` — prevents the corner from being overrun.
  - `duration: 4000` — long enough to read + click an `Undo` action.

  All of these are still overridable via `<ConsoleToaster …>` props.

- 5425608: CRM UX polish pass — calmer enterprise look across detail + kanban.
  - **plugin-kanban**: column headers now use a 2px muted accent stripe with
    neutral foreground titles + a quiet grey count pill instead of full
    rainbow gradient + colored title + colored count. Pipeline boards
    (Opportunity, Case, Task, Lead) look like Salesforce/Linear instead of
    a toy. WIP-limit overflow remains destructive-red so urgency stays loud.
  - **plugin-detail (`record:reference_rail`)**: new `hideEmpty` prop
    (default true) collapses entries whose total === 0 into a single
    `+ N empty (Quotes · Products …)` chip at the bottom of the rail.
    Removes the 4–7 "No records" stack that dominated the aside.
  - **plugin-detail (`record:path`)**: completed stages now render with an
    emerald-tinted background + bold green check instead of low-contrast
    `bg-muted text-muted-foreground` (which read as "light grey on white"
    and was borderline unreadable).
  - **app-shell (`RecordDetailView`)**: record-not-found short-circuit.
    Previously a stale/missing recordId still rendered the page chrome
    (rail, discussion, breadcrumb with the raw id), making invalid links
    look like a partially broken page. Now renders a clean centered
    `Empty` state with database icon + i18n'd "Record not found" copy.
  - **i18n**: added `detail.showEmptyRelated_{one,other}` and
    `empty.recordNotFound{,Description}` keys (en + zh).

- 710fbe6: feat(app-shell): notification center animation polish

  InboxPopover now animates every signal that matters for "noticing":
  - Bell button **bounces once** when total pressure increases (new
    notification or approval arrives). Tracks previous total via a ref
    so the very first render — when the server-side counts hydrate —
    does not trigger a spurious bounce.
  - Bell badge **zooms in** on every count change (re-keyed on
    `totalBadge` so each transition is an independent animation).
  - Per-tab counter badges (Notifications / Approvals) get the same
    zoom-in treatment on count change.
  - Notification list rows **fade + slide in from top** with a small
    staggered delay (capped at 6×20ms so a full list never feels
    laggy).
  - Activity rows mirror the same fade/slide pattern.
  - Empty states (`You're all caught up`, `No recent activity`, `No
pending approvals`) fade in instead of popping in.
  - The unread dot (•) is now always rendered but fades its opacity
    when `is_read` flips, instead of disappearing instantly — gives a
    smooth "marked read" affordance.

  All animations are wrapped in `motion-safe:` utility variants so
  users with `prefers-reduced-motion` see the previous (instant) UI.
  No new dependencies; reuses `tailwindcss-animate` utilities already
  present in the design system.

- 7c441f5: End-to-end @-mention notifications.

  `@object-ui/plugin-detail` now exports `extractMentions(text, suggestions)`
  — a small utility that resolves `@<label>` tokens in a comment body to
  user ids, using the same suggestion list that drives the in-editor
  dropdown. Handles labels with spaces ("@QA Test"), CJK ("@王小明"),
  longest-match disambiguation ("Anna Lee" wins over "Anna"), and ignores
  unknown @-tokens. 9 unit tests.

  `@object-ui/app-shell` `RecordDetailView` now:
  1. Serializes the resolved mention ids into `sys_comment.mentions`
     (previously hard-coded `'[]'`, so servers had no idea who was being
     pinged).
  2. Fan-outs a `sys_notification` row per mentioned recipient
     (self-mentions are filtered as noise) with the canonical bell-inbox
     shape: `type: 'mention'`, `recipient_id`, `actor_name`, `title`,
     `body` preview (≤140 chars), `source_object`/`source_id`/
     `source_comment_id`, `is_read: false`, `created_at`.

  The notification write tolerates 404 silently, so deployments without
  a notification collection degrade to the previous behavior (mention
  text + highlight, no inbox row). Spec-compliant servers that emit
  notifications via their own sys_comment after-create hook can ignore
  the client-side write — the bell de-dupes by id at the polling layer.

- 072cad0: Always seed @-mention suggestions with the current user so the dropdown
  appears even when the backend has no `sys_user` directory (or the fetch
  fails). Hosts with a real user roster still get the merged list —
  current user first, then directory entries de-duped by id.

  Previously, typing `@` in the discussion comment box was a no-op on
  example backends that don't serve `sys_user`, making the feature look
  broken. Authors can now at minimum mention themselves; richer rosters
  are merged in automatically when available.

- 54e3dfb: Remove unused stub renderers from `@object-ui/app-shell`:
  - `ObjectRenderer` / `ObjectRendererProps`
  - `DashboardRenderer` / `DashboardRendererProps`
  - `PageRenderer` / `PageRendererProps`
  - `FormRenderer` / `FormRendererProps`

  These were placeholder components that never delegated to a real
  SchemaRenderer — they rendered a literal `"TODO"` string and were not
  consumed anywhere in the monorepo or in the official Console app.
  Because they were non-functional, no working production code could
  have depended on them; this is treated as a patch-level cleanup rather
  than a semver-major break.

  If you were importing one of the removed stubs (and somehow got past
  the "TODO" placeholder render), the real renderers ship from the
  respective plugin packages:
  - Dashboard → `@object-ui/plugin-dashboard` (`DashboardRenderer`)
  - Page / Object / Form → `@object-ui/react` (`SchemaRenderer`) +
    `@object-ui/plugin-form` / `@object-ui/plugin-grid` etc.

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [321294c]
- Updated dependencies [b2d1704]
- Updated dependencies [0a644f0]
- Updated dependencies [a3cb88f]
- Updated dependencies [5425608]
- Updated dependencies [6c3f018]
- Updated dependencies [d912a60]
- Updated dependencies [87bc8ff]
- Updated dependencies [3ebba63]
- Updated dependencies [e919433]
- Updated dependencies [a8d12ec]
- Updated dependencies [a4a0e1d]
- Updated dependencies [70b5570]
- Updated dependencies [aa063db]
- Updated dependencies [d9c3bae]
- Updated dependencies [d1442e3]
- Updated dependencies [7c7400a]
- Updated dependencies [b703480]
- Updated dependencies [e7b6eae]
  - @object-ui/types@5.2.0
  - @object-ui/data-objectstack@5.2.0
  - @object-ui/core@5.2.0
  - @object-ui/i18n@5.2.0
  - @object-ui/react@5.2.0
  - @object-ui/fields@5.2.0
  - @object-ui/components@5.2.0
  - @object-ui/collaboration@5.2.0
  - @object-ui/layout@5.2.0
  - @object-ui/auth@5.2.0
  - @object-ui/permissions@5.2.0
  - @object-ui/providers@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/fields@5.1.1
  - @object-ui/layout@5.1.1
  - @object-ui/types@5.1.1
  - @object-ui/core@5.1.1
  - @object-ui/i18n@5.1.1
  - @object-ui/react@5.1.1
  - @object-ui/data-objectstack@5.1.1
  - @object-ui/auth@5.1.1
  - @object-ui/permissions@5.1.1
  - @object-ui/collaboration@5.1.1
  - @object-ui/providers@5.1.1

## 5.1.0

### Minor Changes

- d1ec6a2: Fold inline-edit into the page-header overflow menu (HubSpot/Lightning
  pattern) and remove the orphan "Edit fields" toolbar row that previously
  floated between the tab strip and the first detail section.
  - `@object-ui/app-shell` `RecordDetailView`: injects a new `sys_inline_edit`
    system action that appears in the ⋯ overflow menu and dispatches a
    `objectui:record:inline-edit-toggle` window CustomEvent (filtered by
    recordId + objectName).
  - `@object-ui/plugin-detail` `DetailView`: listens for that event to
    toggle inline-edit mode; the in-page toolbar now renders only during
    active editing / save error / locked states, so the idle layout flows
    tabs → first section card with no orphan row.
  - `@object-ui/components` layout containers: extended `KNOWN_LABEL_DICT`
    with zh-CN + zh-TW translations for common CRM related-list labels
    (Quotes / Products / Contacts / Accounts / Leads / Opportunities /
    Cases / Campaigns / Approvals / Documents / Emails / Calls / Meetings
    / Open Tasks / Closed Tasks), so authored English labels auto-translate
    in `page:accordion` / `page:tabs` items.

- cf30cc2: Polish Lightning record detail page layout.
  - `record:details` sections now render with Card chrome by default when a `title` is present, restoring visual grouping that was missing on pages like the opportunity detail page.
  - Section labels can be translated via the `{ns}.objects.{objectName}._sections.{name}.label` convention. Author each section with a stable `name` (e.g. `info`, `forecast`) and the renderer picks up the locale-specific label automatically. Falls back to the literal `label` when no translation exists.
  - The `page:header` action toolbar now collapses into a `⋯` overflow menu when more than two actions are present. The first business action stays inline; secondary system actions (Edit / Share / Delete) move into the menu, with destructive styling applied to Delete.
  - Header action labels resolve via the `{ns}.objects.{objectName}._actions.{name}.label` convention.
  - Removed the meaningless field-count Badge from collapsible section headers (the `2` chip next to "Description"). Field-count metadata wasn't useful in the header and added visual noise.
  - Synth-path `sys_delete` now carries `variant: 'destructive'` so the overflow menu can color it appropriately.

- c0b236f: Platform detail/form polish:
  - **Auto-section grouping**: When an object has no authored `views.form.sections`, the detail page now splits fields into a primary section and a collapsible "More details" section based on a field-type/name heuristic (textarea / markdown / description / notes / remarks). Eliminates the wall-of-fields layout on objects without explicit detail metadata.
  - **FormSection card chrome**: `FormSection` now accepts `showBorder`. Defaults to `true` for titled sections (Card wrapper) and `false` for untitled sections (flat). Same auto-default already applied to `DetailSection`.
  - **Origin breadcrumb**: Navigating from a list/kanban into a record now records the source view; the detail page shows a `← <view label>` back-link above the page header.
  - New i18n key `detail.sectionMoreDetails` (en + zh-CN).

### Patch Changes

- d51a577: feat(platform): Discussion attachments + @mention directory + Reference Rail aside
  - **Discussion attachments** — `RichTextCommentInput` now accepts an `extraSlot`
    and a `canSubmitEmpty` flag so hosts can mount the existing
    `CommentAttachment` composer beneath the editor without forking the toolbar.
    `RecordActivityTimeline` plumbs the attachments through
    `DiscussionContext.onUploadAttachments` and submits attachment-only comments.
  - **@mention directory** — `DiscussionContext` gains a `mentionSuggestions`
    field; `RecordDetailView` populates it from the host `sys_user` collection so
    `@` autocomplete in the composer now resolves against real users.
  - **Reference Rail** — New `record:reference_rail` renderer + a dedicated
    `aside` region emitted by `buildDefaultPageSchema` whenever a record has
    ≥ 2 related lists. The rail surfaces a Salesforce/HubSpot-style snapshot
    of related collections (count badge + top 3 records) on `xl+` viewports.
  - **Layout** — `PageRenderer`'s structured-layout `<aside>` wrappers now honor
    `aside.className`, letting schemas attach responsive utilities like
    `hidden xl:flex` to the rail region.

- 1976691: Fix the drawer "Open as full page" (maximize) button on the record drawer
  which threw `TypeError: name.indexOf is not a function` and prevented
  navigation to the dedicated detail page.
  - `@object-ui/app-shell` `ObjectView`: pass `objectDef.name` (string) — not
    the whole `objectDef` — into `viewLabel(...)` when computing the
    `originState.from.label` for both drawer-navigate and list-navigate
    flows. Two call sites fixed.
  - `@object-ui/i18n` `useObjectLabel`: harden `stripNamespace` so it
    tolerates non-string inputs and returns an empty string instead of
    throwing, providing a safety net for similar future regressions.

- a49f300: feat(detail): per-object Reference Rail opt-out via `objectDef.detail.hideReferenceRail`

  The Record-detail Reference Rail (right-hand related-list summary cards)
  can now be suppressed on a per-object basis without authoring a full
  custom `Page`. Catalog-style objects (Product, Task) ship with the rail
  off by default; hub objects (Account, Opportunity, Contact, Case) keep it
  on.
  - `RecordDetailView` now reads `(objectDef as any)?.detail?.hideReferenceRail`
    and `…?.hideRelatedTab` and threads them to `buildDefaultPageSchema`.
  - The Reference Rail renderer also accepts entries authored as either a
    flat `entries` array or nested under `properties.entries`, so explicit
    `Page` authors can opt-in via the standard spec shape.
  - See `packages/plugin-detail/README.md` (Reference Rail decision matrix)
    for the rationale and per-object guidance.

- e9767b0: Remove dead `sys_presence` REST probes from `RecordDetailView` and `AppHeader`. Real-time
  presence does not belong in a regular REST collection — the feature is being redesigned
  behind a transport-level `<PresenceProvider>` (see ROADMAP). This change removes the
  probe (and associated state / unused UI mounts) so the browser no longer makes silently
  swallowed 404 requests on every record open / app navigation. UI surface area is
  unchanged for end users (the previous code never rendered viewers when the probe failed).
- Updated dependencies [bd8447d]
- Updated dependencies [fbd5052]
- Updated dependencies [d51a577]
- Updated dependencies [1976691]
- Updated dependencies [d1ec6a2]
- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
- Updated dependencies [49b1760]
- Updated dependencies [c0b236f]
- Updated dependencies [d548d6b]
  - @object-ui/components@5.1.0
  - @object-ui/react@5.1.0
  - @object-ui/i18n@5.1.0
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0
  - @object-ui/data-objectstack@5.1.0
  - @object-ui/fields@5.1.0
  - @object-ui/layout@5.1.0
  - @object-ui/auth@5.1.0
  - @object-ui/collaboration@5.1.0
  - @object-ui/permissions@5.1.0
  - @object-ui/providers@5.1.0

## 5.0.2

### Patch Changes

- cab6a93: **plugin-grid:** column summary footer now formats values using the
  column's type metadata. Currency columns render `Sum: $1,760,000.00`
  instead of bare `Sum: 1,760,000`; percent columns honor `0–1` vs
  `0–100` value ranges; avg uses two fraction digits. `useColumnSummary`
  accepts an optional `fieldMetadata` map (typically `objectSchema.fields`)
  so per-field `type`, `currency`, `defaultCurrency`, `precision` are
  respected.

  **plugin-gantt:** added safe-fallback `useGanttTranslation` hook. All
  hardcoded toolbar `aria-label`s and the `Task Name` / `Start` / `End` /
  `Today` column-header strings now flow through `t('gantt.*')`. A new
  `gantt.*` section is exported from the en/zh/ja/ko/de/fr/es/pt/ru/ar
  locales.

  **app-shell:** `ReportView` no longer hardcodes the `Edit` button label
  or the `Loading report…` fallback — they now use `common.edit` and
  `common.loading`.

  **i18n:** added top-level `gantt` section (with English fallbacks in
  non-en/zh locales) and the `common.addToFavorites` /
  `common.removeFromFavorites` keys across all ten built-in locales so
  the `builtInLocales` parity tests pass.

- Updated dependencies [cab6a93]
  - @object-ui/i18n@5.0.2
  - @object-ui/components@5.0.2
  - @object-ui/fields@5.0.2
  - @object-ui/react@5.0.2
  - @object-ui/layout@5.0.2
  - @object-ui/types@5.0.2
  - @object-ui/core@5.0.2
  - @object-ui/data-objectstack@5.0.2
  - @object-ui/auth@5.0.2
  - @object-ui/permissions@5.0.2
  - @object-ui/collaboration@5.0.2
  - @object-ui/providers@5.0.2

## 5.0.1

### Patch Changes

- cb4879e: form
  - @object-ui/types@5.0.1
  - @object-ui/core@5.0.1
  - @object-ui/i18n@5.0.1
  - @object-ui/react@5.0.1
  - @object-ui/components@5.0.1
  - @object-ui/fields@5.0.1
  - @object-ui/layout@5.0.1
  - @object-ui/data-objectstack@5.0.1
  - @object-ui/auth@5.0.1
  - @object-ui/permissions@5.0.1
  - @object-ui/collaboration@5.0.1
  - @object-ui/providers@5.0.1

## 5.0.0

### Minor Changes

- 8930b15: feat(detail): close the gap between Page-assigned and default record detail pages (Track 1)

  Custom Lightning-style record detail pages (assigned via `assignedPage` /
  `Page` schemas) used to feel meaningfully poorer than the auto-generated
  default detail view. They were missing cross-cutting affordances and
  shipped with English-only tab labels and heavy bordered section cards
  even when the host locale was Chinese. Track 1 closes the visible gap:
  - **app-shell `RecordDetailView`**: the `assignedPage` branch now wears
    the same chrome as the default branch — lifecycle managed-by badge
    and presence avatars in the top-right, `MetadataPanel` debug panel,
    `ActionConfirmDialog` / `ActionParamDialog`, and an auto-appended
    `RecordChatterPanel` at the bottom of the page. Authors opt out of
    the auto-discussion with `assignedPage.disableDiscussion = true`.
  - **plugin-detail `record:details`**: defaults to `inlineEdit: true` so
    fields are click-to-edit just like the default page, and synthesises
    sections with `showBorder: false` by default so a Lightning page
    doesn't double-wrap every block in a heavy Card.
  - **components `page:tabs` / `page:accordion`**: well-known English
    labels (Details / Related / Activity / History / Notes / Files /
    Tasks / Events / Attachments / Chatter / Discussion / Comments /
    Overview / Summary) auto-translate to Chinese (`zh-CN` / `zh-TW`)
    via a built-in dictionary keyed off `document.documentElement.lang`.
    Authors supplying explicit localised labels (string or
    `{ default, zh-CN, ... }`) are not affected.
  - **i18n provider**: applies the initial language to
    `document.documentElement.lang` on mount (i18next does not fire
    `languageChanged` for the bootstrap language), so locale-aware
    renderers downstream see the right value from the first render.

- 186aee8: feat(detail): default-on renderViaSchema for non-assignedPage records

  Track 3 Phase G slice 6. The synthesized Page schema path (slice 2,
  behind `?renderViaSchema=1`) is now the default rendering pipeline for
  every object without a custom assignedPage. Visual and functional
  parity verified on task and account before flipping.

  Switches preserved: `?renderViaSchema=0` URL fallback,
  `objectDef.detail.renderViaSchema = false` per-object opt-out.

- 927187a: Phase N.1 + N.2: visual polish for record detail pages.

  **N.1 — System actions on full Lightning pages.** `PageHeaderRenderer`
  now merges `headerSystemActions` from `RecordContext` with authored
  actions (authored wins on name/id collision), so full custom pages
  (lead, opportunity, ...) once again show 编辑 / 分享 / 删除 alongside
  their authored actions. `sys_share` and `sys_delete` now use the
  `outline` variant instead of `destructive` to read better in
  multi-button clusters.

  **N.2 — Hide empty fields by default in synth detail pages.**
  `record:details` defaults `section.hideEmpty` to `true` so synthesized
  pages don't render label graveyards on first load. The "显示 N 个空字段"
  reveal toggle is preserved as the user-facing escape hatch. Authors can
  opt back into showing every field by setting `hideEmpty: false` on the
  section schema.

- 8435860: Phase N.4b: highlight↔body dedup now works for hand-authored Lightning
  pages too.

  Adds a small `HighlightFieldsContext` registry. `record:highlights`
  registers the field names it currently surfaces; `record:details` unions
  that live set into its `hideFieldNames` filter so a field shown in the
  highlight strip is never duplicated in the section grid below.

  Previously the dedup only fired for synth-generated pages (via the
  `hideFields` prop passed by `buildDefaultPageSchema`). Custom Lightning
  pages (e.g. opportunity) showed `所属客户` both in the strip and in the
  body. The registry-based approach covers both code paths uniformly with
  no schema author work required.

  The registry uses `useSyncExternalStore` so adding/removing highlights
  notifies consumers without triggering the provider value identity to
  change — avoiding the update-loop that a naive context implementation
  would cause.

  `RecordDetailView` mounts `<HighlightFieldsProvider>` once per record
  page so the two renderers share state.

- 74962b0: feat(detail): record:discussion schema component + flush accordion variant
  - New `record:discussion` schema type lets authors place the record
    chatter feed anywhere in a custom Page schema. Wired through a
    shared `DiscussionContext` provider on the `assignedPage` branch
    of `RecordDetailView`; auto-append still applies when no explicit
    `record:discussion` / `record:chatter` node is present.
  - `page:accordion` gains a `variant` prop. Default `flush` strips the
    per-item border so accordion sections no longer double-wrap inner
    Card-bearing renderers (RelatedList, etc.). Authors who want the
    old visual pass `variant: 'card'`.
  - `translateLabel` now handles compound labels split by `&`, `and`,
    or `和` (e.g. `Notes & Attachments` → `备注与附件`).

- fa4c2cb: feat(detail): renderViaSchema opt-in routes default detail through SchemaRenderer (Track 3 Phase G slice 2)

  When `?renderViaSchema=1` is in the URL, or `objectDef.detail.renderViaSchema === true`,
  `RecordDetailView`'s no-assignedPage branch now synthesizes a canonical
  Page schema (`page:header` → `record:highlights` → `record:path` →
  `page:tabs(record:details)` → `record:discussion`) via
  `buildDefaultPageSchema(objectDef, { sections, highlightFields })` and
  renders it through the existing `<SchemaRenderer>` pipeline.

  This means every object without a custom assigned page can opt in to
  the same chrome (record-aware header chip, chevron path, flush
  accordion, discussion slot) that custom Lightning pages already enjoy.

  Changes:
  - `buildDefaultPageSchema` now emits `page:tabs.items` (correct shape
    for the renderer) rather than `tabs`.
  - `PageHeaderRenderer.resolvedTitle` honors `objectSchema.primaryField`
    before the legacy `name/title/display_name/label` fallbacks.
  - `RecordDetailView` rebuilds the synthesized schema with
    `detailSchema.sections` + `highlightFields` at render time so
    `record:details` inherits the same field layout the legacy
    `<DetailView>` would have produced.

  Flag is intentionally off by default — flipping the default is a
  separate explicit commit after empirical parity validation across
  multiple objects. Known gaps tracked for slice 3: titleFormat
  fallback for objects without `primaryField`, auto Activity / History
  tabs, header-action buttons.

- 7213027: feat(detail): slotted record pages (Track 3 Phase I)

  Introduce `kind: "slotted"` record pages that override one or more
  named slots while letting the default-page synthesizer fill in the
  rest. Authors no longer need to re-author the entire page just to
  customize the header or one tab.

  **Slot menu (v1):**
  - `header` — replaces `page:header`
  - `actions` — replaces the `record:quick_actions` action bar
  - `highlights` — replaces the chips + chevron path strip
  - `details` — replaces the Details tab body (other tabs stay synthesized)
  - `tabs` — replaces the entire `page:tabs` node (wins over `details`)
  - `discussion` — replaces the inline `record:discussion` footer

  Each slot is a full replacement at the slot boundary. To compose
  default + custom, call the corresponding `buildDefault*` sub-builder
  (now exported from `@object-ui/plugin-detail`):
  `buildDefaultHeader`, `buildDefaultActions`, `buildDefaultHighlights`,
  `buildDefaultDetails`, `buildDefaultTabs`, `buildDefaultDiscussion`.

  **Author shape:**

  ```ts
  {
    type: 'record',
    object: 'account',
    kind: 'slotted',
    slots: {
      header: { type: 'page:header', properties: { ... } },
    },
  }
  ```

  **API changes:**
  - `PageSchema` (in `@object-ui/types`): adds `kind?: 'full' | 'slotted'`
    (default `'full'`) and `slots?: PageSlotMap`.
  - `usePageAssignment` (in `@object-ui/react`): result now exposes a
    `slots` field populated when the matched page has `kind === 'slotted'`.
    Existing `page` field is unchanged for full pages.
  - `buildDefaultPageSchema` (in `@object-ui/plugin-detail`): accepts an
    `options.slots` map that overrides individual regions at synthesis time.

- 34b66bf: feat(detail): synthesize Related / Activity / History tabs + record:quick_actions header (Track 3 Phase G slice 4)
  - `buildDefaultPageSchema` now accepts `headerActions`, `related`,
    `showActivity`, and `history` options. When provided, the synthesizer
    emits a `record:quick_actions` node after `page:header` and appends
    the corresponding tabs to `page:tabs.items` in stable order
    (Details / Related / Activity / History).
  - New `record:history` renderer wraps the existing `HistoryTimeline`,
    reading `entries` / `loading` from the schema. Host owns fetching.
  - `RecordDetailView` forwards `detailSchema.actions[0].actions`,
    `detailSchema.related[]` (unwrapped to `{objectName,relationshipField}`),
    and `detailSchema.history` into the synthesizer call so the
    `renderViaSchema` path reaches parity with the monolithic DetailView
    tab strip and header action bar.
  - 6 new unit tests covering headerActions emit/skip, Related tab
    shape, Activity opt-in, History entries pass-through, and stable
    tab ordering.

  No behavior change for objects without the `renderViaSchema` opt-in.

- c7561a7: **Unify per-user UI state storage onto `sys_user_preference`.**

  `createObjectStackUserStateAdapter` previously wrote to a bespoke
  `user_app_state` object using `(user_id, kind, payload)` columns. That
  parallel KV table duplicated the canonical per-user preference store
  shipped by `@objectstack/plugin-auth`, and pulled UI traces (favorites,
  recent items, grid widths) out of the place users actually look for
  their settings.

  The adapter now defaults to:
  - `resource`: `sys_user_preference`
  - field shape: `(user_id, key, value)` instead of `(user_id, kind, payload)`
  - option name: **`key`** instead of `kind`

  `ConsoleShell` is updated to attach favorites/recent under the namespaced
  keys `ui.favorites` and `ui.recent`. Recommended convention for new
  adapters: keep machine-written UI traces under `ui.*` so they stay
  distinguishable from user-facing preferences (`theme`, `locale`, ...).

  **Migration**: callers passing `kind:` need to switch to `key:`. Callers
  relying on the old `user_app_state` table can pin
  `resource: 'user_app_state'` to keep the legacy behaviour, but no
  backend ships that schema and the new default works against any
  plugin-auth-enabled environment with zero extra setup.

### Patch Changes

- 983d5ad: fix(app-shell): suppress duplicate discussion panel on record detail pages

  `RecordDetailView` auto-appends a `RecordChatterPanel` below the
  rendered page unless an explicit `record:discussion` / `record:chatter`
  node is found in the schema. The detection walker recursed into
  `children / items / body / components / properties.*` but **not**
  `regions[]`. Synthesised pages (`buildDefaultPageSchema`) and authored
  full-Lightning pages place `record:discussion` inside
  `regions[0].components`, so the walker missed it and a second
  discussion panel rendered on top of the first.

  Extracted the walker into `utils/pageSchemaIntrospect.ts`, added a
  `regions` branch, and covered both shapes with unit tests.

  Verified in browser on account (slotted), opportunity (full), lead,
  contact, and task — each renders exactly one discussion panel.

- a4c10b2: Restore Edit / Share / Delete system actions on synthesized record detail headers.

  Phase G slice 6 flipped the synth detail page on by default but did not
  forward the legacy DetailView's built-in system actions to the new
  `record:quick_actions` bar. Objects without authored `record_header`
  business actions ended up with a bare header (only the ★ favorite +
  copy-id chip from `page:header`).

  This patch injects gated system actions into `synthHeaderActions` for
  both the synth and slotted paths:
  - `sys_edit` — visible when `affordances.edit`. Calls the existing
    `onEdit` prop, opening the same form modal as before.
  - `sys_share` — always visible. Uses `navigator.share` when available;
    falls back to clipboard copy of the current URL with a toast.
  - `sys_delete` — visible when `affordances.delete`. Confirms via
    `window.confirm`, calls `dataSource.delete`, then navigates back to
    the list.

  Business / custom actions (e.g. Lead.convert, Contact.set_primary)
  continue to render alongside the system actions, unchanged. Full
  Lightning pages (objects with an `assignedPage`) are unaffected — they
  remain author-owned.

- Updated dependencies [542cca9]
- Updated dependencies [8930b15]
- Updated dependencies [95b6b21]
- Updated dependencies [ddb08a7]
- Updated dependencies [f16a762]
- Updated dependencies [765d50f]
- Updated dependencies [927187a]
- Updated dependencies [bae8ba8]
- Updated dependencies [8435860]
- Updated dependencies [bece8ca]
- Updated dependencies [bb2ea48]
- Updated dependencies [77c1877]
- Updated dependencies [b14fe09]
- Updated dependencies [1911d34]
- Updated dependencies [ba98039]
- Updated dependencies [a7bef6e]
- Updated dependencies [86c04f1]
- Updated dependencies [74962b0]
- Updated dependencies [8b850b5]
- Updated dependencies [3154334]
- Updated dependencies [fa4c2cb]
- Updated dependencies [7213027]
- Updated dependencies [34b66bf]
- Updated dependencies [c7561a7]
  - @object-ui/plugin-detail@5.0.0
  - @object-ui/components@5.0.0
  - @object-ui/i18n@5.0.0
  - @object-ui/layout@5.0.0
  - @object-ui/react@5.0.0
  - @object-ui/types@5.0.0
  - @object-ui/data-objectstack@5.0.0
  - @object-ui/plugin-calendar@5.0.0
  - @object-ui/plugin-kanban@5.0.0
  - @object-ui/fields@5.0.0
  - @object-ui/plugin-charts@5.0.0
  - @object-ui/plugin-chatbot@5.0.0
  - @object-ui/plugin-dashboard@5.0.0
  - @object-ui/plugin-designer@5.0.0
  - @object-ui/plugin-form@5.0.0
  - @object-ui/plugin-grid@5.0.0
  - @object-ui/plugin-list@5.0.0
  - @object-ui/plugin-report@5.0.0
  - @object-ui/plugin-view@5.0.0
  - @object-ui/auth@5.0.0
  - @object-ui/collaboration@5.0.0
  - @object-ui/core@5.0.0
  - @object-ui/permissions@5.0.0

## 4.8.0

### Minor Changes

- 3a17c8d: Mobile UI: aggressive chrome reduction to match real mobile-app conventions.

  Real mobile CRMs (Salesforce, HubSpot, Notion, Linear) keep one row of
  chrome on phones: title + 1 primary action, plus content. We were
  shipping ~5 rows of toolbars + chips + tabs above the data. This commit
  hides the desktop-only chrome at the `<sm` breakpoint:
  - **ListView**: TabBar (view switcher), UserFilters chip row, quick-filters
    chip row, Sort button, list-scoped Search popover, and the
    (newly-added) mobile-only ViewSettingsPopover gear are all hidden on
    phones. Only the **Filter** icon survives on mobile — paired with the
    global ⌘K top-bar search, that is the entire mobile control surface.
  - **Kanban**: previous commit replaced verbose swipe text with a dot
    indicator; that stands.
  - **ObjectView page header**: the Import (CSV upload) button is hidden
    on mobile — CSV import is a desktop workflow.

  Net effect on a 390px viewport: ListView toolbar collapses from
  ~10 controls (5 chips + 5 icons) to a single Filter icon next to the
  title; the body of the page is reachable without scrolling past 3 rows
  of chrome.

  Desktop and tablet behavior is unchanged.

- 51e274a: feat(app-shell,plugin-list): mobile Airtable-style topbar + filter chip row

  Refactor mobile object-view layout to match the Airtable Interface
  pattern:
  - **AppHeader**: the mobile topbar's static page label is now a
    view-switcher dropdown (`<viewName> ▾`). Tapping opens a list of
    available views with icons + active-state checkmark. Falls back to
    plain text when only one view exists, or when the current page has
    no view-switching surface (Home, Settings, …).
  - **ObjectView**: drops the standalone mobile `sm:hidden` view-select
    row that previously lived between the desktop tab bar and the
    content area. View switching is now exposed exclusively via the
    topbar dropdown on mobile, eliminating the duplicated `object name`
    vs `view name` rows.
  - **ListView**: un-hides the `UserFilters` chip row on mobile.
    Single-line, horizontally scrollable, matches the Airtable Interface
    filter chip strip.
  - New lightweight `MobileViewSwitcherContext` provides a
    page → header data channel (no zustand dependency added).

  Net effect on mobile (390×844):

  ```
  ☰ 客户卡片 ▾                🔍 🔔 M    ← topbar
  类型 ▾  行业 ▾  是否活跃 ▾  更多 3 ▾  ⛛  ← chip row
  [content cards]                          ← content
                                    (+)    ← FAB
  [Leads | Accounts | Contacts | …]        ← bottom nav
  ```

- 7feed12: Mobile UX: Home affordance + chrome reduction

  Two fixes that match what users actually need on a 390px viewport:
  - **Add Home link to mobile sidebar.** When inside an app, the sidebar
    drawer previously listed only the current app's nav groups, with no
    way back to the home page (the desktop topbar's logo and AppSwitcher
    pill are hidden on phones). Now the mobile sidebar opens with a
    prominent "Home" row (`/home`) at the top, gated to mobile + app
    context so the desktop layout is untouched.
  - **Cut a row of top chrome.** The list/object PageHeader (icon + title
    - create / import / more actions) duplicated the page title already
      shown in the topbar. On mobile it's hidden entirely; the primary
      create action moves to a floating "+" button anchored above the
      bottom nav. Desktop still renders the full PageHeader.

- 00363fd: feat(app-shell): remove mobile bottom-tab navigation

  The mobile bottom-tab strip was rendering the first 5 leaf items of
  the app's navigation tree — exactly the same items that the drawer
  (`☰`) surfaces, just without grouping, favourites, or recents.

  Per the Notion / Linear mobile convention, we now rely on the drawer
  alone. Bottom-tab strips work when they expose **orthogonal**
  top-level sections (Airtable's Home / Bases / Notifications / Account)
  — but ours was a duplicate of the drawer, so it was pure visual
  weight: ~52px of vertical real estate, redundant taps, and clashes
  with the FAB and chat-bubble stack at the bottom-right corner.

  Net effect:
  - Drawer remains the single source of in-app navigation.
  - ~52px reclaimed for list/kanban content on every mobile screen.
  - FAB and chat-bubble keep their existing offsets (no overlap;
    bottom-nav was already accounted for above them).

- faba0e3: Mobile UX cleanup:
  - `app-shell/AppHeader`: hide the platform-logo, app-switcher pill, and
    intermediate path separators on mobile when inside an app route. The
    sidebar already exposes those affordances; the topbar now reads
    `☰ + page title + Search + Inbox + Avatar`.
  - `plugin-list`: replace the hidden mobile TabBar with a new compact
    `TabBarSelect` dropdown (current view name + chevron → menu of every
    view). Phone users keep view-switching without burning a row on chip
    pills. Desktop continues to render the inline TabBar.

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/i18n@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0
- @object-ui/fields@4.8.0
- @object-ui/layout@4.8.0
- @object-ui/data-objectstack@4.8.0
- @object-ui/auth@4.8.0
- @object-ui/permissions@4.8.0
- @object-ui/collaboration@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/i18n@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0
- @object-ui/fields@4.7.0
- @object-ui/layout@4.7.0
- @object-ui/data-objectstack@4.7.0
- @object-ui/auth@4.7.0
- @object-ui/permissions@4.7.0
- @object-ui/collaboration@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [3ee436d]
  - @object-ui/components@4.6.0
  - @object-ui/fields@4.6.0
  - @object-ui/layout@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/i18n@4.6.0
  - @object-ui/react@4.6.0
  - @object-ui/data-objectstack@4.6.0
  - @object-ui/auth@4.6.0
  - @object-ui/permissions@4.6.0
  - @object-ui/collaboration@4.6.0

## 4.5.0

### Patch Changes

- d714e85: Lookup display-name resolution now falls back through a Salesforce-style chain
  when an `$expand`'d reference object lacks a top-level `name`/`label`/
  `display_name`/`title` field:
  1. Standard display fields (existing behaviour)
  2. `salutation first_name last_name` composite — handles person records that
     only carry first/last name parts
  3. `email` — last-resort identifier, beats the opaque id

  Applies to `LookupCellRenderer`, `PageHeader.subtitle` interpolation,
  `DetailView` page-mode `titleFormat`, and the shared `formatRecordTitle`
  utility. Concretely: a Contact reference with `first_name: Bob`, `last_name:
Lin` and no `name` field now renders as `Bob Lin` everywhere — instead of
  the email or [object Object] fallback.

- Updated dependencies [ab5e281]
- Updated dependencies [d714e85]
- Updated dependencies [6b6afd1]
- Updated dependencies [22fa558]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/types@4.5.0
  - @object-ui/fields@4.5.0
  - @object-ui/layout@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/i18n@4.5.0
  - @object-ui/auth@4.5.0
  - @object-ui/collaboration@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/data-objectstack@4.5.0
  - @object-ui/permissions@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- 501ce20: fix(detail): hide system/tenant fields from auto-generated record detail

  The auto-generated detail section (used when an object has no explicit form
  sections) was leading every record page with `organization_id` (rendered as
  "ORGANIZATION: Admin's Workspace") — pure tenancy metadata with no business
  value. Extended the existing audit-field filter to also drop
  `organization_id`, `tenant_id`, `is_deleted`, and `deleted_at`. Objects that
  intentionally surface tenant info can still do so via explicit
  `views.form.sections`.

- 63eb66d: fix(detail): expand lookup fields so subtitle + lookup cells show display names

  The record-page fetch in `RecordDetailView` (the page-mode path) now
  requests `$expand` for every lookup/master_detail field on the object,
  mirroring the behaviour the legacy `DetailView` already had. Combined
  with two small downstream fixes — `PageHeader` subtitle interpolation
  now extracts `name/label` from expanded reference objects instead of
  rendering `[object Object]`, and `LookupCellRenderer` now short-circuits
  to `pickRecordDisplayName` when the value is already a nested record —
  all `record:*` renderers and the page header subtitle (`Owned by
{account}`) now display the related record's name rather than the raw
  foreign-key id.

- 2bd45af: feat(shell): main becomes the scroll container; record tabs are sticky
  - `AppShell`'s SidebarProvider wrapper is now constrained to viewport
    height (`h-svh overflow-hidden`) instead of expanding with content via
    the default `min-h-svh`. This makes the inner `<main>` (which is
    `overflow-auto`) the actual scroll container instead of the window.
  - `RecordDetailView` page-mode container drops the redundant
    `h-full overflow-auto` (avoids nested scrollers; main owns scroll now).
  - `page:tabs` (horizontal) gets `sticky top-0 z-20` with a translucent
    backdrop so the tab strip stays visible while users scroll through
    long record pages — the Salesforce Lightning behaviour our schemas
    were already implying.

- e33d575: Support dotted paths (e.g. `{account.name}`) in object `titleFormat`. When a
  placeholder resolves to an expanded reference object, automatically extract
  its `name`/`label`/`display_name`/`title` so detail page titles render the
  related record's display name instead of falling through to the object label.
- Updated dependencies [63eb66d]
- Updated dependencies [67dabe1]
- Updated dependencies [ef0e30d]
- Updated dependencies [2bd45af]
  - @object-ui/layout@4.4.0
  - @object-ui/fields@4.4.0
  - @object-ui/components@4.4.0
  - @object-ui/types@4.4.0
  - @object-ui/core@4.4.0
  - @object-ui/i18n@4.4.0
  - @object-ui/react@4.4.0
  - @object-ui/data-objectstack@4.4.0
  - @object-ui/auth@4.4.0
  - @object-ui/permissions@4.4.0
  - @object-ui/collaboration@4.4.0

## 4.3.1

### Patch Changes

- 9167935: fix
- 52af5cf: fix
- Updated dependencies [5f4ac6e]
- Updated dependencies [6b683c8]
- Updated dependencies [0d8eb98]
  - @object-ui/i18n@4.3.1
  - @object-ui/components@4.3.1
  - @object-ui/layout@4.3.1
  - @object-ui/fields@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1
  - @object-ui/data-objectstack@4.3.1
  - @object-ui/auth@4.3.1
  - @object-ui/permissions@4.3.1
  - @object-ui/collaboration@4.3.1

## 4.3.0

### Patch Changes

- 079c3b2: feat(plugin-report): per-block field resolution for joined reports

  Joined report blocks can override `objectName` to query a different
  object than the container, but the editor was always offering the
  container's fields — wrong field names, wrong types, broken granularity
  and chart-axis filtering.

  `ReportConfigPanel` now accepts an optional `getFieldsForObject`
  resolver. `JoinedBlocksEditor` uses it to source fields for each
  block based on `block.objectName ?? containerObjectName`, falling
  back to the static `availableFields` when the resolver returns
  `undefined` (unknown object).

  `ReportView` wires the resolver against the app's loaded `objects`
  list and reuses the same parsing path internally to derive its
  top-level `availableFields`, removing the duplicated schema lookup.

  5 new RTL tests verify the resolver wiring, fallback behaviour,
  add-block flow, and inline duplicate-name validation (111 plugin-report
  tests green).

- 154a36c: fix
- fed4897: fix
- Updated dependencies [f196cf4]
- Updated dependencies [ee1cc96]
- Updated dependencies [0b032be]
- Updated dependencies [115d36a]
- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/i18n@4.3.0
  - @object-ui/components@4.3.0
  - @object-ui/fields@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/layout@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0
  - @object-ui/data-objectstack@4.3.0
  - @object-ui/auth@4.3.0
  - @object-ui/permissions@4.3.0
  - @object-ui/collaboration@4.3.0

## 4.2.1

### Patch Changes

- 47c27c7: fix
  - @object-ui/types@4.2.1
  - @object-ui/core@4.2.1
  - @object-ui/i18n@4.2.1
  - @object-ui/react@4.2.1
  - @object-ui/components@4.2.1
  - @object-ui/fields@4.2.1
  - @object-ui/layout@4.2.1
  - @object-ui/data-objectstack@4.2.1
  - @object-ui/auth@4.2.1
  - @object-ui/permissions@4.2.1
  - @object-ui/collaboration@4.2.1

## 4.2.0

### Patch Changes

- 786de60: ReportView no longer caps the report content at `max-w-5xl` (1024px). Reports now use the full available content width, matching DashboardView behavior. Matrix and grid reports in particular benefit from the additional horizontal real estate.
- Updated dependencies [eb738bd]
- Updated dependencies [650392e]
- Updated dependencies [84b4bf1]
  - @object-ui/i18n@4.2.0
  - @object-ui/components@4.2.0
  - @object-ui/fields@4.2.0
  - @object-ui/react@4.2.0
  - @object-ui/layout@4.2.0
  - @object-ui/types@4.2.0
  - @object-ui/core@4.2.0
  - @object-ui/data-objectstack@4.2.0
  - @object-ui/auth@4.2.0
  - @object-ui/permissions@4.2.0
  - @object-ui/collaboration@4.2.0

## 4.1.0

### Patch Changes

- b4ce9e2: Fix summary reports: render chart + KPIs, correct empty-table on server-aggregated data.
  - `plugin-report`: `SpecReportGrid` now renders a KPI strip (per aggregating column) and a chart section above the grid for `summary` reports. KPI section auto-hides when no aggregating columns. New `buildChartData()` adapter buckets aggregated `ReportRow[]` to chart-ready data, auto-sorts pie/funnel descending, and falls back to row count when the chart `yAxis` points at a non-numeric column. When the data is server-aggregated, the grid switches columns to `[groupings, ${field}__${agg}]` so cells aren't empty against a raw-row column schema.
  - `plugin-charts`: register `'column'` as an alias of `'bar'` in `ChartRenderer` / `AdvancedChartImpl` (Recharts only has `BarChart`).
  - `app-shell`: `ReportView` now routes any object-backed report (matrix/joined/summary/tabular/columns/groupingsAcross) through the spec `ReportRenderer`; fully-legacy `fields`+`data` schemas still use `ReportViewer`.
  - @object-ui/types@4.1.0
  - @object-ui/core@4.1.0
  - @object-ui/i18n@4.1.0
  - @object-ui/react@4.1.0
  - @object-ui/components@4.1.0
  - @object-ui/fields@4.1.0
  - @object-ui/layout@4.1.0
  - @object-ui/data-objectstack@4.1.0
  - @object-ui/auth@4.1.0
  - @object-ui/permissions@4.1.0
  - @object-ui/collaboration@4.1.0

## 4.0.12

### Patch Changes

- e468592: fix
  - @object-ui/types@4.0.12
  - @object-ui/core@4.0.12
  - @object-ui/i18n@4.0.12
  - @object-ui/react@4.0.12
  - @object-ui/components@4.0.12
  - @object-ui/fields@4.0.12
  - @object-ui/layout@4.0.12
  - @object-ui/data-objectstack@4.0.12
  - @object-ui/auth@4.0.12
  - @object-ui/permissions@4.0.12
  - @object-ui/plugin-calendar@4.0.12
  - @object-ui/plugin-charts@4.0.12
  - @object-ui/plugin-chatbot@4.0.12
  - @object-ui/plugin-dashboard@4.0.12
  - @object-ui/plugin-designer@4.0.12
  - @object-ui/plugin-detail@4.0.12
  - @object-ui/plugin-form@4.0.12
  - @object-ui/plugin-grid@4.0.12
  - @object-ui/plugin-kanban@4.0.12
  - @object-ui/plugin-list@4.0.12
  - @object-ui/plugin-report@4.0.12
  - @object-ui/plugin-view@4.0.12
  - @object-ui/collaboration@4.0.12

## 4.0.11

### Patch Changes

- 7ea1d93: dashboard
- Updated dependencies [1909bc3]
  - @object-ui/i18n@4.0.11
  - @object-ui/components@4.0.11
  - @object-ui/fields@4.0.11
  - @object-ui/plugin-calendar@4.0.11
  - @object-ui/plugin-charts@4.0.11
  - @object-ui/plugin-dashboard@4.0.11
  - @object-ui/plugin-designer@4.0.11
  - @object-ui/plugin-kanban@4.0.11
  - @object-ui/plugin-list@4.0.11
  - @object-ui/react@4.0.11
  - @object-ui/layout@4.0.11
  - @object-ui/plugin-chatbot@4.0.11
  - @object-ui/plugin-detail@4.0.11
  - @object-ui/plugin-form@4.0.11
  - @object-ui/plugin-grid@4.0.11
  - @object-ui/plugin-report@4.0.11
  - @object-ui/plugin-view@4.0.11
  - @object-ui/types@4.0.11
  - @object-ui/core@4.0.11
  - @object-ui/data-objectstack@4.0.11
  - @object-ui/auth@4.0.11
  - @object-ui/permissions@4.0.11
  - @object-ui/collaboration@4.0.11

## 4.0.10

### Patch Changes

- 7cb0c37: metadata
  - @object-ui/types@4.0.10
  - @object-ui/core@4.0.10
  - @object-ui/i18n@4.0.10
  - @object-ui/react@4.0.10
  - @object-ui/components@4.0.10
  - @object-ui/fields@4.0.10
  - @object-ui/layout@4.0.10
  - @object-ui/data-objectstack@4.0.10
  - @object-ui/auth@4.0.10
  - @object-ui/permissions@4.0.10
  - @object-ui/plugin-calendar@4.0.10
  - @object-ui/plugin-charts@4.0.10
  - @object-ui/plugin-chatbot@4.0.10
  - @object-ui/plugin-dashboard@4.0.10
  - @object-ui/plugin-designer@4.0.10
  - @object-ui/plugin-detail@4.0.10
  - @object-ui/plugin-form@4.0.10
  - @object-ui/plugin-grid@4.0.10
  - @object-ui/plugin-kanban@4.0.10
  - @object-ui/plugin-list@4.0.10
  - @object-ui/plugin-report@4.0.10
  - @object-ui/plugin-view@4.0.10
  - @object-ui/collaboration@4.0.10

## 4.0.9

### Patch Changes

- 19c044f: i18n
  - @object-ui/types@4.0.9
  - @object-ui/core@4.0.9
  - @object-ui/i18n@4.0.9
  - @object-ui/react@4.0.9
  - @object-ui/components@4.0.9
  - @object-ui/fields@4.0.9
  - @object-ui/layout@4.0.9
  - @object-ui/data-objectstack@4.0.9
  - @object-ui/auth@4.0.9
  - @object-ui/permissions@4.0.9
  - @object-ui/plugin-calendar@4.0.9
  - @object-ui/plugin-charts@4.0.9
  - @object-ui/plugin-chatbot@4.0.9
  - @object-ui/plugin-dashboard@4.0.9
  - @object-ui/plugin-designer@4.0.9
  - @object-ui/plugin-detail@4.0.9
  - @object-ui/plugin-form@4.0.9
  - @object-ui/plugin-grid@4.0.9
  - @object-ui/plugin-kanban@4.0.9
  - @object-ui/plugin-list@4.0.9
  - @object-ui/plugin-report@4.0.9
  - @object-ui/plugin-view@4.0.9
  - @object-ui/collaboration@4.0.9

## 4.0.8

### Patch Changes

- 3d58eaa: fix(auth,app-shell): hide Log out menu item when auth is disabled (guest/preview mode)

  When the console runs against a server with `discovery.services.auth.enabled === false`
  (or in preview mode), `AuthProvider` hardcodes `isAuthenticated: true` and the mock
  `signOut()` has no real backend. Previously, clicking "Log out" in the user menu had
  no visible effect — the user/session were nulled but the UI stayed authenticated.

  Changes:
  - **`@object-ui/auth`** — added `isAuthEnabled: boolean` to `AuthContextValue`
    (`true` only when real auth is in use, `false` for guest/preview modes).
  - **`@object-ui/app-shell`** — `AppHeader` and `AppSidebar` now hide the "Log out"
    menu item entirely when `!isAuthEnabled`, so users aren't presented with an action
    that can't actually do anything. Also fixed two missed i18n strings in
    `AppSidebar` ("Settings", "Log out").
  - **`@object-ui/i18n`** — added `user.{profile,settings,logout}` namespace to all
    10 built-in locales (en/zh translated; ja/ko/de/fr/es/pt/ru/ar fall back to
    English pending native translation).

- Updated dependencies [3d58eaa]
  - @object-ui/auth@4.0.8
  - @object-ui/i18n@4.0.8
  - @object-ui/components@4.0.8
  - @object-ui/fields@4.0.8
  - @object-ui/plugin-calendar@4.0.8
  - @object-ui/plugin-charts@4.0.8
  - @object-ui/plugin-dashboard@4.0.8
  - @object-ui/plugin-designer@4.0.8
  - @object-ui/plugin-list@4.0.8
  - @object-ui/react@4.0.8
  - @object-ui/layout@4.0.8
  - @object-ui/plugin-chatbot@4.0.8
  - @object-ui/plugin-detail@4.0.8
  - @object-ui/plugin-form@4.0.8
  - @object-ui/plugin-grid@4.0.8
  - @object-ui/plugin-kanban@4.0.8
  - @object-ui/plugin-report@4.0.8
  - @object-ui/plugin-view@4.0.8
  - @object-ui/types@4.0.8
  - @object-ui/core@4.0.8
  - @object-ui/data-objectstack@4.0.8
  - @object-ui/permissions@4.0.8
  - @object-ui/collaboration@4.0.8

## 4.0.7

### Patch Changes

- 7c9b85c: Fix compatibility with the framework's normalized Expression envelope format.

  `@objectstack/spec` now emits predicate (`visible` / `enabled`) and template
  (`titleFormat`) fields as `{ dialect, source }` envelopes instead of bare
  strings. The previous implementation assumed strings and crashed the record
  detail view (`TypeError: titleFormat.replace is not a function`) and printed
  `Failed to evaluate expression: ${[object Object]}` for every action visibility
  predicate.
  - `@object-ui/core`: `ExpressionEvaluator.evaluate` / `evaluateCondition` now
    unwrap Expression envelopes transparently.
  - `@object-ui/react`: new `toPredicateInput()` helper to safely normalize
    `boolean | string | Expression` predicate inputs into the `${expr}` form
    expected by `useCondition`.
  - `@object-ui/components`: `action-bar`, `action-button`, `action-group`,
    `action-icon`, `action-menu` renderers use `toPredicateInput()` instead of
    template-literal interpolation that produced `${[object Object]}`.
  - `@object-ui/plugin-detail`, `@object-ui/plugin-kanban`,
    `@object-ui/plugin-calendar`, `@object-ui/app-shell`,
    `@object-ui/console`: title-format helpers accept both legacy strings and
    the new `{ source }` envelope.

  All changes are backward-compatible — legacy bare strings continue to work.

- fd15918: Comprehensive i18n refactor + CI test fix.

  **i18n (`@object-ui/i18n`)**
  - Added ~130 new keys under 12 new top-level namespaces: `layout`, `search`,
    `empty`, `renderer`, `actionDialog`, `rowAction`, `navigationSync`,
    `objectActions`, `objectViewActions`, `dashboardActions`, `recordDetail`,
    `cellRender`, plus `grid.{empty,yes,no,systemFields,openMenu}`.
  - Mirrored all new top-level namespaces to all 10 built-in locales
    (en, zh, ja, ko, de, fr, es, pt, ru, ar) to maintain key parity required
    by the locale-structure test. Non-en/zh locales seed with English values
    and rely on `fallbackLng: 'en'` until human translation lands.

  **App shell (`@object-ui/app-shell`)** — replaced hardcoded English in 14
  files with `useObjectTranslation`:
  - Layout: `AppSidebar`, `ActivityFeed` (locale-aware relative time),
    `MetadataInspector`.
  - Views: `SearchResultsPage`, `ActionParamDialog`, `RecordFormPage`,
    `RecordDetailView`, `PageView`, `DashboardView` (PDF / forecast toasts),
    `ReportView`, `ObjectView` (rename / delete view toasts).
  - Console: `AppContent` (no-apps empty state).
  - Components: `PageRenderer`, `FormRenderer`, `DashboardRenderer`.
  - Hooks: `useNavigationSync` (16 toasts incl. Undo label),
    `useObjectActions` (delete confirm + success / failure toasts).

  **Plugin grid (`@object-ui/plugin-grid`)**
  - `ObjectGrid` record-detail panel now translates Empty / Yes / No / System
    via the existing `useGridTranslation` safe-fallback wrapper.
  - `RowActionMenu` adopts a local safe-fallback i18n wrapper for
    `Open menu` / `Edit` / `Delete`, preserving standalone-usage guarantees.

  **CLI test fix (`@object-ui/cli`)**
  - `cli-bin.test.ts` auto-builds the package on first run when `dist/cli.js`
    is missing, instead of throwing. This unbreaks `pnpm test:coverage` in CI
    (root vitest run does not honor turbo's `^build` deps) and removes the
    manual `pnpm --filter @object-ui/cli build` requirement for local dev.

- Updated dependencies [7c9b85c]
- Updated dependencies [fd15918]
  - @object-ui/core@4.0.7
  - @object-ui/react@4.0.7
  - @object-ui/components@4.0.7
  - @object-ui/plugin-detail@4.0.7
  - @object-ui/plugin-kanban@4.0.7
  - @object-ui/plugin-calendar@4.0.7
  - @object-ui/i18n@4.0.7
  - @object-ui/plugin-grid@4.0.7
  - @object-ui/data-objectstack@4.0.7
  - @object-ui/fields@4.0.7
  - @object-ui/layout@4.0.7
  - @object-ui/plugin-charts@4.0.7
  - @object-ui/plugin-chatbot@4.0.7
  - @object-ui/plugin-dashboard@4.0.7
  - @object-ui/plugin-designer@4.0.7
  - @object-ui/plugin-form@4.0.7
  - @object-ui/plugin-list@4.0.7
  - @object-ui/plugin-report@4.0.7
  - @object-ui/plugin-view@4.0.7
  - @object-ui/types@4.0.7
  - @object-ui/auth@4.0.7
  - @object-ui/permissions@4.0.7
  - @object-ui/collaboration@4.0.7

## 4.0.6

### Patch Changes

- 925051d: fix: convert Tailwind v3 `[--var]` arbitrary value syntax to v4 `(--var)`

  Shadcn `Sidebar`, `Calendar`, `Chart`, `Popover`, `Tooltip`, `HoverCard`,
  `Menubar`, `Select`, `Dropdown`, `Context-Menu`, and `AppSidebar` used the
  Tailwind v3 syntax `w-[--sidebar-width]`, `origin-[--radix-...]`, etc.
  Tailwind v4 no longer interprets the bare `--xxx` inside arbitrary values
  as `var(--xxx)`, so the rule emits empty CSS — the sidebar collapses to
  0 width and overlays the main content, dropdown/popover positions fall
  back to the wrong origin, and the calendar cells lose their fixed size.

  Replaced all such occurrences with the v4 CSS-variable shorthand
  `w-(--sidebar-width)`, `origin-(--radix-...)`, etc. Existing
  `[calc(var(--xxx)*-1)]` arbitrary expressions are unaffected.

- Updated dependencies [89ae109]
- Updated dependencies [925051d]
- Updated dependencies [1b6dc64]
  - @object-ui/plugin-grid@4.0.6
  - @object-ui/plugin-form@4.0.6
  - @object-ui/fields@4.0.6
  - @object-ui/components@4.0.6
  - @object-ui/plugin-chatbot@4.0.6
  - @object-ui/plugin-designer@4.0.6
  - @object-ui/plugin-kanban@4.0.6
  - @object-ui/plugin-view@4.0.6
  - @object-ui/plugin-calendar@4.0.6
  - @object-ui/plugin-detail@4.0.6
  - @object-ui/plugin-report@4.0.6
  - @object-ui/layout@4.0.6
  - @object-ui/plugin-charts@4.0.6
  - @object-ui/plugin-dashboard@4.0.6
  - @object-ui/plugin-list@4.0.6
  - @object-ui/types@4.0.6
  - @object-ui/core@4.0.6
  - @object-ui/i18n@4.0.6
  - @object-ui/react@4.0.6
  - @object-ui/data-objectstack@4.0.6
  - @object-ui/auth@4.0.6
  - @object-ui/permissions@4.0.6
  - @object-ui/collaboration@4.0.6

## 4.0.5

### Patch Changes

- Updated dependencies [1dc6061]
  - @object-ui/components@4.0.5
  - @object-ui/fields@4.0.5
  - @object-ui/layout@4.0.5
  - @object-ui/plugin-calendar@4.0.5
  - @object-ui/plugin-charts@4.0.5
  - @object-ui/plugin-chatbot@4.0.5
  - @object-ui/plugin-dashboard@4.0.5
  - @object-ui/plugin-designer@4.0.5
  - @object-ui/plugin-detail@4.0.5
  - @object-ui/plugin-form@4.0.5
  - @object-ui/plugin-grid@4.0.5
  - @object-ui/plugin-kanban@4.0.5
  - @object-ui/plugin-list@4.0.5
  - @object-ui/plugin-report@4.0.5
  - @object-ui/plugin-view@4.0.5
  - @object-ui/types@4.0.5
  - @object-ui/core@4.0.5
  - @object-ui/i18n@4.0.5
  - @object-ui/react@4.0.5
  - @object-ui/data-objectstack@4.0.5
  - @object-ui/auth@4.0.5
  - @object-ui/permissions@4.0.5
  - @object-ui/collaboration@4.0.5

## 4.0.4

### Patch Changes

- Updated dependencies [d2b6ece]
  - @object-ui/components@4.0.4
  - @object-ui/fields@4.0.4
  - @object-ui/layout@4.0.4
  - @object-ui/plugin-calendar@4.0.4
  - @object-ui/plugin-charts@4.0.4
  - @object-ui/plugin-chatbot@4.0.4
  - @object-ui/plugin-dashboard@4.0.4
  - @object-ui/plugin-designer@4.0.4
  - @object-ui/plugin-detail@4.0.4
  - @object-ui/plugin-form@4.0.4
  - @object-ui/plugin-grid@4.0.4
  - @object-ui/plugin-kanban@4.0.4
  - @object-ui/plugin-list@4.0.4
  - @object-ui/plugin-report@4.0.4
  - @object-ui/plugin-view@4.0.4
  - @object-ui/types@4.0.4
  - @object-ui/core@4.0.4
  - @object-ui/i18n@4.0.4
  - @object-ui/react@4.0.4
  - @object-ui/data-objectstack@4.0.4
  - @object-ui/auth@4.0.4
  - @object-ui/permissions@4.0.4
  - @object-ui/collaboration@4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

- Updated dependencies [4be43e2]
  - @object-ui/types@4.0.3
  - @object-ui/core@4.0.3
  - @object-ui/i18n@4.0.3
  - @object-ui/react@4.0.3
  - @object-ui/components@4.0.3
  - @object-ui/fields@4.0.3
  - @object-ui/layout@4.0.3
  - @object-ui/data-objectstack@4.0.3
  - @object-ui/auth@4.0.3
  - @object-ui/permissions@4.0.3
  - @object-ui/plugin-calendar@4.0.3
  - @object-ui/plugin-charts@4.0.3
  - @object-ui/plugin-chatbot@4.0.3
  - @object-ui/plugin-dashboard@4.0.3
  - @object-ui/plugin-designer@4.0.3
  - @object-ui/plugin-detail@4.0.3
  - @object-ui/plugin-form@4.0.3
  - @object-ui/plugin-grid@4.0.3
  - @object-ui/plugin-kanban@4.0.3
  - @object-ui/plugin-list@4.0.3
  - @object-ui/plugin-report@4.0.3
  - @object-ui/plugin-view@4.0.3
  - @object-ui/collaboration@4.0.3

## Unreleased

### Added

- **Page-mode record forms.** Objects can now opt into a route-driven
  full-screen create/edit experience by setting `editMode: 'page'` on the
  object metadata (default remains `'modal'`). When opted in, the
  console mounts two new routes under `/apps/:appName/`:
  - `:objectName/new` for create
  - `:objectName/record/:recordId/edit` for edit

  URLs are deep-linkable, refresh-safe, and respect the browser back
  button. The new `RecordFormPage` view renders inside the existing
  `ConsoleLayout` chrome and reuses the same `<ObjectForm>` pipeline as
  the modal flow, so every existing form configuration (sections,
  visibility expressions, validations, `formType: 'tabbed' | 'wizard'`,
  …) works without changes.

  Two declarative actions expose the routes for `<action:button>` JSON:
  - `{ "action": "navigate_create", "params": { "objectName": "..." } }`
  - `{ "action": "navigate_edit", "params": { "objectName": "...", "recordId": "..." } }`

  When called from inside an `ObjectView` the `objectName` falls back to
  the action context, so it can be omitted from the params.

  See `content/docs/guide/record-edit-modes.md` for a walkthrough.
  - New view: `packages/app-shell/src/views/RecordFormPage.tsx`
  - New helpers: `resolveRecordFormTarget`, `resolveNavigateCreateUrl`,
    `resolveNavigateEditUrl` in
    `packages/app-shell/src/utils/recordFormNavigation.ts`
  - Tests: `RecordFormPage.test.tsx` (6) and
    `recordFormNavigation.test.ts` (22), all passing.

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/i18n@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1
- @object-ui/fields@4.0.1
- @object-ui/layout@4.0.1
- @object-ui/data-objectstack@4.0.1
- @object-ui/auth@4.0.1
- @object-ui/permissions@4.0.1
- @object-ui/plugin-calendar@4.0.1
- @object-ui/plugin-charts@4.0.1
- @object-ui/plugin-chatbot@4.0.1
- @object-ui/plugin-dashboard@4.0.1
- @object-ui/plugin-designer@4.0.1
- @object-ui/plugin-detail@4.0.1
- @object-ui/plugin-form@4.0.1
- @object-ui/plugin-grid@4.0.1
- @object-ui/plugin-kanban@4.0.1
- @object-ui/plugin-list@4.0.1
- @object-ui/plugin-report@4.0.1
- @object-ui/plugin-view@4.0.1
- @object-ui/collaboration@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/auth@4.0.0
  - @object-ui/collaboration@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/data-objectstack@4.0.0
  - @object-ui/fields@4.0.0
  - @object-ui/layout@4.0.0
  - @object-ui/permissions@4.0.0
  - @object-ui/plugin-calendar@4.0.0
  - @object-ui/plugin-charts@4.0.0
  - @object-ui/plugin-chatbot@4.0.0
  - @object-ui/plugin-dashboard@4.0.0
  - @object-ui/plugin-designer@4.0.0
  - @object-ui/plugin-detail@4.0.0
  - @object-ui/plugin-form@4.0.0
  - @object-ui/plugin-grid@4.0.0
  - @object-ui/plugin-kanban@4.0.0
  - @object-ui/plugin-list@4.0.0
  - @object-ui/plugin-report@4.0.0
  - @object-ui/plugin-view@4.0.0
  - @object-ui/react@4.0.0
  - @object-ui/i18n@4.0.0

## 4.0.0

### Patch Changes

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
- Updated dependencies [b2be122]
  - @object-ui/components@3.4.0
  - @object-ui/fields@3.4.0
  - @object-ui/plugin-designer@3.4.0
  - @object-ui/plugin-grid@3.4.0
  - @object-ui/plugin-kanban@3.4.0
  - @object-ui/types@3.4.0
  - @object-ui/plugin-form@3.4.0
  - @object-ui/plugin-calendar@3.4.0
  - @object-ui/layout@3.4.0
  - @object-ui/plugin-charts@3.4.0
  - @object-ui/plugin-chatbot@3.4.0
  - @object-ui/plugin-dashboard@3.4.0
  - @object-ui/plugin-detail@3.4.0
  - @object-ui/plugin-list@3.4.0
  - @object-ui/plugin-report@3.4.0
  - @object-ui/plugin-view@3.4.0
  - @object-ui/auth@3.4.0
  - @object-ui/collaboration@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/data-objectstack@3.4.0
  - @object-ui/permissions@3.4.0
  - @object-ui/react@3.4.0
  - @object-ui/i18n@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/i18n@3.3.2
- @object-ui/react@3.3.2
- @object-ui/components@3.3.2
- @object-ui/fields@3.3.2
- @object-ui/layout@3.3.2
- @object-ui/data-objectstack@3.3.2
- @object-ui/auth@3.3.2
- @object-ui/permissions@3.3.2
- @object-ui/plugin-calendar@3.3.2
- @object-ui/plugin-charts@3.3.2
- @object-ui/plugin-chatbot@3.3.2
- @object-ui/plugin-dashboard@3.3.2
- @object-ui/plugin-designer@3.3.2
- @object-ui/plugin-detail@3.3.2
- @object-ui/plugin-form@3.3.2
- @object-ui/plugin-grid@3.3.2
- @object-ui/plugin-kanban@3.3.2
- @object-ui/plugin-list@3.3.2
- @object-ui/plugin-report@3.3.2
- @object-ui/plugin-view@3.3.2
- @object-ui/collaboration@3.3.2

## 3.3.1

### Patch Changes

- b429568: chore(examples): relocate console templates under `examples/`

  The fork-ready ObjectStack console template moved from `apps/console-starter`
  to `examples/console-starter`, so `apps/` only contains real deployable
  products (`console`, `site`). The third-party integration demo
  `examples/minimal-console` was renamed to `examples/byo-backend-console`
  to make its "bring-your-own backend" purpose explicit and to remove the
  naming collision with the starter template. Source comments and READMEs in
  `@object-ui/app-shell` and `@object-ui/components` have been updated to
  point at the new paths; no runtime behaviour changed. A new
  `examples/README.md` provides a "which example should I use?" selector.

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/fields@3.3.1
  - @object-ui/layout@3.3.1
  - @object-ui/plugin-calendar@3.3.1
  - @object-ui/plugin-charts@3.3.1
  - @object-ui/plugin-chatbot@3.3.1
  - @object-ui/plugin-dashboard@3.3.1
  - @object-ui/plugin-designer@3.3.1
  - @object-ui/plugin-detail@3.3.1
  - @object-ui/plugin-form@3.3.1
  - @object-ui/plugin-grid@3.3.1
  - @object-ui/plugin-kanban@3.3.1
  - @object-ui/plugin-list@3.3.1
  - @object-ui/plugin-report@3.3.1
  - @object-ui/plugin-view@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/i18n@3.3.1
  - @object-ui/react@3.3.1
  - @object-ui/data-objectstack@3.3.1
  - @object-ui/auth@3.3.1
  - @object-ui/permissions@3.3.1
  - @object-ui/collaboration@3.3.1

All notable changes to this package will be documented in this file.
See the [monorepo CHANGELOG](../../CHANGELOG.md) for cross-package release notes.
