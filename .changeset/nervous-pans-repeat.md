---
---

Releases nothing on purpose: this deletes 22 dead `t(key) || 'English'` fallbacks in
`@object-ui/app-shell` and adds the gate that stops them coming back, and not one of
them can change what a user reads.

The right operand of these was unreachable on **every** path before the deletion, which
is the whole finding (objectui#4117). With an `I18nProvider` mounted, i18next serves the
`en` value and the fallback is skipped. Without one, react-i18next's not-ready `t`
returns the KEY — truthy — so `||` skips the fallback there too and the raw key renders
either way. Removing an operand that never evaluated leaves both paths byte-identical.

The five rows whose dead string said something *different* from the pack were the ones
worth checking individually, because a divergent fallback that also carried
`{{holes}}` could have been hiding an unfilled hole. Each was verified against what the
call actually passes:

- `marketplace.detail.purgeSuccess` (×2) — `en` `Removed {{count}} sample record(s).`,
  call passes `{ count: removed }`. Hole filled; renders the same before and after.
- `marketplace.detail.reseedLocalSuccess` — `en` `Re-seeded sample data: {{inserted}}
  inserted, {{updated}} updated.`, call passes `{ inserted, updated }`. Both filled.
- `marketplace.detail.reseedPartialErrors` — `en` `({{count}} record(s) failed to
  write)`, call passes `{ count: errored }`. Filled.
- `console.objectView.deleteViewConfirm` — `en` `… delete the view "{{name}}"? …`,
  call passes `{ name: viewLabel }`. Filled.
- `marketplace.detail.moreOptions` — `en` `More install options` against a dead
  `'More options'`. No holes; the `aria-label` already read the pack value.

So no call needed params wired, and the `interpolation-parity` rule from objectui#3845
independently agrees: it judges all 22 of these sites and reports nothing in either
direction. The user-visible copy is unchanged, which is why this entry carries no
version bump.
