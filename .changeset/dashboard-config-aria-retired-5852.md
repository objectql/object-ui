---
'@object-ui/types': minor
---

**Retired the designer-surface dashboard `aria` pair — `DashboardConfig.aria` and `DashboardConfigSchema.aria`** (objectui#5852).

Both spellings are named verbatim above so a host can grep its own sources: the
retired member is `aria`, on the TypeScript interface `DashboardConfig`
(`@object-ui/types`, `designer.ts`) and on its Zod mirror `DashboardConfigSchema`
(`@object-ui/types/zod`). It declared `{ label?: string; description?: string }`.

**Why.** The spellings `label`/`description` match neither `@objectstack/spec`'s
`AriaProps` vocabulary (`ariaLabel` / `ariaDescribedBy` / `role`) nor anything a
renderer maps, so no read point could have consumed them even in principle.
Re-measured on `main` at the retirement: zero `.aria` reads in
`packages/plugin-designer/src`, `packages/plugin-dashboard/src` and
`apps/console/src`; zero occurrences of either name anywhere in the `objectstack`
repo; and `DashboardConfigPanel.tsx` — the panel the interface's own doc comment
says it serves — imports neither name.

**The two directions differ, and neither is a no-op:**

- **TypeScript (a narrowed suggestion, not a compile break).** `DashboardConfig`
  carries a `[key: string]: any` catch-all, so an existing `aria:` line still
  compiles; what is gone is the editor suggestion and the false implication that
  the key was part of the contract.
- **Zod (a behaviour change — read this one).** `aria` is now an ADR-0049
  retirement tombstone (`z.never().optional()`), following this package's
  existing convention. Previously an authored `aria` was **accepted and
  preserved** in `safeParse` output; it is now **refused by name**, with `aria`
  in the issue path and a message telling the author to delete the key. A plain
  deletion was deliberately not taken: `DashboardConfigSchema` is a bare
  `z.object` with no `.strict()`, so deleting the key would have made an
  authored `aria` **silently disappear** from the parsed output instead — a
  quiet data loss in place of a loud refusal.

**External caveat.** In-repo consumer count is zero, but that is not the npm
count: `@object-ui/types` is published, and stored dashboard configuration is
not reachable from this repo. A host that authored `aria` on a `DashboardConfig`
document will now see a validation error naming the key where it previously saw
a silently carried value. The remedy is to delete the key — it never reached a
renderer.
