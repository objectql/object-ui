# @object-ui/plugin-detail

## 11.1.0

### Patch Changes

- Updated dependencies [6726a2b]
  - @object-ui/i18n@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/i18n@7.3.0

## 7.2.0

### Minor Changes

- d23db5c: feat(detail): related-list add-by-picker (generic m2m/junction) + a generic "Assigned Users" management UI on permission sets (assign ai_seat and any role with zero bespoke CRUD; server-side cap errors surface inline).

### Patch Changes

- Updated dependencies [8e7c1da]
  - @object-ui/i18n@7.2.0

## 7.1.0

### Patch Changes

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

### Patch Changes

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
- Updated dependencies [2f31406]
- Updated dependencies [18728c1]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/components@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/i18n@7.0.0
  - @object-ui/types@7.0.0
  - @object-ui/fields@7.0.0
  - @object-ui/permissions@7.0.0

## 6.2.3

## 6.2.2

## 6.2.1

## 6.2.0

## 6.1.0

## 6.0.4

## 6.0.3

## 6.0.2

## 6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0
- @object-ui/fields@6.0.0
- @object-ui/permissions@6.0.0

## 5.4.2

## 5.4.1

## 5.4.0

## 5.3.2

## 5.3.1

## 5.3.0

## 5.2.1

## 5.2.0

### Minor Changes

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

- 70b5570: `record:path` now distinguishes won/lost terminal stages. Stages can opt
  in via the new `terminal: 'won' | 'lost'` property on each stage entry,
  and the renderer also falls back to a value/label heuristic (matches
  `closed_lost`, `lost`, `failed`, `cancelled`, `失败`, `流失`, `丢单`, etc.)
  so existing CRM-style picklists get the treatment without migration.
  - **Lost** stages render in a visually separated group with a left
    border, destructive (red) tint, pill shape, and `✗` glyph — mirroring
    the Salesforce / HubSpot alt-terminus pattern that signals "this
    breaks the forward path, not steps past it."
  - **Won** terminus (the last stage of the forward chevron) gets a subtle
    emerald wash + 🏆 glyph to read as "the goal," even before the record
    reaches it.
  - Mobile pill row distinguishes lost via color, since the layout doesn't
    have room to fork the row.

- 3216f8a: `buildDefaultPageSchema` now accepts a `slots.rightRail` override that
  contributes nodes to the aside (right-rail) region. The aside region is
  emitted whenever either the auto-detected reference rail OR
  `slots.rightRail` is non-empty (previously: only when 2+ related lists
  were declared). Slot contributions are appended after the canonical
  `record:reference_rail` so the "related summary" stays anchored at the
  top while plugins can drop activity feeds, workflow status cards,
  presence lists, etc. beneath it.

  No change for existing schemas — the aside region only renders if
  something opts in.

### Patch Changes

- a3cb88f: CRM UX polish batch:
  - Kanban columns: drop the per-column rainbow top stripe. Lane border + header divider are sufficient; cards are now the loudest thing on screen (Linear / HubSpot pattern).
  - Stage chevron (`record:path`): bump completed-stage contrast (emerald-800 text on emerald-500/15, was 700 on /10) and future-stage text from `foreground/70` to `foreground/85` for legibility.
  - i18n: add `notifications.emptyUnread`, `notifications.filterUnread`, `notifications.filterAll` (en + zh) so the InboxPopover Unread/All sub-filter renders in the active locale.
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

- 5633edd: feat(detail,grid): tab + selection motion polish

  **plugin-detail**
  - `DetailTabs` and the auto-tabs path in `DetailView` (5 inline
    `<TabsContent>` instances: details, related, activity, discussion,
    history) now fade in when their tab becomes active, eliminating
    the harsh flash when switching tabs.

  **plugin-grid**
  - `BulkActionBar` slides in from the bottom + fades in when a
    selection is made, instead of popping into existence.
  - The "N items selected" counter re-animates on every count change
    (re-keyed on the count value with a small `zoom-in-90`), so users
    see clear feedback as they tick/untick rows. `tabular-nums` keeps
    the number from jittering during the animation.

  All animations are wrapped in `motion-safe:` so prefers-reduced-motion
  users keep the original instant UI. No new deps.

  **Dialog / Sheet motion audit (informational, no code change)**

  Verified `packages/components/src/ui/{dialog,alert-dialog,sheet}.tsx`:
  Dialog + AlertDialog use a consistent `duration-200`. Sheet uses an
  asymmetric `open:500ms / close:300ms` — this is the intentional
  shadcn upstream default ("slower open feels purposeful"). No fixes
  needed; these primitives live in the no-touch zone anyway.

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

