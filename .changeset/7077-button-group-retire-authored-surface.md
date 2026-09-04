---
'@object-ui/components': patch
---

`button-group` honors per-button `disabled`, and the catalog stops authoring 29 keys
nothing reads (objectui#7077, maintainer ruling 2026-09-04, decision batch #25).

**The renderer change.** `ButtonGroupButton` declares `disabled?: boolean` and the
renderer read it nowhere — it mapped `schema.buttons` to `Button` elements passing
`variant`, `size`, `className` and `label` and nothing else, so a button declaring
`disabled: true` rendered live and clickable. It now forwards the value, matching every
sibling that declares item-level `disabled`: `tabs`, `select`, `dropdown-menu`,
`menubar`, `context-menu`, and `toggle-group` since objectui#4632. This is mechanical
consistency with an already-declared contract — no new key, no new type member, and no
change to what any schema accepts or refuses.

**Migration.** None required. A `disabled: true` you already author starts taking
effect; that is the declared meaning of the key, and nothing in the shipped corpus
authored it.

**The corpus change.** `button-group` stays a **presentational** group: no selection
state, no `selectionMode`, no group-level `value`, no per-button `value`, no per-button
`icon`. All six catalog fixtures authored those four undeclared keys — 29 occurrences —
and every one parsed green, because `BaseSchema` is `.passthrough()` and carries
`[key: string]: any`: admitted unexamined, never refused. The keys are gone from the
fixtures. Implementing selection instead was weighed and rejected: it is a capability
addition with zero measured pull, and the only things authoring it were fixtures we
wrote ourselves — the corpus reverse-defining the product. It remains available as a
fallback if a real consumer (an app or example needing a segmented control) is produced
first.

This matters more than a demo tidy-up because the catalog is the corpus AI authoring
tools retrieve from. An author copying the old `single-selection.json` got a schema that
validated, published, and did nothing — a failure with no signal to self-correct from.

`with-icons.json` is **removed** rather than emptied: with `icon` retired, a fixture by
that name authored no icons, and what remained duplicated `basic-button-group.json`. Its
demo slot on the docs page goes with it. The other five keep their labels and still
render — `icon-toolbar.json` rendered three blank buttons until objectui#6318 gave it
labels, and a pin now holds every fixture in the category to a non-empty `label` on
every button.

`onClick` is **not** wired, and is not a gap: objectui#6124 (PR #7339) retired it two
days before this ruling. It is `onClick?: never` on the TypeScript face and a refusal by
name on the Zod mirror, so there is no declared-but-dead handler left to forward.
