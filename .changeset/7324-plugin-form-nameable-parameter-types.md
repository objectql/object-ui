---
'@object-ui/plugin-form': minor
---

Publish the parameter types of the entry's own exported functions, so a consumer can
name what it must pass (objectui#7324).

`ChildObjectSchemaLike` and `FieldDefaultsSchemaLike` are now exported from
`@object-ui/plugin-form`. They are **type-only** additions — no runtime name is added
to the entry, which is pinned.

**Why `minor`, not `patch`.** Nothing breaks and no behaviour changes, but two names
join the published surface of a published package. Additions are `minor` in this repo,
and a new public export is the kind of addition a consumer's lockfile-pinned range
should be able to see.

**What was wrong.** Five exported derive functions (`deriveDetail`, `deriveColumns`,
`deriveFormFields`, `findRelationshipField`, `resolveInlineMode`) take a `childSchema`,
and the exported `omitServerResolvedDefaults` takes an `objectSchema` — and neither
parameter type reached the entry. A host with its own form renderer (the reason
objectui#6059 published `omitServerResolvedDefaults` in the first place) has to hold
that schema in a variable or a prop, and could not annotate it. Structural typing means
such a host still compiled by writing the shape out by hand, so the cost was not a hard
failure but a producer-owned shape restated in every consumer, invisible to every gate
until the producer's shape moved. The package README carried exactly that restatement,
and now imports the real name instead.

**Renamed at the declaration site first, deliberately.** Both types were called
`ObjectSchemaLike`, in two files, and they are **not** the same type: the defaults one
pins the four field members its rule reads (`defaultValue`, `type`, `reference`,
`reference_to`), while the child one leaves a field value as `any` because the derive
functions read much more of it. Measured with `tsc`, they are mutually assignable
**only** through that `any` — replace it with `unknown` and the child → defaults
direction fails (TS2322) — so re-exporting either under the shared name would have put
a name on the public surface that already meant something else two files over, with
nothing in the name to say which. Neither old name was reachable from outside the
package (the package `exports` map has a single `.` entry and the entry never re-exported
them), so the rename is not a break for any consumer.

**Not** `@object-ui/types`' `ObjectSchemaMetadata`: measured, it requires `name`,
requires a `type` on every field, and has no `reference_to` member — while
`isCurrentUserSeedField` honours both `reference` and `reference_to` on purpose. Adopting
it would have narrowed what these functions accept and dropped one of the two honoured
spellings, not widened anything.
