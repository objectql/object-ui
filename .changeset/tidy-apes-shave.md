---
'@object-ui/react': patch
---

fix(react): the spec bridge abstains on a non-string `rowHeight` instead of coercing it to a density, matching core

`mapDensity` opened with a truthiness guard, so any **truthy non-string** survived it and was
then coerced into a lookup key — both `Object.prototype.hasOwnProperty.call` and the table index
run `String(...)`. `rowHeight: ['compact']`, a boxed `String('compact')` or
`{ toString: () => 'compact' }` therefore each selected a real density, while
`@object-ui/core`'s `rowHeightToDensityMode` — which opens with `typeof rowHeight !== 'string'` —
abstained for the same input. Two published surfaces, two answers for one input.

The bridge now opens with core's type guard. An off-spec non-string `rowHeight` renders exactly
like an absent one, and the producer is where it gets fixed (AGENTS.md #0.1). Behaviour for the
five spec row heights and for off-spec **strings** is unchanged; `''` keeps its answer by a
different route (a string now, refused one line later because it is not one of the five keys).

Note the direction against the previous fix in this function: that leak returned a *function*,
visibly wrong to everything downstream. This one returned a legitimate-looking `'compact'` that
nothing downstream could tell apart from an authored density.
