---
'@object-ui/core': minor
---

`ValueDataSource`'s object-dialect matcher executes the operators the spec declares and
refuses the rest, instead of waving every unrecognised one through (objectui#8447).

**Breaking, deliberately — this MOVES RESULTS.** `matchesFilter` ended its operator
switch with `default: break`, which adds no constraint, so an unrecognised operator
matched **every** row, silently. The asymmetry sat inside one `if` in `find()`: an
array `$filter` goes to `matchesASTFilter`, which refuses an unknown node, excludes the
row and logs it; an object `$filter` went to `matchesFilter`, which admitted it and
included the row. Same file, opposite defaults, and nothing told an author which dialect
their filter took.

**Now executed** — one arm per member of the spec's `FILTER_OPERATORS`, each answering
the same question its AST twin already answered: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`,
`$lte`, `$in`, `$nin`, `$between`, `$contains`, `$icontains`, `$notContains`,
`$startsWith`, `$endsWith`, `$null`. Eight of those were already implemented; the other
seven selected every row. `$eq` is the sharpest of them: `{ age: { $eq: 26 } }` selected
everything while the plain `{ age: 26 }` beside it was correct all along.

**Now refused** — excluded and logged once per distinct refusal per `find()`, in
`matchesASTFilter`'s own idiom:

- `$exists`, with a refusal that names the exact synonym this matcher does execute
  (`$exists: true` is `$null: false`; `$exists: false` is `$null: true`).
- `$like` / `$ilike`, declared by `StringOperatorSchema` but deliberately staged out of
  `FILTER_OPERATORS`; this matcher has no pattern engine.
- `$regex` / `$options`, retired from the protocol — the refusal prints the spec's own
  `RETIRED_FILTER_OPERATORS` prescription verbatim, the way the driver-side refusal
  sites do.
- Lowercase aliases (`$startswith`, `$notcontains`, `$notin`) and the off-spec
  `$ncontains`: the canonical `$` spellings are camelCase, and growing alias arms in the
  renderer would fossilise a second dialect.
- A nested relation constraint (`{ profile: { verified: true } }`), refused by the key
  it could not read; this matcher does not descend into relations.
- `$and` / `$or` / `$not`, which are combinators rather than field operators. `$and` and
  `$or` carry an array and were already excluding every row through the equality branch,
  silently — those rows do not move, only the silence does. `$not` carries an object, so
  it entered the operator branch, its inner field names were read as operator names and
  each hit `default: break`: it matched **every** row, and now matches none. Executing a
  group in this dialect is a feature with its own semantics to settle and is not part of
  this repair; the AST array `$filter`, which the sibling arm of `find()` already
  executes, is the door that works today.

**Migration.** A filter that used any of the seven newly-executed operators was
returning unfiltered data; it now returns the rows it names. A filter using a refused
spelling now returns nothing and says why on the console — rewrite it in the canonical
spelling the refusal prints, or express it as an AST array `$filter`.
