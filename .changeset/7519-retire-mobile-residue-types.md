---
'@object-ui/types': minor
'@object-ui/mobile': minor
---

**Removes two published exports.** Retire the `MobileResponsiveConfig` and
`GestureConfig` types (objectui#7519, ADR-0049 enforce-or-remove). Both names
are deleted from `@object-ui/types` and from `@object-ui/mobile`, which
re-exported them — after this release `import type { MobileResponsiveConfig }`
or `import type { GestureConfig }` from either package is a compile error, not a
deprecation warning.

Each had exactly one consumer: the `responsive` and `gestures` members of
`MobileComponentConfig`, which objectui#5942 retired. Re-measured on current
`main` before anything was deleted, each was a declaration plus the two barrel
re-exports and nothing else — no type mounted either, nothing extended,
annotated, cast to or imported them outside the barrels, and the example apps
and the `objectstack` sibling checkout had zero authors. A value written against
either could not reach a renderer or a handler by any path. That is the same
declared-surface-with-no-consumption-path shape as `MobileComponentConfig`
itself and `MobileOverrides` (objectui#4919) before it, one level down.

Removed outright rather than kept as `?: never` tombstones, measured against
this package's two-prong discriminator (a tombstone steers authors to a named
live replacement key, or keeps loud a key the docs taught as working). Prong 1:
neither has a replacement key — the behaviour they named lives in hooks, and
`SpecGestureConfig` is a different contract, not a successor. Prong 2: the only
release-note lines naming either are the objectstack#4115 rename-ledger rows
and, for `GestureConfig`, the objectui#3363 reclaim note; none taught a
renderer or dispatcher reading them, and no member carried a published
`@default` (contrast `triggerIcon`, tombstoned by objectui#7654 on exactly that
evidence). Structurally there is also no silent-strip hazard for a tombstone to
guard: whole interfaces go, nothing ever parsed them, and the mobile module has
never had a `zod/` twin to host a `retirementTombstone()`. The compiler was the
only channel these names ever had, and the refusal now lives there.

## Upgrading

**No behaviour changes and there is nothing to migrate at runtime.** An object
authored against either type did nothing before and does nothing now; what
changes is that the contract no longer claims otherwise, so the mistake surfaces
at authoring time instead of silently type-checking.

- **You imported a type only** (the only thing that was possible — nothing
  accepted either as a value): delete the import. If you kept a local object
  annotated with it, drop the annotation; it was never passed anywhere that read
  it.
- **You wanted per-breakpoint layout:** it exists and is not being retired —
  `useResponsive` / `ResponsiveContainer` / `useBreakpoint` in
  `@object-ui/mobile`. `ResponsiveValue` and `BreakpointName` stay exported from
  both packages.
- **You wanted to bind a gesture to a handler:** `useGesture` in
  `@object-ui/mobile` takes `{ type: GestureType, onGesture, threshold?,
  longPressDuration?, enabled? }`. `GestureType` and `GestureContext` stay
  exported from both packages.
- **You want a declarative mobile config surface:** that re-enters deliberately
  as designed product surface on its own card, with the renderer that reads it
  landing in the same change as the declaration — not by restoring these
  declarations.

**Do not follow the compiler's suggestion for `GestureConfig`.** Measured against
the built declarations: `import type { GestureConfig }` from either package now
fails as TS2724 with `Did you mean 'SpecGestureConfig'?`. That is a lexical
near-match, not a migration target. `SpecGestureConfig` is the retired
`@objectstack/spec` `ui/touch` **tuning** record (`{ type, label, enabled,
swipe, pinch, longPress }`) that `useSpecGesture` reads; it has no `action`
member and does not bind a gesture to anything. `MobileResponsiveConfig` fails
as a plain TS2305 with no suggestion from either package.

Marked `minor`, not `major`, per this repo's version-alignment rule (AGENTS.md
版本号策略), which reserves `major` for following `@objectstack` across a major —
the same classification objectui#5942 and objectui#4919 used for identically
breaking type removals. **Breaking for TypeScript consumers of the two names
only.** The in-repo consumer count is zero; consumers outside this repository
that import either name from either package are not visible from here, which is
why this entry is graded on the published-surface change and not on that count.
