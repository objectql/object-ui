---
'@object-ui/app-shell': minor
---

`ConditionBuilder` now takes a caller-supplied **subject vocabulary** instead of hardcoding a
record-scoped one (objectui#6296).

The builder built every row subject as `record.` + field name, plus a fixed `record.id` /
`user.*` / `org.*` context list. That is correct for all five files that mount it today — six
mount sites, since `ActionDefaultInspector` mounts it twice — because every one of them is a
record-scoped site. It is wrong for a **flattened**-scoped site such as the flow designer's
entry condition, where the trigger record's fields *are* the top-level evaluation context
(bare `status`) and the prior values arrive as `previous.FIELD`. This repo's own
`flow-scope.ts` already computes that distinction (`fieldPrefix: onStart ? '' : 'record.'`,
`includePrevious`), and objectstack's `packages/formula/src/validate.ts` defines the two
scopes.

A new optional `subjects` prop declares what a site actually binds:

- `fieldPrefix` — defaults to `'record.'`; `''` declares a flattened scope.
- `includePrevious` — also offer `previous.FIELD` per field, plus the whole-record `previous`
  token, which is what makes the create-path idiom `previous == null` **selectable** rather
  than something the author has to recall from help text.
- `context` — replace the context subjects, so a flattened site does not inherit `record.id`,
  a root it does not bind. Offering it there would make this editor emit the one spelling its
  own sibling ref-check flags as out of scope.

Declared, never inferred: the component does not guess a site's scope from the value it is
handed. **A caller that declares nothing gets exactly the previous behaviour** — the option
list, the `record.` prefix on a compiled row, and the single-quoted value spelling are all
pinned positively against that default, so changing it fails rather than re-baselines.

**Double-quoted string literals now round-trip into row mode.** `unfmtValue` stripped only
single quotes while `fmtValue` re-emitted only single quotes, so `status == "done"` could
never survive the builder's byte-for-byte adoption check and was handed to the raw CEL editor
— even though double quotes are what the entry-condition placeholder teaches and what every
shipped example flow uses. Each row now remembers the quote character it was parsed with and
re-emits that one, so the author's own spelling is preserved rather than normalised, and the
byte-for-byte safety rule is kept exactly as it was rather than loosened. Rows built in the
builder still emit single quotes, unchanged.

Measured against the shipped corpus — every start-node entry condition in objectstack's
example apps plus the HotCRM example from objectui#6226 — row-mode adoption goes from 3/17 to
15/17. The two that remain on raw mode are `&&` mixed with a parenthesised `||` group: a
grammar limit of the row model, unrelated to subjects, and out of this card's scope.

The component is not re-exported from the package index, so no external caller can pass the
new prop yet; the wiring that will (objectui#6226) is a separate card. Scored `minor` for the
added capability rather than `patch`, since the widening is real even while its only future
caller is in-repo.
