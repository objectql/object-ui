---
'@object-ui/types': patch
'@object-ui/runner': patch
---

The standalone runner renders `AppAction.items` from its declared type only, which
makes `AppActionSchema.onClick`'s retirement message true again (objectui#6854,
maintainer ruling of 2026-09-05, option B2).

`AppAction.items` is `AppMenuItem[]`, and the zod mirror parses it with the legacy
eight-member `MenuItemSchema` — neither declares `onClick` or `shortcut`.
`LayoutRenderer` reached both through `as any`, past the type it was handed, and
that left three mutually exclusive signals about the same key: the TypeScript face
said `?: never`, the validator's refusal said "no renderer reads this key, so
nothing could ever run it", and a renderer read it. An agent or a reader could
believe any one of the three and be contradicted by the other two.

**No published accept set moves and no exported symbol changes.** `AppAction.items`
is NOT re-typed (the alternative was measured and refused: it would have carried a
breaking migration for `path` / `href` / `badge` / `type` and the divider spelling,
for a capability with no measured consumer). The refusal message itself is unchanged
— it is shared by 22 other retired handler keys, and deleting the cast is what makes
its sentence true rather than restating it.

- `@object-ui/runner`: `LayoutRenderer` no longer reads `onClick` or `shortcut` on a
  `type: 'user'` action's `items`. The `onClick` branch was an empty body and could
  never run a JSON value; the `shortcut` read rendered a `DropdownMenuShortcut` from
  a key the mirror strips in silence, so no validated document could reach it. A
  census of every JSON and TypeScript app document in this repository found zero
  authors of either key (positive controls recorded on the issue).
- `@object-ui/types`: the rationale comments on `AppAction.onClick` and
  `AppActionSchema.onClick` said "nothing reads `AppComponentSchema.actions[]`".
  That was false — the runner renders both the `'button'` and the `'user'` arm.
  Corrected to what was measured: `actions[]` is read, `onClick` is not.

Whether `shortcut` should become authorable on `AppAction.items` is a separate
contract question and is filed on its own.
