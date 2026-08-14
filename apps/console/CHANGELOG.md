# @object-ui/console

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

- 3b7d1cc: An unloadable app list no longer lands you on `/home` as though you had no default app — and the Applications page's Set-as-default / Disable / Delete now actually write

  Two defects on the same journey, reported together because the second is why the first had no workaround.

  **The landing.** `resolveLandingPath` reads a list of apps, and an empty list is a legitimate input with a legitimate answer: rule 3 sends you to `/home`, the multi-app launcher. What it could not see is _why_ the list was empty. A failed `GET /meta/app` produces exactly the same `[]` — `MetadataProvider.ensureType` catches and resolves an empty array, so nothing rejects and `loading` goes false — and the resolver then reported "this deployment has no default app" about a deployment it never managed to ask. The wrong answer did not stay soft, either: `Navigate … replace` rewrites `/` to `/home` in history, so a reload re-enters at `/home` and the `isDefault` branch never gets a second chance; if the session also turns out to be dead, the auth guard captures `/home` into `?redirect=%2Fhome` and honors it after sign-in. An error-state fallthrough should never be fossilized as user intent.

  `/` now resolves a landing only from an app list that is an _answer_. The distinguishing fact already existed on the metadata context and is used as-is — `getTypeStatus('app')`, the provider's own per-type load status — so no second dialect of loading or auth state is introduced, and the landing policy itself is untouched: every existing rule, including the empty-list fallthrough and the Setup-only case, still resolves exactly as before when the list genuinely loaded. While the list is unknown the console holds at `/` and re-asks the metadata layer once, so a transient failure heals on its own and a real outage settles on a screen that is at least not a claim about which apps exist.

  The originally reported chain had an earlier link that is already closed: before objectui#4042 the `/` route mounted the resolver with no guard above it, so an unauthenticated visitor ran the whole resolution against a list emptied by a 401. That entry is now guarded and the bare `/` is deliberately not captured as a redirect target, and both facts — plus the legitimate deep-link capture that must keep working — are pinned here for the first time.

  **The Applications page.** Set as default, Disable (and the bulk toggle) and Delete each showed a success toast having issued no request at all, then called `refresh()` — which re-rendered the unchanged server state underneath the confirmation, and is what made the stubs read as a working feature. Their `// TODO: Replace with real API call when backend supports app management` was measured against `@objectstack/client` 17.0.0-rc.6 and its premise is false: the write surface exists, is gated on `manage_metadata`, and is already how app schemas are persisted elsewhere in this console. All four handlers now await a real mutation and report success only afterwards; a refusal surfaces the server's own message. Set-as-default demotes the outgoing default before promoting the new one, so the landing cannot depend on the order the server lists apps in, and the bulk toggle counts the writes that actually landed rather than the size of your selection.

- e4d1c08: `resolveHostAppSegment` is published from `@object-ui/app-shell`'s package root, and the console's local copy of it is deleted

  Which app should host a framework-owned, app-INDEPENDENT page — the Approvals Inbox, the full inbox, an internal form's created record — is one hard-won definition, and `resolveHostAppSegment`'s docblock says so at length: prefer the app the user is in or last had open RE-CHECKED against the live active list, else their first active app, else the two last resorts. It lived in `app-shell/src/utils/appRoute.ts`, and `packages/app-shell` published only its package root, which re-exported `./utils` nowhere. So the definition was unreachable from every consumer outside the package.

  Something outside the package needed it anyway. objectui#4109 had to name a host app for the record an internal `/forms/:name` submit creates, could not import the resolver, and shipped a documented local subset instead: steps 1 and 2 only, returning `null` where upstream falls through further. That is the "two readers of one prose contract" shape this repo keeps paying for (#3367 / #3842) — the next edit to the resolution order lands on one copy — and the divergence was disclosed rather than smuggled precisely so it could be collected later. This is that collection.

  `resolveHostAppSegment` is now exported from the package root, alongside the two predicates it is defined in terms of (`appRouteSegment`, `filterActiveApps`), and the console's copy is gone: `createdRecordPath.ts` holds the URL shape and delegates the choice. The app record type it accepts is derived from the resolver's own signature rather than re-declared, so the call site cannot drift from it either.

  **Behaviour change on the created-record redirect.** Converging on the full resolver means the two cases the subset answered `null` for now name an app. An empty openable list with a preferred app keeps that preferred app unchecked — an empty list means "not loaded yet" at least as often as "this user has no apps", and demoting someone demonstrably rendering inside `/apps/{preferred}/…` would reintroduce the defect objectui#4074 removed. Anything else unresolvable — no apps and nothing preferred, or apps carrying neither `_packageId` nor `name` — lands on `setup`, the least-surprising last resort rather than a broken link. Concretely: an internal form submit that previously stopped on FormPage's in-place confirmation ("no record page to land on") now navigates to the record under the resolved app, which is the same answer every other record link in the console already gives. The write itself was never at stake, only where the user is put afterwards. The remaining `null` from `buildCreatedRecordPath` means what it always should have: there is no record to point at, because the caller has no object or no id.

- 90e792e: Internal `/forms/:name` renders inside the console shell, and an internal submit lands on the record it just created

  A `type: 'form'` action navigates to `/forms/:name` (`ActionRunner.executeForm`). That route was declared at the TOP level of the console route tree, a sibling of the app-shell routes, so clicking a button inside an app dropped the user onto a bare form — no header, no navigation, no way back — while the URL still said they were in the console. It now renders inside the console's layout for app-independent authed pages, the same chrome `/home` and `/organizations` use. The route itself is unchanged: deep links to it keep working, because the missing chrome was the defect, not the navigation.

  The second half is what happens after Submit. The post-submit default was `{ kind: 'thank-you' }` for both form modes, so a signed-in operator who had just created a record was shown the ANONYMOUS confirmation — "Your submission has been received" — with no link to the thing they had created. The default is now mode-aware: an internal submit navigates to the created record's page, while the public `/f/:slug` path keeps `thank-you`, which is the right answer for a visitor who has no console to be sent into. A form view that declares its own `submitBehavior` still wins in both modes, unchanged and untouched — the point of a default is that the corpus never has to opt out of a wrong one.

  Landing on the record needs the created record's id, and that comes from the spec-declared `CreateDataResponse = { object, id, record }` returned by `POST /api/v1/data/:object`. Only that one declared key is read: `record.id` carries the same value, but reading both would be a second de-facto contract for one fact. A response that names no id — or a workspace where no app can host the record's page — falls back to confirming the submit rather than navigating somewhere broken, since the record really was created and silence would be the worse answer.

  No authorable surface changed. The "land on the created record" behaviour is deliberately NOT a new `submitBehavior.kind`: the spec's union (`thank-you | redirect | continue | next-record`) is strict and stays exactly as it is, and nothing parses the new internal default out of metadata — it is only what the renderer does when an author declared nothing.

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

### Patch Changes

- a00d23c: API Console renders the Storage group again — its catalog key now names the canonical `file-storage` slot instead of the route

  The API Console's service-gated groups are keyed by canonical service-slot name, because the key is looked up directly in `/discovery`'s `services` map — and the framework keys that map by `CoreServiceName`. The storage group was keyed `storage`, which is the _route_ (`/api/v1/storage`), not the slot (`file-storage`). So the lookup missed on every host, and because a miss is indistinguishable from "no such service" the deliberate fail-closed branch (ADR-0076 D12) hid all three storage endpoints — upload, download, delete — on every deployment, whether or not a storage service was registered and healthy.

  The fail-closed posture was never the defect and is unchanged; only the key moves. The group's user-facing name stays `Storage` — that is the route's name, and it was never derived from the catalog key, so no display string and no i18n resource changes.

  The mis-key survived because nothing tied the catalog's keys to the vocabulary they are spelled in: a wrong key produces silence, not an error, and an empty group is exactly what a legitimately absent service looks like. A tripwire now derives that vocabulary from `@objectstack/spec` itself and asserts every service-gated catalog key against it, so a rename on either side fails a test instead of quietly emptying a group. Deriving it also surfaced two further keys that name no slot and therefore can never render — `workflow` (slot retired upstream) and `feed` (never a slot) — recorded as a documented exception set pointing at objectui#4303 rather than fixed here, since neither has a correctly-spelled name to move to.

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

