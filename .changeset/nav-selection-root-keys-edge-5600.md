---
---

Internal layering fix, behaviour-unchanged: publishes nothing, declared explicitly
with an empty frontmatter rather than left undeclared.

Inverts the dependency edge objectui#5600 found: `nav-selection.ts` — otherwise pure
URL-parsing plumbing (`parseSurfaceParam` / `formatSurfaceParam` / `parseNavSelParam`
and friends) — statically imported `APP_NAV_ROOT_KEYS` from the 510-line
`AppNavInspector.tsx`, so every consumer of the URL helpers (including two small
utilities, `console/ai/artifactStudioPath.ts` and, transitively via
`useSurfaceDeepLink.ts`, the studio-design surface) pulled a React inspector
component into their static import graph for one array of root keys.

`APP_NAV_ROOT_KEYS` (`['nav', 'navigation', 'tabs', 'items', 'menu']`) is a plain
string-literal array — it describes nav SHAPE, not the inspector — so it now lives in
`nav-selection.ts` instead. `AppNavInspector.tsx` never read the array itself, only
re-exported it (`export const APP_NAV_ROOT_KEYS = ROOT_KEYS;` as its last line), so
the fix is a straight move with no back-import needed on that side.

Verified structurally rather than by reading the import line: a BFS over static
(non-type, non-dynamic) relative imports from `nav-selection.ts` and the other
non-test importers no longer reaches `AppNavInspector.tsx` (158 files visited, target
not found), where the same walk over the pre-fix tree found it in 6 files via
`nav-selection.ts -> AppNavInspector.tsx` directly.
