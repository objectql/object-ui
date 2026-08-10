# @object-ui/plugin-form

## 17.4.0

### Minor Changes

- ecae400: Retire the `capability-multiselect` field widget name, which existed only on the docs-site registration path and which nothing ever stamped (objectui#3308, ADR-0049 enforce-or-remove)

  `field:capability-multiselect` was registered by `registerFields()` and only there. That function's sole caller is the docs site, so the key never existed on the live path (`registerAllFields()`, run at module import, iterates `fieldWidgetMap` — which never listed it). A field authored with `widget: 'capability-multiselect'` therefore resolved to nothing in every real application, while the comment above the registration described it as usable from a record form: a code comment promising a capability that does not exist, which is the worst direction for a metadata renderer AI-authored apps read as authority.

  Nothing stamped the hint either. ADR-0056 P1 stamps `permission-facet-link` on all six `sys_permission_set` facets — `system_permissions` included — through the single `ObjectStackAdapter.getObjectSchema` choke point, and P2 put the capability editor in Studio. The widget name was a leftover from an intermediate iteration of that rollout.

  Removed, with a tombstone at each site:

  - `@object-ui/fields` — the `field:capability-multiselect` registration and the comment that advertised it. **Breaking in name only**: the key was unreachable outside the docs site, so no application could have resolved it. A field still carrying the hint now degrades to its declared `type` renderer, the defined behavior for an unregistered widget.
  - `@object-ui/plugin-detail` — `InlineFieldInput`'s `widget === 'capability-multiselect'` branch, the hint's last honoring surface. Leaving one consumer for a name no producer emits and no form resolves is the same declared-vs-enforced split, inverted. The sibling `permission-facet-link` branch is untouched and pinned.
  - `@object-ui/components` — the dead `capability-multiselect` entry in the form renderer's `DATA_SOURCE_FIELD_TYPES` set, which could never match a resolvable widget.
  - `@object-ui/plugin-form` — a comment naming `capability-multiselect` as the widget stamped onto `sys_permission_set.system_permissions`; it names `permission-facet-link` now, which is what is actually stamped.

  `CapabilityMultiSelectField` itself is **unchanged and still exported**: Studio's `PermissionMatrixEditor` imports and renders it directly, which is ADR-0056 P2's design. Only the widget name is retired — the component is not a registry field widget and its doc comment now says so.

  `registerFields()` is also **kept**, with its `@deprecated Use registerAllFields() instead` note corrected. The two are not interchangeable: it registers `createFieldRenderer(widget)`, which synthesizes the label, description and the local `value`/`onChange` state that lets a bare field node (`{ type: 'currency', label: 'Amount' }`) render standalone in the docs demos. Retiring it needs a decision about where that demo chrome goes; the note now records that instead of implying a drop-in replacement.

- 1bd6faa: fix(fields,plugin-form): stop the inline child grid from collapsing `datetime`/`time` columns onto the `date` control

  `deriveMasterDetail`'s `fieldTypeToColumnType` mapped `date`, `datetime` and `time` onto the single `date` grid column type, and `GridField` renders that as `<input type="date">`. The consequence was not cosmetic: that control emits a bare `YYYY-MM-DD` on change, so a user who merely re-picked the **day** of a `datetime` cell silently wrote the record's time component out of existence — a `14:30` became midnight with no warning and no undo.

  `GridColumn['type']` now carries `'datetime'` and `'time'` alongside `'date'`, and each renders its own control with its own read/write adapter:

  - `datetime` → `<input type="datetime-local">`, read through `toDateTimeInputValue` and written back through `fromDateTimeInputValue`, so the stored shape stays ISO-8601 and read and write share one basis (the contract `DateTimeField` already follows, objectui#3127).
  - `time` → `<input type="time">`, round-tripping the stored zone-less `HH:mm[:ss]` verbatim.
  - `date` → unchanged.

  The read-only surfaces are fixed with it. `displayText()` and the read-only table both fell through to `String(value)` and printed the raw stored ISO on screen (`2026-06-17T00:00:00.000Z`); each temporal type now formats as itself — a day for `date`, day + local time for `datetime`, the wall clock for `time`. That could not be fixed before the type collapse was undone, because with one column type the renderer had no way to know which of the two to show.

  Authors writing explicit grid `columns` can now declare `type: 'datetime'` / `type: 'time'`; previously those spellings were not part of the exported union.

### Patch Changes

- 8497579: A required field whose `defaultValue` is a runtime token is submittable from a create form

  `@objectstack/spec` lets a field's `defaultValue` be a runtime _instruction_
  rather than a value — the `DEFAULT_VALUE_TOKENS` family (`'NOW()'`,
  `'current_user'`) or a CEL Expression envelope. The server resolves those per
  insert, in `ObjectQL.applyFieldDefaults`, for any field that arrives absent or
  null, which is why a create form must leave them empty: seeding the literal text
  `NOW()` into a datetime input and submitting it suppresses the very resolution
  the declaration asked for.

  Correct for an optional field. Combined with `required: true` it deadlocked:

  ```ts
  remind_at: Field.datetime({ required: true, defaultValue: 'NOW()' }),
  ```

  the control opened empty, the client-side required rule refused the submit, and
  there was nothing sensible for the user to type — the declaration had already
  said what the value is, and omitting the field is exactly what makes the server
  supply it. Same shape as the `required` + static-default case, one layer down.

  In **create** mode a runtime `defaultValue` now suppresses the client-side
  `required` rule, and the field is omitted from the payload. The producer
  guarantees the value at insert, so the field is not "missing" — it is
  server-owned. `required: true` alongside a runtime default is coherent authoring
  (storage-level required, producer-guaranteed), not an authoring error.

  Both halves matter. Suppressing the rule alone would have been half an answer: a
  rendered control registers with the form whether or not anything seeded it, so
  an untouched runtime-default field still reached the payload as `undefined` — or
  as `''` once anything focused it. `undefined` is invisible to a
  `JSON.stringify` inspection while remaining a KEY a data source may translate
  into an explicit column write, and `''` is neither absent nor null, so it stores
  a blank and defeats the declaration outright.

  Three boundaries came with it, each pinned in both directions:

  - **Create only.** An edit form shows a persisted row, where the token was
    resolved at insert; blanking a required column there is a real removal and is
    still refused.
  - **Runtime defaults only.** A static literal default _is_ seeded into the
    control, so if the user clears it they have removed a value that was really
    there — `required` still fires.
  - **The rule, not the field.** A value the user does type is submitted normally
    and outranks the declared default. Only the "must not be empty" check is
    suppressed.

  Seeding and this rule read ONE predicate (`isRuntimeDefault`), so a form can
  never seed a field it also refuses to submit. The suppression also drops the
  required marker and `aria-required` for that field in create mode, since both
  are driven by the same boolean — the honest reading, as the user really is not
  required to provide the value. Surfacing what the server _will_ supply, as a
  non-authoritative preview, is a separate follow-up.

  Not extended to `requiredWhen` (the conditional-required CEL rule), which is
  resolved downstream in the form renderer against the live record.

- f0c9a90: Create forms now open with the object schema's declared `defaultValue`s

  A field declared `required: true, defaultValue: 'draft'` opened the console's
  create dialog with an empty select and a required marker: the user had to pick a
  value the system already knew, with every neighbouring option — some with side
  effects — one click away. `defaultValue` + `required` produced the worst create
  experience of any modelling choice, strictly worse than declaring no default.

  The server was never the problem. Omitting the field from a create request
  stores the declared default, because `ObjectQL.applyFieldDefaults` resolves it on
  insert. The gap was container-side: `ObjectForm` seeded its opening values from
  the object schema, and the five other object-form containers did not — their
  create branch set the form data to `initialData || initialValues || {}` and never
  looked at the schema. The console's create dialog is the global `<ModalForm>`,
  one of those five. Modal, Drawer, Tabbed, Split and Wizard now seed through one
  shared module (`schemaDefaults`), so a create form opens preselected and
  submittable.

  Three boundaries came with it, each pinned in both directions:

  - **Create only.** An edit form shows a persisted row as the server holds it.
    `ObjectForm`'s pass had been running in every mode, so a column the record
    leaves unset showed the default — arming a silent write of a value the user
    never chose on the next save of any other field. It is now gated on the same
    "no persisted record" test the data-fetch effect uses.
  - **Static defaults only.** A `defaultValue` may be an instruction the server
    resolves per insert — the `NOW()` / `current_user` runtime tokens
    (`DEFAULT_VALUE_TOKENS`) or a CEL Expression envelope. `ObjectForm` had been
    seeding those verbatim, which put the literal text `NOW()` into a datetime
    input and then submitted it as the field's value, suppressing the very
    resolution the declaration asked for (`applyFieldDefaults` only fills fields
    that arrive empty). Those are now left empty for the server.
  - **Callers still win.** `initialData` / `initialValues` outrank a schema
    default — a lookup prefill or a duplicate-record seed is the more specific
    instruction.

  Only the field-level `defaultValue` is honoured, not a select option's
  `default: true`, even though `@objectstack/spec`'s `SelectOptionSchema` declares
  that key: the insert path resolves `defaultValue` and nothing else, so seeding
  from option-level `default` would preselect values the server would never have
  applied — a UI-only second default contract.

- 5bfaabd: `PageComponentSchema.dataSource` now reaches every object-bound block, not just
  `list-view` — and `element:record_picker` stops discarding `view`
  (objectstack#6953).

  objectstack#5576 wired the spec's per-element data binding
  (`dataSource: { object, view?, filter?, sort?, limit? }`) to `list-view` and left
  the same declaration inert on every other page component. Two gaps remained, and
  both were silent:

  - **`element:record_picker` read four of the five keys and dropped `view`.** So
    `dataSource: { object: 'account', view: 'hot' }` — the spec's own example —
    built a picker over EVERY account instead of the rows the saved view selects.
    Nothing threw and nothing rendered an error; the option list was simply wider
    than what was authored, which also means a user could select a record the page
    said was out of scope.
  - **`object-grid` / `object-form` / `object-kanban` / `object-calendar` /
    `object-chart` / `object-metric` / `record:related_list` read none of it.**
    Each gates its fetch on its own `objectName`, and nothing mapped
    `dataSource.object` onto it, so a page written the way the spec documents
    rendered an empty grid / a field-less form / a board with no cards / an empty
    month / an empty chart / a static metric number — with no request and no
    diagnostic anywhere. Spec-valid metadata rendering nothing is the
    objectstack#4413 shape.

  Composition follows objectstack#5576's landed semantics unchanged on every block:
  a named saved view supplies the baseline, a key written on the component itself
  overrides it, an explicit binding key overrides both, `filter` AND-combines
  ("additional filter criteria" — a binding can narrow a view, never widen it), and
  a `view` name that does not resolve renders a configuration error instead of
  degrading to the object's full scope.

  - `@object-ui/react` — new `useElementDataSourceSchema(schema, mapping, dataSource?)`
    and `ElementDataSourceGate` apply a resolved binding to the schema keys a given
    block reads, plus `ElementDataSourceErrorPanel` / `ElementDataSourceLoadingPanel`
    for the two non-final states. One precedence table for all blocks rather than
    one copy per block — that copy is how "additional filter criteria" would have
    become two dialects.
  - A mapping names **only** keys its block genuinely reads. A composed value
    written onto a key the block ignores would be accepted and dropped, which is
    the defect being removed, one layer deeper — so a kanban's swimlane `columns`
    never receive a view's field list, and a block with no row cap leaves `limit`
    unmapped. The per-block coverage table, including two residual gaps that are
    named rather than papered over, is in `content/docs/guide/data-source.md`.

  No behaviour changes for a block that carries no `dataSource`: the binding-free
  path returns the schema by reference, so nothing remounts and nothing refetches.

- 022002a: `PageComponentSchema.dataSource` now reaches the remaining object-bound public
  blocks: `object-gantt` / `object-timeline` / `object-map` / `object-pivot` /
  `object-master-detail-form` / `embeddable-form` / `record:line_items`
  (objectstack#7121).

  objectstack#6953 wired the spec's per-element data binding
  (`dataSource: { object, view?, filter?, sort?, limit? }`) to the eight blocks it
  named and left the same declaration inert on these seven. Each gates its fetch on
  its own object key and nothing mapped `dataSource.object` onto it, so a page
  written the way the spec documents rendered an empty gantt / an empty timeline
  rail / a map with no markers / an empty cross-tab / a field-less form — with no
  request and no diagnostic anywhere. Spec-valid metadata rendering nothing is the
  objectstack#4413 shape.

  Composition follows objectstack#5576's landed semantics unchanged, through the
  shared `ElementDataSourceGate` (no change to it or to the resolution layer): a
  named saved view supplies the baseline, a key written on the component itself
  overrides it, an explicit binding key overrides both, `filter` AND-combines
  ("additional filter criteria" — a binding can narrow a view, never widen it), and
  a `view` name that does not resolve renders a configuration error on every one of
  these blocks instead of degrading to the object's full scope.

  Each block maps **only** the keys it genuinely reads, which for this batch means
  several keys stay deliberately unmapped rather than being parked somewhere
  plausible:

  - `object-gantt` and `object-map` take `object` / `filter` / `sort`; neither has a
    row cap or a field-list read site.
  - `object-pivot` takes `object` / `filter`; a cross-tab orders itself by its own
    row/column grouping and cannot be computed over a truncated page.
  - `object-timeline` takes `object` only — its fetch is
    `find(objectName, { options: { $top: 100 } })`, with no filter/sort read site
    at all, so a named view is error-checked and then contributes nothing.
  - `embeddable-form` and `object-master-detail-form` take `object` only (the
    parent object, in the master-detail case); a form that writes one record has no
    collection query for `filter` / `sort` / `limit` to narrow.
  - `record:line_items` takes `object` onto **`childObject`** — the collection it
    actually lists — and nothing else: its query is the parent FK plus a fixed
    `$top: 500`, and its `columns` are editable `GridColumn` objects rather than a
    field-name projection a view could supply.

  The per-block coverage table, including every residual gap named above, is in
  `content/docs/guide/data-source.md`.

  No behaviour change for a block that carries no `dataSource`: the binding-free
  path returns the schema by reference, so nothing remounts and nothing refetches.

- 6d762da: The five locale keys behind #3546's eight no-fallback `t()` call sites are now defined in all ten packs, so the built-in-view toasts, the activity-timeline source link, the wizard's required-field toast and the Gantt refresh button's accessible name are translated instead of falling back to English — or, on two surfaces, to the key itself (part of #3546).

  `scripts/check-i18n-call-site-keys.mjs` measured 258 keys that a `t()` call site asks for and no pack defines. These five were the subset with no working inline default: `console.objectView.cannotEditMetaView`, `console.objectView.cannotDeleteMetaView`, `detail.viewSource`, `gantt.toolbar.refresh` and `wizard.missingRequired`. Adding a `defaultValue` is deliberately not the fix — that mechanism is what kept all 258 invisible for months.

  **Two of the eight sites really did render the raw key**, and both go through a binding with nothing in front of i18next. `ObjectView.tsx` calls `useObjectTranslation()` directly, so five toasts read `console.objectView.cannotEditMetaView` / `cannotDeleteMetaView` on screen; the `|| 'Built-in views cannot be renamed.'` guards next to them were dead on every path, because i18next answers a miss with the key itself and a non-empty string never falls through `||`. Those four unreachable English strings are removed rather than repaired: one key served four call sites (rename / pin / set-as-default / configure), so the pack copy covers any change to a built-in view instead of naming one operation. `RecordActivityTimeline.tsx` fails the same way for a subtler reason — `useDetailTranslation` is `createSafeTranslation(..., 'detail.back')`, and because `detail.back` does resolve, the probe hands back i18next's `t` for every key and bypasses the defaults map wholesale, so `detail.viewSource` reached the user verbatim.

  **The other two sites were not rendering a raw key**, contrary to the issue's description, and are fixed here as the milder "English in all ten languages" class. `wizard.missingRequired` is its own hook's probe key, so the probe failed and `createSafeTranslation` correctly served its English default. `gantt.toolbar.refresh` goes through `useGanttTranslation`, which deliberately does not use `createSafeTranslation` and falls back per key — so the refresh button's `aria-label` was "Refresh", in English, never the key. Screen-reader users heard an English word rather than an identifier; a `zh` session now hears 刷新.

  Regression cover is provider-mounted on purpose: with no `I18nProvider` the defaults maps answer every one of these keys and the assertions pass while the console is broken, which is precisely the false-green the issue documents. For the two sites whose English output was already correct, `en` cannot discriminate before from after — the `zh` assertions are the ones that pin the fix.

- 11c1e71: Resolve a `select` field declared `multiple: true` to the `field:multiselect` widget, so the object form's visible label actually names the chip picker it renders (objectui#3986).

  `mapFieldTypeToFormType` keyed the widget id on the field's `type` string alone, so an object-schema `{ type: 'select', multiple: true }` picklist — a spec-legal, entirely ordinary shape — became `field:select`. `SelectField` then delegated to `MultiSelectField` on `config.multiple`, so the component that RENDERED was the chip picker while everything keyed on the widget id still answered for the single-value combobox. Above all the label-association declaration (`ComponentMeta.labelling`, objectui#3961), which the form renderer resolves per widget id: the host emitted `<label for>` at the chip row's wrapper `div`, where a `for` is inert — `HTMLLabelElement.control` returns `null`. Visually the field had a label; in the accessibility tree that label named nothing. Measured on the object-form path, `role=group` + accessible name went from 1 for a `multiselect`-typed field (fixed in objectui#3975) to 0 for this one.

  Declaring `select` itself `labelling: 'group'` was not available: a single-value select's trigger is a labelable `button[role=combobox]` whose `for` association works, and a bare `select` is a builtin the renderer resolves without consulting the registry at all. The fix is therefore at the producer — the widget id now carries the arity, so one place decides which widget renders and the declaration can no longer be addressed to a widget that is not rendering.

  - `mapFieldTypeToFormType(fieldType, config?)` takes an optional second argument — the rest of the field definition, of which only `multiple` is read. Existing single-argument calls are unchanged, and so is every type outside the new table: `select` is the only one whose `multiple` form is a different WIDGET. The spec's multi-capable set is larger (select / lookup / file / image, with `radio` on the select branch and `user` storing like `lookup`), but `LookupField`, `FileField` and `ImageField` each render both arities themselves, so their id — and their labelling declaration — is already right for either.
  - The four object-form producers pass the pair: `ObjectForm`, `DrawerForm`, `ModalForm`, and `sectionFields` (Tabbed / Wizard / Split / Drawer / Modal). In `sectionFields` the id is now computed once from the EFFECTIVE pair, after view-level overrides have merged, because `multiple` is itself a spec `FormField` key: a view restating only `multiple: true` over a single-value object field moves the widget too, and `multiple: false` moves it back.
  - `SelectField`'s `multiple` delegation is KEPT, not retired. Measured, it stays reachable from three entrances that never consult the alias map: the inline grid editor (`FieldEditWidget` finds `select` in its own table first), `ActionParamDialog` (`resolveFormWidgetType` returns `select` from `fieldWidgetMap` first), and hand-written SDUI addressing `field:select` by name with `multiple` on its metadata.

  Read-only rendering of these widgets is untouched (objectui#4005), as is the built-in `Select` branch (objectui#3976).

- 523be48: `object-timeline` and `record:line_items` now apply the filter / sort / row cap they are given, so a named `dataSource.view` narrows them instead of contributing nothing

  These were the two residual gaps in objectstack#7121's per-block coverage table
  (objectstack#7137). Both blocks are object-bound lists, both accepted the spec's
  per-element `dataSource` binding, and neither had a read site for `filter` or
  `sort` anywhere in its fetch:

  - `object-timeline`'s entire query was
    `find(objectName, { options: { $top: 100 } })`.
  - `record:line_items`' was the parent FK plus a fixed `$top: 500`.

  So `dataSource: { object, view: 'hot' }` resolved the view — a typo still reported
  a configuration error, it never degraded into an unfiltered query — and then
  dropped everything the view said. The rendered rows could be **wider than the view
  they named**, silently, which is exactly the class of mistake AI-authored metadata
  hides best: the page looks like it works. objectstack#7121 deliberately left the
  keys unmapped and recorded the gap rather than writing composed values onto schema
  keys nobody read; this closes it at the fetch instead.

  What each block now reads:

  - **`object-timeline`** — `$filter: schema.filter`,
    `$orderby: convertSortToQueryParams(schema.sort)`, and
    `$top: schema.limit ?? 100`, matching the form `object-gantt` / `object-map` /
    `object-calendar` already use. Its registry mapping gains
    `filter` / `sort` / `limit`; `columns` stays unmapped, because a timeline
    projects the fields its `timeline` config names.
  - **`record:line_items`** — the composed filter is **AND-combined** with the parent
    relationship condition through `mergeFilterNodes`, never substituted for it, the
    same way `record:related_list` composes its own since objectstack#7118: a
    line-items panel is always scoped to the record it sits on, so an _additional_
    criterion can only narrow this parent's children and can never surface another
    parent's rows. `sort` becomes the load order and `limit` the row cap (default
    500). `columns` stays unmapped — here they are `GridColumn[]` driving an editable
    grid, not a field-name projection, so a view's column list would be the wrong
    _shape_ rather than merely a wider answer.

  **Behaviour change worth knowing about:** the timeline's default window is now a
  real cap. `{ options: { $top: 100 } }` nested the limit under a key that is not a
  `QueryParams` field and that no adapter in this repo reads (`convertQueryParams`
  maps `params.$top`), so the intended window never reached the wire and a timeline
  over a large object fetched whatever the server chose to return. It is now sent as
  `$top`, and authorable via `limit` or a view's `pagination.pageSize`.

  `@object-ui/core` gains `convertSortToQueryParams`, the sort→`$orderby` lowering
  the three sibling blocks each inline privately. It is shared rather than copied
  twice more, and is slightly more faithful to the declared contract than those
  copies: a sort entry that omits `order` means ascending instead of being dropped
  (the string spelling `"amount"` already meant ascending in the same copies), and
  nothing orderable yields `undefined` rather than a truthy empty `{}`. Migrating
  the three existing copies onto it is objectstack#7148 and is not done here.

- Updated dependencies [794c497]
- Updated dependencies [993336f]
- Updated dependencies [f0a625a]
- Updated dependencies [b5980f4]
- Updated dependencies [8aad9fd]
- Updated dependencies [6719877]
- Updated dependencies [56ff091]
- Updated dependencies [0186cdc]
- Updated dependencies [7864f03]
- Updated dependencies [ea41a59]
- Updated dependencies [0cbdca8]
- Updated dependencies [d229dfa]
- Updated dependencies [ecae400]
- Updated dependencies [4bc6c23]
- Updated dependencies [d3e738a]
- Updated dependencies [c3b01a7]
- Updated dependencies [f5f8744]
- Updated dependencies [7ed3360]
- Updated dependencies [69becd2]
- Updated dependencies [5e52495]
- Updated dependencies [0fa5e4d]
- Updated dependencies [b750823]
- Updated dependencies [5bfaabd]
- Updated dependencies [e06810e]
- Updated dependencies [ab3ad4f]
- Updated dependencies [65bb513]
- Updated dependencies [c97a45e]
- Updated dependencies [b19162d]
- Updated dependencies [c2fd122]
- Updated dependencies [1bd6faa]
- Updated dependencies [ac2139c]
- Updated dependencies [b14ab3a]
- Updated dependencies [e24d767]
- Updated dependencies [8c60819]
- Updated dependencies [aca561a]
- Updated dependencies [e64a52e]
- Updated dependencies [844d17f]
- Updated dependencies [d8a0be4]
- Updated dependencies [48132f7]
- Updated dependencies [4dcd52a]
- Updated dependencies [42ae5c6]
- Updated dependencies [0ef9dfd]
- Updated dependencies [f4b97c8]
- Updated dependencies [1d723e3]
- Updated dependencies [0109f54]
- Updated dependencies [7e5bb5d]
- Updated dependencies [fbc23e0]
- Updated dependencies [6d762da]
- Updated dependencies [e6fdbdc]
- Updated dependencies [54233b1]
- Updated dependencies [c2ecbae]
- Updated dependencies [f9faa7d]
- Updated dependencies [97b63d7]
- Updated dependencies [6bb454a]
- Updated dependencies [11c1e71]
- Updated dependencies [523be48]
- Updated dependencies [7e2b7e9]
- Updated dependencies [33526fd]
- Updated dependencies [32413ec]
- Updated dependencies [c1e1e6b]
  - @object-ui/components@17.4.0
  - @object-ui/react@17.4.0
  - @object-ui/core@17.4.0
  - @object-ui/fields@17.4.0
  - @object-ui/i18n@17.4.0
  - @object-ui/types@17.4.0
  - @object-ui/permissions@17.4.0

## 17.3.0

### Minor Changes

- f44d872: `mobile.fullscreenLongText` finally reaches auto-generated long-text fields, and
  `mobile_fullscreen` gets one declared carrier (objectui#3245).

  FROM: `ObjectForm` stamped the flag onto the FormField itself
  (`{ ...f, mobile_fullscreen: true }`). TO: it stamps the flag onto the object the
  form renderer will actually forward to the widget as `field` — `f.field || f`,
  resolved exactly the way `renderFieldComponent` resolves it.

  **The flag's only legal carrier is the field metadata, and its only producer is
  `ObjectForm`.** That convention was already what the widget side assumed after
  objectui#3232/#3233 (`TextAreaField` reads `field.mobile_fullscreen` and nothing
  else, and `field` is the single metadata carrier); the producer was writing to a
  different object, so for auto-generated fields the two never met.

  What was broken, end to end: `ObjectForm` builds an auto-generated field as
  `type: 'field:textarea'` **and** stashes the object-field metadata on `.field`.
  The renderer forwards `field: field.field || field`, so the widget received the
  raw metadata — which never carried the flag — while the FormField-level copy was
  dropped by `stripRegisteredFieldProps`. Every entry point into `TextAreaField`
  therefore read `undefined` and the expand affordance never rendered. Only the
  hand-authored `customFields` path (no `.field` to shadow the FormField) ever
  worked, i.e. the feature was dead on the path virtually every form takes. Unit
  tests on both ends passed the whole time, because the break lived in the seam
  between them; this release adds the feature's first integration coverage — real
  `ObjectForm` → real form renderer → real `TextAreaField`, no mocks — which fails
  against the old producer and passes against the new one.

  `mobile_fullscreen` is now declared on `@object-ui/types`' `BaseFieldMetadata`,
  hence on every member of the `FieldMetadata` union that
  `FieldWidgetComponentProps.field` resolves to. It is deliberately **not** an
  `@objectstack/spec` property: nobody authors it on a field definition, it is a
  projection of the form-level `ObjectFormSchema.mobile.fullscreenLongText` setting
  onto the field metadata at render time. Declaring it removes the last untyped
  end of the chain — the producer's `as FormField` cast is gone — so the two sides
  can now disagree out loud instead of silently.

  The hand-authored `customFields` path keeps working unchanged, and keeps its own
  metadata: the flag is stamped on the FormField only when there is no `.field` to
  carry it. Synthesizing a `field` object in that case would light the affordance
  up while quietly replacing the field's `rows` / `placeholder` with defaults — the
  regression test pins that too.

- 30ae33a: `RichTextField` honours `mobile_fullscreen`, so `mobile.fullscreenLongText` is
  finally true of rich text too (objectui#3301).

  `ObjectFormSchema.mobile.fullscreenLongText` has always been documented as
  "textarea/rich-text get an expand button", and `ObjectForm` has always stamped
  `mobile_fullscreen` onto `field:markdown` / `field:html` fields to deliver it.
  Both of those types resolve to `RichTextField`, and that widget never read the
  flag: a producer with no consumer. Turning the setting on gave a phone user an
  expand affordance on their textareas and nothing at all on their markdown or
  HTML fields, with nothing anywhere reporting that half the feature was inert.

  FROM: `RichTextField` ignored the flag entirely (`grep fullscreen` over that
  file returned nothing). TO: it reads `field.mobile_fullscreen` — the same single
  metadata carrier `TextAreaField` reads, and nowhere else — and renders the same
  expand affordance and full-height editing dialog.

  **The affordance now has one implementation, not two.** One form-level setting
  should produce one behaviour, so the expand button, the dialog and the
  draft/commit semantics moved into a shared `FullscreenFieldEditor` that both
  widgets render; only the EDITOR is per-widget. A second hand-written copy of
  that state machine would be the same defect this release fixes, with an extra
  step — it drifts, and nothing reports the drift. The rich-text dialog hosts the
  widget's real editing surface (same format indicator, same editor), not a bare
  textarea, so whatever that editor grows into, both positions get it at once.

  Behaviour is identical across the two widgets and unchanged for
  `TextAreaField`: the dialog seeds its draft from the committed value at open
  time, keeps typing local (a react-hook-form field is not marked dirty by an
  edit the user may still cancel), commits once on "Done", and discards on
  "Cancel". Test ids follow the existing convention per widget —
  `richtext-fullscreen-toggle` / `-dialog` / `-input` / `-save` alongside the
  `textarea-*` ones, since a single form can contain both.

  There is deliberately no prop spelling of the flag and no `??` fallback chain in
  either widget. The field metadata is the one carrier (objectui#3233), so a
  misspelled or misplaced flag stays inert and visible rather than being quietly
  caught by a tolerant consumer.

  Also removes a dead type from the producer: `ObjectForm` stamped the flag on
  `'string-multiline'`, a string that `grep -rn` finds exactly once across both
  this repo and `objectstack` — that line itself. No producer emitted it, no
  registry key matched it, no widget read it. The remaining four stamped types
  (`textarea`, `field:textarea`, `field:markdown`, `field:html`) each have a real
  reader.

### Patch Changes

- a4cff5b: Conditional-rule predicates that fail to evaluate are no longer silent
  (objectstack#5149, appeal 2). `evalFieldPredicate` — the canonical funnel for
  `visibleWhen` / `readonlyWhen` / `requiredWhen`, view-level `visibleOn`, legacy
  `condition`, per-option `visibleWhen`, screen-field predicates and list
  conditional formatting — now logs **one `console.warn` per predicate text**
  when evaluation fails (parse error, unbound identifier, engine fault), carrying
  the predicate source, the engine's failure reason, and the field/rule locator
  the call site provides. Renderer call sites thread that locator
  (`visibleWhen of field 'amount'`), so a broken predicate identifies itself in
  the browser console instead of being indistinguishable from an absent one.

  Verdicts are unchanged: evaluation still fails open to the caller's safe
  default (flipping that default is objectstack#5149 appeal 1, tracked
  separately). Fault-probing callers (`evalRowPredicate`'s fail-closed path,
  `ExpressionEvaluator`'s `throwOnError`) opt out via the new
  `diagnostic.warn: false` and keep their own single diagnostic, so no broken
  predicate ever warns twice.

- Updated dependencies [18cd432]
- Updated dependencies [b7165ce]
- Updated dependencies [532cf8b]
- Updated dependencies [680080a]
- Updated dependencies [a7651e6]
- Updated dependencies [d915c47]
- Updated dependencies [b71fc92]
- Updated dependencies [65516ba]
- Updated dependencies [94c5b7c]
- Updated dependencies [ca0fa8f]
- Updated dependencies [34595eb]
- Updated dependencies [3889ffb]
- Updated dependencies [5781fb1]
- Updated dependencies [7e2406a]
- Updated dependencies [9e9e9a9]
- Updated dependencies [19b8c9b]
- Updated dependencies [56409c2]
- Updated dependencies [042e09d]
- Updated dependencies [7d08c3f]
- Updated dependencies [9cbcbf4]
- Updated dependencies [85c4c9c]
- Updated dependencies [fd54c3e]
- Updated dependencies [4eeb932]
- Updated dependencies [6fe485b]
- Updated dependencies [5c856ec]
- Updated dependencies [23018cc]
- Updated dependencies [53811d1]
- Updated dependencies [68b6a28]
- Updated dependencies [0554e88]
- Updated dependencies [d915c47]
- Updated dependencies [f44d872]
- Updated dependencies [28b2e65]
- Updated dependencies [509104a]
- Updated dependencies [825bbe3]
- Updated dependencies [6195841]
- Updated dependencies [5dd0127]
- Updated dependencies [06632e9]
- Updated dependencies [a415684]
- Updated dependencies [a4cff5b]
- Updated dependencies [175bd79]
- Updated dependencies [5af2852]
- Updated dependencies [34d9169]
- Updated dependencies [5881a2c]
- Updated dependencies [9bc3709]
- Updated dependencies [f833d3a]
- Updated dependencies [30ae33a]
- Updated dependencies [a6ec93d]
- Updated dependencies [2a9513d]
- Updated dependencies [49f7449]
- Updated dependencies [71be406]
- Updated dependencies [d22ae31]
- Updated dependencies [c7ed4c3]
- Updated dependencies [2409e1d]
- Updated dependencies [789fe3e]
- Updated dependencies [f789c3b]
- Updated dependencies [a321fa4]
- Updated dependencies [8d8094a]
  - @object-ui/core@17.3.0
  - @object-ui/fields@17.3.0
  - @object-ui/components@17.3.0
  - @object-ui/types@17.3.0
  - @object-ui/i18n@17.3.0
  - @object-ui/react@17.3.0
  - @object-ui/permissions@17.3.0

## 17.2.0

### Minor Changes

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

- 335041c: Stop declaring 13 `@object-ui/core` symbols under names `@objectstack/spec` owns
  (objectui#3158, objectstack#4115 batch 4).

  **Breaking for importers of `@object-ui/core`** — seven exported names changed,
  because the spec exports the same name for a _different_ thing:

  | was                      | now                               | what the spec's same-named export actually is                                |
  | :----------------------- | :-------------------------------- | :--------------------------------------------------------------------------- |
  | `ChartSeries`            | `ChartSeriesBinding`              | the authored dataset-binding descriptor (a measure `name`, no `data`)        |
  | `ActionHandler`          | `ActionRunnerHandler`             | the SERVER-side objectql handler, `(ctx) => unknown`                         |
  | `PluginDefinition`       | `RegistryPluginDefinition`        | the platform PACKAGE manifest (`id`/`slug`/`staticPath`/install hooks)       |
  | `ValidationError`        | `SchemaNodeValidationError`       | plugin-manifest validation, keyed by `field`, no severity                    |
  | `ValidationResult`       | `SchemaNodeValidationResult`      | ditto, with both arrays optional                                             |
  | `defineView`             | `defineSystemView`                | the VIEW-DOCUMENT factory: parses a `ViewSchema`, returns a validated `View` |
  | `resolveCrudAffordances` | `resolveEffectiveCrudAffordances` | the object-level affordance matrix, with no notion of server API operations  |

  The other six keep their names and are now **imported from the spec** instead of
  re-declared: `StyleMap`, `ResponsiveStyles` (ADR-0065), `RowHeight`,
  `CONTEXT_TOKENS`, `CrudAffordances`, `RowCrudPredicates`.

  **The copies were live misdescriptions, not just duplicates.** Three said so in
  their own comments:

  - `CONTEXT_TOKENS` carried a note that the duplication was "temporary until the
    next coordinated release… because the installed `@objectstack/spec` predates
    that export". The installed spec (17.0.0-rc.0) exports it, and the copy was
    byte-identical — so it passed every value comparison and every behavioural
    test for the whole interval in which its stated reason was false.
  - `RowHeight` advertised itself as "the spec's `RowHeightSchema` vocabulary"
    while being a hand-written union. It happened to be correct; nothing would
    have caught the day it stopped being.
  - `managedBy.ts` described itself as a "UI-side mirror of the framework's
    `resolveCrudAffordances()`" and carried its own `DEFAULTS` table — a
    line-for-line copy of the spec's `CRUD_AFFORDANCE_DEFAULTS`, plus a copy of
    its override parser.

  `resolveEffectiveCrudAffordances` now **delegates** the bucket/`userActions` half
  to the spec's `resolveCrudAffordances()`, so the bucket table has exactly one
  definition on the platform. What stays objectui's is the part the spec has no
  notion of: intersecting that matrix with the server-resolved effective API
  operation set (#3391), so the UI never offers a button the server would 405 —
  and the name now says that instead of claiming to be the spec's function.

  Deriving `RowCrudPredicates` also **tightens** it: the local copy typed
  `visibleWhen`/`disabledWhen` as `unknown`, where the spec types them as
  `Expression | ExpressionInput`. That was imprecision, not a deliberate dialect.

- 5eaa861: `list-view` and `embeddable-form` get a data source on the registry path — their required `objectName` was binding to nothing (#3144).

  `SchemaRenderer` puts the data source on `SchemaRendererContext` and **never** injects it into
  component props. A component that reads `props.dataSource` therefore needs its registration to
  bridge the two. `object-form`, `object-kanban` and `object-calendar` each register a small
  renderer that does exactly that. These two did not:

  - `list-view` (and its `view:list` alias) registered the bare `ListView`, which reads
    `props.dataSource` — so its `getObjectSchema` effect returned immediately, nothing was ever
    fetched, and it rendered the `empty-state` "Nothing here".
  - `embeddable-form`'s renderer was `({ schema }) => <EmbeddableForm config={schema} />`, dropping
    the context entirely — so the read-only source it derives for its inner `ObjectForm` was never
    built, and its submit path (`if (dataSource) await dataSource.create(...)`) had nothing to call.

  Both declare `objectName` **required** in their registry `inputs`. A binding the protocol obliges
  an author to supply, that nothing on that path can consume, is objectstack#4413's shape one layer
  up — and the reason it went unnoticed is that the console never takes this path: it reaches
  ListView through `ObjectView`'s `renderListView` render-prop, which passes a data source itself.
  Broken on the registry/SDUI path, which is the path `sdui.manifest.json` describes and a
  `kind:'react'` page walks.

  Found by `apps/console/src/__tests__/public-block-binding-reach.test.tsx` (objectstack#4472), not
  by hand — that suite mounts every public block declaring an `objectName` under a recording
  `dataSource` and asserts the binding arrives. Its ledger carried these two as named debt; with the
  bridge in place the ledger's both-directions assertion **failed until the entries were deleted**,
  which is the mechanism working as designed. Only `record:related_list` remains, and legitimately
  (it needs a parent record id from `RecordContext` before it may fetch).

  An explicit `dataSource` prop still wins, so hosts passing their own are unaffected, and
  `ListViewRenderer` forwards refs so `ListViewHandle` still works through the registry.

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
- Updated dependencies [785b8a5]
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
  - @object-ui/fields@17.2.0
  - @object-ui/permissions@17.2.0

## 17.1.0

### Minor Changes

- 38ca8be: refactor(fields): `requiredWhen` is the only required-predicate slot — drop the retired `conditionalRequired` alias

  `@objectstack/spec` 17 (objectstack#3855) **retired** `Field.conditionalRequired`,
  the long-deprecated alias of `requiredWhen`. ObjectUI carried a back-compat read
  for it in seven places; all of them are removed.

  The removal is safe because the spec did not merely _stop emitting_ the key — it
  made authoring it **fail loudly**. `retiredKey()` declares the key as
  `z.never()`, so:

  - `z.input` types it as `never` — writing it is a `tsc` error at the authoring site;
  - the parse **rejects** it (verified against `17.0.0-rc.0`), at both `FieldSchema`
    and `ObjectSchema`, with the prescription as the message:

    > `conditionalRequired` was removed in @objectstack/spec 17 (#3855) — use
    > `requiredWhen`. Rename the key; the value (a CEL predicate) is unchanged.
    > Run `os migrate meta --from 16` to rewrite it automatically.

  So spec-parsed metadata cannot carry the key — an object declaring it fails to
  load rather than loading with the rule silently dropped. Keeping a renderer-side
  `requiredWhen ?? conditionalRequired` would have re-created exactly the second
  de-facto contract the tombstone exists to prevent: the key would have kept
  working in the UI while being rejected everywhere else, hiding the producer's bug
  (AGENTS.md #0.1). "Backend-agnostic" (#1) does not argue for keeping it either —
  `conditionalRequired` is an ObjectStack-spec-ism, so the only producers that ever
  emit it are ObjectStack producers on ≤16, and the spec ships them a converter.

  Removed from:

  | package                  | site                                                                                                      |
  | :----------------------- | :-------------------------------------------------------------------------------------------------------- |
  | `@object-ui/types`       | the `conditionalRequired?:` member on `FormField`                                                         |
  | `@object-ui/core`        | the `??` fallback + rules-param member in `resolveFieldRuleState`                                         |
  | `@object-ui/components`  | three pass-throughs in the form renderer                                                                  |
  | `@object-ui/plugin-form` | `ObjectForm`, `ModalForm`, `sectionFields`, `deriveMasterDetail` (×2)                                     |
  | `@object-ui/app-shell`   | the field inspector's legacy read/auto-migrate, and the key's entry in `clientValidation`'s CEL lint list |

  **Studio authors lose nothing.** The object designer's draft validation parses
  against the spec's own `ObjectSchema`, so a draft carrying the key now surfaces
  the tombstone's rename prescription under the same `fields.<name>.conditionalRequired`
  path the CEL lint used to report — a better message than the inspector's silent
  auto-migration, and one the server agrees with. That behavior is pinned by a test.

  **Migrating:** rename the key to `requiredWhen` (the CEL value is unchanged), or
  run `os migrate meta --from 16`.

- 03bd53b: feat(form): `SplitForm` honours the spec's new `FormSection.pane`

  A split form's panel assignment was a hardcoded positional rule — first section
  left, everything else right. The rule was invisible in the metadata, so
  reordering sections silently moved them across the divider, and an author could
  not place two sections in the left pane at all.

  Sections now declare their panel: `pane: 'primary' | 'secondary'`
  (@objectstack/spec `FormSection.pane`, objectstack#4160). Placement follows the
  key, not the array position — reordering paned sections never changes the
  layout. Omitted keys keep the exact legacy rule (first section `primary`, rest
  `secondary`), so existing metadata renders unchanged.

  `ObjectForm`'s split dispatch copies the key through its per-key section mapping
  (the path that once silently dropped `visibleOn`), and `ObjectFormSection`
  declares it. The spec side rejects `pane` on non-split form types at parse, so
  the key can never be an accepted-but-ignored no-op.

### Patch Changes

- 7639a61: fix(form): the spec↔runtime form-field chokepoint stops dropping spec 17 vocabulary, and the validator stops contradicting the renderer — #3090

  `normalizeSectionField` — the one translation point between the spec's authored
  form-field shape (`field` = object-field reference) and the runtime shape
  (`name` = data path) — silently dropped four spec keys, worst of all the
  ADR-0089 **canonical** `visibleWhen` spelling while the deprecated `visibleOn`
  worked. Now:

  - view-level `visibleWhen` routes into the view-level slot (`visibleOn`) so it
    ANDs with the object-level rule instead of clobbering it, and the wizard's
    final-submit gate folds the same slot into its verdict (before, a required
    field the view itself hides could block submission from off-screen);
  - `dependsOn`, `keyField`, and `disclosure` carry through;
  - a behavioral parity gate walks the spec `FormFieldSchema` key set — a key the
    spec adds fails as unmapped, a key it retires fails as stale.

  `SelectOptionSchema` is now derived from `@objectstack/spec/data` by reference
  (it used to strip `color` — which `@object-ui/fields` renders — plus `default`
  and the per-option `visibleWhen` gate), with pinned divergences (`value`
  widened for UI forms, `visibleWhen` on the #2212 wire contract) and documented
  UI-only extensions (`disabled`, `icon`). `SelectOption` (TS) gains `color` and
  `default`.

  `FormFieldSchema` (the runtime vocabulary `objectui validate` enforces) now
  covers every key the `FormField` interface declares — `widget`, `dependsOn`,
  `hidden`, `readonly`, `visibleOn`/`visibleWhen`/`readonlyWhen`/`requiredWhen`,
  `span` — and `type` is optional, matching the interface. A typo'd predicate now
  fails loudly instead of being stripped; spec-shape fields (`{ field: … }`) are
  still rejected, pinning the two-layer boundary.

- 94e63ef: fix(form): the runtime `field` metadata slot is declared instead of smuggled, and importing the spec's FormField is a lint error — #3090

  `FormField.field` — the slot where object-bound form paths stash the resolved
  field-metadata **object** for widgets — rode through the index signature,
  undeclared, readable only via `as any`. Same key, different layer: in the spec
  form-view vocabulary `field` is a _string_ (the referenced object-field name),
  and the undeclared slot kept that pun latent. The slot is now declared
  (`field?: Record<string, any>`) with the invariant in its JSDoc: on a runtime
  FormField it is never a string — the authored string form ends at the
  `normalizeSectionField` chokepoint, and a tripwire test pins that across all
  three input shapes. Assigning a string is now a compile error; the `as any`
  casts at the read sites are gone.

  A `no-restricted-imports` tripwire bans importing `FormField`/
  `FormFieldSchema` from `@objectstack/spec/ui` inside this repo: the spec's
  FormField TYPE erases to `any` in its dist (objectstack#4171), so the
  misimport silently deletes type safety — tsc says nothing. The lint message
  names the two layers and the correct import. The drift-guard parity test is
  the one legitimate importer, exempted inline with its reason.

  Ledger: `FormField` and `FormFieldSchema` move from untriaged DEBT to ALLOW
  with the two-layer rationale written down (122 → 120).

- aeb0bd2: fix(form): a tabbed/split form honours the form view's own `columns`

  `FormView.columns` is a spec key, but only `ObjectForm`'s simple path and
  `ModalForm` read it. `TabbedForm` and `SplitForm` derived the grid width from the
  per-section `columns` alone, so a view declaring `columns: 3` rendered 3 columns
  in a modal and **single-column** as a tab or split — the same metadata laying out
  differently depending on which host picked it up.

  Both now resolve the grid the way the other hosts already did:

      explicit form `columns`  ??  widest section's `columns`  ??  1

  The two keys answer different questions and the precedence reflects that: the
  view's `columns` is how wide the grid is, a section's `columns` is how densely
  that section fills it (via per-field `colSpan`). `columns` is declared on
  `TabbedFormSchema` / `SplitFormSchema` accordingly — `ObjectForm` already spread
  it through, it was simply being dropped on arrival.

- c735bf7: fix(form): a spec-vocabulary field no longer crashes the standalone form, and every surface now says which vocabulary you meant — #3090

  Writing the regression test against the unfixed renderer proved the failure
  was worse than the assumed silent drop: a `{ field: 'x' }` entry (spec
  form-VIEW vocabulary) slipped past the `f?.name` guards into a
  react-hook-form Controller with `name === undefined` and crashed the whole
  standalone form on `name.split('.')`, with nothing naming the culprit entry.
  The renderer now partitions such entries out — the rest of the form renders —
  and surfaces them with an inline alert plus a console.error whose text is the
  fix instruction (rename to `name`, or use an object-bound form whose sections
  accept the spec shape).

  `objectui validate` grows the same boundary awareness: on failure, a
  `{ field: … }` entry in a standalone form gets a "likely cause" hint naming
  the real fix instead of the bare `invalid_union` — the previous message read
  as "bolt a `name` on", which converts spec metadata wrongly. On success,
  mixed-vocabulary entries (`name` + string `field`) get a warning: they
  validate, but the spec key is dead weight the renderer ignores.

  `normalizeSectionField` warns (once per site) when an authored section field
  mixes both identity keys — the spec branch derives the runtime name from
  `field`, so an authored `name` was silently overwritten.

- e339d60: fix(plugin-form): swapping `recordId` no longer leaves the previous record on screen

  `loading` in `ModalForm` / `DrawerForm` / `TabbedForm` / `SplitForm` was only ever
  set `true` once, by `useState(true)`, and thereafter only ever set `false`. A
  `recordId` change therefore re-entered the fetch effect **without** going back
  through the loading branch: the form stayed mounted showing — and accepting edits
  to — record A's values, with nothing indicating a different record had been asked
  for, until B's response landed and replaced them in place. Anything typed in that
  window read as A's on screen and would have been submitted against B.

  The same effect had no staleness guard either, so two overlapping reads landed in
  **completion** order rather than request order: ask for B then C, and a slow B
  arriving last left the form showing B while the caller had asked for C.

  Both are the same defect from the user's side — the form displays a record nobody
  asked for — so both are fixed:

  - a change of record re-enters the loading state before the read, so the previous
    record is off screen while the next one is in flight. Gated on the record
    actually changing: the effect also re-runs on `initialData`/`initialValues`
    identity churn (callers rebuild those objects every render), and flashing the
    loading state for that would thrash;
  - the effect's cleanup marks its read stale, so a response that is no longer the
    one being awaited is dropped instead of overwriting a newer record.

  `ObjectForm` already re-entered loading before its fetch, which is why this only
  ever reproduced on the four sectioned variants.

  **Also fixed, a consequence of the above:** hiding the form unmounts the inner
  renderer, and that renderer is the only thing that reports dirtiness via
  `onDirtyChange` — it gets no chance to report `false` on the way out. Without
  clearing the flag, the overlay's unsaved-input guards would stay armed for input
  belonging to a record no longer on screen: a plain refresh would prompt, and
  closing would offer to discard nothing.

- aa35561: fix(form): a split create/edit form no longer loses the panel you are not submitting from (#2153)

  `SplitForm` rendered one `SchemaRenderer` — one react-hook-form instance and one
  `<form>` element — **per section**, and its two groups of sections live in
  separate resizable panels. So each panel owned isolated form state: submitting
  from one panel's action bar sent only that section's fields and silently dropped
  everything the user had typed on the other side of the divider. Filling both
  panels and clicking Create persisted `{ subject }` alone.

  The same isolation killed cross-panel field rules: a `visibleWhen` in the right
  panel referencing a left-panel field never saw that field in its record, so the
  predicate faulted and failed **open** — the field the author meant to hide was
  always shown.

  Both panels are now ONE form. The panel group became a layout the form renderer
  owns, via a new `FormSchema.fieldPanes` (+ `fieldPanesOrientation`,
  `fieldPanesResizable`) that mirrors `fieldTabs` (#2959): the `<form>` wraps the
  whole `ResizablePanelGroup` and each pane holds only fields, which is what lets a
  single react-hook-form instance span the divider. Sections inside a pane render
  behind the inline `section-divider` header, each at its own declared column
  density within the form's shared grid.

  One more fix falls out of moving the panels into the renderer: `splitResizable:
false` now actually pins the divider. It previously only hid the grip — the
  separator stayed draggable, because nothing passed the panel library's
  `disabled`.

  Each pane is its own `@container`, so a multi-column section collapses to fewer
  columns as its panel is dragged narrower instead of overflowing.

- 3c1f321: fix(form): a tabbed/sectioned create-edit form no longer loses the tabs you are not looking at (#2959, #2153)

  The explicit-`sections` path rendered one `SchemaRenderer` — one react-hook-form
  instance and one `<form>` element — **per section**, all sharing the same
  `formId`. Two failures compounded:

  1. the footer submit button (`form={formId}`) can only be associated with the
     **first** of those forms, so section 2+ never reached the payload; and
  2. in the `tabbed` variant Radix unmounted the inactive panel, destroying that
     tab's form state outright.

  Reported flow (HotCRM, 3 tabs, required `description` on tab 3): fill tab 1 →
  submit → server 400 `description is required` → switch to tab 3, fill it →
  submit → the server now reports `subject; description; status; priority` **all**
  missing, because the second submit's body had lost every earlier value.

  `ModalForm` (stacked and `contentLayout: 'tabbed'`) and `TabbedForm` now render
  ONE form for all sections, matching `ObjectForm` / `DrawerForm`. Stacked sections
  use the existing inline `section-divider` header (which now also renders the
  section's `description`); tabbed sections go through a new
  `FormSchema.fieldTabs` (+ `defaultFieldTab`, `fieldTabsPosition`) that the form
  renderer distributes into **force-mounted** Radix panels — CSS-hidden rather
  than unmounted, since react-hook-form skips validation for unmounted fields,
  which is how a required field on a tab nobody opened used to sail past the
  client and come back as a server 400.

  Validation feedback now points at the tab: a rejected field activates its tab and
  every tab holding one is marked on its trigger, for client-side rules and server
  `fields[]` rejections alike.

- c0d0bc8: fix(form): a wizard with `allowSkip` no longer submits past the required fields you skipped

  `allowSkip` let the user jump to any step from the indicator, and
  `handleStepClick` did so without validating anything on the way. Since a wizard
  mounts ONE step at a time and react-hook-form only validates the fields currently
  **mounted**, a required field on a step nobody opened was never registered, never
  validated, and simply absent from the payload.

  Measured against the unfixed component — 3 steps, required `owner` on step 2,
  `allowSkip: true`, click step 3's indicator, fill it, hit Create:

      createCalls: 1
      payload:     { subject: 'S1', notes: 'S3' }   // `owner` missing entirely
      UI mentions "required": false                 // nothing said so

  So an invalid create went out and the client said nothing about why — #2959's
  validation half, wearing a wizard's clothes.

  The final submit now checks the WHOLE declared field set, and when something is
  outstanding it returns the user to the first step that has one, marks that step's
  indicator (`data-error="true"`, destructive circle + icon), names the fields in a
  toast, and sends nothing. Conditional rules are honoured: the check runs on the
  canonical `resolveFieldRuleState`, the same engine the form renderer and the
  server's rule-validator use, so a field hidden by `visibleWhen` or not yet
  required by `requiredWhen` is not demanded. The sequential path is unaffected —
  a forward jump is refused without `allowSkip`, so Next already validated each step.

  Also in `WizardForm`:

  - `FormView.columns` is now honoured (spec key, previously dropped): the grid
    width is the view's `columns`, else the step's own. Unlike the tabbed/split
    hosts there is no widest-section fallback — wizard steps never share a viewport,
    so each keeps its authored width.
  - the root gained `@container`. The step grid is sized with container queries, and
    without a container ancestor every `@md:`/`@2xl:` variant was inert — a step
    declaring 2 columns rendered single-column. Found by running it in a browser;
    the class was present all along, which is why asserting the class alone had
    missed it.

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
- Updated dependencies [2307b52]
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
- Updated dependencies [aecc934]
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
  - @object-ui/permissions@17.1.0
  - @object-ui/fields@17.1.0

## 17.0.0

### Minor Changes

- f9bbddb: feat: gate detail/form edit & delete on the server's effective operation set (#3546)

  PR-4 (#3391) wired the **list/toolbar** surface (ObjectView Import, ListView /
  ObjectGrid Export) to the server-resolved effective API operation set
  (`/me/permissions` `apiOperations`, intersected via
  `resolveCrudAffordances(obj, effectiveApiOperations?)`). The **detail / form**
  surfaces still gated edit/delete on the bucket + `userActions` alone. This
  extends the same intersection to them, so the record page and its forms never
  offer an operation the server would 405.

  - **core** `isObjectInlineEditable(obj, effectiveApiOperations?)` gains the same
    optional second argument as `resolveCrudAffordances` — inline-edit is now
    additionally ANDed with the server allowing `update`.
  - **app-shell** `RecordDetailView` threads the object's effective operations into
    the synthesized Edit/Delete header actions and the record-body inline-edit
    gate (`canEdit`); `RelatedRecordActionsBridge` intersects each **child**
    object's Create/Edit/Delete handlers with that child's own effective set.
  - **plugin-detail** `record:details` ANDs its inline-edit affordance with the
    object's effective `update`.
  - **plugin-form** `ObjectForm`'s blanket managed-object field lock also engages
    when the server denies `update` (edit mode) / `create` (create mode).

  Backward-compatible: a missing effective set (unrestricted object, older
  backend, or no `PermissionProvider`) leaves the resolved affordance untouched —
  the bucket/`userActions` decision wins, exactly as today. Layers on top of the
  existing per-object `check('edit')` / `check('delete')` permission gates
  (intersection, never union).

### Patch Changes

- 6dee2cb: feat(form): consume spec-aligned FormView buttons/defaults in ObjectForm

  The authored `@objectstack/spec` FormViewSchema carries structured
  `buttons.{submit,cancel,reset}.{show,label}` and `defaults`, but the form
  renderer only read the flat renderer-invented `showSubmit`/`submitText`/
  `showCancel`/`cancelText`/`showReset`/`initialValues`. That left the two spec
  keys parsed-but-inert (ADR-0078) and stuck at `experimental` in the spec
  liveness ledger.

  `ObjectForm` now folds the structured shape down onto those flat props inside
  its existing normalization pass, so every entry path (ObjectView
  drawer/modal/page, RecordFormPage) honors it. An explicitly-set flat key still
  wins, so metadata authored against the deprecated flat keys is unchanged.
  `ObjectView` and `RecordFormPage` forward `buttons`/`defaults` from the spec
  form view. `ObjectFormSchema` gains the optional `buttons`/`defaults` fields.

  Refs objectstack-ai/objectstack#1894, objectstack-ai/objectstack#2998.

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

- 662bdf9: fix(fls): wire the real per-caller FLS channel into import targets and grid
  columns; remove the never-populated `field.permissions` shape (objectstack#3661)

  The `permissions?: { read?, write?, edit? }` key on `@object-ui/types` field
  definitions (Phase 3.2.6) was declared-but-never-enforced: no producer in the
  stack ever populated it, so every guard reading it short-circuited to "allow".
  Per ADR-0049 enforce-or-remove, the shape is deleted and the three consumers
  now use the server-resolved `/auth/me/permissions` channel
  (`usePermissions().checkField`) — the same channel ObjectForm/ModalForm/ListView
  already enforce:

  - **ImportWizard target fields (app-shell `ObjectView`)**: the importable
    field set (and thus the downloadable CSV template's columns) now drops
    fields the caller cannot edit, instead of offering columns the server's
    FLS write gate would 403.
  - **ObjectGrid auto-derived columns**: columns the caller cannot read are
    dropped (same gate ListView applies), instead of a dead schema-shape check.
  - **ObjectForm**: the redundant dead guard in field generation is removed;
    the existing `applyFieldPerms` gate remains the real enforcement point.

  BREAKING CHANGE: `@object-ui/types` field definitions no longer accept a
  `permissions` key. It never carried data at runtime; consumers needing
  per-caller field-level permissions must use `@object-ui/permissions`
  (`MePermissionsProvider` + `useFieldPermissions`/`checkField`).

- dc7a798: fix(plugin-grid,plugin-form,plugin-designer,cli,vscode-extension): type-check the last five unchecked packages, and fix the two runtime bugs that hid there (#2919)

  Closes the remaining `DEBT` entries from the #2911 sweep. Each package gains
  `"type-check": "tsc --noEmit"` and loses its entry in
  `scripts/check-type-check-coverage.mjs`; coverage goes 36 -> 41 of 45 and
  outstanding errors 25 -> 5 (only #2916 `plugin-view` and #2918 `layout` remain).

  **Two of these were real bugs, not just type noise.**

  `@object-ui/cli` — `objectui validate` could never report a validation failure.
  `ZodError.errors` was removed in Zod 4 (the repo is on 4.4.3), so `.errors` read
  `undefined` and `.forEach` threw a `TypeError` that the enclosing `catch`
  reported as `✗ Error reading or parsing schema file: Cannot read properties of
undefined` — swallowing the very errors the command exists to print. Now reads
  `.issues`. Verified against the built CLI: an invalid schema now prints
  `1. Invalid input / Code: invalid_union` and exits 1.

  `@object-ui/plugin-grid` — grouping a grid by a boolean column showed the raw
  i18n key. `t('grid.booleanTrue', 'Yes')` asked for a key present in neither
  `GRID_DEFAULT_TRANSLATIONS` nor any locale bundle, and passed the English
  fallback as a bare second argument — which `createSafeTranslation`'s no-provider
  translator reads as an _options object_, so the fallback never applied and the
  header rendered the literal `grid.booleanTrue`. Switched to the `grid.yes` /
  `grid.no` keys the boolean cell renderer (`ObjectGrid.tsx`) and
  `BulkActionDialog` already use, with the fallback passed as `defaultValue`.
  Covered by a new regression test, confirmed to fail against the old code.

  The rest are type-only corrections that preserve runtime behaviour exactly:

  - **plugin-grid** `importParsers.ts` — `scorePair`'s `score`/`reason` moved into
    one `best` record. They were captured `let`s mutated only inside the `bump`
    closure, which TypeScript's control-flow analysis does not track, so it still
    believed `reason` was `'none'` at the type gate and flagged the comparisons as
    non-overlapping (TS2367). The gate — which stops a text column being mapped
    onto a number field — is unchanged; its two dedicated tests still pass.
  - **plugin-form** — `SectionFieldsContext.fieldLabel` now requires `fallback`,
    matching the `useSafeFieldLabel` producer in `@object-ui/i18n` (an omitted
    fallback could not satisfy the `=> string` return, and all four call sites
    already pass one). This one signature cleared six errors.
    `MasterDetailFormSchema.recordId` widens to `string | number`, matching
    `ObjectFormSchema` and the five envelopes that forward straight into it;
    it is narrowed with `String()` only at the batch-transaction boundary, whose
    `BatchTransactionOperation.id` is a string by protocol (the `isEdit` guard
    already proves it non-null there). `deriveMasterDetail`'s column sort gets an
    explicit `fillPriority` helper — `GridColumn.type` is optional, and a column
    without one keeps sorting at priority 5 exactly as the old
    `TYPE_FILL_PRIORITY[undefined] ?? 5` lookup put it.
  - **plugin-designer** — unused `index` parameter prefixed `_`, matching the
    `_entry` beside it.
  - **cli** — a stale `@ts-expect-error` removed; `viteConfig` is typed `any`, so
    the line it guarded had stopped erroring.
  - **vscode-extension** (`object-ui`) — migrated off `moduleResolution: "node"`,
    which is deprecated and stops working in TypeScript 7, to `node16` paired with
    `module: "node16"` (the package has no `"type": "module"`, so node16 resolves
    it as the CommonJS that tsup emits, and it gains the `exports`-map awareness
    node10 lacks). Its error count was under-reported as 1: that TS5107 config
    error masked four more. The package uses `console`/`Buffer` but sets
    `lib: ["ES2020"]` with no DOM and never declared `@types/node` — added, with an
    explicit `types: ["node", "vscode"]`.

  Also: `plugin-grid`, `plugin-form` and `plugin-designer` gain the `baseUrl` +
  `paths` override their type-checked plugin peers already carry, and `cli` an
  empty `paths`. Without it the inherited root `paths` point `@object-ui/*` at
  sibling `src/`, which is outside each project's `rootDir` and produces the ~104
  spurious TS6059 errors noted in #2915; workspace deps instead resolve through
  node_modules to built `.d.ts`, which `type-check`'s `dependsOn: ["^build"]`
  guarantees exist.

  Verified the gate genuinely covers all five rather than trusting the green:
  injecting a type error into each package makes `pnpm type-check --filter <pkg>`
  fail, which was impossible before this change.

- Updated dependencies [7b21891]
- Updated dependencies [0b3be01]
- Updated dependencies [3c4d935]
- Updated dependencies [4b1ed7d]
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
- Updated dependencies [697cda4]
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
- Updated dependencies [341bfb5]
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
  - @object-ui/fields@17.0.0
  - @object-ui/react@17.0.0
  - @object-ui/types@17.0.0
  - @object-ui/core@17.0.0
  - @object-ui/permissions@17.0.0

## 16.1.0

### Minor Changes

- 62b9ab5: feat(data): unify master-detail saves behind `DataSource.batchTransaction`, isolate the non-atomic fallback in the adapter (#2679)

  Master-detail saves (`MasterDetailForm`, `LineItemsPanel`) now always persist
  through `dataSource.batchTransaction(operations)` — one ordered cross-object
  operation list, with `{ $ref: <op index> }` linking a child to a parent created
  in the same batch. The form no longer contains any client-side orchestration or
  best-effort compensation-delete; that atomicity anti-pattern is gone from the UI
  layer (framework #1604 / framework ADR-0034 item 4).

  - **`@object-ui/types`** — `batchTransaction?` is now a first-class (optional)
    method on the `DataSource` contract, typed via `BatchTransactionOperation` /
    `BatchRef`. Replaces the previous `(dataSource as any).batchTransaction`
    method-sniffing.
  - **`@object-ui/core`** — new `emulateBatchTransaction(dataSource, operations)`
    (sequential writes, `$ref` resolution, best-effort reverse-order compensation)
    and `runBatchTransaction(dataSource, operations)` (prefers the adapter's method,
    emulates otherwise). `ApiDataSource` / `ValueDataSource` implement
    `batchTransaction` via the emulation.
  - **`@object-ui/data-objectstack`** — `ObjectStackAdapter.batchTransaction` uses
    the server's atomic `POST /api/v1/batch`, prefers the typed
    `client.data.batchTransaction` SDK method when the installed client exposes it,
    and degrades to the client-side emulation ONLY when the endpoint is missing
    (404/405) or the runtime can't do transactions (501). Real errors (400/401/403/
    409/500) still surface. This is the isolated, tested home of the non-atomic
    fallback.
  - **`@object-ui/plugin-form`** — removed `applyDetail` / `createMany` /
    `ApplyDetailResult` from `masterDetailTx.ts`; `MasterDetailForm` and
    `LineItemsPanel` build ops and call `runBatchTransaction`. `LineItemsPanel`
    saves are now atomic on a capable backend, with the rollup folded into the same
    batch.

  No behavior change on a current ObjectStack backend (it has `/api/v1/batch`);
  older/limited backends keep a working — now clearly non-atomic — save path.

### Patch Changes

- 7cf4051: chore(deps): align every `@objectstack/*` dependency to `^16.0.0-rc.0`

  Bumps `@objectstack/spec` / `client` / `formula` / `lint` from `^15.1.1` to the
  `16.0.0-rc.0` pre-release across the workspace (root + `apps/console` +
  `apps/site` + all consuming packages). ObjectUI's own packages are already on
  major 16, so this closes the 15↔16 skew between ObjectUI and the `@objectstack`
  contract libraries (which publish in lockstep with `spec`).

  This is a dependency alignment, not a behavioral migration: the full workspace
  build (43/43) and the `@objectstack`-consuming package test suites
  (`core` / `app-shell` / `data-objectstack` / `plugin-form` / `types`) are green
  against `16.0.0-rc.0` with no source changes required.

  Practical effect: `@objectstack/client@16.0.0-rc.0` now ships
  `data.batchTransaction` (framework #3271), so `ObjectStackAdapter`'s feature
  detect (`typeof client.data.batchTransaction === 'function'`) routes
  master-detail cross-object saves through the typed SDK method instead of the
  raw `fetch('/api/v1/batch')` fallback — realizing the "verify SDK path" half of
  #2694. The raw-fetch branch stays as a defensive fallback (removal tracked in
  #2694).

- 0a3710b: **Finish the `managedBy` / `userActions` de-dup — one parser for the override shape (completes objectui#2712, framework#3343).** #2712 consolidated the bucket _union_ + affordance _set_ mirrors but left four surfaces still parsing the `userActions.{create,edit,delete}` override shape by hand. They now all route through the shared `@object-ui/core` policy, so no package re-implements the boolean / #2614-object-form parse locally.

  - **`@object-ui/core`** promotes the internal `normalizeOverride` to the exported **`normalizeUserAction(v, base)`** (the one parser) and adds **`userActionPredicates(v)`** for per-record CEL predicate extraction.
  - **`app-shell/utils/managedByEmptyState.ts`** — the writable-`system` create check and its local `EmptyStateUserActions` interface are replaced by `resolveCrudAffordances({ managedBy, userActions }).create`.
  - **`plugin-grid/rowCrudAffordances.ts`** — the local `isOptedOut` / `predicatesOf` helpers (and duplicated `RowCrudUserAction` / `RowCrudPredicates` types) fold into `normalizeUserAction`; the historical type names stay re-exported for compat.
  - **`plugin-detail/RelatedList.tsx`** — its inline `predicatesOf` fold into `userActionPredicates`.
  - **`plugin-form/ObjectForm.tsx`** — the hand-rolled `managedBy !== 'platform'` blanket lock + `userActions` unlock is replaced by the resolved affordance for the current mode (`edit` / `create`), the **same** `resolveCrudAffordances` contract the detail (`isObjectInlineEditable`) and grid surfaces use.

  Behavior-preserving for `platform` / `system` / `append-only` / `better-auth`, with one deliberate alignment: an admin-editable **`config`**-bucket object (e.g. `sys_webhook`, `sys_permission_set`) is now editable in `ObjectForm` — it was previously over-locked as "non-`platform`", while detail/grid already treated it as editable (`config` resolves `edit: true`). New unit coverage for the shared parser and the config / create-mode form gate; all existing affordance/edit-gate tests stay green.

- Updated dependencies [0318118]
- Updated dependencies [1c8935a]
- Updated dependencies [af1b0db]
- Updated dependencies [8b8b744]
- Updated dependencies [7cf4051]
- Updated dependencies [803558e]
- Updated dependencies [aefcf39]
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
- Updated dependencies [14cb729]
- Updated dependencies [1629313]
- Updated dependencies [29c6040]
- Updated dependencies [faebac3]
- Updated dependencies [2331ac9]
- Updated dependencies [199fa83]
- Updated dependencies [eee4ded]
- Updated dependencies [3b2e4d9]
  - @object-ui/fields@16.1.0
  - @object-ui/i18n@16.1.0
  - @object-ui/core@16.1.0
  - @object-ui/types@16.1.0
  - @object-ui/react@16.1.0
  - @object-ui/components@16.1.0
  - @object-ui/permissions@16.1.0

## 16.0.0

### Minor Changes

- 9d4a429: fix(form+detail): keep single-file children as inline grids; drop non-spec `attachment` handling

  Two follow-ups to the upload-in-grid work (objectui#2360):

  - **#2654** — Now that `file`/`image`/`avatar` fields render a compact upload
    cell in the line-item grid, a child object with a _single_ such field no
    longer flips the smart `inlineEdit` default to a per-row form. `resolveInlineMode`
    splits the old `FORM_ONLY_TYPES`: truly form-only types (textarea / richtext /
    html / markdown / json / location / address) still tip to `form` on their own,
    while file-family types only tip when several rich fields pile up
    (`RICH_FIELD_FORM_THRESHOLD`, default 2). An explicit `inlineEdit` always wins.

  - **#2655** — `attachment` is not a `@objectstack/spec` field type (the spec
    media types are file/image/avatar/video/audio), so the renderer no longer
    models it: removed from `fieldTypeToColumnType`, the inline-mode heuristic, and
    `RelatedList`'s auto-column `SKIP_TYPES`. Contract-first cleanup — the renderer
    stops fossilizing a phantom type (AGENTS.md #0.1).

### Patch Changes

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
  - @object-ui/fields@16.0.0
  - @object-ui/core@16.0.0
  - @object-ui/permissions@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/i18n@15.0.0
- @object-ui/react@15.0.0
- @object-ui/components@15.0.0
- @object-ui/fields@15.0.0
- @object-ui/permissions@15.0.0

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

- Updated dependencies [82441e4]
- Updated dependencies [2efa9fd]
- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
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
  - @object-ui/permissions@14.1.0
  - @object-ui/components@14.1.0

## 14.0.0

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
  - @object-ui/fields@14.0.0
  - @object-ui/permissions@14.0.0

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

- 5da9905: fix(plugin-form): honor `userActions.edit` on managed objects instead of blanket-disabling every field (ADR-0092 D4)

  `ObjectForm` disabled every field on any non-`platform` lifecycle bucket
  (config / system / append-only / better-auth) — a defensive default from when
  those objects had no generic edit affordance at all. Now that an object can
  OPEN per-record editing via `userActions.{edit,create}` (framework ADR-0092 D4
  — e.g. `sys_user` exposing its `name`/`image` profile fields), the blanket
  lock lifts for the current mode when its affordance is `true`, and each
  field's own `readonly` flag decides. Managed buckets still default the
  affordance off, so an object that doesn't opt in is unchanged. The server-side
  identity write guard remains the real boundary; this is UX only.

- Updated dependencies [80901aa]
- Updated dependencies [53c40c2]
- Updated dependencies [e492b9d]
  - @object-ui/components@13.2.0
  - @object-ui/i18n@13.2.0
  - @object-ui/fields@13.2.0
  - @object-ui/react@13.2.0
  - @object-ui/types@13.2.0
  - @object-ui/core@13.2.0
  - @object-ui/permissions@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/core@13.1.0
- @object-ui/i18n@13.1.0
- @object-ui/react@13.1.0
- @object-ui/components@13.1.0
- @object-ui/fields@13.1.0
- @object-ui/permissions@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [9e38270]
- Updated dependencies [ac04b76]
- Updated dependencies [619097e]
  - @object-ui/i18n@13.0.0
  - @object-ui/components@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/fields@13.0.0
  - @object-ui/react@13.0.0
  - @object-ui/core@13.0.0
  - @object-ui/permissions@13.0.0

## 12.1.0

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
  - @object-ui/react@12.1.0
  - @object-ui/core@12.1.0
  - @object-ui/permissions@12.1.0

## 12.0.0

### Minor Changes

- e4de456: Fix form section grouping inconsistencies found in a UX review of grouped forms:

  - **Unified section visual language.** `FormSection`'s Card-wrapped path (used by Modal/Split/Tabbed/Wizard forms) previously rendered as a nearly-invisible white-on-white card (same `bg-card` as the page background, distinguished only by a barely-visible shadow) with a duplicated, inconsistent header (different title size, and a collapse chevron positioned differently) versus the flat `SectionDivider` path used by simple/drawer forms. Both now share the same header treatment (`text-sm font-semibold`, inline-left chevron, bottom border), and the Card path gets a soft `bg-muted/40` tint so grouped sections are visually distinguishable without relying on shadow alone.
  - **`readonly` no longer renders as `disabled`.** A field marked `readonly` (statically or via `readonlyWhen`) was being folded into the `disabled` prop before reaching field widgets, so widgets with a dedicated readonly display (e.g. `EmailField`'s mailto link, `TextField`'s plain-text view) never received it — every readonly field just looked permanently disabled. `readonly` is now forwarded as its own prop; generic `input`/`textarea` fields get a distinct readonly style (`bg-muted/40`, no `cursor-not-allowed`) instead of the disabled look.
  - **Section `className`/`gridClassName` now flow through JSON schemas.** `ObjectFormSection` and the per-form-variant section configs (`ModalFormSectionConfig`, `SplitFormSectionConfig`, `FormSectionConfig`, `DrawerFormSectionConfig`) accept `className` (and `gridClassName` where applicable), wired through `ObjectForm`'s form-type dispatch into `FormSection`/`SectionDivider` — closing a gap where section wrappers couldn't be customized from schema despite `FormSection` itself already supporting it.

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e36a9c7]
- Updated dependencies [e4de456]
- Updated dependencies [68e2d1c]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/components@12.0.0
  - @object-ui/fields@12.0.0
  - @object-ui/permissions@12.0.0
  - @object-ui/react@12.0.0
  - @object-ui/i18n@12.0.0

## 11.5.0

### Patch Changes

- fae75e2: Fix two bugs verified still-present after #2254 claimed to resolve them (framework#2620 / framework#2616 Showcase UX pass, tracked in #2268):

  - **Wizard/form `submitBehavior: 'thank-you'` allowed duplicate resubmission.** #2254 fixed the spec-bridge dropping `submitBehavior` before it reached the renderer, so the configured toast message started appearing — but `WizardForm`'s last step and `ObjectForm`'s submit handler only ever called `toast.success(...)` for `thank-you`/`next-record`; the form stayed mounted and fully filled with its submit button re-enabled once the request settled, so a second click created a second record. Both components now track a terminal `submitted` state and, when set, replace the form with a confirmation panel (using the behavior's `title`/`message`, which were also never read before) — mirroring the pattern `apps/console/src/components/FormPage.tsx` already used for its own standalone forms.

  - **Command Center-style 3-up chart bands stayed collapsed to ~100-130px, and a dataset-bound chart's measure leaked its raw field name.**
    - `responsiveStyles` (and `style`) were declared on the page-spec `PageComponent` bridge input type but never copied onto the `SchemaNode` in `spec-bridge/bridges/page.ts::mapComponent()` — so a page author's ADR-0065 layout override (e.g. forcing `display: 'grid'` on a `type: 'flex'` band) never reached `SchemaRenderer`, and the node silently fell back to its default flex layout. Both fields are now mapped through.
    - `ObjectChart`'s dataset-bound fetch path (`schema.dataset` + `ds.queryDataset(...)`) discarded the response's `fields` array (which carries each measure's `label`, e.g. `{ name: 'task_count', label: 'Tasks' }`) before it ever reached `buildChartSeries()` — whose `fields` param already resolves this correctly (see `chart-series.test.ts`) — so the legend/tooltip always fell back to the raw field name. The fetched `fields` are now captured and threaded through.

- ec9c8ee: Fix master-detail record create: stop double success toast + localize the Cancel button.

  Objects with inline subforms (master-detail, e.g. a Lead with product line items)
  render `MasterDetailForm` inside `ModalForm`/`DrawerForm` instead of the plain
  footer, which exposed two mismatches with the host contract:

  - **Double success toast.** Flat `ObjectForm` delegates confirmation to the host
    when an `onSuccess` is supplied (skips its own default toast), but
    `MasterDetailForm.handleSaved` ALWAYS toasted `Created`/`Saved` AND ran
    `onSuccess`. In the console the host's `onSuccess` chains into the `crud_success`
    handler, which toasts a localized message — so create fired both `Created` and
    e.g. `线索创建成功`. `handleSaved` now only toasts as a fallback when no host
    `onSuccess` is provided, matching the `ObjectForm` contract; saves without a host
    handler stay non-silent.

  - **Hardcoded English `Cancel`.** The master-detail action bar wrote `Cancel` as a
    literal and accepted no `cancelText`, so the button stayed English while the
    submit button was localized (`submitText` was already forwarded).
    `MasterDetailForm` now takes `cancelText`, and `ModalForm`/`DrawerForm`/`ObjectForm`
    forward the host's localized label down the subforms branch.

  Adds regression tests: create with a host `onSuccess` fires no built-in toast (no
  double-confirm), and the Cancel button renders the host-supplied `cancelText`.

- 6c1ad9e: Record task flows open as derived overlays with lossless return (framework#2604, extends framework#2578).

  - **Create/Edit never route** — the global record form is URL-driven (`?form=new` / `?form=<id>`): browser Back closes the overlay with the origin (list scroll/filters, detail state) intact; field-heavy objects derive a full-screen modal (`modalSize:'full'`) via the new `deriveRecordFlowSurface` mirror in plugin-view, light ones keep the auto-sized modal. `editMode:'page'` opt-in unchanged.
  - **Save invariant** — _edit never moves you_ (origin refetches in place); _create lands on the new record's detail_ on its derived surface (drawer over the still-intact list for light objects, detail route for heavy), with `replace:true` so Back skips the transient form entry.
  - **Subtable child create/edit = overlay over the parent detail, never a route** — related-list New/Edit push `?form=…&formObject=<child>&formLink=<fk>:<parentId>`; the one global overlay pre-links the parent (refresh-safe), sizes to the CHILD object, and on save stays on the parent while only the child's related lists refetch. ModalForm now forwards `initialValues` into its master-detail (subforms) branch so pre-links survive for children with inline line items.

- Updated dependencies [544d8eb]
- Updated dependencies [6fffd3d]
- Updated dependencies [9255686]
- Updated dependencies [fae75e2]
- Updated dependencies [1072701]
  - @object-ui/i18n@11.5.0
  - @object-ui/react@11.5.0
  - @object-ui/components@11.5.0
  - @object-ui/types@11.5.0
  - @object-ui/fields@11.5.0
  - @object-ui/core@11.5.0
  - @object-ui/permissions@11.5.0

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

### Patch Changes

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

- 1e9145d: Hydrate widget types on hand-authored master-detail subform columns. A view can
  list a child grid's columns as bare `{ field, label }` (the common authoring
  form); previously such untyped columns were passed straight to the grid, so a
  `select` / `lookup` / `date` / `number` field silently rendered as a plain text
  cell. `MasterDetailForm` (and `deriveDetail`) now resolve each untyped column's
  `type` (plus `options` / `reference` / computed `expr`) from the child object's
  schema via the new `hydrateColumns` helper — a picklist becomes a dropdown, a
  lookup a record picker, a date a date input — while preserving the author's
  exact column set, order and labels. Columns that already declare a `type` are
  left untouched (the author's explicit choice still wins).
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
- Updated dependencies [09e1b26]
- Updated dependencies [e84d64d]
  - @object-ui/types@11.4.0
  - @object-ui/components@11.4.0
  - @object-ui/fields@11.4.0
  - @object-ui/i18n@11.4.0
  - @object-ui/core@11.4.0
  - @object-ui/permissions@11.4.0
  - @object-ui/react@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [d88c8ec]
- Updated dependencies [b7237bb]
- Updated dependencies [d23d6eb]
  - @object-ui/components@11.3.0
  - @object-ui/i18n@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/fields@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/types@11.3.0
  - @object-ui/permissions@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/components@11.2.0
  - @object-ui/core@11.2.0
  - @object-ui/fields@11.2.0
  - @object-ui/react@11.2.0
  - @object-ui/types@11.2.0
  - @object-ui/i18n@11.2.0
  - @object-ui/permissions@11.2.0

## 11.1.0

### Patch Changes

- Updated dependencies [6726a2b]
  - @object-ui/i18n@11.1.0
  - @object-ui/components@11.1.0
  - @object-ui/fields@11.1.0
  - @object-ui/react@11.1.0
  - @object-ui/types@11.1.0
  - @object-ui/core@11.1.0
  - @object-ui/permissions@11.1.0

## 7.3.0

### Patch Changes

- Updated dependencies [788dbf9]
  - @object-ui/fields@7.3.0
  - @object-ui/types@7.3.0
  - @object-ui/core@7.3.0
  - @object-ui/react@7.3.0
  - @object-ui/components@7.3.0
  - @object-ui/permissions@7.3.0

## 7.2.0

### Patch Changes

- 4aa8b84: fix(plugin-form): call `useRecordContext` unconditionally; drop impure render-time `Date.now()`

  `LineItemsPanel` wrapped `useRecordContext()` in a `try/catch`, which ESLint flagged
  as `react-hooks/rules-of-hooks` ("React Hook is called conditionally") — a genuine
  hook-order hazard if the `catch` ever fired part-way through render. `useRecordContext`
  returns `null` outside a `<RecordContextProvider>` and never throws, so the guard was
  dead code; it's now called unconditionally at the top level and the `null` case is
  handled by the existing optional chaining.

  Also clears a second pre-existing lint error: `EmbeddableForm` now seeds `mountedAtRef`
  from `0` instead of calling the impure `Date.now()` during render (the mount effect
  already overwrites it before any submit, so the anti-bot min-fill check is unchanged),
  fixing the react-compiler "Cannot call impure function during render" error. No
  behavior change.

- Updated dependencies [d23db5c]
  - @object-ui/types@7.2.0
  - @object-ui/components@7.2.0
  - @object-ui/fields@7.2.0
  - @object-ui/react@7.2.0
  - @object-ui/core@7.2.0
  - @object-ui/permissions@7.2.0

## 7.1.0

### Patch Changes

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

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0
  - @object-ui/react@7.1.0
  - @object-ui/components@7.1.0
  - @object-ui/fields@7.1.0
  - @object-ui/permissions@7.1.0

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

- 80c133c: Spreadsheet-style line-item grid editor.

  `GridField`'s editable grid mode is reworked into an enterprise line-item editor (the QuickBooks / Stripe / NetSuite pattern), generalised across every inline grid:

  - **Computed read-only columns** — a child field with an arithmetic `expression` (e.g. `amount = quantity * unit_price`) renders read-only, recomputes live as its inputs change, and writes the result back into the row so it persists and the running total reflects it. A small safe arithmetic evaluator (`+ - * / %`, parens, `record.<field>` refs; no `eval`) powers it.
  - **Trailing "ghost" row** — start-with-one + auto-append: typing in the ghost materialises a real row (index-stable, so focus/caret survive), so you keep entering lines without clicking "Add".
  - **Borderless click-to-focus cells** + role-based column widths (description flexes; qty/price/amount stay narrow).
  - **Keyboard navigation** — Enter / ArrowUp / ArrowDown move between rows in the same column.
  - Per-row "expand to full form" is gated to grids that omit fields (no redundant expand on thin lines).
  - `deriveColumns` surfaces a field `expression` as a computed column; the running-total column prefers the computed/last-currency column. Blank/ghost rows are filtered from the persisted batch (`isBlankRow`).

- d16566f: Atomic master-detail create via the cross-object transactional batch endpoint (ObjectStack #1604).

  When the server exposes the transactional batch endpoint, a NEW parent record and its child line items are now persisted in ONE server transaction — commit all or roll back all — instead of the previous client-orchestrated "create parent → create children → best-effort cleanup on failure" sequence.

  **`@object-ui/data-objectstack` — `ObjectStackAdapter.batchTransaction(operations)`**

  - New method posting `{ operations }` to `POST /api/v1/batch`. Operations run in one server transaction. A field value of `{ $ref: <earlier op index> }` resolves to that op's generated id, so a child can reference its parent created earlier in the same batch (master-detail FK). Throws `ObjectStackError('BATCH_ERROR')` on a non-2xx response.

  **`@object-ui/plugin-form`**

  - `MasterDetailForm` now detects `dataSource.batchTransaction` and, on a NEW parent, builds one atomic batch (parent at index 0, each child FK set to `{ $ref: 0 }`) via the new pure helper `buildMasterDetailBatch`. Client-side total rollups are merged into the parent payload before the batch. Edit mode and adapters without `batchTransaction` keep the existing client-orchestrated path.
  - `ObjectForm` gained a `submitHandler` hook: when supplied, the form validates and hands the collected values to the host instead of calling `dataSource.create` / `dataSource.update`. `MasterDetailForm` uses it to own the atomic parent+children write while the parent fields are still rendered by `ObjectForm`.

  **`@object-ui/types`**

  - `ObjectFormSchema.submitHandler?: (values) => any | Promise<any>` — typed override for host-owned persistence.

  Pairs with the framework-side ambient-transaction fix (ObjectQL `AsyncLocalStorage` transaction propagation) and the `/api/v1/batch` endpoint added in `@objectstack/rest`.

- 69510df: feat(master-detail): derive child columns + relationship FK from metadata

  A master-detail child collection can now be configured with **just the child
  object name** — the relationship FK and the editable grid columns are derived
  from the child object's schema (via `DataSource.getObjectSchema`), instead of a
  hand-authored columns block.

  ```ts
  // before: ~40 lines of columns + relationshipField
  details: [{ childObject: 'task', relationshipField: 'project', columns: [ ...12 lines... ] }]
  // after:
  details: [{ childObject: 'task' }]
  ```

  - `relationshipField` is auto-detected from the child's `master_detail`/`lookup`
    field that references the parent (master_detail preferred).
  - `columns` are derived from the child's fields, skipping system/audit fields,
    the back-reference FK, and non-editable types (formula/summary/autonumber/
    file/json/…); select options and lookup references carry through.
  - `amountField` (running-total source) defaults to the first numeric/currency
    column.
  - Any of these can still be set explicitly to override the derived defaults.
  - Save is gated until derivation resolves; new pure helpers
    (`deriveDetail`/`deriveColumns`/`findRelationshipField`) are unit-tested.

- b148daf: feat(master-detail): atomic EDIT via the cross-object batch endpoint

  Edit mode now persists the parent update together with its child line-item
  create/update/delete diffs in ONE server transaction (commit all or roll back
  all), matching what create already did. Previously only create used the atomic
  `/api/v1/batch` path; edit fell back to client-orchestrated writes with
  best-effort cleanup.

  - New pure helper `buildMasterDetailEditBatch(parentObject, parentId,
parentData, details)` — emits a parent `update` op (index 0) then diffs each
    child collection against its loaded snapshot into `create` / `update` /
    `delete` ops (children reference the known parent id directly, no `$ref`).
  - `MasterDetailForm` now treats `canBatch` as available whenever the data
    source exposes `batchTransaction` (create AND edit). `submitViaBatch` builds
    create-ops or edit-ops by mode; `onSuccess` → `handleSaved` ("saved" toast,
    no form reset in edit).

  The server `/api/v1/batch` handler already supports `update`/`delete` actions,
  and the adapter already forwards `action`/`id`, so this is a front-end change.
  Unit-tested (parent update + child create/update/delete diff); the create path
  remains verified by the live e2e.

- 90acb7f: Master-detail subform + lightweight list primitives (SDUI).

  - `MasterDetailForm` (`object-master-detail-form`): enter a parent record and its child line items together; client-orchestrated transactional create (parent → FK → bulk children → rollup → cleanup). Enterprise-convention layout (header on top, line grid, single Save bar at the bottom).
  - `LineItemsField` editable child grid (line numbers, right-aligned numerics, running total) and `LineItemsPanel` (`record:line_items`) for detail-page inline edit.
  - `element:definition-list` and `element:repeater` — lightweight, low-chrome list primitives for simple data.

- 00f8d2d: Master-detail form: live Subtotal / Tax / Total stack.

  `MasterDetailForm` now renders a right-aligned document totals stack under the line items when the parent form has a tax-rate field (`taxRateField`, default `tax_rate`): **Subtotal** (Σ line amounts) → **Tax** (header rate %) → **Total**, recomputed live as lines and the rate change. The header rate is read via scoped event delegation on the form host (no coupling into `ObjectForm` internals). When the stack is shown, the per-grid footer total is subsumed.

- 300d755: feat(form): inline master-detail in a plain ObjectForm via `subforms`

  `ObjectFormSchema` gains a `subforms` array. When set, a regular `object-form`
  renders as a master-detail form — the object's own fields on top, an editable
  grid per child collection below, persisted together in one atomic transaction —
  without a bespoke `object-master-detail-form` page.

  ```ts
  { type: 'object-form', objectName: 'expense_claim',
    subforms: [{ childObject: 'expense_line' }] }   // FK + columns auto-derived
  ```

  Each subform needs only `childObject` (relationship FK and columns are derived
  from the child object's metadata; override with `relationshipField`/`columns`).
  This is the config-driven, page-less way to express master-detail entry — a form
  view can declare its child collections directly.

- 18728c1: Master-detail entry: lighter layout, compact lookup cells, persisted line order.

  - **De-framed line-item section** — the subform no longer double-frames the grid in a `Card` (border + `p-6`); it renders as a light label + the grid's own bordered table, reclaiming the width the line table needs.
  - **Compact lookup cells** — `LookupField` gains a `compact` mode (used by grid cells): the selected value shows inline in a borderless single-line trigger instead of a chip stacked above a separate "Select…" button.
  - **Persisted drag-reorder** — `deriveMasterDetail` detects a sort field (`position`/`sort_order`/…), excludes it from the editable columns/row-form, and threads it as the grid's `sort_field` so reordering stamps `row[position] = index` and survives a reload.

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

- ddbe4a2: B2 step 3: client-side field-level conditional rules (`visibleWhen` / `readonlyWhen` / `requiredWhen`). The form renderer now evaluates these CEL predicates reactively against the live record and gates each field's visibility, read-only state, and required-ness accordingly. Evaluation delegates to the canonical `@objectstack/formula` `ExpressionEngine` — the _same_ dialect the server enforces (`requiredWhen` in the rule-validator, `readonlyWhen` in `stripReadonlyWhenFields`) — so the UX and the persisted verdict always agree. New core helpers `evalFieldPredicate` / `resolveFieldRuleState` (zero-React, fail-open). `FormField` gains `visibleWhen` / `readonlyWhen` / `requiredWhen` (+ deprecated `conditionalRequired` alias), and `ObjectForm` carries them through from object metadata.
- 2d47e94: B2 follow-ups (A): field conditional rules in inline grids + submit-time enforcement.

  - **Grids**: a line-item column's `readonlyWhen` / `requiredWhen` CEL rule is now honored per row — `deriveMasterDetail` carries the props onto the `GridColumn` and `GridField` evaluates them against each row via `resolveFieldRuleState` (a `readonlyWhen`-TRUE cell locks; a `requiredWhen`-TRUE empty cell flags inline-invalid). Rules are row-scoped (`record.*`); the core helpers gained an optional `scope` (and `GridField` a `contextRecord` prop) so a future header-driven lock can bind `parent.*` — that wiring is deferred (it needs the master-detail header's re-renders isolated).
  - **Submit enforcement**: `requiredWhen` already drove react-hook-form's `required` rule, so submit is blocked with a field error when the predicate is TRUE and the value is empty. Added a reactive cleanup so a stale _required_ error clears when the predicate flips FALSE (and all errors clear when a field is hidden by `visibleWhen`).

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

- ad8ade6: feat(components): metadata-derived field locators on generated forms (ADR-0054 Phase 4)

  The form renderer now emits a stable `data-testid="field:{objectName}.{field}"`
  (plus `data-field`) on every field wrapper, derived from the form's `objectName`
  and each field's name — closing the locator gap at the source so every generated
  form (`ObjectForm`/`ModalForm`/`DrawerForm`/`SplitForm`/`WizardForm`) inherits
  testable fields with zero per-app work (ADR-0054 C4). `FormSchema` gains an
  optional `objectName`; the object prefix is omitted (`field:{field}`) when a form
  has none. `FormItem` now accepts `data-*` attributes.

- 3870c20: feat(forms): declarative `navigateOnSuccess` + `resetOnSuccess` on object-form

  Rounds out declarative success behavior for metadata-only forms (which can't
  pass an `onSuccess` function), complementing `successMessage`:

  - **`navigateOnSuccess`** — after a successful create/update, navigate here.
    Supports `{id}`/`{recordId}` interpolation from the saved record and is
    same-origin-guarded; takes precedence over the toast (landing on the record
    is the confirmation).
  - **`resetOnSuccess`** — after a successful create, reset the form for another
    entry (the wizard returns to a cleared step 1). Ignored when navigating.

  Wired in both ObjectForm and WizardForm via a small shared `successBehavior`
  helper (kept dependency-free to avoid an EmbeddableForm import cycle).

- b88c560: feat(forms): declarative `successMessage` on object-form

  Metadata-only forms (a wizard/object-form authored as JSON) cannot pass an
  `onSuccess` function, so the post-create/update feedback was a fixed
  "Created"/"Saved" toast. `ObjectFormSchema` now accepts `successMessage`, which
  ObjectForm and WizardForm use for the default success toast when no `onSuccess`
  handler is supplied. Falls back to "Created"/"Saved".

- 7913390: fix(master-detail): never silent on save — feedback, reset, and a duplicate-submit guard

  `MasterDetailForm`'s "Create" submitted successfully but gave **no feedback**: no toast, no form reset, no navigation. A successful create looked broken, and re-clicking created duplicate records.

  - On success: a `toast.success`, and on create the form clears (line items reset + parent `<ObjectForm>` remounts) ready for the next entry. A page-supplied `onSuccess` still runs afterwards (e.g. to navigate).
  - On failure (validation / network / atomic rollback): a `toast.error` surfaces the message instead of failing silently.
  - In-flight guard: the Create button shows "Saving…" and is disabled while a submit is running, preventing duplicate submissions, with a safety release if client-side validation blocks the submit.
  - `@object-ui/components` now re-exports `toast` (alongside `Toaster`) from its sonner wrapper.

  Tests: two new `MasterDetailForm` tests assert success → toast + form clear, and failure → error toast.

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

- 586a027: B2 follow-up (#1581): parent-scoped conditional rules in inline grids — "paid invoice → lock lines". `MasterDetailForm` now binds the live header record to every line-item grid as `parent`, so a column's `readonlyWhen` / `requiredWhen` CEL rule can react to the header (e.g. `parent.status == 'paid'` locks quantity / unit price / product when the invoice is paid). The line grids + document totals moved into a dedicated `<MasterDetailLines>` child that owns the scraped header record, so a header edit re-renders only the lines and never resets the header `ObjectForm`'s react-hook-form state mid-edit; the scrape is deduped by value to avoid needless churn. (`@object-ui/fields`' `GridField.contextRecord` and column-rule derivation already existed — this wires the last link.)
- 9aac2b8: feat(form): modal forms can host a tabbed layout (modal + tabbed composes)

  `ModalForm` rendered sections as a flat vertical stack — a modal create/edit
  form could never be tabbed, because `formType` (one field) couldn't be both
  `modal` (container) and `tabbed` (layout). Per ADR-0050 (additive first), the
  modal container now accepts a `contentLayout` ('simple' | 'tabbed'): when
  `tabbed`, sections render as tabs inside the dialog. The console record
  New/Edit modal (`AppContent`) forwards the default form view's layout, so a
  `type:'tabbed'` form view now renders tabbed in the modal too — not just on the
  full-page route (#1762). Non-breaking; `FormView.type` enum unchanged.

  Refs objectstack-ai/objectstack#1890, ADR-0050

- 650bd1f: fix(forms/dashboard/related-list): four business-facing rendering fixes found while QA-ing a showcase workspace

  - **plugin-form / WizardForm**: a multi-step `object-form` with `formType: 'wizard'` posted an empty/partial body on submit, so the server rejected every required field. Two causes: (1) the footer Next/Create buttons bypassed the inner form and submitted the wizard's own (never-collected) `formData`; (2) the create-mode data-seeding effect re-ran on `dataSource`/`objectSchema` identity churn and reset `formData` to `{}` mid-wizard. Now the buttons submit the inner form natively (`<form id>` + `type="submit"`, which validates each step and collects values via `getValues()`), and the create seed is made idempotent.
  - **plugin-dashboard / DashboardRenderer**: chart widgets rendered as empty cards (recharts logged `width(-1) height(-1)`) because the positioned grid used `auto-rows-min`, collapsing any widget with no intrinsic height. The explicit-columns grid now uses `gridAutoRows: minmax(5rem, auto)` so spanned chart rows get a real height while tables can still grow.
  - **plugin-detail / RelatedList**: auto-derived related-list columns led with system audit fields (`created_at`, `updated_at`, …) for child objects without a name/title field, pushing business columns past the column cap. System audit fields are now sorted last.
  - **plugin-form / ObjectForm + WizardForm**: a successful create/update gave no feedback for metadata-only pages (which can't pass an `onSuccess` function). They now show a default `toast.success('Created'/'Saved')` when no `onSuccess` handler is supplied (guarded so a `submitHandler` host like MasterDetailForm never double-toasts).

- Updated dependencies [5976ba3]
- Updated dependencies [a00e16d]
- Updated dependencies [eaccefd]
- Updated dependencies [f7f325d]
- Updated dependencies [c12986e]
- Updated dependencies [71d7ce0]
- Updated dependencies [053c948]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [9049bbe]
- Updated dependencies [6c0c92c]
- Updated dependencies [cb2fdb1]
- Updated dependencies [c3749eb]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [d54346c]
- Updated dependencies [5332639]
- Updated dependencies [3870c20]
- Updated dependencies [2eb3096]
- Updated dependencies [b88c560]
- Updated dependencies [bd398df]
- Updated dependencies [66ed3ad]
- Updated dependencies [c6445b6]
- Updated dependencies [80c133c]
- Updated dependencies [5e1b838]
- Updated dependencies [d16566f]
- Updated dependencies [90acb7f]
- Updated dependencies [7913390]
- Updated dependencies [514f426]
- Updated dependencies [1394e34]
- Updated dependencies [e95cc25]
- Updated dependencies [abe8ebc]
- Updated dependencies [300d755]
- Updated dependencies [bd8b054]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [db8cd00]
- Updated dependencies [18728c1]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/components@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/types@7.0.0
  - @object-ui/fields@7.0.0
  - @object-ui/permissions@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/react@6.2.3
- @object-ui/components@6.2.3
- @object-ui/fields@6.2.3
- @object-ui/permissions@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
  - @object-ui/fields@6.2.2
  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2
  - @object-ui/permissions@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/react@6.2.1
- @object-ui/components@6.2.1
- @object-ui/fields@6.2.1
- @object-ui/permissions@6.2.1

## 6.2.0

### Patch Changes

- @object-ui/react@6.2.0
- @object-ui/components@6.2.0
- @object-ui/fields@6.2.0
- @object-ui/types@6.2.0
- @object-ui/core@6.2.0
- @object-ui/permissions@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/components@6.1.0
  - @object-ui/fields@6.1.0
  - @object-ui/react@6.1.0
  - @object-ui/permissions@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/react@6.0.4
- @object-ui/components@6.0.4
- @object-ui/fields@6.0.4
- @object-ui/permissions@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/react@6.0.3
- @object-ui/components@6.0.3
- @object-ui/fields@6.0.3
- @object-ui/permissions@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/react@6.0.2
- @object-ui/components@6.0.2
- @object-ui/fields@6.0.2
- @object-ui/permissions@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/react@6.0.1
- @object-ui/components@6.0.1
- @object-ui/fields@6.0.1
- @object-ui/permissions@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0
- @object-ui/fields@6.0.0
- @object-ui/permissions@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/react@5.4.2
- @object-ui/components@5.4.2
- @object-ui/fields@5.4.2
- @object-ui/permissions@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/react@5.4.1
- @object-ui/components@5.4.1
- @object-ui/fields@5.4.1
- @object-ui/permissions@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/fields@5.4.0
  - @object-ui/permissions@5.4.0
  - @object-ui/react@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/react@5.3.2
- @object-ui/components@5.3.2
- @object-ui/fields@5.3.2
- @object-ui/permissions@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1
- @object-ui/fields@5.3.1
- @object-ui/permissions@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0
- @object-ui/fields@5.3.0
- @object-ui/permissions@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/react@5.2.1
- @object-ui/components@5.2.1
- @object-ui/fields@5.2.1
- @object-ui/permissions@5.2.1

## 5.2.0

### Patch Changes

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [b2d1704]
- Updated dependencies [6c3f018]
- Updated dependencies [d912a60]
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
  - @object-ui/react@5.2.0
  - @object-ui/fields@5.2.0
  - @object-ui/components@5.2.0
  - @object-ui/permissions@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/fields@5.1.1
  - @object-ui/types@5.1.1
  - @object-ui/core@5.1.1
  - @object-ui/react@5.1.1
  - @object-ui/permissions@5.1.1

## 5.1.0

### Minor Changes

- c0b236f: Platform detail/form polish:
  - **Auto-section grouping**: When an object has no authored `views.form.sections`, the detail page now splits fields into a primary section and a collapsible "More details" section based on a field-type/name heuristic (textarea / markdown / description / notes / remarks). Eliminates the wall-of-fields layout on objects without explicit detail metadata.
  - **FormSection card chrome**: `FormSection` now accepts `showBorder`. Defaults to `true` for titled sections (Card wrapper) and `false` for untitled sections (flat). Same auto-default already applied to `DetailSection`.
  - **Origin breadcrumb**: Navigating from a list/kanban into a record now records the source view; the detail page shows a `← <view label>` back-link above the page header.
  - New i18n key `detail.sectionMoreDetails` (en + zh-CN).

### Patch Changes

- Updated dependencies [bd8447d]
- Updated dependencies [fbd5052]
- Updated dependencies [d51a577]
- Updated dependencies [d1ec6a2]
- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
- Updated dependencies [d548d6b]
  - @object-ui/components@5.1.0
  - @object-ui/react@5.1.0
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0
  - @object-ui/fields@5.1.0
  - @object-ui/permissions@5.1.0

## 5.0.2

### Patch Changes

- a311e22: Fix EmbeddableForm rendering no inputs on the public-form path. When the
  caller passes a `fields: string[]` list (e.g. the response from
  `GET /api/v1/forms/:slug`) the inner `ObjectForm` now receives a
  read-only wrapper of the data source — preserving `getObjectSchema()`
  so it can materialise widgets, while neutralising mutating ops so all
  backend writes still go through `EmbeddableForm.handleSubmit` (and its
  consent / honeypot / min-fill / redirect / payload-sanitisation gates).
  - @object-ui/components@5.0.2
  - @object-ui/fields@5.0.2
  - @object-ui/react@5.0.2
  - @object-ui/types@5.0.2
  - @object-ui/core@5.0.2
  - @object-ui/permissions@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1
- @object-ui/react@5.0.1
- @object-ui/components@5.0.1
- @object-ui/fields@5.0.1
- @object-ui/permissions@5.0.1

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
  - @object-ui/react@5.0.0
  - @object-ui/types@5.0.0
  - @object-ui/fields@5.0.0
  - @object-ui/core@5.0.0
  - @object-ui/permissions@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0
- @object-ui/fields@4.8.0
- @object-ui/permissions@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0
- @object-ui/fields@4.7.0
- @object-ui/permissions@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [3ee436d]
  - @object-ui/components@4.6.0
  - @object-ui/fields@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/react@4.6.0
  - @object-ui/permissions@4.6.0

## 4.5.0

### Patch Changes

- 6b6afd1: ModalForm / SplitForm / WizardForm now honor field-level `visibleOn` (CEL
  expression on inline fields) and `visible_on` (object schema mirror) inside
  their section-mode rendering. Previously only flat-field forms via ObjectForm
  respected the expression; section-mode dropped it so conditional fields
  always rendered.
- Updated dependencies [ab5e281]
- Updated dependencies [d714e85]
- Updated dependencies [6b6afd1]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/types@4.5.0
  - @object-ui/fields@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/permissions@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- Updated dependencies [63eb66d]
- Updated dependencies [2bd45af]
  - @object-ui/fields@4.4.0
  - @object-ui/components@4.4.0
  - @object-ui/types@4.4.0
  - @object-ui/core@4.4.0
  - @object-ui/react@4.4.0
  - @object-ui/permissions@4.4.0

## 4.3.1

### Patch Changes

- Updated dependencies [6b683c8]
  - @object-ui/components@4.3.1
  - @object-ui/fields@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1
  - @object-ui/permissions@4.3.1

## 4.3.0

### Patch Changes

- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/components@4.3.0
  - @object-ui/fields@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1
- @object-ui/react@4.2.1
- @object-ui/components@4.2.1
- @object-ui/fields@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/components@4.2.0
- @object-ui/fields@4.2.0
- @object-ui/react@4.2.0
- @object-ui/types@4.2.0
- @object-ui/core@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/react@4.1.0
- @object-ui/components@4.1.0
- @object-ui/fields@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/react@4.0.12
- @object-ui/components@4.0.12
- @object-ui/fields@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/components@4.0.11
- @object-ui/fields@4.0.11
- @object-ui/react@4.0.11
- @object-ui/types@4.0.11
- @object-ui/core@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10
- @object-ui/react@4.0.10
- @object-ui/components@4.0.10
- @object-ui/fields@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/react@4.0.9
- @object-ui/components@4.0.9
- @object-ui/fields@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/components@4.0.8
- @object-ui/fields@4.0.8
- @object-ui/react@4.0.8
- @object-ui/types@4.0.8
- @object-ui/core@4.0.8

## 4.0.7

### Patch Changes

- Updated dependencies [7c9b85c]
  - @object-ui/core@4.0.7
  - @object-ui/react@4.0.7
  - @object-ui/components@4.0.7
  - @object-ui/fields@4.0.7
  - @object-ui/types@4.0.7

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

- Updated dependencies [89ae109]
- Updated dependencies [925051d]
- Updated dependencies [1b6dc64]
  - @object-ui/fields@4.0.6
  - @object-ui/components@4.0.6
  - @object-ui/types@4.0.6
  - @object-ui/core@4.0.6
  - @object-ui/react@4.0.6

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
  - @object-ui/fields@4.0.5
  - @object-ui/types@4.0.5
  - @object-ui/core@4.0.5
  - @object-ui/react@4.0.5

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
  - @object-ui/fields@4.0.4
  - @object-ui/types@4.0.4
  - @object-ui/core@4.0.4
  - @object-ui/react@4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

- Updated dependencies [4be43e2]
  - @object-ui/types@4.0.3
  - @object-ui/core@4.0.3
  - @object-ui/react@4.0.3
  - @object-ui/components@4.0.3
  - @object-ui/fields@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1
- @object-ui/fields@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/fields@4.0.0
  - @object-ui/react@4.0.0

## 3.4.0

### Patch Changes

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
  - @object-ui/fields@3.4.0
  - @object-ui/types@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/react@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/react@3.3.2
- @object-ui/components@3.3.2
- @object-ui/fields@3.3.2

## 3.3.1

### Patch Changes

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/fields@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/react@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/react@3.3.0
- @object-ui/components@3.3.0
- @object-ui/fields@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/react@3.2.0
- @object-ui/components@3.2.0
- @object-ui/fields@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/react@3.1.5
- @object-ui/components@3.1.5
- @object-ui/fields@3.1.5
- @object-ui/types@3.1.5
- @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/react@3.1.4
- @object-ui/components@3.1.4
- @object-ui/fields@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/react@3.1.3
- @object-ui/components@3.1.3
- @object-ui/fields@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/react@3.1.2
- @object-ui/components@3.1.2
- @object-ui/fields@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/components@3.1.1
  - @object-ui/core@3.1.1
  - @object-ui/fields@3.1.1
  - @object-ui/react@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3
- @object-ui/react@3.0.3
- @object-ui/components@3.0.3
- @object-ui/fields@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/react@3.0.2
- @object-ui/components@3.0.2
- @object-ui/fields@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [adf2cc0]
  - @object-ui/react@3.0.1
  - @object-ui/components@3.0.1
  - @object-ui/fields@3.0.1
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
  - @object-ui/react@3.0.0
  - @object-ui/components@3.0.0
  - @object-ui/fields@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0
  - @object-ui/react@2.0.0
  - @object-ui/components@2.0.0
  - @object-ui/fields@2.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1
  - @object-ui/react@0.3.1
  - @object-ui/components@0.3.1
  - @object-ui/fields@0.3.1
