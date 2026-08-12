---
'@object-ui/core': minor
---

Retire `ActionEngine`'s event-mapping API (objectui#3368). `ActionEngine.addMapping()`,
`ActionEngine.dispatch()`, the private `mappings` registry behind them, and the exported
`ActionMapping` interface are removed under enforce-or-remove: all four were public surface
of `@object-ui/core` with zero production callers. Nothing in the repo ever registered a
mapping, so `dispatch()` had no reachable caller either, and every call site was in the
engine's own test file.

Breaking for anyone who typed against or called the removed declarations, marked `minor`
per this repository's version-alignment convention (the major tracks `@objectstack`, never
an API-break count). Actions are still entered by name (`executeAction`), by location
(`getActionsForLocation`), by shortcut (`handleShortcut`) and in bulk (`executeBulk`) —
only the event-keyed entry point is gone, and no runtime behaviour changes because no
runtime path reached it.

The three ways the retired condition gate had drifted from the `visible` contract that
`getActionsForLocation` implements die with the path rather than being fixed on it: it
entered on a raw truthy check (`condition: false` dispatched anyway), typed `condition` as
`string` only (a `{ dialect: 'cel', source }` envelope could not reach the canonical
`@objectstack/formula` engine), and evaluated without `throwOnError` (a throwing predicate
failed OPEN, the opposite of `visible`'s fail-closed posture). Aligning the contract of an
API nobody calls would only have widened behaviour nobody uses.
