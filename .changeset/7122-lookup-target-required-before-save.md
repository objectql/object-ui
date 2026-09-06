---
'@object-ui/app-shell': minor
'@object-ui/plugin-designer': minor
---

Refuse to save a `lookup` / `master_detail` field with no target, instead of
PUTting it and blocking the object (objectui#7122).

⚠️ **Breaking behaviour, graded `minor`.** A `lookup` / `master_detail` field
whose `reference` is missing or empty is now **refused before any PUT** by both
metadata writers — `@object-ui/app-shell`'s `MetadataService.saveFields` /
`saveObject` and `@object-ui/plugin-designer`'s `MetadataFieldsPage`. A caller
that previously got a request issued (and accepted by a 17.2.0 backend) now gets
a rejection and **no request at all**. `minor` rather than `major` per
`AGENTS.md`'s version-alignment rule: objectui's own breaking changes are graded
`minor` with the breaking semantics stated in the changeset body, because any
`major` in the fixed group would push all 39 packages off `@objectstack`'s major.

`@objectstack/spec` 17.3.0 makes `reference` a hard requirement on the two
relationship field types — a `custom` refinement at path `reference`, measured
on the installed build; at 17.2.0 the requirement was prose only and
`{ type: 'lookup', label: 'L' }` parsed green. The designer relied on that
latitude and PUT half-filled drafts.

Against a matched 17.3.0 backend that PUT returns `422 INVALID_METADATA` for the
WHOLE object document, so the damage is not confined to the incomplete field:
every later save of that object fails the same way until the draft is completed
or removed by hand.

Both metadata writers now raise before the request, naming the field and what to
do about it. The message lands in the page's existing error banner, the same one
a nameless or duplicated field already produces; no new UI affordance, and no
request is issued. A relationship field WITH a target is unaffected.

Picked over the cheaper alternative deliberately: flipping the parity pin green
while the product still PUT the draft would have pinned a known-broken save
path.

## ⚠️ The guard is STRICTER than the contract on one value, and that is declared

The predicate is `typeof reference === 'string' && reference.trim() !== ''`, so
a **whitespace-only** `reference` is refused too. `@objectstack/spec` 17.3.0
**accepts** that value — measured on the installed build, at field level and
again through the whole `ObjectSchema` document:

```
FieldSchema.safeParse({ type: 'lookup', label: 'L', reference: '   ' })  => true
ObjectSchema.safeParse({ …, fields: { rel: { …, reference: '   ' } } })  => true
```

objectui being stricter than the platform is a divergence, not a neutral choice,
so it is stated here and in both writers' docblocks rather than left to be
inferred from a predicate.

⭐ **Kept, deliberately.** A whitespace-only `reference` names no object — there
is no `   ` object for the record picker to query, for `$expand` to resolve, or
for a relationship index to be built against — so admitting it buys the author
nothing and only moves the same failure to a later and worse place: past the
guard, past the PUT, into a stored document, where it surfaces with no field
named. This guard exists precisely to stop a target-less lookup being saved, and
a blank target is a target-less lookup that happens to parse.

⚠️ The spec accepting `'   '` while refusing `''` reads as an **upstream gap**
rather than deliberate latitude — its own refusal prose says "non-empty …
naming the target object", and `ObjectSchema.fields`' key grammar
(`/^[a-z_][a-z0-9_]*$/`) admits no whitespace-bearing name for it to resolve to.
Filed as **objectstack#16126**; objectui is compensating for it here. When it
lands upstream this declaration retires and the behaviour is unchanged.

## The refusal message now distinguishes the four states

It used to say the field "has none" for every refused value, which is wrong for
two of them. Measured on 17.3.0: a **non-string** `reference` is refused as
`invalid_type` at that path, not as a missing target ("supply a target" is not
the repair for `reference: 42`), and a **whitespace-only** one is not refused by
the spec at all, so the 422 the message promised could not be delivered for it.
Each of the four states now gets its own accurate diagnosis and consequence.
