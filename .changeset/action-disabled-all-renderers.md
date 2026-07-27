---
"@object-ui/components": patch
"@object-ui/app-shell": patch
"@object-ui/plugin-detail": patch
---

fix(action): honor the spec `disabled` predicate on every action-rendering surface (#1885 follow-through)

The spec Action field is `disabled` (boolean | CEL — disabled when TRUE); the
schema has no `enabled` key. #1885 wired it in `action:button` only. Browser
dogfooding against the showcase found FIVE more surfaces where a spec-authored
`disabled` silently did nothing:

- **components** — the `action:group` leaves (inline + dropdown), `action:icon`
  and `action:menu` still read the legacy non-spec `enabled`. They now consume
  `disabled` as the primary control (evaluated in the same scope as `visible`),
  with `enabled` kept as a deprecated fallback.
- **app-shell** — `DeclaredActionsBar` (server-declared action bar) read
  neither; it gains `disabled` (no legacy fallback: declared actions are
  spec-shaped and never carried `enabled`).
- **plugin-detail** — `record:quick_actions` HAD a `disabled` implementation,
  but its `typeof === 'string'` split dropped the `{dialect:'cel', source}`
  envelope the server compiles authored CEL into (#2661 routes envelopes to the
  canonical formula engine), so the predicate never fired on real metadata. It
  now feeds `toPredicateInput`'s result to `useCondition` whole, like every
  other surface.

Pinned by new `DropdownActionItem` tests (disabled-when-TRUE, false-stays-
clickable, disabled-wins-over-enabled, boolean literal) and browser-verified
end-to-end against the showcase `showcase_archive_task` specimen: greyed on an
in-progress task, clickable on a done one (with `visible` hiding Mark Done on
the same screen — the hide-vs-grey contrast).
