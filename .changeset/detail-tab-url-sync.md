---
'@object-ui/components': minor
'@object-ui/plugin-detail': minor
'@object-ui/app-shell': minor
'@object-ui/types': patch
---

Record detail tabs are URL-addressable (`?tab=`) and survive subtree remounts (objectui#2257, ADR-0054 C3).

- `buildDefaultTabs` emits STABLE semantic tab values (`details` / `related:<child>` / `related` / `activity` / `history`) instead of leaving the renderer to synthesize index-derived ones.
- `PageTabsRenderer` honors `item.value`, a host-provided `schema.defaultTab` (validated against actual tabs) and `schema.onTabChange`; index fallback kept for authored schemas without values.
- app-shell `RecordDetailView` restores the active tab from `?tab=` and writes it back with `replace` (tab switches never stack history), via the pure `withPageTabsUrlSync` page-tree injector (never mutates authored/memoized page schemas). Legacy `DetailView.autoTabs` wired to the same contract (`defaultTab`/`onTabChange`).
- Fixes the tab strip resetting to Details after save-refresh remounts (`refreshKey`-style) and dev-StrictMode URL churn; enables `?tab=` deep links; invalid values fall back to Details.
