---
'@object-ui/app-shell': minor
---

**BREAKING (in name only):** `MetadataService.saveObject(obj, existingFields)` now requires
its second argument (objectui#6490). Calls that omitted it no longer compile.

**Runtime behaviour is unchanged, and that is the whole justification.** A call that omitted
the field list was already a guaranteed `422` — every time it ran, against every backend.
`ObjectSchema.fields` is not merely typed, it is REQUIRED: measured against the installed
`@objectstack/spec` 17.2.0, `ObjectSchema.safeParse({ name: 'account', label: 'Account' })`
fails with `invalid_type @ fields`, and `metadata-protocol`'s `saveMetaItem` parses the whole
item against that same schema and throws `422 INVALID_METADATA` **before** it persists. The
method cannot build a valid document without the argument, so the only calls this break
breaks are calls that already failed. The signature is now honest about it, and the diagnosis
moves from a round trip at runtime to the compiler.

Nothing new is exported and nothing new is accepted — this narrows the published surface
rather than widening it. In-repo production call sites were measured at **zero** (only tests
called it), so the migration for an external consumer is to pass the field list it was
already required to send: `saveObject(obj, fields)`.

⛔ Two readings were considered and declined, recorded so neither is taken later as a
shortcut. **Not a `{}` default** — `{}` parses GREEN and `PUT /api/v1/meta/object/:name` is
an upsert, so defaulting would delete every field of the object on a save that only meant to
rename it, trading a loud, harmless 422 for silent data loss; the anti-wipe control from
objectui#6240 (`omits fields entirely when the caller supplied none — it does NOT write {}`)
moves with the signature and still guards the path a JavaScript consumer can reach. **Not
fetch-and-merge** — an object save could GET the current document and preserve its stored
`fields` the way `saveFields` does, but that builds capability for a path with zero measured
pull and makes the parameter redundant.

An EMPTY list stays a different statement from a missing one: `[]` means "this object has no
fields", writes `{}`, and under the upsert performs the wipe the caller asked for — the same
authoritative reading `saveFields` gives its own empty list. Unchanged, and now pinned,
because the required parameter is what routes a caller with nothing to hand toward it.

Scored `minor` and not `major` per AGENTS.md §版本号策略 — objectui's major is pinned to the
`@objectstack` major so that "same major ⇒ compatible" holds across the two repos, and every
publishable package sits in one `fixed` group, so objectui's own breaking changes ship as
`minor` with the break spelled out in the body. That is the convention, which is why the
break is stated in words above.
