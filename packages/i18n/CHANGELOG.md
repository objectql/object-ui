# @object-ui/i18n

## 17.5.0

### Minor Changes

- 0e67b53: `/accept-invitation/:invitationId` is one route, one component, one namespace — the console now renders the invitation page that actually shows you the invitation

  Two components shipped for this single URL. The console routed its own thin page, which offered nothing but an Accept and a Decline button: it never told the user which organization they had been invited to, in what role, or when the link expires, and accepting left them in whatever organization they were already in. App-shell's page — exported as `DefaultAcceptInvitationPage`, routed by nobody — fetches the invitation, shows the organization, the role and the expiry date, and switches the user into that organization on accept. Console now routes that one. The thin page is deleted.

  Behind them sat two i18n namespaces for one screen: `acceptInvitation.*` (12 keys) for the thin page and `organization.accept.*` (14) for the richer one, both freshly translated into ten languages by different slices of objectui#3546, neither wrong when read on its own. That is 26 keys of duplicated copy with no gate to tell the next author which of the two to edit — the failure mode this repo already has an uncollected precedent for. `acceptInvitation.*` is removed from all ten packs, and its absence is pinned negatively so it cannot drift back: the slice-three test now asserts that no pack defines any of the 12 retired keys (nor an emptied namespace root left by a partial revert), and that neither consuming package asks `t()` for one.

  One behavior needed repairing before the swap was safe rather than after. `?redirect=` is a basename-stripped path by contract in this console — `LoginPage` re-prefixes it with the mount before navigating — and the thin page built it from the route param, correctly. App-shell's page built it from `window.location.pathname`, which already carries the mount, so a console served under a `<base href="/console/">` would have sent the user back to `/console/console/accept-invitation/…` after signing in. It now reads the router (`useLocation`), like every other producer of that parameter in this repo. Under the default `/` mount the two spellings are identical, which is why only a basename case can see the difference; that case is now a test.

  Nothing published was removed: `DefaultAcceptInvitationPage` keeps its export and simply becomes the routed implementation. Downstream apps mounting it get the redirect fix and are otherwise untouched.

- ae10a01: Console chrome reaches the bundle — the list switcher, the aggregate footer, the dialog a11y fallbacks and the whole Settings namespace screen stop being English on non-English consoles

  Six strings on the two screens a user looks at most were hardcoded English literals rather than bundle lookups, so they stayed English on every non-English console with nothing an app could author to change them. They are not object, field, view or action labels — no key in `TranslationData` reaches them — while the console's own bundle already ships zh-CN, ja-JP, es-ES, de, fr, pt, ru, ko and ar and translates hundreds of neighbouring strings. Omissions from an otherwise complete bundle, not a missing capability.

  **Two of the six needed no new keys at all, which is the more interesting half.** The list-view mode switcher named its nine visualizations from a private `VIEW_LABELS` table while `console.objectView.viewType*` — the same nine words — had been resolved through the bundle by the create-view picker for months; the switcher now reads those keys, so the picker's 「画廊」 and the switcher's 「画廊」 cannot drift apart in nine languages. The create/edit dialog's close button is the remainder of a fix that already landed: objectstack#5505 routed the `sr-only` close label through `common.close` for the two Shadcn-synced primitives, but `MobileDialogContent` is a hand-written wrapper outside that regeneration zone with its own close button, and it is exactly what `ModalForm` renders — so the dialog the report measured was the one place still announcing "Close" in English.

  The aggregate footer is the one the original report singled out: the **number** was already locale-formatted and the **prefix** was a hardcoded `Avg: ` / `Sum: `. All eleven aggregation kinds now take their prefix from `grid.summary.*`, and the label/value join is its own key rather than a `': '` baked into the renderer — the separator is translatable content, so zh sets a fullwidth colon and fr the French space-before-colon. The numbers are untouched. The form dialog's `sr-only` description fallback joins the packs too; it is clipped, not visible, so the only way an app could displace it was to author a `description` and thereby put a visible subtitle on every dialog.

  **The Settings namespace screen converts as one unit.** `SettingsView` routed zero framing copy through i18n — save/failure toasts, the env-lock and crypto refusals, the load-error card, the empty-route state, the navigation buttons, the unsaved-changes save bar — while its immediate sibling `SettingsHub`, in the same directory, resolved everything through `t('console.settingsHub.*')`. A zh-CN admin read correctly translated field labels sitting inside an English save bar, because `useSettingsLabel` translates a namespace's authored content but reaches none of the chrome around it. All of it now resolves through a `console.settingsView.*` namespace placed beside the hub's, including the crypto-refusal strings that objectui#4579 deliberately left in English rather than leave one translated string among a dozen literals.

  The save-bar counter was an English plural rule executing in every locale (`change` plus an `s` when the count exceeds one). It is now a real i18next plural family — base key plus `_one` and `_other` in all ten packs — not the `(s)` spelling translated nine ways. The base key is the load-bearing part: i18next asks `Intl.PluralRules` for the one suffix a language needs and, finding no such slot, falls back to English, so without it Russian would read English at counts 2-20 and Arabic at 2-99. Russian and Arabic take the "noun: {count}" form their packs already use for this exact reason, and the counter is verified rendering in-language at 1, 2 and 5.

  The Beta badge reuses the hub's existing key rather than minting a twin, and the refusal messages interpolate their subject through the bundle instead of concatenating a translated word onto an English prefix.

- 66fb4fa: The console's language menu now asks the app which locales it actually ships, instead of always offering the same ten.

  `LocaleSwitcher` built its items from a module-level `LANGUAGES` constant — exactly the ten codes `@object-ui/i18n` ships packs for — and never consulted the app, even though `GET /api/v1/i18n/locales` has been serving that list all along. It failed in both directions at once. An app shipping a locale outside those ten (`th`, a regional `pt-BR`) had no way to be selected from the console: the bundle could be complete and lint clean, and the menu simply had no entry for it. An app shipping only `en` and `zh` still listed all ten, so picking 日本語 handed the user the console's own chrome in Japanese with everything app-authored in the fallback language — a half-translated UI its author never opted into.

  The menu is now the **intersection**: the app's own locale list ∩ what the renderer can actually resolve (built-in packs, `config.resources`, and — for an app that wires a dynamic `loadLanguage` loader, which is how the console gets its packs — the locales that loader can fetch). Both failure directions close in the same change: an app-shipped locale becomes offerable, and locales the app does not ship disappear. The endpoint is reached through a new `loadLocales` prop on `I18nProvider`, wired exactly like the existing `loadLanguage`: the app owns the transport, the provider owns what is done with the answer. An app that does not wire it keeps today's menu unchanged.

  **The restore validation widened in lockstep, because otherwise this fix would have minted the next bug.** A restored language was validated against "the locales this provider can produce" — built-in packs plus `config.resources` — a bound that was correct only for as long as the menu offered exactly the built-in ten. The moment the menu grows to the app's real list, a locale the user can now pick is a locale that bound rejects, so a user-picked app locale would have been purged on the next page load. It now also accepts a locale a wired dynamic loader may be able to fetch, and the bound stays honest rather than absent: only well-formed BCP-47 tags qualify (`constructor`, `__proto__`, `en_US` are still rejected, as is any stored locale in an app with no loader), and the app's own locale list adjudicates the choice for real once it arrives — a locale the app has since dropped is reverted and purged rather than left locking the UI to a language with no translations.

  Labels come from the built-in native names where they exist (`中文`, `日本語`, … are unchanged) and from `Intl.DisplayNames` for everything else, so an app locale is named in its own language rather than by its code. The endpoint's own `label` is deliberately not used for display: the server sets it to the code echoed back, which would have put `th` in the menu where `ไทย` belongs.

  While the app's list is in flight the switcher renders nothing, following the sibling menus in the same folder — the ten never flash past on an app that only ships two. When there is no backend, the endpoint fails, or the app answers with nothing this renderer can produce, the built-in ten remain as the offline fallback, so the menu is never empty and never unusable.

- 92250d6: One home for the number-display policy — and a percent stops meaning two different things between a list cell and a dashboard measure

  `formatDisplayNumber`, `shouldGroupDisplayNumber` and `DisplayNumberFormatOptions` move from `@object-ui/i18n` into `@object-ui/core`. `@object-ui/i18n` re-exports all three under the same names, so every existing import path keeps working unchanged and both spellings resolve to the same function object; nothing published was removed.

  The move is what fixes the bug. `@object-ui/core`'s `formatMeasure` needed exactly this policy and could not import it — `core` is the React-free engine and is a runtime dependency of React-free consumers (the `object-ui` VS Code extension, `@object-ui/data-objectstack`), while `i18n` depends on `i18next`/`react-i18next` and peer-depends on React. So `formatMeasure` carried a parallel `Intl` implementation, recorded at both ends as deliberate duplication, and the two drifted in the one place a hand-built string and `Intl` disagree. A German session read `1.234,5 %` from a list cell and `1.234,5%` from a dashboard measure showing the same number. The function is pure, so the boundary was never a property of the code — only of where the code sat; moving it down removes the obstacle instead of working around it. `core` imports nothing from `i18n`, so the new edge adds no cycle.

  **Behaviour change — a measure's percent sign now follows the locale.** `formatMeasure` appended a literal `%` in every locale; it now renders the locale's own percent convention, the same one the list-cell `formatPercent` has used since the fix to its own machine-locale defect. Measured to change output in de, fr, es, ru, sv, cs, fi (a no-break space appears before the sign), tr (the sign moves to the FRONT: `%1.234,5`) and ar (its own percent sign plus U+061C). English, Japanese and Chinese are byte-identical — their convention is a bare trailing sign — which is why this was invisible in an English session.

  **No numeral moves, in any locale, at any magnitude.** The obvious route to the locale's convention is `Intl`'s `style: 'percent'`, but that style expects a fraction, so a value already in percentage points would have to be divided by 100 for `Intl` to multiply it straight back — and that round trip is lossy. Measured, it moves 27,581 of 1,200,013 ordinary-magnitude en-US forms at rounding ties (`0.175` at two decimals becomes `0.17%` instead of `0.18%`), plus `MAX_SAFE_INTEGER` and everything from 1e23 up, where `100,000,000,000,000,000,000,000%` becomes `99,999,999,999,999,990,000,000%`. The percentage points are formatted directly instead, through a new `style: 'percentPoints'` on `DisplayNumberFormatOptions`; that route was measured to produce a byte-identical percent affix to `style: 'percent'` across all 171 locale tags tested while moving none of those 1,200,013 forms. Callers holding a fraction keep using `style: 'percent'`, whose behaviour is unchanged — naming the two cases apart is what stops the next caller from reaching for the lossy one.

  `@object-ui/i18n`'s entry declaration is byte-identical, but the declaration it points at now lives in `@object-ui/core` and the package gains that dependency, so it takes the same minor bump rather than a patch.

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

