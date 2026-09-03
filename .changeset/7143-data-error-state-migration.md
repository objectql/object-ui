---
'@object-ui/components': minor
'@object-ui/plugin-list': minor
---

`DataErrorState` accepts the icon props `DataEmptyState` already had, and `ListView`'s
load-failure panel is now rendered by the error state instead of the empty state
(objectui#7143; maintainer ruling 2026-09-01, director decision batch #27).

`ListView` rendered its load FAILURE through `DataEmptyState` — the component named for
the *empty* case — passing it a destructive icon, error copy and a retry action, while
`DataErrorState`, in the same file and with the same layout, had no consumer anywhere in
the repo. objectui#7132 closed the accessibility half of that collision (the panel now
declares `role="alert"` over the empty state's `role="status"` default) and deliberately
left the structural half alone: `DataErrorState` hardcoded its icon, so the swap was a
props-surface question plus a visual change rather than a rename.

**`@object-ui/components` — three additive optional props on `DataErrorState`**, mirrored
from `DataEmptyState` in the same file rather than spelled a second way:

- `icon?: React.ReactNode` — rendered above the title; falls back to the `AlertCircle`
  glyph the component has always drawn.
- `showIcon?: boolean` (default `true`) — `false` omits the icon container entirely.
- `iconWrapperClassName?: string` — REPLACES the wrapper's default class rather than
  merging with it, so `""` renders the icon raw. `DataEmptyState` resolves it with `??`
  against its own default and this does the same, against
  `flex size-10 items-center justify-center rounded-lg bg-destructive/10` — the destructive
  square `DataErrorState` already drew.

Same names, same types, same default semantics as the empty state's; nothing existing on
`DataErrorState` changed, and a call site that passes none of the three renders exactly
what it rendered before. `illustration` and `action` were deliberately NOT mirrored — the
ruling pins three props, and this component's retry affordance is already spelled
`onRetry` / `retryLabel` (plus `children` for a call site that needs its own control).

One non-prop addition rides along, called out rather than folded in: the icon wrapper now
carries `data-slot="data-error-state-icon"`, mirroring the empty state's
`data-empty-state-icon`. Without it the wrapper `iconWrapperClassName` governs has no
name — untestable and unstylable — and migrating a call site off `DataEmptyState` would
DROP that identifier rather than rename it.

**`@object-ui/plugin-list` — the panel changes component identity, not pixels.** The call
site passes the same custom icon through the new `icon` prop, the same
`iconWrapperClassName="mb-3"`, the same title, and the same copy through `message` (the
error state's spelling of `description`); its retry `<Button>` moves from `action` to
`children`, which renders at the identical position. `role="alert"`, the
`data-testid="list-error-state"` hook and `data-error-kind` are untouched. The whole
rendered delta is two attributes:

- the panel root's `data-slot` becomes `data-error-state` (was `data-empty-state`);
- the icon wrapper's becomes `data-error-state-icon` (was `data-empty-state-icon`).

Both are renames, not removals. Nothing in this repo styles or selects on either — no CSS
rule and no test read them — so a stylesheet in a host app targeting
`[data-slot="data-empty-state"]` to reach *this* panel is the only way to notice, and it
should be reading `data-error-state` now. Every class on every node, and the glyphs
themselves, are byte-identical: this is a visual no-op, deliberately, so the review the
ruling asks for has a small thing to look at rather than a redesign.
