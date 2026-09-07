# @object-ui/react

## 17.7.0

### Minor Changes

- 1b1d772: Expression-bindable text keys: `statistic.value`, `card.title`, `button.label`
  and their siblings now evaluate `${...}` on the node (objectui#4795 Direction 1,
  maintainer ruling 2026-08-25).
  
  **What changes for you.** Four text keys — `title`, `label`, `value`,
  `description` — can now carry an expression written directly on the component
  node, on the component types that declare them:
  
  | Component | Bindable node keys |
  |---|---|
  | `statistic` | `label`, `value`, `description` |
  | `card` | `title`, `description` |
  | `button` | `label` |
  
  ```json
  { "type": "statistic", "label": "Active users", "value": "${data.metrics.active}" }
  ```
  
  That node used to render the literal text `${data.metrics.active}`. A dashboard
  `statistic` previously had no way at all to bind a dynamic number — the
  documented workaround (moving the key under `props`) evaluated the value and
  then discarded it, painting a blank card instead. Both shapes are fixed by the
  same change: the value is evaluated once, at the single place that produces
  evaluated schema, and lands where the renderers already read.
  
  **No component behaviour changed.** `statistic.tsx`, `card.tsx` and `button.tsx`
  are untouched — they always read these keys off the node; nothing was writing an
  evaluated value there.
  
  **Scope, and how it grows.** The list is closed and lives in
  `@objectstack/spec` (`EXPRESSION_BINDABLE_TEXT_KEYS_BY_COMPONENT`); the renderer
  reads that declaration rather than keeping a copy. On any other component type
  these four keys are still read raw, so an expression reaches the screen as
  literal text — notably `text`, whose `value` is read but has no declaration.
  Adding a type or a key is a change to the spec, never something the renderer
  infers.
  
  **Nothing is newly rejected.** This release only widens what evaluates; no
  metadata that used to render now fails to. The build-time rejection of `${...}`
  in undeclared keys — the second half of the same ruling — is not in this release
  and is still open.
  
  Published authoring guidance updated to match: `skills/objectui/rules/protocol.md`
  (new "Bindable Text Keys" rule), plus the `page-builder`, `schema-expressions`
  and `data-integration` guides, which taught the now-retired "never evaluated"
  statement and its host-pre-resolution workaround.
