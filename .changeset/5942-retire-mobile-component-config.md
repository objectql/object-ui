---
'@object-ui/types': minor
'@object-ui/mobile': minor
---

**Removes a published export.** Retire the `MobileComponentConfig` type
(objectui#5942, ADR-0049 enforce-or-remove). The name is deleted from
`@object-ui/types` and from `@object-ui/mobile`, which re-exported it — after
this release `import type { MobileComponentConfig }` from either package is a
compile error, not a deprecation warning.

`MobileComponentConfig` published a four-key "mobile component schema
extension" — `responsive`, `gestures`, `pullToRefresh` and `infiniteScroll` —
and nothing read it. Re-measured on current `main` before anything was deleted:
the type had exactly four code mentions repo-wide — its own declaration, one
doc-comment cross-reference, and the two barrel re-exports. It had **no mount
point at all**: no type mounted it as a property, nothing extended it, and no
renderer, hook or adapter annotated, cast to or imported it. A sweep of the
example apps and the `objectstack` sibling checkout found zero authors. Every
read-shape probe returned zero against a control lit in the same run.

That makes it stricter than the usual case: not merely a surface whose values
were unimplemented, but a container with no path by which any authored value
could reach a renderer. objectui#4919 removed its last member
(`mobileOverrides`), which is what left the container itself inert.

Removed outright rather than kept as a `?: never` tombstone, on this package's
own discriminator: a tombstone steers authors to a named live replacement key
(`crud.ts` `confirm` to `confirmText`; `data-display.ts` `hoverable`/`striped`
to `data-table`), or keeps loud a key the docs taught as working. Neither
applies — the whole interface goes, so there is no surviving object to hang a
`never` key on, and no documentation ever described it
(`skills/objectui/guides/mobile.md` teaches the hooks, never this type). Same
zero-pull, no-successor shape as `MobileOverrides` (objectui#4919) and
`AccordionItem.icon` / `ToggleGroupItem.icon`.

## Upgrading

**No behaviour changes and there is nothing to migrate at runtime.** An object
authored against this type did nothing before and does nothing now; what
changes is that the contract no longer claims otherwise, so the mistake
surfaces at authoring time instead of silently type-checking.

- **You imported the type only** (the only thing that was possible — nothing
  accepted it as a value): delete the import. If you kept a local config object
  annotated with it, drop the annotation; the object was never passed anywhere
  that read it.
- **You actually wanted the behaviour:** it exists, and it is not being
  retired. It lives in `@object-ui/mobile` as React hooks, which is where the
  working code always was — `useResponsive` / `ResponsiveContainer` for
  `responsive`, `useGesture` for `gestures`, `usePullToRefresh` for
  `pullToRefresh`. `infiniteScroll` has no hook; it was never implemented in
  any form. See `skills/objectui/guides/mobile.md`.
- **You want a declarative mobile config surface:** that re-enters deliberately
  as designed product surface on its own card, with the renderer that reads it
  landing in the same change as the declaration — not by restoring this
  declaration.

Marked `minor`, not `major`, per this repo's version-alignment rule, which
reserves `major` for following `@objectstack` across a major (AGENTS.md
版本号策略) — the same classification objectui#4919's identically breaking type
removal used. **Breaking for TypeScript consumers of the name only.**

Follow-up, deliberately not widened into this change: `MobileResponsiveConfig`
and `GestureConfig` were consumed only by this container and are now
zero-consumer published types themselves. Filed as objectui#7519 for triage.
