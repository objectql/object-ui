# @object-ui/collaboration

## 17.5.0

### Patch Changes

- 3e19fe7: i18n copy: one ellipsis glyph across the ten packs, `usted` in the es draft-preview empty state, and a pt sentence that stops contracting `de` onto its own hole

  Three locale-copy defects that no gate could see, because all three are _value_ defects on keys whose names, placeholders and key sets were already correct.

  **One ellipsis (objectui#3878).** `en` ended 33 values with three ASCII full stops (`Loading...`, `Ask anything...`) and 110 with the typographic ellipsis `…`, and the nine translation packs had copied `en` value by value — so a user could read both glyphs on one screen: `common.loading` beside `dashboard.loading`, `console.ai.askAnything` beside its own panel's siblings. All ten packs now spell it `…` (U+2026), per the maintainer-authorized consistency pass registered on objectstack#6015. 312 pack values changed: 34 in `en` (the 33 trailing plus the one mid-sentence `collaboration.commentPlaceholder`) and 278 across the nine. Eleven inline `defaultValue` call sites were re-synchronised with the new `en` text, which `scripts/check-i18n-call-site-keys.mjs` requires byte-for-byte.

  The convention is now pinned so the split cannot regrow: `packages/i18n/src/__tests__/ellipsis-glyph-3878.test.ts` fails, by key name, on any value in any of the ten packs that holds three ASCII full stops. It is deliberately wider than "a trailing `...` in `en`", because the census showed the narrow rule would have shipped with two holes in it — `collaboration.commentPlaceholder` puts the ellipsis mid-sentence, and `list.loading` had the packs wrong while `en` was already right, which no `en`-only rule can see.

  Fifteen module-local **no-provider fallback** entries were moved with the packs, across `useCollaborationTranslation`, `useFieldTranslation`, `useDetailTranslation`, `ObjectGrid`, `KanbanImpl`, `data-table` and `ConnectionStatus`. Those maps exist to render when no `LocalizationProvider` is mounted, and each one's own docblock requires it to stay byte-identical to the `en` pack — a requirement objectui#3440 already enforces mechanically for the collaboration map. Leaving them behind would have made the provider-less path disagree with the provider path on ten keys.

  **es `usted` (objectui#3875).** `preview.empty.notReadyDescription` said `Revisa la conversación` — the tú imperative — in a namespace that is otherwise 23:1 usted, and it renders _underneath the usted draft-preview banner at the same moment_, not before or after it. `Revisa` → `Revise`; nothing else in the sentence carries a register. The neighbouring `approvalsInbox` namespace is legitimately tú and was left alone.

  **pt contraction (objectui#3877).** `ConcurrentUpdateDialog` splits `detail.concurrentUpdateDescription` on `{{field}}` and renders a bolded label in the gap, and pt left a bare `de` in front of that gap. When the multi-field conflict branch passes the record label (`este registro`), Portuguese users read `de este registro` — a contraction error every native speaker sees, and one that no spelling of the leaf value could fix (`deste registro` renders `de deste registro`). The pt sentence is rewritten so the hole is preceded by the verb `afeta` instead of any preposition, which closes the whole class rather than trading `de` for an `em` or `a` that contract just as hard. pt only; `en` is unchanged.

  No behavior, no keys added or removed, no placeholder changed.

- Updated dependencies [0e67b53]
- Updated dependencies [932cbcd]
- Updated dependencies [734d186]
- Updated dependencies [f650253]
- Updated dependencies [3d9769a]
- Updated dependencies [3fc2971]
- Updated dependencies [f7c6430]
- Updated dependencies [ae10a01]
- Updated dependencies [92876f0]
- Updated dependencies [d9d3463]
- Updated dependencies [2a40f69]
- Updated dependencies [bec3e14]
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
- Updated dependencies [7e4f0e5]
- Updated dependencies [45e1949]
- Updated dependencies [92250d6]
- Updated dependencies [c1d939f]
- Updated dependencies [58bebf6]
- Updated dependencies [405e808]
- Updated dependencies [c0f9a4b]
- Updated dependencies [ac853ce]
- Updated dependencies [fa51109]
- Updated dependencies [d46f9b8]
- Updated dependencies [2fea4d2]
- Updated dependencies [7f1cb33]
- Updated dependencies [bb68488]
- Updated dependencies [2e3b0c0]
- Updated dependencies [78fa331]
- Updated dependencies [31ab1ac]
- Updated dependencies [0082db8]
- Updated dependencies [ab04728]
- Updated dependencies [06915b0]
- Updated dependencies [ff84b05]
  - @object-ui/i18n@17.5.0
  - @object-ui/types@17.5.0

## 17.4.0

### Patch Changes

- Updated dependencies [7864f03]
- Updated dependencies [d229dfa]
- Updated dependencies [f5f8744]
- Updated dependencies [69becd2]
- Updated dependencies [5e52495]
- Updated dependencies [b750823]
- Updated dependencies [c2fd122]
- Updated dependencies [ac2139c]
- Updated dependencies [b14ab3a]
- Updated dependencies [8c60819]
- Updated dependencies [e64a52e]
- Updated dependencies [844d17f]
- Updated dependencies [48132f7]
- Updated dependencies [4dcd52a]
- Updated dependencies [42ae5c6]
- Updated dependencies [7e5bb5d]
- Updated dependencies [6d762da]
- Updated dependencies [e6fdbdc]
- Updated dependencies [f9faa7d]
- Updated dependencies [7e2b7e9]
- Updated dependencies [33526fd]
- Updated dependencies [32413ec]
- Updated dependencies [c1e1e6b]
  - @object-ui/i18n@17.4.0
  - @object-ui/types@17.4.0

## 17.3.0

### Patch Changes

- 65516ba: Name `CommentThread`'s three emoji-only buttons, and follow the session language past the 7-day mark (objectui#3441)

  Two leftovers from objectstack#5506 / objectui#3424, in the same component. It
  is an exported, published component with no in-repo consumer, so both only ever
  bite an external host.

  **One — three controls with no authored accessible name.** Each comment's two
  quick-reaction buttons (`'👍'` and `'❤️'`) and the reply banner's dismiss button
  (`'✕'`) carried no `aria-label` and no `title`. The `+` reaction picker right
  beside them has had one since #3424 (`collaboration.addThumbsUp`), which is what
  makes these three an omission rather than a design choice.

  `aria-label`, not the `title` the `+` uses: a `button`'s accessible name is
  computed from its CONTENT (accname §2F) before the `title` tooltip is ever
  consulted (§2I), so on a button whose only child is a glyph a `title` decorates
  the mouse and leaves the name alone. What a screen reader read out was the
  codepoint — "thumbs up", "red heart", in English whatever the session language,
  and for U+2715 MULTIPLICATION X very often nothing at all.

  Three new keys in all ten packs: `collaboration.reactThumbsUp`,
  `collaboration.reactHeart`, `collaboration.cancelReply`.

  `reactThumbsUp` is deliberately NOT a reuse of `addThumbsUp`, even though both
  dispatch the same `onReaction(id, '👍')` today. `addThumbsUp` names the reaction
  bar's picker entry point, whose copy follows the picker if it ever picks; and on
  any comment that already has reactions the two controls are on screen together,
  so one shared key would put two visibly different buttons under one name.
  `cancelReply` rather than the generic `common.cancel` for the same reason — an
  accessible name has to say what is being cancelled (only the reply target is
  dropped; anything typed into the composer survives).

  **Two — the >= 7 day timestamp ignored the session language.** `formatTimestamp`
  ended in a bare `date.toLocaleDateString()`, i.e. the RUNTIME's locale, so a
  `zh` session read "6 天前" for a six-day-old comment and `8/1/2026` for an
  eight-day-old one.

  The fix passes the session `language`, but not straight through — that is the
  trap #3424 flagged and declined to walk into. `toLocaleDateString(tag)`
  canonicalizes its argument and throws `RangeError` on anything not well-formed
  per BCP 47, and the session language reaches the component verbatim: a host that
  configures `defaultLanguage: 'en_US'` (the POSIX spelling — well-formed-looking,
  and rejected) hands `Intl` a tag it refuses. That `RangeError` would land in
  `formatTimestamp`'s outer `catch`, whose fallback is `return iso`, replacing the
  date with a raw `2026-08-01T09:30:00.000Z` — worse than the un-localized date it
  set out to fix.

  So the absolute-date branch gets its own local `try`/`catch` that falls back to
  the no-argument call. A malformed tag degrades to exactly the previous
  behaviour (the runtime's own locale); the worst case of following the session
  language is the status quo, never a regression. A well-formed but unknown tag
  such as `xx-YY` does not throw at all — `Intl` resolves it to the default — so
  only genuinely malformed tags reach the guard. No date library, and no month or
  weekday copy in the locale packs: `Intl` already owns the per-locale ordering
  and separators.

  Tests assert the computed accessible name via `getByRole('button', { name })`
  rather than the presence of an attribute, which is the distinction the fix turns
  on, and pin that no button is left answering to a bare emoji. The malformed-tag
  case is recorded honestly as green on both sides of this change — `origin/main`
  never passed a tag anywhere, so it could not trip over a bad one; its
  counterfactual is the naive fix, and dropping the inner `catch` is what turns it
  red with the raw ISO string in the DOM.

- 94c5b7c: Localize `@object-ui/collaboration` — `CommentThread` no longer hardcodes English (objectstack#5506)

  `@object-ui/collaboration` depended only on `@object-ui/types` and carried every
  user-visible string as an English literal, so a `zh` console rendered a Chinese
  shell around an English comment thread: "3 comments", "Reply", "Resolve",
  "just now", "Add a comment... (use @ to mention)".

  The package now takes `@object-ui/i18n` as a dependency and exposes one
  translation seam, `useCollaborationTranslation` /
  `COLLAB_DEFAULT_TRANSLATIONS`, built on `createSafeTranslation` — the same
  factory `data-table`, `form` and `filter-builder` use. Under an `I18nProvider`
  it resolves the session locale; with no provider it resolves the English
  defaults map, which is what keeps `CommentThread` usable standalone. There is
  deliberately no `formatter`/label prop escape hatch: a host that wants
  different copy overrides the locale keys, so one thread can never end up half
  translated by the bundle and half by props.

  The issue listed 13 sites. A site-by-site sweep of the file found **20** — the
  seven the original sweep missed are `{n}h ago`, `{n}d ago`, `(edited)`, the
  thread's own comment count, the `Oldest`/`Newest` sort options,
  `Replying to {name}...`, and the composer's `Send` button. All 20 are keyed
  here; leaving any behind would have shipped a thread that is 90% translated.

  Two of them carry a second defect on top of being untranslated: the plural
  **rule** was compiled into the component, not just the words.

  - the header read `` `${n} comment${n !== 1 ? 's' : ''}` ``;
  - the reaction chip tooltip read `` n === 1 ? '1 reaction' : `${n} reactions` ``.

  Both produced correct _English_ — this is not the "1 items" bug objectui#3423
  fixed on the tab badge — but the choice between the two forms was English
  grammar hardwired into the render path. No locale could apply its own: ru needs
  three forms and ja needs none, and neither could ever be expressed no matter
  what the packs said.

  Both now use the repo's **two-key** plural convention
  (`collaboration.commentCount`/`commentCountOne`,
  `collaboration.reactionCount`/`reactionCountOne`) rather than an i18next
  `_one`/`_other` pair: zh/ja/ko have no separate singular form, so those packs
  would legitimately omit the `_one` half and `all-locales-key-parity` reads a
  legitimately-absent half as a lost key. Counts are interpolated as strings, so
  i18next skips its own plural resolution and the two-key scheme stays in charge.

  The reaction tooltip gets a **dedicated** key pair rather than reusing
  `detail.reactionCount`: that one interpolates `{{emoji}}`, and at this call
  site the emoji is the chip's visible label with nothing to hand the
  placeholder — reuse would have left a literal `{{emoji}}` in the accessible
  name under every locale.

  Relative timestamps stayed word-level: the existing minute/hour/day buckets are
  untouched and no date library was introduced. The `>= 7d` branch still uses the
  runtime's own `toLocaleDateString()` — that is not a hardcoded English literal,
  and pinning it to the session language has its own failure mode (an
  unrecognised tag throws into the surrounding `catch`, which would render a raw
  ISO string), so it is tracked separately.

  `Save` / `Cancel` / `Edit` / `Delete` read from the shared `common` namespace
  instead of being re-spelled under `collaboration` — they are the generic action
  words, already translated in all ten packs, and a second spelling would only be
  a second thing to keep in sync. The 21 genuinely new keys are added to all ten
  locale packs with real translations.

- ca0fa8f: Localize `PresenceAvatars` — the avatar stack's accessible name and tooltips follow the session language (objectui#3440)

  objectui#3424 wired `@object-ui/collaboration` up to `@object-ui/i18n` but only
  converted `CommentThread`. `PresenceAvatars` in the same package kept three
  English literals, and it is not a dormant export — the console renders it in
  two places: `app-shell/src/layout/AppHeader.tsx` (tenant presence beside the
  lifecycle badge) and `app-shell/src/views/RecordDetailView.tsx` (who else is on
  this record). A `zh` session got them in English.

  The three sites:

  - the group's `aria-label`, `` `${n} user${n !== 1 ? 's' : ''} present` ``;
  - the overflow badge's tooltip, `` `${n} more user${n !== 1 ? 's' : ''}` ``;
  - each avatar's tooltip, `` `${name} (${status})` ``.

  The first one is the whole control as far as a screen reader is concerned: the
  stack renders images and initials and nothing else, so there was no other
  accessible name to fall back on.

  As with the comment count in #3424, the first two carried a second defect on
  top of being untranslated — the plural **rule** was compiled into the component.
  Both produced correct _English_ (each has a real singular branch, so this is
  not the "1 items" defect objectui#3423 fixed on the tab badge), but
  `n !== 1 ? 's' : ''` is English grammar in a render path and no locale could
  apply its own. Both now use the repo's **two-key** plural convention
  (`collaboration.presentUserCount`/`presentUserCountOne`,
  `collaboration.moreUserCount`/`moreUserCountOne`) rather than an i18next
  `_one`/`_other` pair, with the count interpolated as a string so i18next skips
  its own plural resolution. German is what witnesses the move: "1 anwesender
  Benutzer" vs "2 anwesende Benutzer" inflects the adjective, which the deleted
  ternary could not have produced for any pack.

  The avatar tooltip becomes a single `collaboration.userStatusTitle` key
  (`{{name}} ({{status}})`) so the parentheses and their spacing belong to the
  translation — the CJK packs drop the space English puts before `(`, matching
  their existing `edited: '(已编辑)'`.

  Its `status` is a **display-layer** translation
  (`collaboration.statusActive` / `statusIdle` / `statusAway`): the
  `PresenceUser['status']` enum value stays raw data everywhere it is stored,
  compared or passed around — including the `statusColors` lookup — and is
  translated only at this render exit. A status outside the declared union
  renders as itself, the raw string: presence users arrive from a host-supplied
  `PresenceSource` transport, so an unmapped value is reachable at runtime
  whatever the type says, and the fallback invents nothing rather than leaving an
  empty bracket pair.

  Eight new keys, added to all ten locale packs with real translations.

- d0d71df: Give `CommentThread`'s `+` reaction picker a real accessible name (objectui#3478)

  The fourth glyph-only control in the same component, and the one objectui#3441
  walked past. Its content is the literal `'+'`, so the `title` objectstack#5506
  gave it (`collaboration.addThumbsUp`) could never become its accessible name: a
  `button`'s name is computed from CONTENT (accname §2F) before the `title`
  tooltip is consulted at all (§2I). A screen reader announced "plus button". The
  copy existed, was localized into all ten packs, and reached only the people who
  could already see the button.

  That is a different failure from #3441's three buttons, which is why it survived
  that fix — those had no authored copy anywhere, so every "is the key wired up?"
  check found the gap. Here the key WAS wired up and the English WAS in
  `COLLAB_DEFAULT_TRANSLATIONS`; only its DESTINATION was wrong. #3441's own pin
  test recorded the defect without naming it, asserting `getByTitle('Add thumbs
up')` and `queryAllByRole('button', { name: 'Add thumbs up' })).toHaveLength(0)`
  in the same green case — two assertions that together say "the title is set and
  it is not the name". The docblock read them as pinning the picker apart from the
  quick 👍; they were also, unread, the bug report.

  The fix adds `aria-label` (accname §2C, which outranks content) alongside the
  existing `title`, on the same key. Zero new keys — the copy was always there.

  The `title` is KEPT rather than replaced, and this is the one control in the
  component where carrying both is right instead of redundant: `+` says nothing to
  a sighted mouse user either, so the hover hint is doing real work of its own.
  (The 👍/❤️ buttons #3441 fixed had no `title` to keep.) Both attributes read the
  same key, so the tooltip and the name cannot drift apart.

  The name stays `addThumbsUp` — it describes what the button does today
  (`onReaction(id, '👍')`, unconditionally), not what `styles.reactionPicker`
  hints it might become. Turning it into an actual emoji picker is a feature
  change, and the copy follows the behaviour when that lands. It also stays
  distinct from #3441's `reactThumbsUp`: on a comment that already has reactions
  both controls are on screen at once, and now that both carry a real accessible
  name, sharing one key would be worse than when #3441 declined to — two visibly
  different buttons announcing themselves identically.

  The adjacent reaction chips are deliberately untouched. Their content is
  `${emoji} ${count}` — already a descriptive name — so name-from-content is the
  right answer there, and their `title` adds the count in words.

  Tests assert the computed accessible name via `getByRole('button', { name })`
  rather than the presence of an attribute, in English, Chinese and with no
  `I18nProvider` mounted; the mirror assertion (`{ name: '+' }` finds nothing) is
  what fails if the `aria-label` is ever dropped. #3441's pin was rewritten in
  place to pin the new both-named state instead of the old separation, since the
  statement it used to make is exactly the one this change falsifies.

- Updated dependencies [d915c47]
- Updated dependencies [b71fc92]
- Updated dependencies [65516ba]
- Updated dependencies [94c5b7c]
- Updated dependencies [ca0fa8f]
- Updated dependencies [3889ffb]
- Updated dependencies [7e2406a]
- Updated dependencies [9e9e9a9]
- Updated dependencies [4eeb932]
- Updated dependencies [5c856ec]
- Updated dependencies [23018cc]
- Updated dependencies [68b6a28]
- Updated dependencies [0554e88]
- Updated dependencies [f44d872]
- Updated dependencies [28b2e65]
- Updated dependencies [825bbe3]
- Updated dependencies [6195841]
- Updated dependencies [5dd0127]
- Updated dependencies [a415684]
- Updated dependencies [5af2852]
- Updated dependencies [f833d3a]
- Updated dependencies [a6ec93d]
- Updated dependencies [d22ae31]
- Updated dependencies [c7ed4c3]
- Updated dependencies [2409e1d]
- Updated dependencies [789fe3e]
  - @object-ui/types@17.3.0
  - @object-ui/i18n@17.3.0

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

- Updated dependencies [4ae0ac4]
- Updated dependencies [696e3c1]
- Updated dependencies [4bf612c]
- Updated dependencies [cb82705]
- Updated dependencies [f572849]
- Updated dependencies [444457c]
- Updated dependencies [022e4c3]
- Updated dependencies [009e25d]
- Updated dependencies [726b89c]
  - @object-ui/types@17.2.0

## 17.1.0

### Patch Changes

- Updated dependencies [9e7349e]
- Updated dependencies [8864971]
- Updated dependencies [b41f401]
- Updated dependencies [19e9fa0]
- Updated dependencies [38ca8be]
- Updated dependencies [4952edf]
- Updated dependencies [7f0252e]
- Updated dependencies [7639a61]
- Updated dependencies [94e63ef]
- Updated dependencies [c4db402]
- Updated dependencies [5319bf1]
- Updated dependencies [49e5671]
- Updated dependencies [b5b97e2]
- Updated dependencies [f59f2c1]
- Updated dependencies [4874117]
- Updated dependencies [ce08d55]
- Updated dependencies [2374a49]
- Updated dependencies [ea7f477]
- Updated dependencies [7f23cd0]
- Updated dependencies [24e0e0a]
- Updated dependencies [3a6cf24]
- Updated dependencies [aa35561]
- Updated dependencies [03bd53b]
- Updated dependencies [3c1f321]
- Updated dependencies [a045a32]
- Updated dependencies [912496d]
- Updated dependencies [9867281]
  - @object-ui/types@17.1.0

## 17.0.0

### Patch Changes

- Updated dependencies [1767124]
- Updated dependencies [8ecf5a6]
- Updated dependencies [dfd3705]
- Updated dependencies [6dee2cb]
- Updated dependencies [c7cff19]
- Updated dependencies [cd09a7b]
- Updated dependencies [f1abf0e]
- Updated dependencies [f05b84e]
- Updated dependencies [662bdf9]
- Updated dependencies [059a052]
- Updated dependencies [53642d4]
- Updated dependencies [8aae006]
- Updated dependencies [d147a13]
  - @object-ui/types@17.0.0

## 16.1.0

### Patch Changes

- ebe6494: chore(lint): clear the baseline lint errors in nine more packages (objectui#2713 Wave 2)

  Second wave of the #2713 lint-gate restoration (after #2730). These nine package
  lints were red at baseline on `main`, so their per-package `lint` gate could not
  catch new violations. Cleared every **error** (no behavior change; warnings out
  of scope):

  - **`react-hooks/rules-of-hooks`** (`i18n`, `plugin-grid`, `plugin-view`,
    `plugin-list`) — translation helpers (`useSafeFieldLabel`,
    `useRowActionTranslation`, `useViewLabel`, `useViewTabLabel`, `useMoreLabel`)
    wrapped a provider-safe hook (`useObjectTranslation`/`useObjectLabel`, which
    never throw) in try/catch; removed the wrapper (the same fix #2709 applied in
    fields). `plugin-kanban` `ObjectKanban` moved its `if (error)` early return
    below the `useCallback` so hooks run unconditionally. `collaboration`
    `__unsafe_usePresenceContext` keeps its deliberate danger-prefix name via a
    justified scoped disable.
  - **`react-hooks/static-components`** (`layout`, `plugin-list`, `plugin-report`)
    — dynamic-icon / registry lookups (`resolveIcon`, `useRegistryComponent`) are
    stable component references, not components created during render → scoped
    disable with justification. `plugin-charts` `TreemapCell` was a _genuine_
    inline component and is hoisted to module scope (it is purely props-driven).
  - **`no-irregular-whitespace`** (`plugin-grid` `ImportWizard`) — the literal
    U+FEFF BOM prepended to exported CSV/text blobs (so Excel detects UTF-8) is
    now written as the `﻿` escape: byte-identical at runtime, no literal
    irregular-whitespace character in source.
  - **`no-useless-assignment`** (`plugin-grid` `BulkActionDialog`) — dropped a
    dead `= null` initializer that the exhaustive `switch` (incl. `default`)
    overwrites before it is read.
  - **`no-unsafe-function-type`** (`plugin-view` `ViewTabBar`) — the dnd-kit
    render-prop `listeners` map is typed `Record<string, (...args: any[]) => void>`
    instead of bare `Function`.
  - **`no-require-imports`** (`plugin-kanban`, `plugin-view` tests) — hoisted
    `vi.mock` factories use an `async` factory with `await import('react')`.

- Updated dependencies [7cf4051]
- Updated dependencies [94d4876]
- Updated dependencies [2b17339]
- Updated dependencies [31b77d4]
- Updated dependencies [6d4fbe6]
- Updated dependencies [62b9ab5]
- Updated dependencies [29c6040]
- Updated dependencies [faebac3]
- Updated dependencies [199fa83]
  - @object-ui/types@16.1.0

## 16.0.0

### Patch Changes

- Updated dependencies [210806a]
- Updated dependencies [b4ef588]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
  - @object-ui/types@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0

## 14.1.0

### Patch Changes

- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [887062c]
- Updated dependencies [9e2d58f]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f0f10f5]
  - @object-ui/types@14.1.0

## 14.0.0

### Patch Changes

- Updated dependencies [86c69c3]
- Updated dependencies [6a74160]
  - @object-ui/types@14.0.0

## 13.2.0

### Patch Changes

- @object-ui/types@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [619097e]
  - @object-ui/types@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [c31874d]
  - @object-ui/types@12.1.0

## 12.0.0

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0

## 11.5.0

### Patch Changes

- Updated dependencies [9255686]
- Updated dependencies [1072701]
  - @object-ui/types@11.5.0

## 11.4.0

### Patch Changes

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [c38d107]
  - @object-ui/types@11.4.0

## 11.3.0

### Patch Changes

- @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- @object-ui/types@11.2.0

## 11.1.0

### Patch Changes

- @object-ui/types@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/types@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [d23db5c]
  - @object-ui/types@7.2.0

## 7.1.0

### Patch Changes

- Updated dependencies [677f7ed]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0

## 7.0.0

### Patch Changes

- Updated dependencies [ddbe4a2]
- Updated dependencies [9049bbe]
- Updated dependencies [cb2fdb1]
- Updated dependencies [6cfa330]
- Updated dependencies [ad8ade6]
- Updated dependencies [3870c20]
- Updated dependencies [b88c560]
- Updated dependencies [d16566f]
- Updated dependencies [300d755]
- Updated dependencies [4eb9cb6]
- Updated dependencies [858ad94]
  - @object-ui/types@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3

## 6.2.2

### Patch Changes

- @object-ui/types@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1

## 6.2.0

### Patch Changes

- @object-ui/types@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/types@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1

## 6.0.0

### Patch Changes

- @object-ui/types@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1

## 5.4.0

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1

## 5.2.0

### Minor Changes

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

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [70b5570]
  - @object-ui/types@5.2.0

## 5.1.1

### Patch Changes

- @object-ui/types@5.1.1

## 5.1.0

### Patch Changes

- Updated dependencies [cf30cc2]
- Updated dependencies [5b80cfd]
  - @object-ui/types@5.1.0

## 5.0.2

### Patch Changes

- @object-ui/types@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1

## 5.0.0

### Patch Changes

- Updated dependencies [7213027]
  - @object-ui/types@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0

## 4.6.0

### Patch Changes

- @object-ui/types@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [ab5e281]
  - @object-ui/types@4.5.0

## 4.4.0

### Patch Changes

- @object-ui/types@4.4.0

## 4.3.1

### Patch Changes

- @object-ui/types@4.3.1

## 4.3.0

### Patch Changes

- @object-ui/types@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/types@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/types@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/types@4.0.8

## 4.0.7

### Patch Changes

- @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

- @object-ui/types@4.0.6

## 4.0.5

### Patch Changes

- @object-ui/types@4.0.5

## 4.0.4

### Patch Changes

- @object-ui/types@4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

- Updated dependencies [4be43e2]
  - @object-ui/types@4.0.3

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/types@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2

## 3.3.1

### Patch Changes

- @object-ui/types@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0

## 3.1.5

### Patch Changes

- @object-ui/types@3.1.5

## 3.1.4

### Patch Changes

- @object-ui/types@3.1.4

## 3.1.3

### Patch Changes

- @object-ui/types@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1

## 3.0.3

### Patch Changes

- @object-ui/types@3.0.3

## 3.0.2

### Patch Changes

- @object-ui/types@3.0.2

## 3.0.1

### Patch Changes

- @object-ui/types@3.0.1

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