## 5.1.1

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

- 32306e8: feat(plugin-detail): conflict-resolution dialog for OCC

  When inline record-detail edits race a concurrent writer, the bound
  DataSource now raises `ConcurrentUpdateError` (HTTP 409
  `CONCURRENT_UPDATE`). `RecordDetailsRenderer` catches it and opens a
  new `<ConcurrentUpdateDialog>` showing the user's pending value next
  to the server's current value, with three resolution paths:
  - **Reload latest** — discard the pending edit and refetch.
  - **Overwrite anyway** — retry against the server's freshest version
    (still OCC-checked, but acknowledges "I've seen the newer version").
  - **Cancel** — close the dialog and leave the form untouched.

  The renderer now forwards `record.updated_at` as `{ ifMatch }` to
  `dataSource.update()`, so the server can detect stale writes. The
  component is re-exported as `ConcurrentUpdateDialog` /
  `isConcurrentUpdateError` from `@object-ui/plugin-detail` for hosts
  that need to surface the same UX from custom save paths.

  End-to-end OCC requires `@objectstack/client@>=4.2.0` (now wired) and
  backend support in `@objectstack/rest@>=4.2.0`.

- 49b1760: Polish the ConcurrentUpdateDialog and add i18n.
  - Internationalise all dialog strings (title, body, button labels, "your edit" / "current value" headings, audit-trail line) through `useDetailTranslation`. Locale strings added to `@object-ui/i18n` for English and Chinese.
  - Replace the plain dialog header with an amber warning badge + `AlertTriangle` icon to communicate that this is a conflict, not a routine confirmation.
  - Visually differentiate the two value blocks: amber tint for the user's pending edit, sky tint for the server's current value. Both wrap long values cleanly.
  - Surface audit provenance for the racer's write (`updated_at`, plus `updated_by_name`/`updated_by_label` when supplied). Opaque ID-looking `updated_by` tokens are suppressed.
  - Re-prioritise the action buttons: **Reload latest** is now the primary/recommended action (autofocused), **Overwrite anyway** is rendered as a destructive-outline button so the dangerous path requires deliberate intent, and **Cancel** falls back to a ghost variant.

- 8fd863e: Platform highlight + list polish:
  - **deriveHighlightFields**: extended the preferred-field list (close_date, due_date, account, contact, …) and now skips fields whose declared type is not "highlight-friendly" (textarea, markdown, json, boolean, rich-text, etc.). Untyped legacy fields still pass through. Prevents long-form/structural fields from ending up in the highlight strip on objects with sparse metadata.
  - **ListView bulk-action labels**: bulk-action buttons now resolve their labels through `actionLabel(objectName, action, fallback)` so they pick up app-supplied translations under `_actions.<name>.label`, matching the detail-page page-header overflow menu. Falls back to the previous title-cased string when no resource is found.

### Patch Changes

- bd8447d: Three platform-wide detail polish items.

  **Tighter page rhythm**
  - Outer `PageRenderer` padding `p-4 md:p-6 lg:p-8` → `p-3 md:p-4 lg:p-6`
    and outer body wrap `space-y-8` → `space-y-6` so list / detail / home
    pages share the same edge rhythm. Cuts ~16px of edge slack on lg.

  **Highlights KPI treatment**
  - `HeaderHighlight` now renders numeric / currency / percent / decimal
    values as KPI numbers (`text-xl md:text-2xl font-semibold tabular-nums`)
    instead of the uniform `text-sm font-semibold`, so amount / probability
    / count fields read as headline stats — Salesforce-style key facts.

  **Discussion footer upgrade**
  - `RecordActivityTimeline` now uses `RichTextCommentInput` (bold / italic /
    list / code, `@`-mention autocomplete, preview toggle, Send) instead of
    a bare `<textarea>`.
  - `DiscussionContext` gains an optional `mentionSuggestions` array that
    hosts can wire (e.g. team member directory). Falls back to free-text
    `@mention` when omitted.
  - `RecordChatterPanel` threads `mentionSuggestions` through both inline
    and sidebar positions.

