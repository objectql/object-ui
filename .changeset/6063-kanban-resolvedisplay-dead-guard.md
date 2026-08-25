---
'@object-ui/plugin-kanban': patch
---

`ObjectKanban`'s `resolveDisplay` drops an unreachable relation-type guard, and the rule
that survives it is pinned (objectui#6063).

The helper that builds card descriptions ended:

```ts
const isLookup = isExpandableFieldType(def);
if (isLookup && isOpaqueId(raw)) return undefined;
if (isOpaqueId(raw)) return undefined;
return raw;
```

The second line subsumes the first for every input — same `raw` (a `const`, unmodified
between the two lines), same predicate, and `OPAQUE_ID_RE` carries no `g`/`y` flag, so
repeated `.test()` on it is stateless. `isLookup` was computed, branched on and discarded.

**No behaviour changes on any board.** The card named a second reading — that the
unconditional line was the mistake and only relation columns were meant to suppress
id-shaped values — and it was rejected on evidence rather than by tidying first: the
helper's own docblock declares both clauses, the same predicate is already applied with no
type gate to the incoming `description` a few lines down, and `objectDef` is optional at
that read, so a type gate would suppress nothing on exactly the boards whose object schema
is thin or absent. That reading is now a red test, not a comment.

Deleting the branch also deleted this path's read of `@object-ui/core`'s
`EXPANDABLE_FIELD_TYPES`, so objectui#5874's identity pin for this face is re-anchored onto
the read that is live — `buildExpandFields`, on every fetch — where the membership delta is
observable on the wire (`$expand`) as well. That pairs the identity pin with the
behavioural counter-probe #5874 had to record as missing.