- fa51109: i18n: retire the orphaned `report.editor.*` namespace — 105 of its 106 keys, in all ten locale packs (~1050 translated strings)

  The namespace labelled the hand-rolled report editor form. That form no longer
  exists: `ReportConfigPanel`'s body is `ReportDefaultInspector`, a spec-driven
  inspector whose labels come from the report spec's own metadata rather than from
  a pack namespace. Until objectui#4137 the namespace had exactly one live reader,
  and it was the objectui#4118 defect itself — the panel borrowing
  `report.editor.title` (the label of the report's Title _field_) to name itself.
  Moving that slot onto a purpose-built `report.editor.panelTitle` left the other
  105 keys with no reader anywhere.

  Re-verified before deleting, repo-wide and per key: no `t()` call site, no
  dynamic `t()` template form, and no JSON or MDX reference reads any of the 105.
  No user-visible string changes — these keys never rendered.

  `report.editor.panelTitle` survives in all ten packs and is untouched; the
  deletion sweeps around it. `report.editor` therefore remains a live namespace
  holding exactly that one key.

  This narrows the exported `TranslationKeys` type (`typeof en`), which is why it
  is a minor rather than a patch: code indexing `TranslationKeys` at a retired key
  stops type-checking. No runtime consumer existed to break.

  A negative pin (`packages/i18n/src/__tests__/report-editor-retired-4145.test.ts`)
  names all 105 retired keys and fails if any returns to any pack, since every
  existing i18n gate runs call site to key and none of them can see a key with no
  call site.

- 78fa331: console: seed the UI language from the tenant's server-side locale

  `GET /auth/me/localization` has always been fetched on every boot, but its
  `locale` only ever fed currency/date formatting — the UI language was decided
  entirely client-side, so a tenant configured `zh-CN` still handed every new
  device an English console until each user switched by hand.

  The tenant locale now sits in the language precedence chain, between the user's
  own choice and the browser's:

  1. the user's explicit choice (`objectui-locale`)
  2. the tenant's server locale, cached at `objectui-locale-seed`
  3. the browser language
  4. `en`

  The server value is cached in a slot of its own and is never written into the
  explicit-choice slot, so it can never masquerade as a preference the user
  expressed: only a manual switch promotes a language to an explicit choice. A
  cached seed applies synchronously at bootstrap, and the in-app fetch refreshes
  that cache from every successful answer, so a tenant that changes its locale
  reaches choice-less devices on their next boot without an old seed pinning
  them. On a device's true first visit the fetch is raced against a ~500ms
  timeout alongside the console's existing pre-mount round-trips and fails open
  to the browser language; a seed that arrives after the bound is cached for the
  next boot rather than re-languaging a live session. A tenant locale this build
  ships no pack for falls through to the next tier instead of half-rendering.

  No platform additions: no new endpoint, no client read/write API, and
  `sys_user_preference` is untouched.

- 0082db8: The timeline's gantt bucket labels and its row-label default speak the session language

  objectui#4513 routed every `Intl` call in the timeline renderer through `useDisplayLocale()`, so a Chinese session renders `2026年8月` on the month axis and `2026年8月11日` on item dates. Three sibling strings in the same renderer never went through `Intl` at all and stayed English on that same Chinese axis: the `week` header (`Week 1`), the `quarter` header (`Q3 2026`), and the gantt row-label column default (`Items`). The half-fixed state was the visible one — a Chinese date axis with English bucket labels beside it.

  They are a translation concern rather than a locale-resolver one, and that distinction is the fix: a locale TAG formats a date, only a TRANSLATION spells a word. All three now resolve through the package's existing channel — `useTimelineTranslation` / `TIMELINE_DEFAULT_TRANSLATIONS`, the `createSafeTranslation` factory `ObjectTimeline` already uses for `timeline.bucket.*` — under three new keys carried by all ten locale packs: `timeline.scale.week`, `timeline.scale.quarter`, `timeline.gantt.rowLabel`.

  The week number and the quarter/year ride the channel's own `{{hole}}` parameters rather than being concatenated, because the word order belongs to the translation: Chinese puts the year first (`2026年第3季度`), which no `Q${q} ${year}` template can produce at all. Only the row-label DEFAULT moved — an author who writes `rowLabel` still supplies their own string, and the `year` scale stays a bare `String(getFullYear())` with no vocabulary in it to translate.

  English output is byte-identical to the retired literals: the `en` pack values are the same two templates the code used to interpolate by hand. `generateTimeScaleHeaders` is a pure exported function and cannot host a hook, so the translate fn is threaded in as an optional fifth parameter on the seam #4513 opened for `locale`, defaulting to the package's own defaults table — the same lookup the channel serves with no `I18nProvider` mounted. Existing three- and four-argument call sites are unaffected.

  One consequence is worth stating because it looks like a bug and is not: dates and vocabulary resolve through different channels on purpose. `useDisplayLocale()` puts the tenant's regional default first (how this organization writes dates), while `t` follows the UI language (what this user reads). A tenant configured `en` whose user reads Chinese chrome therefore sees `Aug 2026` beside `第 1 周` — the same split `timeline.bucket.*` has always had.

### Patch Changes

- 932cbcd: An app you are not allowed to open now says so, instead of reporting that it may still be publishing

  `GET /api/v1/meta/apps` is filtered per session server-side (`filterAppForUser`), so an app withheld by its `requiredPermissions` and an app that does not exist were byte-identical to the console: both simply absent from the list. With one fact and two conditions, `AppContent` rendered its only copy for an absent app — "This app is not available yet — it may still be publishing. Try again in a moment." — over a permanent authorization decision, under a Retry button that could never succeed.

  That is not a cosmetic complaint. On a downstream acceptance round one role hit this screen while another opened the same app fine, and because the copy names a transient deployment state the finding was filed as a suspected platform defect and carried through two test batches before a clean-baseline investigation found the account was missing a permission-set binding. The gate had been working exactly as designed; the message is what sent everyone to the wrong place.

  The maintainer ruling (2026-08-12) took the contract half first. objectstack#8013 made the BY-NAME route answer an explicit denial — `403` with the ADR-0112 catalog code `PERMISSION_DENIED` in the declared `{ success: false, error: { code, message } }` envelope — for an app that exists and whose `requiredPermissions` the session lacks, while the LIST route stays filtered exactly as before, with no `authorized: false` flag, so the enumeration surface is not widened past what a direct by-name probe already implies. Absence keeps answering `404 RESOURCE_NOT_FOUND`, and so do the two neighbouring refusals the same ruling deliberately left alone: an unpublished app (ADR-0045 §3 keeps it externally unobservable) and an app gated by an absent optional service (ADR-0057 D10 — nothing was denied to the caller).

  This is the console half. When a requested app is missing from the list and the existing post-publish readiness re-check still cannot find it, the console asks the by-name route which of the two it is, through a new `ObjectStackAdapter.probeAppAccess(name)`. On the measured code it renders a plain authorization message with a way back to the launcher; on anything else — an absent app, an unreachable server, a host that injected a DataSource without the probe — today's publishing copy renders byte for byte, retry button included.

  Two properties of that seam are load-bearing rather than incidental. It branches on the ADR-0112 **code**, never the status (objectui#4408): the two answers under test are both errors one status apart, and a status-reading implementation passes the happy path while going blind exactly where the defect lives. And only `denied` moves the copy: this bug exists because the console asserted a state it had not measured, so a probe that fails, times out or cannot be issued must leave the screen alone rather than guess in the other direction.

  `probeAppAccess` is deliberately separate from `getApp` rather than a flag on it: `getApp` degrades every failure to `null` — the very conflation being undone — and memoises in the adapter's metadata cache, where a verdict about the CALLER would outlive the session it described. New public API on the adapter (`probeAppAccess`, `isAppPermissionDeniedError`, `APP_PERMISSION_DENIED_CODE`, `AppAccessVerdict`), purely additive; nothing existing changed shape. Three new `empty.*` keys ship in all ten locale packs.

- 734d186: The console's Applications page is localized — its own chrome only, never the
  server's words (objectui#4307).

  `AppManagementPage` was raw English end to end: headings, the search field, the
  selection and bulk controls, the six per-row actions with their tooltip/ARIA
  pairs, the status badges, and every toast. It was the last un-i18n'd system page,
  and #4233 / PR #4300 had just given it four live mutations — so the gap became
  user-visible on every non-English console at the moment operators started using
  it. 45 keys land under `appManagement.*` in all ten packs, reached through
  `useObjectTranslation` with the call site's `defaultValue` inline, which is the
  convention the neighbouring system pages already follow.

  The split that shapes this change is between the strings the PAGE authors and
  the strings the SERVER authors. `PUT`/`DELETE /api/v1/meta/app/:name` is gated on
  `manage_metadata` (ADR-0066 D1), so a refusal like `forbidden: manage_metadata
required` is the server's diagnosis of one specific request; there is no fixed
  catalogue of those sentences to key against. Each failure toast is therefore a
  keyed template with a `{{reason}}` hole, and what fills the hole is passed
  through byte for byte, untranslated. The one part that IS the page's own — what
  it says when the server sent no message at all — is keyed as
  `appManagement.toast.unknownError`.

  Two smaller things follow from doing the conversion properly rather than
  mechanically. The per-failure entry of a bulk toast and the separator between
  entries are keys, not literals, because bracket style and list punctuation are
  locale properties (the same rule, and the same past defect, as
  `validation.formInvalidJoiner`). And the row's controls now name an app through
  the resolver the visible heading two lines away already used, with `t` passed:
  an app carrying objectui's keyed label form previously rendered `Select [object
Object]` into its checkbox's ARIA label.

- 3fc2971: A null-keyed group renders as an explicit bucket instead of silently vanishing from a chart (objectui#4466)

  `buildChartSeries`' single-dimension branch passed rows through verbatim, so a row whose category VALUE is `null` reached recharts with a null category and drew no mark. The visible outcome was not an empty chart but a quietly wrong one: rows `[{user_id: null, event_count: 51}, {user_id: 'Dev Admin', event_count: 2}]` drew exactly ONE bar — the dominant group, 51 of 53 events, dropped while the y-axis scale still accommodated it, so the chart understated its own data and the axis proved the data had been there. With every group null it drew axes, gridlines and an axis title with zero marks and no empty state, which is the shipped first-boot state of the built-in System Overview board's "Events by User" (every seeded `sys_audit_log` row is written with `user_id = NULL`).

  The mapping lives in the shared series layer, so dashboard widgets and standalone `ObjectChart` get one answer rather than a per-chart patch in the recharts wrapper. It resolves the two-answers disagreement the card names as well: an empty result set keeps the designed empty state, a non-empty result always draws bars — the null bucket included.

  `@object-ui/core` gains `NULL_CATEGORY_LABEL` and `ChartSeriesOptions`; `buildChartSeries` and `findChartSeriesRow` each take an optional trailing `options`. Both additive — every existing call site compiles and behaves identically, and a result with no null category is still returned by array identity. The two helpers are a pair on purpose: the caller matches a clicked segment against rows that still carry the raw `null`, so `findChartSeriesRow` reads the bucket label back to that row and the newly-visible bar keeps its drill-through instead of resolving to `-1`.

  The label goes through the i18n channel (`chart.nullCategory`, en `(None)` / zh `(未指定)`, all ten packs), passed down by the renderer: `@object-ui/core` is React-free and cannot read the locale bundle, so it takes the resolved string the same way `dimensionOptionTranslator` takes a resolver. Its English constant is the floor for a provider-less host, not the mechanism.

  `hasNoCategoryKey` (framework#4033) is untouched and now documented against this: a row that does not carry the category key AT ALL is a different defect — a dimension grouped by but never projected — and keeps its explanatory placeholder. The bucket deliberately never ADDS the key to such a row, which is what keeps that guard's signal alive. Key absent → the placeholder; key present with a null value → the bucket.

- f7c6430: The build-history panel tells an operator a 503 means "the commit store could not be reached — retry", instead of `commits HTTP 503`

  `packages/app-shell/src/preview/commitHistory.ts` flattened every non-OK response to a bare status code (`commits HTTP {status}` for the read, `HTTP {status}` for the revert). Nothing was ever swallowed and no fictional "no history" was ever rendered — those fail-loud properties held, and still hold, which is why objectstack#5980's 503-ification (ADR-0110 D3) needed no follow-up here. What was lost is the meaning the backend already sends, on the one screen where it matters most: this is the rollback surface, read by an operator who is usually mid-incident. A 503 says the read/write did not happen and is worth retrying; a 404 says the store answered "no". They now read differently, and 404, 500 and 503 stay tellable apart.

  Failures now throw a `CommitStoreError` carrying `status`, the ADR-0112 `code`, and a `retryable` flag, and the panel renders a sentence rather than a number. The revert half gets a deliberately different sentence: a write that could not reach the store may still have landed, and re-issuing it appends a _second_ revert commit to an append-only log, so the copy asks the operator to re-read the timeline before retrying rather than simply saying "try again".

  Two details of the report this fixes were checked against the producer and came back different, and both are the reason the copy is authored client-side. The semantic code arrives at **`error.code`**, not `details.code` — `HttpDispatcher.errorFromThrown` parks it in `details` and `buildApiError`/`splitSemanticCode` lift it out and drop `details` (objectstack#3842) — so a consumer reading `details.code` would run a check that can only pass vacuously. And the envelope's own `message` for this class is _withheld_: `declaresServerFault` (objectstack#5811) is true for a 5xx carrying a string code, so the prose on the wire is the generic `Internal server error`. Rendering it would have been strictly worse than the bare status code it replaced. Classification therefore keys on the HTTP status first and treats the code as a second signal, which also means a 503 shed by a proxy with an HTML body still produces the retryable reading.

  Adds `preview.history.loadFailedUnavailable` and `preview.history.revertUnavailable` to all ten locale packs.

- 92876f0: Doc comments no longer cite `@objectstack/spec` symbols the pinned spec has retired

  Eight exported declarations carried a doc comment claiming alignment with a
  `@objectstack/spec` symbol that `17.0.0-rc.6` does not export — four locale
  formatting shapes in `@object-ui/i18n` (`SpecPluralRule`, `SpecDateFormat`,
  `SpecNumberFormat`, `SpecLocaleConfig`) and four activity-feed shapes in
  `@object-ui/types` (`FieldChangeEntry`, `Mention`, `Reaction`,
  `RecordSubscription`). A citation that points at nothing is worse than a stale
  one: the next reader cannot tell whether the protocol retired the symbol,
  renamed it, or never had it.

  Measuring all eight against the published registry answered that question, and
  the answer was not "these names never existed". Every one was a real export the
  protocol retired on purpose, and every local key set was faithful to the schema
  it named. The feed four left `@objectstack/spec/data` in the `16.0.0` major,
  when the feed surface was replaced by the data API over `sys_comment` /
  `sys_activity`. The i18n four left `@objectstack/spec/ui` in `17.0.0-rc.6`
  itself — they were still present in `rc.5` — retired under ADR-0049
  enforce-or-remove because no authorable shape carried them and nothing ever
  parsed them.

  Each comment now records that provenance, including the version the symbol left
  and what (if anything) replaced it, so the shapes read as declarations these
  packages own rather than as a view onto a protocol type. Type shapes, runtime
  behaviour and exports are unchanged — the published `.d.ts` files differ only in
  comment text, which is why this is graded `patch`.

- 828549a: The gantt's conflict dialog shows the number of affected tasks again, not a literal `{2}`

  `gantt.conflict.body` was resolved at the render site with a literal string replace on **single** braces — `t('gantt.conflict.body').replace('{count}', String(n))` — while all ten locale packs spell the placeholder the i18next way, `{{count}}`. `"…{{count}}…".replace("{count}", "2")` consumes the inner seven characters and leaves the outer pair behind, so every user on every loaded pack read "自动重新排程 **{2}** 个受影响的任务？". The dialog now interpolates through i18next (`t('gantt.conflict.body', { count })`), the idiom `gantt.delete.body` already used.

  The two sibling keys three lines away in the same file, `gantt.autoScheduleDlg.body` and `.skipped`, were **not** broken — pack and call site both used single braces, and they rendered correctly. They are converted anyway, because that split is the whole mechanism: two write-confirmation dialogs in one component carried two different interpolation idioms, so `conflict.body` drifting to the i18next spelling in the packs (which is the correct spelling, and matches every other placeholder in the bundle) silently broke the render. Leaving the auto-schedule keys on the literal-replace idiom leaves the same trap armed for the next translator. All ten packs and the plugin's bundled English fallback table now agree on `{{count}}` for all three; only the braces moved, no translation was reworded.

  `gantt.quickFilter.resultSummary` stays deliberately single-brace — its `ObjectGantt` call site really does resolve `{shown}`/`{total}` with a literal replace, and that convention is pinned by its own parity test. It is now the only key in the gantt namespace on that idiom, and the comments at both spellings say so.

  Nothing caught this, and each gate was silent for its own reason: the cross-pack parity check compares en against each pack, and all eleven spellings agreed; the en-drift check compares a pack against its own history, and the packs were born matching. Both are **relative** comparisons, and the defect lived in the **absolute** relationship between a pack's spelling and the syntax the call site resolves. The existing render test asserted the dialog body contains `'1'` — which `{1}` satisfies. The new pin asserts the absolute form directly, under a real loaded pack, for every way a placeholder can survive to the screen.

- e1ade8f: An illegal gantt dependency link now says why it was refused, instead of doing nothing

  Dragging a dependency onto a target the gantt refuses — itself, a locked row, a group row, or one that would close a dependency cycle — produced no feedback of any kind: no toast, no dialog, no cursor change, no target outline, not even a console warning. The guard was right and completely invisible, so a user drawing a legitimate-looking dependency got a dead interaction and no way to learn the constraint. The rejection was silent in both places it could have shown: a refused bar never became the drop target, so it got no hover treatment at all, and the release handler only ran its body when a target _had_ been registered, so the drop itself was a no-op.

  Both halves are now wired, and both read the **same** verdict. `canReceiveLink`'s four-branch boolean became `classifyLinkTarget`, which returns which branch refused (or `null`), with the boolean derived from it. The hover affordance and the drop toast are two consumers of that one classification, so the reason a user is shown cannot drift from the reason the link was actually refused — there is no second classifier to disagree. The branch names are the leaves of the new `gantt.link.rejected.*` keys, so a branch added later without a message surfaces as a missing key rather than as a plausible-but-wrong sentence.

  During the drag, a refused bar under the pointer gets `cursor: not-allowed` and a destructive outline; on release it raises a toast naming the reason. Four messages, one per branch, in all ten packs. Both the cursor and the outline are driven from inline `style` rather than utility classes, matching the bar's existing read-only cursor three lines away and for the same reason recorded there: `cursor-not-allowed` and the ring alpha utilities are not emitted in the prebuilt components CSS, so a class would look correct in a DOM test and render nothing in a browser.

  Deliberately unchanged: a host veto through `onBeforeDependencyCreate` stays silent. That rejection carries a reason only the host knows, and the gantt has none to show — surfacing it means exposing a rejection-reason output on the public component, which is a separate contract rather than a rider on this one. The four built-in reasons are the gantt's own policy and are the only ones it can explain.

  One of the four, `group`, has no end-to-end path today: a `type: 'group'` row renders no bar, so the drag can never target it. The message is kept anyway — without it the branch would render a raw key on screen if it ever did fire — and the test pins the reachability fact, so it goes red the day group rows gain a bar. Filed as objectui#4209.

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

- 5cc847c: The console shows a standing impersonation banner, with an exit that fails loudly (#4467).

  While `session.impersonatedBy` is present, `ConsoleShell` renders a banner naming BOTH
  parties — the impersonated user, whose name every write is recorded under, and the
  administrator who started it — plus a stop affordance. It derives from the session rather
  than from client memory of the click, so it survives a full SPA reboot, a new tab and a
  browser restart, and it cannot disagree with who the server thinks is acting. An ordinary
  session renders `null` and its chrome is unchanged.

  The exit calls `POST /auth/admin/stop-impersonating` over the same data lane and then
  awaits a session refresh. The server restores the administrator from the `admin_session`
  COOKIE, so a deployment that blocks cookies cannot exit this way — the banner says so and
  stays up instead of appearing to succeed, which would leave the operator doing ordinary
  work under someone else's identity.

  Ten locale packs carry the banner's copy.

- fa21254: Kanban: a drop that makes fields required now collects them instead of dead-ending

  Dragging a card into a column whose value flips a field's `requiredWhen` predicate to TRUE used to PATCH the column value alone. The engine refused the whole update — correctly, that is what the predicate declares — and the board had no way to finish the move: the only path to closing a won deal was to abandon the board and open the record form. HotCRM's opportunity pipeline is the reported case (`win_reason` is required when `stage == "closed_won"`), but the dead end belonged to every board whose target column carries a conditional requirement.

  The board now evaluates the target column's predicates BEFORE writing anything. If the move would make fields required while they are still empty, it opens a small dialog collecting exactly those fields, then submits the column value and everything collected as ONE PATCH — never two writes, which would leave the record in the refused state if the second one failed. A drop that triggers no predicate is untouched, down to the PATCH body.

  The verdict comes from `@object-ui/core`'s `resolveFieldRuleState` — the same evaluator the record form, the wizard and the line-item grid already resolve `visibleWhen`/`readonlyWhen`/`requiredWhen` with, delegating to `@objectstack/formula`'s CEL engine. The board's prompt and the server's enforcement therefore reach the identical verdict rather than drifting through a second hand-rolled predicate evaluator. Emptiness is core's `isMissingForRequired`, the presence contract the form and the server share, so a `false` boolean and a `0` count as answers and are not re-asked.

  Every control in the dialog is `@object-ui/fields`' `FieldEditWidget`, the same widget the record form renders for that field type — a select edits as a select, a date as a date picker — so this adds no second set of field-rendering decisions.

  Four kinds of field are deliberately NOT collected, and each falls through to the unchanged PATCH where the server's refusal (legible since objectstack#7525) speaks for itself: one that already has a value, one `visibleWhen` hides, one that is readonly, and one whose type has no edit widget at all. A dialog row with no control would be a worse dead end than the one being fixed.

  Cancelling writes nothing and leaves the card in its original column; a combined PATCH that is still refused for some other reason surfaces the refusal and rolls back exactly as a plain rejected move does, rather than looping the dialog on an arbitrary server error.

  `@object-ui/i18n` carries two new `kanban.*` strings for the dialog, translated across all ten packs. Its public type surface is unchanged — the `.d.ts` was measured identical before and after — hence the patch bump.

- 33c32bf: List sort: the picker stops borrowing the filter whitelist, and a header click is no longer a one-way door out of the view's declared sort

  `filterableFields` was applied to the single field set both toolbar builders read, so a whitelist authored for _filtering_ silently became the _sort_ whitelist too. A view could declare a two-level default sort — `plan_start_date` then `name` — and get a sort panel that offered neither field and rendered both of its rows blank: the declared sort worked on load and could then be neither reproduced nor modified, and there was no way to express "sortable but not offered as a filter condition" short of widening the filter builder as collateral. The whitelist now narrows the filter builder alone, which is the contract it was written for; the sort picker starts from every field the view can name and applies its own sortability rules.

  Those rules are about what the sort can honestly reach, so a second one joins the existing relational exclusion: a `formula` field is withheld. It has no materialised column, so ordering by one is refused by the server outright (objectstack `UNMATERIALIZED_SORT_TYPES`) — and it matters here precisely because the base set widened, since a formula field previously reached the picker only if someone had whitelisted it. The exclusion is `formula` alone and deliberately not the spec's `COMPUTED_VALUE_TYPES`: `summary` and `autonumber` are computed too, each gets a real maintained column, and both order correctly. Either rule keeps its existing escape hatch — a field the current sort already uses stays listed, which for a formula field is the only way to remove the offending row.

  One consequence worth naming: the hint explaining the relational omission used to be gated by the same whitelist. A view whitelisting only `status` showed a near-empty sort picker and no word about why; the withheld relational field now reaches the rule that withholds it, so the explanation appears with it.

  The second half is the way back. One column-header click replaces the whole sort array, so a view shipping a multi-level default lost it for the rest of the session — the declared `sort` behaved as an initial value only, recoverable just by reloading the page. The sort panel gains a **Reset to view default** control that restores the declared array whole: multi-level, in declared order, not merely cleared. It reads the view's declared sort through the same resolver the initial render already uses, so there is one answer to "what did this view declare". It is disabled while the active sort already matches that default, and absent entirely for a view that declares no sort — there is no default to return to, and clearing the sort under that label would be a second, differently-named way to do what removing the rows already does. The header click's own semantics are unchanged: it still replaces the array, it just no longer does so irreversibly.

- 6d641c9: Members & invitations tabs gate their affordances by org role instead of letting the server's 403 be the UI (#4475)

  A user whose organization role is `member` opened the workspace members page and
  was shown an enabled **Invite member** button plus a per-row **Member actions**
  menu carrying **Remove member** — on every row, the workspace Owner's included.
  Nothing was hidden or disabled; the action only failed after the user had
  committed to it. The Settings tab of the same page already gated correctly; the
  members and invitations tabs never got the same treatment.

  The affordances are now narrowed to the roles that can actually use them, keyed
  on the active member's role — the same source the role-change menu on this page
  already reads. Which roles those are is **measured against the routes that
  enforce them**, not assumed to be "owner":

  | affordance        | route                             | permission              | roles                         |
  | ----------------- | --------------------------------- | ----------------------- | ----------------------------- |
  | Invite member     | `/organization/invite-member`     | `invitation:["create"]` | owner, admin, delegated_admin |
  | Remove member     | `/organization/remove-member`     | `member:["delete"]`     | owner, admin                  |
  | Cancel invitation | `/organization/cancel-invitation` | `invitation:["cancel"]` | owner, admin                  |

  Three different gates, because `delegated_admin` holds `invitation:["create"]`
  without `member:["delete"]` and deliberately without `cancel` — so it keeps the
  invite button and the copy-link action while losing remove and cancel. A single
  owner check could not express that.

  An actor left with no row action at all gets no menu rather than a trigger that
  opens onto nothing, and the members page explains the absence where the Invite
  button used to sit, in the Settings tab's own voice. An unresolved role is
  treated as the least privileged, so nothing privileged is offered to a viewer
  whose membership could not be read.

  Reading the pages is unaffected: the member list and the invitation ledger still
  render in full. Whether `org_member` should be able to read the invitation
  ledger at all is a separate, server-side question.

- 45e1949: Numbers render in the user's locale, and a `Field.number` year is no longer `2,026`

  Every numeric field the console rendered went through an `Intl.NumberFormat` built with the locale hardcoded to `en-US` and `useGrouping` never set. Two defects rode in that one construction: a `zh-CN` or `de-DE` console still grouped and pointed decimals the US way, and a four-digit **year** stored as `Field.number({ scale: 0 })` rendered as `2,026` — in every locale, with no field property able to turn it off. Apps had been converting year columns to `Field.text` to escape it, permanently trading numeric comparison, range filters and dataset dimension types for a display detail.

  The construction had been copied into five places — the number cell renderer, the currency cell renderer, the `CurrencyField` widget, the compact `formatNumber` helper, and the dashboard `MetricWidget` — so fixing any one surface never changed the answer. They now share one formatter, `formatDisplayNumber` in `@object-ui/i18n`, which owns the locale and the grouping policy together, plus one locale resolver, `useDisplayLocale`.

  `useDisplayLocale` composes the two locale channels this repo already had rather than adding a third: the tenant's regional default (`useLocalization().locale`, ADR-0053) when an org has configured one, otherwise the active UI language (`useObjectTranslation().language`) so grouping and decimal marks follow a language switch. That second step is what covers the case the report was measured in — a fresh database, where the tenant localization endpoint has no locale to give.

  Grouping is now suppressed when a field declares `scale: 0` and carries no currency, which is what makes years, fiscal periods and other ordinals render plainly. This is an **interim default** with an accepted cost: a large scale-0 _count_ loses its separators too. It holds only until the spec gains an authorable presentation hint, which is being specified separately, contract-first; when that lands it overrides this heuristic.

  Three surfaces deliberately keep their separators, because a zero-decimal display there does not come from a field declaration: the dashboard `MetricWidget` (its decimals are parsed from a numeral.js format pattern, and its own contract calls the separators load-bearing — "`1,930,000` not `1930000`"), the `element:number` aggregate renderer, and every currency path including amounts whose currency code could not be resolved. An **undeclared** `scale` also keeps grouping — absent means "decimals unknown", not "integer".

  `formatCurrency`, `formatCompactCurrency` and `formatNumber` each take a new optional trailing `locale` argument. Existing calls are unaffected; omitting it now follows the runtime default rather than forcing US conventions.

- 58bebf6: Organization & invitation console: translate the English holdouts a zh session was left reading (#4474)

  Three families of string, one sweep over `console/organizations/`:

  - **Role names** now come from the single shared `ORG_ROLE_LABELS` map at every
    site. The role badges on the members and invitations pages were rendering the
    raw server identifier (`owner`) under a CSS `capitalize` that made it look like
    a label in English and left it untranslated everywhere else; the accept page
    did the same in its role row and inside its otherwise-translated sentence. The
    map's four `organization.roles.*` keys existed in no locale pack, so even the
    dropdown that did consult it fell through to English — all ten packs now carry
    them. An unrecognized role renders verbatim rather than blank.
  - **Server-echoed errors** are mapped by better-auth's stable `code`, never by
    matching its English text. `createAuthClient` was dropping that code for every
    `organization.*` call while preserving it for sign-in/sign-up, so the console
    had nothing to key on; all sixteen organization methods now go through the same
    `toAuthError` helper. Messages are unchanged — the code simply stops being
    thrown away. An unmapped code still shows the server's own sentence.
  - **Icon-only `aria-label`s** (member actions, copy invitation link, cancel
    invitation, and a fourth on the share-link copy button) are translated — for an
    icon-only control this is the only name a screen reader gets.

- 405e808: `pickLocalized` reads own properties only, and takes only string values, on every limb

  The resolver read four of its six limbs — the exact tag, the base language, `default` and `en` — with a bare bracket access. Bare access walks the prototype chain, so a locale that happened to name an `Object.prototype` member resolved to that member and the function stringified it into the label: `pickLocalized({ en: 'Pricing' }, 'constructor')` returned `function Object() { [native code] }`, and the same held for `toString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable` and `toLocaleString`. Those same four limbs also skipped the `typeof === 'string'` filter the regional and last-resort limbs already applied, so a non-string value short-circuited the chain and rendered as `[object Object]`.

  Both guards now apply uniformly. A guarded limb **misses** rather than aborting the resolution, so an unusable entry falls through to the next limb exactly as an absent one does — `pickLocalized({ en: 'Pricing' }, 'constructor')` is now `'Pricing'` (the `en` limb), and only a map with no usable entry at all resolves to `''`. An empty-string value is still a hit, because `''` is a label the author wrote.

  No real language tag can observe this: no BCP-47 tag is an `Object.prototype` member, and the inline locale map is declared `z.record(<tag>, z.string())`, so every in-contract input resolves byte-identically to before. What it changes is agreement with the backend twin `resolveI18nLabel` (objectstack#6765), which shipped with exactly these two narrowings recorded as deliberate departures from this function because on a server the locale can arrive in an `Accept-Language` header. That recorded rule divergence is now zero; the only remaining difference is how each side spells a miss (`''` here for a text node, `undefined` there for a producer's fallback chain), which is pinned as an identity in the cross-resolver parity table.

- c0f9a4b: Studio surfaces the runtime authoring gate's advisory findings instead of discarding them client-side

  The framework's runtime authoring gate produces two kinds of verdict on a metadata write. Errors become a 422 and the author sees them. Advisories ride a **200** — the save succeeded, the row persisted, the version bumped — and until objectstack#7435 the server dropped them into a deduped `console.warn` behind a process-level set. That landing put them on the wire as an optional `advisories[]` on the save response, emitted only when non-empty, and objectui was still throwing them away one layer further out: `MetadataClient.save` parsed the body, returned it as an opaque `T`, and every call site awaited it for its side effect and discarded the value.

  The measured case the fix is built on: a `nightly_purge` flow whose only defect is a `delete_record` node with `multi: true` and no filter yields `errors = 0 / advisories = 1`. The save returns 200, the flow goes live, and nothing anywhere tells the author it deletes every row. That matters most for exactly the authors Studio serves — a Studio tenant or an MCP/AI author has no `os lint` and no CLI config for `sys_metadata` overlay rows, so this gate is not the weakest of four doors, it is the only one.

  `MetadataClient` now carries an `onSaveAdvisory` sink, invoked after a save whose response carried a non-empty `advisories[]`, and the console wires it in `useMetadataClient` — the one hook every app-shell write path takes its client from, so a single wiring covers `ResourceEditPage`, `StudioDesignSurface`, `EmbeddedItemEditor`, `DatasourceResourcePage`, `ObjectHooksPanel` and any future call site rather than a toast copied into twenty of them. The finding shape is re-exported from `@objectstack/spec` (`RuntimeAuthoringIssue`) rather than restated, so it cannot fork from the 422 `issues[]` it deliberately shares a declaration with.

  The affordance is the warning tier and says "Saved" first. A successful save that reads as a failure is the specific defect this surface must not ship, so the toast acknowledges the write, lists `rule` + `message` + `hint` per finding with `where` as secondary context, and renders that text **verbatim** — `message` and `hint` are server prose composed by the gate's rules, not i18n keys. Only the frame around them is translated (`console.saveAdvisoryTitle`, ten packs). The sink is best-effort in both directions: a malformed finding is dropped rather than printed as blanks, and a throwing renderer cannot turn a save the server already committed into an error.

  **What this does not surface yet, and why.** Studio's designer saves as a **draft** on every edit, and drafts are never gated — the framework returns at its D1 early-return (`if (args.state !== 'active') return null`) before running a single rule, so a draft save produces no findings at all rather than producing some that get withheld. The publish step that promotes a draft to active _does_ run the gate, but the publish route returns no `advisories` field until objectstack#7294 lands. So a draft-then-publish flow renders nothing today, at both of its doors, for two different reasons; the active-mode save door renders findings now. That gap is pinned as a test rather than left for a reader to rediscover.

- d46f9b8: i18n: `createSafeTranslation`'s provider-less fallback now honours a call site's inline `defaultValue`

  `fallbackT` looked its key up in the hook's hand-written `defaults` map and, on a miss, rendered the
  **raw key** to the user — then ran every option, `defaultValue` included, through the interpolation
  loop as if it were a `{{defaultValue}}` variable. So `t('perm.facet.none', { defaultValue: 'None' })`
  showed `perm.facet.none` on a host with no `I18nProvider`, which is a supported scenario (standalone
  embedding and tests are the whole reason this factory exists).

  The lookup order is now `defaults[key]` -> a string `defaultValue` -> the key, matching i18next,
  which serves the provider path: the defaults map is the pack value's stand-in here, so it keeps the
  pack's winning position. `defaultValue` is also excluded from the interpolation loop as a reserved
  name — it selects the string, it does not fill holes in one. Non-string `defaultValue` is ignored.
  The provider path is untouched.

  Measured over all 26 `createSafeTranslation` hooks in the repo: 27 keys reach a hook whose defaults
  map lacks them, 21 of those carrying an inline `defaultValue` that used to be dropped (16 keys in
  `plugin-detail` alone). Those 21 now render their English instead of a raw key on provider-less
  hosts; the other 6 pass no inline default and still need a map or pack entry.

- 2fea4d2: `detail.showEmptyRelated` renders Russian and Arabic again — the "+N empty" button no longer falls through to English at the counts it takes most often

  This was the repo's only pre-existing i18next plural family, and all ten packs defined exactly two slots: `_one` and `_other`. i18next asks `Intl.PluralRules` for the one suffix a language needs for that number, and when the pack has no such slot it walks `fallbackLng` to `en`. Russian has four plural categories and Arabic six, so `ru` at counts 2-4 (`few`) and 5-20, 25-30, … (`many`), and `ar` at 0, 2, 3-10 and 11-99, resolved nothing locally and rendered the English string. The call site is the collapsed-empties button in the record detail's reference rail, whose count is the number of empty related lists — 2 to 4 are the most common values it ever takes, so a Russian user essentially always read English.

  The fix is a base key (no suffix) beside the two existing slots, in all ten packs. The base key is always in i18next's lookup chain, so every category a pack did not enumerate resolves to it, in that pack's own language — and, unlike adding `_few`/`_many` to `ru` alone, it keeps the ten packs' key sets identical, which full key parity requires. Same shape objectui#3546 slice six established for `perm.facet.*`. Where the base key is genuinely reachable it carries a count-invariant phrasing: `ru` uses the «Существительное: {{count}}» form the pack already writes 22 times, `ar` the «{{count}} مفرد(جمع)» marker it uses throughout. For `en`/`de`/`zh`/`ja`/`ko` the base key cannot be reached at all (their categories are covered by the two existing slots) and repeats `_other` for parity; `fr`/`es`/`pt` reach it only from a million up, where the plural form is already correct. No English copy moves.

  The provider-less path needed the same row for a different reason: `createSafeTranslation`'s fallback resolves `defaults[key]` literally and never appends a plural suffix, so the two suffixed rows in plugin-detail's defaults table were unreachable through it and that path answered with the raw key. It now carries the base key too.

  Parity across packs turned out to be necessary and not sufficient — ten identical key sets were green throughout, because the defect is one level below key names: the slot the language needs is not in the set. So the invariant "a plural family must carry a base key" is now asserted over all ten packs in `all-locales-key-parity.test.ts`, where it is pack-intrinsic and fails at PR time without needing a call site to exist. It went red on all ten packs before this change and names the family that is missing its base.

- 7f1cb33: List sort: the relational hint stops recommending a formula field, the one type the server refuses to sort by

  The Sort panel withholds columns that link to another record and explains why, and the last sentence of that explanation named the remedy: _add a formula field holding it_. A formula field is exactly what the platform will not order by. The server keeps `UNMATERIALIZED_SORT_TYPES = new Set(['formula'])` and, since objectstack#6994, a sort naming one is a hard `400 INVALID_SORT` — before that it degraded silently, returning every row with `asc` and `desc` byte-identical. So an author who read the hint, followed it, and built a formula field arrived at a refusal; and since #4243 withheld formula fields from this very picker, at a field the panel does not offer either. Two doors, opposite advice, for one problem.

  The remedy sentence now names a **stored, denormalised field — written when the source changes** — and rules the formula field out in as many words: it is virtual, no column is stored for it, and the server refuses to sort by one. That is deliberately the server's own vocabulary rather than a third phrasing of the same fact: objectstack#6924 and objectstack#6994 settled on one wording across the refusal doors so an author refused twice is not sent two different ways, and this is the UI door of that same set. The first half of the hint — why relation columns are withheld at all — is unchanged.

  All ten locale packs move together, as `check:i18n-drift` requires of any `en` edit. The same sentence also lives in `plugin-list`'s provider-less fallback table, which is what renders when the component is used outside an `I18nProvider`; it is updated to match `en` byte for byte, because a pack-only reword would have left the retired advice on exactly the surface this fixes.

- 2e3b0c0: fix(list): an `OBJECT_API_DISABLED` list request renders an honest cannot-work state instead of the empty state

  A list pointed at an object whose `enable` block withholds the API rendered its ordinary
  empty state, so _"this page cannot work, and never could"_ reached the user as _"you have no
  records"_ (objectui#4408). The reported instance — `Setup › Advanced › Signing Keys`, whose
  `sys_jwks` declares `enable.apiEnabled: false` — could not load for any persona and said so
  to nobody. That is also why the upstream defect objectstack#7544 survived review for its
  whole life: a merely unpopulated page invites nobody to click through.

  The masking had two halves, in two packages, and neither package could see the other:

  - **`@object-ui/data-objectstack`** (minor — see the grading note below) — `find()` degraded
    **every** 404 into `{ data: [], total: 0 }` and memoised the resource, so the denial arrived
    at the surface as a successful empty result, indistinguishable from a genuinely empty
    object. The two `enable`-block denials are now let through instead: `OBJECT_API_DISABLED`
    (404) and `OBJECT_API_METHOD_NOT_ALLOWED` (405). The memo skips them too — absorbing one
    would have pinned the object to "empty" for the rest of the session.
  - **`@object-ui/plugin-list`** — the load-error panel gained an `api-disabled` kind. The 405
    half was never swallowed, so it already reached this panel, but classified as `network`:
    _"check your connection and try again"_ for a condition no retry can change. It now says
    the object is not exposed through the API, that this is a setting on the object rather than
    a permission, and it offers **no Retry** button, because every retry re-fetches the
    identical refusal.

  Both denials are pure functions of the object's metadata — no user, no permission, no
  context — so neither is transient or per-user, which is exactly the case where a silent empty
  state is most misleading. Discrimination is on the ADR-0112 `code`, never the status: a
  missing collection, a missing record and a disabled object are all 404.

  **A genuinely empty object still renders the ordinary empty state**, and a backend without an
  optional collection still degrades to empty — pinned in both directions, at the adapter, at
  the view, and once end-to-end over a real adapter and a real `ListView`.

  Also closes a code-propagation gap on the same path: `find()`'s raw `$expand`/`$search`
  branch bypasses `@objectstack/client` and hand-rolled its own error, stamping only `status`.
  It now carries the ADR-0112 envelope (`code` + `httpStatus`), so a denial arriving on the
  branch a list takes whenever it expands a lookup or runs a search is no longer anonymous.

  New strings: `list.loadErrorApiDisabledTitle` / `list.loadErrorApiDisabledMessage`, in the
  `en` pack and mirrored in the list defaults map.

  ## Grading note — why `@object-ui/data-objectstack` is **minor** and not patch

  Two independent reasons, either of which is sufficient under this repo's precedent
  (objectui#4403 / #4177, and #4485's grading of `@object-ui/core`'s `toDomProps` lift):

  1. **The emitted `.d.ts` grows two NEW exports.** `isApiAccessDeniedError(error: unknown):
boolean` and `API_ACCESS_DENIED_CODES` (the readonly tuple
     `['OBJECT_API_DISABLED', 'OBJECT_API_METHOD_NOT_ALLOWED']`) are added to the package's
     public surface. Additive surface growth is minor.
  2. **Observable behaviour on a published API moves.** `ObjectStackDataSource.find()` now
     **REJECTS** for the two `enable`-block denial codes where it previously **RESOLVED** with
     `{ data: [], total: 0 }`. No signature changed and nothing was removed, but a caller that
     relied on those two codes arriving as a successful empty result now receives a rejected
     promise carrying `code` + `httpStatus`, and must handle it.

  Deliberately unchanged, and still resolving to an empty result exactly as before: a bare 404
  with no code, `OBJECT_NOT_FOUND` (still memoised) and `RECORD_NOT_FOUND`. The behaviour move
  is scoped to the two denial codes named above and to nothing else.

  Not major: this follows AGENTS.md's version-alignment rule — objectui's major tracks
  `@objectstack`'s, so this repo's own breaking semantics are declared as minor with the change
  described in the body, which is what this note is.

- 31ab1ac: fix(print): `window.print()` produces a usable page, and the Print buttons say what they do

  The list, report and dashboard Print controls were bare `window.print()` calls with no
  print stylesheet, so the browser printed the whole console — sidebar, top bar, chat rail,
  toasts — with the data table clipped to a single viewport. With no label to the contrary
  they were being accepted against "export to PDF" requirements, which they have never been.

  - `@object-ui/app-shell/styles.css` gains a shared `@media print` block: it hides the shell
    chrome, prints the active content area full-width, releases the viewport-height flex chain
    so long tables paginate instead of clipping, repeats table headers on every sheet, and
    neutralises dark mode (which otherwise prints white-on-white). One sheet serves list,
    report and dashboard.
  - The list and report Print buttons carry a tooltip and accessible name stating that they
    open the browser's own print dialog and are not a PDF export (new `common.printDialogHint`,
    translated in all ten locale packs).
  - The dashboard's `export_dashboard_pdf` action no longer toasts "Preparing PDF export…" —
    it names the print dialog it actually opens (`dashboardActions.pdfPreparing` is replaced by
    `dashboardActions.printDialogOpening`).

  No control was removed and no headless detection was added. A real print/PDF primitive
  remains out of scope (`objectstack-ai/objectstack#1301`, closed NOT_PLANNED).

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

- ff84b05: Stop the report config panel being titled "Title", and the view-settings colour section "Color"

  Two call sites asked for a key whose value was written for a different slot, so the rendered copy was wrong (objectui#4118, surfaced by objectui#3810's census).

  `ReportConfigPanel` used `report.editor.title` for both its heading and the accessible name of its `role="complementary"` landmark. That key is the label of the report's Title _field_ — `report.editor.titlePlaceholder` ('e.g. Pipeline by Quarter') sits directly under it in the pack. So the panel was headed "Title", and a screen reader announced a complementary region named "Title", which says nothing about what the region is. A new `report.editor.panelTitle` ('Edit report' — what the call site's own dead fallback said before objectui#3810 aligned it to the pack) now names the panel, in all ten locale packs.

  `ViewSettingsPopover`'s colour section used `list.color`. On the wide toolbar `ListView` already uses both keys correctly for the two slots of this one feature: the compact `Paintbrush` button is `list.color` ('Color') and the panel it opens is headed `list.rowColor` ('Row Color'). This popover is that same panel on the collapsed/`compactToolbar` surface, so it now takes `list.rowColor` — an existing key, no pack change.

  No `en` value of an existing key changed; `scripts/check-i18n-en-drift.mjs` reports 0 en values changed, 1 key added.

- Updated dependencies [ee66e2e]
- Updated dependencies [ee26e65]
- Updated dependencies [5900ac5]
- Updated dependencies [3fc2971]
- Updated dependencies [aca27fa]
- Updated dependencies [dde7283]
- Updated dependencies [f279deb]
- Updated dependencies [eb7f586]
- Updated dependencies [e901131]
- Updated dependencies [d9d3463]
- Updated dependencies [613b167]
- Updated dependencies [abb0f81]
- Updated dependencies [38ab505]
- Updated dependencies [7e4f0e5]
- Updated dependencies [92250d6]
- Updated dependencies [c1d939f]
- Updated dependencies [49ae9f4]
- Updated dependencies [2459a3e]
- Updated dependencies [d6aa172]
- Updated dependencies [fe52a04]
- Updated dependencies [bb68488]
- Updated dependencies [9461dd3]
  - @object-ui/core@17.5.0

## 17.4.0

### Patch Changes

- 7864f03: Backfill the auth family's 54 missing locale keys — `auth` 26 + `oauth` 16 + `acceptInvitation` 12 (objectui#3546, slice three)

  `scripts/check-i18n-call-site-keys.mjs` (objectui#3530) measured 54 keys that a
  `t()` call site asks for and that **no locale pack defined** — 54 distinct keys at
  54 call sites across the console's six auth pages. All 54 carried an inline
  `t(key, { defaultValue: 'English' })`, which is exactly the objectui#3517 class:
  English rendered correctly, and **all ten languages were stuck on it** for
  months. Nothing here rendered a raw key — slice one (PR #3583) held those sites.

  What that meant on the page: a `zh` user reaching `/login` and switching to the
  phone/SMS branch got "Email or phone number", "Get code", "Resend in {seconds}s"
  and "Sign in with password instead" in English; the whole `/oauth/consent` screen
  — including the four scope sentences describing what a third-party client is
  about to be granted — was English-only; so was the `/accept-invitation` page and
  the device-authorization dead end.

  - **`packages/i18n/src/locales/en.ts`** gains the 54 keys. `oauth.consent.*` and
    `acceptInvitation.*` are new top-level namespaces; the other 26 extend
    `auth.login`, `auth.forgotPassword`, `auth.device` and `auth.verifyEmail`.
    Every one of the 52 keys whose call site carries a **string** `defaultValue`
    gets that exact string, byte for byte (52/52, script-compared), so the pack
    path and the inline-default path cannot diverge. The two remaining keys —
    `oauth.consent.title` / `oauth.consent.request` — have **template**
    defaultValues, where byte identity is structurally impossible (JS `${…}` vs
    i18next `{{…}}`); both take the interpolation contract the call site actually
    declares in its options.
  - **The nine other packs** get real translations, each evidenced against a
    neighbour key in the same pack (fr's space before `?`/`:`, de's en dash, ru's
    ё, ar's verb-first placement so an RTL sentence does not open on a Latin
    client name, zh's full-width punctuation). The one string all ten packs share
    is `phonePlaceholder` — the E.164 example number, treated like the
    `name@example.com` the packs already keep untranslated.
  - **`scripts/i18n-call-site-key-baseline.json`** loses exactly those 54 entries
    (163 → 109). The file is a ratchet: an unfixed key missing from it fails the
    build, and a fixed key still listed fails it too.
  - **No component changed.** An AST sweep of all 122 call sites in these three
    namespaces found zero dead `t(key) || 'English'` fallbacks (the construct
    slice one had to delete from `ObjectView.tsx`, where i18next's key-as-value
    return made `||` unreachable).

  Two holes here are **not** i18next's and must survive translation intact:
  `resendOtpCountdownText` carries `{seconds}` in single braces because
  `packages/auth/src/LoginForm.tsx` and `ForgotPasswordForm.tsx` substitute it with
  a literal `.replace()`, and `oauth.consent.request`'s `{{suffix}}` arrives
  pre-formatted from the page. Both are pinned in
  `packages/i18n/src/__tests__/auth-namespace-3546.test.tsx`, in both directions.

- f5f8744: Backfill the `console` namespace's 41 missing locale keys plus the `console.ai.group.` template family (objectui#3546, slice four)

  `scripts/check-i18n-call-site-keys.mjs` (objectui#3530) measured **41 distinct
  keys at 47 call sites** under `console.*` that a `t()` call site asks for and
  that **no locale pack defined** — five of those keys have more than one site
  (`console.ai.dock.maximize` has three), which is why the denominator is measured
  and never counted by hand. All 47 carried an inline
  `t(key, { defaultValue: 'English' })`, so this is the objectui#3517 class:
  English rendered correctly, and **all ten languages were stuck on it**. Nothing
  here rendered a raw key — slice one (PR #3583) held those sites.

  What that meant on the page: a `zh` user opening `/ai` got "Waiting for
  server…", "Still working…" and "Connection lost — reconnecting…" in the
  connection banner, all ten "Designing your app…" progress hints in English, and
  "Built" / "Not yet built" / "Published" / "Publish failed" on the plan card; the
  ChatDock's whole chrome (title, resize handle, collapse, "Open full page") was
  English including two `aria-label`s; the conversation sidebar's date headers read
  "Today" / "Yesterday" / "Previous 7 days"; a mistyped URL produced an English
  "Page not found"; and the `?` shortcuts dialog's AI group was English inside an
  otherwise translated table. Two of these strings ("Not yet built", "TODAY") are
  named in objectui#2458's mixed-language list.

  - **`packages/i18n/src/locales/en.ts`** gains 46 keys: the 41 measured ones plus
    the five members of the `console.ai.group.` family. `console.notFound` is a new
    sub-namespace; the rest extend `console.shortcuts` and `console.ai` (with new
    `console.ai.dock`, `console.ai.designingPlanHint` and `console.ai.group`
    objects). Every one of the 41 measured keys takes its call site's inline
    `defaultValue` **byte for byte** (46/47 sites, script-compared), so the pack
    path and the inline-default path cannot diverge.

    - The one site that cannot match is `ChatDock.tsx:563`, where a single key
      (`console.ai.dock.open`) carries two different English strings: the
      `aria-label` says `Open assistant` and the `title` says
      `Open assistant (⌘⇧I)`. A key can hold one value, so `en` takes the
      `aria-label` spelling — an accessible name must not carry a glyph run that
      screen readers announce as symbols, and `⌘` is a mac-only glyph that a
      _language_ pack cannot vary per platform. The tooltip therefore stops
      advertising the shortcut; recorded on objectui#3810 (whose class this
      divergence joins) rather than papered over.

  - **`console.ai.group.` leaves the ratchet's `missingPrefixes` (4 → 3).** It is a
    template key — `` t(`console.ai.group.${group.key}`) `` in
    `ConversationsSidebar.tsx:277` — whose static head matched no `en` key, so every
    expansion missed. Its value surface is the **closed** `ConversationGroupKey`
    union, so the repair is an enumeration of all five members, not a wildcard; a
    test reads the component's own union and label map and fails if a sixth bucket
    is ever added without a key.

  - **The nine other packs** get real translations, each evidenced against its own
    `console` neighbours: `zh` full-width punctuation and the pack's single-em-dash
    status-line style, `ja`/`ko` the pack's `AI ` spacing, `de` formal _Sie_ and
    its `Wird …` progressive, `fr` straight apostrophes, `es` _usted_ (as the
    `console.ai` neighbourhood already uses), `pt` the pack's `off-line` spelling,
    `ru` ё orthography, `ar` verb-first phrasing that never opens an RTL sentence
    with a Latin token. Where `en` repeats a string the packs already translate
    (`Go back`, `Publish failed`, `Try again`, `Back to home`, `Assistant`,
    `Today`, `Yesterday`), the existing neighbour's wording is reused rather than
    re-invented.

  - **`scripts/i18n-call-site-key-baseline.json`** shrinks by exactly 42 entries
    (41 keys + 1 prefix family): 109 → 68 keys, 4 → 3 prefixes.

  No component changed: an AST sweep of all 308 `console.*` call sites in the repo
  found zero dead `t(key) || 'English'` fallbacks among this slice's keys.

- 69becd2: `de` approvals inbox no longer shows two quote typographies on one screen

  Three `approvalsInbox` values quoted the record title with ASCII straight quotes
  on **both** sides while their own sibling `approvalsInbox.approveOneTitle` used
  the correct German pair (U+201E low-9 opener, U+201C closer):

  | key                             | before                  | after                   |
  | ------------------------------- | ----------------------- | ----------------------- |
  | `approvalsInbox.rejectOneTitle` | `"{{title}}" ablehnen?` | `„{{title}}“ ablehnen?` |
  | `approvalsInbox.inlineApproved` | `"{{title}}" genehmigt` | `„{{title}}“ genehmigt` |
  | `approvalsInbox.inlineRejected` | `"{{title}}" abgelehnt` | `„{{title}}“ abgelehnt` |

  A German approver therefore met both typographies in a single screen and inside a
  single operation pair — German quotes on the approve confirmation, typewriter
  quotes on the reject confirmation and on both inline toasts. `„…“` is the pack's
  own majority (50 paired spans) and DUDEN R11, so the three values were the
  outlier. Keys and the `{{title}}` placeholder are unchanged; this is a
  value-domain typography fix, and `en` (ASCII on both sides by design) is
  untouched.

  This is a **different defect shape** from objectui#3876, which paired a German
  opener with an ASCII closer. Because these three were ASCII on both sides they
  were self-consistent, so the pairing invariant objectui#3876 left behind could
  not see them — it scans forward from each `„`, and there was no `„` in them to
  scan from. The pack's straight-quote census being empty now lets that pin become
  strictly stronger: `de-quote-pairing-3876.test.ts` asserted an explicit
  three-key allowlist and now asserts that **no `de` value holds a U+0022 at all**,
  which covers both defect shapes and needs no per-key maintenance as new values
  land. The pack census moves from `„` 47 / `“` 47 / `”` 0 / `"` 6 to
  `„` 50 / `“` 50 / `”` 0 / `"` 0.

  None of the three i18n gates could have caught this: `all-locales-key-parity`
  compares key sets and placeholder shapes, `check-i18n-call-site-keys.mjs` only
  asks whether a key resolves, and `check-i18n-en-drift.mjs` fires on `en` value
  changes — these values were wrong from the day they landed, so no drift event
  ever existed. All three are value-blind by design, which is why the invariant
  lives in a test.

- 5e52495: German pack: the 20 values that closed the German opening quote with an ASCII straight quote now close it with `“`

  `packages/i18n/src/locales/de.ts` opened a quoted span with the German low-9
  quote `„` (U+201E) and closed it with the ASCII typewriter quote `"` (U+0022) in
  20 keys, so a German user read `Registerkarte „Alle Datensätze" anzeigen` — a
  mismatched pair. `search.resultsCount` showed it most plainly: the value ended
  `„{{query}}""`, the mismatched closer immediately followed by the TS string
  terminator.

  This was never a pack convention. Measured on `main@2937bcf7d` before the fix,
  the same file already spelled 23 spans the correct German way, `„…“` — the two
  styles sat side by side, in sibling keys of the same namespace. Every mismatched
  closer is now `“` (U+201C), which is what German orthography (DUDEN R11) and the
  majority of the file already used. Affected surfaces: the four empty states
  (object / page / dashboard / report not found), the search results header, the
  lookup "create named" action, four `console.objectView` strings, the home
  getting-started hint, the six `navigationSync` toasts, the local marketplace
  install toast, and the preview not-ready title.

  No other language pack and no `en` value changed — the counts are unchanged for
  every other locale, and the mismatch was measured only in `de`.

  ### Counted at landing, in two units

  The card reported "20 values" and the triage re-scan reported "22 mismatched
  pairs"; both are correct about different units, and the difference is now
  recorded rather than left to the next reader. 20 keys carried a mismatch;
  22 mismatch occurrences lived in them, because `navigationSync.renamedPage` and
  `navigationSync.renamedDashboard` each quote two names in one sentence
  ("Seite „alt“ in „neu“ umbenannt") and so contribute two each. Full-file counts
  before → after: `„` 45 → 45, `“` 25 → 47, `”` 2 → 2, `"` 28 → 6.

  ### The durable half, and why it is not the count equality the card proposed

  Three i18n gates run over these packs and none can see a wrong quote:
  `all-locales-key-parity` compares key sets and placeholder shapes,
  `check-i18n-call-site-keys.mjs` only asks whether a key resolves, and
  `check-i18n-en-drift.mjs` fires on `en` **value changes** — these values were
  wrong from the day they landed, so no drift event ever existed. Without a
  value-domain assertion the next backfill copies the mismatch from a neighbour
  again, which is exactly how these 20 accumulated.

  The card proposed asserting `count(„) === count(“)`. That is **false on the
  correctly fixed file** (45 vs 47) and would have sent the next reader hunting a
  bug that is not there: two values in this pack, `grid.import.savedMappingHint`
  and `grid.import.savedMappingPreviewNote`, are still untranslated English prose
  and quote in the English style `“…”`, so their two `“` are legitimate _openers_.
  The invariant that is pinned instead is the pairing itself — for every `„`, the
  first quote character that follows must be `“` — backed by the arithmetic
  identity `count(“) === count(„) + count(”)`, which stays true if those two values
  are later translated (47 === 47 + 0) and breaks the moment a mismatch returns.
  Both carry a presence guard so a broken import cannot make them pass by scanning
  nothing.

- b750823: `preview.draftBar` speaks one second person in `es` — the draft-preview banner no
  longer switches from tú to usted when a Spanish user publishes (#3844)

  `DraftPreviewBar` renders two mutually exclusive sentences in the same strip of
  the same banner: `message` while there are unpublished changes, `messageClean`
  once there are none. In `es` the two disagreed on register — `message` was tú
  (`estás viendo`, `publiques`) while `messageClean` (`ve`) and `sampleDataBody`
  (`Está`, `su`, `Publíquela`) were usted. So a Spanish user who pressed Publish
  watched the banner change person: same component, same position, same session.

  This is a third defect class in the value-domain blind spot behind #3582 and
  #3625, and no gate in the repo can see it. Both `es` values are correct
  translations of their `en` sentences — nothing is missing, nothing is stale, and
  nothing holds English. The inconsistency is _internal to one pack, on one UI
  surface_: `scripts/check-i18n-call-site-keys.mjs` only asks whether a key exists
  in `en`, `all-locales-key-parity` compares key sets and placeholder shapes and
  never reads values, and `scripts/check-i18n-en-drift.mjs` only fires when an `en`
  value moves — these two `en` values never moved.

  `message` is the value that changes, because usted is what the pack already says
  everywhere around it: the `es` pack censuses 102 usted markers to 30 tú (tú being
  the marked exception, concentrated in the auth, report-editor and organizations
  neighbourhoods that #3546 slice two deliberately ruled informal); the other three
  strings of this same object were already usted; and #3546 slice five gave the 19
  new `preview.unpublishedBar.*` / `preview.history.*` keys usted on the strength
  of `home.pendingDrafts.published` ("¡Publicado! Sus cambios están activos."). Two
  smaller divergences inside the same sentence are closed with it, so the banner's
  two halves stop disagreeing about wording as well as person:

  - **`—` instead of `:`** in `messageClean`, matching `en`, where both sentences
    open `Draft preview — `. That is the whole of `messageClean`'s diff.
  - **`activo` instead of `en producción`** for "live". The pack spells this concept
    `activo` in four neighbouring places including `publishCta` in this very object
    ("Publicar para verlo activo"), and it reserves _producción_ for the actual
    production environment (`environment.entitlement.planLockedBody`), so the
    outlier was ambiguous as well as inconsistent.
  - **`Vista previa del borrador`** as the shared opening, `del` being the form
    `messageClean` already used.

  No `en` value changes (the en-drift gate reports 0), no key is added or removed
  (so `all-locales-key-parity` is untouched by construction), and the nine other
  packs are not touched. The diff is two values in one file.

  Re-voicing the whole `preview` namespace to tú was considered and rejected — a
  much larger change that would collide with the adjacent `marketplace.*` (9:0
  usted) and `console.ai.*`. `preview.empty.notReadyDescription` therefore stays tú
  here, since #3844's ruling is this banner only; it is filed as #3875 rather than
  waved through, because `PreviewDraftEmptyState` renders _underneath_
  `DraftPreviewBar` and so those two show usted and tú on screen at the same time.
  After this change the `preview` namespace is 23 usted to that 1 tú.

  A gate that checks "one register per namespace" is deliberately **not** here:
  recognising usted vs tú needs real morphology, and token matching demonstrably
  cannot — in this pack the token `revisa` is usted in `console.ai.empty.build`
  (es.ts:1365, "…y usted revisa y publica.") and tú in
  `auth.forgotPassword.successTitle` (es.ts:1918, "Revisa tu correo electrónico"),
  the same eight letters in opposite registers. The neighbourhood boundary such a
  gate would police is human judgement anyway — #3546 slice two's "same rule,
  different answer". A new `draftBar-es-register-3844.test.ts` pins the four `es`
  values byte for byte instead, plus the `en` literals, so a future reword of
  either `en` sentence fails in the same PR that reworded it.

- ac2139c: `grid.import` saved-mapping copy is now translated in ko / de / fr / es / pt / ru / ar instead of served as English

  Five keys — `grid.import.savedMapping`, `chooseSavedMapping`, `manualMapping`,
  `savedMappingHint` and `savedMappingPreviewNote` — were **byte-identical to `en`**
  in seven of the nine non-`en` packs, 35 values in all. Only zh and ja had been
  translated, and two of the five are multi-clause explanatory sentences rather
  than placeholders or proper nouns, so this was not a deliberately untranslated
  term: a German, French, Spanish, Portuguese, Russian, Korean or Arabic user
  picking a saved mapping in the import wizard read English.

  None of the three i18n gates could see it. `all-locales-key-parity` compares key
  sets and placeholder shapes, so English passed perfectly; the call-site gate only
  asks whether a key resolves; `check-i18n-en-drift.mjs` fires on an `en` **value
  change** and these keys arrived in the packs already English, so no drift event
  ever existed. objectui#3920 also proposed a general "no non-`en` value may be
  byte-equal to `en`" gate; that is deliberately not part of this change, because
  values like `auth.*.emailPlaceholder` (`name@example.com`),
  `fields.image.counter` (`{{current}} / {{total}}`) and
  `grid.import.templateFileName` are byte-equal across packs correctly, and
  objectui#3880 records the other face of the family. The five keys are pinned by
  name instead.

  Each translation reuses vocabulary its own pack already ships rather than
  inventing a second word for the same concept: `stepMapping` for "mapping"
  (Zuordnung / Correspondance / Asignación / Mapeamento / Сопоставление / تعيين /
  매핑), `legacyFallbackNotice` for "type coercion" (Typkonvertierung / conversion
  de type / conversión de tipos / conversão de tipos / приведение типов / تحويل
  الأنواع / 형 변환), `view.readonlyTooltip` for "read-only", and `validateHint`
  for "on the server". `es` follows the usted ruling objectui#3844 measured for
  this pack; `pt` is the pack's own pt-BR (mapeamento / salvo / no servidor);
  `ru` keeps its ё; `fr` keeps the straight apostrophe and the space before colon
  and semicolon; `ar` punctuates with U+060C and U+061B; `ko` uses the 은(는) /
  이(가) spelling its `fields.file.exceedsMaxSize` already uses for a placeholder
  whose particle cannot be resolved at authoring time.

  The quote around `{{name}}` follows each pack's measured majority for wrapping a
  placeholder — de `„…“` (38 spans against 3 ASCII), fr `« … »` with an ASCII
  space (25 against 18), ru `«…»` (23 against 18), and ASCII `"…"` for ko (38:0),
  pt (39:0), es (22:19) and ar (27:15). The card cited
  `residue-namespaces-3546.test.tsx` as pinning "the rest ASCII", but that line
  pins the `empty.*` family only and its own comment scopes the rule to "the
  sibling value in the SAME pack"; `grid.import` has no other quoted span, so the
  census one ring out decides.

  Germanising the two `de` sentences also closes the 45/47 gap
  `de-quote-pairing-3876.test.ts` documented: that pack's census moves from
  `„` 45 / `“` 47 / `”` 2 to `„` 47 / `“` 47 / `”` 0, exactly as that file's header
  predicted, and its `count(“) === count(„) + count(”)` identity still holds. The
  three literal counts in it were updated and the two keys are now pinned by name
  there, so `rdqKeys === []` cannot become an assertion that passes because nothing
  is produced.

  `en`, `zh` and `ja` are untouched, and `grid.import.transform` — the sixth key in
  the same block, English in the same seven packs, and the third column header of
  the very table this hint sits above — is deliberately left alone, filed as
  objectui#3938 and pinned as still-English so the number cannot drift while that
  issue waits its turn.

- b14ab3a: `grid.import.transform` is now translated in ko / de / fr / es / pt / ru / ar instead of served as English

  The third column header of the import wizard's saved-mapping summary was
  **byte-identical to `en`** — the literal string `Transform` — in seven of the
  nine non-`en` packs. zh (`转换`) and ja (`変換`) had translated it, which is what
  rules out the "deliberately untranslated term" reading; this is the sixth key of
  the same six-line block objectui#3920 / PR #3936 fixed the other five of, and it
  was left out of that card only to keep its 5-keys / 35-values census verifiable.

  | pack | before      | after            | the pack's own anchor                                                                    |
  | ---- | ----------- | ---------------- | ---------------------------------------------------------------------------------------- |
  | ko   | `Transform` | `변환`           | `savedMappingHint` "이름 변경 + 변환 + 형 변환"                                          |
  | de   | `Transform` | `Transformation` | `savedMappingHint` "Umbenennung + Transformationen + Typkonvertierung"                   |
  | fr   | `Transform` | `Transformation` | `savedMappingHint` "le renommage + les transformations + la conversion de type"          |
  | es   | `Transform` | `Transformación` | `savedMappingHint` "el cambio de nombre + las transformaciones + la conversión de tipos" |
  | pt   | `Transform` | `Transformação`  | `savedMappingHint` "renomeação + transformações + conversão de tipos"                    |
  | ru   | `Transform` | `Преобразование` | `savedMappingHint` "переименование + преобразования + приведение типов"                  |
  | ar   | `Transform` | `التحويل`        | `savedMappingHint` "إعادة التسمية + التحويلات + تحويل الأنواع"                           |

  Each value is the **singular of the word the pack already uses** for `en`'s
  plural "transforms" in `grid.import.savedMappingHint` — the sentence
  `SavedMappingSummary` renders directly above this header. That is the anchor
  rather than `legacyFallbackNotice`'s term, because `en`'s own sentence lists
  "transforms" and "type coercion" as two different server-side operations and
  `legacyFallbackNotice` is about the second: reusing de "Typkonvertierung", ko
  "형 변환" or ar "تحويل الأنواع" for this header would name the wrong operation.

  Why it was worth a card of its own rather than waiting for a general gate: this
  value is not a hidden string. It is the third `TableHead` of
  `SavedMappingSummary`, sitting in one row with `csvColumn` and `mapsTo`, which
  were always translated — so a German user read `Spalte` / `Zugeordnet zu` /
  `Transform`, two languages in a single header row, directly under the German
  hint PR #3936 had just landed. Before that PR the whole panel was English and
  therefore at least self-consistent.

  The three i18n gates are value-blind here exactly as they were for
  objectui#3920: `all-locales-key-parity` compares key sets and placeholder shapes
  (the key was present with no placeholder, so English passed perfectly), the
  call-site gate only asks whether a key resolves, and `check-i18n-en-drift.mjs`
  fires on an `en` **value change** — this value entered the seven packs already
  English, so no drift event ever existed. `en`, zh and ja are untouched, and the
  pin PR #3936 left in `gridImportSavedMapping-i18n-3920.test.ts` asserting these
  seven were "still English" has been replaced by the translated pin it asked for.

- 8c60819: The inbox popover now spells out what the bell badge is made of

  The bell badge is `unread notification topics + pending approvals`, clamped to
  "9+" above nine. As one number it is unexplainable: objectstack#7213 measured
  Home's "pending approvals" card saying 8 while the bell said "9+", and read that
  as the two counts disagreeing — they never did, the bell was simply carrying a
  second addend the user could not see.

  The popover already tabs the two streams and puts a count pill on each tab, so
  the split was partly visible — but those pills clamp at "9+" too. A loaded
  console therefore showed three "9+"s that reconcile to nothing, which is why
  sectioning alone did not close this.

  A breakdown line under the popover header now states the exact, unclamped
  addends beside the exact total — `15 total · 12 notifications + 3 pending
approvals`. The approvals half is the same `pendingApprovalsCount` the Home card
  and the Approvals Inbox tab read, so the number a user reconciles against is
  literally the one they see elsewhere.

  The badge formula, the counting APIs and the "9+" clamp on the badge itself are
  unchanged — this is a display fix. Three new keys
  (`notifications.badgeTotal` / `badgeNotifications` / `badgeApprovals`) land in
  all ten locale packs. They interpolate named placeholders (`{{total}}`,
  `{{unread}}`, `{{approvals}}`) rather than i18next's `{{count}}`, which would
  additionally drive plural-key resolution these packs carry no forms for.

- e64a52e: 回填 `perm` + `home` 两命名空间 14 个缺失语言 key,十个语言包补齐(#3546 切片六)

  `scripts/check-i18n-call-site-keys.mjs` 实测:14 个不重复 key / 14 个调用点(1:1),分布在权限集
  记录的授权面摘要(`PermissionFacetLink`,ADR-0056 P1)与"一键发布全部草稿"的其余几条 toast
  (`usePublishAllDrafts`:ADR-0038 L3 探针健康、示例数据健康、ADR-0066 ⑨ 能力引用巡检)。

  这 14 处都带内联 `defaultValue`,所以英文一直正常渲染,**十种语言都翻不了** —— 修的是这一半。
  英文字串一字未改:9 处静态 `defaultValue` 与 en 逐字节相同;另外 4 个计数标签(对象 / 字段规则 /
  RLS 策略 / 标签页规则)的 `defaultValue` 是带英文单复数分支的模板串,改用 i18next 复数族
  (`key` + `key_one`)后逐个计数渲染结果与模板串一致。

  复数族刻意带**基础 key** 而不是只写 `_one`/`_other`:i18next 只按语言的 CLDR 类别取一个后缀,
  取不到就沿 fallback 链落到 `en`。ru(few 2-4、many 5-20)与 ar(two、few 3-10、many 11-99)
  恰好在用户最先遇到的计数上会因此显示英文;基础 key 让这些类别落回**本语言**。

- 844d17f: Backfill the `marketplace` and `preview` namespaces' 37 missing locale keys plus the `marketplace.disclosure.runtime.` template-key family (objectui#3546, slice five)

  `scripts/check-i18n-call-site-keys.mjs` (objectui#3530) measured 37 keys that a
  `t()` call site asks for and that **no locale pack defined** — 37 distinct keys at
  37 call sites across five console components — plus one `missing-prefix` family
  whose static head matched no `en` key at all, so every expansion missed. All 37
  carried an inline `t(key, { defaultValue: 'English' })`, which is exactly the
  objectui#3517 class: English rendered correctly, and **all ten languages were
  stuck on it** for months. Nothing here rendered a raw key — slice one (PR #3583)
  held those sites.

  What that meant on the page for a `zh` (or `ja`, `de`, `ar`, …) user: the
  marketplace's "Your organization" strip, its Install / Installing… / Installed
  buttons and the version-update affordances were English; the whole ADR-0025 PD4
  **pre-install permission disclosure** was English — "This package contains code",
  the trust-tier badge, "Reviewed & approved" / "Not yet reviewed" / "Signed", the
  four permission group labels (platform services, lifecycle hooks, network,
  filesystem) and the consent checkbox the user ticks to accept them; the ADR-0045
  unpublished-app banner and its publish toasts were English; and the entire
  ADR-0067 build-history sheet — title, description, the per-commit labels, the
  Revert button and both of its result toasts — was English.

  `marketplace.disclosure.runtime.` is repaired as an **enumeration, not a
  wildcard**: its value surface is the closed trust-tier enum
  (`PluginRuntimeSchema` = `z.enum(['node', 'sandbox', 'worker'])`, ADR-0025 §3.6),
  so all three members are backfilled and the family leaves the ratchet's
  `missingPrefixes` (3 → 2). A test reads the component's own fallback map and
  fails if a fourth tier is ever added without a key — the job the prefix entry
  used to do.

  Each `en` value is byte-identical to the inline `defaultValue` it replaces (36 of
  36 literal sites; the 37th's `defaultValue` is a template literal whose
  `${pkg.display_name}` becomes the `{{name}}` hole its call site already passes),
  so no English string a user sees today changes. The nine translations follow each
  pack's own neighbourhood — including two namespaces that legitimately take
  **different** second persons in `zh` (`marketplace` 你, `preview` 您) — and reuse
  an existing neighbour's translation wherever the `en` string already existed
  verbatim, so one English string never renders as two different sentences in the
  same language.

  No component changed: an AST sweep of the whole `marketplace.*`/`preview.*`
  call-site surface found the slice's own dead-`||`-fallback count to be zero.

- 4dcd52a: `console.objectView.systemViewReadonly` and `console.objectView.expandToPage`
  are translated in the eight packs that stored English for them, so a Japanese,
  Korean, German, French, Spanish, Portuguese, Russian or Arabic session reads
  the system-view hint and the expand affordance in its own language (#3582).

  This is a different defect class from #3546's ledger, and no gate in the repo
  could see it. There the key was _missing_ from a pack and `fallbackLng: 'en'`
  rendered English; here the key was **present in all ten** and eight of them
  stored English as the value. `all-locales-key-parity` compares key _sets_ and
  placeholder _shape_ — identical before and after this change, and neither key
  interpolates anything. `scripts/check-i18n-call-site-keys.mjs` and its baseline
  ratchet ask whether a `t()` key exists in `en`; it did, so these two were never
  in the 258.

  `systemViewReadonly` carried the sharper half: the eight packs did not hold
  `en`'s sentence, they held one `en` had already abandoned. `en` says the view
  is read-only; the eight said `System view defined in code - duplicate to
customize.` — pointing eight locales at a duplicate-to-customize path the
  product no longer presents. They are translated against `en`'s **current**
  read-only meaning, not against the stale English they replaced.

  Each value is built from terminology the same pack already uses rather than
  invented: `view.readonlyTooltip` supplies "system view" and
  `console.objectView.cannotEditMetaView` (landed in #3583) supplies "defined in
  code", so the new hint agrees with the copy beside it in every pack. For
  `expandToPage`, `detail.openAsFullPage` is the identical English sentence one
  namespace over and was already translated everywhere — `en` and `zh` hold their
  two byte-identical to each other, so the eight now do too, and one locale
  cannot end up with two different words for one action.

  `en` and `zh` are unchanged, byte for byte. No key is added or removed —
  the diff is 16 values in 8 files. A new
  `objectView-value-language-3582.test.ts` pins the `en` literal (so the next
  rewording of `en` fails loudly instead of silently orphaning nine
  translations), asserts that no pack but `en` serves either English spelling,
  and requires the zh/ja/ko/ru/ar values to contain characters of their own
  script. The repo-wide "no ASCII English sentence in a non-Latin pack" gate that
  #3582 also sketched is deliberately **not** here; it is a separate, lands-green
  change.

- 42ae5c6: The organization-management console is translatable. The 90 keys under
  `organization.*` — the org layout and its tabs, the members list, the whole
  invitation flow, organization settings including the leave and delete
  confirmations, the accept-invitation page, and the workspace switcher — are now
  defined in all ten locale packs, so a non-English session reads the org admin
  surface in its own language instead of English (part of #3546).

  `scripts/check-i18n-call-site-keys.mjs` measured 258 keys that a `t()` call site
  asks for and no pack defines. `organization.*` was the largest namespace in that
  tally at 90 keys across 93 call sites in seven components. Every one of them
  carried an inline `t(key, { defaultValue: 'English' })`, which is why nothing
  looked broken: English rendered correctly at each site and all ten languages
  were pinned to it. That is the #3517 class, not the raw-key class slice one
  (#3583) held — no organization site rendered an identifier, and none had a dead
  `||` fallback to remove, which was measured before deciding not to touch the
  components.

  Adding a `defaultValue` is deliberately not the fix; it is the mechanism that
  kept these invisible for months. The existing defaults stay where they are, and
  each `en` value is byte-identical to the default at its call site so the two
  paths cannot render different text.

  `organization` is a new top-level namespace, sitting next to — and distinct
  from — `organizations`: the singular one is the management surface, the plural
  one the org picker. The ratchet in `scripts/i18n-call-site-key-baseline.json`
  shrinks by exactly these 90 entries, from 253 to 163. The
  `organization.invitations.status.*` template-key family is untouched and still
  baselined: enumerating an invitation status set is a different repair from
  backfilling literal keys.

- 6d762da: The five locale keys behind #3546's eight no-fallback `t()` call sites are now defined in all ten packs, so the built-in-view toasts, the activity-timeline source link, the wizard's required-field toast and the Gantt refresh button's accessible name are translated instead of falling back to English — or, on two surfaces, to the key itself (part of #3546).

  `scripts/check-i18n-call-site-keys.mjs` measured 258 keys that a `t()` call site asks for and no pack defines. These five were the subset with no working inline default: `console.objectView.cannotEditMetaView`, `console.objectView.cannotDeleteMetaView`, `detail.viewSource`, `gantt.toolbar.refresh` and `wizard.missingRequired`. Adding a `defaultValue` is deliberately not the fix — that mechanism is what kept all 258 invisible for months.

  **Two of the eight sites really did render the raw key**, and both go through a binding with nothing in front of i18next. `ObjectView.tsx` calls `useObjectTranslation()` directly, so five toasts read `console.objectView.cannotEditMetaView` / `cannotDeleteMetaView` on screen; the `|| 'Built-in views cannot be renamed.'` guards next to them were dead on every path, because i18next answers a miss with the key itself and a non-empty string never falls through `||`. Those four unreachable English strings are removed rather than repaired: one key served four call sites (rename / pin / set-as-default / configure), so the pack copy covers any change to a built-in view instead of naming one operation. `RecordActivityTimeline.tsx` fails the same way for a subtler reason — `useDetailTranslation` is `createSafeTranslation(..., 'detail.back')`, and because `detail.back` does resolve, the probe hands back i18next's `t` for every key and bypasses the defaults map wholesale, so `detail.viewSource` reached the user verbatim.

  **The other two sites were not rendering a raw key**, contrary to the issue's description, and are fixed here as the milder "English in all ten languages" class. `wizard.missingRequired` is its own hook's probe key, so the probe failed and `createSafeTranslation` correctly served its English default. `gantt.toolbar.refresh` goes through `useGanttTranslation`, which deliberately does not use `createSafeTranslation` and falls back per key — so the refresh button's `aria-label` was "Refresh", in English, never the key. Screen-reader users heard an English word rather than an identifier; a `zh` session now hears 刷新.

  Regression cover is provider-mounted on purpose: with no `I18nProvider` the defaults maps answer every one of these keys and the assertions pass while the console is broken, which is precisely the false-green the issue documents. For the two sites whose English output was already correct, `en` cannot discriminate before from after — the `zh` assertions are the ones that pin the fix.

- f9faa7d: Backfill the last 17 missing locale keys and both remaining template-key families, emptying the call-site key ratchet (objectui#3546, slice seven — final)

  `scripts/check-i18n-call-site-keys.mjs` (objectui#3530) opened this backlog with
  **258 keys and 4 template-key families** that a `t()` call site asks for and that
  **no locale pack defined**. Seven slices later the last of it is paid: this change
  takes the ratchet from 17 keys to **zero** and from 2 prefix families to **zero**,
  and the gate now reports every one of the **2320** literal call-site keys
  resolving against `en`.

  The residue was the long tail — nine namespaces across `app-shell`,
  `plugin-detail`, `plugin-dashboard`, `plugin-kanban` and `plugin-gantt`, none of
  them big enough to have been its own slice. 17 distinct keys at **23** call sites
  (five keys are used at more than one site) plus **3** call sites behind the two
  families.

  What that meant on the page for a `zh` (or `ja`, `de`, `ar`, …) user: the "App not
  available" empty state a user lands on when an app is still publishing, including
  its whole explanation and its Retry button; the interface page's "source is not
  available" message; the system navigation's **Administration** group header,
  **Datasources** and **Documentation** entries; the "creating new organizations is
  disabled on this instance" guard in the workspace dialog; the invitation list's
  five status labels (All / Pending / Accepted / Rejected / Canceled) on both the
  filter tabs and every invitation badge; the Gantt dependency-drag hint that names
  which endpoint the drop will link (`start` / `end`); the record detail's Add,
  "Record deleted", "No history yet" and the concurrent-update dialog's "this
  record"; the kanban empty board's column count; the dashboard widget's screen
  reader "Loading…"; and the page editor's "Edit in studio" tooltip and accessible
  name. All of it rendered English, in every one of the ten languages.

  Nothing here rendered a raw key — slice one (PR #3583) held those sites, and the
  three keys the issue body named as unprotected (`detail.viewSource`,
  `wizard.missingRequired`, `gantt.toolbar.refresh`) have resolved in `en` since.

  Both families are repaired as **enumerations, not wildcards**, and the assertion
  that used to live in the ratchet's `missingPrefixes` moves into a test that fails
  if either union grows a member without a key:

  - `gantt.linkEnd.` — the closed union `'start' | 'end'`, declared by GanttView's
    own `linkDrag` state.
  - `organization.invitations.status.` — `StatusFilter`
    (`all | pending | accepted | rejected | canceled`), declared by InvitationsPage.

  Every `en` value is byte-identical to the English the call site rendered before,
  so no string a user sees today changes: 16 keys match an inline
  `t(key, { defaultValue: … })`; `dashboard.loading` matches `useSafeTranslate`'s
  positional fallback `tt(key, 'Loading…')`; `gantt.linkEnd.*` match
  `useGanttTranslation`'s per-key fallback map; and the five status labels match the
  CSS-capitalised wire value each badge and tab showed. The nine translations follow
  each pack's own neighbourhood and reuse an existing neighbour's row wherever the
  `en` string already existed verbatim **and** that row is grammatical here — the
  four invitation adjectives are deliberately not reused from the approvals family,
  because those agree with each pack's word for "request" (`ru` masculine `Отклонён`)
  while an invitation needs its own agreement (`ru` neuter `Отклонено`).

  `scripts/i18n-call-site-key-baseline.json` is kept rather than deleted: empty is
  its terminal, load-bearing state — against an empty baseline any NEW unresolved
  call-site key is unexpected and fails the build.

  No component changed.

- 33526fd: `view.readonlyTooltip` — the tooltip on a view tab's read-only lock — is
  retranslated in the eight packs (ja/ko/de/fr/es/pt/ru/ar) that still described
  the retired "duplicate to customize" workflow, so a Japanese, Korean, German,
  French, Spanish, Portuguese, Russian or Arabic session is told the view is
  defined in code and read-only, which is what `en` says and what the product
  does (#3625).

  This is the same stale sentence #3582 fixed one namespace over, but it hid
  behind a much better disguise. In #3582 the eight packs stored the **English**
  string, so two cheap criteria could see it: "value equals `en`" and "a
  non-Latin pack holds pure ASCII". Neither can see this key. Its eight values
  were **idiomatic translations** — real Japanese, real Cyrillic, real Arabic —
  of a sentence `en` itself had already abandoned. Nothing about their form was
  wrong; only their meaning was. Key sets were complete, so
  `all-locales-key-parity` was green; the key exists in `en`, so the call-site
  guard and its ratchet were green; the values are distinct and in their own
  scripts, so every heuristic #3582 sketched would have been green too. Eight
  locales spent those releases pointing users at a path the product no longer
  offers, with every gate reporting success.

  Each value is translated against `en`'s **current** meaning and built from
  words the same pack already uses — "read-only" from its own `view.readOnly` /
  `view.readonlyAriaLabel`, "defined in code" from
  `console.objectView.systemViewReadonly` / `cannotEditMetaView` — so the tooltip
  agrees with the copy beside it instead of introducing a ninth way to say
  read-only. Nothing is rewritten from the stale text.

  `en` and `zh` are unchanged, byte for byte, and no key is added or removed —
  the diff is eight values in eight files. A new
  `viewReadonlyTooltip-semantics-3625.test.ts` tests **meaning** rather than
  form, in both directions: no pack may name the duplicate/copy workflow in its
  own language, and every pack must positively carry all three pieces of the
  sentence ("system view", "defined in code", "read-only") so the negative check
  cannot pass on a gutted string. It also pins the `en` literal, so the next
  rewording of `en` fails in the PR that does the rewording rather than orphaning
  nine translations for another release — which is the invariant this family of
  defects has actually been missing.

- 32413ec: Resolve `_views` translation keys by the bare view name only — the prefixed full name is no longer a second candidate

  `useObjectLabel().viewLabel` / `viewDescription` / `viewEmptyState` build their key by stripping the object prefix off the runtime view id (`crm_opportunity.pipeline_kanban` → `objects.crm_opportunity._views.pipeline_kanban.<tail>`). Until now, if that bare key missed, the resolver **also** tried the prefixed full name — `objects.crm_opportunity._views.crm_opportunity.pipeline_kanban.<tail>` — so a bundle authored against the prefixed spelling resolved too.

  **Behavior change:** it no longer does. A `_views` entry keyed by the prefixed full name is not read at all; the label falls back to the metadata default, exactly as it would if no translation had been written. Bundles keyed by the bare view name — the only spelling the extractor emits and `os lint` accepts — are unaffected.

  This closes an asymmetry, not a feature. The server-side resolver reads the one bare key (objectstack#5165), so a prefixed-key bundle produced a **translated label in the Console and English everywhere else**: the REST boundary, mobile, plain HTTP and SDUI consumers do not run this second resolution pass. The half-success was harder to notice than a clean miss, and it fossilized a second de-facto spelling of a key the platform has now converged on: per the objectstack#5164 ruling (2026-08-06, option A), the canonical `_views` key is the runtime view identity's bare name, with the i18n extractor deriving it from the view composer (objectstack#6124) and `packages/lint` enforcing that single spelling (objectstack#6038). This is the third and last leg of that convergence.

  The object-name axis is untouched: a bundle written against the short object name (`objects.opportunity._views.…`) still resolves when the runtime presents the namespaced name (`crm__opportunity`).

  **If a label stopped translating after this upgrade,** its `_views` key is written with the object prefix. Drop the prefix — `_views.crm_opportunity.pipeline_kanban.label` becomes `_views.pipeline_kanban.label`. `os lint` names these for you: a prefixed key is reported as `translation-target-unknown`, because no view of the object declares it.

## 17.3.0

### Minor Changes

- 0554e88: The console language choice now survives a reload. `I18nProvider` writes every language change to `localStorage` (`objectui-locale`, exported as `LOCALE_STORAGE_KEY`) and boots the next session in that language, so switching to 中文/日本語/… is no longer reverted to `en` by the next F5 or new tab (objectstack#5406).

  Bootstrap precedence is **stored choice → browser language → `defaultLanguage`**: an explicit choice outranks browser detection, and a stored value the app no longer offers is ignored and purged rather than locking the UI to a locale with no translations. The restore lands in the instance's bootstrap language, so `<html lang>` — and therefore the `Accept-Language` header on the first wave of API calls — is already correct on the first render.

  New public surface on `@object-ui/i18n`: `persistLanguage` (default `true`; set `false` for fixed-language previews/demos), `LOCALE_STORAGE_KEY`, and `readStoredLanguage()` for apps that bootstrap their own i18next instance.

- 5af2852: The record detail page now shows a read-gated approval panel (#3461). A record in approval used to expose NOTHING about the running approval to anyone but the current pending approver — `useRecordApprovals` was consumed solely to inject the header Approve/Reject buttons, while the pending-approver list, decision progress, and the `sys_approval_action` timeline existed only in the Approval Center's drawer, a `setup`-app surface that business roles can't navigate to (and whose backing object is tenant-wide, so granting read there is over-broad). The submitter couldn't tell whom to nudge; the record's own audit history was no help either, since the engine mirrors business fields as `runAs:'system'` and decisions never enter record history. The new surface is an **Approvals tab** on the record page — a peer of Details/Related (same promotion Attachments got in objectstack#4358), emitted by `buildDefaultTabs` only when the record actually has requests, with a request-count badge and the label localizing through the tab strip's KNOWN_LABEL_DICT (审批). The tab wraps the new `record:approvals` node (`RecordApprovalsPanel`), visible to EVERY viewer who can read the record: current flow/step with the enriched flow-steps strip, server-computed decision progress (quorum tally, per-group 会签 ticks), the waiting-on chips with server-resolved names and group labels (never raw ids), one chronological action timeline merged across all of the record's requests (a multi-level flow opens one request per node), decision comments and attachments, and an inline remind button for the submitter (`viewer.is_submitter`, with an id-match fallback for older backends) that POSTs the existing `/approvals/requests/:id/remind`. The host threads its live `useRecordApprovals` read through the node so the tab and the header decision buttons never disagree; on authored pages the `record:approvals` renderer self-fetches, and an authored page that omits the node gets a bottom-of-page fallback append so the approval story is never lost to a custom layout. Copy reuses the Approval Center's `approvalsInbox.*` keys so the two surfaces can't drift; `useRecordApprovals` now exposes the full `requests` array plus `listApprovalActions` / `remindApprovalRequest`, and its `ApprovalRequestLite` carries the display enrichment (`process_label`, `step_label`, `flow_steps`, `viewer`, `round`) the single-read endpoint already sent.

### Patch Changes

- b71fc92: Localize the last untranslated console-chrome accessible names (objectstack#5430)

  Four icon-only controls still carried hardcoded English accessible names, so
  under a non-English session they were the only English left in the record
  chrome — and because the controls have no visible label, that literal _is_ the
  control to a screen reader and to the hover tooltip.

  - `page:header`'s `role="toolbar"` — now `detail.pageHeaderActions` (its `⋯`
    overflow trigger eight lines below was fixed in #5407; the toolbar was missed)
  - `ReactionPicker`'s `role="listbox"` popup — now `detail.emojiPicker`
  - `ReactionPicker`'s per-reaction chip, which built its name by concatenation
    with English pluralization baked in (`reaction${count !== 1 ? 's' : ''}`) —
    now `detail.reactionCount` / `detail.reactionCountOne`
  - `NavigationOverlay`'s drawer close and split-panel close — now `common.close`
    (the key the rest of the console already uses) and `common.closePanel`

  The pluralized label follows this repo's **two-key** convention
  (`detail.relatedRecords`/`relatedRecordOne`, `lookup.recordCount`/`recordCountOne`)
  rather than an i18next `_one`/`_other` pair: zh/ja/ko have no separate singular
  form, so those packs would legitimately omit the `_one` half and
  `all-locales-key-parity` would read that as a lost key.

  All five new keys are added to all ten locale packs.

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

- 7e2406a: The group-tenancy write-target badge is now translated in all ten locales (objectui#3517)

  `form.createTargetOrg` — the ADR-0105 badge `RecordFormPage` shows in create mode
  to name the organization a new record will land in — was defined in **no** locale
  pack, not even `en`. i18next therefore genuinely missed the key and rendered the
  call site's inline `defaultValue`, so the badge read English `Creates in <org>` in
  all ten languages: a Chinese console creating a record on an org-walled object
  showed `Creates in 某某组织`.

  `all-locales-key-parity.test.ts` could not see this. It asserts that every pack
  defines every **`en`** key, so a key `en` itself lacks is outside the comparison —
  ten packs missing it identically kept parity fully green.

  ## What changed

  - `createTargetOrg` is backfilled into `en` as `Creates in {{org}}`, which makes
    the parity gate demand it from the other nine; each is translated to its pack's
    existing `form`-section tone rather than copied or machine-filled.
  - The inline `defaultValue` in `RecordFormPage.tsx` is deleted, finishing what
    objectui#3469 started — that key was the file's last remaining exception, and
    every `t()` on the page now passes bare. Declared = enforced: the packs are the
    single source of this copy, and a missing key must surface (raw key + dev
    missing-key warning) instead of being papered over at the call site.
  - The two exception-pinning tests objectui#3516 left behind invert. `form.createTargetOrg`
    joins the `BARE_KEYS` list (pinned present in all ten packs), and the render
    assertion now checks the badge against the **pack** copy in both `en` and `zh` —
    the deleted English default could not satisfy the Chinese assertion, so the
    badge fails loudly if the packs ever stop driving it.

- 4eeb932: The form renderer's last user-visible English literals now go through i18n (#3272). The fullscreen long-text editor (`mobile_fullscreen`) was an entire untranslated dialog — title, screen-reader description, `Cancel` / `Done` footer buttons, and the expand trigger's accessible name — rendering English inside an otherwise translated zh/ja/ar form; it now reads the new `form.fullscreen.*` keys, shipped in all ten locale packs.

  **Behaviour change worth reading if you author forms:** `submitLabel` and `cancelLabel` no longer default to the literals `'Submit'` and `'Cancel'` in the renderer. They default to _unset_, and the action bar falls back at render time to `common.submit` / `common.cancel`, so a form that declares no button copy now follows the session language instead of being silently frozen to English. A label you DO declare still wins verbatim in every locale — including an English one under a zh session, and including an explicit empty string (the fallback uses `??`, so `submitLabel: ''` renders a blank button rather than being overwritten). The only forms whose rendered text changes are those that never declared the labels and are viewed in a non-English session — which is the bug. `FormSchema.submitLabel` / `cancelLabel` stay optional strings; no spec or type change.

  Also removed the built-in `select` branch's second `|| 'Select an option'` fallback. The single call site already supplies `t('common.selectOption')`, so the literal was reachable only through an authored `placeholder: ''` — where it replaced the author's deliberate blank with an untranslated English word.

- 5c856ec: `ObjectGantt`'s quick-filter bar is now localized instead of pinned to Chinese. The four `QuickFilterBar` labels (`all`, `clear`, `empty`, `resultSummary`) were hardcoded as Chinese string literals at the `ObjectGantt` call site, so the bar read 全部 / 清除筛选 / 无可选项 / 显示 N / M 项任务 under an `en`, `ja`, `es` or `ar` session while the rest of the gantt toolbar localized correctly — a conspicuous mismatch, and a violation of the English-only-codebase rule. `QuickFilterBar` itself was never at fault: it is presentational and already falls back to English, so the host was the only thing pinning the copy.

  The four strings moved into a new `gantt.quickFilter` namespace, added to all ten built-in locale packs, and the call site now resolves them through the gantt package's existing `useGanttTranslation` — the same per-key hook every other gantt string already uses, so a host dictionary that lags on these keys still renders the bundled English default rather than a raw key. `gantt.quickFilter.resultSummary` deliberately keeps SINGLE-brace placeholders (`{shown}` / `{total}`): the call site substitutes them with a literal `.replace`, not i18next interpolation, matching `gantt.autoScheduleDlg.body` and the placeholder convention `all-locales-key-parity` already recognises. Anyone retranslating these packs must keep that spelling — a respell to `{{shown}}` would render the raw placeholder to the user.

- 68b6a28: The list toolbar's "Filter" now saves. Saving a filter from the runtime toolbar PUT the FilterBuilder's whole group object (`{ id, logic, conditions }`) into the view's `filter`, where `@objectstack/spec`'s `ListViewSchema.filter` declares `ViewFilterRule[]` — so every save came back `422 invalid_metadata` and the filter was silently never persisted (objectstack#5159).

  The producer now folds the builder's group to the spec's flat `{ field, operator, value }` rule list before persisting, sharing one transform with the Studio view inspector (which had the only copy). Operators normalize through the spec's own `normalizeFilterOperator`, so the four builder operators the Studio's local table had drifted behind — `startsWith`, `endsWith`, `isNull`, `isNotNull` — now persist correctly too. The builder's per-row `id` is no longer written: it is a React list key that the read path regenerates, so stored view bodies keep the declared vocabulary only.

  A filter whose shape cannot be represented losslessly as a flat rule list — `OR` across several conditions, or nested condition groups — is now refused with a translated message instead of being quietly saved as `AND`, which would have returned a different set of records than the one on screen. Such a filter still applies to the current list; it just does not become part of the saved view.

- 28b2e65: Localize the create / edit / view form title `ObjectView` builds itself
  (objectui#3462)

  The same family as #3426 / PR #3457 and #3459 / PR #3464, one call site further
  in. `ObjectView.getFormTitle()` string-built its three verbs in TypeScript:

      case 'create': return `Create ${objectLabel}`;
      case 'edit':   return `Edit ${objectLabel}`;
      case 'view':   return `View ${objectLabel}`;

  so a Chinese session whose object is labelled 联系人 read a drawer headed
  **"View 联系人"** — an English verb glued onto a localized label. All three
  consumers are visible chrome: `renderDrawerForm`'s `DrawerTitle`,
  `renderModalForm`'s `DialogTitle`, and the `title` prop handed to
  `NavigationOverlay` in the `popover` branch (a host-supplied `title` displaces
  the overlay's own `resolvedTitle` default, so it is what the user sees).

  The bar to reach it is lower than #3459's split panel: `ObjectViewSchema.layout`
  already defaults to `'drawer'`, and `navigation` is a declared authorable input
  on the registered `object-view` block whose `mode` union carries `drawer`,
  `modal` and `popover`. A row click under any of them sets `formMode: 'view'` and
  opens the container. `app-shell`'s wrapper pinning `layout: 'page'` is one host
  overriding a registered block, not proof the branch is dead.

  ## What changed

  The three verb branches resolve `form.createTitle` / `form.editTitle` /
  `form.viewTitle`.

  **No new key family was minted.** `form.createTitle` (`'Create {{object}}'`) and
  `form.editTitle` (`'Edit {{object}}'`) already ship in all ten packs and are
  already how `app-shell` heads the PAGE-mode record form
  (`RecordFormPage.tsx`, `AppContent.tsx`). The drawer / modal / popover titles are
  the same heading on a different surface, so they resolve the same keys — a
  parallel per-plugin family would have guaranteed the two spellings drift, which
  is what the sibling issues were about. Only the third verb had no sibling:
  `form.viewTitle` is added to all ten packs, following each pack's existing
  arrangement for its create/edit twins rather than a translated-verb-plus-label
  concatenation (de puts the verb last, ja/zh use particles and no space).

  `VIEW_DEFAULT_TRANSLATIONS` in `ObjectView.tsx` gains the three English entries,
  which is what `createSafeTranslation` falls back to with no `I18nProvider`
  mounted.

  Two branches stay literal on purpose and are pinned by tests: `schema.form.title`
  (the author wrote a title, so the author's title wins, in every locale) and the
  `default` branch (bare object label, no verb to translate).

  ## Visible English change

  None. Every branch is byte-identical in English — `Create Contacts`,
  `Edit Contacts`, `View Contacts` — with and without a provider, so e2e specs and
  host tests that address this chrome by its English name keep addressing it. The
  provider-less path has its own test file, kept separate because
  `initReactI18next` registers its instance as a module global that outlives
  `cleanup()`.

  The toolbar's create BUTTON keeps resolving `console.objectView.new`
  ("New" / 新建) and was deliberately not reused for the heading: a button verb and
  a title are different contexts, and folding them together is how the next drift
  of this shape would start.

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

- 6195841: Localize the record-detail overlay heading that `ListView` and `ObjectGrid`
  build themselves (objectui#3426)

  #3423 gave `NavigationOverlay`'s `resolvedTitle` an i18n default
  (`detail.recordDetail`), but two hosts never let that default run: they
  string-built an English heading in TypeScript and passed it as the `title`
  prop, so a zh/ja/de session got a fully localized drawer with one English
  heading on it.

  - `packages/plugin-list/src/ListView.tsx` — `` `${schema.label} Detail` ``
  - `packages/plugin-grid/src/ObjectGrid.tsx` — the same template, plus a bare
    `'Record Detail'` literal for the no-label case

  Both are user-reachable, not dead defaults. `list-view` / `object-grid` are
  public page blocks and `navigation` is an authorable key on their schema, so a
  page that authors `navigation: { mode: 'drawer' }` opens exactly this overlay
  on row click. (`app-shell`'s `ObjectView` does suppress it — it passes its own
  `onRowClick`, which takes priority inside `useNavigationOverlay`, and renders
  its own overlay — but that is one host overriding a public block, not proof the
  branch is unreachable.)

  ## What changed

  Both call sites now key their heading instead of concatenating it:

  - a new `detail.recordDetailWithLabel` (`'{{label}} Detail'`) carries the
    object label through interpolation, so a pack whose qualifier trails the noun
    (`de`) or that needs a possessive particle (`ja`/`zh`) can write its own
    arrangement rather than inherit English word order;
  - the no-label branch reuses `detail.recordDetail` — the very key the overlay
    itself defaults to — so one heading on one control cannot drift into two
    translations.

  The new key is added to all ten locale packs and to each plugin's English
  defaults map (`LIST_DEFAULT_TRANSLATIONS` / `GRID_DEFAULT_TRANSLATIONS`), which
  is what `createSafeTranslation` falls back to with no `I18nProvider` mounted.

  English output is byte-identical in every branch (`Contacts Detail` /
  `Contacts Detail` / `Record Detail`), with and without a provider — pinned by a
  provider-less test file per plugin, kept separate because `initReactI18next`
  registers its instance as a module global that outlives `cleanup()`.

- 5dd0127: Localize the record-overlay and tab-badge chrome that #5430's sweep left behind (objectstack#5506)

  Four more console-chrome strings were still hardcoded English literals. Unlike
  #5430's set they are not all accessible names — one is visible copy, and one was
  a component **default** that only the console happened to override.

  - `page:tabs`' count badge built its `aria-label` by template literal,
    `` `${formatTabCount(count)} items` ``. The badge renders digits only, so that
    label _is_ the badge to a screen reader — and the English plural was baked in
    with no singular branch at all, so a related list with one row announced
    "1 items". Now `common.itemCount` / `common.itemCountOne`.
  - `NavigationOverlay`'s drag-resize handle (`role="separator"`, no visible label)
    — now `common.resizeDrawer`.
  - `NavigationOverlay`'s `expandLabel` **default**. Hosts may override it and the
    console does, but the default is what every other host ships — and it feeds
    both `aria-label` and `title` of an icon-only button. Now
    `detail.openAsFullPage`, still overridable by the prop.
  - `NavigationOverlay`'s `resolvedTitle` fallback, `'Record Detail'` — **visible**
    overlay heading, not just an a11y name. Now `detail.recordDetail`.
  - The sr-only `SheetDescription`/`DialogDescription` prose
    `Record detail overlay for {title}.`, which existed in three copies
    (drawer / modal / popover) — now one `detail.recordDetailOverlay` key with a
    `{{title}}` placeholder.

  The count badge follows this repo's **two-key** plural convention
  (`detail.reactionCount`/`reactionCountOne`, `detail.relatedRecords`/`relatedRecordOne`)
  rather than an i18next `_one`/`_other` pair: zh/ja/ko have no separate singular
  form, so those packs would legitimately omit the `_one` half and
  `all-locales-key-parity` would read that as a lost key. The formatted count
  (`1.2k`, not `1200`) is interpolated so the accessible name and the visible
  digits never disagree — and because i18next skips its own plural resolution when
  `count` is a string, the two-key scheme stays in charge of the choice.

  Both touched components moved from `useSafeTranslate` to `createSafeTranslation`,
  which carries an options bag (two of the new keys interpolate) and an English
  defaults map. That map is what keeps the provider-less path English, which
  consumers outside this package depend on — `plugin-view`'s `ObjectView.test.tsx`
  and `e2e/live/inline-edit-polish-2572.spec.ts` address this chrome by English
  accessible name with no `I18nProvider` mounted.

  All six new keys are added to all ten locale packs.

- a415684: The console server-action wrapper's `opensInNewTab` choreography no longer
  ships hard-coded bilingual Chinese/English copy (objectui#3321, AGENTS.md
  Commandment #-1): the pre-opened SSO spinner tab (title + body) and the
  popup-blocked toast (title, description, action label) are now localized
  through new `console.serverAction.*` keys in `@object-ui/i18n`, added at full
  parity across all ten locale packs.

  `createConsoleServerActionHandler` gains an optional i18next-style `t` option
  (`t(key, englishDefault)`) — the wrapper is a plain function, so the translate
  function is injected from the two hook-context call sites
  (`useConsoleActionRuntime`, `RecordDetailView`) via `useObjectTranslation`.
  When omitted (tests / standalone), every string falls back to its English
  default; no non-English copy remains in code. Locale strings are HTML-escaped
  before being written into the spinner document.

- a6ec93d: `createSafeTranslation`'s no-provider fallback interpolation now replaces **all**
  occurrences of each placeholder, matching i18next semantics on the provider path.

  The fallback used `value.replace('{{k}}', String(v))`, and `String.prototype.replace`
  with a string needle substitutes only the _first_ match. A default string repeating a
  placeholder — `'Selected {{count}} of {{count}} items'`, natural in many locales and
  sometimes required by RTL / agglutinative word order — therefore leaked literal braces
  to users on hosts with no `I18nProvider` mounted (standalone / embedded renderers),
  while the same string interpolated correctly once a provider was present. A silent
  semantic fork, in exactly the environments we observe least.

  The replacement is `value.split(needle).join(String(v))` rather than `replaceAll`:
  both `replace` and `replaceAll` interpret `$&`, `` $` ``, `$'` and `$$` in the
  _replacement_ string, which i18next does not. Values here are runtime data (record
  labels, search terms), so that second divergence was reachable today — a label
  containing `$&` was mangled on the fallback path. split/join is literal on both sides
  and needs no regex escaping of the placeholder name.

  Key resolution (`defaults[key] || key`), the `String(v)` coercion, and the
  leave-it-literal behaviour for a placeholder with no matching option are unchanged.
  Fixes objectui#3418.

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

### Patch Changes

- 4b470b9: Localize the environment entitlement dialog and read cloud's nested error envelope.

  The free-plan "Development environments are a paid feature" prompt was built from
  English string literals in `entitlements.ts` — including the lowercase `your free
plan` sentence users reported (cloud#959). Both spec builders now take a translator
  and resolve `environment.entitlement.*`; all ten locale packs carry the strings.
  `entitlements.ts` stays dependency-free: `t` is passed in, not imported, and
  defaults to the English copy with local `{{token}}` interpolation.

  The dialog now renders the Console's own copy rather than the server's prose — a
  control plane upgrades independently and only localizes these messages from
  cloud#959 on, so preferring the server string left the reactive path English
  against every older deployment.

  Also fixes the reactive dialog not firing at all: cloud#948 moved coded errors into
  a nested envelope (`{ success, error: { code, … } }`), and
  `entitlementDialogFromError` read `code` off the top level — returning `null` for
  every entitlement 403, so the upgrade dialog degraded to a generic red error toast.
  Both shapes are read now.

## 17.1.0

### Minor Changes

- 1cf0de7: fix(detail): finish the approval-lock story, and warn on silently stripped fields (framework#3794)

  The Console reported record writability wrong in both directions during an
  approval, so a user had nothing to go on: what they _could_ edit said "locked",
  and what they _couldn't_ said "updated successfully".

  **The lock band told the truth; the Edit button did not.** objectui#2902 split
  the band into "in approval · editable" vs locked, but the header **Edit** CTA
  still keyed off nothing at all — on a genuinely locked record it stayed live, so
  the user opened the form, filled a screen, and got `RECORD_LOCKED` back on Save.
  It is now `disabled` on a locked record: visible-but-off, with the band beside it
  saying why. This is the LOCK, not the mere presence of an approval — a
  `lockRecord: false` node keeps Edit live, which is the point of that setting.

  **And the band could still re-lock itself.** `DetailView` OR-ed the record's own
  `approval_status` mirror into `isLocked` unconditionally. That mirror is written
  on submit by any flow configuring an `approvalStatusField`, _regardless of_
  `lockRecord` — so on a `lockRecord: false` node the host correctly resolved "not
  locked" from the request's `lock_record` while the mirror dragged the band back
  to "Locked for approval", with the pencils live and saves landing underneath it.
  The host is now authoritative whenever it threads `approvalPending`; the mirror
  is consulted only for bare/legacy `DetailView` hosts that thread nothing, where
  it still reads as locked (no node granularity — the safe direction).

  Recall's tooltip no longer promises to unlock a record the node never locked
  (`detail.cancelApprovalTooltipUnlocked`).

  **Silently stripped fields now surface on the record form's save path.** The
  adapter emitted a write-warning for `create`/`update` responses carrying
  `droppedFields`, but not for `batchTransaction` — which is how the record form
  saves a master-detail record, i.e. the one surface where a user actually edits a
  `readonlyWhen`-locked field. `batchTransaction` now emits one warning per event,
  resolving each back to its operation via the response's `index`.

  The toast itself was hardcoded English and called every strip "read-only". It is
  now localized (`detail.writeStripped*`, ten locales) and worded by reason:
  `readonly_when` says the field is not editable _in this record's current state_,
  which is what actually happened — the field is editable in other states and the
  form rendered it as an ordinary input, so "read-only" sent the user hunting for a
  permission problem that does not exist.

  **And it stopped crying wolf.** `createObjectStackUserStateAdapter` hand-stamped
  the server-managed `updated_at` on every recents/favorites write, which the
  server strips and reports — so the console popped "Some fields were not saved"
  about a field no user ever touched, on page loads, drowning the signal the toast
  exists for. It no longer sends the column; the server stamps it anyway.

- d21794c: fix(list,i18n): a 400 from the server no longer reads as "check your connection"

  `classifyLoadError` was written because a 403 rendered the same
  "check your connection and try again" panel as a genuine outage — its own doc
  comment says users "were told to debug their network when the server had
  (correctly) denied them access." It made that distinction for 401 and 403 and
  then sent **everything else**, including 4xx, to the network branch.

  A **400** is the server saying it understood the request and will never accept
  it. Retrying resends the identical bad request, so "check your connection and
  try again" is advice that cannot work — the same mistake the function exists to
  prevent, one status code over.

  This became reachable from ordinary stored metadata with
  objectstack-ai/objectstack#4121: a `$filter` array that is not a filter AST is
  now rejected at the protocol with `400 INVALID_FILTER`, where it previously
  reached a driver (and, for a lone `['and']`, silently returned every row). A
  view saved with such a filter now answers 400 on every load.

  Adds a fourth classification, `rejected`, for `status === 400` and for the
  server's 400-class codes (`INVALID_FILTER`, `UNSUPPORTED_QUERY_PARAM`,
  `INVALID_QUERY`). Its copy points at the filter rather than the network, and
  says who can fix it when the view is saved that way. 403/401 keep priority, so a
  permission denial can never read as a bad request — pinned by a test.

  The two new strings are added to **all ten locale packs**, not just `en`: the
  neighbouring panels are translated, and `fallbackLng: 'en'` would have rendered
  this one in English beside them. The full-parity gate
  (`all-locales-key-parity.test.ts`) caught the pack I missed.

  Verified: 5 new tests — numeric status, error code without a status, a status
  embedded in the message text, and the 403/401 ordering guard. Reverting the
  branch fails four of them. `plugin-list` + `i18n`: **403 tests across 29 files**,
  green.

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

- 752e18f: fix(console,app-shell): readable reassign hand-off + "System" label for svc:\* audit actors — objectstack#4365 / objectstack#4366

  - **Approvals inbox** (`ApprovalsInboxPage`): a reassign timeline entry now
    renders "from A to B" from the structured
    `reassign_from`/`reassign_to` fields (and their server-resolved
    `*_name` companions) that objectstack#4365 added to
    `sys_approval_action`, instead of relying on the old default comment that
    baked two raw user ids into user-facing text. Legacy rows without the
    structured fields keep the comment fallback. New i18n key
    `approvalsInbox.reassignFromTo` across all ten locales.
  - **Record history** (`RecordDetailView`): an audit row attributed to a
    service principal (`svc:*` on the `actor` column — e.g. a
    `runAs:'system'` flow's `svc:flow:<name>` label from objectstack#4366) now
    renders the localized "System" label instead of the raw principal string;
    the raw value stays on the entry for tooling.

- c785740: fix(detail): record Attachments become their own tab (with count badge) and their copy is translated — objectstack#4358

  Two defects on `enable.files: true` record detail pages:

  1. **Buried placement.** `RecordDetailView` appended `RecordAttachmentsPanel`
     AFTER the schema-rendered page tree, whose synthesized default embeds
     `record:discussion` as the last main component — so the panel always
     landed below an ever-growing feed timeline, undiscoverable without
     scrolling to the very bottom, with no metadata knob to move it.

     `buildDefaultTabs` now emits a peer **Attachments** tab (a new
     `record:attachments` node rendered by an app-shell registration wrapping
     the existing panel via RecordContext) between Related and
     Activity/History. `PageTabsRenderer` derives the tab's count badge from a
     `sys_attachment` probe scoped to `(parent_object, parent_id)`, riding the
     same RelatedCountStore cache/invalidation bus as related-list badges — so
     uploads and deletes update the badge live. A `hideAttachments` synthesizer
     option suppresses the tab; RecordDetailView keeps its legacy bottom append
     only as the fallback for authored pages without the node
     (`hasExplicitAttachments`).

  2. **Untranslated copy.** The panel's eleven `detail.*` keys (`attachments`,
     `uploadAttachment`, `loadingAttachments`, `noAttachments`,
     `downloadAttachment`, `deleteAttachment`, and the five
     `attachment*Denied/Required` friendly errors) existed only as inline
     English `defaultValue`s — no locale bundle carried them, so non-English
     consoles always showed English. All ten locales now define them; the tab
     label rides the existing well-known-label dictionary (→ 附件 etc.).

- d61efd1: fix(grid): a bulk action's `visible` is evaluated per selected record — objectui#3067

  The selection bar evaluated a def's `visible` against the ambient scope with no
  record bound. That does not fail open, it answers wrongly: with no `record` in
  scope the lenient evaluator returned `true` for **every** row-scoped predicate,
  including the ones that should be false — `${record.done}` and
  `${record.owner == user.id}` both came back `true`. An authored gate was not
  weakened, it was inverted for half its inputs, and nothing distinguished that
  from a real verdict.

  `visible` is now evaluated **once per selected record, with that record in
  scope**, fail-closed per record and warning once on a fault — the same contract
  the row kebab uses. One evaluation answers both questions:

  - **Is the button offered?** When at least one selected record passes. A
    record-free predicate (`features.x`, `current_user.y`) returns the same
    verdict for every row, so it still behaves as a plain button-level gate — no
    syntactic sniffing for `record` references is involved.
  - **Which records does it run on?** The ones that passed. The confirm step
    states how many were skipped, so a run over fewer records than the user
    ticked says so instead of quietly shrinking the selection.

  Eligibility is re-applied to the EXPANDED set after "select all N matching",
  not just the page selection the button could see.

  The mechanism predates objectui#3002, but only inline-authored
  `bulkActionDefs[].visible` used to reach it — written by authors who knew there
  was no record. #3031 began promoting object actions into the bar, and their
  `visible` is typically written for a row/record surface, which is what put
  row-scoped predicates in front of a record-free evaluation.

- 9eb932b: fix(console): three real-user console failures — 403 blamed on the network, ⌘K search capped at 8 objects, nav gating fields inert

  1. **List error panel classifies the failure** (`plugin-list`, `i18n`): a 403/401 from the data source used to render the same "check your connection" copy as a genuine outage, sending users to debug their network while the server was correctly denying access. The panel now classifies by `httpStatus`/`status`/`statusCode`, the `PERMISSION_DENIED`/`UNAUTHORIZED` error codes, or an `HTTP <status>` message prefix, and renders dedicated permission-denied / sign-in-required copy (all nine locales).

  2. **⌘K / full-page search scope is no longer truncated** (`react`): `maxObjectsQueried` caps the per-object fanout fallback, not the search scope — it used to slice the candidate pool itself, so the `objects` whitelist sent to the platform's `/api/v1/search` only ever named the first 8 nav objects. Which sidebar group came first decided which records were findable; everything later in the nav was unsearchable no matter what the user typed.

  3. **Nav gating fields finally gate** (`app-shell`): `evaluateVisibility` only evaluated `${…}` template strings, so the `{ dialect: 'cel', source }` envelopes the spec normalizes every authored `visible` predicate into fell through to a blanket "visible" — a constant-false predicate still rendered for everyone. It now delegates to `ExpressionEvaluator.evaluateCondition`, which routes CEL envelopes to the canonical `@objectstack/formula` engine. And the sidebars' `requiredPermissions` check treats a bare name as an ADR-0066 system capability (union of the user's permission-set `systemPermissions` from `/me/permissions`) — the same subset rule the server applies to `AppSchema.requiredPermissions` — instead of misreading it as `can(<name>, 'read')`, which had degraded `requiredPermissions` into a hide-from-everyone switch (admins included). The `object:action` form and the legacy object-read fallback keep working.

- 3cb9646: fix(app-shell,i18n): record forms no longer render the developer-voiced default subtitle

  Every create/edit record form (both the console dialog in `AppContent` and the
  full-page `RecordFormPage`) hardcoded a platform default description under the
  title: "Add a new {{object}} to your database." / "Update details for
  {{object}}" (zh: 「向数据库添加新的{{object}}。」/「更新{{object}}的详情」).

  The copy is developer-tooling voice leaking into end-user business apps — a
  scheduling clerk filling in a 排班计划 has no business being told about "the
  database", and the phrasing came straight from admin-panel boilerplate. The
  line carried no information the form title didn't already have, and neither
  call site let a form view override it.

  The default subtitle is now gone: both call sites stop passing `description`,
  and the unused `form.createDescription` / `form.editDescription` keys are
  removed from all ten locale bundles (the `workspace.createDescription` key is
  unrelated and stays).

- b5b97e2: fix(types,layout): nav item type `component` joins `NavigationItemType` and its zod enum — objectui#2918

  The renderers have carried a full `type: 'component'` implementation (Phase 3b:
  `componentRef` colon-split to `/component/<ns>/<name>`, `params` serialised as
  querystring, `metadata:*` special-cases) — but the vocabulary never gained the
  member, and `@objectstack/spec` has had `ComponentNavItem` all along. The zod
  enum was the part that bit: `NavigationItemTypeSchema` rejected
  `type: 'component'` at validation time, so authors could not declare one and
  the renderer half was unreachable — dead on arrival rather than dead code.

  - `NavigationItemType` and `NavigationItemTypeSchema` gain `'component'`;
    `NavigationItem` gains the fields the renderer consumes, `componentRef` and
    `params` (also used by `type: 'page'`), mirroring spec's `ComponentNavItem` —
    declared in zod too, so parse no longer strips them.
  - The `(item as any).componentRef` / `params` casts in `NavigationRenderer`
    and `AppSchemaRenderer` become typed access.
  - `NavigationDesigner`'s exhaustive type-meta map gains a `component` badge
    (new `appDesigner.navTypeComponent` key in all 10 locales).
  - `@object-ui/layout` gains `type-check` (src + tests) with the #2915 `paths`
    override; its DEBT entry in `check-type-check-coverage.mjs` is deleted.

- 2d5d594: fix(list,detail): sorting a lookup column no longer orders by an invisible key — #3096

  A relational column (`lookup` / `master_detail` / `user` / `tree`) never holds
  the string its cell shows: it holds the `$expand`-ed record, or a raw foreign-key
  id whose label was resolved separately. Every sort path took that raw value as
  its key, so the column of names came back in an order with no relation to the
  names — sorting looked broken, with nothing saying the key was something else.

  The two halves are fixed differently, because they can order by different things:

  - **Client-side sorts** (grid column headers, any `data-table`, a non-windowed
    related list) now key off the label the cell renders, via the new
    `getSortValue` / `compareSortValues` in `@object-ui/core` — which resolves an
    expanded record through `getRecordDisplayName` (ADR-0079), so the sort key and
    the lookup cell agree on which field names a record. This replaces two broken
    comparators: `a[col] < b[col]` is always false between two objects (the
    comparator collapsed to a constant and permuted the rows), and
    `String(a[col])` is `"[object Object]"` (every row compared equal, so the sort
    silently did nothing).
  - **Server `$orderby` sorts** cannot be fixed here — the key is the stored id by
    construction, and `objectstack#4256` settled that no relation join is coming.
    So those entry points stop offering the illusion: the ListView toolbar sort
    picker withholds relational fields and explains why (pointing at a formula
    field as the supported way to sort by a related name), and a windowed related
    list renders no sort button for them.

  A relational field the view's CURRENT sort already uses stays listed, labelled
  `(by ID)`, so view metadata authored or saved with such a sort round-trips
  instead of rendering a blank row and losing the sort on the next edit.

## 17.0.0

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

- 2735de6: feat: render the server's effective API operation set (#3391 PR-4)

  The frontend now consumes the per-object **effective API operation set** the
  server resolves (from `/me/permissions` `apiOperations`, framework #3391) —
  never the raw `apiMethods` — so Import/Export/New/Edit/Delete buttons match what
  the server will actually admit, and a 405 import refusal shows a dedicated
  message instead of silently falling back.

  - **core** `resolveCrudAffordances(obj, effectiveApiOperations?)` — new optional
    second argument intersects each affordance bit with its API operation
    (create/import→create/import, edit→update, delete→delete, exportCsv→export).
    Omitting it (old backend / no effective set) leaves affordances unchanged.
  - **permissions** — `/me/permissions` response carries per-object
    `apiOperations`; `PermissionContextValue.getObjectApiOperations(object)`
    exposes it (undefined when absent → callers keep current behavior); `check()`
    maps `import→allowCreate`, `export→allowRead`.
  - **app-shell** `ObjectView` intersects its toolbar affordances with the object's
    effective operations (Import); the platform-admin identity-import bypass is
    unaffected.
  - **plugin-list** `ListView` / **plugin-grid** `ObjectGrid` gate the Export
    button (and export handler) on effective `export`; `plugin-grid` gains the
    `@object-ui/permissions` workspace dependency.
  - **plugin-grid** `ImportWizard` — a 405 / `OBJECT_API_METHOD_NOT_ALLOWED`
    import refusal is detected by a new `isImportNotAllowed` predicate at every
    catch site (async, sync, dry-run) and STOPS with a dedicated
    `grid.import.notAllowed` message (10 locales + fallback dict) — it never falls
    back to the sync/legacy path (which 405s too), distinct from the 404
    route-absent fallback.

  Backward-compatible: a missing effective set (unrestricted object, older
  backend, or no permission provider) preserves the current default-allow
  behavior everywhere.

### Patch Changes

- 0b3be01: fix(app-shell): give inline `lookup` action params a real record picker (#3405)

  An action parameter declared inline as `{ name: 'inspector', type: 'lookup',
reference: 'sys_user' }` always rendered as a plain text input asking the user
  to paste a record id (UUID) — a supervisor assigning an inspector had to go
  find that person's UUID by hand, while the same reference field picks records
  by name in the create/edit dialog.

  `paramToField()` degrades a picker param to text when it has no `referenceTo`
  target, and `referenceTo` was only ever populated on the field-backed branch of
  `resolveActionParams()`. The inline branch dropped the authored `reference`
  key entirely (as did the spec schema, which stripped it as unknown), so an
  inline picker could never reach `<LookupField>` no matter how it was authored.

  - `resolveActionParam()` now maps an inline `reference` onto `referenceTo` — on
    the inline branch, on the missing-field fallback branch, and as an override
    on the field-backed branch (matching how every other inline value overrides
    the resolved field).
  - The text degradation now warns in dev naming the offending param, since with
    `@objectstack/spec` rejecting a targetless inline picker at parse time it
    means the metadata is broken, not merely partial.
  - The fallback's placeholder and help text no longer claim "a picker is coming
    soon" — the picker has shipped, and the message now says the parameter has no
    reference object configured. Updated across all 10 locales.

- 3c4d935: fix(i18n): compose the AI-model diagnostics summary client-side instead of rendering the server's English string (objectui#2886)

  `CloudAiModelStatus` rendered `report.summary` verbatim — the most prominent
  line on the panel, in English for every locale.

  Reading `objectstack-ai/cloud` settled how to fix it. The server **cannot**
  localize that string as currently built:

  - `service-ai/src/effective-model.ts:117` assembles it as a hard-coded English
    template literal, with no locale parameter;
  - `service-ai/src/routes/ai-routes.ts:395` declares `handler: async () => …` —
    it takes **no request argument**, so it cannot read `Accept-Language` even
    though `createAuthenticatedFetch` has been sending it since objectui#1319.

  But no server change is needed, because every ingredient of the sentence is
  already in the structured payload: `conversational.model`,
  `conversational.source`, `structured.model`, `structured.pinned`, and
  `routing.{free,paid}`. The issue proposed "return structured data instead of a
  sentence" as the better fix — the server was already doing that; the client
  just wasn't using it.

  The panel now composes the line from those fields. `sourceLabel()` already
  produced exactly the two clauses the server hand-rolls — "pinned by X" /
  "code default (no env override)", and "same as build/ask" for an unpinned
  structured model — so no new source vocabulary was required.

  **A dropped diagnostic, not just untranslated text.** The client's
  `EffectiveModelReport` never declared `routing`, which the server has always
  sent conditionally. Its only appearance anywhere was inside the English summary,
  so non-English admins could not see the plan→model routing policy **at all**.
  It is now declared and surfaced.

  Also fixed: `attributeSource` emits the bare token `'unknown'` when the adapter
  cannot report a model, and `sourceLabel` fell through to rendering it raw.

  Four keys added to all ten packs (`summary`, `summaryRouting`, `modelUnknown`,
  `sourceUnknown`), so the full-parity guard from objectui#2909 stays green.

  The panel had **no test coverage at all**; it now has five, mutation-tested by
  restoring `<p>{report.summary}</p>` — which fails four of them.

- 4b60d2d: fix(console): make the approval timeline attachment chip show its name and open (#2820)

  A decision attachment in the approval inbox timeline (审批动态) rendered a
  nameless "附件" chip that did nothing when clicked. Three separate bugs:

  - **No filename.** The chip resolved its label by fetching `/data/sys_file/{id}`
    — a system object a regular approver cannot read — and silently fell back to a
    generic label when that was denied. The name now comes from the attachment
    descriptor the server returns (framework #3266), so no `sys_file` access is
    needed and the real filename shows for every approver.
  - **Dead click.** `openAttachment` called `window.open` _after_ an `await`, so
    it was no longer a user gesture and the browser blocked the popup. It now opens
    the tab synchronously up front, then points it at the signed URL once fetched.
  - **Wrong origin.** The signed URL from the local storage adapter is
    server-relative; `window.open` resolved it against the console origin. It is
    now resolved against the API origin.
  - Every open failure was swallowed silently. The user now gets a toast on
    failure — new `approvalsInbox.attachmentOpenFailed` string across all 10
    locales.

- de5e40c: fix(approvals): Approval Center UX pass — badge nowrap, approve confirm, decision progress bar, localized declared actions (#2762)

  - **Badge no longer stacks CJK text vertically (P0-1)** — `Badge` gains
    `whitespace-nowrap` in its base variants (a badge is a single-line pill by
    definition), and the inbox 状态 column gets a minimum width, so 待审批 can
    never render as 待/审/批.
  - **Quick Approve now confirms (P0-2)** — the row's right-edge ✓, the mobile
    card button and the `a` keyboard shortcut all route through a confirmation
    dialog before executing, mirroring the Reject flow; an irreversible decision
    can no longer fire on a stray click.
  - **Decision progress is visualized (P1-1)** — the drawer renders a segmented
    progress bar (ARIA `progressbar`) for `decision_progress`, per-group chips
    get an explicit unsatisfied ○ state next to the satisfied ✓, the eligible
    approver count is spelled out, and the drawer pager now reads
    "Request N of M" so it can't be misread as approval progress.
  - **Declared action labels localize (P0-3)** — `DeclaredActionsBar` resolves
    label / confirmText / successMessage through the `_actions.<name>.*`
    translation convention (metadata literals as fallback), matching
    ObjectView/RecordDetailView; with the `@objectstack/plugin-approvals`
    bundle, the drawer shows 通过 / 拒绝 / 转签 instead of English in a zh-CN
    workspace. New `approvalsInbox` keys shipped in all ten locales.

- 1a03af6: fix(approvals): Approval Center triage + drawer readability pass (#2762 P1-2/P1-3/P1-4/P1-5/P2)

  - **Decision-relevant data in the queue (P1-3)** — list rows and mobile cards
    now surface the request's amount/total inline (detected from the snapshot,
    preferring the server-formatted `payload_display` value), so a reviewer can
    triage without opening each request. A sort control adds "Oldest first" and
    "Amount (high→low)" alongside the default newest-first.
  - **Empty applicant column (P1-4)** — flow-/system-initiated requests (no human
    submitter) now read "Flow-initiated" with a workflow icon instead of a bare
    person icon + "—", in the desktop table, mobile card, and drawer.
  - **Approver chips deduped (P1-2)** — a person filling more than one approver
    slot rendered as N identical "Waiting on" chips; they collapse to one chip
    with a ×N count, the tooltip keeping every underlying id.
  - **Action hierarchy (P1-5)** — `DeclaredActionsBar` maps the spec action
    `variant` enum onto the Button variants (`primary` → filled default,
    `danger` → destructive), so the drawer's Approve stands out and Reject reads
    as destructive once `@objectstack/plugin-approvals` declares them.
  - **Label polish (P2)** — `owner_id`-style resolved lookup keys render as
    "Owner", not the awkward "Owner Id", in the drawer summary.

  New `approvalsInbox` keys (`flowOrigin`, `sortBy`/`sortRecent`/`sortOldest`/
  `sortAmount`) added to all ten locales.

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

- cfc675e: fix(i18n): unconditional Chinese in the chatbot confirm card and the field inspector (objectui#2884, objectui#2885)

  Two issues split out of the objectui#2871 survey because neither is a language
  _branch_ — both are copy that renders in Chinese for every user regardless of
  locale.

  **objectui#2884 — the confirm-before-change card.** Heading, buttons, hint and
  the verb column of each change row were Chinese literals, so an English user
  read the whole confirm gate in Chinese. They now follow the same
  prop-with-English-default convention the plan card already uses
  (`changesTitleLabel`, `changesConfirmLabel`, `changeVerbLabels`, …), with the
  console passing translated values from `console.ai.*`.

  The serious half was the outbound message. Clicking Confirm sent
  `'确认修改，应用你刚才提议的改动。'` unconditionally — an English user's click
  told the agent, in Chinese, to apply the changes, and the agent answered in
  Chinese for the rest of the thread. That message now routes through the same
  `convZh` (conversation-language) switch as `planApproveMessage`, so it matches
  the language actually being spoken rather than the UI or a hard-coded literal.

  Note this is deliberately _not_ "always send English": the repo already decided
  outbound agent text follows the CONVERSATION, and the cloud confirm gate
  (`service-ai-studio` `confirm-gate.ts` `APPROVAL_RE`) matches on approval
  keywords. The Chinese string is unchanged, so that path is byte-for-byte what
  the gate already accepted; `i18n.test.ts` now pins it against the mirrored gate
  regex alongside the two plan messages.

  Also in this component: the error banner's `Response failed` / `Details` /
  `Retry` were hard-coded English, and both it and the quota banner used a bare
  `t(key)` that renders the raw key when the chat is mounted without an
  `I18nProvider`. Both now use `useSafeTranslate`, so they degrade to English
  instead of to `chatbotError.title`. The `「…」` corner brackets around the
  target-app name are now neutral quotes.

  **objectui#2885 — the draft-field suffix.** `ObjectFieldInspector` appended a
  bare `(草稿)` to draft objects in the lookup picker — the only Chinese literal
  in a 1500-line file where the other 101 strings all go through `t(key, locale)`.
  It now reads `engine.inspector.draftSuffix` from the Studio catalog.

  The 18 new keys were added to all ten locale packs, so the objectui#2872 part
  (a) gap held at 469/471 rather than widening.

- 20df08c: fix(cloud-connection): localize the Cloud Connection panel (objectstack#3589 follow-up)

  `CloudConnectionPanel` — the `cloud-connection:panel` SDUI widget that is the
  entire body of the Cloud Connection Setup page — had no i18n at all: no
  `@object-ui/i18n` import, and no `cloudConnection` namespace in any of the ten
  built-in locale packs. Its siblings on neighbouring pages
  (`marketplace:installed-list`, `mcp:connect-agent`) were already fully
  localized, so this one page rendered a translated header above an English body
  once the framework-side `page:header` resolution landed.

  - New `cloudConnection` namespace in all ten packs (en, zh, ja, ko, de, fr, es,
    pt, ru, ar), matching the coverage its sibling namespaces already had. Covers
    every phase of the device-code flow: checking, error + retry, waiting
    (approval prompt, user code, copy), bound (connection detail labels), and
    unbound (call to action).
  - The three hard-coded failure messages (expired request, bind failure, device
    code request failure) are translated where they are raised, not where they
    are rendered, since they are stored in component state.
  - The "code is pre-filled…" line was one sentence stitched together across JSX
    with a conditional tail and a bare `'.'`. It is now two self-contained
    strings, so a translator never receives a dangling clause whose word order
    they cannot change.
  - The `bound_at` timestamp now formats with the active UI language rather than
    the browser default, matching the surrounding copy.

  Also adds a locale-parity test asserting the `cloudConnection` key set is
  identical across all ten packs — partial coverage degrades quietly, because
  i18next falls back to `en` and the result merely looks half-translated.

- af705b9: feat(i18n): complete the locale backfill — all ten packs reach full key parity (objectui#2872)

  Translates the remaining **275 keys × 8 packs = 2,200 strings**, closing
  objectui#2872. The largest namespaces are `grid` (101, mostly the import
  wizard), `gantt` (58) and `dashboard` (25), plus a long tail across `list`,
  `auth`, `fields`, `marketplace`, `capability` and nine others.

  Every pack is now at parity with `en`: **2,495 of 2,499 keys**, zero keys that
  `en` lacks. The four-key remainder is the outbound-message set, absent by
  design so `t()` falls through to English and the cloud confirm gate keeps
  recognising it — `outbound-agent-messages.test.ts` owns that invariant.

  **P3 is now enforceable.** `high-frequency-namespace-parity.test.ts` was scoped
  to four namespaces because full parity would have been a permanently red build.
  That restriction is obsolete, so it is replaced by
  `all-locales-key-parity.test.ts`, which asserts:

  - every pack defines every `en` key;
  - no pack defines a key `en` lacks (objectui#2872 part b was 74 keys of exactly
    this, hidden behind a component-private fallback);
  - **placeholders match `en` per string** — both `{{count}}` and the single-brace
    `{count}` form, which two `gantt.autoScheduleDlg.*` keys use on purpose
    because their call site does a literal `.replace('{count}', …)` rather than
    i18next interpolation. A translation that drops a placeholder renders a
    sentence with a hole in it and no error, so this is checked mechanically
    rather than by eye.

  All three assertions were mutation-tested, including the single-brace form.

  ### A bug the test suite could not have caught

  The first merge pass produced **duplicate keys** in four packs: the key list is
  the union of what is missing across all eight, but the insert ran
  unconditionally, so packs that already had `detail.created` / `detail.updated`
  got a second copy. Every test still passed — at runtime the later property
  simply wins, so the parity check saw a perfectly consistent object.

  `tsc` caught it as TS1117 during `turbo build`. ESLint does not flag it, and a
  runtime test _cannot_ — the duplicate is already collapsed before JS sees the
  object. The compiler is the only possible guard here, and CI runs it. The merge
  script now filters per pack against what that pack actually defines.

  ### Translation quality

  Model-generated, and dense domain terminology (Gantt dependency types, the
  import wizard's upsert/match-field vocabulary) is exactly where that is
  weakest. This was raised before starting and the work was requested anyway, so
  it ships as a **reviewable first draft, not a finished localization** — native
  review is still worthwhile. What _is_ verified mechanically: key parity in both
  directions, placeholder shape per string, and that no outbound agent message
  was translated.

- 0502a7c: fix(i18n): the change card's Confirm button sent text the cloud gate does not accept

  The English `console.ai.changesConfirmMessage` was
  `"Confirm the changes — apply what you just proposed."`. The cloud confirm gate
  (`service-ai-studio` `confirm-gate.ts` `APPROVAL_RE`) recognises
  `apply (this|the) change` — **not** "apply what". So the message failed the
  gate, and failing the gate is silent: the agent re-proposes instead of applying,
  and the Confirm button on the change card simply looks inert.

  This affected English conversations **and all eight locales that fall back to
  English** for that key. It is now
  `"Confirm — apply the change you just proposed."` — singular "the change", so it
  still matches if the gate ever tightens to a word boundary. The Chinese string
  was always fine (`确认修改` hits the 确认-anchored clause) and is unchanged.

  The same literal lives in four places — the locale pack, the
  `ChatbotEnhanced` prop default, its doc comment, and the `AiChatPage`
  `defaultValue` — and all four are updated together.

  **Why the existing guard missed it.** `i18n.test.ts` mirrored only the _Chinese_
  clause of `APPROVAL_RE`; the English half was reduced to "starts with Confirm,
  contains apply" because nothing in this repo could see the real pattern. That
  weaker assertion passed against a string the gate rejected — the guard was
  green and the feature was broken.

  The mirror is now **verbatim, both clauses**, and drives an `it.each` over every
  outbound approval message in both `zh` and `en`. Two supporting tests keep it
  honest: one asserting the gate stays narrow (a plain build request like
  "帮我搭建一个 CRM" must NOT read as approval), and one asserting
  `planAnswerMessage` does _not_ match — it answers a structure question and must
  never read as blanket approval.

  The mirror is duplicated across a repo boundary by necessity (objectui cannot
  import from cloud); the comment says so, so the next person changing
  `APPROVAL_RE` knows to update it here too.

- c6fd752: fix(app-shell): localize the two `DeclaredActionsBar` strings that bypassed i18n (objectui#2762 P0-3)

  The declared action _labels_ resolve through `useObjectLabel`, so a zh-CN
  workspace got 通过 / 拒绝 buttons — sitting inside a toolbar whose accessible
  name was the English literal `'Actions'`, above decision-output fields whose
  help text read `Handed to the flow as a decision output.` Both strings are
  authored by the bar itself rather than by metadata, and both skipped the locale
  bundle entirely.

  - `aria-label` now uses the existing `common.actions` key (a host-supplied
    `label` still wins).
  - The decision-output help text moves to new `actions.decisionOutput.help` /
    `.helpMultiValue` keys, added across all ten shipped locales.

  Worth being precise about why the help text needed fixing at all, since the
  runtime _does_ localize action params: `useConsoleActionRuntime` runs every
  param through `actionParamText`, but these params are synthesized here from the
  record's `decision_output_defs`, so their key path (`outputs.<key>`) is dynamic
  and no `_actions.<action>.params.*` bundle entry can ever match it. The
  fallback is not a rare path — it is the only path, which is why the English
  survived.

  Not fixed, and deliberately: a decision output that arrives without a `label`
  still renders a title-cased version of its machine key. That derived text
  mirrors the framework's `humanizeFieldPath` convention, and the real fix is the
  backend declaring the label — a client-side bundle cannot key off a dynamic
  output name.

- e05f052: feat(i18n): translate the four highest-traffic namespaces into the eight trailing locales (objectui#2872 part a)

  Backfills `console`, `home`, `topbar` and `layout` — 193 keys × 8 packs, 1,544
  strings — so a ja/ko/de/fr/es/pt/ru/ar admin sees the AI console, the home
  screen, the top bar and the system navigation in their own language instead of
  silently falling back to English.

  The gap in those eight packs drops from **469–471 keys to 277–279**. `en` and
  `zh` remain at exact parity (2499 : 2499, zero difference in both directions).

  This is the "high-frequency namespaces only" strategy from the objectui#2872
  discussion, not a full backfill: `grid` (101), `gantt` (58), `dashboard` (25)
  and the long tail stay on English fallback and remain tracked there.

  **Four keys are deliberately left untranslated**, and that is the load-bearing
  part of this change:

  ```
  console.ai.planApproveMessage
  console.ai.planApproveDefaultsMessage
  console.ai.planAnswerMessage
  console.ai.changesConfirmMessage
  ```

  These are not labels. They are the text a button _transmits to the agent_, and
  the cloud confirm gate (`service-ai-studio` `confirm-gate.ts` `APPROVAL_RE`)
  decides whether that text reads as approval. It recognises Chinese and English
  — nothing else. `AiChatPage` therefore selects them by the language of the
  CONVERSATION rather than of the UI, and the `t()` call is _expected_ to miss in
  every non-Chinese pack and fall through to its English `defaultValue`.

  Translating them would be an outright regression: a German user's "Build it"
  would start sending German, the gate would stop matching, and the agent would
  re-propose instead of building — the button looks inert while nothing visibly
  errors.

  objectui#2900 shipped precisely that bug for `changesConfirmMessage`, which had
  been added to all ten packs. **This change removes it from the eight**,
  restoring the English fallback. A new guard,
  `packages/i18n/src/__tests__/outbound-agent-messages.test.ts`, pins the
  invariant in both directions: the four keys must be absent from the eight packs
  AND present in `en`/`zh`, while every _other_ `console.ai` label must be
  translated — so the narrow fix can't be over-applied into an excuse for leaving
  surrounding labels in English.

  Translations are model-generated and would benefit from native review; the
  placeholder set of every string was verified programmatically against the
  English source.

- 0502a7c: test(i18n): ratchet the four backfilled namespaces so they cannot silently erode

  objectui#2903 translated `console`, `home`, `topbar` and `layout` into all ten
  packs. Nothing stopped that from decaying: `fallbackLng: 'en'` means dropping a
  key from `de` renders English, which reads as "not translated yet" rather than
  "we lost this", and the missing-key handler is dev-only so CI never sees it.

  This is objectui#2872's P3 (full parity test) applied **only to the namespaces
  that are actually complete**. Full parity would fail today by ~277 keys per
  pack with no action attached to it, which is a broken build rather than a
  guard. Widen `RATCHETED_NAMESPACES` as each remaining namespace is translated —
  not before.

  Asserts both directions, because the packs have drifted both ways before:

  - every ratcheted `en` key exists in all nine other packs;
  - no pack defines a ratcheted key that `en` lacks — objectui#2872 part (b) was
    exactly this failure, 74 keys deep, hidden behind a component-private
    fallback so English "happened to" render.

  The four outbound agent messages are excluded, since they are deliberately
  absent from the eight non-gate packs; `outbound-agent-messages.test.ts` owns
  that invariant and the two guards would otherwise contradict each other.

  A non-vacuity assertion pins the ratchet at >300 keys and requires every named
  namespace to contribute, so a rename can't quietly reduce the whole file to a
  no-op.

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

- 09c6a17: fix(grid): localize import result errors (objectstack#3566)

  The import completion screen rendered the raw English server message verbatim —
  e.g. `Row 6 (position): position: "装配工" matches more than one
os_tianshun_ehr_position — use a unique value or the record id` — with the field
  name twice, an internal object api-name, all in English, while the dry-run panel
  already localized the same errors.

  - The result list now runs through the same `formatDryRunError` path (driving
    off the structured error `code`, resolving the api-name to its field label,
    dropping the duplicated `<api-name>:` prefix). Threaded the error `code`
    through `ImportResult.errors` to make this possible.
  - Added code-driven translations for the remaining structured import errors —
    `invalid_boolean` / `invalid_number` / `invalid_date` / `invalid_option` /
    `required` / `AMBIGUOUS_MATCH` — with Chinese (`zh`) copy in `@object-ui/i18n`
    alongside the existing reference errors.

- ba73a02: fix(kanban): surface off-column records in an "Uncategorized" lane instead of dropping them (#2792)

  Records whose `groupBy` value matched no declared column were bucketed and then silently discarded — the board rendered empty while the list footer still counted the rows, so it read as data loss (a status the board doesn't render, an edited/removed picklist option, imported legacy data, or an empty value all triggered it). They now land in a trailing "Uncategorized" lane so no record is invisible and the visible card total reconciles with the record count. Dragging a card out of that lane into a real column repairs its status; the drag handler refuses to persist a move _into_ the lane (its sentinel id is not a real option). Adds `kanban.uncategorized` to the en/zh bundles.

- 9b4b952: fix(i18n): make `en` the complete source of truth for grid import and set-password (objectui#2872 b/c)

  The `en` and `zh` packs had drifted in both directions, silently, because
  `fallbackLng: 'en'` degrades a missing key into English rather than an error and
  the missing-key handler only fires in dev.

  - **74 keys existed only in `zh`.** `grid.import.*` and `auth.setPassword.*` had
    never been added to `en`, so no other locale could translate them: the English
    text came from call-site `defaultValue:` args and a private map inside
    `ImportWizard`. They now live in `en`, which is what translators and
    `os i18n extract` read.
  - **4 `en` keys were missing from `zh`** (`console.commandPalette.title`,
    two `console.ai.suggestions.metadataAssistant.*`, `help.keyboardShortcuts`),
    so Chinese users saw English.

  `grid.import` in particular had three disagreeing sources — the `en` pack (62
  keys), `zh` (130) and `ImportWizard`'s own fallback map (133), union 134, no two
  the same set. All three are now aligned on 134.

  The wizard's fallback map is kept, not deleted: it is what lets the wizard render
  with no `I18nProvider` mounted (standalone embedding, unit tests). It is instead
  pinned to the `en` pack by a new test, so the two can no longer drift.

  `SetPasswordPage` drops its now-redundant inline `defaultValue:` args; the text
  is byte-identical, it just comes from the pack now.

  Adds two guards, both mutation-verified:

  - `en` ↔ `zh` full key parity, asserted in both directions. The other eight
    packs are still ~357 keys behind and are tracked separately (objectui#2872
    part a), so they are deliberately not asserted yet.
  - `IMPORT_DEFAULT_TRANSLATIONS` ↔ `en.grid.import`, same keys and same text.

- 7d46648: fix(hooks): stop calling translation hooks inside try/catch (objectui#2879)

  Eleven call sites wrapped a React hook in `try`/`catch` to make it
  "provider-safe". `useObjectTranslation` and `useObjectLabel` already are — they
  read context optionally and fall back to react-i18next's global instance, and
  never throw. The `catch` bought nothing and cost correctness: a throw _after_
  the hook ran desyncs hook order on the next render, because React matches hooks
  positionally. objectui#2595/#2596 fixed exactly this in `@object-ui/i18n`'s
  `createSafeTranslation`; nine plugin-local re-implementations kept their own
  copy of the bug, and two more (`ObjectTimeline`, `ObjectView`) were found by the
  new lint rule below — `ObjectView` had even suppressed
  `react-hooks/rules-of-hooks` inline to keep it.

  - Six exact re-implementations now delegate to `createSafeTranslation`:
    `plugin-detail`, `plugin-timeline`, `plugin-list`, `plugin-calendar`,
    `plugin-grid`'s `ObjectGrid`, `plugin-designer`.
  - `components`' `data-table` also delegates; `createSafeTranslation` now
    returns `language` alongside `t` so consumers that localize dates don't need
    a second hook call. Purely additive.
  - `plugin-gantt` and `plugin-grid`'s `ImportWizard` keep their local hooks —
    they fall back _per key_, which a single-probe factory cannot express and
    which their comments justify (a host dictionary that covers common keys but
    lags on newer ones). Only the `try`/`catch` is removed.
  - `ObjectTimeline` and `ObjectView` call the hook directly and probe the
    returned value, mirroring `useSafeFieldLabel`.

  Adds `object-ui/no-try-catch-around-hook` (error) so a twelfth copy fails CI.
  It only matches `use*` names, accepts member calls solely on `React` (so
  `vi.useRealTimers()` is not a hook), and resets its try-depth inside nested
  functions (so `renderHook(() => useThing())` inside a `try` is fine) — both
  false positives were real code in this repo and are pinned in the rule's tests.

  `eslint-rules/**/*.test.js` matched no vitest project glob, so the local
  plugin's specs had never run in CI. They are now included; all three pass.

  `ObjectTimeline`'s test mock of `@object-ui/react` omitted `useObjectLabel` —
  the removed `try`/`catch` had been silently absorbing that gap. The mock is now
  complete.

- bb4aa25: fix(i18n): apply globalActions label overlays to actions surfaced on a record-detail action bar (objectui#3372)

  On a record-detail action bar the caller passes `objectDef.name` for **every**
  action, so a `globalAction` surfaced there (e.g. `log_call`) looked up
  `objects.<obj>._actions.<action>.label`, missed, and leaked the English
  metadata literal ("Log a Call") instead of its `globalActions.<action>.label`
  overlay ("记录通话"). Object-owned actions on the same bar translated fine,
  which is what made the gap visible.

  `useObjectLabel()`'s action resolvers now mirror the canonical
  `@objectstack/spec` resolver (`system/i18n-resolver.lookupActionField`): when an
  action is object-scoped, the object key still wins, but `globalActions.<action>.*`
  is consulted as a fallback before returning the literal. This applies uniformly
  to `actionLabel`, `actionConfirm`, `actionSuccess`, `actionDescription`,
  `actionResultDialog`, `actionParamText`, and `actionParamOptionLabel`, so a
  globalAction resolves the same on a record-detail action bar as it does
  everywhere else. App-namespace discovery also recognises a `globalActions`-only
  bundle (one with no object/field entries).

- 75f1cdf: fix(auth): localize the ADR-0069 remediation gate and the auth split-panel (#2870)

  `RemediationOverlay` had no i18n at all. It is the full-screen gate mounted
  unconditionally at `ConsoleShell` (`fixed inset-0 z-[200]`) that a user hits
  when the backend returns `PASSWORD_EXPIRED` or `MFA_REQUIRED` — there is no
  route around it, so a user who could not read English could not get back into
  the product. That makes it a usability block rather than a cosmetic gap.

  - New `auth.remediation.*` namespace in all ten locale packs, covering both
    branches of the gate: expired-password (title, three field labels, submit /
    submitting, mismatch and failure messages) and MFA enrolment (password step,
    QR scan copy, backup-code disclosure, code entry, verify / verifying, and the
    enrolment and invalid-code failures), plus the shared "sign out instead" exit.
  - Validation and failure messages are translated where they are raised, since
    they are held in component state and rendered later.
  - The server-provided `remediationRequired.message` is left untouched; only the
    empty-message fallback is localized.
  - `AuthPageLayout`'s two marketing strings move to `auth.layout.*`. The forms it
    wraps were already localized, so the split-panel had been rendering half in
    the user's language and half in English.

  Adds a locale-parity test over both namespaces, asserting an identical key set
  across all ten packs, a non-empty string at every leaf, and that prose differs
  from English (short labels like "Continue" legitimately collide). i18next falls
  back to `en` silently and its missing-key handler is dev-only, so a key added to
  one pack and forgotten elsewhere is invisible in whichever locales get tested by
  hand.

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

- c6aaed8: fix(i18n): retire four hand-rolled zh/en branches (objectui#2871, part 1)

  Four surfaces decided their language with a hand-written `startsWith('zh')`
  check instead of the locale packs, so the other eight shipped languages
  silently rendered English and the strings could never be translated without a
  code change.

  - **`RecordTitleChip`** carried a private zh-CN/zh-TW dictionary behind a
    comment claiming "components is i18n-free". That is not true —
    `@object-ui/components` declares `@object-ui/i18n` and its sibling
    `containers.tsx` already uses it. All four of its keys (`detail.copied`,
    `detail.copyRecordId`, `detail.addToFavorites`, `detail.removeFromFavorites`)
    already existed in **all ten packs**, so this deletes ~35 lines and fixes ten
    locales with zero new translations. It renders on every record detail page.
  - **`EnvironmentListToolbar`**'s three state-aware CTA labels move to a new
    `environment.*` namespace. This surface had already regressed once for the
    same reason (#844) and was fixed then with inline `{en,zh}` pairs.
  - **`StudioAiCopilot`**'s dock title moves to the Studio catalog as
    `engine.studio.aiCopilot`.
  - **`StudioHomePage.relativeTime`** now uses `Intl.RelativeTimeFormat` with
    `numeric: 'auto'` instead of five `zh ? … : …` ternaries. This is strictly
    better than adding ten catalog keys: it covers every locale, applies the
    correct plural rules, and yields "yesterday" / 「昨天」 rather than "1d ago".
    Arabic gets its dual form («أسبوعين») — something a ternary cannot express.

  The new `environment.*` keys are added to all ten packs, so this does not widen
  the gap tracked by objectui#2872 part (a).

  `EnvironmentListToolbar`'s tests now render inside a real `I18nProvider` pinned
  to `en`. Without one, `t()` returns the raw key, so the previous assertions on
  literal English would have been asserting nothing.

- 263f885: fix(i18n): delete the four `pick({en,zh})` clones (objectui#2871, part 2)

  Four files each carried an identical private resolver:

  ```ts
  function pick(label: I18n): string {
    const lang = document.documentElement.getAttribute("lang") || "en";
    return lang.toLowerCase().startsWith("zh") ? label.zh : label.en;
  }
  ```

  Only Chinese was ever handled, so ja/ko/de/fr/es/pt/ru/ar silently rendered
  English — and because the copy was baked into the components as inline
  `{en, zh}` pairs, no translator could reach it. All four copies are deleted
  along with their `I18n` type alias.

  Migrated to the locale packs, **all ten languages**:

  - `excelImport.*` (8 keys) — `ExcelImportBar`. The completion toast becomes a
    proper `{{count}}` / `{{object}}` interpolation instead of a template literal
    baked into both language variants.
  - `cloudOnboarding.*` (5 keys) — `CloudOnboardingNext`, the Cloud welcome page.
  - `aiModelStatus.*` (11 keys) — `CloudAiModelStatus`, including the
    `sourceLabel()` enum→prose helper (now `t`-driven with a `{{source}}`
    placeholder) and the three `ModelRow` labels. The conditional
    `(HTTP nnn)` fragment becomes two whole sentences rather than a string
    spliced mid-clause, which is not translatable into every word order.
  - `chatbotQuota.*` (4 keys) — the AI quota banner in `ChatbotEnhanced`.

  The chatbot banner keeps choosing between the server's `quota.message` (zh) and
  `quota.messageEn` — that pair is server-owned — but now decides using the
  console's active language instead of `navigator.language`, which had ignored
  the in-app locale switcher entirely.

  `CloudOnboardingNext`'s tests now render inside a real `I18nProvider`; without
  one `t()` returns the raw key, so the previous assertions on literal English
  were asserting nothing.

  This completes the `pick()` cluster from #2871. The remaining
  `startsWith('zh')` sites are the ones that classification marked KEEP —
  `LoadingScreen` (bootstrap, selects real locale packs before i18next is up),
  `conversationLanguage` (detects the chat's language for the agent, not UI
  copy), `containers.tsx` (normalises author-supplied schema data; its `'与'`
  separator is a CJK typography rule), and the Studio catalog / `field-types.ts`
  data catalog.

- dc334da: fix(i18n): close the last three zh-branch gaps (objectui#2871, part 3)

  The three items the #2871 classification marked as real but _not_ a
  migrate-the-copy fix. Each needed a different remedy.

  **`LoadingScreen` — ten languages collapsed to two.** The boot splash already
  selected real locale packs (not inline copy), but through
  `lang.startsWith('zh') ? zh : en`, so a ja/ko/de user watched the whole startup
  in English. It now indexes `builtInLocales` by the two-letter prefix.

  Each field falls back to `en` **individually**, which matters: `console.*` is
  one of the namespaces that trails in the non-`zh` packs (objectui#2872 part a),
  so a whole-object swap would have rendered `undefined` on the splash rather
  than English. `console.loadingHint` was in fact missing from all eight — added
  here, since a blank line under the progress list is worse than an English one.

  **`containers.tsx` — two language sources that could disagree.** The tab-label
  call sites resolved `language` from `useObjectTranslation()`, then handed the
  string to `translateLabel`, which called `detectLocale()` and read
  `document.documentElement.lang` on its own. Those update independently, so an
  in-app language switch could leave a tab label and its surrounding chrome in
  different languages until the next reload. `language` is now threaded in, and
  `detectLocale` is deleted so nothing reaches for the DOM again.

  **`field-types.ts` — a two-language data catalog.** `FieldTypeMeta` carried a
  `labelZh` column beside `label`, which capped the field-type picker at English
  or Chinese by construction. The 46 type names and 9 category names move into
  the Studio catalog as `engine.fieldType.<id>` / `engine.fieldCategory.<cat>`,
  generated from the existing values so no wording changes. This removes the
  `isZh` helper from **both** `ObjectFieldInspector` and `ObjectFormCanvas` — the
  two files the classification listed as "keep the component, fix the catalog".

  The picker's search filter previously matched `id`, the English label, and
  `labelZh` — so searching in Japanese or German matched nothing. It now matches
  the label as the user actually sees it.

## 16.1.0

### Minor Changes

- af1b0db: feat(i18n): localize action result dialogs via the `_actions.<action>.resultDialog` convention

  The post-success secret-reveal dialog (create-user temporary password, 2FA
  backup codes, OAuth client secrets) always rendered the hardcoded English
  metadata literals — the spec bundles now carry `resultDialog` translations
  (objectstack `_actions.<action>.resultDialog.*`), but nothing resolved them
  client-side.

  - **@object-ui/i18n.** `useObjectLabel()` gains `actionResultDialog(objectName,
actionName, spec)`: overlays translated `title` / `description` /
    `acknowledge` and per-field labels onto the metadata spec, falling back to
    the literals. The `fields` node is keyed by the LITERAL result-field path
    (may contain dots, e.g. `"user.email"`), so it is fetched whole with
    `returnObjects` and indexed directly — never resolved through a dotted
    i18next key. Built-in locale packs also translate the dialog's fallback
    `defaultTitle` / `acknowledge` (previously English in all ten locales) and
    add the new `actions.resultDialog.copyAll` key.
  - **@object-ui/app-shell.** The result-dialog handlers in
    `useConsoleActionRuntime` and `RecordDetailView` accept the action context
    (already passed by `ActionRunner`) and localize the spec before opening the
    dialog; `ActionResultDialog`'s hardcoded "Copy all" button now goes through
    `actions.resultDialog.copyAll`.

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

- 1100a8b: feat(plugin-gantt)!: remove the 移动端二维码 (mobile QR share) context-menu item

  The QR-share feature is removed outright: the context-menu item, the QR dialog,
  the `taskUrl` prop on `GanttView`, the URL wiring in `ObjectGantt`, the
  `gantt.menu.qrcode` / `gantt.qr.*` i18n keys (en/zh) and the `qrcode`
  dependency are all deleted. It baked one consumer's app-specific requirement
  (scan-to-open on mobile) into the generic gantt renderer, and what it encoded —
  the desktop console record URL — was not even the right target for that
  requirement. Apps that need scan-to-mobile flows should implement them
  app-side against their own mobile surface.

- 7abe4cd: **Console user-import wizard defaults to the `auto` password policy (tracks framework#3236).** The "Sign-in setup for imported users" selector gains an **Automatic (recommended)** option and it is now the default (was "No password"). `auto` decides per row on the server: reachable users get an invitation (email / SMS), anyone who can't be reached gets a one-time password shown once on the result screen — so it works with or without an email/SMS service, and the one-time-password reveal now surfaces only the rows that actually fell back (instead of the whole batch under `temporary`).

  The other three policies are unchanged and still selectable: `invite` (force invitations, unreachable rows fail), `temporary` (force one-time passwords for every row), `none` (identity only). New `console.identityImport.policy.auto` / `policyHint.auto` strings added for `en` and `zh`; the `none` label drops its "(recommended)" marker.

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

- f80aaf2: **Distinguish writable `system` objects from engine-owned ones in the Console (framework ADR-0103 / #3220).** The framework split the overloaded `managedBy: 'system'` bucket: engine-owned rows stay read-only, but several `system` objects are admin/user-writable _data_ (Notification Preferences/Subscriptions/Templates, delegated RBAC assignments, user preferences) and declare `userActions` opening their writes.

  The Console already surfaced the New/Edit/Delete buttons correctly for these (all affordance mirrors honour `userActions`), but the badge and empty-state _copy_ still called every `system` object a "read-only monitoring surface". Now:

  - **`ManagedByBadge`** takes the object's `userActions` and, when a `system` object opens any write, renders the "Platform schema — admin-writable" variant instead of the engine-owned copy.
  - **`resolveManagedByEmptyState`** returns `undefined` for a `system` object whose `userActions.create` is set, so the generic empty state (with the New button) shows instead of "entries appear automatically".
  - New `managedByBadge.systemWritable.*` strings (en + zh; other locales fall back to the English default).

  Copy/UX only — no behavioural change to what a user can do.

- 29c6040: fix(app-shell): redo the record-list "Add View" create flow — empty-name 405, invisible drafts, canonical naming

  Rebuilds the record-list "Add View" / "Save as view" create path so a
  runtime-created view has one canonical identity and is actually verifiable
  before publish (supersedes #2754; fixes #2767).

  - **Unified identity (P1).** New `viewEnvelope(objectName, spec, { name, label })`
    seam in `runtime-metadata-persistence.ts` emits the canonical ViewItem
    (`{ name: '<object>.<key>', object, viewKind: 'list', label, config }` with
    `config.data = { provider: 'object', object }`), mirroring the Studio
    `anchors.ts:createBuildBody`. The **qualified** name is passed as BOTH the
    `PUT /meta/view/:name` URL segment and `body.name`, so the `sys_metadata`
    row key, the ViewTabBar tab id, and the body identity all agree and the
    draft → read → publish loop resolves. `ObjectView` and `ObjectDataPage` both
    call the single helper — the duplicated envelope block is gone (P6).
  - **Empty-name guards (405).** `MetadataClient.save()` and
    `createRuntimeMetadata()` throw a clear contextual error instead of emitting
    `PUT /meta/view/` (empty `:name`, server 405).
  - **Draft visibility (P2/P3/P4).** `DataSource.listViews(objectName, { previewDrafts })`:
    in draft-preview mode the `ObjectStackAdapter` makes a **single**
    `MetadataClient.withPreviewDrafts(true).list('view')` request and uses the
    server's already-overlaid list (draft wins by name, `_draft` tagged) —
    replacing, not appending, so a draft that edits a published view can't
    double-tab. No hand-rolled `fetch` of metadata routes at the adapter layer.
    After a create in normal mode the console navigates to the new view with
    `?preview=draft`, so the DraftPreviewBar is visible and Publish is one click.
  - **CJK-aware naming (P5).** `CreateViewDialog` gains an editable machine-name
    field, prefilled via `slugify(label)` for Latin labels and required (submit
    disabled) when slugify yields empty for non-Latin labels — no more silent
    random `task_grid_mrsyt56j` names. New `console.objectView.viewName*` keys
    (en/zh).

## 16.0.0

### Patch Changes

- ca0f5f0: Login page surfaces the dev-seeded admin credentials. The framework runtime seeds `admin@objectos.ai` on an empty development database, but nothing on the login page said so — new users clicked "Sign up" and landed in an empty non-admin workspace (15.1 third-party eval). When `GET /api/v1/auth/config` reports `devSeedAdmin` (dev-only; the server omits the field in production and once the default password is changed), the page renders a dismissible amber banner with the credentials. Dismissal persists per browser via localStorage.

## 15.0.0

## 14.1.0

### Patch Changes

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

- e628d1f: Dashboard-level filters follow-ups (#2578, framework#2501):

  - **i18n**: the `DashboardFilterBar` strings now ship as real locale entries —
    `dashboard.filters.*` (bar label, "All time", "Custom…", "All", "Reset",
    and the 13 date-range preset labels) added to `en` and `zh`. Previously the
    bar always rendered the `useSafeTranslate` English fallbacks.
  - **types**: `GlobalFilterSchema.name` and `DashboardWidgetSchema.filterBindings`
    landed in `@objectstack/spec` (framework#2501), so the local type
    annotations flip from "Pending alignment" to "Aligned" — no shape changes.

  Also adds five schema-catalog examples (`plugin-dashboard/filtered-dashboard-*`:
  dynamic `optionsFrom` options, text/number/lookup filter types, dataset +
  inline widget mix, `targetWidgets` allow-list, date presets + custom range)
  and a new "Dashboard-Level Filters" guide page covering the full tutorial,
  `page.*` expression usage, and known limitations with workarounds.

- 23d65c3: fix(i18n): `createSafeTranslation` / `useSafeTranslate` no longer wrap the
  translation hook in try/catch — the last known rules-of-hooks violation of
  the class fixed in objectui#2595/#2596 (a throw after the hook ran would
  desync hook order on the next render; the factory closure just escaped the
  static lint). `useObjectTranslation` is provider-safe, and the actual
  fallback behavior is unchanged: the testKey probe (createSafeTranslation)
  and per-key `t(key) === key` detection (useSafeTranslate) still return the
  English defaults when translations aren't configured. The fallback `t` is
  now a stable per-factory reference, so downstream memo deps stop
  invalidating every render in the no-translations case.

## 14.0.0

### Patch Changes

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

- 05e56ca: 导出/导入模板的下载文件名与内容本地化。

  **导出文件名**:CSV/Excel/JSON 导出下载不再是 `<对象名>.<扩展名>`(如 `contracts.csv`),改为「对象显示名-视图名-时间戳.扩展名」(如 `任务-In Progress-20260714-153045.xlsx`);`exportOptions.fileNamePrefix` 配置仍优先(且作为完整前缀,不再追加视图名)。视图名与对象名重复时自动省略;`@object-ui/core` 新增 `buildExportFileName(ext, { prefix, label, objectName, viewLabel }, now?)` 与 `sanitizeFileNameBase(raw)`,ObjectGrid 与 ListView 的所有导出路径(服务端流式与前端兜底)统一走它。app-shell/plugin-view 的 ObjectView 现将当前视图的显示标签写进传给 ListView 的 schema(`label`),使导出文件名能区分同一对象的不同保存视图。

  **导入模板**:「下载模板」修复两处英文漏出——示例行的 select/多选取值改为优先取选项**显示标签**(如 `准备中`)而非 ASCII slug(`prepare`,服务端导入两者都接受);模板文件名本地化为 `{{object}}-导入模板.csv`(新增 i18n key `grid.import.templateFileName`,英文回退 `{{object}}-import-template.csv`)。

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

## 13.2.0

### Patch Changes

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

## 13.1.0

## 13.0.0

### Minor Changes

- 9e38270: feat(setup): "Connect an agent" page widget (`mcp:connect-agent`) — framework#2714 Phase 1, #2363

  The interactive body for the plugin-carried Setup page shipped by
  `@objectstack/mcp`: the environment's MCP URL (from `/discovery`), per-client
  connect cards (claude.ai/Desktop, Claude Code incl. the official plugin,
  Cursor one-click deeplink, VS Code, Codex CLI), the SKILL.md download
  (`GET /api/v1/mcp/skill`), and show-once API-key minting for headless
  callers via the existing `POST /api/v1/keys`. Renders a disabled empty state
  when discovery doesn't advertise `routes.mcp` (deployment opted out).
  Translations for all nine locales.

## 12.1.0

### Minor Changes

- e1840bf: Signal the platform's preview stage in the UI.

  The console top bar (`AppHeader`) now shows a small **Preview** chip next to the
  product wordmark on every surface (home / app / orgs), so users always know the
  whole platform is pre-GA. It's a new `PreviewBadge` component driven by a
  `branding.stage` field in runtime-config (`'preview' | 'beta' | 'ga'`, exposed
  via `getPlatformStage()`), which defaults to `'preview'` so the badge shows out
  of the box. Operators flip the stage to `'ga'` at launch (`OS_PRODUCT_STAGE` /
  `RuntimeConfigPlugin`) and the badge disappears with no code change; `'beta'`
  renders a "Beta" chip instead. Labels are localized under `topbar.stage.*`.

### Patch Changes

- 6cbccf3: Localize form validation messages, toast client-side validation failures, and make native date/time picker icons legible in dark mode.

  Record-form validation messages (required, min/max length, min/max value, pattern, email, URL) were hard-coded English even when the field label was localized — e.g. a Chinese "计划开始日期" field showed "计划开始日期 is required". `buildValidationRules` baked English strings, so the form renderer's `t(...)` fallback never applied. It now emits `required: true` and, for the other rules, a `messageKey` + `undefined` message (a field-authored `*_message` still wins and passes through verbatim); the form renderer fills the blanks via i18n (`validation.*` keys already exist in every locale), so messages track the label's language.

  When client-side validation blocks a submit, the offending field's inline error can sit below the fold in a long modal/drawer form — the user clicks 创建 and sees nothing happen. The form renderer now also fires a `toast.error` naming the fields (`validation.formInvalid`, added to all 10 locales), mirroring the existing server-error toast so the feedback is visible regardless of scroll position.

  Separately, native controls now declare `color-scheme` (`light` on `:root`, `dark` on `.dark`), so the webkit calendar-picker-indicator and other built-in glyphs render light-on-dark instead of vanishing against the dark input background.

## 12.0.0

## 11.5.0

### Minor Changes

- 544d8eb: Add the app → Studio reverse bridge (ADR-0080): workspace admins see a "Design in Studio" entry in the app top bar that deep-links to the running app's owning package on the Studio design surface (`/studio/:packageId/data`). Hidden for non-admins and for apps with no owning package; package writability stays server-side (read-only packages open as browse-only).
- 1072701: Import wizard: use registered server-side import mappings (framework #2611). When an object has `mapping` metadata artifacts targeting it, the wizard shows a "Saved mapping" selector; picking one hands rename + transforms + write semantics to the server (the artifact is authoritative), replaces the manual column table with a read-only summary of the mapping, and submits `mappingName` over source-header rows (mutually exclusive with the inline column rename). `ImportRequestOptions` gains `mappingName`; the objectstack adapter gains `listImportMappings(objectName)` (feature-detected — the selector simply doesn't appear when unsupported). New `grid.import.*` strings added across all locales.

## 11.4.0

### Patch Changes

- 9cd9be1: fix(plugin-grid): make the import wizard's preview step readable — wider columns + friendlier validation errors

  Two problems on the import wizard's 预览 (preview) step:

  - **Cramped preview table.** With many mapped columns crammed into the fixed
    dialog width, each header collapsed to one character per line (`关联排班计划`
    stacked vertically) and became unreadable. Columns now get a `min-width` and
    headers no longer wrap, so the preview area scrolls horizontally instead of
    crushing every column.

  - **Unreadable dry-run error messages.** A reference cell that couldn't resolve
    rendered as `第 1 行: product: product: no os_tianshun_ehr_product matches "导管架"`
    — the field named twice, an internal object api-name leaking through, all in
    English. The server already tags each failure with a structured `code`, so we
    now drive the message off that code (localized, with the offending value),
    resolve the field's api-name to its label, and only fall back to the raw
    server text — minus the duplicated prefix — for unrecognized codes. The same
    row now reads `第 1 行: 产品：找不到匹配 "导管架" 的记录`.

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

## 11.3.0

### Patch Changes

- d88c8ec: fix(data-table): surface inline-edit save failures instead of swallowing them

  A rejected inline-edit save (e.g. a 400 validation failure like an invalid
  status transition) was caught with only `console.error` — the toolbar stayed
  stuck, the cell kept the unsaved value, and the author got no feedback. Now the
  data-table shows the server's reason in the toolbar (with an alert icon) and
  tints the affected row(s) destructive so it's clear which rows didn't persist.
  The pending edit is kept for retry; the error clears on a successful save or on
  cancel. Adds the `table.saveFailed` string across all locales.

## 11.2.0

## 11.1.0

### Patch Changes

- 6726a2b: First-run UX polish (objectstack-ai/objectui#2038) — copy improvements found via the ObjectOS Cloud signup walkthrough:

  - **"Organization" → "Workspace"** across the org picker (`organizations.*` strings, en + zh). The create flow + WorkspaceSwitcher already say "workspace"; the picker ("Your Organizations / No organizations yet") was the lone holdout. Now consistent.
  - **Non-admin empty state** — "There are no applications available to you yet. Please contact your workspace administrator." → "Your workspace is being set up — apps your admin shares with you will show up here." (less dead-end, en + zh).
  - **Cold-start reassurance** — new `console.loadingHint` line under the LoadingScreen steps: "Setting up a new environment can take a few moments." (en + zh).
  - **Signup value-prop** — register subtitle "Enter your information to get started" → "Create your account to start building." (en + zh).

## 7.3.0

## 7.2.0

### Patch Changes

- 8e7c1da: fix(preview): draft-preview bar no longer demands a redundant Publish when nothing is pending

  Under the auto-publish posture an AI build leaves zero pending drafts, yet opening a
  draft preview still showed "Draft preview — Nothing here is live until you publish."
  alongside "Changes (0)" and a Publish button — a self-contradicting, no-op call to
  action. `DraftPreviewBar` now reflects the real pending-draft count: when it is
  known to be zero the bar softens to a neutral preview indicator and drops the
  Publish/Changes affordances; an unknown count (still loading / fetch failed) keeps
  the publish path. `HomePage` (count-gated) and `RuntimeDraftBar` (draft-gated)
  already behaved this way — this aligns the third surface.

## 7.1.0

## 7.0.0

### Minor Changes

- 89e113c: ADR-0044 send-back-for-revision in the approvals inbox (framework #1744/#1769). Approvers get a "Send back" action (violet, with its own dialog) that ends the round as `returned` and unlocks the record; the submitter sees a revision panel on the returned request — edit-record link, optional comment, Resubmit (opens round N+1) and Recall (abandons the revision). New `returned` status badge/filter, Round-N chips (list + drawer), timeline rendering for `revise`/`resubmit` actions, `approvalsApi.sendBack/resubmit`, and ten-locale `approvalsInbox` strings.
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

### Patch Changes

- 77cc6bb: Cloud Connection bind v2 UX (cloud ADR runtime-identity-binding §2.3): the binding flow becomes one click. `CloudConnectionPanel` drops the environment-id input entirely (registration happens cloud-side at approval), auto-opens the approval page in a popup on Connect (user-code display stays as the popup-blocked fallback), and shows the registered runtime name + runtime id once bound. `DeviceAuthPage` displays the requesting device's context (`runtime_name` / `runtime_version` from the verification URL) plus an "only approve if you started this" warning — the informed-consent surface for the RFC 8628 flow. Two new `auth.device.*` keys across all locales.
- 97c6831: Localize AI workspace, shell navigation, startup, connection, toast, and chatbot affordance text across core console screens.
- c09f44e: Docs: mermaid diagrams + long-doc table of contents (ADR-0046).

  - **plugin-markdown** renders ```mermaid fenced blocks as diagrams (`<Mermaid>`: lazy-loaded mermaid, `securityLevel: 'strict'`, rendered post-`rehype-sanitize`by a trusted component, degrades to the raw source on error). Mermaid is text → SVG, so it stays within the v1 image/binary ban. Adds`extractToc(markdown)`— a TOC builder whose slugs are generated with the same`github-slugger` `rehype-slug`uses, so`#id` links resolve to the rendered heading anchors.
  - **console** `DocPage` shows a sticky right-rail table of contents (h2–h3) for docs with ≥3 headings, plus an app-independent `/apps/:packageId/docs` index already added earlier.
  - **i18n** adds `help.onThisPage` (en/zh; other locales fall back).

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

- 0ad72a6: fix: pass full gantt config to renderer, render multi-value lookups in gantt tooltips, persist `bodyExtra` on dataSource actions, and complete zh/en gantt labels

  Four platform gaps that the EHR app previously worked around with `node_modules` patches:

  - **app-shell / ObjectView** — the `config.gantt → renderer props` adapter was a hardcoded 6-field whitelist, so `parentField`/`typeField` (and `baseline*`, `groupByField`, `resourceView`, `tooltipFields`, `quickFilters`, …) never reached the renderer and the chart degraded to a flat list. It now spreads the full `viewDef.gantt` first, then applies the three required defaults last (mirroring the gallery branch).
  - **plugin-gantt / ObjectGantt** — the tooltip value formatter only handled single-object lookups, so a multi-value lookup (a populated `[{name},{name}]` array) fell through to `'—'`. It now maps each array element to its display value and joins them.
  - **app-shell / useConsoleActionRuntime** — `bodyExtra` was merged only on the absolute-HTTP path; the generic `dataSource.update` path ignored it, so a pure-confirmation action (no params array) left an empty payload and persisted nothing. `bodyExtra` is now merged last on that path too, matching the documented semantics.
  - **i18n** — added the gantt labels the 9.x renderer references but the bundles lacked: `toolbar.thisWeek/thisMonth/exportPdf/saveLayout`, `viewMode.year`, `menu.add*/removeDependency/noCandidates`, the `linkType.*` and `conflict.*` blocks, and `readOnly*` — in both `en` (canonical key source) and `zh`.

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

- 59b6bbb: i18n the managed-by empty states for system / append-only / better-auth object lists.

  `resolveManagedByEmptyState` previously hardcoded English titles and messages (e.g. "No identity records", "No events recorded"), so list views for managed objects (identity, audit logs, system-generated records) rendered English regardless of locale. It now takes the `t` translator and resolves `list.managedBy.{system,appendOnly,betterAuth}.{title,message}` (English kept as `defaultValue` fallbacks); `ObjectView` passes its `t` through. Added the keys to the `en` and `zh` locale packs.

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

- 2f31406: Refine Studio package-scoped navigation and home overview.

  Studio now treats the selected package as the home overview scope, flattens the root Overview sidebar group, hides the duplicate all-metadata sidebar entry, redirects the invalid package metadata route to package management, preserves the selected package across package-management navigation, and adds a localized package-management sidebar label.

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

## 5.4.2

## 5.4.1

## 5.4.0

## 5.3.2

## 5.3.1

## 5.3.0

## 5.2.1

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

### Patch Changes

- 321294c: Cmd-K now shows recently viewed records in its empty state, sourced
  from the existing cloud-synced `sys_user_preference` adapter (already
  wired by `RecentItemsProvider` + `useTrackRouteAsRecent` +
  `RecordDetailView`). Multi-device by construction: open a record on
  laptop, see it in `⌘K → Recently viewed` on phone.

  - Group renders only when input is empty (no competition with search).
  - Limited to the 5 most recent record-type entries.
  - New i18n key `console.commandPalette.recentRecords` (en + zh seeded;
    other locales fall back to `defaultValue: "Recently viewed"`).

- 0a644f0: feat(app-shell): CommandPalette searching indicator

  When `useRecordSearch` is mid-flight (debounced fetch across objects
  hasn't returned yet), the palette now surfaces a subtle visual:

  - A small pulsing primary-coloured dot next to the **Records** group
    heading, so the user sees that more results may still appear.
  - A `Searching…` placeholder inside the empty state when the user has
    typed something but no hits exist yet — replaces the static
    "No results found." message until the request settles.

  New i18n key `console.commandPalette.searching` (en + zh).

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

## 5.1.1

## 5.1.0

### Minor Changes

- 49b1760: Polish the ConcurrentUpdateDialog and add i18n.

  - Internationalise all dialog strings (title, body, button labels, "your edit" / "current value" headings, audit-trail line) through `useDetailTranslation`. Locale strings added to `@object-ui/i18n` for English and Chinese.
  - Replace the plain dialog header with an amber warning badge + `AlertTriangle` icon to communicate that this is a conflict, not a routine confirmation.
  - Visually differentiate the two value blocks: amber tint for the user's pending edit, sky tint for the server's current value. Both wrap long values cleanly.
  - Surface audit provenance for the racer's write (`updated_at`, plus `updated_by_name`/`updated_by_label` when supplied). Opaque ID-looking `updated_by` tokens are suppressed.
  - Re-prioritise the action buttons: **Reload latest** is now the primary/recommended action (autofocused), **Overwrite anyway** is rendered as a destructive-outline button so the dangerous path requires deliberate intent, and **Cancel** falls back to a ghost variant.

- c0b236f: Platform detail/form polish:
  - **Auto-section grouping**: When an object has no authored `views.form.sections`, the detail page now splits fields into a primary section and a collapsible "More details" section based on a field-type/name heuristic (textarea / markdown / description / notes / remarks). Eliminates the wall-of-fields layout on objects without explicit detail metadata.
  - **FormSection card chrome**: `FormSection` now accepts `showBorder`. Defaults to `true` for titled sections (Card wrapper) and `false` for untitled sections (flat). Same auto-default already applied to `DetailSection`.
  - **Origin breadcrumb**: Navigating from a list/kanban into a record now records the source view; the detail page shows a `← <view label>` back-link above the page header.
  - New i18n key `detail.sectionMoreDetails` (en + zh-CN).

### Patch Changes

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

## 5.0.1

## 5.0.0

### Patch Changes

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

## 4.8.0

## 4.7.0

## 4.6.0

## 4.5.0

### Patch Changes

- 22fa558: Clean up pre-existing TypeScript errors in `plugin-list` and tighten i18n:
  - Switch grouping-editor labels to `t(key, { defaultValue })` option form so i18next's strict types accept the literal fallback.
  - Add the missing `list.addGroup` / `list.collapsedByDefault` / `list.removeGroup` keys to en + zh locale bundles.
  - Drop the dead `currentView === 'list'` branch in `ListView` (local `ViewType` union has `'grid'`, never `'list'`).
  - Widen `UserFilters.resolveFields` `translateOptions` parameter from a generic `<T>` to the concrete option shape so it matches the `useObjectLabel` hook's signature.

## 4.4.0

## 4.3.1

### Patch Changes

- 5f4ac6e: fix(i18n): add notifications + organizations namespaces to all 8 non-en/zh locales (ar/de/es/fr/ja/ko/pt/ru) to restore top-level key parity. Resolves the long-standing i18n.test.ts locale-parity failure.

## 4.3.0

### Patch Changes

- f196cf4: feat(plugin-report): popup picker for groupings + section-aware test ids

  The matrix/summary "Group by" (rows) and "Columns axis" (cols) sections now
  share the same searchable popup picker as the columns section, with a
  commit-on-select single-pick mode wired through `FieldPickerDialog`.

  - Per-row field buttons display the human-readable field label and open a
    dialog scoped to swap that single field (already-used fields filtered out)
  - "Add grouping" trigger uses the same dialog
  - `GroupingsBuilder` accepts a `testIdPrefix` prop; ReportConfigPanel passes
    `rows-grouping` and `cols-grouping` so both instances no longer share the
    ambiguous `grouping-field-0` testid
  - Bigger row spacing (h-7 / text-xs) — the old `text-[10px]` was unreadable

  `FieldPickerDialog` gains:

  - `commitOnSelect`: hides the Confirm/Cancel footer; clicking a row commits
    - closes immediately (intended for `singleSelect` flows)
  - `trigger`: custom trigger element override (used by the per-row field button)

- ee1cc96: feat(plugin-report): joined-report block editor

  `type: 'joined'` reports were a black hole in the editor — the type
  selector exposed them but no UI knew how to edit the `blocks` array,
  so users could neither create nor modify joined reports without
  hand-editing JSON.

  This change adds a `Blocks` section to the report editor, visible only
  when `type === 'joined'`. Each block renders as a collapsible card with
  its own name (required + unique-validated), label, description, block
  type, object override, and reuses the existing `ColumnsEditor`,
  `GroupingsBuilder`, `SpecFilterAdapter`, and `ChartConfig` builders so
  every block behaves like a mini standalone report — matching the
  runtime contract of `JoinedReportRenderer`.

  Block-level validation is surfaced in the main `ValidationBanner`:
  empty blocks array, missing or duplicate block names, and blocks
  without columns all become editor-time errors so saves stay safe.

  The non-joined sections (Columns / Rows / Columns axis / Filters /
  Chart) are hidden when `type === 'joined'` since they live per-block
  in the spec.

  New exports from `@object-ui/plugin-report`:

  - `JoinedBlocksEditor` — standalone component for embedding the
    block editor anywhere.
  - `validateJoinedBlocks` — pure helper returning translated
    problem strings, suitable for custom validation banners.
  - `ColumnsEditor`, `GroupingsBuilder`, `ChartConfig`,
    `SpecFilterAdapter`, `normalizeColumns` are now exported so
    downstream consumers can build their own report-editor surfaces.

  i18n: added `report.editor.blocks*` / `report.editor.addBlock` /
  `report.editor.removeBlock` / `report.editor.blockName*` /
  `report.editor.blockLabel*` / `report.editor.blockDescription*` /
  `report.editor.validationJoinedNeedsBlocks` /
  `report.editor.validationBlockNameRequired` /
  `report.editor.validationBlockNameDuplicate` /
  `report.editor.validationBlockNeedsColumns` to en + zh.

- 0b032be: feat(plugin-report): replace inline column picker with a popup field picker

  The columns section now opens a Dialog-based multi-select picker (`FieldPickerDialog`)
  instead of rendering the unselected field list inline. The popup supports search,
  batched multi-selection (commit several fields in one click), per-field type badges,
  cancel-discards-pending semantics, and is fully i18n'd. Also fixes a latent
  `ReferenceError: normalizeColumns is not defined` that crashed the editor whenever
  the chart section was expanded.

- 115d36a: i18n: native translations for the report editor (`report.editor.*`) in 8 locales — ar, de, es, fr, ja, ko, pt, ru. Previously these locales had the English placeholder strings copy-pasted from `en.ts` and the newer `blocks*`, `addCondition`, `opContains`, `formatCurrency` etc. keys were missing entirely (so the report editor surfaced raw key names in those languages). All locales now carry the full key set with locale-appropriate copy.
- 4e7bc1b: **Report editor panel overhaul**

  The report configuration panel is now safe to open on any spec-shape `Report` and only exposes fields that are actually persisted by `@objectstack/spec`.

  `@object-ui/plugin-report`:

  - Add a bidirectional `SpecFilterAdapter` so `ReportConfigPanel` can edit
    spec `FilterCondition` filters (`{field: value}`, `{field: {$op: value}}`,
    top-level `$and`/`$or`). Complex / nested filters fall back to a
    read-only banner and are preserved verbatim on save.
  - Drop sections that never round-tripped through the spec
    (`conditionalFormatting`, `sections`, `export`, `schedule`, `appearance`)
    and their helper components.
  - Add type-driven section visibility: `tabular` shows Columns/Filters,
    `summary` adds Rows + Chart, `matrix` adds Rows + Columns axis + Chart.
  - New `GroupingsBuilder` covers `groupingsDown`/`groupingsAcross` with
    `sortOrder` and date-aware `dateGranularity` controls.
  - New `ColumnsEditor` lets users reorder picked columns, override labels,
    set aggregates and choose a display format.
  - Chart subset now mirrors the spec: chart `title`, `showLegend`,
    `showDataLabels`, plus `funnel` (scatter removed).
  - Validation banner highlights missing `objectName` and missing
    rows/columns for `matrix`/`summary` reports.
  - All editor labels and hints are i18n-driven (`report.editor.*`).
  - 18 new unit tests cover the filter adapter round-trip.

  `@object-ui/components`:

  - `FilterBuilder` now guards against malformed external `value` props.
    Previously a spec-shape filter (`{is_active: true}`) would crash the
    component on first render; the builder now falls back to an empty
    AND group whenever `value` is not a valid `FilterGroup`.

  `@object-ui/i18n`:

  - Add `report.editor.*` strings to `en` and `zh`.

- 8442c05: Improve report editor panel usability based on real-user browser testing:
  - **Wider config panel** — the report editor now defaults to a `--config-panel-width`
    of 440px (up from 280px), driven by a new optional `style` prop on
    `ConfigPanelRenderer`. Long field labels, report titles, type labels, and filter
    rows no longer truncate to "Account Na" / "kup" / "ct" / 1-character widths.
  - **Disambiguated "Columns" sections** — for `summary` and `matrix` reports the
    measure list is now labelled **"Values / 度量"** (pivot-style vocabulary) instead
    of "Columns", which previously clashed with the matrix's pivot column axis
    (also called "Columns / 列"). The two sections used to be indistinguishable.
    New i18n key `report.editor.values` / `valuesHint` is shipped for all 10
    locales (en, zh, ar, de, es, fr, ja, ko, pt, ru).
  - **Reordered sections for matrix/summary** — the editor now surfaces _Rows_
    and _Columns_ (the pivot axes) **before** _Values_, mirroring how a business
    user thinks about a pivot table.
  - **Per-row aggregate/format headers** — each column row in `ColumnsEditor` now
    shows small "Aggregate" / "Format" labels above the respective selects, and
    the row uses a 2-line layout so the label input has its own line. The cramped
    3-dropdowns-side-by-side layout at 10px font is gone.
  - **Searchable field picker** — the "Add columns" list now has a search box,
    a `filtered / total` counter, an empty-state message, and a scrollable bordered
    container. New i18n keys: `report.editor.searchFields`,
    `report.editor.noMatchingFields`.

## 4.2.1

## 4.2.0

### Patch Changes

- eb738bd: fix(i18n): add missing top-level `report` key to ar/de/es/fr/ja/ko/pt/ru locales

  The i18n parity test (`all locales have the same top-level keys`) was failing
  because the `report` key existed only in `en` and `zh`. The other built-in
  locales now include the same `report` block (English fallback strings) so the
  CI parity check passes again.

- 650392e: MatrixRenderer now displays i18n-translated labels for picklist (`select` / `status`) groupings instead of raw values (e.g. `Best Case` / `Commit` / `Pipeline` instead of `best_case` / `commit` / `pipeline`). Field labels in the corner cell, row/column total labels, and the `(Empty)` / `(All)` placeholders are also fully translated. Adds `report.*` keys to `en` and `zh` locale bundles.
- 84b4bf1: Summary reports now render i18n-translated labels in the chart axis, chart series legend, and totals strip. `buildChartData` accepts a new `labels` parameter so callers (currently `SpecReportGrid`) can supply field/column/aggregate/value resolvers. Replaces raw column keys (e.g. `Count of case_number`) and raw picklist values (e.g. `closed`, `in_progress`) with their translated display labels (e.g. `案例编号 · 计数`, `已关闭`, `处理中`). Adds `report.totals` locale key.

## 4.1.0

## 4.0.12

## 4.0.11

### Patch Changes

- 1909bc3: Add `transformSpecTranslations` / `isSpecTranslationData` helpers to
  `@object-ui/i18n` so apps no longer need to maintain their own copy of the
  `@objectstack/spec` `TranslationData` → flat namespace transform.

  The new transform preserves **every** `_`-prefixed object scope by
  convention (`_views`, `_actions`, `_sections`, `_notifications`, `_errors`,
  `_options`, plus anything added in future spec versions), which fixes a
  class of silent-failure regressions where new spec scopes were dropped
  during transformation — leaving e.g. list-view labels to fall back to the
  untranslated source string.

  `@object-ui/console`'s `loadLanguage.ts` is rewritten to delegate to the
  shared helper.

## 4.0.10

## 4.0.9

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

## 4.0.7

### Patch Changes

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

## 4.0.6

## 4.0.5

## 4.0.4

## 4.0.3

### Patch Changes

- 4be43e2: **Page-mode record forms (`editMode: 'page'`).** New per-object metadata flag that opts a record's create/edit form into a dedicated full-screen route (`/apps/:appName/:objectName/new`, `/apps/:appName/:objectName/record/:recordId/edit`). Two new declarative actions `navigate_create` and `navigate_edit` open these routes from JSON action buttons. Default modal behavior is preserved for objects that do not set `editMode`.

  **`@object-ui/plugin-list` & `@object-ui/plugin-detail`: `ComponentRegistry` singleton fix.** Both plugins' Vite configs now mark all `@object-ui/*` packages as external so each plugin no longer bundles its own private copy of `@object-ui/core`. Cross-plugin component lookups now resolve correctly from the same singleton registry. `plugin-list` dist shrank from multi-MB to 67 kB (gzip 16 kB); `plugin-detail` to 124 kB (gzip 28 kB).

  **`@object-ui/app-shell` `CreateViewDialog` churn fix.** `existingSet` is now memoised on the joined string key of `existingLabels` rather than the raw array reference, preventing the name-suggest `useEffect` from re-firing on every parent render.

  **CI fixes.** `ReportViewer` conditional-formatting test now accepts both `rgb(...)` and hex color representations. `ObjectView` i18n mocks rewritten to mirror the real hook shapes (`useObjectTranslation`, `useObjectLabel`).

## 4.0.1

## 4.0.0

## 3.4.0

## 3.3.2

## 3.3.1

## 3.3.0

## 3.2.0

## 3.1.5

### Patch Changes

- cfe0596: fix i18n

## 3.1.4

## 3.1.3

## 3.1.2

## 3.1.1

## 3.0.3

## 3.0.2

## 3.0.1

## 3.0.0

### Minor Changes

- 87979c3: Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0
