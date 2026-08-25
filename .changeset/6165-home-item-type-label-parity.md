---
'@object-ui/app-shell': patch
---

Home renders one agreed label for an item kind that has no translation key.

The rail (`HomeContinue`), `RecentApps` and `StarredApps` all resolve the same
`home.recentApps.itemType.*` label, and each spelled the lookup itself. They had
drifted: the rail fell back to the bare kind (`report`) where both card surfaces
fell back to the capitalised one (`Report`) — two spellings of the same word on
one screen. All three now resolve through a single `recentItemTypeLabel` helper,
so the fallback cannot drift apart again.

User-visible: the rail's label for an unkeyed kind changes from `report` to
`Report`. Every kind shipping today carries a key, so no label changes for them;
this is about the next kind added, and any host passing a kind the locales do
not carry.
