---
'@object-ui/plugin-grid': patch
---

`object-grid` now declares its `data` input as the object its contract actually
accepts, instead of as an array (objectui#5090).

The declaration published `{ name: 'data', type: 'array', label: 'Static Data',
description: 'Inline rows, …' }` — which is the shape of `staticData`, the
deprecated alias the objectui#4648 carve-out deliberately leaves unpublished,
under the canonical key's name. The contract is
`ObjectGridSchema.data?: ViewData`: the spec's discriminated union on
`provider`, four strict object arms (`object` / `api` / `value` / `schema`),
none of them an array.

Both halves of that misdeclaration were user-visible. An author following the
designer panel or the generated `sdui-intrinsics.d.ts` wrote `data: [ …rows… ]`
and got a grid that renders but a document `tsc` rejects (TS2322) and spec
parsing refuses; meanwhile the one form that satisfies both,
`{ provider: 'value', items: [...] }`, was reported as `type-mismatch` by the
save gate, because a declared `array` arm accepts only arrays. Writing the
inline-rows form the README already documents now validates clean, and the
designer labels the key `Data Source` with a description that names all four
providers rather than only the deprecated shortcut's shape.

The renderer is unchanged: a bare array is still honoured as back-compat
(`getDataConfig` folds it to `{ provider: 'value', items }`), it is simply no
longer advertised as authoring surface — the same standing `staticData` has.
Authors who wrote the array shorthand keep working and will now see a
`type-mismatch` hint pointing at the spec-valid spelling.
