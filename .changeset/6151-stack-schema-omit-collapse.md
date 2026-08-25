---
'@object-ui/types': minor
---

`StackSchema` now SHIPS the members it declares (objectui#6151). Its emitted declaration
carried one property — `type` — where it was meant to carry twenty-five.

The interface was written `extends Omit<FlexSchema, 'type'>`: "everything `FlexSchema` has,
with a different `type`". That spelling erases every named member. `Omit` of a type over a
key set is `Pick` over `Exclude` of `keyof` that type, and `keyof` a type carrying a string
index signature is `string | number` — the literal member names are absorbed. `FlexSchema`
inherits `BaseSchema`'s `[key: string]: any` (objectui#5155), so excluding `'type'` from
`string | number` still leaves `string | number`, and the `Pick` rebuilt a type holding the
index signature and none of the named members. Measured against the built `dist`:
`FlexSchema` declared 25 properties, `StackSchema` declared 1.

Nothing errored, which is why it survived four releases: the index signature keeps every
absent key assignable and readable as `any`. The cost fell entirely on the tools that READ
the declaration. Editor completion on a `stack` node offered `type` and nothing else — no
`gap`, no `align`, no `justify`, no `children`. And a docs-versus-type sweep read
`stack.mdx` as documenting keys that do not exist: objectui#6143 flagged `gap`, `children`
and `className` there as divergences when the docs were right and the type was wrong.

Fixed at the mechanism rather than by restating the members. The six flex/stack members now
live in a new exported interface, `FlexLayoutProps`, which does NOT inherit `BaseSchema`,
and `FlexSchema` and `StackSchema` each extend `BaseSchema` and `FlexLayoutProps`. No
`Omit` crosses the index signature any more, and the members are declared once rather than
duplicated. Extending `FlexSchema` directly was measured unavailable: an interface may
narrow an inherited property only to a subtype, and `'stack'` is not a subtype of
`FlexSchema`'s `type: 'flex'` (TS2430).

`FlexSchema` is unchanged — its six member declarations moved byte-identically, and its
emitted member set is the same 25 names before and after. The only declaration whose shape
changes is `StackSchema`, which goes from 1 property to the same 25.

**The one way this can newly error**, and why it ships as `minor`: keys on a `stack` node
were previously answered by the index signature as `any`, so `gap: 'large'` type-checked.
`gap` is now `number | undefined` and that line is a `tsc` error. Every value this newly
rejects is one the renderer never honoured — `stack.tsx` feeds `gap` to a Tailwind numeric
scale — so the change reports a defect that was already there rather than removing a
capability. All three in-repo packages that name `StackSchema` or `FlexSchema`
(`@object-ui/components`, `@object-ui/core`, the schema-catalog example) type-check green
unchanged.

Guarded by `packages/types/src/__tests__/stack-schema-emitted-members.test.ts`, which
asserts against the EMITTED declaration rather than the source. That distinction is the
whole point: a source-level assertion passes on the broken code, because the index
signature answers for the missing key with `any`. The guard emits declarations with the
package's own tsconfig and asserts (1) `StackSchema` declares exactly what `FlexSchema`
declares, and (2) no member of the `LayoutSchema` union has lost any of `BaseSchema`'s
named members — so the next heritage clause that collapses under the index signature reds
for the whole class, not just for this one interface.