- 30c73cd: A `disabled` / `disabledOn` predicate that cannot be evaluated is now reported on the console, in development **and** in production — and the message says what this gate's fail-soft default actually did.
  
  `SchemaRenderer` routes six visibility legs (`visibleWhen`, `visible`, `visibleOn`, `visibility`, `hidden`, `hiddenOn`) through one reporter, and called `evaluateCondition` **bare** on the two enablement legs — the only uninstrumented predicate pair in the file. A faulting `disabled` predicate had therefore never been reported in any build, in any dialect that does not report on its own.
  
  It is also the pair whose fail-soft answer **bites**. `evaluateCondition` answers an unevaluable predicate with `true`; on the negated visibility legs that means SHOWN, here it means GREYED OUT. So the user got a control they could see and could not use, and the author got nothing to grep for.
  
  - **Wiring only, one engine call.** Both legs pass `EvaluationOptions.onFault` (objectui#6038's seam), which hands back the fault the evaluator has already caught. No `throwOnError`, no second evaluation, no `__DEV__` split — dev and production print identical bytes.
  - **No verdict moves.** The fail-soft `true` is preserved deliberately: a faulting `disabled` predicate still disables, exactly as before. Flipping that is a shipped-behaviour change and is not part of this.
  - **Its own copy, not the visibility reporter's.** The shipped line says the safe default meant the gate "did NOT bite", which is written about a gate that shows the node. This gate's line says the opposite, because the opposite is true: `[ObjectUI] An enablement predicate could not be evaluated`, then the node, the key, the source, the engine's reason, and that the node renders disabled — on screen, greyed out — with nothing else on screen to say a predicate failed. One reporter, one dedupe, one severity; a second message.
  - **Rate-limited exactly as the visibility gate is**, per `(node type, key, predicate source)`: two hundred rows of one broken predicate print one line, a second distinct source still prints, and the same source authored on `disabled` and on `visibleWhen` prints two — the gates cannot silence each other.
- 830ed58: The record page's approval band offers its **Recall** button to the approval's submitter
  only (objectui#6464).
  
  Field report on `@objectstack/*@17.2.0`: user A submits a record into a 4-level approval;
  user B — not the submitter, read access, not an admin — opens the record and the band still
  lights a clickable recall button. The click cannot succeed. The recall endpoint authorizes
  on submitter identity and refuses everyone else, so the only outcome available to that
  button was a failure toast. Record state was never at risk; this was purely a
  writability-feedback mismatch, the same family as objectui#3794.
  
  The button's only gate was `dataSource.cancelPendingApproval` — "can this adapter recall at
  all" — which is a question about the DataSource, not about the viewer. Identity now joins
  it, threaded the way every other signal on that band already travels: the HOST resolves it
  and passes it through `InlineEditProvider`, so the renderer stays DataSource-agnostic and
  never re-derives who submitted what.
  
  - `@object-ui/react` — `InlineEditProvider` accepts `approvalIsSubmitter`, surfaced on
    `InlineEditContextValue`. Additive and optional; no existing prop changes.
  - `@object-ui/plugin-detail` — the band's recall button is withdrawn when that signal is a
    resolved `false`.
  - `@object-ui/app-shell` — `RecordDetailView` resolves the verdict from its existing
    approvals read and threads it.
  
  **The signal is tri-state, and the third state is the load-bearing one.** `true` offers
  recall, `false` withdraws it, and **`undefined` — a host that resolves no approval identity
  — renders exactly as it did before this release.** Omission preserving prior behaviour
  mirrors how `approvalPending` falls back to `locked`. Defaulting the unknown case to "hide"
  would have traded a cosmetic defect for a functional loss: every host whose band runs off
  the record's `approval_status` mirror alone would silently lose its submitter's only way to
  unlock their own record.
  
  **Withdrawn rather than disabled-with-reason.** The card offered either. For a
  non-submitter this control is never actionable on any pending record, so a permanently
  disabled button is standing clutter rather than a lesson; and the two sibling submitter
  levers already hide — the approvals panel's Remind button, and the declared
  `approval_recall` action's `visible` predicate. The band, its quorum tally and the
  approvals timeline still tell a non-submitter exactly what state the record is in. Only the
  lever they can never pull is gone.
  
  **This changes no permission.** Nothing about what the server allows moves, `canEdit` and
  the approval lock are untouched, and nothing downstream reads `approvalIsSubmitter` as an
  authorization verdict — the recall endpoint remains the sole authority, and it refused
  these callers before this change and refuses them after. There is deliberately **no admin
  carve-out** (the reporter ruled that case out, cf. objectstack#9464).
  
  The derivation itself is now one function, `isSubmitterOf` — server-resolved
  `viewer.is_submitter` first (framework#3310), an id comparison as the fallback for backends
  that predate it, joined with `??` so a server that resolved `false` is believed rather than
  re-litigated client-side. The approvals panel's Remind gate, which already carried that
  expression inline and whose behaviour is unchanged, now reads the same answer: two copies
  would have been two definitions of who submitted.
  
  The **untranslated refusal text** the reporter also saw ("No pending approval request found
  for this record", concatenated after a localized prefix) is a separate defect and is not
  addressed here; it is tracked on objectstack#11993.
- c71e14d: **The unresolvable-visibility-predicate report now names the roots of the tier the
  predicate was actually evaluated against** (objectui#6487). An app-shell author
  whose nav, area or field `visible` faulted was told to check `record` and
  `page.<var>` — two roots that tier does not bind at all.
  
  `formatUnresolvableVisibilityMessage` and `reportUnresolvableVisibilityPredicate`
  (both exported from `@object-ui/react`) take a new **optional sixth argument**, a
  `PredicateScopeTier` — also exported — selecting the closing advice paragraph.
  Everything above that paragraph is unchanged on every surface, and so is every
  verdict: this is diagnostics copy only.
  
  **The published signature grew; nothing existing breaks.** The argument defaults
  to `'page-component'`, so a five-argument call keeps printing the bytes it
  printed before. All three in-repo call sites pass their tier explicitly rather
  than lean on that default.
  
  Each tier's root set was derived from the code that builds the bag, not from the
  prose that described it:
  
  - **`'page-component'`** — `SchemaRenderer`'s node gate and `page:tabs` item
    predicates. Both bind `record`, `current_user` and `page.<var>` (the roots
    `@objectstack/spec`'s `ui/page.zod.ts` declares for the tier). Its paragraph is
    byte-for-byte what it was.
  - **`'app-shell'`** — the chrome gate `ExpressionProvider.evaluateVisibility`
    runs, wired onto this reporter by objectui#6443. Its evaluator is built from
    `{ current_user, user, ctx: { user }, os: { user }, app, data, features }`, so
    the line now names `current_user` with its three ADR-0068 alias spellings,
    `app`, and `features` — the deployment-flag root that provider documents for
    exactly this kind of predicate — and states outright that `record` and
    `page.<var>` do not exist there.
  
  **Why not generalise the copy instead.** Dropping the concrete root names would
  have made one paragraph true everywhere at the cost of making it useful nowhere:
  an author who mistyped a root needs to know which roots exist *at their tier*,
  which is the whole reason the paragraph is read.
  
  `data` is bound at the app-shell tier but is deliberately not advertised there —
  every mount of `ExpressionProvider` in this repo passes `data={{}}` or omits it,
  so naming it would point an author at a root that answers nothing.
- 748494b: The unresolvable-predicate diagnostic tells `hidden` / `hiddenOn` authors what actually
  happened to their node (objectui#6503). Those two legs are the only ones in
  `SchemaRenderer`'s visibility chain whose verdict is NOT negated: `evaluateCondition`
  answers an unevaluable predicate with `true` on every path, the four negated legs turn that
  into SHOWN, and these two return it as-is, so the same `true` sets `_hidden` and the
  component returns `null`. Both were handed the consequence paragraph written for the negated
  legs — "the gate did NOT bite - a predicate that cannot be evaluated reads on screen exactly
  like one that said yes" — which is the opposite of what an author whose block VANISHED is
  looking at. That line exists to name their predicate, and instead it sent them to hunt a
  rendering bug that does not exist.
  
  The two legs now print their own paragraph: the safe default is the one that BITES here, the
  node was REMOVED and is not on the page at all, an absent node is indistinguishable from
  metadata that meant to hide it, and nothing is wrong with the renderer.
  
  Copy only — no verdict moved. The node still vanishes, which is the shipped fail-soft the
  neighbouring family (objectui#3862 / #3955 / #6443 / #6487 / #6445) preserved deliberately,
  and every case in the new suite pins the verdict beside the sentence.
  
  `PredicateGateKind` — re-exported from `@object-ui/react`'s entry — gains a third member,
  `'concealment'`, joining `'visibility'` and `'enablement'`. The opening line is deliberately
  UNCHANGED (`UNRESOLVABLE_VISIBILITY_PREFIX`): these are visibility predicates, and an app or
  a test filtering the console by that constant must go on catching them. Consumers that
  switch EXHAUSTIVELY over the union, or key a `Record` by it, gain a third case to answer;
  no runtime signature moved and every value accepted before still is.
- dc4365c: Retire the discovery-wire preview mode — the console no longer turns
  authentication off because a server said `mode: 'preview'` (objectui#6654).
  
  `@objectstack/spec` retired the `RuntimeMode` value `'preview'` and the whole
  `PreviewModeConfig` block (objectstack#11846). This console still read that
  surface back off the runtime discovery payload, which is a different layer from
  the retired compile-time type — so the consumption could not simply be assumed
  dead, and its removal was ruled deliberately (2026-08-29).
  
  - `ConditionalAuthWrapper` (`@object-ui/app-shell`) drops the branch gated on
    `discovery.mode === 'preview'`. That branch called `setAuthEnabled(false)` and
    simulated an identity out of `discovery.previewMode`, every field behind a
    default. Auth availability is now decided **only** by the ADR-0076 D12 service
    reading (`isServiceUsable(discovery.services.auth)`), exactly as for any other
    mode.
  - `DiscoveryInfo` (`@object-ui/react`) drops the `previewMode` block and stops
    documenting `'preview'` as a runtime mode; the package README's discovery
    section is updated to match.
  
  **Accepted failure direction:** a deployment that still emits `mode: 'preview'`
  or a `previewMode` block now falls back to the ordinary auth reading — it
  requires login. That is loud, diagnosable and more secure than keeping a dormant
  auth-off path keyed on a spelling the platform no longer produces.
  
  **Not affected:** `AuthProvider`'s `previewMode` prop, `useAuth().previewMode`
  and `PreviewBanner` in `@object-ui/auth` are a separate published capability
  with a different producer (a host passing the prop). Only the discovery-wire
  producer of that prop is retired; hosts that pass it explicitly are unchanged.
- e321d52: `useSchemaPersistence` refuses to save a schema carrying function-valued keys
  (objectui#6658).
  
  The designer save door handed the schema straight to `JSON.stringify`, which
  does not preserve a function value and says nothing about it: an object key is
  **dropped**, an array element is **coerced to `null`**. No throw, no warning.
  `save()`
  resolved with the id, `error` stayed null and `lastSavedAt` advanced, so every
  observable signal reported success while the stored schema had quietly lost the
  handler. The failure ordering was the bad one: loss at save, symptom at render
  or click, arbitrarily later, in a different component, with no link back.
  
  Per the 2026-08-29 maintainer ruling on objectui#6658, the door now refuses such
  a save instead of performing a lossy one:
  
  - `save()` walks the schema for function-valued keys **anywhere** in it —
    nested objects and array elements included — before serialization.
  - On a hit it sets `error`, returns `null`, leaves `lastSavedAt` and `isDirty`
    untouched, and never reaches the adapter. The message names the exact
    offending key paths (`columns[2].cell`, `toolbar.actions.onExport`) and both
    escapes: strip the callables before saving, or use the declarative form.
  - The guard sits at the **hook layer**, not inside the default localStorage
    adapter, so a host-injected or REST adapter is covered too — the documented
    REST adapter has the identical `JSON.stringify` shape, so a host following
    the docs inherited the behaviour rather than escaping it.
  
  True lowering (objectstack's server-side `lowerCallables`) is recorded as
  unavailable at a browser door: functions cannot round-trip storage without a
  code registry, so refusal is the honest shape.
  
  Behaviour change for hosts that previously saved callable-bearing schemas —
  those saves were already losing the callables and now fail loudly instead.
  Fully declarative schemas are unaffected and store byte-identically to before.
  No published type or signature changed.
- 3beef6d: The spec's `dataSource` element binding is now DECLARED by the blocks that read
  it, so the html tier stops reporting the one working saved-view spelling as
  `unknown-prop` (objectui#6678).
  
  `PageComponentSchema.dataSource` — `{ object, view, filter, sort, limit }` — is
  the one spelling that resolves a saved view for an object-bound block. It works,
  and it drew the identical `unknown-prop` warning as the two spellings that do
  nothing (`viewName`, `view`), because `validateTree` looks a prop up in the
  block's declared `inputs` and no registration declared this key. On the tier
  built to accept AI-authored pages, where the diagnostic IS the contract, the
  only signal pointed away from the key that works.
  
  Adopting the maintainer ruling of 2026-08-29 — option B **in the injection
  form**:
  
  - `ELEMENT_DATA_SOURCE_INPUT` is the single declaration, in `@object-ui/core`
    beside the binding's own semantics; `Registry.register` emits it for any
    registration whose renderer passed through the new `elementDataSourceBlock()`
    seam. One mechanism, one copy — not a hand-kept declaration per block, which is
    the shape that drifts and that a new block forgets. The seam lives in
    `@object-ui/core` and is re-exported by `@object-ui/react` beside
    `ElementDataSourceGate` for discoverability; call sites take the core import,
    because a registration runs at module scope and this repo's suites partially
    mock `@object-ui/react`.
  - Seventeen renderers, in thirteen files across twelve packages, reach the seam
    and now publish the key to the save gate, the parser whitelist, the generated
    JSX authoring types and the block list. The card named nine blocks; the tree
    also has `plugin-grid`, `plugin-timeline`, two further `plugin-form` blocks and
    `element:record_picker` — nothing was hand-listed, so the mechanism covered
    them. `element:record_picker` consumes the gate's HOOK and status panels rather
    than the wrapper tag (its object lives under `properties`), and was found by a
    render probe rather than by reading sources.
  - `dataSource` on a block that does NOT read it (`flex`, `card`) still reports
    `unknown-prop`. Adding the key to `sdui-parser`'s `BASE_PROPS` was refused for
    exactly this reason — that set mirrors `BaseSchema`, and silencing the key
    everywhere would make the diagnostic lie in the other direction.
  - New `check:element-data-source-declaration` fails any source that consumes the
    gate without reaching the seam, so a block added tomorrow cannot forget.
  
  Behaviour of the binding itself is unchanged — this is a declaration, not a
  resolution change. The saved view still resolves its columns, and an
  unresolvable `view` still fails loudly rather than widening to the object's full
  scope.
  
  The spec/registry parity gates (repo-wide and the `record:related_list` per-block
  pin) now derive their accepted set from the WHOLE node contract rather than from
  `ComponentPropsMap[type]` alone. `PageComponentSchema` accepts and keeps
  `dataSource` on a page-component node — it is a node-level key, a sibling of
  `type` and `className`, not a per-block prop — so the gates' previous complaint
  was measurably wrong. Derived from the spec, not exempted, and both still
  discriminate against an invented key.
- 26896c6: `element:*` renderers stop re-reading a degenerate config bag as its own character indices — the third and last channel of the objectui#6752 / objectui#6760 hazard (objectui#6783).
  
  Five modules under `packages/components/src/renderers/basic/` — `elements.tsx`, `data-list.tsx`, `text-input.tsx`, `record-picker.tsx`, `metadata-viewer.tsx` — each carried a copy of the same reader, `{ ...(schema?.props ?? {}), ...(schema?.properties ?? {}) }`. `??` only replaces `null`/`undefined`, so a non-object bag went into the object spread and came back out as indexed keys: for `properties: 'not-a-bag'`, the config bag a renderer received was `{ '0': 'n', '1': 'o', … '8': 'g' }` — nine keys nobody authored. The five copies are now one `readProps` (`renderers/basic/readProps.ts`) that asks `isConfigBag`, and a degenerate bag on either side contributes no keys.
  
  `@object-ui/react` exports `isConfigBag` from its package entry. That is the API addition here, and it is the reason the fix is not a sixth spelling of the predicate: objectui#6761 converged six occurrences of "is this a real config bag?" behind one definition in `packages/react/src/utils/configBag.ts` and pinned it, but the pin scans `packages/react/src` only — a copy written one package over would be invisible to it. `@object-ui/components` already depends on `@object-ui/react` (all five modules import from it today), so the reachable answer was to publish the definition rather than retell it. Same reason the node-gate predicate reporter is exported at that entry (objectui#6038): one definition, read by every package that asks.
  
  **What this does not change, measured rather than predicted.** No rendered output moves on today's tree. All five renderers read named keys off this bag, and the single onward spread — `metadata-viewer`'s `<StateMachineView {...props} />` — hands it to components that destructure named fields, so the indexed keys were computed and then dropped. The census behind objectui#6708 found zero authored nodes carrying a degenerate config bag, so this was a latent shape, not a live failure. What the guard buys is what objectui#6752 measured its own guard buys, one channel further down: the authored value's shape is not reinterpreted. objectui#5123's precedence is untouched — `properties` still wins a contested key, and a degenerate bag declares no key for either side to win.
- b87f15b: `useOffline` auto-syncs mutations queued while already online (objectui#6818).
  
  The auto-sync effect was keyed `[isOnline, enabled]` with
  `react-hooks/exhaustive-deps` suppressed, so its `queue.length === 0` guard was
  evaluated against the queue as it stood when `isOnline` or `enabled` last
  changed. `queueMutation` has never been conditional on being offline — it
  accepts entries whenever the hook is enabled — so anything queued while ALREADY
  online found the effect asleep, and nothing re-ran it. Only an explicit `sync()`
  drained those mutations; the hook whose job is auto-sync did nothing for them.
  
  The suppression's stated reason ("only trigger on `isOnline` changes, not on
  every queue change") was about TIMER RESTARTS, and it is kept: the effect is
  keyed on the **boolean** `queue.length > 0`, never on `queue` or `queue.length`,
  so queueing a second mutation while the 100ms stabilization timer is already
  armed still does not re-run the effect or restart the timer. What the
  suppression never justified — the early return against a stale snapshot — is
  what changed.
  
  `sync` also read `batchSize` through a ref (newest) while reading `queue` from
  its own closure (a snapshot), so the two halves of one call disagreed about how
  current they were, and the auto-sync effect retains such a closure by design.
  The queue now reaches `sync` through the same commit-phase mirror the sync
  config uses, so both halves are the newest committed values. That also takes
  `queue` out of `sync`'s dependency list: `sync` is keyed `[enabled]` and is
  stable across queued mutations, which is what lets the effect name every value
  it reads and drop the `eslint-disable` entirely rather than reword it.
  
  **Behaviour change, graded `minor` deliberately.** `useOffline` is published and
  its out-of-repo population is unmeasured; the single in-repo caller
  (`AppHeader`) destructures `isOnline` only and is unaffected. A consumer that
  called `queueMutation` while online and relied on nothing being sent until it
  called `sync()` itself will now see that mutation flushed ~100ms later.
  `sync`'s identity is also more stable than before — it no longer changes on
  every queued mutation — which is safe for effects keyed on it but is a visible
  difference.
  
  Not changed here: a `batchSize` smaller than the queue still drains one batch
  and leaves the remainder for the next transition, because whether one auto-sync
  should chain batches until the queue is empty is a separate question about what
  `batchSize` means, not about this guard. Filed as objectui#6857.
- 03380aa: Inline edit: a rejected save now says WHICH field the server refused, and why.
  
  Editing a record in place on a detail page and hitting Save used to surface the
  backend's own string when the write was refused — `VALIDATION_FAILED:
  Validation failed for crm_opportunity` — leaving the user to guess which of the
  fields they had just edited was the problem. The refusal has always been
  field-scoped (`@objectstack/objectql`'s validators throw `VALIDATION_FAILED`
  with `fields[]`, and both the REST layer and the runtime dispatcher pass those
  entries through intact); the inline surface was the last one still dropping
  them. `<InlineEditSaveBar>` now renders one reason per rejected field, named by
  that field's own label — the same treatment record forms have had since #3222.
  
  Attribution never guesses. It reads the envelope through
  `@object-ui/react`'s `extractFieldErrors`, the single in-repo normaliser the
  form surface already uses, and an entry with no usable `field` is dropped
  rather than pinned on whichever input is nearby. In the drawer's callback mode,
  where persistence loops `onFieldSave(field, value)` one key at a time, a
  rejection is attributed to the key that was in flight — a fact about the write,
  not an inference. Anything that is not field-scoped (a network failure, a
  permission denial) keeps the cleaned single-line message it had before.
  
  `@object-ui/react` gains one additive public API member to carry this, and it
  is the reason that package's entry is `minor` rather than `patch`:
  `InlineEditContextValue` now has **`fieldErrors`** — a nullable map of field
  machine name to the server's reason — alongside a **`setFieldErrors`** setter,
  the exact companions of the `error` / `setError` pair that interface already
  carried. Nothing is removed and nothing changes shape, so every existing host
  and consumer compiles and behaves as before; a host that never reads the new
  member sees no difference. It exists because the save bar and the field rows
  are SIBLINGS under `InlineEditProvider` in both persistence modes, so before
  this there was no channel between the component that receives a refusal and the
  components that render the fields it is about.
  
  Also recorded in code, per the maintainer's ruling on objectui#6868: **the
  server is the validation authority on the inline-edit surface.** That was
  previously an absence — `InlineFieldInput` runs no rules and takes no `error`
  prop — and it is now a decision, written into both modules' headers with a
  pointer to the ruling. No client-side rule evaluator was added, and none should
  be: the server is the only rule source, and this surface only presents it.
- 7c3df8f: A non-grid view's fetch now carries a platform row ceiling, and crossing it is
  never silent (objectui#7210, maintainer ruling a′, 2026-09-02).
  
  Before this, `ObjectGantt`, `ObjectCalendar`, `ObjectMap` and `ObjectTree` each
  issued a `find` with **no `$top` at all**, so the request returned the entire
  filtered result set. At the 186 rows the card was filed from that is invisible;
  on an object with 100k scheduled rows it is the whole table into the browser,
  and nothing an author could write — `pagination.pageSize` included — could
  bound a request that never carried a cap to begin with.
  
  **What changed.** Those four fetches now ask for `NON_GRID_ROW_CEILING_TOP`
  rows, draw at most `NON_GRID_ROW_CEILING` of them, and when the result set was
  larger they render a footnote naming both numbers, verbatim as it renders:
  *"Showing the first 2000 of 41234 records. Narrow the filter."* Below the
  ceiling nothing changes: the full set draws and no footnote appears.
  
  The four view packages take a **minor**, not a patch: a result set above the
  ceiling is no longer drawn in full, which is a behaviour break whatever the
  fixed group does to the released version number.
  
  **The ceiling is a platform constant, not an authorable key** — `2000`, exported
  from `@object-ui/react` as `NON_GRID_ROW_CEILING`. An authored `limit` or
  `dataSource: { limit }` still does not reach these queries, by the same ruling;
  three alternatives were rejected with it (a documentation note only — still the
  whole table; truncating at `pageSize` — silent, and a complete schedule capped
  at one page; an authorable `maxRows` — a new permanent key every author sets).
  
  **Why 2,000.** One constant for all four, so the binding view sets it. Measured
  in this repo's jsdom lane: gantt, calendar and map hold their DOM flat as rows
  grow (virtualised task list; four events per day cell; auto-clustering above
  100 markers), while `ObjectTree` flattens every expanded node into the document
  at a linear **5.2 DOM elements per record** with no virtualisation. 2,000 rows
  is where the worst of the four lands at ~10,400 elements — an order of
  magnitude above Lighthouse's "excessive DOM size" warning, and still ~10x the
  real application result set this card came from.
  
  New exports on `@object-ui/react`: `NON_GRID_ROW_CEILING`,
  `NON_GRID_ROW_CEILING_TOP`, `applyNonGridRowCeiling`, `NonGridRowCeilingNote`
  and the type `NonGridCeilingResult`. Two new `common.*` i18n keys carry the
  footnote copy in all ten packs.
- b041b9c: `@object-ui/core` publishes `resolveRecordSourceObjectName`, the ONE reader for "which
  object is this block bound to" (objectui#7627).
  
  Six view plugins each spelled that resolution locally — `ObjectCalendar` twice,
  `ObjectGantt`, `ObjectTree` twice, `ObjectMap`, `ObjectGrid` — and had drifted: three
  wrote `?? schema.objectName`, one `|| ''`, one `: undefined`, one an `'object' in
  dataConfig` test. They now delegate to one function that states the published
  objectui#6939 record-source ladder (`data`, then `staticData`, then `objectName`) once.
  
  **No behaviour changes.** Each site's pre-collapse expression is transcribed verbatim
  into `record-source.behaviourNeutrality-7627.test.ts` and asserted equal to its
  post-collapse spelling across the whole contract-valid input matrix — both bindings
  present, data only, `objectName` only, empty `objectName`, empty `data.object`, the
  `api` / `value` / `staticData` / array-shorthand providers, and nothing bound.
  
  **Two questions stay two questions.** `normalizeListViewSchema`'s gap-fill (#7477,
  ruling B of PR #7628) is untouched and is NOT re-pointed at the new reader: it answers
  how `objectName` gets POPULATED when absent, where an already-present `objectName` wins.
  The new reader answers which object a block RESOLVES, where the `data` block wins — the
  order declared on both published faces in `@object-ui/types` and pinned by
  `objectql-record-source-refinement-6939.test.ts`. Merging them would silently override
  one standing ruling or the other.
  
  **`ObjectGantt`'s `persistLayoutKey` is deliberately excluded** and keeps its inverted
  order, with an in-place comment saying why: its receiver is a localStorage key
  (`gantt-layout:KEY:filters`), not a record source, so re-pointing it would orphan every
  saved layout and filter-chip set of a view carrying both bindings. Two more sites the
  finding listed are not object-name readers at all and were struck: `ObjectGantt`'s
  refresh-handler predicate (`object` OR `api`) and `plugin-dashboard`'s `isObjectProvider`
  type-guard over a widget's `data`.
  
  `useSettledSchema`'s doc comment stops prescribing the hand-written ladder at all four
  lines that taught it, so the copies cannot re-seed from the hook that replaced them.
- 0ea7054: Remove 37 runtime dependencies that no file in the declaring package consumes, and gate
  the direction so the next one cannot land (objectui#8198).
  
  `check:phantom-deps` judges imports that are not declared; nothing judged the reverse,
  so a declaration could outlive its last consumer indefinitely. That is what happened to
  `recharts` in `@object-ui/components` after objectui#7397 deleted its only importer — it
  was removed by hand on objectui#7625, and nothing would have reported the next one. The
  new `pnpm check:unused-deps` asks the reverse question over `dependencies` and
  `optionalDependencies` of every released package.
  
  **Potentially breaking, for consumers relying on hoisting.** Nothing these packages ship
  changes: their Vite `external` predicates are path-based and never read `dependencies`,
  so no built artifact moves. What changes is the install graph — a project that imports
  one of the removed packages while depending only on the ObjectUI package that used to
  drag it in will no longer resolve it. Declare it directly; that is the correct
  dependency edge in either case. The removals, by package:
  
  - `@object-ui/plugin-designer`: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@object-ui/fields`
  - `@object-ui/plugin-chatbot`: `react-markdown`, `react-syntax-highlighter`, `remark-gfm` (and the orphaned `@types/react-syntax-highlighter`)
  - `@object-ui/plugin-report`: `@object-ui/plugin-grid`, `clsx`, `react-i18next`, `tailwind-merge`
  - `@object-ui/plugin-map`: `@objectstack/spec`, `lucide-react`, `zod`
  - `@object-ui/runner`: `class-variance-authority`, `clsx`, `tailwind-merge`
  - `@object-ui/core`: `lodash`, `zod`
  - `@object-ui/layout`: `clsx`, `tailwind-merge`, and `react-dom` — which it pinned at an exact version in `dependencies` while also declaring it as a peer range, i.e. a library hard-depending on the renderer it asks its host to supply
  - `@object-ui/plugin-dashboard`: `clsx`, `tailwind-merge`, and the same `react-dom` defect
  - `@object-ui/plugin-ai`: `@object-ui/react`, `clsx`, `tailwind-merge`
  - `@object-ui/fields`: `clsx`, `tailwind-merge`
  - `@object-ui/console`: `@object-ui/react-runtime`, `sucrase`
  - `@object-ui/auth`: `@object-ui/types`
  - `@object-ui/plugin-calendar`: `@object-ui/fields`
  - `@object-ui/plugin-editor`, `@object-ui/plugin-markdown`: `@object-ui/react`
  - `@object-ui/react`: `react-hook-form`
  
  Every one was verified by a whole-package grep before removal — the name appeared nowhere
  under the package but its own manifest and CHANGELOG — and the whole workspace builds,
  type-checks and tests green afterwards.
- ae61ad4: The console form now renders a refusal message the producer explicitly marked
  as user-facing, instead of always substituting a generic string
  (objectui#5210).
  
  An application's hook guards could not talk to their users. When a hook refused
  a write with 403, the form replaced the server's text with
  `form.noPermissionToSave` unconditionally — the recorded objectstack#3821 fix,
  which exists because a raw refusal body puts untranslated platform diagnostics
  (`FORBIDDEN: insufficient privileges to update showcase_private_note
  pi-TgoJ4_DM55Fqz`) in front of end users. The external report behind this change
  had 11 guards whose deliberate, localized guidance — which role owns the action,
  whom to ask — never reached anyone, and named the incentive that creates:
  returning 400 instead of 403 for permission failures, degrading the status
  semantics logs, monitoring and API consumers depend on.
  
  The maintainer ruling (2026-08-19) was a producer-side opt-in rather than a
  chattier 403 branch, and the platform half shipped as objectstack#9934: a hook
  marks its refusal text with `userMessage` at throw time. This is the consumer
  half.
  
  - `@object-ui/react` gains `declaredUserMessage(err)` — the one "is this
    marked?" read. It answers the marking verbatim, from the two places the
    adapter boundary parks the envelope (the error itself, where
    `@objectstack/client` lifts it, and `details`), and `null` for everything
    else.
  - The form prefers a marked message over both its generic strings, on ANY
    status — the marking is status-agnostic; 403 is where this was reported, not
    a fence the contract draws.
  
  **Unmarked refusals are unchanged**: a 403 with no marking still shows the
  generic `form.noPermissionToSave`, and the raw text still goes to the browser
  console only. objectstack#3821's protection is preserved by construction, not
  by re-guessing which 403 bodies are presentable — the mark and the marked text
  are one field, so no boundary that rewraps or substitutes `message` can promote
  platform prose into the user-facing channel, and platform code never sets it.
- ebce5a3: `object-grid` / `object-form` / `detail-view` resolve their data source the same way, and a block that resolves none says so
  
  The three object-bound blocks disagreed about how the data-source adapter reached
  them. `object-grid` and `object-form` were registered through wrappers that read
  it from `SchemaRendererProvider` context; `detail-view` was registered as the raw
  component, which reads a React `dataSource` prop. `SchemaRenderer` itself reads
  only context, so the two wirings were mutually exclusive: measured with correct
  keys in every cell, provider wiring gave the grid `find` 1 and the detail view
  `findOne` 0, and prop wiring gave exactly the reverse. Neither reported anything.
  
  All three now resolve the adapter through one rule — an explicit `dataSource`
  prop first, the provider context second. This is additive: `detail-view` keeps
  its prop form (and direct `<DetailView dataSource={…} />` callers are untouched),
  `object-form` gains a prop form it did not have, and `object-grid` no longer
  throws `useSchemaContext must be used within a SchemaRendererProvider` when a
  page has no provider.
  
  And the silence is over. A block in this family that resolves no adapter renders
  a **No data source resolved** panel naming the block, the object it was about to
  read, and the ancestor that injects the adapter — instead of a header-only grid,
  a field-less form card, or nothing at all. The check is opt-in per block, so a
  placement with inline rows, inline `customFields`, an inline record or an `api`
  endpoint is untouched.
  
  New from `@object-ui/react`: `useResolvedDataSource`, `NoDataSourcePanel`,
  `noDataSourceMessage`, and a `requiresDataSource` prop on `ElementDataSourceGate`.
- cac64b3: The spec-bridge's form-view input now accepts everything `@objectstack/spec`'s
  FormViewSchema accepts — three key types had drifted narrower, and one of them
  had inverted (objectui#5652).
  
  `bridges/form-view.ts` held a third hand-written description of the FormViewSchema
  contract, after the leaf (objectui#5542) and the two containers (objectui#5596)
  were converged elsewhere. A description nothing compares is one spec release from
  being a fork, and this one had already drifted on the keys that decide whether a
  legal document renders:
  
  - `FormSection.columns` refused the string spelling of a column count, which the
    contract admits and folds to a number in its own pipe. It is now the contract's
    type, and the bridge performs the fold — the `object-form` node's section
    declares `columns` as a number and its container indexes a grid-class map by
    it, so forwarding `'2'` handed every downstream renderer a value outside the
    type it declares.
  - `FormField.dependsOn` was declared `string[]`, which is the exact inverse of the
    contract: it admitted only the array arm the contract rejects, and refused the
    bare parent-field name that is the one configuration making `field-selector`
    and `dynamic-config` work (objectui#5040).
  - `visibleWhen`, on both fields and sections, was declared `string`, so the
    ADR-0089 expression object — the arm `evalFieldPredicate` reads — could not be
    described at all. Both arms now travel whole onto the node.
  
  A section's `fields` may also be a bare object-field name, the spec shorthand the
  list bridge already honours. The form bridge ran it through the object mapper
  instead, producing a field with no identity (`{ name: undefined }`) for the most
  ordinary section a form can declare; it is now forwarded verbatim, which is what
  the node's own `fields` slot admits.
  
  Each drift-prone key's type is now bound to the `@objectstack/spec` symbol that
  owns it rather than restated, so it cannot drift again, and the compile-time pins
  in `FormViewWidenedArms.test.ts` fail if a future edit restates any of them by
  hand. The documented subset itself is unchanged: the keys this bridge does not
  declare, including the retirement ledger it keeps, stay exactly as they were.
- bf28341: refactor(spec-bridge): retire the spec-bridge — `SpecBridge`, `bridgeListView`, `bridgeFormView` (#6366)
  
  Removed under the 2026-08-27 maintainer ruling on #6366 (Option A — remove, and
  for `SpecBridge` as a WHOLE, not just the form half), on the same criteria the
  17.0.0 entry used to remove `bridgePage` / `bridgeDashboard`: no runtime
  consumer, and a route that could not deliver a working result even in
  principle. The stage-1 measurement (2026-08-26, PM-verified) the ruling rests
  on:
  
  - **Zero consumers at every reachable endpoint** — no non-test caller in this
    repo, none in the sibling `objectstack` repo (which does not depend on
    `@object-ui/react` at all), and a GitHub-wide public code search returning
    hits only inside this repository. External npm-private hosts are
    unmeasurable from here; the ruling records fallback C (keep + document the
    boundary) should evidence of one ever surface.
  - **The bridged form route was structurally unable to work**: a bridged node
    carries neither `objectName` nor `customFields`, so `ObjectForm` takes the
    branch its own code labels "cannot proceed" and renders, in the registry
    wrapper's words, "a field-less card in silence". The only working host
    recipe (`{...node, objectName: '...'} as any`) existed solely inside the
    list bridge's integration tests and was documented nowhere.
  
  This knowingly reverses the 17.0.0 changelog line "The `list` and `form`
  bridges are unaffected and remain the live authoring path" — by maintainer
  ruling, on the same measurement criteria that entry itself applied.
  
  #5898's restored-key work on the form-view bridge (the
  `FormViewSpecConformance` suite and the spec keys it carried onto the bridged
  node) is **superseded by this removal, not fixed** — the route it repaired is
  gone. #6366's measured type-vocabulary asymmetry (a bridged field carrying
  `text` where the normalizer produces `field:text`) is likewise mooted rather
  than repaired.
  
  The suites pinning the removed route go with it — retirement of a route
  nothing travels, not quarantine: the seven suites under
  `react/src/spec-bridge/__tests__/`, and plugin-grid's
  `specBridgeColumnSpelling` / `specBridgeExportFormats` render-integration
  suites. `ObjectGrid`'s own column-spelling, export-gate and density behavior
  keep their non-bridge pins (`columnDeclaredSpellingOnly`, `exportGate`,
  `exportServer`, `rowHeightOffSpecBoundary`, and core's
  `normalize-list-view` suite).
  
  BREAKING CHANGE: the public exports `SpecBridge`, `bridgeListView`,
  `bridgeFormView` and the types `BridgeContext` / `BridgeFn` / `ObjectDefLite`
  are removed from `@object-ui/react`. There is no replacement translation
  layer — author `object-grid` / `object-form` nodes directly (the live path is
  `app-shell`'s `ObjectView`, which builds them from the object's own metadata),
  exactly as the 17.0.0 entry already directed for pages and dashboards.
- 83fe6e7: row predicates on runtime record surfaces resolve `record.*` only; the bare-field and `data.*` spellings are no longer bound
  
  Phase 2 of the row-predicate canon (objectui#5330, ruled 2026-08-20, option B;
  Phase 2 ruled 2026-09-02 and amended 2026-09-05 on objectui#5741). Until now a
  row predicate — `visible` / `disabled` / `enabled` on an action renderer, a row
  action, a `record:alert`, a `page:header` action, a conditional-formatting
  `condition` — bound the row three ways: canonical `record.status`, bare
  `status`, and `data.status`. The two non-canonical spellings are retired on
  every runtime record surface, in both evaluation tiers (`evalRowPredicate` /
  `partitionRowsByPredicate` in `@object-ui/core`; `usePredicateRecordContext` +
  `useCondition` in `@object-ui/react`) and for both dialects: a legacy
  `${data.x}` / `${x}` string on a row surface retires with the CEL spellings.
  
  **What a retired spelling does now: it faults, exactly as it already did on the
  server** (`buildScope({ record })` mounts exactly `['record']`, so `status` and
  `data` are unknown variables there), and each surface applies its EXISTING
  fault policy — no runtime detector, no "treat as absent" special case, no
  uniform override:
  
  - `evalRowPredicate` / `partitionRowsByPredicate` (row kebab, selection bar,
    `page:header` actions, conditional formatting): the caller's `fallback` —
    hidden / every row excluded / no style — reported once by the existing fault
    warning, which names the unknown variable (`Unknown variable: status`) and,
    on the fast route, carries the `record.` hint.
  - `useCondition` legs that opt into `throwOnError` (`action:button` and
    `action:menu` `visible`, `DeclaredActionsBar` `visible`): fail-closed —
    hidden on every row, reported once as `was hidden/disabled: its predicate
    threw — status is not defined`.
  - the non-throwing `useCondition` legs (`action:icon` / `action:group`
    `visible`, every `disabled` / `enabled`, `record:alert`): fail-soft — shown /
    greyed / enabled on every row, with the evaluator's own console line.
  - a host scope that carries its OWN `data` (app-shell's ambient `data: {}`) is
    left standing: `data.*` on a record surface then reads the host's object — a
    constant, silent `false` — which is what "no longer bound to the row" means.
  
  The Phase-1 deprecation warning is removed with the bindings:
  `warnNonCanonicalRowSpelling` and `resetRowPredicateCanonWarnings` are no
  longer exported from `@object-ui/core`. `detectNonCanonicalRowSpelling`,
  `ROW_PREDICATE_CANONICAL_ROOT` and the `NonCanonicalRowSpelling` type stay
  exported — the offline instrument for sweeping authored metadata.
  
  The layer rule is unchanged: `data` remains the canonical root on
  metadata-editing surfaces (ADR-0089 D3, `CANONICAL_ROOT_BY_LAYER`), and
  app-shell's metadata-admin `SchemaForm` / `predicate.ts` keep binding
  `{ data: row }` through their own evaluator.
  
  No stored-metadata survey, export or migration rewrite was run (the maintainer
  ruled the stored population out of scope, 「不考虑存量」); the Phase-1 warning
  period was the notice.
  
  Release note: Phase 1 (PR #5737 — the canon statement plus the warning) shipped
  in `@object-ui/core@17.6.0` (npm, 2026-08-24) although its changeset
  `.changeset/row-predicate-record-canon-5330.md` is still pending on `main`, so
  the next CHANGELOG section lists Phase 1 and this Phase 2 together: the warning
  it describes was live from 17.6.0 and is gone from this release on.
- d1ab06f: Row predicates declare a canon: `record.*`. The bare shorthand and `data.*` now
  warn once, and are unchanged otherwise.
  
  A row predicate (`visible` / `disabled` / `enabled` on an action renderer, a row
  scope, a `record:alert`) has bound the row three ways since objectui#4075 —
  `record.status`, bare `status`, and `data.status` — without any of them being
  declared the contract. The maintainer ruled that question on 2026-08-20
  (objectui#5330, option B), mirroring the objectstack#7917 option-② precedent for
  the identical renderer-tolerance shape: **the canon is `record.*`**, and the
  other two enter a deprecation window.
  
  The canon states the **server's** accept set, which was this card's first
  measurement and turns out to be strictly narrower than the renderer's. Measured
  against `@objectstack/formula@17.1.0`, the engine the server evaluates with:
  
  | spelling | server runtime | server authoring oracle |
  |---|---|---|
  | `record.status` | `{ ok: true, value: true }` | accepted |
  | bare `status` | `Unknown variable: status` | refused |
  | `data.status` | `Unknown variable: data` | **silently accepted** |
  
  `buildScope({ record })` mounts exactly `['record']` — `data` is never bound and
  the row's fields are never flattened to top level. The three-way binding is a
  client tolerance with no server counterpart, which is why the warning belongs on
  this side.
  
  `data.*` is the dangerous one, and the reason the warning exists. `data` is in
  `@objectstack/formula`'s `SCOPE_ROOTS`, so the server's bare-identifier oracle
  waves it through — that list is a deliberately generous "never faults" lint
  baseline, not the runtime accept set. A `data.*` row predicate therefore passes
  every authoring gate the platform has and then binds nothing at runtime: not an
  error, a constant `false`. A `visible` that is constantly false is a button that
  silently never appears — the objectui#4075 fail-closed signature.
  
  What ships:
  
  - `@object-ui/core` exports `detectNonCanonicalRowSpelling`,
    `warnNonCanonicalRowSpelling`, `resetRowPredicateCanonWarnings` and
    `ROW_PREDICATE_CANONICAL_ROOT` from a new `evaluator/rowPredicateCanon.ts`,
    which carries the canon statement and the measurement.
  - Both evaluation tiers report once, in dev: `evalRowPredicate` (core) and
    `useCondition` (react, for bags bound by `usePredicateRecordContext`).
  - Detection reuses the server's own oracles (`collectCelRootIdentifiers`,
    `firstUndeclaredReference`) rather than a regex, so no second dialect
    judgement is invented client-side.
  
  **No spelling is removed and no behaviour changes.** Every predicate that
  resolved before resolves now — the ruling defers removal behind a stored-metadata
  survey, and the warning is what makes that survey possible (ADR-0078: a
  tolerance nothing ever reports can never be retired).
  
  The deprecation is scoped to the **runtime record layer**. `data` remains the
  canonical root one layer over, in a metadata-editing form (ADR-0089 D3
  `CANONICAL_ROOT_BY_LAYER`), and the detector stands down there.
- dba7d84: New export: `useSettledSchema` — the settled-schema RESOLUTION half shared by
  `ObjectKanban` / `ObjectView` / `ObjectCalendar`'s fetch-gate hand copies
  (objectui#6482, maintainer ruling Option A). It tracks whether an object's
  definition has finished resolving FOR THE KEY THE CURRENT RENDER IS ASKING
  ABOUT, returning `{ ready, def }` from one piece of internal state so `ready`
  and `def` can never be observed inconsistently and a stale key can never read
  as ready — the structural fix for the `ObjectTree` defect (objectui#6481)
  where a definition and a separate, one-way-latched "settled" boolean could
  disagree for a render after the object changed.
  
  Gate PLACEMENT — which effect branch actually waits on `ready` — stays a
  per-component decision and is not part of this hook; see the hook's own doc
  comment. Existing hand copies are migrated on their own subsequent cards, not
  by this change.
- c86185e: Bind `record` into the node-level visibility evaluator, and stop a hoisted
  `properties.visible` swallowing a declared `visibleWhen`.
  
  `@objectstack/spec` has declared since ADR-0089 that a page component's
  `visibleWhen` binds the row — `ui/page.zod.ts`: *"Binds `record`,
  `current_user`, `page.<var>`"*. `SchemaRenderer` bound no `record` at all. Its
  evaluator was built from the ambient predicate scope, `data: dataSource` (the
  connector **adapter**, not the row) and `page: pageVariables`; the row lives in
  `RecordContext`, which that evaluator never read.
  
  Because the surface is fail-soft, a `record.*` predicate did not misfire — it
  resolved to **shown**. Both polarities of the same predicate returned the same
  verdict, so a visibility gate silently did not gate, on every block on every
  record page. Measured on `record:alert`, `record:path`, `page:card` and
  `element:text`.
  
  Three changes, all in `SchemaRenderer`'s evaluation memo:
  
  - **`record` is bound**, as the `record` root only — the three roots the
    describe promises and nothing more. Not as bare fields, and never over
    `data`, which is what `${data.*}` in a props bag resolves against. Bound
    conditionally, so "no row" binds nothing rather than shadowing a `record` a
    host supplied through the ambient scope.
  - **`visibleWhen` is tested before `visible`.** The memo hoists `properties.*`
    onto the node, so a node carrying `properties.visible` short-circuited the
    declared node predicate — the one key the spec tells authors to write was the
    one key that could be silently ignored. The two deprecated aliases
    (`visibleOn` / `visibility`) deliberately keep their rank: they normalize into
    `visibleWhen` at parse, so a spec-parsed page never reaches them.
  - **An unresolvable predicate is loud** (dev builds). Fail-soft answered "this
    predicate is broken" and "this predicate said yes" with the same word. The
    verdict is unchanged on every path — `evaluateCondition` already returned
    `true` for every unevaluable predicate, including the non-negated `hidden` /
    `hiddenOn` legs where that `true` means HIDE — so only the silence moved.
  
  **Behaviour change, stated plainly:** a shipped page whose node-level
  `record.*` predicate was previously inert now evaluates. A block that was
  permanently visible may begin to hide — which is the point, but it is a verdict
  change, not a no-op. `properties.visible` is unaffected in verdict: an
  in-tree census found **zero** node-level `record.*` predicates on page
  components, so nothing in this repository changes verdict.

### Patch Changes

- 546ddf7: A node-gate visibility predicate that FAULTS now says so in a production build, once per
  distinct predicate source (objectui#6038, maintainer ruling 2026-08-25, option B: "the
  silence is no longer an accepted property"). Observability only — no verdict moves.
  
  `SchemaRenderer`'s visibility chain is fail-open: a predicate that cannot be evaluated
  resolves to the same answer as one that said yes, so a gate that stops biting looks
  exactly like a gate the author got right. The diagnostic that names it (objectui#5454 /
  objectui#5687) sat behind a `__DEV__` short-circuit, because the only fault-detection
  channel available was `throwOnError`, and on the CEL branch `evaluateCelCondition`
  implements that by evaluating **twice** — too expensive to ship for every predicate of
  every node.
  
  **What production actually printed before, measured per dialect on the built evaluator**
  — the card's premise held for one dialect of three, and the other two failed in opposite
  directions:
  
  | dialect | production console, before |
  |---|---|
  | bare string | **nothing** |
  | `{ dialect: 'cel' }` envelope | one generic line, deduped per source |
  | `${…}` template | one generic line **per evaluation**, never deduped |
  
  So the dialect objectstack#11254 measured a live gate breaking on was the silent one,
  while the template dialect was the console flood the ruling's rate-limit clause exists to
  prevent.
  
  **The fix reports the fault the evaluator already detected, at the same number of engine
  calls.** `EvaluationOptions.onFault` is a new passback on `@object-ui/core`'s
  `ExpressionEvaluator`: every fault site is already inside a `catch`, or already holds the
  canonical engine's failure reason, so nothing is evaluated twice. It mirrors, one layer
  up, the seam `FieldPredicateDiagnostic` already documents (`warn: false` plus a reason
  passback), and supplying it transfers reporting to the caller so one fault stays one
  line. Pinned: the CEL branch performs the same number of record reads with the passback
  as without it, and strictly fewer than the `throwOnError` probe.
  
  `SchemaRenderer` passes it in production and reports through the **same** reporter the dev
  branch uses — same message, same severity, same dedupe `Set`, same key. Development and
  production now print the identical line for the identical fault; the `__DEV__` gate no
  longer decides *whether* a fault is reported, only *how* it is detected.
  
  `page:tabs` item-level `visibleWhen` (`@object-ui/components`) is covered by the same
  reporter and the same rate limit. It swallowed the identical fault under a different
  helper, and it was the worse of the two: the node gate at least reported in development,
  while a faulting item predicate was silent in *both* builds on a gate whose false verdict
  removes an entire tab, header and panel.
  
  **Rate limit:** deduped per (node type, gate key, predicate source) — never per render and
  never per node instance. A two-hundred-row list of one broken predicate is one line; a
  second distinct predicate source still gets its own line. Both halves are pinned, because
  a test that asserts only "a warning was emitted" is equally green on an implementation
  that emitted fifty, and one that asserts only "exactly one" is equally green on an
  implementation that suppresses everything.
  
  **Not changed by this card, deliberately:** the fail-open semantics themselves; the
  objectui#5687 adapter-only `data.*` report, which stays development-only under its own
  2026-08-22 ruling (that path is not a fault — the predicate evaluated perfectly, against
  the wrong object); and the `/forms/:name` scope wiring of objectui#6262, which lands in
  its own PR.
  
  `reportUnresolvableVisibilityPredicate`, `formatUnresolvableVisibilityMessage`,
  `UNRESOLVABLE_VISIBILITY_PREFIX` and `__resetVisibilityPredicateWarnings` are now exported
  from `@object-ui/react` so every surface that evaluates a node `visibleWhen` shares one
  reporter and one rate limit — a second copy would mean a second dedupe `Set`, and one
  authored predicate would be entitled to one line per package instead of one line.
- 22ba927: `SchemaRenderer` now hands a stable `schema` object identity to a node carrying
  `responsiveStyles` (objectui#6270).
  
  ADR-0065 scoped styles make a styled node take a branch that rebuilds the schema
  object to merge the generated scope class into `className`. That rebuild was not
  memoised, so it allocated a new object on **every** `SchemaRenderer` render — even
  when the `evaluatedSchema` memo directly above it held. Every downstream renderer
  that memoises on `[schema]` therefore saw a fresh identity and re-ran: concretely
  `ObjectMap`'s `dataConfig` and `mapConfig`, and the whole marker cascade below them
  (`markers` → `filteredMarkers` → `clusteredData` / `markerBounds` → `initialViewState`).
  Only nodes on that branch were affected — a plain node was already handed the
  memoised `evaluatedSchema` itself.
  
  The trigger is narrower than "has `responsiveStyles`" reads: it needs one of the four
  sized breakpoint keys (`large` / `medium` / `small` / `xsmall`). A `{ base: … }` shape
  never took the branch and was never affected.
  
  The scoped-style computation now lives in a `useMemo` keyed on
  `[evaluatedSchema, autoStyleId]`, hoisted above the renderer's early returns — its old
  use site sits after them, so a memo written there would have been a conditional hook.
  A genuinely changed `className`, interpolated value or breakpoint still produces a new
  identity, so nothing goes stale.
- 5967be0: Extends objectui#5687's adapter-only `data.*` constant-predicate diagnostic — a node-gate
  predicate that evaluates perfectly, against the wrong object, because at the node tier
  `data` is the data-source adapter, not the row — to the `disabled` / `disabledOn` gate
  (objectui#6504, maintainer ruling 2026-08-27 option A).
  
  A node written `{ "type": "button", "disabled": "data.status == 'locked'" }` evaluates
  cleanly (no fault, so objectui#6445's fault reporter correctly stays silent), and on the
  constant's other polarity (`data.locked == null`, `!data.assignee`, or an adapter that
  answers nothing) hands the gate a constant `true` that greys the control out on every row,
  in every build, with nothing on the console. This leg now names it, in development only —
  option C (always-on) was excluded, outside the #5687 precedent.
  
  The copy is new, not reused: the visibility leg's sentence ("a constant `false` hides the
  node on every row") is written about the opposite polarity and would be false on this gate.
  The enablement leg's own sentence names the constant-`true` direction — the control renders
  DISABLED, greyed out, indistinguishable from a gate the author meant to close.
  
  Both legs carry the same dissolution pointer: this diagnostic — visibility AND enablement
  together — dissolves when objectui#5330's `data.*` deprecation window closes.
  
  Dev-only, no verdict change, no interpolation change, no published type widened (the new
  `AdapterOnlyPredicateGateKind` type and the new prefix constant are module-internal, not
  re-exported from the package entry — matching objectui#5687's own symbols, which never were
  either).
- 12402a9: Drop the undeclared object-level `titleField` from the object page's five
  remaining view-config seams, and from the record-search memo key
  
  `ObjectView` resolves a title field for seven view kinds. Two of them —
  calendar and gantt — already read `viewDef.<kind>?.titleField || 'name'`. The
  other five (timeline, kanban, map, gallery, tree) carried a three-rung chain
  with `objectDef.titleField` in the middle, so one file answered the same
  question two different ways. This converges the five on the shape the two
  siblings already had; it is a convergence, not a removal.
  
  The middle rung could never fire for legal metadata. `@objectstack/spec`'s
  object schema is a `strictObject`, so
  `ObjectSchema.safeParse({ …, titleField: 'x' })` is rejected with
  `unrecognized_keys` — the same issue code a nonsense key gets — while
  `nameField`, `displayNameField` and `titleFormat` all parse (measured against
  `@objectstack/spec@17.2.0`, the dist this repo installs). objectui#6531
  established that measurement and dropped the twin read inside
  `getRecordDisplayName`. Reading a key no producer can ship is the
  consumer-side alias AGENTS.md Commandment #0.1 bans.
  
  Behaviour for every legal config is unchanged, and both directions are pinned:
  a view that declares its own `titleField` still wins on every kind, a view that
  declares none still floors at `'name'`, and an object carrying the
  contract-rejected key is now honoured by no kind. Re-pointing the middle rung
  at the declared `nameField` was considered and rejected: it would have added a
  rung calendar and gantt do not have — increasing the divergence — and, unlike
  this change, it would have altered behaviour for legal configs.
  
  `useRecordSearch`'s candidate signature — the memo key that decides when the
  cross-object fanout re-runs — appended `o?.titleField ?? ''` to every entry.
  Because no legal object definition can carry the key, that half was permanently
  `''`: a constant suffix in a cache signature, and the last thing in the repo
  that read as evidence some producer supplies it. The signature is now the object
  name alone, which is the only field of an object definition the effect actually
  consumes. Change detection is unaffected — a changed candidate name still
  re-runs the fanout, and a new array with identical content still does not.
- 46b9bc9: A `props` config bag on a component-renderer node is now named at render
  instead of dropped in silence (objectui#6708).
  
  `SchemaRenderer` HOISTS every `properties.*` value onto the node, so a key
  written under `properties` is a real value on `schema.<key>` by the time a
  renderer destructures it. `props` — the annotated legacy alias of the same bag
  — is NOT hoisted: it is evaluated and then spread as React props on the created
  element. A renderer declared as `({ schema })`, which is the normal shape for
  the component renderers, therefore never sees it. The `element:*` family is the
  exception: its `readProps()` merges `{ ...schema.props, ...schema.properties }`,
  so the same spelling is honoured there.
  
  Every gate accepts the `props` spelling — `BaseSchema` is `.passthrough()` with
  `[key: string]: any` — and the docs call it a supported alias, so nothing
  between the author and the screen said a word. Re-measured on `faac0d935`
  through the real `SchemaRenderer` with a probe that records both channels:
  
  | node | React prop `data` | `schema.data` |
  |---|---|---|
  | `props: { data: "${data.customers}" }` | the evaluated array | absent |
  | `properties: { data: "${data.customers}" }` | the evaluated array | the array |
  
  Same key, same value, one envelope apart. The expression is evaluated on both
  legs, so this is a dropped value rather than an unevaluated one. Read through a
  real `data-table` (objectui#6665's four-leg pin) the same pair renders
  `No results found` against the two rows.
  
  The diagnostic's level and dedupe were chosen from a census, which the ruling
  made a precondition. Every JSON document, every `json` fence in every
  `.md`/`.mdx`, and every TypeScript object literal in the repo was walked for
  nodes carrying both `type` and `props`: 39 such nodes, 22 of them on
  component-renderer types, and 19 of those 22 are test fixtures exercising this
  shape on purpose. The authored, non-test corpus holds 5 — three of which are
  deliberate counter-examples in the skills guides. Nothing floods, so the level
  is not softened for volume; the dedupe is keyed on the MESSAGE rather than on
  the schema object, so a metadata generator emitting one wrong envelope across
  many nodes still gets one line while two genuinely different nodes get two.
  
  `console.warn`, matching objectui#6575 and objectui#6665 — the two prior
  instances of this exact "you declared something and the renderer dropped it"
  shape — rather than the `console.error` its neighbour at this tier uses for a
  raw `${...}` placed verbatim in front of a user. Nothing is placed here; a
  value is dropped.
  
  No behaviour change, which is the entire reason this arm was chosen. Hoisting
  `props` to parity with `properties` was refused at ruling: it would weld the
  legacy alias in as a permanent second spelling, against this repo's
  alias-retirement direction. Refusing the key at parse stays blocked on the
  `.passthrough()` ceiling (objectui#5155 / objectui#6269). What every renderer
  receives is pinned byte-for-byte against a reading captured on the tree before
  the diagnostic existed. Nothing is added to the published surface either — the
  predicate, message builder, prefix constant and test-only reset are
  module-internal and are not re-exported from the package entry, matching
  objectui#6575's own symbols. The trap stops being silent; it does not stop
  being a trap.
- d47de51: `useSchemaPersistence` no longer writes its adapter ref during render
  (objectui#6745).
  
  The hook keeps the live adapter in a ref so `save`/`load`/`list`/`remove` can be
  created once and still reach the newest adapter at call time. That ref was
  written in the render body:
  
  ```
  const defaultAdapter = useRef(createLocalStorageAdapter());
  const adapterRef = useRef(adapter ?? defaultAdapter.current);
  adapterRef.current = adapter ?? defaultAdapter.current;   // during render
  ```
  
  which `react-hooks/refs` flags on three counts. A render React discards or
  replays — StrictMode, a Suspense retry, a concurrent interruption — still
  performed that write, so a save could be routed through an adapter belonging to
  a render that never committed.
  
  The write now happens in `useInsertionEffect`, and the default adapter comes
  from `useMemo` instead of a ref read during render.
  
  **Timing is preserved for every legal call site.** Insertion effects run in the
  mutation phase — before every layout effect in the tree, before paint, and
  before any event handler can fire — so a changed `adapter` prop is in place
  before anything that may legally invoke these methods can observe it. This is
  deliberately *not* `useEffect` (which lands after paint) or `useLayoutEffect`
  (a child's layout effects run before its parent's); either would route a call
  made earlier in the same commit to the previous adapter. The only window that
  changed is a read during the render phase itself, which no legal consumer has:
  `save`/`load`/`list`/`remove` are side effects and are never callable during
  render.
  
  Also fixed in passing, on the same lines: `useRef(createLocalStorageAdapter())`
  invoked the factory on **every** render and discarded all but the first result.
  The `useMemo` runs it once. The adapter is a stateless facade over
  `localStorage` and its identity is never exposed, so this is unobservable
  beyond the saved work.
  
  No API, signature or observable behaviour change for any supported call site.
- 3fe6463: `SchemaRenderer`: a non-object `props` bag is no longer object-spread into
  indexed React props (objectui#6752).
  
  A node written `{ type: 'card', props: 'not-a-bag' }` reached `createElement`
  carrying nine React props named `0` through `8`, one per character, because
  `{ ...'not-a-bag' }` enumerates a string's character indices. Nothing threw and
  nothing was logged, so the symptom — a component handed nine props it never
  declared — sat a long way from the `props` value that caused it. Measured
  through the real `SchemaRenderer`; the in-repo corpus has no such node today, so
  this is a latent shape rather than a live failure.
  
  The canonical `properties` branch already carried the wider guard. Its comment
  claimed the guard was hoist-specific, and that turned out not to survive
  measurement: ablating it leaves the indexed keys the hoist puts on the node
  completely unchanged, and moves only whether `schema.properties` still holds the
  value the author wrote. The reason is channel-independent — a degenerate value
  must not have its shape reinterpreted by an object spread — so `props` now
  carries the same guard, both bags share one `isConfigBag` predicate, and the
  `properties` comment states the measured reason instead of the old one.
  
  Both sites that spread the bag are covered: the evaluation memo (so
  `schema.props` keeps the authored value) and `propsWithoutCanonicalKeys` (so the
  `createElement` spread does not re-enumerate it). A degenerate bag now
  contributes no keys, and the authored value is passed through unmangled on the
  React prop named `props`.
  
  Unchanged: a normal object `props` (still evaluated, still spread per key),
  objectui#5123's two-bag precedence, the `properties` hoist, and objectui#6708's
  dropped-`props` diagnostic.
- 31ab372: A degenerate `properties` bag no longer reaches the element as indexed React
  props (objectui#6760).
  
  `properties` is the spec spelling of a node's config bag. The hoist that copies
  `properties.*` onto the node's top level walked it with `Object.entries`
  unconditionally, so a non-object value was enumerated rather than skipped:
  measured on `c6732825d`, `{ type, properties: 'not-a-bag' }` reached the element
  as nine React props named `0` … `8`, and `properties: ['x', 'y']` as `0`, `1`.
  Nobody authored those keys — they are the walk's reading of a string's character
  indices.
  
  The hoist now asks the same `isConfigBag` question the evaluation memo and the
  `props` bag already ask (objectui#6752, objectui#6761). Of the two arms the card
  left open, this is "guard the hoist" rather than "declare that the hoist may
  enumerate anything", because objectui#5123 ruled that a key gets one answer
  whichever channel reads it — and the alternative would have answered one
  authored mistake two ways, with the reinterpreting half falling on the canonical
  spelling while the quiet half fell on its legacy alias.
  
  Nothing else moves: a real object bag hoists exactly as before (including the
  `type`/`id` keys the hoist has always refused to copy), the authored
  `properties` value still reaches renderers on both channels unchanged, and
  `properties: 42` / `properties: true` were already contributing no keys.
- 67fc3b0: `useETagCache`, `useGlobalUndo` and `useOffline` stop writing their config refs
  during render (objectui#6797).
  
  Each of the three kept a "latest value" ref that was assigned in the render
  body, one `react-hooks/refs` warning apiece on this base
  (`useETagCache.ts:204`, `useGlobalUndo.ts:57`, `useOffline.ts:262` — all three
  `Cannot update ref during render`, all three the WRITE only; unlike
  `useSchemaPersistence` none of them also READ a ref during render). A ref
  written in the render body is also written by renders React discards or
  replays — StrictMode's double render, a Suspense retry, a concurrent
  interruption — so a tree that never committed could publish its config to
  callbacks that outlive it.
  
  The write moved to `useInsertionEffect` in all three, but that shape was chosen
  per hook rather than carried over, because what each ref protects differs:
  
  - **`useETagCache`** — five resolved config scalars read by five `useCallback`s
    with `[]` deps whose identity is part of the published result. Re-keying them
    on the config values would have changed `fetchWithETag`'s identity whenever a
    caller's `ttl` moved, re-firing consumer effects keyed on it, so the ref
    stays.
  - **`useGlobalUndo`** — the whole options bag. Every caller passes a fresh
    inline literal with inline `onUndo` / `onRedo` closures, and the keydown
    effect is keyed on `undo` / `redo`, so the ref is the only thing keeping
    those two stable while still reaching the newest callbacks.
  - **`useOffline`** — `config.sync`, read by one caller (`sync`) that is
    *already* unstable (deps `[enabled, queue]`). Here the ref protects RETAINED
    closures rather than an identity: the auto-sync effect deliberately captures
    a `sync` and fires it 100ms later, and that closure must still see the newest
    `batchSize`. Dropping the ref for a `syncConfig?.batchSize` dep would have
    changed what that retained closure reads, so it was rejected.
  
  `useInsertionEffect` runs in the mutation phase — ahead of every layout effect,
  ref attachment and paint — so the only window any of the three defers is the
  render phase itself, where none of the affected callbacks is legally callable.
  `useEffectEvent` would be the idiomatic answer but is React 19.2+, and this
  package's peer range starts at React 18.
  
  **No behavioural change is claimed for callers that exist today**: reverting any
  of the three implementations leaves the whole suite green, and the new pins pass
  against the old code and the new code alike. They guard the next edit — each
  file's discriminating pin fails under both `useEffect` and `useLayoutEffect`.
- 33a3b3c: `useETagCache` builds its config object once per hook instance instead of once
  per render (objectui#6817).
  
  `useRef({ enabled, storage, storagePrefix, maxEntries, ttl })` evaluated that
  literal on **every** render and kept only the first result, so every later
  render allocated a five-key object that was discarded. It now comes from a
  `useMemo` keyed on the five values, which is also what the ref's
  `useInsertionEffect` write publishes.
  
  `patch`, not `minor`: nothing a published consumer can observe changes. The
  public shape, the returned callbacks' identities and the values the stable
  `[]`-deps callbacks read off the ref are all unchanged — the object's identity
  is private to the hook, so the only difference is the allocation that no longer
  happens. Same pattern PR objectui#6796 repaired in `useSchemaPersistence`; this
  is the half of that class the `react-hooks/refs` rule structurally cannot see,
  which is why it needed a test rather than a lint fix.
- 2ce2612: A record-page URL now names the object the clicked rows actually came from, in
  `ObjectTree` and `ObjectCalendar` (objectui#7638).
  
  `useNavigationOverlay` builds `/{objectName}/record/{id}` out of whatever it is handed,
  and both components handed it the bare top-level `schema.objectName` while resolving
  their own rows through the objectui#6939 record-source ladder (`data`, then
  `staticData`, then `objectName`). objectui#6939 published `objectName` as that ladder's
  THIRD RUNG and not as a parallel "page object" concept, so a block has exactly one
  record source — and a row fetched through `data.object` whose click built
  `/{schema.objectName}/record/{id}` named a record that the URL's own object does not
  contain.
  
  Two shapes change, both toward the object the rows came from:
  
  - a block carrying **both** bindings navigated to the top-level key and now navigates to
    `data.object`;
  - a **data-only** block had no name to build a URL from at all, so the hook took its
    `/{id}` leg — an unrouted path that paints a blank page — and now builds the routed
    record URL.
  
  `ObjectCalendar` is where the divergence was plainest: on one click it resolved the
  detail drawer through the ladder and the navigation URL through the top-level key. The
  URL now reuses the very `schemaObjectName` that already keys the calendar's record query
  and its `$expand` derivation, so query, drawer and URL agree by construction.
  
  **Nothing else moves.** Both converted sites keep a site-local `?? schema.objectName`
  tail for the off-contract `data: { provider: 'object' }` that carries no `object`
  (`ViewDataSchema` declares it required) — the same tail `ObjectTree`'s `headerObjectName`
  already carries, and the same conservatism objectui#7627 applied when it published the
  shared reader. `useNavigationOverlay`'s own signature is unchanged: it still takes an
  `objectName`, and only what callers hand it has changed.
  
  The hook's `@example` stops prescribing `objectName: schema.objectName`. That prose is
  why there were copies to convert at all — component authors copied the divergence out of
  the documentation, correctly, as written — so it now points at
  `resolveRecordSourceObjectName` and says explicitly that a caller with no data config
  has nothing above rung three and should keep passing `schema.objectName`.
  
  `ObjectKanban` is deliberately **not** converted: it has no data config, no
  `getDataConfig`, and its `data` is a raw row array rather than a `ViewData` binding, so
  `schema.objectName` already IS its record source and its board, drawer and URL already
  agree.
- d1bebb0: The unevaluated-expression diagnostic now lists `properties` among the channels
  that evaluate and read back, matching the sibling `props`-bag diagnostic that
  tells authors to write their keys there.
  
  Both messages are dev-build diagnostics in `SchemaRenderer`, and one node can
  trip both. They disagreed: `propsBagDiagnostic` said *"`props` is NOT hoisted
  onto the node — only `properties.*` is … Write them under `properties`
  instead"*, while `unevaluatedExpression` enumerated *"channels that do evaluate
  and read back today"* as `content` or host-side resolution — omitting
  `properties`. An author who hit both was told to use a channel the other message
  said did not work.
  
  The enumeration was the wrong half, established by measurement rather than by
  reading the `COMPAT` label on the hoist. `properties` has no retirement on
  record: `@objectstack/spec@17.2.0` calls the vocabulary carried there *"ALIVE —
  this is not dead surface to retire under ADR-0049"*, keeps
  `PageComponentSchema.properties` as the open carrier on purpose, gates it at the
  authoring door, and tombstones no part of it via `retiredKey()`. In this repo
  `props`, not `properties`, is the spelling annotated as the legacy alias.
  
  Diagnostic text only — no evaluation, hoist or schema behaviour changed.
- 98c3a74: Fix `createLazyPlugin`'s JSDoc example, which taught a call that does not compile.
  
  The `@example` block passed `() => import('@object-ui/plugin-grid')` as the
  `importFn`. ObjectUI plugin packages export their components by name and have no
  `default`, so that call supplies the module namespace object — rejected by the
  compiler (`Property 'default' is missing`) and, at runtime, handed to
  `React.lazy` as the component. The examples now unwrap the named export via the
  `async` spelling, which is the form that actually type-checks. This ships in the
  published `.d.ts`, so it is what editors show on hover.
- 9850c6e: `SchemaRenderer`'s node visibility gate now emits a dev-only warning when a
  predicate reads `data.*` and the data-source adapter cannot answer that read, so
  an author who wrote `properties: { visible: "data.status == 'draft'" }` sees the
  constant they authored instead of shipping it (objectui#5687).
  
  At the node tier `data` is the data-source **adapter** — the object `${data.total}`
  in a props bag resolves against — and it has never been the row. A predicate
  written with the deprecated `data.*` spelling therefore resolves `undefined ==
  'draft'`, which is a perfectly good `false`: the block is hidden on every row, and
  because it does not throw, the unresolvable-predicate reporter added for
  objectui#5454 never fired. Measured on this base, the same predicate written as a
  `{ dialect: 'cel' }` envelope *does* throw and *was* already reported — so whether
  an author heard about the identical mistake depended on which dialect they happened
  to write it in, which is the arbitrariness objectui#5454 existed to remove.
  
  **No verdict changes and no interpolation changes** (maintainer ruling,
  2026-08-22, option A). The node tier keeps its documented `data` = adapter
  semantics; objectui#5330's row binding does not extend here. The evaluator's answer
  is returned exactly as computed and `${data.*}` interpolation is untouched — only
  the silence moved.
  
  The report fires on a `data.*` read the bound adapter answers with `undefined`, not
  on the spelling. A genuine adapter read stays silent (`data.total > 0` against an
  adapter carrying `total`), a canonical `record.*` predicate stays silent, and a
  correctly-hiding gate stays silent. Dev builds only, `console.warn`, deduped per
  node type + key + predicate source — the same module, Set and lifecycle as the
  objectui#5454 reporter.
  
  This loudness is temporary by design: it dissolves when objectui#5330's deprecation
  window for the `data.*` row spelling closes.
- b2ea297: `ObjectSchemaMetadata` is now derived from `@objectstack/spec`'s `ServiceObject`
  instead of being a hand-written copy (objectui#5362; maintainer ruling
  2026-08-20: the object document type belongs to the spec).
  
  What changes on the published type surface:
  
  - **Gained:** the full spec object-document surface, including the three keys
    the runtime already reads but the old interface rejected as excess
    properties: `icon`, `titleFormat`, `listViews` (plus `pluralLabel`,
    `nameField`, `displayNameField`, `managedBy` as a spec key, and the rest of
    the spec document).
  - **Removed:** nine members the old interface declared that no objectui
    runtime code reads and the spec document does not know: `extends`,
    `triggers`, `primary_key`, `relationships`, `name_field` (the spec spelling
    is `nameField`), `soft_delete`, `audit_trail`, `version`, `cache`.
    `ObjectTrigger` and `ObjectRelationship` remain exported unchanged.
  - **Kept:** `editMode` — the one measured client-side member the runtime reads
    (`recordFormNavigation` / `AppContent`) — now declared on the new
    `ObjectSchemaClientExtensions` interface, which the derivation intersects.
    Note the spec's strict parse rejects `editMode` on published documents
    (`unrecognized_keys`); it is a client-type member only.
  
  Spelling settlement: `listViews` (camelCase) is canonical — `list_views`
  appears nowhere in `@objectstack/spec` 17.2.0. Runtime read sites in
  `@object-ui/app-shell` and `@object-ui/react` keep a documented snake-spelling
  READ fallback for stored pre-settlement documents (that stock has never been
  censused — objectstack#7917); the CRUD guide and its pinned transcription now
  author the canonical spelling.
- 4f14ad7: `SchemaRenderer`'s node visibility gate now also catches the `${…}`-templated
  spelling of the objectui#5454/#5687 diagnostics when it is written inside
  `properties`, e.g. `properties: { visible: "${data.status == 'draft'}" }`
  (objectui#5756).
  
  The `properties.*` evaluation loop runs, and interpolates every `${…}` template it
  finds, **before** the visibility gate ever sees the value — so by the time the
  existing diagnostics ran, a template-spelled predicate had already collapsed into a
  plain boolean and there was no predicate text left to inspect. The bare-string
  spelling of the exact same gate (`properties: { visible: "data.status == 'draft'"
  }`) was unaffected — nothing interpolates a string with no `${` in it — and was
  already reported; only the template spelling was structurally invisible.
  
  Reached by moving the diagnostic check to inside the `properties` evaluation loop,
  on the predicate's raw (pre-interpolation) text, gated on the key being one of the
  six visibility keys the render chain consults (`visibleWhen` / `visible` /
  `visibleOn` / `visibility` / `hidden` / `hiddenOn`) — a `properties.content`
  interpolation, or any other non-visibility key, is untouched and stays silent.
  
  Reports only the key that actually **decides** the node's visibility, mirroring
  objectui#5454's own leg semantics (its reporter is likewise only ever invoked on
  the leg the chain's early-return sequence actually reaches): a `properties.visible`
  template that a co-declared `visibleWhen` outranks is not reported for deciding
  nothing.
  
  **No verdict changes and no interpolation changes.** The diagnostic call's return
  value is discarded; the real verdict is still computed afterward, off the
  post-evaluation, post-hoist schema, by the same code path as before this change.
  Same two reporters as objectui#5454/#5687 (unresolvable-predicate / adapter-only-data
  predicate), same dedupe `Set`, same `console.warn` severity, same dev-only gate —
  only the silence moved, one render-step earlier.
- f90b8fb: `toRenderableSchema`'s header now says the bridge is permanent, instead of instructing
  callers to remove it (objectui#4622).
  
  No executable line changes — but the artifact is **not** unchanged, and that is worth
  stating plainly rather than rounding to "comment-only". This package builds with plain
  `tsc`, and `tsconfig.base.json` sets `"removeComments": false` deliberately, so the JSDoc
  is emitted into `dist/schema-input.js` as well as `dist/schema-input.d.ts` — it is both
  what an editor shows on hover at every call site and bytes that ship.
  
  Measured by building the package the way the repo builds it, at both revisions:
  `dist/schema-input.js` grows from 1,486 to 2,377 bytes (1.45 KB to 2.32 KB), and from 850
  to 1,266 bytes gzipped (0.83 KB to 1.24 KB) — **+891 bytes raw, +416 gzipped**. All 19
  differing lines in the emitted file are JSDoc continuations and the three executable lines
  are byte-identical, so the growth is the paragraph and nothing else. The trade is
  deliberate: roughly 0.4 KB gzipped, against the five-hour `Build Docs` outage the old
  paragraph's instruction produced once already.
  
  The old closing paragraph said the two competing repo-wide `SchemaNode` spellings "have
  not been reconciled" and that "when it lands, the call sites using this can go back to
  forwarding directly". Both halves went false when PR #4608 merged, and the second half is
  the harmful one: it is an instruction whose trigger condition has now fired, sitting
  directly above the function a future author is about to call.
  
  The reconciliation (objectui#4580 / PR #4608) resolved the collision in favour of
  `@object-ui/types`' union — `@object-ui/core` now re-exports it rather than hand-declaring
  an interface — while `SchemaRenderer`'s prop stays deliberately narrow per objectui#4548
  ruling Q2 (`schema: BaseSchema | string | null | undefined`, no `number` / `boolean`). So
  a `SchemaNode` became *less* assignable to that prop, not more, and the bridge is a
  permanent crossing between two intentionally different types rather than scaffolding
  awaiting a merge.
  
  Following the old instruction has a measured cost: five `apps/site` call sites were
  forwarding directly when PR #4608 landed, and `Build Docs` was red on `main` for roughly
  five hours until PR #4621 routed all five through this function (objectui#4617).
- f53a8d0: fix(react): stop the form-view bridge silently dropping 18 spec keys
  
  `spec-bridge/bridges/form-view.ts` promised (#2545) that "every serializable
  spec key is either mapped onto the `object-form` node or listed here with an
  explicit reason for being ignored". Measured against `@objectstack/spec` 17.2.0
  the promise was false for 18 keys, because the conformance test enforcing it ran
  its completeness loop over its own hand-written fixture rather than the
  contract's key set.
  
  Seventeen of them now reach the node, at the destinations the receiving layer
  already reads:
  
  - `FormViewSchema.buttons` / `.defaults` — `ObjectFormSchema` declares both and
    `ObjectForm` folds them at render (action-button visibility/labels, and
    create-mode initial values).
  - `FormSection.pane` — explicit split-pane placement; without it a spec-authored
    split form fell back to the positional rule, so reordering sections moved them
    across the divider.
  - `FormSection.visibleOn` — the deprecated spelling now folds onto `visibleWhen`,
    matching the contract's own parse-time normalisation and the field path.
  - Thirteen `FormFieldSchema` keys — `maxLength`, `minLength`, `min`, `max`,
    `precision`, `scale`, `multiple`, `immutable`, `span`, `language`, `keyField`,
    `disclosure`, `fields` — so authored constraints, composite config and field
    width survive the bridge instead of ending there.
  
  `publicPicker` is deliberately not carried and now says so: it is a server-side
  public-lookup authorization opt-in with no client destination.
  
  The conformance test's key set is now derived from the contract's own shape at
  all three levels, so a spec key that is neither mapped nor explained fails the
  suite by construction.
- d91aed9: Name the case-only spelling when a component type misses the registry.
  
  Registry lookup is exactly case-sensitive, so a node typed `Page` misses a registered `page` and falls through to the OBJUI-001 "Unknown component type" panel. Because the mistake is usually uniform across a document, the symptom is not one broken widget — it is the whole page rendering as error panels, with nothing in the message pointing at the cause.
  
  Both surfaces that report the miss now name the spelling that would have resolved. `SchemaRenderer`'s panel reads `Unknown component type: Page — did you mean 'page'?`, and `objectui check` reports `Unknown schema type "Page" in <file> — did you mean "page"?`. When no known type differs by case alone, neither says anything extra — `zzz` gains no bogus suggestion, and this is case matching, not an edit distance, so `pge` suggests nothing either.
  
  **Lookup itself does not change.** `Page` still misses, still fails, and still renders the panel; only the message teaches. Normalising the lookup was considered and rejected (objectui#5247, maintainer ruling 2026-08-19): it would make two spellings valid everywhere, permanently, and legalise the typo class (`PAGE`, `pAge`) along with the PascalCase convention.
  
  Each surface reads its candidates from the set it can actually trust — the renderer from the live `ComponentRegistry` (including pending lazy stubs), the CLI from the registration-derived `KNOWN_SCHEMA_TYPES` snapshot — so neither can suggest a type nothing registers.
- Updated dependencies [64dae8e]
- Updated dependencies [b06e374]
- Updated dependencies [06a8af5]
- Updated dependencies [6a91586]
- Updated dependencies [a04d7c6]
- Updated dependencies [9801765]
- Updated dependencies [460575f]
- Updated dependencies [594704f]
- Updated dependencies [d3995fe]
- Updated dependencies [d88e20f]
- Updated dependencies [2d7304d]
- Updated dependencies [993f312]
- Updated dependencies [636b236]
- Updated dependencies [64d624d]
- Updated dependencies [053fdc8]
- Updated dependencies [41b7ce3]
- Updated dependencies [d2fb6ef]
- Updated dependencies [94e2fa7]
- Updated dependencies [490d9a9]
- Updated dependencies [fc62bb4]
- Updated dependencies [41df893]
- Updated dependencies [00f3eb5]
- Updated dependencies [1ec291c]
- Updated dependencies [453dbaa]
- Updated dependencies [95f8704]
- Updated dependencies [69a2163]
- Updated dependencies [24e027e]
- Updated dependencies [2c3cd1b]
- Updated dependencies [90665e0]
- Updated dependencies [8d3a529]
- Updated dependencies [5ac2e2c]
- Updated dependencies [7e19d03]
- Updated dependencies [b08b7eb]
- Updated dependencies [546ddf7]
- Updated dependencies [864154e]
- Updated dependencies [b023625]
- Updated dependencies [75bd83d]
- Updated dependencies [44d075b]
- Updated dependencies [40c479a]
- Updated dependencies [971d387]
- Updated dependencies [ee851c3]
- Updated dependencies [6414dfd]
- Updated dependencies [a8d5c71]
- Updated dependencies [905b21f]
- Updated dependencies [88e9109]
- Updated dependencies [2c45966]
- Updated dependencies [db3a600]
- Updated dependencies [5fa06c4]
- Updated dependencies [52a43de]
- Updated dependencies [e4559d1]
- Updated dependencies [2c71482]
- Updated dependencies [a26b9e4]
- Updated dependencies [5ef9c4f]
- Updated dependencies [46f0bb4]
- Updated dependencies [6f81384]
- Updated dependencies [5d3a2d1]
- Updated dependencies [8f1d995]
- Updated dependencies [b362c1b]
- Updated dependencies [5127378]
- Updated dependencies [dddb942]
- Updated dependencies [00c665e]
- Updated dependencies [29754cf]
- Updated dependencies [3c2b6f7]
- Updated dependencies [b84dc18]
- Updated dependencies [ac8abb0]
- Updated dependencies [9d86e1d]
- Updated dependencies [99a3c2d]
- Updated dependencies [5961030]
- Updated dependencies [c8ea8af]
- Updated dependencies [9602dc8]
- Updated dependencies [3190414]
- Updated dependencies [4e480f5]
- Updated dependencies [38a123c]
- Updated dependencies [299102e]
- Updated dependencies [d7acad6]
- Updated dependencies [45a9aeb]
- Updated dependencies [713db46]
- Updated dependencies [bf3a03c]
- Updated dependencies [831be72]
- Updated dependencies [29cb85b]
- Updated dependencies [3e028c8]
- Updated dependencies [d0889e2]
- Updated dependencies [ce503e5]
- Updated dependencies [f20dcf0]
- Updated dependencies [4ca30d0]
- Updated dependencies [7a5da14]
- Updated dependencies [fff9645]
- Updated dependencies [9c3b7ce]
- Updated dependencies [2c1c967]
- Updated dependencies [4d5f9b4]
- Updated dependencies [d6ceb8d]
- Updated dependencies [969ba84]
- Updated dependencies [7977ff9]
- Updated dependencies [3beef6d]
- Updated dependencies [dbd5194]
- Updated dependencies [b392674]
- Updated dependencies [4f3a1e2]
- Updated dependencies [f07b976]
- Updated dependencies [045d20b]
- Updated dependencies [adb2a86]
- Updated dependencies [3561bd2]
- Updated dependencies [bf97b98]
- Updated dependencies [320374d]
- Updated dependencies [b0d308d]
- Updated dependencies [8063bcb]
- Updated dependencies [b74a859]
- Updated dependencies [d4493fd]
- Updated dependencies [240b80f]
- Updated dependencies [77cb489]
- Updated dependencies [bfaa158]
- Updated dependencies [777e5c6]
- Updated dependencies [0c386dd]
- Updated dependencies [9e37d9b]
- Updated dependencies [5ad86dd]
- Updated dependencies [16a725f]
- Updated dependencies [4dfdcc3]
- Updated dependencies [446d93d]
- Updated dependencies [ecd9cb2]
- Updated dependencies [98d4108]
- Updated dependencies [0e3b3be]
- Updated dependencies [220c18d]
- Updated dependencies [4388f71]
- Updated dependencies [c93b4d5]
- Updated dependencies [c1fe272]
- Updated dependencies [8ad218d]
- Updated dependencies [5f78953]
- Updated dependencies [639114c]
- Updated dependencies [639114c]
- Updated dependencies [639114c]
- Updated dependencies [1490691]
- Updated dependencies [1f31d3a]
- Updated dependencies [d8ec8d6]
- Updated dependencies [351eb31]
- Updated dependencies [866cd1d]
- Updated dependencies [20c04b2]
- Updated dependencies [01c9023]
- Updated dependencies [48c19bd]
- Updated dependencies [a6d8b8d]
- Updated dependencies [b652514]
- Updated dependencies [adbda1b]
- Updated dependencies [8952395]
- Updated dependencies [e8c553b]
- Updated dependencies [2e32ed4]
- Updated dependencies [7c3df8f]
- Updated dependencies [a4514e8]
- Updated dependencies [e75f4c9]
- Updated dependencies [19f1639]
- Updated dependencies [47547d0]
- Updated dependencies [858cd72]
- Updated dependencies [554f2b6]
- Updated dependencies [669d71b]
- Updated dependencies [6a99bb2]
- Updated dependencies [ed27d7c]
- Updated dependencies [52c8cf7]
- Updated dependencies [52c8cf7]
- Updated dependencies [3399704]
- Updated dependencies [81a2eb1]
- Updated dependencies [20cb8db]
- Updated dependencies [00d2fa6]
- Updated dependencies [c6198c2]
- Updated dependencies [51eb515]
- Updated dependencies [c354ce5]
- Updated dependencies [8fe8e5c]
- Updated dependencies [2a5bf45]
- Updated dependencies [9587fc9]
- Updated dependencies [e62c44e]
- Updated dependencies [5d0876c]
- Updated dependencies [b041b9c]
- Updated dependencies [ce2aaef]
- Updated dependencies [bc640ec]
- Updated dependencies [3e377c9]
- Updated dependencies [a3eb5d0]
- Updated dependencies [4ce14f1]
- Updated dependencies [2af1fa7]
- Updated dependencies [caf477f]
- Updated dependencies [f6375da]
- Updated dependencies [967e5d8]
- Updated dependencies [a4611b3]
- Updated dependencies [20316ba]
- Updated dependencies [d3499b3]
- Updated dependencies [91f9276]
- Updated dependencies [18897a4]
- Updated dependencies [8b7ea39]
- Updated dependencies [a915064]
- Updated dependencies [52cac38]
- Updated dependencies [53ded82]
- Updated dependencies [64a252d]
- Updated dependencies [4f9f1ee]
- Updated dependencies [c842594]
- Updated dependencies [cf1d29e]
- Updated dependencies [0758bd8]
- Updated dependencies [f57ca75]
- Updated dependencies [0ea7054]
- Updated dependencies [fc32921]
- Updated dependencies [8f9d87a]
- Updated dependencies [6bca0e4]
- Updated dependencies [81c0bc4]
- Updated dependencies [b2e85a9]
- Updated dependencies [d5c1f52]
- Updated dependencies [c7cd2b6]
- Updated dependencies [b2065e7]
- Updated dependencies [2fcefb9]
- Updated dependencies [77f846a]
- Updated dependencies [bc5870c]
- Updated dependencies [b55a346]
- Updated dependencies [065bba7]
- Updated dependencies [100547e]
- Updated dependencies [3a58149]
- Updated dependencies [6d1c155]
- Updated dependencies [d7573b3]
- Updated dependencies [bf3edfe]
- Updated dependencies [6ce89da]
- Updated dependencies [0e05aac]
- Updated dependencies [5aed9e4]
- Updated dependencies [83c77dc]
- Updated dependencies [18a8e7d]
- Updated dependencies [e7957ab]
- Updated dependencies [f7e34ca]
- Updated dependencies [e719ebd]
- Updated dependencies [f9e4f91]
- Updated dependencies [fa429cf]
- Updated dependencies [ed8df3e]
- Updated dependencies [b470e91]
- Updated dependencies [8ebd57f]
- Updated dependencies [c40f3b8]
- Updated dependencies [199d31b]
- Updated dependencies [3e01cb5]
- Updated dependencies [7138bc1]
- Updated dependencies [cef27e2]
- Updated dependencies [4e8622b]
- Updated dependencies [dffd752]
- Updated dependencies [105f3c5]
- Updated dependencies [3ccd9e8]
- Updated dependencies [689b979]
- Updated dependencies [e546222]
- Updated dependencies [fd13f52]
- Updated dependencies [20e317c]
- Updated dependencies [0fce2ef]
- Updated dependencies [8e00bfd]
- Updated dependencies [8d37efb]
- Updated dependencies [9118a31]
- Updated dependencies [de570cc]
- Updated dependencies [b2ea297]
- Updated dependencies [5b5a5c3]
- Updated dependencies [a691c0b]
- Updated dependencies [1e66879]
- Updated dependencies [c5200f0]
- Updated dependencies [af3861f]
- Updated dependencies [515f171]
- Updated dependencies [258d264]
- Updated dependencies [c00bf28]
- Updated dependencies [f2158ec]
- Updated dependencies [fd8dace]
- Updated dependencies [78cbdb5]
- Updated dependencies [b7543a9]
- Updated dependencies [6c6cee7]
- Updated dependencies [83fe6e7]
- Updated dependencies [d1ab06f]
- Updated dependencies [38a9568]
- Updated dependencies [91783c4]
- Updated dependencies [2d36552]
- Updated dependencies [b2437a7]
- Updated dependencies [f157423]
- Updated dependencies [7a90afd]
- Updated dependencies [eddc1dd]
- Updated dependencies [c9327c9]
- Updated dependencies [920165d]
- Updated dependencies [3c73d99]
- Updated dependencies [ed71d9e]
- Updated dependencies [7776fc2]
- Updated dependencies [fb96ecb]
- Updated dependencies [1170ed1]
- Updated dependencies [f75810e]
- Updated dependencies [4d73b07]
  - @object-ui/i18n@17.7.0
  - @object-ui/core@17.7.0
  - @object-ui/types@17.7.0
  - @object-ui/data-objectstack@17.7.0

## 17.6.0

### Minor Changes

- f1d4748: Remove the retired `striped` / `bordered` / `virtualScroll` list-view surface
  
  objectstack#7176 retired `list.striped`, `list.bordered` and `list.virtualScroll`
  from the spec after measuring every objectui reader as pass-through: each one
  copied the key onward and no renderer ever applied it. objectui stops declaring,
  typing and forwarding them.
  
  Off the chain: the `@objectstack/spec` list-view bridge in `@object-ui/react`,
  `ListView`'s child-view props in `@object-ui/plugin-list`, both `ObjectView`
  relays (`@object-ui/plugin-view` and `@object-ui/app-shell`), the `ObjectGridSchema`
  and `NamedListView` declarations in `@object-ui/types` (interface and zod),
  `ObjectGrid.component.yml` in `@object-ui/components`, and the page-block
  inspector's `striped` / `bordered` toggles in the metadata-admin designer.
  
  Behaviour is unchanged: nothing read these keys, so nothing rendered differently
  for them. Stored view metadata that still carries one keeps validating — the keys
  are simply no longer relayed. `ListViewSchema` continues to take the spec's
  list-view fields by reference, so the protocol's own retirement tombstones
  arrive with the next `@objectstack/spec` bump and reject the keys at the
  authoring boundary. Restoring any of the three as live surface requires an
  implementation card filed first, per the ruling.
- 8c0d52e: A form's ruled `submitBehavior.url` redirect can now be performed by the HOST, so a destination stays inside a console mounted at a sub-path (objectui#4989 defect 4).
  
  `ObjectForm` and `WizardForm` accept a relative in-app path and used to travel to it with `window.location.assign`. A rooted path resolves against the ORIGIN there, so under a mounted host — `<BrowserRouter basename="/_console">`, which the framework CLI configures for every embedded deployment — an authored `/thanks` left the application. The destination was correct and the navigation was wrong, and a published renderer cannot fix that alone: only the host knows its mount.
  
  **New: `HostNavigationContext` (`@object-ui/react`).** A host offers its own navigate; a renderer uses it when it is there:
  
  ```tsx
  import { HostNavigationProvider } from '@object-ui/react';
  import { useNavigate } from 'react-router-dom';
  
  function Bridge({ children }) {
    const navigate = useNavigate();
    return (
      <HostNavigationProvider value={{ navigate: (to, o) => navigate(to, { replace: o?.replace ?? false }) }}>
        {children}
      </HostNavigationProvider>
    );
  }
  ```
  
  `@object-ui/app-shell`'s `ConsoleShell` now mounts that bridge above every console route, so the console's own routes, and its basename, are what a post-submit redirect resolves against — and the redirect becomes an SPA transition instead of a full page load.
  
  **Nothing changes for a host that wires nothing.** With no provider the behaviour is byte-for-byte what it was: one `window.location.assign` of the resolved path after the declared `delayMs`. A host with no router has no basename, so origin-rooted resolution is already right there — the seam changes what a MOUNTED host gets and nothing else. `useHostNavigation()` outside a provider answers `{ navigate: undefined }` and never throws.
  
  Two mechanisms were weighed and rejected by the ruling, recorded so they are not re-proposed. **Reading React Router's context when a router happens to be present** is implicit, and unavailable anyway: a React context is a module-instance object, so reading the host's means importing `react-router` into the renderer — which `@object-ui/plugin-form` declares in none of its dependency fields, whose published build externalises every bare specifier, and which two real consumers (`apps/site`, `packages/plugin-view`) do not install. **Requiring `react-router` as a peer** is the honest version of the same thing and costs the package its property of dropping into any React application.
  
  What the host takes on by supplying a navigate: the destination becomes a client-side transition, so an in-app path with no matching route renders the host's not-found instead of a full page load. That is the host's routing table to answer for, which is why the choice is the host's. The contract verdict is unchanged either way — a destination `@objectstack/spec` refuses is refused identically with or without a seam, so an injected navigate can never launder a value the authoring door rejects.
  
  `navigateOnSuccess` is a different declared key with its own open contract question (objectui#5034) and is deliberately untouched here.
- dbbd38a: fix(react): `bridgeListView` emits the column spelling the spec declares
  
  `mapColumn` took a spec-canonical `ListColumn` — whose columns are **already**
  spelled `field` / `label` — and down-translated every one of them to
  `{ accessorKey, header }` before emitting the `object-grid` node, which
  `ObjectGrid` then translated back. A round trip through a spelling
  `ListColumnSchema` refuses by name, on a value that arrived canonical. The
  bridge now forwards the declared shape, and the tolerance branch on the other
  side retires in the same release (see `@object-ui/plugin-grid`).
  
  **Output shape.** `bridgeListView` / `SpecBridge.transformListView` emit
  `columns: [{ field, label?, … }]`. Code reading `node.columns[i].accessorKey`
  off a bridged node reads `field` instead; `header` becomes `label`. The bare
  string shorthand `columns: ['name']` now maps to `{ field: 'name' }`.
  
  **No label is invented any more.** `header: col.label ?? col.field` turned "the
  author declared no label" into "the author declared the machine name", and that
  synthesized value pre-empted `ObjectGrid`'s own header chain — the column's
  label, then the **object field's** label, then the prettified machine name —
  whose middle step exists so a localized field label wins on a non-English app.
  A bridged view therefore rendered raw machine names where a directly authored
  `object-grid` rendered the field's real label. A bare `{ field }` column now
  reaches that chain intact.
  
  Speaking the declared spelling also routes bridged views through the renderer's
  full ListColumn path rather than its type-inference-only one: object-schema
  field enrichment, `hidden` filtering, primary-field auto-linking, and per-column
  `link` / `action` handling now apply to a bridged `ListView` exactly as they do
  to an authored grid.

### Patch Changes

- 516663d: RecordAttachmentsPanel no longer offers a Retry for an api-disabled `sys_attachment` read.
  
  `OBJECT_API_DISABLED` (404, `enable.apiEnabled: false`) and its sibling
  `OBJECT_API_METHOD_NOT_ALLOWED` (405, the operation is absent from
  `enable.apiMethods`) are pure functions of the object's metadata — no user, no
  session, no request body — so every retry of every persona re-fetches the
  identical refusal. Before this change both landed in `RecordAttachmentsPanel`'s
  `unavailable` state and offered a Retry that was guaranteed to change nothing,
  the same wrong advice `ListView`'s error panel already stops giving for list
  reads.
  
  The panel gains a fifth status, `api-unavailable`: no Retry button, and honest
  copy ("The attachments list is not available on this object.", new
  `detail.attachmentsApiUnavailable` key in all ten locale packs) instead of
  "We couldn't load the attachments for this record." The pre-existing `denied`
  (authorization) and `unavailable` (network/5xx/expired-session) states and
  their affordances are unchanged.
  
  `ListView.classifyLoadError` — the classifier that already separated this case
  into its own `api-disabled` kind for list views — is lifted out of
  `packages/plugin-list/src/ListView.tsx`'s module scope into
  `@object-ui/react` (`classifyLoadError`, `LoadErrorKind`), so both surfaces
  consume one classification instead of `RecordAttachmentsPanel` re-deriving it.
  `ListView`'s own behavior is unchanged — it now imports the function it
  previously defined locally. The classifier delegates its api-disabled check to
  `isApiAccessDeniedError` (`@object-ui/data-objectstack`), removing a second,
  independently-maintained copy of the same code list.
- d374caf: SpecBridge's form-view bridge stops reading `defaultSort` and `aria`, two keys spec 17
  retired on the FormView carrier (`retiredKey()` tombstones — authoring either is a parse
  error). Both guards were unreachable for any FormView that passed validation, and both
  ends were measured dead before removal: no form renderer reads either off the node
  (`plugin-form` reads neither, and `SchemaRenderer`'s ARIA injection resolves flat
  `ariaLabel`/`ariaDescribedBy`/`role`, never a nested `aria` object). Behaviour for
  spec-valid metadata is unchanged; a host that fed the exported bridge a raw pre-17
  document no longer gets these two keys copied onto a node slot nothing consumed. The
  LIST view's `aria` pass-through is untouched — that carrier stayed live and is applied by
  `ListView`.
- af5e292: Emit explicit file extensions on relative import specifiers, so the published
  entries can be imported by Node's own ESM resolver.
  
  `@object-ui/react`'s built entry re-exported through extensionless relative
  specifiers (`export * from './SchemaRenderer'`). Node does not extension-search
  relative specifiers, so `import('@object-ui/react')` under plain Node — an SSR
  host, or any consumer without a bundler — failed with `ERR_MODULE_NOT_FOUND`.
  Bundled consumers were never affected and are unchanged by this.
  
  `@object-ui/types`, `@object-ui/core` and `@object-ui/i18n` carried the same
  emission; `@object-ui/react`'s entry stayed unloadable until they were fixed
  too, because evaluation crosses into them. No exported API changed.
- 0046d8f: Evaluate expressions written under a node's `properties`, not just under `props`
  
  `properties` is the spec spelling of a node's config bag and `props` is the
  legacy alias, but `SchemaRenderer`'s evaluation memo only ran the expression
  evaluator over `props`. Renderers in the `element:*` namespace read
  `schema.properties` first, so a node written the canonical way handed the
  renderer the raw `${…}` source and rendered it verbatim, while the same node
  written with the alias evaluated correctly — writing the spec-compliant form
  was the way to lose your expressions.
  
  `schema.properties` values are now evaluated per value, exactly as `props`
  already was, and the evaluation runs before the existing
  `properties`-to-top-level hoist so a key means the same thing whether it is read
  as `schema.properties.x`, as `schema.x`, or as the spread `x` React prop.
  Evaluation stays shallow on both spellings (nested objects and arrays are passed
  through, not walked), and `properties` keeps its precedence over `props`.
- 70a774b: A node writing both `properties` and `props` now gets ONE answer per key, and it is the canonical `properties` one — on both read channels.
  
  `properties` is the spec spelling of a node's config bag and `props` is the
  annotated legacy alias, but which one actually reached the screen depended on
  how the receiving renderer happened to read it — and the two channels disagreed
  in opposite directions:
  
  - **config bag** (`schema.properties.x`) — the `element:*` family's
    `readProps()` merges `{ ...schema.props, ...schema.properties }`, so
    `properties` won.
  - **React prop** (`x` arriving as a prop) — `SchemaRenderer`'s `createElement`
    spread the hoisted `properties.*` values first and then
    `...(evaluatedSchema.props || {})` last, which overwrote them, so `props` won.
  
  Measured on one render of one such node: the bag read `FROM_PROPERTIES` while
  the same key read as a React prop gave `FROM_PROPS`. Which value rendered was
  decided by nothing an author can see — only by whether their chosen component
  belonged to the `readProps()` family.
  
  The React-prop channel now declines to let the legacy alias override a key the
  canonical bag also declares; the config-bag order was already correct and is
  unchanged. Scope is co-occurrence only: a key that only `props` declares still
  works exactly as before, and a node that writes one spelling is untouched. The
  `props` alias is not retired here — only its precedence against a co-present
  canonical spelling is settled.
- dfc6975: Related-list "+ New" now honours `userActions.create` predicates, and the grid
  toolbar's inline-edit affordance is gated on `update` permission (objectui#4646,
  objectui#4647).
  
  Two declared-but-unenforced gaps on the same toolbar surface.
  
  **#4646 — `createPredicates` had a producer and no consumer.**
  `@objectstack/spec@17.0.0` widened `userActions.create` to
  `z.union([z.boolean(), RowCrudActionOverrideSchema])`, so `resolveCrudAffordances`
  emits `createPredicates` — and nothing in objectui read them, against roughly
  fifteen consumption sites apiece for `editPredicates` / `deletePredicates`. The
  symptom: a parent record entering a frozen state correctly greyed its children's
  row Edit/Delete while the related list's "+ New" stayed fully live, so the user
  filled in the whole child form to earn a server 409. The related-list toolbar now
  evaluates `visibleWhen` / `disabledWhen` **once against the host parent record**,
  per the spec docblock's binding for this key, on top of the existing
  `o.create ∧ can(child, 'create')` check. `visibleWhen` hides "+ New" and fails
  CLOSED; `disabledWhen` greys it and fails SOFT — the same evaluator, fail
  directions and hidden-vs-disabled split the record header already uses for
  edit/delete (objectui#4419 / PR #4515). A bare-boolean `userActions.create` is
  untouched: with no predicates there is nothing to evaluate.
  
  **#4647 — the inline-edit toggle was the one ungated affordance on its toolbar.**
  It rendered on "grid view ∧ the host wired `onInlineEditChange` ∧ not the compact
  toolbar", and every host wires that callback unconditionally. New and Import are
  hidden for an account without the grant and the bulk-delete entry on the same
  toolbar ANDs `can(obj, 'delete')`, but a read-only principal could flip inline
  edit, modify cells and press "Save all" to earn a server 403. It is now gated on
  the object's resolved edit affordance ∧ `can(object, 'update')`, mirroring that
  bulk-delete gate. The gate is applied at all three sites that carry this
  affordance — the wide toolbar's toggle, the compact toolbar's settings-popover
  entry (which previously had no gate at all, not even the callback), and the
  `editable` mode handed to the grid, so a stored view carrying `inlineEdit: true`
  can no longer drop a read-only principal into editable cells with no toggle to
  press.
  
  `ListViewSchema.userActions.editInline` is also consumed now: an explicit `false`
  withholds the affordance wholesale, which authors previously could not do.
  
  **Behaviour change for read-only users, stated plainly.** Where the UI used to
  offer inline editing and let the server refuse it, it now declines to offer the
  entry point at all. No data access changes — the server gate was and remains the
  enforcement boundary; this only stops the UI walking users into round-trips
  guaranteed to fail. Accounts *with* the grant see no change, and hosts with no
  `PermissionProvider` mounted (standalone embeds, the Studio designer) keep
  today's behaviour, since `can()` answers `true` there by design.
  
  One deliberate non-change: the absent case of `userActions.editInline` defers to
  the host's existing `inlineEdit` channel rather than enforcing the spec's
  `.default(false)`. Enforcing that default would remove the toggle from every
  stored console list view in one release, since nothing folds a legacy key into
  `editInline` and no existing view declares it. This follows the rule the
  surrounding toolbar-flag block already states for itself — defaults chosen to
  match what the flags have always done. `InterfaceListPage`, the key's other
  consumer, reads the absent case as OFF, because the ADR-0047 interface page has
  no such host channel to defer to.
- 144ef9b: Dev builds now shout when an unevaluated `${…}` expression reaches the DOM.
  
  A value only reaches the user if `SchemaRenderer` EVALUATES it and the renderer
  READS IT BACK, and those two sets do not fully overlap. Where they miss, the
  failure was silent. Measured on a real render with `dataSource: { n: 99 }`:
  `{ type: 'ui:statistic', value: '${data.n}' }` puts the literal text `${data.n}`
  on screen, because the evaluation memo covers `content`, the `properties` /
  `props` bags and the predicate keys and passes every other top-level key through
  untouched. An author — increasingly, an AI authoring metadata — got no signal at
  all: a literal `${data.n}` in front of a user reads like a data problem rather
  than a contract violation.
  
  `SchemaRenderer` now reports such a value once per node via `console.error`,
  naming the node type and id, the key the raw source survived on (spelled the way
  it was authored — `properties.value`, not the hoisted top-level copy), the
  expression source verbatim, and the channels that do work today. It also catches
  the second, harder shape: an expression that WAS evaluated but THREW, which
  `ExpressionEvaluator` returns as its source text — indistinguishable on screen
  from a key that was never evaluated.
  
  Diagnostic only. No evaluation behaviour changes, no DOM attribute is added, and
  the whole module is behind the module-load `NODE_ENV` constant a bundler folds
  away, so production pays nothing.
  
  Two boundaries are deliberate. The scan is exactly as deep as evaluation is —
  shallow — because a nested `aria: { label: '${…}' }` keeps its raw source today
  by decision (objectui#4799 pinned that shallowness on both bags), and a deeper
  scan would report a shape the engine has not yet decided to change. And schema
  METADATA is never reported: `visible` / `visibleWhen` / `hidden` / `disabled` /
  … hold raw predicate source by design, and the diagnostic reads the set of
  values that actually leaves for the DOM, after those keys have been stripped.
  
  Part of objectui#4795 (Direction 3, per the maintainer's 2026-08-17 ruling).
  Widening the set of evaluated text keys is Direction 1 and stays deferred behind
  its named restart condition; this change deliberately does not pre-empt it.
- Updated dependencies [88085e3]
- Updated dependencies [69251bf]
- Updated dependencies [57e668f]
- Updated dependencies [516663d]
- Updated dependencies [41ac1b7]
- Updated dependencies [1eaf0a1]
- Updated dependencies [2533ec5]
- Updated dependencies [bbe8b86]
- Updated dependencies [8477be5]
- Updated dependencies [279fb13]
- Updated dependencies [2e82ab2]
- Updated dependencies [ad07b65]
- Updated dependencies [41f498b]
- Updated dependencies [ef0d150]
- Updated dependencies [1ef236e]
- Updated dependencies [f34226e]
- Updated dependencies [564b605]
- Updated dependencies [e1d4251]
- Updated dependencies [1184192]
- Updated dependencies [a2a9747]
- Updated dependencies [a1609a6]
- Updated dependencies [37f6844]
- Updated dependencies [2b50261]
- Updated dependencies [ac600e5]
- Updated dependencies [c1ef923]
- Updated dependencies [af5e292]
- Updated dependencies [7f96b10]
- Updated dependencies [167ec42]
- Updated dependencies [cf4f8a6]
- Updated dependencies [f1d4748]
- Updated dependencies [bea374e]
- Updated dependencies [b1119ec]
- Updated dependencies [9f23d2b]
- Updated dependencies [578e025]
- Updated dependencies [af025ee]
- Updated dependencies [d109a4d]
- Updated dependencies [3d053bb]
- Updated dependencies [598c89a]
- Updated dependencies [b8b9af4]
- Updated dependencies [31676be]
- Updated dependencies [9ce096f]
- Updated dependencies [e05db88]
- Updated dependencies [ad13d63]
- Updated dependencies [5ffcc14]
- Updated dependencies [d971e51]
- Updated dependencies [97abb24]
- Updated dependencies [deb157a]
- Updated dependencies [9c60144]
- Updated dependencies [d2ce342]
- Updated dependencies [a8411ad]
- Updated dependencies [9695da7]
- Updated dependencies [58b8346]
- Updated dependencies [a9e17b4]
- Updated dependencies [b8ce7dc]
- Updated dependencies [8871c14]
- Updated dependencies [dfc6975]
- Updated dependencies [3cf4de0]
- Updated dependencies [c9dc811]
- Updated dependencies [d871f8e]
- Updated dependencies [a0b9e91]
- Updated dependencies [99bd015]
- Updated dependencies [21e4585]
  - @object-ui/types@17.6.0
  - @object-ui/i18n@17.6.0
  - @object-ui/core@17.6.0
  - @object-ui/data-objectstack@17.6.0

## 17.5.0

### Minor Changes

- d9d3463: Retire four zero-consumer declared surfaces (dead-surface sweep batch 3, #4328). Each was
  measured as declared-but-never-read at the branch point, and each is removed rather than
  left as an authoring surface whose values nothing acts on.

  Breaking for anyone who typed against the removed declarations, marked `minor` per this
  repository's version-alignment convention (the major tracks `@objectstack`, never an
  API-break count):

  - `@object-ui/core` no longer exports `mergeViewsIntoObjects`. It was a second copy left
    behind by the move of that step to the provider layer, and it had drifted: it ignored a
    view container's default `list` and keyed views by the authored bare key instead of the
    composer's `<object>.<key>` identity. The live implementation — `MetadataProvider`'s, in
    `@object-ui/app-shell` — is unchanged and remains the only one. (#3775)
  - `@object-ui/types`' `RoleDefinition` no longer declares `permissions`. A role's grants
    live in `ObjectPermissionConfig.roles`, keyed by object; that is the only home any
    consumer reads (`resolveRoles` walks `inherits` and matches on `name`). The removed
    field was _required_, so five fixtures across three packages had been declaring an empty
    array for a value nothing would ever look at. Role-attached grants are now a compile
    error rather than silently ignored data. (#4288)
  - `@object-ui/react`'s `RecordContextValue` no longer declares `loading` / `error`. Both
    had zero producers and zero consumers — no host passed them, no `record:*` renderer read
    them — and only the provider's memo dependency list still named them. Record-level
    loading and error state stays where it is actually expressed: each renderer's own data
    source. (#3773)

  No behaviour change, no request-count change:

  - `@object-ui/data-objectstack` drops five `metadataCache.invalidate('views:<object>')`
    calls across `updateViewConfig` / `createView` / `updateView` / `deleteView`. No read
    path has ever populated that key — `listViews` fetches directly, uncached — so all five
    were permanent no-ops. The invalidations of the keys that do have readers
    (`view:<object>:<viewId>` for `getView`, `view-overrides:<object>` for
    `listViewOverrides`) are untouched and now pinned. (#3778)

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

- d7f3e30: `bridgeListView` maps the five row heights the spec admits, and only those — the four dead spellings are gone

  `mapDensity` carried a nine-key table: `compact`, `short`, `comfortable`,
  `spacious`, `small`, `medium`, `large`, `tall`, `extra_tall`. `RowHeightSchema`
  in `@objectstack/spec` admits five — `short | compact | medium | tall |
extra_tall` — so `comfortable`, `spacious`, `small` and `large` were unreachable
  from any spec-valid list view. The bridge's own parameter type said as much
  (`Partial< ListView >`), and `mapDensity` widened it back to `rowHeight?: string`
  to let them in. They survived because the fixture asserting three of them
  compiled against nothing: the package's build tsconfig excludes tests and no
  other `tsc` read them, so four branches of renderer-side dialect read as live
  capability (objectui#4352, surfaced by objectui#4040 / PR #4351).

  They are deleted. The parameter takes the spec type honestly, and the table is
  now `Record< RowHeight, … >`, so a row height added upstream fails the build here
  instead of arriving with no density. This is AGENTS.md #0.1: a lenient reading
  for off-spec metadata is a second de-facto contract, and one strict contract
  beats N dialects — a bad `rowHeight` gets fixed at the producer, where the schema
  already rejects it.

  **Breaking semantics, deliberately graded `minor`** (this repo never publishes
  `major` — its major tracks `@objectstack`). Nothing narrows in the published type
  surface: `mapDensity` is module-local and never appeared in the emitted `.d.ts`,
  and `bridgeListView`'s declaration is unchanged. What changes is runtime output,
  and only for input the spec already rejects: a host handing the bridge
  `rowHeight: 'comfortable'` (or `'spacious'` / `'small'` / `'large'`) used to get
  `density: 'comfortable'` / `'spacious'` / `'compact'` back, and now gets no
  `density` key at all, so the renderer's own default applies. A sweep of this repo,
  the `objectstack` example apps and the console's view metadata found zero authored
  uses of any of the four; the legacy `densityMode` alias cannot produce one either,
  since `DENSITY_MODE_TO_ROW_HEIGHT` is typed `Record< DensityMode, RowHeight >` and
  folds onto `compact` / `medium` / `tall`.

- a84385b: `NavigationConfig.mode` is optional — the type now says what the hook does

  `@object-ui/react` published a `NavigationConfig` that required `mode`, in front of a `useNavigationOverlay` that has always defaulted it. The declaration took the spec's authored config, `Omit`ted `mode`, and re-added it as `NonNullable< … >`; 140 lines below, the hook read `navigation?.mode ?? 'page'`. The type was strictly stricter than the implementation it fronted, and `'page'` is meaningful behaviour rather than a placeholder.

  The spec never asked for that. `NavigationConfigSchema` declares `mode: NavigationModeSchema.default('page')`, and a `.default()` lands on the authoring side as `| undefined` — so `navigation: { view: 'summary_view' }` is legal authored metadata that lets the mode default. `@object-ui/types` already re-exported the spec's own `NavigationConfig` unchanged, which meant one monorepo shipped two published types of the same name that disagreed about whether `mode` could be omitted.

  The alias is now the spec's authored config verbatim, with no divergence of its own:

  ```ts
  export type NavigationConfig = SpecAuthoredInput<
    typeof NavigationConfigSchema
  >;
  ```

  The cost of the old spelling was paid by callers. `ListView` carried `schema.navigation as NavigationConfig | undefined` for no reason except to get a valid spec-shaped value past the declaration; that assertion is deleted here, not replaced. A type in front of an implementation must not be stricter than the implementation — when it is, every caller pays in casts, and a cast is exactly the renderer-side workaround that belongs back at the producer.

  **Nothing changes at runtime.** `navigation?.mode ?? 'page'` is untouched, and the default is now pinned as observable behaviour (`useNavigationOverlay.modeDefault.test.tsx`) rather than only as a comment — the explicit modes, the `preventNavigation` and `none` short-circuits, the `onRowClick` priority, and the Cmd/Ctrl/middle-click and `new_window` branches are all pinned alongside it.

  **Why minor rather than patch**, from the measured `.d.ts`. Optional-izing a property is looser for writers and narrower for readers, so the grade turns on which role the published surface actually plays. In this package `NavigationConfig` occurs only in input positions — `useNavigationOverlay`'s `navigation?:` option and `resolveOverlayWidth`'s parameter — and never in a return type; the package consumes these values and never hands one back. For consumers the change is therefore purely permissive: every call that compiled before still compiles, and spec-shaped configs that previously needed an assertion now compile without one. That gained input shape is a real capability rather than an internal repair, which is more than a patch describes. The reader-side narrowing is real but secondary: code that imports the bare type, annotates its own value with it and reads `.mode` now sees `NavigationMode | undefined`. The in-repo census found exactly one such importer — `ListView` — and it imported the type only to write the assertion this change removes.

- c1d939f: One `SchemaNode`, and one label vocabulary — the union wins, and labels resolve where the locale lives

  Two packages published a type called `SchemaNode` and they were not the same type. `@object-ui/core` hand-declared `interface SchemaNode { type: string; … [key: string]: any }`; `@object-ui/types` exported `type SchemaNode = BaseSchema | string | number | boolean | null | undefined`, whose own doc comment names `'Plain string'` a valid node. Both were exported under one name from packages the same consumers import together, so which declaration a call site got depended on which package it happened to import from — #4548's canary measured 19 of 35 errors as exactly that collision. Core's declaration is now a re-export of types', so there is one declaration left to disagree with. Core's entry surface is unchanged: `dist/index.d.ts` is byte-identical across the change.

  Reconciling it exposed a real defect rather than a mechanical narrowing, which is why the first attempt was withdrawn instead of forced. The spec bridges write `spec.label` — the spec's `I18nLabel`, an INLINE locale map like `{ en: 'Owner', 'zh-CN': '负责人' }` — into `node.label`, and `BaseSchema.label` declared `string`. Under core's old index signature that assignment was invisibly `any`; under one honest `SchemaNode` it is a type error. `BaseSchema.label` and `.description` therefore now accept `string | I18nLabel`, and the two bridge assignments compile with their expressions untouched.

  Resolution happens at READ time, in the renderer, against the display locale — not at the bridge. Resolving at the bridge was measured unimplementable: it is a plain class method that cannot call a hook, `BridgeContext` declares no locale, and `updateContext()` has zero callers, so a bridge-resolved label would freeze one audience's language into the node tree with no re-translation channel. React's own invalidation re-translates for free at the read site.

  The widening turned every blind `schema.label`-as-string read into a named compiler error, and that inventory is the audit: it named four sites repo-wide, all one class — the label reaching a React child position, where a map does not render as `[object Object]` but THROWS `Objects are not valid as a React child`, failing the whole subtree. Three are `@object-ui/components` renderers (`filter-builder`, `sidebar-group`, `dropdown-menu`), which now resolve with the spec's own `resolveI18nLabel` against `useDisplayLocale()`. The fourth is `plugin-dashboard`'s `DashboardGridLayout` heading, which resolves with `pickLocalized` against the active UI language — matching the widget-title resolution already in that same component rather than putting two resolvers and two disagreeing locale channels in one render; the two resolvers are limb-for-limb twins with a parity test pinning them.

  One interface now carries both label vocabularies two properties apart — `label`/`description` are the spec's INLINE map, `ariaLabel` is the KEYED bundle reference — and each accepts the other's shape vacuously. That confusability is objectui#4167's known hazard, inherent to the spec's `I18nLabel` design; both shapes are named with cross-referenced doc comments stating which resolver owns which slot, and a pin asserts the two unions do not collapse into each other.

  Finally, the spec bridges declare their return type as `BaseSchema` instead of the union. Both bridges end in a single `return node` on an object literal, so the union described nothing real while forcing a narrowing at every read — 272 mechanical errors across five suites in the first round. That change is a type annotation only; the emitted JavaScript is byte-identical.

- 3f5f87c: `SchemaRenderer` states its real contract — a typed, required `schema` and a deliberate forwarding surface

  `SchemaRenderer` is the renderer loop: every registered SDUI component is rendered through it. It handed `forwardRef` a props type of `{ schema: SchemaNode } & Record<string, any>`, which puts `string` into `keyof Props`, so `'ref' extends keyof Props` was always true, React's `PropsWithoutRef` took its `Omit` branch, and `Omit` over a type carrying a string index signature keeps only the index signature. Every declared prop was erased. Measured on the pre-fix source: `keyof ComponentProps<typeof SchemaRenderer>` was `string` and `ComponentProps<typeof SchemaRenderer>['schema']` was `any`, while the type argument went on declaring `SchemaNode`. The other half is the same defect seen from the call site — `<SchemaRenderer />` with no schema at all, `<SchemaRenderer schema={12345} />`, and an arbitrary misspelled prop each type-checked in silence. This is objectui#4422 / PR #4438's trap in the most central component in the repo, spelled `Record<string, any>` rather than `[key: string]: any`, which is why every previous sweep's grep and both shipped guards' detector reported the site as clean.

  Graded **minor, not major**, on objectui#4528's reasoning: the type argument has always DECLARED `schema`; the index signature erased it from the resolved type, and restoring what the declaration documents is a fix to the published contract rather than a contract break.

  **The forwarding surface is kept, deliberately.** This component forwards every prop it does not read to the component the schema names, resolved at runtime from a plugin-extensible registry — `packages/react/README.md` documents exactly that, and `@object-ui/components`' form renderer consumes the `onSubmit` it shows being forwarded. Closing that surface would state a false contract and would force every leaf plugin's props into this package. So the two halves are separated: the `forwardRef` type argument is the honest `SchemaRendererProps`, with no index signature for `PropsWithoutRef` to collapse, and the open surface is stated once in an explicit export annotation, which nothing routes through `Omit`. The published `.d.ts` shows the erasure disappearing: `ForwardRefExoticComponent<Omit<{ schema: SchemaNode } & Record<string, any>, "ref"> & RefAttributes<any>>` becomes `ForwardRefExoticComponent<SchemaRendererProps & Record<string, any> & RefAttributes<any>>`.

  `SchemaRendererProps.schema` is declared as `BaseSchema | string | null | undefined` — what this component actually handles. It previously declared `@object-ui/core`'s `SchemaNode` interface, which requires `type: string` and so contradicted the component's own early returns for strings and nullish, while every caller held `@object-ui/types`' wider union. The erasure hid that mismatch completely.

  **One declared behaviour change.** A non-object, non-string primitive schema now renders as its own text. It previously fell through to the shallow copy `{ ...schema }`, which spreads a primitive to an empty object, lost the `type` the renderer then looked up, and surfaced the red "Unknown component type: undefined" box — an accident of the spread rather than a decision. The declared props type excludes `number` / `boolean` so no author is invited to pass them; the runtime handling is defence-in-depth for untyped callers and stored metadata. Strings, `null`, `undefined`, `0` and `false` render exactly as before, and an object naming an unregistered type still gets the error box; all four are pinned.

  Latent defects the erasure had been hiding, each surfaced by the repo-wide type-check and fixed at its call site: `DashboardRenderer` cast its widget schema to `Record<string, any>`, dropping the `type` every branch of `getComponentSchema` sets; `DashboardGridLayout`'s equivalent now states its return type instead of inferring a union that admitted a shape with no `type`; and `ReportViewer` handed a section's `content` array to the renderer whole, so a multi-node section rendered the unknown-component box instead of its content — arrays are mapped rather than widened into the renderer's declared input.

  A repo-wide structural guard replaces the two per-package siblings' blocked direction: it judges every `forwardRef` in `packages/*/src` (219 sites) and its detector resolves `Record<string, …>` and `string`-keyed mapped types in addition to literal index signatures — the spelling the previous detector went blind on. It judges the type argument only, where an index signature is an accidental eraser, and never an export annotation, where one is a stated contract.

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

- ceccdcf: Action confirm dialogs and success toasts now honour the bundle's translated
  `confirmText` / `successMessage`, not just `label` (objectui#4265).

  A TranslationBundle entry for an action carries three keys under one
  `_actions.<name>` node — `label`, `confirmText`, `successMessage` — and
  `useObjectLabel()` has always exposed a resolver for each. What had drifted was
  the call sites: `page:header` (authored record pages), `record:quick_actions`
  and the related-list row menu resolved the button `label` only and dispatched
  the authored `confirmText` / `successMessage` untouched. One bundle entry met
  two fates: the button rendered the translation, the confirm dialog rendered the
  authored English.

  All action-rendering surfaces now go through one resolver,
  `useActionTextLocalizer()` (new, exported from `@object-ui/react`), which
  applies the existing `actionLabel` / `actionConfirm` / `actionSuccess`
  resolvers over the three keys together. Fallback is unchanged: with no bundle
  entry — or an entry lacking a key — the authored text renders. A bundle cannot
  introduce a `confirmText` or `successMessage` the metadata never declared.

- ee26e65: Analytics: the dimension label net's fetch-and-memo glue is written once, not once per surface

  PR #4388 (objectui#4330) put the same React glue on two surfaces — the dashboard's `DatasetWidget` and plugin-report's dataset block. The resolution RULES were never duplicated (both call the same `@object-ui/core` helpers), but the wiring around them was: read the object schema through the host's authenticated `apiFetch`, keep the fetched metadata locale-free in state, derive the label maps in a render memo. Two copies meant two statements of the same two bug fixes, which is a drift surface rather than a defect — nothing a user could hit today, filed as objectui#4389 so it was retired deliberately.

  It is now split along the layer that can actually hold each half. `@object-ui/core` gains the React-free parts — `loadDimensionFieldMeta` (the base-object read composed with the dimension walk), `deriveDimensionLabelMaps` (the locale-applying derivation) and `dimensionOptionTranslator` (binding the bundle resolver to the object that OWNS a terminal field, which for a dotted path is the relationship target). `@object-ui/react` gains `useDatasetDimensionLabels` / `useDatasetDimensionMeta`, the React wiring that cannot live in core, beside the `useViewData` / `useElementDataSource` / `useDiscovery` hooks that already read `SchemaRendererContext` the same way. Both plugins consume it; the dashboard keeps its chart-only per-category colour and category-order derivation layered locally, since a table renders no palette.

  The card originally proposed `@object-ui/core` as the whole glue's home. That home was disproven by measurement and retired in the card's PM RULING #2: `SchemaRendererContext` is defined in `@object-ui/react`, which depends on core, so core importing it back is a cycle — and core is React-free by declaration, by content, and by the topology in AGENTS.md. objectui#3367 had already ruled this direction for the same family (core-canonical logic, react re-exports).

  Behaviour is unchanged by construction: same read count, same best-effort fallback, same memoization boundary. The two bug fixes are now stated once and pinned at the shared hook — the read rides the host's authenticated `apiFetch` (objectui#4121, pinned by asserting that a new channel re-issues the read, i.e. that it really is in the effect's deps), and the fetched metadata stays locale-free (objectui#4030 / PR #4324, pinned by switching language at runtime and asserting the labels flip with no second metadata read). All 39 assertions PR #4388 landed across both surfaces pass unchanged, and their files are byte-identical to before.

- f650253: `BaseSchema.ariaLabel` declares the keyed i18n vocabulary the renderer actually
  resolves, `.disabled` accepts the predicate string it actually evaluates, and the
  keyed shape finally has a name (objectui#4581)

  Three slots on one base type had drifted from what the renderer does with them.
  PR #4593 fixed `visible` and measured the rest; these are the rest.

  `ariaLabel` was `string`, but `SchemaRenderer.tsx:111` resolves it with
  `resolveKeyedI18nLabel`, whose input is the KEYED form
  `{ key, defaultValue?, params? }` — a reference into a translation bundle. It is
  now `string | KeyedI18nLabel`, and `KeyedI18nLabel` is a new exported type in
  `@object-ui/types` rather than a fourth inline copy of one object literal: the
  three that existed (`@object-ui/react`'s resolver, `@object-ui/layout`'s
  `resolveLabel`, `@object-ui/app-shell`'s `t`-taking twin) were verified identical
  in their object half first, and two of them now import the name.

  The vocabulary matters more than the widening. `#4581` originally asked for
  `string | I18nLabel`, and that spelling was withdrawn as measured-wrong: the
  spec's `I18nLabel` is the INLINE LOCALE MAP (`string | Record<string, string>`),
  a different vocabulary resolved against a BCP-47 locale by a different function
  of a confusingly similar name. Under it the shipped keyed fixture type-checked
  only vacuously — as a locale map whose "locales" are named `key` and
  `defaultValue` — the same label carrying `params` was rejected outright, and a
  genuine `{ en: 'Owner' }` compiled while rendering an EMPTY `aria-label`. Naming
  the keyed shape is the declaration half of the fix objectui#4167 started on the
  naming side; `@object-ui/app-shell`'s copy keeps its inline spelling for now
  because an open PR has a pending change to that file, and the comment there says
  so.

  `disabled` was `boolean` on a key the renderer never reads as one:
  `SchemaRenderer.tsx:466` evaluates it through the same `evaluateCondition` as
  `visible`, and a `disabledOn?: string` sibling exists for the same reason. It is
  now `boolean | string`. The asymmetry with `visible` was accidental rather than
  deliberate.

  Both are widenings on authored-input-dominant properties: authors gain a
  spelling, nothing that type-checked before stops doing so, and readers already
  coped with `any` through `BaseSchema`'s index signature. Three test fixtures that
  had been casting past these declarations with `as unknown as BaseSchema` state
  their values directly now, and the declared unions are pinned invariantly so
  neither a missing widening nor an overshoot to `any` can pass unnoticed.

  Declaring the vocabulary honestly also surfaced a real one: the `toggle`
  renderer writes `aria-label` itself instead of going through SchemaRenderer's
  resolver, and it forwarded the raw value. Invoked directly it emitted
  `aria-label="[object Object]"` for a keyed label — announced verbatim by a
  screen reader. It resolves now. Through `SchemaRenderer` the bug was invisible,
  because SchemaRenderer injects its own resolved `aria-label` afterwards; a
  downstream type-check sweep found it, not a test.

  `BaseSchema.label` and `.description` are deliberately unchanged and pinned that
  way. They receive the spec's inline `I18nLabel` from the view bridges, which is a
  real defect, but resolving it belongs at the spec-to-schema boundary rather than
  in this declaration — and that work is still blocked on a design question about
  where the display locale enters, so it is not in this release.

- 8f85f8b: The spec bridge abstains on prototype-member `rowHeight` spellings instead of leaking a
  function into `density`.

  `bridgeListView`'s `mapDensity` indexed a plain object literal with an unchecked key, so
  the lookup reached `Object.prototype`. The parameter is typed `RowHeight`, but the
  boundary a host's stored view definition actually crosses is `SpecBridge.transformListView`,
  whose parameter is `any` — so `rowHeight: 'toString'` came back as `Object.prototype.toString`,
  a **function**, out of a read whose return type is three strings or nothing. `bridgeListView`
  then writes the key under `if (density)`, and a function is truthy, so the bad value was not
  merely returned: it was stored on a `SchemaNode` whose renderer expects
  `'compact' | 'comfortable' | 'spacious'`. Same for `constructor`, `valueOf`,
  `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable` and `toLocaleString`.

  The lookup is now guarded with `Object.prototype.hasOwnProperty.call(...)` — the same guard
  `@object-ui/core`'s `rowHeightToDensityMode` grew in objectui#4440, and the repo's existing
  convention at eight other sites. Both `rowHeight` surfaces now abstain identically on every
  off-spec **string** spelling, and objectui#4440's agreement pin covers the prototype-member
  family instead of excluding it (objectui#4442).

  Runtime-only: no public type moved, and no spec-valid `rowHeight` changes its answer.

- d0c3b26: Every plain `<button>` now declares its `type`. HTML defaults an untyped button to
  `type="submit"`, so any of these buttons would submit the form it was composed into
  instead of running its own handler — a real risk for renderers (`drawer`, `tree-view`,
  `navigation-overlay`) whose placement inside a form is a JSON metadata decision. 114
  sites were converted to `type="button"`; no site was a genuine submit button, and the
  DOM is otherwise unchanged.

  The defect class is now closed mechanically by a new `object-ui/button-has-type` ESLint
  rule (error), so the next untyped button fails CI at write time rather than being found
  by a fourth audit round (objectui#4045, closing the objectui#3344 family).

- f148a64: SpecBridge lifts a legacy bare `exportOptions` array to the spec's object form, so a
  spec-authored view's declared export formats reach the grid (objectui#4585).

  A spec `ListView` may spell `exportOptions` either way, and `@objectstack/spec` lifts the
  legacy bare format array to `{ formats: [...] }` when it parses one (objectstack#8010).
  That lift never ran on the bridge path: the bridge's input is a TypeScript type, not a
  parsed value — there is no `parse`/`safeParse` anywhere under `spec-bridge/` — so a host
  forwarding raw stored metadata handed the array straight through, and the bridge copied it
  onto the `object-grid` node verbatim. ObjectGrid reads the object form and only that, and
  `.formats` on an array is `undefined`, so the renderer's `['csv', 'json']` default won.

  A view declaring `['csv', 'xlsx']` therefore rendered an export menu offering CSV and
  JSON: the declared xlsx never appeared, an undeclared json did, and nothing said so — the
  export button still showed, because a non-empty array is truthy. The bridge now applies
  the spec's own transform at the assignment site, so both spellings leave it as one shape.

  Deliberately narrow: this mirrors the spec's lift and nothing else. The object form passes
  through by reference, unread and unrewritten; a view with no `exportOptions` is untouched;
  and a `'pdf'` stored before its retirement is carried rather than filtered, because the
  spec refuses that value at parse with a migration prescription instead of silently
  dropping it — such a format still dies downstream in ObjectGrid's format-agnostic menu
  filter (objectui#4535). The fix is at the producer for the same reason: a tolerant
  `Array.isArray` fallback in the renderer would make a second de-facto contract out of one
  spec key.

  One behavior follows from reading the lift literally: `exportOptions: []` now lifts to
  `{ formats: [] }` and the export button is hidden, where before the unreadable `[]` was
  merely truthy and produced a menu built entirely from the `['csv', 'json']` default. A
  view that declares zero formats now offers zero.

- 47f551b: fix(react): the spec bridge abstains on a non-string `rowHeight` instead of coercing it to a density, matching core

  `mapDensity` opened with a truthiness guard, so any **truthy non-string** survived it and was
  then coerced into a lookup key — both `Object.prototype.hasOwnProperty.call` and the table index
  run `String(...)`. `rowHeight: ['compact']`, a boxed `String('compact')` or
  `{ toString: () => 'compact' }` therefore each selected a real density, while
  `@object-ui/core`'s `rowHeightToDensityMode` — which opens with `typeof rowHeight !== 'string'` —
  abstained for the same input. Two published surfaces, two answers for one input.

  The bridge now opens with core's type guard. An off-spec non-string `rowHeight` renders exactly
  like an absent one, and the producer is where it gets fixed (AGENTS.md #0.1). Behaviour for the
  five spec row heights and for off-spec **strings** is unchanged; `''` keeps its answer by a
  different route (a string now, refused one line later because it is not one of the five keys).

  Note the direction against the previous fix in this function: that leak returned a _function_,
  visibly wrong to everything downstream. This one returned a legitimate-looking `'compact'` that
  nothing downstream could tell apart from an authored density.

- Updated dependencies [0e67b53]
- Updated dependencies [ee66e2e]
- Updated dependencies [ee26e65]
- Updated dependencies [5900ac5]
- Updated dependencies [932cbcd]
- Updated dependencies [734d186]
- Updated dependencies [f650253]
- Updated dependencies [3d9769a]
- Updated dependencies [3fc2971]
- Updated dependencies [aca27fa]
- Updated dependencies [dde7283]
- Updated dependencies [f7c6430]
- Updated dependencies [ae10a01]
- Updated dependencies [92876f0]
- Updated dependencies [f279deb]
- Updated dependencies [eb7f586]
- Updated dependencies [e901131]
- Updated dependencies [d9d3463]
- Updated dependencies [2a40f69]
- Updated dependencies [537a0d1]
- Updated dependencies [bec3e14]
- Updated dependencies [613b167]
- Updated dependencies [1f9b905]
- Updated dependencies [828549a]
- Updated dependencies [e1ade8f]
- Updated dependencies [abb0f81]
- Updated dependencies [38ab505]
- Updated dependencies [3e19fe7]
- Updated dependencies [bb58d1d]
- Updated dependencies [5cc847c]
- Updated dependencies [fa21254]
- Updated dependencies [33c32bf]
- Updated dependencies [66fb4fa]
- Updated dependencies [6d641c9]
- Updated dependencies [479cc7b]
- Updated dependencies [7e4f0e5]
- Updated dependencies [45e1949]
- Updated dependencies [92250d6]
- Updated dependencies [c1d939f]
- Updated dependencies [58bebf6]
- Updated dependencies [405e808]
- Updated dependencies [49ae9f4]
- Updated dependencies [c0f9a4b]
- Updated dependencies [2459a3e]
- Updated dependencies [2776b11]
- Updated dependencies [ac853ce]
- Updated dependencies [fa51109]
- Updated dependencies [d6aa172]
- Updated dependencies [fe52a04]
- Updated dependencies [d46f9b8]
- Updated dependencies [605b747]
- Updated dependencies [2fea4d2]
- Updated dependencies [7f1cb33]
- Updated dependencies [bb68488]
- Updated dependencies [2e3b0c0]
- Updated dependencies [9461dd3]
- Updated dependencies [78fa331]
- Updated dependencies [31ab1ac]
- Updated dependencies [0082db8]
- Updated dependencies [b42558a]
- Updated dependencies [d2f6e6b]
- Updated dependencies [ab04728]
- Updated dependencies [85a3082]
- Updated dependencies [06915b0]
- Updated dependencies [ff84b05]
  - @object-ui/i18n@17.5.0
  - @object-ui/core@17.5.0
  - @object-ui/data-objectstack@17.5.0
  - @object-ui/types@17.5.0

## 17.4.0

### Minor Changes

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

- 48132f7: Track the `@objectstack` family at `17.0.0-rc.5` (objectui#3560).

  The pin moves from `^17.0.0-rc.2` to `^17.0.0-rc.5` across all 37 declarations in
  30 `package.json` files, and the sibling `@objectstack/*` packages (`client` /
  `formula` / `lint`) move with it — they pin `@objectstack/spec` **exactly**, so
  leaving them behind would keep a second copy of the spec in the tree and have
  `@objectstack/lint` validating against schemas that still accept the keys rc.3–rc.5
  retire. `pnpm-lock.yaml` now resolves one copy of each of the six family packages
  (`spec` / `client` / `core` / `formula` / `lint` / `sdui-parser`), all at rc.5.

  Bumping the pin and repairing the fallout cannot be split: the pin alone reddens
  CI, and the code alone targets a shape that is not in effect yet.

  ## A live bug this upgrade fixes

  **`ObjectStackDataSource.delete()` never emitted its mutation event, and resolved
  `undefined` instead of a boolean.** `@objectstack/client`'s `DeleteDataResult`
  declared a key called `deleted` — a key no schema has ever declared and no server
  path has ever returned on `DELETE /data/:object/:id`. So `result.deleted`
  compiled and read `undefined` at runtime: the guard never fired, a successful
  delete notified no subscriber, and every consumer's cache stayed stale.
  objectstack#5638 corrected the interface to the schema's `success`; following the
  rename is what restores both behaviours. Nothing in this repo had to change shape
  for it — the code was already asking the right question of the wrong key.

  ## Breaking, in FROM → TO form

  - **The five `@objectstack/spec/ui` interaction-config modules are gone** —
    touch / dnd / keyboard / animation / offline, 32 defs and 64 exports
    (objectstack#4988, PR objectstack#5321). None of them had an authoring door: no
    metadata document could ever carry one of these blocks, so a stack that parsed
    before the retirement parses byte-for-byte the same after it. `@object-ui/types`
    drops the 32 `export type` re-exports. The vocabulary each one's only real
    consumer needs is now declared by that consumer, which is the remedy the spec's
    own retirement ledger prescribes ("declare that union locally — it is your
    client's policy, not the platform's"):

    - `@object-ui/react`'s `useOffline` owns `OfflineStrategy`, `ConflictResolution`,
      `PersistStorageType`, `EvictionPolicyType`, `OfflineConfig`,
      `OfflineCacheConfig`, `OfflineSyncConfig`;
    - `@object-ui/core`'s `DndProtocol` / `KeyboardProtocol` own `DndConfig`,
      `DragItem`, `DropZone`, `DragConstraint`, `DragHandle`, `DropEffect`,
      `KeyboardNavigationConfig`, `KeyboardShortcut`, `FocusManagement`,
      `FocusTrapConfig`;
    - `@object-ui/types`' `mobile` module owns `SpecGestureConfig`,
      `SwipeGestureConfig`, `PinchGestureConfig`, `LongPressGestureConfig`,
      `TouchTargetConfig`, `TouchInteraction` (plus a new `SPEC_GESTURE_TYPES`
      runtime tuple), so `@object-ui/mobile`'s import paths are unchanged.

    Every shape is moved verbatim — same keys, same members, same optionality — so
    no hook or bridge changes behaviour. Consumers importing these names from
    `@object-ui/types` must import them from the owning package instead. Note the
    spec's _surviving_ `ConnectorConflictResolution` (`/integration`, connector sync)
    and `ConflictResolutionStrategy` (`/api`, route merge policy) are **different
    concepts** — do not re-point at them.

  - **`@object-ui/types` no longer re-exports `NotificationAction` or `EmbedConfig`**
    (objectstack#5015, PR objectstack#5300). Both were published `ui` vocabulary with
    no authoring door; no notification action was ever parsed from metadata and no
    iframe route ever read an embed config. The presentation enums
    (`NotificationType` / `NotificationSeverity` / `NotificationPosition`) and
    `SharingConfig` **survive** and are untouched — public form sharing still gates
    the anonymous endpoints on `allowAnonymous` + `publicLink`.
    `@object-ui/core`'s `SharingProtocol` keeps `resolveEmbedConfig` /
    `generateEmbedCode` against a locally declared `EmbedConfig`, so its surface is
    unchanged.
  - **`ThemeEngine` stops emitting nine retired CSS variable groups**
    (objectstack#5021 option 2, PR objectstack#5289). `theme.animation`,
    `theme.zIndex` and five typography groups (`fontSize` / `fontWeight` /
    `lineHeight` / `letterSpacing`, plus `fontFamily.heading` / `fontFamily.mono`)
    are tombstones the schema now rejects by name, so `--duration-*`, `--timing-*`,
    `--z-*`, `--font-size-*`, `--font-weight-*`, `--line-height-*`,
    `--letter-spacing-*`, `--font-heading` and `--font-mono` had become structurally
    dead code — no author could produce the input that reached them.
    `generateAnimationVars` and `generateZIndexVars` are removed from
    `@object-ui/core`, and `@object-ui/types` drops `Animation` / `ZIndex` /
    `AnimationSchema` / `ZIndexSchema`. **`theme.customVars` is the declared — and
    since #5021 the only — door**: each entry is emitted verbatim as
    `--<key>: <value>`, so a `--z-modal` or a `--duration-fast` goes there now.
    LIVE emission is untouched byte for byte: `colors`, `borderRadius`, `shadows`,
    `typography.fontFamily.base` (→ `--font-sans`) and `customVars`.
  - **`@object-ui/types`' `HttpMethodSchema` now binds the spec's
    `HttpMethodSubsetSchema`, and `HttpMethod` binds `HttpMethodSubset`**
    (objectstack#5832, PR objectstack#5976 — objectui#3499). The spec renamed its
    5-value UI subset because `schemaNameFromExportKey` strips the `Schema` suffix,
    so the 5-value and 7-value enums both published as `shared/HttpMethod` and the
    later write won — the emitted JSON Schema and reference page described only one
    of them. **The runtime domain is unchanged and this repo's exported names are
    unchanged**; this follows the rename without touching cross-package semantics.
    Deliberately NOT re-pointed at the spec's bare `HttpMethod`: that is the 7-value
    enum, and widening to it would let `method: 'HEAD'` compile and then throw in
    `HttpRequestSchema.parse()`.
  - **`dashboard.widgets[].actionUrl` / `actionType` / `actionIcon` / `aria` are
    refused, not stripped** (objectstack#5010, ADR-0049 enforce-or-remove). A
    dashboard widget has no action button and never had one — every action the
    dashboard dispatches comes from `header.actions[]` — and no renderer ever applied
    the widget `aria`, so it promised accessibility compliance it did not deliver.
    A stale dashboard now gets a named error telling it where the affordance moved,
    instead of silently losing it. Run `os migrate meta --from 16` to rewrite.

### Patch Changes

- 8aad9fd: Action-face predicates written against the canonical `record.` root now evaluate

  `action:button`, `action:icon`, `action:menu` and `action:group` gated their
  actions on `useCondition(pred, context)`, which evaluates on
  `new ExpressionEvaluator({ ...scope, ...context })` — and the context each of
  them passed was the row spread flat, or nothing at all. Only the shorthand
  spelling resolved:

  | predicate                    | verdict, before                  |
  | ---------------------------- | -------------------------------- |
  | `status == "pending"`        | evaluates (`action:button` only) |
  | `record.status == "pending"` | throws `record is not defined`   |
  | `data.status == "pending"`   | throws `data is not defined`     |

  `record.` is not a mistaken spelling — it is the canonical one. It is what
  `ExpressionEvaluator`'s CEL path binds (`bag.record` as the record namespace),
  what `evalRowPredicate` binds on the record header, list rows, the row kebab
  and conditional formatting (`record.status` / bare `status` / `data.status`),
  and what the server enforces with. A `visible` that fails CLOSED turns the throw
  into "hidden", so a correctly-authored predicate deleted its own button —
  indistinguishable from the gate having said no. On the fail-soft legs the same
  throw lands the other way: `disabled` greyed a control out for everyone.

  Live rather than theoretical: every declared action on framework's
  `sys_approval_request` gates on `record.viewer.*`, so the whole server-declared
  approval decision set was invisible wherever the declared-action bar rendered
  until objectui#4077 fixed that bar. These four generic renderers carried the
  same binding.

  What changed:

  - all four bind the row the three canonical ways, through one named helper
    (`usePredicateRecordContext`, exported from `@object-ui/react` beside
    `useCondition`), so the action face and the row surfaces answer an author's
    `visible:` the same way;
  - `action:icon` reads the row at all. It evaluated against an empty bag, so not
    even the bare-field shorthand resolved — and its `data` prop was landing in
    the props spread onto the DOM button;
  - `action:menu`'s items and `action:group`'s two leaves receive the row from
    their host, which they previously never got;
  - `action:bar` forwards the row into the overflow menu it builds, not just to
    its inline members. An action's predicate had been answering a different
    question purely because it spilled past `maxVisible` — which on mobile
    defaults to 1, making the verdict a function of the viewport.

  Deliberately unchanged: the evaluation entry and each site's error policy. A
  predicate that genuinely faults still fails closed on `action:button` /
  `action:menu` `visible` and still fails soft on the other legs, exactly as
  before; `toPredicateInput`, `hasDeclaredVisibilityGate` and the empty-predicate
  rules keep their pinned semantics. Binding the row is a separate question from
  what to do when the predicate faults.

  A surface with no row of its own binds nothing rather than an empty record, so
  a host that supplies the row through the ambient predicate scope is not blanked
  out; a row passed explicitly still wins over the scope.

- e06810e: `PageComponentSchema.dataSource` is now consumed instead of discarded — a
  `list-view` page component can reference a **saved view by name** for the first
  time, and writing the binding no longer breaks the component
  (objectstack#5576).

  The spec declares a per-element data binding on every page component —
  `dataSource: { object, view?, filter?, sort?, limit? }` — and objectui read none
  of it. `ViewDataProvider.resolveElementDataSource` forwarded
  `filter`/`sort`/`limit` and dropped `view` entirely, and had no caller outside its
  own test; nothing mapped `object` onto the `objectName` a list actually reads. So
  "reference a saved view by name" was published, validated and inert, and every
  page that wanted a saved view's columns/filter/sort had to inline a second copy of
  them — the drift the binding exists to remove.

  Writing the binding also **broke** the block, for a reason unrelated to `view`:
  `SchemaRenderer` spread the schema's `dataSource` metadata onto the component as a
  React prop, and that is the prop name the host uses to inject the data-source
  ADAPTER. The plain `{ object, view }` object shadowed the adapter, so the first
  `dataSource.find(…)` threw `dataSource.find is not a function` and `list-view`
  rendered "Couldn't load records" — a spec-compliant component failing next to
  identical ones that omitted the binding.

  - `@object-ui/react` — `SchemaRenderer` no longer spreads `schema.dataSource` as a
    prop (it is metadata, like `visibleWhen`); renderers read it off `schema`. An
    explicit React `dataSource` prop is unaffected. New
    `useElementDataSource(schema, dataSource?)` hook resolves a binding, fetching
    the named saved view from the object definition's `listViews` and the metadata
    overlay's `listViews()`.
  - `@object-ui/core` — new `isElementDataSourceConfig` / `collectSavedViews` /
    `resolveSavedView` / `composeElementDataSource`, and `resolveElementDataSource`
    now honours `view` through an optional `DataFetcher.fetchViews`, reporting an
    unresolvable view as an error instead of silently returning every record.
    `resolveViewId` moved here from `@object-ui/app-shell` (re-exported there) so
    one matcher serves both the object page and a page component.
  - `@object-ui/plugin-list` — `list-view` maps the binding onto the props
    `ListView` reads. `dataSource.*` keys are authoritative, view-supplied values
    are a baseline the component's own keys override, and `filter` AND-combines at
    every level (the spec calls the binding's filter "additional criteria"), so a
    binding can narrow a saved view but never widen it. A `view` name that does not
    resolve renders a configuration error naming the object's actual views and
    issues no query — it never falls back to the object's default view, because that
    turns a typo into a silently wider answer.

- ab3ad4f: An empty predicate is no longer a declared gate anywhere (objectui#3850, objectui#3862)

  "Is a gate DECLARED on this key — is there a condition to reach a verdict on?" was
  answered three times in this repo, with three different scopes, and the widest
  answers sat on `disabled`, where the mistake is not benign:

  - `hasDeclaredVisibilityGate` (the action face) asked `!= null && !== ''`, so every
    OBJECT counted — including `{ dialect: 'cel', source: '' }`. That envelope is not
    a hand-written curiosity: `@objectstack/spec`'s `ExpressionInputSchema` normalizes
    every authored predicate into one, so "the author left the predicate empty"
    compiles to exactly it. The verdict path normalized the same value back to
    `undefined`, and `evaluateCondition(undefined)` answers `true` — "no condition, so
    visible/enabled". On `visible` that `true` means SHOW, so the two mistakes
    cancelled; on `disabled` it means GREY, so they compounded: a button disabled
    forever that no author asked to disable (objectui#3850, the residue objectui#3842
    left behind).
  - `SchemaRenderer` asked `disabled !== undefined` inline, one notch wider again, so
    `disabled: null` greyed out too — on the GENERIC rendering path, since that block
    runs for every node type, and not as an internal flag either: `_disabled` is
    forwarded to the component as a real `disabled` prop (objectui#3862).
  - `ActionRunner`'s execution gates asked "does this normalize to something
    evaluable?" — the scope that turned out to be right (objectui#3848 / objectui#3872).

  There is now ONE definition, `hasDeclaredPredicate`, exported from
  `@object-ui/core` (`evaluator/declaredPredicate.ts`, beside the `toPredicateInput`
  normalizer it is derived from): a gate is declared when normalization still leaves a
  condition to evaluate. `''`, a whitespace-only string, an empty-`source` envelope
  and any non-predicate value (`0`, `{}`) are NOT declared; `false` IS (a verdict is
  not a missing gate — objectui#3812). `hasDeclaredVisibilityGate` keeps its name as a
  re-export of it, so the five member-action renderer call sites, `DeclaredActionsBar`
  and `record-quick-actions` are unchanged and inherit the scope;
  `SchemaRenderer`'s `disabled` / `disabledOn` chain and `ActionRunner`'s two gates
  read the same function. No consumer got a local "and also check for empty" test —
  that fourth dialect is what objectui#3842 / objectui#3849 spent two PRs merging away.

  Measured behaviour change, `action:button` and the generic path, before → after:

  | value                                                     | `visible`      | `disabled` | `enabled` | `SchemaRenderer` `disabled` prop |
  | --------------------------------------------------------- | -------------- | ---------- | --------- | -------------------------------- |
  | `''`                                                      | shown → shown  | on → on    | on → on   | forwarded → absent               |
  | `null`                                                    | shown → shown  | on → on    | on → on   | forwarded → absent               |
  | `{ dialect: 'cel', source: '' }`                          | shown → shown  | GREY → on  | on → on   | forwarded → absent               |
  | `{ source: '' }`                                          | shown → shown  | GREY → on  | on → on   | forwarded → absent               |
  | `'   '` (whitespace)                                      | HIDDEN → shown | on → on    | GREY → on | forwarded → absent               |
  | `0` / `{}` (not predicates)                               | shown → shown  | GREY → on  | on → on   | forwarded → absent               |
  | `true` / `false` / bare CEL / `${…}` / non-empty envelope | unchanged      | unchanged  | unchanged | unchanged                        |

  Every row moves toward "there is no gate here", never away from it, and no value
  that HAS a verdict changes it — the verdict is still read from the raw value, only
  the gate in front of it narrowed. Two rows are behaviour changes rather than the
  equivalence the ruling expected, and are pinned as such: the whitespace string moves
  on `visible` / `enabled` (it used to normalize to `'${   }'`, which evaluates falsy,
  so a predicate that says nothing HID the action from everyone), and non-predicate
  junk stops greying controls out (fail-open, the posture `ActionRunner` already
  committed to).

  One blank spelling is knowingly still outside the scope: an envelope whose `source`
  is blank but not EMPTY (`{ dialect: 'cel', source: '   ' }`) — the normalizer folds a
  `source` of `''` and does not trim, so the string spelling of a blank predicate is
  trimmed and the envelope spelling is not, and `disabled` still greys out for that one
  value. The ruling enumerated three empty spellings; this is a fourth, measured and
  filed as objectui#3960 rather than widened in here.

  One chain is deliberately untouched: `SchemaRenderer`'s `visible` / `visibleWhen` /
  `visibleOn` / `visibility` / `hidden` / `hiddenOn` legs keep `!== undefined`, because
  narrowing them would change ALIAS PRECEDENCE, not just emptiness. The `hidden` legs
  are not negated and therefore carry this same defect with the polarity that makes the
  node vanish — measured, out of this ruling's scope, filed as objectui#3955.

- 0109f54: Blank predicates and non-predicate values are no longer gates, at the last three entries that still judged them (objectui#3955, objectui#3957, objectui#3960)

  objectui#3850 sank "is a predicate gate DECLARED here?" into one definition,
  `@object-ui/core`'s `hasDeclaredPredicate`. Three places were left out of that
  ruling's placement clause, each with the same shape of defect: the evaluator's
  single default for "there is nothing here to evaluate" is `true`, meaning
  _visible/enabled_, and wherever a too-wide "declared" test hands it an empty
  predicate on an INVERTED key, that `true` turns a control off for a value the
  metadata never used to say anything.

  **`SchemaRenderer`'s `hidden` / `hiddenOn` legs (objectui#3955)** asked
  `!== undefined` and did NOT negate the verdict, so an empty predicate meant HIDE
  and the node disappeared — on the generic rendering path, since that block runs
  for every schema type. Harder to diagnose than the `disabled` twin objectui#3862
  fixed: a greyed-out control is still on screen, while a node that never rendered
  is indistinguishable from metadata that meant to hide it. Both legs now read the
  shared definition.

  **The "blank" criterion now covers the envelope spelling (objectui#3960).** The
  definition trimmed a whitespace-only STRING and not an envelope's whitespace-only
  `source`, because `toPredicateInput` folds a `source` of `''` and does not trim.
  So `{ dialect: 'cel', source: '   ' }` was a declared gate whose verdict came from
  core's own CEL entry calling that exact value "no predicate" (`if (!source.trim())
return true`) — `disabled` greyed out forever and `ActionRunner.execute` answered
  `{ success: false, error: 'Action is disabled' }` with the handler never invoked.
  Blankness is now decided once for both spellings, at the definition. The
  NORMALIZER's contract is deliberately unchanged: "what shape does the evaluator
  accept" is not the same question as "is there a condition", and moving the trim
  there would have flipped verdicts for every
  `useCondition(toPredicateInput(…))` call site, including container-level `visible`
  reads that never asked this question at all.

  **`ActionEngine.getActionsForLocation`'s `visible` filter (objectui#3957)** was the
  last consumer answering the question with a range of its own — three empty
  spellings folded by hand, everything else coerced with `Boolean(raw)`. It now reads
  the shared definition and the coercion branch is gone, so one value no longer gets
  two answers depending on whether an action was surfaced by the engine or rendered
  standalone (the invariant objectui#3314 established). Its fail-CLOSED posture on a
  predicate that THROWS is untouched (`throwOnError: true` + `warnHiddenPredicate`):
  "the predicate faulted" and "there is no predicate" are different facts.

  Behaviour changes, before → after. Observation-class: each needs an author to write
  an empty/blank predicate or a non-predicate value, and there is no known user path
  today.

  | value                                                       | `ActionEngine` `visible` | `SchemaRenderer` `hidden` | `disabled` (action face + generic path) | `ActionRunner.execute` `disabled` |
  | ----------------------------------------------------------- | ------------------------ | ------------------------- | --------------------------------------- | --------------------------------- |
  | `''` / `null`                                               | shown → shown            | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `'   '` (blank text)                                        | HIDDEN → shown           | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `0` / `NaN`                                                 | HIDDEN → shown           | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `{}` / `[]`                                                 | shown → shown            | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `{ dialect: 'cel', source: '' }`                            | shown → shown            | HIDDEN → rendered         | unchanged                               | unchanged                         |
  | `{ dialect: 'cel', source: '   ' }`                         | shown → shown            | HIDDEN → rendered         | GREY → on                               | refused → runs                    |
  | `{ source: '   ' }` (no dialect)                            | HIDDEN → shown           | HIDDEN → rendered         | GREY → on                               | refused → runs                    |
  | `true` / `false` / bare CEL / `${…}` / a non-blank envelope | unchanged                | unchanged                 | unchanged                               | unchanged                         |

  Every row moves toward "there is no gate here", never away from it, and no value
  that HAS a verdict changes it — a declared `false` is still a verdict, not a
  missing gate (objectui#3812), and blankness is `trim()`, not "short": `{ dialect:
'cel', source: ' x ' }` is a predicate. One alias precedence changes with the
  `hidden` legs and is pinned rather than claimed as an equivalence: an undeclared
  `hidden` no longer short-circuits the chain, so a declared `hiddenOn` is finally
  consulted.

  `SchemaRenderer`'s four `visible*` legs keep `!== undefined` deliberately, as
  objectui#3850 ruled: their `true` is negated, so an empty predicate already lands
  on "shown", and narrowing them would change alias precedence rather than fix
  anything.

- Updated dependencies [6719877]
- Updated dependencies [56ff091]
- Updated dependencies [7864f03]
- Updated dependencies [d229dfa]
- Updated dependencies [4bc6c23]
- Updated dependencies [c3b01a7]
- Updated dependencies [f5f8744]
- Updated dependencies [3765678]
- Updated dependencies [d83f6b3]
- Updated dependencies [5f08c05]
- Updated dependencies [69becd2]
- Updated dependencies [5e52495]
- Updated dependencies [b750823]
- Updated dependencies [e06810e]
- Updated dependencies [ab3ad4f]
- Updated dependencies [c2fd122]
- Updated dependencies [ac2139c]
- Updated dependencies [b14ab3a]
- Updated dependencies [8c60819]
- Updated dependencies [41d6022]
- Updated dependencies [e64a52e]
- Updated dependencies [844d17f]
- Updated dependencies [48132f7]
- Updated dependencies [4dcd52a]
- Updated dependencies [42ae5c6]
- Updated dependencies [1d723e3]
- Updated dependencies [0109f54]
- Updated dependencies [7e5bb5d]
- Updated dependencies [fbc23e0]
- Updated dependencies [6d762da]
- Updated dependencies [e6fdbdc]
- Updated dependencies [f9faa7d]
- Updated dependencies [6bb454a]
- Updated dependencies [523be48]
- Updated dependencies [7e2b7e9]
- Updated dependencies [33526fd]
- Updated dependencies [32413ec]
- Updated dependencies [c1e1e6b]
  - @object-ui/core@17.4.0
  - @object-ui/i18n@17.4.0
  - @object-ui/types@17.4.0
  - @object-ui/data-objectstack@17.4.0

## 17.3.0

### Patch Changes

- d915c47: Relation fields (`lookup` / `master_detail` / `user` / `tree`) are now usable in action and conditional-formatting predicates: they bind as the stored foreign key on every surface, and the fields a predicate reads are included in the query projection (#3501).

  Before this, one predicate over one relation field had four different fates, decided by things its author does not control. `$expand` **replaces** the id in place with the whole related record, and a view expands exactly the relations it shows as COLUMNS — so `record.owner == "U1"` was **true** where the column was absent, **false** where it was displayed, and a **fault** where the field was neither displayed nor projected (a list's `$select` was built from its columns alone, and CEL treats an absent key as a fault, not as null). A fault is fail-CLOSED on the row kebab and the selection bar and fail-OPEN on the lenient paths, so the same authoring mistake hid the button from everyone on one surface and showed it to everyone on the next, with nothing on screen to point at either. The server, meanwhile, only ever sees the id — so client and server could not agree, which is the one thing ADR-0036 / ADR-0058 exist to guarantee.

  Two changes close it. `toPredicateRecord` (new, `@object-ui/core`) collapses expanded relation values back to their ids when a record is bound for evaluation — driven by the object's own field types, not by sniffing for an `id` key, so a `json` field that happens to carry one is untouched. It is threaded through `evalRowPredicate` / `resolveConditionalFormatting` (via a new `fields` option), `useRowPredicate`, `partitionBulkRows`, and both `page:header` evaluators, with the object schema supplied by `ObjectGrid` / `ListView` / `ObjectKanban` / the record context. Kanban card formatting is threaded the same way, so a rule cannot match on the grid view of a list and silently never match on its board. Display is unaffected — a detail-page title still renders the related record's name, and the schema-only `kanban-ui` entry point (which has no object schema to offer) keeps using the payload verbatim. `collectPredicateFieldRefs` / `listViewPredicates` (new) harvest the `record.x` / `data.x` references out of a view's conditional formatting, row-action defs, bulk-action defs, promoted object actions and `userActions` overrides, and add them to `$select` — intersected with the object's declared fields plus the platform columns every object carries (`isProjectableField`), because an unknown key is not ignored by every backend. No `$expand` is added: a predicate wants the foreign key, which is what an unexpanded relation already is.

- 175bd79: `toPredicateInput` is now re-exported from `@object-ui/core` instead of being reimplemented in `@object-ui/react`. Behaviour is byte-for-byte identical — the renderer-side copy in `packages/react/src/hooks/useExpression.ts` had item-for-item the same semantics as the canonical `packages/core/src/evaluator/predicateInput.ts` (booleans short-circuit, bare strings and non-`cel` dialects become `${…}`, a `{ dialect: 'cel', source }` envelope survives so `useCondition` routes it to the canonical `@objectstack/formula` engine, empty/absent predicates become `undefined`), and every existing import path (`import { toPredicateInput } from '@object-ui/react'`) keeps working with an unchanged signature. What changes is that there is now ONE implementation rather than two held in step by a parity table: #3314 is the record of what two normalizations do when left alone — they drift, and the same `visible:` predicate reaches different verdicts depending on whether the action was surfaced by `ActionEngine.getActionsForLocation` or rendered standalone. The 14-shape normalization parity table degenerated once both of its columns called the same function, so it is replaced by a single identity assertion (`react`'s export IS `core`'s function object); the engine-path-vs-renderer-path verdict parity suite is untouched and still proves the two call paths agree (#3367).
- Updated dependencies [18cd432]
- Updated dependencies [d915c47]
- Updated dependencies [b71fc92]
- Updated dependencies [65516ba]
- Updated dependencies [94c5b7c]
- Updated dependencies [ca0fa8f]
- Updated dependencies [3889ffb]
- Updated dependencies [5781fb1]
- Updated dependencies [7e2406a]
- Updated dependencies [9e9e9a9]
- Updated dependencies [4eeb932]
- Updated dependencies [5c856ec]
- Updated dependencies [23018cc]
- Updated dependencies [68b6a28]
- Updated dependencies [0554e88]
- Updated dependencies [d915c47]
- Updated dependencies [f44d872]
- Updated dependencies [28b2e65]
- Updated dependencies [509104a]
- Updated dependencies [825bbe3]
- Updated dependencies [6195841]
- Updated dependencies [5dd0127]
- Updated dependencies [a415684]
- Updated dependencies [a4cff5b]
- Updated dependencies [5af2852]
- Updated dependencies [f833d3a]
- Updated dependencies [a6ec93d]
- Updated dependencies [2a9513d]
- Updated dependencies [d22ae31]
- Updated dependencies [c7ed4c3]
- Updated dependencies [2409e1d]
- Updated dependencies [789fe3e]
  - @object-ui/core@17.3.0
  - @object-ui/types@17.3.0
  - @object-ui/i18n@17.3.0
  - @object-ui/data-objectstack@17.3.0

## 17.2.0

### Minor Changes

- a889e31: A record's approval band now shows the quorum / per-group tally the server already computes.

  The showcase's `showcase_committee_quorum` node declares `behavior: 'quorum'` with
  `minApprovals: 2` over three approvers, and even ships a pre-rendered
  `"Committee Sign-off (2 of 3)"` label; `showcase_expense_signoff` declares
  `per_group` (会签) with named manager / finance groups. On the business record
  the approval band rendered none of it — the lock badge, the recall button and
  the approve/reject actions were all correct, but a two-of-three committee step
  looked exactly like a one-approver step. An approver could not see whether their
  own click finalized the node or was one of three, which is the single fact a
  quorum node exists to express (objectstack#4478).

  Nothing was wrong on the wire, and nothing here papers over the server. The
  framework computes `decision_progress` — `{ behavior, got, need, groups? }`,
  derived from the node's own `node_config_json` snapshot, so the count a client
  shows is the count the engine will enforce. **It attaches that block in
  `getRequest` only**: `listRequests` deliberately skips it, because the
  `sys_approval_action` tally it costs is per row and a list read may return
  hundreds. The record header's `useRecordApprovals` reads
  `GET /approvals/requests?object=…&recordId=…` — the list route — so the
  enrichment was never in the payload it had. The hook now follows up with one
  single read for the ONE pending row and folds the result onto it; a failed or
  mismatched follow-up leaves the row exactly as the list sent it, so a display-only
  enrichment can never take the approval panel down and no tally is ever invented.

  `InlineEditProvider` carries the block through as `approvalProgress`, and the
  DetailView approval band renders it beside the existing badge: a labelled
  `role="progressbar"` with one tick per required approval for `quorum` /
  `unanimous`, and for `per_group` a chip per group marking which have signed
  (`finance 1/1` ✓, `manager 0/1`). Group names come from the flow author's own
  config, so they need no locale strings; the three new label keys are added to all
  ten packs. `first_response` nodes carry no `decision_progress` and are unchanged —
  one decision is the whole step there, and a "1 of 1" bar would be noise.

  Scored `minor` rather than `patch`: this is new observable rendering plus a new
  public `approvalProgress` prop / `ApprovalProgress` type on `@object-ui/react`,
  not a behavior correction inside an existing surface.

- 09d30a4: Stop declaring 18 `@object-ui/auth` / `@object-ui/components` / `@object-ui/react`
  symbols under names `@objectstack/spec` owns (objectui#3159, objectstack#4115
  batch 5).

  **Breaking for importers of all three packages** — six exported names changed,
  because the spec exports the same name for a _different_ thing:

  | package      | was                          | now                      | what the spec's same-named export actually is                                  |
  | :----------- | :--------------------------- | :----------------------- | :----------------------------------------------------------------------------- |
  | `auth`       | `AuthSession`                | `AuthClientSession`      | the SERVER's session record (`{ id, userId, expiresAt: ISO string, token? }`)  |
  | `auth`       | `AuthProviderConfig`         | `AuthProviderOptions`    | an OAuth/OIDC provider registration (`{ id, clientId, clientSecret, scope? }`) |
  | `components` | `FilterCondition`            | `FilterBuilderCondition` | the recursive ObjectQL predicate AST (`$and`/`$or`/`$not`)                     |
  | `components` | `Field`                      | `FieldContainer`         | an object FIELD's metadata and its builder namespace                           |
  | `react`      | `ConflictResolutionStrategy` | `ConflictResolution`     | the metadata-MERGE policy (`error \| priority \| first-wins \| last-wins`)     |

  The `react` rename is the odd one out: the new name is the **spec's own** name
  for the union that hook always used, so it is a re-export rather than a dialect.

  Eleven more keep their names and are now **imported or derived from the spec**
  instead of re-declared: `TenancyPosture`, `DelegableScope` (+`DelegableAdminScope`),
  `AuthUser`, `ShareLinkPermission`, `ShareLinkAudience`, `ShareLink`, `SortItem`,
  `OfflineStrategy`, `OfflineCacheConfig`, `OfflineSyncConfig`, `OfflineConfig`,
  `NavigationConfig`.

  **Three of the copies were losing information, not just duplicating it.**

  - `AuthUser` never declared the spec's `positions` or `tenantId` — the
    authorization inputs. Its `[key: string]: unknown` index signature meant the
    omission was invisible at every call site _and_ to any structural comparison
    (the objectstack#4075 mechanism). It now `extends` the spec principal, so the
    display-only fields (`image`, `role`, `roles`, `emailVerified`) are the delta
    and the spec's keys arrive on their own.
  - `useNavigationOverlay`'s copy carried the note _"inline … to avoid importing
    from `@object-ui/types` (which may not be a direct dependency of
    `@object-ui/react`)"_. The vocabulary belongs to `@objectstack/spec`, which
    **is** a direct dependency — the same expired "kept local to avoid a
    dependency" comment objectui#3169 found in `@object-ui/app-shell`.
  - `useOffline` and `usePerformance` both opened with _"Types aligned with
    `@objectstack/spec` v2.0.7"_. The installed spec is 17.0.0-rc.1.

  `ShareLink` derives from the spec row **minus `password_hash`** — omitted rather
  than optional, because it is the credential itself and typing it in a browser
  package is an invitation to render it. `password_protected` (the boolean the UI
  needs in its place) is the one local addition.

  The config types derive from each schema's **input** side, not `z.infer`.
  `useOffline(config: OfflineConfig = {})` defaults to the empty object, which the
  output type — every `.default()`ed key required — would reject outright.

  `@objectstack/spec` moves from `devDependencies` to `dependencies` in
  `@object-ui/components`: its public type surface now references the spec.

  Scored `minor`, not `major`, per this repo's fixed-group rule — objectui's major
  tracks `@objectstack`, so breaking changes of our own ship as minor with the
  semantics spelled out above (see AGENTS.md §版本号策略). A `major` here would carry
  all 39 packages of the fixed group to `18.0.0` and off objectstack's 17.x line.

### Patch Changes

- ea96284: `useMetadataItem` no longer spins forever outside a `<MetadataProvider>` — the "graceful fallback" was the thing that made those consumers impossible to mount.

  `useMetadata()` built its no-provider fallback **inline on every call**, so outside a provider
  every render produced a new `getItem`. `useMetadataItem` lists `getItem` in its effect deps and,
  on the no-name path, called `setState({ item: null, loading: false, error: null })` with a fresh
  object each run. New identity → effect re-runs → new state object → re-render → new identity:
  an unbreakable loop, synchronous enough to hang inside `render()` rather than fail.

  So the fallback documented as the graceful path for consumers mounted outside a provider —
  "common in unit tests that only need to assert on rendering" — was precisely what made them
  unmountable. `record:alert` and `record:quick_actions` both call `useMetadataItem`
  unconditionally; each pinned a core and grew unbounded (8.6 GB before the first kill) on a
  `render()` that never returned.

  Two changes, at the cause and one layer in:

  - The fallback is a frozen module-level singleton, so its identity is stable across renders.
  - The clear-state path bails out when the state is already cleared, instead of installing an
    equal-but-new object. That covers the same loop arriving by another route — any caller whose
    context value is rebuilt per render, which this interface explicitly invites ("hand-rolled
    context values in tests keep working").

  Found by `apps/console/src/__tests__/record-block-record-reach.test.tsx` (objectui#3149), which
  could not mount either block until this was fixed.

- Updated dependencies [4ae0ac4]
- Updated dependencies [696e3c1]
- Updated dependencies [bca45cc]
- Updated dependencies [a889e31]
- Updated dependencies [4bf612c]
- Updated dependencies [335041c]
- Updated dependencies [b414983]
- Updated dependencies [256f8cc]
- Updated dependencies [c5ccbd5]
- Updated dependencies [d9668a7]
- Updated dependencies [4b470b9]
- Updated dependencies [cb82705]
- Updated dependencies [f572849]
- Updated dependencies [d3584c6]
- Updated dependencies [a8ad6c0]
- Updated dependencies [444457c]
- Updated dependencies [850033c]
- Updated dependencies [022e4c3]
- Updated dependencies [009e25d]
- Updated dependencies [726b89c]
  - @object-ui/types@17.2.0
  - @object-ui/core@17.2.0
  - @object-ui/i18n@17.2.0
  - @object-ui/data-objectstack@17.2.0

## 17.1.0

### Minor Changes

- c4db402: refactor(views): ListView's `aria` and `sharing` are the spec sub-shapes (#2890 scope A step 5)

  Last rename batch in the ListView vocabulary migration.

  **`aria`** is now the spec's `AriaPropsSchema`: `label` → `ariaLabel`,
  `describedBy` → `ariaDescribedBy`, folded at the ListView boundary like every
  other legacy key. Two things fall out of adopting the spec shape:

  - `role` becomes authorable. The list region hardcoded `role="region"`; it now
    reads `aria.role` and falls back to `region`.
  - `aria.live` stays as a documented local extension — it has no spec
    counterpart, and dropping it would silently disable a shipped capability.
    Promote it rather than growing that extension.

  **`sharing`** is now the spec's `ViewSharingSchema` (`{ type, lockedBy }`),
  imported by reference — the local four-key object is gone. The legacy pair folds
  in: `visibility` collapses onto the two ownership kinds the spec models (only
  `private` is `personal`; `team` / `organization` / `public` are all
  `collaborative`), and a bare `enabled: true` maps to `personal`, which is the
  badge the user already saw (the old title fell back to `'private'`).

  _Visible change_: the share badge's tooltip shows the spec ownership type, so a
  view authored with `visibility: 'team'` reads "Sharing: collaborative" instead
  of "Sharing: team". The four-value audience has no spec home and nothing but
  that tooltip consumed it; keeping a second audience enum alive would re-open the
  fork this issue closes.

  Also fixes the **spec bridge**, which was doing the opposite of its job: given a
  spec-shaped `sharing`, `transformListView` _downgraded_ it — inventing a legacy
  `visibility` audience and an `enabled` flag that the renderer then had to fold
  back. Both sides speak `ViewSharing` now, so it passes through.

  `conditionalFormatting` and `exportOptions` are deliberately **not** folded.
  Both objectui shapes are supersets carrying capability the spec cannot express —
  the `{ field, operator, value }` rule form, and `maxRecords` / `includeHeaders`
  / `fileNamePrefix`. Folding them onto the narrower spec shapes would delete
  working features; they want promotion upstream, not a rename.

- 07de839: fix(notifications): the config, `position` and action `variant` are read instead of forked or ignored (#3014 follow-up)

  The last of the notification contract. After `displayType` (#3071) and `icon`
  (#3076), four gaps of the same family were left:

  - **the config was 3/4 inert** — only `defaultDuration` was ever read.
    `maxVisible` and `stacking` were carried and ignored, while
    `NotificationBanners` capped at a hard-coded `3` of its own;
  - **its field names forked from `NotificationConfigSchema`** — `position` vs
    `defaultPosition`, a renderer-local `stacking` boolean with no spec
    counterpart, and no `pauseOnHover` at all;
  - **a notification could not declare a `position`.** The #3008 parity guard
    asserted the position _vocabulary_ matched the spec while nothing positioned
    anything by it — a guard passing over an unused value;
  - **`NotificationActionButton.variant` was the shadcn Button vocabulary**
    (`default | destructive | outline`) under a spec-shaped name, forking
    `NotificationActionSchema.variant` (`primary | secondary | link`).

  **How positioning resolves now** — `notification.position ?? config.defaultPosition
?? nothing`, and "nothing" is a real answer:

  - **declared** → the surface pins itself there, always. `presentNotificationToast`
    passes it per-toast so the contract wins over the container;
  - **undeclared** → the surface keeps its own anchor (a snackbar's bottom edge) or
    defers to the host's toast chrome.

  That asymmetry is the design decision. The host's sonner container also serves
  toasts that are _not_ spec notifications (the console action runtime's own
  `toast.*` calls), so it stays the fallback authority for placement — never a
  competing one. A declared position a component prop could silently override
  would be the same "validates, then does nothing" shape this whole area is about.
  Hence `defaultPosition` has no fabricated default: "the host didn't say" has to
  be representable.

  Also: `maxVisible` / `stackDirection` now drive every stacking surface through
  one shared `visibleNotificationStack` (cap keeps the NEWEST, stack grows in the
  declared direction); `pauseOnHover` holds a transient notification's timer and
  resumes it with the time it had left, which needed the provider to track live
  timers rather than fire-and-forget `setTimeout`s. Legacy spellings still resolve:
  `position` folds into `defaultPosition`, and `stacking: false` reads as
  `maxVisible: 1` rather than being ignored.

  `onToast` now receives the resolved config as a second argument, so the delegate
  can apply the parts of the contract only it can. Existing one-argument handlers
  are unaffected. The spec-parity guard gained the action-variant vocabulary, the
  one notification enum it did not cover.

- 2a40b5e: feat(notifications): each spec `displayType` gets its own presentation instead of a toast (#3014)

  #3008 closed the **contract** half of this: `NotificationContext`'s union matched
  `NotificationTypeSchema`, and `notify()` materialized the declared type so a
  consumer _could_ branch on it. Nothing did. `NotificationProvider` handed every
  item to the host's `onToast` delegate regardless of type, so an author picking
  `banner` or `inline` got a transient overlay — plausible output, wrong output.

  Each of the five spec types now has a presentation of its own:

  | `displayType` | Presentation                                           | Rendered by                        |
  | ------------- | ------------------------------------------------------ | ---------------------------------- |
  | `toast`       | transient overlay (unchanged)                          | the host's `onToast` delegate      |
  | `snackbar`    | bottom-anchored bar, one at a time, at most one action | `<NotificationSnackbar />`         |
  | `banner`      | page-width strip **in the content flow**               | `<NotificationBanners />`          |
  | `alert`       | blocking acknowledgement dialog, FIFO queue            | `<NotificationAlerts />`           |
  | `inline`      | in place, at the raising surface                       | `<NotificationInline scope="…" />` |

  The four surface components ship from `@object-ui/components` and subscribe via
  `useNotificationsByPresentation(type, scope?)`.

  **Answers to the three questions the issue left open:**

  1. **Banner/inline placement is the host's.** They are not overlays: a banner takes
     space at the top of the content area and an `inline` notification belongs next to
     the thing that raised it. So the context exposes the items and the surfaces
     subscribe, rather than one `onToast`-style delegate positioning everything. An
     `inline` notification carries a `scope` that pairs it with its outlet, so two
     forms on one page don't show each other's messages.
  2. **`alert` is modal-ish but NOT the action system's `ModalHandler`.** That handler
     resolves a page/object, renders it, and reports an `ActionResult` back to the
     `ActionRunner`; a notification alert has no schema, no target and no result.
     Routing it there would mean synthesizing a page just to say "OK". It renders
     through the `AlertDialog` primitive instead — no second action-modal path.
  3. **`snackbar` earns its own component.** It supersedes rather than stacks, anchors
     bottom regardless of the toast position config, and takes at most one action.
     Making it a sonner variant is what "presents as a toast" means.

  **Also fixed:** auto-dismiss now follows the presentation. `toast`/`snackbar` keep
  the transient timer; `banner`/`alert`/`inline` are persistent unless the raiser sets
  `duration` explicitly — a persistent banner used to evaporate on the shared 5s toast
  timer. `dismissible` is honored on the persistent surfaces (an `alert` always keeps
  its acknowledge button; `dismissible: false` only closes the Escape route).

  `onToast` now receives **only** `toast` items. A provider with no `onToast` remains
  the supported store-only mode (a bell reading `notifications`/`unreadCount`), but
  raising one of the other four types with its surface unmounted warns in dev, naming
  the component to mount — that failure used to be silent.

  `NOTIFICATION_PRESENTATIONS` is typed `Record<NotificationPresentation, …>`, so a new
  member in the spec enum fails type-check until its presentation is decided; a parity
  test additionally asserts the table covers `NotificationTypeSchema` exactly and that
  no two types share a surface.

- ce08d55: chore(deps): upgrade `@objectstack/*` to 17.0.0-rc.0, and let the spec take back what it now owns

  `spec` / `client` / `formula` / `lint` move from `^16.x` to `^17.0.0-rc.0`. Two
  groups of v17 changes reach this repo, and they pull in opposite directions —
  the spec pruned surface objectui re-exported, and adopted surface objectui had
  been carrying locally.

  **The spec pruned dead Theme config (objectstack#3494), so the re-exports went
  with it.** `ThemeSchema` dropped `spacing`, `breakpoints`, `logo`, `density`,
  `wcagContrast`, `rtl`, `touchTarget` and `keyboardNavigation` — authorable but
  never enforced, so authoring them was already a silent no-op. `@object-ui/types`
  re-exported those sub-schemas _by reference_ (issue #2231), so they could not
  survive the prune without becoming hand-written mirrors — exactly the second
  de-facto contract AGENTS.md #0.1 forbids. Removed from the public surface:

  - Types: `Spacing`, `Breakpoints`, `DensityMode`, `WcagContrastLevel`,
    `ThemeLogo`, and the deprecated `SpacingScale` alias
  - Schemas: `SpacingSchema`, `SpacingScaleSchema`, `BreakpointsSchema`,
    `ThemeLogoSchema`, and the `SpacingSchemaType` / `BreakpointsSchemaType` helpers
  - `Theme.spacing`, `Theme.breakpoints` and `Theme.logo`

  `mergeThemes` no longer merges the three dropped keys. `generateThemeVars` is
  unaffected — it never emitted them, which is why the liveness audit called them
  dead. The one real consumer was `ThemeProvider`, which set the favicon from
  `theme.logo.favicon`; that path is gone, because v17 strips the key at parse and
  it could never arrive again. The live favicon is unaffected: it comes from
  operator branding (`getFaviconUrl()`), applied in the console's `index.html`,
  `main.tsx`, and on route change.

  Nothing else read the pruned types. In particular the list-density feature is
  untouched — `useDensityMode` and `rowHeightToDensityMode` use `@object-ui/core`'s
  own local `DensityMode`, which never came from the spec.

  **The spec adopted objectui's ListColumn extensions (objectui#2231), so the
  extension collapsed.** `ListColumnSchema` used to `.extend()` the spec with two
  fields, each carrying a note to promote it upstream rather than grow the
  extension; v17 did exactly that. `summary` is now the spec's
  `union([ColumnSummarySchema, ColumnSummaryConfigSchema])` — the same enum ∪
  `{ type, field }` form `useColumnSummary` reads — and `prefix` is the spec's
  `ColumnPrefixSchema`. `ListColumnSchema` is now a plain by-reference re-export.
  One behavior change rides along: `prefix.type` defaults to `'text'` on parse
  instead of staying `undefined`, so the cell renderer always gets a value.

  **Node 22 is now the floor.** Every `@objectstack` package declares
  `engines.node: ">=22.0.0"` (objectstack#3825; Node 20 reached EOL 2026-04-30).
  This repo claimed `>=20` and ran CI on Node 20.x, so it promised — and validated
  — a runtime its own core dependency does not support. `engines.node` is now
  `>=22`, CI runs Node 22.x, and the CI/deployment docs say so.

  The major stays 17: per AGENTS.md the major tracks `@objectstack`'s major, which
  is also 17, and that convention deliberately outranks semver purity — so the
  removals above ship as a minor rather than desyncing the two.

- 0ded602: fix(form): a server rejection that names fields now marks those fields (objectstack#3896)

  The server has always said which field it rejected. `@objectstack/objectql`'s
  validators throw `VALIDATION_FAILED` with `fields[]` — one entry per offending
  field, each with a human `message` — and both the REST layer and the runtime
  dispatcher serve that as a 400 with the entries intact.

  Every form dropped them. The submit handler caught the rejection, ran the
  message through `extractWriteErrorMessage`, and showed **one undirected toast**:
  the user was told something was wrong but not _what_, on a surface that already
  knows how to mark an input — and already does exactly that for client-side
  validation. On a long form the offending field was often off-screen, so "创建"
  appeared to do nothing.

  **Now the two failures behave identically, because they share one
  implementation.** The per-field marking, the toast naming the fields, and the
  scroll-and-focus of the first offender (#2793) were extracted from the
  client-side invalid handler; the server path calls the same function. As far as
  the person filling in the form is concerned these are the same event — only the
  referee differs.

  Three layers, each of which was dropping the detail:

  - **`@object-ui/react`** — new `extractFieldErrors(err)` (exported alongside
    `extractWriteErrorMessage` / `isPermissionError`) normalises the three shapes
    the error can arrive in: a typed `ValidationError` from the ObjectStack
    adapter, the raw `@objectstack/client` error (whose `details` falls back to the
    whole response body, which is where `fields[]` lands), and a hand-rolled error
    carrying `fields` directly — the server duck-types that shape identically, so
    the client must not be pickier than the server. Entries with no usable `field`
    are **dropped rather than guessed at**: marking an innocent input is worse than
    the generic toast.
  - **`@object-ui/data-objectstack`** — `normaliseClientError` now maps a 400
    `VALIDATION_FAILED` onto the `ValidationError` class that has sat in
    `errors.ts` since the package was written, exported and **never once
    constructed**. Its `validationErrors: Array<{ field, message }>` shape was
    already exactly right. `create` also now normalises at all: only `update` did,
    so a rejected insert reached callers as the raw client error — and a create is
    the path that most often trips required-field validation.
  - **`@object-ui/components`** — the form renderer maps the entries onto
    `form.setError` and takes over the failure, **but only when every rejected
    field has a visible input to carry it**. If the server also rejected something
    the form does not render, it falls through to the banner, whose top-level
    message concatenates every field's reason — so the part the user cannot see
    inline is still said out loud instead of silently dropped.

  This also removes the need for the client-side predicate mirroring added in
  #2962: a form no longer has to guess what the server will reject in order to
  warn about it beforehand, and mirrored predicates drift.

  Non-field failures (403 / permission denials / anything without `fields[]`) take
  exactly the path they took before.

### Patch Changes

- fc0272a: fix(actions): apply the ADR-0066 D4 capability gate on every action surface (framework#3923)

  An action declaring `requiredPermissions` is supposed to be one declaration with
  two enforcement surfaces: 403 on the server, hidden button in the UI. The UI half
  only ever ran inside `ActionEngine.getActionsForLocation` — and the surfaces
  `record_header`, `record_more`, `list_item` and `list_toolbar` actually render on
  do not go through the engine. They filter their own action lists. So a button
  declaring a capability nobody holds rendered, live and clickable, on the record
  header, in every grid row menu, and on the list toolbar. For a `type: 'api'`
  action pointed at a self-authored endpoint, nothing else was checking either: the
  platform's action route (which is where the 403 comes from) never sees that
  request.

  `page:header`, `action:bar` (business _and_ `systemActions`) and the grid's
  `RowActionMenu` now apply the same gate, via a shared `useCapabilityGate()` so
  the surfaces cannot drift apart. The rule is the engine's, unchanged: hide unless
  the caller holds **all** declared capabilities; an empty held set is "holds
  nothing" and gates; **unknown** — no action runtime, no resolved capabilities —
  fails OPEN, because the server is the authority and hiding a permitted user's
  button on missing client data is the worse failure.

  The record surface was also feeding the gate nothing to work with.
  `RecordDetailView` mounts its own `<ActionProvider>`, which shadows the shell's
  for every action on that page, and seeded it with identity only — no
  `systemPermissions`. Since unknown fails open, that alone un-gated every
  `record_header` / `record_more` / `record_section` action on the one page those
  locations exist on. It now forwards the caller's resolved capabilities (and only
  once they have actually resolved, so a standalone embed without a
  `PermissionProvider` keeps failing open rather than hiding everything).

  `useRecordEditable`'s record-level explain probe went out on a bare
  `fetch(..., { credentials: 'include' })`. A bearer-token session carries its
  credential in the `Authorization` header, not a cookie, so the probe came back
  401 on a perfectly valid admin session and the verdict silently failed open —
  the hook was inert in exactly the deployments it was written for. It now rides
  the host's authenticated fetch (`SchemaRendererProvider`'s `apiFetch`), falling
  back to the global one for standalone embeds.

- 9eb932b: fix(console): three real-user console failures — 403 blamed on the network, ⌘K search capped at 8 objects, nav gating fields inert

  1. **List error panel classifies the failure** (`plugin-list`, `i18n`): a 403/401 from the data source used to render the same "check your connection" copy as a genuine outage, sending users to debug their network while the server was correctly denying access. The panel now classifies by `httpStatus`/`status`/`statusCode`, the `PERMISSION_DENIED`/`UNAUTHORIZED` error codes, or an `HTTP <status>` message prefix, and renders dedicated permission-denied / sign-in-required copy (all nine locales).

  2. **⌘K / full-page search scope is no longer truncated** (`react`): `maxObjectsQueried` caps the per-object fanout fallback, not the search scope — it used to slice the candidate pool itself, so the `objects` whitelist sent to the platform's `/api/v1/search` only ever named the first 8 nav objects. Which sidebar group came first decided which records were findable; everything later in the nav was unsearchable no matter what the user typed.

  3. **Nav gating fields finally gate** (`app-shell`): `evaluateVisibility` only evaluated `${…}` template strings, so the `{ dialect: 'cel', source }` envelopes the spec normalizes every authored `visible` predicate into fell through to a blanket "visible" — a constant-false predicate still rendered for everyone. It now delegates to `ExpressionEvaluator.evaluateCondition`, which routes CEL envelopes to the canonical `@objectstack/formula` engine. And the sidebars' `requiredPermissions` check treats a bare name as an ADR-0066 system capability (union of the user's permission-set `systemPermissions` from `/me/permissions`) — the same subset rule the server applies to `AppSchema.requiredPermissions` — instead of misreading it as `can(<name>, 'read')`, which had degraded `requiredPermissions` into a hide-from-everyone switch (admins included). The `object:action` form and the legacy object-read fallback keep working.

- 4952edf: fix(errors): error-code branches survive the framework's ADR-0112 rename — objectstack#3841

  Framework ADR-0112 renamed the whole `error.code` vocabulary from lowercase
  `snake_case` to `SCREAMING_SNAKE` (`destructive_change` → `DESTRUCTIVE_CHANGE`).
  Eleven places compared `err.code` against the old spelling with `===`, so against
  a swept server they simply stopped matching — and nothing threw. The affordance
  each branch guards just vanished and the user got the generic error toast instead:

  - the destructive-change confirm dialog (resource editor, permission matrix)
  - the "create a writable package first" hint
  - field-scoped validation issues on embedded item saves
  - the all-or-nothing publish summary naming the causal item
  - unknown-object tolerance in the app header and in record search
  - the marketplace's local-install messages for conflict / auth / unavailable
  - `isNotFoundError` in the data layer

  `RECORD_NOT_FOUND` had already been renamed a release earlier, so that branch was
  already dead before this fix.

  New `errorCodeIs` / `errorCodeIsAnyOf` in `@object-ui/types` compare
  case-insensitively, so the console keeps working against servers on either side
  of the rename — the console ships separately from the server it talks to. Every
  call site now passes the catalog (SCREAMING) spelling, and `error-code.ts` is the
  single file to delete once no supported server emits the old vocabulary.

- 2374a49: fix(sdui): a react page no longer loses its state to a memo that never held, and a source that exports nothing fails loudly

  Writing the regression guard for objectui#2954's "latent hazard" found it was
  already real.

  **`evaluatedSchema` was memoised on values rebuilt every render.**
  `SchemaRenderer` fell back to a fresh `{}` when no `SchemaRendererProvider` sat
  above it, and `usePageVariables()` returned a brand-new object literal outside a
  `PageVariablesProvider`. Both feed the `evaluatedSchema` memo's dependency list,
  so for any tree without those providers the memo never hit: the schema was
  re-cloned and the ExpressionEvaluator re-run on every render, and children got a
  new schema identity every time. A `kind:'react'` page memoises its compiled
  source on that identity, so the page was recompiled — a new page function, a new
  element type — and React remounted it, silently discarding the user's `useState`.
  Any registry notification (every lazy plugin's first load) triggered it. Both
  fallbacks are now module constants.

  **A source that exports nothing now throws instead of rendering blank.**
  `generateElement` inserts the implicit `export default` only when the source
  _starts with_ JSX, a `function` declaration, `()` or `class` — so the very
  common `const Page = () => …` exported nothing, and the page rendered blank with
  no error reported anywhere. It now throws with a message naming the fix, which
  `ReactRunner`'s error panel surfaces. `export default null` still means "render
  nothing"; a default export that is not a component throws too.

  **`PageSchema['kind']` matches `@objectstack/spec`.** It declared
  `'full' | 'slotted'` while the renderer had shipped `'react'` and
  `'html'`/`'jsx'` since ADR-0080 and read the field through a cast. The union now
  spells all five and the cast is gone.

  Docs: new `content/docs/guide/react-pages.md` (choosing between the executed and
  parsed tiers, the capability gate, the injected scope, flat props, `Block`,
  `useAdapter`, source shapes, error handling) and a `@object-ui/react-runtime`
  README — the package had neither, while being the tier AI-authored pages target.

- Updated dependencies [62311b6]
- Updated dependencies [9e7349e]
- Updated dependencies [8864971]
- Updated dependencies [9b773f9]
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
- Updated dependencies [4952edf]
- Updated dependencies [7f0252e]
- Updated dependencies [7d35010]
- Updated dependencies [c4d7b20]
- Updated dependencies [7639a61]
- Updated dependencies [94e63ef]
- Updated dependencies [02aef0c]
- Updated dependencies [6f29aa5]
- Updated dependencies [d21794c]
- Updated dependencies [c4db402]
- Updated dependencies [5319bf1]
- Updated dependencies [49e5671]
- Updated dependencies [b5b97e2]
- Updated dependencies [f59f2c1]
- Updated dependencies [4874117]
- Updated dependencies [ad0183a]
- Updated dependencies [ce08d55]
- Updated dependencies [a17ef09]
- Updated dependencies [aa1240a]
- Updated dependencies [2374a49]
- Updated dependencies [390c071]
- Updated dependencies [d10f526]
- Updated dependencies [2d5d594]
- Updated dependencies [ea7f477]
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
- Updated dependencies [9867281]
  - @object-ui/core@17.1.0
  - @object-ui/types@17.1.0
  - @object-ui/data-objectstack@17.1.0
  - @object-ui/i18n@17.1.0

## 17.0.0

### Major Changes

- c77108c: refactor(spec-bridge): remove the dead page/dashboard bridges (#1892)

  `SpecBridge`'s `page` and `dashboard` bridges — `bridgePage`, `bridgeDashboard`,
  and the `SpecBridge#transformPage` / `#transformDashboard` methods — had no
  runtime consumer. Pages render through their own renderer and dashboards
  through `DashboardView → DashboardRenderer → DatasetWidget` (ADR-0021); neither
  path routes through `SpecBridge`. The dashboard bridge's input shape
  (`object` / `categoryField` / `valueField` / `aggregate`) is the pre-ADR-0021
  widget model, which the strict `DashboardWidgetSchema` now rejects — so the
  bridge could not receive a spec-valid dashboard even in principle.

  Flagged dead by the metadata-liveness audit (framework #1878 / #1892). The
  `list` and `form` bridges are unaffected and remain the live authoring path.

  BREAKING CHANGE: the public exports `bridgePage`, `bridgeDashboard`, and the
  `SpecBridge#transformPage` / `#transformDashboard` methods are removed. There
  is no replacement — render pages and dashboards through their renderers
  (`DashboardRenderer` / the page renderer) directly.

### Minor Changes

- 952b978: fix(detail): the approval band honors the node's `lockRecord` instead of assuming every approval locks (#2902)

  A record detail page treated "a pending approval request exists" as "this
  record is locked". An approval node declares `lockRecord` (default `true`), and
  on `lockRecord: false` the server keeps accepting writes for the whole time
  that node waits — so the console was asserting a lock the backend did not
  enforce.

  The label was the smaller half of it. The same conflated signal fed `canEdit`,
  so the record-level inline-edit session was suppressed too: no pencils,
  `enter()` a no-op. On a single-approver step — a department head or plant
  manager, exactly the case `lockRecord: false` exists for, where the approver is
  meant to fill in the missing detail before deciding — the capability was
  unreachable from the UI. And a flow chaining nodes with different policies drew
  one identical band for "edit freely" and "the server will reject your save with
  `RECORD_LOCKED`", so the two states were indistinguishable until Save failed.

  Approval state is now two signals:

  - **`approvalPending`** — an approval is running. Drives the band and the recall
    button, both meaningful whether or not the record is editable.
  - **`locked`** — that approval also forbids edits, from the pending node's
    `lock_record` (framework#3814, read off the same `node_config_json` snapshot
    the server's record-lock hook reads).

  The band renders two states: amber lock + "Locked for approval", or sky clock +
  "In approval · editable", each with its own tooltip. Recall moved out of the
  locked branch — an editable pending approval is just as recallable. Inline
  editing stays live in the editable state.

  `InlineEditProvider` takes a new optional `approvalPending` prop, defaulting to
  `locked`, so a host that threads only `locked` renders exactly as before. The
  record's `approval_status` field remains the fallback for backends with no
  approvals API; it carries no node granularity, so it still reads as locked — as
  does a pending request from a backend too old to report the policy.

  New `detail.approvalPendingEditable` / `detail.approvalPendingTooltip` keys are
  translated in all ten locales.

- 1767124: feat(grid): compute all eleven spec column summary aggregations (#2890)

  `ColumnSummarySchema` accepts eleven aggregation names; `useColumnSummary` computed
  five. The other six — `none`, `count_empty`, `count_filled`, `count_unique`,
  `percent_empty`, `percent_filled` — passed validation at authoring time and then
  rendered a blank footer cell, with no error raised on either side.

  The computation now splits into two families. Count and percent read _raw_ cell
  values, before the numeric parse, so they work on text, select and lookup columns and
  a value that does not parse as a number still counts as a filled row; a cell is empty
  when it is `null`, `undefined`, `""` or an empty array. `sum`/`avg`/`min`/`max` keep
  the existing numeric parse and column formatting.

  Two behavior changes follow from the enum carrying both `count` and `count_filled`,
  which cannot mean the same thing:

  - `count` is now every row; `count_filled` is the non-empty variant. Only a column
    whose values are all empty renders differently than before.
  - a zero count renders `Empty: 0` instead of collapsing to a blank cell.

  Column currency/percent formatting is gated to the numeric family, so `count_unique`
  on a currency column reads `Unique: 3` and not `$3.00`. `none` and unrecognized names
  skip the entry entirely, so a view whose columns all opt out renders no footer row.

  `ListColumnSchema`'s objectui-local `{ type, field }` arm now takes its vocabulary
  from `SpecColumnSummarySchema` by reference — it was stuck at the same five names,
  which left the per-column `field` override unavailable for the six new aggregations.

  A parity test asserts the renderer's supported set equals the spec enum in both
  directions: a spec name the renderer omits is the bug above, and a renderer name the
  spec omits would be local dialect (Commandment #0).

  **Removed:** `useColumnSummary` from `@object-ui/react`. It was a second, unrelated
  hook of the same name with no callers — a different API, a comment claiming it
  implemented spec v2.0.7, and a `distinct` aggregation that is not in the spec
  vocabulary at all (the spec calls it `count_unique`). Use `useColumnSummary` from
  `@object-ui/plugin-grid`, which implements the spec enum.

- c6cfdf1: feat(react)!: trim the dead device/preference delegates from
  `useClientNotifications` (objectstack#3612 companion)

  `registerDevice`, `getPreferences`, and `updatePreferences` delegated to
  `@objectstack/client` methods that were deleted in objectstack#3612 — the
  `/notifications/devices` and `/notifications/preferences` server routes they
  targeted were never built, so every call already surfaced an error at
  runtime. The hook keeps `fetchNotifications` and `markAsRead` (both
  dispatcher-served and route-ledgered). Breaking only for code destructuring
  the removed functions from the hook result; nothing in this repo did.

### Patch Changes

- 8ecf5a6: Command palette (⌘K) now surfaces record search hits from the platform's global
  search endpoint (`GET /api/v1/search`).

  Previously the palette only ran a per-object `find({ $search })` fanout (the
  metadata-driven ADR-0061 search), which misses records that only the global
  search index knows about — so typing a well-known record name returned no
  records even though `/api/v1/search` served them. `ObjectStackAdapter` now
  exposes a `searchAll(query, { limit, objects })` method that calls the unified
  endpoint, `useRecordSearch` prefers it when present (falling back to the fanout
  otherwise), and the palette renders the resulting record hits grouped by object.

- 7b35e4b: fix(dashboard,charts): resolve `{current_user_id}` in widget filters (framework #3574)

  A dashboard widget filtered on `{current_user_id}` rendered `0`. The token
  reached SQL as a literal, matched no row, and nothing was logged on the client
  or the server — a silent zero that reads as "you have no work" rather than
  "this filter did not resolve". The same token in a list-view filter resolved
  correctly, so a user-scoped list and a user-scoped widget over the same data
  disagreed.

  There was no shared resolver. Three ad-hoc implementations had grown up
  independently — `ObjectView` for list views, `ObjectDataPage` for URL filter
  triples, `NavigationRenderer` for hrefs — and each understood only the filter
  shape its own surface used. `ObjectView`'s opened with
  `if (!Array.isArray(filter)) return filter`, so it could not have been reused
  by dashboard widgets even in principle: widget filters are MongoDB-style
  objects. Widgets therefore got no resolution at all — `DatasetWidget` called
  `resolveDateMacros` and nothing else, which is why `{today}` worked in a widget
  and `{current_user_id}` silently did not.

  - **`@object-ui/core`** — new `utils/filter-tokens.ts` with
    `resolveContextTokens` and `resolveFilterPlaceholders`. The latter expands
    _every_ placeholder vocabulary in one call and is what surfaces should use;
    resolving only some of them is the whole defect. The walk handles arrays and
    plain objects uniformly, so one resolver covers both platform filter shapes.
  - **`@object-ui/react`** — new `FilterScopeProvider` / `useFilterScope`. The
    renderer packages deliberately do not depend on `@object-ui/auth`, so the
    shell supplies the session values. This is a separate context from
    `PredicateScopeContext`, which is the expression evaluation scope and carries
    no organization.
  - **`@object-ui/plugin-dashboard` / `@object-ui/plugin-charts`** — all six
    widgets that previously resolved date macros only now resolve both
    vocabularies: `DatasetWidget`, `ObjectMetricWidget`, `ObjectDataTable`,
    `ObjectPivotTable`, and `ObjectChart` (dataset-bound and inline paths). The
    chart's `compareTo` comparison filter gets the session pass too — otherwise
    the overlay series silently ignored the owner clause the primary series
    honoured.
  - **`@object-ui/app-shell`** — `ObjectView`'s local `substituteFilterTokens`
    and `ObjectDataPage`'s inline `=== '{current_user_id}'` ternary now delegate
    to the shared resolver, so both also gain `{current_org_id}` and date macros.
    Two of the three ad-hoc implementations are gone rather than joined by a
    fourth.

  An unresolvable token is left intact rather than dropped: leaving it yields an
  empty result, whereas dropping the clause would _widen_ the result set and show
  a signed-out viewer everyone's data. It is no longer silent — the resolver
  warns, naming the token, and suggests the intended spelling for known
  near-misses (`{current_user}`, `{user_id}`, `{organization_id}`). Authoring-time
  enforcement lands separately as `filter-token-unknown` in `@objectstack/lint`.

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
- Updated dependencies [e16ed2d]
- Updated dependencies [c6fd752]
- Updated dependencies [f9bbddb]
- Updated dependencies [dfd3705]
- Updated dependencies [2735de6]
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
- Updated dependencies [7d46648]
- Updated dependencies [6e8fd3c]
- Updated dependencies [bb4aa25]
- Updated dependencies [75f1cdf]
- Updated dependencies [662bdf9]
- Updated dependencies [059a052]
- Updated dependencies [53642d4]
- Updated dependencies [8aae006]
- Updated dependencies [d62fb1f]
- Updated dependencies [d147a13]
- Updated dependencies [c6aaed8]
- Updated dependencies [263f885]
- Updated dependencies [dc334da]
  - @object-ui/i18n@17.0.0
  - @object-ui/types@17.0.0
  - @object-ui/data-objectstack@17.0.0
  - @object-ui/core@17.0.0

## 16.1.0

### Minor Changes

- 803558e: feat(data): thread the host's authenticated fetch into `provider: 'api'` data sources (#2725)

  `provider: 'api'` view data sources went through a bare `globalThis.fetch`, so
  custom endpoints (gantt composite trees, report aggregates) carried only
  same-origin cookies while every native `/api/v1/*` request carried
  `Authorization: Bearer` — the moment cookie HMAC verification failed (dev
  restart rotating the fallback auth secret, cookie expiry/rotation in prod)
  those views 401'd while the rest of the app kept working.

  - **`@object-ui/react`** — `SchemaRendererProvider` accepts an optional
    `apiFetch`; nested providers inherit it from their parent so re-wrapped
    subtrees (react pages, preview surfaces) keep the host's authentication.
    `useViewData` defaults the api-provider adapter's fetch to the context
    `apiFetch` (explicit `adapterOptions.fetch` still wins).
  - **`@object-ui/auth`** — `createAuthenticatedFetch` gains a
    `sameOriginOnly` option: cross-origin URLs pass through to the bare fetch
    with no `Authorization` / `X-Tenant-ID` / `Accept-Language`, so metadata-
    supplied third-party URLs never see the platform token.
  - **`@object-ui/app-shell`** — the console wires
    `createAuthenticatedFetch({ sameOriginOnly: true })` (settle-signal wrapped)
    as `apiFetch` on the root `SchemaRendererProvider`.
  - **`@object-ui/plugin-gantt`** — `ObjectGantt` resolves its api-provider
    DataSource with the context `apiFetch`, covering reads and write-backs.

  Behaviour is unchanged for hosts that don't provide `apiFetch` (bare fetch +
  cookies, as before).

- 2e7d7f0: feat(evaluator): route `{ dialect: 'cel' }` component/action predicates to the canonical CEL engine (#2661)

  Component and action `visible` / `disabled` / `hidden` predicates were evaluated
  by the home-grown JS `ExpressionEvaluator`, while field rules
  (`visibleWhen`/`readonlyWhen`/`requiredWhen`, via `fieldRules.ts`) and row/list
  conditionals (via `evalRowPredicate`) already delegate to the canonical
  `@objectstack/formula` engine. That split meant a `{ dialect: 'cel' }` predicate
  in a renderer/action surface was executed as **JavaScript** — CEL-only forms
  (`x in list`, `has()`, typed `==`, the `today()`/`daysFromNow()` catalog) behaved
  differently from, or faulted against, the server's enforcement.

  This converges the remaining tier onto the same engine:

  - **`@object-ui/core`** — `ExpressionEvaluator.evaluateCondition` now detects a
    `{ dialect: 'cel', source }` envelope and evaluates it on `@objectstack/formula`
    (via `evalFieldPredicate`), binding the `record` namespace plus the whole
    context bag as top-level scope (`record.*`, `features.*`, `user.*`, `app.*`).
    Fail-soft to visible/enabled to match the legacy default; `throwOnError`
    callers still fail closed on a _faulting_ predicate (a genuine `false` never
    throws). This fixes every `SchemaRenderer` visibility/disabled read at once.
  - **`@object-ui/react`** — `toPredicateInput` preserves a CEL envelope instead of
    collapsing it to a `${source}` string, and `useCondition` accepts and forwards
    the envelope (keyed on a stable `(dialect, source)` so it doesn't re-evaluate
    each render). Action buttons (`action-icon`/`group`/`bar`/`button`) therefore
    evaluate CEL `visible`/`enabled`/`disabled` on the canonical engine.

  **Back-compat:** bare strings and `${…}` templates stay on the legacy JS path
  (deprecation window); only an explicit `{ dialect: 'cel' }` envelope is rerouted.
  `{ dialect: 'template' }` is unaffected.

  Together with the `^15.1.1` alignment (#2662), a renderer CEL predicate now
  reaches the identical verdict as the server — including the framework's
  `dateField == today()` equality fix (objectstack-ai/objectstack#3205) once it
  lands in a published 15.x. The broader home-grown-vs-canonical divergence
  motivation is #2661.

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

- 549c67d: chore(lint): clear the mechanical baseline lint errors so these packages' lint gates protect them again

  Extends the fields/core cleanup from #2709 (objectui#2713). These eight package
  lints were red at baseline on `main`, so their per-package `lint` gate could not
  catch new violations of the same class. Cleared every **error** (no behavior
  change; warnings are out of scope):

  - **`no-useless-catch`** (`data-objectstack`) — unwrapped five try/catch blocks
    whose `catch` only re-threw; errors still propagate identically.
  - **`preserve-caught-error`** (`cli`, `data-objectstack`, `react`) — the caught
    error's message is inlined into the thrown `Error`; a scoped disable with a
    justifying comment carries each one, because these packages target ES2020
    whose lib types the 1-arg `Error` constructor only (so `{ cause }` won't
    compile) — same reasoning as the core case in #2709.
  - **`prefer-const`** (`plugin-calendar`, `plugin-map`) — `let`→`const` for
    never-reassigned bindings.
  - **`no-empty-object-type`** (`plugin-designer`) — empty extend-only interfaces
    → equivalent `type` aliases.
  - **`no-useless-assignment`** (`react`) — dropped a dead initializer that both
    branches overwrite before it is read.
  - **`no-require-imports`** (`plugin-calendar`, `plugin-timeline` tests) —
    hoisted `vi.mock` factories now use an `async` factory with
    `await import('react')` instead of `require('react')`.
  - **stale `eslint-disable` directive** (`plugin-markdown`) — removed a
    `react/no-danger` disable whose plugin is not loaded in the flat config (an
    unknown-rule reference that ESLint v10 reports as an error); the rationale is
    kept as a plain comment.

- Updated dependencies [0318118]
- Updated dependencies [1c8935a]
- Updated dependencies [af1b0db]
- Updated dependencies [8b8b744]
- Updated dependencies [7cf4051]
- Updated dependencies [8c1e415]
- Updated dependencies [0ea5036]
- Updated dependencies [2e7d7f0]
- Updated dependencies [94d4876]
- Updated dependencies [1100a8b]
- Updated dependencies [7abe4cd]
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
  - @object-ui/data-objectstack@16.1.0
  - @object-ui/types@16.1.0

## 16.0.0

### Minor Changes

- d3e19ed: Adapt to framework 15.1: (1) ADR-0067 D2 all-or-nothing publishes — `formatPublishFailures` renders a rolled-back batch as ONE banner anchored on the causal item (`batch_aborted` entries are summarized, not listed as parallel errors); PackagesPage says "rolled back because X" instead of "{n} failed"; the AI chat publish toast surfaces the real reason instead of a bare count. Pre-15.1 partial-publish responses keep their per-item rendering. (2) ADR-0076 D12 honest discovery — `DiscoveryServiceStatus` gains `handlerReady` + `degraded`/`stub` statuses, new backward-tolerant `isServiceUsable()` helper (absent fields keep the pre-15.1 default; `stub`/`handlerReady:false` gate off; `degraded` stays usable), consumed by `isAuthEnabled`/`isAiEnabled` and `ConditionalAuthWrapper`.

### Patch Changes

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

- 195a651: refactor(spec-bridge): retire the hand-written `ListViewSpec`/`ListColumn` mirrors in the list-view bridge (#2231 follow-up)

  The SpecBridge's list-view bridge kept a third hand-written copy of the ListView shape
  (after the zod schema and the TS interface unified in the previous #2231 PR). It now
  derives its input type from `@objectstack/spec/ui` (`Partial<ListView>`, spec `ListColumn`),
  so the bridge can no longer drift from the protocol.

  Behavior fix surfaced by the real types: spec `columns` is `string[] | ListColumn[]`, but
  the old local interface only admitted `ListColumn[]` — a bare field-name column would have
  produced a broken `{ accessorKey: undefined }` mapping. String columns now map to a default
  column (`{ accessorKey: field, header: field }`).

- Updated dependencies [210806a]
- Updated dependencies [b4ef588]
- Updated dependencies [ca0f5f0]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
  - @object-ui/types@16.0.0
  - @object-ui/i18n@16.0.0
  - @object-ui/core@16.0.0
  - @object-ui/data-objectstack@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/i18n@15.0.0
- @object-ui/data-objectstack@15.0.0

## 14.1.0

### Minor Changes

- 5523fc4: Dashboard-level filters — the three #2578 item-5 enhancements (framework#2501):

  - **react**: nested `PageVariablesProvider`s now MERGE instead of shadowing
    wholesale. A filtered dashboard embedded in a Page with its own `variables`
    keeps the outer page variables readable inside widget subtrees (`page.*`);
    an inner definition shadows only the SAME name; writes route to the scope
    that defines the variable (writing an outer-defined name from inside the
    nested subtree updates the outer provider); `resetVariables` stays local.
    Names defined nowhere still write locally, exactly as before.
  - **core**: `buildWidgetScopedFilter` accepts an optional `knownFields` set —
    a DEFAULT binding whose target field is not on the widget's object is
    skipped with a console warning instead of emitting a query the backend
    empty-matches. Explicit `filterBindings` strings are always honoured (a
    typo surfaces as a visibly empty widget, never a silently dropped filter).
    Omitting `knownFields` preserves the previous unchecked behaviour.
  - **plugin-dashboard**: `DashboardRenderer` feeds `knownFields` from
    `dataSource.getObjectSchema` for inline `object` widgets (best-effort —
    unchecked while metadata loads or when the source can't describe objects).
    `optionsFrom` dynamic filter options now resolve DISTINCT values
    server-side via a dataset GROUP BY (`queryDataset` with an inline draft)
    when the data source supports it, falling back to the previous client-side
    top-200 dedupe otherwise.

- dea65f7: Unify the list-view conditional tier onto the canonical CEL engine (#1584).

  Conditional formatting (list / grid / kanban) and row-action `visible` /
  `disabled` predicates are now evaluated by `@objectstack/formula`'s
  `ExpressionEngine` — the same engine the server uses — instead of the legacy
  JS-dialect `ExpressionEvaluator`, matching how `@objectstack/spec` already types
  these surfaces (`ExpressionInputSchema` / CEL). The whole platform now speaks one
  expression dialect (framework ADR-0058).

  - `@object-ui/core`: new `evalRowPredicate` + `resolveConditionalFormatting`
    helpers (next to `evalFieldPredicate`). One implementation of all three
    formatting rule shapes; dialect routing (a `{ dialect: 'cel' }` envelope is
    always CEL; a bare string is CEL unless it carries legacy-only syntax
    (`${…}` / `===` / `?.` / `.includes()`), which routes to the old engine with a
    one-time deprecation warning); the native `{ field, operator, value }` form is
    translated to CEL.
  - `@object-ui/react`: new `useRowPredicate` hook (canonical CEL, ambient
    predicate scope merged).
  - Consumers converged: `ListView.evaluateConditionalFormatting` (thin wrapper,
    export kept), `ObjectGrid` row styling (inline copy removed), kanban card
    styles, and the grid / data-table row-action menus. `plugin-view`'s kanban
    branch now forwards top-level `conditionalFormatting` (previously dropped).
  - Row-action `visible` fails **closed** (broken predicate → hidden + warn);
    `disabled` fails soft. The CEL `in` operator (and list membership) now work in
    row predicates — the legacy engine could not parse them.
  - The legacy `FormField.condition: { field, equals/notEquals/in }` is retired to
    a CEL translation (back-compat preserved); `FieldDesigner` migrated to
    `visibleWhen`.

  Fully back-compat: existing conditional-formatting rules, row-action predicates,
  and form `condition` metadata keep working (translated / routed as needed).

- 5b52624: feat(detail): record-level inline edit — shared `InlineEditContext` + one atomic Save (objectui#2407 P1)

  Lift the inline-edit session out of `DetailView`'s private state into a
  record-level, shared context so a record page's surfaces can share ONE draft and
  commit it in ONE atomic, cross-field-validated write (replacing the per-field
  save loop).

  - **`InlineEditContext` / `InlineEditProvider` / `useInlineEdit`** (@object-ui/react)
    — pure UI state (`editing`, `canEdit`, `draft`, `autoFocusField`, `saving`,
    `error` + `enter` / `setField` / `cancel` / `reset`). A _separate_ context from
    `RecordContext` (mirrors `HighlightFieldsContext`) so per-keystroke draft churn
    doesn't re-render other `record:*` consumers.
  - **`<InlineEditSaveBar>`** (@object-ui/plugin-detail) — the record-level sticky
    Save/Cancel bar. Commits the whole draft in ONE
    `dataSource.update(obj, id, draft, { ifMatch: data.updated_at })` → `refresh()`;
    a `409 CONCURRENT_UPDATE` reuses `<ConcurrentUpdateDialog>` (reload / overwrite).
    A callback mode (`onFieldSave`) preserves the drawer's per-field persistence
    contract with plugin-gantt/calendar/kanban.
  - **`DetailView`** now consumes `useInlineEdit()` instead of owning inline-edit
    state; its header/inline Save-Cancel bars and per-field batch-save are removed
    (the approval-lock badge stays). Rendered without a provider it is simply
    read-only.
  - **`record:details`** and **`RecordDetailDrawer`** each wrap their `DetailView`
    in an `<InlineEditProvider>` + `<InlineEditSaveBar>`. The object-lifecycle /
    permission gate flows through `canEdit`; computed / readonly / system fields
    and the OCC path are unchanged.

  Guardrails preserved: computed (`formula`/`summary`/`rollup`/`auto_number`) +
  `readonly` + system fields expose no editor; `canEdit` gate; OCC (`ifMatch` +
  `ConcurrentUpdateDialog`); the atomic partial update carries only user-edited
  keys (never computed/read-only). Editable highlights ride on top of this in P2.

- f94905d: remove(react): drop the unused `FormRenderer` / `FieldFactory` duplicate render path (#2545)

  `FormRenderer` (and its captive `FieldFactory`) was an exported-but-dead second
  form render path: zero runtime consumers anywhere in the repo — the only import
  was its own test file. It duplicated `@object-ui/plugin-form`'s `ObjectForm`
  (the path every app actually uses via the component registry) but had drifted
  into a degraded variant: raw-HTML/Tailwind instead of the shared UI primitives,
  a hard-coded Submit button, and no support for `submitBehavior` / `aria` /
  `groups`.

  **Breaking (ships as minor per the pre-1.0 launch-window convention):** the
  public exports `FormRenderer`, `FormRendererProps`, `FieldFactory`,
  `FieldFactoryProps`, and `ExtendedFormField` are removed from
  `@object-ui/react`. Render forms through the `object-form` schema node
  (`@object-ui/plugin-form` `ObjectForm`, reachable from a `FormViewSchema` via
  `SchemaRenderer` / the spec bridge) instead. Closes Phase 4 of #2545.

### Patch Changes

- Updated dependencies [82441e4]
- Updated dependencies [2efa9fd]
- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
- Updated dependencies [23d65c3]
- Updated dependencies [9e2d58f]
- Updated dependencies [dea65f7]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f0f10f5]
  - @object-ui/i18n@14.1.0
  - @object-ui/core@14.1.0
  - @object-ui/types@14.1.0
  - @object-ui/data-objectstack@14.1.0

## 14.0.0

### Minor Changes

- 86c69c3: ADR-0089: read the canonical `visibleWhen` conditional-visibility predicate in the form + page renderers.

  `@objectstack/spec` now unifies conditional visibility under a single canonical key, `visibleWhen`, and folds the deprecated `visibleOn` (view form) / `visibility` (page component) aliases into it at parse. This updates ObjectUI to read the canonical key:

  - **Page renderer** (`SchemaRenderer`) — evaluates `visibleWhen` first (show-when-truthy), then the deprecated `visibleOn` / `visibility` as a defensive read for raw / un-normalized metadata. `visibleWhen` is stripped from DOM props.
  - **Spec→node bridges** — the page bridge maps a component's `visibleWhen ?? visibility` onto the node's canonical `visibleWhen`; the form-view bridge maps a field's `visibleWhen ?? visibleOn` onto the ObjectForm view-level predicate slot.
  - **Form renderers** — the `@object-ui/react` `FormRenderer` prefers `visibleWhen` over the `visibleOn` alias. (`ObjectForm`/`form.tsx` already evaluated `visibleWhen`.)
  - **Types** — the component base schema (`BaseSchema` / `base.zod`) gains the canonical `visibleWhen`; `visibleOn` is marked `@deprecated`.

  Fully back-compat: existing `visibleOn` / `visibility` metadata keeps working through the alias reads.

### Patch Changes

- Updated dependencies [443360a]
- Updated dependencies [c70bca7]
- Updated dependencies [86c69c3]
- Updated dependencies [05e56ca]
- Updated dependencies [5971cc4]
- Updated dependencies [6a74160]
  - @object-ui/core@14.0.0
  - @object-ui/i18n@14.0.0
  - @object-ui/types@14.0.0
  - @object-ui/data-objectstack@14.0.0

## 13.2.0

### Patch Changes

- Updated dependencies [53c40c2]
- Updated dependencies [e492b9d]
  - @object-ui/i18n@13.2.0
  - @object-ui/data-objectstack@13.2.0
  - @object-ui/types@13.2.0
  - @object-ui/core@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/core@13.1.0
- @object-ui/i18n@13.1.0
- @object-ui/data-objectstack@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [9e38270]
- Updated dependencies [619097e]
  - @object-ui/i18n@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/core@13.0.0
  - @object-ui/data-objectstack@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [6cbccf3]
- Updated dependencies [e1840bf]
- Updated dependencies [c31874d]
  - @object-ui/i18n@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/core@12.1.0
  - @object-ui/data-objectstack@12.1.0

## 12.0.0

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/data-objectstack@12.0.0
  - @object-ui/i18n@12.0.0

## 11.5.0

### Minor Changes

- 6fffd3d: Client-side data-invalidation bus — refresh data, don't rebuild UI (objectui#2269 P1).

  - `@object-ui/react` gains the bus: `notifyDataChanged({objectName, recordId?})`, `useDataInvalidation(objectName, recordId?)` (reader nonce), `subscribeDataChanges`, and `useMutationInvalidationBridge(dataSource)` which fans every dataSource write (`MutationEvent`) onto the bus. The bus also dispatches the legacy `objectui:related-changed` window event, so pre-bus listeners keep working.
  - The `key={refreshKey}` remount of `RecordDetailView` (AppContent) and the `key={actionRefreshKey}` remount of `DetailView` (RecordDetailView) are GONE: record data now refetches in place via the bus — scroll, collapsed sections, tabs and in-progress inline edits survive every save/action/undo. All nine action-success bumps became precisely-scoped `notifyDataChanged` calls; undo/redo use the operation's own `objectName`/`recordId`.
  - `RelatedCountStore` is wired to the bus (tab count badges refetch after any change to their object) and its `useSyncExternalStore` snapshot is now a monotonic version — previously it returned the same `Map` reference, so `emit()` never re-rendered subscribers and invalidations left badges stale; `useRelatedCountVersion()` is exported and drives the probe effect's re-fetch.
  - app-shell also gains the reserved URL-param registry (`urlParams.ts` — `form`/`formObject`/`formLink`/`tab`/`recordId`/`palette`/`shortcuts` constants replace scattered string literals) and AGENTS.md Commandment #8 (UI-state classification: state that must survive a data refresh may never live only in an uncontrolled component).

### Patch Changes

- fae75e2: Fix two bugs verified still-present after #2254 claimed to resolve them (framework#2620 / framework#2616 Showcase UX pass, tracked in #2268):

  - **Wizard/form `submitBehavior: 'thank-you'` allowed duplicate resubmission.** #2254 fixed the spec-bridge dropping `submitBehavior` before it reached the renderer, so the configured toast message started appearing — but `WizardForm`'s last step and `ObjectForm`'s submit handler only ever called `toast.success(...)` for `thank-you`/`next-record`; the form stayed mounted and fully filled with its submit button re-enabled once the request settled, so a second click created a second record. Both components now track a terminal `submitted` state and, when set, replace the form with a confirmation panel (using the behavior's `title`/`message`, which were also never read before) — mirroring the pattern `apps/console/src/components/FormPage.tsx` already used for its own standalone forms.

  - **Command Center-style 3-up chart bands stayed collapsed to ~100-130px, and a dataset-bound chart's measure leaked its raw field name.**
    - `responsiveStyles` (and `style`) were declared on the page-spec `PageComponent` bridge input type but never copied onto the `SchemaNode` in `spec-bridge/bridges/page.ts::mapComponent()` — so a page author's ADR-0065 layout override (e.g. forcing `display: 'grid'` on a `type: 'flex'` band) never reached `SchemaRenderer`, and the node silently fell back to its default flex layout. Both fields are now mapped through.
    - `ObjectChart`'s dataset-bound fetch path (`schema.dataset` + `ds.queryDataset(...)`) discarded the response's `fields` array (which carries each measure's `label`, e.g. `{ name: 'task_count', label: 'Tasks' }`) before it ever reached `buildChartSeries()` — whose `fields` param already resolves this correctly (see `chart-series.test.ts`) — so the legend/tooltip always fell back to the raw field name. The fetched `fields` are now captured and threaded through.

- Updated dependencies [544d8eb]
- Updated dependencies [9255686]
- Updated dependencies [1072701]
  - @object-ui/i18n@11.5.0
  - @object-ui/types@11.5.0
  - @object-ui/data-objectstack@11.5.0
  - @object-ui/core@11.5.0

## 11.4.0

### Patch Changes

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [9cd9be1]
- Updated dependencies [c38d107]
- Updated dependencies [790558b]
- Updated dependencies [c0164ad]
  - @object-ui/types@11.4.0
  - @object-ui/i18n@11.4.0
  - @object-ui/data-objectstack@11.4.0
  - @object-ui/core@11.4.0

## 11.3.0

### Patch Changes

- Updated dependencies [d88c8ec]
- Updated dependencies [d23d6eb]
  - @object-ui/i18n@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/data-objectstack@11.3.0
  - @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/core@11.2.0
  - @object-ui/data-objectstack@11.2.0
  - @object-ui/types@11.2.0
  - @object-ui/i18n@11.2.0

## 11.1.0

### Patch Changes

- Updated dependencies [6726a2b]
  - @object-ui/i18n@11.1.0
  - @object-ui/types@11.1.0
  - @object-ui/core@11.1.0
  - @object-ui/data-objectstack@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/types@7.3.0
- @object-ui/core@7.3.0
- @object-ui/i18n@7.3.0
- @object-ui/data-objectstack@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [8e7c1da]
- Updated dependencies [d23db5c]
  - @object-ui/i18n@7.2.0
  - @object-ui/types@7.2.0
  - @object-ui/core@7.2.0
  - @object-ui/data-objectstack@7.2.0

## 7.1.0

### Minor Changes

- a71be60: chore: drop the unrendered `blank` / `record_review` page types and their config

  The `blank` and `record_review` page types have no renderer and were removed
  from `@objectstack/spec`'s `PageTypeSchema` (framework#2265, enforce-or-remove).
  This drops their now-dead references in objectui so the upstream spec can hard-
  remove `BlankPageLayoutSchema` / `RecordReviewConfigSchema`:

  - `PageType` union: removed `dashboard` / `form` / `record_detail` /
    `record_review` / `overview` / `blank` (grid/gallery/kanban/calendar/timeline
    remain — those are list _visualizations_, a separate cleanup).
  - Removed `blankLayout` from `PageLayout` and the `blankLayout` / `recordReview`
    handling in the spec→SDUI page bridge.
  - Removed the redundant `BlankPageLayout{,Schema,Item,ItemSchema}` re-import from
    `@objectstack/spec/ui` (it was never used).

### Patch Changes

- Updated dependencies [677f7ed]
- Updated dependencies [08c47da]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0
  - @object-ui/core@7.1.0
  - @object-ui/data-objectstack@7.1.0
  - @object-ui/i18n@7.1.0

## 7.0.0

### Minor Changes

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

### Patch Changes

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

- e95cc25: Fix the NavigationSyncEffect baseline race: lazily-loaded `page`/`dashboard` metadata (and the empty cache during `invalidate()` refetch) could seed a partial diff baseline, making platform `sys_` pages look "user added" — the effect then wrote them into every app's navigation, 403ing on ADR-0010 locked apps (red "Failed to update navigation" toasts) and polluting writable apps. The effect now diffs only while both types are `status === 'ready'` (new optional `MetadataContextValue.getTypeStatus`), never treats `sys_`-prefixed artifacts as user creations, and skips apps whose `_lock`/`protection.lock` is `full`/`no-overlay`.
- abe8ebc: Repoint `useClientNotifications` to the ADR-0030 `@objectstack/client` surface

  The `useClientNotifications` bridge hook called `client.notifications.*` with
  signatures that no longer exist on `@objectstack/client@7.x`:

  - `registerDevice(token, platform)` → the SDK takes a single
    `RegisterDeviceRequest` object (`{ token, platform }`).
  - `markAsRead(id)` → there is no single-id method; the SDK exposes
    `markRead(ids: string[])`. The hook keeps its friendly single-id API and
    adapts to the batch call.

  These helpers are the stable transport contract for ADR-0030 (Notification
  Convergence): server-side they route to the L5 `sys_inbox_message`
  materialization and the `sys_notification_receipt` read-state spine — the
  re-modeled `sys_notification` L2 event no longer carries recipient/read
  columns. (The Console bell itself reads the inbox + receipts directly via the
  generic data API; see the `@object-ui/app-shell` bell cut-over.)

  ## Cut-over sequence (operational — run in this order)

  The Console UI repoint must land together with the framework pipeline **and**
  the data migration so the bell is never blank and read-state is never lost:

  1. Deploy the framework ADR-0030 change (objects + `emit()` + producers). New
     notifications now land in `sys_inbox_message` + `sys_notification_receipt`.
  2. Run the data migration **once** to carry existing notifications across —
     `migrateSysNotificationToEvent({ driver, data })` from
     `@objectstack/metadata/migrations`. It splits each legacy `sys_notification`
     inbox row into a `sys_inbox_message` + receipt, rewrites the row to the event
     shape, and clears the legacy columns. It is **idempotent** and reports
     `not_applicable` on fresh installs. This runs against the ObjectStack
     **server/data engine** — it is not a Console (frontend) step.
  3. Deploy the objectui repoint (this change + the `@object-ui/app-shell` bell
     cut-over).

- 2270239: feat: scoped style-object rendering (ADR-0065)

  A metadata node may carry `responsiveStyles` (per-breakpoint CSS-property maps);
  `SchemaRenderer` compiles it to **id-scoped CSS** injected as a `<style>` tag and
  appends a scope class to the node. Build-independent (arbitrary values + design
  tokens pass through verbatim — no Tailwind JIT), collision-free (per-node scope,
  unlayered so it beats base utilities), responsive-correct (model breakpoint maps
  → generated `@media`, never `md:` variant classes). Adds `compileScopedStyles`/
  `scopeClassFor`/`hasResponsiveStyles` to `@object-ui/core` and an SDUI design-token
  palette (`--space-*`, `--surface`, `--brand`, …) to the theme. Mirrors Builder.io.

- Updated dependencies [5976ba3]
- Updated dependencies [eaccefd]
- Updated dependencies [f7f325d]
- Updated dependencies [c12986e]
- Updated dependencies [71d7ce0]
- Updated dependencies [30ee761]
- Updated dependencies [053c948]
- Updated dependencies [b99d9bd]
- Updated dependencies [053c948]
- Updated dependencies [89e113c]
- Updated dependencies [ddbe4a2]
- Updated dependencies [2d47e94]
- Updated dependencies [9049bbe]
- Updated dependencies [77cc6bb]
- Updated dependencies [97c6831]
- Updated dependencies [cb2fdb1]
- Updated dependencies [a58c6b8]
- Updated dependencies [c3749eb]
- Updated dependencies [c09f44e]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [d54346c]
- Updated dependencies [5332639]
- Updated dependencies [3870c20]
- Updated dependencies [b88c560]
- Updated dependencies [0ad72a6]
- Updated dependencies [3fa23a7]
- Updated dependencies [18d0339]
- Updated dependencies [59b6bbb]
- Updated dependencies [d16566f]
- Updated dependencies [1394e34]
- Updated dependencies [300d755]
- Updated dependencies [bd8b054]
- Updated dependencies [4eb9cb6]
- Updated dependencies [7c239fd]
- Updated dependencies [858ad94]
- Updated dependencies [2270239]
- Updated dependencies [2f31406]
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/data-objectstack@7.0.0
  - @object-ui/i18n@7.0.0
  - @object-ui/types@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/i18n@6.2.3
- @object-ui/data-objectstack@6.2.3

## 6.2.2

### Patch Changes

- a66f788: fix(react): preserve `data-obj-schema-invalid` flag across re-renders

  `SchemaRenderer` runs a post-mount `forceUpdate` to pick up lazy plugin
  registrations. The dev-mode validator was deduping via a `WeakSet` that
  always returned `valid: true` on the second call, which stripped the
  `data-obj-schema-invalid` attribute on the immediate re-render. The
  result and the "warn-once" tracking are now stored separately: a
  `WeakMap` caches the validation outcome (so the visual flag is stable),
  while a `WeakSet` continues to dedupe `console.warn` output.

  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2
  - @object-ui/i18n@6.2.2
  - @object-ui/data-objectstack@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/i18n@6.2.1
- @object-ui/data-objectstack@6.2.1

## 6.2.0

### Patch Changes

- Updated dependencies [fe3c1d3]
- Updated dependencies [ec8dcde]
  - @object-ui/data-objectstack@6.2.0
  - @object-ui/types@6.2.0
  - @object-ui/core@6.2.0
  - @object-ui/i18n@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/data-objectstack@6.1.0
  - @object-ui/i18n@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/i18n@6.0.4
- @object-ui/data-objectstack@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/i18n@6.0.3
- @object-ui/data-objectstack@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/i18n@6.0.2
- @object-ui/data-objectstack@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/i18n@6.0.1
- @object-ui/data-objectstack@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/i18n@6.0.0
- @object-ui/data-objectstack@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/i18n@5.4.2
- @object-ui/data-objectstack@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/i18n@5.4.1
- @object-ui/data-objectstack@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/data-objectstack@5.4.0
  - @object-ui/i18n@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/i18n@5.3.2
- @object-ui/data-objectstack@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/i18n@5.3.1
- @object-ui/data-objectstack@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/i18n@5.3.0
- @object-ui/data-objectstack@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/i18n@5.2.1
- @object-ui/data-objectstack@5.2.1

## 5.2.0

### Minor Changes

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

- aa063db: `useRecordSearch` now orders hits by relevance instead of object-fanout
  order. Tiers (higher wins):

  - 110: exact recordId paste
  - 100: display exactly equals the query
  - 80: display starts with the query
  - 60: any token in display starts with the query
  - 40: display contains the query as a substring

  This makes `⌘K → "Ada"` rank "Ada Lovelace" above "AdvancedTradingAccount"
  even though Account is queried before Contact in the fanout.

  `RecordSearchHit` gains a `score` field for callers that want to render
  hint chips, filter low-confidence rows, or further customize ordering.

- 7c7400a: feat(react): dev-mode schema validation in SchemaRenderer

  `SchemaRenderer` now runs the canonical `validateSchema` from
  `@object-ui/core` on every schema object it renders (deduped per-object
  via a WeakSet so re-renders don't re-log). Errors are surfaced via a
  single grouped `console.warn` that includes the offending JSON path,
  and the host element receives `data-obj-schema-invalid="true"` so apps
  can hook a visual cue (e.g. red outline) via CSS.

  The entire pass is gated on `process.env.NODE_ENV !== 'production'`
  and is a no-op in production builds — zero runtime cost shipped to
  users.

### Patch Changes

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [321294c]
- Updated dependencies [b2d1704]
- Updated dependencies [0a644f0]
- Updated dependencies [a3cb88f]
- Updated dependencies [5425608]
- Updated dependencies [e919433]
- Updated dependencies [70b5570]
- Updated dependencies [d9c3bae]
- Updated dependencies [d1442e3]
  - @object-ui/types@5.2.0
  - @object-ui/data-objectstack@5.2.0
  - @object-ui/core@5.2.0
  - @object-ui/i18n@5.2.0

## 5.1.1

### Patch Changes

- @object-ui/types@5.1.1
- @object-ui/core@5.1.1
- @object-ui/i18n@5.1.1
- @object-ui/data-objectstack@5.1.1

## 5.1.0

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

- Updated dependencies [1976691]
- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
- Updated dependencies [49b1760]
- Updated dependencies [c0b236f]
  - @object-ui/i18n@5.1.0
  - @object-ui/types@5.1.0
  - @object-ui/core@5.1.0
  - @object-ui/data-objectstack@5.1.0

## 5.0.2

### Patch Changes

- Updated dependencies [cab6a93]
  - @object-ui/i18n@5.0.2
  - @object-ui/types@5.0.2
  - @object-ui/core@5.0.2
  - @object-ui/data-objectstack@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1
- @object-ui/i18n@5.0.1
- @object-ui/data-objectstack@5.0.1

## 5.0.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [8930b15]
- Updated dependencies [7213027]
- Updated dependencies [c7561a7]
  - @object-ui/i18n@5.0.0
  - @object-ui/types@5.0.0
  - @object-ui/data-objectstack@5.0.0
  - @object-ui/core@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/i18n@4.8.0
- @object-ui/data-objectstack@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/i18n@4.7.0
- @object-ui/data-objectstack@4.7.0

## 4.6.0

### Patch Changes

- @object-ui/types@4.6.0
- @object-ui/core@4.6.0
- @object-ui/i18n@4.6.0
- @object-ui/data-objectstack@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [ab5e281]
- Updated dependencies [22fa558]
  - @object-ui/types@4.5.0
  - @object-ui/i18n@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/data-objectstack@4.5.0

## 4.4.0

### Patch Changes

- @object-ui/types@4.4.0
- @object-ui/core@4.4.0
- @object-ui/i18n@4.4.0
- @object-ui/data-objectstack@4.4.0

## 4.3.1

### Patch Changes

- Updated dependencies [5f4ac6e]
  - @object-ui/i18n@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1
  - @object-ui/data-objectstack@4.3.1

## 4.3.0

### Patch Changes

- Updated dependencies [f196cf4]
- Updated dependencies [ee1cc96]
- Updated dependencies [0b032be]
- Updated dependencies [115d36a]
- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/i18n@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0
  - @object-ui/data-objectstack@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1
- @object-ui/i18n@4.2.1
- @object-ui/data-objectstack@4.2.1

## 4.2.0

### Patch Changes

- Updated dependencies [eb738bd]
- Updated dependencies [650392e]
- Updated dependencies [84b4bf1]
  - @object-ui/i18n@4.2.0
  - @object-ui/types@4.2.0
  - @object-ui/core@4.2.0
  - @object-ui/data-objectstack@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/i18n@4.1.0
- @object-ui/data-objectstack@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/i18n@4.0.12
- @object-ui/data-objectstack@4.0.12

## 4.0.11

### Patch Changes

- Updated dependencies [1909bc3]
  - @object-ui/i18n@4.0.11
  - @object-ui/types@4.0.11
  - @object-ui/core@4.0.11
  - @object-ui/data-objectstack@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10
- @object-ui/i18n@4.0.10
- @object-ui/data-objectstack@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/i18n@4.0.9
- @object-ui/data-objectstack@4.0.9

## 4.0.8

### Patch Changes

- Updated dependencies [3d58eaa]
  - @object-ui/i18n@4.0.8
  - @object-ui/types@4.0.8
  - @object-ui/core@4.0.8
  - @object-ui/data-objectstack@4.0.8

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

- Updated dependencies [7c9b85c]
- Updated dependencies [fd15918]
  - @object-ui/core@4.0.7
  - @object-ui/i18n@4.0.7
  - @object-ui/data-objectstack@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- @object-ui/types@4.0.6
- @object-ui/core@4.0.6
- @object-ui/i18n@4.0.6
- @object-ui/data-objectstack@4.0.6

## 4.0.5

### Patch Changes

- @object-ui/types@4.0.5
- @object-ui/core@4.0.5
- @object-ui/i18n@4.0.5
- @object-ui/data-objectstack@4.0.5

## 4.0.4

### Patch Changes

- @object-ui/types@4.0.4
- @object-ui/core@4.0.4
- @object-ui/i18n@4.0.4
- @object-ui/data-objectstack@4.0.4

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
  - @object-ui/data-objectstack@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/i18n@4.0.1
- @object-ui/data-objectstack@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/data-objectstack@4.0.0
  - @object-ui/i18n@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/types@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/data-objectstack@3.4.0
  - @object-ui/i18n@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/i18n@3.3.2
- @object-ui/data-objectstack@3.3.2

## 3.3.1

### Patch Changes

- @object-ui/types@3.3.1
- @object-ui/core@3.3.1
- @object-ui/i18n@3.3.1
- @object-ui/data-objectstack@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/i18n@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
- @object-ui/i18n@3.2.0

## 3.1.5

### Patch Changes

- Updated dependencies [cfe0596]
  - @object-ui/i18n@3.1.5
  - @object-ui/types@3.1.5
  - @object-ui/core@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4
- @object-ui/core@3.1.4
- @object-ui/i18n@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3
- @object-ui/core@3.1.3
- @object-ui/i18n@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/i18n@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/core@3.1.1
  - @object-ui/i18n@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3
- @object-ui/core@3.0.3
- @object-ui/i18n@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2
- @object-ui/core@3.0.2
- @object-ui/i18n@3.0.2

## 3.0.1

### Patch Changes

- adf2cc0: Patch release for bug fixes and improvements
  - @object-ui/types@3.0.1
  - @object-ui/core@3.0.1
  - @object-ui/i18n@3.0.1

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
  - @object-ui/i18n@3.0.0

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
  - @object-ui/core@2.0.0
  - @object-ui/i18n@2.0.0

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/core@0.3.1

## 0.3.0

### Minor Changes

- Unified version across all packages to 0.3.0 for consistent versioning

## 0.2.2

### Patch Changes

- New plugin-object and ObjectQL SDK updates

  **Added:**

  - New Plugin: @object-ui/plugin-object - ObjectQL plugin for automatic table and form generation
    - ObjectTable: Auto-generates tables from ObjectQL object schemas
    - ObjectForm: Auto-generates forms from ObjectQL object schemas with create/edit/view modes
    - Full TypeScript support with comprehensive type definitions
  - Type Definitions: Added ObjectTableSchema and ObjectFormSchema to @object-ui/types
  - ObjectQL Integration: Enhanced ObjectQLDataSource with getObjectSchema() method using MetadataApiClient

  **Changed:**

  - Updated @objectql/sdk from ^1.8.3 to ^1.9.1
  - Updated @objectql/types from ^1.8.3 to ^1.9.1

- Updated dependencies
  - @object-ui/core@0.2.2

## 0.2.1

### Patch Changes

- Patch release: Add automated changeset workflow and CI/CD improvements

  This release includes infrastructure improvements:

  - Added changeset-based version management
  - Enhanced CI/CD workflows with GitHub Actions
  - Improved documentation for contributing and releasing

- Updated dependencies
  - @object-ui/core@0.2.1
