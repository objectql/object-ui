# @object-ui/fields

## 17.6.0

### Minor Changes

- a09bc33: fix(fields): render the option colour an author declared as an explicit hex, instead of quantizing it to nine palette families (objectui#5141)
  
  `options[].color` accepts any hex, but the badge renderer answered a lossy
  question with it: `hexToPaletteName` bucketed the value by hue into nine
  families (`red`/`orange`/`yellow`/`green`/`blue`/`indigo`/`purple`/`pink`, plus
  `gray` below 22% saturation), and `BADGE_COLOR_MAP` held exactly one class set
  per family. Two tiers an author declared as distinct therefore rendered
  byte-identical: `#2ecc71` ("in progress") and `#1e8449` ("completed") differ by
  0.1 degree of hue, both landed in `green`, and both emitted
  `bg-green-50 text-green-700 border-green-200`. Pressing the second colour darker
  still changed nothing. End users could not tell the two states apart in a list.
  
  `plugin-gantt` had already settled this class of conflict the other way —
  *explicit colorField value (hex or semantic name) — metadata wins* — and
  Studio's own option editor paints the author's swatch straight from the raw hex.
  Badges were the odd surface out.
  
  Now an explicitly declared hex is rendered as declared: the soft-pill surface,
  label and border are derived from that hex rather than snapped to a family, for
  both `appearance: 'badge'` and `appearance: 'dot'`.
  
  Two properties the family maps gave us for free are kept deliberately:
  
  - **The design system keeps control of theming.** The derived colours are
    published as CSS custom properties and consumed by *static* Tailwind
    utilities, so light and dark remain ordinary `dark:` variants
    (`.dark\:bg-...:where(.dark, .dark *)` in the built sheet) rather than a
    hard-coded inline background that would render identically in dark mode.
    Tailwind cannot generate a class for a runtime value, so the custom property —
    not the colour — has to be the dynamic part.
  - **Contrast is pinned, not just colour identity.** The label is the lightness
    along the declared hue nearest the declared one that still clears WCAG AA
    (4.5:1) against the surface actually rendered. Authors can and do declare
    colours that are unreadable under a label; honoring the declaration must not
    turn legibility loose across every list view. Dots are held to 1.9:1 against
    the row, the measured floor of the `-500` shades shipped today.
  
  **What changes for an author relying on the current look:** every select/status
  badge whose option colour is declared as a hex — which the renderer's own notes
  describe as almost all of them — will render in that declared colour rather than
  its palette family's fixed pill. Colours near a family's canonical shade look
  much as before; a colour the author picked deliberately *away* from it (a deep
  green, a muted red) now looks like what was written, and the pill's depth tracks
  the declared lightness. Declarations that are not an explicit hex are untouched:
  family names, the semantic value map and the deterministic hash fallback all
  resolve exactly as they did, and `getSemanticColorName` still returns family
  names, so the Gantt path is unaffected.
  
  The badge classes exported by `getBadgeColorClasses` are unchanged, so callers
  that consume only a class string (the grid's compact card view and group-header
  pills, Kanban) keep today's quantized rendering until they adopt the new
  `getBadgeHexAppearance` / `getDotHexAppearance` helpers.
- 167ec42: `ComponentMeta.labelling` grows a third value: `'control' | 'group' | 'display'`
  (objectui#4857, ruled jointly with objectui#4871 as the single repo-wide vocabulary for
  "how does a host learn what a widget will render"). `'display'` declares a widget whose
  whole surface is a pure display in EVERY state — no focusable control, nothing a
  `<label for>` could ever reach.
  
  The form renderer answers the declaration with the objectui#4788 host container (field
  id + `aria-labelledby` + `aria-describedby` + `role="group"`) in the editable state too;
  the `readonly === true` arm keeps its exact #4788 semantics for undeclared widgets. The
  display-only four (`formula` / `summary` / `auto_number` / `vector`) declare `'display'`
  — on the real object-form path they arrive `disabled`, never `readonly` (a deliberate
  distinction this change does not touch), so their visible labels pointed `for` at an id
  no element carried and their help text had zero consumers in every editable form.
  
  `grid` was re-measured before being classified: its only bare-config focusable is the
  auxiliary "Add line" button (routing `for` there would have label clicks insert rows),
  and every realistic config is a table of per-cell inputs — a composite. It declares
  `labelling: 'group'` and its root container now consumes the host id, name and
  description, exactly like `address` / `checkboxes`.
  
  Companion registry gate: `FIELD_WIDGET_LABELLING` (exported) is a `Record` keyed by the
  field-widget map's own literal key union, so registering a widget without deciding its
  labelling is a compile error rather than a silent fall-through to the dangling-`for`
  path, and the declaration test asserts the registered meta agrees with it key by key.

### Patch Changes

- 69251bf: `AddressField` is translatable, shows no US example placeholders, and formats its readonly line in the reader's address order.
  
  The five sub-labels ("Street Address", "City", "State / Province", "ZIP /
  Postal Code", "Country") were English string literals with no i18n key. On a
  non-English console every address field showed five English words in the middle
  of an otherwise fully translated form, and an app had no way to reach them: the
  parts are not fields on the object (`billing_address` is a single `address`
  column), so a translation bundle had nothing to key on, there is no `subLabels`
  property to declare, and the widget cannot be replaced from metadata. They now
  resolve through `fields.address.street` / `.city` / `.state` / `.postalCode` /
  `.country`, added to all ten locale packs. The `en` values are byte-identical to
  the literals they replace, and `FIELD_DEFAULTS` carries the same five, so
  English and provider-less rendering are unchanged.
  
  The five input placeholders (`123 Main St`, `San Francisco`, `CA`, `94102`,
  `United States`) are **removed** rather than keyed. They were untranslated and
  US-specific — a zh/ja/ar user was shown an American address as the example of
  what to type — and the right example is a function of the address's country,
  not the reader's language, which no channel in the stored value can supply
  today. Each box keeps the visible label that names it.
  
  The readonly line's part order now follows the reader's display locale
  (`useDisplayLocale()`): `zh`, `ja` and `ko` read largest-first (`Country, ZIP
  State, City, Street`), every other locale keeps the unchanged small-to-large
  order (`Street, City, State ZIP, Country`). The display cell renderer takes the
  same locale through the same shared `formatAddress`, so a stored address reads
  identically in a readonly form and in a grid cell.
- 0ae27f7: The form renderer's built-in `textarea` branch now honours a declared character cap the same way the registered `field:textarea` widget does.
  
  One `maxLength` declaration produced two experiences. The registered path has
  shipped four things since objectui#3406/#3408/#3417 — the native cap, visible
  `{n}/{max}` digits, a description reached through `aria-describedby` so the
  limit is announced on focus, and a threshold-gated debounced near-limit notice.
  The built-in branch — the path standalone and embedded hosts take, the ones that
  call no `registerAllFields()` — shipped a subset of one of them.
  
  The accessibility half is the half that mattered: a screen-reader user on this
  path learned the field's limit only as a validation error AFTER submitting. All
  four affordances now render on both of the branch's surfaces (the inline control
  and the fullscreen dialog), from the SAME `CharacterCount` component the widget
  renders rather than a second copy of it.
  
  Also fixed, and wider than the visible gap: the branch never READ the cap, it
  only spread its leftover field props onto the element. A camelCase `maxLength`
  therefore worked by coincidence — it names a real DOM attribute — while the
  legacy `max_length` spelling, which the registered widget and all three
  producers of a form field have dual-read since framework#1878 §3, landed as a
  stray inert `max_length="…"` attribute and capped nothing at all. The branch now
  resolves both spellings and keeps the non-attribute spelling off the DOM.
  
  `CharacterCount` moved from `@object-ui/fields` to `@object-ui/components`, the
  package both render paths may import, in the direction and for the reason
  objectui#3398 measured for `FullscreenEditor`. It was internal to `fields` (never
  exported from that package's barrel), so no published export changed; it is a
  new export of `@object-ui/components`. Its copy moved with it onto the same
  `fields.textarea.*` keys with byte-identical English defaults, so the ten locale
  packs need no edit and provider-less rendering is unchanged.
