# @object-ui/auth

## 17.7.0

### Minor Changes

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
- 686d5d9: `AuthGuard`'s `requiredRoles` now matches against `user.positions` — the one published spelling (framework ADR-0090 D3) — keeping the `user.role` scalar fallback only for sessions that carry no `positions` key at all (guest / legacy identities). This restores position-holder admission on protocol-17 deployments (where the retired `roles` key is never emitted) and closes the matching over-admission: a coarse scalar `role` no longer passes a gate whose position the server says the user lacks. Preview mode now emits `positions: [role]` instead of the retired `roles` key — it was the last producer — so preview identities are shaped like protocol-17 sessions for every `positions` consumer. The hand-copied `roles?: string[]` mirror key is removed from the client `AuthUser` type; breaking only for TypeScript consumers that compiled against `AuthUser['roles']` (read `positions` instead — no runtime payload ever carried `roles` at protocol 17). Maintainer ruling 2026-08-22 on objectui#5424.
- c8da8b3: Stop showing an access-denied screen to a real administrator while their
  adminship is still resolving.
  
  `useIsWorkspaceAdmin()` returned a bare `boolean`, so "the inputs have not
  arrived yet" and "resolved: not an admin" were the same answer. One of its three
  sources — the active organization member row — is fetched some round trips after
  the session (`listOrganizations` → `getActiveOrganization` → `getActiveMember`),
  so an administrator whose adminship lives only in that row rendered at least
  once as a non-admin, and every gate downstream acted on it: the two marketplace
  surfaces painted `MarketplaceAccessDenied`, the console chrome dropped and
  re-added its admin nav entry, and `AppContent` fired a `<Navigate to="/home"
  replace>` that the later flip could not undo.
  
  **Breaking (published API, hence `minor` per this repo's version policy):**
  `useIsWorkspaceAdmin(): boolean` is replaced by
  `useWorkspaceAdminStatus(): { isAdmin: boolean; isResolved: boolean }`. The old
  name is removed rather than kept alongside, so a call site that ignores the
  third state fails to compile instead of silently refusing an administrator.
  
      -const isAdmin = useIsWorkspaceAdmin();
      +const { isAdmin, isResolved } = useWorkspaceAdminStatus();
  
  `AuthProvider` gains `isMembershipResolved` on its context — the organization /
  member pipeline has reached a terminal state — because `organizations`,
  `activeOrganization` and `activeMember` read `[]` / `null` / `null` both before
  the pipeline starts and after it finds nothing.
  
  No extra wait for administrators: `isResolved` is true the instant `isAdmin` is,
  so an admin the session already identifies through `positions[]` never waits on
  the member row.

### Patch Changes

- 639114c: Reconcile `@object-ui/app-shell` with `@objectstack/spec` 17.3.0 (objectui#7122).
  
  `SchemaDiffEntryKind` gained an `unreachable` member in 17.3.0, and the external
  datasource validation panel labels those kinds through a map that is TOTAL over
  the union on purpose — so an upstream addition fails the build rather than
  rendering a blank cell. That mechanism fired: the package did not compile against
  17.3.0 until the kind was labelled. It now reads "Not checked — remote
  unreachable", following the spec's own ruling that this kind asserts nothing
  about the remote schema and must never be surfaced as "schema changed": it means
  introspection could not complete, which is often transient, and labelling it like
  a mismatch would tell an operator to repair a schema nobody has read.
  
  Two internal flow-inspector types were renamed (`FlowNodeLike` →
  `InspectorFlowNode` / `ScopeFlowNode`) because 17.3.0 began exporting its own
  `FlowNodeLike`; neither name is in this package's published entry, so no consumer
  import changes.
  
  `@object-ui/auth`: a README sentence claiming the preview-mode prop aligns with
  the spec's `PreviewModeConfig` is corrected — 17.3.0 removed that symbol. The
  `previewMode` prop itself is host-supplied, unchanged, and unaffected.
- ebfc3c2: `ActiveOrganizationStorage.clear()` now verifies that the persisted key is actually
  gone and, when it is not, both reports the failure and stops `get()` answering from
  the surviving value — instead of swallowing the failed removal (objectui#5731).
  
  `clear()` nulled `_memoryValue` and then removed the persisted key inside a
  `try`/`catch` that discarded any failure. Since objectui#5703 `get()` prefers a
  NON-NULL `localStorage` read and only falls through to `_memoryValue`, so the two
  halves of `clear()` were not equally strong: nulling memory always sticks, while a
  removal that did not stick left the key readable and the read order preferred it.
  Sign-out is one of `clear()`'s five callers, so the failure mode was "sign-out does
  not stick", and it was silent — the cleared organization went back on the wire as
  `X-Tenant-ID` on every subsequent request.
  
  The removal is now judged by a READ-BACK rather than by catching the throw, which is
  both narrower and wider in the right directions. Wider: a wrapped or proxied
  `localStorage` whose `removeItem` is a silent no-op never throws and leaves identical
  residue, and is now covered. Narrower: SSR and the partitioned-iframe browser where
  every operation throws have nothing readable to resurrect, were already safe, and are
  not reported as failures.
  
  A key whose removal could not be verified is quarantined in memory for the rest of the
  page-load: `get()` skips the persisted branch for it and answers from `_memoryValue`,
  which `clear()` has just nulled and which a later `set()` refills with the value that
  write was meant to persist. The quarantine is released as soon as a removal on that key
  sticks. An unstamped `X-Tenant-ID` is a documented state of the edge contract
  (objectui#5279); a re-stamped signed-out organization is not.
  
  The failure is not thrown and not returned. All five call sites — sign-out's
  `purgeSignedOutClientCaches`, `switchOrganization`, `deleteOrganization`,
  `leaveOrganization`, and the session-user purge that runs on the SIGN-IN path — arrive
  after the transition they follow up on has already happened, and none can act on a
  storage failure; a `boolean` every caller ignores would read as handled when it is not.
  So the invariant is restored inside `clear()` and the failure is reported to the
  console.
  
  A working `localStorage` behaves exactly as before: the removal sticks, nothing is
  quarantined, nothing is reported, and a non-null persisted read is still authoritative.
  `set()`'s swallowed write failure is deliberately untouched — that swallow is
  objectui#5703's memory fallback, and it is the correct kind, because the memory copy
  upholds `set()`'s postcondition where nulling memory could not uphold `clear()`'s.
- 9a5d669: `ActiveOrganizationStorage.get()` now prefers a non-null `localStorage` read and falls
  back to the in-memory value otherwise, instead of returning the `localStorage` read
  unconditionally — so the fallback is reachable in the browser state it was written for
  (objectui#5703).
  
  `set()` already swallowed a failed `localStorage.setItem` into `_memoryValue`, but
  `get()` only consulted `_memoryValue` when the READ itself threw. There is a real
  browser state where the read does not throw and the fallback is nonetheless the only
  copy: `localStorage` present and readable but rejecting writes — Safari private
  browsing, and any quota-exhausted origin, where `setItem` throws `QuotaExceededError`.
  In that state the active org was stored and could not be read back, measured as
  `_memoryValue = org-42` alongside `get() = null`.
  
  The cost was silent and lasted the whole session rather than the documented first-boot
  window: `createAuthenticatedFetch` reads `get()`, so `X-Tenant-ID` was never stamped on
  any request. Per the edge contract documented on objectui#5279 that header is a routing
  hint a reader falls through on — the framework scopes from the session — so no row
  visibility rode on this; what was missing is the tenant-routing input, on every request.
  `switchOrganization` also appeared to succeed while the client-side stamp never
  followed.
  
  Sign-out is unaffected, and that is the half worth stating: the new fallback fires
  exactly when the `localStorage` read is null, which is the state `clear()` leaves
  behind. It answers `null` there because `clear()` nulls `_memoryValue` too. That
  property is now pinned by test rather than relied upon, so a future `clear()` that only
  removed the persisted key fails a test instead of quietly re-stamping a cleared org.
  
  A non-null persisted read still wins over the memory value, so a working `localStorage`
  behaves exactly as before.
- 32ef595: Restore platform-admin detection for permission-set-derived administrators.
  
  `useIsWorkspaceAdmin` decides Setup app + Studio visibility, App Marketplace
  gating and the "Build an app" CTAs. Its third source read `user.roles`, a key
  the protocol-17 session face no longer emits (framework ADR-0090 D3 renamed it
  to `positions`). An administrator whose adminship comes from the
  `admin_full_access` permission set — the single-tenant deployment shape, where
  there is no organization member row and the server deliberately no longer
  overwrites `user.role` — matched none of the three sources and read as **not an
  administrator**: Setup and Studio simply disappeared for them.
  
  The hook now reads `user.positions[]`, the one spelling the session publishes.
  Detection is restored for that path and unchanged everywhere else: an active
  member row with an admin role, a stored `user.role` admin scalar, and
  preview/no-auth mode all behave exactly as before, and nobody who was not an
  administrator becomes one — pinned by four negative cases alongside the
  positive one.
  
  Also corrects the now-stale documentation that described the removed spelling:
  the hook's own docblock, the `roles?: string[]` declaration on the client
  `AuthUser` (kept for one remaining compile-time reader; see objectui#5424), and
  two comments in `@object-ui/app-shell`'s Home page. No behaviour change from the
  comment corrections.
- 343c598: The active organization id is now stored per user, and a change of session user drops the
  previous user's client state wholesale (objectui#5664).
  
  `auth-active-organization-id` was a single un-namespaced `localStorage` key while its
  siblings were already user-scoped (`objectui-recent-items:u:`, `objectui-favorites:u:`,
  `flow-palette-recents:u:`). On a browser handed from one account to another — a shared
  machine, a kiosk, a handover, a support session — the arriving user's console read the
  PREVIOUS user's organization id. The header workspace chip rendered the previous user's
  workspace for a user whose `organization/list` was empty, and the consequence past the
  cosmetics is the one worth stating: the polluted org context suppressed
  `RequireOrganization`'s routing into the guided "Create your workspace" first-run flow, so
  a brand-new user on that browser silently never got the new-user flow at all.
  
  Nothing about row visibility rode on this. With the stale id the server answers
  `403 USER_IS_NOT_A_MEMBER` on `get-full-organization` and `set-active`, and lists zero
  environments; the damage was entirely in what the client believed about itself.
  
  Three changes, and the third is the one that closes the class rather than the instance:
  
  - The key is per-user (`auth-active-organization-id:u:$userId`), matching the convention
    its siblings already use.
  - It can no longer be written un-namespaced at all. Where no session user is known yet the
    value lives in memory for that page-load only — a namespacing that kept a bare-key
    fallback would re-open the defect the first time a write happened before the user id
    resolved.
  - **A change of session user drops the previous user's client state wholesale.** This is an
    allowlist sweep of both `localStorage` and `sessionStorage`, not a list of known keys, so
    the NEXT storage key someone adds without a `:u:` scope is covered before it is written.
    Only device-scoped entries survive: the arriving session's own bearer token, the pointer
    recording whose state the browser holds, and the UI theme.
  
  Both properties objectui#5703 established are preserved and still pinned: `get()` prefers a
  non-null `localStorage` read and falls back to the in-memory value, and the memory value is
  nulled BEFORE storage is touched — by `clear()` as before, and now by the user-change purge
  too, so the outgoing user's org id cannot outlive their persisted key on the sign-out-then-
  sign-in path that never reloads the page.
  
  Existing browsers are not migrated. A value sitting under the retired bare key is
  unattributable — nothing recorded whose org id it is — so migrating it is precisely the
  defect it would be migrating away from, and it is deleted instead. A signed-in user loses
  nothing durable: the active organization is a server-owned fact that
  `AuthProvider.refreshOrganizations` re-asks for whenever the list is non-empty and no
  active org is held, including the ADR-0081 single-membership repair. One boot re-supplies
  it; users with no organization land on the guided first-run flow, which is the outcome this
  card is about.
  
  `apps/console`'s pre-render auth preflight purges every spelling of the active-org key —
  the retired bare one and each `:u:` scope — when it finds a dead bearer token, and
  deliberately leaves the session-user pointer in place so the next sign-in can still tell
  that the browser changed hands.
- 2dd9443: `purgeSignedOutClientCaches()` — the sweep that drops the signed-out user's
  `objectui:metadata:*` seed cache on sign-out (objectui#5198) — now costs one key when a
  single `removeItem` throws, instead of aborting the rest of the sweep (objectui#5777).
  
  The `try` wrapped the WHOLE loop, not each removal. A `removeItem` that threw on key `n`
  aborted the walk, so keys `n+1..end` were never swept, and the failure was swallowed —
  `AuthProvider`'s `signOut` believed the purge had completed. The entries this sweeps are
  the previous principal's org-scoped, PERMISSION-FILTERED app list — objectui#5198
  classifies a surviving entry as a cross-principal disclosure on a shared browser, not
  mere staleness — so a partial sweep here is the sharper half of the same defect class
  objectui#5763 fixed on the sign-in path (`sweepStore` in `ActiveOrganizationStorage.ts`).
  
  `Object.keys(sessionStorage)` — the reason a guard exists here at all — stays guarded on
  its own; only the per-key guard is new. Same as `sweepStore`, a failed removal here is
  not verified by read-back and not quarantined the way `ActiveOrganizationStorage.clear()`
  (objectui#5731) quarantines a key: this function does not own reads for the metadata
  seed cache (`MetadataProvider` in `@object-ui/app-shell` does), so there is no `get()` to
  guard and nothing to quarantine — adding read-back verification would be a general
  storage-error-handling refactor of the module, out of this card's scope. What is
  mirrored is the reporting channel: a key whose `removeItem` throws is named in a
  `console.warn`, the same channel `sweepStore` and `clear()` use, so a partial sweep is
  discoverable instead of silent.
  
  Adds a partial-failure test: a `sessionStorage` whose `removeItem` throws on one metadata
  key, asserting every other metadata key on both sides of it is still swept and unrelated
  non-matching keys are untouched, plus a control that the warning fires only on an actual
  failure.
- ff2d547: `sweepStore()` — the walk that drops the previous user's `localStorage`/`sessionStorage`
  state on a change of session user (objectui#5664 part 3) — now costs one key when a
  single `removeItem` throws, instead of aborting the rest of the sweep (objectui#5763).
  
  The `try` wrapped the WHOLE loop, not each removal. A `removeItem` that threw on key
  `n` aborted the walk, so keys `n+1..end` were never swept, and the failure was
  swallowed — `purgePreviousUserClientState()` returned normally and `SessionUserScope.adopt`
  believed the sign-in purge had completed. This is an ALLOWLIST sweep precisely so the
  next un-namespaced key — one nobody has written yet — cannot re-open the cross-user
  pollution class #5664 fixed; a partial sweep is a partial allowlist, and which keys
  survived depended on `Object.keys` iteration order rather than on anything bounded. The
  previous user's org id, recents, favourites, or a `sessionStorage` metadata seed (their
  permission-filtered app list, a cross-principal disclosure per objectui#5198) could all
  land on the wrong side of the abort.
  
  `Object.keys(store)` — the reason a guard exists here at all — stays guarded on its
  own; only the per-key guard is new, so one uncooperative key now costs exactly that key.
  
  Unlike `ActiveOrganizationStorage.clear()` (objectui#5731), a failed removal here is
  NOT verified by read-back and NOT quarantined: `clear()` owns every future read of its
  one key through `ActiveOrganizationStorage.get()`, so a "still readable" verdict and a
  quarantine are what keep a failed `clear()` from handing the value straight back.
  `sweepStore` walks keys it does not own reads for — another package's recents cache, a
  metadata seed — so there is no `get()` here to guard and nothing to quarantine; adding
  read-back verification for keys this function does not otherwise touch would be a
  general storage-error-handling refactor of the module, which this card is scoped away
  from. What IS mirrored is the reporting channel: a key whose `removeItem` throws is
  named in a `console.warn`, the same channel `clear()` uses, so a partial sweep is
  discoverable instead of silent. The caller (`SessionUserScope.adopt`, on the sign-in
  path, inside an `AuthProvider` effect) still cannot act on the failure and must not
  throw either.
  
  A working `localStorage`/`sessionStorage` behaves exactly as before: every
  non-device-scoped key is removed, nothing is reported, and the device-scoped allowlist
  (`auth-session-token`, `auth-session-user-id`, `vite-ui-theme`) is unaffected.
- 36918bf: `switchOrganization` now re-resolves identity for the organization it just switched
  to by its own explicit decision, instead of depending on an accidental
  `TokenStorage` side effect to notice the switch (objectui#5750).
  
  `AuthProvider.switchOrganization` has never called `loadSession()` itself. Identity
  re-resolved across a switch only because `POST /organization/set-active` happens to
  return the SIGNED `token.signature` spelling in `set-auth-token`, which differs from
  the UNSIGNED `session.token` spelling `getSession()` normally stores — so
  `TokenStorage.set` reads the flip as a rotation and the objectui#4467 subscription
  calls `loadSession()` for it (measured and pinned in objectui#5749/#5719). That
  signed spelling is deterministic on the raw session token, not on the organization:
  two switches with no `get-session` landing in between produce the identical signed
  value, so the SECOND `TokenStorage.set` sees no change, never notifies, and identity
  is left answering for whichever organization the FIRST switch targeted even though
  `activeOrganization` already reads as the new one.
  
  Reachable in the console via `OrganizationLayout`'s slug-driven effect (the "Manage"
  link on an org card, plus its own "Back to organizations" button) — ordinary
  client-side navigation with no full-page reload and nothing debouncing repeat
  switches. `WorkspaceSwitcher` and `OrganizationsPage`'s own card click were not
  reachable paths for this: both force `window.location.href` immediately after a
  successful switch, and the resulting fresh `AuthProvider` mount always performs an
  authoritative `loadSession()` regardless of how the race above resolved.
  
  `switchOrganization` now tracks the organization it last resolved to itself and
  re-resolves explicitly whenever a switch's target differs from that, while
  suppressing the (now redundant) rotation notification for its own `set-active`
  call — so the common single-switch path still spends exactly one `get-session`, not
  two. A generation guard discards a still-in-flight, now-superseded switch's answer
  rather than let it clobber a later switch's fresher one.
- 934a532: Document the `X-Tenant-ID` edge contract that `createAuthenticatedFetch` stamps, and the
  unstamped-first-request window in which it is not sent (objectui#5279). Documentation
  only — no behaviour changes.
  
  The header had no written contract anywhere, and the shape of the missing information was
  actively misleading: its only non-CORS consumer lives in the **cloud** repository, so a
  search confined to this repo and the framework (`objectstack`) returns zero readers and
  reads as "nothing consumes this stamp". #5279 was filed on exactly that reading, and was
  held until a cloud-side reading came back non-empty. Without the contract written down,
  the next person to grep reaches the same false conclusion and deletes a live routing
  input.
  
  `packages/auth/README.md` gains "The `X-Tenant-ID` edge contract": what the header means
  (a routing hint carrying the better-auth `activeOrganizationId` — not an identity claim,
  not an authorization input, not what scopes rows), who stamps it and under exactly which
  condition, who reads it, and what a reader may and may not assume. The framework half is
  stated as a negative with its pin — `resolveAuthzContext` takes `tenantId` from the
  API-key principal or `session.activeOrganizationId` and from no header — alongside
  `plugin-sharing`'s record that trusting `x-tenant-id` as identity *was* a vulnerability.
  The configuration half is quoted from the contract this package can actually resolve,
  `TenantRoutingConfigSchema` in `@objectstack/spec/cloud`, where `X-Tenant-ID` is the
  default of a configurable `tenantHeaderName` and `header` ranks second of six
  identification sources behind `subdomain`.
  
  The unstamped-first-request gap gets its own section: `ActiveOrganizationStorage` is
  filled only after `AuthProvider`'s async `getSession` -> `listOrganizations` ->
  `getActiveOrganization` chain resolves, so early-boot requests carry no tenant header at
  all. What a reader observes is documented as **absent, never present-and-empty**, with the
  five situations that open the window and the instruction to fall through to the next
  identification source rather than fail closed. The gap is recorded, deliberately not
  closed: the cloud readers observe today's behaviour, so changing when the header first
  appears is its own decision.
  
  Three cases in `createAuthenticatedFetch.test.tsx` pin the statements the prose makes
  about the wire — no active organization means no header at all, the stamp is not gated on
  `/api/` the way `Authorization` is, and the active organization overwrites a caller-set
  `X-Tenant-ID` — so the documentation cannot drift away from the behaviour unnoticed.

## 17.6.0

### Minor Changes

- 1b21b1a: `AuthInvitation.status` is the closed four-member union it always documented, enforced at the auth client's wire boundary.
  
  The field was declared `status: string` while its own doc comment enumerated
  `'pending' | 'accepted' | 'rejected' | 'canceled'`, and `createAuthClient` cast
  better-auth's `any` responses straight to `AuthInvitation[]` with no check. The
  enumeration was therefore advisory: any value a backend stored reached the
  console untouched, where the invitations screen coloured it through a
  `default: 'secondary'` badge arm and printed it with
  `defaultValue: inv.status` — the raw wire string rendered as interface copy, in
  all ten packs (objectui#3879). Nobody could trigger it today, because the four
  are what better-auth writes; it was the contract that was loose, and a loose
  consumer is where an unexpected value would have hidden.
  
  `AuthInvitationStatus` now carries the union and **binds better-auth's own
  `InvitationStatus`** rather than restating it, the way `org-roles.ts` binds the
  spec's `BUILTIN_MEMBERSHIP_ROLES` — a member-for-member copy is the state one
  upstream release away from drifting silently. The runtime list
  (`AUTH_INVITATION_STATUSES`) is derived from a total map keyed by that union, so
  a fifth status upstream is a build failure here rather than a gap in the guard.
  `isAuthInvitationStatus` is exported alongside, and all four invitation-returning
  client methods (`listInvitations`, `listUserInvitations`, `getInvitation`,
  `inviteMember`) narrow their wire rows through it.
  
  Behaviour change, stated because it is one: an invitation whose `status` is
  outside the set now **fails loudly** — the call rejects with a message naming the
  value it refused and the four it expected — instead of resolving into a badge.
  Both call paths already render a rejection with a retry, so the throw lands on a
  designed surface. Degrading quietly was the alternative and was deliberately not
  taken: a neutral label is how the raw value shipped in the first place, and
  dropping the row would delete an invitation from an administrative ledger without
  saying so. The console's badge switch is exhaustive over the union now and has no
  `default:` arm, so if better-auth ever adds a member the type-check gate stops the
  build at the one place a human has to choose a colour.
  
  Consumers assigning an arbitrary string to `AuthInvitation.status` (a hand-built
  fixture, a mock) will need one of the four members.

### Patch Changes

- 5458414: Publish relative import specifiers with explicit `.js` extensions so these six packages load under plain Node ESM.
  
  Node's ESM resolver does not extension-search relative specifiers and `tsc` never rewrites them, so an extensionless `./Foo` in the source shipped as an extensionless `./Foo` in `dist` and importing the package entry outside a bundler failed with `ERR_MODULE_NOT_FOUND`. Bundled consumers were unaffected. Unbundled consumers — plain Node ESM, an SSR host importing the package directly, anyone running the published tarball without a build step — can now import these entries, and so can the downstream `@object-ui/plugin-*` packages that evaluate through `mobile`, `permissions` and `providers`.
- 61b097c: Sign-out now drops the client-side caches that belonged to the session it ends,
  and the metadata seed cache is keyed by session identity.
  
  `sessionStorage` is per-tab, not per-session, and no sign-out call site reloads
  the page — so the `objectui:metadata:*` entries (the app list the server
  permission-filters per session) and the active-organization id survived into
  whatever happened next in that tab. A second person signing in on a shared,
  kiosk or handover browser was seeded with the previous user's filtered app list.
  Organization scoping did not close this: two users in the same organization
  computed the same cache key.
  
  `AuthProvider.signOut()` now purges the `objectui:metadata:` entries and clears
  `ActiveOrganizationStorage` (and the in-memory organization block) on both the
  success and failure paths, and `MetadataProvider` keys each entry by a
  fingerprint of the session token, so an entry that escapes the purge is
  unreadable by the next principal rather than merely undeleted. Entries left by
  another principal are deleted the first time a console mounts.
- a9e17b4: `auth.forgotPassword.successDescription`'s address hole is now spelled with
  single braces (`{email}`) instead of i18next's double braces (`{{email}}`),
  in all ten locale packs.
  
  This is a spelling-only change — rendered output is byte-identical in every
  language, because the hole was never filled by i18next in the first place:
  `ForgotPasswordForm` substitutes the address itself once the user submits
  the form (the label renders before the address exists, so `t()` cannot do
  it). `{{email}}` and a genuinely unfilled i18next hole were indistinguishable
  at the call site, and passing `email` as an interpolation argument — the
  natural "fix" for what looks like a missing argument — would let i18next
  consume the hole and cause the address to be appended a second time
  (objectui#4135).
  
  Converging on `{x}` for every hole a component fills downstream of `t()`
  (the convention `resendOtpCountdownText`'s `{seconds}` already used) puts
  this hole outside i18next's `{{…}}` syntax entirely, so the ambiguity is
  gone by construction rather than fenced by an exemption. Accordingly,
  `scripts/check-i18n-call-site-keys.mjs`'s `EXTERNALLY_INTERPOLATED_HOLES`
  registry entry for this key is retired — the gate needs no exemption for a
  hole i18next was never going to touch.
  
  `ForgotPasswordForm.tsx`'s replacement marker and its own built-in default
  label move to the same spelling in the same change, as does the inline
  `defaultValue` at `apps/console/src/pages/auth/ForgotPasswordPage.tsx`'s
  call site.
- Updated dependencies [88085e3]
- Updated dependencies [279fb13]
- Updated dependencies [1184192]
- Updated dependencies [a2a9747]
- Updated dependencies [af5e292]
- Updated dependencies [7f96b10]
- Updated dependencies [f1d4748]
- Updated dependencies [578e025]
- Updated dependencies [598c89a]
- Updated dependencies [b8b9af4]
- Updated dependencies [97abb24]
- Updated dependencies [deb157a]
- Updated dependencies [d2ce342]
- Updated dependencies [9695da7]
- Updated dependencies [58b8346]
- Updated dependencies [3cf4de0]
- Updated dependencies [c9dc811]
- Updated dependencies [a0b9e91]
- Updated dependencies [99bd015]
  - @object-ui/types@17.6.0

## 17.5.0

### Minor Changes

- 5cc847c: The data lane now honors `set-auth-token`, so impersonation takes effect at all (#4467).

  The console injects the same localStorage bearer from two lanes: the AUTH lane
  (`createBearerFetch` inside `createAuthClient`) and the DATA lane
  (`createAuthenticatedFetch` — the adapter, `provider: 'api'` data sources, and every
  metadata `type: 'api'` action). better-auth's server-side bearer plugin hands a ROTATED
  session token back in the `set-auth-token` response header on whichever lane the call
  arrived over, and only the auth lane read it. A rotation issued to a data-lane call was
  discarded and the browser kept sending the old token.

  `POST /auth/admin/impersonate-user` is exactly such a call — an ordinary metadata action.
  The impersonated session token was dropped on the floor while the server's bearer plugin
  kept overwriting the impersonation cookie with the admin bearer the console kept sending,
  so impersonation was a complete no-op in the console rather than merely an invisible one.
  Support staff believed they were seeing a user's view while acting entirely as themselves.

  Published behaviour that moves: a data-lane response carrying `set-auth-token` now
  replaces the stored session token, on any API call this lane authenticated (untrusted
  targets remain the `sameOriginOnly` option's job — it short-circuits before any header
  work). The accepted cost, recorded on the card: while impersonating, the administrator's
  own token is replaced in localStorage for the duration, and a client that misses the stop
  rotation is stranded until re-login.

  Also in this release, all additive:

  - `AuthContextValue.refreshSession()` re-resolves `user`/`session` from the server in
    place, without raising `isLoading` — the transitions that change WHO the session is
    without going through `signIn`/`signOut`.
  - `TokenStorage.subscribeRotation()` notifies when a token already in hand is replaced by
    a different one. First store, `clear()`, and re-storing the same value stay silent:
    those transitions have an owner that updates identity itself.
  - `AuthClientSession.impersonatedBy?: string` — optional, set by better-auth's admin
    plugin for the life of an impersonated session.

### Patch Changes

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

- 564252c: `features.passkeys` and `features.magicLink` are documented as reserved, so enabling them no longer implies a login-page entry point that does not exist

  `GET /api/v1/auth/config` advertises eight login-surface capability flags. Six of them gate something real — `sso` gates the "Sign in with SSO" button, `phoneNumberOtp` the verification-code mode, `deviceAuthorization` the device-approval page — and each carries a doc comment saying what it gates. Two did not gate anything: `passkeys` and `magicLink` existed only as two undocumented lines in `AuthPublicConfig.features`, consumed by no component, no route and no metadata. A deployer who turned one on got a flag that changed nothing, with nothing anywhere to say so. That is the mirror of the defect the audit was looking for (framework#2874 P2②): not UI advertising a capability the backend lacks, but a backend advertising a capability the UI lacks.

  Both flags are now marked reserved at the two places a deployer meets them. The declarations in `packages/auth/src/types.ts` carry doc comments — which ship in the published `.d.ts`, so the warning appears on hover — stating that enabling the flag adds no entry point and naming the follow-up card. `packages/auth/README.md` gains a "Server Feature Flags" section documenting what the `features` map is for and a "Reserved flags" table saying the same thing in prose. Per the maintainer's ruling on objectui#2514, the UI is deliberately not built here; it is filed as objectui#4179 and left unscheduled.

  No runtime behaviour changes: nothing read these flags before and nothing reads them now. What changes is that the published types and docs stop being silent about it.

  The three artifacts are pinned together by `packages/auth/src/__tests__/reserved-auth-features.test.ts`, which asserts the declarations still exist, that each carries a reserved marking naming the card, that the README section says the same, and — the inverse direction — that no source file under `packages/*/src`, `apps/*/src` or `examples/*/src` references either identifier. The sweep covers `.json` as well as `.ts`/`.tsx` because `AppContent` hands the whole `features` object to `ExpressionProvider`, so authored metadata can reach these flags without any source file naming them. Two calibration cases keep the pin from rotting into a vacuous pass: one asserts the sweep reads a non-trivial number of files, the other that it can still find a flag that _is_ consumed. When the UI is eventually built, the pin fails and its docblock spells out the retirement checklist — the doc comments, the README section and the pin itself come out in the same PR.

  `features.twoFactor` is untouched and explicitly excluded: two-factor is implemented in this package (`enableTwoFactor` / `verifyTwoFactor`) and its challenge is driven by server-side remediation rather than by the flag, so `LoginForm` not reading it is the design rather than a gap. The README says so, and the pin asserts `twoFactor` never appears in the reserved table.

- Updated dependencies [f650253]
- Updated dependencies [3d9769a]
- Updated dependencies [92876f0]
- Updated dependencies [d9d3463]
- Updated dependencies [2a40f69]
- Updated dependencies [bec3e14]
- Updated dependencies [1f9b905]
- Updated dependencies [abb0f81]
- Updated dependencies [38ab505]
- Updated dependencies [7e4f0e5]
- Updated dependencies [c1d939f]
- Updated dependencies [bb68488]
- Updated dependencies [ab04728]
  - @object-ui/types@17.5.0

## 17.4.0

### Patch Changes

- Updated dependencies [d229dfa]
- Updated dependencies [c2fd122]
- Updated dependencies [48132f7]
- Updated dependencies [7e5bb5d]
- Updated dependencies [e6fdbdc]
- Updated dependencies [7e2b7e9]
- Updated dependencies [c1e1e6b]
  - @object-ui/types@17.4.0

## 17.3.0

### Patch Changes

- Updated dependencies [d915c47]
- Updated dependencies [9e9e9a9]
- Updated dependencies [23018cc]
- Updated dependencies [f44d872]
- Updated dependencies [f833d3a]
- Updated dependencies [d22ae31]
  - @object-ui/types@17.3.0

## 17.2.0

### Minor Changes

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

- fc60ad3: refactor(auth): derive the org-role vocabulary from `@objectstack/spec` instead of mirroring it

  `org-roles.ts` restated the four membership-role names that `@objectstack/spec`
  owns as `BUILTIN_MEMBERSHIP_ROLES`. That was a mirror for packaging reasons
  only: this package took no dependency on the spec, and no published spec
  carried the constants. Both blockers are gone — `@objectstack/spec@17.0.0-rc.0`
  ships ADR-0108's closed vocabulary and the workspace already pins
  `^17.0.0-rc.0` — so the four `ORG_ROLE_*` constants are now re-exports,
  `OrgRole` is `BuiltinMembershipRole`, and `ORG_ROLES` is
  `[...BUILTIN_MEMBERSHIP_ROLES]`. The list cannot drift from what the server's
  enforced `select` accepts, by construction.

  Deliberately still local: `ORG_ROLE_LABELS` and the grade ladder
  (`orgRoleGrade` / `invitableOrgRoles` / `assignableOrgRoles`). They are console
  concerns — i18n keys and screen-narrowing rules — and folding them into the
  name list would be the modeling error ADR-0108 D4 warns about: _what names
  exist_ is a list; _which names mean authority_ and _how a name projects_ are
  rules that belong next to what they govern.

  The #2907 drift guard (`is EXACTLY the framework four`) is dropped — a derived
  list cannot drift, and asserting a re-export against a literal is noise. No
  behaviour changes: the four names, their display order, and their labels are
  exactly what they already were.

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

### Patch Changes

- 503d3f6: docs(auth): the org-role vocabulary is closed — correct the mirror's standing instruction (framework ADR-0108)

  `org-roles.ts` carried a standing instruction that is now wrong: _"a role added
  server-side must be added HERE too."_ There are no server-side additions left
  to chase.

  The framework used to register every declared `position` / `permission` name as
  an organization role, so the console's list could always fall behind the
  server's. That channel was retired (framework ADR-0108, objectstack#3723):
  every value stored in `sys_member.role` is projected into
  `current_user.positions`, so a business role handed out that way was capability
  with none of the position system's controls — no `granted_by`, no validity
  window, no scope check. `sys_member.role` is now a closed, framework-owned list
  of `owner` / `admin` / `delegated_admin` / `member`, and an app's own business
  roles are positions, granted through `sys_user_position` or an invitation's
  placement (framework ADR-0105 D8).

  So this mirror is now complete **by construction** rather than by vigilance.
  Nothing about the console's behaviour changes — the four names and their labels
  are what they already were.

  Still a mirror rather than a derivation, but only for a packaging reason now:
  the names live in `@objectstack/spec` as `BUILTIN_MEMBERSHIP_ROLES` /
  `BUILTIN_MEMBERSHIP_ROLE_OPTIONS`, which `@object-ui/auth` cannot import yet —
  this package takes no dependency on `@objectstack/spec`, and those constants
  ship in the first release carrying ADR-0108 (they are absent from the published
  16.1.0). A new test pins the list to exactly those four in display order until
  then, so drift fails loudly instead of silently offering a value the server's
  enforced `select` would reject.

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

### Patch Changes

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

- 45c6fb4: Login-page auth-config hardening (#2625, #2626):

  - `createAuthClient.getConfig` now single-flights + caches the `/auth/config`
    fetch (the login page's three consumers used to fire three requests) and
    retries failures with backoff (500ms/1.5s/3.5s, 8s per-attempt abort) before
    rejecting. A cold-starting environment kernel no longer strands the page
    without its SSO buttons; a final failure clears the cache so later callers
    retry.
  - `LoginForm` holds a spinner instead of painting the password-form defaults
    while config resolves — an SSO-only deployment must never flash a password
    wall at JIT users who have no password. A failed config still falls back to
    the password form (break-glass beats lock-out).
  - `signInWithProvider` gains a 20s watchdog: a sign-in request that hangs now
    rejects with a clear timeout error so the provider button recovers instead
    of spinning forever.
  - Removed LoginForm's duplicate "or" divider — SocialSignInButtons already
    renders its own, and the stacked pair read as a rendering glitch.

- 077e45b: `signInWithProvider` with `type: 'oidc'` now signs in through better-auth's
  core social route (`POST /sign-in/social`) and only falls back to the legacy
  `POST /sign-in/oauth2` endpoint when the social route rejects the provider.

  better-auth ≥ 1.7 restructured the `genericOAuth` plugin: generic OAuth/OIDC
  providers are injected into the core social sign-in flow and the dedicated
  `/sign-in/oauth2` endpoint no longer exists. The old client therefore 404'd on
  every "Continue with ObjectStack" click (platform SSO broken end-to-end on
  current framework). The fallback keeps the button working against older
  (< 1.7) servers during the coordinated rollout; when both routes fail, the
  social-route error is surfaced since on a ≥ 1.7 server it is the real failure.

- 022735f: RegisterForm: drop the duplicate "or" divider (matching the LoginForm fix in
  #2629). SocialSignInButtons already renders its own "or continue with email"
  divider under the provider buttons; RegisterForm stacked a second "OR" line on
  top, which read as a rendering glitch on the sign-up page.
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

- Updated dependencies [2ded18c]
- Updated dependencies [e628d1f]
- Updated dependencies [887062c]
- Updated dependencies [9e2d58f]
- Updated dependencies [d5b1bc0]
- Updated dependencies [f0f10f5]
  - @object-ui/types@14.1.0

## 14.0.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [86c69c3]
- Updated dependencies [6a74160]
  - @object-ui/types@14.0.0

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

### Minor Changes

- 6fb6738: Auth: remediation overlay for the ADR-0069 session gate (enforced MFA / password expiry)

  The ObjectStack backend now blocks logged-in users from protected resources with `403 { error: { code: 'MFA_REQUIRED' | 'PASSWORD_EXPIRED' } }`. The Console now detects this on every API response and raises a full-screen, guided remediation flow instead of leaving the user on failing requests.

  - `@object-ui/auth`: the authenticated fetch wrapper detects the gate and broadcasts it via a tiny module-level emitter; `AuthProvider` exposes `remediationRequired` + `setRemediationRequired`; the `twoFactorClient` plugin is enabled and `enrollTotp` / `verifyTotp` are added to the auth client (`changePassword` already existed).
  - `@object-ui/app-shell`: a `RemediationOverlay` (mounted in `ConsoleShell`) renders the guided flow — change an expired password, or enrol an authenticator (password confirm → QR + backup codes → verify TOTP) — then reloads so the app re-fetches cleanly. Auth + metadata + `me/*` reads stay reachable (server allow-list), so the overlay renders above a normally-loading shell.

### Patch Changes

- @object-ui/types@11.1.0

## 7.3.0

### Patch Changes

- @object-ui/types@7.3.0

## 7.2.0

### Patch Changes

- cf746c9: fix(auth): only render the "Sign in with SSO" button when the server reports it

  `LoginForm` rendered the SSO button unconditionally, so a deployment without
  enterprise SSO wired (the default for self-hosted / `os dev` local runs) showed
  a button whose `POST /sign-in/sso` route isn't mounted — clicking it surfaced
  the misleading "No SSO provider is configured for this email domain." only at
  click time.

  The button is now gated on `features.sso` from `GET /auth/config`, mirroring how
  `SocialSignInButtons` already gates social providers. It defaults to hidden, so a
  failed config fetch or an older server that doesn't report the flag simply omits
  the button rather than offering a dead end. Requires the matching
  `@objectstack/plugin-auth` change that surfaces `features.sso`.

- Updated dependencies [d23db5c]
  - @object-ui/types@7.2.0

## 7.1.0

### Patch Changes

- Updated dependencies [677f7ed]
- Updated dependencies [a71be60]
- Updated dependencies [cb03bc3]
  - @object-ui/types@7.1.0

## 7.0.0

### Minor Changes

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

- f011479: getSession self-heals a stale localStorage bearer: an invalid `auth-session-token` used to SHADOW a perfectly valid cookie session — SSO landings (e.g. the cloud console's sso-exchange into a tenant environment) only set the cookie and cannot touch the target origin's localStorage, so users with a leftover token bounced back to the login page forever. On a bearer get-session miss the client now retries once cookie-only: a live cookie session wins (its token replaces the stale one); an affirmative double-miss drops the dead token; transport errors keep it. getSession also no longer throws on network errors (better-fetch rethrows them).
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

### Added

- **Preview Mode** (`previewMode` prop on `AuthProvider`): Auto-login with simulated identity for marketplace demos and app showcases. Configurable role, display name, session expiry, read-only mode, and banner message.
- **PreviewBanner** component: Renders a status banner when preview mode is active.
- `isPreviewMode` and `previewMode` fields exposed on `AuthContextValue` / `useAuth()` hook.
- New `PreviewModeOptions` type mirroring spec's `PreviewModeConfig`.

### Changed

- Upgraded `@objectstack/spec` from `^3.0.2` to `^3.0.4`.

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

## 2.0.0

### Major Changes

- b859617: Release v1.0.0 — unify all package versions to 1.0.0

### Patch Changes

- Updated dependencies [b859617]
  - @object-ui/types@2.0.0
