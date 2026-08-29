---
"@object-ui/console": patch
---

Console: free the marketplace routes `AppContent` declares lazy, and pin the metadata-admin surface that cannot be freed

`AppContent` declares four surfaces with `lazy()` that the emitted bundle loaded on
every console page load anyway. Measured on `b98352a15` from
`apps/console/dist/eager-closure.json` and the emitted chunks' own module lists —
not from a source-level search, which cannot see the mechanism at all:

| chunk | gz, eager before | after |
|---|---|---|
| `metadata-admin` | 172,651 B | unchanged — pinned, with the module list that proves it |
| `MarketplacePackagePage` | 7,647 B | lazy |
| `MarketplaceInstalledPage` | 1,836 B | lazy |
| `MarketplacePage` | already lazy | lazy |

Both marketplace chunks were held by CHUNK CO-TENANCY, not by any import of the page:
rolldown had parked `components/SuggestedBindingsPanel.tsx` (statically imported by the
eager `views/studio-design/StudioDesignSurface.tsx`) in the first, and
`console/marketplace/InstalledListWidget.tsx` (bare-imported by the package barrel for
its SDUI registration) in the second. An `app-shell-eager-leaves` group in
`apps/console/vite.config.ts` isolates those co-tenants so the three declared-lazy pages
chunk by their own dynamic-only reachability. The console eager closure moves
3180.2 KB → 3171.5 KB gzipped (−8,888 bytes, 48 → 45 eager chunks) with the three
per-chunk ceilings unmoved.

`metadata-admin` is NOT freed and is now pinned in
`DECLARED_LAZY_VIEWS_STILL_EAGER` with the reason: it is statically imported by the
package barrel and by `services/builtinComponents.tsx`, which registers
`MetadataDirectoryPage` and `MetadataResourceRouter` by value, and it performs five
load-bearing top-level registrations. Freeing it would change what
`registerAppComponent` accepts and what the barrel re-exports — a published-contract
decision, not a bundling one.
