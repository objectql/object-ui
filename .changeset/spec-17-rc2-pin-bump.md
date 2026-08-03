---
"@object-ui/types": minor
"@object-ui/core": minor
"@object-ui/layout": minor
"@object-ui/app-shell": minor
"@object-ui/data-objectstack": minor
"@object-ui/console": minor
---

Track `@objectstack/spec` 17.0.0-rc.2 (objectui#3235, #3208, #3287, #3264).

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
  what every notification surface already read. Note that the spec's *other*
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
