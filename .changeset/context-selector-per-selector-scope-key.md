---
'@object-ui/app-shell': patch
---

`useAppContextSelectors` now derives each context selector's URL scope key from its own `id` instead of hardcoding the literal `package` query key. `App.contextSelectors` is an array and `AppContextSelectorSchema.id` is documented as the nav template var the selected value is published under — but the shell spelled `package` on all five read/write sites, so a second declared selector mirrored the first: switching either one wrote the same query key, and every `contextValues[id]` read it back. An app declaring `active_package` + `active_env` parsed clean, rendered two dropdowns, and fed both template vars one shared value (#3500).

Studio's shipped `?package=` links are unaffected. The `active_package` selector keeps that exact key through a single grandfathered entry (`contextSelectorQueryKey`), because it is not this renderer's key to rename: ~15 Studio nav items declare `params: { package: '{active_package}' }` in `@objectstack/platform-objects`, six Studio surfaces read `?package` straight off the query string, and bookmarked URLs already carry it. Existing URLs are byte-identical before and after; only newly declared selectors get `?<id>=`. `UnifiedSidebar`'s Studio home link now reads and re-emits the scope through the same derivation rather than assuming the literal key. Two selectors colliding on one key warn in dev.

The `persist` under-enforcement reported in the same issue (`'query' | 'session' | 'none'` are not distinguished) is deliberately untouched here — it is a spec-side enforce-or-remove ruling tracked separately.
