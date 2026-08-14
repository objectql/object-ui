# @object-ui/app-shell — Changelog

## 17.5.0

### Minor Changes

- 38ab505: Retire the `global_nav` Studio designer surfaces, and track the `@objectstack` family at `17.0.0-rc.6` (objectstack#7100 / objectstack#6888).

  ## The retirement

  `global_nav` was an `ACTION_LOCATIONS` member no running-app surface ever rendered. The console's ⌘K palette (`app-shell/src/chrome/CommandPalette.tsx`) builds its groups from nav items, objects, dashboards, pages, reports, recent items, record search and theme; it holds no reference to `global_nav`, to `actionRendersAt`, or to any action-metadata source. An action declaring `locations: ['global_nav']` therefore never reached a user.

  The Studio designer previewed it anyway — a mock frame reading `⌘K · Command palette` with the author's button inside it. That is the sharp edge the maintainer's 2026-08-09 ruling on objectstack#6888 named: an authoring tool promising a surface the product does not have teaches authors, and every AI copying this corpus, to declare dead metadata. `@objectstack/spec` `17.0.0-rc.6` retired the member (7 members → 6) with a named rejection message; this release removes the designer surfaces that outlived it.

  - `metadata-admin/previews/ActionPreview.tsx` — the mock command-palette placement frame is gone. The metadata strip above it still ECHOES whatever `locations` the draft declares, deliberately: reporting what a (possibly stale) draft says is honest, whereas the frame CLAIMED the platform renders it.
  - `metadata-admin/inspectors/ActionDefaultInspector.tsx` — the `global_nav` entry is gone from `LOCATION_LABELS`. That map is typed `Record< ActionLocation, string >`, so the retirement reached it as a compile error rather than as a silently stale dropdown — the mechanism objectui#3017 installed, firing as designed.
  - `metadata-admin/previews/block-config.ts` — the `record:quick_actions` location dropdown no longer offers it, and both locale tables drop the now-orphaned `…option.location.global_nav` key.
  - `@object-ui/components`' `action:bar` doc comment is aligned. The component's published enum is `[...ACTION_LOCATIONS]`, so it followed the retirement on its own; only the prose was stale.

  `@object-ui/core`'s `ActionEngine.getActionsForLocation` is **unchanged and still answers a literal string match**. Narrowing it to the six live members would put a second rejection point beside the schema's — the tolerant-consumer shape the strict-contract rule forbids, inverted. Enforcement stays where it belongs: the parameter type is now six-membered so no type-correct caller can spell the retired value, and `ActionLocationSchema` rejects it by name at authoring and publish time.

  ## The dependency move

  All 37 `@objectstack/*` declarations across 30 `package.json` files move from `^17.0.0-rc.5` to `^17.0.0-rc.6`, and `pnpm-lock.yaml` resolves one copy of each family package at rc.6. The siblings move with `spec` because `client` / `formula` / `lint` pin it **exactly** — leaving them behind would keep two copies of the spec in the tree, the split brain objectui#3560 called out.

  Bumping the pin and repairing the fallout cannot be split: at rc.5 the `Record< ActionLocation, string >` above is missing a key, at rc.6 it has an excess one.

  ## Breaking, in FROM → TO form

  - **`@object-ui/types`' `Theme` now binds the spec's `Theme`, not `ThemeInput`.** rc.6 retired every `…Input` alias and moved the bare name onto the `z.input` side (`X` = `z.input`, `XParsed` = `z.infer`). The runtime shape and this package's exported name are unchanged — `Theme` was, and still is, the AUTHORING shape where `mode` is optional. Re-pointing at `ThemeParsed` would have been the silent swap.
  - **`SpecReport` / `SpecReportChart` re-point to `ReportParsed` / `ReportChartParsed`, and `SpecReportInput` / `SpecReportChartInput` to `Report` / `ReportChart`.** Same rename, same rule: each local alias keeps the SIDE it had at rc.5.
  - **`@object-ui/types` no longer re-exports `I18nObject`, `LocaleConfig`, `PluralRule`, `DateFormat` or `NumberFormat`** — all five were retired by rc.6. They were dead re-exports here: nothing in this repo imported them from `@object-ui/types` (`@object-ui/i18n`'s formatter vocabulary in `utils/spec-formatters.ts` is locally declared and never bound the spec symbols). `I18nLabel` survives and is unchanged as a name.
  - **`I18nLabel` itself widened from `string` to `string | Record< string, string >`** — rc.6 folded the retired `I18nObject`'s per-locale map into it and ships `resolveI18nLabel(label, locale)` as the shared resolver. Every read in this repo that lands in a text slot now goes through that resolver, so an inline map renders its locale instead of `[object Object]`. Reads the compiler cannot see are audited separately in objectui#4163.
  - **`@object-ui/types`' `GlobalFilterSchema` derives via `.safeExtend`, not `.extend`.** rc.6's `GlobalFilterSchema` carries a refinement and zod 4 refuses `.extend()` on a refined object outright, which threw at module load. `.safeExtend` is zod's prescribed replacement and KEEPS the refinement, so the spec's cross-field rule now also runs on this package's dialect — which is the intended behaviour, since the pinned divergences widen individual fields and were never meant to switch off a whole-object rule.

- e4d1c08: `resolveHostAppSegment` is published from `@object-ui/app-shell`'s package root, and the console's local copy of it is deleted

  Which app should host a framework-owned, app-INDEPENDENT page — the Approvals Inbox, the full inbox, an internal form's created record — is one hard-won definition, and `resolveHostAppSegment`'s docblock says so at length: prefer the app the user is in or last had open RE-CHECKED against the live active list, else their first active app, else the two last resorts. It lived in `app-shell/src/utils/appRoute.ts`, and `packages/app-shell` published only its package root, which re-exported `./utils` nowhere. So the definition was unreachable from every consumer outside the package.

  Something outside the package needed it anyway. objectui#4109 had to name a host app for the record an internal `/forms/:name` submit creates, could not import the resolver, and shipped a documented local subset instead: steps 1 and 2 only, returning `null` where upstream falls through further. That is the "two readers of one prose contract" shape this repo keeps paying for (#3367 / #3842) — the next edit to the resolution order lands on one copy — and the divergence was disclosed rather than smuggled precisely so it could be collected later. This is that collection.

  `resolveHostAppSegment` is now exported from the package root, alongside the two predicates it is defined in terms of (`appRouteSegment`, `filterActiveApps`), and the console's copy is gone: `createdRecordPath.ts` holds the URL shape and delegates the choice. The app record type it accepts is derived from the resolver's own signature rather than re-declared, so the call site cannot drift from it either.

  **Behaviour change on the created-record redirect.** Converging on the full resolver means the two cases the subset answered `null` for now name an app. An empty openable list with a preferred app keeps that preferred app unchecked — an empty list means "not loaded yet" at least as often as "this user has no apps", and demoting someone demonstrably rendering inside `/apps/{preferred}/…` would reintroduce the defect objectui#4074 removed. Anything else unresolvable — no apps and nothing preferred, or apps carrying neither `_packageId` nor `name` — lands on `setup`, the least-surprising last resort rather than a broken link. Concretely: an internal form submit that previously stopped on FormPage's in-place confirmation ("no record page to land on") now navigates to the record under the resolved app, which is the same answer every other record link in the console already gives. The write itself was never at stake, only where the user is put afterwards. The remaining `null` from `buildCreatedRecordPath` means what it always should have: there is no record to point at, because the caller has no object or no id.

- 553099c: Inspectors can block Save — a formula that does not parse no longer saves and publishes as the live field definition

  The field inspector rendered its CEL verdict and did nothing with it. Typing `record.est_hours *` into a formula field showed the inline parse error, left "Save draft" enabled, saved with a 200 and a success toast, and publishing made the malformed expression the live field definition. The RLS policy editor on the same build refused the same class of input — the inconsistency was inside one console, and the difference was structural rather than an oversight in one file.

  `CelPredicateField` has always reported its findings upward through `onLintChange`, but only `PermissionAdvancedFacets` listened, and both ends of that channel live inside the permission editor, which owns its own Save button. The field inspector is a registry component: the button it needed to gate belongs to a host — the Studio Data pillar or the metadata editor — reached only through `MetadataInspectorProps`, which had no way to say "what I am showing is not saveable". So the inspector had no channel to be wired to, and adding one is the fix.

  `MetadataInspectorProps` gains an optional `onBlockingIssuesChange(count)`. It is named for blocking issues rather than for CEL because the same gap reaches five more inspectors through `ConditionBuilder` and `ConditionalFormattingEditor`; those are wired separately, against this contract rather than a renamed one. The prop is optional, so every existing inspector remains valid and any inspector with nothing to block on simply never calls it.

  `ObjectFieldInspector` now aggregates its four CEL editors — the formula box and the `visibleWhen` / `readonlyWhen` / `requiredWhen` rules — into a per-site map rather than one running total. Four editors lint independently and asynchronously, so a shared counter would let whichever reported last overwrite the others: fixing one of two broken rules would hand back a writable Save while the other rule was still malformed. Two stale-verdict cases are settled by deriving the total rather than by repairing it afterwards, which leaves no window in which Save is gated by an editor that is already gone: the map is stamped with the field it describes, so a verdict that lands after the selection moved cannot gate the field now on screen, and the formula site is only counted while the field actually is a formula — otherwise typing a bad formula and switching the type away would wedge Save shut with no editor left to fix it in.

  Both hosts hold the count and disable their own Save, reusing the message the RLS editor already shows ("Fix the CEL syntax errors before saving.") so one console says one thing. Each host stamps the count with the selection it came from, so it expires when the selection changes or the panel closes — an unmounted inspector can never retract its last verdict, and a host that waited for one would leave Save permanently disabled. In the metadata editor all three save doors are gated, not just the button: the autosave timer and the ⌘S shortcut would otherwise have written the malformed definition a second later.

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

- ca269fe: fix(app-shell): a transient 404 no longer retires the shared inbox feed for the page's lifetime

  `sharedUserFeeds`' `markUnavailable()` was a one-way door: `refresh`, `schedule`
  and `onVisibilityChange` all returned early on `unavailable`, so a feed that took
  one missing-resource answer stayed retired until the user reloaded the page or
  switched identity. Since #4225 pointed both the header bell and Home's action
  centre at one inbox feed, that took both panels together — reproducing the
  #4110 / #4230 dead-bell signature from a lost race rather than from a real
  absence.

  The split is reachable because `isMissingResource` is status-shaped
  (`httpStatus === 404` alone qualifies) and the ObjectStack client stamps
  `httpStatus` from the response status before it reads the body — so a 404 from
  anywhere in the transport arrives indistinguishable from the registry's
  considered `OBJECT_NOT_FOUND`.

  A retired feed now re-probes at most `UNAVAILABLE_PROBE_LIMIT` (3) times, no
  more often than `UNAVAILABLE_PROBE_MS` (60s), on the poll timer and on
  `visibilitychange` alike; a probe that answers with rows revives the feed and
  restores its normal cadence. The retired state itself is unchanged — status
  stays `ready`, the value stays empty, and no error is ever rendered — so a
  deployment that genuinely has no messaging pipeline still reads as an answer and
  now costs three extra reads across the whole page rather than one.

### Patch Changes

- 0e67b53: `/accept-invitation/:invitationId` is one route, one component, one namespace — the console now renders the invitation page that actually shows you the invitation

  Two components shipped for this single URL. The console routed its own thin page, which offered nothing but an Accept and a Decline button: it never told the user which organization they had been invited to, in what role, or when the link expires, and accepting left them in whatever organization they were already in. App-shell's page — exported as `DefaultAcceptInvitationPage`, routed by nobody — fetches the invitation, shows the organization, the role and the expiry date, and switches the user into that organization on accept. Console now routes that one. The thin page is deleted.

  Behind them sat two i18n namespaces for one screen: `acceptInvitation.*` (12 keys) for the thin page and `organization.accept.*` (14) for the richer one, both freshly translated into ten languages by different slices of objectui#3546, neither wrong when read on its own. That is 26 keys of duplicated copy with no gate to tell the next author which of the two to edit — the failure mode this repo already has an uncollected precedent for. `acceptInvitation.*` is removed from all ten packs, and its absence is pinned negatively so it cannot drift back: the slice-three test now asserts that no pack defines any of the 12 retired keys (nor an emptied namespace root left by a partial revert), and that neither consuming package asks `t()` for one.

  One behavior needed repairing before the swap was safe rather than after. `?redirect=` is a basename-stripped path by contract in this console — `LoginPage` re-prefixes it with the mount before navigating — and the thin page built it from the route param, correctly. App-shell's page built it from `window.location.pathname`, which already carries the mount, so a console served under a `<base href="/console/">` would have sent the user back to `/console/console/accept-invitation/…` after signing in. It now reads the router (`useLocation`), like every other producer of that parameter in this repo. Under the default `/` mount the two spellings are identical, which is why only a basename case can see the difference; that case is now a test.

  Nothing published was removed: `DefaultAcceptInvitationPage` keeps its export and simply becomes the routed implementation. Downstream apps mounting it get the redirect fix and are otherwise untouched.

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

- e16fd95: The AI build conversation no longer blanks itself the moment the preview opens

  `useChatConversation` treated every failed resolve the same way: clear the id, clear the messages. For a FIRST resolve that is right — there is nothing to lose. For a re-resolve of the conversation the hook is already holding it is destructive, and the AI build flow fires exactly such a re-resolve at the worst possible moment.

  The sequence is the magic-moment one. A build turn streams; `apply_blueprint`'s draft lands and the Live Canvas opens, switching the page from full-screen chat to the chat|preview split; the turn ends; ADR-0057 A1.b bind-on-create — which deliberately waits for that edge — re-keys the conversation to `app:<pkg>:build` and navigates to `?package=`. The scope flip re-resolves the same conversation, one GET issued at the instant the server is still finishing the heaviest turn of the session. A 502 or a dropped connection on that single request landed in the blanket catch.

  Clearing the id there is not a conservative fallback, because of what the host does with it: `AiChatPage` keys its chat pane on `` `${chatApi}:${conversationId ?? 'pending'}` ``, and the thread itself lives inside the chat hook's instance (`useObjectChat` seeds from `initialMessages` once per mount). So `undefined` does not re-render the pane, it REPLACES it, and the blueprint card, the build summary and the Publish button all leave with the discarded instance — the reported "the whole conversation went blank right after the build finished, and only came back after switching threads and back".

  A failed resolve now keeps whatever it was re-reading, when that is the conversation already held: the id is still valid and the messages are still the truth, so the surface stays as it was and the next resolve recovers. This is the other half of a guard that was already there for the empty case — the same re-resolve returning NO messages mid-turn was already refused the right to wipe hydrated history; only the failing case was still open. A resolve aimed at a DIFFERENT conversation (a sidebar switch) and a first resolve with nothing held still clear, and both are pinned negatively.

  Pinned at two levels: the hook, and the page driving the real build→preview→re-key sequence and asserting the pane is never remounted across it.

- d8d0d66: `AiChatPage` narrows the chat hook's messages through the exported `toRuntimeMessages` adapter instead of five casts

  `useObjectChat` returns `ObjectChatMessage[]` — the shape both of its modes really produce (objectui#4424) — which is wide where local mode is wide: it keeps the authored `'tool'` role and the legacy `'partial-call'`/`'call'`/`'result'` tool states. This page wants the runtime shape, and said so five times with `messages as ChatMessage[]` (plus one `as unknown as` double cast). The narrowing was real and the casts were legal; what was missing is that a cast erases the whole difference rather than the intentional part of it, so nothing recorded which narrowing was meant and nothing could go red when it changed.

  There is now one conversion where the hook's values enter the page's runtime-typed world, memoized on `messages` exactly as the plugin's own three renderers do (objectui#4399). All five sites read it; no cast replaces them, and the `as unknown as` double cast at the bound-package derivation turned out to be unnecessary once the value is honestly typed.

  One behaviour changes, and it is the one the fold was measured for. `sanitizeChatMessagesForCache` declares its parameter's role as `'user' | 'assistant' | 'system'` — it has always asked for folded roles, and the cast is what let an unfolded `'tool'` past that declaration. Measured on a thread carrying one: the entry was cached as `role: 'tool'`, which the cache's own reader then rejects, so the message vanished on a cache-fallback reload; and because sanitize gates tool serialization on `role === 'assistant'`, that turn's tool invocations — including the re-serialized draft envelope behind "Review N changes / Publish" — never reached the cache at all. Folded, both survive the reload they exist to survive. The other two compute sites were measured to be fold-insensitive and are unchanged: `isConversationZh` reads `role === 'user'` and the text, which the fold can neither create nor destroy, and `deriveBoundPackageId` walks every message irrespective of role and reads keys the adapter spreads through.

  Nothing on screen moves today: neither a `'tool'` role nor a legacy tool state is producible on this page's own paths, since hydration yields runtime roles and API mode's values come from `mapMessages` with v6 states already. This closes the hole ahead of a value that can reach it, and makes a future vocabulary move surface as a type error at the host rather than as rendering behaviour.

- 932cbcd: An app you are not allowed to open now says so, instead of reporting that it may still be publishing

  `GET /api/v1/meta/apps` is filtered per session server-side (`filterAppForUser`), so an app withheld by its `requiredPermissions` and an app that does not exist were byte-identical to the console: both simply absent from the list. With one fact and two conditions, `AppContent` rendered its only copy for an absent app — "This app is not available yet — it may still be publishing. Try again in a moment." — over a permanent authorization decision, under a Retry button that could never succeed.

  That is not a cosmetic complaint. On a downstream acceptance round one role hit this screen while another opened the same app fine, and because the copy names a transient deployment state the finding was filed as a suspected platform defect and carried through two test batches before a clean-baseline investigation found the account was missing a permission-set binding. The gate had been working exactly as designed; the message is what sent everyone to the wrong place.

  The maintainer ruling (2026-08-12) took the contract half first. objectstack#8013 made the BY-NAME route answer an explicit denial — `403` with the ADR-0112 catalog code `PERMISSION_DENIED` in the declared `{ success: false, error: { code, message } }` envelope — for an app that exists and whose `requiredPermissions` the session lacks, while the LIST route stays filtered exactly as before, with no `authorized: false` flag, so the enumeration surface is not widened past what a direct by-name probe already implies. Absence keeps answering `404 RESOURCE_NOT_FOUND`, and so do the two neighbouring refusals the same ruling deliberately left alone: an unpublished app (ADR-0045 §3 keeps it externally unobservable) and an app gated by an absent optional service (ADR-0057 D10 — nothing was denied to the caller).

  This is the console half. When a requested app is missing from the list and the existing post-publish readiness re-check still cannot find it, the console asks the by-name route which of the two it is, through a new `ObjectStackAdapter.probeAppAccess(name)`. On the measured code it renders a plain authorization message with a way back to the launcher; on anything else — an absent app, an unreachable server, a host that injected a DataSource without the probe — today's publishing copy renders byte for byte, retry button included.

  Two properties of that seam are load-bearing rather than incidental. It branches on the ADR-0112 **code**, never the status (objectui#4408): the two answers under test are both errors one status apart, and a status-reading implementation passes the happy path while going blind exactly where the defect lives. And only `denied` moves the copy: this bug exists because the console asserted a state it had not measured, so a probe that fails, times out or cannot be issued must leave the screen alone rather than guess in the other direction.

  `probeAppAccess` is deliberately separate from `getApp` rather than a flag on it: `getApp` degrades every failure to `null` — the very conflation being undone — and memoises in the adapter's metadata cache, where a verdict about the CALLER would outlive the session it described. New public API on the adapter (`probeAppAccess`, `isAppPermissionDeniedError`, `APP_PERMISSION_DENIED_CODE`, `AppAccessVerdict`), purely additive; nothing existing changed shape. Three new `empty.*` keys ship in all ten locale packs.

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

- 8b971f8: The bell's Approvals and Activity tabs fill in on Home, Organizations and the AI screen — from the same fetch the cards below them already use

  The top bar's bell renders on every console surface, but two of the three streams that fill it were gated on `variant === 'app'`: the pending-approvals poll and the `sys_activity` read. Off-app the popover therefore held nothing to show — the Approvals tab read "No pending approvals" and the Activity tab "No recent activity" — on the very page whose own To-do and activity cards were listing both, from the same endpoint and the same object. Neither stream is app-scoped: approvals are scoped to the signed-in user, activity to the tenant. Whichever app happened to be in the URL was never part of either query.

  The badge made the inconsistency arithmetic. It is `unreadTopics + pendingApprovalsCount`, and after objectui#4199 un-gated the inbox half, only the first addend was fetched outside an app — so one user with one set of data read 1 on Home and 3 inside an app, and the popover's own breakdown line disagreed with the number on the bell.

  Un-gating alone would have fixed the emptiness by paying for it twice: on `/home` the bell and the cards mount in one tree, so each owning its own effect means the approvals request and the `sys_activity` read both go out twice per page. They now share one fetch. A module-scoped store (`hooks/sharedUserFeeds`) owns each feed — one in-flight request, one 30s approvals poll, one 404-retires-the-feature rule — and both the bell and `useHomeInbox` subscribe to it. The dedupe is structural rather than agreed: there is no longer a second producer that could drift, so the badge and the card cannot show different numbers. Home's card keeps its narrower cut of the rows (human actors only, `sys_*`/`ai_*` churn dropped) by filtering the shared feed at its own call site rather than by issuing its own query.

  `isApp` keeps the meaning it was introduced for. The presence avatars and the connection dot are app-shell chrome and stay behind it — and presence was never a read to begin with: it is a transport-level subscription (`useTenantPresence`), which is why the effect that used to be called `fetchPresenceAndActivities` only ever fetched `sys_activity`. The boundary this draws is data scope, not surface: user- and tenant-scoped feeds follow the bell everywhere it renders, app-scoped chrome does not.

- d0c3b26: Every plain `<button>` now declares its `type`. HTML defaults an untyped button to
  `type="submit"`, so any of these buttons would submit the form it was composed into
  instead of running its own handler — a real risk for renderers (`drawer`, `tree-view`,
  `navigation-overlay`) whose placement inside a form is a JSON metadata decision. 114
  sites were converted to `type="button"`; no site was a genuine submit button, and the
  DOM is otherwise unchanged.

  The defect class is now closed mechanically by a new `object-ui/button-has-type` ESLint
  rule (error), so the next untyped button fails CI at write time rather than being found
  by a fourth audit round (objectui#4045, closing the objectui#3344 family).

- 609820d: fix(app-shell): every CelPredicateField binds its label, so the RLS row-filter editors have an accessible name

  `CelPredicateField` renders both halves of its own label association — the
  `Label htmlFor` and the `Textarea id` — but `id` was an optional prop with no
  fallback, so a call site that omitted it left both `undefined`: a label that
  read correctly on screen and resolved to nothing, and an editor with no
  accessible name.

  The row-level-security `USING (read filter)` and `CHECK (write filter)` clauses
  on the permission-set editor were mounted that way, which made the row-filter
  authoring surface unreachable by label for screen readers and for
  `getByLabelText`. The condition builder's CEL escape hatch was affected too.

  `id` now falls back to a generated `useId()`, so the association is a property
  of mounting the component rather than of every caller remembering the prop. An
  explicit `id` still wins unchanged — the field inspector's four editors and the
  conditional-formatting editor keep the exact ids they already had. The
  autocomplete listbox is named off the same resolved id, so an id-less mount now
  also carries the `aria-controls` that ties the combobox to its popup.

- f7c6430: The build-history panel tells an operator a 503 means "the commit store could not be reached — retry", instead of `commits HTTP 503`

  `packages/app-shell/src/preview/commitHistory.ts` flattened every non-OK response to a bare status code (`commits HTTP {status}` for the read, `HTTP {status}` for the revert). Nothing was ever swallowed and no fictional "no history" was ever rendered — those fail-loud properties held, and still hold, which is why objectstack#5980's 503-ification (ADR-0110 D3) needed no follow-up here. What was lost is the meaning the backend already sends, on the one screen where it matters most: this is the rollback surface, read by an operator who is usually mid-incident. A 503 says the read/write did not happen and is worth retrying; a 404 says the store answered "no". They now read differently, and 404, 500 and 503 stay tellable apart.

  Failures now throw a `CommitStoreError` carrying `status`, the ADR-0112 `code`, and a `retryable` flag, and the panel renders a sentence rather than a number. The revert half gets a deliberately different sentence: a write that could not reach the store may still have landed, and re-issuing it appends a _second_ revert commit to an append-only log, so the copy asks the operator to re-read the timeline before retrying rather than simply saying "try again".

  Two details of the report this fixes were checked against the producer and came back different, and both are the reason the copy is authored client-side. The semantic code arrives at **`error.code`**, not `details.code` — `HttpDispatcher.errorFromThrown` parks it in `details` and `buildApiError`/`splitSemanticCode` lift it out and drop `details` (objectstack#3842) — so a consumer reading `details.code` would run a check that can only pass vacuously. And the envelope's own `message` for this class is _withheld_: `declaresServerFault` (objectstack#5811) is true for a 5xx carrying a string code, so the prose on the wire is the generic `Internal server error`. Rendering it would have been strictly worse than the bare status code it replaced. Classification therefore keys on the HTTP status first and treats the code as a second signal, which also means a 503 shed by a proxy with an HTML body still produces the retryable reading.

  Adds `preview.history.loadFailedUnavailable` and `preview.history.revertUnavailable` to all ten locale packs.

- 082ca7b: the connector node's Input section derives typed fields from the action descriptor's `inputSchema`

  A `connector_action` node published its input contract and the designer ignored it. `GET /api/v1/automation/connectors` serves each action's `inputSchema` — the connector's own JSON Schema, projected verbatim by the engine from `ConnectorActionSchema.inputSchema` — and nothing in `app-shell` read it: `git grep inputSchema` over the package found a field declaration and a comment. So after committing an action, the Input section stayed a single untyped key/value repeater, and the author typed raw key names against a contract the picker beside it already knew. The connector and action pickers were correct throughout; this was the last untyped step of that flow.

  The mapping is not a new one. `json-schema-to-fields` — the resolver the inspector already uses for a node type's engine-published `configSchema` — speaks exactly this language, so the descriptor's schema goes through it unchanged and a small adapter only re-roots what comes back: that resolver hard-roots every field at `config.<key>`, while a connector's inputs live in the spec-structured sibling block `connectorConfig.input`, which is what the executor reads. Nothing here interprets JSON Schema a second time. A property the resolver declines — an `array` with no `items` (Slack's `blocks`), a bare `{type:'object'}` (REST's `headers`), a union — is not claimed either, so no descriptor can make a stored key unreachable.

  The stored map is the constraint that shapes the rest. Typed fields read and write the SAME `connectorConfig.input` map an existing flow already committed, key by key, so editing one input leaves every other key — declared or not — at its stored value and in its stored position. `additionalProperties` decides what happens beside them, measured rather than assumed: no shipped connector emits the key at all, JSON Schema's default for an absent one is open, and the executor passes the whole map to the handler unvalidated, so undeclared keys really are accepted. An open schema therefore keeps the repeater alongside the typed fields, trimmed to exactly the keys they do not own and merging its commit back over them instead of replacing the map. A closed one (`additionalProperties: false`) drops the repeater — unless the stored map still holds undeclared keys, because hiding config an older flow committed is worse than offering an editor the new schema no longer invites.

  Descriptors that publish no `inputSchema`, an unreachable registry, a node with no action chosen yet, and an array-shaped input are all left exactly as they were: the generic repeater, unchanged. Field labels and help come from the descriptor's own `title` and `description` — the connector's i18n channel — so no UI copy was added. JSON Schema `required` is read by the engine at dispatch and is still not represented in the form; the field model has no requiredness concept to carry it.

- ab37c5f: `DatasourcePreview` no longer renders three key groups `DatasourceSchema` rejects
  (objectui#4131). `retryPolicy`, `healthCheck` and `capabilities` were removed from the
  datasource document by objectstack#4583 under ADR-0049 enforce-or-remove — connection
  retry and health probing belong to the runtime driver, and pushdown is decided by that
  driver's own `supports.*`, never by datasource metadata. The schema is `.strict()`, so it
  refuses all three by name, while the preview kept painting a `Retry Policy` SideBlock, a
  `Health Check` SideBlock and a `Capabilities` chip strip for them. An author who typed any
  of the three saw the designer confirm a draft that cannot be saved — the preview was the
  only surface acknowledging the keys at all, so it was also the strongest signal they
  worked. `pool` and `ssl` are still declared and still render.

  This is the third wave of the same defect on this one file (objectui#3275 deleted
  `d.type` / `isDefault` / the `Array.isArray(capabilities)` branch; objectui#3143 deleted
  the read-replica pill), and the removals had been in `main` eight days before anyone
  noticed — nothing compared the two halves of the contract. They are now compared
  mechanically: `DatasourcePreview.spec-keys.test.ts` derives the keys the preview reads off
  the draft from the component's own AST, derives the keys the schema accepts from the
  schema object's `.keyof()`, and fails on any read the schema would reject. Neither side is
  written down as a list, so a key added or removed in `@objectstack/spec` moves the pin on
  the next dependency bump instead of leaving it stale.

- ee66e2e: `DeclaredActionsBar` reads `visible` / `disabled` off the typed action def instead of through `(action as any)`.

  The `disabled` cast was the one the maintainer's 2026-08-06 ruling on
  objectstack#4075 named: `ActionDef.disabled` was hand-written as
  `string | boolean` and could not describe the `{ dialect, source }` envelope the
  spec emits, so the bar had to reach around the type to evaluate it. With both
  keys now derived from the spec's unified three-arm shape (`@object-ui/core`, step 3) there is nothing left to reach around. The adjacent `visible` casts go with
  them for the same reason — step 2 declared `visible` and deleted `ActionEngine`'s
  equivalent casts, but missed this file's.

  No behaviour change: `toPredicateInput` and `hasDeclaredPredicate` both take
  `unknown`, so the casts only ever affected whether the property access compiled,
  never which verdict it produced.

- 4cb0562: `DeclaredActionsBar` binds its row through the shared `usePredicateRecordContext`

  The bar held an inline copy of the three-way row binding — `{ ...row, record: row, data: row }`, added by objectui#4077 to fix its root-only predicate scope. objectui#4079 fixed the same fault on the four generic action renderers and gave the rule one name instead of a fifth copy: `usePredicateRecordContext`, exported from `@object-ui/react` beside `useCondition`. The bar now calls it.

  No verdict changes on any row: the two copies agreed wherever a row exists, which is every surface that mounts this bar today. They differed in one corner, and the helper's semantics are the ones kept — with **no** row, the bar now binds nothing where it used to bind `{ record: {}, data: {} }`. Since `useCondition` merges this context over the ambient predicate scope, the old shape blanked out a `record` a host had put in the scope itself; "this surface has no row" and "this surface's row is empty" are now distinct here too.

  Two implementations of one binding rule is what objectui#3367 / #3842 rule against, and this family already paid for it once at the `toPredicateInput` level (objectui#3314: two normalizations drifted, and the same `visible:` predicate reached different verdicts depending on which path surfaced the action). Nothing had drifted here yet — the next edit to the rule is what this closes off.

- 298769f: The default-inspector family and its panel hosts gate Save on CEL errors — a hook guard, an action predicate or a validation rule that does not parse no longer saves

  #4306 gave the SCOPED inspectors a way to say "what I am showing is not saveable" (`MetadataInspectorProps.onBlockingIssuesChange`), and #4527's first half wired the shared CEL editors to it. That left the other half of the console still publishing malformed expressions, for a structural reason rather than an oversight: there are TWO inspector registries, and only one of them had the channel. `MetadataDefaultInspectorProps` — the contract every "no selection" inspector is rendered through — had no such member, so the hook guard, an action's `visible` / `disabled` predicates and a view's conditional-formatting rules on the home panel rendered their inline parse errors while Save stayed writable, and no host could pass a callback that did not exist.

  `MetadataDefaultInspectorProps` now carries the same optional `onBlockingIssuesChange`. `HookDefaultInspector` reports its guard; `ActionDefaultInspector` aggregates its two predicate editors through a per-site map, because two editors lint independently and a shared counter would hand back a writable Save the moment one of two broken predicates was fixed; the view home panel already aggregated and now has a contract to report through.

  The hosts that own the buttons hold and expire those counts. The metadata editor gates its no-selection branch as well as its scoped one, stamping each so neither reads the other's verdict. Studio's design pillar gates its rail at last — that was an unfinished edge of #4306 rather than new ground, since the same malformed-CEL publish was reachable there with the gate inert, including for the field inspector. The Data pillar gains a second count for its panel family: the validations, actions and settings panels write through the object draft and own no Save, so their faults have to reach the pillar's button, and the count is stamped with the panel tab because only one panel is mounted at a time and a tab the author has left can never retract its verdict. The hooks panel is the one panel that writes on its own (`client.save('hook', …)`), so it gates its own per-hook Save.

  Every count is DERIVED from what it describes rather than repaired by a reset effect, and pruned by what still exists: a deleted validation rule or action drops out of the total immediately, so a fault can never wedge Save shut with no editor left on screen to fix it in. A faulty rule the author merely navigates away from stays counted, because it is still in the document and saving would still publish it.

  Also wired: the object validations panel, a sixth `ConditionBuilder` consumer that the original report did not list. Still deferred by ruling: `widgets.tsx`'s condition widget, a `SchemaForm` widget needing widget-context plumbing.

- b318273: fix(app-shell): the metadata-admin designer's own i18n table uses the typographic ellipsis

  The designer carries its own flat `en`/`zh` table rather than reading the ten locale
  packs, so objectui#3878 — which converged those packs on U+2026 `…` per the
  consistency pass on objectstack#6015 — left it behind. Ten values across five keys
  (`engine.form.select`, `.selectObjectDots`, `.addObjects`, `.selectFieldDots`,
  `.addFields`) still ended in three ASCII full stops, and the designer renders inside
  the console shell, so `Select...` sat on screen beside the packs' `Select…`.

  All ten now use `…`, and the table's header records the convention for the next
  author.

- f762f5b: refactor(app-shell): collapse the metadata-admin designer table's byte-identical key pairs

  objectui#4377 converged five designer i18n values on the typographic ellipsis `…`. Three
  of the five then held values byte-identical to a sibling key in both the `en` and the `zh`
  block, so the `Dots` suffix — which used to name "the spelling _with_ trailing dots" —
  named nothing any more, and one key had no consumer at all:

  - `engine.form.selectObjectDots` → collapsed onto `engine.form.selectObject`
  - `engine.form.selectFieldDots` → collapsed onto `engine.form.selectField`
  - `engine.form.select` → deleted (no call site; byte-identical twin of the live
    `engine.form.selectEllipsis`)

  The two live `Dots` call sites in `widgets.tsx` now read the surviving key. Every rendered
  string is unchanged — the collapsed values were byte-identical — so this is a table-shape
  change only: the designer no longer names one placeholder twice, which is where the next
  author would otherwise re-split the dialect.

- bf2fd3d: `?runAction=create_environment` is no longer consumed when the environments toolbar has no create action to run it on.

  `EnvironmentListToolbar` armed the deep link on `toolbarActions.length > 0` — the presence of _any_ toolbar action. Consumption of this deep link is modelled as stripping the param from the URL, so arming is destructive: a toolbar carrying some other action stripped `?runAction=create_environment` and triggered nothing (measured with the real `action:bar` + `action:button` runner: `urlParam=null execute=0`). Because the strip _is_ the consumption, the user's intent was unrecoverable — reloading could not retry it, and the welcome page's "Create your environment" CTA (#844) simply landed on the list with no dialog and no way to ask again.

  Arming now keys on the create action actually being present. When it is not, the URL is left alone, so the next mount that can act on the deep link still does — a reload, or the action arriving with fresh metadata.

  The two lists that used to disagree are now one. The toolbar filtered placement only (`locations`), while `action:bar` additionally applies the ADR-0066 D4 capability gate (`requiredPermissions`) to what it renders — so a create action the caller may not invoke was counted here and dropped there, which is the divergence that made the bug reachable without any change to cloud metadata. The toolbar now builds its list with both of the bar's predicates (`actionRendersAt` + `useCapabilityGate`, the shared hook that exists precisely to keep self-filtering surfaces from drifting), and every affordance derived from that list follows: the loading skeleton is held only for a create button that can actually arrive, and the plan-locked "Add environment" upgrade CTA — which stands in for the create action — is not offered when there is no create action to stand in for.

  The `#3803`-verified consumption ordering is untouched and re-pinned: the runner still consumes `autoTrigger` before the parent strips the param.

- f8595a0: Using a list's filter panel no longer overwrites the view's source-declared `filter` for everyone

  Opening a Console list view's filter panel and clicking **Add filter** wrote a view-customization overlay into `sys_metadata`. The row that button inserts is incomplete by construction — `{ field: <first column>, operator: 'equals', value: '' }` — and a view override is merged over the source-declared view key-wise (`{ ...source, ...override }`), so that one stray condition became the view's _entire_ `filter`. The list then came back `total: 0` on every subsequent visit, for every user of the view, and the panel's own **Clear all** could not undo it: clearing wrote `filter: []`, which is still an override that deletes the source declaration. Recovery required deleting the `sys_metadata` row and restarting the service.

  Two independent changes, because the defect had a write half and a read half.

  **The write is gone.** `persistViewFilter` and both `onFilterChange` persist bindings are removed: a filter-panel interaction is transient state belonging to the session and to `writeListFilterState`'s per-browser restore, never to the view's stored body. The threshold for writing a view overlay is now an explicit save — `handleViewConfigSave`, and `ObjectDataPage`'s "Save as view". `ObjectDataPage` had already made exactly this call for the sibling surface ("Deliberately NO onSortChange/onFilterChange persistence hooks", #2251); this surface was the outlier. The surviving handler still writes localStorage, so the panel is not amnesiac — it just no longer speaks for every other user of the view. `foldFilterGroupToSpecRules` (objectstack#5159) survives untouched and is still the one dialect for the explicit paths; what was removed is the automatic write, not the fold.

  **Already-poisoned installs self-heal on read.** `sanitizeViewOverride` runs on both branches of `loadViewOverrides` and strips conditions an overlay must never impose — an empty value against an operator that wants one, in both the spec `ViewFilterRule` shape and the legacy runtime triple — then drops the `filter` **key** entirely when nothing effective survives. Dropping the key rather than writing `[]` is the whole point, and the merge semantics are measured in the tests rather than assumed: `filter: []` wins the spread and blanks the declaration, whereas no `filter` key falls through to it. So a stored `field equals ""` and a stored `filter: []` both stop overriding, and the source filter wins again on the next load — no `sys_metadata` surgery, no restart.

  One consequence is deliberate and worth naming: an overlay can no longer express "this view has NO filter" over a source view that declares one. That is the strictly safer side of the trade, because the shape that expressed it is the same shape that silently erased source declarations; an author who genuinely wants no filter edits the view, which writes the view body rather than an overlay.

  The existing objectstack#5159 ratchet is retargeted rather than deleted — it now asserts that _no_ filter reaches the view-config persist path, that the `persistViewFilter` seam does not exist to be called, and that no `onFilterChange` handler reaches any persist call, with the explicit-save path pinned alongside as a control.

- 6d8231c: A `type: 'form'` action fired from a record now EDITS that record instead of creating a duplicate

  `ActionRunner.executeForm` forwards the record an action was fired from as `/forms/:name?recordId=<id>`, but the console's internal form route never read that param. The only query params it consumed were the `prefill_` ones, so the route rendered EMPTY inputs, and its submit was an unconditional `POST /api/v1/data/:object` — an insert. An "edit this record" action therefore opened a blank form and, on Submit, created a second record while leaving the original untouched. In the showcase app: open any Task, click **Log Time**, fill it in, Submit — a NEW Task appeared. Until objectui#4109 the damage was hidden behind the anonymous "Your submission has been received" panel; once an internal submit started landing on the record it wrote, the duplicate became visible immediately.

  `?recordId=` now selects the whole read/write pair. The route loads the record with `GET /api/v1/data/:object/:id`, prefills the inputs with its stored values, and saves with `PATCH /api/v1/data/:object/:id` — the verb the data plugin declares (`plugin-rest-api.zod.ts`), the one `packages/rest` registers, and the one every other update client in this workspace already spells. After a successful save the user lands back on the record they edited.

  A `recordId` the route cannot honour now fails closed. A record that 404s or 403s, a payload whose object contradicts the form's target, and a present-but-blank `?recordId=` each render the form's error state; none of them falls back to create mode, because a blank form whose submit inserts a duplicate is this bug's exact harm and silently degrading into it would just re-arm it. A `recordId` naming a record of a different object is not found under the form's own object, so it takes the same refusal path.

  When a URL carries both a `recordId` and `prefill_` params, the explicit params win for the fields they name and the record's stored values fill the rest — a producer that forwards both is expressing intent, and the per-field instruction is the more specific one. Stored nulls and empty strings count as real values and beat a field's create-time `defaultValue`, so opening an edit form never silently proposes a change the user did not make.

  Two surfaces are deliberately untouched. Create mode — no `recordId` — behaves exactly as before, and the public `/f/:slug` path ignores `recordId` entirely: an anonymous visitor controls the URL, so honouring it there would turn a public form into an arbitrary-record reader and writer. In `@object-ui/app-shell` only the URL-param registry's documentation changed, recording that `recordId` now has a second reader on a route that can never match the same URL as the record drawer's.

- 7084f7d: `DashboardRenderer` and `ListView` serve the props they declare — the index signature stops erasing them

  Both components declared a full props interface and neither was enforced. A `[key: string]: any` on `DashboardRendererProps` and `ListViewProps` puts `string` into `keyof Props`, so `'ref' extends keyof Props` is always true and React's `PropsWithoutRef` takes its `Omit` branch — and `Omit` over a type carrying a string index signature keeps only the index signature. Every declared property was dropped from the resolved type, on both sides: the render function received `{ [x: string]: any }` (so even `schema` was `any` inside the component), and every JSX call site was unchecked. Measured on the pre-fix source, `keyof ComponentProps<typeof DashboardRenderer>` was `string | number` and `ComponentProps<typeof DashboardRenderer>['onWidgetClick']` was `any`, while the interface went on declaring `(widgetId: string | null) => void`. `ListView` measured identically for `onRowClick`. This is objectui#4422 / PR #4438's trap in the two packages that issue left unswept.

  Graded **minor, not major**: the interfaces have always DECLARED these props; the index signature erased them from the resolved type. Restoring what the interface documents is a FIX to the published contract, not a contract break — no documented capability is removed, and `any`-typed accidental passthrough was never the documented surface. Nothing in either package's README or docs endorses relying on it.

  The props each component genuinely reads but never declared are now declared by name, at the type each one lands on: `dataSource` on both, plus `onAddRecord` / `onBulkAction` / `onPageSizeChange` / `onEdit` / `onDelete` / `onBulkDelete` on `ListView`. `DashboardRenderer`'s DOM pass-through keys are derived from `toDomProps`' whitelist constant itself, so the declaration and the runtime filter cannot drift — the "declare it and forward it by name" direction `@object-ui/core`'s `dom-props` doctrine asks for, rather than reopening the spread.

  Type-only: the emitted JS for both packages is byte-identical before and after (verified by sha256 on `dist/index.js` and `dist/index.umd.cjs`), and both packages' runtime suites are untouched and green.

  Three latent defects the erasure had been hiding are fixed with it, each surfaced by the repo-wide type-check: `DashboardWithConfig` typed its widget-select handler `(widgetId: string)` while `DashboardRenderer` calls `onWidgetClick(null)` to deselect; `InterfaceListPage` built a list schema whose `viewType` was a bare `string`; and `StudioDesignSurface` forwarded a `refreshKey` prop that no component in the chain declares or reads, so it was silently dropped. Per-package structural guards now pin the shape in both packages, covering the public `forwardRef` that takes its props whole — the spelling objectui#4438's `schema`-destructuring scan could not see.

- de62779: Home's action centre badges everything that is waiting, not the five rows it has room for

  `/home` showed two numbers for one question. The bell badges distinct unread topics plus pending approvals over the shared feed's full 20-row window; the action centre 200px below badged `pendingApprovalsCount + notifications.length` — and `notifications` is the list it renders, which `useHomeInbox` caps at 5. So nine unread messages read as **9** on the bell and **5** on the card, on one page, about one set of rows. The badge was reporting the size of a preview as if it were a total.

  Before objectui#4225 the card could not have said anything else: its own read was `$top: 5`, so nine was not a number it had. Both surfaces now cut from one already-joined feed, so the true count is in hand at Home's call site and the cap is a presentation slice over data the card already holds.

  `useHomeInbox` grows one additive field, `unreadTopicCount`, and `HomeActionCenter` takes it as a required prop: badge = `pendingApprovalsCount + unreadTopicCount`, list = the same unread set, newest first, still capped at 5. Badge means "how much needs you", list means "the newest few of it" — two semantics, each truthful, one number.

  The count is the bell's own fold (`groupNotifications`, by `(topic, title)`) applied to the bell's own rows, deliberately, rather than the pre-slice length of Home's list. That length is title-folded and drops blank titles, so it would agree with the bell on ordinary data and disagree whenever two topics share a title — and "two derivations of one number that agree usually" is exactly the defect objectui#4316 was. One fold, applied twice, cannot drift.

  Two adjacent behaviours are unchanged and now pinned as such: the approvals addend (distinct pending request ids from the shared REST feed, degrading to 0 on 404) and the list's own cap of five. "You're all caught up" is now gated on the total rather than on the rows on show, so it can no longer contradict the badge above it.

- 771466a: Home's action centre no longer says "You're all caught up" to a user whose inbox it failed to read (#4235)

  `useHomeInbox` caught every failed `sys_inbox_message` read to `[]`, so a denial
  arrived at `HomeActionCenter` wearing the exact shape of an empty inbox and the
  panel reported a quiet day, with no badge, to a user with nine unread messages.
  That is the reported symptom, and objectstack#7344 measured its mechanism in a
  browser: `403 PERMISSION_DENIED` on that object for every non-admin session,
  while `/api/v1/notifications` — a projection of the very same rows — answered
  with their messages. It also resolves the cross-run contradiction the card
  carried: two QA runs on one console pin disagreed because one was an admin and
  one was not.

  The hook now reports `notificationsStatus` (`idle` / `loading` / `ready` /
  `error` — `MetadataProvider`'s vocabulary, per #4300's one-dialect ruling), and
  the affirmative copy renders only on `ready`. An unanswered read gets a quiet,
  non-affirmative notice instead, rendered alongside the approvals row when only
  that half answered. A deployment with no inbox object at all is still an answer
  and still reads as caught up, unchanged.

  The source is unchanged and deliberately so: ADR-0030 names `sys_inbox_message`
  as the console's consumer channel, and `/api/v1/notifications` projects the same
  query one hop later.

- 3e19fe7: i18n copy: one ellipsis glyph across the ten packs, `usted` in the es draft-preview empty state, and a pt sentence that stops contracting `de` onto its own hole

  Three locale-copy defects that no gate could see, because all three are _value_ defects on keys whose names, placeholders and key sets were already correct.

  **One ellipsis (objectui#3878).** `en` ended 33 values with three ASCII full stops (`Loading...`, `Ask anything...`) and 110 with the typographic ellipsis `…`, and the nine translation packs had copied `en` value by value — so a user could read both glyphs on one screen: `common.loading` beside `dashboard.loading`, `console.ai.askAnything` beside its own panel's siblings. All ten packs now spell it `…` (U+2026), per the maintainer-authorized consistency pass registered on objectstack#6015. 312 pack values changed: 34 in `en` (the 33 trailing plus the one mid-sentence `collaboration.commentPlaceholder`) and 278 across the nine. Eleven inline `defaultValue` call sites were re-synchronised with the new `en` text, which `scripts/check-i18n-call-site-keys.mjs` requires byte-for-byte.

  The convention is now pinned so the split cannot regrow: `packages/i18n/src/__tests__/ellipsis-glyph-3878.test.ts` fails, by key name, on any value in any of the ten packs that holds three ASCII full stops. It is deliberately wider than "a trailing `...` in `en`", because the census showed the narrow rule would have shipped with two holes in it — `collaboration.commentPlaceholder` puts the ellipsis mid-sentence, and `list.loading` had the packs wrong while `en` was already right, which no `en`-only rule can see.

  Fifteen module-local **no-provider fallback** entries were moved with the packs, across `useCollaborationTranslation`, `useFieldTranslation`, `useDetailTranslation`, `ObjectGrid`, `KanbanImpl`, `data-table` and `ConnectionStatus`. Those maps exist to render when no `LocalizationProvider` is mounted, and each one's own docblock requires it to stay byte-identical to the `en` pack — a requirement objectui#3440 already enforces mechanically for the collaboration map. Leaving them behind would have made the provider-less path disagree with the provider path on ten keys.

  **es `usted` (objectui#3875).** `preview.empty.notReadyDescription` said `Revisa la conversación` — the tú imperative — in a namespace that is otherwise 23:1 usted, and it renders _underneath the usted draft-preview banner at the same moment_, not before or after it. `Revisa` → `Revise`; nothing else in the sentence carries a register. The neighbouring `approvalsInbox` namespace is legitimately tú and was left alone.

  **pt contraction (objectui#3877).** `ConcurrentUpdateDialog` splits `detail.concurrentUpdateDescription` on `{{field}}` and renders a bolded label in the gap, and pt left a bare `de` in front of that gap. When the multi-field conflict branch passes the record label (`este registro`), Portuguese users read `de este registro` — a contraction error every native speaker sees, and one that no spelling of the leaf value could fix (`deste registro` renders `de deste registro`). The pt sentence is rewritten so the hole is preceded by the verb `afeta` instead of any preposition, which closes the whole class rather than trading `de` for an `em` or `a` that contract just as hard. pt only; `en` is unchanged.

  No behavior, no keys added or removed, no placeholder changed.

- bb68488: An inline per-locale label now renders its locale's string at the thirteen read sites the `@objectstack/spec` 17.0.0-rc.6 bump exposed

  rc.6 widened `I18nLabel` from `string` to `string | Record<string, string>`, so an author may write `label: { en: 'Owner', 'zh-CN': '负责人' }` anywhere the spec accepts a display label. PR #4169 repaired eight such sites; these thirteen were invisible to it because the five packages involved build through vite/rolldown, so `turbo run build` never type-checks their sources — only `turbo run type-check` does. All thirteen are now resolved through a shared resolver against a real locale, and `turbo run type-check` is 78/78 with zero errors.

  | package                       | what an author can now write and see                                                    |
  | ----------------------------- | --------------------------------------------------------------------------------------- |
  | `@object-ui/layout`           | `NavigationArea.label` — the sidebar area switcher's button and its tooltip             |
  | `@object-ui/plugin-list`      | `ViewTab.label` — the inline pill row, and the mobile dropdown's trigger and menu items |
  | `@object-ui/plugin-dashboard` | `DashboardWidget.title` — the widget card heading and its `title` attribute             |
  | `@object-ui/plugin-designer`  | `DashboardWidget.title` — the widget card and the preview tile                          |
  | `@object-ui/app-shell`        | `ActionParam.label` **and** each `ActionParam.options[].label`                          |

  **Patch, not minor, in every case: no public surface changes meaning.** Every entry above is a read site that previously could only be reached with a value the type system rejected, so no caller's working code changes behaviour. `@object-ui/app-shell` is the only package with an exported-type change and it is purely additive on the authoring side — `RawActionParam.label` and `RawActionParam.options[].label` widen to `I18nLabel` (they accept strictly more), `ResolveActionParamsContext` gains an optional `locale`, and the new `RawActionParamOption` names the authoring shape that was previously spelled with the resolved one. What `resolveActionParams` **emits** is unchanged: `ActionParamDef.label` and its options' labels are still plain `string`s.

  Two consequences worth knowing:

  - **The dashboard designer's title input is deliberately read-only for a map-valued title.** Resolving a per-locale map into a single-line input and writing `e.target.value` back would collapse every other locale on the first keystroke, so the write is guarded and an inline map survives an unrelated edit-and-save round trip untouched — the same conservative branch #4169 took for `DashboardWidgetInspector`. What Studio should actually offer for authoring a per-locale label is objectui#4163 part 2, which is unclaimed and pending design.
  - **`@object-ui/layout` resolves at the spec's `en` default, not the viewer's language.** That package carries no i18n dependency by design (its whole i18n story is injection), and `AppSchemaRendererProps` exposes no locale to thread. The choice and what would change it are documented at the call site.

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

- f812de6: The bell popover's and Home's "see all" drills open inside an app the user can actually open, not the setup app

  Four navigation producers hardcoded `/apps/setup/...` for pages that are not bound to the setup app at all: Home's notification fallback (`sys_inbox_message?view=mine`, taken whenever a notification carries no `action_url`), Home's "View all activity" (`sys_activity`), and the bell popover's two footer links to the same two pages. `sys_inbox_message` and `sys_activity` are framework-owned objects that resolve at `/apps/{any app}/{object}` — exactly like `system/approvals`, whose sibling entry in the very same popover was already resolving the current app. The in-code comment defending the hardcoded path argued the OBJECT is app-independent, which is true, and which is precisely why rendering it in `setup` does not follow.

  Both halves of the cost were measured in a browser before the fix. A business user whose app list does not contain `setup` clicked "View all notifications" and got the target rendered inside their own app's shell with the page showing "You don't have access" — a softer, more confusing failure than a hard app guard. Every other user, admins included, was switched out of the app they were in: the URL, the sidebar and the header app switcher all flipped to Setup, with no announcement and no way back except the app switcher.

  All four now resolve the host app through one shared helper (`resolveHostAppSegment` in `utils/appRoute.ts`), which generalizes the resolution objectstack#7231 introduced for the approvals entry and which Home and the popover both call, so the two surfaces cannot drift into different answers: the app the user is in (or last had open) re-checked against the live active-app list, then their first active app, then — only when the list names no app at all, i.e. it has not loaded yet — the caller's own hint, and `setup` last. A user whose current app is `setup` still lands in `setup`; a remembered app that has since been deactivated or hidden is not resurrected as a link.

  Two admin-scoped links, `/apps/setup/system/marketplace` and `/apps/setup/system/apps`, are deliberately left alone and pinned as such: those are setup-app surfaces by intent.

  Routing was not the only reason a business user saw an empty inbox — objectstack#7344 (no shipped permission set grants `sys_inbox_message`) is a second, independent cause, and the destination can still refuse the data read until that grant question is settled. This fix is necessary rather than sufficient, and the tests assert the resolved target, never the far end's data grant.

- 7b07832: fix(app-shell): the top-bar bell polls the inbox on every console surface, not only inside an app (#4110)

  The bell's `sys_inbox_message` + `sys_notification_receipt` poll was gated on the
  header's `isApp` variant flag — the flag that exists to hide the app-only presence
  avatars and connection dot. The bell itself renders in every variant, so on Home,
  Organizations and the full-page AI screen its Notifications tab held `[]` forever:
  "Unread" read "You're all caught up" and "All" — which applies no predicate at all —
  read "No notifications", while Home's own To-do card listed the same row from the
  same object. The inbox is scoped to the signed-in user, not to the app in the URL,
  so the poll is now scoped by `user?.id` only.

- 297534b: Align 43 inline `defaultValue` strings with the `en` pack, and make the call-site gate enforce it (objectui#3810)

  `t(key, { defaultValue: 'English text' })` only renders that text when i18next
  **misses** the key. Where the key exists in `packages/i18n/src/locales/en.ts` the
  pack value always wins, so the inline string is dead code — and 43 of those dead
  strings said something different from the sentence users actually read.

  `scripts/check-i18n-call-site-keys.mjs` (objectui#3530) now compares the two
  whenever a call site carries a literal `defaultValue` for a key `en` defines, and
  fails on any byte of difference. It is a hard rule with **no baseline**: the
  repo-wide census measured 43 sites in 19 files out of 851 literal inline defaults,
  and all 43 are aligned here, so there is no debt for a ratchet to hold. A
  `defaultValue` on a key that is _not_ yet in `en` stays legal — that transition
  runs for months (objectui#3546) and belongs to the existing `missing-key` rule,
  which keeps reporting it alone.

  Every fix moved the CALL SITE to the pack's wording. `en.ts` is untouched: its
  values are what users read today, and changing one would oblige the same change in
  the nine other packs (`scripts/check-i18n-en-drift.mjs`, objectui#3650). Six of the
  43 differed only in an ellipsis (`...` against U+2026) — invisible in review, which
  is how they survived three i18n gates that are each blind to this class by
  construction.

  The visible effect is confined to hosts that render these components with **no**
  `I18nProvider` and no initialised i18next instance. There, react-i18next's
  not-ready `t` returns the `defaultValue`, so the inline string was the rendered
  one; it now matches what a provider-backed app has always shown. Inside the
  console — provider mounted — nothing users see changes. The clearest converging
  examples: the workspaces screen was written as "Organizations" at nine call sites
  while every user has been reading "Workspaces"; the forgot-password success line
  was written as "If an account exists, a reset link has been sent." while the pack
  asserts "We've sent a password reset link to {{email}}."

- dd3adbd: All CEL-hosting inspectors block Save on parse faults — a page block or formatting rule whose condition does not parse no longer saves

  `CelPredicateField` has always reported its lint verdict upward through `onLintChange`, but only the RLS policy editor listened. #4306 fixed the field inspector and shipped the channel the rest of the console needed — `MetadataInspectorProps.onBlockingIssuesChange`, named for blocking issues rather than for CEL precisely so the remaining sites could be wired against it. This wires the two shared editors that discarded the verdict: `ConditionBuilder` (the no-code predicate builder's raw-expression mode) and `ConditionalFormattingEditor` (one condition per formatting rule). Each gains an optional callback surfacing its blocking-error count, and the inspectors above them aggregate and report through the contract, so the host that owns Save refuses to write.

  Both counts are DERIVED from what they describe rather than repaired by reset effects, because the editors can vanish while their last verdict was "1 error" and nothing would ever retract it. `ConditionBuilder`'s CEL editor exists only in raw mode — an externally-changed value that round-trips as a simple predicate flips the builder back to rows in the same commit, unmounting the editor and cancelling its pending lint — so the count is read as 0 whenever the raw editor is not mounted. `ConditionalFormattingEditor` keys a per-rule map and counts only rules that still exist: a shared counter would let whichever rule linted last overwrite the others, so fixing one of two broken rules would hand back a writable Save while the other was still malformed, and a deleted rule's remembered error would wedge Save shut with no editor on screen to fix it. Only `severity: 'error'` counts; advisory warnings never block.

  Wired this way, `PageBlockInspector` gates the metadata editor's Save on a page block's `visibleWhen`, and `ViewVariantInspector` gates it on a view's `conditionalFormatting` rules (forwarded through `ViewInspector`, the scoped router — without that hop the channel stops one component short of the editor and the wiring is inert).

  Three of the sites named in the original report are NOT wired here, because the channel does not reach them: `HookDefaultInspector`, `ActionDefaultInspector` and the view's home panel are `MetadataDefaultInspectorProps` components, whose contract has no blocking-issues member, and `widgets.tsx`'s condition widget is a `SchemaForm` widget rather than an inspector at all. Wiring those needs a second contract decision and edits to the hosts, so they are left for a follow-up rather than guessed at.

- 5f40de7: Fail when a `t()` call site's arguments are not the holes its `en` value has, and delete the three that were inert

  `scripts/check-i18n-call-site-keys.mjs` gains a fourth failure class, `interpolation-parity`: for a call site whose key resolves to a readable `en` leaf, the set of interpolation option names it passes must EQUAL the set of `{{hole}}` names in that value. Both directions fail, because they fail differently — an argument with no hole is dropped by i18next in silence, and a hole with no argument leaves its own braces in what the user reads.

  Nothing else could see this. `all-locales-key-parity` does compare placeholder shape, but pack against pack, so ten packs agreeing on `Update` while the call site passes `version` is full parity. `check-i18n-en-drift` fires only when an `en` string changes. And objectui#3810's `default-value-drift` is satisfied the moment the call site's inline default matches the pack — which is exactly how `home.welcome` got here: its value was rewritten from `Welcome to {{product}}` to `Build your business system with AI`, the call site's default was later aligned to the new sentence, and the now-inert `product` argument stayed sitting beside it.

  The repo-wide run found **3 inert arguments and 0 unfilled holes**, so the rule lands hard, with no baseline. All three arguments are deleted rather than answered with a new hole in `en.ts`:

  - `marketplace.action.updateTo` — `version`, on a primary button reading a bare `Update` while its sister key in the same file renders `Update → v{{version}}`.
  - `home.welcome` — `product`, so no white-label deployment's name has ever reached the console hero.
  - `objectActions.resetPackageSetSuccess` — `label`, copied from the `deleteSuccess` branch next to it, whose sentence does name the record.

  **No rendered output moves, on any path.** With a provider mounted, i18next dropped these arguments already. With none, react-i18next's `notReadyT` returns `optsOrDefaultValue.defaultValue` verbatim — there is no interpolation step on that path at all — and all three inline defaults are hole-free too, so the miss path is unaffected as well. Adding the hole instead would have been a copy change: it moves a string users read today and obliges the other nine packs through objectui#3650. The gate accepts either resolution; choosing between them is not its business, and objectui#3546's slice-five assertion — written to force this decision rather than let it be settled silently — now pins the chosen state.

  One key is registered as filling its hole downstream: `auth.forgotPassword.successDescription` travels through `t()` with `{{email}}` intact because `ForgotPasswordForm` substitutes the address itself, once the form knows it. That entry silences the unfilled direction only — passing `email` to `t()` there would let i18next consume the hole and make the form append the address a second time, and the gate still reports it.

- a610bf2: The copied invitation link is one the recipient can actually open — both copy sites resolve through the console mount instead of rebuilding it from `BASE_URL`

  Copying a link from the workspace **Invitations** tab produced `http://localhost:8080./accept-invitation/<id>` — unusable twice over. Both copy sites (the Invitations tab's per-row copy button and the invite dialog's freshly-created "Accept link" field) carried their own `buildAcceptUrl`, glueing `${window.location.origin}` to `import.meta.env.BASE_URL`. In the portable build the console ships (`base: './'`) `BASE_URL` is the literal `'.'`, so that concatenation put a dot straight after the authority — a trailing-dot host. Removing the dot by hand did not help either: the resulting `/accept-invitation/<id>` skips the deployment mount, and a console served under `/_console/` answers that path with `{"error":"Not found"}`. An invited user had no working way in.

  Both local copies are deleted. The two sites now call `resolveConsoleUrl`, the mount-aware helper `WorkspaceSwitcher` and `OrganizationsPage` already use for full-page navigations — it resolves against the `<base href>` the server injects, which is exactly the trailing-dot failure `resolveHomeUrl`'s header documents as retired. One resolver, one answer: no URL assembly survives in either file, and the invite dialog resolves once so its displayed field and its clipboard cannot drift apart.

- bc77f7d: console: an inaccessible landing app bounces to `/home` instead of stranding the user on a chrome-less page

  Switching organization (and accepting an invitation, which switches as its last step) could land a `member` on `/apps/setup` rendering the bare "No apps configured" screen — no header, no navigation, no workspace switcher, and no way back except editing the URL by hand.

  `GET /meta/apps` is filtered per session server-side, so an empty list means "nothing here is yours to open", not "this workspace has no apps". When the app surface has no app to enter, it now redirects to `/home`, which renders inside the shell chrome and already carries the copy for this state. A workspace admin still gets the first-run empty state with its create-app / system-settings actions, and a user with access to the app enters it exactly as before.

- f565418: fix(plugin-grid): the list link column renders a real anchor when the host publishes record URLs

  The list's `link: true` column (and the auto-linked primary field) rendered as
  a `span role="link"` with no `href`, navigating only through a click handler.
  So the surface users actually open records from had none of a link's native
  affordances — no middle-click / ⌘-click open-in-new-tab, no "copy link
  address", no hover status-bar URL — and `role="link"` without an href is a
  weaker contract for assistive tech than a real anchor. It was also the odd one
  out: the previous release gave record-detail and related-list lookup VALUES
  real anchors, leaving the list column as the weakest of the three surfaces.

  `LinkCell` now renders a real `<a href>` with the same click split: a plain
  left click is prevented and handed to the existing in-app navigation, so drawer
  / modal / page behavior is completely unchanged, while modifier and
  middle-clicks are left to the browser.

  The URL is not assembled in the grid. The object list page publishes its own
  record-URL builder through `RelatedRecordActionsContext.recordHref` — the same
  seam the lookup links use, and the same expression its "open in new window"
  action already navigated with, so the anchor and that action cannot address
  different records. A host that publishes no URL renders exactly what it
  rendered before: the Studio designer, embedded renderers and standalone grids
  are untouched.

  Neither package's published `dist/index.d.ts` changes (measured both ways —
  byte-identical), so this is a patch on both: the list host's new helpers are
  module-level exports behind a barrel that re-exports only `ObjectView`.

- 66fb4fa: The console's language menu now asks the app which locales it actually ships, instead of always offering the same ten.

  `LocaleSwitcher` built its items from a module-level `LANGUAGES` constant — exactly the ten codes `@object-ui/i18n` ships packs for — and never consulted the app, even though `GET /api/v1/i18n/locales` has been serving that list all along. It failed in both directions at once. An app shipping a locale outside those ten (`th`, a regional `pt-BR`) had no way to be selected from the console: the bundle could be complete and lint clean, and the menu simply had no entry for it. An app shipping only `en` and `zh` still listed all ten, so picking 日本語 handed the user the console's own chrome in Japanese with everything app-authored in the fallback language — a half-translated UI its author never opted into.

  The menu is now the **intersection**: the app's own locale list ∩ what the renderer can actually resolve (built-in packs, `config.resources`, and — for an app that wires a dynamic `loadLanguage` loader, which is how the console gets its packs — the locales that loader can fetch). Both failure directions close in the same change: an app-shipped locale becomes offerable, and locales the app does not ship disappear. The endpoint is reached through a new `loadLocales` prop on `I18nProvider`, wired exactly like the existing `loadLanguage`: the app owns the transport, the provider owns what is done with the answer. An app that does not wire it keeps today's menu unchanged.

  **The restore validation widened in lockstep, because otherwise this fix would have minted the next bug.** A restored language was validated against "the locales this provider can produce" — built-in packs plus `config.resources` — a bound that was correct only for as long as the menu offered exactly the built-in ten. The moment the menu grows to the app's real list, a locale the user can now pick is a locale that bound rejects, so a user-picked app locale would have been purged on the next page load. It now also accepts a locale a wired dynamic loader may be able to fetch, and the bound stays honest rather than absent: only well-formed BCP-47 tags qualify (`constructor`, `__proto__`, `en_US` are still rejected, as is any stored locale in an app with no loader), and the app's own locale list adjudicates the choice for real once it arrives — a locale the app has since dropped is reverted and purged rather than left locking the UI to a language with no translations.

  Labels come from the built-in native names where they exist (`中文`, `日本語`, … are unchanged) and from `Intl.DisplayNames` for everything else, so an app locale is named in its own language rather than by its code. The endpoint's own `label` is deliberately not used for display: the server sets it to the code echoed back, which would have put `th` in the menu where `ไทย` belongs.

  While the app's list is in flight the switcher renders nothing, following the sibling menus in the same folder — the ten never flash past on an app that only ships two. When there is no backend, the endpoint fails, or the app answers with nothing this renderer can produce, the built-in ten remain as the offline fallback, so the menu is never empty and never unusable.

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

- 7e4f0e5: fix(dashboard,i18n): KPI cards and dashboard filters resolve authored labels instead of dropping them (#4032)

  A `type: 'metric'` dashboard widget rendered raw English while every other widget
  type on the same dashboard rendered the translation, and dashboard filter chips
  rendered `[object Object]` or the raw stored value. Both come from the same
  cause: authored labels reaching a render site that could not read the
  vocabulary `@objectstack/spec` actually admits.

  - **KPI cards rejoin the widget translation channel.** The self-contained
    `metric` branch built its own label from the raw `widget.title`, so the
    `{ns}.dashboards.{dash}.widgets.{id}.title` value the renderer had already
    resolved was computed and thrown away. It now reads that channel like every
    other widget header.
  - **The three private `resolveLabel` copies** (`DashboardRenderer`,
    `MetricWidget`, `MetricCard`) are gone. Each read the retired
    `{ key, defaultValue }` key-reference form and ended `defaultValue || key`, so
    handed the inline per-locale map the spec admits today they returned nothing —
    a KPI card with a map title rendered the literal string `metric`. All three
    now use `pickLocalized`, the resolver already used for this vocabulary
    elsewhere in the package.
  - **Dashboard filter labels and static option labels resolve per locale.**
    `DashboardFilterDef.label` widens to `string | I18nLabel`, the filter bar
    resolves before rendering (fixing `[object Object]: All` in the trigger, and
    in `aria-label` / `placeholder`), and the `def.label || def.name` gate now
    tests the RESOLVED string — an object is always truthy, so it never reached
    the fallback before.
  - **Option labels are no longer discarded.** `normalizeFilterOptions` coerced a
    map label to the raw stored value in every locale, English included, so
    `{ value: 'domestic', label: { en: 'Domestic', … } }` displayed as `domestic`.
    The pair shape is still normalized; the label vocabulary is preserved for the
    render side to resolve.
  - **`DashboardComponentSchema.globalFilters` is bound to the spec's
    `GlobalFilter`** instead of restated by hand. The restatement was both too
    narrow (`label?: string`, which is what made these read sites invisible to
    `tsc`) and too wide (it declared a bare-string option shorthand the spec
    rejects at publish).

  Plain-string labels are unaffected and render byte-identically.

- af52932: fix(app-shell): the console record header honors `userActions` predicates

  `userActions.edit` / `.delete` reached the console record page's header in
  their **boolean** form but not in their **predicate** form.
  `userActions: { delete: false }` hid Delete on the list row and on the record
  header alike, because the switch flows through the affordance resolver
  (`resolveRecordHeaderActionGates` → `resolveEffectiveCrudAffordances`). The
  per-record object form — `edit: { visibleWhen: … }` — reached the list row
  only: `synthSystemActions` gated on `objectAffordances.edit ∧
recordWriteAllowed` and never parsed, let alone evaluated, the predicate. An
  author narrowing "who may edit this object" to "which records may be edited"
  therefore kept the converged list and lost the record page, where the Edit
  button still opened a form the server would reject on save.

  The header now folds the per-record predicates in as a fourth conjunct,
  evaluated against the open record through the same helper family the row
  surfaces use — `userActionPredicates` from `@object-ui/core` for the parse and
  `useRowPredicate` from `@object-ui/react` for the evaluation:

  - `edit.visibleWhen` / `delete.visibleWhen` false → the synthesized header
    action is not emitted (fails closed; `visibleWhen: false` counts as a
    declared gate).
  - `edit.disabledWhen` / `delete.disabledWhen` true → the header affordance
    renders disabled rather than disappearing, matching the row kebab. On
    `sys_edit` this composes with `OR` onto the `disabled` key the approval lock
    already used, so an approval lock and a declared predicate stay independent
    reasons for the same off.

  The record body's inline-edit session joins the same conjunction, exactly where
  the approval lock already sits, so the header CTA and the body pencils cannot
  disagree about whether this record may be edited.

  The existing affordance, permission and record-writability gates are unchanged
  and the predicate only ever subtracts, so a predicate that holds can never
  resurrect a button the bucket closed or the user may not press. The boolean
  form stays the affordance resolver's channel — a bare boolean yields no
  predicate.

  This completes the convergence started in the row kebab and continued in
  `plugin-detail`'s `DetailView` header: one authored predicate, one evaluator,
  one answer on all three surfaces.

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

- aa45fd7: A row-level-security policy authored under a package is now saved — Studio's package door carries every facet the permission editor can author

  Opening the Access pillar inside a writable package, adding an RLS policy (name, object, USING, CHECK) and clicking a fully-enabled Save produced a 200, a success toast, and no row filter anywhere. The PUT body was `{"name":…,"label":…,"objects":{},"fields":{}}` — the `rowLevelSecurity` key was not on the wire at all, so the record read back after publish carried no policy while the surface still showed one. Tab visibility and the delegated-admin scope were reverted the same way. A silent revert is worse than a refusal here: the admin is left with positive, false evidence that a control is in place.

  `mergePermissionSlice` — the package door's save path (ADR-0086 P0) — rebuilt the record from a freshly-read base and took only `name`, `label`, `isDefault`, `objects` and `fields` from the editor. Every other facet came from the server's stored copy, whatever the author had just typed. The whitelist was correct when it was written and then drifted: `rowLevelSecurity`, `tabPermissions` and `adminScope` became authorable afterwards and nothing said so.

  The rule is now inverted rather than extended by four more names: a facet the editor can author comes from the edited draft, and the freshly-read base supplies only what the editor cannot author. The package scoping that P0 actually needs is `objects` / `fields` and nothing else — the load path narrows exactly those two maps and hands every other facet to the editors unscoped — so other packages' contributed rows are still preserved byte-for-byte by the same row-level merge as before. A facet the edited body does not carry at all still comes from the base: absence means "this caller does not model the facet", never "the author cleared it", and clearing still persists as clearing because the facet editors always write a value (an emptied policy list is `[]`, not a missing key).

  Drift cannot recur silently. A structural guard scans the editor sources for the keys their `setDraft(...)` updaters write into the draft and fails when one of them is not carried by the slice, so the next facet added to the editor reds in CI instead of being discarded on Save. The environment door, which was never affected, is pinned unchanged as a guard, and the pins assert the saved body rather than the toast — a 200 is exactly what this defect already produced.

- 172c73e: The permission matrix honors `allowRuntimeCreate` — and its read-only badge names the gate that actually tripped

  On a stock boot the permission-matrix editor rendered every checkbox disabled, hid Save, and captioned itself `Read-only (OS_METADATA_WRITABLE not enabled)` — in a **writable** package, at both the metadata-admin route and inside Studio's Access pillar — while the server accepted the very write it was refusing to offer (`PUT /api/v1/meta/permission/<n>?package=<pkg>` → 200, measured on objectstack#7637).

  The editor's writability switch read `allowOrgOverride` alone. That flag and `allowRuntimeCreate` are two different doors: the first is permission to OVERLAY a code-shipped item per organization, the second is permission to AUTHOR an item at runtime — and authoring is what this editor's Save does under a `packageId` (`mode: 'draft'` + `packageId`, ADR-0086 P0/P2). The server refuses only when BOTH are false; `permission` sits in exactly the gap, `allowOrgOverride: false` (ADR-0005 forbids per-org overlay of a packaged permission set — silent privilege drift) with `allowRuntimeCreate: true`, which objectstack#6483 kept open deliberately. The switch now reads the disjunction, off the raw server entry, the way `DirectoryPage`, `EmbeddedItemEditor` and `ResourceEditPage` already read it and the way `useMetadata.ts` documents on the field itself.

  The package-level gate is untouched and still dominant: a read-only package locks this screen whatever the type permits, so a code-defined package behaves exactly as before.

  The badge and the controls also stop disagreeing, and the fix is what closed the gap rather than a second edit. `PageShell`'s writability badge was already reading the full disjunction (`readOnly` → `allowOrgOverride` → `allowRuntimeCreate`); the controls were the outlier, so the two predicates are now byte-identical and a four-state table pins them that way. Previously this screen showed a "create-only" badge above 207 dead checkboxes.

  The read-only caption is honest in both directions now. `OS_METADATA_WRITABLE` was never the type gate's cause — that variable does not sit beside `allowOrgOverride`, it flips it (`getMetaTypes` emits `allowOrgOverride: base.allowOrgOverride || isEnvOverridden`), so there was no reachable state in which the old sentence was the right explanation: whenever the hatch is on for a type, that type is writable and no read-only badge renders. The caption now names the per-type registry declaration that actually locked the surface, and keeps the env var where it belongs — as the documented remedy, in the hint.

- 878140b: The permission matrix models the server's artifact tier — no Save that 403s on a code-declared set

  The server's metadata write gate is **two** tiers, and the permission-matrix editor modelled only the first. After the type tier was opened (#4446), an environment-scope edit of a **code-declared** permission set rendered live checkboxes and a Save button that failed at the end with `403 not_overridable` instead of a surface that explains itself up front.

  The second tier is the one `saveMetaItem` applies after the type-tier disjunction has already passed: for an item a code package _ships_, `allowRuntimeCreate` is not enough, because overwriting a packaged item is an **overlay** and overlaying needs `allowOrgOverride`. `permission` sits exactly in that gap — `allowOrgOverride: false` (ADR-0005 forbids per-org overlay of a packaged set: silent privilege drift) with `allowRuntimeCreate: true`. The editor now computes the same three-way rule `ResourceEditPage` has modelled all along, read off the layered envelope it already fetches — including the `sys_metadata` provenance sentinel, so a **published org set** stays editable instead of being mis-read as a packaged one. No new server round trip.

  It is scoped to the environment door. Under a `packageId` the write is a package-door draft (ADR-0086 P0/P2) and the measured behaviour is 200, so the #4446 headline case — a code-declared set on the single-kernel showcase — stays writable exactly as it was; a code-defined package there is already locked by the package-level read-only gate, which still dominates every other gate. Runtime-created sets stay editable at both scopes.

  The new read-only case gets its own caption rather than borrowing an existing one. Naming the type would be the mirror image of the wording #4446 removed: the type _does_ have a runtime write channel, and a brand-new set authored on this screen still saves fine — what is locked is this one set, because a code package provides it. The caption says that, and the hint carries the server's own reason and its documented remedy.

- c0f9a4b: Studio surfaces the runtime authoring gate's advisory findings instead of discarding them client-side

  The framework's runtime authoring gate produces two kinds of verdict on a metadata write. Errors become a 422 and the author sees them. Advisories ride a **200** — the save succeeded, the row persisted, the version bumped — and until objectstack#7435 the server dropped them into a deduped `console.warn` behind a process-level set. That landing put them on the wire as an optional `advisories[]` on the save response, emitted only when non-empty, and objectui was still throwing them away one layer further out: `MetadataClient.save` parsed the body, returned it as an opaque `T`, and every call site awaited it for its side effect and discarded the value.

  The measured case the fix is built on: a `nightly_purge` flow whose only defect is a `delete_record` node with `multi: true` and no filter yields `errors = 0 / advisories = 1`. The save returns 200, the flow goes live, and nothing anywhere tells the author it deletes every row. That matters most for exactly the authors Studio serves — a Studio tenant or an MCP/AI author has no `os lint` and no CLI config for `sys_metadata` overlay rows, so this gate is not the weakest of four doors, it is the only one.

  `MetadataClient` now carries an `onSaveAdvisory` sink, invoked after a save whose response carried a non-empty `advisories[]`, and the console wires it in `useMetadataClient` — the one hook every app-shell write path takes its client from, so a single wiring covers `ResourceEditPage`, `StudioDesignSurface`, `EmbeddedItemEditor`, `DatasourceResourcePage`, `ObjectHooksPanel` and any future call site rather than a toast copied into twenty of them. The finding shape is re-exported from `@objectstack/spec` (`RuntimeAuthoringIssue`) rather than restated, so it cannot fork from the 422 `issues[]` it deliberately shares a declaration with.

  The affordance is the warning tier and says "Saved" first. A successful save that reads as a failure is the specific defect this surface must not ship, so the toast acknowledges the write, lists `rule` + `message` + `hint` per finding with `where` as secondary context, and renders that text **verbatim** — `message` and `hint` are server prose composed by the gate's rules, not i18n keys. Only the frame around them is translated (`console.saveAdvisoryTitle`, ten packs). The sink is best-effort in both directions: a malformed finding is dropped rather than printed as blanks, and a throwing renderer cannot turn a save the server already committed into an error.

  **What this does not surface yet, and why.** Studio's designer saves as a **draft** on every edit, and drafts are never gated — the framework returns at its D1 early-return (`if (args.state !== 'active') return null`) before running a single rule, so a draft save produces no findings at all rather than producing some that get withheld. The publish step that promotes a draft to active _does_ run the gate, but the publish route returns no `advisories` field until objectstack#7294 lands. So a draft-then-publish flow renders nothing today, at both of its doors, for two different reasons; the active-mode save door renders findings now. That gap is pinned as a test rather than left for a reader to rediscover.

- cb315f2: Report and dataset-preview measures follow the display locale (objectui#4575)

  objectui#4566 gave `formatMeasure` / `formatDimensionValue` in `@object-ui/core`
  an optional trailing `locale` and threaded `useDisplayLocale()` through the
  dashboard's `DatasetWidget`. The parameter is OPTIONAL by design, so the
  producer could land without dragging every consumer with it — which left the
  consumers it did not reach still formatting in the MACHINE's locale. A German
  session read a report measure as `1,234.5` directly beside a dashboard measure
  that, after #4566, rendered `1.234,5`: one number, two spellings, on the same
  screen. That is a sharper inconsistency than the one before #4566, when both
  surfaces were uniformly wrong.

  The remaining thirteen call sites now thread `useDisplayLocale()`:

  - `plugin-report`'s `DatasetReportRenderer` (ten) — the grouped table's measure,
    dimension and grand-total cells, the embedded single-value chart's metric, and
    the cross-tab's across-axis header, down-axis cell, measure cell, row total,
    column total and grand total;
  - `app-shell`'s metadata-admin `DatasetPreview` (two) — the preview table's
    measure and dimension cells;
  - `app-shell`'s `DatasetDefaultInspector` (one) — the measure format-hint
    sample, which is a preview of authored formatting and so has to be rendered
    through the channel it previews.

  **English output does not move**, and that is the discriminator against the
  sibling fix. These sites already went through `Intl` with default grouping, so
  the only thing that changes is WHOSE locale is used — contrast objectui#4553,
  where `formatPercent` had never grouped at all and moving en `1235%` to
  `1,235%` WAS the fix. Every new case pins the same value in de AND in en, so
  at least one half must fail on any runner: before the change both render in the
  machine's locale, which is what makes the machine locale stop being a test
  input.

  Two details worth recording:

  - **The cross-tab's header labels are built inside a `useMemo`**, so the locale
    joins that dependency array. Threading it into the call alone would leave the
    headers frozen in whatever locale they were first built with — measured, and
    pinned by a case that changes only the locale and asserts the header
    re-labels. Removing just the dependency entry turns exactly that one case red
    and leaves the other nine green.
  - **The metadata designer's `locale` prop is deliberately not used.** It carries
    the designer's own chrome language (`useMetadataLocale()`, which resolves to
    exactly `en-US` or `zh-CN`), not a number-formatting locale — a German session
    gets `en-US` from it. The preview's numbers have to match what the report and
    dashboard render for the same dataset, which is `useDisplayLocale()`.

  Both packages are `patch`: their published declarations are unchanged (measured
  against the built `.d.ts` with `dist/` cleared between builds). The threading is
  module-local, and the one signature that gained a parameter — the file-local
  `bucketLabel` helper — is not exported.

  A side effect of the fallback: these surfaces are now DETERMINISTIC where they
  previously followed whatever locale the machine happened to run in.
  `useDisplayLocale` ends at a concrete `'en'` rather than the `undefined` that
  hands `Intl` the machine's locale.

- 3032107: metadata-admin: retire the standalone `validation` resource, and move
  `ValidationPreview` onto the embedded path the framework actually evaluates
  (objectui#4132)

  `anchors.ts` registered a standalone `validation` resource anchored by
  `anchorByField('object')`, complete with `createFields` / `createSchema` /
  `createDefaults`. That gave every object's Related tab a "Validations" group
  whose `+` routed to `validation/_new`, and the file justified it in a comment:
  "usually embedded in the object, but standalone variants do exist."

  They do not. ADR-0088 / objectstack#4509 retired `validation` as a metadata
  kind, and the framework ledger (`packages/spec/liveness/validation.json`)
  records that the door never led anywhere in the first place:

  > a STANDALONE `validation` item (file `*.validation.ts` or Studio) never
  > reached any object's write path, because the schema has no object-binding key
  > and — every variant being `.strict()` — an author could not add one; no merge
  > code existed […] A state machine authored through that door saved cleanly and
  > gated nothing.

  Re-measured against the installed `@objectstack/spec` 17.0.0-rc.6 by parsing the
  shipped registries rather than grepping source: `validation` is in neither
  `DEFAULT_METADATA_TYPE_REGISTRY` (27 kinds) nor
  `listUnregisteredKindSchemaTypes()` (`connector`, `sharing_rule`, `webhook`). So
  the console was offering an authoring affordance for a kind the framework does
  not have — the "shipped false signpost" shape, where the most confident surface
  in the product is the one for the thing that does not work.

  **What is gone**: the standalone registration, its create affordance, and the
  stale comment. **What stays**: the embedded anchor `__object_validation`
  (`editAs: 'validation'`, `embeddedPath: 'validations'`) — rules live inside their
  object, and that is the path the framework evaluates.

  **The renderer moved rather than retiring with the door.** `ValidationPreview`
  renders a rule's label, description, severity/message callout, per-variant body
  and tags, and until now the only route that mounted it was `ResourceEditPage`'s
  Preview tab on the retired standalone resource; the governed route (Related tab
  → `MetadataDetailDrawer` → `EmbeddedItemEditor`) drew a bare `SchemaForm`.
  `EmbeddedItemEditor` now looks a preview up by the anchor's `editAs` and mounts
  it above the form on the live draft. The lookup is generic, so this is not a
  `validation` special case: an embedded sub-type with no registered preview
  (`index`) is unchanged and grows no empty preview chrome. This also re-opens
  objectstack#7427's `validation.label` / `.description` / `.tags` ledger rows,
  which were graded `dead` precisely because the render was unreachable on the
  evaluated path.

  **One read went with the door.** `ValidationPreview` painted an
  `object: <name>` pill, exempted from the objectui#3275 cleanup on the stated
  ground that "anchors.ts registers a standalone `validation` resource … so a
  standalone rule really does carry it". With that registration gone the read has
  no producer, and it never had one on the governed path either — measured,
  `ValidationRuleSchema.safeParse({ type: 'script', …, object: 'account' })`
  returns `unrecognized_keys: ['object']`. The pill could only ever confirm a key
  that makes the rule unsaveable. Its test case is replaced rather than re-spelled:
  the schema's verdict is now the instrument, and the preview is asserted not to
  paint the key.

- c32a8a1: `richtext` fields are placed like the long-form fields they are — four layout sets stopped spelling the type three ways the spec rejects

  `@objectstack/spec` spells the WYSIWYG type `richtext`, one word, and **rejects** `rich_text` and `rich-text`: both exist only as typo keys in the spec's own `suggestFieldType` table, so `FieldSchema` refuses a field declared with either. Four sets that place fields by matching the RAW type string carried nothing else — `SKIP_TYPES` in the related list spelled it `rich_text`, both `WIDE_FIELD_TYPES` and `SECONDARY_FIELD_TYPES` spelled it `rich-text` — so each set was inert for the only spelling a producer can emit, and every one of them named the type it was failing to handle.

  For a real `richtext` field that meant: it was auto-derived into a related-list column, it never spanned the full row in a multi-column detail section or form (unlike `markdown` and `html` sitting right beside it in the same sets), and it stayed in the dense primary section of the record page instead of dropping into "More details". All four move together — half of them would have left the detail page and the form disagreeing about the same field, which is worse than the uniform gap.

  The dead spellings are dropped rather than kept alongside the live one: the alias table is the single place aliases belong, and a set that carries both invites the next drift. The pins are derived from the spec's own `FieldType` vocabulary instead of enumerated, so a member that stops being a real type name fails by name — replacing an assertion that was green only because the set contained the string it asked about.

  `markdown` joins `richtext` and `html` in the related list's `SKIP_TYPES`, on a measurement rather than on the assumption that it renders raw. It does not: markdown and richtext both render through `MarkdownCellRenderer`, formatted and sanitized. The reason none of the three works in a table is that the formatted output is block-level — a heading, paragraphs, a list — inside a single-line truncating cell, so a document shows as one clipped heading with the rest invisible. `textarea` stays derived for the same reason read the other way: it renders as plain truncated text, which is a useful column. Author-declared columns are untouched — this set only filters the zero-config auto-derive walk.

- 338e2c4: "Set as Default" and drag-reorder work again on saved views — the adapter's
  `updateView` was being called unbound (objectui#4463).

  `handleSetDefaultView` and `handleReorderViews` both detached the method into a
  local before calling it (`const updateView = (dataSource as any).updateView;`
  … `updateView(objectName, target, patch)`). Detached, `this` is `undefined`
  inside the adapter, whose `updateView` opens with `await this.connect()` — so
  every write in the list rejected with `TypeError: Cannot read properties of
undefined (reading 'connect')` **before a single request was issued**. QA
  measured zero network requests, one console error and a "Failed to set default
  view" toast; the view never gained `isDefault` and the prior default was left
  in place. Rename and pin worked from the same menu because `handlePinView`
  always called the method as a method — that is the convention this restores.

  Both call sites now route through one exported helper, `dispatchViewPatches`,
  which issues `dataSource.updateView(...)` as a method call. Having a single
  dispatch site means there is no local left to detach into, so the two handlers
  can no longer drift apart on this. Reorder's write set moves to a matching
  exported helper, `reorderViewPatches`, so the `sortOrder` sequence it persists
  is assertable without mounting the view.

  Both handlers now also require a resolved `objectName` before writing, matching
  the guard the view-override effect in the same file already used: the adapter
  keys its cache invalidation on the object name, so a write issued under
  `undefined` would have changed the server and then failed to invalidate what it
  changed.

- 605b747: The second metadata client class surfaces the runtime authoring gate's advisories instead of discarding them

  objectui#4133 (PR #4236) put the gate's advisory findings — the ones that ride a **200**, where the save succeeded and the row persisted — in front of Studio authors, but it covered only one of the two client classes that write through `PUT /api/v1/meta/:type/:name`. The wiring lifts at `useMetadataClient`, which is where every app-shell path takes its `MetadataClient` from. `ObjectStackClient.meta.saveItem` — the SDK client hanging off `ObjectStackAdapter` — is a different class reaching the same door, and every one of its callers awaited the call and discarded the response, so an `advisories[]` the server attached was parsed off the wire and dropped one layer further out.

  Those callers all write in **active** mode, so this is not the draft case where the gate never runs: the gate does run for them, produces findings, and the author was told nothing. The list is `MetadataService` (five saves behind the Object Manager and Field Designer), `useNavigationSync`, plugin-designer's Create/EditAppPage, and the adapter's own `updateViewConfig` / view / `updateDashboard` paths.

  `ObjectStackAdapter` now carries an `onSaveAdvisory(listener)` subscription and emits on it after a metadata save whose 200 carried a non-empty `advisories[]`; `AdapterProvider` subscribes once and renders through the same `emitSaveAdvisories` the other client class already uses, so both doors produce one wording on the warning tier that says "Saved" first. The emitter is installed **once at the adapter/client seam** rather than at the call sites: every caller above reaches the save door through the adapter's own long-lived `ObjectStackClient`, so one interception covers all of them, plus any future one, without a toast copied into a dozen places — the same reasoning that put #4133's sink at one factory instead of twenty call sites.

  It is a sibling of the `onWriteWarning` channel (#3431/#3455) rather than a second payload pushed down it, which is what `MetadataSaveAdvisoryEvent` already said it was modelled on. `WriteWarningEvent` is a closed shape whose required `droppedFields` means "fields the write legally stripped", so carrying advisories on it would either force every existing subscriber to grow a branch or make the event lie about what happened. The seam's shape is reused; its event type is not. `readSaveAdvisories` is shared unchanged between the two clients — one reader, two call sites — which the response envelopes make possible: the spec puts `advisories` at the save body's top level, and the SDK returns that body verbatim (it strips its `{ success, data }` envelope only when a `data` key is present, and this body has none). That measurement is pinned by tests that drive a real SDK client through a fake `fetch` rather than stubbing the method under test.

- 79a40ad: Set-default on a saved view fires its write again — a stored `id` can no longer rename the tab out from under the overlay read

  "Set as default" could do nothing at all: no toast, no request, no change. The filer measured that the adapter cannot produce that — `ObjectStackAdapter.updateView` has no early return between its read and its `saveItem`, so every patch shape it is handed becomes a write — which put the cause above it, in the view switcher.

  It was an identity seam. Views reach `ObjectView` through two independent reads of the same `type='view'` metadata namespace: the object definition's `listViews`, keyed by the composer's `<object>.<key>` identity, and the adapter's `listViews()` overlay rows. Everything that decides whether a view is mutable — the tab's `readonly` flag, the `isSavedView` guard, and the early return in all five mutating handlers — asks whether a tab's id is among the overlay keys. So the two reads have to spell the same view's identity the same way, and they had two different spellings to do it with. The overlay side stamped `id` last and was safe; the metadata side built each tab as `{ id: <key>, ...body, ...override }`, with `id` FIRST, so any `id` key inside the merged body or the stored override replaced it.

  Both of those are stored documents that really do carry one. `persistViewPatch` writes the whole tab object — its `id` included — back through `updateViewConfig`, so a personalized view leaves an override row carrying an `id`; and a duplicated view copies its source artifact's `id` verbatim into the view body, which `MetadataProvider` spreads into the `listViews` entry. Either way the tab ended up under an id the overlay read had never heard of, the view was classified as system, and — because the set-default, rename and delete entries render only under `!readonly` — the menu entry was **absent** rather than present-and-inert. That is why the symptom reads as "nothing happened" instead of "refused": there was no control left to click, and the guard's toast was never reached.

  The fix is one spelling instead of three. `viewRowId` answers "what is this row's identity" (`name` → `id` → `_id`, empty strings skipped) for the producer and every reader, and is idempotent across the overlay normalization so the key written and the key read back cannot drift. `viewEntry` stamps identity last at all three tab-building sites, so a tab id is a property of the key it was looked up by and never of the data. `isSavedViewId` is now the single predicate behind both the tab's `readonly` flag and the handler guard, so the menu and the handler agree by construction rather than by coincidence.

  No behavior was loosened to get there: the guard is unchanged, and a genuine system view stays read-only with its mutating entries correctly absent.

- b3f665b: `/setup` is a real address again — the console gets a stable deep link into platform administration instead of bouncing you back to home

  Opening `/_console/setup` landed on `/_console/home`. System settings had no direct URL at all: the only way in was clicking the 「系统设置」 card on the home launcher, which meant the entry point could not be bookmarked, could not be pasted into a support runbook, and was asymmetric with Studio, whose front door has been stable for a while.

  The route was never missing — it was occupied. `/setup` mounts the first-run owner-bootstrap wizard (ported here when the Account SPA was retired), and that page evicts everyone it is not meant for: a signed-in visitor via `window.location.assign('/')`, which the landing resolver then turns into `/home` on any multi-app deployment. So the bounce was the wizard doing its job at a URL that had quietly acquired a second, more common meaning.

  `/setup` now decides between the two, on the condition the wizard itself already probes — whether the deployment has an owner (`GET /api/v1/auth/bootstrap-status`). No owner yet: the wizard, unchanged. Otherwise: the platform-administration deep link. A live session short-circuits the probe entirely, because `hasOwner: false` cannot be true while somebody is signed in — which also keeps a failed probe from re-creating the bounce it is meant to remove. The verdict is latched for the lifetime of the mount, because `signUp()` flips the session to authenticated while the wizard is still renaming the bootstrap organization, and re-deciding on that flip would unmount the wizard mid-submission.

  The destination is read from metadata rather than spelled out. `SetupRedirect` (new, exported from `@object-ui/app-shell` alongside `SystemRedirect`, with its policy available as the pure `resolveSetupAppPath`) resolves the Setup app through the same `appRouteSegment()` helper the home launcher's app cards use, and forwards to the app ROOT — so the page you land on is whatever `AppContent` already resolves as that app's landing item, not a second copy of that policy that would drift the next time Setup's navigation is re-ordered. Search and hash carry across the hop, as they do for `SystemRedirect`.

  Two edges are handled rather than papered over. An unauthenticated deep link now goes to `/login?redirect=%2Fsetup` through the console's existing auth-redirect contract — router-derived, so it stays correct under a `<base href>` mount — and lands back on `/setup` after signing in; previously it reached a bare `/login` and the deep link was dropped. And a viewer whose metadata contains no Setup app (the common cause is not a broken build but a missing `setup.access` permission, which filters the app out server-side) gets the shell's ordinary "App not available" screen, with its retry and its one-shot metadata re-check — never a silent landing on home, and never the bare `/apps/setup` pseudo-route, which would have resolved to whichever app happens to be the default.

  `/_console/studio` was checked for the same asymmetry and needed no change: bare `/studio` is a declared front door rendering the builder landing, and `/studio/:packageId` already redirects to its Data pillar.

- bed18a5: Home's action centre stops counting messages the user has already read, and the inbox is read once per page instead of twice (#4316, #4225)

  `useHomeInbox` read `sys_inbox_message` and nothing else — it never joined
  `sys_notification_receipt`, where ADR-0030 (resolved decision 2) puts read-state.
  So Home's "Needs your attention" card could not tell a read message from an
  unread one: it listed the five most recent unconditionally and badged them. A
  user who opened the bell, read all nine messages and returned to Home still found
  up to five of them filed as work waiting on them — while the bell two hundred
  pixels above correctly showed zero, because its own poll did join the receipts.
  One page load, two panels, opposite claims about the same rows (#4316).

  The fix is the one #4225 sketched: `hooks/sharedUserFeeds.ts` gains an inbox feed
  holding the bell's already-joined 20-row window, polled once at the bell's 10s
  cadence, and BOTH consumers derive from it — the bell lists the window and badges
  its unread topics, Home takes the unread ones newest-first and caps them at its
  own smaller limit. Home's second query is gone (one `sys_inbox_message` read and
  one `sys_notification_receipt` read per page, not two and one), and the two
  surfaces can no longer disagree about a row's read-state, because there is no
  second read left to drift from the first.

  Two supporting changes travel with it, both visible only when something goes
  wrong. The shared store now reports per-feed status in the same four words the
  rest of the console uses (`idle` / `loading` / `ready` / `error`, per #4300's
  one-dialect ruling): it used to swallow every failure into "keep the last value"
  and say nothing, which is indistinguishable from a successful re-read, and would
  have turned #4235's hard-won `error` state back into stale-but-confident data on
  its way through the store. A missing object (404 / `OBJECT_NOT_FOUND`) is still
  an answer — the deployment has no inbox, so nothing is waiting — and a denial
  still is not. The bell's hidden-tab throttle, its return-to-tab refetch and its
  failure backoff moved into the store with the poll rather than being dropped, and
  now apply to every shared feed.

- 98eb4fc: The Studio Data pillar's grid no longer issues a duplicate `find()` on every render (#4567).

  The pillar built its object-view `table.fields` inline, allocating a fresh columns array on every render. That array's IDENTITY is a data-fetch input downstream: plugin-view's ObjectView forwards it to the `renderListView` slot as `columns` by reference, and ListView derives its `$expand` fields from `schema.columns` with the array in that memo's dependency array by identity, which is itself in the fetch effect's dependency array. So each render of the pillar issued another list query — measured 1 to 4 across three re-renders that changed nothing. It was invisible in the UI (the rows repaint with the same data) while multiplying backend load on a surface that re-renders at keystroke rate.

  The columns array is now memoized on the draft's `fields`, so it changes identity only when its contents change. The dependency stays live: adding, removing or reordering a field still refetches. The fix is module-local memoization at the producer — `ListView`'s by-identity dependency is correct for a genuine column change and is untouched, as is the refresh channel pinned by #4549.

- f046f88: Studio's read-only packages stop advertising writability they do not have — the `access` header badge and the `Data → Form` layout caption now report the gate that actually governs the screen

  Two captions on the Studio package surfaces contradicted the controls beside them. Both are display-side defects: the interaction gating was already correct in each case, and this change does not touch it.

  **The `access` header badge.** `/studio/<pkg>/access` rendered a permission set's title row as `... · Security · writable · ...` while all 207 permission checkboxes and the Save button below it were disabled with the read-only-package tooltip. The two renderings answer the same question — "can you write this?" — from different inputs. The controls read `!!resolved.allowOrgOverride && !readOnly`, i.e. the type registry AND the host package gate, which is the right answer. The header badge read `entry.allowOrgOverride` alone, and `permission` is one of the overlay-allowed types, so that flag is true and the badge said `writable` in every package. `PageShell` now takes a `readOnly` host gate that dominates the type-level flag, and the Studio Access pillar passes the same value it already gives the matrix's own controls; the tooltip names the package as the reason, reusing the wording (`engine.studio.pkg.readonly*`) the Studio top bar and the identity strip already use for this gate rather than inventing a second spelling. The badge slot was extracted into one `WritabilityBadge` component because it was duplicated verbatim in the compact and hero headers — the shape that lets a gate be honoured in one header and forgotten in the other.

  **The `Data → Form` layout caption.** In a read-only package the form tab read `Draft layout — your unsaved changes` with `Save draft` disabled and no draggable element on the surface at all. The mechanism was not a stale diff: the caption was selected by `formMode === 'layout'` — a TAB selector — so it asserted pending edits on every clean layout tab, read-only or not, while the component's real `dirty` flag sat a few lines below driving the preview warning. The claim is now made only when there are real local edits on a surface that can save them, and a neutral `Draft layout` caption (`engine.studio.data.form.layoutBadgeClean`, added in both locales) covers every other case, so the caption still names what you are looking at.

  Nothing about the read-only policy changed. This is the B-half of the objectstack#5768 split ruling — Studio keeps its blanket package-level read-only ("Studio 维持包级只读") while the A-half, whether the overlay-allowed types become individually editable, is still under review. The suites added here pin that deliberately: alongside the caption assertions they carry control tests asserting that a read-only package still disables every checkbox, still offers no Save, and still exposes no add-field affordance — so a change that made anything editable would fail even though the caption assertions would pass.

  Not covered, and correct as they stand: the metadata directory and resource-list badges read the type registry alone, which is the whole truth in those non-package-scoped screens; the OWD overview panel's unsaved badge and the form tab's preview warning were already derived from real edit state.

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

- 690ae0f: The Unpublished-app banner now reads the ADR-0045 publish gate `_unpublished`, not the navigation flag `hidden` — so a published app that is merely kept out of the launcher no longer wears the "only builders can see it" watermark

  Upstream (framework PR #6942, objectstack#4829 ruling A1) split one flag into two with disjoint meanings: `_unpublished` is the machine-managed publish gate that materialization sets and publish clears, while `hidden` became author-declared navigation presentation and nothing else — "Hidden apps stay fully routable and permission-checked". `UnpublishedAppBar` read `hidden`, which after that split was wrong in **both** directions at once, and both are fixed here:

  - **False positive.** A published, nav-hidden app — the built-in `account` app is the specimen — rendered the amber "Unpublished app — fully functional, but only builders can see it" bar. The app was live to every user; the console told its owner the opposite.
  - **False negative.** A genuinely unpublished app whose author had not also set `hidden` rendered no bar at all. The server withholds unpublished apps from non-builders, so this watermark is the _builder's own_ only signal that what they are looking at is not live yet — losing it means publishing feels already-done.

  This was not latent: console pin bump objectstack#7308 put an objectui build keying on `hidden` in front of a framework that had already redefined it, so both directions were live in the bundled console.

  The Publish button on that bar writes `PUT /meta/app/{name}` with `{"_unpublished": false}` instead of `{"hidden": false}`. `false` rather than a key delete, matching the server's own `POST /packages/:id/publish-drafts` flip: ADR-0045 §3 makes publish/unpublish symmetric, so the gate stays two-state rather than a key whose absence has to be re-derived. Whatever `hidden` the app carries now rides through the write **untouched** — publishing an app must not silently rewrite the author's navigation choice, which is the regression objectstack#4829 was filed for in the first place. The package-level Publish (`POST /packages/:id/publish-drafts`) is unchanged; the server-side flip it triggers already clears `_unpublished`.

  **Launcher surfaces deliberately do NOT move to the new key** and are pinned against it by test, because the symmetry is a trap rather than an oversight. `_unpublished` is enforced server-side — the REST metadata gate withholds those apps from everyone who should not see them — so an unpublished app that reaches the client at all belongs to a builder who is entitled to navigate to it; filtering it in the launcher would hide a builder's in-progress app from the builder while buying no protection the server was not already providing. `hidden`, by contrast, has no other enforcement point anywhere: that client-side filter _is_ its entire implementation. Two keys, two enforcement layers, so the App Switcher, the `AppContent` launcher list, the home grid and the root landing resolver all keep filtering on `hidden` alone.

  No authoring surface, wire format or exported type changes. The `publish-drafts` response fields `unhiddenApps` / `unhideError` keep their spelling: the framework still emits exactly those names, and renaming only the consumer would be the same silent break this pair of cards exists to close.

- eec2e4f: `useObjectChat` declares the message shape it actually hands back

  The hook typed `messages` — and the `onSend(content, messages)` callback fed from it — as `@object-ui/types`' authoring `ChatMessage`. That was true in local mode only. In API mode the values came out of the runtime mapper and were asserted into place with `as OuiChatMessage[]`, and the authoring contract declares none of what they carry: `buildProgress`, `blueprintProgress`, `charts`, and `pendingActionId` / `draftReview` / `proposedPlan` / `proposedChanges` / `builderHandoff` on every tool invocation. Those keys are the HITL approval card, the "Review N changes" affordance, the proposed-plan card, the build panel and the inline charts. They survived only because nothing on the path ever rebuilt a message; anyone writing the obvious thing — reconstruct a message field-by-field from its declared type — deleted all of them, with the compiler agreeing, because the declared type genuinely did not have them.

  The declaration is now the truth, published as `ObjectChatMessage`. The survey behind it found the honest type to be neither of the two `ChatMessage` types on either side, because neither is true of both modes: it stays **wide** where local mode is wide (an authored `'tool'` role and the legacy `'partial-call'` / `'call'` / `'result'` tool states reach this surface unchanged and are folded only at the render seam), **narrow** where both modes are narrow (`timestamp` is `string`, never `Date` — API mode never produces one and local mode absorbs it before emitting), and adds the render-only keys API mode really carries. The `as OuiChatMessage[]` assertion is deleted rather than moved: the mapper's output satisfies the declared type, so the compiler checks that assignment instead of being told to stop looking.

  Nothing about the values changed, and nothing correct breaks. `ObjectChatMessage` is a **subtype** of the authoring `ChatMessage` it replaces, so every consumer that accepted the old declaration still accepts these values — including a host `onSend` callback that types its parameter as `ChatMessage[]`, which keeps type-checking by contravariance. Naming `ObjectChatMessage` is what lets a host _read_ the keys above. The one observable narrowing is deliberate: code that branched on `timestamp instanceof Date` was handling a value this hook cannot emit, and now says so at compile time.

  The seam below it (`chatMessageAdapter.ts`, from objectui#4399) is still necessary and unchanged in behaviour — `'tool'` and the legacy tool states still have to be narrowed for the renderers. What changed is that its pass-through is no longer an act of faith: its input type (`SeamChatMessage`, also exported, alongside `SeamToolInvocation`) names the render-only keys, so the spread preserves them as declared properties the compiler can see, and the pass-through tests type their API-mode fixture directly instead of casting it past the compiler. A cast returning to the hook is now caught by a test rather than by a future outage.

  App-shell carries a comment-only correction on the same family: `AiChatPage` still described `@object-ui/plugin-chatbot` as exporting a second, minimal legacy `ChatMessage` alongside the enhanced one. That collision was retired in objectui#4383 — the barrel publishes one contract and `ChatbotEnhancedMessage` is a deprecated alias of it — so the paragraph was sending readers to look for a hazard that no longer exists.

- d2f6e6b: Publishing a view from the console no longer serves a five-minute-stale override map — every writer now routes through one invalidation seam

  `ObjectStackAdapter` caches two view-shaped reads: `getView` under `view:{object}:{name}` and `listViewOverrides` under `view-overrides:{object}`, with `MetadataCache`'s default 5-minute TTL. objectui#4363 made the adapter's own four write paths drop both. But the console's real create-a-view flow never calls any of them: `ObjectView.handleViewCreate` writes through the ADR-0034 metadata seam (`createRuntimeMetadata` → `metadataClient.save`), and Publish goes `RuntimeDraftBar` → `publishRuntimeMetadata` → `metadataClient.publish`. Two writers into the same `/meta/view/:name` rows; only one of them invalidated anything.

  Publish is the sharp end. A create lands an invisible per-item draft, and `listViewOverrides` enumerates published rows, so the map is still honest there. Publish promotes the row into exactly the world the map describes — and nothing dropped the key, so the object page kept applying its pre-publish snapshot for the rest of the TTL. It does not self-heal: `loadViewOverrides` treats a resolved map as authoritative and deliberately does not re-probe per view (objectui#3774, correct — re-probing reinstates the 404 flurry the batch read exists to remove), so the per-view `getView` fallback that would have masked a stale map is by design unreachable.

  The fix is one seam rather than a fifth copy of the key list. `ObjectStackAdapter.invalidateViewKeys(objectName, viewName)` is now the only place that knows which keys a view-row write drops; the adapter's four write paths call it instead of restating the pair, app-shell's ADR-0034 persistence module calls it for `view` saves, creates, publishes and discards, and `MetadataService.saveMetadataItem` calls it when the category is `view` (where it previously named `view:{name}`, which no reader has). Restatement is what this repo keeps paying for — objectui#3778 removed five copies of a key no reader populated, objectui#4363 fixed four copies that named half the live set, and objectui#4373 is the measured proof that a new writer forgets the list by default. A pin suite can only guard writers that exist; a seam makes the next one unable to forget.

  No cache key, no read path and no public signature changed. The adapter's eight existing invalidation pins pass unchanged, which is the evidence that routing four paths through a seam changed nothing observable; two new structural guards keep the key set from being restated again — one asserting each key template appears exactly twice in the adapter (its reader, and the seam), one asserting no app-shell file spells either.

- b954120: metadata-admin: diagnose a path on the right-hand side of `==` / `!=` in a visibility predicate

  The predicate evaluator resolves paths only on the LEFT of `==` / `!=`. The right-hand side goes
  through `parseLiteral`, which hands back anything it does not recognise as a literal verbatim — so
  `data.a == data.b` compares the value of `data.a` against the seven-character string `"data.b"` and
  is false however equal the two sides are, with nothing in the console. objectstack#6936's
  unresolved-path warning cannot see this: it hangs on `resolveValue`, which the right side never
  enters.

  A dev-mode `console.warn` now fires when that tail returns something path-shaped (a dot-separated
  identifier chain — the same grammar the left side accepts), naming the text, the predicate carrying
  it, and the boundary. **No semantics change**: `data.a == data.b` still evaluates false, and the
  before/after verdicts are pinned identical. The semantic fix belongs to publish-time predicate
  validation (objectstack#7010) and to the real CEL runtime this file stands in for (ROADMAP M9), with
  which this diagnostic retires.

- ff84b05: Stop the report config panel being titled "Title", and the view-settings colour section "Color"

  Two call sites asked for a key whose value was written for a different slot, so the rendered copy was wrong (objectui#4118, surfaced by objectui#3810's census).

  `ReportConfigPanel` used `report.editor.title` for both its heading and the accessible name of its `role="complementary"` landmark. That key is the label of the report's Title _field_ — `report.editor.titlePlaceholder` ('e.g. Pipeline by Quarter') sits directly under it in the pack. So the panel was headed "Title", and a screen reader announced a complementary region named "Title", which says nothing about what the region is. A new `report.editor.panelTitle` ('Edit report' — what the call site's own dead fallback said before objectui#3810 aligned it to the pack) now names the panel, in all ten locale packs.

  `ViewSettingsPopover`'s colour section used `list.color`. On the wide toolbar `ListView` already uses both keys correctly for the two slots of this one feature: the compact `Paintbrush` button is `list.color` ('Color') and the panel it opens is headed `list.rowColor` ('Row Color'). This popover is that same panel on the collapsed/`compactToolbar` surface, so it now takes `list.rowColor` — an existing key, no pack change.

  No `en` value of an existing key changed; `scripts/check-i18n-en-drift.mjs` reports 0 en values changed, 1 key added.

- Updated dependencies [0e67b53]
- Updated dependencies [ceccdcf]
- Updated dependencies [d6e5124]
- Updated dependencies [debad27]
- Updated dependencies [dc2aa3e]
- Updated dependencies [ee66e2e]
- Updated dependencies [e2e6360]
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
- Updated dependencies [0f21348]
- Updated dependencies [d2e2caf]
- Updated dependencies [92876f0]
- Updated dependencies [f279deb]
- Updated dependencies [4b70d28]
- Updated dependencies [eb7f586]
- Updated dependencies [e901131]
- Updated dependencies [ebb4e0e]
- Updated dependencies [3a9021e]
- Updated dependencies [d9d3463]
- Updated dependencies [2a40f69]
- Updated dependencies [537a0d1]
- Updated dependencies [bec3e14]
- Updated dependencies [613b167]
- Updated dependencies [b4d3c22]
- Updated dependencies [1f9b905]
- Updated dependencies [8f60d73]
- Updated dependencies [cb13400]
- Updated dependencies [828549a]
- Updated dependencies [e1ade8f]
- Updated dependencies [bc64bfe]
- Updated dependencies [abb0f81]
- Updated dependencies [38ab505]
- Updated dependencies [3e19fe7]
- Updated dependencies [bb58d1d]
- Updated dependencies [bb68488]
- Updated dependencies [433ff9f]
- Updated dependencies [5cc847c]
- Updated dependencies [5cc847c]
- Updated dependencies [e7663f2]
- Updated dependencies [fa21254]
- Updated dependencies [33c32bf]
- Updated dependencies [66fb4fa]
- Updated dependencies [b953a97]
- Updated dependencies [d7f3e30]
- Updated dependencies [6d641c9]
- Updated dependencies [479cc7b]
- Updated dependencies [7e4f0e5]
- Updated dependencies [a84385b]
- Updated dependencies [45e1949]
- Updated dependencies [92250d6]
- Updated dependencies [c1d939f]
- Updated dependencies [58bebf6]
- Updated dependencies [36310dc]
- Updated dependencies [52d878a]
- Updated dependencies [405e808]
- Updated dependencies [49ae9f4]
- Updated dependencies [a3ae404]
- Updated dependencies [bfdf3d4]
- Updated dependencies [bb68488]
- Updated dependencies [c0f9a4b]
- Updated dependencies [b1e42d0]
- Updated dependencies [564252c]
- Updated dependencies [2459a3e]
- Updated dependencies [2776b11]
- Updated dependencies [ac853ce]
- Updated dependencies [fa51109]
- Updated dependencies [d6aa172]
- Updated dependencies [fe52a04]
- Updated dependencies [d46f9b8]
- Updated dependencies [3f5f87c]
- Updated dependencies [605b747]
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
- Updated dependencies [b42558a]
- Updated dependencies [d2f6e6b]
- Updated dependencies [ab04728]
- Updated dependencies [85a3082]
- Updated dependencies [5bf09fd]
- Updated dependencies [06915b0]
- Updated dependencies [ff84b05]
  - @object-ui/i18n@17.5.0
  - @object-ui/react@17.5.0
  - @object-ui/components@17.5.0
  - @object-ui/core@17.5.0
  - @object-ui/fields@17.5.0
  - @object-ui/data-objectstack@17.5.0
  - @object-ui/types@17.5.0
  - @object-ui/layout@17.5.0
  - @object-ui/permissions@17.5.0
  - @object-ui/plugin-editor@17.5.0
  - @object-ui/collaboration@17.5.0
  - @object-ui/auth@17.5.0
  - @object-ui/providers@17.5.0

## 17.4.0

### Minor Changes

- bd863fe: fix(timeline): the timeline binds to the date axis the view actually declares (#3129)

  A view whose date axis is bound under `calendar` was **offered** the Timeline
  visualization and then bucketed every record into "No date" — while the calendar
  rendered the very same field correctly. Two read-sites disagreed about what
  counts as a timeline binding:

  - `ListView`'s capability gate accepted `options.calendar.startDateField` as a
    timeline-resolvable axis; the render branch never read calendar config at all,
    so it fell through to its `created_at` last resort.
  - `app-shell`'s object page emitted `startDateField: 'due_date'` into
    `options.timeline` for **every** object view, declared or not. Downstream that
    is indistinguishable from a real binding, and because it is always present it
    shadowed the fallback entirely.

  `ListView` now resolves the axis once — `resolveTimelineDateBinding`, consumed by
  the capability gate and the render branch alike, reading spec key before legacy
  alias and `timeline` before `calendar` in both nestings — and the object page
  forwards only what the view declared. A declared `timeline.startDateField` still
  wins wherever both appear, and a view that declares no date axis anywhere keeps
  the historical `created_at` fallback.

  Observable rendering change (records move out of "No date" into real date
  buckets), hence `minor`.

### Patch Changes

- 993336f: An action declaring `disabled: ''` is no longer greyed out forever (objectui#3842)

  The "is a `disabled` gate declared?" test stopped at `!= null`, missing the
  `!== ''` half of the invariant the `visible` family converged on
  (`hasDeclaredVisibilityGate`, objectui#3492 / #3758 / #3812 / #3823 / #3835). So
  `disabled: ''` counted as a declared gate, and the verdict went to the evaluation
  entry — which reads an empty predicate as "no condition → `true`"
  (`toPredicateInput('')` is `undefined`, `evaluateCondition(undefined)` is `true`).

  The direction is why this half is a defect and the `visible` half was not. On
  `visible`, that `true` means SHOW, so an over-broad "declared" test and a
  permissive empty predicate cancel out and `visible: ''` renders either way. On
  `disabled`, the same `true` means DISABLE — the two mistakes compound, and an
  empty predicate stopped meaning "no gate" and started meaning "permanently
  greyed out". One empty predicate, opposite treatment under two keys.

  Two gates now ask the shared definition instead:

  - `@object-ui/app-shell`'s `DeclaredActionsBar` — the hot one. Its actions are
    SERVER-declared (`objectDef.actions[]`) and its hosts are the approvals inbox's
    record sections, so a `disabled: ''` arriving from metadata (an authoring form
    left empty, a template that rendered to an empty string) produced an Approve /
    Reject button nobody could click, indistinguishable from deliberate metadata.
    objectui#3835 was this same surface failing the other way.
  - `@object-ui/components`' `action:button` — verified to be the same shape before
    it was changed (the issue inferred it from the identical spelling but did not
    probe it): with `disabled: ''` the rendered button carried `disabled=""`.

  **Behaviour change surface, deliberately narrow.** Only `disabled: ''` changes —
  from disabled to clickable, which is what "no predicate" asked for. `disabled:
true` still disables, `disabled: false` and an absent `disabled` still do not, and
  no expression-valued `disabled` changes verdict. One consequence worth naming: on
  `action:button`, an empty `disabled` now falls THROUGH to the legacy non-spec
  `enabled` fallback instead of short-circuiting on the empty predicate, so an
  action spelling both (`disabled: ''` + `enabled: true`) becomes clickable.

  The legacy `enabled` leg of `action:button` was routed through the same
  definition for consistency, and that part is behaviour-preserving by derivation
  rather than a fix: the leg is negated (`disabled = !isEnabled`), so an empty
  predicate's `true` already arrived as "not disabled" — the same verdict "no gate"
  produces. All four shapes are identical under either test; the derivation table
  and the reason no test can distinguish them are written down next to the pins.

  `hasDeclaredVisibilityGate` keeps its historic name at both call sites (the
  objectui#3842 dispatch ruling): the predicate is key-neutral, and one
  implementation behind two names is how a repo grows dialects. Each call site says
  so in a comment.

- d518a90: `datetime` action params are usable in the Console for the first time — the dialog now POSTs the zoned ISO instant the platform requires instead of a shape the validator rejects

  An action declaring a `type: 'datetime'` param was unusable from the UI: **no
  value a user could pick could pass validation**. The dialog rendered the param
  as `datetime-local` (which is zone-less by nature) and then serialized on
  submit back to that control's own naive wall clock, e.g. `2026-08-10T15:00`.
  Since 17.0 the dispatcher validates a params bag against the action's
  declaration before the handler runs (ADR-0104 D2, `validateActionParams` →
  `InstantValueSchema`), and that contract is an ISO-8601 instant with an
  explicit zone. Every submission earned:

  ```
  HTTP 400 VALIDATION_ERROR
  Action param "start" (datetime): expected an ISO-8601 instant with explicit
  zone (e.g. 2026-03-15T14:30:00.000Z)
  ```

  The renderer and the validator wanted disjoint shapes, and an app author had no
  seam between them — declaring a `datetime` param doomed the action in the UI,
  whatever the app. Found in a hotcrm dogfood run (objectstack#5061), reproduced
  from two separate entry points (list-view row menu and record header).

  The fix is a removal, not a conversion. `DateTimeField` has been ISO-canonical
  on both sides since objectui#3127/#3565 — it takes the record's ISO instant in
  and hands an ISO instant back out, seconds, milliseconds and zone included — so
  the widget's own value already satisfies the contract. #3565 added the
  back-conversion to keep the wire shape byte-identical while it fixed a display
  bug, and named the follow-up in its own commit message: moving action params
  onto ISO is a contract change of its own. This is that change.
  `serializeParamValues` now passes `datetime` values through untouched, which
  makes it idempotent for a value that already carries a zone (a `+08:00` offset
  survives byte-for-byte rather than being re-derived and re-cut to the minute)
  and leaves an empty or unfilled param alone.

  Deliberately still rejected: an authored `defaultValue` written as a zone-less
  wall clock. That value is ambiguous metadata — whose zone? — and coercing it in
  the renderer would make it "work" in the UI while the identical literal kept
  400ing from REST and MCP, which is the worst split to debug. It stays loud
  until the spec validates a param default against the param's own value
  contract, filed as objectstack#6970 (the same hole lets a `number` param
  default to `'abc'`, so it is not datetime-specific).

  The render proof that pinned the old shape was replaced rather than re-spelled:
  it asserted `2026-07-20T14:30` and was green while the feature was 100% broken,
  because the shape it pinned is the one shape nothing accepts. It now drives the
  real widget and asks the real `validateActionParams` — the exact function that
  produced the 400 — whether the resolved bag is acceptable. The datetime
  assertions are written to hold in every timezone (verified under
  `Asia/Shanghai`, `UTC` and `America/Los_Angeles`), since a zone-shaped test that
  only holds in UTC goes green on CI while the defect is live for every user east
  or west of it.

- cdc0e44: `ActionParamDialog` boolean params: the dialog now owns the control id, so the checkbox is named once instead of twice

  The boolean branch rendered `<Label htmlFor={param.name}>` beside the control but
  passed the widget no `id`, unlike its own generic branch a few dozen lines below,
  which has always passed `id={param.name}`. Measured on a real dialog render, a
  `boolean` param labelled "Confirm This" produced TWO label elements pointing at
  one control — the dialog's visible one and a `sr-only` copy the widget emitted —
  so the checkbox's accessible name was the two concatenated: screen readers
  announced "Confirm This Confirm This".

  Two distinct problems, one line apart:

  - The association was IMPLICIT. It resolved only because `BooleanField`'s id
    fallback chain reaches `config.name`, which `paramToField` seeds from
    `param.name`, so both sides landed on the same string by coincidence of
    another package's internals. A host that renders `htmlFor` must emit the id it
    names; that is what the declared `id` key of the widget contract is for.
  - The duplicate `sr-only` label. objectui#3952 / PR #3959 made `BooleanField`
    suppress its own label whenever a host supplies the id — precisely because a
    host that supplies an id is a host that renders a label. Receiving no id, this
    branch never triggered that suppression.

  Both `for` targets resolved, so unlike objectui#3341 and objectui#3952 this was
  never a dangling label: clicking the row's text already toggled the control, and
  still does. What changes is the announced name, which is now the single
  "Confirm This" the author declared. The generic branch is untouched.

- 28c3856: Register `approvals:inbox` as a component ref, and stop sending Home's "pending approvals" card into the setup app (objectstack#7231).

  The Approvals Inbox had no addressable identity: nothing in any app's navigation metadata pointed at it, and every entry to it was a hardcoded path. `HomePage`'s action-center card spelled `/apps/setup/system/approvals`. That path is not wrong about the page — `system/approvals` is mounted as both `extraRoutes` and `extraRoutesNoApp`, so `/apps/{any app}/system/approvals` has always resolved — it is wrong about the app. A business user with approvals waiting but no access to `setup` followed the only entry Home offers them into the shell's "App not available" guard.

  Two changes, one additive and one corrective:

  - `approvals:inbox` now resolves in the component registry to the Approvals Inbox page, so a `{ type: 'component', componentRef: 'approvals:inbox' }` nav item renders the full inbox at `/apps/{app}/component/approvals/inbox` — tabs, drawer, decision actions and record deep links all scoped to `{app}`. Both mount paths are relative routes under `/apps/:appName/*`, so the page reads the same `:appName` and the same `?request={id}` deep link either way. The standalone `system/approvals` route is untouched and stays the target of server notification and email links; the registry key is purely additive indirection, so the approval surface can be rebuilt later behind the same key without any navigation metadata changing.
  - The Home card now navigates within the app the user last had open, re-checked against their live active-app list so a remembered app that has since been deactivated is not resurrected as a dead link, falling back to their first available app. `setup` survives only as the last resort for an app carrying no addressable segment at all — the zero-app workspace never reaches this producer, because Home returns its welcome empty state before the action center exists.

- 65d6c07: Page block inspector: the input hints inside the properties panel follow the session's language

  objectui#3913 turned `block-config.ts`'s `label` / `addLabel` / option labels into
  translation keys and stopped at the column next to them. The 8 `placeholder`
  values that are prose stayed display text, so a zh-CN admin opening `page:header`
  read 「图标」 over a box hinting `lucide icon name`, and `record:details`'
  「名称（i18n 键）」 over `snake_case, e.g. contact_info` — in the panel #3913 and
  objectui#3963 had just finished translating. Those 8 are now keys under
  `engine.inspector.pageBlock.placeholder.<blockType>.<field path>`, resolved by
  `PageBlockInspector` at render, with en-US and zh-CN both defined. The en-US text
  is byte-identical to the literals it replaces, ellipsis included, so an English
  admin sees no change.

  The column could not simply follow `label`, and that is the design half of this
  change: it is a MIXED surface. Of the 18 placeholders, 10 are example VALUES — a
  row count `20`, `https://…`, the inline-action sample
  `{ "type": "url", "target": "/environments" }` — and translating those would be a
  defect, not a courtesy. A localized JSON sample is metadata `InlineActionSchema`
  rejects, and a "translated" default row count means nothing at all.

  So which kind a placeholder is, is declared in the type rather than left to a
  convention plus a list of exceptions:

      placeholder?: { key: string } | { literal: string }

  A bare `placeholder: 'lucide icon name'` — the shape this file used until now,
  and the first thing anything generating a new field reaches for — no longer
  compiles. That matters more than the eight strings: `type-check` runs in every
  lane and in the editor, so the mistake is caught where it is made instead of
  becoming an English box in a Chinese panel that waits for a reviewer to notice.
  `addLabel` was made required for the same reason in #3913; `placeholder` stays
  optional, because a field with no hint is legitimate.

  The keyed half joins the derivation pin
  (`previews/__tests__/block-config-i18n.test.ts`) as a fifth key family, so a new
  prose placeholder without a translation is red rather than shipping. The literal
  half is pinned as an inventory with a reason per entry, because "finish
  translating the other ten" is the plausible next edit and it needs to argue with
  a test first. `block-config.test.ts`'s snake_case assertion moved from the raw
  placeholder to the RESOLVED hint in both locales, which is now the stronger
  statement: the `snake_case` token has to survive translation, not merely exist in
  English.

- 2c632d9: Context selectors: picking an option the instant the dropdown fills no longer snaps back to the first one

  A context selector is a _mandatory_ scope, so `SelectorControl` auto-selects
  `options[0]` as soon as the option list resolves and nothing concrete is
  selected yet. That repair ran in a passive effect — a task AFTER the commit that
  rendered the option rows — which left a gap in which the dropdown was already
  rendered and clickable while no selection had been made. A pick delivered inside
  that gap was applied and then immediately undone: the queued auto-select fired
  second, carrying a closure from before the pick (`hasConcrete` still `false`,
  and the search string it wrote from still the pre-pick one), so the user's
  choice was replaced by the first row — silently, and for a `persist: 'query'`
  selector with a URL rewrite behind it.

  The gap is widest exactly where it matters: a slow options endpoint, a loaded
  machine, or a low-end device, i.e. the cases where a user is most likely to be
  already reaching for the option they want. The repair is now a layout effect, so
  it lands in the same synchronous flush as the options it reacts to — no event
  can be delivered in between, and the control is never painted with an empty
  value while options exist.

  Nothing else about the behaviour moves: same trigger, same deps, same one write
  per medium. A scope that a later param-less nav link drops is still
  re-established from the first option (the re-selection objectstack#5994 relied
  on when it deleted the storage-to-URL bridge), which is pinned alongside the two
  medium cases in `ContextSelectors.autoSelectRace.test.tsx`.

  Found as a CI flake in `ContextSelectors.persist.test.tsx`
  (objectstack#6979): under load the test's own pick lost the same race, twice,
  with `expected 'billing' to be 'crm_core'`. Those cases now settle the
  auto-select before picking, which also pins a fact none of them pinned before —
  a user's pick overrides the auto-selected first option.

- d3e738a: Server-declared actions declaring `visible: false` are now hidden instead of rendered as live buttons (objectui#3835)

  `DeclaredActionsBar` — the bar that renders an object's SERVER-declared actions
  for one record at a `location`, with no per-action host code — asked truthiness
  on the gate: `if (action.visible && !isVisible) return null`. `false && …` is
  falsy, so `visible: false`, the most explicit way an author can say "never show
  this", fell into the "no gate declared" branch, the verdict was never consulted,
  and the action rendered for everyone.

  What that means on the page: the bar's host is the approvals inbox's
  record-section toolbar (`apps/console/src/pages/system/ApprovalsInboxPage.tsx`),
  so an approval action the metadata had switched off with `visible: false`
  rendered as a live Approve / Reject / Reassign button — and this component's own
  click handler is what POSTs the decision. One click was a real approve/reject
  call on a request the declaration said not to offer a decision on.

  This is the fifth and last member of the objectui#3492 family (after
  objectui#3758 / PR #3816 for the row-action surfaces and objectui#3812 / #3823
  for the action face), and the one whose two family-wide mitigations both fail:

  - The action defs are **server-declared** (`objectDef.actions[]`,
    `sys_approval_request`), not hand-written view JSON. "`ActionSchema.visible` is
    `ExpressionInputSchema` with no boolean member, so `objectstack build` cannot
    emit this shape" does not apply on this path — the def arrives from server
    metadata and in-process construction, where a boolean is the natural spelling.
  - The bar is mounted as **plain JSX** by its hosts, so `packages/react`'s
    `SchemaRenderer` — which evaluates a node's `visible` and hides it before the
    component mounts, and which is why objectui#3812 judged the component-level
    gates a dormant defensive layer — is not on this path at all. This gate was the
    only one there.

  The gate now reads the family's one named definition,
  `hasDeclaredVisibilityGate` (`!= null && !== ''`), imported from
  `@object-ui/components` rather than re-spelled: five gates in three packages
  asking one question must not drift into five answers. The evaluation entry is
  untouched — `toPredicateInput` passes a boolean through and `useCondition`
  short-circuits it instead of calling the expression engine — so a declared
  `false` resolves to `false`, and every expression-valued `visible` keeps exactly
  the verdict it had.

  Behaviour change surface, deliberately narrow: only a declared action whose
  `visible` is the literal boolean `false` (or another falsy non-empty value)
  changes, from rendered to hidden, which is what the declaration asked for.
  `visible: true` still renders, `''` and an absent `visible` are still no gate at
  all, and the bar still renders no chrome when its located set is empty.

  The suite that covered this component could not have caught it: it stubbed the
  whole predicate entry constant-true (`useCondition: () => true`), with a comment
  saying the test actions omit `visible` "so this is unused" — which made the gate
  unreachable from the only tests that mount this component (the objectstack#4984
  family, where a fixture keeps a broken rule green). That stub is gone; the suite
  now runs the real `useCondition` / `toPredicateInput` and doubles only the action
  dispatch, so all four shapes (`false` hides / `true` renders / undeclared renders
  / `''` is not a gate) are judged by the shipped evaluation semantics.

- b691f06: Ask the view composer for a container's view identities instead of deriving `list.name || 'list'`, so the default list view's translated label resolves

  A `defineView` container declares its default list under the `list` key. That key is a slot in the authoring document, not the view's identity: `expandViewContainer` — the same composer the framework's loader and the i18n extractor call — registers an unnamed default list as `<object>.default`. This renderer derived `list.name || 'list'` instead, a third spelling no producer emits, so a default-list-only object probed `objects.<object>._views.list.label`, missed the published `_views.default.label` key (objectstack#5164 ruling A, migrated in objectstack#6124) and fell back to the English metadata label — for the view's description and empty state too.

  - `MetadataProvider.mergeViewsIntoObjects` now expands a stack-packaged container through `expandViewContainer` and routes the result through the same code path as first-class ViewItems. Both authoring gates therefore key `listViews` / `formViews` by the canonical `<object>.<key>` identity, and the container inherits the composer's folding (a `listViews` entry that merely restates `list` collapses into one view) and collision renaming instead of restating them locally.
  - `ObjectView` resolves the primary view's id through the new `defaultListViewId` helper — one derivation shared by the view-override lookup and the view-switcher promotion, with no literal fallback.

  The renamed id is also the key a view override is persisted under (`updateViewConfig(object, viewId, …)` writes a `view` metadata record named by the id). Nothing is orphaned: the retired `'list'` spelling is not a representable view identity at all — `ViewItemNameSchema` requires a dotted `<object>.<key>` name — while the record-gate path, which real backends serve, already used the qualified id. Stale `/view/list` links fall back to the object's default view, which is the same view they named.

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

- 0ef94ca: console: hold the environment list's create CTA with a skeleton until entitlements
  resolve, instead of showing a label that is about to be overwritten (objectui#3482,
  part of cloud#1049).

  `EnvironmentListToolbar` presents a state-aware create affordance — "Set up your
  production environment" / "Add development environment" / an upgrade prompt — decided
  from `GET /cloud/environment-entitlements`. While that request was in flight the
  toolbar rendered the action's metadata label, so the button visibly changed its
  wording the moment the response landed. The two texts are owned by different
  packages (the cloud translation bundle vs this repo's locale packs), which made the
  swap read as an inconsistency rather than a load.

  The in-flight state now renders a `Skeleton` sized like the button it stands in for,
  matching the adjacent `cloud:onboarding-next` welcome CTA. Only the create action is
  withheld — other toolbar actions never re-label, so they keep rendering — and a
  toolbar without a create action gets no skeleton at all. The skeleton is never
  terminal: when both entitlement signals fail, the resolution settles as
  `{ ready: false, source: 'unknown' }` and the neutral metadata label is shown, which
  remains the honest text for a state where "which create is this?" is genuinely
  unknown.

- 13b72c7: Render the `/home` Administration group as a real group, so its nine system-administration entries are reachable (objectui#3609).

  `UnifiedSidebar` picks its renderer with one ternary on `context === 'app' && activeApp`. Only the app arm rendered `NavigationRenderer`, the component that descends into `type: 'group'` children; the home arm hand-rolled `homeNavigation.map(item => <Link to={item.url || '/home'}>)` with no recursion. Since home navigation is the only navigation that groups, the whole nine-entry Administration cluster collapsed into one row — and a group carries no `url` of its own, so `|| '/home'` pointed that row back at the page the user was already on. System Settings, Applications, App Marketplace, Object Manager, Datasources, Users, Organizations, Roles and Configuration never reached the DOM. `resolveLandingPath([])` sends a fresh-deployment admin to `/home`, and `HomePage` had deliberately dropped its own System card on the grounds that the sidebar already carried those entries, so the net effect was an admin with no route into system administration at all.

  The home arm now renders through the same `NavigationRenderer` as the app arm rather than growing a second renderer that recurses: the group becomes a Collapsible and every entry passes the same item-level `visible` / `requiredPermissions` / runtime-capability guards. Hrefs are unchanged — home entries are all `type: 'url'`, whose resolution is verbatim. The group states `expanded: true` so it opens by default: the renderer's unauthored default collapses groups of eight or more children, a heuristic for one long section among many, whereas on `/home` this group _is_ the navigation. Pinning and drag-reorder stay off in the home context, where their persistence key resolves to the first app rather than to home. Non-admins are unaffected — the cluster is still built behind the `isWorkspaceAdmin` gate and is absent from their item tree.

- 7883c02: Send the console host's legacy URL redirects straight to the canonical metadata-admin routes instead of routing them through the deprecated `component/metadata/resource` alias (objectui#3639).

  `apps/console`'s `ObjectRedirect` and `MetadataRedirect` rewrote `system/objects[/:name]` and `system/metadata[/:type[/:name]]` onto `…/component/metadata/resource[/:name]?type=:type`. app-shell declares that spelling as a legacy _alias_, not a page: its route element is `LegacyMetadataRedirect`, which immediately navigates on to `…/metadata/:type[/:name]`. Every one of those URLs therefore took two `<Navigate>` hops (plus a re-render) to reach a destination the host could name directly — and it was this indirection that carried `sys-objects` into the zero-app blank screen fixed in objectui#3610, since the alias was the leg that branch did not recognise.

  Both redirects now construct `…/metadata/:type[/:name]` (and `…/metadata` for the typeless directory arm) themselves. The endpoints are unchanged, byte for byte, including the alias hop's own percent-encoding of `:type` and its verbatim pass-through of `:name`; only the intermediate hop is gone. The alias routes stay declared exactly as they were — bookmarks, external links and the setup left-nav still arrive on them and are still forwarded — this change only stops the console feeding its own traffic through them.

  Also corrects four docblocks that described the alias as "the engine route", in `apps/console`'s two redirects and in app-shell's `datasource` resource registration and page. That wording is not merely stale: the objectui#3610 dispatch read this chain and concluded `component/metadata/resource` was the canonical spelling, which is the exact opposite of what the route table says.

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

- 1037e1a: Name the `InspectorComboField` trigger: the visible label now owns it, and an anonymous combo no longer compiles (objectui#3997).

  This is the fourth inspector field atom with the shape PR #3996 fixed for the three in `_shared.tsx` — a `Label` rendered as a plain sibling of the control, with no `htmlFor`, no `id` and no `aria-label`. It lives in its own module, so it stayed broken after the other three were closed. The label and the `button[role=combobox]` were adjacent only visually: assistive tech announced an anonymous combobox with the field name floating above it as unowned text, `getByLabelText` could not reach it, and clicking the visible label did nothing. It renders at eighteen call sites across the object-field, dataset, dashboard-widget, app-nav and view-variant inspectors (lookup display/description fields, `lookupFilters` rows, summary aggregates, dataset dimensions and measures, nav targets), so it is on screen the moment any of those panels opens.

  The labelled branch closes the pair the same way the other atoms do: `React.useId()` mints the id inside the atom, `Label` gets the `htmlFor`, and the id lands on the trigger `Button` that `PopoverTrigger asChild` renders. Never on `Popover` — Radix's `Popover.Root` is a context provider that renders no DOM element, so an id handed to it is dropped silently and the `for` dangles, which is the objectui#3976 / #3994 mistake this repo has now paid for twice.

  `label` was optional, and the un-labelled branch was the same defect one notch worse: a combobox with no name at all. Five of the eighteen call sites had authored exactly that. Rather than adding a lenient fallback (synthesising a name from the placeholder would have produced "Select…" as the announced name), naming became a type-level requirement of exactly one of three channels:

  - `label` — the atom renders the visible label and owns the association. Unchanged for the thirteen call sites that already passed one.
  - `ariaLabel` — for repeated rows where no visible label exists and one would break the grid: an app-nav URL filter's `field = value` pair, a dataset's list of joined relationships, the dependent-lookup "add a field" picker.
  - `id` — for when an external `Label htmlFor` already owns the naming. `DashboardWidgetInspector` wraps its controls in a `Field` that renders `Label htmlFor={id}` and hands the same id to the control; every other field honoured it (`Input id`, `SelectTrigger id`) but the dataset combo could not, because the atom accepted no id. That `for` pointed at an id nothing carried — a dangling IDREF, worse than an unnamed control, because tooling reports an association that resolves to nothing.

  Zero channels and two channels are now both unauthorable: zero is anonymous, and two is the double-announcement failure objectui#3961/#3978 exists to avoid. Neither has a runtime symptom the component could detect and report — an unnamed combobox renders, lays out and commits values perfectly, and is wrong only for the users who cannot see it — so the check is compile-time or nothing. It is pinned in `InspectorComboField.naming.types.test.tsx`, listed in `tsconfig.typetests.json` so a compiler actually reads it.

  One new pair of strings (`engine.inspector.widget.filterBindingField`, en-US + zh-CN) names the per-filter binding combo in the dashboard widget inspector, which sits under a heading that captions its whole row rather than the combo alone.

- dffeeef: Metadata-admin inspectors: the shared text / number / select field labels now name their control

  The three generic field atoms of every scoped inspector — `InspectorTextField`,
  `InspectorNumberField`, `InspectorSelectField` — rendered a `Label` as a plain sibling of
  their control, with no `htmlFor`, no `id` and no `aria-label` fallback. Label and control
  were adjacent only visually: assistive tech announced an anonymous "edit box" / "combobox"
  while the visible field name sat above it as unowned text, and clicking the label did
  nothing. Measured before the fix, `getByLabelText('Group')` — the same `for`→id chain a
  screen reader walks — found zero matches for all three.

  These atoms are consumed by 16 non-test modules (page-block, flow-node, report, dataset,
  permission and object-field inspectors, plus the object-group inspector in Studio design),
  so every inspector panel rendered nameless inputs the moment it opened.

  Each atom now mints its own id with `React.useId()` and closes the pair. The id is minted
  inside the atom rather than taken as a prop deliberately: these atoms render in loops over
  array items (`record:details.sections[i]`, `page:tabs.items[i]`) where every item repeats
  the same label, which is precisely where a caller-supplied id collides — and a collision is
  invisible, because both labels would still resolve, to the first control. `useId()` cannot
  collide by construction; per-instance uniqueness is pinned rather than assumed.

  For the select the id lands on `SelectTrigger`, never on `Select`: Radix's `Select.Root`
  renders no DOM element of its own, so an id handed to it is silently dropped and the
  label's `for` dangles — the same mechanism objectui#3976 fixed one directory over. The
  trigger renders the real `button[role=combobox]`, a labelable element, so one `for`/`id`
  pair names it with no second `aria-labelledby` channel. `disabled` stays on Root (single
  authority over trigger, items and the hidden native mirror) and a disabled select is still
  named.

  `InspectorCheckboxField` was already correct — it uses a wrapping `label`, a valid
  association that needs no id — and is untouched, serving as the positive control in the
  tests.

  Follow-on for test authors: `PageBlockInspector.sectionName.test.tsx` located its section
  name boxes by placeholder _because_ `getByLabelText` could not reach them. That workaround
  is gone; the boxes are located by their label, and the `snake_case` placeholder convention
  keeps its own dedicated assertion.

- 41d6022: The console no longer reads `/meta/*` before it knows whether it has a session, and a failed request now says which request failed

  Opening a logged-out console painted ~30 red `HTTP request failed` lines before
  the login form was drawn. Two independent causes, fixed independently
  (objectui#4042).

  **1. Requests fired before the session was known.** `ConnectedShellInner` now
  withholds the metadata tree until `GET /auth/get-session` resolves, so
  `meta/object` / `meta/view` / `meta/app` are never issued blind. `useAuth()`
  outside an `AuthProvider` reports `isLoading: false`, so an embed with no auth
  provider is unaffected, and every protected route already sat behind an
  `AuthGuard` that resolves auth first — the signed-in data flow is unchanged.

  The console's landing route (`<Route path="/">`) was the actual entry point for
  the burst: it mounted `ConnectedShell` with no guard above it, so simply opening
  `/_console/` mounted the whole data layer as an anonymous visitor. It is now
  guarded, which also means an unauthenticated visitor reaches `/login` without a
  single doomed request. `examples/console-starter` had the same shape and got the
  same fix.

  **2. Two requests per type, per mount — not an unauthenticated artefact.**
  Consumers read metadata during the FIRST render (`useActionModal` reads
  `objects`, whose getter kicks `ensureType('object')` and `ensureType('view')`
  from the render phase), before any effect runs. `MetadataProvider`'s preview-mode
  effect then cleared the whole cache on mount, discarding those two entries while
  their requests were in flight; the next render found them `idle` and refetched
  both. The effect now skips its mount run — on mount the cache is empty and there
  was never anything to drop; it only ever meant something on a later
  `previewDrafts` change. That halved `meta/object` and `meta/view` on **every**
  mount, signed in included.

  A second duplicate only appeared once a read had failed: `entry.promise`
  collapses callers that arrive while a request is in flight, but callers arriving
  just after a failure each started a fresh attempt. A failed type now stays
  un-retried for ~1s, which collapses one mount's burst of callers into a single
  attempt. This is deliberately not the 5-minute `ttlMs` — later callers still
  retry on their own, and `refresh()` / `invalidate()` retry immediately and
  unconditionally, so no explicit recovery path changes.

  **3. `HTTP request failed` now identifies the request.** `@objectstack/client`
  reports every non-2xx as
  `logger.error("HTTP request failed", undefined, { method, url, status, error })`,
  and the console's logger forwarded that verbatim — so the identifying fields
  lived only in the third argument, and anything that flattens a console record to
  text rendered them `[object Object]` / `Object`. A screenful of failures could
  not tell you a single URL or status. The message string now carries them:

  ```text
  HTTP request failed: GET /api/v1/meta/object -> 401 [UNAUTHORIZED]
  ```

  The structured bag is still passed alongside for DevTools to expand — text for
  the flatteners, object for the inspectors, neither at the other's expense. The
  formatter is exported as `formatHttpFailureMessage`, and `createQuietHttpLogger`
  is now exported too so an app wiring its own `ObjectStackClient` gets the same
  identified failures.

  Nothing is newly silenced. The only demotion remains 404-on-an-optional-
  collection (`sys_presence`, `sys_activity`), which is an expected outcome of a
  request we still mean to make; a 401 that survives the session gate — a
  mid-session expiry, say — stays a visible, fully-identified error. The cure for
  doomed requests is not issuing them, never hiding them once issued.

- be9cd38: metadata-admin: name the offending key when only one union member ever read the value

  A union with no discriminant reports its failure as one collapsed issue, and the
  member diagnostics that would name the problem are buried inside it. PR #3677
  started unpacking those for `config.columns` by reading the value's own content,
  but deliberately declined every union where some member had rejected the value's
  type outright — which left `config.sort` (`string | ColumnSort[]`) collapsed even
  though only one of its two members had read the value at all.

  When exactly one member accepted the value's type, naming it is a fact rather
  than a preference: it is the only member whose complaint can be about what the
  author wrote. So `sort: [{ field: 'n', order: 'bogus' }]` now reports
  `config.sort.0.order` with the spec's own `expected one of "asc" | "desc"`
  instead of `config.sort` / `Invalid input`, and the same holds for a sort row
  that is not an object, a `columns[].summary` written as a bad enum string, a form
  `sections[].fields[]` entry missing its `field`, and an array `filter[].value`
  whose offending element is now addressed directly.

  Where two or more members read the value, or where none did, nothing changes:
  the previous message is kept rather than inventing a preference between members
  that objected equally. Both gates — create and edit — continue to report
  identically, and validation verdicts are untouched: the accept/reject decision is
  still made by the one gate, and this only changes how an already-failed draft is
  presented.

- ebb579d: metadata-admin: an unresolvable visibility-predicate path now fails OPEN, loudly (objectstack#6936)

  `views/metadata-admin/predicate.ts` promised fail-open in its own header — "on any
  parse error → returns `true`: better to show a field than to silently hide it" —
  and delivered it only for _thrown_ errors. A path whose root identifier did not
  exist in the evaluation scope took a quieter route: `resolveValue` returned
  `undefined`, and then every comparison judged it false —
  `['text','number'].includes(undefined)`, `undefined === 'text'` — so a predicate
  referencing a name that is not there **hid** the field. Fail-CLOSED, the opposite
  of the documented promise, with nothing in the console.

  The bite case is a version-skew window, measured in objectui#3923: `@objectstack/spec`
  ≤ 17.0.0-rc.5 spells the `objectForm` sub-field predicates bare (`type in ['text',…]`,
  16 of them) while this engine evaluates them against a `{ data: draftRow }` scope. A
  console upgraded ahead of its backend resolved `type` to nothing, and all 16
  type-conditional Studio sub-fields — Min / Max / Precision / Scale / Max Length /
  Min Length / reference / deleteBehavior / expression / returnType /
  autonumberFormat / language … — disappeared for every row type at once. The symptom
  users saw was "the config items are gone", indistinguishable from a permission
  problem or an unsupported field type.

  Per the maintainer ruling on objectstack#6936 (option C):

  - **An unresolvable path evaluates `true`.** The field stays visible instead of
    vanishing, honouring what the header always claimed.
  - **Dev mode says so**, naming the unresolved path _and_ the predicate that
    carried it, warn-once per (path, predicate) pair — the shape
    `warnOnUnknownActionKeys` established in `@object-ui/core`. Keying the memo on
    the path alone would have reported the first of the 16 skewed predicates and
    stayed silent about the other fifteen.

  **The boundary, which is the load-bearing half.** "Unresolvable" means the path's
  ROOT identifier is not a name the scope declares (`type`, `record.status`,
  `page.selectedId` against a scope whose only name is `data`). It does _not_ mean
  "the value came out undefined": `data.type == 'text'` on a draft that has no
  `type` yet resolves its root fine, the draft simply carries no value there — that
  comparison is still false and the field stays hidden, silently, exactly as before.
  A draft is allowed to be empty; widening fail-open to any absent value would light
  up every type-conditional sub-field at once on a fresh row. A typo one segment
  deep (`data.tpye`) is indistinguishable from an unfilled draft field _without the
  schema_, which this evaluator does not have — catching that belongs to
  publish-time validation of predicate path references at the producer (filed
  separately), not to a renderer heuristic (Commandment #0.1).

  The signal is a thrown internal error, deliberately not a sentinel value: fail-open
  is a property of the whole predicate, not of the sub-expression that failed. A
  sentinel would have to be threaded through `!`, `&&`, `||`, `in` and `==` by hand,
  and the first operator that missed it would invert the verdict — `!unresolvedPath`
  would resolve the inner path to "true-ish" and negate it straight back to false,
  i.e. fail-CLOSED again by another route. Throwing routes every failure to the one
  fail-open gate that already existed; `!unresolvedPath` is pinned true.

  Unchanged, and pinned: the pre-existing parse-error fail-open (still silent — the
  path resolved, reading it blew up, a different fact); CEL-order absorption, where
  `false && unresolvable` is false and `true || unresolvable` is true with no
  warning because the unresolvable half was short-circuited away; and CEL-style loose
  nullish equality (`data.type == null` on an empty draft is still true).

- d2fd044: Point the last four navigation producers at the canonical metadata-admin routes instead of the deprecated `component/metadata` alias, removing a redirect hop from each (objectui#3660).

  The System hub's "Metadata" and "Datasources" cards aimed at `…/component/metadata/directory` and `…/component/metadata/resource?type=datasource`, and the `sys-datasources` entry in both `AppSidebar.systemFallbackNavigation` and `UnifiedSidebar.homeNavigation` spelled the latter too. app-shell declares those spellings as legacy _aliases_, not pages: their route element is `LegacyMetadataRedirect`, which immediately navigates on to `…/metadata` and `…/metadata/datasource`. Every click on any of the four therefore paid a redundant hop plus a re-render to reach a destination the navigation could name directly. All four now name it.

  The landing pages are unchanged, byte for byte — the new URLs are exactly what the alias hop was already computing (`datasource` percent-encodes to itself, and neither producer carried a query or hash beyond the `?type=` the alias itself consumed). Only the intermediate hop is gone.

  The alias routes stay declared in both `AppContent` branches, untouched: bookmarks and external links still arrive on them and are still forwarded. This completes objectui#3639, which corrected the console host's two redirects and enumerated these four as the remainder.

- b7b05da: Point the `sys-objects` navigation entries at the canonical metadata-admin route instead of the `system/metadata/object` alias, removing a redirect hop from each click (objectui#3739).

  `AppSidebar.systemFallbackNavigation`, `UnifiedSidebar.homeNavigation` and `console/home/QuickActions` all spelled this target `/apps/setup/system/metadata/object`. That is not a page: `apps/console`'s host fragment declares `system/metadata/:metadataType` with `MetadataRedirect` as its element, which immediately navigates on to `/apps/setup/metadata/object` — the engine's real route (`metadata/:type`, `MetadataResourceListPage`). Every click therefore paid a redundant hop plus a re-render to reach a destination the navigation could name directly. All three now name it.

  This is the same defect objectui#3660 fixed for `sys-datasources`, declared on the line immediately below `sys-objects` in both sidebar arrays. It was missed there because the two entries reached their aliases through different route tables — `sys-datasources` through app-shell's own `component/metadata/resource` alias, `sys-objects` through the host's `system/metadata/:type` rewrite.

  The landing page is unchanged, byte for byte: the new URL is exactly what the alias hop was already computing (`object` percent-encodes to itself, and no producer carried a query or hash). Only the intermediate hop is gone. Of the three producers, the two sidebars are live; `QuickActions` has no JSX call site today, so its change is a guard against the dead link returning with the component.

  The alias routes stay declared and untouched: bookmarks and external links still arrive on them and are still forwarded.

- fa3ba5b: Make the zero-app console's "Object Manager" / "Datasources" entries resolve, and give that branch a not-found screen instead of a blank one (objectui#3610).

  On a deployment with no published apps, the system fallback navigation sends `sys-datasources` to `/apps/setup/component/metadata/resource?type=datasource` and `sys-objects` to `/apps/setup/system/metadata/object` (rewritten by the console host onto the same legacy alias). `isMetadataRoute` is a substring test on `/metadata`, so both URLs pass the "No Apps Configured" guard and enter `AppContent`'s no-`activeApp` route table — which declared no `component/…` route at all and, unlike the with-`activeApp` table, carried no trailing catch-all. A `<Routes>` with no match renders `null`, so an admin building their first object got a fully blank screen: no 404, no error, no empty state.

  Both halves are fixed on the routing side, with no navigation URL changed. The two legacy metadata aliases (`component/metadata/directory`, `component/metadata/resource/*`) are now declared in the no-`activeApp` branch too, mirroring the with-`activeApp` branch — they are redirects, not a second copy of the page, so they forward onto the canonical `metadata/:type` routes that branch already declared. And the branch now ends in the same `path="*"` → "Page not found" screen the with-app branch has always had, so the next unresolved URL in a zero-app console is reportable rather than invisible.

- 9089d85: The no-apps empty state's "Create Your First App" CTA now opens the app-creation
  flow instead of silently bouncing the user back to the landing page. It called
  `navigate('/create-app')` — an ABSOLUTE path, so it resolved against the HOST's
  root route tree, which declares no `/create-app`; the reference host's trailing
  `<Route path="*">` therefore replaced it with `/`. The `create-app` route is
  declared by `AppContent` itself, inside the `/apps/:appName/*` subtree (both the
  no-active-app branch and the with-app router), so the CTA now builds the
  app-scoped `/apps/<segment>/create-app` — the platform's canonical app URL
  (ADR-0048) and the same target the sidebar's add-app entry already links to. On
  a fresh zero-app deployment this was the first screen's only route into app
  creation, and it read as a button that does nothing (#3573).

  A plain relative `navigate('create-app')` is deliberately NOT the fix, and the
  new routing test pins why: under the installed react-router 7,
  `getResolveToMatches` resolves a relative target against the LEAF match's full
  `pathname` with the splat INCLUDED (in v6 this was the `v7_relativeSplatPath`
  future flag; v7 hardcodes it). The empty state renders across a whole URL family
  — `/apps/setup` and any deeper `/apps/setup/<segment>` — so the relative form is
  right only at the shallowest of them and builds
  `/apps/setup/<segment>/create-app` elsewhere, which matches no route and renders
  a blank screen instead of the bounce. The sibling "System Settings" CTA is
  unchanged.

- d1be436: Point the "System Settings" entries at the system hub `/apps/setup/system` instead of the bare `/apps/setup` (objectui#3590).

  `AppContent` mounts the system hub only under `isSystemRoute`, which keys on a `/system` path segment. A bare `/apps/setup` therefore matched no pseudo-route except `isSetupRoute` and fell back into the "No Apps Configured" guard — i.e. on a zero-app deployment it _is_ that empty state's own URL, so the empty state's `go-to-settings-btn` re-rendered the very screen it sits on. Retargeted three call sites: the empty state's CTA, `AppSidebar`'s no-active-app `sys-settings` fallback entry, and `UnifiedSidebar`'s `/home` Administration `sys-settings` entry. Every sibling entry in both clusters already spelled `/apps/setup/system/...`.

- 949b2f1: metadata-admin: name the offending column when `config.columns` is rejected

  `config.columns` is `string[] | ColumnDef[]` — a union with no discriminant — so
  Zod reported every rejection as one collapsed issue on the field itself:
  `config.columns` / `Invalid input`, on the create gate and the edit gate alike.
  The field was reachable, but nothing said which column was wrong, which key, or
  what was expected.

  The union member is now chosen by the value's own first element — a list of
  field names or a list of column objects — and that member's real diagnostics are
  reported at their draft-absolute path. A mis-typed key reports
  `config.columns.0.field` with `expected string, received number`; a stray number
  in a list of field names reports the element that broke it rather than every
  element of the shape the author never chose. The aggregated container reaches
  the same union as `list.columns.…`, and both gates now report identically.

  Only unions that really are "an array of A or an array of B" are read this way,
  so neighbours such as `config.sort` (`string | ColumnSort[]`) are untouched.
  Where the content elects nothing — a first element that is neither a string nor
  an object — the previous message is kept rather than guessing.

  Validation verdicts are unchanged: the accept/reject decision is still made by
  the one gate, and this only changes how an already-failed draft is presented.

- d86b41c: Honour all three `AppContextSelectorSchema.persist` values in app context selectors: `'query'` (the default) writes and reads the URL query parameter only, `'session'` writes and reads `sessionStorage` only, and `'none'` writes neither — the pick stays in memory for that mount. Previously every selector was mirrored into both stores and read back as `URL ?? storage`, so `'session'` and `'query'` were indistinguishable and `'none'` persisted anyway. Selectors on the `'query'` default (including Studio's package scope) no longer write `objectui-ctx-*` storage, and a scope dropped by a param-less nav link is re-established by auto-select-first instead of from a store the author never declared.
- 99ba5fb: The AI plan / confirm cards send the agent text in the CONVERSATION's language, not the console UI's (objectui#3896)

  #772 / #2884 established the rule and `AiChatPage` states it at the gate:
  outbound text follows the conversation, rendered labels follow the UI locale.
  Only half of it was implemented. Three of the four outbound messages read

      convZh ? '<Chinese literal>' : t('console.ai.…')

  and `t()` is the **UI pack**, so the "not Chinese" branch answered with the UI
  locale rather than with English. The fourth, `planAnswerMessage`, had no gate at
  all.

  Two measured consequences, one in each direction:

  - **A zh console holding an English conversation sent Chinese.** The `zh` pack
    defines all four keys, so the `t()` lookup HIT instead of falling through to
    its English default: clicking "Build it" put `确认，开始搭建。` into an English
    thread. Cloud's confirm gate (`service-ai-studio` `confirm-gate.ts`
    `APPROVAL_RE`) recognises both languages, so the build ran — and the agent
    switched the rest of the thread to Chinese. That is objectui#2884's symptom
    with the trigger reversed.
  - **The answer chip sent the UI locale in both directions.** Ungated, it put
    `For "…", go with: …` into a Chinese thread — objectui#772's opening complaint
    verbatim — and a Chinese sentence into an English one under a zh console.

  All four sites now go through one resolver,
  `packages/app-shell/src/console/ai/outboundAgentText.ts`: a Chinese conversation
  gets the `zh` pack's value, every other conversation gets the `en` pack's value,
  and the UI pack is never consulted. The three console AI surfaces (`/ai` page,
  chat dock, Studio copilot) all mount the same `ChatPane`, so all three change
  together.

  Reading the two packs directly rather than `t(key, { lng })` is deliberate: an
  i18next lookup's answer depends on which bundles the host app loaded and on
  `fallbackLng`, and a `zh` lookup silently falling back to `en` is exactly the
  wrong-language bug above. The per-language fallback table in the resolver is
  pinned byte-identical to both packs, so a Chinese conversation falls back to
  Chinese — never to English — if a pack ever stops defining a key.

  Labels are untouched: they still follow the UI locale, and the pin that fails
  when a `*Label` drifts into the conversation gate (objectui#3837) now also fails
  when an outbound `*Message` is read back out of the UI pack.

- 708aaf8: fix(metadata-admin): page block inspector chrome follows the locale

  `PageBlockInspector`'s own JSX carried hardcoded English that no translation
  table could reach: the row-adder of every field list (`Add`), the per-row and
  per-item remove `aria-label`s (`Remove` / `Remove item`), and the free-text
  fallback placeholders of the object picker and the field list. All now resolve
  through `engine.inspector.pageBlock.*` keys defined in both en-US and zh-CN.
  The JSON editor's parse error reuses the catalog's existing
  `engine.form.invalidJson` instead of its own literal, and holds the parse
  failure as state so the message follows a later locale switch. English is
  unchanged.

- 62c6441: Page block inspector: the PROPERTIES panel's curated field labels now follow the session locale instead of always rendering English

  `PageBlockInspector`'s chrome went through the translation table from the start —
  `t('engine.inspector.pageBlock.properties')` and its siblings — while the panel's
  CONTENTS did not. Every `label` in `previews/block-config.ts` was an English
  literal handed straight to the field components, so a zh-CN admin opening any
  page block read 「属性」 over a stack of English field names: two languages in one
  panel, reproducible on any block with no special data.

  All 157 label literals (152 field/option labels + 5 `addLabel`s) are now
  translation keys resolved through `t(key, locale)` at render, with 154 distinct
  keys added to both the `en-US` and `zh-CN` sides of
  `views/metadata-admin/i18n.ts`. The English text is unchanged: every key's `en`
  value is the literal it replaced, verified by substituting all 157 keys back and
  diffing the result byte-for-byte against the pre-change file.

  The key is a function of the label's POSITION in `BLOCK_CONFIG`
  (`engine.inspector.pageBlock.field.<blockType>.<name>`, `.add.<blockType>.<name>`,
  `.option.<fieldName>.<value>`), and a test re-derives all three shapes from the
  table's own structure. That is what makes the realistic mistake visible: these
  keys differ by one segment, so adding a block by copy-pasting a neighbour's key
  yields a key that EXISTS in both locales and renders a plausible label belonging
  to a different property — an existence-only check is green for it. Positional
  keys also let one English word take different Chinese per block, which the panel
  needs: `element:button.label` is a button caption 「按钮文字」 while
  `page:tabs.items.label` is a tab title 「标签」, and `Add section` is 「添加分区」
  here but stays 「添加分组」 in the form-layout canvas.

  `addLabel` is now REQUIRED on the `array` field variant. It was optional and the
  inspector fell back to a bare English `'Add'` — an untranslatable literal no
  locale table could reach. Requiring it deletes the fallback instead of
  translating it, so a new array field cannot compile without naming its
  add-button key.

  Option labels are translated too, including the ones `ColorVariantPicker` renders
  only as `aria-label`/`title`, where an untranslated string is invisible to a text
  query.

- 5419f55: The Studio RLS editor no longer authors the retired `rowLevelSecurity[].priority` key (objectstack#7130)

  `rowLevelSecurity[].priority` was removed in `@objectstack/spec` 17.0.0
  (objectstack#3896) and left as a `retiredKey` tombstone in
  `packages/spec/src/security/rls.zod.ts` — an authored value is REJECTED at parse
  time with the upgrade prescription, not ignored. It promised "conflict
  resolution" that cannot exist: applicable policies OR-combine (most permissive
  wins), so there is no conflict to order.

  `PermissionAdvancedFacets` — the structured RLS editor on the Studio permission
  matrix — was still typing the key and seeding `priority: 0` on every policy its
  "Add policy" button created. Its docblock described the shapes as mirroring the
  framework spec, but that mirror was sampled before the removal. Nothing on the
  save path removed the key: `doSave` sends the draft verbatim, and at package
  scope `mergePermissionSlice` copies `rowLevelSecurity` from the freshly-read
  base while taking only `objects`/`fields` from the edit — so at environment
  scope (the only scope where these facets are persisted) the seeded key went
  straight into the saved permission set. A user who added an RLS policy through
  the editor therefore wrote a permission set the parser refuses.

  Three changes, all editor-side:

  - the local `RlsPolicy` shape drops `priority`;
  - the Add-policy seed drops `priority: 0` — it now authors exactly
    `{name,object,operation,using,enabled}`;
  - policies are stripped of the retired key as they are read out of the draft, so
    a permission set already carrying `priority` (written by this editor before
    this fix) comes out clean the moment any RLS edit re-emits the list. This is
    editor hygiene, not a data migration: a set nobody opens is untouched, and the
    strip is keyed to the named tombstone rather than being a blanket unknown-key
    purge, so every live key the editor does not itself render survives a
    round-trip.

  The docblock stops claiming the shapes are "sampled from live data" — that
  sampling is exactly how a removed key stayed in the editor for ten days.

- b3439f4: The plan card's "Building…" badge follows the console UI locale, like every other label on it (objectui#3837)

  `AiChatPage` gates four strings on `convZh` — the language of the CONVERSATION,
  not of the UI — because the cloud confirm gate (`service-ai-studio`
  `confirm-gate.ts` `APPROVAL_RE`) recognises Chinese and English only, so what the
  confirm cards SEND has to match the thread it is sent into (objectui#772 /
  objectui#2884). The file's own comment above that gate ends with the other half
  of the rule: "button LABELS stay on the UI locale."

  `planBuildingLabel` (objectui#2632) had drifted onto the wrong side of it, and
  handed back a hard-coded `正在搭建…` for any Chinese thread. Two consequences,
  both measured:

  - **A mixed-language card.** Under an English console, a Chinese thread's plan
    card rendered `Proposed plan` / `Build it` / `Built` / `Not yet built` in
    English with one Chinese badge in the middle. objectui#2458 item 4 recorded the
    reverse direction of the same disease.
  - **A dead translation.** A Chinese conversation always took the literal, so the
    zh value of `console.ai.planBuilding` was unreachable for Chinese readers —
    re-wording the pack changed nothing for them. objectui#3546 slice four had just
    backfilled that key into all ten packs (PR #3839) and could only contain the
    defect, by making the zh value byte-identical to the literal and pinning the two
    together.

  The badge now reads `t('console.ai.planBuilding', …)` like its twelve neighbours,
  so all ten packs are reachable — a German console with a Chinese thread renders
  `Wird erstellt…` — and the zh pack is the single source of the Chinese wording
  (unchanged: `正在搭建…`, so no Chinese reader sees a different string than before).

  The three OUTBOUND strings (`planApproveMessage`,
  `planApproveDefaultsMessage`, `changesConfirmMessage`) are untouched and still
  follow the conversation: each is passed to `onSendMessage` and read by the gate,
  which is the class the `convZh` branch exists for. The slice-four containment pin
  in `packages/i18n/src/__tests__/console-namespace-3546.test.tsx` is flipped in the
  same change — it now fails if a gate reappears over that label, or if any future
  `convZh` read feeds something rendered instead of something sent.

- 5f752a0: Match the built-in pseudo-routes on whole path segments, so a mistyped app name can no longer render a different app (objectui#3638).

  `AppContent` decides whether a URL is a built-in pseudo-route (`create-app`, `system/*`, `metadata/*`, `setup`) before it decides which app to render, and two of those switches were substring tests: `pathname.includes('/system')` and `pathname.includes('/metadata')`. Both are true for any segment that merely _starts_ with the word — `system_log`, `system_setting`, `systems`, `metadata_import`, `metadata-export`. `isSpecialRoute` feeds `requestedAppMissing`, so visiting `/apps/<mistyped-app>/system_log` marked the URL as a pseudo-route, suppressed the "App not available" guard, fell back to the default app and rendered **that** app's shell with `system_log` taken as its object name — the exact "must NOT silently render a DIFFERENT app" case the fallback's own comment exists to prevent, with no indication that the requested app does not exist.

  The two flags now test path _segments_ (`pathname.split('/').includes('system' | 'metadata')`); `isCreateAppRoute`'s `endsWith('/create-app')` is unchanged. Every real pseudo-route spells the word as a whole segment — `system/marketplace{,/installed,/:packageId}`, the host's `system/{apps,profile,approvals,ai-approvals,audit-log,settings,objects,metadata/…}`, `metadata/{,_diagnostics,:type,…}` and the legacy `component/metadata/{directory,resource/*}` aliases — so all of them stay special, including in the zero-app branch that keys on these flags directly (objectui#3590 / #3610). Knock-on, in a zero-app console only: a `system`-prefixed near-miss such as `/apps/setup/system_log` now reaches the same "No Apps Configured" screen every other unresolved URL there reaches, instead of the pseudo-route branch's "Page not found".

- fbc23e0: Action params that inherit a field's options now keep the keys that field declared

  A field-backed action param (`{ field: 'tier' }`) had its inherited option list
  rebuilt entry by entry as `{ label, value }`, which silently dropped every other
  key the field's options declared — most consequentially the per-option
  `visibleWhen` predicate (ADR-0058). A select field whose options narrow by
  predicate in an object form therefore offered the FULL list in an action dialog,
  including the entries the predicate exists to hide, with no diagnostic on either
  side; `color` / `icon` / `disabled` were lost the same way. Options authored
  inline on the param were never affected — they always passed through verbatim,
  which is the asymmetry this restores.

  The resolver now preserves each inherited entry and only does its two real jobs:
  expanding bare strings into label/value pairs and translating the label through
  `fieldOptionLabel`. The option widgets already filter on `visibleWhen`, so a
  role-gated option (`'admin' in current_user.positions`) inherited by a dialog
  param now narrows the offered set and clears a seeded value the predicate hides.

  `ActionParamDef.options` (`@object-ui/core`) and the resolver's `RawActionParam`
  are widened to match: `ActionParamOption` names the two keys the param layer
  reads and carries the rest of a field's option vocabulary through.

- 6d762da: The five locale keys behind #3546's eight no-fallback `t()` call sites are now defined in all ten packs, so the built-in-view toasts, the activity-timeline source link, the wizard's required-field toast and the Gantt refresh button's accessible name are translated instead of falling back to English — or, on two surfaces, to the key itself (part of #3546).

  `scripts/check-i18n-call-site-keys.mjs` measured 258 keys that a `t()` call site asks for and no pack defines. These five were the subset with no working inline default: `console.objectView.cannotEditMetaView`, `console.objectView.cannotDeleteMetaView`, `detail.viewSource`, `gantt.toolbar.refresh` and `wizard.missingRequired`. Adding a `defaultValue` is deliberately not the fix — that mechanism is what kept all 258 invisible for months.

  **Two of the eight sites really did render the raw key**, and both go through a binding with nothing in front of i18next. `ObjectView.tsx` calls `useObjectTranslation()` directly, so five toasts read `console.objectView.cannotEditMetaView` / `cannotDeleteMetaView` on screen; the `|| 'Built-in views cannot be renamed.'` guards next to them were dead on every path, because i18next answers a miss with the key itself and a non-empty string never falls through `||`. Those four unreachable English strings are removed rather than repaired: one key served four call sites (rename / pin / set-as-default / configure), so the pack copy covers any change to a built-in view instead of naming one operation. `RecordActivityTimeline.tsx` fails the same way for a subtler reason — `useDetailTranslation` is `createSafeTranslation(..., 'detail.back')`, and because `detail.back` does resolve, the probe hands back i18next's `t` for every key and bypasses the defaults map wholesale, so `detail.viewSource` reached the user verbatim.

  **The other two sites were not rendering a raw key**, contrary to the issue's description, and are fixed here as the milder "English in all ten languages" class. `wizard.missingRequired` is its own hook's probe key, so the probe failed and `createSafeTranslation` correctly served its English default. `gantt.toolbar.refresh` goes through `useGanttTranslation`, which deliberately does not use `createSafeTranslation` and falls back per key — so the refresh button's `aria-label` was "Refresh", in English, never the key. Screen-reader users heard an English word rather than an identifier; a `zh` session now hears 刷新.

  Regression cover is provider-mounted on purpose: with no `I18nProvider` the defaults maps answer every one of these keys and the assertions pass while the console is broken, which is precisely the false-green the issue documents. For the two sites whose English output was already correct, `en` cannot discriminate before from after — the `zh` assertions are the ones that pin the fix.

- 2937bcf: `record:details` section editor now offers the `name` i18n anchor

  The page block inspector's `record:details` → Sections editor exposed
  `label` / `columns` / `fields` and silently omitted `name`. That key is not
  decoration: it is the section heading's i18n anchor. `plugin-detail`'s
  `record-details` renderer resolves the heading through
  `objects.<object>._sections.<name>.label` and falls back to the authored string
  whenever `name` is absent —

  ```
  const translatedTitle = s.name && objectName
    ? sectionLabel(objectName, s.name, rawTitle ?? s.name)
    : rawTitle;
  ```

  — so every section built in Studio was untranslatable by construction: one
  authored string in every locale, plus an upstream
  `translation-section-name-missing` diagnostic the author had no control to
  clear. The key was reachable only by hand-editing source, which is precisely
  what a designer exists to avoid.

  The new `Name (i18n key)` text box sits first in each section entry, matching
  `page:tabs` / `page:accordion` where the stable identifier precedes the human
  label. Its placeholder carries the snake_case convention, because
  `BlockPropField` has no description or pattern affordance — the same reason the
  suite already requires every `json` field to carry a shape placeholder.

  Two authoring decisions, both deliberate and both pinned:

  **The anchor is never derived from `label`.** `InspectorTextField` does expose an
  `onBlur` hook for deriving a dependent field, and the block-config renderer
  deliberately leaves it unwired here. A label may already be localized prose — or
  an inline `{ en, 'zh-CN' }` map, which `record-details` runs through
  `pickLocalized` — and seeding an anchor from it freezes one locale's text into
  the one value that must stay locale-independent. Worse, it would be invisible:
  the renderer falls back to the authored label when a translation misses, so a
  wrongly-derived anchor renders exactly like the bug it was meant to fix, until
  someone adds a second locale.

  **Sections authored before this field existed are not backfilled.** They open
  with the anchor box empty and their `label` untouched; nothing is written until
  the author types. This needs no code — the inspector is read-through, writing
  only from a commit handler — and the alternative would mark an untouched page
  dirty merely for being opened.

  No validation was added. `BlockPropField` has no pattern/validate capability,
  and inventing one for a single field is out of scope; the placeholder states the
  convention and the upstream lint rule remains the enforcement point.

  Coverage for this block's section entry is now derived from the spec's own
  `RecordDetailsProps` shape rather than hand-listed, so the next section key the
  spec grows fails loudly here instead of quietly never reaching the designer.

- 54233b1: Record detail pages: a header ⟳ that refreshes the record, its related lists and its tab counts in place — no browser reload

  Concurrent-editing scenario from the shop floor (MES work orders): operator A sits on a record's detail page while operator B starts or reports the same order. A had no way to see the new state except F5, which throws away the open tab, the scroll position and any in-progress inline edit along with the stale data.

  The pipeline for this already existed — the objectui#2269 invalidation bus refetches every mounted reader in place, and `RecordContext.refresh` had been declared for it — but nothing produced that field and no UI reached for it. Three changes give it a trigger:

  - **`RecordDetailView` produces `RecordContext.refresh`**, publishing `notifyDataChanged({ objectName: '*' })`. The wildcard is deliberate: a user reaches for refresh because of a write made by SOMEONE ELSE, which this client never saw and therefore cannot attribute to particular objects. `'*'` marks everything mounted as stale, so the main record, every related child list and the tab-count badges all refetch — no remount, so tab / scroll / draft state survive. First phase covers the standalone record route; embedded hosts (list drawer, split-pane preview) keep their existing chrome unchanged.
  - **`page:header` renders the ⟳** at the far end of the header row when — and only when — the host provides `refresh`. It is page chrome rather than a header action, so its position is the same on every record page regardless of which business actions the object declares, and it can never be collapsed into the `⋯` overflow. Styled as that `⋯` trigger's twin so the row reads as one button family. Its accessible name and tooltip come from the existing `common.refresh` key, so the icon-only button is not English-only in the other nine locales. The icon spins for a short floor after a click, because the bus is fire-and-forget and a warm backend would otherwise finish before the click looked like it landed.
  - **`RelatedList` accepts the `'*'` wildcard** on the legacy `objectui:related-changed` event, matching what `dataChangeMatches` already does for the bus's own readers. This listener compared the payload's object name to its own, so a wildcard invalidation reached everything on the page except the related lists — a concrete foreign object name is still ignored.

  Hosts that provide no `refresh` render exactly as before.

- 99782f9: Run `sys_approval_request`'s server-declared decision actions on the business record page, and retire the hard-coded two-button approval path (objectui#3055).

  A record with an approval pending on it showed exactly two buttons — Approve and Reject — hand-written into the record header behind a bespoke `type:'approval'` handler and a client-side approver test. The approvals list, looking at the same request over the same nine REST routes, offered five decisions plus the submitter's levers and took decision attachments. On a business record, **reassign / send back / request info had no entry point at all**, a decision could not carry a file, and the copy on the two surfaces was maintained separately.

  The record page now renders the object's own declared actions through the shared declared-action bar — the same metadata, the same action runtime, the same param dialogs the approvals list uses. Approve, Reject, Reassign, Send back and Request info reach a business record, with their declared params (comment, attachments, the new approver picker) and the per-request decision outputs an approval node declares. Remind stays with the approvals panel, which owns a richer, throttle-aware version of it. Adding a tenth decision action is now a metadata change with no console work.

  Two behaviour changes come with it:

  - **Who sees a decision is the server's answer, not the console's.** Visibility was `pending_approvers.includes(currentUserId)` evaluated in the browser; it is now each action's declared `visible` predicate over the server-computed `viewer` block (`can_act` / `is_submitter` / `can_override`) — the same block that gates the approvals list, computed by the same service that authorizes the decision. A platform or tenant admin's override levers, the recovery path for a request routed to an unstaffed position, now reach the record page for the first time. On a backend too old to send `viewer`, the predicate cannot be evaluated and no decision is offered rather than one whose precondition is unknown.
  - **A declared `visible` written against the canonical `record.` root now evaluates.** The declared-action bar passed the row in as the bare predicate scope, so only the shorthand spelling (`status == "pending"`) resolved; `record.viewer.can_act` raised `record is not defined`, and the fail-closed gate turned that into "hidden". Every declared action on `sys_approval_request` gates on `record.viewer.*`, so the whole server-declared decision set was invisible on every surface this bar renders, the approvals inbox included. The row now binds the three ways the record header and list rows bind it — `record.status`, bare `status`, `data.status` — so both spellings reach a verdict.

  `useRecordApprovals` keeps only its read half (status, `lock_record`, the request rows). Its `canDecide` / `approve` / `reject` members and its `currentUserId` parameter are gone: deciding is the declared action's POST, and every remaining question about the viewer is answered on the row by the server.

- 6b3d47b: Point the four remaining "Settings" senders at the system hub `/apps/setup/system` instead of the bare `/apps/setup` (objectui#3611).

  Same root cause as objectui#3590, which fixed the three call sites inside its declared file surface: `AppContent` mounts the system hub only under `isSystemRoute`, which keys on a `/system` path segment, so on a zero-app deployment the bare `/apps/setup` _is_ the "No Apps Configured" empty state's own URL and every entry spelling it looped in place.

  Three of the four are live defects, all reachable on a zero-app deployment today:

  - `AppSidebar`'s no-active-app sidebar header (`system-sidebar-header`) — the sharpest of them, since it renders _only_ when there is no active app, i.e. it was unreachable except in exactly the state where its target was broken.
  - `AppSidebar`'s user-menu "Settings" entry.
  - `SystemRedirect`'s bare `/system` legacy bookmark. This forwarder was already half right — every _suffixed_ bookmark (`/system/users`) was correctly rewritten to `/apps/setup/system/users`, and only the bare one dropped the `system` segment. The bare branch now agrees with the suffixed branch beside it; no new logic.

  The fourth, `QuickActions`' "System Settings" card, is dormant — the component has zero JSX call sites repo-wide, so no user can reach it today. It is corrected in the same pass so the dead link cannot return with the component if it is ever remounted.

- aeb8424: List row Edit/Delete, bulk delete and related-list CRUD now run the caller's own permission, not just the object's API exposure (objectui#4096)

  The row kebab's built-in Edit/Delete rendered for every account, including ones
  the server answers `403 PERMISSION_DENIED` on. Clicking Edit opened a fully
  prefilled dialog that could only fail on save; Delete — a destructive entry —
  sat one click away from users who could never perform it.

  The gate intersected the object's resolved CRUD affordance with the server's
  effective API operation set (`/me/permissions` `apiOperations`, objectui#3720),
  and nothing else. `apiOperations` is the object's **API exposure surface** —
  "which verbs does this object publish" — and the spec's own describe text says
  so. It is principal-independent: the report measured two accounts with opposite
  `allowEdit`, 30 shared objects, and **30/30 identical** `apiOperations`. A gate
  made only of object-scoped layers therefore fails OPEN for every unprivileged
  caller, which is why the same screen carried three different answers to "may
  this user write this object": the toolbar's New was correctly hidden
  (`affordances.create && can(obj, 'create')`), the record header's Edit/Delete
  were correctly hidden (per-record write probe), and the row kebab was not.

  Four surfaces now AND the principal's own verdict — `can(obj, 'update' |
'delete')`, i.e. `/me/permissions` `allowEdit` / `allowDelete`, the toolbar's
  source — on top of the layers they already had:

  - the grid row kebab's built-in Edit/Delete (`resolveRowCrudAffordances` gained
    `permissionUpdate` / `permissionDelete`, filled at the `ObjectGrid` call site);
  - the grid's bulk-delete bar, which rides the same object-level delete verdict,
    so the row gate and the more destructive bulk entry move together;
  - the non-grid (kanban / calendar / gallery) bulk bar `ListView` renders itself;
  - the related-list Create/Edit/Delete on a child object
    (`RelatedRecordActionsBridge`), which had the same object-only gate.

  **This is a tightening of the intersection, not a swap.** Every existing layer
  stays: the ADR-0103 lifecycle bucket, `userActions.edit` / `delete`, and
  `apiOperations`. A permission grant cannot re-open what any of them closed, and
  none of them survives a permission denial.

  Fail-open is preserved where it is the deliberate contract: `usePermissions()`
  with no `PermissionProvider` answers `can: () => true`, so standalone embeds and
  hosts that ship no permission source keep their Edit/Delete exactly as before.
  Under `MePermissionsProvider` the semantics are the toolbar's, unchanged and now
  shared: an authenticated principal whose object is absent from
  `/me/permissions.objects` resolves fail-closed (objectui#2926 ④), an anonymous
  session keeps the permissive default, and children never render while the
  permission set is loading. Per-key absence is still permissive — an object entry
  without `allowEdit` reads as allowed.

  Server-side enforcement was already hard (403, DB unchanged), so this closes a
  UI-affordance gap rather than an authorization hole.

- 7a197e7: Make metadata-form visibility predicates work again in the Setup/Studio admin
  engine: `SchemaForm` now reads the canonical `visibleWhen` key, falling back to
  the deprecated `visibleOn` alias (objectstack#6331).

  ADR-0089 renamed the FormView predicate `visibleOn` → `visibleWhen`, and the
  spec's normaliser REWRITES the alias rather than keeping both — a parsed
  `FormView` carries `visibleWhen` and no `visibleOn` at all. All five predicate
  read sites in `SchemaForm.tsx` looked at `visibleOn` only, so every spec-served
  predicate read as absent and each guard short-circuited to "visible". Every
  conditional field, section and tab in every metadata form rendered
  unconditionally.

  Measured over the bundled `@objectstack/spec@17`: `objectForm` carries 16
  sub-field predicates, `viewForm` 7, `actionForm` 6, `pageForm` 4 — all spelled
  `visibleWhen`, none spelled `visibleOn`. Every one of them was inert.

  Fixed sites: the flat per-property path, section-level, section field-level,
  the tabbed path's field probe, and `type: 'record'` row sub-fields. Spelling and
  precedence mirror the runtime record-form adapter (`@object-ui/plugin-form`
  `sectionFields.ts`) and the spec bridge (`@object-ui/react` `form-view.ts`),
  which already read `visibleWhen ?? visibleOn` — one dialect across the repo,
  canonical wins. `FormSectionSpec` / `FormFieldSpec` declare both keys, the alias
  marked `@deprecated`.

  **Visible behaviour change** — these predicates have never taken effect in a
  shipped build, so they switch on for the first time here:

  - Studio's object field list now shows only the type-relevant row sub-fields: a
    `currency` field shows Min / Max / Precision / Scale, a `text` field shows Max
    Length / Min Length, instead of all of them at once.
  - Page authoring hides Data Context / Layout / Template on a `list` page and
    shows the Interface section, and the mirror for a record page. View, Action and
    Report authoring forms gain their type-conditional sections and fields.

  Predicates authored with the deprecated alias keep working, including this app's
  own create schemas, which set `visibleOn` directly on raw JSONSchema properties
  (`view-create-body.ts`, `anchors.ts`) and never pass through the spec normaliser.

  Note for the rollout: the predicates must be `data.`-scoped to evaluate against
  the draft (objectstack#6254 corrected 16 bare spellings in `object.form.ts`). A
  backend still serving the pre-#6254 bare spelling now yields the opposite
  symptom — those sub-fields stay hidden rather than always shown — because the
  admin engine's evaluator resolves an unscoped identifier to `undefined` and the
  predicate goes false.

- c993ff2: metadata-admin: restore per-field diagnostics when editing an invalid stored `view`

  Editing a stored `view` is judged by the wire gate `ViewMetadataSchema`, which is a
  union. Zod reports a union failure as a single root issue — no path, message
  `Invalid input` — so every field-level diagnostic collapsed into one message that
  pointed at nothing: `SchemaForm` had no field to highlight and Monaco had no
  position to jump to, and the guided messages the spec writes for these rejections
  never reached the editor.

  Failures are now expanded to the union member the draft's own `viewKind`
  discriminant selects, so a bad stored view reports `config.type` with the list of
  valid layouts, a mis-typed filter reports `config.filter.0.operator`, and a
  container key that belongs to a single view gets the spec's full
  `defineView(...)` guidance back. Only the selected member's issues are shown, so
  the other members' rejections do not become noise.

  Validation verdicts are unchanged: the accept/reject decision is still made by the
  one gate, and this only changes how an already-failed draft is presented.

- 877385a: metadata-admin: wire client-side Zod validation for `sharing_rule`, `translation` and `connector` (objectui#3561)

  These three metadata types opted out of live client-side validation on recorded
  reasons that no longer held against the resolved `@objectstack/spec` 17.0.0-rc.5:
  `SharingRuleSchema` was described as having an empty shape (it is a `.strict()`
  object of nine keys), `translation` was judged by `TranslationBundleSchema` (the
  bundle map, not the kind's schema — it rejects a valid translation item), and
  `connector` was blocked on a required `id` field that does not exist in
  `ConnectorSchema`.

  Each loader now names the schema the platform actually binds — `SharingRuleSchema`,
  `TranslationItemSchema` and `DeclarativeConnectorEntrySchema`. Behaviour change:
  drafts of these types are now rejected in the editor before save, through the same
  diagnostics banner every other wired type already uses. Most notably a `connector`
  draft that inlines credentials or authors provider-derived `actions` is caught at
  authoring time by the ADR-0097 rules the bare `ConnectorSchema` does not carry.

  `sharing_rule` is gated on the **create** door only: its schema is `.strict()` and
  declares none of the ADR-0010 envelope keys that a stored body carries, so judging
  a stored body with it would make the client stricter than the server.
  `hasClientValidator(type, mode)` takes the door as a second argument for that
  reason — without it the editor would have read a type with no gate on the edit
  path as "clean" and suppressed the server's own diagnostics.

- 4cf76ce: metadata-admin no longer false-rejects a stored `view` that has been pinned or
  reordered. The editor's live client-side validation judged BOTH the create and
  the edit draft with the AUTHORING schema (`ViewItemSchema` via
  `viewSchemaForDraft`). That is right for create and wrong for edit: the editor
  opens a body that came back out of `sys_metadata`, and the platform itself
  writes keys into stored view bodies — `isPinned` from the view switcher's pin
  action, `sortOrder` from the reorder write, and a per-row `id` that the console
  filter/sort builders stamp on `config.filter[]` for React. `updateView` GETs the
  stored item and PUTs `{ ...current, ...partial }`, and `saveMetaItem` persists
  the accepted body verbatim, so those keys are in storage by design.

  Before the authoring schemas were tightened these keys were silently stripped
  and the draft passed. Once the gate became strict, opening a pinned view in the
  editor reported unrecognized keys — while the SERVER accepted the very same body,
  because it validates against `ViewMetadataSchema`. The client was strictly
  stricter than the server; the direction was inverted.

  `validateMetadataDraft` now takes an optional `{ mode: 'create' | 'edit' }`.
  Create keeps the authoring gate unchanged. Edit is judged by
  `ViewMetadataSchema` — the schema the `view` metadata type registers, i.e. the
  same one the server runs — so the client and the server accept the same set by
  construction. `mode` defaults to `'create'`, the strict gate, so a caller that
  omits it can only ever over-report, never silently widen the door.

  The edit gate keeps its teeth: a wrong `config.type` and a container carrying an
  unknown key are both still rejected.

- 7e2b7e9: Fix saved list-view preferences never reading back (density, column widths, sort, hidden columns, inline edit)

  `listViewOverrides` in the ObjectStack adapter enumerated `GET /api/v1/meta/{objectName}` — putting the object name in the metadata **type** slot — while `updateViewConfig` persists under `type='view'`. The two key spaces are disjoint, so the batch map came back empty for every object and every personalization a user saved on a list view was written to the server but never read back, showing up as "the setting didn't save".

  The read now enumerates `type='view'` once and narrows to the object client-side, through the same accessor `listViews()` uses over the same rows — the metadata index is name-only, so there is no server-side `?object=` filter to push it into.

  Second half: the batch read no longer swallows its own failures into an empty map. An empty map is an authoritative "this object has no overrides" and callers may still trust it and skip the per-view reads (the batch optimization is intact), but a transport failure now rejects, so the per-view `getView` fallback it was silently disabling becomes reachable again. `DataSource.listViewOverrides` documents both terms so other adapters implement the same contract.

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
- Updated dependencies [3765678]
- Updated dependencies [d83f6b3]
- Updated dependencies [5f08c05]
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
- Updated dependencies [6bd6a4d]
- Updated dependencies [876e3f7]
- Updated dependencies [41d6022]
- Updated dependencies [e64a52e]
- Updated dependencies [844d17f]
- Updated dependencies [d8a0be4]
- Updated dependencies [f3b2874]
- Updated dependencies [48132f7]
- Updated dependencies [4dcd52a]
- Updated dependencies [42ae5c6]
- Updated dependencies [0ef9dfd]
- Updated dependencies [82f8dff]
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
  - @object-ui/data-objectstack@17.4.0
  - @object-ui/layout@17.4.0
  - @object-ui/plugin-editor@17.4.0
  - @object-ui/collaboration@17.4.0
  - @object-ui/auth@17.4.0
  - @object-ui/permissions@17.4.0
  - @object-ui/providers@17.4.0

## 17.3.0

### Minor Changes

- 8ec4067: The environment entitlement dialog now reads its context from
  `error.details.*` — the single declared location — and the flat dual-dialect
  tolerance is deleted (objectui#3329, the objectui half of cloud#1046).

  `entitlementDialogFromError()` maps a cloud env-create 403 into the friendly
  upgrade / limit dialog. It read `upgrade_url`, `contact_url`, `plan`, `current`
  and `limit` off the error object's **top level**, where the control plane used
  to put them as undeclared siblings of `code`. Those keys are conformant only by
  evaporating: `ApiErrorSchema` is a plain `z.object` that STRIPS unknown keys, so
  they survive to the Console purely because this path consumes the raw wire body
  before any parse. ADR-0112 (with framework#4224 and cloud#930's `AiErrorExtra`)
  declares `details` as the slot for structured error context, and cloud#1046
  moves the producer there.

  ## What changed

  - All entitlement context is read from `error.details.<key>` and **nowhere
    else**. `code` and `message` are declared `ApiErrorSchema` fields and stay on
    `error` itself.
  - `entitlementErrorFields()` — the `body?.error ?? body` flat/nested tolerance —
    is **removed**. A flat body (`error` as a string with `code` at the top level)
    no longer produces a dialog; it takes the caller's ordinary error path.
  - No `??` chain between shapes was added in its place: exactly one shape is
    accepted after this change, and tests pin both directions (details is read;
    the retired locations are not).

  ## Breaking note — read before tracking objectui `main` directly

  This is a wire-shape change with no consumer-side fallback, by decision on
  cloud#1046 (option A). It is safe for the **hosted** product because the cloud
  image pins objectui by `.objectui-sha`: cloud#1046's second half lands the
  producer change and the pin bump in one PR, so producer and consumer flip
  atomically and the hosted Console never runs one against the other.

  **Self-hosted deployments that track objectui `main` ahead of their control
  plane** will, until that control plane emits `error.details.*`, see the
  entitlement dialog lose its context: the upgrade CTA falls back to
  `/settings/billing`, `PRODUCTION_ENV_LIMIT` drops its "Contact sales" CTA,
  `DEV_ENV_PLAN_LOCKED` says "free plan" regardless of the real plan, and
  `DEV_ENV_LIMIT` drops the "using X of Y" counts. The dialog itself still opens
  and its titles/messages are unaffected — `code` did not move. Upgrade the
  control plane past cloud#1046 to restore the context.

- 6e794a1: The flow designer writes node geometry as the spec's `FlowNode.position`, not its
  own `ui: { x, y }` (objectui#3172).

  FROM: dragging, adding-at-a-point and insert-on-edge each wrote `node.ui = {x, y}`
  — a fourth-generation local spelling of a concept `@objectstack/spec` has modelled
  as `FlowNode.position` all along. TO: all three write `position: { x, y }`, and the
  canvas migrates on write: a stored flow's legacy `ui` is lifted onto `position` and
  the key removed in the first patch the canvas emits, geometry-related or not.

  **This is a behaviour fix, not a rename.** `FlowNodeSchema` has been `.strict()`
  since objectstack#4001, so `ui` is an `unrecognized_keys` error: the live client
  validation flagged the draft on every keystroke and the server rejected the save
  with a 422. In other words, dragging a node made the flow unsavable — the
  convergence is what makes the designer's most basic gesture round-trip again. A
  test now parses `{ …node, ui: {x, y} }` through the spec's own schema and asserts
  the rejection, so the claim is executed rather than argued.

  Reading is backwards-compatible: `manualPosition()` prefers `position` and falls
  back to a legacy `ui`, so a flow stored before this change still opens with its
  nodes exactly where the author left them (pinned by a test that lays out both
  spellings and compares the maps). The fallback is a migration path, not a second
  contract — nothing writes `ui`, and the canvas strips it at its input boundary, so
  no patch can re-emit it.

  The geometry type is now derived from the spec by reference
  (`FlowNodePosition = NonNullable< SpecFlowNode['position'] >`), and
  `spec-symbol-parity.test.ts` pins the equality in both directions — including that
  both coordinates are required, so a half-position stays unrepresentable. The
  shape-copy in `FlowPreview.tsx` is gone; it reads the canvas's own node type, the
  way it already read the canvas's edge type.

  Breaking for anyone reading `node.ui` off a flow draft: after the author's first
  edit the key is gone and the coordinates live under `node.position`. Nothing in
  this repo or the engine read it — it was a designer-local key the schema rejected.

- 5af2852: The record detail page now shows a read-gated approval panel (#3461). A record in approval used to expose NOTHING about the running approval to anyone but the current pending approver — `useRecordApprovals` was consumed solely to inject the header Approve/Reject buttons, while the pending-approver list, decision progress, and the `sys_approval_action` timeline existed only in the Approval Center's drawer, a `setup`-app surface that business roles can't navigate to (and whose backing object is tenant-wide, so granting read there is over-broad). The submitter couldn't tell whom to nudge; the record's own audit history was no help either, since the engine mirrors business fields as `runAs:'system'` and decisions never enter record history. The new surface is an **Approvals tab** on the record page — a peer of Details/Related (same promotion Attachments got in objectstack#4358), emitted by `buildDefaultTabs` only when the record actually has requests, with a request-count badge and the label localizing through the tab strip's KNOWN_LABEL_DICT (审批). The tab wraps the new `record:approvals` node (`RecordApprovalsPanel`), visible to EVERY viewer who can read the record: current flow/step with the enriched flow-steps strip, server-computed decision progress (quorum tally, per-group 会签 ticks), the waiting-on chips with server-resolved names and group labels (never raw ids), one chronological action timeline merged across all of the record's requests (a multi-level flow opens one request per node), decision comments and attachments, and an inline remind button for the submitter (`viewer.is_submitter`, with an id-match fallback for older backends) that POSTs the existing `/approvals/requests/:id/remind`. The host threads its live `useRecordApprovals` read through the node so the tab and the header decision buttons never disagree; on authored pages the `record:approvals` renderer self-fetches, and an authored page that omits the node gets a bottom-of-page fallback append so the approval story is never lost to a custom layout. Copy reuses the Approval Center's `approvalsInbox.*` keys so the two surfaces can't drift; `useRecordApprovals` now exposes the full `requests` array plus `listApprovalActions` / `remindApprovalRequest`, and its `ApprovalRequestLite` carries the display enrichment (`process_label`, `step_label`, `flow_steps`, `viewer`, `round`) the single-read endpoint already sent.
- d22ae31: Track `@objectstack/spec` 17.0.0-rc.2 (objectui#3235, #3208, #3287, #3264).

  The pin moves from `^17.0.0-rc.1` to `^17.0.0-rc.2` across the workspace, and
  the sibling `@objectstack/*` packages (`client` / `core` / `formula` / `lint`)
  move with it — they pin `@objectstack/spec` **exactly**, so leaving them behind
  kept a second copy of the spec in the tree and would have had `@objectstack/lint`
  validating against rc.1 schemas that still accept keys rc.2 retires.

  Breaking semantics, in FROM → TO form:

  - **`app.homePageId` is retired — an app's landing page is now its first
    navigation item.** An app that pinned a landing page with `homePageId` will
    open on the first reachable navigation entry (by `order`) instead; the root
    landing still follows `isDefault`. To restore a specific landing page, reorder
    `navigation` so the intended entry comes first. Stored metadata is migrated by
    `os migrate meta --from 16`. The key is a hard error now, not a stripped one:
    the spec ships a tombstone that names the migration.
    Upstream retired it because of its SHAPE, not its usage — it was an ID
    cross-reference with no referential integrity, so a `homePageId` that pointed
    at nothing silently fell back to the first navigation item anyway
    (objectstack#4667, premise corrected in #4709). If the capability returns, it
    returns as a flag on the navigation item itself, which cannot dangle.
  - **`@object-ui/types`' `HttpMethod` now resolves to the spec's
    `HttpMethodType`.** Shape is verbatim identical — the same 5-value UI subset —
    and `@object-ui/types` still exports it as `HttpMethod`, so no consumer
    changes. The spec renamed its `./ui` export because `HttpMethod` named two
    different types depending on the import path (`./shared` / `./api` carry a
    7-value enum including `HEAD` / `OPTIONS`); objectui deliberately keeps the
    5-value one (objectstack#4691).
  - **`AppContextSelector.includeAll` / `placement` are gone.** Neither ever did
    anything in this renderer: context selectors are mandatory-scope, so no "All"
    row was ever rendered, and `placement: 'topbar'` put nothing in the topbar.
    Both carried schema defaults, which is why the liveness lint structurally
    could not flag them — removal was the only channel that reaches an author
    (framework#4509).
  - **`NavigationArea.visible` / `order` / `requiredPermissions` are gone.** An
    area is a layout grouping, not an access boundary. Gating moved down to the
    navigation ITEM, where `visible` and `requiredPermissions` are unchanged and
    still enforced. `AppSchemaRenderer`'s area switcher no longer hides an area, so
    an area whose items are all gated away renders as visible-but-empty rather
    than disappearing.
  - **`@object-ui/core` no longer exports `NotificationProtocol`**
    (`resolveNotificationConfig`, `specNotificationToToast`, `mapSeverityToVariant`,
    `mapPosition`, `ToastNotification`). It bridged `@objectstack/spec/ui`'s
    `Notification` / `NotificationConfig`, which objectstack#4610 deleted with no
    successor. Use `resolveNotificationConfig` from `@object-ui/react`
    (`NotificationContext`), which owns the live `NotificationSystemConfig` and is
    what every notification surface already read. Note that the spec's _other_
    `Notification` — `@objectstack/spec/api` — is the REST inbox row, a different
    contract, and is deliberately NOT aliased in as a replacement.
  - **The `email_template` client-side validator now uses
    `EmailTemplateDefinitionSchema`.** It was pointing at the removed
    `EmailTemplateSchema`, so authored templates were being checked against the
    wrong contract: the live one is keyed `name` + `locale` (not `id`) and splits
    the body into `bodyHtml` / `bodyText` (not `body` + `bodyType`)
    (objectstack#4616 / #4807).

  Fixes that are not breaking, but were only found because rc.2 stopped being
  lenient — each had been passing vacuously:

  - **`view` drafts are actually validated now.** The client validator named the
    aggregated container schema while this admin authors first-class `ViewItem`s,
    and the container used to strip `viewKind` / `config` in silence — so no view
    draft ever had one of its own keys checked. It now validates each shape
    against its own schema (objectui#3312).
  - **The console's worked examples were wrong**, and being stripped rather than
    refused: `view.list.object` (the container root already declares it),
    `job.concurrency` / `job.timeoutMs` (no such keys; the spelling is `timeout`,
    already in ms), `email_template.from` / `.to` (a template is not a send —
    the sender override is `fromOverride`, an object), and
    `datasource.capabilities` / `.healthCheck` (objectstack#4583 removed the
    former; the latter was never a datasource key). These are the drafts an
    author — or a model generating metadata — copies.
  - Action key inventory re-derived: `ActionSchema` gained the package-lock
    envelope (`_lock*` / `_package*` / `_provenance`), so a packaged action no
    longer reports them as unknown keys.
  - The schema-diff panel labels the new `default_mismatch` finding.
  - Test fixtures pinning the retired `managedBy: 'system'` bucket now use
    `engine-owned`. Protocol 17 split that value (objectstack#3355), so it
    resolved to the default-writable fallback and a batch of "stays locked"
    assertions had quietly stopped asserting anything.

### Patch Changes

- 8d9984c: `AppSidebar` and `UnifiedSidebar` area switchers now adopt the derived area
  visibility introduced for `AppSchemaRenderer` in objectui#3311, closing the
  same visible-but-empty gap in the console shells (objectui#3319).

  Both sidebars inlined their own area switcher without any area-level
  filtering, so an area whose navigation items were **all** gated away
  (`visible` expression, `requiredPermissions`, `requiresObject` /
  `requiresService` capability gates) still appeared in the switcher and
  rendered an empty navigation — and a fully gated _first_ area was even
  auto-activated, landing the user on an empty sidebar.

  ## What changed

  - **Shared predicate, not a second implementation.** Both switchers now call
    `hasVisibleNavigationItems` from `@object-ui/layout` — the exact guards
    `NavigationRenderer` applies per item — so the switcher can never disagree
    with the rendered navigation. In `UnifiedSidebar`, `action` items count as
    content (it wires `onAction`, framework#4509); in `AppSidebar` they do not
    (it wires none).
  - **The active area is elected among visible areas only**: first visible by
    default, re-elected when the active area is gated away, and a gating change
    that merely _reveals_ an area never steals the user's current selection.
  - `areas: any[]` tightened to `NavigationArea[]` in both components.

  No authorable area-level key is introduced — visibility stays derived, per
  the objectui#3311 ruling.

- 532cf8b: Deliver the required state to the control in the five renderers outside the object form that still painted it as an asterisk only (objectui#3299 — the same defect #3290/#3298 fixed in `form.tsx`).

  Each site converges on the reference shape (`EmbeddableForm.tsx`): the control carries `aria-required={required || undefined}` and the asterisk is `aria-hidden="true"`, so assistive tech announces required once, as a state — instead of hearing a bare "asterisk" folded into the accessible name, or nothing at all.

  - `@object-ui/app-shell` — `ActionParamDialog` (both the boolean row and the default branch, delivered through the real field widgets' `toDomProps` whitelist) and `CreateViewDialog` (display label, machine name, and every type-specific required-field selector).
  - `@object-ui/components` — the custom `ActionParamDialog` (all five typed branches, including the Radix select trigger) and `FieldContainer`, whose existing Slot injection (`id` / `aria-describedby` / `aria-invalid`) now also injects `aria-required`, covering every consumer in one place.
  - `@object-ui/plugin-detail` — `InlineCreateRelated`'s create-tab inputs.

  Deliberately NOT the native `required` attribute (#3290 ruling): each of these hosts runs its own validation, and native `required` would arm the browser's constraint-validation bubble beside it. The SDUI controls that already use native `required` (`renderers/form/{input,textarea,select,checkbox}.tsx`, `basic/text-input.tsx`) are unchanged — they don't have a second validator, so their channel is already correct.

- f59406d: `useAppContextSelectors` now derives each context selector's URL scope key from its own `id` instead of hardcoding the literal `package` query key. `App.contextSelectors` is an array and `AppContextSelectorSchema.id` is documented as the nav template var the selected value is published under — but the shell spelled `package` on all five read/write sites, so a second declared selector mirrored the first: switching either one wrote the same query key, and every `contextValues[id]` read it back. An app declaring `active_package` + `active_env` parsed clean, rendered two dropdowns, and fed both template vars one shared value (#3500).

  Studio's shipped `?package=` links are unaffected. The `active_package` selector keeps that exact key through a single grandfathered entry (`contextSelectorQueryKey`), because it is not this renderer's key to rename: ~15 Studio nav items declare `params: { package: '{active_package}' }` in `@objectstack/platform-objects`, six Studio surfaces read `?package` straight off the query string, and bookmarked URLs already carry it. Existing URLs are byte-identical before and after; only newly declared selectors get `?<id>=`. `UnifiedSidebar`'s Studio home link now reads and re-emits the scope through the same derivation rather than assuming the literal key. Two selectors colliding on one key warn in dev.

  The `persist` under-enforcement reported in the same issue (`'query' | 'session' | 'none'` are not distinguished) is deliberately untouched here — it is a spec-side enforce-or-remove ruling tracked separately.

- 5781fb1: `@object-ui/core` now ships the server-action dispatcher factory —
  `createServerActionHandler({ fetch, baseUrl, resolveObject, ... })` — so any
  consumer of the runner (standalone renderers, SDUI hosts, embedded usage) can
  run `action.body` script actions by registering the produced handler, instead
  of dead-ending on the built-in `executeScript`'s "must be executed server-side"
  error with no supported way to make it run (objectui#2904, the follow-up
  objectui#2896 deferred).

  The factory is deliberately opinion-free about the three things core has no
  business deciding — auth (`fetch` is an injected authenticated wrapper), origin
  (`baseUrl` string or thunk; no bundler env convention), and fallback object
  scope (`resolveObject`) — and owns everything protocol-shaped, once:

  - name-based action identity (ADR-0110 D1 — `target` is a binding expression,
    never an identity);
  - the record-id resolution dance, also exported as
    `resolveServerActionRecordId` (`_rowRecord`, `recordIdField`, toolbar
    selection fallback with its single/zero-select guards, aggregate
    `_selectedIds` bypass), replaceable wholesale via `resolveRecordId` for
    hosts with their own policy (record pages);
  - a re-entrancy guard per action+record;
  - the `/actions` response-envelope rule: `interpretActionResponse`,
    `readActionPayload` and `actionErrorDetail` moved from `@object-ui/app-shell`
    internals into core and are now public exports.

  `@object-ui/app-shell`'s two hand-rolled copies of this POST —
  `useConsoleActionRuntime.serverActionHandler` and `RecordDetailView`'s — are
  collapsed into one console wrapper (`createConsoleServerActionHandler`) that
  layers the browser-only choreography (popup pre-open dance, zero-roundtrip
  `newTabUrl` fast path, `redirectUrl` convention) over the core factory. The
  copies had already drifted twice (objectstack#3913 — envelope; framework#3935 —
  identity, fixed in one copy only): RecordDetailView now also dispatches by
  declarative `name` instead of `target || name`, and no longer leaks the
  client-side `_rowRecord` stash to the server.

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

- 35da149: The flow designer no longer seeds new `wait` nodes with the retired
  `waitEventConfig.onTimeout` (objectui#3316).

  FROM: `defaultNodeExtras('wait')` returned
  `{ waitEventConfig: { eventType: 'timer', onTimeout: 'fail' } }`, and the
  one-click revision loop (`addReviseLoop`) wrote `onTimeout: 'fail'` onto the
  `wait` node it creates. TO: both seed only the event flavor — `{ eventType:
'timer' }` and `{ eventType: 'signal', signalName: 'revision' }`. The author
  fills in `timerDuration`.

  **This is a behaviour fix, not a cleanup.** `waitEventConfig.onTimeout` was
  retired in `@objectstack/spec` 17 (framework#4158) via `retiredKey()`, i.e.
  `z.never().optional()` — it is not a silently-stripped extra but a hard
  `FlowNodeSchema.parse()` error carrying its own prescription ("It had no
  readers at all … Delete the key."). Every `wait` node dragged out of the
  palette, inserted on an edge, or created by the revision-loop button therefore
  carried a key the loader rejects, so publishing a flow the author had merely
  assembled returned 422. The other half of the same retirement had already
  landed here — the label overrides came out of `i18n.ts` and the two fields came
  out of the hand-written node form (`inspectors/flow-node-config.ts`) — but the
  block that _produces_ the key was missed.

  A new `flow-canvas-seeds.spec-parse.test.tsx` pins the invariant for the next
  retirement: every seeded node shape (all `NODE_PALETTE` types plus `start` /
  `end` / `http_request` / `boundary_event`) is run through the spec's own
  `FlowNodeSchema`, and the revision-loop node is captured from a real button
  click and parsed the same way. Two deliberately different criteria: the strict
  sibling blocks (`waitEventConfig` / `connectorConfig` / `boundaryConfig`) get a
  full-parse verdict plus an explicit `[REMOVED]`-tombstone check that names the
  offending seed key; the `config`-rooted seeds (`approval` / `notify` / `http`)
  — invisible to `FlowNodeSchema`, whose `config` is a permissive record, and
  deliberately partial, since the author still supplies notify's `title` and
  http's `url` — are checked key-level against the spec's published
  `ApprovalNodeConfigSchema` / `NotifyConfigSchema` / `HttpConfigSchema`.

  No other `defaultNodeExtras` branch was affected: the remaining seeds
  (`connector_action` / `boundary_event` / `approval` / `notify` / `http` /
  `script` / `start`) were each checked against the spec and are clean.

- 68b6a28: The list toolbar's "Filter" now saves. Saving a filter from the runtime toolbar PUT the FilterBuilder's whole group object (`{ id, logic, conditions }`) into the view's `filter`, where `@objectstack/spec`'s `ListViewSchema.filter` declares `ViewFilterRule[]` — so every save came back `422 invalid_metadata` and the filter was silently never persisted (objectstack#5159).

  The producer now folds the builder's group to the spec's flat `{ field, operator, value }` rule list before persisting, sharing one transform with the Studio view inspector (which had the only copy). Operators normalize through the spec's own `normalizeFilterOperator`, so the four builder operators the Studio's local table had drifted behind — `startsWith`, `endsWith`, `isNull`, `isNotNull` — now persist correctly too. The builder's per-row `id` is no longer written: it is a React list key that the read path regenerates, so stored view bodies keep the declared vocabulary only.

  A filter whose shape cannot be represented losslessly as a flat rule list — `OR` across several conditions, or nested condition groups — is now refused with a translated message instead of being quietly saved as `AND`, which would have returned a different set of records than the one on screen. Such a filter still applies to the current list; it just does not become part of the saved view.

- 94755bb: RecordDetailView's `type:'modal'` dispatch no longer falls back to the server-side action handler when the target resolves to neither a page nor an object. That fallthrough could never succeed — the framework rejects `type:'modal'` over REST with a 400 (`headlessActionTypeError`) — so it only converted an authoring mistake into a confusing round-trip. The record page now reports the same descriptive authoring error as the shared console runtime (objectstack#3959), naming the action, the dud target, and the way out (`type:'script'` with `params`).
- 875c5fa: `ObjectDataPage`'s "Save as view" now folds the active URL drill conditions into `@objectstack/spec` `ViewFilterRule`s before persisting them, instead of writing the runtime filter triples verbatim into the view body. The page renders from a filter AST (`['stage', '=', 'open']`), but a saved view is a ViewItem whose `ListViewSchema.filter` declares `z.array(ViewFilterRuleSchema)` — `{ field, operator, value }` over the canonical operator words. Saving a drilled list therefore produced an off-spec ViewItem that the record gate rejects on `config.filter.0` ("expected object, received array"), so a view saved with drill conditions was already invalid the moment it was written (#3419). Operators are canonicalised through the spec's own `normalizeFilterOperator` — the same exit `viewFilterFold` uses for the FilterBuilder — so `=` becomes `equals` and `>=` becomes `greater_than_or_equal`, and `field` / `value` are carried through untouched. Contract-first: the fold is at the producer; no consumer was taught to accept triples. A condition whose operator has no canonical spelling is dropped from the persisted view with a debug-level note rather than written off-spec (the URL contract emits none such today). Saving a view with no drill conditions active is unchanged — no `filter` key is written, exactly as before.
- 8e02ad7: The Page block inspector's conditional-visibility control now authors
  `visibleWhen`, and says "Visible when" while doing it (objectui#3229).

  FROM: the `ConditionBuilder` rendered for the selected page block read and wrote
  `block.hidden`. TO: it reads and writes `block.visibleWhen`, the canonical
  conditional-visibility key (ADR-0089), through the same envelope read/write pair
  the hook and action guards use (objectui#3218).

  `PageComponentSchema` (`ui/page.zod.ts`) is `.strict()` and has no `hidden` key
  at all. So this was not a tolerant consumer accepting something sloppy — it was
  the **producer emitting a key the contract rejects**: every author who filled
  that box got a save-time parse failure naming a key they never typed, because the
  inspector typed it for them. The spec's own error message already names the fix
  (`` the canonical key is `visibleWhen` ``). A designer that mass-produces drafts
  guaranteed to be rejected is a worse failure than a lenient reader — a lenient
  reader lets wrong metadata run, this made the _correct tool_ emit the wrong thing.

  The fix also closes the gap in the other direction: a **valid** block carrying
  `visibleWhen` previously had no control in the inspector that could edit its
  visibility, because the only visibility control on screen wrote a different key.
  Removing the control instead would have stopped teaching the wrong key but left
  that gap open, which is a capability regression.

  **The semantic flip lands in the UI copy, not just the key.** `hidden` and
  `visibleWhen` are inverses (`hidden` true ⇒ gone; `visibleWhen` true ⇒ shown), so
  the label, the i18n key (`engine.inspector.pageBlock.hidden` →
  `engine.inspector.pageBlock.visibleWhen`) and both language packs move together:
  "Hidden (CEL)" → "Visible when (CEL)", 「隐藏条件（CEL）」→「显示条件（CEL）」.
  Renaming the key while leaving hide-flavoured copy would have been worse than
  leaving the bug: authors would write the predicate backwards, producing metadata
  that PARSES and means the opposite — the objectui#3276 class, which objectui#3257's
  guard is structurally blind to because it only asks whether a draft parses.

  **No value is migrated.** An existing `hidden` expression is NOT negated into
  `visibleWhen`: textually negating an arbitrary CEL predicate is unsound
  (`!(a && b)` is not `!a && !b`), and there is no stored valid draft to migrate
  anyway — since ADR-0089 D3a `hidden` is a loud parse failure on save, and before
  D3a the key was silently dropped, so it never reached published metadata either.
  A loud error on a rare stale draft, with the spec's message pointing at
  `visibleWhen`, beats silently rewriting an author's predicate.

  Because `visibleWhen` is `ExpressionInputSchema`, a persisted block carries the
  `{ dialect, source }` envelope rather than the authored string, so the control
  goes through `expressionSource` / `writeExpressionSource` — an edit preserves
  `dialect` and `meta` and drops the stale `ast`, instead of flattening the
  envelope to a bare string and silently swapping the evaluation engine.

  Tests pin DIRECTION, not just the key name (the objectui#3276 precedent makes
  that a hard requirement): the block the inspector actually commits is rendered
  through `SchemaRenderer` and must appear when its predicate is true and be absent
  when it is false, alongside assertions that the committed key is `visibleWhen`,
  never `hidden`, and that the resulting draft parses.

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

- 8ff3ad7: Five metadata designers stop rendering keys `@objectstack/spec` rejects, and start
  rendering the keys it declares (objectui#3275, objectui#3281).

  The previews and the console's sample drafts had been wrong TOGETHER, which is
  why the gallery looked healthy. objectui#3266 corrected the samples and the
  gallery immediately rendered LESS — agent's TOOLS and KNOWLEDGE blocks, skill's
  TRIGGER PHRASES, app's per-item row and `Dashboard` badge, and datasource's
  CAPABILITIES all vanished or degraded. Nothing had broken: those blocks were only
  ever lit up by metadata that cannot be saved. This is the renderer half of that
  finding, and the same fix objectui#3236 / PR #3258 made to `ToolPreview`.

  A preview that renders a rejected key does not just show something useless — it
  tells the author "this is correct" until publish refuses it. For AI-generated
  metadata that is where a stale key hides and multiplies, so every read below was
  deleted rather than kept behind a fallback (AGENTS.md #0.1).

  **Retired keys, deleted** — each is a `retiredKey()` tombstone rejected by name:
  `agent.tools` (objectstack#3894 — an agent reaches exactly the tools its skills
  declare, ADR-0064), `agent.knowledge` (objectstack#3896 — it never scoped
  retrieval), `skill.triggerPhrases` (objectstack#3896 — phrases were never matched
  against a user's message).

  **`AppPreview` / `AppNavCanvas`** — `AppSchema.navigation` is a discriminated
  union on `type` whose every branch is `.strict()`. Both surfaces ignored the
  discriminator: kind came from `it.object` / `it.dashboard`, the route from
  `it.path ?? it.href ?? it.route ?? it.url`, and the landing from
  `landingRoute ?? landing ?? defaultRoute ?? '/'`. Not one of those is a key
  (`landing` was removed in objectstack#4001), so the reading was exactly inverted —
  a valid app showed generic badges, no targets and an invented `Landing: /`. Now
  `type` is the badge, each branch's own key is the target
  (`objectName`/`pageName`/`dashboardName`/`url`/`reportName`/`componentRef`/
  `actionDef.actionName`), and the route comes from `resolveHref`, the shell's own
  nav → URL mapping that `useNavPins` and `SearchResultsPage` already share — so a
  link in the preview is the link the runtime follows. The landing entry is
  DERIVED, never read off the draft — it is the first navigation item that yields
  a route, the same rule the console shell applies; `homePageId` was retired in
  `@objectstack/spec` 17.0.0 and is not consulted.

  **`DatasourcePreview`** — `capabilities` is a `DatasourceCapabilities` object of
  boolean flags, and the preview tested `Array.isArray`, lighting the block up only
  for the pre-17 token array the schema refuses. It now lists the flags set to
  `true`. The `driver ?? d.type` fallback is gone (the schema's own hint is
  `type` → `driver`), as is the `default` pill behind `isDefault ?? default` —
  routing is declared at stack level via `datasourceMapping`, never on the
  datasource.

  **`SkillPreview`** — the trigger-conditions table read `cond.expression ??
cond.value` under a `cond.type` gutter, so a spec-valid condition rendered as
  `COND | sales_order` with the field it tests and the operator it applies both
  invisible. It is now three columns — `field` / `operator` / `value` — straight off
  `SkillTriggerConditionSchema`, and a row missing one of those required cells says
  so instead of rendering a blank that reads as fine.

  **`ValidationPreview`** (objectui#3281) — drew nine rule types where the union has
  six. `unique`, `async` and `custom` were removed by one paragraph of
  `validation.zod.ts`, because a rule must be a deterministic, synchronous,
  side-effect-free predicate over one record; each now redirects to the layer that
  does the job (a unique **index** — a SELECT-then-INSERT rule is racy, TOCTOU — a
  form-layer check, a lifecycle hook). Two alias fallbacks went with them:
  `condition ?? expression` and `pattern ?? regex`, where neither `expression` nor
  `pattern` has ever been a key on any branch — which is precisely why a bogus
  `expression` sat unnoticed in the console sample. Two branches were also simply
  wrong: `conditional` read `condition` instead of its `when` (a valid rule showed
  "No expression set", and its nested `then`/`otherwise` now render), and
  `json_schema` had no branch at all, so a valid rule displayed "Unknown rule type".

  `validation.object` is deliberately still read: `anchors.ts` registers a
  standalone `validation` resource matched by `anchorByField('object')`, so a
  standalone rule genuinely carries it. Not every key a union omits is residue.

  Verified in the preview gallery before and after, per designer; each preview also
  gains tests that feed a spec-valid draft and assert the block renders, then feed a
  stale draft carrying the retired key and assert nothing renders from it.

- 12bf669: The record discussion panel now says "loading" while it is loading, instead of
  "No comments yet" (objectui#3209).

  FROM: opening any record page showed the discussion/chatter panel asserting
  `No comments yet` for the whole first leg of the page, then contradicting
  itself when the comments appeared. TO: the panel shows the loading row until
  the feed has actually answered, and only then commits to "this record has no
  comments".

  objectui#3205 gave `RecordActivityTimeline` the render branch that prefers a
  loading row over the empty copy, and `RecordChatterPanel` already forwarded
  `loading` to it in both positions — but on the chatter chain **nothing
  produced the signal**, so that branch could never fire. `record:activity`
  computes its own flag and was visibly fixed by #3205; chatter was not. The
  four wiring points are one chain and are all closed here, because any one of
  them left open still ships the empty copy to some user:

  - `RecordDetailView` — the host that OWNS the feed fetch — now derives a
    `feedLoading` flag from its two reads (`sys_comment` + `sys_activity`);
  - `<DiscussionContextProvider loading={feedLoading}>` publishes it (the field
    was already declared on `DiscussionContextValue`, and already read by
    `record:activity`);
  - the auto-appended `<RecordChatterPanel loading={feedLoading}>` — the panel
    authored pages get when they place no discussion slot — receives it
    directly;
  - the `record:chatter` / `record:discussion` renderer forwards
    `loading={discussion?.loading}`, so a hand-placed block is on the same
    chain as the synthesized one.

  The two reads run in parallel, so the flag closes over **both**: it clears on
  `Promise.allSettled`, and a REJECTED read counts as an answer. A deployment
  without the audit plugin 404s `sys_activity` and an object with
  `enable.feeds: false` 403s `sys_comment`; neither may pin the panel in a
  permanent spinner, which would be a worse bug than the one being fixed. The
  flag is keyed by `object:recordId` rather than being a plain boolean, so the
  first render of a record already reads as loading (no one-frame flash of the
  empty state) and navigating between records cannot show the previous record's
  settled answer.

  No tolerance was added at the consumer. The timeline still does not guess that
  "no items yet and just mounted" means loading — that guess is wrong the moment
  a record genuinely has no comments, and the signal belongs to whoever owns the
  fetch. Same shape as objectui#3165 / #3205: divergence converges at the
  producer.

- a8aa576: The record discussion panel no longer shows the PREVIOUS record's comments and
  activity (objectui#3268).

  FROM: clicking from record A to record B in a list left A's comments and
  activity rows on B's discussion panel, with B's own rows merged in alongside
  them. TO: each record's panel shows that record's feed and nothing else, and a
  record that is still being fetched shows the loading row rather than the
  record the user just came from.

  This was cross-record data display, not a cosmetic glitch. `RecordDetailView`
  is deliberately NOT remounted between records — no mount site passes a `key=`
  (`console/AppContent.tsx`, and the `ObjectView` / `ObjectDataPage` /
  `InterfaceListPage` drawers just swap `recordIdOverride`), per objectui#2269
  "refresh data, don't rebuild UI" — so its feed state survived the navigation,
  and both reads (`sys_comment`, `sys_activity`) merged into it BY ROW ID. A's
  rows and B's rows have different ids, so the merge could not dedupe them away
  and nothing anywhere reset the list.

  It also suppressed the fix objectui#3209 had just shipped. On record→record
  navigation `feedLoading` did flip true, but `RecordActivityTimeline`'s branch
  is `loading && filtered.length === 0` (objectui#3205, deliberate: a refresh
  must not turn an on-screen feed into a spinner) and the leftover rows kept
  `filtered` non-empty — so the panel rendered the previous record's content
  where a loading state belonged. The two issues only add up to a working
  feature together.

  The feed state is now keyed by `objectName:recordId` — the same key
  objectui#3209 introduced in this file for the loading flag, and the very
  `thread_id` the rows carry server-side. The render reads only the current
  key's slice, so "empty for a new record" FALLS OUT of reading a key that has
  no slice; there is no `setFeedItems([])` racing the fetch that fills it. A
  response that lands after the user has navigated away is written under the key
  its effect closed over, so it updates the record it was fetched for and can
  never bleed into the record now on screen — the same guarantee `settledFeedKey`
  already gave the loading flag. One idiom in this file, not two.

  Keying rather than clearing is what keeps OPTIMISTIC rows safe. A comment the
  user has just posted but that has not come back from the server lives only in
  this state, and it now rides in its own record's slice: navigating away and
  back finds it again, and it never appears on another record's panel. Nothing
  deletes a slice, so returning to a record shows its rows immediately while the
  re-read confirms them (objectui#3205 again), and the re-read folds the
  persisted copy onto the optimistic row by id — same id, because that is the id
  it was created under — so there is no duplicate when it lands. The same
  scoping applies to threaded replies and reaction toggles.

  No tolerance was added at the consumer. `RecordActivityTimeline` still keeps
  `loading && filtered.length === 0` exactly as objectui#3205 wrote it; once the
  feed's lifecycle is correct that condition is right on its own. Weakening it
  would have been treating the symptom at the consumer, which is what
  objectui#3165 / #3205 / #3209 all deliberately avoided.

- c0c771c: `RecordFormPage` no longer passes an inline `defaultValue` to the seven `t()`
  lookups whose keys are defined in all ten locale packs (`form.createTitle`,
  `form.editTitle`, `form.createSuccess`, `form.updateSuccess`,
  `form.saveRecord`, `common.back`, `common.cancel`). Rendered copy is
  unchanged in every locale — those branches were unreachable, because
  `all-locales-key-parity.test.ts` pins the keys as present, so i18next always
  resolved the pack value and never consulted the fallback (objectui#3469).

  What the dead fallbacks _did_ do is carry a second, unwatched English
  spelling of the same string. `form.createTitle`'s default read
  `New {object}` while the pack says `Create {{object}}` — a different verb for
  one title at one call site. Had the key ever been renamed or dropped, the page
  title would have silently changed from "Create Contacts" to "New Contacts"
  with the whole suite still green. Now a missing key surfaces as the raw key
  plus the dev missing-key warning, and a new
  `RecordFormPage.i18n.test.tsx` asserts both that the rendered copy is the pack
  copy (checked in `en` and `zh`, which no hardcoded English default could
  satisfy) and that every bare key really exists in all ten packs.

  One `defaultValue` in the file is deliberately kept: `form.createTargetOrg`
  (the group-tenancy write-target badge) is defined in **no** pack, not even
  `en`, so its fallback is what actually renders. It is now documented as the
  exception and pinned by a test that says to remove it when the key is
  backfilled.

- 30ac2e1: `ToolPreview` stops advertising retired `ToolSchema` flags (objectui#3236).

  The metadata-admin tool preview painted a header strip of flag pills read
  straight off the raw draft: `Requires confirmation`, `Active` / `Disabled`,
  `built-in`, and the `category` tag. All four keys have been removed from
  `@objectstack/spec`'s `ToolSchema` — `requiresConfirmation` in the 16.x line
  (objectstack#3715, ADR-0033 §2) and `category` / `active` / `builtIn` in
  17.0.0 (objectstack#3896 audit close-out). The schema is `.strict()` and now
  rejects each by name with an upgrade prescription, so no newly authored tool
  can carry them; verified against the `@objectstack/spec@17.0.0-rc.1` this repo
  depends on.

  New metadata could not reach these pills — but rows stored before the removals
  still carry the keys, and for those the preview kept rendering. That is the
  harmful direction, not a cosmetic one:

  - `Requires confirmation` advertised a safety pause that no execution path has
    ever performed. Nothing read the key — not the LLM tool set (a tool reaches
    the model as name/description/parameters only), not `ToolRegistry.execute`,
    not `POST /ai/tools/:name/execute`. A reviewer reading the preview saw a
    destructive tool marked as gated when it was not. The real gate is
    `action.ai.requiresConfirmation`, which the HITL approval queue reads.
  - `Disabled` claimed a tool had been withdrawn while `ToolRegistry.getAll()`
    kept handing it to the LLM and the execute route kept running it.

  Same shape as objectui#2962: a UI badge advertising a capability the runtime
  does not have. The pills are gone; the surviving header strip shows label,
  machine name and the `objectName` pill (`objectName` is still a live spec key),
  and nothing else in the preview changed — parameters table, example LLM call
  and output schema are untouched.

  New tests feed the preview a stale draft that still carries all four retired
  keys and assert none of them renders, so the pills cannot grow back: the names
  survive in the spec's tombstone guidance, which gives the next reader a
  plausible-looking reason to "restore" them.

- Updated dependencies [18cd432]
- Updated dependencies [b7165ce]
- Updated dependencies [608669e]
- Updated dependencies [532cf8b]
- Updated dependencies [680080a]
- Updated dependencies [a7651e6]
- Updated dependencies [d915c47]
- Updated dependencies [b71fc92]
- Updated dependencies [65516ba]
- Updated dependencies [94c5b7c]
- Updated dependencies [ca0fa8f]
- Updated dependencies [d0d71df]
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
- Updated dependencies [d2363e7]
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
  - @object-ui/layout@17.3.0
  - @object-ui/components@17.3.0
  - @object-ui/types@17.3.0
  - @object-ui/i18n@17.3.0
  - @object-ui/collaboration@17.3.0
  - @object-ui/react@17.3.0
  - @object-ui/data-objectstack@17.3.0
  - @object-ui/plugin-editor@17.3.0
  - @object-ui/auth@17.3.0
  - @object-ui/permissions@17.3.0
  - @object-ui/providers@17.3.0

## 17.2.0

### Minor Changes

- 4ae0ac4: One placement rule for action `locations` (objectui#3142).

  **Breaking for metadata**: an action that declares no `locations` (missing key
  or `[]`) no longer renders in a located surface. FROM: omitting `locations`
  made an action appear on the list toolbar, the record header, and every
  metadata-admin toolbar. TO: declare where it belongs —
  `locations: ['record_header']` for the record header, `['list_toolbar']` for
  the list toolbar, and so on. Nothing else changes; actions that already
  declare a location are untouched.

  Four renderers each answered "where does an action with no `locations` go?"
  differently — `action:bar` and metadata-admin showed it EVERYWHERE,
  `page:header` showed it on the header, `action:group` showed it for
  `undefined` but hid it for `[]` — while `ActionEngine`, `RecordDetailView`,
  `DeclaredActionsBar`, the related-list bridge and the environment toolbar all
  showed it NOWHERE. The same action therefore appeared or vanished depending on
  which component happened to draw it. All eight now go through one exported
  predicate, `actionRendersAt(action, location)` from `@object-ui/types`: an
  action renders at a location only if it declares that location.

  The strict reading is the platform's own — ADR-0078 lists "an `action` with no
  `locations`" as a verified inert shape, and the detail-page synthesizer already
  documented "must include `locations: ['record_header']` to render". The
  leniency contradicted both, and it is what let an aggregate-only bulk action
  (objectui#3139) — one with no single-record placement by construction — mint a
  list-toolbar button whose dispatch could only fail.

  Two placements are declared elsewhere and need no `locations`, both unchanged:
  host-injected chrome in the `systemActions` / `headerSystemActions` slot (now
  consistently exempt on `page:header` too, where it used to be filtered), and an
  action named in a view's `bulkActions` / `bulkActionDefs`.

  Authoring side: Studio seeds `locations: ['record_header']` on a new action
  instead of minting one that renders nowhere, and the action inspector says so
  when no placement is ticked. The `ActionSchema.locations` JSDoc claimed a
  `['record_header']` default that no renderer ever implemented — corrected.

- 696e3c1: `reference` is the one authorable action-param picker target (objectui#3174).

  **Breaking for authoring**: `ActionParam` in `@object-ui/types` no longer
  declares the nine resolved-side picker keys — `referenceTo`, `displayField`,
  `idField`, `descriptionField`, `titleFormat`, `lookupColumns`, `lookupFilters`,
  `lookupPageSize`, `dependsOn`. FROM: `{ name: 'account_id', type: 'lookup',
referenceTo: 'account' }` type-checked. TO: `{ name: 'account_id', type:
'lookup', reference: 'account' }` — or make the param field-backed
  (`{ field: 'account_id' }`) and it inherits the whole picker group from the
  object field.

  The two halves of one contract disagreed about a spelling, and the type was the
  half that was wrong. `resolveActionParams()` reads the spec's `reference` for an
  inline `lookup`/`master_detail` target and nothing else; it EMITS
  `ActionParamDef.referenceTo`, the resolved spelling. The public authoring type
  declared the resolved spelling "for parity with the resolved shape", so an
  author who followed it got a param whose picker target was dropped in the
  resolver and a dialog that degraded to a plain record-id text input — asking a
  human to paste a UUID. The dev warning that fired then told them to declare
  `reference`, a key the type did not have.

  `reference` wins because the platform had already decided: `ActionParamSchema` in
  `@objectstack/spec` is `.strict()`, lists `referenceTo` **by name** in its
  alias map, and answers it with "use `reference`". So an authored `referenceTo`
  was never storable — it was a hard parse rejection on the server while `tsc`
  waved it through. Resolving it in objectui instead would have made the renderer
  accept metadata the platform itself refuses, and such a param would work in a
  locally-authored TS action and fail at publish; removing the declaration moves
  the failure to where it can be fixed, at the authoring keystroke.

  - **`@object-ui/types`**: the nine keys are gone, and the rule they violated is
    now pinned — `ActionParam` declares _exactly_ the spec's authorable key set.
    The drift guard names the single exception (`validation`, inert and rejected
    by the same `.strict()` parse — filed as objectui#3201) so a second one cannot
    appear without being a decision.
  - **`@object-ui/app-shell`**: `resolveActionParams()` names any resolved-only
    key it finds on an authored param in a dev-mode warning, with the
    prescription (`referenceTo` → "use `reference`"; the rest → "make the param
    field-backed"). It still does **not** read them. This covers the gap `tsc`
    cannot gate — params authored in plain JS, loaded from JSON, or synthesised
    at runtime — so the mistake is loud where it is made rather than surfacing
    downstream as `paramToField()`'s "no reference target" warning naming a key
    the author never wrote.

  The internal pipeline keeps its two spellings on purpose (authoring `reference`
  → `ActionParamDef.referenceTo` → the field's `reference_to`); what is pinned now
  is that the public entry and the public exit agree. The end-to-end test authors
  through the published `ActionParam` and follows one param to `reference_to` —
  every previous test authored the resolver's own local input interface, which is
  why the resolver only ever agreed with itself and the mismatch survived.

- 10bead2: Stop declaring 28 app-shell symbols under names `@objectstack/spec` owns
  (objectui#3157, objectstack#4115 batch 3).

  **Breaking for importers of `@object-ui/app-shell`** — eight exported names
  changed, because the spec exports the same name for a _different_ thing:

  | was                     | now                                     | what the spec's same-named export actually is |
  | :---------------------- | :-------------------------------------- | :-------------------------------------------- |
  | `FieldInput`            | `ScreenFieldInput`                      | the authoring shape of an object FIELD        |
  | `ConversationSummary`   | `ConversationListItem`                  | the AI context-compaction record              |
  | `RuntimeConfig`         | `AppShellRuntimeConfig`                 | the ENGINE runtime config                     |
  | `PageHeaderProps`       | `PageHeaderComponentProps`              | the authored SDUI page-header schema          |
  | `FlowNode` / `FlowEdge` | `FlowDesignerNode` / `FlowDesignerEdge` | a COMPLETE authored flow node/edge            |
  | `PackageManifest`       | `PackageManifestRow`                    | the full authored package manifest            |
  | `InstalledPackage`      | `InstalledPackageRow`                   | the full install record                       |

  The object designer's `FieldGroup` also becomes `ObjectFieldGroup` — that is
  the spec's own name for this exact shape, while its `FieldGroup` is the Studio
  field-editor's group config. The other nineteen keep their names and are now
  imported or derived from the spec instead of re-declared.

  **Three live defects the copies were hiding**, all fixed by importing the real
  types:

  - `SchemaDiffEntryKind` was missing `index_mismatch` and `unmapped_index`
    (framework#3728). The federation validate panel renders a label per kind from
    a total map, so an index divergence — which the server already emits — arrived
    as a diff row this UI could not name. The union is now the spec's, and the
    compiler required the two missing labels.
  - `ExplainLayer.contributors[].state` (`'active' | 'expired'`) did not exist in
    the local copy of the access-explain report, so an EXPIRED permission-set or
    position contribution rendered identically to a live one.
  - `ExternalColumn.primaryKey` was optional locally while the server always sends
    it (the spec schema defaults it), and `ExplainRecordAttribution.rules` /
    `ExplainDecision.principal.positions` / `.permissionSets` were optional here
    and required there — every reader carried a nullish branch that could not fire.

  The comment justifying the largest copy ("kept local so app-shell does not take
  a build dependency on the framework spec package") was already false:
  `@objectstack/spec` is a direct dependency of this package.

  Two symbols are derived structurally rather than re-exported, each with one
  documented divergence pinned by a test: `ScreenSpec` keeps `fields` optional
  (an `object-form` step legitimately sends none — #3528), and `DecisionOutputDef`
  adds `required`, which the server enforces but the spec does not yet model.
  Deriving the latter also narrowed its `type` from a bare `string` to the spec's
  closed enum, so a typo'd picker kind now fails to compile instead of silently
  degrading to a raw record-id text box (objectui#2955).

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

- 4bf612c: Aggregate single-call mode for bulk actions: `execution: 'aggregate'` (objectui#3139).

  A `bulkActionDefs` entry with `operation: 'custom'` used to have exactly one
  dispatch shape: one action-runner call per selected record (`_rowRecord`
  attached). "Select N rows → ONE call that receives every selected id" — the
  zip-of-QR-codes / merged-PDF / batch-print shape — could not be expressed, so
  downstream projects fell back to per-row `window.open` storms or gave up.

  `BulkActionDef` now carries `execution?: 'perRecord' | 'aggregate'` (default
  `'perRecord'`, existing views untouched). An aggregate def dispatches its
  action exactly once for the whole selection with `params._selectedIds:
string[]` injected and the full records published as
  `context.selectedRecords`. The authored form usually just names a declared
  object action — `{ name, operation: 'custom', execution: 'aggregate' }` —
  and `resolveBulkActions` attaches the declaration. Results are
  all-or-nothing: a failure is attributed to every id with the real error and
  per-row Retry is hidden (re-running the action is the retry; a total failure
  keeps the selection). `batchSize` does not apply; `maxRecords` still gates.

  The executor rides the existing `executeBulkBatch` bulk-first decision tree —
  the aggregate call is its `bulkCall`, and the per-row "fallback" only
  re-throws the captured error for attribution, never fans out N dispatches
  against an endpoint written for one `_selectedIds` call.

  Also: url/api target interpolation now exposes `${ctx.selection.ids}` (comma
  -joined) and `${ctx.selection.count}` from the grid's checkbox selection, so
  a plain `list_toolbar` action can carry the selection without bulk plumbing;
  the console's server-action handler recognizes `_selectedIds` and skips the
  single-record multi-select guard for aggregate dispatches.

- e3aea83: Flow branch editor: an edge it creates carries an `id` (objectui#3202).

  The Branches editor on a Decision node creates an out-edge when a branch names a
  Target it has no edge for. That edge shipped with no `id`, while
  `FlowEdgeSchema.id` in `@objectstack/spec` is a required `z.string()` — so the
  designer drew an edge, its own live draft validation (`clientValidation.ts`,
  which parses the draft with `FlowSchema`) immediately flagged
  `edges.N.id: Invalid input: expected string, received undefined`, and saving it
  was a 422 from the server's parse of the same schema. The author had done
  nothing wrong and there is no UI anywhere that can supply a missing edge id.

  Created edges now get `uniqueId('edge', …)` — the same minter every other
  edge-creating path in this designer already used (`FlowCanvas`'s `addNode`,
  `insertOnEdge`, and the ADR-0044 revise loop). Ids are drawn from the ids
  already in the flow **plus the ones minted earlier in the same commit**, since
  one apply can create several edges at once and must not mint a number twice.

  The gate that would have caught it is now in place: every edge produced by
  `applyDecisionBranches` / `syncDecisionEdgesByOrder`, across create, update,
  retarget, detach and legacy by-order scenarios, must pass
  `FlowEdgeSchema.safeParse`. These functions' output is a **committed** state
  that goes straight to `onPatch` → draft → save, so "the designer's own output is
  spec-legal" is the contract, not a nicety.

  **Type change (minor, public):** `FlowDesignerEdge.condition` in
  `views/metadata-admin/previews/flow-canvas-layout` is now the spec's
  `ExpressionInput` — a bare CEL string, or the ADR-0089 envelope whose `dialect`
  discriminant is **required**. It was `string | { source?: string }`, which
  described an envelope the server rejects and that nothing in this repo has ever
  produced. Code that assigned a `dialect`-less `{ source }` to an edge condition
  no longer compiles; such a condition was already refused at save, so this only
  moves the failure to where it can be fixed. The type is **imported** from
  `@objectstack/spec` rather than restated, so the mirror cannot go stale, and it
  is pinned by compile-time assertions in a project CI actually type-checks
  (`tsconfig.typetests.json`). The two other places that restated the same
  over-wide shape follow: `FlowEdgeInspector` (which only ever commits the
  bare-string form) and `FlowPreview`, whose duplicate declaration is deleted in
  favour of the canvas's own type.

  Why the type is part of a bug fix: that over-wide read type already cost a wrong
  defect diagnosis — objectui#3171 was filed against the phantom `{ source }`
  envelope and does not reproduce, while the real spec-rejected shape the designer
  emits was this missing `id`. A type that cannot describe a shape the spec
  rejects cannot send the next reader down that road either.

  `uniqueId` also moves from `inspectors/_shared.tsx` to `inspectors/unique-id.ts`
  (re-exported from `_shared`, so every existing import is unchanged) so that pure
  reconciliation modules can share the one minter without dragging React and the
  `@object-ui/components` barrel into their unit tests — measured at 7.4s of
  module load versus 63ms.

- 39033a3: Flow simulator evaluates an edge guard stored as `{ dialect, source }` (objectui#3216).

  A decision's out-edge whose guard is the ADR-0089 expression envelope — say
  `{ dialect: 'cel', source: 'amount > 10' }` — was reported on the debug timeline
  as `Branch has no condition.` and skipped. With `amount = 20` the simulation fell
  through to the default branch (or dead-ended with "No branch matched"), while the
  engine takes that branch at run time. A designer-time debugger that shows a
  different route than the runtime is worse than no debugger, and it is the one
  thing the simulator's own contract forbids: _never silently simulate semantics
  that differ from the runtime_.

  The envelope is not an exotic spelling. `ExpressionInputSchema` in
  `@objectstack/spec` is a `ZodPipe`: parsing `condition: 'amount > 10'` **rewrites
  it into** `{ dialect: 'cel', source: 'amount > 10' }`, and `FlowEdgeSchema.condition`
  is that schema. So the shape the simulator could not read is the shape the
  platform itself produces for every authored guard.

  Two readers in `previews/simulator/` each hand-rolled `typeof c === 'string' ? c :
undefined`, while every other consumer in this repo already accepted both
  spellings — `conditionText` (canvas labels, `FlowEdgeInspector`, the Branches↔edges
  reconciliation) and `validateExpressionClient` (the Problems panel). Both now go
  through `conditionText`, so "how an edge guard is read" has exactly one answer.
  Its JSDoc says so, because a fifth hand-rolled copy brings this class of bug
  straight back.

  Two behaviours change, both toward the runtime:

  - **Decision routing** — a branch guarded by an envelope is now evaluated, and
    selected when true. The timeline shows the CEL source it ran instead of
    "no condition". An envelope carrying only a compiled `ast` and no `source`
    (spec phase M9.2) still reports "no condition": there is nothing to evaluate,
    and the simulator says so rather than faking a result.
  - **Preflight diagnostics** — `validateFlowDraft` warns that a decision has no
    default branch when _every_ out-edge is guarded. A decision whose guards were
    envelopes was silently exempt from that warning; it is exactly as able to
    dead-end, so the warning now appears in the Problems panel and the canvas
    banner for those flows too.

  **Type change:** `SimEdge.condition` is now the spec's `ExpressionInput`,
  **imported** rather than restated — the last copy of the restatement objectui#3202
  removed from `FlowDesignerEdge`. `string | { source?: string }` was wrong in both
  directions at once: too wide, since it describes a `dialect`-less envelope the
  server rejects; too narrow, since excess-property checking then refused the
  canonical envelope written as a literal (`'dialect' does not exist in type
'{ source?: string }'`) — the one shape a persisted flow actually carries was the
  one shape you could not write down. Compile-time assertions pin it in
  `tsconfig.typetests.json`, the project CI actually type-checks.

- 5cb75b3: fix(studio): the form-layout canvas resolves the object's field and section translations (#3134)

  `ObjectFormDesigner` bills itself as a preview of the end-user form, but it read
  labels straight off the object draft — `entry.def.label` for fields, `group.label`
  for section headers. Every other surface for the same object (`ObjectForm`,
  `RecordDetailView`, the data grid) resolves those through the project's object
  translations first, so a fully translated object rendered `Opportunity Name` /
  `Basic Information` on the layout canvas while the very same fields read
  `商机名称` / `基本信息` one click away.

  The designer now goes through `useSafeFieldLabel()` — `fieldLabel()` for field
  cards (including the drag overlay) and `sectionLabel()` for section headers —
  which is the same resolver the runtime form uses, with the authored metadata
  label as fallback when no translation exists. The lookup root is the object's
  API name; `StudioDesignSurface` now passes it explicitly (`objectName`) so a
  draft body that has not been re-named still resolves, falling back to
  `draft.name`.

  Observable rendering change (translated labels now appear where English source
  labels did), hence `minor`.

- b06f78a: Inspectors read AND write the `{ dialect, source }` expression envelope (objectui#3218).

  The Hook inspector's "Run only when (optional CEL)" box rendered **empty** for a
  hook that had a guard. `HookSchema.condition` is `ExpressionInputSchema` — the
  same `ZodPipe` as `FlowEdgeSchema.condition` — so parsing `condition: 'amount > 10'`
  **rewrites it into** `{ dialect: 'cel', source: 'amount > 10' }`. The envelope is
  what a persisted hook carries; the inspector read `typeof draft.condition ===
'string'` and fell through to `''`.

  An empty box is not a cosmetic defect here. `ConditionBuilder.emit` compiles only
  the rows currently on screen, so the author's next edit **replaced** a guard they
  were never shown (clearing it committed `condition: undefined`). Opening the
  panel is safe on its own — `onCommit` fires only on a real edit — but the empty
  box is what induces that edit.

  **Read.** Every one of these surfaces now goes through `conditionText`, the one
  reader objectui#3216 settled on, via a shared `expressionSource` /
  `writeExpressionSource` pair. No new `typeof c === 'string'` was written.

  **Write.** `source` was the only key the commit path preserved — everything else
  in the envelope was discarded, because the commit sent a bare string and the
  spec's pipe hardcodes `dialect: 'cel'`. Editing one character of a
  `dialect: 'cron'` or `dialect: 'template'` guard silently moved it to a different
  evaluation engine, and dropped `ast` and ADR-0089 `meta` (`rationale` /
  `generatedBy` — the keys AI-authored metadata fills and nobody restores by hand).
  An edit now:

  | key       | behaviour                                                                                                                                                                                                                                               |
  | :-------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `dialect` | **preserved**                                                                                                                                                                                                                                           |
  | `meta`    | **preserved**                                                                                                                                                                                                                                           |
  | `source`  | replaced                                                                                                                                                                                                                                                |
  | `ast`     | **discarded** — it was compiled from the OLD source, so keeping it would leave the engine evaluating the old guard while the UI shows the new one. `objectstack compile` refills it, and `ExpressionSchema`'s `source \|\| ast` refinement still holds. |

  With no prior envelope to preserve, the commit stays the bare-string shorthand —
  which the spec's pipe normalizes to exactly `{ dialect: 'cel', source }`, so
  nothing is lost and plain-`string` predicate fields keep round-tripping as
  strings.

  Four surfaces were in this family, not one:

  - **Hook inspector** — `condition` (the reported defect).
  - **Action inspector** — `visible` and `disabled` (`boolean | ExpressionInput`),
    same empty-box read.
  - **The generic SchemaForm condition widget** — every predicate-named field
    (`visible` / `hidden` / `disabled` / `condition` / `predicate` / `*When`) routes
    here, and it did `String(value)`: an envelope reached the editor as the literal
    text `[object Object]`.
  - **Object validations panel** — the rule `condition`, plus a third narrow read
    in the type switcher that dropped a persisted guard on the floor and left the
    skeleton's never-firing `'false'` in its place. `ValidationRuleDraft.condition`
    is now `ExpressionInput` instead of `string`.

  The flow-edge inspector's **write** is fixed the same way; objectui#3216 had
  converged only its read.

  Fixtures in the new tests are authored input fed through `HookSchema.parse` — no
  envelope is hand-written — so they cannot drift from the spec.

- 07de7be: Navigation `action` items actually run now (framework#4509).

  A `type: 'action'` nav item rendered, gated like any other item, and did
  **nothing** when clicked. `NavigationRenderer` dispatches such a click to an
  `onAction` prop it expects the host shell to supply — it deliberately never
  reads `item.actionDef` itself — and no shipped sidebar supplied that prop. So
  `actionDef.actionName` reached no dispatcher: an author could put an action in
  the menu, watch it render with its icon and label, and never find out that
  clicking it was a no-op. The framework's liveness ledger recorded this as the
  single gap in the AppSchema navigation surface.

  **New `useNavActionDispatch`** (`@object-ui/app-shell`) resolves the nav item's
  `actionName` against `action` metadata at click time — the same source
  `DeclaredActionsBar` reads for a record toolbar — and dispatches the resolved
  definition through `useAction()`. `UnifiedSidebar` now passes it. No new
  provider is involved: the sidebar already renders inside `ConsoleShell`'s
  `GlobalActionRuntimeProvider`, so nav actions get the fully-wired console runner
  including the confirm, param-collection, result and navigate dialogs. A declared
  `params` array becomes the runner's param-dialog input, and the nav item's own
  `actionDef.params` is passed as the value bag, so a menu entry can pre-fill the
  action it launches.

  Nav actions are inherently **global**: `ActionNavItemSchema` is strict with
  exactly `{ actionName, params? }` and carries no `objectName`, so resolution is
  by name alone and no record context rides along.

  **Behaviour change:** a shell that passes no `onAction` no longer renders
  `action` items at all, instead of rendering them dead. This mirrors the existing
  capability guards — an item the host cannot serve is hidden — and it makes the
  omission diagnosable: a missing prop now shows up as "my action item is gone",
  which leads to the prop, rather than "clicking does nothing", which for three
  releases led nowhere. Every failure at dispatch time (an unnamed item, an
  unresolvable action, a throwing action) warns and toasts instead of returning
  silently.

- d3584c6: Bring the whole `@objectstack` family to `17.0.0-rc.1`, so the dependency graph resolves a
  single copy of `@objectstack/spec`.

  #3178 bumped **only** `@objectstack/spec` to `17.0.0-rc.1`. The rest of the family —
  `client`, `core`, `formula`, `lint` (and `sdui-parser`, reached through `lint`) — stayed on
  `17.0.0-rc.0`, and each of them depends on spec at an **exact** version rather than a
  caret:

  ```
  @objectstack/client@17.0.0-rc.0  -> spec "17.0.0-rc.0"
  @objectstack/core@17.0.0-rc.0    -> spec "17.0.0-rc.0"
  @objectstack/formula@17.0.0-rc.0 -> spec "17.0.0-rc.0"
  @objectstack/lint@17.0.0-rc.0    -> spec "17.0.0-rc.0"
  ```

  So `main` carried **two** spec copies: objectui's own code read `17.0.0-rc.1` while every
  `@objectstack/*` package read `17.0.0-rc.0` from its own nested `node_modules`. That breaks
  the single-contract invariant this repo's guards are built on, and it breaks them
  _silently_ — the affected checks depend on identity, not on version strings:

  - `spec-subschema-parity.test.ts` distinguishes a genuine re-export from a fork by
    **reference identity** of the zod schema object. Two spec copies make every schema a
    distinct object, so a real re-export starts reading as a fork (or a fork slips through,
    depending on which copy each side resolved).
  - `scripts/check-spec-symbol-derivation.mjs` and `spec-symbol-parity.test.ts` use
    `createRequire` to resolve spec's `.d.ts` and run it through the TS checker. With two
    copies installed, _which_ declaration file the checker sees is a function of resolution
    order rather than of intent.

  The declared ranges were already `^17.0.0-rc.0`, which technically admits rc.1 — the pin
  lived in the lockfile. Raising the remaining ranges to `^17.0.0-rc.1` makes the floor
  explicit and forbids a future install from silently sliding back onto a family member that
  drags rc.0 along with it. The rc.1 family members pin spec at `17.0.0-rc.1` exactly, so the
  graph now converges on one copy by construction, not by luck.

  No product behaviour changes here. `check:spec-symbols` reconciliation was already
  completed by #3178 and stays green under the unified graph; this changeset is `minor`
  per the repo's fixed-group version policy.

- 444457c: feat!: follow the framework's `managedBy: 'system'` → `'system-data'` retirement (objectstack#3355)

  **FROM → TO: `managedBy: 'system'` → `managedBy: 'system-data'`.** The framework
  retired the residual `system` bucket in protocol 17; this is the UI half of that
  change, landing with it so the closed `ManagedByBucket` union stays a mirror
  rather than a fork.

  ADR-0103 split the overloaded `system` bucket additively in v16 — the
  engine-owned objects moved to the explicit `engine-owned`, the admin/user-writable
  ones stayed on `system` — which left that value named after the half that had
  already moved out. `system-data` names what it actually holds: the SCHEMA is the
  platform's, the DATA is the admin's or the user's.

  **The derivation this deletes is the point.** Because v16's `system` doubled as
  both the engine-owned default and the writable set, three UI surfaces had to
  RECOVER the distinction from `userActions` at render time:

  - `isSystemWritable()` probed `userActions` for any opted-in write. It is now
    `managedBy === 'system-data'` — the bucket answers directly.
  - `ManagedByBadge` derived a synthetic `'system-writable'` variant key. The
    variant map is now 1:1 with the bucket union, so a new bucket is a compile
    error to miss instead of a silent fallthrough. The `systemWritable` /
    `system` i18n keys are **unchanged**, so no locale bundle moves.
  - `resolveManagedByEmptyState()` asked the resolved `create` affordance whether a
    `system` list should read "entries appear automatically" or show the New
    button. `system-data` now falls through to the generic empty state by
    definition; `engine-owned` keeps the automatic-entries copy.

  **Breaking (UI API):** `ManagedByBadge`'s `userActions` prop and the exported
  `ManagedByUserActions` interface are **removed**. The bucket alone selects the
  variant now, so the prop had become metadata nothing read — the exact defect the
  framework change exists to remove; shipping it as an accepted-but-ignored prop
  would have reproduced it one layer up. Drop the prop from call sites; no other
  change is needed.

  `MANAGED_BY_BUCKETS` and `ManagedByBucket` no longer contain `'system'`.

- 850033c: Stop offering the retired `action.shortcut` / `action.bulkEnabled` keys.

  `@objectstack/spec` 17 retired both as `retiredKey()` tombstones: authoring
  either one is a hard PARSE REJECTION, so a draft carrying it cannot be saved
  at all. The designer still offered controls for both — a "Bulk — apply to
  multiple selected rows" checkbox and a "Shortcut" text field — which meant the
  Studio action inspector let an author build a draft the platform would then
  refuse, with the rejection arriving later and nowhere near the checkbox.

  - **Action inspector**: both controls removed. The keys stay hidden from the
    fallback form (the server's live schema still advertises them, so dropping
    them from the hidden list would put the inputs straight back) — now under a
    `RETIRED_FIELDS` list that says why, so nobody "restores the missing
    control". `bulkEnabled`'s replacement is the list view's `bulkActions` /
    `bulkActionDefs`; `shortcut` has none.
  - **Action preview**: the `shortcut` and `bulk` pills are gone — they could
    only ever render for metadata the platform now refuses.
  - **`ActionEngine.registerActions`**: no longer harvests the two retired keys
    from authored metadata, which made two dead registration options look
    load-bearing. Both are still accepted on the single-action
    `registerAction(action, options)` overload, where a HOST passes them
    explicitly.

- b67be19: Flow designer: the `script` node authors a function call, and nothing else (framework#4343).

  **Breaking for authoring**, not for stored metadata: the `script` panel no longer
  offers `Action type`, `Template`, `Recipients`, `Template variables` or the inline
  `Code` body. What it offers is the function path — `Function` (required),
  `Inputs`, `Output variable` — shown unconditionally, since there is no action type
  left to gate them behind.

  framework#4343 retired those five keys because none of them ran. `actionType:
'email' | 'slack'` were logger-backed stubs: they wrote a log line, reported
  success, and delivered nothing under any configuration, with `template` /
  `recipients` / `variables` addressing a message no channel sent. Inline
  `config.script` was recognized and never executed — the built-in runtime has no
  server-side JS sandbox. Any other `actionType` value was a second spelling of
  `function`. Real delivery is a **`notify`** node (the messaging service: in-app
  inbox by default, email once `@objectstack/plugin-email` is installed); Slack is a
  **`connector_action`** with the Slack connector, or an `http` node posting to a
  webhook.

  **Stored nodes are never hidden.** All five keys keep a legacy render-only field
  (`__legacy__` gating — the rule this group already followed for the `code` / `sms`
  / `notification` action types objectui#3099 dropped), each labelled `(retired)`
  with its replacement in the help text. `os migrate meta --from 16` rewrites the
  metadata; a shorthand `actionType` moves into `function`, which is what it named.

  The flow canvas subtitle now leads with the function name (falling back to the
  retired keys so an unmigrated node is never blank), and the simulator says what a
  retired branch actually did rather than pretending it mocked a notification.

  The cross-repo reconciliation ledger spans the spec bump: on a spec that still
  publishes the retired branches it asserts only that the form offers nothing the
  executor ignores; on the spec that retires them (`SCRIPT_BUILTIN_ACTION_TYPES`
  disappearing is the discriminator) the full bidirectional comparison arms itself.
  Verified against a locally built framework spec: the converged panel reconciles
  clean in both directions.

- 022e4c3: Upgrade to `@objectstack/spec@17.0.0-rc.1`, stop offering the retired `wait` timeout fields (#3101), and route the newly-adopted `combo` chart type.

  **Breaking for authoring, and the reason to do it now**: the `wait` panel no longer offers
  `waitEventConfig.timeoutMs` or `.onTimeout`. Both are `retiredKey()` tombstones as of spec
  17.0.0-rc.1 (framework#4158), which means a value written there is **rejected at load** —
  so until this lands, Studio can produce flow metadata the author's own runtime refuses.
  That hazard opened the moment rc.1 published, independent of when this repo bumps.

  `wait` never had a timeout: `onTimeout` had zero readers, so neither `'fail'` nor
  `'continue'` ever happened, and `timeoutMs`'s only reader used it as the timer **duration**
  when `timerDuration` was absent. Use **Duration** — it accepts a bare number as
  milliseconds, making the old `timeoutMs: 60000` and `timerDuration: '60000'` the same wait.
  Stored flows are converted by framework's D2 conversion; the designer simply stops offering
  the entry. The two `zh` label overrides go with the fields.

  #3101 asked for this to ride along with the bump rather than land alone, and that is
  load-bearing: the sibling-block assertion is **bidirectional**, so deleting the fields
  against a spec that still declares them fails in the other direction.

  **`combo` is now a spec chart type** — the sole addition to `ChartTypeSchema` in rc.1 (19
  members → 20). It had been a renderer-local family the chart renderer derived from the
  series, so nothing classified it on the two surfaces that route a _spec_ chart type: a
  spec-valid `combo` fell through to the red "Unknown component type" panel on a dashboard
  and to the out-of-spec notice on a report. Both now route it
  (`widgetDispatch.SERIES_CHART_TYPES`, `planReportChart`). The renderer-local derivation
  stays — it is what makes an authored `type: 'combo'` render rather than merely validate.

  **Retired spec exports this repo bound to**, all removed upstream in spec 17.0.0:

  - `JoinStrategy` / `WindowFunction` (framework#4286 tombstoned `query.joins` and
    `query.windowFunctions`: no engine or driver ever read either on the query path). They
    were derived off the spec enums under objectstack#4115's "come off the spec enum, not a
    restatement" rule; with no enum left, `data-protocol.ts` now restates the members locally
    — verbatim from the last spec that published them — as the objectui query-AST vocabulary
    they have become. The AST itself is unchanged.
  - `PerformanceConfig`, retired with `dashboard.performance` (framework#3896). Nothing bound
    to it — `@object-ui/react`'s `usePerformance` declares its own interface and is untouched.
    The dashboard form is derived from the spec's own `dashboardForm`, so the field
    disappears from the inspector for free; its test now pins the absence.

  **Three inverted pins fired, and are recorded rather than resolved.** objectstack#4171's
  tripwires asserted that `NavigationItem`, `FormField` and `ConditionalValidation`'s branches
  still erased to `any`/`unknown` upstream — the premise that justified objectui keeping local
  declarations. rc.1 types them properly, so the assertions are inverted to state the new
  fact. The burn-down each one asks for — deriving those types from the spec — touches
  widely-used public types and is deliberately **not** bundled into a version bump; it is
  tracked in #3177. `JoinNode`'s pin is gone outright: the symbol no longer exists.

  **What the bump arms.** The reconciliation ledger's `subflow` and `decision` panels
  feature-detect their spec exports and had never actually run — rc.0 predates the exports
  (framework#4278). They now execute and pass. The `script` panel's full bidirectional check
  stays deliberately skipped: rc.1 predates framework#4343, so the retired dispatch branches
  are still contract keys there, and only the "offers nothing the executor ignores" direction
  is meaningful. It arms itself on the next rc.

- 726b89c: `@object-ui/types` stops declaring sixteen symbols under names `@objectstack/spec` owns (objectui#3156, objectstack#4115).

  Seven are now **derived** from the spec, nine are **renamed** to the local
  dialect they always were. Both halves remove the same hazard: a local
  declaration under a spec export's name reads as the spec's own definition to
  the next reader, so a copy that is merely _correct today_ is a planted premise
  tomorrow.

  **Derived** — the spec now supplies the keys, by reference:

  | symbol                   | derivation                                                                        |
  | :----------------------- | :-------------------------------------------------------------------------------- |
  | `ActionParam`            | `z.input<typeof ActionParamSchema>`, `type` widened to the local legacy spellings |
  | `CreateExportJobRequest` | `Omit<CreateExportJobInput, 'object'>` (`object` is the method argument)          |
  | `CreateExportJobResult`  | re-export from `@objectstack/spec/contracts`                                      |
  | `ImportRowResult`        | re-export from `@objectstack/spec/api`                                            |
  | `NavigationArea`         | spec keys, with `navigation` / `visible` pinned locally                           |
  | `NavigationAreaSchema`   | `specFieldsExcept(NavigationAreaSchema.shape, …)`                                 |
  | `Theme`                  | re-export of the spec's `ThemeInput` (the authoring shape)                        |
  | `ExportJobFormat`        | re-export of the spec's `ExportFormat`                                            |

  Four of these close real gaps rather than tidy names. `ActionParam` never
  declared `reference` — the key `resolveActionParams()` actually reads for an
  inline lookup target — nor `defaultFromRow`, which the metadata designer's own
  inspector writes; it also narrowed `visible` to a bare string although the
  resolver has always accepted the `{ dialect, source }` envelope too.
  `CreateExportJobResult.createdAt` and `ImportRowResult.action` were optional
  here and required by the server, leaving every consumer a branch that could
  never run. And `NavigationArea`'s `id` now carries the spec's own length rule
  instead of accepting any string.

  **Renamed** — same word, different concept:

  | was                | now                      | why                                                                                                                            |
  | :----------------- | :----------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
  | `FileMetadata`     | `UploadedFileMetadata`   | field-VALUE payload (`url`, `original_name`), not the storage file record                                                      |
  | `GestureType`      | `TouchGestureType`       | direction-fused (`swipe-left`), not the spec's type+direction pair                                                             |
  | `GestureConfig`    | `TouchGestureConfig`     | gesture→`action` binding, not per-gesture tuning                                                                               |
  | `OfflineConfig`    | `PWAOfflineConfig`       | service-worker route caching, not the offline data/sync model                                                                  |
  | `PageRegion`       | `PageNodeRegion`         | region of the renderer page NODE, holding `SchemaNode`s                                                                        |
  | `PageRegionSchema` | `PageNodeRegionSchema`   | zod twin of the above                                                                                                          |
  | `ResponsiveConfig` | `MobileResponsiveConfig` | mobile box config, not the spec's SDUI grid contract                                                                           |
  | `WidgetManifest`   | `RuntimeWidgetManifest`  | SDUI component manifest, not the field-widget plugin manifest                                                                  |
  | `WidgetSource`     | `RuntimeWidgetSource`    | `module`/`inline`/`registry` loader union — and its `inline` carries a resolved component where the spec's carries source code |

  **Migration**: the old names are gone, not deprecated — an alias would preserve
  exactly the ambiguity being removed. Import the new name; nothing about the
  shapes changed. `@object-ui/types` already re-exports the spec's own
  `SpecResponsiveConfig`, and `@object-ui/react`'s `useOffline` config remains the
  spec-shaped `OfflineConfig`, so both concepts stay reachable under
  distinguishable names.

  Each rename carries a bidirectional tripwire
  (`packages/types/src/__tests__/page-nav-misc-spec-parity.test.ts`): it fails if
  the spec ever claims the new name, and also if the spec retires the old one —
  at which point the natural name can be taken back rather than the workaround
  outliving its reason.

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

- d9668a7: Honor the server's declared percent scale, so a ratio of exactly 1 renders as 100.0% (#3136)

  A dataset measure declared `format: '0.0%'` rendered every ratio below 1
  correctly and got the single most consequential one wrong: a rate of exactly
  `1` printed as **`1.0%`**. On an SLA / pass-rate dashboard that turns
  "everything met the SLA" into "1% met the SLA", on both surfaces the issue
  names — the KPI card and the dataset-bound table (they share `formatMeasure`).

  The cause was never a bad multiplier; it was a missing fact. `formatMeasure`
  scaled by magnitude — `percentDisplayValue` multiplies by 100 only strictly
  inside `(-1, 1)` — because the column arrived with a `%` format string and
  nothing saying what scale its numbers were on. That guess is undecidable at
  exactly 1, which is both a full-compliance ratio ("100%") and one percentage
  point ("1%"), and it resolved to the reading almost nobody means.

  The server now answers the question instead (framework: `percentScaleOf` +
  `AnalyticsResult.fields[].percentScale`, the sibling of the ADR-0053 currency
  chain): a `derived: { op: 'ratio' }` measure is a `fraction` by definition, and
  a measure over a `percent` field inherits that field's scale. `formatMeasure`
  takes the declared scale as a fourth argument and, when present, scales by it —
  `fraction` ×100, `whole` verbatim — instead of inspecting the value. Every
  dataset-bound call site passes the column's `percentScale`: the dashboard
  metric/table/pivot cells, the report renderer's cells, totals and KPI, and the
  dataset preview.

  `percentDisplayValue` is untouched and still the fallback for a column that
  arrives without the annotation (an older server, or a non-dataset percent cell
  in a list view), so nothing that renders correctly today changes.

- 14f6999: Datasource preview stops reporting read replicas

  `DatasourcePreview` rendered a "2 read replicas" pill from
  `datasource.readReplicas`. That key is retired in `@objectstack/spec` 17
  (objectstack#4468): nothing in the platform ever opened a replica connection —
  no driver reads the key and no query path splits reads from writes — so the
  pill confirmed a configuration that did not exist.

  It is worth being precise about what the pill did wrong, because a preview
  panel echoing the draft back is normally harmless. This one did not echo, it
  concluded: an author who configured replicas, saved, and saw the pill light up
  got the platform telling them it had understood. It was the only surface in
  either repo that acknowledged the key at all, which made it the whole of the
  evidence that the feature worked. `packages/spec/liveness/README.md` has the
  standing rule — an authoring or preview renderer is never a runtime consumer —
  and a 2026-06 sweep that classified 13 properties on preview-renderer evidence
  alone was later found wrong on 10 of them.

  Read-replica routing does not exist yet; it is tracked as a feature request
  rather than reflected in the UI as though it shipped.

- efd7767: Say what the Decision inspector actually does: the default path is the edge marker, not the branch.

  Two help strings described mechanisms the engine does not have.

  The **Branches** editor said a branch whose expression is `"true"` _is_ the
  default/else path. It is how you **ask** for one — `FlowEdgeInspector.applyBranch()`
  turns such a branch into `isDefault: true` on the out-edge it wires, and the marker
  on that edge is what routes. Conflating the two is the reading that let
  objectstack-ai/objectstack#4414 ship a decision whose guard did not guard, and it is
  worth being exact about now that `isDefault` is finally enforced: the key had **zero
  readers** in the engine until then, so this designer had been writing a marker
  nothing honoured, and every Studio "default/else" edge ran unconditionally alongside
  whichever branch matched. The help also now states that branches are tried in order
  and that the expression is bare CEL — a braced predicate there is a build failure
  since objectstack-ai/objectstack#4439.

  The legacy single **Condition** field said _"Prefer Branches above"_, which reads as
  "this works, but the other is better". It does not work at all: the decision executor
  never reads `config.condition`. The engine honours that key only on a Start node, as
  the trigger gate, and `os validate` now reports it as `flow-inert-node-condition`.
  The field stays render-only (its `__legacy__` controller never matches, so it is not
  offered for new authoring) so a stored value is not invisible — but the help says it
  is inert and where the predicate belongs instead.

  Text only; no behaviour change on this side.

- 5426cc7: Collapse app-shell's `DecisionOutputDef` to a plain re-export of the spec's
  (objectstack#4562).

  The local type was `interface DecisionOutputDef extends SpecDecisionOutputDef
{ required?: boolean }` — a structural derivation carrying ONE documented
  divergence, because the server enforced `required` (`decide()` rejects a blank
  required output before any write) while `@objectstack/spec` did not model it.
  The spec adopted `required` in cd6b9f202 and pinned it at the schema level in
  objectstack#4561, and this repo now resolves a spec that has it
  (`@objectstack/spec@17.0.0-rc.1`, #3178). The addition is therefore redundant
  and the type becomes `export type DecisionOutputDef = SpecDecisionOutputDef`.

  No behavior change and no API change: the symbol is internal to this package
  (it is not re-exported from `src/index.ts`), the resolved shape is identical
  key-for-key, and `decisionOutputParams()` still reads `d.required` — now off
  the spec's own field.

  The module TSDoc still asserted "the spec does not model it yet", which was
  stale and actively misleading — an agent reading it would take the divergence
  as ground truth and build on it, which is the objectstack#4115 failure class
  this file's own tripwires exist to prevent. It now states the current truth.

  The parity pin in `__tests__/spec-symbol-parity.test.ts` is inverted
  accordingly: `Exclude<keyof DecisionOutputDef, keyof SpecDecisionOutputDef>`
  is asserted `never` rather than `'required'`, plus an exact-identity
  assertion, so a future local addition to this symbol cannot slip in
  undocumented. The `type`-is-the-spec's-closed-enum pin is unchanged — that
  narrowing is still what stops a typo'd picker kind from silently degrading to
  a raw record-id text box (objectui#2955).

  Note that this pin, like every other type-level assertion in that file, is not
  yet compiled by any gate — package tsconfigs exclude `**/*.test.ts`, so
  nothing type-checks it. It was verified by compiling the file explicitly. See
  objectui#3181.

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

- d9cdda6: fix(approvals): record-header Reject fires after ONE dialog again (objectui#3126)

  Since #2961 made the record header's decision inputs live (`actionParams`),
  the Reject action carried BOTH `confirmText` and a collectable comment param.
  The ActionRunner chains confirmation before param collection, so rejecting
  queued two dialogs: the approver answered "Reject this approval request? →
  Continue", the alertdialog closed — and no request fired, because it was
  waiting on a second, unexpected "Action parameters / Comment (optional)"
  dialog. Anyone on the rc.0 contract (one confirm → request) read that as a
  silent no-op: zero network traffic, no toast, the flow stuck pending. Approve
  never declared `confirmText`, which is why it kept working on the same node.

  The Reject action no longer declares `confirmText`. The param dialog is the
  confirmation surface: it is titled by the action ("Reject"), carries the old
  confirm question as its description (same `approvals.rejectConfirm` i18n key,
  so every locale keeps its translation), collects the optional comment and any
  declared decision outputs, and nothing is sent until its own Confirm — one
  decision, one dialog, matching Approve and the Approval Center.

- Updated dependencies [4ae0ac4]
- Updated dependencies [696e3c1]
- Updated dependencies [bca45cc]
- Updated dependencies [a889e31]
- Updated dependencies [09d30a4]
- Updated dependencies [4bf612c]
- Updated dependencies [335041c]
- Updated dependencies [b414983]
- Updated dependencies [256f8cc]
- Updated dependencies [c5ccbd5]
- Updated dependencies [d9668a7]
- Updated dependencies [4b470b9]
- Updated dependencies [785b8a5]
- Updated dependencies [cb82705]
- Updated dependencies [f572849]
- Updated dependencies [4a51e77]
- Updated dependencies [f6e8d78]
- Updated dependencies [ea96284]
- Updated dependencies [07de7be]
- Updated dependencies [d3584c6]
- Updated dependencies [6d868e1]
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
  - @object-ui/auth@17.2.0
  - @object-ui/data-objectstack@17.2.0
  - @object-ui/fields@17.2.0
  - @object-ui/collaboration@17.2.0
  - @object-ui/layout@17.2.0
  - @object-ui/providers@17.2.0
  - @object-ui/permissions@17.2.0
  - @object-ui/plugin-editor@17.2.0

## 17.1.0

### Minor Changes

- 9e7349e: **`target` is the only action handler slot — the `execute` alias is gone from the renderer (framework#3856).**

  `ActionRunner.executeScript` read `action.target || action.execute`. That fallback
  is unreachable against `@objectstack/spec` 17: `execute` is now a tombstoned key
  (framework#3855) that the parser **rejects** with the rename prescription, so no
  parsed action can carry it and the `||` could only ever yield `target`. Verified
  against 17.0.0-rc.0 — an action declaring `execute` fails `ActionSchema.safeParse`,
  and a `target` action's parsed output has no `execute` key at all.

  Deleted rather than left as harmless residue: two handler slots is what let one
  action run one script server-side and a different one client-side (framework#3713,
  where this renderer preferred the alias while the spec transform preferred
  `target`). A dead slot still reads as a live contract to the next maintainer.

  `execute` is also **removed from the types**, which is the part that had never
  landed. framework#3856 predicted a compile error here; there wasn't one, because
  neither reader was typed against the spec's `z.infer`:

  - `@object-ui/types` `ActionSchema` hand-declared `execute?: string`. Removed, so
    `execute: '…'` now fails `tsc` at the authoring site (TS2353).
  - `@object-ui/core` `ActionDef` hand-declared it too. Removed — but `ActionDef`
    carries a `[key: string]: any` index signature, so stale hand-authored metadata
    that never passed through the parser still compiles. For that path
    `executeScript` now returns the rename prescription instead of a bare
    "No script provided", matching the spec tombstone's rule that removing an
    authorable key must be audible: silently binding no handler is the
    "Mark Done does nothing" shape (framework#2169).

  The four action renderers (`action:button`, `action:icon`, `action:menu`,
  `action:group`) no longer forward `execute` into the runner, and Studio's
  `ActionPreview` no longer falls back to it — previewing an alias-only draft as
  "bound" contradicted the parse that rejects it on save.

  Requires `@objectstack/spec` 17. Metadata still on the alias is rewritten by
  `os migrate meta --from 16`.

- 1c07e6a: **[ADR-0110 D1] The server-action URL identifies an action by `name`, not `target`.**

  `serverActionHandler` posted `action.target || action.name` — the handler's
  registration KEY — to `/api/v1/actions/:object/:action`. For a target-bound
  action (`{ name: 'complete_task', target: 'completeTask' }`) the server resolves
  the declaration by name, so posting the target meant it resolved **no**
  declaration and silently skipped both the ADR-0066 D4 capability gate and the
  ADR-0104 param contract: a Console button correctly hidden from users without
  the capability posted to an endpoint that accepted anyone (framework#3935).

  `target` is a binding expression — a handler key here, a flow id for
  `type: 'flow'`, a URL for `type: 'url'`, `${param.X}`-interpolatable, and
  legitimately non-unique — so it can never identify a declaration. The URL now
  carries `action.name`, and the server derives the handler key from the
  declaration it resolves. An action with no `name` is refused rather than
  falling back to `target`.

  `apiHandler` and `flowHandler` are unchanged: their `target` genuinely is the
  endpoint / flow id they dispatch on.

  Requires a framework with the ADR-0110 handler-key rotation (protocol 17); the
  two ship in lockstep.

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

- 2bb1809: feat(app-shell): the console mounts the notification surfaces, so `displayType` works there (#3014 follow-up)

  #3071 gave each spec `NotificationTypeSchema` member its own presentation, but no
  host mounted `NotificationProvider` — the capability existed and the console
  could not reach it. `ConsoleShell` now mounts the provider and the surfaces with
  a single global home; `ConsoleLayout` mounts the one that belongs in the content
  area:

  | `displayType` | Surface                                        | Mounted by                                           |
  | ------------- | ---------------------------------------------- | ---------------------------------------------------- |
  | `toast`       | sonner, via the new `presentNotificationToast` | `ConsoleShell`                                       |
  | `snackbar`    | `<NotificationSnackbar />`                     | `ConsoleShell`                                       |
  | `alert`       | `<NotificationAlerts />`                       | `ConsoleShell`                                       |
  | `banner`      | `<NotificationBanners />`                      | `ConsoleLayout`, beside the draft / unpublished bars |
  | `inline`      | `<NotificationInline scope="…" />`             | the raising surface — **not** mounted globally       |

  `inline` is left out deliberately: rendering in place at the raiser is the whole
  difference between it and a banner, so a global inline outlet would collapse the
  two again.

  `presentNotificationToast` is the single place a notification becomes a sonner
  call — severity → variant, `duration: 0` → `Infinity` (the contract's
  "persistent", which passed through raw would have made the toast vanish on the
  next tick), first action → the one action slot sonner offers, an absent duration
  left to the `ConsoleToaster` default rather than reinvented. Its severity table
  is `Record<NotificationSeverityLevel, …>`, so a new spec severity fails
  type-check instead of silently rendering neutral.

  The banners go through `ConsoleNotificationBanners`, which gates on
  `useHasNotificationProvider()`. `ConsoleShell` is deliberately a set of
  composable pieces a host assembles in its own `App.tsx`, so `ConsoleLayout` can
  legitimately render without the provider above it — and `useNotifications()`
  throws there, which would white-screen the whole app instead of simply showing
  no banners.

  Both pieces are exported (`presentNotificationToast`, `ConsoleNotificationBanners`)
  for hand-assembled shells. The provider's `defaultDuration` matches
  `ConsoleToaster`'s 4s, so a snackbar and a toast raised together disappear
  together.

- 6937572: fix(approvals): decision outputs reach both decision surfaces (objectui#2955, framework#3447 P2)

  An approval node can ask the approver for structured data with their decision
  (`decisionOutputs`) — typically to route the next node's approvers, which the
  flow then reads as `vars.<nodeId>.<key>`. The server has shipped this since
  framework#3447 P2 and surfaces the typed declaration on the request row
  (`decision_output_defs`), but neither Console decision surface actually
  delivered it.

  **The Approval Center asked for a record id instead of showing a picker.** The
  typed pickers landed in objectui#2831 and the drawer really did synthesize a
  `lookup` param per declared output — but it spelled the picker target
  `referenceTo`, and `resolveActionParams()` (which every collected param passes
  through before the dialog renders it) rebuilds an inline param from a fixed key
  list, reading the target from `reference`. The target was dropped there, and
  `paramToField()` degrades a targetless picker to a plain text input — so a
  `position` output rendered as a box labelled "<label> 的记录 ID". The approver
  had to go find the record id somewhere else and paste it back. `user`-typed
  outputs were unaffected (that widget needs no target), which is why this
  survived: `department` / `position` / `team` were the broken three.

  **The record header decided without collecting anything at all.** Approve /
  Reject on the detail page shipped their inputs under `collectParams` — a key
  nothing in the codebase reads (`ActionRunner` collects from `actionParams`).
  No dialog had opened on that surface since the ADR-0019 rework: the approver's
  comment was silently dropped on every record-page decision, and a node
  declaring `decisionOutputs` got no inputs either, so the flow resumed with
  `vars.<node>.<key>` missing — the next node's `expression` approver then failed
  with `EXPRESSION_FAILED`, or fell through to `onEmptyApprovers`, with nothing
  surfaced to the approver or the flow author. The header now collects through
  `actionParams`, renders the node's declared outputs with the same pickers the
  Approval Center uses, and posts them under `outputs` on the decide call. The
  comment box works again as a side effect, and it is a real textarea (the param
  resolver drops `multiline`, so the intent has to ride the type).

  The widget mapping now lives in one place (`utils/decisionOutputParams`), so
  the two surfaces cannot drift apart again, and the round trip through param
  resolution — the stage that actually broke — is pinned by tests.

  **And a `required` output is now enforced at the field.** The spec grew
  `decisionOutputs[].required` (the platform half of this issue, shipping in
  `@objectstack/spec` + `@objectstack/plugin-approvals`) — the server rejects an
  approve carrying no value for one, before any write. The dialog marks those params
  required, so the approver is stopped at the empty field with the Confirm button
  refusing rather than by a 400 after the round trip. Only on APPROVE: the server
  never requires them on a reject (the run leaves down the reject edge, where
  nothing reads the outputs), so the two dialogs differ in exactly that flag. On a
  backend that predates the field nothing is required, which is the behavior above
  unchanged.

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

- 4a74ea6: feat(studio): a page button created in Studio can be given an action

  `element:button` renders inert without an `action`, and Studio had no way to add
  one. The inspector's curated `BLOCK_CONFIG` entry listed `label`, `variant`,
  `size`, `icon` — no `action` — and the generic "Advanced" section is not a
  fallback for that, because it enumerates the keys the block **already has**
  (`Object.keys(blockProps)`). So it could edit an `action` authored in source, and
  never add one to a button dragged from the palette.

  Adds a `json` field kind — the same `InspectorJsonField` editor Advanced uses,
  reachable for a property that does not exist yet — and an `action` field on
  `element:button` carrying `{ "type": "url", "target": "/environments" }` as its
  placeholder. An empty JSON textarea is otherwise the whole affordance, so
  `placeholder` is now threaded through to the textarea and asserted for every
  `json` field.

  Raw JSON rather than typed sub-fields deliberately: the spec declares the prop as
  `InlineActionSchema` (objectstack-ai/objectstack#4135), and the inspector cannot
  render a nested schema as fields yet. A JSON box the author can actually use
  beats a curated form that models a fraction of the shape.

  Refs objectstack-ai/objectui#2997

- 5319bf1: feat(views): the list toolbar speaks one vocabulary — `userActions` (#2890 scope A step 3)

  The seven bare `show*` toolbar flags fold into the spec's `userActions`, and the
  renderer reads nothing else. `showDescription` folds into
  `appearance.showDescription` at the same boundary.

  | legacy                                                    | canonical                                                 |
  | :-------------------------------------------------------- | :-------------------------------------------------------- |
  | `showSearch` / `showSort` / `showFilters` / `showDensity` | `userActions.search` / `.sort` / `.filter` / `.rowHeight` |
  | `showGroup` / `showHideFields` / `showColor`              | `userActions.group` / `.hideFields` / `.rowColor`         |
  | `showDescription`                                         | `appearance.showDescription`                              |

  **The last three are new keys, and they close a capability hole rather than just
  renaming one.** `@objectstack/spec`'s `UserActionsConfigSchema` documents itself
  as "which interactive actions are available to users in the view toolbar — each
  boolean toggles the corresponding toolbar element on/off", and already carries
  `rowHeight` (objectui's `showDensity` under its spec name). Grouping, column
  visibility and row coloring are the same kind of toggle: the spec models all
  three as _configuration_ (`grouping`, `hiddenFields`, `rowColor`) but has no
  "may the user change it" switch for any of them.

  The consequence was visible in the product. With no `userActions` key to read,
  the two list surfaces **hardcoded opposite policies**: `InterfaceListPage` (the
  author-curated interface page) pinned all three OFF, `ObjectDataPage` pinned two
  ON — and an interface-page author could not turn grouping back on for end users
  at all. Both surfaces now express their policy as `userActions` defaults, which
  an author can override.

  Until the keys land in `@objectstack/spec`, `@object-ui/types` carries them as a
  documented `.extend()` on `UserActionsConfigSchema` (the same shape
  `ListColumnSchema` uses while waiting on objectstack#3761); it collapses into a
  plain re-export once they do. Note the spec schema is not `.strict()`, so before
  this an author writing `userActions: { group: false }` had it **silently
  stripped** — valid on parse, no effect at render.

  Defaults are unchanged and deliberately asymmetric, matching what these flags
  have always done: `search` / `sort` / `filter` / `rowHeight` / `group` are on
  unless turned off; `hideFields` / `rowColor` are off unless turned on. Making
  them uniform would grow two buttons on every existing view, so it is left as its
  own product decision rather than smuggled into a vocabulary migration.

  Also drops a dead relay in app-shell's `ObjectView`, which forwarded
  `showDescription` onto the node although `ListView` has only ever read
  `appearance.showDescription`.

- a136322: **[objectstack#3959] A `type: 'modal'` action is client-side only — the server fallthrough is removed.**

  `modalActionHandler` fell through to `serverActionHandler` when the action's
  target resolved to neither a page nor an object, documented as "how a modal
  action bound to `engine.registerAction(...)` still runs". It never ran: the
  framework's `headlessActionTypeError` rejects `type: 'modal'` over REST with a
  400, because a modal action has no server dispatch. The fallthrough only turned
  an authoring mistake — a target naming no page — into a confusing round-trip,
  and it let apps ship handlers that no declaration could address (app-todo's
  `deferTask` / `setReminder` sat dead for exactly this reason).

  An unresolvable target is now reported as what it is, naming the action, the
  dud target, and the way out. To collect input and then run server-side,
  declare `type: 'script'` with `params` — the runner collects the same dialog
  and the handler runs with those values.

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

- df613fa: fix(notifications): the spec `icon` is read instead of stored and ignored (#3014 follow-up)

  `NotificationSchema.icon` — "Icon name override" — reached `NotificationItem` and
  stopped there. Every surface drew the severity icon, so an author writing
  `icon: 'rocket'` got the success checkmark. Same shape as the `displayType`
  collapse #3071 fixed: a value that validates, is carried, and renders nothing.

  All five presentations now resolve it through one rule (`notificationIcon`): a
  declared Lucide name — kebab-case or PascalCase — replaces the severity icon;
  anything else falls back to it. That includes the console's sonner toast, so the
  override behaves identically on a toast, a banner, a snackbar, an alert and an
  inline message.

  **The fallback is the interesting part.** `getLazyIcon` degrades an unknown name
  to a `Database` glyph, which is right for a data-shaped schema slot and wrong
  here — on an error notification it swaps a meaningful icon for a meaningless one.
  So the name is checked first, via a new `isLucideIconName` export, and a typo
  costs the author their override and nothing more.

- c7c5294: feat(flow-designer): the script node's form authors what the executor runs — framework#4278

  The `script` flow node is one of five builtins whose designer form lives only
  in this package's hand-written `FLOW_NODE_CONFIG` table (the engine publishes
  no `configSchema` for them, deliberately), and nothing reconciled that table
  against the executor. It had drifted user-visibly: of the four `actionType`
  options offered, `code` was a recognized no-op (the built-in runtime has no
  server-side JS sandbox) and `sms` / `notification` failed every run (neither
  is a built-in — they resolve as function names); the "Output variables"
  (plural) field was read by nothing; and the one path that runs real logic —
  `function` + `inputs` + `outputVariable` — could not be authored at all.

  - The `actionType` select now offers **Call function** (default) / **Email** /
    **Slack**, mirroring the executor's dispatch set
    (`SCRIPT_BUILTIN_ACTION_TYPES` + the `invoke_function` marker). The function
    path fields (`function`, `inputs`, `outputVariable`) are first-class.
  - The inline `script` body becomes render-only: hidden for new nodes (its help
    states it is NOT executed and steers to a registered function), still shown
    whenever a stored node carries one. The dead plural `outputVariables` field
    is removed; stored values surface in the Advanced (JSON) block.
  - A scalar select whose stored value was dropped from the options now renders
    it as a flagged "`<value> (deprecated)`" entry instead of blanking it —
    the same rule FlowObjectListField already applied to select cells.
  - The data picker (`flow-scope`) and the flow simulator stop pretending the
    legacy `outputVariables[]` list binds variables — the engine never binds
    those names; only the singular `outputVariable` does.
  - New reconciliation test: the hand-written `script` / `subflow` / `decision`
    groups are compared bidirectionally against the executor-derived config
    contracts `@objectstack/spec/automation` publishes for exactly this purpose
    (framework#4278), and the `wait` / `connector_action` / `boundary_event`
    groups against the `FlowNodeSchema` sibling blocks. The spec-export panels
    feature-detect and arm themselves on the next `@objectstack/spec` bump.

### Patch Changes

- 4db7eb3: fix(actions): a failed server action no longer reports as success (green toast) — objectstack#3913

  `useConsoleActionRuntime.serverActionHandler` — the console's **main** action
  path (list toolbars, row actions, page actions) — decided success from
  `res.ok` and the OUTER envelope only:

  ```ts
  if (!res.ok || (json && json.success === false)) {
    /* failure */
  }
  ```

  A server older than objectstack#3913 reports a handler failure as HTTP **200**
  with the failure nested one level down:

  ```json
  {
    "success": true,
    "data": {
      "success": false,
      "error": "Action 'log_call' on object '*' not found"
    }
  }
  ```

  Both guards pass, so the action was reported as completed: the ActionRunner
  fired its green "completed" toast, the list refreshed, and the real error was
  swallowed. `RecordDetailView`'s copy of the same handler already inspected the
  inner envelope; the shared runtime now does too, and the marketplace install
  call (`marketplaceApi.installPackage`), which had the identical hole and could
  report a package as installed when it was not.

  Current servers answer a failed action with a real HTTP status, which `!res.ok`
  catches first — the inner-envelope check is what keeps the console honest
  against a runtime that has not been upgraded yet.

  **Also fixed:** with objectstack#3913 the failure body is
  `{success: false, error: {message, code}}`. `RecordDetailView` read `json?.error`
  raw and would have handed that **object** to `toast.error()` as a React child,
  crashing the page (React #31) — the exact failure the console runtime's
  `errorDetail` helper existed to prevent. That helper is now a shared util
  (`utils/actionErrorDetail`) and both call sites go through it, so a nested
  `{message}` always resolves to a string.

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

- 52ec79d: fix(actions): one source for the `/actions` envelope rule, and `redirectUrl` finally works (objectstack#3913 follow-up)

  The `/actions` response wraps **twice** — the route's own `{success, data}`
  inside the dispatcher's — and a failure has three shapes, only one of which
  `res.ok` catches. That rule was hand-rolled in two places
  (`useConsoleActionRuntime.serverActionHandler` and `RecordDetailView`'s copy of
  the same handler), and the two drifted. Four hand-rolled copies produced three
  distinct bugs:

  1. **A failed action reported as success** — the copy that didn't inspect the
     inner envelope was the console's _main_ action path, so a failure fired the
     green "completed" toast on every list and page surface (fixed in #2963).
  2. **React #31 crash** — the nested `{message, code}` object handed to
     `toast.error()` as a React child (fixed in #2963).
  3. **`redirectUrl` never fired** — _fixed here._

  Both handlers now call `interpretActionResponse` from `utils/actionResponse`,
  and a ratchet test (`actions-envelope.ratchet.test.ts`) fails if a third
  hand-rolled copy appears.

  ## `redirectUrl` was unreachable

  A script action can return `{ redirectUrl: 'https://…' }` to ask the console to
  open a URL. Both handlers read it off `body.data` — the **action** envelope,
  one level too shallow:

  ```
  { success: true, data: { success: true, data: { redirectUrl: '…' } } }
                   ^^^^ read here          ^^^^ actually lives here
  ```

  `body.data` is constructed by the server and only ever holds `success` / `data`,
  so `body.data.redirectUrl` was **always** undefined — the convention could never
  fire, and no handler could work around it. An `opensInNewTab` action was worse
  than a no-op: it pre-opens a tab on a spinner page for popup-blocker safety, and
  with no redirect to drive it to, that tab sat on the spinner forever.

  `ActionResult.data` still carries the **action envelope**, unchanged — some
  `resultDialog` field paths in the wild may have adapted to that depth, so it is
  not silently re-pointed here.

- aecc934: fix(actions): read objectstack#3962's single-wrapped /actions responses; legacy double wrap detected narrowly

  objectstack#3962 made `/actions` failures speak HTTP (400 rejection / 404 / 403
  / 503 / 500) and single-wrapped success — `body.data` IS the handler's return
  value. `interpretActionResponse` / `readActionPayload` now treat that as the
  primary shape: the pre-#3962 double envelope is detected NARROWLY (a boolean
  `success` and no keys beyond the envelope's own) and unwrapped for older
  runtimes, so a handler value that merely contains a `success` key is
  handler-owned and passes through untouched. `ActionResult.data`'s depth quirk
  self-heals on #3962 servers.

- 9b773f9: fix(analytics): a missing analytics capability no longer renders as an empty KPI — objectstack#3891

  The framework retired its degraded in-kernel analytics fallback (objectstack#3891):
  it dropped the caller's RLS/tenant scope and ignored the contract filter, so it
  answered `200` with over-broad numbers. `@objectstack/service-analytics` is now
  the only implementation, and a deployment without it answers `404` on
  `/analytics/query` (objectstack#4019 stops mounting the routes) or `501` on
  `/analytics/dataset/query`.

  Three things were wrong on this side of that boundary:

  **① A KPI on such a deployment rendered a confident zero.** `aggregate()`'s
  `catch` promises a client-side fallback, and the fallback is correct — but the
  adapter never got there for the most likely failure. It now classifies the
  failure (`classifyAnalyticsFailure`) instead of treating every error alike:
  capability-absent (404/501) degrades to a client-side aggregate over a
  **server-scoped** `find()` — same rows, same filter, RLS still applied — and
  says so **once per adapter** in the console, naming the package to install,
  rather than once per widget or not at all.

  **② A rejected query was answered with plausible numbers.** The framework
  validates `/analytics/query` at the entry now (objectstack#4010), so a `400
VALIDATION_FAILED` means _this adapter_ sent an off-contract body. Degrading
  there would bury our own bug behind output from a different code path — the
  misdirection objectstack#3878 documented. It now throws
  `AnalyticsQueryRejectedError` and never falls back. Transient failures (5xx,
  network) degrade exactly as before.

  **③ The dataset preview blamed the author for a missing capability.**
  `queryDataset` mapped `501`/`404` to `Dataset query failed: 501 Not Implemented
— …`; it now throws the typed `AnalyticsNotInstalledError`
  (`code: 'ANALYTICS_NOT_INSTALLED'`) with a message a UI can render verbatim, and
  `DatasetPreview` shows it as a "analytics capability not installed" empty state
  instead of a red error banner. A real compile error (e.g. "relationship not
  declared in include") keeps its server detail and its banner.

  New exports from `@object-ui/data-objectstack`: `AnalyticsNotInstalledError`,
  `AnalyticsQueryRejectedError`, `isAnalyticsNotInstalledError`,
  `classifyAnalyticsFailure`.

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

- 19e9fa0: fix(grid): drop the `bulkEnabled` derivation — the spec key is a tombstone

  Follow-up to objectui#3002 / #3031. That change folded two sources into the
  selection bar: a view's `bulkActions` names resolved against
  `objectDef.actions`, and object actions declaring `ActionSchema.bulkEnabled`.
  The second source is dead.

  `@objectstack/spec` 17.0.0 retired `action.bulkEnabled` in the #3896 audit
  close-out (framework#4054, landed while #3031 was in flight — the spec source
  still carried the key when its design was settled). It is now a `retiredKey()`
  tombstone, so it is not merely ignored: `defineStack` **hard-rejects** a config
  that sets it, and the backend refuses to boot. Browser verification against a
  real showcase backend is what surfaced this — the derivation branch could never
  run, and #3031's changeset pointed authors at a key that breaks their app.

  The tombstone's own prescription is the path that survives:

  > the multi-select toolbar is driven by the LIST VIEW's `bulkActions` /
  > `bulkActionDefs`, never by this flag … declare the action in the view's
  > `bulkActions` instead.

  So `resolveBulkActions` now folds exactly two vocabularies — inline-authored
  `bulkActionDefs`, and `bulkActions` names promoted to their declared object
  action — which is what #3031's other half already did and what the end-to-end
  run exercised: naming `showcase_mark_done` in the view's `bulkActions` issued
  one `POST /api/v1/actions/showcase_task/showcase_mark_done` per selected
  record (10/10 → `done: true, progress: 100` server-side). Everything downstream
  of the fold is unchanged: promoted defs still carry the action's label, icon,
  `visible`, confirm text and params; still run through `BulkActionDialog`
  (params → confirm → progress → result); still dispatch per record with
  `_rowRecord` attached; still attribute failures per record.

  A stale `bulkEnabled: true` on an object action is now inert rather than a
  second path into the bar. Note tsc cannot catch this class of drift here — the
  fold reads a loosely-typed `NamedActionDef` with an index signature, so the
  retired key never surfaces as `never`.

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

- d132bb5: fix(flow-designer): a published `configSchema` can no longer delete a node's sibling-block editors — objectstack#4045

  `FlowNodeInspector` resolved its form as `serverFields ?? fieldsForNodeType(type)`,
  so an engine-published `configSchema` **replaced the hand-written field group
  wholesale**. But a `configSchema` describes `node.config` and nothing else
  (ADR-0018), and `jsonSchemaToFlowFields` roots every field it emits at
  `['config', key]` — so the replacement silently deleted every editor rooted
  anywhere else.

  18 fields sit in that blast radius: `connectorConfig.*` (3), `waitEventConfig.*`
  (5), `boundaryConfig.*` (6) and the top-level `timeoutMs` (4). For `wait` and
  `boundary_event` those blocks are the node's **entire** contract.

  This already happened once. `connector_action`'s descriptor published a schema
  declaring `connectorId` / `actionId` / `input` as CONFIG keys, so against a live
  backend the generated form replaced the `connectorConfig` group — connector and
  action pickers included — and an author configuring a connector node in Studio
  wrote the trio to `node.config`, which the executor never reads. The node then
  refused to dispatch with `connectorConfig.connectorId and .actionId are
required`. objectstack#4210 retired that schema on the server; this change is
  what stops the next mis-rooted one from doing the same to `wait` or
  `boundary_event`.

  New `mergeServerFlowFields()` splits the resolution by root:

  - **the server owns the config-rooted fields** — it is the authority on what the
    executor actually reads, so its set replaces the hand-written config fields
    rather than merging with them (a stale client key must not linger);
  - **non-config fields are always preserved** from the hand-written group, in
    declared order;
  - a server field duplicating a preserved sibling key is **dropped**, not rendered
    twice — two editors for one value, one of them writing where nothing reads, is
    the same bug wearing a different hat.

  With no published schema the hand-written group is still used whole, unchanged.

  Verified by mutation: reverting to the old replacement turns all three new
  assertions red, one of which replays the `connector_action` incident directly.

- 4874117: fix(grid): an object-declared bulk action runs over the selected records — objectui#3002

  A list view declaring `bulkActions: ['push_down']` rendered a selection-bar
  button that never ran the action: `ObjectGrid` dispatched the legacy form as
  `{ type: <action name>, params: { records } }`, putting the action _name_ in the
  runner's `type` slot. Since objectui#2996 that fails loudly instead of
  green-toasting a no-op, but it still never ran. Nor could the object declare a
  bulk action to resolve against — `bulkActionDefs` was passed through from the
  view JSON verbatim, never derived from `objectDef.actions` the way
  `rowActionDefs` is derived from `locations: ['list_item']`.

  **No spec change was needed.** `ActionSchema.bulkEnabled` — _"Whether this
  action can be applied to multiple selected records"_ — has always been the
  declaration; what was missing was a consumer, exactly as framework's own
  property-liveness audit recorded (_"engine has `getBulkActions`/`executeBulk`,
  but no spec-driven view path calls `executeBulk`"_). So no new `locations`
  entry: a list's selection bar is the only surface on which records are
  multi-selected, which is what the flag already names. `locations` stays
  orthogonal — it places an action's single-record entry, and an action may carry
  both (`locations: ['list_item'], bulkEnabled: true` = one row from the kebab, N
  rows from the selection bar).

  **`ObjectGrid` folds three sources into the selection bar** (new pure
  `resolveBulkActions`, the twin of `resolveLegacyRowActions`; `ObjectGrid` is the
  single convergence point of all three list callers):

  - defs authored inline in the view JSON — unchanged, they win every collision;
  - object actions declaring `bulkEnabled: true` — **derived**, which is what
    "declare a bulk action on the object" now means;
  - legacy `bulkActions` names — resolved against `objectDef.actions` and
    **promoted** to that def, so they carry the action's label, icon, `visible`
    predicate, confirm text and params instead of a bare humanized name. A name
    matching a def already on the bar is dropped rather than rendered as a dead
    twin; a name matching nothing is still dispatched by name, since a consumer
    may have registered a runner handler under it.

  **Execution reuses the existing `BulkActionDialog` model** (params → confirm →
  progress → result). A derived def carries the source action under `actionDef`,
  and `useBulkExecutor` dispatches it through the action runner once per selected
  record with the row attached as `_rowRecord` — so `recordIdParam` injection
  behaves exactly as it does for a `list_item` row action. Client fan-out is the
  only semantics the single-record action contract supports; a server-side "take
  every id at once" variant would need its own spec key and endpoint contract.
  Params and confirmation are collected once by the dialog and handed to the
  runner as values so it never re-prompts per record, per-record toasts are muted
  in favour of the dialog's aggregate result, and a failing record is attributed
  in the result list (and error CSV) rather than counted as a success.

  Also fixed: the bar rendered legacy string buttons **only when no defs
  existed**, so a view mixing both silently lost half its buttons. After the fold
  the two lists are disjoint, and both render.

- Updated dependencies [62311b6]
- Updated dependencies [fc0272a]
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
- Updated dependencies [68ef584]
- Updated dependencies [4952edf]
- Updated dependencies [7f0252e]
- Updated dependencies [7d35010]
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
- Updated dependencies [a17ef09]
- Updated dependencies [fc60ad3]
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
  - @object-ui/data-objectstack@17.1.0
  - @object-ui/i18n@17.1.0
  - @object-ui/permissions@17.1.0
  - @object-ui/layout@17.1.0
  - @object-ui/auth@17.1.0
  - @object-ui/fields@17.1.0
  - @object-ui/plugin-editor@17.1.0
  - @object-ui/collaboration@17.1.0
  - @object-ui/providers@17.1.0

## 17.0.0

### Minor Changes

- 8b4bc94: feat(console): group tenancy posture affordances — org switcher as write
  context + org attribution in read views (framework ADR-0105 Phase 1)

  Under the new `group` tenancy posture the server widens reads to every
  organization the member belongs to (`organization_id IN accessible_org_ids`)
  while writes land in the ACTIVE organization — so the console's existing
  "which org am I in = which org's data I see" presentation becomes wrong the
  moment a deployment switches postures. The ADR requires these affordances to
  land WITH Phase 1, not after.

  - `@object-ui/auth`: `AuthPublicConfig.features.tenancyPosture`
    (`'single' | 'group' | 'isolated'`, exported as `TenancyPosture`) mirrors
    the server's public auth config key. It gates nothing — `multiOrgEnabled`
    stays the capability flag; this only tells the console how to render org
    context.
  - `useTenancyPosture()` (app-shell): reads the posture from the cached auth
    config fetch; `undefined` (older server, unrecognized value, fetch failure)
    keeps every group affordance off, so non-group deployments render
    pixel-identical to today.
  - `WorkspaceSwitcher`: under `group` the dropdown labels the active org
    "Working organization" and explains the split — new records are created
    here, views show data from all your organizations.
  - `RecordFormPage` (create mode): org-walled objects show a "Creates in
    <active org>" badge naming the engine's write target (ADR-0105 D5 stamps
    `organization_id` from the active org).
  - Default list columns (`ObjectView`, `InterfaceListPage`, `ObjectDataPage`):
    under `group`, org-walled objects get a TRAILING `organization_id`
    attribution column so cross-org rows are attributable at a glance.
    Render-time only — never persisted into saved view/page metadata, and
    business fields still lead.

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

- 6720008: feat(approvals): dynamic decision-output fields + expression approver editing (framework#3447 P2)

  - The approve/reject dialogs now render one input per author-declared decision-output key (the row's `decision_outputs`, per-request so it can't be a static action param). DeclaredActionsBar synthesizes `outputs.<key>` params; the api handler folds them into the nested `outputs` body the decide route expects. Blank optional outputs are omitted.
  - The flow designer's approval-node approver list renders an `expression`-type approver's value as a CEL expression input (mono + syntax check) instead of a dead free-text reference box, with a placeholder teaching the three legal roots (`current.*` / `trigger.*` / `vars.*`). Flow-scope pickers are deliberately not wired in — approval expressions have their own closed root set, and offering flow-scope paths would teach exactly the spelling the runtime rejects.
  - Static fallback descriptor gains the `Expression (CEL)` approver type, the expression-only `resolveAs` column, and the node-level `onEmptyApprovers` policy select (the online form derives all of these from the engine's published configSchema).

- 7f153de: feat(approvals): typed decision-output pickers, quick-path guard, and approval-expression completion (framework#3447 follow-ups, #2829)

  - Decision dialogs render TYPED decision outputs as record pickers: `decision_output_defs` (`{ key, label?, type, multiple? }`) maps `user` to the sys_user people picker and `department`/`position`/`team` to the matching system-object lookup; `multiple` collects an id array. Bare keys keep the text input.
  - Quick decision paths (inline a/r keyboard, hover buttons, mobile card buttons, bulk apply) no longer decide a request whose node declares decision outputs (#2829) — only the drawer dialog collects those fields. Buttons render disabled with an explanation; bulk selection excludes such rows via the existing "N actionable" messaging.
  - The approval `expression` approver input now has a scope-aware data picker and inline root validation: three groups — `current.<field>` (live at node entry), `trigger.<field>` (submit snapshot), `vars.*` (flow variables) — built by `useFlowScope` from the same materials as the condition picker but with the approval root set. `nodeOutputRefs` now models approval nodes (`<nodeId>.decision` + declared `decisionOutputs` keys), so the previous stage's outputs are pickable, and `vars.previous` is always listed so a legitimate `vars.*` reference is never flagged as out of scope.

- 54886ca: feat(console): make the `delegated_admin` org role reachable, and narrow both role pickers to what the server will accept (framework#3697)

  The framework registered a fourth organization role — `delegated_admin`, the
  grade that may reach `/organization/invite-member` **without** being an org
  admin, which is what finally gives ADR-0105 D8's scope-bounded issuance gate a
  caller. objectui#2868 already shipped the placement half of that UX (units and
  positions narrowed by `describeDelegableScope()`), but the console could not
  select the role in the first place: `MembersPage` and `InviteMemberDialog` each
  inlined `type Role = 'owner' | 'admin' | 'member'`, so the capability the
  framework grew was unreachable from either screen.

  **One vocabulary, not two.** The role names, labels and narrowing rules now live
  in `@object-ui/auth`'s new `org-roles` module (`ORG_ROLES`, `ORG_ROLE_LABELS`,
  `orgRoleGrade`, `invitableOrgRoles`, `assignableOrgRoles`) and both screens
  consume it. Note this list still **mirrors** the server rather than deriving
  from it — `/auth/config` publishes feature flags but no role vocabulary, so
  there is no surface to read; objectstack-ai/objectstack#3723 tracks making one
  list the source for all of them. Until then a server-side role addition means
  one console edit instead of two.

  **The pickers now narrow, the way the placement picker already does.** Both
  mirror a _different_ server gate, and offering an option the server would refuse
  is the failure they prevent:

  - **Invite role** ← the framework's `beforeCreateInvitation` role cap: never
    above the issuer's own grade, and an issuer below admin grade may invite as
    `member` only. A `delegated_admin` who picked "Admin" would have been refused
    with a 403; that option is simply no longer offered.
  - **Change role** ← better-auth's `update-member-role` route: it requires the
    `member:["update"]` permission (owner/admin only — `delegated_admin` is built
    from `memberAc` and holds `member: []`), and only an owner may set `owner` or
    re-role an existing owner. An actor who may re-role nobody now gets no items
    instead of three that would 403.

  Narrowing is convenience, not the boundary — the server re-checks every one of
  these — and it fails toward _less_: an unresolved membership offers `member`
  alone on invite, and nothing on re-role.

  An ordinary invitation is unchanged: with the default role and no placement, the
  request body is byte-identical to before.

  Note for translators: `organization.roles.*` has never been defined in any
  locale bundle — all four labels (owner/admin/member included) resolve through
  their `defaultValue` English fallback. The new role follows the same pattern
  rather than being the only localized one.

- b5609cb: feat(console): scoped-invitation placement — invite someone straight into a
  business unit and positions (framework ADR-0105 D8)

  An invitation may now carry PLACEMENT INTENT: the business unit the invitee
  lands in and the positions they are assigned when they accept. A plant admin's
  invitee arrives already in the right unit and role instead of waiting on a
  platform admin to finish the job by hand.

  - `@object-ui/auth`: `inviteMember` accepts optional `businessUnitId` /
    `positions` (passed through better-auth's invitation `additionalFields`), and
    a new `describeDelegableScope()` reads
    `GET /api/v1/security/my-delegable-scope`.
  - `InviteMemberDialog`: an optional "Placement" section listing **only** the
    units the issuer may place into and the positions they may hand out.
    Positions appear once a unit is chosen — an unanchored assignment is refused
    by the server, so offering it first would mislead.

  The narrowing is convenience, not the boundary: the server authorizes the pair
  against the ISSUER's `adminScope` (ADR-0090 D12) at issuance and rejects the
  whole invitation when it is out of scope. Accordingly the section is **hidden**
  whenever the caller has no delegable authority, or the deployment exposes no
  delegated-administration runtime at all (the endpoint answers 501 ⇒ `null`) —
  never a form the server would refuse. An ordinary invitation is unchanged: with
  no placement chosen, the request body is byte-identical to before.

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

- f1abf0e: fix(views): ListView reads the spec-canonical `filter`, so a view's base filter reaches every visualization (#2890 scope A step 4)

  Third rename in the ListView vocabulary migration: **`filters` → `filter`**. Unlike
  the first two this closes a live bug, because the fork was asymmetric.

  `ListView` was the **only** surface in the repo reading `filters`. Every child
  view — `ObjectGrid`, `ObjectGallery`, `ObjectKanban`, `ObjectCalendar`,
  `ObjectGantt`, `ObjectMap`, `ObjectTree`, `ObjectChart` — reads `filter`, and
  `ListView` handed them `filters`. Wherever a child fetches its own rows instead
  of receiving `ListView`'s, the view's base filter was silently dropped:

  - **a `chart` list view aggregated the whole object.** The chart branch built an
    `object-chart` node with `filters:`; `ObjectChart` reads `schema.filter` and
    never read `filters`, so a chart view with a base filter charted unfiltered
    totals.
  - the same applied to any of the other view components rendered standalone from
    a list-view-shaped config.

  Conversely, a **spec-authored** list view — one carrying `filter`, which is what
  the spec says and what `runtime-metadata-persistence` and "Save as view" already
  persist — rendered **unfiltered** in `ListView`, because nothing read that key.

  The fold is a key rename only. Both keys carry an ObjectQL FilterNode array
  everywhere in objectui; every consumer passes the value straight to `$filter`.
  (The spec types `filter` as `ViewFilterRule[]` — `{field, operator, value}`
  objects — so objectui's field is typed from the spec but used as something else.
  That mismatch is real and left alone here: converting formats inside a
  vocabulary fold would change what reaches the data source.)

  Also collapses a duplicated computation in `app-shell`'s `ObjectView`, which
  computed the same effective filter **twice** — once as `filter` for the child
  views, once as `filters` for `ListView` — with the two copies subtly different
  (only one fell back to `listSchema.filter`; only the other ran token
  substitution over the URL filters). There is now one computation, keeping both
  behaviors.

  `filters` stays declared on `ListViewSchema` and in the drift guard's sanctioned
  set — stored views carry it and it is still valid input — but it is input-only.

- f05b84e: refactor(views): ListView resolves density from the spec-canonical `rowHeight` (#2890 scope A step 2)

  Second rename in the ListView vocabulary migration: **`densityMode` → `rowHeight`**,
  folded in the same `normalizeListViewSchema` that step 1 introduced.

  Unlike `fields`/`columns` this is not a pure alias — the two vocabularies are
  different sizes. The spec has five row heights (`compact`/`short`/`medium`/
  `tall`/`extra_tall`); ListView's toolbar offers three densities
  (`compact`/`comfortable`/`spacious`). Both directions now live in one place as
  `DENSITY_MODE_TO_ROW_HEIGHT` / `ROW_HEIGHT_TO_DENSITY_MODE`, chosen so a fold
  followed by a read is a round trip (`spacious` → `tall` → `spacious`), with the
  narrowing collapse (`short` → `compact`, `extra_tall` → `spacious`) stated once
  instead of being re-derived per call site.

  Two behavior fixes fall out of it:

  - **Precedence is no longer inverted.** `ListView` read `densityMode` _first_, so
    a view carrying both keys rendered the legacy value — backwards from every
    other legacy/canonical pair in the schema. The canonical key now wins.
  - **The toolbar stops re-seeding the legacy key.** `ObjectView`'s
    `onDensityChange` persisted `densityMode` into stored view metadata on every
    density toggle, so the legacy vocabulary kept regrowing underneath the
    migration. It persists `rowHeight` now.

  `densityMode` stays declared on `ListViewSchema` and in the drift guard's
  sanctioned set — stored views carry it and it is still valid input — but it is
  input-only.

- 059a052: feat(report)!: drop `SpecReportColumn`/`SpecReportGrouping` re-exports + retire the legacy ReportViewer chart fallback (#3463)

  Cross-repo close-out of the ADR-0021 report cleanup (framework #3463). Upstream
  `@objectstack/spec` removed the dead `ReportColumnSchema` / `ReportGroupingSchema`
  and the unread report `chart.groupBy`; this drops their objectui mirrors and the
  now-orphaned legacy report chart path.

  - **types**: removed the `SpecReportColumn` / `SpecReportColumnInput` /
    `SpecReportGrouping` / `SpecReportGroupingInput` type re-exports and the
    `SpecReportColumnSchema` / `SpecReportGroupingSchema` value re-exports from
    `@object-ui/types` (they aliased the deleted upstream symbols). The live
    report shape is dataset-bound — `SpecReport` with `dataset` + `values`
    (measure names) + `rows` / `columns` (dimension names).
  - **app-shell**: `ReportView` now renders every report through the spec
    `ReportRenderer` dispatcher (dataset → `DatasetReportRenderer`, stored pre-9.0
    JSON → presentation bridge, pre-spec `{ data, columns }` → `LegacyReportRenderer`).
    Deleted the `ReportViewer` last-resort branch, the `mapReportForViewer`
    spec→legacy chart-section adapter (the sole producer of `xAxisField` /
    `yAxisFields`), and the now-dead data-fetch loading flag. No shipped report
    metadata reached the removed branch — the Studio inspector only ever writes
    the dataset-bound shape.
  - **plugin-report**: removed the `ReportViewer` chart-section branch. It read
    the invented `xAxisField` / `yAxisFields` (never the spec's `xAxis` / `yAxis`)
    and was only fed by the deleted `mapReportForViewer`. `ReportViewer` itself is
    retained — its table / summary / text sections still back the `report-viewer`
    registered component and the pre-9.0 presentation bridge.

  **Migration**: nothing an author writes changes. TypeScript consumers importing
  `SpecReportColumn*` / `SpecReportGrouping*` from `@object-ui/types` have no
  replacement type — model report columns as the dataset's measure names and
  grouping as its dimension names.

- 2600e01: feat(studio): surface the `enable.searchable` toggle in ObjectSettingsPanel (#2800)

  `enable.searchable` was corrected to LIVE during framework#2377 (the Global
  Search executor gates on it — explicit `false` opts the object out of
  cross-object search), making it the only live `enable.*` flag the Studio
  settings panel did not expose. It now renders as an opt-out toggle (default
  on) alongside feeds/activities/clone, with en + zh labels that point
  field-level match configuration at `searchableFields` (ADR-0061) to avoid
  conflating the two.

### Patch Changes

- 7b21891: fix(action): honor the spec `disabled` predicate on every action-rendering surface (#1885 follow-through)

  The spec Action field is `disabled` (boolean | CEL — disabled when TRUE); the
  schema has no `enabled` key. #1885 wired it in `action:button` only. Browser
  dogfooding against the showcase found FIVE more surfaces where a spec-authored
  `disabled` silently did nothing:

  - **components** — the `action:group` leaves (inline + dropdown), `action:icon`
    and `action:menu` still read the legacy non-spec `enabled`. They now consume
    `disabled` as the primary control (evaluated in the same scope as `visible`),
    with `enabled` kept as a deprecated fallback.
  - **app-shell** — `DeclaredActionsBar` (server-declared action bar) read
    neither; it gains `disabled` (no legacy fallback: declared actions are
    spec-shaped and never carried `enabled`).
  - **plugin-detail** — `record:quick_actions` HAD a `disabled` implementation,
    but its `typeof === 'string'` split dropped the `{dialect:'cel', source}`
    envelope the server compiles authored CEL into (#2661 routes envelopes to the
    canonical formula engine), so the predicate never fired on real metadata. It
    now feeds `toPredicateInput`'s result to `useCondition` whole, like every
    other surface.

  Pinned by new `DropdownActionItem` tests (disabled-when-TRUE, false-stays-
  clickable, disabled-wins-over-enabled, boolean literal) and browser-verified
  end-to-end against the showcase `showcase_archive_task` specimen: greyed on an
  in-progress task, clickable on a done one (with `visible` hiding Mark Done on
  the same screen — the hide-vs-grey contrast).

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

- cc5eca9: fix(app-shell): map raw `sys_activity` rows before rendering the inbox Activity tab

  The top-bar inbox bell's Activity tab (`InboxPopover`) rendered blank rows —
  only the relative time showed (`47m ·`), with the actor, summary, and object
  name all missing. `AppHeader.fetchPresenceAndActivities` cast the raw
  `sys_activity` rows straight to `ActivityItem` without renaming their fields,
  so the popover read `a.user` / `a.description` / `a.objectName` while the rows
  only carry plugin-audit's `actor_name` / `summary` / `object_name`.

  The rows are now mapped onto `ActivityItem` (with `type` normalization, a
  `timestamp` fallback, and an empty-`summary` filter), mirroring the mapping in
  `useHomeInbox` so the bell and the Home dashboard stay in sync.

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

- eea4391: fix(flow-designer): read approver value sources off the schema instead of mirroring them (framework#3508 follow-up)

  The approver Value picker decided _where its candidates live_ from a local
  table, `KIND_TO_RECORD_LOOKUP`, hand-mirrored from the spec's
  `APPROVER_VALUE_BINDINGS`. That mirror is what made framework#3508 possible:
  `xRef.map` names a picker KIND (`'team'`) and nothing more, so this package had
  to pick a data source itself — and picked the metadata REGISTRY
  (`GET /api/v1/meta/:type`), which lists no `sys_user` / `sys_team` /
  `sys_business_unit` / `sys_position` ROWS. Candidates were always empty and the
  control degraded to a raw-id text box.

  The spec now publishes the data contract as `xRef.sources` (one entry per
  approver type: `{ source: 'data', object, valueField }`, the closed enum
  inline, or a non-picker marker). `json-schema-to-fields` carries it through —
  validating each entry, dropping any that could not drive a picker — and
  `recordLookupFor()` prefers it over the local table. A new approver type can no
  longer leave a stale mirror behind here.

  What did NOT move: presentation. Which field to display, whether to open the
  people picker, what subtitle to show under a row stay this package's calls, so
  the spec ships the data contract and not the look. The local table remains as
  the fallback for a server that predates the annotation, and a `data` source for
  a kind with no presentation entry still renders a lookup labelled by its
  committed column — better than degrading a resolvable reference to free text.

  Also corrects the approver `type` options comment in `flow-node-config.ts`: that
  list is the OFFLINE fallback (`FlowNodeInspector` renders
  `serverFields ?? fieldsForNodeType(...)`, so a real backend's published
  configSchema wins). Its "indirect bindings lead, `user` last" ordering therefore
  never reached the live picker, which followed the spec enum with `user` first —
  the opposite of the intent. The ordering now lives in the spec's `ApproverType`
  enum, and the comment says which list is authoritative.

- 70941e8: fix(attachments): read the storage service's new error envelope so gated downloads keep their friendly copy (objectstack#3675)

  `RecordAttachmentsPanel` mapped the server's fail-closed 40x codes
  (`AUTH_REQUIRED`, `ATTACHMENT_DOWNLOAD_DENIED`) to human copy by reading
  `code` off the top level of the error body. The storage service has moved that
  code into the envelope its contract declares —
  `{ success: false, error: { code, message } }` — so the top-level read now
  returns `undefined`, and every gated download would have degraded from
  "You don't have access to download this attachment." to the generic
  "Download failed (403)".

  The download handler now reads `body?.error?.code ?? body?.code`, mirroring how
  the success branch two lines below already reads `body?.url ?? body?.data?.url`.
  Both dialects on purpose: the console ships independently of the server it
  talks to, so a current console must keep understanding an older one. A test
  covers each shape, and the fix is mutation-checked — dropping the nested read
  fails the two new-envelope cases.

- e56a9fd: fix(list): keep the injected `owner_id` out of the auto-generated list columns

  `ObjectView` renders an object's default "所有记录" tabular view (and prefills the
  "Add View" dialog) from the object's field order when it declares no explicit
  list view. Both paths carried their own name-based `SYSTEM_FIELDS` exclusion set
  that — like the pre-#2702 lists in `ObjectGrid` / `InterfaceListPage` — never
  listed `owner_id`. Because the framework's `applySystemFields` spreads its
  injected system/audit/ownership fields to the FRONT of the field map and
  `owner_id` is deliberately non-hidden and non-readonly (ownership is
  reassignable), it leaked through as the leading, raw-id column on every object
  without a declared list view (e.g. `showcase_invoice`), redundant with the
  business `owner` (`Field.user`) column.

  Both paths now derive their columns through a single shared
  `defaultListColumnsFromObject` helper that classifies system fields via the
  `isSystemManagedField` helper from `@object-ui/types` (the same classifier
  #2702 introduced) — branching on the spec `system` flag with a name-set
  fallback that includes the ownership/tenancy FKs. Auto-derived lists lead with
  business fields again and pick up future injected fields without editing a name
  list. Closes #2777.

- 4fc4b97: feat(app-shell): localize the automations flow designer & inspector (en-US + zh-CN)

  Comprehensive zh-CN localization of the metadata-admin automations surfaces —
  the visual Flow designer, node/edge inspector, validation, and the shared editor
  panels shown on the flow screen. Client-side per the platform's
  `translateMetadataType` precedent; en-US is unchanged (every zh overlay falls
  back to English, so unknown/plugin values are never hidden).

  - Flow designer: node palette (labels/hints/categories + Chinese search), canvas
    chrome & tooltips, header pills incl. enum values, preview panels, run-history
    & debug simulator, nested-region tray, and localized default labels for
    newly-created nodes.
  - Node & edge inspectors: config-field labels / help / options / column headers
    for the full engine-published `configSchema` field set (loop
    `indexVariable`/`maxIterations`, http `durable`/`signingSecret`, connector flat
    ids, notify's config fields, …), keyed off the raw node type so aliased types
    localize correctly.
  - Structural + unknown-reference validation messages (canvas banner, Problems
    panel, debug simulator) and the Problems-panel chrome.
  - Generic `SchemaForm` enum-option / raw-field-label localization used on the
    flow property form, plus the History / Audit / References / Layered-diff panels
    and the force-save dialog shown on the flow screen.

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

- 8ecf5a6: Command palette (⌘K) now surfaces record search hits from the platform's global
  search endpoint (`GET /api/v1/search`).

  Previously the palette only ran a per-object `find({ $search })` fanout (the
  metadata-driven ADR-0061 search), which misses records that only the global
  search index knows about — so typing a well-known record name returned no
  records even though `/api/v1/search` served them. `ObjectStackAdapter` now
  exposes a `searchAll(query, { limit, objects })` method that calls the unified
  endpoint, `useRecordSearch` prefers it when present (falling back to the fanout
  otherwise), and the palette renders the resulting record hits grouped by object.

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

- c992915: fix(metadata-admin): drop the SkillPreview "Required Permissions" panel (framework#3686)

  Upstream removed `SkillSchema.permissions` — skill invocation was never gated by
  it. Showing a "Required Permissions" section (and a "N required perms" header
  pill) for an unenforced list taught the wrong model: access is gated at the
  AGENT (`access`/`permissions`, enforced at the chat route) or on the underlying
  actions the skill's tools call.

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

- 2cb8d78: fix(console): dispatch flow actions from every surface, and cover the screen-flow round trip (framework#3528)

  The resume half of screen flows is fixed; these are the two launch-side holes
  found while mapping every path that dispatches a `type: 'flow'` action — on
  both, a screen flow could not even be started.

  - **plugin-dashboard** — a dashboard header action only dispatched when its type
    was `modal` or `script`. `flow` (and `api` / `form` / `navigation`) fell
    through to `console.warn("Unknown header actionType")` and did nothing at all.
    The click handler now routes everything that is not a raw `url` navigation
    through the ActionRunner, which owns the type registry; there is nothing for
    the renderer to second-guess.
  - **app-shell** — the console-root `<ActionProvider>` was mounted with no
    `handlers` map. It exists to give every field widget a modal handler, but an
    `ActionProvider` also decides what a `useAction()` consumer _below_ it can
    dispatch, so any `action:button` outside ObjectView / RecordDetailView /
    PageView / DeclaredActionsBar bound to a runner that could only open modals:
    a `flow` action there failed with "Flow handler not registered", and `api` /
    `script` were equally dead. The root now carries the shared console runtime's
    api / flow / script handlers plus its confirm / param / result / screen-flow
    dialogs. `modal` deliberately stays on the client-side `useActionModal`
    handler — registering it in `handlers` would take precedence over `onModal`
    and reroute the inline-create affordance to `/api/v1/actions/...`.

  Both changes ship with regression tests that were verified to fail without them.
  Also adds the first coverage of the screen-flow seam itself, which had none:

  - `FlowRunner.suspense.test.tsx` — a lazily-loaded screen body must not unwind
    past the dialog. Reproduces the real shape (lazy body, route-level boundary
    above the host, host state that must survive) and fails against the
    pre-boundary runner, which is how a paused run's screen used to vanish before
    it could be submitted.
  - `e2e/live/screen-flow.spec.ts` — the live round trip: a row flow action
    triggers the run, the paused screen renders, Submit POSTs to
    `/automation/{flow}/runs/{runId}/resume` with the collected values, and the
    flow's downstream `update_record` shows up in the list. The unit tests stub
    the runner out of the action runtime and the runner's own tests feed it a
    screen directly, so trigger → dialog → resume → refresh was previously only
    ever exercised by hand.

- ba642f8: feat(app-shell): Studio flow start node offers a "Record created or updated" trigger (#3427)

  The record-change trigger now supports `record-after-write` (create OR update in
  one flow), so the flow designer's start-node trigger picker offers a "Record
  created or updated" option. Selecting it shows the Object and Entry-condition
  fields, and the scope resolver puts both `record` and `previous` in scope for it
  (`previous == null` is how an author branches the create leg) — mirroring the
  runtime binding that fires the flow on both insert and update.

- b821287: feat(studio): first-class `notify` flow node in the Studio palette + inspector

  The `notify` flow node (ADR-0012 — outbound notification via the messaging
  service) is a live built-in with a server descriptor, but Studio had no static
  palette entry or config editor for it: `fieldsForNodeType('notify')` returned
  `[]`, so it was only authorable by hand-editing JSON or when the running engine
  happened to publish its descriptor (framework#1878 / framework#1895).

  - Added `notify` to `NODE_PALETTE` (Integration), with a Bell icon and the
    integration tone, canvas category, and a sensible default-config seed
    (`channels: ['inbox']`).
  - Added a `notify` entry to `FLOW_NODE_CONFIG` mirroring the built-in node's
    descriptor keys: `recipients`/`channels` (stringList), `title`, `message`
    (textarea), `topic`, `severity` (select info/warning/critical), and the
    click-through target (`sourceObject`/`sourceId`/`url`) — all written under
    `node.config`.

  Closes the last item of the designer-authoring-gaps issue (framework#1895).
  Unit + DOM tested (palette entry, config field kinds/paths, no inspector
  regression). A browser dogfood pass of authoring a notify node end-to-end is
  recommended before merge.

- 6b78855: fix(app-shell): stop the flow-node repeater from committing during render (#2838)

  Operating any `commitCell`-backed control in a flow node's objectList repeater —
  checkbox, select cell, record lookup, nested list, remove-row — logged a React
  warning:

  ```
  Cannot update a component (`MetadataResourceEditPageImpl`) while rendering a
  different component (`FlowObjectListField`).
  ```

  `commitCell` and `removeRow` called `flush()` (which calls the parent's
  `onCommit`) from inside their `setRows` updater. React runs updaters during the
  render phase, so the parent's `setState` landed mid-render — the exact pattern
  React flags. React only warns once per component pair, so whichever control the
  author touched first "claimed" the warning and every other one looked innocent.

  The handler now raises a commit-intent flag and leaves the updater pure; an
  effect flushes after commit. Because the effect reads the rows React actually
  applied, a commit no longer risks publishing a stale snapshot when another
  update is already queued (typing in a cell and then hitting the row's ✕ in the
  same tick).

  The plain suites missed this because React computes an updater eagerly when the
  fiber has no pending work — that path runs it in the handler and hides the
  warning — and because an `onCommit: vi.fn()` parent takes no update at all. The
  new regression test reproduces both conditions.

- 072330d: fix(console): let a screen flow be completed from the developer Flow Runs page (framework#3528)

  Developer → Flow Runs triggers a flow and renders the result. For a **screen**
  flow that result is not a result — it is `{ status: 'paused', runId, screen }`,
  and the run sits suspended until something posts to its resume endpoint. The
  panel dumped that envelope as JSON and stopped: no screen, no Submit, no resume
  call. Every test run of a screen flow left an orphaned `paused` row in Recent
  Runs, and there was no way to drive one to completion from this surface.

  - **console** — a paused test run now opens the same `FlowRunner` the record and
    list surfaces use, so the screen renders for real (flat fields, multi-step
    wizards, and `object-form` steps with their master-detail grids) and Submit
    posts to `/automation/:flow/runs/:runId/resume`. Dismissing the runner no
    longer strands the run: the pause is durable, so the panel keeps a "Continue
    run" affordance to reopen the pending screen. `paused` also gets its own
    status badge instead of falling through to the unknown-status style.
  - **app-shell** — `FlowRunner` (and its `ScreenFlowState` / `ScreenSpec` types)
    is now exported from the package so surfaces outside `views/` can mount the
    one screen-flow runner rather than reimplementing it.
  - **app-shell** — `FlowRunner` now wraps the screen body in its own `<Suspense>`
    boundary. An `object-form` step mounts `ObjectForm`, whose field widgets are
    lazy; that suspension used to unwind to the _host's_ nearest boundary, and on
    a surface whose nearest boundary is the route-level one, React swapped the
    whole page for the fallback and remounted it — destroying the host's state
    along with this dialog. The screen vanished before it could be filled in and
    the run stayed paused with no resume call, which is exactly the "Submit does
    nothing" shape. Reproduced on the Flow Runs page and fixed at the source, so
    every host that mounts the runner is covered.
  - **app-shell** — a screen payload without `fields` no longer throws. `fields`
    is optional on the wire (a message-only screen, or an `object-form` step from
    a node executor that omits it), but `FlowRunner`/`ScreenView` read it
    unguarded and blew up as the dialog mounted. Reads now go through a
    `screenFields()` helper; the design-time builder keeps its exhaustive shape.

- ddea597: feat(app-shell): surface step warnings in the Flow Runs panel (#3407)

  The automation engine now attaches advisory `warnings[]` to a step whose write
  was legally stripped by the data layer — an `update_record`/`create_record`
  targeting a `readonly` / `readonlyWhen` field. The step still reports
  `success` (the strip is legitimate semantics), so the run trace previously
  looked like a clean 3ms success while the intended write never landed; the
  only signal lived in the server WARN log.

  `FlowRunsPanel` now reads `step.warnings` and renders each one amber beneath
  its step — with a ⚠ marker on the step row — **without** recoloring the
  status. The dropped-write signal that #3407/#3413 plumbed from the data layer
  into the run's step log now reaches the Studio, closing the observability loop
  the author actually looks at.

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

- cd09a7b: refactor(views): ListView reads the spec-canonical `columns`, with legacy `fields` folded in one normalizer (#2890 scope A step 1)

  `ListViewSchema` has been derived from `@objectstack/spec/ui` since #2231, but
  the renderer still spoke objectui's own vocabulary for the same concepts. First
  rename closed: **`fields` → `columns`**.

  Legacy acceptance does not disappear — stored view metadata in user databases
  carries `fields` — but it now lives in exactly one place instead of being
  re-implemented per read-site:

  - **New `normalizeListViewSchema` (`@object-ui/core`)** folds `fields` into
    `columns` (canonical wins when both are present) and drops the legacy key, so
    a read-site that was missed fails loudly instead of quietly taking the legacy
    path. It also absorbs the `viewType` renderability default ListView applied
    inline. Non-mutating, idempotent, and returns its input by reference when
    there is nothing to fold, so ListView's downstream memos keep a stable
    dependency identity.
  - **`ListView` normalizes once at the component boundary**, before anything
    reads the schema. This is what guarantees the fold runs: nothing on the render
    path parses view metadata through zod (the zod schemas serve the CLI
    validator, the VS Code extension and tests), so a `z.preprocess` on
    `ListViewSchema` — spec-side or local — would never execute.
  - **Producers emit `columns`**: `ObjectView`'s `renderListView` payload,
    `ObjectDataPage`, `InterfaceListPage` and the `list-view` registry defaults
    had been _downgrading_ already-canonical `columns` config back to `fields`.

  Two latent inconsistencies go away with it: the filter builder's
  objectDef-not-loaded fallback now resolves `ListColumn.field` (it read only
  `name`/`fieldName`, so object-form columns produced unnamed filter entries), and
  the column list no longer depends on which of the two keys a host happened to
  emit.

  `fields` stays declared on `ListViewSchema` and in the drift guard's sanctioned
  set — it is still valid input, and `@objectstack/spec`'s `react-blocks.ts`
  sanctions it as the React-tier `<ListView fields>` prop — but it is input-only.

- 66dbca5: fix(SchemaForm): render row sub-fields for `repeater` fields whose schema is a union (objectui#3379)

  In Edit View Config → Columns & Filters → Sort, "Add" produced an empty row
  with no field picker or order dropdown. A View's `sort` prop is a
  `z.union([z.string(), z.array(z.object({ field, order }))])`, so its JSONSchema
  is `anyOf: [string, {field,order}[]]`. The SchemaForm repeater read
  `schema.items` at the top level — which is `undefined` for a union — and
  derived zero sub-fields.

  The repeater now resolves the union to its array branch and uses that branch's
  `items` for both the derived field list and the per-row controls
  (`pickSubSchema`). The legacy bare-string `sort` form remains valid in the spec
  (its removal is a separate, deferred deprecation cycle); this is purely a
  renderer fix.

- 89eb682: fix(console): resolve a modal action's `target` as a page, not an object (#3530)

  Submitting a `type: 'modal'` action failed with "Error loading form — Bad
  Request". The console read the action's `target` as an OBJECT name and opened a
  create form for it, so a target naming a page issued `GET
/meta/object/<page>` — which 400s — and the dialog rendered `<ModalForm>`'s
  error state instead of the page. Every modal action in an app hit this; the only
  workaround was re-authoring each one as a screen flow.

  The spec is explicit that for `type: 'modal'`, `target` is "the modal/page name
  to open".

  - `normalizeModalSchema` no longer guesses "object" for a string target. It
    records the raw name and `useActionModal.resolveModalTarget` (new) resolves it
    against metadata: **page first**, then object for back-compat. Resolution uses
    `getItem(type, name)`, a single-item fetch, so it never eagerly loads the lazy
    page/object lists — this hook is mounted at the console root.
  - The `create_x` / `edit_x` prefix convention still yields an object form, but
    now only as a fallback: a page actually named `create_opportunity` wins over
    the object `opportunity` the name would otherwise be parsed into.
  - A target that names neither reports what is wrong ("Modal target "x" matches
    no page or object") instead of surfacing a downstream HTTP error.

  Modal dispatch is also now the same on every console surface. `type: 'modal'`
  was wired straight to the server-action POST in `useConsoleActionRuntime` (list
  pages, SDUI pages, the declared-actions bar) while `RecordDetailView` opened
  modals client-side — the same button did two different things depending on where
  it was mounted. Both now run one rule: render `target` when it names a page or
  object, otherwise complete the action through its server-side handler, so a
  modal action bound to `engine.registerAction(...)` keeps working.

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

- 4dfd14f: fix(app-shell): remove the never-firing `record-change` option from the flow trigger picker (#3427)

  The Studio flow designer's start-node trigger picker offered "Record changed
  (any)" (`record-change`), but the runtime routes it to the record-change trigger,
  which maps it to no ObjectQL hook — so the flow binds yet **never fires**. Authoring
  it produced a silently-dead flow. Removed the option (and dropped `record-change`
  from the scope resolver's record/previous sets and the zh-CN labels). The common
  "created or updated" case is covered by `record-after-write`; a companion
  `@objectstack/lint` rule flags any hand-authored `record-change` at `os validate`
  time.

- 1bb77aa: fix(flow-runner): honor a screen field's `visibleWhen` — in rendering AND in required-enforcement (framework#3528)

  A paused screen-flow rendered every declared field regardless of its
  `visibleWhen` predicate, while still enforcing `required` over the full list.
  Where a field is optional-by-design but required _when shown_, that combination
  dead-ends the run: Submit blocks on an input the user was never shown, issues
  **zero network requests**, and the flow sits paused forever.

  Reproduced in Chromium against a real HotCRM dev server — on both the console
  shipped with `@objectstack/*` 16.1.0 and current `main`:

  ```
  → POST /api/v1/automation/lead_conversion/trigger   200 {status: paused, screen}
     rendered: ["Create Opportunity? *", "Opportunity Name *", "Opportunity Amount"]
     click Submit (checkbox untouched)
  → (nothing)   resume calls: 0   toasts: none   dialog: still open
  ```

  The predicate never reached the client — the framework declared `visibleWhen` on
  the screen node's designer form but dropped it when building the paused payload
  (fixed in objectstack#3771). This is the consumer half.

  - **`visibleScreenFields(screen, values)`** is the single source of truth for
    what is on screen. `ScreenView` renders from it and `FlowRunner.submit()`
    validates from it, so the two can never disagree — splitting them is the bug.
  - Predicates are **bare CEL over the screen's own field names**
    (`createOpportunity == true`), evaluated through the canonical
    `@objectstack/formula` engine, the same verdict the server reaches for field
    rules. Values bind both bare and under `record.`.
  - **Declared fields are seeded before evaluation.** An untouched checkbox holds
    `undefined`, which CEL treats as an unknown identifier — the evaluation errors
    and falls open, leaving the dependent field on screen in exactly the state
    where it should be hidden. Booleans seed `false`, everything else `null`.
  - **Fail-open is preserved for genuinely broken predicates** (syntax error, or a
    name that is not a field on this screen), matching `resolveFieldRuleState`:
    hiding an input on a typo would silently drop data the flow is waiting for.

  Screens with no `visibleWhen` behave exactly as before.

- 7e354e9: The full-page search (`/apps/:app/search`) now surfaces record hits, not just
  metadata nav items.

  Following the ⌘K command-palette fix (#3371), the search results page was still
  matching only navigation entries (objects, dashboards, pages, reports). It now
  runs the same global record search (`useRecordSearch` → `/api/v1/search`),
  scoped to the app's searchable objects, and renders the record hits grouped by
  object above the metadata matches. Both the search page and the palette now
  resolve each object group's heading through the i18n label resolver, so
  localized object labels display correctly instead of falling back to the raw
  object name.

- 8aae006: fix(views): the five per-view-type configs speak the spec vocabulary (#2231 phase 3)

  `kanban`/`calendar`/`gantt`/`gallery`/`timeline` on `ListViewSchema` were the last
  hand-written forks left after #2882 — and the fork was not cosmetic: objectui named
  the same concepts differently from `@objectstack/spec/ui`, and several read-sites
  only understood one of the two dialects. Two of those gaps were live bugs.

  **Kanban lanes ignored the spec key.** `ListView` gated the Kanban tab on
  `groupByField || groupField` but rendered lanes off `groupField` alone. A config
  authored with the spec key — which is exactly what the product's own
  `CreateViewDialog` emits — offered the tab and then grouped by whatever
  `detectStatusField()` guessed. The spec's `columns` (the fields shown on each card)
  was also spread onto the board verbatim, where `columns` means _lanes_, so
  `ObjectKanban` built lanes with `undefined` id and title. `columns` now maps to
  `cardFields` and the vocabulary keys are stripped from the passthrough.

  **Timeline lost every spec key in app-shell.** `ObjectView`'s `timeline` branch was
  a three-key whitelist while its `gallery`/`gantt` siblings had already been fixed to
  spread-first, so a stored `timeline: { startDateField, endDateField, groupByField,
colorField, scale }` arrived with only `titleField` and an axis pinned to the
  `'due_date'` fallback.

  Also: `plugin-view`'s `ObjectView` now reads `gallery.coverField` and
  `timeline.startDateField` (it only understood the legacy aliases), and the dead
  `gallery.subtitleField` is removed — three producers computed it and `ObjectGallery`
  never read it.

  The schema side now derives from the spec configs (`.partial()`, since the product
  authors partial configs and spec marks `columns`/`titleField`/`startDateField`
  required). `gantt` needed no local schema at all. The pre-#2231 names
  (`groupField`, `cardFields`, `imageField`, `dateField`) remain accepted as deprecated
  aliases so stored views keep validating; the spec key wins wherever both appear.
  `calendar.defaultView` stays local — it has no spec counterpart.

- d62fb1f: feat(app-shell): toast when a save silently dropped read-only fields (framework #3431/#3455)

  The framework now reports fields it LEGALLY stripped from a write (a non-system
  caller can't seed a `readonly` field, a `readonlyWhen` predicate locked it, …)
  via a `droppedFields` payload on the create/update response. Previously the
  console discarded it: a value the user typed into a locked field just vanished on
  save with a success toast and no explanation.

  - **data-objectstack:** `ObjectStackAdapter` now emits a `WriteWarningEvent`
    after a create/update whose response carried `droppedFields`, exposed through a
    new `onWriteWarning(cb)` subscription (mirrors the existing `onMutation` bus).
    Reads the field structurally, so an older client or a backend that never drops
    is a no-op. New exported types: `WriteWarningEvent`, `WriteWarningListener`,
    `DroppedFieldsEvent`.
  - **app-shell:** `AdapterProvider` subscribes and raises a `toast.warning`
    ("Some fields were not saved — the read-only field … could not be changed"),
    so the strip is visible instead of silent. The write itself still succeeded;
    status/behaviour are unchanged.

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

- Updated dependencies [7b21891]
- Updated dependencies [0b3be01]
- Updated dependencies [8b4bc94]
- Updated dependencies [3c4d935]
- Updated dependencies [4b1ed7d]
- Updated dependencies [4b60d2d]
- Updated dependencies [952b978]
- Updated dependencies [de5e40c]
- Updated dependencies [1a03af6]
- Updated dependencies [3e886eb]
- Updated dependencies [aa88056]
- Updated dependencies [cfc675e]
- Updated dependencies [20df08c]
- Updated dependencies [1767124]
- Updated dependencies [8ecf5a6]
- Updated dependencies [af705b9]
- Updated dependencies [0502a7c]
- Updated dependencies [54886ca]
- Updated dependencies [b5609cb]
- Updated dependencies [7b35e4b]
- Updated dependencies [8fb1295]
- Updated dependencies [e16ed2d]
- Updated dependencies [c6fd752]
- Updated dependencies [f9bbddb]
- Updated dependencies [dfd3705]
- Updated dependencies [c77108c]
- Updated dependencies [2735de6]
- Updated dependencies [697cda4]
- Updated dependencies [2cb8d78]
- Updated dependencies [c19ac11]
- Updated dependencies [6dee2cb]
- Updated dependencies [e05f052]
- Updated dependencies [0502a7c]
- Updated dependencies [faad45e]
- Updated dependencies [553443e]
- Updated dependencies [09c6a17]
- Updated dependencies [c7cff19]
- Updated dependencies [df6697f]
- Updated dependencies [ba73a02]
- Updated dependencies [ba45145]
- Updated dependencies [cd09a7b]
- Updated dependencies [f1abf0e]
- Updated dependencies [ab46110]
- Updated dependencies [f05b84e]
- Updated dependencies [9b4b952]
- Updated dependencies [341bfb5]
- Updated dependencies [2f947e4]
- Updated dependencies [7d46648]
- Updated dependencies [6e8fd3c]
- Updated dependencies [9b53d72]
- Updated dependencies [503d3f6]
- Updated dependencies [bb4aa25]
- Updated dependencies [75f1cdf]
- Updated dependencies [662bdf9]
- Updated dependencies [059a052]
- Updated dependencies [53642d4]
- Updated dependencies [8aae006]
- Updated dependencies [d62fb1f]
- Updated dependencies [c6cfdf1]
- Updated dependencies [5b9cf96]
- Updated dependencies [dc7a798]
- Updated dependencies [d147a13]
- Updated dependencies [c6aaed8]
- Updated dependencies [263f885]
- Updated dependencies [dc334da]
  - @object-ui/components@17.0.0
  - @object-ui/plugin-detail@17.0.0
  - @object-ui/i18n@17.0.0
  - @object-ui/auth@17.0.0
  - @object-ui/fields@17.0.0
  - @object-ui/react@17.0.0
  - @object-ui/plugin-charts@17.0.0
  - @object-ui/plugin-chatbot@17.0.0
  - @object-ui/plugin-grid@17.0.0
  - @object-ui/types@17.0.0
  - @object-ui/data-objectstack@17.0.0
  - @object-ui/core@17.0.0
  - @object-ui/plugin-dashboard@17.0.0
  - @object-ui/plugin-form@17.0.0
  - @object-ui/permissions@17.0.0
  - @object-ui/plugin-list@17.0.0
  - @object-ui/plugin-view@17.0.0
  - @object-ui/plugin-kanban@17.0.0
  - @object-ui/plugin-calendar@17.0.0
  - @object-ui/plugin-designer@17.0.0
  - @object-ui/plugin-report@17.0.0
  - @object-ui/layout@17.0.0
  - @object-ui/plugin-editor@17.0.0
  - @object-ui/collaboration@17.0.0
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

- 94d4876: feat(dashboard): Studio authors the ADR-0021 dataset shape only (framework#3251)

  Finishes the dashboard analytics migration on the authoring side so the
  framework can enable `DashboardWidgetSchema.strict()`. Both Studio surfaces now
  emit only the semantic-layer shape (`dataset` + `dimensions` + `values`); no
  surface authors the removed pre-ADR-0021 inline query.

  **FROM → TO** (authoring)

  - charts: `object` + `categoryField` + `valueField` + `aggregate`
    → `dataset` + `dimensions` + `values`
  - pivots: `object` + `rowField` + `columnField` + `valueField` + `aggregation`
    → `dataset` + `dimensions` + `values` (last dimension spreads across columns)

  **Changes**

  - `@object-ui/types` — `DashboardWidgetSchema` gains `dataset` / `dimensions` /
    `values`; the inline analytics keys (`object`, `categoryField`,
    `categoryGranularity`, `valueField`, `aggregate`, `measures`) are marked
    `@deprecated` (retained only so the renderer can still read legacy/static
    metadata during the transition).
  - `@object-ui/plugin-dashboard` — `WidgetConfigPanel` is rewritten as a dataset
    picker (chart AND pivot). **Breaking prop change:** the unused
    `availableObjects` / `availableFields` props are replaced by a new
    `datasets?: WidgetDatasetCatalogEntry[]` (+ `datasetsLoading?`) catalog prop,
    also forwarded by `DashboardWithConfig`. Hosts resolve the catalog (e.g. via
    the metadata client's `list('dataset')`); without it the panel falls back to
    free-text authoring. New exports: `WidgetDatasetCatalogEntry` and
    `sanitizeDraftForType`.
  - `@object-ui/app-shell` — the metadata-admin `DashboardWidgetInspector` drops
    the legacy inline fields (object / value field / category field / aggregate);
    the dataset section is now the primary (and only) analytics binding, and the
    filter-binding field picker sources options from the bound dataset's
    dimensions. The "Add widget" catalog drops `list` / `custom` — neither is a
    member of `@objectstack/spec` `ChartTypeSchema`, so a widget authored with
    them could never publish.

  **Not changed:** `DashboardRenderer` keeps its legacy/static read branches and
  the `ObjectPivotTable` / `PivotTable` blocks (still public SDUI blocks and the
  backward-compat path for stored/static widgets) — only the dashboard authoring
  flow stops emitting the legacy keys. Retiring those renderer branches is a
  follow-up gated on migrating stored dashboards.

- 20a2a02: feat(app-shell): nested-array columns in the flow designer property form (#2678 P2-5)

  The server-driven node property form (`configSchema` → `FlowConfigField`) now
  renders **nested arrays** inside an `objectList` repeater instead of degrading
  them to a plain text cell that `String()`-joined and corrupted the array on
  save. A repeater column whose item property is itself an array becomes a
  **nested repeater** (repeater-in-repeater):

  - `json-schema-to-fields` `columnsFor` maps an array-typed item property to a
    `stringList` / `numberList` / `objectList` column; object-array columns derive
    their own nested columns recursively (bounded by a nesting cap so a
    pathological / cyclic schema can't build a non-terminating form). Arrays that
    still aren't representable fall through to the prior text behavior — no
    regression.
  - `FlowConfigColumn` gains the three list `kind`s plus a recursive `columns` for
    nested `objectList`.
  - `FlowObjectListField` renders those columns via the shared `FlowStringListField`
    (string/number lists, with `number[]` coercion) and a recursive
    `FlowObjectListField` (object lists), round-tripping each cell as an array.

  Any engine-published node config with a nested array is now editable inline
  rather than dropping to the Advanced JSON escape hatch.

- a4acca7: feat(studio): expand loop / parallel / try_catch regions inline on the flow designer canvas (#2670)

  The flow designer rendered ADR-0031 structured control-flow containers
  (`loop` / `parallel` / `try_catch`) as opaque single node cards — their nested
  regions (`config.body` / `config.branches[]` / `config.try`/`catch`) were only
  visible, and only editable, as raw JSON in the inspector's Advanced block.

  A container card now carries an expand chevron that grows the card **in place**
  to embed its region(s) as a read-only mini-canvas — the same top-to-bottom
  node/edge layout as the parent graph, scaled to fit the card width — with a
  header per region (a named branch or `Branch N`, and `Try` / `Catch`; a loop
  body has none). The canvas layout is geometry-aware: the layers below an
  expanded container are **pushed down** by its real height and its outgoing edge
  leaves from its true bottom. Collapsed by default; expansion is session-only
  view state (never written to the flow draft). Legacy flat loops (a `loop` with
  no `config.body`) and all ordinary nodes render exactly as before — with no
  expanded container the layout is identical to the previous release, locked by
  invariance tests.

  Known limitation: a node pinned via a manual drag position sitting at/below an
  expanded container can overlap it (manual positions are absolute); drag it
  clear or collapse the container.

- 5a89ee5: feat(studio): select and edit nested container nodes through the schema-driven flow inspector (#2670)

  Phase 2 (#2680) expanded a container's regions (`loop.body` /
  `parallel.branches[]` / `try_catch.try`/`catch`) inline on the flow designer
  canvas, but the nested nodes were read-only — changing one still meant editing
  the container's Advanced JSON by hand. A nested node is now a first-class
  selection: click it on the expanded canvas and it opens in the SAME
  schema-driven inspector as a top-level node, with a `container › region › node`
  breadcrumb. Edits (label / type / description / typed config fields / Advanced
  JSON) write straight back into `config.<region>.nodes[i]` — the write rebuilds
  the container with explicit spreads so the `config.branches` array stays an
  array and each region's own `edges` / a branch's `name` are preserved.

  Scope resolves correctly for the region's outer context (ADR-0031): a loop
  body node sees the loop's `iteratorVariable` in its data picker even though the
  container's own outputs are otherwise out of scope at its id.

  This phase is edit-only by design. A nested node keeps its id read-only (rename
  it in the container's Advanced JSON), has no delete, and — for a nested
  decision — drops the virtual Target column, since a region sub-graph's internal
  routing is not managed by the inspector yet (nested region-edge editing,
  structural add/remove, and drag are follow-ups). A stale nested deep link
  (the draft moved on) resolves to a harmless empty-state rather than writing to
  the wrong node.

  Also fixes an expression/template validation split now that the engine
  publishes a loop `configSchema`: a string property can carry an `xExpression:
'expression' | 'template'` marker so the designer renders bare-CEL vs
  `interpolate()` `{var}` semantics (mono editor, data-picker brace mode, and
  whether the CEL brace-trap applies) instead of guessing from the field name. A
  loop / map `collection` (`{leadList}`) is a template, so it no longer
  false-positives as a malformed condition inline or on the canvas badge.

- 12390de: feat(studio): nest per-iteration / per-region step logs in the flow Runs panel (#1505)

  The run-observability `FlowRunsPanel` (Studio → flow preview → Runs) rendered a
  run's step log as a flat list, so a `loop` container showed as a single step and
  its body steps — one set per iteration — appeared as an undifferentiated repeat
  of the same node ids, with `parallel` branches and `try`/`catch` handlers
  likewise flattened. The automation engine already tags each structured-region
  body step with its container (`parentNodeId`) plus an `iteration` / `regionKind`
  (ADR-0031, framework #1505); the panel ignored those fields.

  `FlowRunsPanel` now reconstructs the execution tree from the flat, pre-order step
  log (`buildStepTree`) and nests body steps under their container node, grouped by
  a per-iteration / per-branch / handler header (`Iteration 2`, `Branch 1`, `Try`,
  `Catch`). The reconstruction is robust to repeated node ids (a loop body node
  runs once per iteration) and to regions nested inside regions, and degrades
  safely — a body step whose container was dropped by durable-history truncation
  still surfaces at the top level rather than vanishing.

- 7abe4cd: **Console user-import wizard defaults to the `auto` password policy (tracks framework#3236).** The "Sign-in setup for imported users" selector gains an **Automatic (recommended)** option and it is now the default (was "No password"). `auto` decides per row on the server: reachable users get an invitation (email / SMS), anyone who can't be reached gets a one-time password shown once on the result screen — so it works with or without an email/SMS service, and the one-time-password reveal now surfaces only the rows that actually fell back (instead of the whole batch under `temporary`).

  The other three policies are unchanged and still selectable: `invite` (force invitations, unreachable rows fail), `temporary` (force one-time passwords for every row), `none` (identity only). New `console.identityImport.policy.auto` / `policyHint.auto` strings added for `en` and `zh`; the `none` label drops its "(recommended)" marker.

- 2331ac9: feat(report): drill a date-bucket cell into its time range, not a superset (#1752)

  Clicking a report/dashboard cell grouped by a `dateGranularity` date dimension
  ("2026-Q2") used to drill into a **superset** — the date dimension was skipped,
  so the record list spanned every time bucket. It now scopes to the clicked
  bucket's half-open range, consuming the framework's new `drillRanges` sidecar.

  - **`@object-ui/core`** — `buildDatasetDrillFilter` accepts the per-row
    `drillRanges` and emits an ObjectQL range operator object
    (`{ [field]: { $gte, $lt } }`) alongside the equality dims.
  - **`@object-ui/plugin-report` / `@object-ui/plugin-dashboard`** — the report
    renderer and dashboard widget forward `drillRanges`, and a **date-only**
    report (no equality drill dim) is now drillable via the range alone.
  - **`@object-ui/app-shell`** — the "Open in list →" escape hatch
    (`useOpenRecordList`) now targets the ADR-0055 **bare data surface**
    (`/:object/data`, "the URL is the view" — no baked-in view filter to
    over-narrow the drill) and serializes a range to the
    `filter[field][gte|lt]` operator contract. `ObjectDataPage` parses those
    operators (equality shorthand unchanged), renders a range as a single chip,
    and removes both bounds together. A new `drillUrlFilters` module owns the
    write/read serialization so both sides can't drift (round-trip tested).

  Companion to the framework analytics change (objectstack-ai/objectstack#3256).

- e7a8de7: feat(flow-designer): map free-form object maps → keyValue (and numeric arrays → numberList) in the schema-driven inspector (#3304)

  The server-first flow-designer form generator (`jsonSchemaToFlowFields`, ADR-0018)
  had no way to render the flat `{ var: value }` **keyValue** editor from a JSON
  Schema, so any node whose config uses a free-form map — a CRUD node's `fields` /
  `filter`, an `assignment`'s `assignments`, a connector's `input`, a screen's
  `defaults` — could not be driven from its published `configSchema` without
  dropping that editor to raw Advanced JSON.

  The adapter now maps:

  - an object with **`additionalProperties`** (a value schema, or `true`) and **no
    fixed `properties`** → a `keyValue` field (the object-with-`properties` case
    still flattens to sub-fields; an opaque object or `additionalProperties: false`
    still falls through to the Advanced block);
  - an array of **number / integer** → `numberList` (the sibling of the existing
    array-of-string → `stringList`).

  This is a pure capability addition — inert until a node publishes such a schema,
  so no existing form changes. It unblocks giving the previously schema-less flow
  nodes (assignment, the CRUD quartet, script, subflow, screen) a server-driven
  config form that matches their hardcoded one, the objectui half of framework
  #3304 (the descriptor-side counterpart to #2670 Phase 3).

- 7938b60: feat(studio): filter editor for roll-up `summary` fields (framework#1868)

  The object-designer field inspector now edits `summaryOperations.filter` on a
  `summary` field. Backing the framework's new filtered roll-ups — where one child
  object feeds several parent totals, each aggregating only the child rows a
  predicate matches (an approved-only sum vs the grand total) — the inspector adds
  a structured field/operator/value row editor under Rollup Options (mirroring the
  lookupFilters editor), reading and writing the spec's FilterCondition object.

  - Values are coerced to the child field's stored type, so a `boolean` field emits
    `{ billable: true }` (not the string `"true"`) and a numeric operator emits
    `{ amount: { $gte: 500 } }` — the FilterCondition then matches the real column.
  - Rows map to/from the flat FilterCondition (and a top-level `$and`); a filter
    using logic the rows can't represent (`$or` / nested) is shown read-only with a
    note instead of being clobbered on edit.
  - New `designer.field.summary.filter*` i18n keys (en + zh-CN).

- 276c6ba: feat(flow-designer): first-class panel for the time-relative trigger (#1874)

  The flow designer's start-node inspector now offers a **Time-relative (date sweep)**
  trigger option alongside record / schedule triggers. Picking it reveals typed
  fields for the backend's `config.timeRelative` descriptor — Sweep object, Date
  field, Within days (range mode), Offset days (T-minus mode), an Extra filter, and
  Max records — instead of hand-writing the block in the Advanced JSON editor. The
  per-record Entry condition is available too.

  Adds a `numberList` config-field kind (a string-list editor that commits
  `number[]`), so **Offset days** authors emit numbers rather than strings — keeping
  the backend schema (`z.array(z.number())`) strict rather than coercing on the
  consumer side. All fields live under the nested `config.timeRelative` block, which
  the group fully owns, so it never double-renders in Advanced JSON.

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

- 8b8b744: chore(deps): align `@objectstack/formula` / `lint` / `client` to `^15.1.1`

  These three were still pinned to `^14.6.0` while `@objectstack/spec` was already
  `^15.1.1` — a version skew from the v15 upgrade (formula/lint/client publish in
  lockstep with spec, and their own 15.0.0 entries are pure dependency bumps, so
  this is alignment, not a behavioral migration).

  Practical effect: the client-side field-rule evaluation
  (`visibleWhen`/`readonlyWhen`/`requiredWhen` via `fieldRules.ts`, which delegates
  to `@objectstack/formula`'s `ExpressionEngine`) now tracks the 15.x engine — and
  will pick up the framework's `dateField == today()` equality fix
  (objectstack-ai/objectstack#3205) automatically at the next 15.x release via the
  caret range. Renderer/action `visible`/`disabled` predicates are unaffected (they
  use the home-grown JS evaluator — tracked separately in #2661).

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

- ce5e3fc: fix(flow-designer): author the canonical `config.schedule` a scheduled flow's runtime reads

  The start-node inspector's "Cron schedule" field wrote a flat `config.cron`, but the
  automation runtime (`resolveTriggerBinding` → `normalizeSchedule`) only ever reads
  `config.schedule` — so a scheduled flow authored in the designer silently never
  bound and never fired. The field now writes the canonical nested
  `config.schedule.expression`, and a `fallbackPath` migrates an existing flat
  `config.cron` on first edit. Reading `.expression` also renders an object-shaped
  `config.schedule` (e.g. `{ type: 'cron', expression }`) as its cron string instead of
  "[object Object]" (the old legacy text field on `config.schedule` printed the object).
  The canvas node-card summary reads the nested value too. The field is also offered for
  the `time_relative` sweep cadence (optional; defaults to daily).

- d9c304d: chore(lint): clear the baseline lint errors in app-shell (objectui#2713 Wave 3)

  Final package of the #2713 lint-gate restoration — with this the whole workspace
  is at **0 lint errors**. `@object-ui/app-shell` was red at baseline on `main`;
  cleared every **error** (no behavior change; warnings out of scope):

  - **`react-hooks/rules-of-hooks` (12)** — hooks called after conditional early
    returns, restructured so hook order is stable:
    - `SchemaForm`: hoisted the `issuesByPath` `useMemo` above the RawJsonEditor
      fallback guard, and `RecordField`'s five `useState` above its widget /
      specialized-editor early returns.
    - `MetadataPanel`: moved `if (!open) return null` below its three hooks.
    - `LayeredDiff`: moved the `if (code == null)` guard below the two `useMemo`s
      and made `rows` null-safe (`code == null ? [] : computeDiffRows(...)`).
    - `ViewPreview`: hoisted the `object-view` `schema` `useMemo` above the three
      render branches (the earlier branches shadow it locally).
  - **`react-hooks/static-components` (12)** — icon/inspector/preview lookups
    (`getIcon`, `typeIcon`, `kindIcon`, `getMetadataPreview` / `…Inspector` /
    `…DefaultInspector`) are stable registry references → justified scoped disables.
  - **`no-useless-assignment` (3)** — dead `= null` / `= []` initializers in
    `marketplaceApi` and the two ratchet tests (the only fall-through paths
    reassign first).
  - **`@typescript-eslint/ban-ts-comment` (2)** — the `lucide-react/dynamic.mjs`
    imports in `getIcon` / `widgets` no longer error under the build's `tsc`, so
    the stale `@ts-ignore` directives are removed outright.
  - **stale `eslint-disable` (1)** — removed a `@next/next/no-img-element`
    directive in `AgentPreview` whose plugin isn't loaded in the flat config.

- 2b17339: fix(list): keep the injected `owner_id` out of the leading auto-derived columns

  A view-less object's default list columns are derived from the object's field
  order. The framework's `applySystemFields` spreads its injected
  system/audit/ownership fields to the FRONT of that order and stamps them
  `system: true`; `owner_id` is deliberately non-hidden and non-readonly
  (ownership is reassignable), so the old name-based exclusion lists in
  `ObjectGrid` and `InterfaceListPage` — which never listed `owner_id` — let it
  through as column #1 on many showcase list pages (e.g. `showcase_field_zoo`).

  Default-column derivation now classifies system fields via the shared
  `isSystemManagedField` helper, which branches on the spec `system` flag (the
  single source of truth stamped by the registry) with a name-set fallback that
  includes the ownership/tenancy FKs. `owner_id` is pushed to the end
  (`ObjectGrid`) / excluded from the business columns (`InterfaceListPage`), so
  auto-derived lists lead with business fields again and pick up future injected
  fields without editing a name list. Also declares the `system` flag on the
  `@object-ui/types` field metadata.

- 31b77d4: **Add the explicit `engine-owned` lifecycle bucket (tracks framework ADR-0103 addendum / #3343).** The framework split the overloaded `managedBy: 'system'` bucket by promoting the engine-owned case to its own enum value; this mirrors it in the UI type + runtime + badge.

  - **`@object-ui/types`** — `ManagedByBucket` union and `MANAGED_BY_BUCKETS` gain `'engine-owned'` (canonical order: `platform, config, system, engine-owned, append-only, better-auth`). The union stays closed, so every consumer that missed the new value is a compile error.
  - **`@object-ui/core`** — `resolveCrudAffordances` gains the `engine-owned` default row (identical all-locked matrix as `system`/`append-only`), so `isObjectInlineEditable` / the grid + form gates treat it as read-only automatically.
  - **`@object-ui/app-shell`** — the `ManagedByBadge` renders `engine-owned` with the same read-only "System-managed" copy as a locked `system` object (reuses the existing `managedByBadge.system` i18n key — zero translation churn; the distinction is at the schema level, not the user-facing string), and `resolveManagedByEmptyState` reuses the `system` engine-owned empty state.

  Behaviour-preserving: `engine-owned` resolves to the same locked affordances `system` did by default, so nothing about how a locked object renders changes — the value just makes the schema self-documenting. New unit coverage for the bucket in `resolveCrudAffordances` / `isObjectInlineEditable` / `MANAGED_BY_BUCKETS` / the empty-state helper.

- 6d4fbe6: **Consolidate the `managedBy` lifecycle-bucket logic into one shared source of truth (follows framework ADR-0103).** The bucket taxonomy was hand-mirrored in several places — `crudAffordances.ts`, `ManagedByBadge.tsx` (its own `Bucket` union + `isWriteOptedIn` + the writable-system derivation), and `plugin-detail`'s `record-details.tsx` (`NON_EDITABLE_BUCKETS`, duplicated because it can't depend on app-shell) — a drift risk, and the object-schema `managedBy` type was open-ended (`(string & {})`) so unknown buckets slipped through and silently defaulted to fully-editable.

  - **`@object-ui/types`** now owns the closed `ManagedByBucket` union (+ `MANAGED_BY_BUCKETS`), and `ObjectSchema.managedBy` is tightened from `'platform' | 'better-auth' | (string & {})` to that union — unknown buckets are now a type error at authoring time.
  - **`@object-ui/core`** now owns the React-free runtime logic — `resolveCrudAffordances`, `isWriteOptedIn`, `isSystemWritable`, `isObjectInlineEditable` — reachable by every UI package including `plugin-detail` (which could not import app-shell).
  - **`app-shell/utils/crudAffordances.ts`** is now a thin re-export of `@object-ui/core` (existing imports keep working); `ManagedByBadge` consumes the shared `isSystemWritable`; `plugin-detail` `record-details.tsx` replaces its hand-mirrored `NON_EDITABLE_BUCKETS` with `isObjectInlineEditable`.

  Behavior-preserving — all existing affordance/edit-gate tests stay green; the shared module adds direct unit coverage (including the previously-untested `isSystemWritable` derivation). Translated copy (badge variants, empty-state messages) stays in app-shell.

- 0a3710b: **Finish the `managedBy` / `userActions` de-dup — one parser for the override shape (completes objectui#2712, framework#3343).** #2712 consolidated the bucket _union_ + affordance _set_ mirrors but left four surfaces still parsing the `userActions.{create,edit,delete}` override shape by hand. They now all route through the shared `@object-ui/core` policy, so no package re-implements the boolean / #2614-object-form parse locally.

  - **`@object-ui/core`** promotes the internal `normalizeOverride` to the exported **`normalizeUserAction(v, base)`** (the one parser) and adds **`userActionPredicates(v)`** for per-record CEL predicate extraction.
  - **`app-shell/utils/managedByEmptyState.ts`** — the writable-`system` create check and its local `EmptyStateUserActions` interface are replaced by `resolveCrudAffordances({ managedBy, userActions }).create`.
  - **`plugin-grid/rowCrudAffordances.ts`** — the local `isOptedOut` / `predicatesOf` helpers (and duplicated `RowCrudUserAction` / `RowCrudPredicates` types) fold into `normalizeUserAction`; the historical type names stay re-exported for compat.
  - **`plugin-detail/RelatedList.tsx`** — its inline `predicatesOf` fold into `userActionPredicates`.
  - **`plugin-form/ObjectForm.tsx`** — the hand-rolled `managedBy !== 'platform'` blanket lock + `userActions` unlock is replaced by the resolved affordance for the current mode (`edit` / `create`), the **same** `resolveCrudAffordances` contract the detail (`isObjectInlineEditable`) and grid surfaces use.

  Behavior-preserving for `platform` / `system` / `append-only` / `better-auth`, with one deliberate alignment: an admin-editable **`config`**-bucket object (e.g. `sys_webhook`, `sys_permission_set`) is now editable in `ObjectForm` — it was previously over-locked as "non-`platform`", while detail/grid already treated it as editable (`config` resolves `edit: true`). New unit coverage for the shared parser and the config / create-mode form gate; all existing affordance/edit-gate tests stay green.

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

- Updated dependencies [0318118]
- Updated dependencies [1c8935a]
- Updated dependencies [af1b0db]
- Updated dependencies [8b8b744]
- Updated dependencies [7cf4051]
- Updated dependencies [803558e]
- Updated dependencies [aefcf39]
- Updated dependencies [8c1e415]
- Updated dependencies [0ea5036]
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
  - @object-ui/data-objectstack@16.1.0
  - @object-ui/types@16.1.0
  - @object-ui/react@16.1.0
  - @object-ui/auth@16.1.0
  - @object-ui/components@16.1.0
  - @object-ui/layout@16.1.0
  - @object-ui/collaboration@16.1.0
  - @object-ui/plugin-editor@16.1.0
  - @object-ui/permissions@16.1.0
  - @object-ui/providers@16.1.0

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

- 7a6837c: Studio package-create dogfood follow-ups (objectstack-ai/objectstack#2615):

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
    side, ADR-0086 P2 块 1). The **environment-admin** door (no `packageId`) is
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
  framework backend shipped in objectstack-ai/objectstack#1390
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

  Refs objectstack-ai/objectstack#1890

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
