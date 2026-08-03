# @object-ui/fields

## 17.2.0

### Minor Changes

- 785b8a5: `FieldWidgetComponentProps` stops claiming to have every key (objectui#3221).

  **Breaking for widget authors**: the exported `FieldWidgetComponentProps` no
  longer ends in `[key: string]: any`. FROM: any prop name at all type-checked and
  read as `any`. TO: the type declares a closed set — the controlled-input
  contract (`value` / `onChange` / `field` / `readonly` / `disabled` /
  `className` / `errorMessage` / `onUploadingChange`), the host plumbing a
  renderer forwards (`schema`, `dataSource`, `dependentValues`, `dependsOn`,
  `emptyHint`, `compact`, `onSelectRecord`, `onCreateNew`), and DOM pass-through
  (`id`, `name`, `autoFocus`, `tabIndex`, `onBlur`/`onFocus`/`onClick`, every
  `aria-*`, and `data-*` via a template-literal key). A custom widget reading
  anything else now fails `tsc`; the fix is to read it off `field` (the metadata)
  or to add the key here with its producer named.

  Scored `minor`, not `major`, per this repo's fixed-group rule — objectui's major
  tracks `@objectstack`, so breaking changes of our own ship as minor with the
  semantics spelled out (see AGENTS.md §版本号策略). The practical blast radius is
  small: every call site in this monorepo — `plugin-detail`'s inline editor,
  `plugin-grid`'s cell editor, `app-shell`'s metadata inspectors, the form
  renderer — compiles unchanged, because the closed set was derived from them.

  Why it mattered: an index signature is the objectstack#4075 mechanism — **a type
  that claims to have every key can never be reported as missing one**. Three
  things followed, and all three are now fixed:

  - `props.required` and `props.error`, both declared by the spec's
    `FieldWidgetPropsSchema` and both absent here, were legal reads typed `any`
    and `undefined` at runtime forever. They are compile errors now, which is what
    makes the `error` / `errorMessage` divergence (objectui#3222) decidable by the
    compiler instead of by a symbol guard. This change deliberately does **not**
    resolve that divergence — only make it visible.
  - A misspelled prop (`readOnly` for `readonly`, `onchange` for `onChange`)
    compiled and silently did nothing.
  - Any structural / parity comparison against the type was useless _in
    principle_, which is why objectui#3161's batch-7 symbol guard was the only
    detector that could see the collision at all.

  Also cleaned up inside the package: ~20 `(props as any).x` reads of keys the
  type now declares (`compact`, `dataSource`, `disabled`, `name`, `id`,
  `onCreateNew`, `onSelectRecord`, `contextRecord`, `dependentValues`) read
  through the type instead — leaving them would have kept the "a typo compiles"
  half of the defect alive at exactly the sites that matter. The three batch-7
  tripwires that existed to go red on this change
  (`_IndexSignatureStillThere` / `_RequiredSilentlyReadsAsAny` /
  `_ErrorSilentlyReadsAsAny`) are replaced by their inverse, so re-widening the
  type fails a test rather than passing one.

- 4a51e77: Stop declaring 14 symbols across ten packages under names `@objectstack/spec`
  owns (objectui#3161, objectstack#4115 batch 7 — the long tail, one or two
  entries per package). All ten packages leave the ledger, which drops from 17
  collisions across 11 packages to 3 across 1.

  **Renamed exports** — in every case the spec exports the same name for a
  _different_ thing, so the old name was a mis-description rather than a dialect:

  | package                    | was                                | now                                                  | what the spec's same-named export is                                                                                                       |
  | :------------------------- | :--------------------------------- | :--------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
  | `@object-ui/fields`        | `FieldWidgetProps`                 | `FieldWidgetComponentProps`                          | the DECLARED field-widget plugin props contract (a zod object; `field.type` is the `FieldType` enum, `readonly`/`required` carry defaults) |
  | `@object-ui/layout`        | `PageHeaderProps`                  | `PageHeaderComponentProps`                           | the authored `page:header` node — a zod schema of `title`, `subtitle`, an icon NAME, `breadcrumb`, `actions: string[]`                     |
  | `@object-ui/layout`        | `Page`                             | `PageNodeRenderer`                                   | the authored page metadata DOCUMENT (`name`, `label`, `type`, `regions`)                                                                   |
  | `@object-ui/plugin-detail` | `ObjectFieldLike`                  | `ObjectDefFieldLike`                                 | the i18n duck type `translateObject` walks (`help`/`description`, plus `[key: string]: any`)                                               |
  | `@object-ui/plugin-grid`   | `ColumnSummaryConfig`              | `ColumnSummarySetting`                               | the OBJECT form of `ListColumn.summary` **only** — the local one was the whole union, shorthand included                                   |
  | `@object-ui/plugin-grid`   | `isMultiValueField`                | `hasMultiValueShape`                                 | the spec's classifier, which requires a def with a `type`; the local one is called with `undefined`                                        |
  | `@object-ui/collaboration` | `RealtimeConfig`                   | `RealtimeSubscriptionConfig`                         | the app's realtime DECLARATION (`enabled`, `transport`, `subscriptions[]`)                                                                 |
  | `@object-ui/plugin-charts` | `ChartConfig`                      | `ChartContainerConfig`                               | the authored chart document (`type`, `xAxis`, `series`, `showLegend`, …)                                                                   |
  | `@object-ui/plugin-form`   | `FormSection` / `FormSectionProps` | `FormSectionContainer` / `FormSectionContainerProps` | the authored form-section metadata (`name`, `pane`, `visibleWhen`, `fields`)                                                               |
  | `@object-ui/providers`     | `Theme`                            | `ThemePreference`                                    | a whole theme DOCUMENT (`name`, `label`, `colors`, `typography`)                                                                           |
  | `@object-ui/runner`        | `App` (default export)             | `RunnerApp`                                          | the authored application metadata type **and** the `App.create()` builder                                                                  |
  | `@object-ui/sdui-parser`   | `ValidationResult`                 | `ManifestValidationResult`                           | plugin-manifest validation (`{ valid, errors?, warnings? }`), exported from both `kernel` and `contracts`                                  |

  `ManifestValidationResult` follows the `<what was validated>Validation<Error|Result>`
  convention registered on objectstack#4115 (`@object-ui/core` took
  `SchemaNodeValidationResult` in batch 4). `PageHeaderComponentProps` deliberately
  reuses the name `@object-ui/app-shell` already chose for its own header props in
  batch 3, so one concept does not acquire two dialect names one package apart.

  **Now derived from the spec instead of hand-written:**

  - `@object-ui/fields` — `isFileIdToken` is re-exported from
    `@objectstack/spec/data`. The local copy was character-for-character identical
    to the spec's function while its comment said it "mirrors" it, so every
    behaviour test passed and only reference identity could tell the two apart.
    The regex is a wire decision: widening it server-side while a copy here kept
    the old bound would make every new id read as "not a reference", and the
    widget would submit the legacy inline blob to a backend expecting a reference.
  - `@object-ui/plugin-detail` — `FeedFilterMode` is re-exported from
    `@objectstack/spec/data`, in a file that already imported the sibling
    `FeedItemType` from the spec.
  - `@object-ui/plugin-grid` — the eleven-member aggregation union is now the
    spec's `ColumnSummary` enum, so the total `Record<ColumnSummaryType, string>`
    label map turns a member the spec adds into a compile error instead of a
    blank footer cell. `ColumnSummarySetting` is `NonNullable<ListColumn['summary']>`,
    i.e. whatever forms the spec itself accepts. `hasMultiValueShape` delegates to
    the spec's `isMultiValueField` rather than re-deriving it from
    `MULTI_OPTION_TYPES` / `MULTI_CAPABLE_TYPES`.
  - `@object-ui/providers` — `ThemePreference` is the spec's `ThemeMode` union
    plus the one legacy `'system'` spelling this provider still honours for stored
    preferences, read off the schema's own `_zod` carrier so the package takes no
    zod dependency.

  `@objectstack/spec` moves from `devDependencies` to `dependencies` in
  `@object-ui/fields` (it re-exports a runtime function) and `@object-ui/providers`
  (its public `.d.ts` now references the spec).

  Scored `minor`, not `major`, per this repo's fixed-group rule — objectui's major
  tracks `@objectstack`, so breaking changes of our own ship as minor with the
  semantics spelled out above (see AGENTS.md §版本号策略). A `major` here would carry
  all 39 packages of the fixed group to `18.0.0` and off objectstack's 17.x line.

### Patch Changes

- a8ad6c0: A required boolean must be savable in its UNCHECKED state — `false` and `0` are values.

  Reported against an AI-built task tracker whose 任务 object has a required
  `是否完成` boolean: the create form showed the switch OFF, answered "是否完成不能
  为空", and saved instantly once the switch was turned ON. The app could only ever
  create ALREADY-DONE tasks — the one state the control shows by default was the
  one value it refused to save (cloud#972).

  Two defects stacked, and either alone is enough to break it:

  **The `required` verdict read truthiness, not presence.** `@objectstack/spec`
  FieldSchema.required (ADR-0113) is "an insert must provide a NON-NULL value",
  and objectql's record validator implements exactly that. react-hook-form's
  built-in rule instead fails whenever `isBoolean(value) && !value` — its
  accept-the-terms checkbox heritage — silently redefining every required boolean
  as "must be TRUE", including a select whose chosen option value is `false`. It
  also disagreed the other way, letting a whitespace-only string through for the
  server to reject with a 400. The form renderer no longer hands RHF its own
  `required`: the check is now a `validate` entry keyed `required` (so the error
  still surfaces as `type: 'required'`, which the conditional-required cleanup
  keys on) backed by a new shared `isMissingForRequired` in `@object-ui/core`, a
  deliberate mirror of objectql `record-validator.isMissing` — `undefined`,
  `null`, blank-after-trim string, empty array. Deleting the inherited rule also
  stops a `required` that rode in on `validation` from outliving a `requiredWhen`
  that resolved to FALSE.

  **A boolean field held `undefined` while displaying "off".** A two-state control
  has no third state, but a field with no entry in `defaultValues` rendered an OFF
  switch backed by nothing: the create payload omitted the column (it lands null,
  which reads as unchecked but isn't) and the presence check above would still
  refuse it. The form renderer now folds `false` into `defaultValues` for every
  boolean-widget field the caller left unset — in `defaultValues` itself, not
  per-Controller, because that object is also the dirty-check baseline and what
  the defaults-reset window replays. Every surface gets it, including the
  modal/drawer create dialogs that start from a bare `{}`. An authored default
  (or a loaded record, `null` included) still wins.

  `WizardForm`'s cross-step gate had its own copy of the empty-value predicate; it
  now imports the shared one so it cannot drift from the per-field verdict. And
  the field-demo renderer read `schema.defaultValue || schema.value`, throwing
  away an authored default of `false` / `0` / `''` — same falsy-as-empty class,
  now `??`.

  Verified end to end on a local stack against the exact metadata shape
  `apply_blueprint` materializes (`{ type: 'boolean', required: true }`, no
  default): a 是否完成 = 否 task with 工时 = 0 now creates and persists as
  `{ hours: 0, is_done: false }`, turning the switch on still stores `true`, and a
  blank required text is still refused.

- Updated dependencies [4ae0ac4]
- Updated dependencies [696e3c1]
- Updated dependencies [bca45cc]
- Updated dependencies [a889e31]
- Updated dependencies [09d30a4]
- Updated dependencies [4bf612c]
- Updated dependencies [335041c]
- Updated dependencies [b414983]
- Updated dependencies [256f8cc]
- Updated dependencies [d9668a7]
- Updated dependencies [4b470b9]
- Updated dependencies [cb82705]
- Updated dependencies [f572849]
- Updated dependencies [4a51e77]
- Updated dependencies [f6e8d78]
- Updated dependencies [ea96284]
- Updated dependencies [d3584c6]
- Updated dependencies [a8ad6c0]
- Updated dependencies [444457c]
- Updated dependencies [850033c]
- Updated dependencies [022e4c3]
- Updated dependencies [009e25d]
- Updated dependencies [726b89c]
  - @object-ui/types@17.2.0
  - @object-ui/components@17.2.0
  - @object-ui/core@17.2.0
  - @object-ui/react@17.2.0
  - @object-ui/i18n@17.2.0
  - @object-ui/providers@17.2.0

## 17.1.0

### Minor Changes

- f8a95e5: fix(fields): the sharing-criteria builder stops calling an empty criteria "All records" (objectstack#3896)

  `FilterConditionField` renders `sys_sharing_rule.criteria_json`. With no
  criteria it displayed **"All records"**, and `filterGroupToMongo` carried a
  matching `// empty = match all` comment. That was describing a bug as a
  feature: a sharing rule with no predicate was stored as `criteria_json: null`
  and evaluated as `find(object, { filter: {} })` under the system context —
  every record of the object, granted to the recipient. `SharingRuleSchema` had
  always forbidden the shape ("never seeded as a permissive match-all",
  ADR-0049); the REST and data-API entries just never checked.

  objectstack#3896 closes those entries: the server now refuses to save a rule
  whose criteria would match everything, and one already stored shares nothing.
  This is the renderer catching up.

  - **The empty read-only state now says the rule shares nothing**, in
    `destructive` styling — key renamed `fields.filterCondition.allRecords` →
    `fields.filterCondition.noCriteria`, retranslated across all ten locales.
    Nothing else read the old key.
  - **A new `fields.filterCondition.criteriaRequired` hint** renders under the
    builder (and the JSON editor) while the criteria is empty. The server's
    rejection is precise but only arrives as a toast _after_ Save; this says it
    while the admin is still looking at the empty builder.
  - **`isMatchAllCriteria` is exported** — a client-side mirror of the server
    predicate covering `{}`, `[]`, and the vacuous combinators (`{ $and: [] }`,
    `{ $or: [{}] }`), conservative in the same direction. The server stays
    authoritative; this only decides whether to show the hint.

  Unparsable JSON keeps its own `invalidJson` message and does **not** also
  collect the empty-criteria hint.

  Note for anyone wiring this end-to-end: the Criteria field is not marked
  `required` in the object metadata, deliberately — `sys_sharing_rule.criteria_json`
  is nullable in deployed tenants, so `required: true` would only produce a
  destructive `NOT NULL` migration that those nulls block. The invariant lives in
  the server's write guards; this change makes the UI stop contradicting it.

### Patch Changes

- aecc934: fix(fields): PeoplePicker's keyboard cursor can no longer be eaten by a late reset

  The cursor reset on new results lived in a `useEffect`. Effects flush
  asynchronously after the render that delivered the records — so a reset queued
  by their arrival could land AFTER a subsequent ArrowDown and wipe the just-set
  cursor. That was the residual ArrowDown→Enter flake in
  `PeoplePicker.test.tsx` (the earlier signature-keyed fix closed the
  too-often resets, not the too-late one), and a real fast-fingers UX bug: rows
  appear, the user presses ArrowDown, the highlight vanishes.

  The reset now runs in the render phase (the "adjusting state during render"
  pattern), in the same render that shows the new rows — by the time a row is
  visible, the reset has already happened, so it can never race a keypress.
  Semantics unchanged and now pinned by a test: a replaced result set does not
  inherit the previous set's cursor.

- 7f23cd0: fix(form): a numeric/boolean select option survives selection with its type intact — #3090

  `SelectOptionSchema.value` has accepted `string | number | boolean` for as
  long as it has existed, but the Radix controls underneath speak strings:
  picking `{ value: 2 }` silently submitted `"2"` — a wrong-typed write into a
  number field that nothing on the client ever reported. (Display half-worked:
  a numeric default matched its numeric item; only SELECTION morphed the type.)

  The renderers now stringify on the way into the control and map the selection
  back to the AUTHORED option value on the way out (`matchOptionValue`), across
  the in-form select, the standalone `type: 'select'` component, and the
  standalone `type: 'radio-group'` component. The TS types stop lying to match:
  `SelectOption.value` / `RadioOption.value` and the corresponding
  `value`/`defaultValue`/`onChange` channels widen to what the zod schemas
  always accepted — a call site treating `option.value` as `string` is now a
  compile error pointing at a real latent crash, not a false comfort.

  The ripple the widening named, handled at each boundary: `@object-ui/core`'s
  `OptionLike.value` widens (the option engines compare by identity, so values
  flow opaquely; the option-lint's CEL-literal domain stringifies at its
  boundary), and the multi-value field widgets (checkboxes / multiselect /
  radio) stringify at theirs — multi-value fields store string arrays.

  Round-trip pinned by real Radix interactions in jsdom: the in-form select
  submits `2` (number), the standalone select hands its handler `false`
  (boolean).

- Updated dependencies [62311b6]
- Updated dependencies [fc0272a]
- Updated dependencies [9e7349e]
- Updated dependencies [8864971]
- Updated dependencies [1cf0de7]
- Updated dependencies [752e18f]
- Updated dependencies [c785740]
- Updated dependencies [b41f401]
- Updated dependencies [19e9fa0]
- Updated dependencies [d61efd1]
- Updated dependencies [95b7214]
- Updated dependencies [7d9734d]
- Updated dependencies [6ae818e]
- Updated dependencies [9eb932b]
- Updated dependencies [746dd00]
- Updated dependencies [aebfa4f]
- Updated dependencies [38ca8be]
- Updated dependencies [3cb9646]
- Updated dependencies [68ef584]
- Updated dependencies [4952edf]
- Updated dependencies [7f0252e]
- Updated dependencies [c4d7b20]
- Updated dependencies [c769d3d]
- Updated dependencies [7639a61]
- Updated dependencies [94e63ef]
- Updated dependencies [c735bf7]
- Updated dependencies [02aef0c]
- Updated dependencies [6f29aa5]
- Updated dependencies [d21794c]
- Updated dependencies [c4db402]
- Updated dependencies [5319bf1]
- Updated dependencies [49e5671]
- Updated dependencies [9a04d25]
- Updated dependencies [b5b97e2]
- Updated dependencies [f59f2c1]
- Updated dependencies [07de839]
- Updated dependencies [2a40b5e]
- Updated dependencies [df613fa]
- Updated dependencies [4874117]
- Updated dependencies [ad0183a]
- Updated dependencies [ce08d55]
- Updated dependencies [eb4b740]
- Updated dependencies [5b084eb]
- Updated dependencies [aa1240a]
- Updated dependencies [2374a49]
- Updated dependencies [390c071]
- Updated dependencies [d10f526]
- Updated dependencies [2d5d594]
- Updated dependencies [ea7f477]
- Updated dependencies [379728f]
- Updated dependencies [7f23cd0]
- Updated dependencies [0ded602]
- Updated dependencies [24e0e0a]
- Updated dependencies [f8a95e5]
- Updated dependencies [3a6cf24]
- Updated dependencies [aa35561]
- Updated dependencies [03bd53b]
- Updated dependencies [3c1f321]
- Updated dependencies [a045a32]
- Updated dependencies [912496d]
- Updated dependencies [80edbd4]
- Updated dependencies [9867281]
  - @object-ui/core@17.1.0
  - @object-ui/components@17.1.0
  - @object-ui/react@17.1.0
  - @object-ui/types@17.1.0
  - @object-ui/i18n@17.1.0
  - @object-ui/providers@17.1.0

## 17.0.0

### Minor Changes

- 697cda4: feat(fields): adopt the file-as-reference value shape (ObjectStack ADR-0104 D3 wave 2)

  A `file`/`image` field value now reaches the UI in one of three forms, and the
  rules for reading them live in one place — `@object-ui/fields`' new
  `file-value` module — instead of being re-derived in each widget:

  1. **Reference** — a bare `sys_file` id string, what the backend stores once
     file-as-reference is adopted.
  2. **Expanded** — `{ id, name, size, mimeType, url }`, what the read path
     returns after resolving a reference.
  3. **Legacy inline blob** — `{ file_id?, name, original_name, size, mime_type,
url }`, the pre-reference shape this package used to build itself.

  **The casing split is the bug this fixes.** The expanded form carries
  `mimeType`; the legacy blob carries `mime_type`. `FileField`, `FileCell` and
  `ImageField` all read only `mime_type`, so the moment a backend starts returning
  the expanded form they stop recognising images — thumbnails silently degrade to
  a generic file icon, with nothing pointing at a value shape as the cause.
  `readFileValue()` accepts both.

  **Uploads now submit the reference form** — the bare `sys_file` id — when the
  upload adapter surfaced one, falling back to the legacy blob when it did not
  (the object-URL fallback adapter, or a backend predating file-as-reference). The
  same build therefore works against both. Action params already POSTed a bare
  fileId; record field values now use the same contract, and
  `serializeParamValues` shares the `fileIdOf()` extractor so the two surfaces
  cannot drift on what counts as an id.

  Because a bare id carries no name or URL, each widget remembers the display
  details of files it just uploaded, keyed by id, so an upload renders immediately
  rather than showing a bare token until the next read enriches it.

### Patch Changes

- 4b1ed7d: feat(app-shell): approval approver values become record lookups (framework #3508)

  - The flow designer's approver `Value` cell now sources directory kinds from DATA
    records instead of the metadata registry: `user` / `team` / `department` / `position`
    render a single-select record lookup (`LookupField` over `sys_user` / `sys_team` /
    `sys_business_unit` / `sys_position` via the DataSource adapter), with a manual-entry
    escape hatch and a plain free-text fallback when no adapter is available (offline
    preview). `position` commits the machine name; the others commit the record id —
    matching the approval engine's resolution semantics.
  - `org-membership-level` is now a strict select (owner/admin/member); a stored
    out-of-enum value renders flagged instead of being blanked.
  - `manager` renders as an auto-resolved (disabled) cell; `queue` is no longer offered
    for new approver rows and stored queue rows carry a "not supported by the runtime"
    warning.
  - `@object-ui/fields`: `LookupField` hydrates the selected label through `id_field`
    when it is not the primary id (e.g. `id_field: 'name'`), instead of always calling
    `findOne` with the primary id.

- 3e886eb: fix(i18n): localize FileField upload widget + approvals snapshot field labels

  - `FileField` (the shared upload widget) hard-coded every visible string
    ("Drag & drop files here", "or click to browse", "Take photo", "Uploading…",
    size/upload validation messages, …). They now route through
    `useObjectTranslation` with new `fields.file.*` keys, translated across all
    10 locale bundles. This is why the approvals Approve/Reject dialog's
    attachment dropzone was English in a Chinese console.
  - The approvals inbox record-snapshot summary title-cased raw machine keys
    instead of the target object's field labels. It now consumes the
    server-sent `payload_labels` in `payloadSummary`/`decisionAmountEntry`,
    falling back to the prettified key when absent; `approvalsApi`'s row type
    gains `payload_labels`.

- faad45e: fix(fields): render `image` fields consistently and add click-to-zoom (#2836)

  An `image` field rendered differently — and wrongly — on three surfaces:

  - **Edit form showed broken thumbnails.** A record read back its `image` value
    as a bare `sys_file` id (the reference form), but `readFileValue` returned an
    id with no URL — the comment assumed the read path expands it, which the
    edit-form data path does not. The result was `<img src="">`. `file-value` now
    derives the stable download URL (`/api/v1/storage/files/:id`, which
    302-redirects to a signed URL and works directly as `<img src>`) for a bare
    id or an id-only object, so every widget and cell renderer resolves one.
  - **Inline edit leaked the raw storage URL.** `InlineFieldInput` had no branch
    for file-backed types and fell through to a plain text input showing
    `/api/v1/storage/files/…`. It now renders the same upload widgets the form
    uses (`image`/`avatar`/`signature`/`file`/`video`/`audio`).
  - **Hard-coded English.** `ImageField`'s upload/crop/remove/alt strings now go
    through `t('fields.image.*')` (en + zh added).

  Also adds an `ImageLightbox` — click a read-only thumbnail (detail or list cell)
  to open a full-screen preview; multiple images get prev/next navigation, a
  position counter and arrow-key support, a single image just the image. In a
  grid cell the click is `stopPropagation`-guarded so enlarging doesn't also open
  the row.

- 341bfb5: fix: read spec-canonical keys for dashboard header title and field length rules

  Two naming-drift closeouts (framework#1878 / framework#1891):

  - `DashboardRenderer` header now falls back to the spec-canonical `label` when
    the legacy `title` is absent (mirrors the `DashboardGridLayout` fallback from
    #2666) — a spec-compliant dashboard gets its header title.
  - Field validation rules now read the spec-canonical camelCase
    `minLength`/`maxLength` (what the server record-validator enforces) with the
    legacy snake_case `min_length`/`max_length` kept as fallback — authored
    length constraints reach the client form.

- 2f947e4: fix(page,field): consume the spec's `type`/`label`/`maxLength` keys (framework#1878 §3 naming-drift recheck)

  Three forward-drifts where objectui read a different key than the spec
  declares, so authoring the documented key silently no-oped:

  - **page `type` → `pageType`** (app-shell + components): `PageSchema` declares
    the page KIND as `type`, but `PageRenderer` reads `schema.pageType` and fell
    back to `'record'` — and nothing mapped between them. Every non-record page
    (`home`/`app`/`list`/`utility`) rendered with the record max-width, a wrong
    `data-page-type` attribute, and a suppressed header. `PageView` now passes
    `pageType` alongside the SchemaNode discriminator `type`.
  - **page `label` → `title`** (components): `PageSchema.label` is required but the
    region renderer read only `title`. Now dual-reads `title ?? label`, mirroring
    the fallback `DashboardRenderer` already uses. Coupled with the above — the
    header is gated on `pageType !== 'record'`, so both were needed for a title to
    appear.
  - **field `maxLength`/`minLength`** (plugin-form + fields): validation already
    dual-read these, but `ObjectForm`'s HTML-attribute pass and `TextAreaField`
    read `max_length` only, so a spec-authored `maxLength` gave no browser cap and
    no character counter. Both now dual-read, matching `buildValidationRules`.

  Verified in the browser against the showcase: `capability_map` (`type: 'home'`)
  now renders `data-page-type="home"`, the `home` max-width and its page title;
  record pages are unchanged.

- 53642d4: fix(core,fields): a string `$orderby` is a clause, not a character array — and localize the sharing-rule widgets (objectstack#3821)

  **The recipient picker listed nothing, ever.** `QueryParams['$orderby']` was
  typed as `Record | string[] | SortObject[]`, so `queryParamsToRecord` sent any
  non-array value through `Object.entries`. Handed the clause string `'name asc'`
  — which callers do build by hand — it walked the string index by index and
  emitted `$orderby=0 n,1 a,2 m,3 e,4 ,5 a,6 s,7 c`. The server sorted by columns
  that don't exist and every row was filtered out, so
  `sys_sharing_rule.recipient_id` rendered "No matches" for every recipient type
  and no sharing rule could be created from the Console. `ObjectGrid` builds the
  same shape from a schema-level `sort` in three places, so grids with a string
  sort silently showed an empty table.

  A string `$orderby` is now passed through verbatim (the server's OData
  normalizer has always parsed `'name asc'`), and the type admits `string`.
  `RecipientPickerField` additionally switched to the structured
  `{ name: 'asc' }` form so it can't regress this way against any data source.

  **The three sharing-rule authoring widgets never had translations.**
  `ObjectRefField`, `RecipientPickerField` and `FilterConditionField` hardcoded
  their English copy — a Chinese Console showed "Select an object", "Select a
  user", "Search…", "No matches", "Edit as JSON". They now go through
  `useFieldTranslation` like every other widget, with keys added under `fields.*`
  in all ten locales.

  The recipient placeholder was the interesting one: it read
  `` `Select a ${recipientType.replace(/_/g,' ')}` ``, interpolating the enum
  value into an English sentence — a shape no locale can translate. It is now a
  per-type key (`fields.recipient.selectUser`, `…selectBusinessUnit`, …), so
  "选择业务单元" and "Select a business unit" no longer have to share a structure.

  **Editing a rule silently dropped its recipient.** The picker resets the stored
  id when `recipient_type` changes, because an id valid for a user is meaningless
  for a team. It treated the edit form's `'' → 'user'` hydration as such a change:
  opening any saved rule blanked the recipient, and saving persisted the blank.
  Only a non-empty predecessor now counts as a type switch.

  **Building a filter submitted the surrounding form.** None of `FilterBuilder`'s
  controls declared `type="button"`, and a bare `<button>` inside a `<form>`
  defaults to `type="submit"`. Adding, removing or clearing a condition therefore
  submitted the sharing-rule dialog — firing validation mid-edit, and on an
  already-valid form saving the record before the admin was done.

  **A rejected write showed the user raw server diagnostics.** The form rendered
  `error.message` verbatim, so a sharing / RLS denial reached the dialog and the
  toast as `FORBIDDEN: insufficient privileges to update showcase_private_note
pi-TgoJ4_DM55Fqz` — untranslated, and leaking the object's machine name and the
  record id to whoever hit it. Permission failures now render localized copy
  (`form.noPermissionToSave`, added in all ten locales), with the server text kept
  on the console for debugging; other failures still show the server's message,
  which is the useful part, and fall back to `form.submitFailed` when there is
  none — replacing the previously hardcoded English "An error occurred during
  submission".

  **The detail header offered "Edit" on records the user may only read.** Object
  permissions can't express "this one record is read-only" — a read-only sharing
  grant sits inside an object the user may otherwise edit — so the header showed
  the primary Edit CTA, opened the form, and let the user retype a field before
  the server rejected the save. `DetailView` now gates Edit / Delete on the
  object-level check AND on the explain engine's record-grained verdict
  (`POST /api/v1/security/explain` with a `recordId`, ADR-0090 D6 / ADR-0095 C2 —
  the same pipeline the enforcement middleware runs, so button and server cannot
  disagree). Explaining oneself needs no special permission. The probe is one
  cached request per record, skipped entirely when the object-level check already
  says no, and **fails open** on every uncertainty — an unanswered hint must never
  be the reason a permitted user cannot act; the server stays the authority
  (ADR-0057 D10).

  **A long option rendered straight past the combobox border.** `Combobox`'s
  trigger pinned itself to the component's `w-[200px]` default while the fields
  around it ran the full form column, and the selected label was a bare text child
  of a flex button — flex items need `truncate` AND `min-w-0` to clip, and it had
  neither. So "成员 (showcase_project_membership)" in the object picker overflowed
  the control and collided with the field beside it. The label now truncates, the
  trigger can shrink, the dropdown matches the trigger's width instead of a
  hardcoded 200px (a widened combobox used to clip its own options), and the two
  sharing-rule pickers ask for `w-full` so they line up with every other input.

  Hardens `evaluatePermission` while there: a role config carrying only
  `fieldPermissions` (no `actions`) made `check()` throw a TypeError that
  propagated out of the render. A permission check must not be able to crash a
  view.

  Browser-verified against the framework showcase Console in Chinese: object /
  criteria / recipient copy is fully localized, the recipient dropdown lists real
  users, business units and positions, a saved rule reopens with its recipient and
  criteria intact, editing the filter no longer submits, and a rule created
  end-to-end stores a real record id rather than free text. The criteria authored
  in the builder is honored by the evaluator: `{"pinned":true}` on an owner-private
  object granted the recipient exactly the matching records and nothing else.

- Updated dependencies [7b21891]
- Updated dependencies [0b3be01]
- Updated dependencies [3c4d935]
- Updated dependencies [4b60d2d]
- Updated dependencies [952b978]
- Updated dependencies [de5e40c]
- Updated dependencies [1a03af6]
- Updated dependencies [3e886eb]
- Updated dependencies [cfc675e]
- Updated dependencies [20df08c]
- Updated dependencies [1767124]
- Updated dependencies [8ecf5a6]
- Updated dependencies [af705b9]
- Updated dependencies [0502a7c]
- Updated dependencies [7b35e4b]
- Updated dependencies [8fb1295]
- Updated dependencies [e16ed2d]
- Updated dependencies [c6fd752]
- Updated dependencies [f9bbddb]
- Updated dependencies [dfd3705]
- Updated dependencies [c77108c]
- Updated dependencies [2735de6]
- Updated dependencies [c19ac11]
- Updated dependencies [6dee2cb]
- Updated dependencies [e05f052]
- Updated dependencies [0502a7c]
- Updated dependencies [faad45e]
- Updated dependencies [09c6a17]
- Updated dependencies [c7cff19]
- Updated dependencies [ba73a02]
- Updated dependencies [cd09a7b]
- Updated dependencies [f1abf0e]
- Updated dependencies [f05b84e]
- Updated dependencies [9b4b952]
- Updated dependencies [2f947e4]
- Updated dependencies [7d46648]
- Updated dependencies [9b53d72]
- Updated dependencies [bb4aa25]
- Updated dependencies [75f1cdf]
- Updated dependencies [662bdf9]
- Updated dependencies [059a052]
- Updated dependencies [53642d4]
- Updated dependencies [8aae006]
- Updated dependencies [c6cfdf1]
- Updated dependencies [d147a13]
- Updated dependencies [c6aaed8]
- Updated dependencies [263f885]
- Updated dependencies [dc334da]
  - @object-ui/components@17.0.0
  - @object-ui/i18n@17.0.0
  - @object-ui/react@17.0.0
  - @object-ui/types@17.0.0
  - @object-ui/core@17.0.0
  - @object-ui/providers@17.0.0

## 16.1.0

### Minor Changes

- 1c8935a: feat(app-shell): render ActionParamDialog params through the shared form field-widget renderer (ADR-0059, #2700)

  `ActionParamDialog` no longer hand-rolls a per-type ternary chain (select /
  lookup / textarea / number / boolean, everything else → text input). Every
  declared action param now renders through the same `fieldWidgetMap` the object
  form uses, so a param of ANY form-supported field type — `file`, `image`,
  `richtext`, `markdown`, `color`, `address`, `code`, `date`, … — gets its real
  widget, lazily loaded behind `Suspense`. Subsumes the single `file` branch ask
  in #2698: `type: 'file'` params render the real `FileField` upload control via
  the ambient `UploadProvider`, honoring `multiple`/`accept`/`maxSize`.

  - `@object-ui/fields`: new exports `resolveFormWidgetType(type)` (widget-key
    resolution incl. spec aliases, text fallback) and `getLazyFieldWidget(type)`
    (per-type-cached `React.lazy` over the form's own widget loaders).
  - `@object-ui/core`: `ActionParamDef` gains `accept`/`maxSize`; `multiple` is
    now general widget config (was lookup-only).
  - `@object-ui/app-shell`: new pure `paramToField()` adapter (param → field
    shape) with a drift test pinning param support ⊇ form support (`FORM_FIELD_TYPES`),
    mirroring the FieldEditWidget parity guard; `resolveActionParams()` inherits
    `multiple`/`accept`/`maxSize` from the referenced field for every type.
    `required` validation, `visible` CEL gating, helpText, error styling, and
    value shapes for previously-supported types are unchanged.

- ef14f69: feat(fields): CheckboxesField per-option `visibleWhen` cascading + `dependsOn` gating (completes the option-widget parity set)

  `checkboxes` was the last static-option widget still rendering `config.options`
  raw — with no per-option `visibleWhen` filtering, `dependsOn` gating, or cascade
  clear. It now matches `MultiSelectField` (its multi-value sibling), completing
  the ADR-0058 parity across `select` / `multiselect` / `radio` / `checkboxes`.

  - **`@object-ui/fields`**: `CheckboxesField` routes through the shared
    `useCascadingOptions` hook — offered boxes narrow against the live record +
    `current_user`, the control gates behind a "select the parent first" hint
    while a `dependsOn` field is empty, and selections no longer offered are
    pruned per-element from the array. Adds `checkboxes-empty-*` /
    `checkboxes-option-*` testids.
  - **`@object-ui/components`**: adds `checkboxes` to the form renderer's option
    field sets (`CASCADE_OPTION_FIELD_TYPES`, the cross-field cascade-clear
    effect, and the option pre-filter) so a `checkboxes` field is threaded
    `dependentValues` and gated identically to the other option widgets.
  - Tests: `CheckboxesField.cascade.test.tsx` mirrors `MultiSelectField.cascade.test.tsx`.

- 14cb729: feat(fields): MultiSelectField per-option `visibleWhen` cascading + `dependsOn` gating (parity with single select, #2715)

  The multi-value chip picker now implements the same ADR-0058 option
  resolution as the single `SelectField`, closing the gap #2709 opened when a
  `select` + `multiple` (and the `multiselect` type) started delegating to it.

  - Extracted `useCascadingOptions` — the shared hook that resolves per-option
    `visibleWhen` filtering, `dependsOn` gating, and the live `dependentValues` +
    predicate-scope wiring — and routed both `SingleSelectField` and
    `MultiSelectField` through it (no duplicated resolver).
  - `MultiSelectField` narrows its offered chips against the live record +
    `current_user`, gates behind a "select the parent first" hint while a
    `dependsOn` field is empty, and surfaces a legible empty state instead of a
    bare chip row.
  - Cascade-clear: when the offered set changes (parent changed / predicate
    flipped) the widget prunes only the now-invalid selections, keeping the
    still-offered ones — the array analogue of the single select's clear.
  - Tests: `MultiSelectField.cascade.test.tsx` mirrors `SelectField.cascade.test.tsx`
    (gating, per-element cascade clear, role/context gating).

- 1629313: feat(fields): RadioField per-option `visibleWhen` cascading + `dependsOn` gating; single-source the option resolver

  Brings `RadioField` to parity with `SelectField` / `MultiSelectField` for ADR-0058
  cascading & role-gated options, and collapses the three copies of the
  gate-then-filter logic onto one shared resolver.

  - **`@object-ui/core`**: new pure `resolveCascadingOptions(rawOptions, record, dependsOn, scope)`
    → `{ options, gated, dependsOnFields }` — the single source of truth for
    `dependsOn` gating + per-option `visibleWhen` filtering.
  - **`@object-ui/fields`**: `RadioField` now narrows its offered radios against
    the live record + `current_user`, gates behind a "select the parent first"
    hint while a `dependsOn` field is empty, and clears a value no longer offered
    (scalar cascade clear). The `useCascadingOptions` hook is refactored to a thin
    React wrapper over `resolveCascadingOptions`.
  - **`@object-ui/components`**: the form renderer's inline option pre-filter and
    cross-field cascade-clear effect now call `resolveCascadingOptions` instead of
    re-deriving gating/filtering, so they can't drift from the widgets (no
    behavior change).
  - Tests: `RadioField.cascade.test.tsx` mirrors the select cascade tests; core
    gains `resolveCascadingOptions` unit coverage.

- eee4ded: feat(fields): render `select` + `multiple` through the multi-value chip picker; restore fields/core lint gates

  - **Multi-value select** — a `select` field/param declared `multiple: true`
    now renders the multi-value chip picker (the `multiselect` widget) and stores
    a `string[]`, instead of collapsing to a single-value dropdown that could
    hold only one value. The delegation lives inside `SelectField`, so the object
    form, the inline grid editor, and the app-shell `ActionParamDialog` all
    inherit it from the one `select` widget with no per-surface drift. Single
    selects keep the cascading dropdown (multi + per-option `visibleWhen`
    cascading is not a combination in use today).
  - **`autonumber` mapping is unchanged** here; this change is orthogonal.
  - **Lint gates restored** — fixed the pre-existing baseline lint errors that
    had left the `@object-ui/fields` and `@object-ui/core` package lints red (so
    the gate could not catch new violations): `react-hooks/rules-of-hooks` in
    `ImageField` / `TextAreaField` / `index.tsx` (hooks hoisted above early
    returns; the `useFieldTranslate` hook no longer wrapped in try/catch), plus
    `no-useless-assignment` / `no-useless-escape` / `no-control-regex` /
    `prefer-const` / `preserve-caught-error` in the core evaluator and utils. No
    behavior change from the lint fixes.

### Patch Changes

- 0318118: fix(app-shell): block ActionParamDialog submit while a file/image param is uploading; map spec `autonumber` (ADR-0059 follow-ups)

  Two follow-ups to the shared-field-widget param rendering (ADR-0059):

  - **Upload-in-progress guard.** A `file`/`image` param's value only becomes its
    fileId once the presigned upload settles, so confirming mid-upload sent an
    empty/stale value. `FileField`/`ImageField` now surface their upload state via
    an optional `onUploadingChange` prop (shared `useUploadingSignal` hook,
    ignored by other widgets); `ActionParamDialog` wires it for `file`/`image`
    params and disables Confirm (label → "Uploading…", new `actionDialog.uploading`
    i18n key across all locales) plus blocks submit while any upload is in flight.
  - **`autonumber` spelling.** `mapFieldTypeToFormType` now maps the spec
    `FieldType` spelling `autonumber` (in addition to the widget-map key
    `auto_number`) to the AutoNumber widget, so a spec-typed `autonumber`
    field/param no longer falls through to the plain text input — fixes the object
    form path as well as action params.

- aefcf39: feat(action-params): serialize file/image action params to storage id(s); retire the approvals composer

  Declared action params of `type: 'file'`/`'image'` now POST the portable API
  contract — the storage id(s) — instead of the upload widget's rich object:

  - `FileField` surfaces the id it already receives from the upload adapter
    (`meta.fileId`) as `file_id` on each emitted file object (additive; the
    record file-field value shape is unchanged).
  - `ActionParamDialog` maps upload-param values to their `file_id`(s) at submit
    (`serializeParamValues`, pure + exported): single → string, `multiple` →
    `string[]`. The api handler already forwards param values untouched, so an
    action with a `file` param POSTs `attachments: string[]`.

  This lets the approvals inbox retire its last hand-wired UI — the approve/reject
  composer with its bespoke attachment upload — so the drawer renders every
  decision through `DeclaredActionsBar` with the declared `attachments` file param
  (framework side declares it; see the paired framework change). `DeclaredActionsBar`'s
  `exclude` prop stays as a general capability.

- 3b2e4d9: fix(list): route remaining system-field groupings through the shared classifier

  Follow-up to the `owner_id` default-column fix: consolidate the display-oriented
  system-field exclusions onto the shared `isSystemManagedField` /
  `SYSTEM_MANAGED_FIELD_NAMES` (from `@object-ui/types`) so the framework-injected
  `owner_id` is treated consistently across the grid, record picker, and detail
  drawer.

  - `ObjectGrid` record-detail drawer: the business-fields vs. muted meta-section
    split now uses the shared classifier, so `owner_id` (and other injected system
    fields) land in the meta section instead of the business body.
  - `deriveLookupColumns` (record picker): drops its local name set for the shared
    classifier — now flag-aware (`field.system`), not just name-based.
  - `RecordDetailDrawer`: its default `systemFields` set is derived from the shared
    `SYSTEM_MANAGED_FIELD_NAMES`; the `systemFields` prop override is preserved.

  `deriveRelatedLists`' narrow "audit FK on every object" set and plugin-detail's
  inline-edit "never editable" set are intentionally left distinct — different
  semantics (the latter deliberately keeps `owner_id` editable).

- Updated dependencies [0318118]
- Updated dependencies [1c8935a]
- Updated dependencies [af1b0db]
- Updated dependencies [8b8b744]
- Updated dependencies [7cf4051]
- Updated dependencies [803558e]
- Updated dependencies [2e7d7f0]
- Updated dependencies [ef14f69]
- Updated dependencies [94d4876]
- Updated dependencies [1100a8b]
- Updated dependencies [7abe4cd]
- Updated dependencies [69fa5d1]
- Updated dependencies [549c67d]
- Updated dependencies [ebe6494]
- Updated dependencies [2b17339]
- Updated dependencies [31b77d4]
- Updated dependencies [6d4fbe6]
- Updated dependencies [0a3710b]
- Updated dependencies [f80aaf2]
- Updated dependencies [62b9ab5]
- Updated dependencies [1629313]
- Updated dependencies [29c6040]
- Updated dependencies [faebac3]
- Updated dependencies [2331ac9]
- Updated dependencies [199fa83]
- Updated dependencies [eee4ded]
  - @object-ui/i18n@16.1.0
  - @object-ui/core@16.1.0
  - @object-ui/types@16.1.0
  - @object-ui/react@16.1.0
  - @object-ui/components@16.1.0
  - @object-ui/providers@16.1.0

## 16.0.0

### Patch Changes

- Updated dependencies [d3e19ed]
- Updated dependencies [59d4fa9]
- Updated dependencies [4c7c47f]
- Updated dependencies [210806a]
- Updated dependencies [b4ef588]
- Updated dependencies [ca0f5f0]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
- Updated dependencies [195a651]
- Updated dependencies [33b4995]
  - @object-ui/react@16.0.0
  - @object-ui/components@16.0.0
  - @object-ui/types@16.0.0
  - @object-ui/i18n@16.0.0
  - @object-ui/core@16.0.0
  - @object-ui/providers@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/i18n@15.0.0
- @object-ui/react@15.0.0
- @object-ui/components@15.0.0
- @object-ui/providers@15.0.0

## 14.1.0

### Minor Changes

- 579b24d: feat(fields+form+detail): file/image uploads in inline line-item grids (#2360)

  `Field.file` in a master-detail inline grid previously degraded to a plain text
  input (no `input[type=file]` on the page → no way to upload from the grid), and
  auto-derived subform / related-list columns silently dropped file fields.

  - **fields**: new `FileCell` — a compact upload control for grid cells (upload
    button + removable chips, image thumbnails), sharing the `UploadProvider`
    pipeline with the full-size `FileField` via an extracted `useFileUploads`
    hook. `GridField` supports `type: 'file'` columns (with `accept` /
    `multiple`), renders file names in list/readonly modes, and no longer falls
    back to a text `<Input>` for file columns.
  - **plugin-form**: `deriveColumns` / `hydrateColumns` no longer exclude
    `file`/`image`/`avatar` fields — they map to `file` columns and carry the
    field's `multiple` + `accept` (image fields default to `['image/*']`).
  - **plugin-detail**: auto-derived related-list columns no longer skip
    `file`/`image` fields — they render through the existing FileCellRenderer /
    ImageCellRenderer (file-name chip / thumbnail).

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

- 2b30583: fix(fields): LookupCellRenderer honors the target object's configured `display_field` (framework#2926 ⑧). ObjectGrid already forwarded `display_field` on the column meta, but the read cell ignored it and always ran the hardcoded heuristics (`name` first), so lookup columns showed the raw API name instead of the configured display/label field. The preferred field now threads through every render path (expanded objects, arrays, JSON strings, and the on-demand `useLookupName` fetch, whose cache key includes the display field to prevent cross-column stale names).
- 3e8bf07: fix(fields): PeoplePicker keyboard cursor no longer resets on identity-only
  result re-emissions

  The cursor-reset effect keyed on the records array identity, so a background
  refetch returning the same records (StrictMode double-effect, refetch-on-focus)
  yanked the active row back to none mid-navigation — surfacing as a flaky
  ArrowDown→Enter CI test and a real (if rare) keyboard UX glitch. The reset is
  now keyed on the record-id signature, so the cursor only resets when the
  results actually change.

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

- 2712fc1: fix(fields+detail): resolve the pre-existing rules-of-hooks violations in the cell renderers

  - `CurrencyCellRenderer` / `EmailCellRenderer` / `PhoneCellRenderer` called
    hooks (`useLocalization`, `useFieldLabel`, `useState`) **after** their
    empty-value early return — a value flipping between null and set changed
    the hook count between renders (latent "Rendered more hooks than during
    the previous render" crash). Hooks now run unconditionally before the
    early return.
  - `useFieldLabel` wrapped `useObjectTranslation()` in try/catch; a throw
    after other hooks ran would desync hook order. The underlying hook is
    provider-safe (optional context + global i18n fallback), so the guard is
    removed.
  - `ReferenceCellRenderer` no longer constructs JSX inside try/catch (the
    try can't catch render errors anyway) — the display string is computed in
    the try, rendered outside.
  - `RecordMetaFooter`'s UserRef renders the registry cell renderer via
    `React.createElement` instead of a locally-assigned capitalized JSX tag
    (flagged as component-creation-during-render; the registry reference is
    stable).

  No behavior change intended; eslint react-hooks errors on these files drop
  to zero.

- Updated dependencies [82441e4]
- Updated dependencies [2efa9fd]
- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
- Updated dependencies [23d65c3]
- Updated dependencies [055e1d2]
- Updated dependencies [9e2d58f]
- Updated dependencies [dea65f7]
- Updated dependencies [f30ff68]
- Updated dependencies [073e7aa]
- Updated dependencies [6c0135c]
- Updated dependencies [5b52624]
- Updated dependencies [4afb251]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f94905d]
- Updated dependencies [f0f10f5]
  - @object-ui/i18n@14.1.0
  - @object-ui/core@14.1.0
  - @object-ui/types@14.1.0
  - @object-ui/react@14.1.0
  - @object-ui/components@14.1.0
  - @object-ui/providers@14.1.0

## 14.0.0

### Minor Changes

- 6a74160: Sharing-rule form: pick, don't type. Three new widget-hint field components make
  the generic object form render pickers where an admin previously had to type
  machine data (driven by the framework `widget` hints on `sys_sharing_rule`;
  generalizes the `capability-multiselect` pattern). All degrade to the underlying
  `type` renderer when a widget is unregistered.

  - **`object-ref`** — choose a registered object by name (searchable `Combobox`),
    backed by the new `DataSource.getObjects()` (`ObjectStackAdapter` lists code-
    and DB-defined objects via `/api/v1/meta/object`), falling back to a
    `sys_metadata` query. Stores the object's `name`.
  - **`filter-condition`** — a visual criteria builder (`FilterBuilder`) scoped to
    the fields of the object chosen in a sibling field (via `getObjectSchema`),
    round-tripping the stored **MongoDB-style** FilterCondition JSON. Criteria the
    builder can't represent (or invalid JSON) fall back to a raw-JSON editor, with
    an always-available "Edit as JSON" toggle — nothing is hidden or lost.
  - **`recipient-picker`** — a record picker whose target object follows a sibling
    `recipient_type` (`user`→sys_user, `team`→sys_team, `business_unit`/
    `unit_and_subordinates`→sys_business_unit, `position`→sys_position), storing the
    value the evaluator matches on (a record id, or the position **name**). Resets
    the stored id when the type changes.

  Wiring: the three keys join `DATA_SOURCE_FIELD_TYPES` (form.tsx) so the form
  threads `dataSource` + `dependentValues` to them, and `INLINE_EXCLUDED_FIELD_TYPES`
  (they're authored in the record form, not a grid cell). `DataSource.getObjects()`
  is optional on the interface; the ObjectStack adapter implements it.

### Patch Changes

- Updated dependencies [443360a]
- Updated dependencies [c70bca7]
- Updated dependencies [86c69c3]
- Updated dependencies [05e56ca]
- Updated dependencies [a44e7b6]
- Updated dependencies [5971cc4]
- Updated dependencies [6a74160]
  - @object-ui/core@14.0.0
  - @object-ui/i18n@14.0.0
  - @object-ui/react@14.0.0
  - @object-ui/types@14.0.0
  - @object-ui/components@14.0.0
  - @object-ui/providers@14.0.0

## 13.2.0

### Patch Changes

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

- Updated dependencies [80901aa]
- Updated dependencies [53c40c2]
- Updated dependencies [e492b9d]
  - @object-ui/components@13.2.0
  - @object-ui/i18n@13.2.0
  - @object-ui/react@13.2.0
  - @object-ui/types@13.2.0
  - @object-ui/core@13.2.0
  - @object-ui/providers@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/core@13.1.0
- @object-ui/i18n@13.1.0
- @object-ui/react@13.1.0
- @object-ui/components@13.1.0
- @object-ui/providers@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [9e38270]
- Updated dependencies [ac04b76]
- Updated dependencies [619097e]
  - @object-ui/i18n@13.0.0
  - @object-ui/components@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/react@13.0.0
  - @object-ui/core@13.0.0
  - @object-ui/providers@13.0.0

## 12.1.0

### Patch Changes

- 6cbccf3: Localize form validation messages, toast client-side validation failures, and make native date/time picker icons legible in dark mode.

  Record-form validation messages (required, min/max length, min/max value, pattern, email, URL) were hard-coded English even when the field label was localized — e.g. a Chinese "计划开始日期" field showed "计划开始日期 is required". `buildValidationRules` baked English strings, so the form renderer's `t(...)` fallback never applied. It now emits `required: true` and, for the other rules, a `messageKey` + `undefined` message (a field-authored `*_message` still wins and passes through verbatim); the form renderer fills the blanks via i18n (`validation.*` keys already exist in every locale), so messages track the label's language.

  When client-side validation blocks a submit, the offending field's inline error can sit below the fold in a long modal/drawer form — the user clicks 创建 and sees nothing happen. The form renderer now also fires a `toast.error` naming the fields (`validation.formInvalid`, added to all 10 locales), mirroring the existing server-error toast so the feedback is visible regardless of scroll position.

  Separately, native controls now declare `color-scheme` (`light` on `:root`, `dark` on `.dark`), so the webkit calendar-picker-indicator and other built-in glyphs render light-on-dark instead of vanishing against the dark input background.

- Updated dependencies [6cbccf3]
- Updated dependencies [e1840bf]
- Updated dependencies [c31874d]
  - @object-ui/components@12.1.0
  - @object-ui/i18n@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/react@12.1.0
  - @object-ui/core@12.1.0
  - @object-ui/providers@12.1.0

## 12.0.0

### Minor Changes

- 226fde9: Cascading & role-gated `select` options (#2284).

  `select` options now accept a per-option `visibleWhen` CEL predicate — the option
  is offered only when it evaluates TRUE against the live record **plus
  `current_user`** (same engine/env as a field-level `visibleWhen`). Combined with a
  field-level `dependsOn`, this drives dependent selects (country → province → city)
  and role/context gating with no bespoke matrix — the same primitives dependent
  lookups (#2215) already use.

  - `@object-ui/core` exposes `resolveVisibleOptions` / `isOptionGroupGated` /
    `resolveDependsOnFields` / `isValueStillOffered` (evaluator), reusing the
    canonical `evalFieldPredicate`.
  - The form renderer narrows a dependent select's option list, gates the control
    with a "Select {parent} first" hint while a `dependsOn` field is empty, and
    clears a now-invalid value when the parent changes.
  - The standalone `SelectField` widget applies the same resolution via
    `dependentValues` + the global predicate scope.

  Client-side hiding is UX, not authorization: gate authorization-sensitive option
  values on the server too. Aligns with `@objectstack/spec` `SelectOption.visibleWhen`.

### Patch Changes

- e36a9c7: Align the DetailView column density with the entry form (objectui#2578 "多列显示").

  - **Detail views now reach up to 4 columns, matching the form.** `inferDetailColumns` was hard-capped at 2 columns and the section column count was derived per-section, so a field-heavy record displayed 2 columns in detail but 4 in the edit form. It now uses the same density scale as the form's `inferColumns` (1 → 2 → 3 → 4 by field count) and `deriveFieldGroupDetailSections` derives the count from the object's _total_ field count and stamps it uniformly on every section — so view and edit read at the same width. The responsive grid classes and `getResponsiveSpanClass` ladder were extended through the 3- and 4-column breakpoints, and the effective column count is clamped to the number of visible fields so a lone field never sits at 1/N width.
  - **Long JSON values no longer spill into the neighbouring column.** `JsonCellRenderer` (used by `address`/`json`/`object`/`composite`/`record` fields) applied `truncate` to a bare inline `<span>`, where `overflow:hidden`/`text-overflow:ellipsis` never clip (there is no width box) and the accompanying `white-space:nowrap` also defeated the cell's `break-words`; a long name-keyed map or address JSON therefore overflowed into the adjacent GPS/color cell once the grid narrowed to multi-column. The renderer is now a `block max-w-full` element so `truncate` clamps to the cell width (full value still on hover), and the detail cell wrappers carry `min-w-0` so unbreakable values wrap instead of setting the track's min width.

- 68e2d1c: Studio UX audit fixes (objectui#2285) — browser walkthrough of the Studio design surface surfaced one rendering bug and several dead-space/discoverability issues; all fixed and re-verified end to end:

  - **Bug — mobile card view showed `[object Object]` for lookup fields.** `ObjectGrid`'s narrow-viewport card layout dumped raw field values through `String(value)` instead of reusing the type-aware cell renderer the desktop table already used; a lookup's expanded object (`{ id, name }`) rendered as the literal string. Now routed through the shared `coerceToSafeValue` helper (newly exported from `@object-ui/fields`, alongside `pickRecordDisplayName`) and a hoisted `renderRecordDetail`, matching the desktop path.
  - **Studio has no responsive/mobile layout.** Below the mobile breakpoint, each pillar's rail (Objects / Flows / Nav tree / Permission sets) now collapses into a toggleable overlay drawer instead of permanently squeezing the canvas into ~190px, and the top pillar-tab bar scrolls horizontally instead of clipping Automations/Interfaces/Access off-screen.
  - **Records tab / Automations canvas had a dead space band.** `ObjectView`'s built-in "+ New" toolbar row (a separate, mostly-empty flex row above the grid) is now folded into the grid's own toolbar via a new optional `onAddRecord` passthrough on `renderListView`; the Automations canvas container now sizes to the pillar's full height instead of its own intrinsic content height.
  - **Automations "fit view" never actually zoomed in.** `fitToView`'s zoom calculation was hard-capped at 100%, so small (2-4 node) flows stayed stranded in a corner of a mostly-blank canvas even after fitting. Removed the artificial cap (now bounded only by the existing `MAX_ZOOM`) and auto-fit once on mount so opening a flow starts appropriately zoomed instead of a fixed 100%/pan-0,0 default.
  - **Validations tab didn't default-select the first rule**, unlike the Access pillar's Permission Set list — now consistent.
  - **HTML/React "source" pages left the Properties panel permanently empty** (no selectable block exists for raw JSX/HTML pages). It now shows a contextual message pointing at the source editor instead of the generic "click a block" empty state.
  - **Permission matrix column headers (C/R/U/D/Tr/Re/Pu/VA/MA) had no visible legend** — added one above the matrix (the header cells' native tooltips stay as-is).
  - **App Builder landing page** widened and given the same icon-badge treatment as Home's app cards, with a 3-column grid on wide screens instead of a narrow fixed-width column stranded in the corner of the viewport.

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/components@12.0.0
  - @object-ui/providers@12.0.0
  - @object-ui/react@12.0.0
  - @object-ui/i18n@12.0.0

## 11.5.0

### Patch Changes

- Updated dependencies [544d8eb]
- Updated dependencies [6fffd3d]
- Updated dependencies [9255686]
- Updated dependencies [fae75e2]
- Updated dependencies [1072701]
  - @object-ui/i18n@11.5.0
  - @object-ui/react@11.5.0
  - @object-ui/components@11.5.0
  - @object-ui/types@11.5.0
  - @object-ui/core@11.5.0
  - @object-ui/providers@11.5.0

## 11.4.0

### Minor Changes

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

### Patch Changes

- bce581a: Fix dependent (cascading) lookups: unlock on parent selection and enforce the
  cascade filter on every candidate surface (#2215).

  Two breaks made `depends_on` unusable end to end:

  - **The gate never unlocked in create mode.** `LookupField` resolved dependent
    values from `ctx.formValues` — a member `SchemaRendererContext` never had —
    and nothing injected the `dependentValues` prop, so with a fresh record
    (`ctx.data = {}`) the child lookup stayed disabled no matter what the user
    picked in the parent field. The form renderer now injects its live form
    values (the same reactive snapshot that drives field rules) as
    `dependentValues` for data-source fields.
  - **The Level-2 table picker bypassed the cascade.** The `depends_on` chain
    only reached the quick-select popover filter; `RecordPickerDialog` (and the
    search-first `PeoplePicker`) received just `lookup_filters`, listing the full
    unfiltered record set. Both pickers now take a `baseFilter` — a hard
    `$filter` constraint merged after `lookupFilters` and user filter-bar input,
    so it can never be widened back out — and `LookupField` passes the dependent
    chain there, shares the same filter with the popover query, and disables the
    browse-all button while dependencies are missing.

- 5160832: fix(fields): inline-edit relational fields with the standard picker (not a text box)

  Inline cell editing reuses the form's field widgets, but the inline map
  (`EDIT_WIDGETS`) was a hand-maintained subset of the form's (`fieldWidgetMap`)
  and had drifted: **lookup / master_detail / user / owner** had perfectly good
  form pickers yet fell back to a plain text box inline (you'd type a raw record
  id). Wire them up — `lookup`/`master_detail` → `LookupField`, `user`/`owner` →
  `UserField`, the exact widgets the form uses. They read the related-object
  dataSource from `SchemaRendererContext` (which the grid provides), so the
  record picker opens, fetches, and selects inline.

  To stop the two lists drifting again, `index` now exports `FORM_FIELD_TYPES`
  and a drift-guard test pins the contract: every form widget type must have an
  explicit inline decision — an editor in `EDIT_WIDGETS` or an entry in the new
  `INLINE_EXCLUDED_FIELD_TYPES` (computed/binary/heavy/container types, each with
  a reason). A future form widget can no longer silently become a text box (or a
  missing editor) in the grid.

- 69d6b94: feat(fields): inline-edit structured-value fields (color, address, location, geolocation, code, qrcode)

  Completes the inline-editor ↔ form-widget parity from the previous fix: the six
  structured types that already had lightweight form widgets — `color`,
  `address`, `location`, `geolocation`, `code`, `qrcode` — now edit inline with
  those same widgets instead of being deferred. All are dependency-light (no map
  or code-editor libraries) and use the standard `FieldWidgetProps`. Verified
  inline on the field-zoo: color → a color picker, code → a textarea, the rest
  their value editors. The drift-guard's exclusion set now contains only the
  genuinely-non-inline types (computed, binary, heavy editors, containers).

- 243a9ba: fix(fields): inline lookup editor shows the selected record's name (not the "Select…" placeholder)

  When editing a `lookup` / `master_detail` / `user` / `owner` field inline in the
  data grid, the `LookupField` picker showed the placeholder instead of the
  current record's name. The grid requests `$expand` for visible reference
  columns, so a lookup cell's value arrives as the related record **object**
  (`{ id, name }`) rather than a bare id. The read cell (`LookupCellRenderer`)
  already resolves objects via the display-name path, but the inline editor only
  matched **primitive** ids (`findOption(value)` with a strict `===`), so an
  object value never resolved — and the hydration effect made it worse by calling
  `findOne(referenceTo, <object>)` with a bogus id.

  `LookupField` now resolves an expanded-reference object directly into its
  display option (mirroring the read cell), skips the pointless per-object fetch,
  and normalises object values to their id for option matching / multi-select
  toggle / removal. `FieldEditWidget` also renders the relational pickers
  `compact` inline — the same single-line, borderless trigger the line-item grid
  uses — so the record name shows **in** the trigger instead of a chip stacked
  above a "Select…" button.

- 289be5b: fix(fields): align inline lookup value resolution with the read cell (external-id strings, tolerant id match)

  Follow-up to #2125. `LookupField`'s inline display now resolves every value
  shape the read cell (`LookupCellRenderer`) does:

  - **JSON-encoded external-id references** (`'{"externalId":"Website Relaunch"}'`)
    are parsed and shown by their external id, and excluded from the hydration
    fetch (so we never `findOne` with a raw JSON string). `recordToOption` gained
    an `externalId` fallback for both the value and the label.
  - **Tolerant id matching** — a `String()`-coerced fallback (`findOptionLoose`)
    resolves a numeric cell value against a string-keyed option (and vice versa),
    matching the read cell's `String(a) === String(b)` comparison. Only consulted
    when the strict match misses, so homogeneous option lists are unaffected.

  Also adds explicit inline-editor tests for `user` / `owner` fields (they
  delegate to `LookupField` via `UserField`), completing coverage for the full
  relational set wired inline in #2122.

- 09e1b26: Show inline line-item (master-detail subform) row actions always, not on hover.
  In grid mode the per-row remove (🗑) and duplicate buttons were `opacity-0`
  until the row was hovered (`group-hover`), so they read as "delete not
  supported" and were unreachable on touch / coarse-pointer devices with no hover.
  They now render at full opacity (kept muted via `text-muted-foreground`); the
  action column width was already reserved, so there is no layout shift. Existing
  `allow_delete: false` / `readonly` / `disabled` / `min_rows` gating is unchanged.
- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [bce581a]
- Updated dependencies [9cd9be1]
- Updated dependencies [c38d107]
- Updated dependencies [7782698]
- Updated dependencies [790558b]
- Updated dependencies [e84d64d]
  - @object-ui/types@11.4.0
  - @object-ui/components@11.4.0
  - @object-ui/i18n@11.4.0
  - @object-ui/core@11.4.0
  - @object-ui/providers@11.4.0
  - @object-ui/react@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [d88c8ec]
- Updated dependencies [b7237bb]
- Updated dependencies [d23d6eb]
  - @object-ui/components@11.3.0
  - @object-ui/i18n@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/types@11.3.0
  - @object-ui/providers@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/components@11.2.0
  - @object-ui/core@11.2.0
  - @object-ui/react@11.2.0
  - @object-ui/types@11.2.0
  - @object-ui/i18n@11.2.0
  - @object-ui/providers@11.2.0

## 11.1.0

### Patch Changes

- Updated dependencies [6726a2b]
  - @object-ui/i18n@11.1.0
  - @object-ui/components@11.1.0
  - @object-ui/react@11.1.0
  - @object-ui/types@11.1.0
  - @object-ui/core@11.1.0
  - @object-ui/providers@11.1.0

## 7.3.0

### Minor Changes

- 788dbf9: feat(fields): wire the `user` field picker to a real `sys_user` search

  The `user`/`owner` field widgets previously rendered a placeholder ("User
  selection component requires integration with user management system") and the
  form-type map fell through to `field:text`, so a `user` field rendered as a
  plain text input.

  `UserField` now **delegates to the shared `LookupField`** with the reference
  fixed to `sys_user` — reusing the existing debounced candidate search, the
  record-picker dialog, and id resolution — so selecting a person works the same
  way as any lookup, with zero bespoke data plumbing. `mapFieldTypeToFormType`
  now maps `user`/`owner` to `field:user`/`field:owner`, satisfying the existing
  `field-type-coverage` regression guard (which already listed both but had no
  mapping wired — the widget map and cell renderers were registered, the form-type
  map was the missing link). Table-cell display continues to use `UserCellRenderer`
  (avatars/initials).

  Pairs with the framework `user` field type (a lookup specialized to `sys_user`).

### Patch Changes

- @object-ui/types@7.3.0
- @object-ui/core@7.3.0
- @object-ui/i18n@7.3.0
- @object-ui/react@7.3.0
- @object-ui/components@7.3.0
- @object-ui/providers@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [8e7c1da]
- Updated dependencies [d23db5c]
  - @object-ui/i18n@7.2.0
  - @object-ui/types@7.2.0
  - @object-ui/components@7.2.0
  - @object-ui/react@7.2.0
  - @object-ui/core@7.2.0
  - @object-ui/providers@7.2.0

## 7.1.0

### Patch Changes

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0
  - @object-ui/react@7.1.0
  - @object-ui/components@7.1.0
  - @object-ui/providers@7.1.0
  - @object-ui/i18n@7.1.0

## 7.0.0

### Minor Changes

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

- 66ed3ad: Line-item grid: item-typeahead auto-fill from a lookup column.

  When a lookup cell's record is picked, `GridField` now copies any of the chosen record's fields whose names match a sibling column (e.g. a product's `unit_price` / `description` drop into the row), then recomputes computed columns — the catalog-typeahead behaviour of QuickBooks / Stripe / NetSuite. Opt out per column with `autofill: false`. `LookupField` gains an optional `onSelectRecord(record)` callback that surfaces the full selected record (not just its id). New pure export `lookupAutofillPatch(columns, col, record)`.

- c6445b6: Line-item grid: inline validation, duplicate, and drag-to-reorder.

  - **Inline per-cell validation** — a required, non-computed cell that's empty on a real (non-ghost) row flags red in place (`aria-invalid` + ring), so errors are visible without submitting.
  - **Duplicate row** — a hover Copy action clones a line (id stripped) directly below it, for near-identical lines.
  - **Drag-to-reorder** — a hover grip handle reorders rows via native drag-and-drop. Set `sort_field` on the grid config to persist order (`row[sortField] = index` stamped on every change); otherwise reorder is order-of-entry.

- 80c133c: Spreadsheet-style line-item grid editor.

  `GridField`'s editable grid mode is reworked into an enterprise line-item editor (the QuickBooks / Stripe / NetSuite pattern), generalised across every inline grid:

  - **Computed read-only columns** — a child field with an arithmetic `expression` (e.g. `amount = quantity * unit_price`) renders read-only, recomputes live as its inputs change, and writes the result back into the row so it persists and the running total reflects it. A small safe arithmetic evaluator (`+ - * / %`, parens, `record.<field>` refs; no `eval`) powers it.
  - **Trailing "ghost" row** — start-with-one + auto-append: typing in the ghost materialises a real row (index-stable, so focus/caret survive), so you keep entering lines without clicking "Add".
  - **Borderless click-to-focus cells** + role-based column widths (description flexes; qty/price/amount stay narrow).
  - **Keyboard navigation** — Enter / ArrowUp / ArrowDown move between rows in the same column.
  - Per-row "expand to full form" is gated to grids that omit fields (no redundant expand on thin lines).
  - `deriveColumns` surfaces a field `expression` as a computed column; the running-total column prefers the computed/last-currency column. Blank/ghost rows are filtered from the persisted batch (`isBlankRow`).

- 5e1b838: Lookup cells in line-item grids. `LineItemsField` columns now support `type: 'lookup'` (with `reference` / `displayField` / `idField`), rendering a real lookup picker per cell that resolves display labels and stores the foreign-key id — so master-detail line grids can reference other objects (category, account, assignee, …) instead of only plain selects.
- 90acb7f: Master-detail subform + lightweight list primitives (SDUI).

  - `MasterDetailForm` (`object-master-detail-form`): enter a parent record and its child line items together; client-orchestrated transactional create (parent → FK → bulk children → rollup → cleanup). Enterprise-convention layout (header on top, line grid, single Save bar at the bottom).
  - `LineItemsField` editable child grid (line numbers, right-aligned numerics, running total) and `LineItemsPanel` (`record:line_items`) for detail-page inline edit.
  - `element:definition-list` and `element:repeater` — lightweight, low-chrome list primitives for simple data.

- 18728c1: Master-detail entry: lighter layout, compact lookup cells, persisted line order.

  - **De-framed line-item section** — the subform no longer double-frames the grid in a `Card` (border + `p-6`); it renders as a light label + the grid's own bordered table, reclaiming the width the line table needs.
  - **Compact lookup cells** — `LookupField` gains a `compact` mode (used by grid cells): the selected value shows inline in a borderless single-line trigger instead of a chip stacked above a separate "Select…" button.
  - **Persisted drag-reorder** — `deriveMasterDetail` detects a sort field (`position`/`sort_order`/…), excludes it from the editable columns/row-form, and threads it as the grid's `sort_field` so reordering stamps `row[position] = index` and survives a reload.

### Patch Changes

- 2d47e94: B2 follow-ups (A): field conditional rules in inline grids + submit-time enforcement.

  - **Grids**: a line-item column's `readonlyWhen` / `requiredWhen` CEL rule is now honored per row — `deriveMasterDetail` carries the props onto the `GridColumn` and `GridField` evaluates them against each row via `resolveFieldRuleState` (a `readonlyWhen`-TRUE cell locks; a `requiredWhen`-TRUE empty cell flags inline-invalid). Rules are row-scoped (`record.*`); the core helpers gained an optional `scope` (and `GridField` a `contextRecord` prop) so a future header-driven lock can bind `parent.*` — that wiring is deferred (it needs the master-detail header's re-renders isolated).
  - **Submit enforcement**: `requiredWhen` already drove react-hook-form's `required` rule, so submit is blocked with a field error when the predicate is TRUE and the value is empty. Added a reactive cleanup so a stale _required_ error clears when the predicate flips FALSE (and all errors clear when a field is hidden by `visibleWhen`).

- bd398df: Render reference/lookup cells as labels, not raw JSON

  A `lookup` / `master_detail` value can arrive as a JSON-encoded object string —
  e.g. an unresolved external-id reference `{"externalId":"Website Relaunch"}`.
  `LookupCellRenderer` treated the whole JSON string as an opaque id, failed to
  resolve it, and fell through to `String(value)`, leaking raw JSON into the grid
  cell (and detail/kanban surfaces).

  - `LookupCellRenderer` now parses a JSON-object-looking string value and renders
    a human label (`name` → `label` → `externalId` → `id`).
  - `coerceToSafeValue` (the shared safe-render helper used by 8 cell renderers)
    gains the same JSON-string parsing, and `externalId` is added to the
    reference-label precedence for plain object values and arrays.

  Verified in the browser (showcase task grid: Project column shows "Website
  Relaunch" instead of `{"externalId":"Website Relaunch"}`) and by unit tests.

- 514f426: fix(master-detail): reliable submit + stable e2e hooks

  Fixes the "click Create, nothing happens" report, surfaced by a new live browser
  e2e harness that drives the form with real input.

  - **MasterDetailForm `handleSave`** now triggers the button-less parent form's
    submit from a deferred macrotask and re-queries the live `<form>` inside it.
    Calling `requestSubmit()` synchronously inside the click handler (right after
    the `setSaving` state update) intermittently dropped the nested submit event,
    so react-hook-form's `onSubmit` never ran and the click appeared to do nothing
    — only the occasional click got through. Deferring makes it fire every time.
  - **Stable `data-testid`s** so automation/e2e can drive the widgets
    deterministically (Radix Select + react-hook-form cannot be driven by
    synthetic DOM events): `select-trigger-{field}` / `select-option-{value}`
    (SelectField), `lookup-trigger-{field}` (LookupField), `line-items-add`
    (GridField), `md-form-submit` / `md-form-cancel` (MasterDetailForm).

- bd8b054: fix(currency): resolve the tenant default currency across the long-tail renderers

  Phase 2b of the currency-resolution work (ADR-0053). The cell/field renderers
  already funnelled through `resolveFieldCurrency` + `useLocalization` (#1856),
  but the rest of the renderers still hard-coded `USD` or read only one of
  `currency`/`defaultCurrency`. They now share the same resolution chain — explicit
  field currency -> `currencyConfig.defaultCurrency` -> legacy `defaultCurrency` ->
  tenant `localization.currency` -> plain number:

  - `plugin-dashboard` `ObjectMetricWidget` (inferred currency), `ObjectDataTable`
    (symbol-format fallback).
  - `plugin-grid` `useColumnSummary` (footer agrees with the cells) and
    `ObjectGrid` (compact amount + name-inferred currency cells).
  - `plugin-detail` `DetailView` summary metrics.
  - `plugin-gantt` `ObjectGantt` currency tooltips.
  - `components` `element:number` (`format: 'currency'`) — tenant default instead
    of a baked-in `USD`, and renders with the tenant locale.

  `resolveFieldCurrency` now lives in `@object-ui/i18n` (co-located with
  `useLocalization`, which supplies the tenant default); `@object-ui/fields`
  re-exports it, so the existing import path is unchanged. No behavior change when
  no tenant currency is configured — a field that declares its own currency, or a
  deployment with no `localization.currency`, renders exactly as before.

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

- Updated dependencies [5976ba3]
- Updated dependencies [a00e16d]
- Updated dependencies [eaccefd]
- Updated dependencies [f7f325d]
- Updated dependencies [c12986e]
- Updated dependencies [71d7ce0]
- Updated dependencies [053c948]
- Updated dependencies [89e113c]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [9049bbe]
- Updated dependencies [77cc6bb]
- Updated dependencies [6c0c92c]
- Updated dependencies [97c6831]
- Updated dependencies [cb2fdb1]
- Updated dependencies [c3749eb]
- Updated dependencies [c09f44e]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [d54346c]
- Updated dependencies [3870c20]
- Updated dependencies [2eb3096]
- Updated dependencies [b88c560]
- Updated dependencies [0ad72a6]
- Updated dependencies [3fa23a7]
- Updated dependencies [18d0339]
- Updated dependencies [59b6bbb]
- Updated dependencies [d16566f]
- Updated dependencies [90acb7f]
- Updated dependencies [7913390]
- Updated dependencies [1394e34]
- Updated dependencies [e95cc25]
- Updated dependencies [abe8ebc]
- Updated dependencies [300d755]
- Updated dependencies [bd8b054]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [2f31406]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/components@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/i18n@7.0.0
  - @object-ui/types@7.0.0
  - @object-ui/providers@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/i18n@6.2.3
- @object-ui/react@6.2.3
- @object-ui/components@6.2.3
- @object-ui/providers@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2
  - @object-ui/i18n@6.2.2
  - @object-ui/providers@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/i18n@6.2.1
- @object-ui/react@6.2.1
- @object-ui/components@6.2.1
- @object-ui/providers@6.2.1

## 6.2.0

### Patch Changes

- @object-ui/react@6.2.0
- @object-ui/components@6.2.0
- @object-ui/types@6.2.0
- @object-ui/core@6.2.0
- @object-ui/i18n@6.2.0
- @object-ui/providers@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/components@6.1.0
  - @object-ui/react@6.1.0
  - @object-ui/providers@6.1.0
  - @object-ui/i18n@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/i18n@6.0.4
- @object-ui/react@6.0.4
- @object-ui/components@6.0.4
- @object-ui/providers@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/i18n@6.0.3
- @object-ui/react@6.0.3
- @object-ui/components@6.0.3
- @object-ui/providers@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/i18n@6.0.2
- @object-ui/react@6.0.2
- @object-ui/components@6.0.2
- @object-ui/providers@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/i18n@6.0.1
- @object-ui/react@6.0.1
- @object-ui/components@6.0.1
- @object-ui/providers@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/i18n@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0
- @object-ui/providers@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/i18n@5.4.2
- @object-ui/react@5.4.2
- @object-ui/components@5.4.2
- @object-ui/providers@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/i18n@5.4.1
- @object-ui/react@5.4.1
- @object-ui/components@5.4.1
- @object-ui/providers@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
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
- @object-ui/providers@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/i18n@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1
- @object-ui/providers@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/i18n@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0
- @object-ui/providers@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/i18n@5.2.1
- @object-ui/react@5.2.1
- @object-ui/components@5.2.1
- @object-ui/providers@5.2.1

## 5.2.0

### Patch Changes

- 6c3f018: `CurrencyCellRenderer` now reads the currency code from three locations
  in priority order: `field.currency` (legacy grid configs) →
  `field.defaultCurrency` (canonical top-level) →
  `field.currencyConfig.defaultCurrency` (nested shape emitted by
  `@objectstack/spec` `Field.currency({ currencyConfig: ... })`).

  Previously the renderer only checked the first two, so currency-type
  fields defined via the canonical spec helper rendered without their
  configured symbol. When none of the three is set, the cell still
  gracefully degrades to a plain formatted number — never silently
  assuming USD.

- d912a60: CRM polish — denser kanban cards, smarter currency, calmer dates.
  - **plugin-kanban card body**: drop the verbose `Label: value` two-column
    grid in favor of a single-column dense list (values only, with the
    field label preserved as a hover `title` for accessibility). Pipeline
    cards across Salesforce / HubSpot / Linear all do this because the
    value's own type carries its meaning, and the saved space lets the
    title breathe.
  - **fields/formatCurrency**: drop trailing `.00` when the value is a
    whole number (Salesforce convention: `$1,234.50` keeps cents,
    `$1,234` doesn't). Pipeline amounts like `500,000.00` now read as
    `500,000`.
  - **fields/formatDate** default branch: drop the year when it matches
    the current year — `7月21日` instead of `2026年7月21日`. Past- and
    future-year dates keep the year for disambiguation
    (`2025年11月23日`).
  - **fields/CurrencyCellRenderer**: removed the now-redundant
    `.replace(/[.,]00$/, '')` workaround that hid cents for `precision:0`
    fields; the formatter now handles whole-unit trimming natively.

- e919433: Stop silently assuming USD when a currency field has no `currency`
  configured. For non-USD orgs (e.g. a CNY-based CRM seeded without an
  explicit currency) the cells now render as plain locale-formatted
  numbers (`150,000.00`) instead of `$150,000.00` — which was the #1
  "why is my RMB showing as dollars?" bug.

  Behavior change is opt-in via omission: when `currency` /
  `defaultCurrency` is set on the field/column, formatting is unchanged.

  Fixed call sites:
  - `@object-ui/fields`: `formatCurrency`, `formatCompactCurrency`, and
    `CurrencyCellRenderer` no longer default-param `'USD'`.
  - `@object-ui/i18n`: `formatCurrency()` falls back to `formatNumber`
    semantics when `currency` is omitted.
  - `@object-ui/plugin-grid`: column-summary formatter (`Sum: 5,000,000`
    instead of `Sum: $5,000,000.00`).
  - `@object-ui/plugin-detail`: header-highlight currency formatter.
  - `@object-ui/plugin-dashboard`: `ObjectMetricWidget` inferred
    currency now resolves to `undefined` (not `'USD'`) for un-tagged
    fields, so `MetricWidget`'s `isCurrency` heuristic falls through
    to plain number formatting.

- d9c3bae: `RichTextField` now translates its inline hints (`Format: markdown`,
  `Rich text editor (basic)`, `Enter text...`) instead of hardcoding
  English. Adds `fields.richText.*` keys to the en / zh locale packs.
- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [321294c]
- Updated dependencies [b2d1704]
- Updated dependencies [0a644f0]
- Updated dependencies [a3cb88f]
- Updated dependencies [5425608]
- Updated dependencies [87bc8ff]
- Updated dependencies [3ebba63]
- Updated dependencies [e919433]
- Updated dependencies [a8d12ec]
- Updated dependencies [70b5570]
- Updated dependencies [aa063db]
- Updated dependencies [d9c3bae]
- Updated dependencies [d1442e3]
- Updated dependencies [7c7400a]
  - @object-ui/types@5.2.0
  - @object-ui/core@5.2.0
  - @object-ui/i18n@5.2.0
  - @object-ui/react@5.2.0
  - @object-ui/components@5.2.0
  - @object-ui/providers@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/types@5.1.1
  - @object-ui/core@5.1.1
  - @object-ui/i18n@5.1.1
  - @object-ui/react@5.1.1
  - @object-ui/providers@5.1.1

## 5.1.0

### Patch Changes

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
  - @object-ui/providers@5.1.0

## 5.0.2

### Patch Changes

- Updated dependencies [cab6a93]
  - @object-ui/i18n@5.0.2
  - @object-ui/components@5.0.2
  - @object-ui/react@5.0.2
  - @object-ui/types@5.0.2
  - @object-ui/core@5.0.2
  - @object-ui/providers@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1
- @object-ui/i18n@5.0.1
- @object-ui/react@5.0.1
- @object-ui/components@5.0.1
- @object-ui/providers@5.0.1

## 5.0.0

### Patch Changes

- Updated dependencies [8930b15]
- Updated dependencies [95b6b21]
- Updated dependencies [ddb08a7]
- Updated dependencies [765d50f]
- Updated dependencies [927187a]
- Updated dependencies [bae8ba8]
- Updated dependencies [8435860]
- Updated dependencies [bb2ea48]
- Updated dependencies [b14fe09]
- Updated dependencies [a7bef6e]
- Updated dependencies [74962b0]
- Updated dependencies [3154334]
- Updated dependencies [fa4c2cb]
- Updated dependencies [7213027]
  - @object-ui/components@5.0.0
  - @object-ui/i18n@5.0.0
  - @object-ui/react@5.0.0
  - @object-ui/types@5.0.0
  - @object-ui/core@5.0.0
  - @object-ui/providers@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/i18n@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0
- @object-ui/providers@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/i18n@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0
- @object-ui/providers@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [3ee436d]
  - @object-ui/components@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/i18n@4.6.0
  - @object-ui/react@4.6.0
  - @object-ui/providers@4.6.0

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
- Updated dependencies [6b6afd1]
- Updated dependencies [22fa558]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/types@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/i18n@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/providers@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

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

- Updated dependencies [2bd45af]
  - @object-ui/components@4.4.0
  - @object-ui/types@4.4.0
  - @object-ui/core@4.4.0
  - @object-ui/i18n@4.4.0
  - @object-ui/react@4.4.0
  - @object-ui/providers@4.4.0

## 4.3.1

### Patch Changes

- Updated dependencies [5f4ac6e]
- Updated dependencies [6b683c8]
  - @object-ui/i18n@4.3.1
  - @object-ui/components@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1
  - @object-ui/providers@4.3.1

## 4.3.0

### Patch Changes

- Updated dependencies [f196cf4]
- Updated dependencies [ee1cc96]
- Updated dependencies [0b032be]
- Updated dependencies [115d36a]
- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/i18n@4.3.0
  - @object-ui/components@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0
  - @object-ui/providers@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1
- @object-ui/i18n@4.2.1
- @object-ui/react@4.2.1
- @object-ui/components@4.2.1
- @object-ui/providers@4.2.1

## 4.2.0

### Patch Changes

- Updated dependencies [eb738bd]
- Updated dependencies [650392e]
- Updated dependencies [84b4bf1]
  - @object-ui/i18n@4.2.0
  - @object-ui/components@4.2.0
  - @object-ui/react@4.2.0
  - @object-ui/types@4.2.0
  - @object-ui/core@4.2.0
  - @object-ui/providers@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/i18n@4.1.0
- @object-ui/react@4.1.0
- @object-ui/components@4.1.0
- @object-ui/providers@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/i18n@4.0.12
- @object-ui/react@4.0.12
- @object-ui/components@4.0.12
- @object-ui/providers@4.0.12

## 4.0.11

### Patch Changes

- Updated dependencies [1909bc3]
  - @object-ui/i18n@4.0.11
  - @object-ui/components@4.0.11
  - @object-ui/react@4.0.11
  - @object-ui/types@4.0.11
  - @object-ui/core@4.0.11
  - @object-ui/providers@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10
- @object-ui/i18n@4.0.10
- @object-ui/react@4.0.10
- @object-ui/components@4.0.10
- @object-ui/providers@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/i18n@4.0.9
- @object-ui/react@4.0.9
- @object-ui/components@4.0.9
- @object-ui/providers@4.0.9

## 4.0.8

### Patch Changes

- Updated dependencies [3d58eaa]
  - @object-ui/i18n@4.0.8
  - @object-ui/components@4.0.8
  - @object-ui/react@4.0.8
  - @object-ui/types@4.0.8
  - @object-ui/core@4.0.8
  - @object-ui/providers@4.0.8

## 4.0.7

### Patch Changes

- Updated dependencies [7c9b85c]
- Updated dependencies [fd15918]
  - @object-ui/core@4.0.7
  - @object-ui/react@4.0.7
  - @object-ui/components@4.0.7
  - @object-ui/i18n@4.0.7
  - @object-ui/types@4.0.7
  - @object-ui/providers@4.0.7

## 4.0.6

### Patch Changes

- 89ae109: Fix click navigation and required-FK form rendering
  - **plugin-grid**: ObjectGrid's `getSelectFields()` now always includes `id` in
    the SELECT projection. Previously, when a view configured `columns` without
    `id`, the SQL driver stripped it from results, and row-click handlers silently
    no-oped because `record.id` was undefined.
  - **plugin-form / fields**: Master-detail fields now render as a single-value
    lookup picker (`LookupField`) in create/edit forms instead of a one-to-many
    related-list widget. From the child-side, master-detail is the FK to the
    parent record and is typically NOT NULL — it must appear in forms. Prior
    behavior dropped it via the auto-layout exclusion list, which caused server
    errors like "NOT NULL constraint failed: contact.account" when users tried
    to create child records.

- 1b6dc64: fix: complete Tailwind v3→v4 migration cleanup
  - Rename deprecated `flex-shrink-0` → `shrink-0` and `flex-grow-N` →
    `grow-N` (Tailwind v4 dropped the long-form aliases). Affects
    data-table, fields/index, FileField, ChatbotEnhanced,
    FloatingChatbotPanel, ProcessDesigner, HistoryPanel, KanbanEnhanced,
    KanbanImpl, plugin-timeline index, FlowDesigner, LayoutRenderer.
  - Replace `theme(spacing.4)` inside arbitrary-value `[calc(...)]` with
    literal `1rem` in sidebar.tsx — `theme()` is deprecated in v4.
  - Remove obsolete v3-escape CSS overrides from index.css and
    sidebar-fixes.css. The component source now uses native v4 stacked
    data variants (`group-data-[state=collapsed]:group-data-[collapsible=icon]:w-(--sidebar-width-icon)`)
    which Tailwind v4 emits correctly without the manual overrides.
    Only the bespoke `.sidebar-menu-button-icon-mode*` rules are kept.

- Updated dependencies [925051d]
- Updated dependencies [1b6dc64]
  - @object-ui/components@4.0.6
  - @object-ui/types@4.0.6
  - @object-ui/core@4.0.6
  - @object-ui/i18n@4.0.6
  - @object-ui/react@4.0.6
  - @object-ui/providers@4.0.6

## 4.0.5

### Patch Changes

- 1dc6061: fix(build): inline dynamic imports in library outputs

  Library `vite build --lib` outputs were emitting separate code-split chunks
  (`rolldown-runtime-*.js`, `LookupField-*.js`, etc.) when source files used
  `React.lazy()` / dynamic `import()`. When consumer apps re-bundled these
  multi-file dists, the library's per-chunk rolldown-runtime collided with the
  consumer's own runtime, causing "TypeError: i is not a function" at runtime
  when lazy components tried to register themselves (e.g. TextField in
  `@object-ui/fields` after 4.0.4).

  Adding `output.inlineDynamicImports: true` to all `@object-ui/*` library vite
  configs forces a single `dist/index.js` per package, which lets consumer
  bundlers handle the library as an opaque ESM module without identifier
  mismatches across chunks.

  Affected packages: components, fields, layout, plugin-aggrid, plugin-ai,
  plugin-calendar, plugin-charts, plugin-chatbot, plugin-dashboard,
  plugin-designer, plugin-detail, plugin-editor, plugin-form, plugin-gantt,
  plugin-grid, plugin-kanban, plugin-list, plugin-map, plugin-markdown,
  plugin-report, plugin-timeline, plugin-view, plugin-workflow.

- Updated dependencies [1dc6061]
  - @object-ui/components@4.0.5
  - @object-ui/types@4.0.5
  - @object-ui/core@4.0.5
  - @object-ui/i18n@4.0.5
  - @object-ui/react@4.0.5
  - @object-ui/providers@4.0.5

## 4.0.4

### Patch Changes

- d2b6ece: fix: externalize all bare imports in library builds

  Library builds (vite lib mode) now externalize every non-relative import instead of bundling third-party CJS dependencies into the published dist. This avoids inlined `require("react")` / `require("react-dom")` calls that cause `Calling \`require\` for "react" in an environment that doesn't expose the \`require\` function` runtime errors when consumer apps re-bundle the published dist.

  Specifically fixes:
  - `@object-ui/plugin-dashboard` no longer inlines `react-grid-layout` (and its transitive `react-draggable` / `react-resizable` CJS bundles). `react-grid-layout` is now declared as a peer dependency so consumers install a single ESM-friendly copy.
  - `@object-ui/components`, `@object-ui/plugin-calendar`, `@object-ui/plugin-charts`, `@object-ui/plugin-designer` no longer inline `react-i18next` / `i18next` / `use-sync-external-store` CJS shims.
  - All plugin packages now use a unified `external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname)` rule, ensuring future additions of CJS deps are automatically externalized.

- Updated dependencies [d2b6ece]
  - @object-ui/components@4.0.4
  - @object-ui/types@4.0.4
  - @object-ui/core@4.0.4
  - @object-ui/i18n@4.0.4
  - @object-ui/react@4.0.4
  - @object-ui/providers@4.0.4

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
  - @object-ui/providers@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/i18n@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1
- @object-ui/providers@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/providers@4.0.0
  - @object-ui/react@4.0.0
  - @object-ui/i18n@4.0.0

## 3.4.0

### Patch Changes

- a2d7023: End-user feature batch — forms, designer history, import/export, and PWA offline sync.

  **Forms (`@object-ui/fields`, `@object-ui/providers`)**
  - `FileField`: native `<input capture="environment">` camera capture for mobile devices, plus a uploading-progress indicator driven by `UploadProvider`.
  - `ImageField`: per-image inline crop/rotate via the lazy-loaded `ImageCropperDialog` (canvas-based, zero new deps).
  - New `UploadProvider` in `@object-ui/providers` with pluggable adapters for S3 and Azure Blob (plus the default object-URL adapter for local previews). XHR-based with progress, abort, and retry.
  - `LookupField`: `lookup.dependsOn: string | string[]` to chain dependent lookups (e.g. State depends on Country); the trigger is gated until parent values are present and the OData `$filter` is built automatically.

  **Container-aware widget widths (`@object-ui/components`)**
  - New `useResizeObserver(ref)` hook exposing `{ width, height }` of any element. SSR-safe; reads the initial size via `getBoundingClientRect`.
  - `plugin-gantt` and `plugin-kanban` now react to their container size instead of `window.innerWidth`, so they behave correctly inside split panels and dashboards.

  **Designer history (`@object-ui/plugin-designer`)**
  - `useUndoRedo` (and therefore `useDesignerHistory`) gains `persistKey` + `storage` options to round-trip the undo/redo stack through `sessionStorage`, plus a `clearPersisted()` cleanup helper. Drafts now survive accidental tab refreshes.
  - New `<HistoryPanel>` component renders the timeline visually with one-click jump-to-checkpoint via the new `jumpTo(index)` API.

  **Import wizard (`@object-ui/plugin-grid`)**
  - Saved column-mapping templates: name, save, re-apply, and delete via a new template bar in the mapping step. Persisted under `objectui:import-templates:${objectName}` (override via `templateStorageKey` / `templateStorage`).
  - Inline validation correction: cells with errors in the preview step are now editable; corrections feed straight into the import without requiring a re-upload, with green-bar status indicators for fixed rows.

  **PWA offline sync (`@object-ui/mobile`)**
  - New `MemoryOfflineQueue` / `IndexedDbOfflineQueue` (`createOfflineQueue()` picks the best backend) backed by IndexedDB.
  - `createOfflineDataSource(inner, { queue })` wraps any DataSource so mutations issued while offline (or that fail with a network-style error) are queued and replayed in order on reconnect. Includes `replay()`, `drop()`, `clear()`, `pending()`, an `onChange` notifier, and an opt-in `resolveConflict` hook for stale-write conflicts.
  - New `useOfflineSync(source)` hook exposes `{ isOnline, pending, isReplaying, replay, drop, clear }` and auto-replays on the browser's `online` event.
  - `getServiceWorkerSource(opts)` emits a customisable Service Worker that pre-caches the app shell, applies network-first to API requests, and broadcasts `REPLAY_QUEUE` to clients on Background Sync. `requestBackgroundSync(tag)` registers a one-shot sync from the page.

- de881ef: Mobile UX round 3 — Form: sticky save bar, fullscreen long-text editor, and auto-stepper for long forms on small viewports.

  **`@object-ui/types`** — `ObjectFormSchema.mobile` (new) lets a single form opt into all three behaviours:

  ```ts
  {
    type: 'object-form',
    objectName: 'leads',
    mode: 'create',
    mobile: {
      stickyActions: true,        // pin Submit/Cancel to bottom on phones
      stepper: 'auto',            // long forms render one field per step
      stepperMinFields: 8,        // …but only past this many fields
      stepperFieldsPerStep: 1,    // … (default 1)
      fullscreenLongText: true,   // textarea fields get an "expand" affordance
    },
  }
  ```

  `FormSchema.mobileStickyActions` (new) is the lower-level escape hatch — applied automatically when `mobile.stickyActions` is set on `ObjectFormSchema`.

  **`@object-ui/plugin-form`** — `ObjectForm` now:
  - propagates `mobile.fullscreenLongText` to every textarea/markdown/html field as `mobile_fullscreen: true`,
  - sets `mobileStickyActions` on the inner form schema and adds `pb-20` padding so content isn't covered by the fixed bar,
  - when `mobile.stepper === true` (or `'auto'` + `useIsMobile()` + > `stepperMinFields` fields), routes the flat field list through the existing `WizardForm` with synthetic single-field "steps" — keeping per-step validation and the existing `Next`/`Back`/`Submit` flow.

  **`@object-ui/components`** — the registered `form` renderer adds:
  - a `mobileStickyActions` opt-in that turns the action row into a `position: sticky; bottom: 0` bar on small viewports, and
  - an inline `FullscreenTextarea` wrapper used when no field-package widget is registered, providing the same expand-button + edit-dialog UX so the feature works even in lighter setups.

  **`@object-ui/fields`** — `TextAreaField` ships the actual fullscreen UX: a top-right `Maximize2` button opens a near-fullscreen `Dialog` containing a full-height `Textarea` with a draft-then-commit save model (Cancel reverts).

  All three behaviours are off by default — existing forms render unchanged.

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/components@3.4.0
  - @object-ui/providers@3.3.3
  - @object-ui/types@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/react@3.4.0
  - @object-ui/i18n@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/i18n@3.3.2
- @object-ui/react@3.3.2
- @object-ui/components@3.3.2

## 3.3.1

### Patch Changes

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/i18n@3.3.1
  - @object-ui/react@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/i18n@3.3.0
- @object-ui/react@3.3.0
- @object-ui/components@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/i18n@3.2.0
- @object-ui/react@3.2.0
- @object-ui/components@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/react@3.1.5
- @object-ui/components@3.1.5
- @object-ui/types@3.1.5
- @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/react@3.1.4
- @object-ui/components@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/components@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/components@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/components@3.1.1
  - @object-ui/core@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3
- @object-ui/components@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/components@3.0.2

## 3.0.1

### Patch Changes

- @object-ui/components@3.0.1
- @object-ui/types@3.0.1
- @object-ui/core@3.0.1

## 3.0.0

### Minor Changes

- 87979c3: Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer

### Patch Changes

- Updated dependencies [87979c3]
  - @object-ui/types@3.0.0
  - @object-ui/core@3.0.0
  - @object-ui/components@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0
  - @object-ui/components@2.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1
  - @object-ui/components@0.3.1
