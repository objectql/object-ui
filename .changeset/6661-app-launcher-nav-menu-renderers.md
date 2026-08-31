---
'@object-ui/app-shell': minor
'@object-ui/layout': minor
---

Renderers for the `app:launcher` and `nav:menu` page blocks (objectui#6661).
Phase 1 of the 2026-08-26 maintainer ruling on objectstack#12183 — the two
`PageComponentType` members that are purely metadata-driven, so nothing had to
ship before their renderers could. Phase 2 (`global:search` /
`global:notifications`) landed in objectui#6757 and set the pattern this
follows.

A page that declared either member drew a dashed box. The two symptoms were not
the same, which is worth recording because it decides what "fixed" looks like
for each:

- `nav:menu` is in `PALETTE_PLACEHOLDER_BLOCKS`, registered eagerly, so it drew
  the literal "Component Placeholder" scaffold in every host.
- `app:launcher` is only in `PROTOCOL_COMPONENTS`, registered when a host opts
  in via `registerPlaceholders()` — which just `apps/console` does. So it drew
  the scaffold in the console and `SchemaRenderer`'s red OBJUI-001 "Unknown
  component type" panel everywhere else.

Neither block adds a data layer — each mounts plumbing that was already live,
and neither issues a request or touches an adapter:

- `app:launcher` reads the metadata app registry (`useMetadata().apps`, which
  `MetadataProvider` fetches eagerly) through the shared `filterActiveApps`
  predicate, and draws it with `HomeAppsStrip` — the console's own launcher
  grid — so an authored launcher and the Home launcher cannot drift into two
  looks for one thing.
- `nav:menu` reads the active app's navigation tree from that same registry and
  renders it as page content, taking every derived fact from `@object-ui/layout`:
  hrefs from `resolveHref`, labels from `resolveNavItemLabel`, the active row
  from `resolveActiveNavItem`, and the item-level guards (`visible`,
  `requiredPermissions`, `requiresObject` / `requiresService`) in the order
  `NavigationItemRenderer` applies them, wired to the same console providers
  `AppSidebar` wires them to. `action` items dispatch through
  `useNavActionDispatch`, so framework#4509's "renders but dead-clicks" shape is
  not reintroduced.

`nav:menu` does not mount `NavigationRenderer` itself: that renders through
`SidebarMenuButton`, whose `useSidebar()` throws outside the shell's
`SidebarProvider`, and a page block has to render standalone. `@object-ui/layout`
therefore exports `resolveNavItemLabel`, which was module-private — an additive
export with no behaviour change, so the sidebar and an authored menu cannot show
one nav entry under two names.

Both registrations publish **no** `inputs`: `ComponentPropsMap` declares an empty
shape for each, and both use `skipFallback: true` so neither claims the bare
`launcher` / `menu` keys. This does not change the Studio page palette —
`app:launcher` remains recorded there as a shell singleton, which is a palette
decision independent of whether a declared type renders.
