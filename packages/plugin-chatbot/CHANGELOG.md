# @object-ui/plugin-chatbot

## 17.7.0

### Minor Changes

- 64dae8e: Six user-visible fixes across the maker surface, the assistant rail and the
  dataset captions.
  
  **The maker's start chips now promise only what ADR-0112 v1 builds
  (cloud#1984).** Two of the five asked for automation the first version has no
  flows or actions for — the ticket chip said 「状态流转」, the inventory chip said
  「低库存预警」 — and the measured behaviour was not a refusal but a silent
  degrade: a status kanban and a low-stock view. The chip promised an alert and
  delivered a page. All five are reworded in all ten packs (and in the call-site
  `defaultValue` fallbacks, which are a second copy of the same strings) to ask
  for objects, fields, views, pages, dashboards and sample data, keeping each a
  real business scenario — the ticket chip now asks for a status field and a board
  grouped by it, the inventory chip for a view that filters below the reorder
  point. A note beside the keys says to revert when v2 re-adds flows.
  
  **Five newer AI tools get their step labels (objectui#7481).** A zh conversation
  read `✓ Get authoring rules 已完成` between 「读取元数据结构」 and 「列出对象」:
  `get_authoring_rules` (cloud#1837), plus `load_tools`, `open_record`,
  `test_flow` and `toggle_flow`, are registered by the cloud AI runtime but are
  newer than the pinned spec's tool registry, so they had no `chatbot.tool.*`
  entry in any pack and fell through to the English title-caser.
  
  **The assistant rail follows the thread when you send (objectui#7480).** The
  rail and the full-page maker are the same component; what differs is width. A
  reply that still ends on screen in the wide column runs two or three times
  taller in a ~360px rail, so `StickToBottom`'s lock is escaped by the time the
  user types and the new bubble, the tool steps and the streaming answer all land
  below the fold. Every send path now re-arms the lock — including the plan-card
  "Build it" and 确认修改 approvals, whose own code comments already named this
  miss. Message APPENDS deliberately do not, so a user reading back through the
  thread mid-answer is never yanked to the bottom.
  
  **Console toasts move off the assistant composer (objectui#7482).** 「客户更新
  成功」 sat on the ChatDock composer's send button and stayed there. One defect,
  two symptoms: `apps/console` pinned the toaster to `bottom-right` — an override
  that predates ADR-0057 P3a — so a toast both covered the button and, because
  sonner pauses a toast's dismiss timer while the pointer is inside the toaster
  region, never got to run its 4s timer with a pointer resting on the composer
  underneath. The override is gone; the console takes `ConsoleToaster`'s own
  documented top-right anchor, and the 4s success duration is now pinned.
  
  **Built-in aggregate captions follow the locale everywhere (objectui#7534).**
  objectui#7258 taught `buildChartSeries()` to resolve a server-minted default
  measure through the locale map, so a chart legend read `计数` while the table
  beneath it, the KPI caption, the pivot header and the dataset preview still
  printed the server's hard-coded English `Count`. `buildDatasetFieldHelpers()`
  takes the same optional `builtinAggregateLabels`, resolving through the one
  `resolveMeasureLabel` order, and the five call sites pass it. Omitting the
  argument reproduces the previous output byte for byte, and an author-declared
  measure still keeps its own label verbatim (objectui#4106).
  
  **The activity feed stops asking for an object the environment does not have
  (objectui#7476).** A tenant environment has no `sys_activity`, so every page
  load issued a request that 404'd. Everything downstream was already correct —
  the adapter memoizes the missing collection, its logger demotes the failure, the
  feed retires as an ANSWER and the panel renders its earned empty state — so what
  is left is the request itself, and `data-objectstack` states the rule for it:
  the cure for a doomed request is not issuing it. New `useObjectPresence` reads
  the object registry the shell loads for the nav anyway; only a registry that has
  ANSWERED and lists other objects without this one skips the read. Every
  uncertainty — no provider, empty registry, still loading, errored — reads as
  before, because a wrong skip would cost a real deployment its feed.
- 52a43de: `ChatbotSchema` names the `chatbot` node's local-display and legacy
  auto-response keys — a new, additive published surface (objectui#6169, the
  #6172 family ruling: every component node has exactly one named, importable
  authoring-face type).
  
  `ChatbotSchema` (`@object-ui/types`) now declares ten keys that previously
  existed ONLY inside an anonymous inline intersection local to
  `packages/plugin-chatbot/src/renderer.tsx`'s `chatbot` registration, invisible
  to anything outside that one file:
  
  - `showTimestamp`, `userAvatarUrl`, `userAvatarFallback`, `assistantAvatarUrl`,
    `assistantAvatarFallback`, `maxHeight` — display fields.
  - `autoResponse`, `autoResponseText`, `autoResponseDelay` — the local
    auto-response (demo/playground) fields, already live via a real consumer
    (`packages/app-shell/src/console/ai/AiChatPage.tsx`).
  - `onSend?: (content: string, messages: ChatMessage[]) => void` — the
    send-callback, now typed against the published `ChatMessage` shape rather
    than the plugin's internal runtime message type.
  
  Each was read-site-censused before being declared (renderer.tsx and/or
  `useObjectChat.ts` reads every one); none were dead, so none took the
  ADR-0049 retirement route. `disabled` — also present in the original
  intersection — is NOT redeclared: it is already `BaseSchema.disabled`
  (`boolean | string`), read generically for every node type, and redeclaring
  it here would have narrowed away the inherited expression-string case.
  
  **What an external consumer can now do that they could not before:** import
  `ChatbotSchema` from `@object-ui/types` and get these ten keys with real,
  checked types — previously any reference to them required either duplicating
  the anonymous type by hand or falling back to `any`. The Zod mirror
  (`@object-ui/types/zod`) gained the same ten keys in lockstep, so a `chatbot`
  node parsed through it is now validated on these keys rather than silently
  passed through unchecked (`BaseSchema`'s Zod mirror is `.passthrough()`).
  
  `packages/plugin-chatbot`'s `chatbot` registration (`renderer.tsx`) now types
  its `schema` prop as `ChatbotSchema` directly, dropping the anonymous
  intersection. No behavior change: `renderer.tsx:87`'s
  `body: schema.requestBody` forwarding — the subject of the already-merged
  #6193 — is untouched, and the render function reads the exact same keys it
  already read.
  
  This is additive (new optional keys on an interface that already carried a
  `[key: string]: any` index signature, and a new Zod-validated subset of
  previously-passthrough keys), so it ships as `minor` even though it changes
  published type surface: objectui's major is pinned to `@objectstack`'s
  (`scripts/check-changeset-no-major.mjs`), and objectui's own breaking changes
  ship as `minor` with the break spelled out — there is no break here to spell
  out, only a widening from anonymous-and-unchecked to named-and-validated.
  
  Out of scope, deliberately: the `chatbot-enhanced` and `chatbot-floating`
  registrations' own anonymous intersections (different key sets, a decision
  for a separate card in the same family), and the `surface` row on
  `content/docs/plugins/plugin-chatbot.mdx`'s Properties table, which names a
  key no registration in this package currently reads (filed separately).
- 7d8e546: `surface` becomes authorable on the `chatbot-enhanced` node, so the capability the docs
  have been documenting is one an author can actually reach (objectui#6687, maintainer
  ruling 2026-08-29).
  
  `content/docs/plugins/plugin-chatbot.mdx`'s `Properties` table listed `surface`
  (`'card' | 'plain'`, "bordered panel or a frameless full-page workspace"), but the key had
  **zero read points**: none of the three `ComponentRegistry.register('chatbot*', ...)` sites
  in `renderer.tsx` forwarded it, and `ChatbotSchema` did not declare it. `surface` was real
  only as a prop of the React component — `ChatbotEnhanced.tsx` defines `ChatbotSurface`,
  defaults it to `'card'`, and branches six layout decisions off `isPlainSurface` — so it was
  reachable by a hand-written React host and by nobody writing metadata. An author who wrote
  `surface: 'plain'` got the `'card'` default, with no error and no signal.
  
  Measured on both declaration faces before the fix, each with a control that had to hit:
  `schema.surface` appeared 0 times in `renderer.tsx` against `schema.placeholder` at 3 (one
  per registration) and `schema.processVisibility` at 1; and `ChatbotSchema`
  (`packages/types/src/complex.ts`) declared 34 keys, not this one. Two faces agreeing is
  what made the zero a reading rather than a bad query.
  
  The ruling adopted **wiring it** over deleting the row — the row names a real, shipped
  capability, and hiding it back inside the component would withdraw it from authors. It also
  matches this page's two existing resolutions of the same defect class, neither of which
  deleted a row: `requestBody` (objectui#6193) kept its row and documented the seam, and
  `maxToolRoundtrips` (objectui#5605) kept its row, marked it inert, and warns once at runtime.
  
  - `chatbot-enhanced` declares `surface?: ChatbotSurface` on its inline schema-extension
    type and forwards `schema.surface` to `<ChatbotEnhanced>`. The union is **imported** from
    `ChatbotEnhanced.tsx` rather than re-spelled, so there is one contract rather than two
    dialects that can drift (AGENTS.md #0.1).
  - The key joins the registration's `inputs` (designer + autocomplete surface) with
    `defaultValue: 'card'`, and deliberately **not** its `defaultProps` — mirroring
    `processVisibility`, so nothing materializes the key onto new nodes.
  - **The absent case is unchanged**: an unauthored `surface` is forwarded as `undefined`, so
    `<ChatbotEnhanced>`'s own `surface = 'card'` default still applies. This is pinned as
    hard as the authored direction, because it is what a careless
    `schema.surface ?? 'plain'` or a `defaultProps` entry would silently regress for every
    existing document.
  - `chatbot` and `chatbot-floating` do **not** gain the key: they render `<Chatbot>` and
    `<FloatingChatbot>`, which have no such chrome to switch. The docs row is therefore
    scoped to say the key applies to the enhanced registration — the table never again claims
    more than the registrations deliver.
  
  `renderer.surface.test.tsx` pins all of it through the real SDUI host rather than a bare
  component render, and asserts the rendered chrome rather than the forwarded prop, so a
  regression where the key is forwarded but no longer acted on is still red.
- d3499b3: `chatbot-floating` now fences its `<FloatingChatbot>` spread the same way its
  two sibling registrations (`chatbot`, `chatbot-enhanced`) already do —
  `{...toDomProps(props)}`, at the head of the element, instead of a raw
  `{...props}` spread at the end (objectui#7708). This is a deliberate,
  user-visible behavior change, not a refactor:
  
  - **A message sent through a floating chatbot now actually renders.**
    Previously the authored `messages` seed (whatever array was on the node
    when it was authored) silently overrode the live runtime messages on every
    render, because the raw spread landed AFTER `messages={runtimeMessages}`.
    Neither the user's own message nor an `autoResponse` reply ever appeared —
    the identical send on `chatbot-enhanced` worked correctly. Fixed.
  - **`displayMode`, `systemPrompt` and `model` stop leaking as DOM attributes**
    on the panel's root element (`systemPrompt` / `model` are still read
    normally, by name, for the request they configure — only the second,
    unfiltered forward is gone). Closes objectui#4425's leak class on the one
    `plugin-chatbot` registration that had not closed it yet.
  - **Three undeclared keys go dark on `chatbot-floating` nodes:**
    `processVisibility`, `surface` and `showAvatars` reached the panel's
    `ChatbotEnhanced` through the raw spread even though `ChatbotFloatingSchema`
    never declared them. `ChatbotFloatingSchema` documents this explicitly and
    always has — the face never promised these keys — so this closes an
    accidental channel rather than removing declared behavior. A document that
    relied on any of the three to affect a floating node loses that effect;
    author them on a `chatbot-enhanced` node instead, where they are part of
    the declared, tested contract.
  
  `@object-ui/types`: `ChatbotFloatingSchema`'s doc comment is updated to match
  — no type-shape change, so nothing that imports the type needs to change.
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
- 6ce89da: The 确认修改 (confirm changes) card now carries a UI-owned terminal state after approval (#5695): `detectReplayOutcome` lifts the confirm-replay envelope (`replay_*` tool results) into 应用中 / 已生效 / 已暂存为草稿（含内联发布）/ 未生效（含 publishError 首行）, rendered on the original card across the live, hydration/share, and localStorage-cache converters. A failed in-turn publish no longer rehydrates as an ordinary draft card with a live Publish button — the UI-rendered refusal is the layer a model cannot narrate over. New `console.ai.changesApplying/Applied/Drafted/Failed` keys in all ten locale packs.
- 63b4e0e: Fix the three breaks at the AI paywall moment (#7253), measured on a free plan's
  second build iteration when the cloud guardrail refuses "Confirm changes" with a
  429 `AI_DESIGN_QUOTA_EXHAUSTED`.
  
  - **The upgrade CTA no longer opens a 404.** It used to open a client-composed
    `${cloudBase}/apps/cloud-control/sys_environment`, which guessed the control
    plane's console mount, app slug and route — all three wrong — and landed on
    the API's `ENDPOINT_NOT_FOUND` JSON. `cloudInstallDeepLink` /
    `cloudPricingDeepLink` are replaced by `cloudConsoleUrl()`, the
    runtime-supplied cloud origin with no path appended; the control plane's own
    root redirect decides the landing page. The former
    `|| 'https://cloud.objectos.app'` default is gone: a runtime with no upstream
    cloud now renders no upgrade link at all rather than pointing a self-hosted
    user at the vendor's SaaS.
  - **The confirm card gets an explicit failure state.** A quota refusal parks the
    card on "not applied" with the server's own next step (reset tomorrow /
    upgrade) plus the upgrade action, instead of silently rolling back to
    "Confirm / Adjust" as though the click had never happened. Transient failures
    (offline, per-minute rate limit) still roll back, because retrying is the
    right next step there.
  - **The composer is no longer refilled with an already-delivered message.**
    Only text typed into the composer is restorable now; card-driven sends
    (confirm, approve, suggestion chips) send canned text the user never typed and
    no longer leave the previous prompt staged as if it needed resending.
- f157423: Studio workbench and AI tool cards speak the author's language (objectui#7254)
  
  - The Interfaces breadcrumb, canvas caption and navigation rail show the
    metadata label plus a translated kind; the internal `type · name` pair moves
    to the tooltip. An unlabelled nav leaf now falls back to its object name
    instead of rendering an empty row.
  - The Studio top-bar package switcher reads the package's human name from
    either position the packages endpoint serves it in, instead of degrading a
    registry-shaped entry to its reverse-domain id.
  - The dashboard property panel is localized: the spec's authoring form is
    overlaid through the platform's own `metadataForms.<type>` convention, so
    section headings, field labels, hints and the `header` composite's sub-fields
    render in Chinese (developer vocabulary such as "Tailwind units" is replaced
    with something an author can act on, not transliterated).
  - AI tool cards: tool titles resolve through `chatbot.tool.<name>` (all thirty
    platform-provided tools, ten locale packs), the header status badge is
    localized, and the plan count strip is a real plural family instead of an
    English `+ "s"` concatenation.
  - The tool card's header badge and its body badge now come from one producer:
    a proposal that has been confirmed, built or published no longer keeps a
    header reading "Awaiting Approval".

### Patch Changes

- 39f4309: Published typings from every `vite-plugin-dts` package now carry an explicit extension on
  every relative specifier, and a type error in the declaration build now fails the build
  instead of being printed and ignored (objectui#5439, objectui#5483).
  
  **Consumers on `moduleResolution: nodenext` or `node16` may see NEW type errors, and that
  is the fix working.** These packages re-export mostly through NAMED re-exports —
  `export { useObjectChat } from './useObjectChat'`. TypeScript could not follow the
  extensionless hop, but it still DECLARED the name, so the symbol resolved to a silent
  `any`. Nothing errored; consumers simply got no types. With the extension emitted, the
  symbol carries its real type, and any call site that was relying on the `any` now type
  checks for the first time. This is the mode that produced the 21 residual `TS7006` on
  `@object-ui/app-shell` reported against objectui#5365 — a type hole that opened quietly,
  unlike objectui#5365's own `export * from './ui'` packages where the same defect surfaced
  immediately as `TS2305: has no exported member`.
  
  410 extensionless relative specifiers across 19 packages were emitted before this change;
  the count is now 0 in all 22 packages that build typings through `vite-plugin-dts`.
  `@object-ui/fields` was already clean — its sources write explicit `.js` specifiers — and
  is wired so it stays that way.
  
  The second half changes no emitted output today: 22/22 packages built green unmodified, so
  making the declaration step's exit code honest turns nothing red. It changes what a FUTURE
  regression does — print and exit 0, versus fail the build.
- 01c9023: `AiPendingActionsInbox` speaks the session locale — every string in it, not only its timestamps (objectui#7173).
  
  The AI HITL approval inbox held its own relative-time helper returning hardcoded
  English (`'just now'`, `` `${min}m ago` ``), so a zh / ja / ar session read English
  relative times on every row. It is the fifth spelling of that helper in the repo,
  and the file had **no translation wiring at all** — the unwired-component shape,
  not the lookup-swap shape.
  
  It is therefore swept whole. objectui#7142 wired one string into an otherwise
  untranslated component and shipped something visibly half-done, and objectui#7149
  is what finishing that afterwards cost; the triage ruling on this card (2026-09-01)
  carried that forward as *sweep the file whole or leave it*. Everything the user can
  read now resolves from the locale packs: the card heading and description, the three
  tabs, the refresh button, all five status badges, the six column headings, the empty
  state, the row and drawer buttons, all nine drawer field labels, the outcome banner
  and the whole reject-reason dialog.
  
  **No new rows for the four relative-time branches.** `detail.justNow`,
  `detail.minutesAgo`, `detail.hoursAgo` and `detail.daysAgo` already existed,
  translated, in all ten packs, and cross-package key borrowing is this repo's settled
  convention rather than an open question — `ObjectGrid`, `ObjectKanban`, `ObjectTree`,
  `ListView`, `ObjectView`, `NavigationOverlay`, `RecordAttachmentsPanel`,
  `RecordDetailView` and `apps/console` all resolve `detail.*` from outside
  `plugin-detail`. One phrase on one kind of control should not get a second
  translation that can drift from the first.
  
  The rest of the sweep needed copy no pack had, so `@object-ui/i18n` gains an
  `aiApprovals` namespace: 38 keys, translated in all ten packs. It is deliberately
  separate from `approvalsInbox`, which is the human approval-**process** inbox — a
  different surface and a different feature, so no rows are shared with it. Four
  generic verbs are reused rather than forked (`common.refresh`, `common.cancel`,
  `common.loading`, `common.ok`).
  
  **⛔ The five relative-time helpers are not unified.** They differ in real behaviour
  — `Math.round` here against `Math.floor` in `plugin-detail`, thresholds 45s/30d
  against 60s/7d, different tails — so normalising them is a behaviour change wearing
  a refactor's clothes and needs its own card. This inbox's arithmetic is untouched,
  and three rows in the new suite exist only to pin it: 50s renders `1m ago` (a 60s
  threshold would still say "just now"), 90s renders `2m ago` (`Math.floor` gives
  `1m ago`), and 20d renders `20d ago` (a 7d threshold would already show a date).
  
  Two assembled English sentences became single interpolated keys — the outcome banner
  (`Approve for {{id}}: {{message}}`) and the drawer subtitle
  (`Tool {{tool}} on {{object}}`). Their word order differs per locale, which fragments
  around a `<code>` element cannot express, so the two identifiers lose their monospace
  styling. That is the deliberate cost of making those sentences translatable.
  
  Evidence: an `en`-only assertion cannot discriminate here, because each key's `en`
  value is byte-identical to the literal it replaced. The suite asserts in **zh and
  ar**, and the provider-less path separately, in its own file (`createI18n` installs
  itself as react-i18next's module-level global, so a provider-less render in a file
  that has already mounted a provider silently reads that pack instead of the defaults
  map). No inline `defaultValue` anywhere (objectui#3517).
  
  Two consequences of the sweep, both landed here rather than left for CI to find:
  
  `packages/app-shell/src/console/ai/__tests__/ConversationsSidebar.test.tsx` froze its
  `vi.mock('@object-ui/i18n', ...)` factory to a hand-written object. Its import graph
  reaches `plugin-chatbot`, which now resolves `createSafeTranslation` at module scope, so
  the frozen surface made that read `undefined` and the file died during COLLECTION — the
  objectui#6849 shape, which does not look like a test failure. It now spreads
  `importOriginal()` and overrides only `useObjectTranslation`. Measured, not guessed: of
  the 41 frozen `@object-ui/i18n` factories in the repo, running every one of them showed
  this to be the only file whose graph reaches the package.
  
  The ten pack blocks are locale DATA, and locale data lands in the console's eager
  `framework` chunk, so `scripts/check-eager-closure-budget.mjs` raises that chunk's
  ceiling from 512,000 to 524,000 gzipped bytes and re-pins its baseline onto a fresh
  measurement (502,405 to 514,863). Attributed by three console builds: the merge parent
  reads 510,192, this branch with the ten `aiApprovals` blocks cut reads 510,192 again, and
  this branch reads 514,863 — so the whole 4,671-byte delta is the pack data and nothing
  else. Headroom is kept at the line's own convention (9,137 bytes, 0.10x the regression
  the gate must catch) rather than widened; most of the overage was pre-existing drift, with
  the merge parent already at 510,192 of the 512,000 allowed.
- c6198c2: **Breaking for authored metadata:** `ComponentInput.label`, `ComponentInput.defaultValue` and
  `ComponentInput.advanced` are RETIRED on both faces (objectui#7493 item ① and objectui#7781;
  maintainer ruling A of 2026-09-06, immediate, no deprecation window; ADR-0049 enforce-or-remove).
  They are the three keys the manifest serializer does not forward, and nothing read them on any
  publication or consumption path.
  
  No manifest ever published them, so no consumer could ever have read them. `sdui-parser`'s
  serializer (`packages/sdui-parser/src/index.ts`) forwards exactly six keys per input — `name`,
  `type`, `required`, `enum`, `binding`, `description` — so a value authored under any of the three
  never reached `sdui.manifest.json`, the generated JSX `.d.ts`, or a diagnostic; its boundary type
  has no slot for them; the registry's data-source seam reads `name` only; and neither the designer
  nor the app-shell inspectors consult registry `inputs` at all. A structural census over every
  `inputs:` array in the repository (re-measured on this change's merge-base, `name` 951 and `type`
  951 as the controls) counted the writes: `label` 908, `defaultValue` 245, `advanced` 9 — written on
  nearly every registration, read by nothing.
  
  FROM → TO, per key — all three **TOMBSTONED, not removed**, because the route was measured on
  the built face before it was chosen: `ComponentInputSchema` is a non-strict `z.object`, and an
  undeclared key parses GREEN and is silently STRIPPED, so a deletion would have swallowed 1,162
  authored values in silence. The tombstone is what makes the refusal loud and by name.
  
  - `label?: string` → `label?: never` on the interface, `retirementTombstone()` on the Zod mirror.
    Migration: delete the key. An input is identified by its `name` on every path that reaches it;
    nothing ever rendered a label for it.
  - `defaultValue?: any` → `defaultValue?: never` / `retirementTombstone()`. Migration: delete the
    key. The renderer's own fallback read IS the default; tell the author about it in `description`,
    which IS published. (Tightening the type to `unknown` was ruled out: it closes no error class,
    since nothing reads the value.)
  - `advanced?: boolean` → `advanced?: never` / `retirementTombstone()`. Migration: delete the key.
    No designer surface ever hid an "advanced" input; there is nothing to write instead.
  
  The retirement kit: `?: never` on `ComponentInput` (`packages/types/src/base.ts`), so authoring one
  is a `tsc` error at the registration site; `retirementTombstone()` on `ComponentInputSchema`
  (`packages/types/src/zod/base.zod.ts`), so an authored value is REFUSED at parse time with
  `code: 'invalid_type'`, the key named in the issue `path`, and the migration note as the message
  (one string, both channels). Pinned in
  `packages/types/src/__tests__/component-input-retired-keys-7493.test.ts`, which also holds a
  tree-scoped absence census over every `inputs:` array under `packages/**` and `apps/**`.
  
  Accept-set change, stated plainly for reviewers: a document that sets any of the three keys on a
  `ComponentInput` used to parse GREEN (the value was then dropped by the serializer) and now parses
  RED. Every in-repo authoring site — 1,199 keys across 110 registration files, the three standalone
  `ComponentInput[]` arrays and the two named input arrays `tsc` found included — is deleted in the same change, as the ruling's split rule
  requires; the `WidgetRegistry` seam no longer copies the widget-manifest values onto the synthesized
  `ComponentInput` (they fed nothing), and the data-source declaration `ELEMENT_DATA_SOURCE_INPUT`
  drops its `label`. The patch entries on the other packages record exactly that: their registrations
  stop authoring inert keys, with no runtime or published-manifest change.
  
  The nine test files that read `defaultValue` off a registration were re-pinned against the
  renderer's ACTUAL default (its own fallback read, or the `defaultProps` it ships) instead of the
  declaration that went away; two assertions that only restated the shadow default were dropped with
  the reason on the line.
  
  The in-repo zero is what was measured. Whether anything OUTSIDE this repository writes these keys
  is not measurable from here (the objectui#5674 limit); converting such a write from a silent drop
  into a named refusal is exactly what the tombstones buy. `WidgetInput`'s own `label` /
  `defaultValue` / `advanced` (the widget-manifest face) stay declared and writable — nothing has
  ruled on that face; that it now has no reader either is recorded as objectui#7911.
- 3e377c9: Retire `ChatbotSchema.displayMode` — and its copy on `ChatbotFloatingSchema` — as an
  ADR-0049 retirement tombstone, and remove the `chatbot-floating` registration's
  "Display Mode" designer control and its `defaultProps.displayMode: 'floating'` seed
  (objectui#7654, maintainer ruling B of 2026-09-05, director decision batch #44).
  
  ⚠️ **BREAKING for anyone authoring `displayMode` against a chatbot face in TypeScript.**
  Ships as `minor` per the launch-window convention: objectui's `major` is a cross-repo pin
  to `@objectstack`'s so that "same major means compatible" holds across the two repos
  (`scripts/check-changeset-no-major.mjs`), and objectui's own breaking changes ship as
  `minor` with the break named where it lands — this entry is the channel that carries it.
  
  ## What was retired, and why
  
  The node `type` — `chatbot-floating` versus `chatbot` / `chatbot-enhanced` — is the one
  selector of presentation. `displayMode` (`'inline' | 'floating'`) was a second spelling
  of that same choice, and no renderer has ever read it: `chatbot-floating` renders the
  trigger and panel unconditionally, and `chatbot` never looked at the key, so
  `displayMode: 'floating'` on a `chatbot` node produced no trigger and `'inline'` on a
  `chatbot-floating` node changed nothing. It was nevertheless declared on both faces,
  painted as a **Display Mode** control in the designer's property panel, and written as
  `'floating'` into every node the designer created — two surfaces teaching a switch that
  did not exist.
  
  Re-measured on this branch's base rather than inherited from the card: a whole-repo
  `git grep` census over tracked files, build output excluded, returned the declarations,
  the doc comments and parity-ledger entries beside them, one historical CHANGELOG line and
  two unrelated `displayMode` props on `GridField` / `MasterDetailForm` — no read. The same
  pass over `floatingConfig`, a key that IS read, returned 79 lines, so the instrument was
  not blind.
  
  FROM → TO:
  
  - `ChatbotSchema.displayMode?: 'inline' | 'floating'` → **`displayMode?: never`**, an
    ADR-0049 retirement tombstone whose comment points at `type` as the replacement.
  - `ChatbotFloatingSchema.displayMode?: 'inline' | 'floating'` → **`displayMode?: never`**,
    the same tombstone. objectui#7655 declared the key on the floating face with
    `ChatbotSchema`'s own lines precisely so this retirement would find it on both faces;
    leaving the copy typed would have kept the published face teaching the switch.
  - `chatbot-floating` `inputs`: the **Display Mode** control is removed.
  - `chatbot-floating` `defaultProps`: `displayMode: 'floating'` is no longer written into
    designer-created nodes.
  
  A control is restated, never deleted into a vacuum (objectui#7070): the restatement of
  the removed control is the tombstone's guidance plus this note.
  
  **Migration.** Delete `displayMode` from any TypeScript literal typed as `ChatbotSchema`
  or `ChatbotFloatingSchema`; the presentation you wanted is already chosen by `type` —
  `'chatbot-floating'` for the trigger-and-panel, `'chatbot'` / `'chatbot-enhanced'` for
  inline. **No JSON document needs editing** — see the next section.
  
  ## Stored documents: runtime validation of this key is unchanged — zero before, zero after
  
  `displayMode` has never had a Zod arm — it sits in the `UnmirroredDeclared` ledger for
  both `complex.zod.ts#ChatbotSchema` and `#ChatbotFloatingSchema`, and `BaseSchema` is
  `.passthrough()` — so a stored document carrying `displayMode: 'floating'` (every node
  the designer ever created) parses green before this change and parses green after it,
  and the value is dropped at render time exactly as it always was.
  
  That is deliberate, and it is why this tombstone has **no `retirementTombstone()`
  half**: minting a mirror arm to refuse the key would be the declared-but-unmirrored axis
  (objectui#6152), a different defect, and a parse outcome the ruling did not ask for.
  `packages/types/src/__tests__/chatbot-display-mode-retired.test.ts` pins both twins'
  shapes as a **tripwire** — the same shape objectui#7669 gave `triggerIcon` — so that if
  objectui#6152 ever mints an arm for `displayMode`, the pin goes red and whoever lands the
  mirror adds the `retirementTombstone()` half at that time, flipping the control rather
  than deleting it.
  
  ## Why a tombstone and not a deletion — measured on this carrier
  
  `ChatbotSchema` extends `BaseSchema`, which carries a `[key: string]: any` index
  signature, and on such a carrier deleting an optional member is **silent in every value
  shape**: the index signature defeats both excess-property checking and the weak-type
  check. Measured on this member with `tsc -p tsconfig.test.json`, a no-index-signature
  control carrier (`FloatingChatbotConfig`) lit in the same run:
  
  | route | fresh `'floating'` | fresh `'bogus'` | widened `'floating'` |
  |---|---|---|---|
  | declared (before) | clean | `TS2322` | clean |
  | deleted | clean | **clean** | clean |
  | tombstoned (after) | `TS2322` | `TS2322` | `TS2322` |
  
  Deleted, the member reads as `any` and even a wrong-typed value goes quiet. Tombstoned,
  **presence with any value** is a compile error — a channel deletion cannot produce on
  this carrier at all. On a `BaseSchema` carrier the two routes are loud-vs-silent, not
  louder-vs-quieter (the discriminator's carrier branch as corrected on objectui#7678).
  Prong 2 of that discriminator licenses the tombstone: the key was advertised in the
  3.3.0 release record (`CHANGELOG.md:578`) and its published comment taught it as the
  presentation switch. The deleted row is pinned in the test file as a live control — an
  undeclared key that rides both shapes with no directive — so the contrast cannot rot.
  
  ## Accept-set change, one line per face
  
  - **TypeScript.** A write of `displayMode` against either chatbot face used to compile
    and now does not.
  - **Runtime (Zod / `safeValidateSchema`).** Nothing changes at all — a stored document
    carrying the key parses green before and after, and keeps the value.
  - **Designer.** The **Display Mode** control disappears from the `chatbot-floating`
    property panel, and newly created nodes no longer carry the key.
  - **Manifest, author-time validator, and generated JSX props.** The `chatbot-floating`
    registration's `inputs` go from 20 entries to 19 and its `defaultProps` from 9 keys to
    8, so the manifest projected from them no longer lists the prop. Measured on both sides
    of this change: `validateTree` on a stored `chatbot-floating` node carrying
    `displayMode` goes from **0 diagnostics to exactly 1** — code `unknown-prop`, severity
    **`warning`**, message `` `<chatbot-floating> has no prop "displayMode"` `` — which is
    what the JSX/HTML authoring tier reports through `compile()`. In the same pair of runs
    the props interface `generateDts` derives from those same `inputs` drops from 20 members
    to 19, losing its `displayMode?: string` line, so a `.tsx` page written against those
    generated intrinsics no longer type-checks the attribute.
  
    **This is author-time only: no stored document stops parsing and nothing at render
    moves.** The value survives compilation — `compile()` returns a tree still carrying
    `displayMode: 'floating'`, byte-for-byte the same keys before and after — and a
    `warning` never blocks a page, because the page renderer filters the diagnostics to
    `severity === 'error'` before deciding whether to fail. Two neighbouring instruments are
    untouched and worth naming so the scope is not read wider than it is: `os validate` runs
    `safeValidateSchema`, the Zod path, and is silent on this key before and after; and the
    build-time `sdui-intrinsics.d.ts` artifact is generated from the PUBLIC tier, which does
    not contain `chatbot-floating` on either side of this change.
- 4ce14f1: One named, importable authoring-face type per `plugin-chatbot` registration:
  `ChatbotEnhancedSchema` and `ChatbotFloatingSchema` join `ChatbotSchema`
  (objectui#7655, under the objectui#6169 / #6172 family ruling — every component
  node has exactly one named, importable authoring-face type).
  
  `packages/plugin-chatbot` registers three components — `chatbot`,
  `chatbot-enhanced`, `chatbot-floating` — and `@object-ui/types` published ONE
  face for the family with `type` pinned to `'chatbot'`. An author annotating a
  `chatbot-enhanced` or `chatbot-floating` node either dropped to untyped JSON or
  annotated with `ChatbotSchema` and lied about `type`; the docs' floating example
  had to be a `json` fence because no `tsx` fence could compile. The two
  registrations' real key sets lived in anonymous `ChatbotSchema & { ... }`
  intersections local to the renderer, referenceable by nothing outside that file.
  
  ## The shape, and why not the smaller diff
  
  One interface per registration, not `ChatbotSchema['type']` widened to the union
  of the three keys. The union would give three nodes ONE type and re-open what
  #6169 closed — a single interface declaring keys only some of its own `type`
  values read — and this card exists because the family's declarations had already
  drifted from its reads. Each face declares what ITS registration reads, censused
  per key on the PR's base (one `schema.KEY` read per registration body in
  `renderer.tsx`, lit by keys that are NOT shared: `processVisibility` 0 / 1 / 0,
  `floatingConfig` 0 / 0 / 1), and the twenty keys all three read are picked off
  `ChatbotSchema` by name (`ChatbotSharedKey`) so they stay one declaration:
  
  - **`ChatbotEnhancedSchema`** (`type: 'chatbot-enhanced'`): the shared twenty,
    plus `maxHeight` and `processVisibility` (read here, not by the floating
    panel), plus `enableMarkdown`, `enableFileUpload`, `surface` (`'card' |
    'plain'`, objectui#6687) and the `onClear` runtime slot — four keys
    `ChatbotSchema` never declared.
  - **`ChatbotFloatingSchema`** (`type: 'chatbot-floating'`): the shared twenty,
    plus `enableMarkdown`, `enableFileUpload`, `onClear`, and the two keys it
    declares alongside `ChatbotSchema` — `floatingConfig` (`FloatingChatbotConfig`)
    and `displayMode`. No `maxHeight`, `processVisibility` or `surface`: the
    floating registration has no named read for any of them. (Its trailing raw
    props spread does carry authored keys into the panel today — `processVisibility`,
    `surface` and `showAvatars` are live there, measured through the real host;
    that accidental channel is tracked as objectui#7708, and this face neither
    declares nor promises it.)
  - Neither face declares `ChatbotSchema`'s six legacy members (`loading`,
    `showAvatars`, `userAvatar`, `assistantAvatar`, `markdown`, `height`) — no
    registration reads them by name — and neither redeclares `disabled`, which
    stays `BaseSchema`'s `boolean | string` (objectui#7087).
  
  **`ChatbotSchema` is unchanged.** It keeps `displayMode` and `floatingConfig`
  (declarations verbatim), and the floating face declares the same two, so
  `ChatbotSchema['displayMode']` and `ChatbotSchema['floatingConfig']` stay the
  typed members they were — the objectui#7669 `triggerIcon` tombstone keeps its
  reach on `chatbot` nodes, now pinned on the node. `floatingConfig`'s doc comment
  is rewritten on both faces: the old text said it was "only used when
  `displayMode` is `'floating'`", which was false — it is read by `chatbot-floating`
  alone and forwarded to the panel. `displayMode` is RULED RETIRED — objectui#7654,
  maintainer ruling B (2026-09-05): `?: never` tombstone, designer control and
  `defaultProps` seed removed, in that card's own change. This change carries the
  key untouched on both faces (still unmirrored, still read by nothing) so that PR
  finds the member exactly as ruled, and a tripwire test pins that any value still
  parses green until that PR flips it.
  
  **New published symbol:** `ChatbotSharedKey`, the string-literal union of the
  twenty keys all three registrations read. It is exported from `complex.ts`
  because an exported interface may not extend a `Pick` over a private name
  (TS4022), so it is emitted into `dist/complex.d.ts` and is reachable through the
  published `@object-ui/types/complex` subpath (it is not re-exported from the
  package entry). It is a census, not an authoring face.
  
  ## Zod twins, in lockstep
  
  `@object-ui/types/zod` gains `ChatbotEnhancedSchema` and `ChatbotFloatingSchema`
  (and `ComplexSchema` routes the two new discriminants). Every declared key is an
  arm except: the three runtime slots (`onError`, `onSend`, `onClear`), refused by
  name per objectui#6124; and, on the floating twin only, `floatingConfig` (no
  `FloatingChatbotConfig` mirror exists — minting one is objectui#6152's axis) and
  `displayMode` (unmirrored on `ChatbotSchema`'s twin too; retired by ruling on
  objectui#7654 and executed there). The twins mirror the API body params under the
  key the renderer reads, `requestBody`, and inherit `body` as the children slot —
  they do not copy `ChatbotSchema`'s `body` naming collision.
  
  **Accept-set change, stated plainly:** a `chatbot-enhanced` or `chatbot-floating`
  document parsed through the family's only twin used to fail on `type`; through
  its own twin it now parses, and the keys the twin declares are VALIDATED where
  they rode through `.passthrough()` unexamined before (`surface: 'frameless'`,
  `enableMarkdown: 'yes'` and `requestBody: 'x'` are refused). A `chatbot` node's
  parse outcome is unchanged: `ChatbotSchema`'s twin did not move.
  
  ## `@object-ui/plugin-chatbot`
  
  The `chatbot-enhanced` and `chatbot-floating` registrations type `schema` as the
  published faces and drop the anonymous intersections. One consequence:
  `chatbot-floating` used to write `disabled={schema.disabled}` and then spread
  `{...props}` AFTER it — and `SchemaRenderer` always includes `disabled: verdict
  || undefined` in those props, so the raw read was overridden on every render.
  With `disabled` honestly typed as `boolean | string` the raw union cannot be
  forwarded into the panel's `boolean` prop, so the registration now names the
  host verdict (`disabled: hostDisabled`) the way its two siblings have since
  objectui#4431. No render outcome moves; the pin renders through the real host
  both ways.
  
  This ships as `minor` for `@object-ui/types` because it widens the published
  surface with two new node types, two new Zod twins and one new type alias;
  `ChatbotSchema`'s own accept set does not move: objectui's major is pinned to `@objectstack`'s
  (`scripts/check-changeset-no-major.mjs`), and objectui's own contract changes
  ship as `minor` with the semantics spelled out — as above.
- 79a4b8f: Recognize the landed AI quota ledger vocabulary in the chat error path
  
  `parseAiQuotaError` now accepts the three SCREAMING_SNAKE ledger codes the cloud
  token guardrail emits (`AI_ALLOWANCE_EXHAUSTED`, `AI_DESIGN_QUOTA_EXHAUSTED`,
  `AI_DATA_CHAT_TRIAL_EXHAUSTED`) alongside the legacy lowercase trio, which stays
  readable for producers that have not converged yet. The companion fields
  (`messageEn` / `upgrade` / `topUp` / `resetsTonight`) are now read from the
  declared envelope's `error.details` as well as their legacy top-level position,
  with the declared position winning.
  
  A quota-exhausted user gets the upgrade / top-up CTA again instead of the
  generic "Response failed" banner. The per-turn message cap's generic
  `QUOTA_EXCEEDED` deliberately keeps its existing rate-limit path — it has no
  upgrade or top-up next step.
- cc3366b: The built-moment transition (#5799) now fires on auto-publish environments too: `detectBuiltAppPackage` reads the raw build envelope (`status:'drafted'` OR `'published'`, packageId + an `app` item), because an auto-publish posture rewrites apply_blueprint's envelope to `published` and the drafted-only `draftReview` lift never fired there — measured live on staging, where reopening a built conversation stayed on the full page.
- a31adc6: `useObjectChat` no longer rebuilds its `DefaultChatTransport` on every render
  (objectui#4187).
  
  The transport `useMemo` listed the caller's `body` and `headers` in its dep list.
  Both are object props and every caller passes a fresh literal each render — the AI
  page's chat pane builds its `body.context` inline — so the memo never hit and a
  transport was constructed on every render of every chat surface, which during a
  streaming turn is once per token batch.
  
  `body` and `headers` are now read through refs inside
  `prepareSendMessagesRequest`, the idiom this hook already uses for the live model
  (`modelRef`) and the handoff conversation id (`parentConvRef`), and they are gone
  from the dep list. Unlike memoizing at each call site, a future caller cannot
  undo it.
  
  No user-visible behaviour changes: `@ai-sdk/react` keeps the transport in a ref
  and re-keys its `Chat` only on `chat`/`id` (verified against the installed
  4.0.68), which `useObjectChat` passes neither of, so the message thread was never
  at risk — the rebuild was pure waste. The one real difference is *when* the two
  values are sampled: a send now reads them at send time, so it observes the values
  of the most recent render instead of those of the last render that happened to
  rebuild the transport. That is never staler than before, and it is pinned by
  `useObjectChat.transportIdentity.test.tsx`.
- 0fce2ef: `maxToolRoundtrips` on `ChatbotSchema` is deprecated: it is inert, and an author
  who sets it is now told so instead of being left believing the documented cap
  applies (objectui#5605).
  
  The key was declared authorable in `@object-ui/types` (interface and zod, with a
  description), threaded from the authored document through the chatbot renderer at
  three call sites, accepted by `useObjectChat`, given a default — and then dropped.
  Measuring the installed chat runtime says it cannot be honoured from here rather
  than that someone forgot to wire it: `@ai-sdk/react`'s `useChat` takes `ChatInit`
  plus throttle/resume, and `ChatInit` declares exactly one loop control — the
  boolean predicate `sendAutomaticallyWhen` — and no numeric cap under any
  spelling. The numeric knob was removed from `useChat` in a major, and its
  successor was renamed through `continueUntil` to `stopWhen` / `stepCountIs`,
  which the installed `ai` package declares only on `generateText`, `streamText`
  and the tool-loop agent settings — all server-side. ObjectUI is backend-agnostic,
  so it owns no server loop to cap either, and putting the number in the request
  body would only move the same dead key one hop onto a wire contract no backend
  reads.
  
  This is stage one of a two-stage retirement, so nothing an author already wrote
  breaks: the key still parses, still carries its declared shape, and the renderer
  still threads it. What changes is that it is now marked `@deprecated` in the
  interface, the zod description and the docs, and that authoring it logs a
  one-time notice naming the knob that does work — `planning.maxIterations` on the
  agent. A follow-up removes the declaration once this deprecation has shipped in a
  release.
- a392e1c: 「打开这条记录 →」卡片——ask 的记录交接终于有了客户端的另一半
  
  服务端半边（cloud#1659 的 `open_record`）先落了地，实测发现它是**半活的**：agent 发出
  `status:'record_handoff'`、回答说「点击上方链接打开」，而上方根本没有链接——控制台
  有 `build_handoff` 的探测器，这个状态一处都不认识，信号被原样丢弃。
  
  按五步补齐：`detectRecordHandoff`（含持久化 `{type:'text',value}` 包裹形状——replay
  信封那课的规矩）→ live 映射提升 → 水合提升 → 卡片渲染 → 宿主回调。
  
  两个设计点：
  
  - **app 段点击时现场解析**。记录路由要 `/apps/:app/:object/record/:id`，交接载荷只有
    对象和记录 id；宿主回调用一次同源元数据读取 `_packageId` 再导航，不给 agent 增加
    它未必知道的参数。
  - **刻意不做「被取代」置灰**。builder 卡的旧 prompt 会过时，旧的记录链接不会——记录
    不因为有新交接而失效。
  
  真机闭环验证：问「把《沉默的大多数》标记成已读」→ 卡片渲染
  （`沉默的大多数 — 把阅读状态改为已读`）→ 点击 → 落在
  `/apps/app.hdke/hdke_book/record/<id>` 详情页，「编辑」在手边。
  
  缺任一 id 的交接在探测器就被丢弃，与服务端的拒绝对称——指向空处的卡片比散文更糟。
- ad404e0: Confirm-replay dispatch errors (bare `{error: …}` envelopes) now resolve the 确认修改 card instead of leaving it on 应用中 forever: `detectReplayOutcome` classifies them as a provisional failure, and a later successful authoring result in the same turn (the model self-repairing, e.g. after an `object not found` on a blueprint-local name) supersedes it via `detectAuthoringVerdict` — so the card never says 未生效 over a change that actually landed. Real publish failures (`publishFailed` envelopes) are never superseded. Measured live on the local rig, 2026-08-24.
- eddc1dd: The Studio copilot tells the agent WHAT the user is discussing (cloud#1610 send half): `ChatPane` accepts a `surfaceContext` and sends it as `context.surface` on every turn (the transport reads the body per send, so it stays fresh); the Studio copilot derives it from the URL alone — the `:tab` pillar segment plus the `?surface=type:name` deep-link the pillars already mirror, so the artifact carries its type discriminator (page/object/dashboard/report). A display chip above the composer (「正在讨论：…」, new `console.ai.discussing` key in all ten packs) makes the sent context visible instead of invisible grounding.
- 9a9977c: 工具卡片的名字终于有了 i18n 通道（此前中文界面里必然是英文）
  
  实测（cloud#1658，全中文环境）：
  
  ```
  统计一下每个阅读状态各有多少本书
    Describe object    已完成   执行过程     ← 工具名英文
    Visualize data     已完成   执行过程     ← 工具名英文
    已统计完成，各阅读状态的书本数量如下：…    ← 其余全中文
  ```
  
  卡片上每一处都本地化了——状态、动作、回答——**唯独工具名不能**，因为
  `humanizeToolName` 是个纯英文构词器（`describe_object` → `Describe object`），
  名字从未经过翻译，任何语言包都够不着它。而"它现在在做什么"恰恰是用户最需要读懂的一步。
  
  现在它接受一个可选的 `translate`（形状即 `useSafeTranslate()`），按
  `chatbot.tool.<tool_name>` 查；查不到就回落到与今天完全一致的英文标题。
  
  **这一步只打通通道，不改变任何现有显示**：不传 translate 时行为逐字不变（测试的第一组
  就在钉这一点），语言包也还没有条目。后续两件事各自独立、可分别推进：
  把两个调用点接上 `useSafeTranslate()`；以及按需往语言包里补 `chatbot.tool.*`。
  先落通道是因为——在通道存在之前，翻译工作根本无处可放。
  
  回落刻意交给英文标题而非原始名：语言包缺条目时显示 `Describe object`（与今天相同），
  而不是 `describe_object`（比今天更差）。
- Updated dependencies [64dae8e]
- Updated dependencies [b06e374]
- Updated dependencies [06a8af5]
- Updated dependencies [6a91586]
- Updated dependencies [a04d7c6]
- Updated dependencies [9801765]
- Updated dependencies [460575f]
- Updated dependencies [d796c8d]
- Updated dependencies [594704f]
- Updated dependencies [d3995fe]
- Updated dependencies [1b1d772]
- Updated dependencies [d88e20f]
- Updated dependencies [2d7304d]
- Updated dependencies [636b236]
- Updated dependencies [4172589]
- Updated dependencies [64d624d]
- Updated dependencies [053fdc8]
- Updated dependencies [41b7ce3]
- Updated dependencies [39f4309]
- Updated dependencies [d2fb6ef]
- Updated dependencies [7cd3987]
- Updated dependencies [e304a4e]
- Updated dependencies [490d9a9]
- Updated dependencies [fc62bb4]
- Updated dependencies [41df893]
- Updated dependencies [00f3eb5]
- Updated dependencies [1ec291c]
- Updated dependencies [453dbaa]
- Updated dependencies [95f8704]
- Updated dependencies [f8cdbf2]
- Updated dependencies [69a2163]
- Updated dependencies [24e027e]
- Updated dependencies [2c3cd1b]
- Updated dependencies [e176053]
- Updated dependencies [e30ed15]
- Updated dependencies [90665e0]
- Updated dependencies [8d3a529]
- Updated dependencies [5ac2e2c]
- Updated dependencies [194fae1]
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
- Updated dependencies [6fd2cf7]
- Updated dependencies [5fa06c4]
- Updated dependencies [52a43de]
- Updated dependencies [e4559d1]
- Updated dependencies [2c71482]
- Updated dependencies [129bcc5]
- Updated dependencies [a26b9e4]
- Updated dependencies [5ef9c4f]
- Updated dependencies [46f0bb4]
- Updated dependencies [8ec11e1]
- Updated dependencies [6f81384]
- Updated dependencies [22ba927]
- Updated dependencies [f8c70f4]
- Updated dependencies [5d3a2d1]
- Updated dependencies [8f1d995]
- Updated dependencies [b362c1b]
- Updated dependencies [f9c34df]
- Updated dependencies [dddb942]
- Updated dependencies [00c665e]
- Updated dependencies [29754cf]
- Updated dependencies [3c2b6f7]
- Updated dependencies [6e88630]
- Updated dependencies [b84dc18]
- Updated dependencies [ac8abb0]
- Updated dependencies [9d86e1d]
- Updated dependencies [99a3c2d]
- Updated dependencies [5961030]
- Updated dependencies [f24de8b]
- Updated dependencies [c8ea8af]
- Updated dependencies [9602dc8]
- Updated dependencies [3190414]
- Updated dependencies [4e480f5]
- Updated dependencies [38a123c]
- Updated dependencies [299102e]
- Updated dependencies [30c73cd]
- Updated dependencies [830ed58]
- Updated dependencies [d7acad6]
- Updated dependencies [45a9aeb]
- Updated dependencies [713db46]
- Updated dependencies [c71e14d]
- Updated dependencies [bf3a03c]
- Updated dependencies [748494b]
- Updated dependencies [5967be0]
- Updated dependencies [831be72]
- Updated dependencies [29cb85b]
- Updated dependencies [3e028c8]
- Updated dependencies [d0889e2]
- Updated dependencies [ce503e5]
- Updated dependencies [f20dcf0]
- Updated dependencies [12402a9]
- Updated dependencies [aff3d7a]
- Updated dependencies [4ca30d0]
- Updated dependencies [7a5da14]
- Updated dependencies [fff9645]
- Updated dependencies [9c3b7ce]
- Updated dependencies [2c1c967]
- Updated dependencies [9486ac6]
- Updated dependencies [9486ac6]
- Updated dependencies [4d5f9b4]
- Updated dependencies [d6ceb8d]
- Updated dependencies [dc4365c]
- Updated dependencies [e321d52]
- Updated dependencies [969ba84]
- Updated dependencies [4c68077]
- Updated dependencies [7977ff9]
- Updated dependencies [3beef6d]
- Updated dependencies [06b8c42]
- Updated dependencies [46b9bc9]
- Updated dependencies [b97790a]
- Updated dependencies [dbd5194]
- Updated dependencies [7c9b044]
- Updated dependencies [d47de51]
- Updated dependencies [3fe6463]
- Updated dependencies [b392674]
- Updated dependencies [4f3a1e2]
- Updated dependencies [31ab372]
- Updated dependencies [846889b]
- Updated dependencies [26896c6]
- Updated dependencies [67fc3b0]
- Updated dependencies [33a3b3c]
- Updated dependencies [b87f15b]
- Updated dependencies [045d20b]
- Updated dependencies [c18d099]
- Updated dependencies [adb2a86]
- Updated dependencies [03380aa]
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
- Updated dependencies [6a449fc]
- Updated dependencies [446d93d]
- Updated dependencies [ecd9cb2]
- Updated dependencies [98d4108]
- Updated dependencies [0e3b3be]
- Updated dependencies [220c18d]
- Updated dependencies [00d3f09]
- Updated dependencies [4388f71]
- Updated dependencies [c93b4d5]
- Updated dependencies [c1fe272]
- Updated dependencies [8ad218d]
- Updated dependencies [5f78953]
- Updated dependencies [639114c]
- Updated dependencies [639114c]
- Updated dependencies [1490691]
- Updated dependencies [1f31d3a]
- Updated dependencies [d1842ab]
- Updated dependencies [78ca238]
- Updated dependencies [d8ec8d6]
- Updated dependencies [351eb31]
- Updated dependencies [866cd1d]
- Updated dependencies [20c04b2]
- Updated dependencies [01c9023]
- Updated dependencies [48c19bd]
- Updated dependencies [a6d8b8d]
- Updated dependencies [b652514]
- Updated dependencies [adbda1b]
- Updated dependencies [adbda1b]
- Updated dependencies [8952395]
- Updated dependencies [e8c553b]
- Updated dependencies [2e32ed4]
- Updated dependencies [7c3df8f]
- Updated dependencies [a4514e8]
- Updated dependencies [b9f5ff1]
- Updated dependencies [e75f4c9]
- Updated dependencies [19f1639]
- Updated dependencies [4704aa4]
- Updated dependencies [47547d0]
- Updated dependencies [858cd72]
- Updated dependencies [554f2b6]
- Updated dependencies [26e06d7]
- Updated dependencies [669d71b]
- Updated dependencies [ed27d7c]
- Updated dependencies [52c8cf7]
- Updated dependencies [52c8cf7]
- Updated dependencies [3399704]
- Updated dependencies [7bf244b]
- Updated dependencies [f0bb9fa]
- Updated dependencies [81a2eb1]
- Updated dependencies [20cb8db]
- Updated dependencies [00d2fa6]
- Updated dependencies [c6198c2]
- Updated dependencies [2f61238]
- Updated dependencies [51eb515]
- Updated dependencies [c354ce5]
- Updated dependencies [8fe8e5c]
- Updated dependencies [2a5bf45]
- Updated dependencies [9587fc9]
- Updated dependencies [e62c44e]
- Updated dependencies [daf9d57]
- Updated dependencies [c15d7ec]
- Updated dependencies [5d0876c]
- Updated dependencies [f7ace0a]
- Updated dependencies [b041b9c]
- Updated dependencies [ce2aaef]
- Updated dependencies [2ce2612]
- Updated dependencies [bc640ec]
- Updated dependencies [3e377c9]
- Updated dependencies [a3eb5d0]
- Updated dependencies [4ce14f1]
- Updated dependencies [2af1fa7]
- Updated dependencies [c14d3a0]
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
- Updated dependencies [64a252d]
- Updated dependencies [d1bebb0]
- Updated dependencies [4f9f1ee]
- Updated dependencies [c842594]
- Updated dependencies [cf1d29e]
- Updated dependencies [0758bd8]
- Updated dependencies [0ea7054]
- Updated dependencies [fc32921]
- Updated dependencies [8f9d87a]
- Updated dependencies [6bca0e4]
- Updated dependencies [81c0bc4]
- Updated dependencies [3c76801]
- Updated dependencies [2fcefb9]
- Updated dependencies [77f846a]
- Updated dependencies [bc5870c]
- Updated dependencies [b55a346]
- Updated dependencies [065bba7]
- Updated dependencies [dd19463]
- Updated dependencies [100547e]
- Updated dependencies [3a58149]
- Updated dependencies [6d1c155]
- Updated dependencies [d7573b3]
- Updated dependencies [bf3edfe]
- Updated dependencies [2c8474c]
- Updated dependencies [6ce89da]
- Updated dependencies [0e05aac]
- Updated dependencies [ae61ad4]
- Updated dependencies [5aed9e4]
- Updated dependencies [83c77dc]
- Updated dependencies [18a8e7d]
- Updated dependencies [e7957ab]
- Updated dependencies [f7e34ca]
- Updated dependencies [e719ebd]
- Updated dependencies [f9e4f91]
- Updated dependencies [fa429cf]
- Updated dependencies [ed8df3e]
- Updated dependencies [fe76ece]
- Updated dependencies [8ebd57f]
- Updated dependencies [c40f3b8]
- Updated dependencies [58770f3]
- Updated dependencies [aefe428]
- Updated dependencies [485f096]
- Updated dependencies [199d31b]
- Updated dependencies [b655a9d]
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
- Updated dependencies [d7bd274]
- Updated dependencies [98c3a74]
- Updated dependencies [ebce5a3]
- Updated dependencies [9d9040d]
- Updated dependencies [20e317c]
- Updated dependencies [0fce2ef]
- Updated dependencies [9850c6e]
- Updated dependencies [de570cc]
- Updated dependencies [b2ea297]
- Updated dependencies [5b5a5c3]
- Updated dependencies [ab92940]
- Updated dependencies [a691c0b]
- Updated dependencies [0b1326d]
- Updated dependencies [1e66879]
- Updated dependencies [c5200f0]
- Updated dependencies [af3861f]
- Updated dependencies [515f171]
- Updated dependencies [4f14ad7]
- Updated dependencies [258d264]
- Updated dependencies [cac64b3]
- Updated dependencies [fa140b8]
- Updated dependencies [71cba28]
- Updated dependencies [190fbd0]
- Updated dependencies [c00bf28]
- Updated dependencies [f2158ec]
- Updated dependencies [fd8dace]
- Updated dependencies [72ffc34]
- Updated dependencies [bf28341]
- Updated dependencies [78cbdb5]
- Updated dependencies [b7543a9]
- Updated dependencies [6c6cee7]
- Updated dependencies [42887e0]
- Updated dependencies [83fe6e7]
- Updated dependencies [d1ab06f]
- Updated dependencies [38a9568]
- Updated dependencies [f90b8fb]
- Updated dependencies [91783c4]
- Updated dependencies [dba7d84]
- Updated dependencies [5a07e67]
- Updated dependencies [2d36552]
- Updated dependencies [45d8288]
- Updated dependencies [b2437a7]
- Updated dependencies [f157423]
- Updated dependencies [7a90afd]
- Updated dependencies [eddc1dd]
- Updated dependencies [490f482]
- Updated dependencies [27308c5]
- Updated dependencies [8689166]
- Updated dependencies [c9327c9]
- Updated dependencies [920165d]
- Updated dependencies [9101be5]
- Updated dependencies [f53a8d0]
- Updated dependencies [57f9b07]
- Updated dependencies [3c73d99]
- Updated dependencies [d91aed9]
- Updated dependencies [ed71d9e]
- Updated dependencies [7776fc2]
- Updated dependencies [c86185e]
- Updated dependencies [fb96ecb]
- Updated dependencies [1170ed1]
- Updated dependencies [4d73b07]
  - @object-ui/i18n@17.7.0
  - @object-ui/core@17.7.0
  - @object-ui/types@17.7.0
  - @object-ui/components@17.7.0
  - @object-ui/react@17.7.0

## 17.6.0

### Patch Changes

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

## 17.5.0

### Minor Changes

- 3256b14: `@object-ui/plugin-chatbot`'s `ChatMessage` is now one type instead of two

  The barrel exported two different `ChatMessage` types: a minimal one it declared itself (`id` / `role` / `content` / `timestamp` / `avatar` / `avatarFallback`) and the shape `<ChatbotEnhanced>` actually renders, re-exported under the alias `ChatbotEnhancedMessage`. The natural name resolved to the narrow one, so an importer reaching for `ChatMessage` silently got the wrong contract — and the compiler could not object, because both shapes existed on purpose and every construction site spreads the extra keys conditionally, which defeats excess-property checking. That is how app-shell's `AiChatPage` ended up unable to read `toolInvocations` off its own function's return value (objectui#4040; re-pointed in PR #4379, but the collision itself was left standing). objectui#4383.

  **Breaking semantics** (declared `minor` per AGENTS.md §版本号策略 — objectui never declares `major` outside an `@objectstack` major sync): `ChatMessage` exported from `@object-ui/plugin-chatbot` now denotes the enhanced shape. In practice this is a widening rather than a removal — every field of the retired shape survives with the same type, and the enhanced shape adds only optional keys (`streaming`, `toolInvocations`, `reasoning`, `sources`, `traceId`, `buildProgress`, `blueprintProgress`, `charts`), so anything that was a valid `ChatMessage` still is, and `<Chatbot messages={…} />` keeps accepting the same values. Code that relied on the name meaning _exactly_ the six-key shape (exhaustive `keyof` maps, `Equal`-style assertions) is the case that changes.

  `ChatbotEnhancedMessage` is kept as a `@deprecated` alias of the same type, so importers that spelled the disambiguating name keep compiling; new code should import `ChatMessage`. Pinned at compile time by `packages/plugin-chatbot/src/__tests__/chat-message-contract.test.ts`.

- eec2e4f: `useObjectChat` declares the message shape it actually hands back

  The hook typed `messages` — and the `onSend(content, messages)` callback fed from it — as `@object-ui/types`' authoring `ChatMessage`. That was true in local mode only. In API mode the values came out of the runtime mapper and were asserted into place with `as OuiChatMessage[]`, and the authoring contract declares none of what they carry: `buildProgress`, `blueprintProgress`, `charts`, and `pendingActionId` / `draftReview` / `proposedPlan` / `proposedChanges` / `builderHandoff` on every tool invocation. Those keys are the HITL approval card, the "Review N changes" affordance, the proposed-plan card, the build panel and the inline charts. They survived only because nothing on the path ever rebuilt a message; anyone writing the obvious thing — reconstruct a message field-by-field from its declared type — deleted all of them, with the compiler agreeing, because the declared type genuinely did not have them.

  The declaration is now the truth, published as `ObjectChatMessage`. The survey behind it found the honest type to be neither of the two `ChatMessage` types on either side, because neither is true of both modes: it stays **wide** where local mode is wide (an authored `'tool'` role and the legacy `'partial-call'` / `'call'` / `'result'` tool states reach this surface unchanged and are folded only at the render seam), **narrow** where both modes are narrow (`timestamp` is `string`, never `Date` — API mode never produces one and local mode absorbs it before emitting), and adds the render-only keys API mode really carries. The `as OuiChatMessage[]` assertion is deleted rather than moved: the mapper's output satisfies the declared type, so the compiler checks that assignment instead of being told to stop looking.

  Nothing about the values changed, and nothing correct breaks. `ObjectChatMessage` is a **subtype** of the authoring `ChatMessage` it replaces, so every consumer that accepted the old declaration still accepts these values — including a host `onSend` callback that types its parameter as `ChatMessage[]`, which keeps type-checking by contravariance. Naming `ObjectChatMessage` is what lets a host _read_ the keys above. The one observable narrowing is deliberate: code that branched on `timestamp instanceof Date` was handling a value this hook cannot emit, and now says so at compile time.

  The seam below it (`chatMessageAdapter.ts`, from objectui#4399) is still necessary and unchanged in behaviour — `'tool'` and the legacy tool states still have to be narrowed for the renderers. What changed is that its pass-through is no longer an act of faith: its input type (`SeamChatMessage`, also exported, alongside `SeamToolInvocation`) names the render-only keys, so the spread preserves them as declared properties the compiler can see, and the pass-through tests type their API-mode fixture directly instead of casting it past the compiler. A cast returning to the hook is now caught by a test rather than by a future outage.

  App-shell carries a comment-only correction on the same family: `AiChatPage` still described `@object-ui/plugin-chatbot` as exporting a second, minimal legacy `ChatMessage` alongside the enhanced one. That collision was retired in objectui#4383 — the barrel publishes one contract and `ChatbotEnhancedMessage` is a deprecated alias of it — so the paragraph was sending readers to look for a hazard that no longer exists.

### Patch Changes

- dde7283: `chatbot` and `chatbot-enhanced` now pass only whitelisted DOM props to their host element (objectui#4431)

  Both registrations destructured `schema` and `className` and forwarded everything else. `SchemaRenderer` hands a registered component the authored node's own keys, the contents of its `props` container, the ARIA it resolved and the host's trailing props — so all of it became attributes on the chat root `div`, because React passes unknown lowercase attributes through in silence and stringifies object values. Measured through the real SDUI path with a data-source adapter attached: **14 non-DOM attributes on each widget**, including `datasource="[object Object]"` (the injected adapter, which only appears on a deployment that really loads data) and a camelCase `arialabel` sitting next to the resolved `aria-label`, so the element carried each ARIA value twice under two spellings — one of them meaningless to assistive technology.

  Both are now consume-or-whitelist: configuration is read off `schema` as before, the evaluated `disabled` verdict is consumed by name, and only `toDomProps`' output reaches the element. The resolved `aria-label` / `aria-describedby`, `role`, `id`, `tabIndex` and the `data-*` family still arrive — dropping them would have been an accessibility regression dressed as a leak fix, so the pin asserts the delivered set exactly, not just the absent one. `chatbot-floating` is untouched: its content mounts through a portal and its root never spread.

  `@object-ui/core` gains the shared executor this migration needs (`utils/dom-props.ts`): `toDomProps` for the SDUI widget contract, plus `pickDomProps` — the mechanism — for a package whose own contract declares a different key set. That is the objectui#4409 dependency direction: plugin packages declare `@object-ui/core` and must not grow a dependency on `@object-ui/fields` to reach a whitelist.

  `@object-ui/fields` keeps its own key list and its compile-time bindings, and now executes them through core's mechanism. Its behaviour is unchanged and its exported `DomProps<P>` is the same structural type. The two lists differ for measured reasons and no longer can drift silently: `name` and `disabled` are legal only on form controls, which is what every field widget renders and what `FieldWidgetComponentProps` declares, while `role` is resolved by `SchemaRenderer` for every SDUI node and is not part of the field contract. A new assertion binds every shared key in both directions, with `role` named as the single deliberate exception.

- 37bbc42: Replace the three `messages as any` casts at the `@object-ui/types` ↔
  `@object-ui/plugin-chatbot` `ChatMessage` boundary with one explicit typed
  adapter (`toRuntimeMessages` / `authoredToRuntimeMessage`, now exported).

  The authoring contract (`ChatbotSchema['messages']`) and the runtime contract
  `<ChatbotEnhanced>` renders are both deliberate and deliberately different; the
  casts erased ALL of that drift rather than the intentional parts, so a future
  vocabulary move would have surfaced as rendering behaviour instead of a type
  error. Each narrowing is now named, documented and tested: an authored
  `role: 'tool'` message is an assistant message (unchanged rendering — the
  implicit fallthrough is now the recorded decision), a `Date` timestamp becomes
  its ISO string (one expression, consumed by both the seam and the hook's
  `normalizeMessages`), and the legacy tool-invocation states
  `'partial-call'`/`'call'`/`'result'` map to their AI SDK v6 equivalents as the
  authoring type's own documentation declares — previously they reached the tool
  chip unrecognised and rendered a status badge with no label.

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

## 17.4.0

### Minor Changes

- d9ce385: `ApproveOutcome` / `RejectOutcome` are now derived from `@objectstack/spec`
  instead of hand-transcribed (objectui#3783). Same failure class #3220 cleared
  from the same file for `PendingActionRow` / `PendingActionStatus` — but this pair
  wore local names rather than spec names, so `check-spec-symbol-derivation.mjs`,
  which fires on a spec export name being occupied, had no handle on it. A renamed
  hand copy is invisible to a name-based guard by construction.

  Both types now re-export the spec's decision responses
  (`ApproveAiPendingActionResponse` / `RejectAiPendingActionResponse` from
  `@objectstack/spec/api` — the same schemas `@objectstack/client`'s
  `ai.pendingActions.approve()` / `.reject()` type their returns with). The public
  export names do not change. The shapes do, in three ways:

  - **`ApproveOutcome` no longer declares `id`.** The approve response has never
    carried one — `id` is on the _reject_ response. This was the one drift that
    was not dormant: `useHitlInChat`'s public `onDecided` callback promised
    consumers `id: string` and handed them `undefined` at runtime, with nothing
    in the compiler to say so. **If you read `outcome.id` after an approve, that
    read was already `undefined` and now fails to compile** — take the id from
    `ContinueContext.pendingActionId` or from the row you decided on.
  - **`status` is closed.** `'executed' | 'failed' | string` and
    `'rejected' | string` were both just `string`: a union with `string` absorbs
    the literals, so neither annotation carried any information. They are now
    `'executed' | 'failed'` and `'rejected'`.
  - **The `[k: string]: unknown` index signature on `ApproveOutcome` is gone.** The
    objectstack#4075 mechanism: with it, any structural comparison against the
    spec answers "identical" however far the copy has drifted, so a parity test
    bolted onto the old type would have been green from its first day.

  **Breaking at the type level for importers of `@object-ui/plugin-chatbot`** —
  narrowing a published type is a break even when the old type was lying, which is
  why it is spelled out here. Shipped as `minor` per AGENTS.md §版本号策略: the
  family's `major` tracks `@objectstack`'s, and objectui's own breaking changes go
  out as `minor` with the break named in the changeset.

  Runtime behaviour is unchanged — including the hook's decision handling for a
  status outside the spec vocabulary, and the locally synthesized failure envelope
  on a non-2xx, both now pinned by tests. The consumer-side tolerances that remain
  in `useHitlInChat` are recorded in objectui#3790 for a maintainer decision.

### Patch Changes

- 2a54e86: `parseAiQuotaError` now reads the AI quota refusal code from all three shapes the
  cloud 429 producers use, instead of only the flat `error`-holds-the-code dialect.

  The two live producers fill the same `error` key in opposite ways — the token
  guardrail puts the **code** there, `service-ai` puts the **message** there and the
  code in a `code` sibling — while ADR-0112 declares a third shape both are
  converging on: `{ success: false, error: { code, message } }`. The consumer had to
  learn the declared shape **first**, or the producers' convergence would silently
  turn every quota refusal back into a generic "Response failed" banner (the same
  consumer-first sequencing as objectui#2992).

  - Code lookup order is a total order — declared envelope, then the flat guardrail
    code, then the `code` sibling — so a transitional producer that double-emits the
    new envelope alongside the legacy top-level keys has one defined outcome.
  - Only the code's **location** widens. The recognized code set is unchanged, and
    any unrecognized shape still degrades to today's behavior (`null`), so no
    non-quota error is newly captured by the quota CTA.
  - Companion fields (`upgrade`, `topUp`, `messageEn`) keep their established
    top-level read; their position inside the declared envelope is deliberately not
    presumed, and is aligned once the producer PR fixes the real shape.

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

## 17.3.0

### Patch Changes

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

## 17.2.0

### Minor Changes

- c5ccbd5: Stop declaring 12 `@object-ui/data-objectstack` / `@object-ui/plugin-chatbot` /
  `@object-ui/plugin-list` symbols under names `@objectstack/spec` owns
  (objectui#3160, objectstack#4115 batch 6). All three packages leave the ledger.

  **Breaking for importers of `@object-ui/data-objectstack`** — four exported
  names changed, because the spec exports the same name for a _different_ thing:

  | was                   | now                         | what the spec's same-named export actually is                                            |
  | :-------------------- | :-------------------------- | :--------------------------------------------------------------------------------------- |
  | `CacheStats`          | `MetadataCacheStats`        | the platform `ICacheService` counters (`keyCount`, `memoryUsage`)                        |
  | `MetadataSaveOptions` | `MetadataClientSaveOptions` | options for writing a metadata item to a **file** (`format`, `path`, `indent`, `atomic`) |
  | `SecurityPolicy`      | `SecurityManagerPolicy`     | the package supply-chain policy (`autoScan`, licences, code signing, sandbox)            |
  | `ValidationError`     | `DataApiValidationError`    | a plain `{ field, message, code? }` entry in a validation report                         |

  Each pair is disjoint or nearly so — `MetadataSaveOptions` and `SecurityPolicy`
  share not one key with the spec type whose name they wore — so none of them was
  a dialect to reconcile; they were four unrelated concepts squatting on spec
  names. `DataApiValidationError` follows the `<what was validated>Validation<Error|Result>`
  convention registered on objectstack#4115 (`@object-ui/core` took
  `SchemaNodeValidationError` in batch 4). Its **runtime** `name` deliberately
  stays `'ValidationError'`: `normaliseClientError` and `@object-ui/react`'s
  error-message helper both sniff `err.name`, so that string is a wire contract,
  not a symbol.

  **Breaking for importers of `@object-ui/plugin-chatbot`** — `PendingActionRow`
  and `PendingActionStatus` are now re-exported from `@objectstack/spec/contracts`
  instead of hand-transcribed, which narrows them. The copies had drifted three
  ways, and each drift had **disabled a compile-time check** rather than merely
  differed from one:

  - `status: PendingActionStatus | string` — a union with `string` absorbs the
    literals, so that annotation carried no information at all;
  - `[key: string]: unknown` — the objectstack#4075 mechanism: an index signature
    makes every structural comparison against the spec answer "identical", however
    far the copy has drifted;
  - `created_at` / `updated_at`, which the service contract does not carry and no
    consumer in this repo reads.

  **Breaking for importers of `@object-ui/plugin-list`** — `ViewTab` is derived from the spec's `ViewTabSchema`
  — from its **input** side, because `pinned` / `isDefault` / `visible` carry
  `.default()`s and this component is handed authored metadata, not parsed output.
  That removes a renderer-side tolerance the copy carried: `visible` accepted
  `string | boolean` and the tab bar compared it against the literal `'false'`, a
  spelling no producer emits. `label` also stops being required (the spec makes it
  optional; `name` is the identifier) and `filter` stops being `any`.

  `ListView` and `UserFilters` keep their names as declared dialects: both are the
  React **renderers** of the spec types whose names they share, and each takes that
  spec type as a prop (`ListViewProps.schema`, `UserFiltersProps.config`) rather
  than restating its shape. `Tool` and `MessageContent` in `plugin-chatbot` are
  vendored Vercel AI Elements / Shadcn primitives — upstream's component API, not
  objectui's authored surface — so the guard now skips that directory the same way
  it already skips `components/src/ui/`, with a test that fails if any file there
  stops carrying its vendor banner.

  Scored `minor`, not `major`, per this repo's fixed-group rule — objectui's major
  tracks `@objectstack`, so breaking changes of our own ship as minor with the
  semantics spelled out above (see AGENTS.md §版本号策略). A `major` here would carry
  all 39 packages of the fixed group to `18.0.0` and off objectstack's 17.x line.

### Patch Changes

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

## 17.1.0

### Patch Changes

- 9a13622: **Read the agent catalog in the declared envelope too, before the server converts.**

  `GET /api/v1/ai/agents` is served by two producers — the framework dispatcher's
  degraded fallback when no AI service is registered, and cloud's `service-ai` — and
  it is one of the last SDK-addressable routes still answering outside the platform's
  declared `{ success: true, data }` envelope (objectstack#4053). `useAgents` read
  only `{ agents }` and a bare array, so the day either producer converts, the parse
  would miss.

  That miss is unusually dangerous on this particular route, which is why it is worth
  getting ahead of rather than fixing after. The catalog is not just data:
  `useAiSurfaceEnabled` gates the **entire AI surface** on `agents.length > 0`,
  because the route is access-filtered per caller and is therefore the only signal
  that is both edition- and user-aware (ADR-0068). An empty list is the correct
  answer for a seat-less user or a Community-Edition deployment with no `service-ai`
  — so a parse miss and the legitimate hidden state are **indistinguishable**: no
  error, no 403, no log, just the FAB, the top-bar link and the designer's "Ask AI"
  quietly gone for everyone.

  `extractAgentList` now folds all four shapes to the same list — a bare array,
  `{ agents }`, `{ success: true, data: [...] }`, and `{ success: true, data:
{ agents } }` — detecting the envelope the way `ObjectStackClient.unwrapResponse`
  does (a **boolean** `success`), so the two readers cannot disagree about what
  counts as one. Nine tests cover it; reverting to the previous two-shape read fails
  five of them.

  No behaviour change against any server shipping today: the shapes that worked
  before still parse identically. This only removes the lockstep requirement, so the
  server side can convert on its own schedule.

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

## 17.0.0

### Patch Changes

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

## 16.1.0

### Patch Changes

- 59db1f9: chore(lint): clear the baseline lint errors in plugin-chatbot (objectui#2713 Wave 3)

  Wave 3 of the #2713 lint-gate restoration. `@object-ui/plugin-chatbot` was red at
  baseline on `main`; cleared every **error** (no behavior change; warnings out of
  scope):

  - **`react-hooks/rules-of-hooks` in `useObjectChat` (8)** — the hook called
    DIFFERENT `useCallback`s in each of its two `isApiMode` return branches, so
    both sets were conditional (React throws if the mode toggles between renders).
    `useChat` was already called unconditionally; this destructures its result and
    hoists all eight callbacks (3 API + 5 local) above the `isApiMode` branch, so
    the same hooks run in the same order every render. Only the returned surface
    differs by mode — the callback bodies are unchanged (the API `messages` local
    is renamed `apiMessages`). Verified against the `useObjectChat.sendFailure` /
    `handoffContext` / `ChatbotEnhanced.sendError` suites.
  - **`react-hooks/rules-of-hooks` in `FloatingChatbotTrigger`** —
    `useChatbotLabel` wrapped the provider-safe `useObjectTranslation` in
    try/catch; removed the wrapper (the #2709 fix).
  - **`react-hooks/static-components` in `shimmer`** — `motion.create(Component)`
    genuinely builds a motion component and must key off the `as` prop, so it
    can't be module-scoped. Memoized per `Component` (stable across renders,
    avoids the remount) and carries a justified scoped disable at the render site.

- Updated dependencies [1c8935a]
- Updated dependencies [8b8b744]
- Updated dependencies [7cf4051]
- Updated dependencies [803558e]
- Updated dependencies [2e7d7f0]
- Updated dependencies [ef14f69]
- Updated dependencies [94d4876]
- Updated dependencies [69fa5d1]
- Updated dependencies [549c67d]
- Updated dependencies [2b17339]
- Updated dependencies [31b77d4]
- Updated dependencies [6d4fbe6]
- Updated dependencies [0a3710b]
- Updated dependencies [62b9ab5]
- Updated dependencies [1629313]
- Updated dependencies [29c6040]
- Updated dependencies [faebac3]
- Updated dependencies [2331ac9]
- Updated dependencies [199fa83]
- Updated dependencies [eee4ded]
  - @object-ui/core@16.1.0
  - @object-ui/types@16.1.0
  - @object-ui/react@16.1.0
  - @object-ui/components@16.1.0

## 16.0.0

### Patch Changes

- c0bd483: Plan-card approval gives immediate in-card feedback (#2627): clicking
  "Build it" flips the clicked card to a spinning "Building…" badge right away
  (the approval's chat-level effects land at the bottom of the thread, outside
  the viewport, so the card looked untouched for ~10s and users double-clicked).
  The durable Built state still derives from the message stream; an approval
  that never left the client (rate limit / offline) rolls the badge back so the
  button returns. New `planBuildingLabel` prop (AiChatPage passes zh).
- Updated dependencies [d3e19ed]
- Updated dependencies [59d4fa9]
- Updated dependencies [4c7c47f]
- Updated dependencies [210806a]
- Updated dependencies [b4ef588]
- Updated dependencies [5534535]
- Updated dependencies [9b8f978]
- Updated dependencies [195a651]
- Updated dependencies [33b4995]
  - @object-ui/react@16.0.0
  - @object-ui/components@16.0.0
  - @object-ui/types@16.0.0
  - @object-ui/core@16.0.0

## 15.0.0

### Patch Changes

- @object-ui/types@15.0.0
- @object-ui/core@15.0.0
- @object-ui/react@15.0.0
- @object-ui/components@15.0.0

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

- Updated dependencies [0890fa7]
- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [5523fc4]
- Updated dependencies [887062c]
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
  - @object-ui/core@14.1.0
  - @object-ui/types@14.1.0
  - @object-ui/react@14.1.0
  - @object-ui/components@14.1.0

## 14.0.0

### Minor Changes

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

- bfea27f: Make the ask-decline wait feel responsive: live thinking indicator + handoff card the moment `suggest_builder` lands (#2458 item 3).

  When the `ask` agent declines a build-shaped request, the ~20s before the "Open in Builder →" card is dominated by the LLM's time-to-tool-call. During that wait the chat could show dead air — a blank bubble, or the static "执行过程" activity note (a hydrated-history affordance) when the backend streamed a `(called …)` tool-call placeholder.

  `ChatbotEnhanced` now shows the existing live thinking indicator (`ThinkingDots`) whenever a streaming assistant turn has nothing visible yet — including whitespace-only content, a mid-stream `(called …)` placeholder, and hidden reasoning in `summary` mode. The static "执行过程" note is reserved for FINISHED (re-hydrated) tool-call-only turns (#772 preserved). The `builderHandoff` card already renders at `output-available` with no gate on the trailing prose, so it surfaces the instant the tool result arrives; the typing cursor now only paints beside real streaming prose (no lone cursor during the tool phase).

- 408f4ba: fix(plugin-chatbot): build-result summary truncates on mobile instead of overflowing (#2493)

  The draft-review card's summary line (`built N artifact(s) — …`) is a nowrap
  `truncate` span, but its flex row lacked the `min-w-0` that lets `truncate`
  actually bite — so on a phone the long summary expanded the chat column past
  the viewport and the whole chat scrolled sideways. The span now gets
  `min-w-0 flex-1` (truncating within the row) and the action row is `flex-wrap`
  so its buttons drop to a new line on a narrow screen rather than forcing
  horizontal scroll. Desktop is unchanged (there's room, so nothing wraps or
  truncates).

- Updated dependencies [443360a]
- Updated dependencies [86c69c3]
- Updated dependencies [05e56ca]
- Updated dependencies [a44e7b6]
- Updated dependencies [6a74160]
  - @object-ui/core@14.0.0
  - @object-ui/react@14.0.0
  - @object-ui/types@14.0.0
  - @object-ui/components@14.0.0

## 13.2.0

### Patch Changes

- Updated dependencies [80901aa]
- Updated dependencies [e492b9d]
  - @object-ui/components@13.2.0
  - @object-ui/react@13.2.0
  - @object-ui/types@13.2.0
  - @object-ui/core@13.2.0

## 13.1.0

### Patch Changes

- @object-ui/types@13.1.0
- @object-ui/core@13.1.0
- @object-ui/react@13.1.0
- @object-ui/components@13.1.0

## 13.0.0

### Patch Changes

- Updated dependencies [ac04b76]
- Updated dependencies [619097e]
  - @object-ui/components@13.0.0
  - @object-ui/types@13.0.0
  - @object-ui/react@13.0.0
  - @object-ui/core@13.0.0

## 12.1.0

### Patch Changes

- Updated dependencies [6cbccf3]
- Updated dependencies [c31874d]
  - @object-ui/components@12.1.0
  - @object-ui/types@12.1.0
  - @object-ui/react@12.1.0
  - @object-ui/core@12.1.0

## 12.0.0

### Patch Changes

- Updated dependencies [226fde9]
- Updated dependencies [e4de456]
  - @object-ui/types@12.0.0
  - @object-ui/core@12.0.0
  - @object-ui/components@12.0.0
  - @object-ui/react@12.0.0

## 11.5.0

### Patch Changes

- Updated dependencies [6fffd3d]
- Updated dependencies [9255686]
- Updated dependencies [fae75e2]
- Updated dependencies [1072701]
  - @object-ui/react@11.5.0
  - @object-ui/components@11.5.0
  - @object-ui/types@11.5.0
  - @object-ui/core@11.5.0

## 11.4.0

### Patch Changes

- Updated dependencies [8bf6295]
- Updated dependencies [1948c5b]
- Updated dependencies [bce581a]
- Updated dependencies [c38d107]
- Updated dependencies [7782698]
- Updated dependencies [e84d64d]
  - @object-ui/types@11.4.0
  - @object-ui/components@11.4.0
  - @object-ui/core@11.4.0
  - @object-ui/react@11.4.0

## 11.3.0

### Minor Changes

- 8d351f1: chore(chatbot): upgrade to Vercel AI SDK v7 / @ai-sdk/react v4

  Bump `ai` ^6 -> ^7 and `@ai-sdk/react` ^3 -> ^4. The chatbot's `useChat`,
  `DefaultChatTransport`, `UIMessage`/`ChatStatus` usage and the `mapMessages`
  parts adapter are all source-compatible with v7 — no code changes required.

  Verified: type-check clean, build green, 183/183 unit tests pass on v7.

  Part of the org-wide AI SDK v6->v7 / providers v3->v4 upgrade (framework#2464,
  cloud#710).

### Patch Changes

- Updated dependencies [d88c8ec]
- Updated dependencies [b7237bb]
- Updated dependencies [d23d6eb]
  - @object-ui/components@11.3.0
  - @object-ui/core@11.3.0
  - @object-ui/react@11.3.0
  - @object-ui/types@11.3.0

## 11.2.0

### Patch Changes

- Updated dependencies [9e7a986]
- Updated dependencies [1311749]
  - @object-ui/components@11.2.0
  - @object-ui/core@11.2.0
  - @object-ui/react@11.2.0
  - @object-ui/types@11.2.0

## 11.1.0

### Minor Changes

- 27bef5a: feat(ai-build): event-driven "Designing your app…" progress for the blueprint-design stream (Refs cloud#657, cloud#655)

  `propose_blueprint` now streams a reconciled `data-blueprint-progress` part while it drafts the plan (a tens-of-seconds, otherwise-opaque LLM call), so the chat shows the app taking shape — objects appearing one-by-one with their field counts, the summary / extend target revealed progressively, and a `seq`-driven liveness cue — instead of a purely presentational rotating-hint placeholder.

  - `mapMessages`: `uiMessageToChatMessage` lifts the latest `data-blueprint-progress` frame onto `ChatMessage.blueprintProgress` (same single-reconciled-part mechanism as `data-build-progress`; transient, never persisted). This is the shared streaming converter both the full-page AI Build surface (`AiChatPage` via `useObjectChat`) and the floating console chatbot already route through.
  - `ChatbotEnhanced`: a new `BlueprintProgressPanel` renders the live "Designing…" card (object chips + summary + running counts + liveness). It supersedes the rotating-hint placeholder while events flow, and yields to the authoritative "Proposed plan" card the instant the `propose_blueprint` result lands.
  - Graceful degradation: with no `data-blueprint-progress` events (older runtimes / non-streaming turns) the existing rotating-hint placeholder behaves exactly as before — zero regression. On reload the persisted "Proposed plan" card is the record (the live panel is transient by design).

### Patch Changes

- @object-ui/components@11.1.0
- @object-ui/react@11.1.0
- @object-ui/types@11.1.0
- @object-ui/core@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/types@7.3.0
- @object-ui/core@7.3.0
- @object-ui/react@7.3.0
- @object-ui/components@7.3.0

## 7.2.0

### Patch Changes

- Updated dependencies [d23db5c]
  - @object-ui/types@7.2.0
  - @object-ui/components@7.2.0
  - @object-ui/react@7.2.0
  - @object-ui/core@7.2.0

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

## 7.0.0

### Minor Changes

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

- 9049bbe: Add end-user friendly agent process summaries for chatbot tool calls, with a debug mode for raw reasoning and tool details. Console chat surfaces now keep a sanitized browser-side display cache so refreshes can restore user/assistant text plus grouped tool states when the backend returns no message rows.
- 053c948: feat(plugin-chatbot): render AI data-query charts inline (`data-chart`)

  Companion to the framework `visualize_data` tool: the data-query assistant can
  now answer with a CHART rendered right in the assistant bubble.

  - `mapMessages.ts` — `extractCharts()` lifts every `data-chart` custom stream
    part onto `ChatMessage.charts` (defensive narrowing; preserves multiple charts
    in order), mirroring the existing `data-build-progress` → `buildProgress` path.
  - `ChatbotEnhanced.tsx` — renders each chart via `<SchemaRenderer schema={{
type:'chart', … }}/>` (decoupled — no hard dep on `plugin-charts`), giving the
    chart a definite `width: min(520px, 80vw)` so recharts' `ResponsiveContainer`
    measures a stable non-zero width inside the `w-fit` bubble (otherwise the
    circular width dependency leaves bars unpainted).

- 053c948: feat(plugin-chatbot): honest liveness indicator on running AI turns

  AI app builds run 1–3 min with long quiet gaps (LLM thinking, sample-data
  generation) where a static spinner is indistinguishable from a dropped
  connection. The chat now shows a Claude-Code-style liveness indicator driven by
  REAL observed stream activity, not a free-running clock:

  - `useTurnLiveness(active, activityKey)` stamps the moment real data arrives (a
    streamed token / tool delta / `data-build-progress` update) and measures
    seconds-since-last-byte.
  - `LivenessIndicator` renders three honest states — _receiving_ (emerald pulse +
    m:ss, bytes arrived recently), _waiting_ (request in flight, nothing back yet),
    and _stalled_ (amber + "no response for Ns", genuinely silent past 6s).
  - The build panel prefers the server's monotonic `seq` keep-alive heartbeat as
    its activity key (falling back to the content signature on older runtimes), so
    a long quiet seed-generation window reads as honestly _receiving_ rather than
    flipping to amber.

### Patch Changes

- 40c79df: Improve the floating chatbot flow with responsive panel bounds, safer FAB placement, inline responding and stop states, and clearer retryable error feedback.
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
- Updated dependencies [3870c20]
- Updated dependencies [2eb3096]
- Updated dependencies [b88c560]
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
- Updated dependencies [8d1195d]
  - @object-ui/core@7.0.0
  - @object-ui/components@7.0.0
  - @object-ui/react@7.0.0
  - @object-ui/types@7.0.0

## 6.2.3

### Patch Changes

- @object-ui/types@6.2.3
- @object-ui/core@6.2.3
- @object-ui/react@6.2.3
- @object-ui/components@6.2.3

## 6.2.2

### Patch Changes

- Updated dependencies [a66f788]
  - @object-ui/react@6.2.2
  - @object-ui/components@6.2.2
  - @object-ui/types@6.2.2
  - @object-ui/core@6.2.2

## 6.2.1

### Patch Changes

- @object-ui/types@6.2.1
- @object-ui/core@6.2.1
- @object-ui/react@6.2.1
- @object-ui/components@6.2.1

## 6.2.0

### Minor Changes

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

- @object-ui/react@6.2.0
- @object-ui/components@6.2.0
- @object-ui/types@6.2.0
- @object-ui/core@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [991b62d]
  - @object-ui/core@6.1.0
  - @object-ui/types@6.1.0
  - @object-ui/components@6.1.0
  - @object-ui/react@6.1.0

## 6.0.4

### Patch Changes

- @object-ui/types@6.0.4
- @object-ui/core@6.0.4
- @object-ui/react@6.0.4
- @object-ui/components@6.0.4

## 6.0.3

### Patch Changes

- @object-ui/types@6.0.3
- @object-ui/core@6.0.3
- @object-ui/react@6.0.3
- @object-ui/components@6.0.3

## 6.0.2

### Patch Changes

- @object-ui/types@6.0.2
- @object-ui/core@6.0.2
- @object-ui/react@6.0.2
- @object-ui/components@6.0.2

## 6.0.1

### Patch Changes

- @object-ui/types@6.0.1
- @object-ui/core@6.0.1
- @object-ui/react@6.0.1
- @object-ui/components@6.0.1

## 6.0.0

### Minor Changes

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

### Patch Changes

- @object-ui/types@6.0.0
- @object-ui/core@6.0.0
- @object-ui/react@6.0.0
- @object-ui/components@6.0.0

## 5.4.2

### Patch Changes

- @object-ui/types@5.4.2
- @object-ui/core@5.4.2
- @object-ui/react@5.4.2
- @object-ui/components@5.4.2

## 5.4.1

### Patch Changes

- @object-ui/types@5.4.1
- @object-ui/core@5.4.1
- @object-ui/react@5.4.1
- @object-ui/components@5.4.1

## 5.4.0

### Minor Changes

- 3a8c754: Rebuilt the chatbot UI on top of **Vercel AI Elements** (MIT) and wired in
  the v1 capabilities exposed by `@objectstack/service-ai` (tracing,
  `generateObject`, `query_data` tool, `ModelRegistry`).
  - **What's new**
    - `ChatbotEnhanced` is now composed from `Conversation`, `Message`,
      `PromptInput`, `Suggestion`, `Tool`, `Reasoning`, `Sources`, and friends.
      Sticky-to-bottom scrolling, keyboard-aware textarea, file pill chips,
      copy/retry actions, and the streaming/error banners now match the
      shadcn-style AI surface used across the ecosystem.
    - **Tool / reasoning / sources rendering**: assistant messages with
      `toolInvocations`, `reasoning`, or `sources` automatically render the
      collapsible tool panels, the chain-of-thought block, and the citation
      pill. `useObjectChat` parses these directly from `vercel/ai`'s
      `UIMessage.parts` stream — no extra wiring needed at the call site.
    - **Model picker**: optional `models` + `selectedModelId` + `onModelChange`
      props render an inline `<select>` in the prompt-input toolbar. Designed
      to be fed straight from `GET /api/v1/ai/models` (new in service-ai
      v1).
    - **Trace links**: new optional `traceId` on `ChatMessage` surfaces a
      small "trace" link on assistant messages — pair with the `ai_traces`
      object exposed by service-ai's auto-tracing.
    - New optional `suggestions?: string[]` prop renders a chip row in the
      empty state and forwards the picked suggestion to `onSendMessage`.
    - All vendored AI Elements (10 components) plus two missing shadcn
      primitives (`button-group`, `input-group`) are exported as a namespace —
      `import { AIElements } from '@object-ui/plugin-chatbot'` — so apps can
      compose bespoke chat surfaces without dropping back to the legacy
      primitives.
  - **Type-level changes**
    - `@object-ui/types` `ChatMessage` gains optional `reasoning`, `sources`,
      `traceId` fields, and a new `ChatMessageSource` interface.
    - `ChatToolInvocation` accepts the AI SDK v6 lifecycle states
      (`input-streaming`/`input-available`/`output-available`/`output-error`/
      …) in addition to the legacy `partial-call`/`call`/`result`. `args`
      is now optional and accepts arbitrary shapes; new optional `errorText`
      field.
  - **What hasn't changed**
    - Public prop signature on `FloatingChatbot`, `FloatingChatbotPanel`, and
      the SDUI `"chatbot"` renderer.
    - Hook contracts: `useObjectChat`, `useAgents`,
      `useFloatingChatbot`.
    - SSR / Tailwind 4 / React 18+19 support.
  - **Under the hood**
    - New deps: `streamdown`, `use-stick-to-bottom`, `shiki`, `motion`,
      `nanoid`, `@radix-ui/react-use-controllable-state`,
      `@radix-ui/react-slot`, `class-variance-authority`.
    - Vendored sources live under `src/elements/` with header comments pointing
      back to `registry.ai-sdk.dev`. Rule #7 No-Touch Zones are respected —
      `packages/components/src/ui/**` was not modified.

### Patch Changes

- Updated dependencies [3a8c754]
  - @object-ui/types@5.4.0
  - @object-ui/components@5.4.0
  - @object-ui/core@5.4.0
  - @object-ui/react@5.4.0

## 5.3.2

### Patch Changes

- @object-ui/types@5.3.2
- @object-ui/core@5.3.2
- @object-ui/react@5.3.2
- @object-ui/components@5.3.2

## 5.3.1

### Patch Changes

- @object-ui/types@5.3.1
- @object-ui/core@5.3.1
- @object-ui/react@5.3.1
- @object-ui/components@5.3.1

## 5.3.0

### Patch Changes

- @object-ui/types@5.3.0
- @object-ui/core@5.3.0
- @object-ui/react@5.3.0
- @object-ui/components@5.3.0

## 5.2.1

### Patch Changes

- @object-ui/types@5.2.1
- @object-ui/core@5.2.1
- @object-ui/react@5.2.1
- @object-ui/components@5.2.1

## 5.2.0

### Patch Changes

- Updated dependencies [de0c5e6]
- Updated dependencies [9997cae]
- Updated dependencies [b2d1704]
- Updated dependencies [87bc8ff]
- Updated dependencies [3ebba63]
- Updated dependencies [a8d12ec]
- Updated dependencies [70b5570]
- Updated dependencies [aa063db]
- Updated dependencies [d1442e3]
- Updated dependencies [7c7400a]
  - @object-ui/types@5.2.0
  - @object-ui/core@5.2.0
  - @object-ui/react@5.2.0
  - @object-ui/components@5.2.0

## 5.1.1

### Patch Changes

- Updated dependencies [8955b9c]
  - @object-ui/components@5.1.1
  - @object-ui/types@5.1.1
  - @object-ui/core@5.1.1
  - @object-ui/react@5.1.1

## 5.1.0

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

## 5.0.2

### Patch Changes

- @object-ui/components@5.0.2
- @object-ui/react@5.0.2
- @object-ui/types@5.0.2
- @object-ui/core@5.0.2

## 5.0.1

### Patch Changes

- @object-ui/types@5.0.1
- @object-ui/core@5.0.1
- @object-ui/react@5.0.1
- @object-ui/components@5.0.1

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
  - @object-ui/core@5.0.0

## 4.8.0

### Patch Changes

- @object-ui/types@4.8.0
- @object-ui/core@4.8.0
- @object-ui/react@4.8.0
- @object-ui/components@4.8.0

## 4.7.0

### Patch Changes

- @object-ui/types@4.7.0
- @object-ui/core@4.7.0
- @object-ui/react@4.7.0
- @object-ui/components@4.7.0

## 4.6.0

### Patch Changes

- Updated dependencies [3ee436d]
  - @object-ui/components@4.6.0
  - @object-ui/types@4.6.0
  - @object-ui/core@4.6.0
  - @object-ui/react@4.6.0

## 4.5.0

### Patch Changes

- Updated dependencies [ab5e281]
- Updated dependencies [6b6afd1]
- Updated dependencies [aa7855f]
- Updated dependencies [170d89f]
  - @object-ui/types@4.5.0
  - @object-ui/components@4.5.0
  - @object-ui/core@4.5.0
  - @object-ui/react@4.5.0

## 4.4.0

### Patch Changes

- Updated dependencies [2bd45af]
  - @object-ui/components@4.4.0
  - @object-ui/types@4.4.0
  - @object-ui/core@4.4.0
  - @object-ui/react@4.4.0

## 4.3.1

### Patch Changes

- Updated dependencies [6b683c8]
  - @object-ui/components@4.3.1
  - @object-ui/react@4.3.1
  - @object-ui/types@4.3.1
  - @object-ui/core@4.3.1

## 4.3.0

### Patch Changes

- Updated dependencies [4e7bc1b]
- Updated dependencies [8442c05]
  - @object-ui/components@4.3.0
  - @object-ui/react@4.3.0
  - @object-ui/types@4.3.0
  - @object-ui/core@4.3.0

## 4.2.1

### Patch Changes

- @object-ui/types@4.2.1
- @object-ui/core@4.2.1
- @object-ui/react@4.2.1
- @object-ui/components@4.2.1

## 4.2.0

### Patch Changes

- @object-ui/components@4.2.0
- @object-ui/react@4.2.0
- @object-ui/types@4.2.0
- @object-ui/core@4.2.0

## 4.1.0

### Patch Changes

- @object-ui/types@4.1.0
- @object-ui/core@4.1.0
- @object-ui/react@4.1.0
- @object-ui/components@4.1.0

## 4.0.12

### Patch Changes

- @object-ui/types@4.0.12
- @object-ui/core@4.0.12
- @object-ui/react@4.0.12
- @object-ui/components@4.0.12

## 4.0.11

### Patch Changes

- @object-ui/components@4.0.11
- @object-ui/react@4.0.11
- @object-ui/types@4.0.11
- @object-ui/core@4.0.11

## 4.0.10

### Patch Changes

- @object-ui/types@4.0.10
- @object-ui/core@4.0.10
- @object-ui/react@4.0.10
- @object-ui/components@4.0.10

## 4.0.9

### Patch Changes

- @object-ui/types@4.0.9
- @object-ui/core@4.0.9
- @object-ui/react@4.0.9
- @object-ui/components@4.0.9

## 4.0.8

### Patch Changes

- @object-ui/components@4.0.8
- @object-ui/react@4.0.8
- @object-ui/types@4.0.8
- @object-ui/core@4.0.8

## 4.0.7

### Patch Changes

- Updated dependencies [7c9b85c]
  - @object-ui/core@4.0.7
  - @object-ui/react@4.0.7
  - @object-ui/components@4.0.7
  - @object-ui/types@4.0.7

## 4.0.6

### Patch Changes

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

## 4.0.1

### Patch Changes

- @object-ui/types@4.0.1
- @object-ui/core@4.0.1
- @object-ui/react@4.0.1
- @object-ui/components@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies
  - @object-ui/types@4.0.0
  - @object-ui/components@4.0.0
  - @object-ui/core@4.0.0
  - @object-ui/react@4.0.0

## 3.4.0

### Patch Changes

- Updated dependencies [a2d7023]
- Updated dependencies [f1ca238]
- Updated dependencies [de881ef]
  - @object-ui/components@3.4.0
  - @object-ui/types@3.4.0
  - @object-ui/core@3.4.0
  - @object-ui/react@3.4.0

## 3.3.2

### Patch Changes

- @object-ui/types@3.3.2
- @object-ui/core@3.3.2
- @object-ui/react@3.3.2
- @object-ui/components@3.3.2

## 3.3.1

### Patch Changes

- Updated dependencies [b429568]
  - @object-ui/components@3.3.1
  - @object-ui/types@3.3.1
  - @object-ui/core@3.3.1
  - @object-ui/react@3.3.1

## 3.3.0

### Patch Changes

- @object-ui/types@3.3.0
- @object-ui/core@3.3.0
- @object-ui/react@3.3.0
- @object-ui/components@3.3.0

## 3.2.0

### Patch Changes

- @object-ui/types@3.2.0
- @object-ui/core@3.2.0
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
- @object-ui/react@3.1.3
- @object-ui/components@3.1.3

## 3.1.2

### Patch Changes

- @object-ui/types@3.1.2
- @object-ui/core@3.1.2
- @object-ui/react@3.1.2
- @object-ui/components@3.1.2

## 3.1.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@3.1.1
  - @object-ui/components@3.1.1
  - @object-ui/core@3.1.1
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

## 0.3.1

### Patch Changes

- Maintenance release - Documentation and build improvements
- Updated dependencies
  - @object-ui/types@0.3.1
  - @object-ui/core@0.3.1
  - @object-ui/react@0.3.1
  - @object-ui/components@0.3.1
