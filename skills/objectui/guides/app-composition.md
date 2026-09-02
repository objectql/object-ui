# App Composition: nav types and the URLs they resolve to

**Which construct to reach for -- object nav, a named view, a `filters` slice, a
dashboard or a page -- is decided in the `objectstack-ui` skill**, under
"App Navigation" / "Navigation Item Types" and "Three Run Modes: Object Nav vs
Filters Slice vs Interface Pages", which is where the `*.app.ts` author sits.
That skill owns the least-power hierarchy, the seven decision rules and the
one-sentence generation rule; this guide does not restate them.

What is renderer-side, and only here: **the URL each nav type resolves to**.
`resolveHref` in `packages/layout/src/NavigationRenderer.tsx` is the single
source of truth for that mapping.

| Nav item | Route | Renderer note |
|---|---|---|
| `{type:'object', objectName}` | `/:objectName` | Full `ObjectView` shell: default view, view switcher, object actions, create button, `record/:id` detail routing, search and recents integration, permission trimming |
| `{type:'object', objectName, viewName}` | `/:objectName/view/:viewId` | Same shell, entry anchored to a named view; the user can still switch |
| `{type:'object', objectName, recordId}` | `/:objectName/record/:id` | Direct record deep-link; supports template vars such as `{current_user_id}` |
| `{type:'object', objectName, filters}` | `/:objectName/data?filter[k]=v` | Bare data surface. No saved-view tab bar; conditions render as removable chips; full filter/sort/group toolbar; "Save as view" is the exit |
| `{type:'dashboard', dashboardName}` | `/dashboard/:name` | Dashboard renderer |
| `{type:'report', reportName}` | `/report/:name` | Report renderer |
| `{type:'page', pageName}` | `/page/:name` | Bare SDUI rendering only -- no object shell, so view switching, actions and record routing are hand-assembled in the page schema |
| `{type:'url', url}` | external | `target` controls the tab |
| `{type:'component', componentRef, params?}` | `/component/:ns/:name?…` | `componentRef` is colon-joined (`metadata:resource`); `params` ride as querystring. `metadata:*` refs are special-cased onto the `/metadata[/:type[/:name]]` routes |
| `{type:'group', children}` | — | Grouping only; no target |
| `{type:'separator'}` | — | Skipped by `resolveHref`, never pinnable |
| `{type:'action'}` | — | Fires a host handler instead of navigating; **dropped entirely** when the host passes no action handler |

## Contract Reminders (spec-strict)

- Nav items are a **discriminated union on `type`**. There is no `path` and no
  `kind` — those keys are ignored by `resolveHref` and rejected/stripped at
  save. Emit the typed target field for the chosen type (`objectName`,
  `pageName`, `dashboardName`, `reportName`, `url`, `componentRef`).
- Object-item target precedence: `recordId` → `filters` → `viewName`
  (`filters` is a `Record<string, string>`; equality semantics, serialized as
  `filter[<field>]=<value>` on the `/data` route).
- Every nav item needs a snake_case `id` and a `label` (both required by
  `NavigationItemSchema`).
- The `navigation` key is the spec'd root for app nav. `menu` is deprecated
  legacy (`MenuItem[]`, auto-migrated at runtime via
  `menuItemToNavigationItem`); never generate it.

## Spellings `resolveHref` rejects

- [ ] Nav items carrying `path` or `kind` keys.
- [ ] Nav written under `nav` / `tabs` / `items` / `menu` instead of
      `navigation`.
- [ ] Nav `id`s that are not snake_case.

## Related

- Navigation item schema: `packages/types/src/zod/app.zod.ts`
  (`NavigationItemSchema`), `packages/types/src/app.ts` (`NavigationItem`)
- Runtime resolution: `packages/layout/src/NavigationRenderer.tsx`
  (`resolveHref`)
- Console routes: `packages/app-shell/src/console/AppContent.tsx`
- Bare data surface decision record: `docs/adr/0055-parameterized-bare-data-surface.md`
  (amends ADR-0053's context table)
- Human-facing version: `content/docs/guide/designing-app-navigation.md`
  (derived from this guide — update both together)