- 3b4d78e: The Applications page's search box no longer takes the page out on the first keystroke when an app carries a non-string label

  `apps/console/src/pages/system/AppManagementPage.tsx` filtered on `(app.label || '').toLowerCase()`. `label` and `description` are `I18nLabel` in `AppSchema` — `string | Record< string, string >` in `@objectstack/spec` 17.0.0-rc.6 — so an authored non-string label is spec-legal metadata, and an object is **truthy**: the `|| ''` guard never fired for one, and `.toLowerCase()` received the object.

  ```
  TypeError: (l || "").toLowerCase is not a function
  ```

  That throw happened inside `filter` **during render**, so it took the whole page down rather than degrading search. It stayed invisible until someone typed, because `if (!searchQuery) return true` returns before either read — the page mounted perfectly with the very metadata that killed it one character later.

  Both reads now go through the resolver the rows already render with: `appTitle` (the single display-name helper objectui#4307 introduced in this file) for the label, and the identical `resolveKeyedI18nLabel(…, t)` call the description paragraph makes. This is a repair to one page's filter, not a new capability — but it does make search match what the operator can actually see: for objectui's keyed label form it now matches the pack's answer rather than the authoring `defaultValue`, and it matches `app.name` wherever the row heading itself falls back to it.

  Routing search through the render path also means it cannot drift out of step again. The inline locale map form (`{ en: 'Storefront', 'zh-CN': '店面' }`) is still resolved by neither path — the row heading falls back to the app name and search now matches on exactly that, instead of crashing on it — so when objectui#4163 widens the resolver, display and search gain the map form in the same commit.

  No first-party app ships a non-string app label today, so this was reachable through authored metadata rather than live in the shipped examples; the crash is real for anyone who authored one, and `AppSchema` accepts it with a green parse.

- d0c3b26: Every plain `<button>` now declares its `type`. HTML defaults an untyped button to
  `type="submit"`, so any of these buttons would submit the form it was composed into
  instead of running its own handler — a real risk for renderers (`drawer`, `tree-view`,
  `navigation-overlay`) whose placement inside a form is a JSON metadata decision. 114
  sites were converted to `type="button"`; no site was a genuine submit button, and the
  DOM is otherwise unchanged.

  The defect class is now closed mechanically by a new `object-ui/button-has-type` ESLint
  rule (error), so the next untyped button fails CI at write time rather than being found
  by a fourth audit round (objectui#4045, closing the objectui#3344 family).

- 25b9833: Console: restore `crypto.randomUUID` on insecure origins so list views stop crashing on LAN IPs

  `crypto.randomUUID` is exposed only in secure contexts (HTTPS or
  `http://localhost`). Reaching a dev box over plain HTTP from another machine —
  `http://192.168.x.x:4001/_console/`, the ordinary second-device flow — left the
  method undefined, and every unguarded caller threw
  `TypeError: crypto.randomUUID is not a function`, taking the console's list
  views into the ErrorBoundary.

  The console's HTML entry now installs an RFC 4122 v4 fallback built on
  `crypto.getRandomValues` (which is not secure-context-gated, so the entropy
  stays cryptographic). It runs as an inline classic script, synchronously during
  parse, so it precedes every bundled chunk. It is guarded on absence and never
  replaces a native implementation, so secure origins are unaffected; with no
  entropy source available it installs nothing rather than degrading to
  `Math.random`.

- 2a40f69: Retire two post-retirement dead surfaces (#4364, #4368). Both were measured at this
  branch point rather than taken from their cards, and one card's premise only half held.

  Breaking for anyone who typed against the removed declaration, marked `minor` per this
  repository's version-alignment convention (the major tracks `@objectstack`, never an
  API-break count):

  - `@object-ui/types` and `@object-ui/permissions` no longer export
    `ObjectLevelPermission`. It declared a second, parallel home for object-scoped grants
    (`{ object, actions, effect?, conditions? }`) that nothing constructed, accepted or
    read once `RoleDefinition.permissions` was retired (#4288) — its only remaining
    referents were its own definition and the two barrel lines. The wired home is
    `ObjectPermissionConfig.roles`, whose inner grant shape is declared inline; that is
    what the evaluator reads, and it is unchanged. `ObjectPermissionConfig`'s doc comment
    now records the retirement so the surface is not re-declared. (#4364)

  `PermissionCondition` was proposed for retirement on the same card and is **kept**: its
  premise ("only referent is `ObjectLevelPermission.conditions`") did not hold at this
  branch point. `evaluateCondition` in `@object-ui/permissions` takes it as a parameter
  type and implements all eleven of its operators under a 26-case suite. `PermissionEffect`
  is likewise untouched — `FieldLevelPermission.effect` still reads it.

  No behaviour change, no public surface change:

  - `@object-ui/console` drops `src/utils/metadataConverters.ts` and
    `src/services/MetadataService.ts`. Both were console-local duplicates of live
    `@object-ui/app-shell` modules and lost their last importer when the bespoke
    object-detail widgets were retired (#4365). Both had already drifted behind the live
    copies they duplicate — the console converter's `referenceTo` chain never read the
    server's `reference` key, and the console service predates the view cache-invalidation
    seam (#4373) — which is precisely the imitation trap the card recorded: an author
    grepping for "the converter" could land on the unexercised copy. The app-shell copies
    and their tests are untouched. (#4368)

- 6d8231c: A `type: 'form'` action fired from a record now EDITS that record instead of creating a duplicate

  `ActionRunner.executeForm` forwards the record an action was fired from as `/forms/:name?recordId=<id>`, but the console's internal form route never read that param. The only query params it consumed were the `prefill_` ones, so the route rendered EMPTY inputs, and its submit was an unconditional `POST /api/v1/data/:object` — an insert. An "edit this record" action therefore opened a blank form and, on Submit, created a second record while leaving the original untouched. In the showcase app: open any Task, click **Log Time**, fill it in, Submit — a NEW Task appeared. Until objectui#4109 the damage was hidden behind the anonymous "Your submission has been received" panel; once an internal submit started landing on the record it wrote, the duplicate became visible immediately.

  `?recordId=` now selects the whole read/write pair. The route loads the record with `GET /api/v1/data/:object/:id`, prefills the inputs with its stored values, and saves with `PATCH /api/v1/data/:object/:id` — the verb the data plugin declares (`plugin-rest-api.zod.ts`), the one `packages/rest` registers, and the one every other update client in this workspace already spells. After a successful save the user lands back on the record they edited.

  A `recordId` the route cannot honour now fails closed. A record that 404s or 403s, a payload whose object contradicts the form's target, and a present-but-blank `?recordId=` each render the form's error state; none of them falls back to create mode, because a blank form whose submit inserts a duplicate is this bug's exact harm and silently degrading into it would just re-arm it. A `recordId` naming a record of a different object is not found under the form's own object, so it takes the same refusal path.

  When a URL carries both a `recordId` and `prefill_` params, the explicit params win for the fields they name and the record's stored values fill the rest — a producer that forwards both is expressing intent, and the per-field instruction is the more specific one. Stored nulls and empty strings count as real values and beat a field's create-time `defaultValue`, so opening an edit form never silently proposes a change the user did not make.

  Two surfaces are deliberately untouched. Create mode — no `recordId` — behaves exactly as before, and the public `/f/:slug` path ignores `recordId` entirely: an anonymous visitor controls the URL, so honouring it there would turn a public form into an arbitrary-record reader and writer. In `@object-ui/app-shell` only the URL-param registry's documentation changed, recording that `recordId` now has a second reader on a route that can never match the same URL as the record drawer's.

- 3e19fe7: i18n copy: one ellipsis glyph across the ten packs, `usted` in the es draft-preview empty state, and a pt sentence that stops contracting `de` onto its own hole

  Three locale-copy defects that no gate could see, because all three are _value_ defects on keys whose names, placeholders and key sets were already correct.

  **One ellipsis (objectui#3878).** `en` ended 33 values with three ASCII full stops (`Loading...`, `Ask anything...`) and 110 with the typographic ellipsis `…`, and the nine translation packs had copied `en` value by value — so a user could read both glyphs on one screen: `common.loading` beside `dashboard.loading`, `console.ai.askAnything` beside its own panel's siblings. All ten packs now spell it `…` (U+2026), per the maintainer-authorized consistency pass registered on objectstack#6015. 312 pack values changed: 34 in `en` (the 33 trailing plus the one mid-sentence `collaboration.commentPlaceholder`) and 278 across the nine. Eleven inline `defaultValue` call sites were re-synchronised with the new `en` text, which `scripts/check-i18n-call-site-keys.mjs` requires byte-for-byte.

  The convention is now pinned so the split cannot regrow: `packages/i18n/src/__tests__/ellipsis-glyph-3878.test.ts` fails, by key name, on any value in any of the ten packs that holds three ASCII full stops. It is deliberately wider than "a trailing `...` in `en`", because the census showed the narrow rule would have shipped with two holes in it — `collaboration.commentPlaceholder` puts the ellipsis mid-sentence, and `list.loading` had the packs wrong while `en` was already right, which no `en`-only rule can see.

  Fifteen module-local **no-provider fallback** entries were moved with the packs, across `useCollaborationTranslation`, `useFieldTranslation`, `useDetailTranslation`, `ObjectGrid`, `KanbanImpl`, `data-table` and `ConnectionStatus`. Those maps exist to render when no `LocalizationProvider` is mounted, and each one's own docblock requires it to stay byte-identical to the `en` pack — a requirement objectui#3440 already enforces mechanically for the collaboration map. Leaving them behind would have made the provider-less path disagree with the provider path on ten keys.

  **es `usted` (objectui#3875).** `preview.empty.notReadyDescription` said `Revisa la conversación` — the tú imperative — in a namespace that is otherwise 23:1 usted, and it renders _underneath the usted draft-preview banner at the same moment_, not before or after it. `Revisa` → `Revise`; nothing else in the sentence carries a register. The neighbouring `approvalsInbox` namespace is legitimately tú and was left alone.

  **pt contraction (objectui#3877).** `ConcurrentUpdateDialog` splits `detail.concurrentUpdateDescription` on `{{field}}` and renders a bolded label in the gap, and pt left a bare `de` in front of that gap. When the multi-field conflict branch passes the record label (`este registro`), Portuguese users read `de este registro` — a contraction error every native speaker sees, and one that no spelling of the leaf value could fix (`deste registro` renders `de deste registro`). The pt sentence is rewritten so the hole is preceded by the verb `afeta` instead of any preposition, which closes the whole class rather than trading `de` for an `em` or `a` that contract just as hard. pt only; `en` is unchanged.

  No behavior, no keys added or removed, no placeholder changed.

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

- 66fb4fa: The console's language menu now asks the app which locales it actually ships, instead of always offering the same ten.

  `LocaleSwitcher` built its items from a module-level `LANGUAGES` constant — exactly the ten codes `@object-ui/i18n` ships packs for — and never consulted the app, even though `GET /api/v1/i18n/locales` has been serving that list all along. It failed in both directions at once. An app shipping a locale outside those ten (`th`, a regional `pt-BR`) had no way to be selected from the console: the bundle could be complete and lint clean, and the menu simply had no entry for it. An app shipping only `en` and `zh` still listed all ten, so picking 日本語 handed the user the console's own chrome in Japanese with everything app-authored in the fallback language — a half-translated UI its author never opted into.

  The menu is now the **intersection**: the app's own locale list ∩ what the renderer can actually resolve (built-in packs, `config.resources`, and — for an app that wires a dynamic `loadLanguage` loader, which is how the console gets its packs — the locales that loader can fetch). Both failure directions close in the same change: an app-shipped locale becomes offerable, and locales the app does not ship disappear. The endpoint is reached through a new `loadLocales` prop on `I18nProvider`, wired exactly like the existing `loadLanguage`: the app owns the transport, the provider owns what is done with the answer. An app that does not wire it keeps today's menu unchanged.

  **The restore validation widened in lockstep, because otherwise this fix would have minted the next bug.** A restored language was validated against "the locales this provider can produce" — built-in packs plus `config.resources` — a bound that was correct only for as long as the menu offered exactly the built-in ten. The moment the menu grows to the app's real list, a locale the user can now pick is a locale that bound rejects, so a user-picked app locale would have been purged on the next page load. It now also accepts a locale a wired dynamic loader may be able to fetch, and the bound stays honest rather than absent: only well-formed BCP-47 tags qualify (`constructor`, `__proto__`, `en_US` are still rejected, as is any stored locale in an app with no loader), and the app's own locale list adjudicates the choice for real once it arrives — a locale the app has since dropped is reverted and purged rather than left locking the UI to a language with no translations.

  Labels come from the built-in native names where they exist (`中文`, `日本語`, … are unchanged) and from `Intl.DisplayNames` for everything else, so an app locale is named in its own language rather than by its code. The endpoint's own `label` is deliberately not used for display: the server sets it to the code echoed back, which would have put `th` in the menu where `ไทย` belongs.

  While the app's list is in flight the switcher renders nothing, following the sibling menus in the same folder — the ten never flash past on an app that only ships two. When there is no backend, the endpoint fails, or the app answers with nothing this renderer can produce, the built-in ten remain as the offline fallback, so the menu is never empty and never unusable.

- 275d7df: Retire the dormant bespoke object-detail page factory and its seven widgets

  `buildObjectDetailPageSchema()` had zero callers. Its only consumer was the registry-driven `MetadataDetailPage`, deleted when the console moved onto the metadata-admin engine; the factory outlived it by months as code no route could reach. The seven widgets it fed — `object-detail-tabs`, `object-properties`, `object-field-designer`, `object-relationships`, `object-keys`, `object-data-experience`, `object-data-preview` — were still registered in `ComponentRegistry` at startup, so they were reachable in principle by any schema naming those types, and in practice by none: nothing in the repository produces one.

  That unreachability is also why 60 lines of hardcoded Chinese UI copy sat in `objectDetailWidgets.tsx` and `ObjectDetailTabsWidget.tsx` against the English-only rule without any gate seeing them — the strings were bare literals, never `t()` keys, and all three i18n gates judge keys. Translating copy that no user can reach, on a surface with no future, was the more expensive of the two exits; the maintainer ruled REMOVE (objectui#3731 / #3736) and both cards close together.

  Deleted: `schemas/objectDetailPageSchema.ts`, `components/schema/objectDetailWidgets.tsx`, `ObjectDetailTabsWidget.tsx`, `ObjectFieldDesignerWidget.tsx`, `registerObjectDetailWidgets.ts`, and the `main.tsx` registration import. No user-visible behaviour changes, because no route rendered any of it. The `skills/objectui/guides/console-development.md` chapter that positioned the factory as the bespoke-editor recipe now points at the live specimen (`PermissionMatrixEditPage`) instead, and the retired names are recorded in that guide's "Retired names" table.

- 36a4124: Settings save: render the fail-closed crypto refusal as its own state instead of a generic save failure

  A deployment with nothing able to encrypt a declared-secret setting refuses the write, and
  since objectstack#8396 it says so in its own wire envelope — `SETTINGS_CRYPTO_UNAVAILABLE`,
  with `error.details` locating the refused `{ namespace, key }` and `error.message` carrying
  the operator prescription. The console read none of it: the code fell through to the generic
  error path, where the field-error extractor finds no `details.fields` array and returns null,
  so nothing was marked and the whole refusal collapsed into one transient toast reading "save
  failed". The admin was told the save did not work; that the DEPLOYMENT cannot encrypt, and
  which key it refused, was on the wire and thrown away.

  `SettingsView` now branches on the code the way it already does for `SETTINGS_LOCKED`: it
  names the refused key as `namespace.key` from the declared `error.details` slot, and renders
  the server's prescription verbatim in a persistent panel — the server owns that copy, so the
  console frames the refusal but never restates how to fix it. The draft is kept, so the value
  is not lost while the deployment is reconfigured, and the refusal clears when its claim can
  actually have become false: a new save attempt, a save that succeeds, a discard, or a reload.

  The value itself is never rendered — the envelope locates the refusal and deliberately does
  not carry the secret, and the console does not re-introduce it from the draft it is holding.
  `SETTINGS_LOCKED` and `SETTINGS_VALIDATION` are untouched, and an unrecognized code still
  takes the generic path.

- b3f665b: `/setup` is a real address again — the console gets a stable deep link into platform administration instead of bouncing you back to home

  Opening `/_console/setup` landed on `/_console/home`. System settings had no direct URL at all: the only way in was clicking the 「系统设置」 card on the home launcher, which meant the entry point could not be bookmarked, could not be pasted into a support runbook, and was asymmetric with Studio, whose front door has been stable for a while.

  The route was never missing — it was occupied. `/setup` mounts the first-run owner-bootstrap wizard (ported here when the Account SPA was retired), and that page evicts everyone it is not meant for: a signed-in visitor via `window.location.assign('/')`, which the landing resolver then turns into `/home` on any multi-app deployment. So the bounce was the wizard doing its job at a URL that had quietly acquired a second, more common meaning.

  `/setup` now decides between the two, on the condition the wizard itself already probes — whether the deployment has an owner (`GET /api/v1/auth/bootstrap-status`). No owner yet: the wizard, unchanged. Otherwise: the platform-administration deep link. A live session short-circuits the probe entirely, because `hasOwner: false` cannot be true while somebody is signed in — which also keeps a failed probe from re-creating the bounce it is meant to remove. The verdict is latched for the lifetime of the mount, because `signUp()` flips the session to authenticated while the wizard is still renaming the bootstrap organization, and re-deciding on that flip would unmount the wizard mid-submission.

  The destination is read from metadata rather than spelled out. `SetupRedirect` (new, exported from `@object-ui/app-shell` alongside `SystemRedirect`, with its policy available as the pure `resolveSetupAppPath`) resolves the Setup app through the same `appRouteSegment()` helper the home launcher's app cards use, and forwards to the app ROOT — so the page you land on is whatever `AppContent` already resolves as that app's landing item, not a second copy of that policy that would drift the next time Setup's navigation is re-ordered. Search and hash carry across the hop, as they do for `SystemRedirect`.

  Two edges are handled rather than papered over. An unauthenticated deep link now goes to `/login?redirect=%2Fsetup` through the console's existing auth-redirect contract — router-derived, so it stays correct under a `<base href>` mount — and lands back on `/setup` after signing in; previously it reached a bare `/login` and the deep link was dropped. And a viewer whose metadata contains no Setup app (the common cause is not a broken build but a missing `setup.access` permission, which filters the app out server-side) gets the shell's ordinary "App not available" screen, with its retry and its one-shot metadata re-check — never a silent landing on home, and never the bare `/apps/setup` pseudo-route, which would have resolved to whichever app happens to be the default.

  `/_console/studio` was checked for the same asymmetry and needed no change: bare `/studio` is a declared front door rendering the builder landing, and `/studio/:packageId` already redirects to its Data pillar.

- 1f34b38: The first-run setup wizard no longer drops a brand-new owner outside the console

  On a console served under a mount — `/_console/`, which the framework CLI configures for every embedded deployment by injecting a `<base href>` — finishing the first-run owner bootstrap landed the new owner on the ORIGIN root instead of the console. Both of `SetupPage`'s exits navigated to a bare `/`: the success path after the account is created and the bootstrap organization renamed, and the bounce that sends an already-signed-in visitor away. `window.location.assign` does not go through React Router, so its `basename` never applied and a root-relative `/` left the SPA. It is the worst possible moment for a dead end — the first screen after creating the account, on a deployment that by definition has no other account to recover with.

  Under the default `/` mount the prefixed and unprefixed spellings are identical, which is why no standalone `os dev` run ever surfaced this.

  Both exits now go through the console-mount helper `LoginPage` already used for exactly this, so they land inside the SPA under every mount. They stay full-page navigations deliberately: the console shell mounts its metadata tree as soon as auth _resolves_ rather than when it authenticates, and re-keys it only on language, so the app list read while nobody was signed in would survive a router navigation and leave the new owner in an appless console. Tearing the document down is what guarantees the console rebuilds with the session.

  The helper itself was module-private to `LoginPage` and had already been copied verbatim into `RegisterPage`. It now lives in one place with all three auth surfaces importing it, so the next mount fix lands once rather than three times. `LoginPage` and `RegisterPage` behaviour is unchanged, and pinned as unchanged across all three mount configurations.

- 234238e: fix(console): a Setup-only environment lands on `/home`, not Setup's all-zero System Overview

  A new builder arriving on a just-created environment (platform SSO, no explicit
  target) landed on Setup's **System Overview** — a platform-health/audit
  dashboard reading all zeros, because a fresh environment has no audit history
  yet. The intended first screen is the environment's own home: build with AI,
  start from a template, Your apps.

  The path was `resolveLandingPath`'s rule 2. Measured end to end:

      /  →  RootLandingRedirect  →  resolveLandingPath([setup])
         →  rule 2 "single visible app"  →  /apps/setup
         →  AppContent.resolveLandingRoute() → the app's first nav item
         →  dashboard/system_overview

  Rule 2 itself is right — a one-app PRODUCT deployment should not have to click
  through a one-tile launcher. Setup is not that app: it is the platform
  administration console that `@objectstack/platform-objects` ships into every
  deployment, so "the only app this viewer can see is Setup" means _this
  environment has no product apps yet_, not _Setup is the product_. Under ADR-0075
  the environment layer's home is the environment's own responsibility, so that
  case now resolves `/home`.

  Deliberately narrow — everything else is byte-identical:

  - a declared landing still wins (rule 1, `isDefault`, untouched): an admin
    console that genuinely wants Setup first says so, and gets it;
  - a one-app product deployment still lands in its app;
  - `[product, setup]` still resolves `/home` exactly as before — Setup is
    excluded from the single-app _outcome_, never from the visible _count_;
  - the `/setup` deep link is unchanged: `/` is "an arrival with no target",
    `/setup` is an explicit one, and it still resolves into Setup.

- 9461dd3: Form actions no longer carry a record id across an object boundary (#4292).

  `ActionRunner.executeForm` forwarded `/forms/:name?recordId=<id>` unconditionally,
  and that URL says nothing about which object the id belongs to — so the form route
  resolved it against the FormView's own target object. When an action fired from a
  record of a DIFFERENT object and ids collide across objects (per-table integer
  keys), the form silently prefilled and, since the route learned to honour the param,
  `PATCH`ed a same-id record of the wrong object.

  - **Producer**: the id is forwarded only when the firing context record's object
    (`context.objectName`) matches the target view's object; on a mismatch no id is
    forwarded, preserving create semantics. When it IS forwarded, the object travels
    with it as `?recordObject=`.
  - **Consumer**: `/forms/:name` refuses — no record read, no write — when
    `recordObject` disagrees with the FormView's object. A URL without the param
    behaves exactly as before, so existing deep links are unaffected.
  - @object-ui/sdui-parser@17.5.0
  - @object-ui/react-runtime@17.5.0

## 17.4.0

### Patch Changes

- 28c3856: Register `approvals:inbox` as a component ref, and stop sending Home's "pending approvals" card into the setup app (objectstack#7231).

  The Approvals Inbox had no addressable identity: nothing in any app's navigation metadata pointed at it, and every entry to it was a hardcoded path. `HomePage`'s action-center card spelled `/apps/setup/system/approvals`. That path is not wrong about the page — `system/approvals` is mounted as both `extraRoutes` and `extraRoutesNoApp`, so `/apps/{any app}/system/approvals` has always resolved — it is wrong about the app. A business user with approvals waiting but no access to `setup` followed the only entry Home offers them into the shell's "App not available" guard.

  Two changes, one additive and one corrective:

  - `approvals:inbox` now resolves in the component registry to the Approvals Inbox page, so a `{ type: 'component', componentRef: 'approvals:inbox' }` nav item renders the full inbox at `/apps/{app}/component/approvals/inbox` — tabs, drawer, decision actions and record deep links all scoped to `{app}`. Both mount paths are relative routes under `/apps/:appName/*`, so the page reads the same `:appName` and the same `?request={id}` deep link either way. The standalone `system/approvals` route is untouched and stays the target of server notification and email links; the registry key is purely additive indirection, so the approval surface can be rebuilt later behind the same key without any navigation metadata changing.
  - The Home card now navigates within the app the user last had open, re-checked against their live active-app list so a remembered app that has since been deactivated is not resurrected as a dead link, falling back to their first available app. `setup` survives only as the last resort for an app carrying no addressable segment at all — the zero-app workspace never reaches this producer, because Home returns its welcome empty state before the action center exists.

- 7883c02: Send the console host's legacy URL redirects straight to the canonical metadata-admin routes instead of routing them through the deprecated `component/metadata/resource` alias (objectui#3639).

  `apps/console`'s `ObjectRedirect` and `MetadataRedirect` rewrote `system/objects[/:name]` and `system/metadata[/:type[/:name]]` onto `…/component/metadata/resource[/:name]?type=:type`. app-shell declares that spelling as a legacy _alias_, not a page: its route element is `LegacyMetadataRedirect`, which immediately navigates on to `…/metadata/:type[/:name]`. Every one of those URLs therefore took two `<Navigate>` hops (plus a re-render) to reach a destination the host could name directly — and it was this indirection that carried `sys-objects` into the zero-app blank screen fixed in objectui#3610, since the alias was the leg that branch did not recognise.

  Both redirects now construct `…/metadata/:type[/:name]` (and `…/metadata` for the typeless directory arm) themselves. The endpoints are unchanged, byte for byte, including the alias hop's own percent-encoding of `:type` and its verbatim pass-through of `:name`; only the intermediate hop is gone. The alias routes stay declared exactly as they were — bookmarks, external links and the setup left-nav still arrive on them and are still forwarded — this change only stops the console feeding its own traffic through them.

  Also corrects four docblocks that described the alias as "the engine route", in `apps/console`'s two redirects and in app-shell's `datasource` resource registration and page. That wording is not merely stale: the objectui#3610 dispatch read this chain and concluded `component/metadata/resource` was the canonical spelling, which is the exact opposite of what the route table says.

- d2fd044: Point the last four navigation producers at the canonical metadata-admin routes instead of the deprecated `component/metadata` alias, removing a redirect hop from each (objectui#3660).

  The System hub's "Metadata" and "Datasources" cards aimed at `…/component/metadata/directory` and `…/component/metadata/resource?type=datasource`, and the `sys-datasources` entry in both `AppSidebar.systemFallbackNavigation` and `UnifiedSidebar.homeNavigation` spelled the latter too. app-shell declares those spellings as legacy _aliases_, not pages: their route element is `LegacyMetadataRedirect`, which immediately navigates on to `…/metadata` and `…/metadata/datasource`. Every click on any of the four therefore paid a redundant hop plus a re-render to reach a destination the navigation could name directly. All four now name it.

  The landing pages are unchanged, byte for byte — the new URLs are exactly what the alias hop was already computing (`datasource` percent-encodes to itself, and neither producer carried a query or hash beyond the `?type=` the alias itself consumed). Only the intermediate hop is gone.

  The alias routes stay declared in both `AppContent` branches, untouched: bookmarks and external links still arrive on them and are still forwarded. This completes objectui#3639, which corrected the console host's two redirects and enumerated these four as the remainder.

- c1a18ed: System Hub: a card count that failed to load no longer renders as `0`

  Each count on the System Hub fetched one object and caught its own failure with
  an empty page, so a 500, a 401, a 403 or a dropped connection all produced the
  same confident `0` as a table that really is empty — no error, no retry, and no
  way to tell the two apart. The most reachable case was a permission denial on a
  single object: an administrator who may open the hub but cannot read
  `sys_audit_log` was shown "0 entries" rather than being told anything at all.

  A failed lookup now leaves that card's count unknown, and the badge — which
  already renders only for a known count — is omitted, so the card shows no
  number instead of a wrong one. The catch stays on each call rather than around
  the batch, so one object's failure blanks only its own card and the cards beside
  it keep the real numbers they received.

  Unchanged: an object the backend does not have still counts `0`. The adapter
  resolves an unregistered object as an empty page by design (callers read empty
  as "feature unavailable"), so that never was an error and is not treated as one
  here.

- 278f57c: Count System Hub's Organizations card through `sys_organization`, the object the framework actually registers — it asked for `sys_org`, which does not exist, so the card read `0` on every deployment (objectui#3670).

  The failure was silent by construction. A missing object answers `404 OBJECT_NOT_FOUND`, and `ObjectStackAdapter.find()` absorbs that on purpose — it caches the name in `missingResources` and resolves `{ data: [], total: 0 }` so callers can treat an uninstalled collection as "no rows". The hub renders `data.length`, so a name the framework never had produced a perfectly ordinary `0`, indistinguishable from a workspace that genuinely has no organizations — which no single-org deployment ever is, since `sys_organization` always holds at least one row. The `.catch` on each call never even saw the 404; it only ever covered non-404 rejections.

  The other three counted names were checked against the framework's object registry and are correct as spelled: `sys_user`, `sys_position`, `sys_audit_log`.

  The Permissions card is **not** fixed here and still reads `0`. Its query names `sys_permission`, which the framework also does not have — it splits that surface into `sys_capability` (lineage: its own docblock says "named `sys_capability`, not `sys_permission`") and `sys_permission_set` (function: the admin-managed grant container). Both would render, so choosing one would silently bind the card to a surface nobody picked; that decision is open on objectui#3655. Until it lands the gap is held visible by a MEASUREMENT case in the page's test rather than quietly re-aimed.

- cc95c2c: Point System Hub's Permissions card — both its link and its count — at `sys_permission_set`, closing the last of the five `system/*` navigation targets (objectui#3655).

  Four of those URLs became redirects in an earlier change; `system/permissions` was deliberately held back, and so was the count beside it, because the framework splits what this console calls "Permissions" into two Setup entries and picking one would have silently bound every click, bookmark and badge to a surface nobody chose:

  - `sys_capability` — ADR-0066 layer 1, the definition registry of "what can be done". Its own docblock notes it is what the ADR "loosely floats" as `sys_permission`, which is the name the retired page and the count query both used, so lineage pointed here.
  - `sys_permission_set` — ADR-0066 layer 2, the grant container the permissions docs call "the only capability container" (object CRUD, field security, access depth, system capabilities), so function pointed here.

  It is decided as `sys_permission_set`: the card reads "Manage permission rules and assignments", and rules-and-assignments is layer 2 — a capability is what a permission set references by name, not what an administrator is assigned. Two user-visible consequences:

  - `/apps/:app/system/permissions` now forwards in one hop to `/apps/:app/sys_permission_set` instead of being rewritten to `…/system/record/permissions` and rendering a record detail page for an object literally named `system` — a dead link that read as a backend fault.
  - The Permissions card's badge shows the real number of permission sets. It previously counted `sys_permission`, an object the framework does not register; the adapter absorbs that `404` into an empty page on purpose, so the card printed a confident `0` no administrator could tell apart from "there really are none".

  Recorded as a transitional alias. Retiring this hand-written card wall along with the hub (already `@deprecated` in favour of the metadata-driven navigation) remains open and does not conflict — a redirect keeps old bookmarks resolving either way.

- 9961df2: Declare the retired `system/{users,organizations,roles,positions}` console URLs as redirects onto the framework-owned system objects (objectui#3655).

  `SystemHubPage`'s cards and both sidebars' `sys-*` cluster emit five `/apps/setup/system/…` targets. Four of them were real routes until `apps/console` was slimmed for third-party customisation, which deleted the bespoke wrapper pages because "these objects are now contributed by framework plugins … and resolved via the generic `/apps/setup/<object_name>` route" — but the producers were never retargeted and nothing redeclared the URLs. All five fell through to app-shell's tail, where the failure they got depended on how long the word was, because `ShorthandRecordRedirect` treats any URL-safe segment of 6+ characters as a record id:

  - `users` (5) and `roles` (5) rendered "Page not found".
  - `organizations` (13) and `positions` (9) were rewritten to `…/system/record/<word>` and rendered a record detail page for an object literally named `system` — the worse of the two, because it reads as a backend/data problem rather than a dead link.

  Each now forwards in one hop to the object the framework's own Setup navigation names: `sys_user`, `sys_organization` (the list entry — the record-scoped one needs a runtime `{current_org_id}` a static redirect cannot resolve), and `sys_position` for both `roles` and `positions` (ADR-0090 D3 renamed `sys_role` to `sys_position`, so the sidebar's "Roles" and the hub's "Positions" are one surface in two vocabularies). Same shape as the `system/objects` and `system/metadata` redirects beside them: the URL is translated, the deleted page is not resurrected, and the navigation producers are untouched.

  `system/permissions` is deliberately left as it was. The framework splits what this console calls "Permissions" into two Setup entries — `sys_capability` and `sys_permission_set` — and picking one here would silently commit every click and bookmark to a surface nobody chose. Its unchanged landing is pinned in the tests so the gap stays visible.

- Updated dependencies [d11996e]
  - @object-ui/react-runtime@17.4.0
  - @object-ui/sdui-parser@17.4.0

## 17.3.0

### Minor Changes

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

- 7d0c6de: Settings pages read the declared `{ success, data }` response envelope, so the
  whole Setup → Configuration section works again against a framework#3843 server
  (objectui#3366).

  `service-settings` moved all five `/api/settings` responses into the platform
  envelope and its changelog named the cost for callers that do not go through
  `@objectstack/client`: "Raw `fetch` callers must add one hop: `body.data`." The
  console's settings client is one of those callers and never took the hop, so on
  17.0.0-rc.3 it handed the envelope to the views:

  - every namespace page (localization, company, branding, auth, mail, sms,
    storage, AI, knowledge base, feature flags, data lifecycle) hit
    `Object.entries(payload.values)` on an object with no `values`, threw
    `Cannot convert undefined or null to object`, and went to the error boundary;
  - the "All settings" hub read `manifests` off the envelope, got `undefined`,
    and rendered "no settings are registered" while the server was answering 11
    manifests — a soft failure that reads as a plugin bug;
  - a save's read-back merged nothing, leaving stale values under a success toast;
  - an action's verdict was not where the client looked, so its `message` and
    `severity` were dropped and the toast read the bare HTTP status text.

  ## What changed

  - `jsonOrThrow` unwraps the envelope with the exact predicate
    `ObjectStackClient.unwrapResponse` uses — `success` is a boolean **and**
    `data` is present. Requiring both is what keeps error envelopes
    (`{ success: false, error }`) intact, so `err.payload.error` still feeds the
    locked-key and per-field-rejection rendering from objectstack#4224. A body
    with no boolean `success` is a pre-#3843 server and passes through untouched.
  - The action endpoint reads its verdict from the success envelope's `data`, and
    on the reported-failure arm from `error.details`, where the route deliberately
    parks the whole result so `message` / `severity` / `details` survive the 400.
  - Each endpoint now asserts the shape it promises and throws a named
    `Malformed response from …` error instead of passing a wrong-shaped body on.
    Both symptoms above were an unreadable body travelling onward as if it were
    right; the views already have an error state, and a named error renders there.
  - @object-ui/sdui-parser@17.3.0
  - @object-ui/react-runtime@17.3.0

## 17.2.0

### Minor Changes

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

### Patch Changes

- 1ce750b: The binding-reach probe was under-reporting its own coverage by six object blocks, silently (#3149).

  `public-block-binding-reach.test.tsx` selects what to probe by filtering `getPublicConfigs()`
  for a declared `objectName` input. The console registers most object blocks with
  `registerLazy`, and a pending stub carries no `inputs` — `Registry.getMeta` says in as many
  words that a consumer must read that as _"not yet known"_, not as _"declares no props"_. The
  filter read it as the latter, so `object-chart`, `object-kanban`, `object-calendar`,
  `object-gantt`, `object-timeline` and `object-map` — six Tier-A blocks, every one declaring
  `objectName` as **required** — dropped out of the candidate set while the suite reported eight
  green probes and no gap.

  That is objectui#2953's shape (a lazy registration falling out of the contract) recurring in a
  consumer, and objectstack#4472's shape recurring inside the suite written to answer it: a gate
  whose stated scope was wider than its reach. The coverage guard could not see it — `length > 0`
  and `toContain('object-form')` both stayed true at 8 of 14.

  - Pending public lazy loaders are resolved through the registry's own `loadLazy` before
    candidates are selected — driven off the recorded loaders, not a hand-written list of plugin
    imports that would drift out of step with `register-plugins.ts` and reintroduce the same
    shrinkage by another route.
  - The guard is now an **exact** candidate list, the lesson `public-contract.test.ts` already
    carries: the failure mode is a set getting smaller, and only an exact comparison makes both
    directions a deliberate edit. Verified by simulating the regression — with resolution
    disabled the assertion fails naming the missing blocks.

  All six were already wired correctly (`ObjectChart` reads the context itself; gantt/timeline/map
  and kanban/calendar have context→prop wrappers), so this found no new defect of the #3144 kind.
  It found two more probe artifacts, which is the same lesson a third and fourth time — a
  plausible value for every input is not a plausible _configuration_:

  - **`data` supersedes the binding.** `ObjectChart`'s fetch is guarded by
    `if ((schema.objectName || schema.dataset) && !boundData && !schema.data)`, and the spec
    glosses `data` as static data to chart _instead of_ binding via `objectName`. Filling it and
    then reporting "objectName never reached" would have been the probe manufacturing its own
    finding. Binding-superseding inputs are now excluded, narrowly and with the guard quoted.
  - **Teardown is not the subject.** `object-map` mounts maplibre-gl, whose `map.remove()` throws
    in jsdom for want of a WebGL context. Unmount is caught so the assertion speaks to data reach;
    an error thrown during _render_ still propagates.

  Coverage after this: 14 of 14 object-bound public blocks. The rest of #3149 — bindings other
  than `objectName`, the `record:*` family under a record context, and the display primitives —
  is untouched and still open.

- f6e8d78: Lookup search inside a create/edit modal is typeable again (objectui#3183).

  In every production console build, the search input of a lookup field's
  quick-select popover — and the nested Record Picker dialog — could not take
  focus while the form modal was open: every click/focus was synchronously
  yanked back to the field trigger, so a lookup could not be searched while
  creating a record.

  Root cause is a race in stock `@radix-ui/react-focus-scope@1.1.16`: the
  focus-scopes stack effect's cleanup schedules `focusScopesStack.remove(scope)`
  in a `setTimeout(0)`. When the effect re-runs for a still-mounted scope (a
  `container` ref flicker), the re-run re-`add`s the scope and the stale timeout
  then evicts it — the dialog's trap listeners stay active but its scope is no
  longer in the stack, so an opening popover pauses nothing and the trap yanks
  focus out of the popover forever.

  Fixed via `patches/@radix-ui__react-focus-scope.patch`: an effect re-run for a
  live scope cancels the pending eviction; a real unmount still runs the full
  delayed cleanup (autofocus-on-unmount + stack removal). Regression-tested in
  `packages/components` with a deterministic reproduction of the race.

- ea96284: The `record:*` family now has behavioural evidence — until now "it works under a record page" was an assumption (#3149 layer 3a).

  `public-block-binding-reach.test.tsx` (objectstack#4472) asks whether a declared `objectName`
  reaches the data layer when a block is mounted bare. Every `record:*` block is outside that
  question by construction: they take their subject from `<RecordContextProvider>`, so mounted
  bare they correctly do nothing, and "made no data call" says nothing about whether they work.

  That gap is the exact place objectstack#4413 lived — `record:details` / `record:highlights` /
  `record:path` / `record:related_list` published props no renderer read, four blocks rendered
  blank on a real record page, and every gate stayed green. The framework check compares two
  declarations; the binding-reach probe cannot see this family at all.

  `apps/console/src/__tests__/record-block-record-reach.test.tsx` mounts all **11** public
  `record:*` blocks under a record context twice, with two different records of the same object,
  and asks whether anything changes — in the DOM or in the data calls. Behavioural coverage across
  the two probes goes 14 → **24** of the 57 curated blocks (`record:related_list` is in both:
  binding-reach ledgers it as unable to fetch without a parent, and this probe is what finally
  shows it fetching once one is bound — turning that ledger entry's stated reason from a claim
  into a checked one).

  - **A differential, not "renders non-empty".** #3149 records the decision _not_ to cover the
    display primitives precisely because "renders something" is also true of a block that ignores
    every input it declares. Adding a gate that reports green without checking anything is what
    objectstack#4472 exists to eliminate. A block rendering the same fixed shell for two different
    records scores zero.
  - **Two records, not bound-vs-unbound.** An unbound control differs in tree shape, so `useId`
    values shift and everything "differs" for reasons unrelated to the record.
  - **The instrument is checked, not trusted.** Each block also renders record A a _second_ time;
    that mount must be byte-identical to the first. If it ever isn't, "A differs from B" stops
    meaning "the record reached the output", and the file says so instead of staying green.
  - **A crash fails as a crash.** SchemaRenderer paints an error card on a throw, and a crashed
    block renders the _same_ card for both records — which would land in the "no difference"
    bucket and read as a finding about its binding. Asserted separately.
  - **Hermetic.** Blocks in this family call bare `fetch` (`/api/v1/security/explain`); under
    happy-dom that resolves to `localhost:3000`, so the probe used to "work" only because the
    connection was refused — 24 ECONNREFUSED lines per run, and different behaviour for anyone
    with a dev server on that port. `fetch` now rejects immediately and its URL joins the same
    call log, so a block binding through bare fetch is credited rather than reported unbound.

  Eight blocks respond to the bound record. Three are ledgered with the reason and the host path
  NAMED, because "host-fed" is only a reason while a host actually feeds it:
  `record:discussion` (DiscussionContext, mounted by RecordDetailView) and `record:reference_rail`
  (`entries` injected by `buildDefaultPageSchema`) check out — **`record:activity` does not**, and
  that is #3165: it renders `items={[]}` hard-coded, nothing supplies items on any path, and its
  eleven declared inputs are filters over a feed that is always empty. Ledgered rather than fixed
  here because the fix is a feature, not the missing-bridge one-liner #3144 turned out to be; the
  ledger's both-directions assertion forces the entry out the day it starts working.

  **#3149 layer 2 lands with it, in the only form the codebase offers.** The slice the issue
  proposed — `recordId` on `object-form` / `object-master-detail-form` / `embeddable-form` — does
  not exist: no public block declares a `recordId` input at all (the only `recordId`/`resourceId`
  inputs in the repo are on `view:detail` and `detail-view`, neither of them public). Same result
  objectstack#4472's direction (d) hit — a slice proposed from the declarations, unavailable once
  you look at what is actually declared. What is available is stronger: `record:related_list` and
  `record:line_items` both bind a **required** `relationshipField` + `childObject` that must land
  in the child query, checkable only under a record context. Both do, scoped to the bound parent.
  The "same mechanism, different assertion" hypothesis #3149 wanted tested before anyone widens
  the sweep holds, and it cost one assertion on mounts that were already happening.

- Updated dependencies [4a51e77]
- Updated dependencies [cc70b8f]
  - @object-ui/sdui-parser@17.2.0
  - @object-ui/react-runtime@17.2.0

## 17.1.0

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

- 746dd00: feat(sdui): curate the page:\*, element:\* and action:\* families into the public contract

  The AI-authoring vocabulary and the Studio page designer disagreed by thirteen
  blocks: `PUBLIC_BLOCKS` carried one `page:` tag and one `element:` tag while
  the designer palette — and @objectstack/spec's page schema — offered the whole
  families. A block a human can drag in Studio was invisible to a model writing
  the same page, which is the objectui#3006 state at 10× the scale.

  Fifteen tags join the contract (36 → 42 → **57**), every one shipping a
  renderer with declared inputs (objectui#3065):

  - `page:` — tabs, card, accordion, section, footer, sidebar
  - `element:` — text, number, button, definition-list, repeater
  - `action:` — button, group, menu, icon

  Five stay out, each with its reason recorded and guarded: `action:bar`
  (`record:quick_actions` covers the record action strip; the spec blesses the
  other four), `element:image` (duplicates the curated `image` — one spelling
  per concept), and `element:record_picker` / `element:text_input` /
  `element:metadata_viewer` (mirroring the Studio palette's own exclusions, so
  the two vocabularies stay out for the same reasons rather than by
  coincidence).

  The console's reverse-coverage guard now sweeps all four semantic namespaces
  instead of `record:` alone — checking only the namespace you just fixed is
  exactly how the last 22 doubled keys went unnoticed (objectui#3037). A new
  prop-less allowlist (`element:divider`, `page:section`, `page:footer`,
  `page:sidebar`) keeps "declares no inputs" a pinned decision in both
  directions: those four must stay at zero, everything else curated must declare
  a surface.

- 49e5671: fix(console): `LocalizationFetchProvider` retries a transient `/me/localization` failure instead of degrading for the whole session

  `/auth/me/localization` is served by the environment kernel that owns the session
  on a multi-tenant host, and a cold one answers `503` + `Retry-After` while it
  warms (objectstack#4159). A transient failure is therefore a normal part of a
  cold start — not an exception.

  The provider made ONE attempt and `.catch()`-ed into silence. So a single 503
  during warm-up left currency and locale unset for the **whole session**, silently
  and permanently, long after the kernel was ready. Every money field rendered a
  plain number and nothing ever tried again.

  It now re-attempts a transient failure (`408`, `425`, `429`, `502`, `503`, `504`,
  or a thrown fetch), server-stated `Retry-After` first, exponential backoff
  otherwise. `401` / `403` / `404` / `500` are real answers about the caller and
  still fail on the first attempt.

  **It keeps its posture.** This provider is cosmetic, so it renders children
  throughout — including mid-retry — and fills the value in if and when an attempt
  succeeds. That is the opposite of `MePermissionsProvider`, which is fail-closed
  and holds its loading state across the waits. Both are pinned by tests.

  The retry PRIMITIVES ("is this transient", "how long to wait", `Retry-After`
  parsing) move from `@object-ui/permissions`'s internal module to
  `@object-ui/types` — the lowest package both callers can reach — and
  `PermissionsFetchError` becomes the generic `HttpFetchError`. One definition of
  transient, two policies, rather than a second copy free to drift from the first.
  No behaviour change for `MePermissionsProvider`.

- 2307b52: fix(permissions,console): `MePermissionsProvider` retries a transient `/me/permissions` failure instead of stranding the app on its loading state

  "Not now" is a real answer from this endpoint. On a multi-tenant host it is served
  by the environment kernel that owns the session, and a COLD one answers `503` +
  `Retry-After` while it warms (objectstack#4159 / cloud#927). The provider treated
  that like any other failure: it set `error` — and a consumer that passes no
  `errorFallback` renders `loadingFallback` for the error state too. The console
  does exactly that (`loadingFallback={<LoadingScreen />}`, no `errorFallback`), so
  the app sat on its spinner indefinitely, with a `retry` nobody could reach.

  The fetch now re-attempts a **transient** failure — `408`, `425`, `429`, `502`,
  `503`, `504`, or a thrown fetch (offline / DNS / aborted), which never got an
  answer at all. A server-stated `Retry-After` wins over the exponential backoff
  (both wire forms are read, and clamped to 30s so a hostile value cannot park the
  UI); otherwise the delay doubles from `retryBaseDelayMs`. `loading` stays true
  across the waits, so the fail-closed loading state holds and consumers never see
  a permissive flash mid-recovery.

  Unchanged for a real answer about the caller: `401`, `403`, `404` and `500` fail
  on the first attempt exactly as before. `500` is deliberately not retried — a
  genuine server fault neither benefits from hammering nor should be hidden behind
  a spinner.

  **New props**, both optional and defaulted so no call site needs to change:

  - `maxRetries` (default `3`) — `0` restores the previous single-attempt
    behaviour.
  - `retryBaseDelayMs` (default `500`) — base for the exponential backoff.

  Also fixes a latent race the retries made much wider: the in-flight fetch is now
  cancelled when the effect tears down, so a slow answer for a previous `endpoint`
  or `fetcher` can no longer overwrite a fast answer for the current one. The retry
  primitives (`parseRetryAfterMs`, `backoffMs`, `isTransientFailure`,
  `TRANSIENT_STATUS`, `PermissionsFetchError`) live in a new internal `./retry`
  module — not exported from the package root.

  **The console now passes an `errorFallback`.** Retrying narrows the window but
  cannot close it — a kernel build slower than the retry budget still lands in the
  error state, and rendering `loadingFallback` there is what produced the eternal
  spinner. It now renders `<LoadingScreen error={...} onRetry={retry} />`, using the
  error + retry affordance that component has carried all along, so a user is never
  left with a spinner and no way forward.

- 9a04d25: fix(registry): prefix every namespaced key exactly once, in every namespace

  objectui#3023 fixed eleven `record:*` blocks registered as
  `register('record:x', …, { namespace: 'record' })` — an already-prefixed name
  handed to a registry that prefixes it again, landing the block at
  `record:record:x` — and guarded that namespace alone. Twenty-two more were
  sitting in `action:` (5), `element:` (10) and `page:` (7), two of them
  (`page:header`, `element:divider`) curated public blocks.

  Checking one namespace is exactly what let them keep sitting there, so the
  guard now asks the whole registry rather than a prefix of it.

  Same fix as before: register the bare name and let `namespace` do the
  prefixing, with `skipFallback: true` so the fallback does not claim that bare
  name globally. It would otherwise take over `header`, `footer`, `sidebar`,
  `tabs`, `card`, `accordion`, `section`, `text`, `image`, `button`, `icon` —
  every one of which belongs to `ui:`. All 22 stay reachable exactly as
  `<namespace>:<name>`; the registry goes 522 keys to 500, and the contract is
  unchanged at 42/42.

  Found while probing why six curated Tier B primitives report no `inputs`. They
  do declare them — `vitest.setup.dom.tsx` registers simplified `text` / `image` /
  `html` / `grid` stubs that shadow the real registrations inside the test
  environment only. That shadowing is a separate question, left alone here; the
  doubled keys it turned up are not test-environment artifacts.

- 32462dd: feat(sdui): guard the public contract against silent drift — coverage test + manifest lazy-stub assertion

  Follow-up to objectui#2953. That bug — every lazily-registered public block
  missing from the contract, and so from every `kind:'react'` page's scope —
  survived because nothing compared `PUBLIC_BLOCKS` against what an app actually
  registers. Type-check, lint, build and the whole suite stayed green while seven
  curated blocks were unusable. Two guards close that class.

  **Console ↔ contract coverage.** `apps/console/src/register-plugins.ts` extracts
  the plugin registration out of `main.tsx` so it can be imported without booting
  the app. A new `apps/console/src/__tests__/public-contract.test.ts` reads that
  real list and pins, as exact lists, which curated tags the console exposes (35),
  which are still unimplemented (`line_items`), and which reach the contract
  through a pending lazy stub. Exact lists rather than `toContain`, because the
  failure mode is a _shrinking_ contract. Reverting the #2953 fix drops coverage
  from 35 to 28 and fails all four assertions.

  **Manifests must be generated from loaded registrations.** New exported
  `assertFullyLoaded(configs)` in `@object-ui/sdui-parser`, plus `lazy?: boolean`
  on `RegistryConfigLike`. A lazy stub carries metadata but no `inputs`, so it
  would be written into `sdui.manifest.json` as a block that takes no props —
  making every prop an author passes it an `unknown-prop` diagnostic in the save
  gate. Both generators now assert instead: `gen-manifest.ts` throws, and
  `dev/manifest-dump.tsx` also imports the console's real registration list, so a
  plugin the console lazy-registers but the dump forgets to import eagerly is
  caught rather than silently emitted propless. `scripts/dump-public-manifest.mjs`
  surfaces that failure instead of timing out for 120s with no message.

  Also documents `object-chart` as a seventh block affected by objectui#2953 —
  the issue listed six.

- 390c071: feat(record): declare inputs for the seven configurable record:\* blocks, and curate six

  Seven `record:*` blocks shipped with renderers that read props but declared no
  `inputs`. That combination is the worst of both: the renderer honours
  `limit`, `severity`, `location` …, while every authoring surface — the designer
  panel, the AI vocabulary, the generated manifest — reports the block takes no
  configuration. objectui#3013 recorded them as deliberately uncurated for
  exactly that reason.

  The declarations mirror what each renderer actually reads:

  | block                                  | inputs                                                                       |
  | -------------------------------------- | ---------------------------------------------------------------------------- |
  | `record:activity`                      | 11 — from `RecordActivityComponentProps`                                     |
  | `record:chatter` / `record:discussion` | 5 — from `RecordChatterComponentProps`                                       |
  | `record:alert`                         | 8 — severity, title, body, visible, icon, action, dismissible, dismissKey    |
  | `record:quick_actions`                 | 7 — actionNames, requiredPermissions, location, align, inline, variant, size |
  | `record:history`                       | 3 — limit, emptyText, unknownUserText                                        |
  | `record:reference_rail`                | 1 — hideEmpty                                                                |

  `inputs` describe what an AUTHOR writes, which is a subset of what the renderer
  reads. `entries`, `loading` and resolved `actions` are injected by the host
  shell off RecordContext; declaring them would invite a model to hand-write the
  data the page is supposed to fetch. `aria` is omitted for the reason it is
  omitted on `record:details` — an accessibility escape hatch, not a layout
  choice. `location` takes its enum from the spec's `ACTION_LOCATIONS` rather
  than restating it, per objectui#3019.

  Six of the seven are now in `PUBLIC_BLOCKS`: configurable and absent from the
  contract is the state objectui#3006 was about. The contract goes 36 → 42 tags,
  all resolving.

  `record:chatter` stays out — it is the same renderer as `record:discussion`
  under a Salesforce-familiar name, kept for schemas already in the wild. Two
  spellings of one block is ambiguity an authoring model cannot resolve, so the
  vocabulary carries the spec's name. A test compares the two input lists, so the
  day they diverge the exclusion stops being justified and fails.

  A companion assertion requires every curated `record:*` tag to declare inputs.
  A curated tag with none reads as "takes no configuration" when the renderer in
  fact reads props — the same gap objectui#3006 opened, pointed the other way.

- d10f526: fix(sdui): the curated contract lists `record:line_items`, the tag that actually resolves

  `PUBLIC_BLOCKS` carried `line_items` — the bare tag. `@object-ui/plugin-form`
  registers the block as `record:line_items` with `skipFallback: true`, which
  exists precisely so the bare name is _not_ claimed, so that key never existed
  and the curated entry could never resolve. Its four siblings in the list are all
  `record:`-prefixed, and plugin-form's own comment says "Register
  record:line_items"; the bare spelling was a slip.

  The effect was a block that has shipped all along — a full renderer, a label,
  five declared `inputs` — being absent from the public contract, from the JSX
  type surface, from the generated manifest, and from every `kind:'react'` page's
  scope. It read as an unimplemented aspirational entry, which is how it was
  recorded when objectui#2979 added the contract-coverage guard.

  With the tag corrected the contract has no gaps left: all 36 curated tags
  resolve in the console, `record:line_items` among them with its full `inputs`.
  The guard's known-unimplemented list is now empty and stays asserted, so the
  next entry that cannot resolve surfaces instead of being explained away.

- 2baa13f: fix(record): register the record:\* blocks under one key, prefixed once

  Eleven blocks in plugin-detail were registered as
  `register('record:x', …, { namespace: 'record' })` — an already-prefixed name
  handed to a registry that prefixes it again. Each landed at
  `record:record:x`, and the key authors actually resolved, `record:x`, was the
  un-namespaced _fallback_ rather than the intended registration. The registry
  carried 23 keys for 12 components.

  Nothing failed, which is why it survived: `getPublicConfigs()` rewrites `type`
  to the curated tag, so the doubled name never reached the contract, the
  manifest, or the JSX surface. It was visible only when enumerating the registry
  directly — which is what objectui#3013's reverse check does.

  Registering the bare name is what makes `namespace` correct, and
  `skipFallback: true` is what keeps the fallback from claiming that bare name
  globally. Without it these would take over `details`, `path`, `history`,
  `alert` … as top-level tags; `alert` is the live case, owned by `ui:`. Every
  block stays reachable exactly as `record:<name>`, and 23 keys become 12.

  `record:line_items` needed no change — it was the one already registered this
  way, which is what made objectui#3006's near-miss possible in the first place.

  Two console assertions hold the shape: no key carries a doubled prefix, and no
  `record:*` block owns the bare spelling of its own name.

- 9cdc992: test(sdui): check the contract in the direction that would have caught #3006

  The console contract guard only looked one way: every tag in `PUBLIC_BLOCKS`
  must resolve. That direction cannot tell "not built yet" from "built, but the
  contract spells it wrong" — so `record:line_items` was filed as a known gap for
  a release while its renderer shipped, fully configured, in plugin-form.

  Two checks close the other direction:

  - **Every shipped `record:*` block is curated, or listed with a reason.** Seven
    are deliberately out, each declaring zero `inputs` — nothing for an author or
    a model to configure. A new `record:*` registration now fails until someone
    decides which side it belongs on, so the vocabulary cannot quietly drift from
    what the platform can render. A companion assertion pins those seven at zero
    inputs, so one growing a configurable surface re-opens the decision instead of
    inheriting the exclusion.

  - **A curated tag that near-misses a registered block.** `line_items` vs
    `record:line_items` differ only by namespace; one of the two spellings is
    always a typo. The check reports the candidate ("also try
    `record:line_items`") rather than just "not covered".

  Both were verified against the real bug: reverting the tag to `line_items`
  fails them with exactly that diagnosis.

  Grouping the registry by canonical `type` surfaced a second, latent issue —
  eleven `record:*` blocks in plugin-detail are registered as
  `register('record:x', …, { namespace: 'record' })`, prefixing an already-
  prefixed name and yielding doubled `record:record:x` keys. It does not reach
  the contract (`getPublicConfigs()` rewrites `type` to the curated tag), so this
  changeset only documents it where the grouping happens; the registrations are
  left for a separate change.

- 0fcd4a9: fix(settings): read the locked key from `error.details`, tolerating both wire shapes — objectstack#4224

  `SettingsView.onSave` rendered the `SETTINGS_LOCKED` toast from
  `err.payload.error.key`. That key was a SIBLING of `code`/`message` inside
  `error`, a position `ApiErrorSchema` never declared — it reached the console only
  because the schema is a plain `z.object` and silently strips what it does not
  declare, so nothing ever failed to flag it. objectstack#4224 moves it into
  `error.details`, the slot the contract does declare.

  This is the console's half, and it ships **first**: the read is now
  `error.details?.key ?? error.key`, so the toast keeps naming the locked key
  against servers on either side of that change rather than degrading to
  `Locked by environment: undefined` during the window where the two repos are on
  different versions. The fallback can go once the oldest supported server carries
  the fix.

  Also stops interpolating a missing key: when neither position carries one the
  toast now reads `Locked by environment` rather than appending `undefined`.

  This was the only in-console reader of the four keys objectstack#4224 relocated
  (`namespace`, `key`, `reason`, `fields`) — a repo-wide grep for the other three
  finds no consumer.

- eddd4a1: feat(settings): a rejected save marks the fields that caused it — objectstack#4224 follow-up

  A `SETTINGS_VALIDATION` rejection names the offending keys, and the settings page
  threw all of it away. Every failure collapsed into one toast carrying the
  server's summary sentence, with nothing marked on the inputs — so on a namespace
  with a dozen keys the user was told a value was wrong and left to find which.

  **That was not the console's fault, which is the part worth recording.** The
  server sent `fields` as a `Record<key, message>` hung _beside_ `error.code`, a
  position `ApiErrorSchema` never declared — it survived only because the schema
  is a plain `z.object` and strips undeclared keys rather than rejecting them.
  `extractFieldErrors` reads arrays (`details.fields`, `fields`,
  `validationErrors`), so a map at an undeclared position matched nothing and
  returned `null`. objectstack#4224 moved it to `error.details.fields` as the
  declared `FieldError[]`, which is what makes this wiring a few lines rather than
  a parser.

  What changes for a user: the server's message now renders against the input that
  caused it, in the slot the help text occupies, and clears the moment that field
  is edited, on Discard, or on the next successful save. `SettingsField` gained an
  `error` prop; it sets `aria-invalid` and `aria-describedby` on the control and
  gives the message `role="alert"`, so the rejection is announced rather than being
  conveyed by colour alone.

  The toast still fires alongside the per-field marks. The offending field can be
  scrolled out of view or hidden behind a `visible` expression, and a save that
  appears to do nothing is the worse failure.

  Fields the server did not name are left unmarked — a wrong mark on an innocent
  input is worse than the generic toast that was already there — and a failure
  carrying no field array (a 500, an unknown namespace) behaves exactly as before.

- 96ee72e: **The shared-record page's redaction notice never rendered on the enveloped path.**

  `GET /api/v1/share-links/:token/resolve` has two producers — the framework's
  sharing plugin and the runtime dispatcher's `/share-links` domain, which is the
  designed primary surface for cloud's per-environment kernels. `SharedRecordPage`
  read both, but the wire spells the field `redactFields` while the render reads
  `redactedFields`, and only the BARE branch did that rename. The enveloped branch
  handed `body.data` straight through, so on the dispatcher path `redactedFields`
  was always `undefined` and "Some fields are hidden by the owner" never appeared —
  on exactly the pages where fields WERE being stripped. The record itself was
  correctly redacted throughout; what was missing is the visitor being told.

  The fold now lives in one place, `normalizeResolvedShare` in the new
  `pages/shared-record-shape.ts`, with both envelopes covered by tests. Extracting
  it out of the page module is also what lets those tests run without loading the
  chat renderer and the app-shell graph behind it.

  Prompted by objectstack#3983, which moves the plugin surface onto the same
  enveloped shape the dispatcher already used: without this fix that convergence
  would have spread the missing notice from the dispatcher path to every share
  page. No API change — the page reads a superset of what it read before, so it
  still works against a pre-#3983 framework.

- Updated dependencies [32462dd]
- Updated dependencies [aa1240a]
- Updated dependencies [2374a49]
  - @object-ui/sdui-parser@17.1.0
  - @object-ui/react-runtime@17.1.0

## 17.0.0

### Minor Changes

- 6720008: feat(approvals): dynamic decision-output fields + expression approver editing (framework#3447 P2)

  - The approve/reject dialogs now render one input per author-declared decision-output key (the row's `decision_outputs`, per-request so it can't be a static action param). DeclaredActionsBar synthesizes `outputs.<key>` params; the api handler folds them into the nested `outputs` body the decide route expects. Blank optional outputs are omitted.
  - The flow designer's approval-node approver list renders an `expression`-type approver's value as a CEL expression input (mono + syntax check) instead of a dead free-text reference box, with a placeholder teaching the three legal roots (`current.*` / `trigger.*` / `vars.*`). Flow-scope pickers are deliberately not wired in — approval expressions have their own closed root set, and offering flow-scope paths would teach exactly the spelling the runtime rejects.
  - Static fallback descriptor gains the `Expression (CEL)` approver type, the expression-only `resolveAs` column, and the node-level `onEmptyApprovers` policy select (the online form derives all of these from the engine's published configSchema).

- 7f153de: feat(approvals): typed decision-output pickers, quick-path guard, and approval-expression completion (framework#3447 follow-ups, #2829)

  - Decision dialogs render TYPED decision outputs as record pickers: `decision_output_defs` (`{ key, label?, type, multiple? }`) maps `user` to the sys_user people picker and `department`/`position`/`team` to the matching system-object lookup; `multiple` collects an id array. Bare keys keep the text input.
  - Quick decision paths (inline a/r keyboard, hover buttons, mobile card buttons, bulk apply) no longer decide a request whose node declares decision outputs (#2829) — only the drawer dialog collects those fields. Buttons render disabled with an explanation; bulk selection excludes such rows via the existing "N actionable" messaging.
  - The approval `expression` approver input now has a scope-aware data picker and inline root validation: three groups — `current.<field>` (live at node entry), `trigger.<field>` (submit snapshot), `vars.*` (flow variables) — built by `useFlowScope` from the same materials as the condition picker but with the approval root set. `nodeOutputRefs` now models approval nodes (`<nodeId>.decision` + declared `decisionOutputs` keys), so the previous stage's outputs are pickable, and `vars.previous` is always listed so a legitimate `vars.*` reference is never flagged as out of scope.

### Patch Changes

- 7cb199b: feat(approvals): label pending-approver chips with their group (objectui#2807)

  Follow-up to #2762 P1-2. The dedupe pass collapsed repeated "waiting on"
  chips to one with a `×N` count, but couldn't say _which_ group (finance /
  legal / …) each pending approver represented in a 会签 (per_group) request —
  the data wasn't there. With the framework now emitting
  `pending_approver_groups` (`@objectstack/plugin-approvals`), the drawer:

  - keys the chip collapse by **(name, group)** — the same person filling two
    different groups stays two labeled chips (`Dev Admin · finance`,
    `Dev Admin · legal`), while one group filled twice collapses to a single
    chip with a count;
  - renders the group as a muted `· <group>` sub-tag on the chip.

  Degrades cleanly: with no group data (non-`per_group`, or an older backend)
  the key is the name alone, keeping the plain dedupe + `×N` behavior.

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

- 20bd014: fix(approvals): Approval Center density + amount emphasis (#2762 P2)

  - **Column rebalance** — the inbox table gave five auto columns equal width,
    leaving 审批事项 (Request) over-wide next to a cramped 状态 (Status). The
    Record column (the primary content) now gets the widest share, Request a
    moderate one, and Status/Submitted fixed widths so they never crowd.
  - **Lead with the amount** — the drawer summary card now surfaces the
    decision-critical amount as a filled figure at the top of the card instead
    of burying it in the generic field grid (and drops it from that grid so it
    shows once).

  Also verified two P2 items need no change: light mode already works —
  `ConsoleShell` mounts `ThemeProvider defaultTheme="system"` (follows the OS
  `prefers-color-scheme`) with a `ModeToggle`, and the page's own classes carry
  full light/dark variants; and the queue already has a bulk approve/reject
  toolbar for the select-all/per-row selection.

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

- b076050: fix(console,runner): the approvals inbox renders against one ticking clock, and both packages now run ESLint

  `apps/console` and `packages/runner` had no `lint` script, so `turbo run lint`
  skipped them silently and their 17 ESLint **errors** had never been seen
  (#2923 declared them as DEBT; this closes the gap). Both now carry
  `"lint": "eslint ."` and the `DEBT` list in `scripts/check-lint-coverage.mjs`
  is empty — every workspace package is linted.

  What the errors actually were, once read one by one:

  - **8x `react-hooks/purity` — real, and user-visible.** The approvals inbox
    read `Date.now()` mid-render for every age tint, "5m ago" label and SLA chip.
    Render must be pure: the output depended on when React happened to render, so
    it disagreed with itself under StrictMode's double render and then **froze** —
    an inbox left open kept saying "just now" and an SLA countdown never counted
    down. The page now renders against a single `now` held in state and advanced
    once a minute (the finest granularity anything here displays), so render is a
    pure function of props+state _and_ the figures actually tick.
  - Alongside that, `sla_due_at` is now parsed through a guard. A due date the
    backend sends in a shape `Date.parse` can't read used to render as
    "SLA NaNh left"; it now renders nothing.
  - **1x `react-hooks/static-components` — real.** `StatusBadge` was declared
    inside `ApprovalsInboxPage`, making it a brand-new component type on every
    render, so React unmounted and remounted every status chip in the table each
    time the page re-rendered. Hoisted to module scope, with the translated label
    passed as a prop.
  - **6x `react-hooks/static-components` — false positives** (3 in the console's
    settings pages, 3 in the runner's `LayoutRenderer`). All six render the result
    of `getIcon`/`getLazyIcon`, which memoises per name in a module-level cache —
    the component reference is stable across renders and nothing is created during
    render. The rule cannot see through the call, so these carry the same targeted
    `eslint-disable-next-line` + justification the repo already uses at a dozen
    icon-registry sites, and the resolvers themselves now say so in a comment.
    (Verified rather than assumed: typing into a settings field keeps focus and
    every character, so no state was ever being reset there.)
  - **2 minor.** A dead `token` initializer on the console's auth preflight path
    (`no-useless-assignment` — read, not blind-deleted: no intended write was
    missing, every path out of the try/catch either assigns or returns), and a
    `prefer-const` in the SDUI workbench preview.

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

- 5b9cf96: fix(plugin-map): drop the `maplibre-gl@6` default import, and put type-check behind a CI gate that cannot be silently skipped (#2911)

  `maplibre-gl@6.0.0` removed its default export (arrived via #2848, dependabot),
  so `ObjectMap.tsx`'s `import maplibregl from 'maplibre-gl'` has been a TS1192
  error on `main` for a day. The binding was never used — the map instance comes
  from `react-map-gl/maplibre`, and the stylesheet from the side-effect import on
  the next line — so the import is simply deleted rather than rewritten to
  `import * as`.

  Removing it is runtime-neutral, which the issue had explicitly left unverified.
  `@vis.gl/react-maplibre` (what `react-map-gl/maplibre` re-exports) does
  `Promise.resolve(mapLib || import('maplibre-gl'))` in `components/map.js`, so it
  loads the library itself when no `mapLib` prop is passed. Verified in a browser
  against the `store-locator-map` catalog schema: `maplibre-gl` is fetched as its
  own lazy chunk, the WebGL canvas comes up 800x600, and all three markers mount —
  byte-identical probe output with and without the static import. That also matches
  what `apps/console/src/main.tsx` already intends, where the plugin is registered
  lazily specifically to keep `maplibre-gl` out of the initial bundle.

  **The reason it survived a day of green CI is the part worth fixing.** No
  workflow ran `type-check` at all, and `turbo build` only checks types for
  packages whose `build` script happens to invoke `tsc` — the 22 `vite build`
  packages transpile without checking. A sweep of all 45 packages found ten with
  broken types, `plugin-map` merely being the one that had a script to notice it.

  Adding a `pnpm type-check` job alone would not have been a gate: **turbo silently
  skips any package with no `type-check` script**, so 17 packages read as passing
  because nothing ran. With `plugin-map` fixed, `pnpm type-check` reports 63/63
  green while nine packages are still broken. So:

  - `plugin-ai` and `plugin-report` gain the `paths` override their type-checked
    peers already carry, which detaches workspace deps from sibling _source_ and
    resolves them through built `.d.ts` — the sole cause of the 104-error TS6059
    `rootDir` floods, and the same trick their own `vite.config.ts` already applies
    to the dts program.
  - Seven packages gain `"type-check": "tsc --noEmit"` (`plugin-ai`,
    `plugin-report`, `plugin-dashboard`, `create-plugin`, `console`, and the two
    console examples). Coverage goes 28 -> 35 of 45.
  - New `scripts/check-type-check-coverage.mjs` makes the invisibility impossible:
    a package with no `type-check` script must be declared, with a reason, and the
    lists only shrink — gaining a script without deleting the entry fails the
    guard. The nine known-broken packages are recorded there with error counts
    (`@object-ui/runner` has no `tsconfig.json` at all), tracked as follow-ups.
  - New `Type Check` CI job runs the coverage guard first (instant, no install),
    then `pnpm type-check`.

  Both halves were proven to fail before being trusted: the guard was exercised in
  all four of its failure modes, and re-introducing the `maplibre-gl` import turns
  the job red again, as does a fresh error injected into `plugin-ai` — a package
  that had no type checking whatsoever before this change.

  - @object-ui/react-runtime@17.0.0
  - @object-ui/sdui-parser@17.0.0

## 16.1.0

### Patch Changes

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

- 6b114a1: fix(approvals-inbox): align participant gating with the server-computed `viewer` block

  Consume framework#3310's per-viewer capability: `ApprovalRequestRow` gains an
  optional `viewer: { can_act, is_submitter }`, and the approvals inbox's
  participant checks (the reply box + the "why disabled" hint) prefer it over the
  client-side identity heuristic when present. This keeps the hint from ever
  contradicting the declared decision buttons — whose `visible` CEL now gates on
  `record.viewer.*` — and correctly recognizes position/team-addressed approvers
  that the client heuristic couldn't resolve. The heuristic remains as a fallback
  for a backend that predates `viewer`.

  - @object-ui/react-runtime@16.1.0
  - @object-ui/sdui-parser@16.1.0

## 16.0.0

### Patch Changes

- ca0f5f0: Login page surfaces the dev-seeded admin credentials. The framework runtime seeds `admin@objectos.ai` on an empty development database, but nothing on the login page said so — new users clicked "Sign up" and landed in an empty non-admin workspace (15.1 third-party eval). When `GET /api/v1/auth/config` reports `devSeedAdmin` (dev-only; the server omits the field in production and once the default password is changed), the page renders a dismissible amber banner with the credentials. Dismissal persists per browser via localStorage.
  - @object-ui/react-runtime@16.0.0
  - @object-ui/sdui-parser@16.0.0

## 15.0.0

### Major Changes

- a46ce5e: align with objectstack

### Patch Changes

- @object-ui/react-runtime@15.0.0
- @object-ui/sdui-parser@15.0.0

## 14.1.0

### Patch Changes

- 6b2d74e: fix(auth): gate the device-approval page on `features.deviceAuthorization` (framework#2874 / #2513)

  `DeviceAuthPage` hit the RFC 8628 `/device*` endpoints unconditionally, even
  though the better-auth `deviceAuthorization` plugin is opt-in (off by default) —
  so on a deployment without it the page rendered an approve form that only failed
  on submit. It now reads `features.deviceAuthorization` from the public auth
  config and shows a plain "not enabled" notice when the capability is off,
  matching the "form follows plugin" honesty guard the framework side introduced
  in #2874. `AuthPublicConfig.features` gains the `deviceAuthorization` flag
  (previously absent from the client type). A config-fetch error fails open so a
  transient blip never hides a legitimately-enabled page.

- 2b30583: fix(permissions): close the console FLS fail-open for token-only sessions (framework#2926 ④). Two halves: `MePermissionsProvider` gains a `fetcher` prop and the console passes `createAuthenticatedFetch()` so `/me/permissions` carries the Bearer token like every other data call (the cookie-only default fetch resolved token-only sessions as anonymous); and the unknown-object default is now authentication-gated — authenticated sessions fail CLOSED when an object has no resolved perms (fields render read-only instead of inviting input the data layer strips), while anonymous sessions keep the permissive default so guest/public forms keep working. Pairing note: with an older framework whose `/me/permissions` returns sparse objects for authenticated users, unconfigured objects now render read-only.
  - @object-ui/react-runtime@14.1.0
  - @object-ui/sdui-parser@14.1.0

## 14.0.0

### Major Changes

- 2f3ab55: align with objectstack

### Patch Changes

- 94d00d4: feat(auth): phone number + password sign-in on the login page

  The login page's password mode now accepts an **email OR a phone number** as the
  identifier and routes by shape — email → `/sign-in/email`, phone →
  `/sign-in/phone-number` (better-auth phoneNumber plugin, framework#2780). It
  coexists with the existing phone-OTP mode.

  - Gated on `features.phoneNumber` (phoneNumber plugin enabled). Unlike phone-OTP
    it needs no SMS service, so it uses that coarser capability flag, not
    `features.phoneNumberOtp`. When the flag is off the field stays email-only.
  - New `AuthClient.signInWithPhonePassword(phoneNumber, password)` wired through
    `AuthContext` / `AuthProvider` / `useAuth`.
  - New `normalizePhoneIdentifier` / `looksLikePhoneIdentifier` helpers that mirror
    the backend's `normalizePhoneNumber` exactly (strip `[\s\-().]`, validate
    `^\+?[0-9]{6,15}$`, **no** forced E.164 / country code — the backend stores the
    light-stripped form, so anything heavier would break the lookup).
  - SSO stays email-only (a phone-shaped identifier no longer attempts domain
    routing).

  Only works for accounts that have both a phone number and a password set;
  phone-only accounts set a password on first OTP sign-in.

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
  - @object-ui/react-runtime@14.0.0
  - @object-ui/sdui-parser@14.0.0

## 13.2.0

### Patch Changes

- @object-ui/react-runtime@13.2.0
- @object-ui/sdui-parser@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/react-runtime@13.1.0
- @object-ui/sdui-parser@13.1.0

## 13.0.0

### Patch Changes

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

  - @object-ui/react-runtime@13.0.0
  - @object-ui/sdui-parser@13.0.0

## 12.1.0

### Patch Changes

- @object-ui/react-runtime@12.1.0
- @object-ui/sdui-parser@12.1.0

## 12.0.0

### Major Changes

- d985fe5: upgrade with objectstack 12

### Patch Changes

- @object-ui/react-runtime@12.0.0
- @object-ui/sdui-parser@12.0.0

## 11.5.0

### Patch Changes

- @object-ui/react-runtime@11.5.0
- @object-ui/sdui-parser@11.5.0

## 11.4.0

### Patch Changes

- a4ccd4d: FormPage: unwrap the ExpandedViewItem envelope from `/meta/view/:name` — the form
  spec lives under `config`, so internal forms rendered zero fields with a bare
  Submit that falsely succeeded. Non-form views reaching the forms route now throw
  an actionable error instead of the same empty-form false positive.
  - @object-ui/react-runtime@11.4.0
  - @object-ui/sdui-parser@11.4.0

## 11.3.0

### Patch Changes

- 96b1293: ADR-0080: ship a `manifest-dump.html` build entry + `scripts/dump-public-manifest.mjs` that serialize the registry's public tier (`getPublicConfigs()`) to `sdui.manifest.json` — the artifact the framework `os build` JSX gate consumes for full component/prop validation. Generated in a real browser (the registry pulls browser-only deps); wired into `build-console.sh` framework-side.
- d23d6eb: Three-tier AI page authoring: `kind:'html'` and a trusted `kind:'react'` tier.

  - **`@object-ui/react-runtime`** (new) — the trusted runtime-React tier for
    `kind:'react'` pages (vendored react-runner: Sucrase transpile + scope-eval,
    no sandbox). Renders real JSX/TSX (any HTML + JS + hooks/useState/map/onClick)
    in the main React tree with an injected scope (React, the public data blocks,
    page data) and a built-in error boundary.
  - **`@object-ui/core`** — new runtime capability gate (`enableCapability` /
    `disableCapability` / `isCapabilityEnabled`, `CAP_REACT_PAGES`). `react-pages`
    defaults **ON** (the platform trusts reviewed, draft-gated authors); a
    deployment turns it OFF server-side (the runtime injects the disable global
    when `OS_DISABLE_REACT_PAGES` is set). Never controlled from authored metadata.
  - **`@object-ui/components`** — PageRenderer now routes `kind:'react'`
    (capability-gated, lazy-loads the runtime) and renders `kind:'html'` (the
    former `kind:'jsx'`, still accepted as a deprecated alias). The `html` tier
    now resolves the full safe native HTML tag set (h1–h6, p, a, ul/ol/li, img,
    blockquote, pre, strong/em, …) so authored HTML lives up to its name.

- Updated dependencies [d23d6eb]
  - @object-ui/react-runtime@11.3.0
  - @object-ui/sdui-parser@11.3.0

## 11.2.0

## 11.1.0

## 7.3.0

### Minor Changes

- 02da91f: feat(console): resolve the post-login landing from app metadata, not a hardcode

  The root route (`/`) previously redirected via a hardcoded
  `PREFERRED_APPS = ['cloud_control']` in `CloudAwareRootRedirect` — baking one
  product's policy (cloud) into the shared Console, with no supported way for a
  deployment to opt out of the `/home` launcher or land somewhere custom without
  forking the SPA.

  `CloudAwareRootRedirect` is replaced by `RootLandingRedirect`, which resolves the
  landing purely from app metadata (`resolveLandingPath`, unit-tested):

  1. the app marked `isDefault: true` → `/apps/<it>` (its own `homePageId` then
     selects the landing page within it);
  2. else the single visible app (`active !== false && hidden !== true`) → that app;
  3. else `/home` — the multi-app workspace launcher (legacy default).

  This gives `isDefault` **routing semantics** (it was a display-only badge) — a
  back-compat-relevant contract change. Back-compat: a deployment with no
  `isDefault` app and ≥2 visible apps still lands on `/home`, exactly as before;
  cloud is unaffected (`cloud_control` is already `isDefault: true`) and the
  cloud-specific hardcode is removed. The landing is now a build-time product
  decision a developer declares in metadata, not a runtime Settings-UI preference.

## 7.2.0

## 7.1.0

### Patch Changes

- b1766d3: fix(console): object-detail page uses the valid `record` PageType

  `buildObjectDetailPageSchema` emitted `pageType: 'record_detail'`, which was
  dropped from `PageType` (`record | home | app | utility`) in framework#2265 /
  objectui#1949 — a `tsc` error (TS2322) that broke the console build (Bundle
  Analysis). An object detail page is a `record` page; use that.

## 7.0.0

### Minor Changes

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

- 78d1a56: ADR-0046 P2: `/docs/:name` package-documentation route.

  One authenticated route renders any installed `doc` metadata item (flat Markdown docs compiled from a package's `src/docs/*.md`): fetches the item via the standard metadata API (`meta.getItem('doc', name)`), renders the sanitized body through `@object-ui/plugin-markdown`, and rewrites relative cross-references `[x](./other_doc.md#anchor)` → `/docs/other_doc#anchor` (fenced/inline code untouched, SPA navigation on click). Unknown names degrade to a "Documentation not found" notice per the ADR — never a hard failure.

- 89e113c: ADR-0044 send-back-for-revision in the approvals inbox (framework #1744/#1769). Approvers get a "Send back" action (violet, with its own dialog) that ends the round as `returned` and unlocks the record; the submitter sees a revision panel on the returned request — edit-record link, optional comment, Resubmit (opens round N+1) and Recall (abandons the revision). New `returned` status badge/filter, Round-N chips (list + drawer), timeline rendering for `revise`/`resubmit` actions, `approvalsApi.sendBack/resubmit`, and ten-locale `approvalsInbox` strings.
- c09f44e: Docs: mermaid diagrams + long-doc table of contents (ADR-0046).

  - **plugin-markdown** renders ```mermaid fenced blocks as diagrams (`<Mermaid>`: lazy-loaded mermaid, `securityLevel: 'strict'`, rendered post-`rehype-sanitize`by a trusted component, degrades to the raw source on error). Mermaid is text → SVG, so it stays within the v1 image/binary ban. Adds`extractToc(markdown)`— a TOC builder whose slugs are generated with the same`github-slugger` `rehype-slug`uses, so`#id` links resolve to the rendered heading anchors.
  - **console** `DocPage` shows a sticky right-rail table of contents (h2–h3) for docs with ≥3 headings, plus an app-independent `/apps/:packageId/docs` index already added earlier.
  - **i18n** adds `help.onThisPage` (en/zh; other locales fall back).

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

- 4eb9cb6: feat(plugin-tree): add a `tree` / tree-grid object view type

  Renders a self-referencing object as an indented, expand/collapse tree-grid —
  the right view for arbitrary-depth hierarchies (business unit / org chart,
  category trees, BOMs, nested comments) that fixed-depth grouping can't express.
  New `@object-ui/plugin-tree` package (`object-tree`/`tree`), `tree` added to the
  `ViewType` union, and dispatch wired through plugin-list `ListView` +
  app-shell `ObjectView` (the console path).

### Patch Changes

- 8d37b31: fix(ADR-0046): enable Tailwind typography so Markdown docs render styled.

  `plugin-markdown`'s `MarkdownImpl` renders inside `prose prose-h1:text-3xl …`,
  but the console never registered `@tailwindcss/typography`, so every `prose`
  utility was a no-op — Markdown rendered with no heading sizes, list markers, or
  spacing (the `/docs/<name>` page showed its `# Title` at body size, looking
  unstyled). Register the plugin (`@plugin '@tailwindcss/typography'`) and add the
  dependency. Now doc headings, paragraphs, inline code, and links render with
  proper hierarchy.

- d82a580: fix(ADR-0046): docs portal shows summaries, not machine ids.

  The portal listed each doc as title + its raw machine name (`showcase_index`)
  — noise for the business readers docs are written for. Drop the machine id from
  the reader-facing list and render the doc's `description` (ADR-0046) as a
  one-line summary under the title instead. Falls back cleanly when a doc has no
  description.

- e164c92: feat(ADR-0046): lightweight chrome for the docs routes.

  The `/docs` portal and `/docs/:name` viewer are app-independent top-level
  routes, so they rendered as bare full-bleed pages with no header and no way
  back. Add a minimal sticky `DocShell` header — a "Documentation" home link
  (→ `/docs`) plus a breadcrumb of the current doc — shared by the portal and the
  viewer. Keeps ADR-0046's "no nav taxonomy in v1" intent (no app sidebar) while
  giving readers orientation and a way out. The portal's redundant in-body title
  is dropped in favour of the header.

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

- 56571d6: ADR-0048: DocPage resolves docs package-scoped. The doc viewer at
  `/apps/:appName/docs/:name` now passes the route's package segment as
  `getItem('doc', name, { packageId })`, so the single-doc fetch is package-scoped
  (prefer-local) on the server. Two installed packages may ship a doc with the
  same bare name and each resolves within its own package — doc names no longer
  need a globally-unique namespace prefix (the prefix becomes a convention, like
  `page`/`dashboard`/`report`). The legacy top-level `/docs/:name` path (no
  `appName`) keeps its context-free behavior.
- 77cc6bb: Cloud Connection bind v2 UX (cloud ADR runtime-identity-binding §2.3): the binding flow becomes one click. `CloudConnectionPanel` drops the environment-id input entirely (registration happens cloud-side at approval), auto-opens the approval page in a popup on Connect (user-code display stays as the popup-blocked fallback), and shows the registered runtime name + runtime id once bound. `DeviceAuthPage` displays the requesting device's context (`runtime_name` / `runtime_version` from the verification URL) plus an "only approve if you started this" warning — the informed-consent surface for the RFC 8628 flow. Two new `auth.device.*` keys across all locales.
- 82bcc87: DeviceAuthPage claims the device code (GET /device?user_code=…) before approve/deny — better-auth's device-authorization plugin rejects both with 400 "not been claimed by a verifying session" otherwise, so approval silently failed.
- c97513f: DeviceAuthPage preserves the full query string (runtime_name / runtime_version device context) through the login redirect — previously only user_code survived, so a signed-out approver never saw what device they were authorizing.

## 6.2.3

## 6.2.2

## 6.2.1

## 6.2.0

## 6.1.0

## 6.0.4

## 6.0.3

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

## 6.0.1

## 6.0.0

## 5.4.2

## 5.4.1

## 5.4.0

## 5.3.2

## 5.3.1

### Patch Changes

- 9c95649: Make the published Console SPA path-portable. Build with relative Vite
  base (`./`) and derive the React Router basename from `document.baseURI`
  at runtime, so the same `dist/` works at any mount path (`/_console/`,
  `/console/`, `/foo/bar/`). Hosts should inject `<base href="/path/">`
  into the served HTML — the framework CLI does this automatically.
- c351c96: Fix self-host blank page: clear `VITE_SERVER_URL` in `.env.production`
  so the published SPA defaults to same-origin instead of baking in
  `https://demo.objectstack.ai`. CORS-blocked auth/i18n/discovery calls
  were preventing the SPA from rendering when embedded in any host other
  than the demo deployment. Demo-only deployments now inject
  `VITE_SERVER_URL` at deploy time.
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
  - @object-ui/mobile@5.3.1
  - @object-ui/plugin-calendar@5.3.1
  - @object-ui/plugin-charts@5.3.1
  - @object-ui/plugin-chatbot@5.3.1
  - @object-ui/plugin-dashboard@5.3.1
  - @object-ui/plugin-designer@5.3.1
  - @object-ui/plugin-detail@5.3.1
  - @object-ui/plugin-form@5.3.1
  - @object-ui/plugin-gantt@5.3.1
  - @object-ui/plugin-grid@5.3.1
  - @object-ui/plugin-kanban@5.3.1
  - @object-ui/plugin-list@5.3.1
  - @object-ui/plugin-map@5.3.1
  - @object-ui/plugin-markdown@5.3.1
  - @object-ui/plugin-report@5.3.1
  - @object-ui/plugin-timeline@5.3.1
  - @object-ui/plugin-view@5.3.1
  - @object-ui/collaboration@5.3.1
  - @object-ui/app-shell@5.3.1
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

## 5.2.1

## 5.2.0

## 5.1.1

## 5.1.0

### Patch Changes

- 32306e8: chore: bump `@objectstack/client` and `@objectstack/cli` to `^4.2.0`

  Brings in the published Optimistic Concurrency Control surface
  (`If-Match` header on `data.update`/`data.delete`, `409
CONCURRENT_UPDATE` response shape with `currentVersion` /
  `currentRecord`) so the inline-edit save path can actually push the
  `ifMatch` token through.

## 5.0.2

## 5.0.1

## 5.0.0

## 4.8.0

## 4.7.0

## 4.6.0

## 4.5.0

## 4.4.0

## 4.3.1

## 4.3.0

## 4.2.1

## 4.2.0

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

### Patch Changes

- 19c044f: i18n

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

## 4.0.4

## 4.0.3

## 4.0.1

### Patch Changes

- f3bc42e: fix console

## 4.0.0

## 3.4.0

## 3.3.2

### Patch Changes

- 89a7b21: fix i18n

## 3.3.1

### Patch Changes

- db7a418: fix(console): respect Vite `BASE_URL` when redirecting after a workspace
  switch. The post-switch redirect previously hardcoded `/console/home`,
  which broke deployments served from a different base path (e.g. Vercel,
  where the console is mounted at `/`). It now derives the target from
  `import.meta.env.BASE_URL`, so it works both behind `HonoServerPlugin`
  (`/console/home`) and on standalone deployments (`/home`).

## 3.3.0

## 3.2.0

### Minor Changes

- 91a9103: upgrade objectstack ai service

## 3.1.5

## 3.1.4

### Patch Changes

- 7129017: fix

## 3.1.3

## 3.1.2

## 3.1.1

## 3.0.3

### Patch Changes

- e1267d2: fix: re-attach listViews to object metadata stripped by defineStack() Zod parse

## 3.0.2

### Patch Changes

- f1c2fc1: fix build

## 3.0.1

## 3.0.0

### Major Changes

- Upgrade to @objectstack v3.0.0 and console bundle optimization
  - Upgraded all @objectstack/\* packages from ^2.0.7 to ^3.0.0
  - Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
  - Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
  - Added gzip + brotli pre-compression via vite-plugin-compression2
  - Lazy MSW loading for build:server (~150 KB gzip saved)
  - Added bundle analysis with rollup-plugin-visualizer
