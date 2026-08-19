---
'@object-ui/layout': minor
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

**Breaking (published API):** `NavigationRenderer` no longer accepts `resolveGroupLabel` or `resolveItemLabel`. If your build just broke on one of these props, delete the prop — it never did anything.

Both were id-keyed label resolvers on `NavigationRendererProps` (`@object-ui/layout`), typically wired to `useObjectLabel().navGroupLabel` from `@object-ui/i18n` to translate sidebar group and leaf labels from a client translation pack keyed `{ns}.apps.{appName}.navigation.{nodeId}.label`.

**They could never fire.** The renderer guards convention-based resolution with `isCustomized` — a case-insensitive "the authored label differs from this branch's comparison target" test. On the `object` / `dashboard` branches the target is the object or dashboard name, and the test is meaningful: it protects an author's custom label (`Projects`) from being overwritten by an `objects.project.label` translation. On the two id-keyed branches the target was the nav node's own **`id`** — `grp_workspace`, `group_sales` — while the label was its text — `Workspace`, `Sales`. Those never compare equal, so the guard was true for every real navigation entry and the resolver beneath it was unreachable. The only node that could have reached it is one whose label is literally its own id.

Nothing regresses when they go, because nothing was using them to begin with: **app-navigation localization is owned solely by the server-side `/meta` boundary.** `translateApp` (`@objectstack/spec`, `src/system/i18n-resolver.ts`) rewrites every navigation node's `label` by id, and `@objectstack/rest` applies it before the metadata reaches the client — so nav labels arrive already localized and the client-side path was never the one answering. One owner, not two.

**If you wired these hooks to localize navigation, your labels were never being localized by them.** Move the translation to the server side: add it to the app's i18n bundle that `translateApp` reads, keyed by navigation node id. A client-side pack keyed `apps.*.navigation.*.label` changes nothing in the sidebar.

Also in this change:

- `useObjectLabel().navGroupLabel` (`@object-ui/i18n`) is **kept**, but its docstring no longer promises `"Sales" → "销售"` for sidebar groups — that promise was false, and a live docstring describing an unreachable path is how an agent or a developer ends up wiring a translation pack and receiving silent non-localization. It is now documented for what it is: a plain reader for `{ns}.apps.{appName}.navigation.{groupId}.label` with no first-party caller, pointing at the server boundary for anything nav-related.
- `UnifiedSidebar` (`@object-ui/app-shell`) drops the two prop wirings, including a `studio` carve-out that existed only to stop `resolveItemLabel` from re-translating an already-translated "Package management" label.
- The `object` / `dashboard` / `viewName` branches — `resolveObjectLabel`, `resolveDashboardLabel`, `resolveViewLabel` — are untouched and keep both their resolvers and the `isCustomized` guard.