- fbd5052: Tighten record-detail visual rhythm. Section card titles were rendering at
  Shadcn's default `text-2xl` which dominated the page; the related-list
  accordion in flush mode dropped all per-item borders so the collapsed
  "Quotes / Products / Open Tasks" triggers stacked with zero visual
  separation.
  - `@object-ui/plugin-detail` `DetailSection`: override the `CardTitle`
    className to `text-base font-semibold tracking-tight`, slim down
    `CardHeader` padding (`py-3 px-4 sm:py-4 sm:px-6`) and `CardContent`
    vertical padding so titles + content read as a single tight block
    rather than a billboard. Demoted the section description from `text-sm
mt-1.5` to `text-xs mt-1` for the same reason.
  - `@object-ui/components` `PageAccordionRenderer`: in the default
    `flush` variant restore a subtle `border-b last:border-b-0` divider
    between accordion items so collapsed siblings get a separator, and
    style the trigger as `text-sm font-semibold tracking-tight
hover:no-underline` (Shadcn's hover-underline default looks busy on
    CRM-style related-list lists).

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

- 1cb6e21: feat(plugin-detail): suppress Related tab when Reference Rail is auto-emitted

  When `buildDefaultPageSchema` decides to emit the Reference Rail (≥ 2
  related lists), the duplicate `Related` tab is now suppressed by
  default. The same data appeared in both places before, which is
  visually noisy and risks confusing users when one surface refreshes
  out-of-step with the other.

  Behavior matches HubSpot / Microsoft Dynamics: the rail is the single
  source of truth for related-list snapshots, and each rail card now
  exposes a `View all` link that deep-links into the child object's
  filtered list view. Authors can opt back into both surfaces via the
  new `hideRelatedTab: false` option.

  The change is gated on the same `≥ 2` heuristic that emits the rail,
  so single-related-list pages keep the inline Related tab (where the
  rail wouldn't have helped anyway).

- d548d6b: Unify empty-state visuals across timeline + registered `empty` renderer.
  - `RecordActivityTimeline` and `ActivityTimeline` now use `DataEmptyState`
    instead of a bare `<p>` so empty timelines match list/related-list visuals
    (muted icon badge + centered copy).
  - The `ui:empty` schema renderer now delegates to `DataEmptyState`, giving
    schema-driven empty regions the same chrome as ad-hoc consumers.

## 5.0.2

## 5.0.1

## 5.0.0

### Major Changes

- bb2ea48: **Phase O.0 — fix: related-list shows wrong records (critical data bug)**

  `RelatedList` previously called `dataSource.find(api)` with no filter
  when auto-fetching, so every Related tab dumped the entire target
  object table instead of the records that actually reference the
  current parent (e.g. an Account showed every Contact in the system,
  not only contacts of that account).

  Two coupled fixes:
  1. `RelatedList` now requires `parentId` + `referenceField` to auto-
     fetch. When both are present it calls `dataSource.find(api,
{ $filter: { [referenceField]: parentId } })`. When either is
     missing it renders the empty state and logs a developer warning —
     never silently fetches the whole object.
  2. `RelatedCountStore` was sending the probe query as `{ where, limit }`
     which most data-source adapters silently ignored (the codebase
     convention is `{ $filter, $top }`). The tab-count badges were
     therefore showing the global object count, not the parent-scoped
     count. Switched to `$filter` / `$top` to match.

  `record:related_list` renderer threads `ctx.recordId` through as
  `parentId`; no schema author changes required.

  **Breaking:** custom callers that depended on `RelatedList` fetching
  the entire object table when `referenceField` is omitted will need to
  either pass `data` explicitly or supply both `parentId` and
  `referenceField`. The previous behaviour was a bug, not a feature.

### Minor Changes

- 542cca9: feat(detail): buildDefaultPageSchema synthesizer (Track 3 Phase G slice 1)

  Pure-function synthesizer that emits a canonical Lightning-style Page
  schema (`page:header` → `record:highlights?` → `record:path?` →
  `page:tabs` → `record:discussion?`) from an object definition and
  optional overrides. Also exports helpers `detectStatusField`,
  `deriveStages`, `deriveHighlightFields`.

  This is the foundation for converging the default `<DetailView>`
  output with custom Lightning pages. Phase H will wire it into
  `RecordDetailView`'s non-assignedPage branch so the default detail
  page renders through the same `<SchemaRenderer>` pipeline as custom
  pages, inheriting all Phase D/E/F polish automatically.

  No runtime behaviour change in this slice — synthesizer is exported
  but not yet consumed.

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

- bae8ba8: Phase N.3 + N.4 + N.6: record detail visual polish.

  **N.3 — Highlight strip packs left.** `HeaderHighlight` no longer
  stretches a 1-2 chip strip across the full page. Each cell is now
  `min-w-[8rem] max-w-[16rem]` and wraps via flexbox so sparse strips
  sit naturally at the left edge.

  **N.4 — De-duplicate highlight ↔ body.** `record:details` accepts a
  new `hideFields: string[]` prop. The synth pipeline auto-populates it
  with the highlight-strip field list so a field surfaced in
  `record:highlights` no longer appears a second time in the section
  grid below. Authors can also set it directly on the schema.

  **N.6 — Tab count badges only show when >0.** `page:tabs` suppresses
  the count pill when the count is exactly 0 (was rendering "0" as a
  muted badge on every empty Activity/History tab).

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

- bece8ca: Phase N (continued): merge custom record_header actions into `page:header`
  instead of emitting a sibling `record:quick_actions` node. This fixes a
  visual collision on objects (contact, account, ...) that author custom
  record_header actions: previously the floating quick-actions bar
  (`-mt-12` overlay) collided with the system Edit/Share/Delete cluster
  already rendered by `page:header`. Now all action buttons live on a single
  header row.

  `buildDefaultHeader` accepts an optional `actions` array; `buildDefaultActions`
  remains exported as a sub-builder for authors who explicitly want the
  floating quick-action bar via a slot override.

- 77c1877: **Phase O.1 — Cap detail body grid at 2 columns for denser, more legible layout.**

  The auto-layout previously emitted **3 columns** for sections with 11+
  fields, which on typical desktop widths produced very sparse rows
  (label/value cells filled ~30% of each column, lots of whitespace).
  Capped the inferred maximum at 2 columns so paired fields read as
  cleanly-aligned label/value pairs.

  Authors who explicitly set `section.columns: 3` retain the 3-column
  layout — only the auto-inference default changed.

- b14fe09: Phase P.0 + P.5: tighten record-detail header chrome.
  - `RecordTitleChip` collapses the title row to a single baseline-aligned line — H1, eyebrow object label, copy-id, favorite star — instead of the previous two-row title + subtitle layout.
  - `record:details` extends the highlight-field dedup set to also exclude the title field resolved from `objectSchema.primaryField` (or the standard `name`/`full_name`/`title`/`subject`/`display_name`/`label` fallbacks). Removes the duplicate row that previously echoed the H1 (e.g. "客户名称: Acme Corporation") inside the field grid.

- 1911d34: **Phase P.1 — Collapse empty Related-list cards to header-only.**

  Previously each empty related list rendered a full Card with a 200px+
  "暂无相关记录" empty-state block (header + 32px icon + label +
  optional CTA). With 5-10 related objects mostly empty (common on
  fresh records), the Related tab became a wall of empty cards
  spanning 1500+ vertical pixels.

  Now: when a related list has zero records (and isn't loading), the
  CardContent is skipped entirely. The header row shows the title +
  `(0)` badge + an inline italic "暂无相关记录" hint + the `+ 新建`
  button (downgraded to ghost variant). A 200px empty card becomes a
  40px row.

  Lists with data are unchanged.

- ba98039: **Phase P.2 — Collapse CREATE event field-dump in History timeline.**

  CREATE events render every populated field as a `from: — → to: value`
  diff row. For a record with 20+ fields this turned the History tab
  into a wall of debug-looking `Field: — → value` lines.

  For `action === 'create'` we now render a single `▸ N fields
populated` disclosure that expands on click. The expanded view shows
  just `Field: value` (no useless `— →` arrow), since for a creation
  event the "from" is implicitly empty.

  UPDATE / DELETE events are unchanged — their field diffs are
  genuinely informative.

- 86c04f1: Phase Q: unify record-detail visual rhythm — one canvas, one box idiom.

  Audit revealed three competing chrome treatments fighting on the same
  page: the highlight strip was a filled Card, the discussion panel was
  another filled Card, the related-list cards used heavy borders — while
  the title chip, field grid, and history timeline were naked. The
  result was visually noisy ("有的下划线，有的有边框，有的没边框").

  This change commits to a single design language:
  - **Highlights** (`HeaderHighlight`): drop the `Card`/`CardContent`
    wrapper. Render as a borderless `<section>` of stat cells with a
    subtle `border-b` separator. The tab strip below now carries the
    only visible anchor in that vertical band.
  - **Discussion / activity feed** (`RecordActivityTimeline`): drop the
    `Card`/`CardHeader`/`CardContent` wrapper. Render as a borderless
    `<section>` with a top divider and a semantic `<header>` for the
    title. Right-side chatter panel still wraps with its own border so
    no chrome is lost in pinned mode.
  - **Related list** (`RelatedList`): keep the card grouping (each is a
    table of child records — earned chrome), but tone it down to
    `border-border/60 bg-transparent` so the boxes recede instead of
    competing with the rest of the canvas.

  Net effect: title / highlights / details / history sit on one
  continuous bg-background canvas separated by whitespace + hairline
  dividers; related lists are the one (subtle) boxed treatment, justified
  by their tabular content. No internal package APIs changed.

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

- 8b850b5: feat(detail): record:path chevron stepper + record:highlights surface refresh (Phase E)
  - `record:path` now renders Salesforce Lightning-style chevron segments
    (clip-path arrows + overlap) with a primary glow on the current step
    and a check mark on completed steps. On mobile (`<sm`) it falls back
    to a horizontally-scrollable pill row that keeps the same semantics
    but never overflows the viewport.
  - `record:highlights` surface drops the dashed border in favour of a
    solid `bg-muted/40` card with a softer border, so the highlights
    strip reads as a continuous extension of the header chip above it
    rather than a separate framed widget.

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

### Patch Changes

- f16a762: feat(plugin-detail): cross-object detail-page convergence polish (Phase J)

  Two regression fixes surfaced by the Phase J browser canary across CRM
  record detail pages:
  1. **`record:path` now localizes stage labels.** The renderer threads
     `useSafeFieldLabel().translateOptions` against the record-context's
     `objectName` + the schema's `statusField`, so picklist labels match the
     active locale instead of leaking English (`New / Contacted / Qualified`)
     onto zh-CN pages. Falls back to the schema's authored labels when no
     i18n provider is mounted.
  2. **`deriveHighlightFields` skips system + primary fields.** Adds
     `organization_id`, `workspace_id`, `tenant_id`, `created_by`,
     `updated_by`, `deleted_by` to the skip set so the synthesized highlight
     strip stops leaking an orphan "CRM Test's Workspace" chip with no
     visible field label. Also skips the object's `primaryField` and common
     title-field candidates (`name`, `full_name`, `title`, `subject`,
     `display_name`) so the strip never duplicates the page H1.

  `ObjectDefLike` gains an optional `primaryField` declaration to drive the
  new skip behavior. No spec changes; the field is already part of the
  upstream object schema.

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

### Minor Changes

- 06a4066: Mobile: render related sub-tables on record detail pages as a single-column
  gallery of cards (reusing the existing `object-gallery` renderer) instead of
  cramped multi-column tables. Non-first related sections start collapsed on
  mobile to keep the page scannable. Desktop behavior is unchanged. Touch
  targets on the section "+ 新建" button and header are enlarged on mobile.

## 4.7.0

## 4.6.0

### Patch Changes

- 8f490ad: test(perms): add field-level permission negative tests for DetailView
  and ListView. Mounts each consumer inside a `PermissionProvider` that
  denies read on a specific field and asserts the field never reaches
  the rendered DOM (sections, top-level fields, summary chips,
  constructed list columns). Closes the automated half of the Sprint 3-A
  "Known limitations" — backend enforcement is still required, but the
  client-side defence-in-depth is now regression-tested.

## 4.5.0

### Minor Changes

- ab5e281: `record:highlights` renderer normalizes rich field items.

  `RecordHighlightsComponentProps.fields` is now `Array<string | { name, label?, icon?, type? }>`. The renderer normalizes both forms before passing to `HeaderHighlight`, so schemas can attach per-instance label/icon overrides without editing the underlying object metadata. FLS and `redactFields` still apply on the normalized list.

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

## 4.4.0

### Patch Changes

- 67dabe1: feat(page-header): first-class `actions` property on page:header

  PageHeader now accepts an `actions: ActionDef[]` (or string[]) property
  and renders the toolbar inline in the header's right-aligned action slot.
  Removes the need for authors to declare a sibling `record:quick_actions`
  node and the `-mt-12` visual offset hack to pair the toolbar with the
  title. The hack still applies for legacy schemas using the sibling form
  (via location:'record_header'); the new in-header rendering opts out via
  an `inline: true` flag automatically set by PageHeader.

- e33d575: Support dotted paths (e.g. `{account.name}`) in object `titleFormat`. When a
  placeholder resolves to an expanded reference object, automatically extract
  its `name`/`label`/`display_name`/`title` so detail page titles render the
  related record's display name instead of falling through to the object label.

## 4.3.1

### Patch Changes

- 0d8eb98: feat(detail): Salesforce-style record header + section field grid
  - `page:header` now renders an icon chip (resolves Lucide names via
    `LazyIcon`) plus subtitle, so detail pages can show
    "Name / Company" without an extra component.
  - `record:details` normalises string field entries (`fields: ['email']`)
    into the `{name, label?}` shape expected by `DetailSection`, and maps
    section `label` → `title`. Schemas authored against `@objectstack/spec`
    now produce a real grouped field grid instead of an empty card.

- b0bc410: feat(detail): pair quick actions with header, suppress duplicate title chip
  - `record:quick_actions` placed at `record_header` now visually pairs
    with the surrounding `page:header` (Salesforce Lightning placement)
    instead of orphaning into its own row below the title.
  - `record:details` defaults to `showHeader: false` on the inner
    DetailView so embedded record pages no longer render a duplicate
    title chip + star/copy buttons under the page header. The legacy
    standalone DetailView screens are unaffected (showHeader defaults
    to true on that direct path).

## 4.3.0

## 4.2.1

## 4.2.0

## 4.1.0

## 4.0.12

## 4.0.11

## 4.0.10

## 4.0.9

## 4.0.8

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

## 4.0.6

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

## 4.0.4

### Patch Changes

- d2b6ece: fix: externalize all bare imports in library builds

  Library builds (vite lib mode) now externalize every non-relative import instead of bundling third-party CJS dependencies into the published dist. This avoids inlined `require("react")` / `require("react-dom")` calls that cause `Calling \`require\` for "react" in an environment that doesn't expose the \`require\` function` runtime errors when consumer apps re-bundle the published dist.

  Specifically fixes:
  - `@object-ui/plugin-dashboard` no longer inlines `react-grid-layout` (and its transitive `react-draggable` / `react-resizable` CJS bundles). `react-grid-layout` is now declared as a peer dependency so consumers install a single ESM-friendly copy.
  - `@object-ui/components`, `@object-ui/plugin-calendar`, `@object-ui/plugin-charts`, `@object-ui/plugin-designer` no longer inline `react-i18next` / `i18next` / `use-sync-external-store` CJS shims.
  - All plugin packages now use a unified `external: (id) => !/^[./]/.test(id) && !id.startsWith(__dirname)` rule, ensuring future additions of CJS deps are automatically externalized.

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

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

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/react@3.0.2
- @object-ui/components@3.0.2

## 3.0.1

### Patch Changes

- Updated dependencies [adf2cc0]
  - @object-ui/react@3.0.1
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
  - @object-ui/react@3.0.0
  - @object-ui/components@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0
  - @object-ui/react@2.0.0
  - @object-ui/components@2.0.0