- bbe8b86: The allow-list of option widgets that are fed the live record is now one exported constant, `CASCADE_OPTION_WIDGET_TYPES`, instead of three private copies.
  
  `select` / `multiselect` / `radio` / `checkboxes` are the widgets whose OFFERED
  option set is re-resolved against a record (per-option `visibleWhen`, plus the
  `dependsOn` gate), so they are the widgets a surface must thread its live record
  to. Three surfaces feed that one evaluator — the object form, the single-record
  action dialog and the bulk action dialog — and until now each carried its own
  private `new Set([...])` of the same four keys, with a comment in each asking the
  next person to change all three together. Nothing could have reported them
  drifting: every copy passed its own behavioural tests, and a divergence would
  have shown up only as one surface silently disagreeing with another about what
  "the record" is.
  
  The set now lives in `@object-ui/core`, next to `resolveCascadingOptions` — the
  evaluator that reads that record — because core is the one package all three
  surfaces already depend on, and it is re-exported from `@object-ui/fields` next
  to `resolveFormWidgetType`, whose output is the vocabulary the keys are written
  in. Both are the same object, pinned by test; each consumer keeps its own
  normalization (`normalizeFieldType` in the form, `resolveFormWidgetType` in the
  dialogs), which agree on these four members.
  
  No behaviour changes: the members are identical on all three surfaces, and the
  existing pins for each surface still assert the same records reaching the same
  widgets. The rationale that was repeated in the three copies — including the
  note that the widget-hint picker family (`filter-condition`, `recipient-picker`,
  the lookup family) reads a different sibling key off the same channel and is
  deliberately NOT in this set — is now stated once, in the constant's own
  documentation. Whether the action and bulk dialogs should ever feed those
  pickers stays an open question (objectui#4771), unchanged by this convergence.
- 65e88e6: `@object-ui/fields` stops publishing its `src/` tree
  
  The manifest's `files` array listed `src` alongside `dist`, so every published tarball carried all 173 source files — 97 of them `*.test.tsx` / `*.test.ts`. It has been that way since the file's first commit (`780a1b993`), where `files` was already `["dist", "src", "README.md"]` while `exports` named only `dist`, so the entry was never added for a consumer. objectui#4006 recorded this exact shape and did not act on it: its scope was the `*.test.d.ts` half the build program emitted into `dist`, and it noted in passing that the test sources were already in the tarball by this other route.
  
  Nothing in the published surface reached those files, which is why no consumer changes in either direction. Measured on a cleanly rebuilt `dist`, all four ways in are closed: the `exports` map has two entries and both target `dist` (`.` resolves `types` / `import` / `require` to `./dist/index.d.ts` / `./dist/index.js` / `./dist/index.cjs`, and `./style.css` to `./dist/index.css`); `main` / `module` / `types` are `./dist/index.cjs`, `./dist/index.js`, `./dist/index.d.ts`; no deep import into this package exists anywhere in the repo or the docs — the one that used to, `@object-ui/fields/widgets/MarkdownContent`, was ruled out by objectui#4325 precisely because a package's surface is its index, and the `../fields/src` paths in sibling `vite.config.ts` files are workspace aliases resolved through `resolve()` against the source tree, which no `files` array shapes; and the tarball holds no sourcemap that could point back at `src`. That last one is the check that had to be measured rather than assumed, because this package emits its declarations through `vite-plugin-dts` rather than the `tsup` of objectui#4847 or the bare `tsc` of `@object-ui/types`: a clean rebuild writes 78 files into `dist`, of which zero are `.d.ts.map`, zero are `.js.map`, zero contain a `sourceMappingURL` comment and zero mention `../src`. `src/index.css` is an input to `scripts/build-css.mjs`, not an output anyone resolves; the sheet the `./style.css` export names is the built `dist/index.css`, which still ships.
  
  `npm pack --dry-run` across the change, on the same `dist`:
  
  | | before | after |
  | --- | --- | --- |
  | entries | 255 | 82 |
  | unpacked | 2265557 B | 841772 B |
  | tarball | 629843 B | 252364 B |
  
  173 files leave, none arrives, nothing outside `src/` moves, and every surviving entry is byte-identical apart from the edited `package.json` itself. The 173 are the 97 tests plus 76 implementation modules, whose published form remains the bundled `dist/index.js` / `dist/index.cjs` and the 75 declaration files beside them.
  
  `@object-ui/types` keeps its `src` entry for now, and that is a different judgement rather than an omission: it builds with a bare `tsc` under a `declarationMap` / `sourceMap` config with no `inlineSources`, so its shipped `dist/*.d.ts.map` name `../src/*.ts` with no embedded content and dropping `src` there would leave published maps pointing at files the tarball no longer carries. That trade-off is filed as objectui#4851.
- 37f6844: FilterConditionField can author the spec's `$icontains` — case-insensitive contains is reachable from the filter UI.
  
  `@objectstack/spec`'s `FieldOperatorsSchema` gained `$icontains` between
  `17.0.0-rc.2` and `rc.5`, and every driver and evaluation face the platform
  ships now executes it. `FilterConditionField` had no builder operator that could
  author it, so the capability was unreachable from the sharing-rule criteria
  builder and sat in that widget's parity test as an explicit `KNOWN_UNREACHABLE`
  entry.
  
  The FilterBuilder gains a `containsCaseInsensitive` operator ("Contains (ignore
  case)", translated in all ten locale packs). `condToMongo` emits
  `{ field: { $icontains: value } }` and `kvToCondition` reads it back, so a saved
  criteria reopens in the visual builder instead of falling into the raw-JSON
  editor. Today's `contains` is unchanged and still emits the case-SENSITIVE
  `$contains`; whether it should have been case-insensitive all along is a product
  question that stays open, and stored filter views keep meaning what they meant.
  
  The fold is ASCII-only by contract — `café` does not match `CAFÉ`.
  
  The new operator is **opt-in per consumer**: `FilterBuilder` takes an
  `extraOperators` prop, and only `FilterConditionField` passes it. The one
  dropdown feeds three at-rest dialects and only the MongoDB-style criteria this
  widget writes can carry the operator — the spec's `VIEW_FILTER_OPERATORS` (saved
  views) and `VALID_AST_OPERATORS` (the live grid's filter AST) have no
  case-insensitive contains, so offering it there would author a filter those
  paths cannot execute. Every other FilterBuilder is unchanged.
- 911ceaa: The fullscreen long-text dialog announces the field's validation state and carries the field's name
  
  objectui#4824, objectui#4832.
  
  `mobile.fullscreenLongText` is a shipped opt-in, and with it on the phone user
  edits long text in this dialog and nowhere else. Measured on all three surfaces
  that render the dialog — `TextAreaField`, `RichTextField`, and the form
  renderer's built-in `textarea` branch — with the field genuinely invalid at that
  moment:
  
  ```
  INLINE  richtext  aria-invalid= true
  DIALOG  richtext  aria-invalid= false   aria-describedby= null
  INLINE  textarea  aria-invalid= true
  DIALOG  textarea  aria-invalid= null    aria-describedby= null
  ```
  
  and the accessible name of every dialog control empty, against `F` on every
  inline one. The rich-text row is the sharp half: the dialog was not silent about
  the failure, it was announcing the OPPOSITE of the inline control for the same
  field at the same moment, because `RichTextEditorSurface` computed
  `aria-invalid={!!error}` from an `error` prop the dialog rendering never
  received. 3 surfaces, 3 broken, one cause: the dialog's control is built from
  scratch by the host, so none of the wiring the inline control gets from the form
  renderer reaches it.
  
  **Answered once, in the primitive.** `FullscreenEditor` now takes the field's
  `error` and owns what the dialog does with it: it renders the message in a
  dialog-local node, and hands `children` a required fourth argument — a
  spreadable set of DOM attributes — carrying `aria-labelledby` (the dialog
  title's text, i.e. the field label #3393 already put there), `aria-invalid`, and
  `aria-errormessage` naming that node. The host spreads it; the host never learns
  an id, so it cannot name the wrong node, cannot compose the attributes subtly
  wrong, and cannot compute its own `aria-invalid` from a prop it forgot to plumb.
  Three hosts hand-answering this is the shape that produced three identical
  holes.
  
  **On objectui#3222's "the text belongs to `FormMessage`".** The maintainer's
  ruling of 2026-08-16 restates that rule as what it was always protecting —
  only one copy of the error text is in the accessibility tree at any moment —
  which the dialog-local node satisfies: it exists only while the dialog is open,
  and for exactly that window Radix `aria-hidden`s everything outside the modal,
  `FormMessage` included. The shortcut of pointing the dialog control's
  `aria-describedby` / `aria-errormessage` at the host's `FormMessage` id is
  forbidden rather than merely unused: it resolves to a node that is `aria-hidden`
  for the whole time the reference is live (an ARIA MUST violation), and neither
  happy-dom nor jsdom can see the difference — which is why every new pin asserts
  that the named node is inside THIS dialog, not merely that it exists.
  
  `aria-errormessage` carries a single IDREF and is emitted only alongside
  `aria-invalid="true"`. It is deliberately not folded into the host's
  `aria-describedby` chain, which on the textarea surface already carries the
  fullscreen character counter's sentence.
  
  **The name reuses the visible title rather than minting a second author for it**
  (#3978): `aria-labelledby` points at a span inside `DialogTitle`, not at
  `DialogTitle` itself — Radix renders the title as `h2` with the id its own
  `DialogContent` `aria-labelledby` names, so putting an id on it would buy the
  control a name at the cost of the dialog's.
  
  **Breaking (shipped as `minor`, see below), `@object-ui/components` only.**
  `FullscreenEditorProps.error` is REQUIRED, not optional, and
  `FullscreenEditorProps['children']` takes a fourth argument.
  
  FROM → TO for an out-of-repo host:
  
  ```
  <FullscreenEditor value={v} onCommit={c} label={l} testIdPrefix="x">
    {(draft, setDraft, disabled) => <textarea … />}
  </FullscreenEditor>
  
  <FullscreenEditor value={v} onCommit={c} label={l} testIdPrefix="x" error={err}>
    {(draft, setDraft, disabled, aria) => <textarea {...aria} … />}
  </FullscreenEditor>
  ```
  
  A render prop may still declare fewer parameters, so only `error` fails to
  compile — which is the point of making it required. Every consumer already has
  the value at hand (registered widgets take `error` off the widget props
  contract, objectui#3222; the built-in branch reads `fieldState.error?.message`),
  and an omitted `error` reproduces this defect exactly: a dialog announcing
  `aria-invalid="false"` for a field its own form has already failed. An optional
  key was forgotten by three surfaces in a row; a required one cannot be.
  
  `@object-ui/fields` is `patch`: `FullscreenFieldEditor` is internal to that
  package (not re-exported from its entry), so nothing in its public surface
  changes — only the behaviour of the two long-text widgets' dialogs.
  
  `minor` rather than `major` follows the repo's standing retirement precedent
  (AGENTS.md §版本号策略, enforced by `scripts/check-changeset-no-major.mjs`): all
  publishable packages sit in one `fixed` group, so a `major` here would carry the
  whole family up against an `@objectstack` that has not moved.
- 0bffb18: A readonly group-labelled field is now DESCRIBED by its own help text, not just named by its label.
  
  The seven `labelling: 'group'` widgets (`address`, `geolocation`, `checkboxes`, `radio`, `rating`, `file`, `multiselect`) render a `<FormDescription>` in their readonly and zero-option states, and the form renderer publishes its `id` — but nothing in the document referenced that id, so the visible help text had no programmatic association with the field it describes. Measured before the change, one field per row: `consumers=0` on every readonly surface of all seven, against `consumers=1` on the same widget's editable one.
  
  `toHostGroupProps` now carries `aria-describedby` alongside the host `id` and `aria-labelledby`, onto the `role="group"` surface those states already render (a group is a description carrier under ARIA 1.2 — no focusable control required, which is why this became possible only once objectui#3990 gave those surfaces a role).
  
  Control-channel state deliberately does NOT come along: `aria-invalid` and `aria-required` report what a user's editing may do wrong, and a readonly display cannot be edited. The boundary is pinned from both sides, including with a live failed validation on a readonly required field. Editable surfaces are unchanged — a composite's editable container still leaves the description on the sub-input the user focuses, so the help text is never announced twice.
- 800f455: fix(fields): grid columns are keyed by the declared `name`, so spec-compliant grid metadata renders populated cells
  
  `GridField` declared its own column interface keyed by `field` and read
  `c.field` at every site (`key=`, `row[…]`, the blank row, cell writes, the
  column chooser, the running-total lookup), while the published
  `GridColumnDefinition` in `@object-ui/types` — and the grid documentation, and
  the `fields-grid` catalog examples — declare the key as `name`. Metadata
  authored against the published type therefore rendered a grid with the correct
  row count and every cell empty, plus a React "unique key" warning per column.
  
  The renderer now reads the declared `name`, and the master-detail derivation
  (`deriveColumns` / `hydrateColumns` / `pickAmountField`) produces and consumes
  the same key. There is deliberately **no** `col.field ?? col.name` alias: one
  spelling at the producer (AGENTS.md #0.1).
  
  **Breaking for `field`-keyed columns.** Grid / line-item / master-detail
  subform columns spelled `{ field: 'amount' }` must be re-spelled
  `{ name: 'amount' }`. This affects author-supplied `columns` on the `grid`
  field, `record:line_items`, `object-master-detail-form` details and a
  relationship field's `inlineColumns`. Auto-derived columns (no explicit
  `columns` block) need no change. List-view and `object-grid` columns are a
  different contract (`ListColumn`) and keep their own `field` key.
- 5458414: Publish relative import specifiers with explicit `.js` extensions so these six packages load under plain Node ESM.
  
  Node's ESM resolver does not extension-search relative specifiers and `tsc` never rewrites them, so an extensionless `./Foo` in the source shipped as an extensionless `./Foo` in `dist` and importing the package entry outside a bundler failed with `ERR_MODULE_NOT_FOUND`. Bundled consumers were unaffected. Unbundled consumers — plain Node ESM, an SSR host importing the package directly, anyone running the published tarball without a build step — can now import these entries, and so can the downstream `@object-ui/plugin-*` packages that evaluate through `mobile`, `permissions` and `providers`.
- 3241559: `object-kanban` now caps its fetch with a real top-level `$top`, and honours `limit`.
  
  The board's row cap was written `dataSource.find(objectName, { options: { $top: 100 }, $filter: … })`
  — `$filter` at the top level, where the adapters read it, and the cap one level
  down under `options`, which is not a `QueryParams` key. Nothing in this repo
  reads `params.options` (`convertQueryParams` in `@object-ui/data-objectstack` and
  `ApiDataSource` both read `params.$top`), so the intended cap never reached the
  wire: a board over a large object fetched every row the server would return and
  grouped all of it into lanes client-side. The author's 100 was never live.
  
  The cap is now `$top: schema.limit ?? 100`, the shape `object-timeline` took for
  the identical defect. Two consequences worth reading before upgrading:
  
  - **A board that used to fetch unbounded now fetches 100 rows by default.** That
    is the previously-declared intent taking effect, not a new limit — but a board
    over an object with more than 100 matching records will show fewer cards than
    it did. Authors who want the old behaviour should declare the window they
    actually want (`limit: 500`), not rely on the absence of one.
  - **`limit` is now mapped from the `dataSource` binding** (`object-kanban`'s
    `ElementDataSourceMapping` gains `limit: 'limit'`). A board bound to a saved
    view is capped by that view's `pagination.pageSize`, and the binding's own
    `limit` overrides it. The flag comes with the read site: it stayed unmapped
    until now on the rationale that the board had a "fixed window", which is the
    claim this change falsifies. `sort` remains unmapped — the board still has no
    `$orderby` read site — and `columns` remains unmapped because a board's columns
    are its swimlanes, not a field projection.
  
  `KanbanSchema` gains `limit?: number` (the board's row cap; distinct from a
  column's `limit`, which is that lane's WIP limit and never reaches the query),
  and the guide's per-block table in `content/docs/guide/data-source.md` no longer
  claims a fixed window for `object-kanban`.
  
  `@object-ui/fields` carried the same nesting in the lookup-name fallback
  (`find(referenceTo, { $filter: { id }, options: { $top: 1 } })`) where it was
  harmless — a primary-key equality returns at most one row with or without a cap.
  It is spelled `$top: 1` now, so no live instance of the dead nesting is left in
  the repo to read as precedent. No behaviour change there.
- 616a2a5: The list filter builder no longer offers `Is set` / `Is not set`, which its query dialects cannot express.
  
  **User-visible before/after.** The operator dropdown in the list toolbar's
  filter popover — and in the Studio view/tab/page filter inspectors, the dataset
  inspector and the generic `filter` config field — loses two rows: **"Is set"**
  and **"Is not set"**. The sharing-rule criteria builder (`FilterConditionField`)
  keeps both, unchanged. `Is null` / `Is not null` and `Is empty` / `Is not empty`
  are untouched everywhere and remain the way to filter on a missing value from
  the list.
  
  Nothing that worked stops working. Every save path behind those two rows was
  already broken, in three different ways depending on the surface:
  
  - **Live grid** — `ListView.mapOperator` had no row for either id, so its
    `default:` arm returned the id verbatim and the query went out as
    `['name', 'exists', 'x']`. `exists` is not a member of the spec's
    `VALID_AST_OPERATORS`, so `isFilterAST()` rejects the shape: an unfiltered
    read or a 400, never the filter the user asked for.
  - **Save as view** — `foldFilterGroupToSpecRules` normalizes through the spec's
    `normalizeFilterOperator`, which does not know the pair, and
    `ViewFilterRuleSchema`'s enum then refuses the rule.
  - **Dataset inspector** — `groupToCondition` has no row either and drops the
    condition silently, so the filter simply never applied.
  
  **Why withheld rather than mapped.** Measured on `@objectstack/spec`
  17.0.0-rc.6: neither `VIEW_FILTER_OPERATORS` nor `VALID_AST_OPERATORS` contains
  an existence operator, under any spelling — both sets have zero members matching
  `/exist/`. Only the MongoDB-style `FieldOperatorsSchema` criteria carries
  `$exists`, and that is precisely the dialect `FilterConditionField` writes, so
  the pair moves behind the existing `OPT_IN_OPERATORS` gate and that widget opts
  in. Collapsing them onto `isNotNull` / `isNull` was rejected: the builder
  already draws those as their own rows, the round trip is lossy (a saved
  `exists` reads back as `isNotNull`), and the spec's own note records `$exists` =
  has-value as still unsettled across drivers — `driver-memory`'s live mingo path
  and `driver-mongodb` read key-presence.
  
  **The class is now closed by an assertion, not by discipline.** objectui's three
  existing operator-parity guards all sweep spec vocabulary → objectui; none asked
  whether an id the dropdown draws is an id the consumer can persist, which is the
  direction that broke. `plugin-list`'s new
  `list-offered-operator-expressible-parity.test.ts` forces the set the list
  toolbar offers to **equal** the set its two dialects can express, in both
  directions — so an unexpressible operator cannot be offered, and an operator
  that becomes expressible upstream cannot stay needlessly withheld.
- 6c68b13: Lookup "recently used" now obeys the field's declared filters. The recents rail
  re-fetched its rows without merging either `lookupFilters` or the `dependsOn`
  cascade, so a record the author's metadata excludes stayed visible and
  selectable — pick a product under project A, switch the form to project B, and
  project A's product was still offered. Both re-fetch channels are fixed: the
  inline dropdown (which re-read each remembered id with an unfiltered `findOne`)
  and the search-first picker (which batched recents into an unfiltered `$in`
  query). The currently-selected value still resolves unfiltered, so an existing
  value keeps its label and a selection tray is never silently emptied.
- 5607092: objectui#4029 — the repo root now lints `no-console` (`error`, allowing
  `warn`/`error`) so a stray module- or function-scope `console.log`/`info`/
  `debug` fails CI instead of shipping silently (as `console.log('Registering
  object-map...')` did in #7139, caught only by hand). Landing the rule meant
  individually judging every real hit outside the tooling exemptions
  (`scripts/**`, `**/examples/**`, test files, `packages/cli/src/**`,
  `packages/create-plugin/src/**`) — this changeset covers the published
  packages whose call sites changed:
  
  - `@object-ui/app-shell`: `ObjectDataPage`'s dropped-URL-filter message is a
    real diagnostic (data silently discarded), so it moves from `console.debug`
    to `console.warn` to match the house convention.
  - `@object-ui/plugin-detail`: `DetailView`'s Web Share API failure now reports
    via `console.error` (it is a real failure, not debug noise); a redundant
    "Link copied to clipboard" success log is removed.
  - `@object-ui/fields`: `MasterDetailField`'s `handleView` stub no longer logs
    the item it does nothing with.
  - `@object-ui/runner`: `App`'s loader-selection debug prints, `LayoutRenderer`'s
    unused click-handler stub log, and `MockDataSource`'s per-call narration
    (`find`/`create`/`getObjectSchema`) are removed — none diagnosed a problem,
    they only echoed the happy path.
  - `object-ui` (VS Code extension): the "extension is now active!" activation
    log is removed.
  
  No behavior changes beyond console output. `@object-ui/core` and
  `@object-ui/data-objectstack` also touch `no-console`-adjacent lines
  (`debugLog`/`debugTime`/`debugTimeEnd`, `createQuietHttpLogger`) but only to
  add `eslint-disable-next-line` documentation — those ARE the repo's
  deliberate debug/logger infrastructure, not leaked residue, so their own
  changeset carries empty frontmatter.
- e7747f1: fix(fields): retire the `owner` field-type alias with a loud tombstone
  
  `owner` was a synonym for `user` with zero behavioral delta — both resolved to
  the same `UserField` widget — and it is not a member of `@objectstack/spec`'s
  closed `FieldType`, so no object schema could ever declare it. It was reachable
  only through hand-written SDUI, and the three code faces that read it had
  already drifted apart on the word: the form's data-source rule excluded it,
  while plugin-grid's bulk-action dialog and app-shell's `paramToField` included
  it.
  
  The retired spelling now fails **loudly**. Deleting the alias on its own would
  have been absorbed by two silent tails (`mapFieldTypeToFormType`'s
  `|| 'field:text'` and `resolveFormWidgetType`'s `: 'text'`), each handing back a
  working plain text input with no check turning red — so anyone who had written
  `type: 'owner'`, including an AI author copying it out of a doc, would have
  shipped a text box believing they shipped a person picker. Instead:
  
  - `type: 'owner'` and `widget: 'field:owner'` both resolve to a registered
    tombstone widget that renders a visible refusal naming the migration;
  - the same prescription is written to the console once per spelling;
  - the read/cell path degrades to the text cell deliberately and says so.
  
  Migration: write the record-owner field as `{ type: 'user', name: 'owner' }` —
  the field NAME carries the ownership meaning, the type carries the widget.
  `UserField` and `UserCellRenderer` are unchanged; only the synonym is gone.
  
  Also corrects the `dataSource` TSDoc in `@object-ui/fields`, which listed `grid`
  among the widgets the form renderer wires a DataSource to. `GridField` never
  read `dataSource` and no data-source table ever contained the key.
- ac2f332: Retired field-type spellings can no longer reach an inline editor by delegation — the grid's inline cell editor stops offering a working person picker for `owner`.
  
  objectui#4814 retired the `owner` field type with a loud tombstone, and the
  record form has answered `type: 'owner'` with a visible refusal ever since.
  `FieldEditWidget` did not participate, and the reason it was missed is that no
  routing table had to list the spelling for it to stay alive:
  `hasFieldEditWidget` answers `resolveInlineEditType(type) in EDIT_WIDGETS`, and
  `resolveInlineEditType` returns a type **unchanged** when it is already a key of
  `EDIT_WIDGETS`. So while `owner: UserField` sat in that map, the alias table —
  where the retirement lives — was never consulted, and the retirement never
  applied. Measured: `hasFieldEditWidget('owner') === true`, and a direct
  `FieldEditWidget` call rendered a working person picker. Every host built on
  this seam, the data grid's inline cell editor being the user-facing one, still
  let a person be picked and saved for a field the record form refuses.
  
  The gate now consults the retirement table itself, so this closes the **class**
  rather than the spelling — the next retirement covers this seam the day it lands
  in `RETIRED_FIELD_TYPES`, with no edit here:
  
  - `hasFieldEditWidget()` answers `false` for any retired spelling, ahead of
    every table lookup (so it holds even if a retired spelling is still a key of
    the widget map);
  - `isInlineExcludedFieldType()` answers `true` for any retired spelling, which
    is what routes a host to its read-only path;
  - `FieldEditWidget` itself renders no control for a retired spelling and writes
    the once-per-spelling console prescription naming the migration;
  - `owner` is dropped from `EDIT_WIDGETS` and from the cosmetic
    `COMPACT_EDIT_TYPES` sizing set.
  
  The second bullet is load-bearing and not cosmetic. `ObjectGrid` marks a column
  `editable: false` exactly when `isFieldInlineEditable` is false, and that
  predicate consults `isInlineExcludedFieldType`. Without it, closing the first
  gate alone would have left the column editable, handed the cell editor a `null`
  widget, and let DataTable fall back to its built-in **plain text input** — which
  for a stored person reference displays a coerced value and writes a bare string
  straight back over it. Measured before/after on the grid consumer: a stored
  `owner` field went from an editable cell rendering the person picker to a
  read-only cell (`isFieldInlineEditable('owner')` `true` → `false`), which is the
  same disposition `password`, `formula` and `composite` already get, for the same
  reason. The read path is unchanged from #4814: the text cell plus the console
  prescription.
  
  `user` is untouched — it keeps the person picker, its compact sizing and its
  expanded-object value resolution. The record-owner idiom survives verbatim as
  `{ type: 'user', name: 'owner' }`: the field NAME carries the ownership meaning,
  the type carries the widget.
- a777058: Editable `markdown` / `html` / `richtext` fields now carry the host's `id` and `aria-describedby` on the editor.
  
  `RichTextField` — the one widget all three registry keys resolve to — read only
  `className` and `disabled` off its props and had no `toDomProps` anywhere in the
  file, so everything `<FormControl>`'s Radix `Slot` hands a field widget landed on
  no element at all. Measured on a real form with a field carrying a description:
  
  ```
  markdown  editable  descEl=SET  consumers=0  hostIdEl=NONE  for=DANGLING
  text      editable  descEl=SET  consumers=1  hostIdEl=input     for=RESOLVES
  textarea  editable  descEl=SET  consumers=1  hostIdEl=textarea  for=RESOLVES
  ```
  
  Two user-visible consequences: the form's visible label pointed at an id nothing
  carried, so clicking it did not reach the editor and the control had no
  accessible name; and the `<FormDescription>` the form rendered below the field
  had zero consumers, so a screen reader never announced the help text or — on a
  failed submit — the error message id that rides in the same `aria-describedby`.
  
  The fix is objectui#3318's standing recipe: `toDomProps(props)` spread onto the
  REAL focusable control, which here is the `<Textarea>` inside the shared
  `RichTextEditorSurface`. The pass-through is given to the inline surface only —
  the fullscreen dialog's copy of the same surface must not carry a duplicate of
  the host id, and the description ids it names sit outside the modal Radix
  `aria-hidden`s. `aria-invalid` still comes from the widget's own `error` read,
  kept after the spread so objectui#3318's PASS entry for this widget is unchanged.
  
  The readonly branch is untouched: the same reading there belongs to
  objectui#4788, whose mechanism is still open.
- 75444e3: The dependency-gate hint now enumerates its controlling fields with the locale's
  own list separator, and reads identically whichever caller produced it.
  
  `lookup.selectFirst` and `fields.options.selectFirst` are deliberately one
  wording, so a field gated on two or more parents says the same thing whether the
  lookup widget or the form renderer rendered it. The sentence was shared but its
  `{{fields}}` slot was not: each call site joined the controlling-field names
  with its own hardcoded separator, and not even the same one — `', '` in
  `LookupField`, `' / '` in the form renderer's `gatedHint` and in
  `OptionsEmptyState`. A field gated on Account and Lead Source read
  `Select Account, Lead Source first` from one side and
  `Select Account / Lead Source first` from the other.
  
  A list separator is a property of the locale rather than of the code, so both
  spellings were also wrong for the script under zh/ja (which enumerate with
  U+3001) and under ar (U+060C). All three call sites now read
  `validation.formInvalidJoiner` — the key already shipped in all ten packs for
  the invalid-submit toast's field list, which is the same class of truncated-name
  list. One key, every caller: a second, gate-specific key would have recreated
  the divergence the shared sentence exists to prevent.
  
  No locale pack changes, and no change to what a provider-less render produces in
  English: the `@object-ui/fields` defaults table declares the joiner as `', '`,
  the `en` pack's value and the literal `LookupField` previously hardcoded.
- dad51e5: fix(fields): deliver the host's a11y channels to `slider` and name `signature`
  
  `SliderField` and `SignatureField` forwarded nothing a form host handed them —
  neither spread `toDomProps(props)` at all — so `<FormControl>`'s whole payload
  landed on nothing. Measured on a real form, one required field per row, freshly
  failed validation:
  
  ```
  slider     ariaInvalidTrue=[]  labelFor=…-form-item -> DANGLING  descConsumers=0  ids=[]
  signature  ariaInvalidTrue=[]  labelFor=…-form-item -> DANGLING  descConsumers=0  ids=[]
  text       ariaInvalidTrue=[input]  labelFor -> input            descConsumers=1
  ```
  
  `ids=[]` is the tell: no element in either row carried an id at all, so the
  visible label pointed `for` at nothing, the rendered help text had zero
  consumers, and a failed slider announced no error state.
  
  **`slider`** now delivers all three. Its focusable control is Radix's
  `span[role="slider"]` thumb, which the synced `ui/slider.tsx` renders internally
  and does not export, so the primitive grew a declared `thumbProps` — routed
  through a new `lib/slider-thumb` and applied to the no-touch file as a declared
  sync patch, so it survives regeneration. The split of which keys stay on Root
  (`name`, `disabled`) is the one the `select` fix already settled.
  
  **`signature`** gets the name and the description on a `role="group"` container.
  Its control state deliberately does not follow: the drawing surface is a
  `<canvas>` with no keyboard path, and its only other element is disabled while
  the pad is empty, so there is no element a control state could be read from.
  
  Both are now declared `labelling: 'group'` — a `<span>` and a `<canvas>` are not
  labelable elements, so a host `for` could only dangle at them.
- Updated dependencies [88085e3]
- Updated dependencies [69251bf]
- Updated dependencies [57e668f]
- Updated dependencies [516663d]
- Updated dependencies [41ac1b7]
- Updated dependencies [1eaf0a1]
- Updated dependencies [460c4d0]
- Updated dependencies [0ae27f7]
- Updated dependencies [2533ec5]
- Updated dependencies [78c0f9a]
- Updated dependencies [bbe8b86]
- Updated dependencies [8477be5]
- Updated dependencies [279fb13]
- Updated dependencies [2e82ab2]
- Updated dependencies [ad07b65]
- Updated dependencies [41f498b]
- Updated dependencies [ef0d150]
- Updated dependencies [f34226e]
- Updated dependencies [564b605]
- Updated dependencies [e1d4251]
- Updated dependencies [40d3a33]
- Updated dependencies [8b9dc62]
- Updated dependencies [1184192]
- Updated dependencies [a2a9747]
- Updated dependencies [a1609a6]
- Updated dependencies [53f23bc]
- Updated dependencies [c4533dc]
- Updated dependencies [be60815]
- Updated dependencies [37f6844]
- Updated dependencies [93de4f6]
- Updated dependencies [2b50261]
- Updated dependencies [384f30d]
- Updated dependencies [ac600e5]
- Updated dependencies [97fba31]
- Updated dependencies [232f61a]
- Updated dependencies [d374caf]
- Updated dependencies [5673576]
- Updated dependencies [c1ef923]
- Updated dependencies [911ceaa]
- Updated dependencies [98eab36]
- Updated dependencies [af5e292]
- Updated dependencies [3fbbea1]
- Updated dependencies [5458414]
- Updated dependencies [7f96b10]
- Updated dependencies [167ec42]
- Updated dependencies [616a2a5]
- Updated dependencies [0046d8f]
- Updated dependencies [f1d4748]
- Updated dependencies [bea374e]
- Updated dependencies [b1119ec]
- Updated dependencies [9f23d2b]
- Updated dependencies [578e025]
- Updated dependencies [af025ee]
- Updated dependencies [d109a4d]
- Updated dependencies [598c89a]
- Updated dependencies [4a0bd17]
- Updated dependencies [b8b9af4]
- Updated dependencies [31676be]
- Updated dependencies [8c0d52e]
- Updated dependencies [aff10e2]
- Updated dependencies [70a774b]
- Updated dependencies [9ce096f]
- Updated dependencies [e05db88]
- Updated dependencies [7458a41]
- Updated dependencies [ad13d63]
- Updated dependencies [5ffcc14]
- Updated dependencies [d971e51]
- Updated dependencies [97abb24]
- Updated dependencies [deb157a]
- Updated dependencies [9c60144]
- Updated dependencies [d2ce342]
- Updated dependencies [9695da7]
- Updated dependencies [75444e3]
- Updated dependencies [58b8346]
- Updated dependencies [2d0bd16]
- Updated dependencies [a9e17b4]
- Updated dependencies [b8ce7dc]
- Updated dependencies [dad51e5]
- Updated dependencies [1c9c342]
- Updated dependencies [787c738]
- Updated dependencies [8396656]
- Updated dependencies [dbbd38a]
- Updated dependencies [8871c14]
- Updated dependencies [93fe362]
- Updated dependencies [dfc6975]
- Updated dependencies [3cf4de0]
- Updated dependencies [c9dc811]
- Updated dependencies [144ef9b]
- Updated dependencies [138ab04]
- Updated dependencies [a0b9e91]
- Updated dependencies [99bd015]
- Updated dependencies [21e4585]
  - @object-ui/types@17.6.0
  - @object-ui/i18n@17.6.0
  - @object-ui/react@17.6.0
  - @object-ui/components@17.6.0
  - @object-ui/core@17.6.0
  - @object-ui/providers@17.6.0

## 17.5.0

### Minor Changes

- ebb4e0e: The date formatter's last three en-US channels now follow the display locale
  (objectui#4272).

  objectui#4468 (PR #4512) pointed every date _renderer_ at `useDisplayLocale()`.
  Three channels were out of its reach because they are properties of the
  formatter's signature and of its callers rather than of any renderer, so a `zh`
  console still met English dates in three places:

  - **`formatDate`'s `'short'` branch** hardcoded
    `toLocaleDateString('en-US', { month: 'short' })`, so it rendered an English
    month even when the caller had threaded `options.locale` into that very call.
    Its only consumers are ObjectGrid's two mobile-card date cells, which threaded
    no locale — fixing either half alone moves nothing, so both land here.
  - **`formatDateTime` took no options parameter at all**, so no caller could
    localize it however hard it tried; it always handed `Intl` an `undefined` tag,
    which means the MACHINE's locale — neither of the repo's two locale channels.
    The parameter is optional and lands together with its consumers, plugin-gantt's
    four tooltip call sites.
  - **The lookup picker's MongoDB `$date` fallback** called a bare
    `toLocaleDateString()` with no tag.

  One resolver everywhere, as before: `useDisplayLocale()` (tenant regional
  default → active UI language → `'en'`). `Intl` accepts `'zh'` verbatim, so there
  is still no mapping table anywhere.

  English output is byte-identical at every touched site — `en` and `en-US` agree
  on all twelve short month names — and the `'short'` layout itself is unchanged:
  only the month token is localized, the compact `"Jan 15, '24"` shape around it
  is a deliberate fixed layout for narrow cards.

  `@object-ui/fields` is `minor` because `formatDateTime`'s new optional parameter
  is visible in the package's entry `.d.ts`; the plugin packages' own `.d.ts` files
  are byte-identical, so their change is module-local.

- 36310dc: `formatPercent` groups its output and follows the display locale — the last
  tooltip/cell channel (objectui#4553).

  PR #4557 threaded the gantt tooltip's number and currency rows and measured that
  the percent row could not follow: `formatPercent(value, precision)` took no
  locale parameter, and its whole body was
  `${percentDisplayValue(value).toFixed(precision)}%`. It built no
  `Intl.NumberFormat` and never reached `formatDisplayNumber` — so unlike its
  siblings it did not render in the MACHINE's locale, it rendered in **no** locale:
  an ASCII decimal mark, never a grouping separator, byte-identical on every
  machine.

  **English output MOVES, and that is the fix.** Because the function never
  grouped, `1235%` was wrong in en-US too, not only in German. Grouping and locale
  therefore land together:

  |            | before  | after          |
  | ---------- | ------- | -------------- |
  | en, 1234.5 | `1235%` | `1,235%`       |
  | de, 1234.5 | `1235%` | `1.235\u00a0%` |
  | de, 80     | `80%`   | `80\u00a0%`    |

  Values below the grouping threshold are unchanged in English (`80%`, `12.5%`,
  `33.33%`), so the move is confined to four digits and up. German changes at every
  magnitude, because the no-break space before the sign is part of the locale's
  percent convention — which is what routing through `Intl` buys over appending a
  literal `%`.

  The scaling contract is untouched: `percentDisplayValue` still disambiguates a
  fraction-stored percent (`0.8` → 80%) from a whole one, so the list cell and the
  dashboard measure formatter still agree.

  Consumers are threaded in the same change, the parameter never landing
  speculatively:

  - **fields** — `PercentCellRenderer`, on BOTH of its paths. Its whole-percent
    branch (`progress` / `completion` fields, which store 0-100 and must skip the
    fraction scaling) was a second bare `toFixed` call; leaving it behind would
    have made one grid internally inconsistent, so both branches now share one
    locale-aware body and differ only in the scaling policy.
  - **plugin-gantt** — the tooltip percent row, completing objectui#4553's switch.
  - **plugin-grid** — the mobile card's percent cell, which sits in the same
    density row as a date cell objectui#4272 had already localized.
  - **plugin-dashboard** — `renderFieldValue`'s percent branch. It is a plain
    function rather than a component, so it takes the locale as an optional fourth
    parameter beside the `tenantCurrency` already threaded that way, and both of
    its callers pass it and declare it in their memo dependency arrays.

  Bumps follow each package's own `.d.ts` diff, measured in both directions.
  `@object-ui/fields` and `@object-ui/plugin-dashboard` are `minor` on the
  objectui#4272 / PR #4544 precedent — quoted from that changeset: "`@object-ui/fields`
  is `minor` because `formatDateTime`'s new optional parameter is visible in the
  package's entry `.d.ts`; the plugin packages' own `.d.ts` files are
  byte-identical, so their change is module-local." Here `formatPercent` and
  `renderFieldValue` each gain an entry-visible optional parameter, while
  plugin-gantt's and plugin-grid's `.d.ts` files are byte-identical and stay
  `patch`.

- 52d878a: fix(fields): `formatPercent` renders percentage points directly — ties round half-up and extremes keep every digit

  `formatPercent` rendered a value that is already in percentage POINTS through
  `Intl`'s `style: 'percent'`, which expects a FRACTION, so the body divided by
  100 for `Intl` to multiply straight back. That round trip is not
  value-preserving: `Intl` formats from the shortest decimal representation of the
  double it is handed, and the quotient's is not the authored one. A stored
  `1.005` at 2 decimals rendered `1.00%` where half-up on the authored decimal is
  `1.01%`; `1.45` at 1 decimal rendered `1.4%` for `1.5%`. Every case was a
  last-digit off-by-one — the failure mode least likely to be noticed and most
  likely to be trusted.

  The body now renders through `style: 'percentPoints'` with no scaling round
  trip. Measured on this repo's runner (node v22.22.2 / ICU 78.2), 27,577 of
  1,200,003 ordinary en-US forms move (0.005-step grid to 2,000, precisions
  0/1/2), and the same artefact at the top of the double range is gone too:
  `Number.MAX_SAFE_INTEGER` percentage points rendered `9,007,199,254,740,990%`
  and now render `9,007,199,254,740,991%`.

  The locale percent CONVENTION is unchanged — this is a numeral move only.
  `'percentPoints'` is `Intl`'s `style: 'unit'` / `unit: 'percent'`, re-measured on
  this call shape across 720 combinations (10 locales x 18 values x 4 precisions):
  0 convention differences, 130 numeral differences. The no-break space in
  de/fr/ru/sv, Turkish's prefixed sign, Arabic's own percent sign and Bengali's
  digits all render exactly as before. Percent SCALING (a stored fraction below 1
  scaling by 100) is upstream of the render and untouched.

  A percentage point now reads identically in a list cell and in a dashboard
  measure, which `formatMeasure` already rendered this way.

- bb68488: Stop declaring 14 symbols under names `@objectstack/spec` owns at `17.0.0-rc.6`
  (objectui#4167, objectstack#4115).

  The rc.6 bump published nine names this repo already declared locally, on top of
  four that predate it — `check:spec-symbols` reported all thirteen at once, and a
  fourteenth (`GlobalFilterSchema`) appeared during the bump itself. Each was
  triaged on its own rather than blanket-renamed, because the right answer differs
  per symbol: five bind to the spec, three are renamed because the spec's
  same-named export means something else, five arrive by derivation, and one is a
  declared dialect with a written reason.

  **Breaking for importers of `@object-ui/react`, `@object-ui/app-shell` and
  `@object-ui/types`** — three exported names changed, because the spec exports the
  same name for a _different_ thing:

  | package               | was                | now                            | what the spec's same-named export actually is                                                                                                          |
  | :-------------------- | :----------------- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `react` / `app-shell` | `MetadataState`    | `MetadataCacheState`           | a metadata item's LIFECYCLE state — `'draft' \| 'active' \| 'deprecated' \| 'archived'` (`MetadataStateSchema`, `@objectstack/spec/system`)            |
  | `react` / `app-shell` | `resolveI18nLabel` | `resolveKeyedI18nLabel`        | a resolver for the INLINE per-locale map (`{ en: 'Owner', 'zh-CN': '负责人' }`) against a BCP-47 locale                                                |
  | `types`               | `DateRangePreset`  | `FilterBuilderDateRangePreset` | the thirteen HISTORICAL dashboard filter-bar presets; this one is the filter-builder set, which adds eight FUTURE windows the dashboard schema rejects |

  `resolveI18nLabel` is the one where the collision had already started costing
  something. rc.6 widened `I18nLabel` from `string` to
  `string | Record< string, string >`, so the same authored value now reaches
  either resolver — and each answers wrongly, silently, for the other's input: the
  keyed one returns `undefined` for `{ en: 'Owner' }` (no `key`, no
  `defaultValue`), and the spec's reads `key` / `defaultValue` / `params` as locale
  tags. The rc.6 bump PR met this and aliased the spec's import as
  `resolveInlineI18nLabel` in five files, with hand-written comments at two of
  them. That is a review convention, which is what objectstack#4115 exists to
  replace with a rule — so `Keyed` is now the counterpart of that `Inline`, and the
  name says which vocabulary it resolves at every call site.

  **Eleven keep their names and are now imported or derived from the spec** instead
  of re-declared: `DATE_RANGE_PRESETS`, `NavigationMode`, `AddressValue`,
  `BreakpointColumnMap`, `BreakpointOrderMap`, `KanbanConfig`, `CalendarConfig`,
  `GanttConfig`, plus the three renamed above at their new names.

  **Four of the copies were losing information, not just duplicating it.**

  - **`GanttConfig` declared six keys and called itself canonical; rc.6's
    `GanttConfigSchema` declares seventeen.** The eleven it never mentioned —
    `parentField`, `typeField`, `baselineStartField`, `baselineEndField`,
    `groupByField`, `resourceView`, `assigneeField`, `effortField`, `capacity`,
    `quickFilters`, `autoZoomToFilter` — are all read by
    `plugin-gantt/src/ObjectGantt.tsx`, through a local `GanttConfigEx`
    intersection that existed only because this type did not carry them. It now
    derives from the spec, with `timeSegments` (shift segmentation) as the one
    genuinely local extension; the schema is `$loose` upstream, so that key is
    legal metadata rather than a second dialect.
  - **`GanttConfig.tooltipFields` carried the comment "not part of the upstream
    GanttConfigSchema".** It is, as of rc.6, so the key now arrives from the spec.
  - **`AddressValue` declared five of the spec's seven parts** — `countryCode` and
    `formatted` were missing, under a comment already claiming to be "the part
    names of `AddressSchema`". The widget still renders five inputs; binding the
    type stops it from asserting the platform cannot store the other two, and makes
    the `{ ...address }` write-through say so.
  - **`DATE_RANGE_PRESETS` was `Object.keys(PRESET_RANGES)`,** a third copy of a
    vocabulary the spec extracted in objectstack#4614 precisely to collapse — its
    own doc comment names this module as one of the three. It is now the spec's
    array by reference, and the local date-macro bounds table is pinned complete
    against it with `satisfies`, so a preset the schema gains without bounds here
    is a compile error rather than a filter that validates clean and then selects
    nothing.

  `NavigationMode` was one hop from the spec already (`NavigationConfig['mode']`);
  it is bound directly, with a both-directions type pin that it stays the same type
  as the config's own `mode`. `KanbanConfig` / `CalendarConfig` /
  `BreakpointColumnMap` / `BreakpointOrderMap` were exact hand copies of `$strict`
  schemas and are now re-exports — "still exact" is the argument for binding them,
  since a copy with nothing to protect can only drift.

  `GlobalFilterSchema` is the one ALLOW entry. It is the same spread-composition
  dialect as `SelectOptionSchema` next to it, and it collided only because rc.6's
  new refinement forced `.extend()` to be respelled as a `.shape` spread — which
  moved a derivation the guard could see into an object literal it deliberately
  does not descend into. The dialect is unchanged and its three divergences are
  pinned; which side moves on the refinement itself is objectui#4165.

  `@objectstack/spec` moves from `devDependencies` to `dependencies` in
  `@object-ui/layout`: its public type surface now references the spec.

### Patch Changes

- e2e6360: A `Field.address` value now reads as a formatted postal address on the record detail page, instead of stringified JSON.

  The display (read) registry mapped `address` straight to `JsonCellRenderer`, so a populated address rendered as `{"street":"中策路 1 号","city":"杭州",…}` — while a `location` field sitting next to it in the same field group rendered formatted, and the create/edit dialog rendered the very same value as proper Street / City / State / ZIP / Country inputs. The gap was display-side only: the input registry has always carried `address`. Both read surfaces the detail page exposes are affected and both are fixed, because they share one `displayValue` path — read mode, and the inline-edit read state (the row carrying the pencil affordance, before a field is actually being edited).

  Layout is not invented for the read side. `AddressField`'s readonly branch already collapsed a stored address to a single line, and that rule — `Street, City, State ZIP, Country`, with `state` and the postal code sharing one comma group — is now the _only_ implementation, moved into a pure `address-format` module that both surfaces call. A readonly form and a detail page therefore cannot spell one stored address two ways; a second copy next to the renderer would have been a rule that drifts. The module is deliberately React-free, so the eagerly-loaded barrel can format a cell without pulling `AddressField` and its inputs out of the lazy widget chunk.

  Partial values degrade the way the readonly line already did: absent, non-string and whitespace-only parts are dropped rather than spaced over, so a street-only address renders as `中策路 1 号` and never as `, , ,` or as the string `undefined`. Legacy records whose postal code was written under `zipCode` (objectstack#5143) still render it, matching what the input widget reads.

  Nothing is silently swallowed by the change: a value the formatter cannot recognize — an object carrying no known part — keeps today's compact-JSON rendering rather than disappearing, and `{}` or a null value shows the usual empty placeholder. A plain string address passes straight through. `location`, `geolocation`, and the genuinely structural `json` / `object` types are untouched.

  The address _input_ is unchanged on every surface, including the create/edit dialog.

- dde7283: `chatbot` and `chatbot-enhanced` now pass only whitelisted DOM props to their host element (objectui#4431)

  Both registrations destructured `schema` and `className` and forwarded everything else. `SchemaRenderer` hands a registered component the authored node's own keys, the contents of its `props` container, the ARIA it resolved and the host's trailing props — so all of it became attributes on the chat root `div`, because React passes unknown lowercase attributes through in silence and stringifies object values. Measured through the real SDUI path with a data-source adapter attached: **14 non-DOM attributes on each widget**, including `datasource="[object Object]"` (the injected adapter, which only appears on a deployment that really loads data) and a camelCase `arialabel` sitting next to the resolved `aria-label`, so the element carried each ARIA value twice under two spellings — one of them meaningless to assistive technology.

  Both are now consume-or-whitelist: configuration is read off `schema` as before, the evaluated `disabled` verdict is consumed by name, and only `toDomProps`' output reaches the element. The resolved `aria-label` / `aria-describedby`, `role`, `id`, `tabIndex` and the `data-*` family still arrive — dropping them would have been an accessibility regression dressed as a leak fix, so the pin asserts the delivered set exactly, not just the absent one. `chatbot-floating` is untouched: its content mounts through a portal and its root never spread.

  `@object-ui/core` gains the shared executor this migration needs (`utils/dom-props.ts`): `toDomProps` for the SDUI widget contract, plus `pickDomProps` — the mechanism — for a package whose own contract declares a different key set. That is the objectui#4409 dependency direction: plugin packages declare `@object-ui/core` and must not grow a dependency on `@object-ui/fields` to reach a whitelist.

  `@object-ui/fields` keeps its own key list and its compile-time bindings, and now executes them through core's mechanism. Its behaviour is unchanged and its exported `DomProps<P>` is the same structural type. The two lists differ for measured reasons and no longer can drift silently: `name` and `disabled` are legal only on form controls, which is what every field widget renders and what `FieldWidgetComponentProps` declares, while `role` is resolved by `SchemaRenderer` for every SDUI node and is not part of the field contract. A new assertion binds every shared key in both directions, with `role` named as the single deliberate exception.

- 0f21348: Currency amounts now follow each currency's own ISO 4217 fraction-digit
  convention instead of a hardcoded 2 (objectui#4361).

  Both currency formatting paths in `@object-ui/fields` picked a fraction-digit
  width and handed it to `Intl.NumberFormat`, which OVERRIDES the digit count
  `Intl` already knows for the currency being rendered. `formatCurrency` derived
  its width from the VALUE's wholeness alone (`isWhole ? 0 : 2` — a literal 2 for
  every currency on earth), and `CurrencyField` defaulted an undeclared
  `precision` to the same literal. So a yen amount was printed with cents the
  currency does not have and a dinar amount with one digit fewer than it does:

  |              | before         | after       |
  | ------------ | -------------- | ----------- |
  | JPY `1234.5` | `¥1,234.50`    | `¥1,235`    |
  | KWD `1.5`    | `KWD 1.50`     | `KWD 1.500` |
  | CLP `1234.5` | `CLP 1,234.50` | `CLP 1,235` |
  | BHD `2.5`    | `BHD 2.50`     | `BHD 2.500` |
  | USD `1234.5` | `$1,234.50`    | `$1,234.50` |
  | USD `1234`   | `$1,234`       | `$1,234`    |

  Both call sites now derive the width from the currency itself
  (`Intl.NumberFormat(undefined, { style: 'currency', currency })
.resolvedOptions().maximumFractionDigits`, memoized per code) and switch
  wholeness against THAT.

  **The whole-number convention is extended, not retired.** Simply dropping both
  bounds and letting `Intl` decide would have fixed the digit count while turning
  `$1,234` back into `$1,234.00` — the Salesforce convention `formatCurrency`
  documents and objectui#4033 pinned. A whole amount still drops the fraction, now
  for every currency: `KWD 1` renders `KWD 1`, not `KWD 1.000`. Two-decimal
  currencies are byte-identical to before, which is why the objectui#4033 and
  objectui#4332 pins pass unchanged.

  **On `CurrencyField`, an explicitly authored `precision` still wins** — it is
  authored metadata and authored metadata keeps priority, so a JPY field declaring
  `precision: 2` still renders `¥1,234.50`. Only an ABSENT `precision` derives from
  the currency; because that derivation is the widget's one precision, it also
  reaches the spinner `step` and the blur rounding, so a JPY field no longer offers
  a `0.01` step for a currency with no minor unit. Whether a declared `precision`
  that contradicts the currency's ISO 4217 digits should be REJECTED at publish
  time is a contract question, filed upstream in `@objectstack/spec` rather than
  answered here by overriding the author.

  Reachable wherever the resolved currency is not a 2-decimal one — the field's
  `currency`, `currencyConfig.defaultCurrency`, or the tenant default (ADR-0053).

- d2e2caf: fix(fields): `formatCurrency` keeps both cents digits on a fractional amount

  The symbol branch passed `minimumFractionDigits: 0` against a
  wholeness-switched `maximumFractionDigits`, which handed `Intl` the range
  `[0, 2]` — and `Intl` emits the shortest representation in range, so a real
  cents value of `.50` was printed as `.5`. Any price ending in a zero cent digit
  rendered one digit short: `$1,234.50` as `$1,234.5`, `$19.90` as `$19.9`,
  `$0.50` as `$0.5` — money on a record page and in grid cells reading as a data
  error rather than a formatting one.

  Both bounds now take the same wholeness-switched width, so the function
  delivers the contract its own doc comment states: a fractional amount shows
  exactly two digits, a whole amount still drops `.00` (`$1,234`). The
  no-currency branch and the bad-currency fallback already behaved this way; only
  the symbol branch disagreed.

  Reaches every consumer of the shared helper: `CurrencyCellRenderer`,
  `ObjectGrid`, the dashboard `recordFields` and `ObjectGantt`.

- 3a9021e: fields: the currency adornment has one symbol channel

  `CurrencyField` carried the same one-entry fact twice — a dead `CURRENCY_SYMBOLS`
  map that nothing read, and a live `currency === 'USD' ? '$' : currency` ternary
  two lines below it. Both were hand copies of knowledge `Intl` already carries,
  and both are gone: a new `currencySymbol(currency, locale)` beside
  `currencyFractionDigits()` reads the `currency` part of the very format the
  widget's readonly branch already renders amounts with.

  USD is unchanged at the display-locale default. Other currencies now show their
  real symbol instead of the bare ISO code — `€` for EUR, `¥` for JPY, `£` for
  GBP — which is what the same widget's readonly mode has always displayed; the
  edit adornment simply stopped disagreeing with it. Currencies CLDR has no symbol
  for (KWD, BHD, CHF, ISK, CLP) still render their code, exactly as before.

- 8f60d73: `@object-ui/fields` and `@object-ui/plugin-editor` stop publishing their test declarations

  Both packages' build tsconfigs set `include: ["src"]` with no test exclude, so every test file entered the declaration program and its `.d.ts` was written into `dist/`. Both are published (`private` is false, `files` contains `dist`), so those declarations shipped: 85 from `@object-ui/fields` and one from `@object-ui/plugin-editor`. Adding the test exclude the other twenty-odd packages already use removes them.

  Nothing else about either artifact moves. Measured by building each package both ways from a cleared `dist/`, then diffing the file lists: `@object-ui/fields` goes from 163 files to 78 and `@object-ui/plugin-editor` from 6 to 5, every one of the 86 disappearances is a `*.test.d.ts`, no file appears, and all 83 surviving files are byte-identical by sha256 — including each package's entry `dist/index.d.ts`. The entry type surface is therefore unchanged and no import can break; this is the tarball shedding files nothing resolved.

  The type coverage those files were a side effect of did not go with them. Because the build program read the tests, these two packages counted as "tests type-checked" in `scripts/check-type-check-coverage.mjs` — a correct verdict reached through an emit nobody wanted. Excluding the tests alone would have silently dropped 86 test files out of every `tsc` program, so the same change adds a `tsconfig.test.json` per package, chained from each package's `type-check` script, and the coverage gate stays at 41 of 41 packages compiling their tests with zero declared debt on both sides of the change.

- cb13400: One fullscreen long-text editor, hoisted to the package both render paths may import

  The "expand to a full-height dialog" interaction had two independent implementations. `FullscreenTextarea` lived inside the form renderer's built-in (unregistered) `textarea` branch in `@object-ui/components`; `FullscreenFieldEditor` lived in `@object-ui/fields` and served the registered `TextAreaField` / `RichTextField` widgets. They exist because ONE form-level promise — `ObjectFormSchema.mobile.fullscreenLongText`, projected onto every long-text field as `mobile_fullscreen` — is honoured on two render paths, and each path grew its own answer.

  Two copies of a state machine drift, and these did, in both directions: objectui#3400 measured a read-only long-text field that was fully editable through the built-in branch's dialog (and "Done" wrote the edit into form state), objectui#3402 measured the same write-back hole for `disabled` on the registered path, and objectui#3393 (the dialog title needs the field label) and objectui#3272 (the copy needs i18n) each landed on one side before the other. Every repair was correct and none of them scaled.

  `@object-ui/components` now exports `FullscreenEditor`, a single primitive owning the affordance, the dialog, the draft/commit state machine and the copy. The direction follows the measured import graph rather than fighting it: `@object-ui/fields` depends on `@object-ui/components`, and `components` declares no dependency on `fields` in either `dependencies` or `peerDependencies`, so the shared code can only live in `components`. `FullscreenFieldEditor` becomes a thin wrapper over it and keeps its name, its props and its test-id namespaces, so both hosts and their pins are unchanged.

  The load-bearing part of the merge is that the primitive DEFINES `readOnly` and `disabled` instead of inheriting them by accident. Neither copy defined both: the built-in one grew them under objectui#3400, while the fields one declared only `disabled` and was shielded from `readonly` by its hosts' early return — a single implementation cannot be shielded by one caller's control flow. So both are answered once, and both call paths inherit the same answers: `readOnly` renders no affordance at all (it means "shown plainly", so advertising an expand button the user cannot use is worse than showing none), `disabled` leaves an inert one (it means "not interactive, muted"). Neither relies on the toggle alone, because `disabled` also carries the form's `isSubmitting` and can flip to true while the dialog is already open — so opening refuses independently of the attribute, the injected editor is told, "Done" is disabled, and `onCommit` is gated as the single point where a value leaves for host state.

  No copy changed and no locale pack needed an edit: the primitive consumes the same `form.fullscreen.*` / `common.cancel` keys both copies already read, through `createSafeTranslation` with English defaults byte-identical to the literals, so provider-less hosts render exactly what they did. The now-unread `form.fullscreen.*` defaults are dropped from `useFieldTranslation`, where they would have re-created in the defaults map precisely the duplication this change removes from the components.

  `toggleClassName` is not carried into the new primitive. It was declared on `FullscreenFieldEditorProps` and written by nobody — zero producers repo-wide — and `FullscreenFieldEditor` is not exported from the `@object-ui/fields` barrel, so no consumer outside the package could ever have set it. Minting it as part of a NEW public export in `@object-ui/components` would have published a prop with no producer, the shape objectui#3232/#3233 keeps deleting.

- bc64bfe: A dependency-gated option list no longer deletes the field's stored value on mount

  The four fixed-option widgets (`SelectField`, `MultiSelectField`, `CheckboxesField`, `RadioField`) end their cascade resolution with a "drop what is no longer offered" effect, and the form renderer runs an equivalent clear of its own over every option field. Both read `resolveCascadingOptions`, which returns an **empty** offered set whenever the list is _gated_ — a declared `dependsOn` parent is still empty. Nothing the field held could be "still offered" against an empty set, so both paths wrote the field empty **on mount, with no interaction**, while the control rendered "Select Country first" beside it: it told the user it could not offer anything, and deleted what they had.

  Gated means **unknown**, not invalid. The cascade clear exists (ADR-0058) so a user-driven parent change prunes a now-invalid child; a withheld list on mount is missing information — the record simply arrived with its controlling field empty (a later-cleared parent, an import, a partially-migrated row) — and that is not a reason to destroy stored data. Both clears now skip while gated, reading the resolver's own `gated` flag rather than re-deriving it from an empty offered set, which would collide with the distinct never-configured case guarded separately in objectui#4220.

  Convergence stays exactly where it belongs: once the parent **is** chosen and the resolved set genuinely excludes the stored value, the prune applies unchanged — including at the moment the gate lifts, so picking a parent whose list does not contain the old value still clears it on that transition. The three states are pinned apart (never-configured / gated / resolved-and-excludes) across all four widgets and the form host, so a future edit cannot collapse them back into one empty-set test.

  Reachable on every host that mounts these widgets with a live record: the form renderer, the grid's inline cell editor, and the detail page's inline editor — where each `onChange` went straight into the record draft the save bar commits.

- 3e19fe7: i18n copy: one ellipsis glyph across the ten packs, `usted` in the es draft-preview empty state, and a pt sentence that stops contracting `de` onto its own hole

  Three locale-copy defects that no gate could see, because all three are _value_ defects on keys whose names, placeholders and key sets were already correct.

  **One ellipsis (objectui#3878).** `en` ended 33 values with three ASCII full stops (`Loading...`, `Ask anything...`) and 110 with the typographic ellipsis `…`, and the nine translation packs had copied `en` value by value — so a user could read both glyphs on one screen: `common.loading` beside `dashboard.loading`, `console.ai.askAnything` beside its own panel's siblings. All ten packs now spell it `…` (U+2026), per the maintainer-authorized consistency pass registered on objectstack#6015. 312 pack values changed: 34 in `en` (the 33 trailing plus the one mid-sentence `collaboration.commentPlaceholder`) and 278 across the nine. Eleven inline `defaultValue` call sites were re-synchronised with the new `en` text, which `scripts/check-i18n-call-site-keys.mjs` requires byte-for-byte.

  The convention is now pinned so the split cannot regrow: `packages/i18n/src/__tests__/ellipsis-glyph-3878.test.ts` fails, by key name, on any value in any of the ten packs that holds three ASCII full stops. It is deliberately wider than "a trailing `...` in `en`", because the census showed the narrow rule would have shipped with two holes in it — `collaboration.commentPlaceholder` puts the ellipsis mid-sentence, and `list.loading` had the packs wrong while `en` was already right, which no `en`-only rule can see.

  Fifteen module-local **no-provider fallback** entries were moved with the packs, across `useCollaborationTranslation`, `useFieldTranslation`, `useDetailTranslation`, `ObjectGrid`, `KanbanImpl`, `data-table` and `ConnectionStatus`. Those maps exist to render when no `LocalizationProvider` is mounted, and each one's own docblock requires it to stay byte-identical to the `en` pack — a requirement objectui#3440 already enforces mechanically for the collaboration map. Leaving them behind would have made the provider-less path disagree with the provider path on ten keys.

  **es `usted` (objectui#3875).** `preview.empty.notReadyDescription` said `Revisa la conversación` — the tú imperative — in a namespace that is otherwise 23:1 usted, and it renders _underneath the usted draft-preview banner at the same moment_, not before or after it. `Revisa` → `Revise`; nothing else in the sentence carries a register. The neighbouring `approvalsInbox` namespace is legitimately tú and was left alone.

  **pt contraction (objectui#3877).** `ConcurrentUpdateDialog` splits `detail.concurrentUpdateDescription` on `{{field}}` and renders a bolded label in the gap, and pt left a bare `de` in front of that gap. When the multi-field conflict branch passes the record label (`este registro`), Portuguese users read `de este registro` — a contraction error every native speaker sees, and one that no spelling of the leaf value could fix (`deste registro` renders `de deste registro`). The pt sentence is rewritten so the hole is preceded by the verb `afeta` instead of any preposition, which closes the whole class rather than trading `de` for an `em` or `a` that contract just as hard. pt only; `en` is unchanged.

  No behavior, no keys added or removed, no placeholder changed.

- bb58d1d: i18n: the two search placeholders become pack values, and four values the packs served in English get translated

  **objectui#4375** — `ListView` and `LookupField` built their search placeholder as
  `t(key) + '...'`, so the ellipsis was a literal concatenated in code: it stayed ASCII
  in all ten locales on screens where objectui#3878 had converged everything else on
  U+2026, and no pack could opt out of it (sharpest in `ar`, where a left-to-right run
  was appended to right-to-left text). Both now read `table.search`, which is already
  the repo's search-input placeholder key — `data-table`, `RecordPickerDialog` and
  `PeoplePicker` render it too — and is translated with the right ellipsis in all ten
  packs. No new keys.

  **objectui#4376** — `list.loading` served the English `Loading records…` in eight of
  the nine translation packs (`zh` alone had translated it); `designer.undo` and
  `designer.redo` were English in all nine; `appDesigner.snakeCaseHint` in `ko`, `pt`,
  `ru` and `ar`. All translated, reusing each pack's own established vocabulary. A new
  pin (`untranslated-identity-4376.test.ts`) fails on any value byte-identical to `en`
  inside a non-Latin pack unless the key is on an explicit 22-entry allowlist.

- 433ff9f: An image field's declared `maxSize` is enforced before the upload starts, not after it finishes

  `ImageField` received a `maxSize` and ignored it. `paramToField` copies `maxSize` onto the field config for every action param regardless of type, so an image param declared with a 5 MB limit handed the widget its constraint and the widget uploaded anyway: a 6.3 MB PNG fired the full `presigned → PUT → complete` chain and rendered a thumbnail, with no rejection anywhere. The sibling file param, declared the same way, refused the identical pick without a single request. Reported from a QA run driving the two side by side (objectui#4141).

  Both of the widget's upload doors now check the limit first. The native picker rejects oversize picks before any request, keeping FileField's partial-acceptance rule — the in-limit members of a multi-select still upload, and only the oversize ones are reported. The crop dialog is the second door and needed the check in its own right: the cropper re-encodes to PNG, so cropping an in-limit JPEG can produce a blob _over_ the limit, and it is the crop's size that is uploaded. A rejected pick or crop now surfaces the same message the file widget has always shown, in a new error row — this widget had no surface for rejections before, because it never rejected anything.

  The guard itself moved into one shared `maxSizeError` helper that both widgets call, rather than a second copy living in the image widget. The check is the only thing between a declared limit and a real upload, and a per-widget copy is what let these two drift apart unnoticed in the first place. Both widgets also share the existing `fields.file.exceedsMaxSize` message: it names a file and a limit, says nothing file-specific, and is already translated in all built-in locales, so no new key was added and no translation is pending. FileField's own behavior is unchanged — same threshold, same message, same partial acceptance.

  An undeclared `maxSize` still means unrestricted; the falsy check is preserved deliberately, so a missing limit can never be read as a zero-byte one.

- e7663f2: fix(detail): inline edit no longer destroys array values or flattens types on the record page

  `InlineFieldInput`'s type switch ended in a raw text input, and every type it had
  no branch for landed there: the value was displayed through `coerceToSafeValue`
  and written back as whatever the user typed — a bare string.

  Two damage classes survived the earlier passes. Array-valued fields (`tags`,
  `checkboxes`, an options-less multi picklist) were offered for editing as
  `"a, b"` — `coerceToSafeValue` joins arrays — and saved back as that string, so
  the array was gone. Type-lossy scalars (`toggle`, `slider`, `progress`,
  `rating`, `radio`) round-tripped through `String()`, so a boolean column
  received `"true"`, a numeric one `"42"`, and `radio` accepted any free-typed
  value its option list never offered.

  Types the switch already routes keep their editors. Everything else that the
  fields package can edit inline now falls back to `FieldEditWidget` — the same
  control the form renders, `json` → the code editor included — and only genuinely
  string-valued types (`text`, `textarea`, `email`, `phone`, `url`) keep the plain
  input. A drift guard asserts every field type is exactly one of routed /
  excluded / delegated / benign, so a new type can no longer inherit the
  value-destroying default in silence.

  `@object-ui/fields`: the four fixed-option widgets no longer clear the stored
  value when the field declares no `options` at all. An empty offered set had two
  opposite causes — a list that cascaded to zero (clear) and a list that was never
  authored (nothing to decide) — and the second deleted the value on mount, which
  the grid's inline cell editor has always been able to trigger. `FieldEditWidget`
  also forwards `autoFocus` to the widget it renders.

- b953a97: fix(detail): lookup field values link to the referenced record

  A valued lookup on a record detail page rendered as plain text plus a copy
  button — the referenced document's name was visible but unreachable, so users
  copied the number and searched for it from the list page instead. Lookup cells
  inside a related list that pointed at a third object were dead the same way.

  `LookupCellRenderer` — the one cell renderer both surfaces resolve through —
  now renders the display value as a link to the referenced record. The display
  name resolution, the copy affordance and every non-lookup field are unchanged,
  and a lookup with no value still renders its placeholder rather than an empty
  link.

  The URL is not assembled in the renderer. `RelatedRecordActionsContext` gains
  an optional `recordHref` / `openRecord` pair, published by the console's
  `RelatedRecordActionsBridge` from the SAME builder its related-list row
  navigation already used, so there is one record-route shape rather than a
  second one. A host that does not provide it (Studio designer, embedded
  renderers, standalone grids) renders exactly what it rendered before.

- 45e1949: Numbers render in the user's locale, and a `Field.number` year is no longer `2,026`

  Every numeric field the console rendered went through an `Intl.NumberFormat` built with the locale hardcoded to `en-US` and `useGrouping` never set. Two defects rode in that one construction: a `zh-CN` or `de-DE` console still grouped and pointed decimals the US way, and a four-digit **year** stored as `Field.number({ scale: 0 })` rendered as `2,026` — in every locale, with no field property able to turn it off. Apps had been converting year columns to `Field.text` to escape it, permanently trading numeric comparison, range filters and dataset dimension types for a display detail.

  The construction had been copied into five places — the number cell renderer, the currency cell renderer, the `CurrencyField` widget, the compact `formatNumber` helper, and the dashboard `MetricWidget` — so fixing any one surface never changed the answer. They now share one formatter, `formatDisplayNumber` in `@object-ui/i18n`, which owns the locale and the grouping policy together, plus one locale resolver, `useDisplayLocale`.

  `useDisplayLocale` composes the two locale channels this repo already had rather than adding a third: the tenant's regional default (`useLocalization().locale`, ADR-0053) when an org has configured one, otherwise the active UI language (`useObjectTranslation().language`) so grouping and decimal marks follow a language switch. That second step is what covers the case the report was measured in — a fresh database, where the tenant localization endpoint has no locale to give.

  Grouping is now suppressed when a field declares `scale: 0` and carries no currency, which is what makes years, fiscal periods and other ordinals render plainly. This is an **interim default** with an accepted cost: a large scale-0 _count_ loses its separators too. It holds only until the spec gains an authorable presentation hint, which is being specified separately, contract-first; when that lands it overrides this heuristic.

  Three surfaces deliberately keep their separators, because a zero-decimal display there does not come from a field declaration: the dashboard `MetricWidget` (its decimals are parsed from a numeral.js format pattern, and its own contract calls the separators load-bearing — "`1,930,000` not `1930000`"), the `element:number` aggregate renderer, and every currency path including amounts whose currency code could not be resolved. An **undeclared** `scale` also keeps grouping — absent means "decimals unknown", not "integer".

  `formatCurrency`, `formatCompactCurrency` and `formatNumber` each take a new optional trailing `locale` argument. Existing calls are unaffected; omitting it now follows the runtime default rather than forcing US conventions.

- ac853ce: i18n: retire the reader-less `common.search` key from all ten locale packs

  `common.search` (`Search`, no ellipsis) had exactly one consumer: `LookupField`
  built its dialog placeholder by concatenating the key with three ASCII full
  stops. objectui#4375 / PR #4391 retired that concatenation — the placeholder is
  the reused `table.search` pack value (`Search…`, one U+2026 glyph), which is what
  brought it under objectui#3878's glyph pin. That left `common.search` with zero
  readers repo-wide while it still existed in all ten packs.

  Re-verified before deleting, repo-wide: no `t()` call site in any package or app,
  no MDX or JSON reference, and the one dynamic template-literal reader of the
  `common` namespace takes a two-member union parameter (`'openChat' |
'closeChat'`) that cannot resolve to it. No user-visible string changes — this key never rendered.

  The dormant copy in `@object-ui/fields`' no-provider fallback table
  (`useFieldTranslation.ts`'s `FIELD_DEFAULTS`) goes with it. That table is a
  module-local `Record<string, string>` read only when no `LocalizationProvider`
  is mounted; it is not exported, so removing an entry no reader asks for changes
  no rendered output and narrows no public type. Hence patch for that package,
  while the pack change is a minor: deleting a key from `en` narrows the exported
  `TranslationKeys` type (`typeof en`), so code indexing `TranslationKeys` at
  `common.search` stops type-checking. Same grading, for the same reason, as
  objectui#4145's `report.editor.*` retirement. No runtime consumer existed to
  break.

  Retiring a key from `common` was the ruled decision on objectui#4392 rather than
  keeping it as vocabulary: nothing pins a dormant key's meaning, so its next
  reader inherits an unreviewed contract, and a dormant key beside a live
  `table.search` is where a second dialect gets started. The objectui#4328
  dead-surface family has consistently chosen removal for zero-consumer surfaces.

  The neighbouring `common.select` (minted one commit earlier by objectui#4386 /
  PR #4397) is a different key and is untouched.

  A negative pin (`packages/i18n/src/__tests__/common-search-retired-4392.test.ts`)
  fails if the key returns to any pack, if any package reads or re-declares it, or
  if a dynamic `common.*` reader grows a `search` member — every existing i18n gate
  runs call site to key, and none of them can see a key with no call site.

- 06915b0: fix(i18n): every date branch threads the active locale, so a `zh` session no longer renders half its dates in English

  Date rendering had two locale channels and only one followed the user's
  language, so the same row could read `逾期 6 天` in one column and `In 3 days`
  in the next, with a datetime column showing `8/11/2026 12:00 am`
  (objectui#4468).

  The overdue phrase resolves through the translate fn (the active UI language),
  while every `Intl` branch took its tag from the raw tenant locale
  (`useLocalization().locale`) — which is `undefined` on any workspace that never
  configured one, and `undefined` makes `Intl` use the _machine's_ locale.
  `DateTimeCellRenderer` passed no tag at all.

  Every date-formatting site in `@object-ui/fields` now resolves through the one
  existing channel, `useDisplayLocale()` (tenant regional default → active UI
  language → `en`): `DateCellRenderer` (relative past, relative future, near-today
  and the beyond-±7-days absolute fallback), `DateTimeCellRenderer`, the read-only
  `DateField` / `DateTimeField` / `FormulaField` faces, and the sub-grid's
  temporal cells. English output is unchanged, and the already-localized overdue
  wording is untouched.

  No public signature changed. `@object-ui/i18n` carries a documentation
  correction only: `useDisplayLocale`'s docstring claimed `DateCellRenderer`
  already formatted from this channel, which was the very thing that was not true.

- Updated dependencies [0e67b53]
- Updated dependencies [ceccdcf]
- Updated dependencies [d6e5124]
- Updated dependencies [debad27]
- Updated dependencies [dc2aa3e]
- Updated dependencies [ee66e2e]
- Updated dependencies [ee26e65]
- Updated dependencies [5900ac5]
- Updated dependencies [932cbcd]
- Updated dependencies [734d186]
- Updated dependencies [f650253]
- Updated dependencies [3d9769a]
- Updated dependencies [8f85f8b]
- Updated dependencies [d0c3b26]
- Updated dependencies [3fc2971]
- Updated dependencies [aca27fa]
- Updated dependencies [dde7283]
- Updated dependencies [f7c6430]
- Updated dependencies [4dadf0d]
- Updated dependencies [ae10a01]
- Updated dependencies [92876f0]
- Updated dependencies [f279deb]
- Updated dependencies [4b70d28]
- Updated dependencies [eb7f586]
- Updated dependencies [e901131]
- Updated dependencies [d9d3463]
- Updated dependencies [2a40f69]
- Updated dependencies [bec3e14]
- Updated dependencies [613b167]
- Updated dependencies [b4d3c22]
- Updated dependencies [1f9b905]
- Updated dependencies [cb13400]
- Updated dependencies [828549a]
- Updated dependencies [e1ade8f]
- Updated dependencies [bc64bfe]
- Updated dependencies [abb0f81]
- Updated dependencies [38ab505]
- Updated dependencies [3e19fe7]
- Updated dependencies [bb58d1d]
- Updated dependencies [5cc847c]
- Updated dependencies [fa21254]
- Updated dependencies [33c32bf]
- Updated dependencies [66fb4fa]
- Updated dependencies [b953a97]
- Updated dependencies [d7f3e30]
- Updated dependencies [6d641c9]
- Updated dependencies [7e4f0e5]
- Updated dependencies [a84385b]
- Updated dependencies [45e1949]
- Updated dependencies [92250d6]
- Updated dependencies [c1d939f]
- Updated dependencies [58bebf6]
- Updated dependencies [405e808]
- Updated dependencies [49ae9f4]
- Updated dependencies [a3ae404]
- Updated dependencies [bfdf3d4]
- Updated dependencies [bb68488]
- Updated dependencies [c0f9a4b]
- Updated dependencies [b1e42d0]
- Updated dependencies [2459a3e]
- Updated dependencies [ac853ce]
- Updated dependencies [fa51109]
- Updated dependencies [d6aa172]
- Updated dependencies [fe52a04]
- Updated dependencies [d46f9b8]
- Updated dependencies [3f5f87c]
- Updated dependencies [2fea4d2]
- Updated dependencies [f5e1143]
- Updated dependencies [7f1cb33]
- Updated dependencies [f148a64]
- Updated dependencies [bb68488]
- Updated dependencies [2e3b0c0]
- Updated dependencies [9461dd3]
- Updated dependencies [78fa331]
- Updated dependencies [47f551b]
- Updated dependencies [31ab1ac]
- Updated dependencies [0082db8]
- Updated dependencies [ab04728]
- Updated dependencies [5bf09fd]
- Updated dependencies [06915b0]
- Updated dependencies [ff84b05]
  - @object-ui/i18n@17.5.0
  - @object-ui/react@17.5.0
  - @object-ui/components@17.5.0
  - @object-ui/core@17.5.0
  - @object-ui/types@17.5.0
  - @object-ui/providers@17.5.0

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

- 65bb513: fields: remove the docs-demo registration path (`registerFields` + `createFieldRenderer`), and host the docs field examples in a real form

  **Breaking (shipped as `minor` per AGENTS.md §版本号策略 — objectui's major tracks `@objectstack`, so the repo's own breaking changes are `minor` with the break spelled out here):** two public exports are removed from `@object-ui/fields`:

  - `registerFields()` — registered every widget under the same `field:<type>` keys as `registerAllFields()`, but wrapped in a demo-only renderer. Two paths writing the same registry keys meant whoever ran LAST won it for every consumer sharing the registry.
  - `createFieldRenderer()` — that wrapper. It synthesized a `label`, a description, and a local `useState`/`onChange` around a widget.

  **Migration:** there is nothing to migrate for an application. `registerAllFields()` runs on import of `@object-ui/fields` and is the one registration seam (`registerField(type)` for a single type); no shipped application ever called the removed pair — the docs site was the only caller. Code that rendered a **bare field node** standalone (`{ type: 'currency', label: 'Amount' }`) and relied on the wrapper for label and value state must host the field in a form instead: `{ type: 'form', fields: [{ name: 'amount', label: 'Amount', type: 'currency' }] }`. Seed values through the form's `defaultValues`, not a field-level `value`.

  **Why the removal rather than a relocation** (ruling B of objectui#3798, confirmed by the maintainer; objectui#3308 is the origin, PR #3793 the safety net that first corrected the misleading `@deprecated` note): the wrapper existed only so the documentation could render a bare field node as a labelled, editable input. No application produces that rendering — on the live path a bare field node has no host for its label or its value. So the field docs, which are a first-hand transcription source for AI authors, were teaching a shape that does not work, and an author copying it got a node with neither label nor `onChange`. Relocating the wrapper into the docs site would have preserved that divergence under a new owner. Hosting the examples in a real form removes the reason for the wrapper to exist: the form renderer already owns label and value state, so the docs can only show what an application actually renders.

  The 74 bare-node examples under `examples/schema-catalog/src/schemas/fields-*` are now form-hosted (the other 2 already were). A field's `value` moved to the form's `defaultValues`, because the form renderer spreads react-hook-form's state after the schema props and a field-level `value` is therefore ignored — a catalog guard now pins that so a dead `value` cannot come back.

- b19162d: Build and publish `@object-ui/fields/style.css` — the subpath the package has always declared and never shipped

  `packages/fields/package.json` has declared `"./style.css": "./dist/index.css"` for the package's entire life, while its build was `tsc && vite build` and the package contained no `.css` file for Vite to extract. **No published version up to and including 17.3.0 contains a stylesheet** — the `@object-ui/fields@17.3.0` tarball has zero `.css` files in it. The subpath did not merely render badly, it failed to resolve: a consumer writing the `@import '@object-ui/fields/style.css'` that the quick-start guide taught got a build error. This release is the first one where that import works, so it is a new capability rather than a repair of a working one, and no existing consumer can be relying on the old behaviour — an import that never resolved has no working callers.

  Removing the export was the cheaper option and was rejected on a measurement: fields' class surface is not a subset of what `@object-ui/components` publishes. 155 classes exist only here, and 17 of them (`hover:bg-accent/30`, `ring-destructive/50`, `bg-primary/20`, …) resolve `@theme` tokens declared in unpublished package source, so no consumer-side Tailwind configuration can generate them. Dropping the export would have made the field widgets permanently under-styled with no supported remedy.

  The new sheet is a **supplement, not a replacement** — it is compiled against the components theme and then has every rule that package's sheet already ships subtracted from it, so it is ~22 kB rather than another ~180 kB of near-duplicate CSS. Import it after the components sheet:

  ```css
  @import "tailwindcss";
  @import "@object-ui/components/style.css";
  @import "@object-ui/fields/style.css";
  ```

  Also adds a workspace-wide guard (`scripts/__tests__/package-files-exist.test.ts`) that fails when any package exports a subpath its published tarball cannot contain, so a stylesheet export with nothing building it cannot recur silently.

- 1bd6faa: fix(fields,plugin-form): stop the inline child grid from collapsing `datetime`/`time` columns onto the `date` control

  `deriveMasterDetail`'s `fieldTypeToColumnType` mapped `date`, `datetime` and `time` onto the single `date` grid column type, and `GridField` renders that as `<input type="date">`. The consequence was not cosmetic: that control emits a bare `YYYY-MM-DD` on change, so a user who merely re-picked the **day** of a `datetime` cell silently wrote the record's time component out of existence — a `14:30` became midnight with no warning and no undo.

  `GridColumn['type']` now carries `'datetime'` and `'time'` alongside `'date'`, and each renders its own control with its own read/write adapter:

  - `datetime` → `<input type="datetime-local">`, read through `toDateTimeInputValue` and written back through `fromDateTimeInputValue`, so the stored shape stays ISO-8601 and read and write share one basis (the contract `DateTimeField` already follows, objectui#3127).
  - `time` → `<input type="time">`, round-tripping the stored zone-less `HH:mm[:ss]` verbatim.
  - `date` → unchanged.

  The read-only surfaces are fixed with it. `displayText()` and the read-only table both fell through to `String(value)` and printed the raw stored ISO on screen (`2026-06-17T00:00:00.000Z`); each temporal type now formats as itself — a day for `date`, day + local time for `datetime`, the wall clock for `time`. That could not be fixed before the type collapse was undone, because with one column type the renderer had no way to know which of the two to show.

  Authors writing explicit grid `columns` can now declare `type: 'datetime'` / `type: 'time'`; previously those spellings were not part of the exported union.

### Patch Changes

- 0186cdc: `address` widget: the ZIP box now reads and writes `postalCode`, the part name the platform stores

  `AddressField` bound its ZIP input to `zipCode` — a part name that appears
  nowhere in `@objectstack/spec`. The stored value uses `postalCode`, which
  `AddressValueSchema` declares and enforces with `$strip` semantics, so the two
  sides never met:

  - opening a stored address showed an **empty** ZIP box (no input read
    `postalCode`), while street / city / state / country all populated — four of
    five parts working is what let this survive review;
  - anything the user then typed into that box was written back as `zipCode` and
    **stripped at the contract boundary**. On a new record the postal code was
    lost outright; on an existing one the correction was silently discarded and
    the stale stored code remained, with no error anywhere.

  The widget now uses `postalCode` throughout — state key, sub-input id, the
  `onChange` part name and the read-only formatter. Data written by the previous
  builds is still **read** through `zipCode` as a compatibility limb, and the
  first edit of any part normalizes such a record onto `postalCode` rather than
  writing the split shape back out. Nothing writes `zipCode` any more, and it is
  deliberately not part of the exported `AddressValue` type, so authoring code
  cannot spell it.

  `AddressValue` is otherwise unchanged in shape; consumers that referenced
  `AddressValue['zipCode']` must read `postalCode`.

  Fixes objectstack-ai/objectstack#5143.

- ea41a59: fix(fields): `BooleanField` uses the control id its host hands down, so a boolean field's visible label is really associated with the switch

  A `boolean` / `checkbox` field inside a form emitted **two** labels with the same text, and the visible one pointed at nothing. `<FormControl>` (a Radix `Slot`) hands the control the id its `<FormLabel htmlFor>` already references, and the widget replaced it with the field name — so `label for="_r_3_-form-item"` had no target while the switch carried `id="notifications"`. Clicking the visible label, the normal affordance for a switch/checkbox row, toggled nothing on every generated form in every app; the accessible name survived only through the widget's own `sr-only` label.

  The widget now honours the id it was handed (`id` is a declared key of the widget contract, forwarded by `toDomProps`) and stops emitting its own label when a host supplied one. Standalone rendering is unchanged: with no host id the id still falls back to the field name and then to `useId()`, and the `sr-only` label — the only accessible name the inline grid editor and the console's action-param dialog have — is still emitted.

- c3b01a7: Give composite and grouped field widgets a real accessible name: the form renderer now associates its label by IDREF for widgets that declare `labelling: 'group'`, instead of emitting a `<label for>` that nothing labelable answers (objectui#3961).

  Six widgets rendered a visible group label that named **nothing** in the accessibility tree. Measured in a real form, one field per row, reading each label's `for` against the DOM:

  ```
  address      for=…-form-item -> MISSING            byLabelText=0   role+name=0
  geolocation  for=…-form-item -> MISSING            byLabelText=0   role+name=0
  checkboxes   for=…-form-item -> div                byLabelText=0   role+name=0
  radio        for=…-form-item -> div[radiogroup]    byLabelText=0   role+name=0
  rating       for=…-form-item -> div                byLabelText=0   role+name=0
  file         for=…-form-item -> div[role=button]   byLabelText=0   role+name=0
  ```

  Two shapes, one outcome. `address` / `geolocation` spread the host's id onto their first sub-input and then replaced it with that input's own unique id (objectui#3343, correct in itself), so the `for` named an id no element carried — clicking "Shipping Address" did nothing and the group label was absent from the accessibility tree entirely. `checkboxes` / `radio` / `rating` / `file` kept the id, but on a `div`: a `<label for>` on a non-labelable element is inert HTML — `HTMLLabelElement.control` is `null`, so it activates nothing and contributes no name. A screen reader heard "Street Address", "City", "Alpha", "Beta" — never which group they belonged to.

  The fix is the WAI-ARIA group pattern, driven by a DECLARATION rather than by the host guessing at widget DOM:

  - `@object-ui/core` — `ComponentMeta` gains `labelling?: 'control' | 'group'`. Additive and optional; absent means `'control'`, which is every existing component's behaviour.
  - `@object-ui/components` — the form renderer reads it. For a `'group'` field the `<FormLabel>` publishes an `id` and drops its `for`, and the widget receives `aria-labelledby`. The single-control path is unchanged down to the attribute: no id on the label, no `aria-labelledby` key on the widget, so no field acquires a second naming channel. `ui/form.tsx` is untouched (Shadcn no-touch) — both halves travel as ordinary props, since `<FormLabel>` spreads props after its own `htmlFor`.
  - `@object-ui/fields` — the six audited widgets declare `labelling: 'group'`. `address` / `geolocation` move the host id (and only the id) from their first sub-input to the group container; `checkboxes` / `rating` answer a host-supplied `aria-labelledby` with `role="group"`; `radio` keeps Radix's more specific `radiogroup`; `file` takes the name on its dropzone with no invented group layer, because it has exactly one control that merely happens not to be labelable.

  No new key in the widget props contract: `aria-*` is already declared on it and forwarded by `toDomProps`, the same channel `aria-required` (objectui#3290) travels.

  Deliberately unchanged: sub-labels keep naming their own inputs (`aria-labelledby` overrides `<label for>`, so putting the group name on the first sub-input would have replaced "Street Address" with the field name — the concatenated-name outcome this issue rejected), `aria-describedby` stays on the first focusable sub-input where focus can reach it (objectui#3318), the sub-input ids of objectui#3343 do not move, and standalone rendering — the inline grid editor, a bare SDUI node, where nobody hands down an id and there is no host label to point at — emits no role and no IDREF at all.

  A widget that does not declare itself keeps the old `for`, which the label-association tests report as an association resolving to a non-labelable element. Silence was the failure mode being fixed; the default path stays loud.

- c97a45e: Group-labelled field widgets now consume the host label's IDREF in their readonly and zero-option states, so the visible label names something there too

  A field declared `labelling: 'group'` (objectui#3961) is named by IDREF: the form
  renderer publishes its `<FormLabel>`'s own `id`, drops the inert `for`, and hands
  the widget `aria-labelledby` plus the host control `id`. All seven such widgets
  consumed that pair on their editable surface only. A field-level
  `readonly: true`, and an option list that resolved to zero offered options, take
  early returns that render before the container doing the consuming — so the label
  published an id that no element in the document referenced.

  Measured on the previous `main`, one field per row in a real form, counting the
  elements that reference the host label's published id:

  ```
                               consumers  byLabelText  named group
  multiselect  readonly+value      0           0           0
  multiselect  readonly+empty      0           0           0
  multiselect  zeroOptions         0           0           0
  multiselect  editable            1           1           1
  ```

  All seven measured identically in every readonly state; each is 1 now. The
  user-visible effect is the one objectui#3961 fixed for editable fields: the
  visible label was the accessible name of NOTHING, so a readonly "Tags" or
  "Shipping Address" was announced as loose text next to unattributed values. It is
  not a regression of #3961 or objectui#3975 — before them these same states
  emitted a `for` pointing at an id no element carried, which named nothing either.
  The shape changed from a dangling `for` to an unconsumed IDREF; the defect did
  not.

  Each readonly surface now carries exactly two keys — the host `id` and
  `aria-labelledby` — plus the `role="group"` that makes them meaningful, in one
  shared spelling (`toHostGroupProps`). The narrow pair is deliberate: a readonly
  display has no focusable control, so `aria-describedby` / `aria-required` /
  `disabled` / the focus handlers have nothing to announce on, and `name` on a
  `div` is exactly the DOM leak objectui#3291 sweeps for.

  Two widgets answer with a different role than they do while editable, because
  they render a different surface: `radio` (editable `radiogroup`) shows the chosen
  option's label as text with no radios in it, and `file` (editable `button`, the
  dropzone) shows file names with no dropzone. `role="group"` is also what the
  shared "no options available" box now answers with for `checkboxes` / `radio` /
  `multiselect`; the single `select` is not group-labelled, keeps its working
  `for`, and that box emits nothing new for it.

  Standalone rendering is untouched. The grid's inline cell editor and bare SDUI
  nodes hand down neither key, so nothing is emitted and the markup stays
  byte-identical — including the `EmptyValue` placeholder, which keeps its own
  `aria-label` and gains no role. Hosted-and-empty, that placeholder is the whole
  readonly surface, so it carries the group props: its `aria-label` ("No value") is
  then outranked by `aria-labelledby` per accname, which is the intended outcome —
  on the `generic` role that span carries, an author name is prohibited and was
  never exposed, so the choice was between the field's name and no name.

- d8a0be4: A form-hosted `multiselect` field is now NAMED by its visible label. It was the
  residual of objectui#3961: that issue's probe audited six widgets and fixed
  them, and re-running the same probe over the whole widget map afterwards put
  `multiselect` on the byte-identical failure shape as `checkboxes` — the host's
  `id` kept, but on the chip row's wrapper `div`, where a `<label for>` is inert
  HTML (`HTMLLabelElement.control` is `null`, so it activates nothing and
  contributes no accessible name). Measured on the tree that already carried
  #3961's fix, one field per row:

  ```
  checkboxes   for=(none) ownId=…-group-label   byLabelText=1(div[role=group])
  multiselect  for=…-form-item ownId=(none)     byLabelText=0
  ```

  Visually the field had a "Tags" label; a screen reader heard only "Alpha" /
  "Beta" and nothing about what the set of chips was for.

  No new mechanism — #3961's declaration, applied to one more widget:
  `multiselect` declares `labelling: 'group'` at the registration boundary, so
  the form renderer publishes its label's `id` and drops the dead `for`, and the
  chip row answers with `role="group"` + the handed-down `aria-labelledby`.

  Unchanged on purpose: each chip keeps its own accessible name from its text
  content (the group name sits one level up and does not override it), and
  STANDALONE rendering — the grid's inline cell editor, a bare SDUI node, where
  nobody hands an id and there is no host label to point at — emits no role and
  no IDREF, exactly as before.

- f4b97c8: `percent` / `progress` cells now give the NUMBER shrink priority over the decorative bar (objectstack#5066)

  In a narrow clipping container the percent display renderer sacrificed the wrong
  half of itself. It emitted a `w-16 shrink-0` bar in front of a shrinkable value
  span, so in a `record:highlights` chip — `basis-[9rem]`, shrinking toward
  `min-w-[7rem]` as chips are added, clipping with `truncate` — the 64px bar plus
  the 8px gap consumed the content box and `truncate` removed what was left of the
  value. A stored `33.33` carried `33%` in the DOM and read as `3` on screen
  (measured: 79px clip box, 32px text node, 25px overflow), with no ellipsis and
  nothing in the accessible name to signal the loss: a silently smaller, plausible
  number rather than a cosmetic glitch. Downstream the app had to override the
  highlight's render type to `number` to get its digits back, losing the `%` glyph
  and the bar entirely.

  The priority is now inverted, on the principle that the number is the CONTENT and
  the bar is DECORATION: the value span is `shrink-0` and the bar carries
  `min-w-0 shrink`, keeping `w-16` only as its PREFERRED width, so a squeezed
  container eats the bar and the digits survive intact.

  The bar is deliberately NOT `flex-1`. `flex-1` would let it GROW as well as
  shrink, stretching the bar across every wide grid cell and changing a surface
  that has no bug; `w-16` stays the upper bound, so wide containers render exactly
  as before and only the shrink direction changed. Below roughly 40px of content
  the bar has collapsed to nothing and the value clips like any other single-line
  cell — same floor as the plain number renderer, which is as far as a
  self-contained renderer fix reaches (the chip's own width is a function of how
  many chips the record has, so the strip's `@container` cannot see it).

  The neighbouring `number` renderer is untouched.

- c2ecbae: 相关列表 Add 选择器兑现 `add.picker.filter`:作者限定的候选范围现在真的生效

  `record:related_list.add.picker.filter` 被 spec 声明为「Restrict which records the picker offers」,但渲染器从未读过它 —— 挂 `RecordPickerDialog` 时不传任何 filter,对话框照样提供 `picker.object` 的全部记录,选中即建链接行或改父,`os validate` / `os build` 全绿、运行时零诊断。作者写下「只允许指派 active 的岗位」「只允许挂未过期的许可」,得到的是完整候选列表。

  现在它按原样传给 `RecordPickerDialog` 的 `baseFilter` —— 不是 `lookupFilters`,后者会把条件渲染成用户可编辑的筛选栏行,等于把作者的硬性限制降级成建议。

  `baseFilter` 因此接受两种形状,按结构判别(`Array.isArray`):

  - **`QueryParams.$filter` 记录形式**(依赖型 lookup 链)保持原有的键覆盖语义逐字节不变 —— 级联父值必须**替换**同字段上过期的 `lookupFilters` 条目,而不是与之求交。
  - **spec 的 `ViewFilterRule[]`** 经 `mergeFilterNodes`(仓内唯一的 filter 下沉口)下沉,19 个 operator 全部无损到达服务端,包括记录形式没有 `$op` 可用的 `before` / `after` / `is_empty` / `is_not_empty`。此处**不新增**第二份 operator 词汇表。

  槽位类型同时从 `Record<string, any>` 收紧为 `unknown`:前者会接受规则数组(数组满足 `any` 的字符串索引),旧的对象展开再把它压成 `{"0": {...}}`,于是查询去过滤名为 `0` 的列 —— 类型全绿、查询错误、无任何诊断。

- 11c1e71: Resolve a `select` field declared `multiple: true` to the `field:multiselect` widget, so the object form's visible label actually names the chip picker it renders (objectui#3986).

  `mapFieldTypeToFormType` keyed the widget id on the field's `type` string alone, so an object-schema `{ type: 'select', multiple: true }` picklist — a spec-legal, entirely ordinary shape — became `field:select`. `SelectField` then delegated to `MultiSelectField` on `config.multiple`, so the component that RENDERED was the chip picker while everything keyed on the widget id still answered for the single-value combobox. Above all the label-association declaration (`ComponentMeta.labelling`, objectui#3961), which the form renderer resolves per widget id: the host emitted `<label for>` at the chip row's wrapper `div`, where a `for` is inert — `HTMLLabelElement.control` returns `null`. Visually the field had a label; in the accessibility tree that label named nothing. Measured on the object-form path, `role=group` + accessible name went from 1 for a `multiselect`-typed field (fixed in objectui#3975) to 0 for this one.

  Declaring `select` itself `labelling: 'group'` was not available: a single-value select's trigger is a labelable `button[role=combobox]` whose `for` association works, and a bare `select` is a builtin the renderer resolves without consulting the registry at all. The fix is therefore at the producer — the widget id now carries the arity, so one place decides which widget renders and the declaration can no longer be addressed to a widget that is not rendering.

  - `mapFieldTypeToFormType(fieldType, config?)` takes an optional second argument — the rest of the field definition, of which only `multiple` is read. Existing single-argument calls are unchanged, and so is every type outside the new table: `select` is the only one whose `multiple` form is a different WIDGET. The spec's multi-capable set is larger (select / lookup / file / image, with `radio` on the select branch and `user` storing like `lookup`), but `LookupField`, `FileField` and `ImageField` each render both arities themselves, so their id — and their labelling declaration — is already right for either.
  - The four object-form producers pass the pair: `ObjectForm`, `DrawerForm`, `ModalForm`, and `sectionFields` (Tabbed / Wizard / Split / Drawer / Modal). In `sectionFields` the id is now computed once from the EFFECTIVE pair, after view-level overrides have merged, because `multiple` is itself a spec `FormField` key: a view restating only `multiple: true` over a single-value object field moves the widget too, and `multiple: false` moves it back.
  - `SelectField`'s `multiple` delegation is KEPT, not retired. Measured, it stays reachable from three entrances that never consult the alias map: the inline grid editor (`FieldEditWidget` finds `select` in its own table first), `ActionParamDialog` (`resolveFormWidgetType` returns `select` from `fieldWidgetMap` first), and hand-written SDUI addressing `field:select` by name with `multiple` on its metadata.

  Read-only rendering of these widgets is untouched (objectui#4005), as is the built-in `Select` branch (objectui#3976).

- Updated dependencies [794c497]
- Updated dependencies [993336f]
- Updated dependencies [f0a625a]
- Updated dependencies [b5980f4]
- Updated dependencies [8aad9fd]
- Updated dependencies [6719877]
- Updated dependencies [56ff091]
- Updated dependencies [7864f03]
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
- Updated dependencies [c2fd122]
- Updated dependencies [ac2139c]
- Updated dependencies [b14ab3a]
- Updated dependencies [e24d767]
- Updated dependencies [8c60819]
- Updated dependencies [aca561a]
- Updated dependencies [e64a52e]
- Updated dependencies [844d17f]
- Updated dependencies [48132f7]
- Updated dependencies [4dcd52a]
- Updated dependencies [42ae5c6]
- Updated dependencies [0ef9dfd]
- Updated dependencies [1d723e3]
- Updated dependencies [0109f54]
- Updated dependencies [7e5bb5d]
- Updated dependencies [fbc23e0]
- Updated dependencies [6d762da]
- Updated dependencies [e6fdbdc]
- Updated dependencies [54233b1]
- Updated dependencies [f9faa7d]
- Updated dependencies [97b63d7]
- Updated dependencies [6bb454a]
- Updated dependencies [523be48]
- Updated dependencies [7e2b7e9]
- Updated dependencies [33526fd]
- Updated dependencies [32413ec]
- Updated dependencies [c1e1e6b]
  - @object-ui/components@17.4.0
  - @object-ui/react@17.4.0
  - @object-ui/core@17.4.0
  - @object-ui/i18n@17.4.0
  - @object-ui/types@17.4.0
  - @object-ui/providers@17.4.0

## 17.3.0

### Minor Changes

- 3889ffb: Console chrome i18n gaps (objectstack#5407).

  - A dependency-gated lookup now names its controlling field by its **label**
    instead of its raw API name. The sentence was localized but the interpolated
    name was not, so every locale — English included — read `Select crm_account
first`. The form renderer passes a new `dependsOnLabels` widget prop (the
    lookup-side counterpart of `emptyHint`, which it already resolves to labels
    for the fixed-option widgets); a name the host does not cover still falls
    back to itself.
  - The page-header overflow trigger's `More actions` accessible name now reads
    `detail.moreActions`, the same key `action:menu`'s own overflow trigger uses,
    so the two cannot diverge per locale.
  - The activity-feed reaction button's `Add reaction` accessible name is now a
    bundle key (`detail.addReaction`, added to all ten packs).
  - The "check the highlighted fields" toast joins field names with a per-locale
    separator (`validation.formInvalidJoiner`) instead of a hardcoded `、`
    (U+3001) — right for zh/ja by accident, wrong in English and every Latin
    locale. Latin packs use `, `, CJK `、`, Arabic `، `.
  - The Spanish `validation.required` / `validation.unique` templates gained
    their own masculine head noun (`El campo {{field}} es obligatorio`) so the
    adjective agrees for feminine field labels too — `Cuenta es obligatorio` was
    ungrammatical.

- 19b8c9b: Field widgets no longer spread renderer-only props — or arbitrary keys from a
  field config — onto the DOM element they render (objectui#3291).

  **Behaviour change:** an unknown key written on a field configuration (or on an
  SDUI `field:*` node) stops becoming an HTML attribute on the rendered control.
  Nothing reads those attributes, but they were serialized into the DOM, into
  snapshots, and into anything scraping rendered markup.

  ## What was happening

  Widgets forwarded their leftover props with a bare spread, so whatever a host
  handed them became an attribute. Measured on a real form with a real widget:

  ```
  <input placeholder="PH-f" zzcanary="CANARY-STR" zzcanaryobj="[object Object]"
         zzcanarynum="42" id="…" type="text" value="" name="f">
  ```

  `zzcanaryobj="[object Object]"` is an ordinary extra key on the field config
  being `String()`-ed onto an attribute. React 19 does not warn about any of it:
  an all-lowercase unknown attribute is passed through in complete silence, which
  is why this went unnoticed.

  Eleven widgets carried a line that looked like it prevented exactly this:

  ```ts
  const { inputType, ...domProps } = props as any; // "Filter out non-DOM props"
  ```

  `inputType` is already stripped by the form renderer before a widget sees it,
  so that line filtered nothing — the comment actively misled. It is gone.

  ## What changed

  - New `toDomProps(props)`, exported from `@object-ui/fields`. It keeps only
    what may legitimately become a DOM attribute and drops the rest.
  - The 14 field widgets that spread onto a host element now go through it:
    `text`, `textarea`, `number`, `boolean`, `date`, `datetime`, `time`, `email`,
    `phone`, `url`, `password`, `currency`, `percent`, and `select`.

  **It is a whitelist, not a list of keys to drop.** The largest leak source is
  not any named renderer prop — it is the open tail of author-supplied keys. The
  form renderer destructures a fixed set of known keys and forwards the rest
  verbatim, and `SchemaRenderer` is wider still: it spreads the whole authored
  node as props with no strip layer at all, so on that path a widget's own spread
  is the only line of defence. A blacklist of today's renderer-only props would
  pass every canary above and would not stop the next authored key either.

  The forwarded set is the one `FieldWidgetComponentProps` already **declares**:
  `id`, `name`, `autoFocus`, `tabIndex`, `onBlur`, `onFocus`, `onClick`,
  `className`, `disabled`, plus `aria-*` and the `data-*` family. Until now that
  was a type-level claim a widget could violate at runtime just by spreading;
  `toDomProps` is its executable form.

  Two compile-time assertions tie the helper to the declaration, and it is worth
  being exact about which drift each one prevents:

  - the contract's DOM pass-through block is now a named type
    (`FieldWidgetDomProps`), and **both directions are compiler-bound**:
    forwarding a key the contract does not declare fails to compile, and
    declaring a DOM key the helper does not forward fails to compile too. The
    second direction guards _declared but not delivered_ — a key that
    type-checks, reads as supported, and silently never reaches the element. The
    leak test structurally cannot see that class of bug: it looks for attributes
    that arrive, not for ones that go missing.
  - `className` and `disabled` are bound in the **forward direction only**. They
    are DOM-legal and are forwarded, but they live in the controlled-input block
    because widgets also interpret them, so they are deliberately outside
    `FieldWidgetDomProps`.

  An HTML global attribute the contract does not declare (`role`, say) is no
  longer forwarded. It only ever arrived through the open spread. If a field node
  should be able to author one, declare it on `FieldWidgetComponentProps` and add
  it to the whitelist — the fix belongs at the contract, not in a wider spread.

  ## Regression gate

  A new contract test renders **every** registered field widget through **both**
  hosts — the real form renderer and `SchemaRenderer` — and fails on any
  attribute HTML does not define for that element. It walks real DOM attributes
  rather than listening for React warnings (React 19 is silent for the exact case
  that leaked), asserts a validation error genuinely rendered before scanning the
  error variant, and calibrates its own judge against two fixtures: standard
  markup that must produce zero findings, and planted fake attributes that must
  all be found. A new widget type is covered automatically — the sweep is derived
  from the widget registry, so adding one without covering it fails the test.

- 56409c2: Field widgets are finally told when their field fails validation, and the props
  slot that carries it takes the name the published contract gives it
  (objectui#3222).

  **Breaking** for anyone implementing a field widget (see migration below). The
  repo version policy keeps this a `minor` — objectui's major tracks
  `@objectstack`'s — so read the bump as "breaking within objectui".

  ## The a11y defect this fixes

  `@objectstack/spec/ui`'s `FieldWidgetPropsSchema` — the published contract that
  third-party and AI-authored field widgets are written against — has always
  declared `error?: string`. `@object-ui/fields` declared its own slot as
  `errorMessage`. That looked like a naming split; it was worse:

  ```
  producers of `errorMessage` anywhere in packages/ + apps/ :  0
  reads of `errorMessage` in packages/fields/src            : 15  (7 widgets)
  reads of `props.error`                                    :  0
  ```

  The slot was dead under BOTH spellings. No host ever passed it: the form
  renderer showed validation text through its own `<FormMessage/>` and never
  forwarded the prop. So `EmailField`, `CurrencyField`, `UrlField`,
  `RichTextField`, `PercentField`, `TextAreaField` and `PhoneField` each computed
  `aria-invalid={!!errorMessage}` from a value that was `undefined` forever —
  **`aria-invalid` had never once been set, and a screen reader was never told
  the field had failed validation.**

  Worse than "never set": `<FormControl>` is a Radix `Slot` that hands its child a
  CORRECT `aria-invalid`, but a widget's own attribute is written after the props
  spread, so it wins. Those seven widgets were actively overwriting the right
  answer with `false`.

  FROM: `renderFieldComponent` received no validation state, and the widget props
  type declared `errorMessage?: string`, which nothing produced.
  TO: the form renderer passes react-hook-form's `fieldState.error?.message` down
  as `error` when it renders a registered widget, and the props type declares
  `error?: string`. Both ends of the contract are live for the first time; a
  rename alone would only have swapped one dead key for another.

  ## Migration for widget authors

  ```diff
  -export function MyField({ value, onChange, field, readonly, errorMessage }: FieldWidgetComponentProps< string >) {
  -  return <Input value={value} aria-invalid={!!errorMessage} />;
  +export function MyField({ value, onChange, field, readonly, error }: FieldWidgetComponentProps< string >) {
  +  return <Input value={value} aria-invalid={!!error} />;
  ```

  No alias is kept. `errorMessage` was retained nowhere on purpose — a tolerant
  second spelling is exactly the de-facto second contract AGENTS.md #0.1 forbids,
  and it is what would let a missed call site go quiet again. Because
  objectui#3221 had already removed the type's `[key: string]: any`, every missed
  site is a compile error rather than a silent `any`, so the compiler — not grep
  — validated this rename.

  ## Responsibilities are split, not duplicated

  The widget consumes `error` **only** to drive `aria-invalid` on the control it
  renders (which only it can do — `aria-invalid` has to sit on the input element).
  The message TEXT stays with `<FormMessage/>` in the form renderer. A widget that
  also renders the text double-displays it, and the docs, the agent prompt and the
  tests all now say so.

  For the same reason `required` — also declared by the spec, also never delivered
  — is deliberately NOT lowered into widget props: the required marker has exactly
  one author, the renderer's `<FormLabel>`, and giving widgets the flag invites a
  second asterisk. The a11y state a widget could legitimately carry is
  `aria-required`, which needs no contract change at all (`AriaAttributes` is
  already part of the type and widgets already forward it).

  Builtin field types are unaffected: they render inside `<FormControl>`, whose
  Slot already supplies `aria-invalid`, so `error` is stripped there rather than
  leaking into the DOM as a stray attribute.

  Docs updated to match: `content/docs/guide/plugin-development.md`,
  `skills/objectui/guides/plugin-development.md` and
  `.github/prompts/component.prompt.md` — the last of which additionally used the
  spec's non-generic type alias as a generic (`FieldWidgetProps< number >`) and
  destructured a `mode` prop that exists on neither type.

- 042e09d: **BREAKING (v17)** — field widgets receive their metadata on ONE key, `field`.
  `schema` is removed from the widget contract (objectui#3233).

  ## What changed

  `schema` was a second carrier for what `field` already means. Two producers fed
  it: `SchemaRenderer` passed the authored node as `schema`, and the form
  renderer's `renderFieldComponent` passed `schema={props.field || props.schema ||
props}` _alongside_ `field`. The predictable result was ~30 widgets resolving
  their config as `field || schema` — one concept, two spellings, a de-facto
  second contract (AGENTS.md #0.1).

  - `FieldWidgetComponentProps` no longer declares `schema`. Reading
    `props.schema` is now a compile error, not a silent `any`.
  - Both producers converged. The form renderer passes `field` only. The SDUI node
    → `field` translation happens exactly once, in a new registration adapter
    (`withFieldCarrier`), which every built-in field widget is registered through.
  - All `field || schema` reads in `@object-ui/fields` are now plain `field` reads.

  ## Migrating a widget you wrote

  **Reading the metadata** — replace the fallback with the single key:

  ```diff
  -const config = field || (props as any).schema;
  +const config = field;
  ```

  **Registering a widget** — if your widget can be rendered from a schema node
  (anything `SchemaRenderer` dispatches, not just forms), wrap it once so it still
  gets `field`:

  ```diff
  +import { withFieldCarrier } from '@object-ui/fields';
  +
  -ComponentRegistry.register('color', ColorField, { namespace: 'field' });
  +ComponentRegistry.register('color', withFieldCarrier(ColorField), { namespace: 'field' });
  ```

  `withFieldCarrier` forwards the node **by reference** — nothing is copied,
  narrowed or renamed — and consumes `schema` so it cannot reach the DOM through a
  widget's `...props` spread.

  A third-party widget that still reads `props.schema` and is **not** re-registered
  through the adapter will read `undefined` in v17 and silently render an empty /
  default state. That is the deliberate cost of a major boundary: one contract
  beats N dialects, and a widget that picks the wrong spelling should fail at
  compile time rather than work under one host and not another.

  ## What did NOT change

  - **Host metadata (SDUI JSON) is untouched.** No authored schema changes; this is
    a change to how widgets are _written_, not to what apps declare.
  - **`schema` is still the universal SDUI prop** every registered component
    receives from `SchemaRenderer` (`element:*`, `page:*`, grids, reports). Only
    the _field-widget_ contract retired it. In particular `renderFieldComponent`
    still passes `schema` when a form field type resolves to a plain component
    through the bare-name fallback (e.g. `type: 'text'` reaching the display text
    widget) — that component's contract is the node, and dropping it there would
    render `undefined.className`.

  ## Payload equivalence

  Every path that used to deliver a payload through `schema` now delivers the
  identical object through `field`, and both halves are pinned by tests asserting
  **object identity**, not shape:

  - form path — `packages/components/src/renderers/form/__tests__/form-field-carrier.test.tsx`
  - SDUI path — `packages/fields/src/__tests__/field-carrier-sdui.test.tsx`

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

- b7165ce: AddressField / GeolocationField sub-inputs now derive their DOM ids from a `useId()` prefix + sub-field name (the RadioField / CheckboxesField `groupId` paradigm) instead of hardcoded literals ("street", "city", "state", "zipCode", "country", "latitude", "longitude"). Two address or geolocation fields in one form no longer produce duplicate DOM ids, and each sub-label's `htmlFor` resolves to and focuses its own field's input instead of the first match in the document (#3343).
- 7d08c3f: `TextAreaField` / `RichTextField` now honour `disabled` on their fullscreen editing path. `disabled` used to reach the inline control only: `showFullscreenButton` never consulted it, neither widget forwarded it to `FullscreenFieldEditor`, and that component did not declare the prop at all. A disabled long-text or rich-text field therefore sat correctly greyed out next to a live expand button whose dialog accepted any edit and wrote it straight back through `onCommit` — reproduced dynamically before the fix as toggle `disabled=false`, dialog input `disabled=false`, `onChange` called with "EDITED WHILE DISABLED". The state was easy to miss precisely because the visible control looked right.

  `FullscreenFieldEditor` now declares `disabled`: the expand button stays (disabled means "not interactive, muted", unlike `readonly`, which suppresses the affordance entirely via each widget's read-only early return) but is disabled and refuses to open, the dialog's editor is disabled through a new third `children` argument, and "Done" is both disabled and gated before `onCommit`. The dialog locks on its own rather than trusting the button, because the form renderer folds `isSubmitting` into `disabled` — so a submit starting while the dialog was already open used to leave the field editable for the duration of the submit. Cancel and Esc stay live in every state. This is the registered-widget half of the same defect #3400 / #3401 fixed on the built-in `form.tsx` path, so both render paths now give the same metadata the same behaviour (#3402).

- 6fe485b: fix(fields): translate the registered path's fullscreen long-text dialog (objectui#3404)

  `FullscreenFieldEditor` — the expand button and dialog that `TextAreaField`
  (`field:textarea`) and `RichTextField` (`field:markdown` / `field:html`) render
  when `ObjectFormSchema.mobile.fullscreenLongText` is on — shipped four English
  literals: the toggle's accessible name (`Edit {label} fullscreen`), the title
  fallback `Edit text`, `Cancel` and `Done`.

  No translation was missing. `form.fullscreen.*` and `common.cancel` have shipped
  in all ten locale packs since objectui#3272 translated the built-in branch; this
  path simply never consumed them. The result was visible inside a SINGLE form: a
  zh session saw 「取消 / 完成」 on a built-in-rendered long-text field and
  `Cancel / Done` on a registered-widget one.

  All four now consume those existing keys — **no new keys, no locale-pack
  change**. The dialog also gained the sr-only `form.fullscreen.description` the
  built-in branch already carries, so it has an accessible description
  (`aria-describedby`) instead of none.

  Copy resolves through `useFieldTranslation()` (`createSafeTranslation`), as the
  built-in branch does, whose English defaults are byte-identical to the literals
  they replace — so widgets rendered with no `I18nProvider` (standalone/embedded
  hosts) render exactly what they did before rather than raw i18n keys.

- 825bbe3: The option widgets' "this list cannot be filled" message now has one source, and
  it is translated (objectui#3231).

  FROM: `SelectField`, `MultiSelectField`, `RadioField` and `CheckboxesField` each
  carried their own copy of the empty/gated state, each destructured the declared
  `emptyHint` prop into `_emptyHint` and dropped it, and each rendered a hardcoded
  English literal (`'No options available'`, `` `Select ${…} first` ``) even in a
  Chinese or Japanese session. TO: one shared `OptionsEmptyState` — the host's
  `emptyHint` when it supplied one, otherwise a translated fallback
  (`fields.options.empty` / `fields.options.selectFirst`, added to all ten locale
  packs).

  `emptyHint` was declared, produced by the form renderer and transported, then
  lost three times over — so no registered widget could ever render it. All three
  breaks are fixed, because closing only the last one delivers nothing:

  - `isOptionField` compared the raw resolved type against `'select'` /`'radio'` /
    `'multiselect'` / `'checkboxes'`. Object-derived forms emit
    `mapFieldTypeToFormType`'s prefixed ids (`field:select`), which matched none of
    them, so for every option field coming from an object schema — the normal case
    in the console — the whole cascade block was skipped and no hint was computed
    at all. It now normalizes the `field:` prefix, the same normalization
    `stripRegisteredFieldProps` already applied a few lines below.
  - `stripRegisteredFieldProps` then removed the `emptyHint` key from what was
    left. It is now forwarded to the four cascade option types, alongside
    `dependentValues`. This stays an allow-list rather than a blanket
    pass-through: every other registered widget spreads its leftover props onto a
    DOM node, where an unknown `emptyHint` attribute is a React warning.
  - the widgets themselves discarded it. Keeping it out of the `...props` spread
    was correct; not using it afterwards was not.

  User-visible effect: a dependency-gated option list now prompts with the
  controlling field's **label** ("Select Country first") instead of its raw
  metadata name, in the session's language; an unconfigured list says so in the
  session's language too. The gate sentence is one i18n key shared by the renderer
  and the widget fallback, so the two sides cannot word it differently.

  Untouched: the built-in (unregistered) `select` branch of the form renderer,
  which already consumed `emptyHint`. That is a separate live path.

- 34d9169: The record picker's filter panel now sends the AUTHORED value of a picked `select` filter option instead of the control's stringified form. Radix `Select` speaks strings — options render as `String(opt.value)` and `onValueChange` returns that string — and the panel stored it as-is, so a filter option whose value is a number or a boolean queried `{ level: "1" }` against records storing `level: 1`. The user picked an option that plainly has records and got an empty list. This bit the `lookup_filters` auto-derivation in particular: `lookup_filters: [{ field: 'level', operator: 'in', value: [1, 2, 3] }]` derives options whose values keep the author's type (`LookupFilterDef.value` is `unknown`), so every non-string option in the picker was unfilterable. The control's string is now mapped back through `col.options` at the control boundary — the control speaks string, the payload keeps the authored type — reusing the `matchOptionValue` / `toControlValue` semantics `@object-ui/components` introduced for the standalone form's select (#3090), rather than coercing in `filterValuesToRecord`, which would have to guess whether `"1"` meant `1` or `"1"`. Options coming from the object schema are strings by spec and round-trip unchanged, and the `number` / `boolean` filter inputs (which already converted explicitly) are untouched — the `select` branch is lifted to their standard, resolving the three-way inconsistency (#3422).
- 5881a2c: The lookup "Browse all records" Record Picker's filter panel now offers the
  options a `select` field declares in its schema (objectui#3336). `LookupField`
  turns each typed picker column into a filter column, and those carried no
  `options` — so the filter panel's dropdown opened EMPTY and the column could
  not be filtered at all, even though the same column's table cells had rendered
  the authored option labels since objectui#3333.

  `RecordPickerDialog` now fills a `select` filter column's missing `options`
  from `fieldsMeta` (the referenced object's schema `fields` map) through the
  same resolver — and the same i18n option translation — the table cells use, so
  the filter dropdown and the cells can never disagree about what an option is
  called. Explicitly authored filter `options` still win (including the ones
  auto-derived from an `in`/`notIn` `lookup_filters` entry), and a select field
  whose schema declares no options keeps an empty dropdown: no options are
  synthesised from the loaded page's raw stored values.

- 9bc3709: The lookup "Browse all records" Record Picker now formats its columns with
  the same field metadata the list view uses (objectui#3333). Previously the
  dialog handed cell renderers a bare `{ name, type }` descriptor, so a
  `select` column had no `options` and fell back to title-casing the raw
  stored value (`manufacturing` rendered as "Manufacturing" instead of the
  authored option label, e.g. "03 制造") — while the same field displayed
  correctly in the list view and on the record detail page.

  `RecordPickerDialog` gains an optional `fieldsMeta` prop (the referenced
  object's schema `fields` map). When provided, each column's field descriptor
  is enriched from the schema — `options` (run through the shared i18n option
  translation), `currency`, `scale`, `precision`, `format`, `reference_to`, … —
  and columns authored as plain strings in `lookup_columns` inherit the schema
  field's `type`, so they format identically to typed columns. `LookupField`
  passes the referenced object's schema it already fetches for `titleFormat`.
  Callers that don't pass `fieldsMeta` keep the previous behavior.

- 49f7449: `field:select` now announces its validation state to assistive tech: the
  widget's DOM pass-through lands on the Radix `SelectTrigger` — the focusable
  `<button role="combobox">` a user actually interacts with — instead of
  `Select.Root`, which renders no DOM element of its own and silently dropped
  every `aria-*` the form renderer delivered (objectui#3306).

  Before this, a required select that failed validation showed the red message
  while a screen reader was told nothing: `aria-invalid`, `aria-describedby`
  (the link to the message text) and `aria-required` (objectui#3290's state
  channel) all landed on Root and vanished. All three now reach the trigger,
  and the widget computes `aria-invalid` from the published `error` slot after
  the spread, the objectui#3222 discipline — a valid field explicitly says
  `aria-invalid="false"` rather than staying mute.

  Two keys deliberately stay on Root: `name` (Root forwards it to the hidden
  native `<select>` that takes part in form submission) and `disabled` (Root is
  the single authority that disables trigger, items and hidden select together).

  Guarding the whole class forward, a new registry-wide sweep
  (`widget-aria-invalid-registry-e2e.test.tsx`, the objectui#3291 leak-sweep
  paradigm) renders every registered field widget through the real form, drives
  a real validation failure, and asserts `aria-invalid="true"` appears inside
  the field's row. The 29 widget types measured not to deliver yet are pinned in
  a ratchet ledger (tracked in objectui#3318): fixing one turns its ledger row
  red until the entry is removed, so the ledger only ever shrinks.

- c7ed4c3: `TagsField` no longer ships a hardcoded Chinese input placeholder
  (objectui#3342, AGENTS.md Commandment #-1). The placeholder now resolves
  through the pinned chain: the author-declared `field.placeholder` wins
  (previously ignored by this widget); otherwise the widget's own copy arrives
  via `useFieldTranslation()` under the new `fields.tags.placeholder` key, added
  at full parity across all locale packs (Chinese lives in the zh pack, not in
  code); with no `I18nProvider` mounted the English default from FIELD_DEFAULTS
  renders — never a raw key.
- 2409e1d: `TextAreaField`'s character counter now announces itself in the session locale. The counter block — rendered only when the field declares `maxLength` — carried the accessible name `Character count: {n} of {max}` as an English literal, and the element is an `aria-live="polite"` region, so a zh/ja/ar session had that English sentence read out on every keystroke while sighted users saw only the language-independent `{n}/{max}` digits. Nothing was wrong on screen, which is why it survived: only screen reader users could perceive it (#3406).

  Unlike #3404, no key existed to consume — none of the ten locale packs had any character-count string. `fields.textarea.characterCount` is new in all ten, interpolating `{{count}}` and `{{max}}` as one sentence rather than parts assembled in code, because `ja` and `ko` put the cap before the count ("of {{max}} characters, {{count}}"), an order no concatenation can produce. The English pack value and the `FIELD_DEFAULTS` fallback are byte-identical to the literal they replace, so an `en` session and a provider-less embed both render exactly what they did before.

  Behaviour is unchanged: `aria-live="polite"` and the per-keystroke recompute are deliberately untouched here and tracked separately (#3408).

- 789fe3e: `TextAreaField`'s character counter no longer re-announces itself on every keystroke. Measured on `main` in a zh session with `maxLength: 500`, typing a 52-character sentence one character at a time produced 52 distinct screen-reader announcements totalling 979 spoken characters — roughly 19x the text being written, each one cutting off the reader's echo of the letter just typed. The counter element was simultaneously the visible `{n}/{max}` digits, the carrier of the translated sentence and the `aria-live` region itself, so "re-render" and "announce" were the same event; the field also had no `aria-describedby`, so focusing it said nothing about the cap at all (#3408).

  It is now the three-node shape the GOV.UK Design System character-count component uses: the visible digits are `aria-hidden` and purely decorative; the counter sentence (`fields.textarea.characterCount`, unchanged in all ten packs) has moved onto the textarea's `aria-describedby`, so focus reads "Character count: 12 of 500" once and then stays quiet; and a separate visually-hidden `aria-live="polite"` region carries a new near-limit warning, `fields.textarea.charactersRemaining` (new in all ten packs), which stays silent until the value is inside the last 10% or last 20 characters of the cap — whichever the typist reaches first — and updates only after typing pauses for a second. The same 52-keystroke probe now produces zero announcements; a run that types all the way onto a 500-character cap produces five. Any `aria-describedby` the host already supplied (the form renderer's description and error-message ids) is appended to, never replaced.

  No metadata change: the counter still renders exactly when the field declares `maxLength` (or the legacy `max_length`), and a widget rendered with no `I18nProvider` still shows the same English sentences.

- f789c3b: `TextAreaField`'s fullscreen edit dialog now gives screen reader users the character count it has always shown sighted ones. The dialog's footer counter was a bare `{n}/{max}` span: no accessible name, nothing `aria-live`, and nothing tying it to the dialog's textarea — so browse mode read "5 slash 500" if it happened to sweep the footer, and focusing the input said nothing about the cap at all. The inline surface of the same field has carried a proper three-node counter since #3408, so the fullscreen branch was at zero for the same field, the same cap and the same user (#3417). It is reachable on any phone form with `ObjectFormSchema.mobile.fullscreenLongText` on, for every long-text field that declares a limit.

  The counting UI is now ONE shared `CharacterCount` component that both surfaces render, instead of two hand-written copies that could only drift. In the dialog it renders `aria-hidden` digits plus a visually-hidden description carrying `fields.textarea.characterCount`, wired to the dialog's textarea through `aria-describedby`, so focus reads "Character count: 12 of 500" once and the count follows the draft as it is edited. The description ids are per surface, because the dialog's draft and the committed value diverge as soon as the user types.

  The dialog deliberately gets NO live region: it is a modal opened to write at length, the description already delivers the cap on focus, and the inline surface's `aria-live` region stays mounted behind the overlay. The inline surface is unchanged — same DOM, same threshold-gated debounced announcements, same ten locale packs and the same English fallbacks with no `I18nProvider` mounted. No new i18n keys and no metadata change: the counter still renders exactly when the field declares `maxLength` (or the legacy `max_length`).

- a321fa4: `TextAreaField`'s mobile fullscreen flag converges on its one real producer
  (objectui#3232).

  FROM: the widget resolved the "show the expand affordance" decision through a
  four-way `??` chain — a `mobileFullscreen` (camelCase) prop, the field
  metadata's `mobile_fullscreen`, a `mobile_fullscreen` prop, and
  `schema.mobile_fullscreen`. TO: a single read of the field metadata's
  `mobile_fullscreen`, resolved through the `field || schema` carrier pair every
  widget in this package already uses.

  No runtime behaviour changes, because three of those four reads were
  permanently `undefined`:

  - `mobileFullscreen` (camelCase) had **no producer anywhere in the repo** — the
    only occurrences of that spelling were the widget's own read and the
    destructure that kept it off the DOM spread. The doc comment nonetheless
    claimed "the host form passes `mobileFullscreen`", so the contract it
    described had never held.
  - `mobile_fullscreen` as a **prop** cannot arrive: the form renderer's
    `stripRegisteredFieldProps` explicitly removes `mobile_fullscreen` and
    `fullscreen` from the props forwarded to registered field widgets.
  - `schema.mobile_fullscreen` was the same object `field || schema` already
    resolves, so it could only ever restate the metadata read.

  What actually drives the affordance — and is now the only thing that does — is
  the field metadata flag `ObjectForm` stamps onto long-text fields from
  `ObjectFormSchema.mobile.fullscreenLongText`. That path is unchanged and is now
  pinned by tests (button, dialog, and the committed edit), so the cleanup cannot
  have silently removed the working behaviour.

  Also untouched: the built-in (unregistered) `textarea` branch of the form
  renderer, which reads `mobile_fullscreen || fullscreen` off the form-field
  props and renders its own `FullscreenTextarea`. That is a separate live path.

  Why this is worth a changeset rather than a silent tidy-up: reads that nobody
  writes are not free. They document a contract that does not exist — the next
  author follows the comment, passes the prop, and is ignored without a word —
  and a `??` chain that accepts four spellings and rejects none is exactly where
  a misspelled key hides. With one source, a wrong spelling has no read path left
  to absorb it. Per AGENTS.md #0.1 and Prime Directive #12, divergence like this
  converges at the producer, not by accumulating tolerance at the consumer. No
  host-override prop was invented in its place: inventing a key with no producer
  is the same mistake in the other direction.

- 8d8094a: 20 more registered field widgets now announce a failed validation to assistive
  tech: `multiselect`, `radio`, `checkboxes`, `tags`, `lookup`, `master_detail`,
  `user`, `owner`, `file`, `image`, `location`, `object`, `color`, `rating`,
  `code`, `avatar`, `address`, `geolocation`, `qrcode` and `object-ref` carry
  `aria-invalid="true"` on their real focusable control after a validation
  failure, where before the red message rendered while a screen reader was told
  nothing (objectui#3318, the registry-wide gap objectui#3306's sweep measured).

  Each widget follows the objectui#3222/#3306 pattern: the `toDomProps(props)`
  whitelist spread goes onto the control the user actually focuses — the input,
  the lookup trigger button, the radiogroup (`role="radiogroup"` is the
  ARIA-designated carrier for a set of radios), every chip/checkbox/star of the
  composite option widgets, the upload dropzone/button — followed by an explicit
  `aria-invalid={!!error}` computed from the published `error` slot. Wrapper
  `<div>`s never carry the state, and `name` is withheld from non-form-control
  elements (the objectui#3291 leak class).

  `Combobox` (`@object-ui/components`) now accepts standard button attributes
  and forwards them to its focusable `role="combobox"` trigger, giving
  combobox-based widgets an element to deliver `aria-invalid` /
  `aria-describedby` to — the same seam objectui#3306 opened on
  `SelectTrigger`.

  Nine types remain on the objectui#3318 ratchet ledger with their blockers
  documented there (`formula`/`summary`/`auto_number`/`vector` render no
  focusable control; `grid`, `slider`, `signature` need component-level design;
  `filter-condition`/`recipient-picker` deliver in their editable states but
  render a dependency-gate hint with no control in a fresh form).

- Updated dependencies [18cd432]
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
- Updated dependencies [56409c2]
- Updated dependencies [042e09d]
- Updated dependencies [9cbcbf4]
- Updated dependencies [85c4c9c]
- Updated dependencies [fd54c3e]
- Updated dependencies [4eeb932]
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
- Updated dependencies [f833d3a]
- Updated dependencies [a6ec93d]
- Updated dependencies [2a9513d]
- Updated dependencies [71be406]
- Updated dependencies [d22ae31]
- Updated dependencies [c7ed4c3]
- Updated dependencies [2409e1d]
- Updated dependencies [789fe3e]
- Updated dependencies [8d8094a]
  - @object-ui/core@17.3.0
  - @object-ui/components@17.3.0
  - @object-ui/types@17.3.0
  - @object-ui/i18n@17.3.0
  - @object-ui/react@17.3.0
  - @object-ui/providers@17.3.0

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
