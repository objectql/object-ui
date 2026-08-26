---
'@object-ui/app-shell': patch
---

`StarredApps` now filters out `nav`-type favorites before rendering (objectui#6335).

`FavoritesProvider` has always documented `nav` favorites (sidebar entries pinned via
the in-tree pin toggle) as "Excluded from Home/Starred and from the generic sidebar
Favorites list so it doesn't render twice" — but `StarredApps` filtered nothing by type,
so a `nav` favorite handed to it rendered anyway. `FavoriteItem['type']` also has no
`nav` key under `home.recentApps.itemType.*` (only five of its six members do), so a
`nav` card that reached `StarredApps` fell through to the raw `"nav"` label instead of a
translated one.

`StarredApps` now filters `items` to `type !== 'nav'` before rendering — the same
exclusion already applied to the sidebar Favorites list in `AppSidebar.tsx` and
`UnifiedSidebar.tsx` — restoring declared-equals-enforced behaviour and making the
missing locale key correct by construction. No locale packs were touched, and the
`FavoriteItem` / `RecentItem` union types are unchanged.
