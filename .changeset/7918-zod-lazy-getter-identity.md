---
'@object-ui/types': patch
---

Two of the ten `z.lazy` exports in the zod node face now memoise their getter, so their
public `.unwrap()` compares by identity (objectui#7918). The other eight are **deliberately
unchanged** — measured, memoising them is a module-load `ReferenceError`.

The card that found this did not claim the ten were wrong. It asked whether the spelling was
buying a temporal-dead-zone dodge, and that check is what shipped. Each of the ten was
rewritten in place to `const inner = <body>; z.lazy(() => inner)`, the package rebuilt, and
the built barrel imported in a fresh process. **Eight refuse to load.** Seven name the very
const being declared (`children: z.array(TreeNodeSchema)` sits inside `TreeNodeSchema`'s own
initialiser); `SchemaNodeSchema` names `BaseSchemaCore`, which `base.zod.ts` declares below
it. For those eight the `z.lazy` is load-bearing, so `ActionSchema`, `AppMenuItemSchema`,
`FilterGroupSchema`, `MenuItemSchema`, `NavLinkSchema`, `NavigationMenuItemSchema`,
`SchemaNodeSchema` and `TreeNodeSchema` keep the spelling they have. The two that loaded
clean are memoised: `FilterBuilderConditionSchema` is not recursive at all, and
`NavigationItemSchema` already defers its self-reference through an inner
`z.lazy(() => NavigationItemSchema)` on `children`.

⚠️ Two corrections to the finding, both measured, both worth more than the edit:

**The recursion point was already identity-comparable, through the right handle.**
`zod@4.4.3` caches a lazy's resolved inner type on `def._cachedInner` — its own comment says
this preserves "identity for cycle detection on recursive schemas" — and `S._zod.innerType`
reads that cache. It is stable for all ten, including the eight, and survives `.describe()`
clones. What is *not* stable is `S.unwrap()`, because `ZodLazy` defines it as
`() => inst._zod.def.getter()`, going around the cache (`ZodPromise` spells its own as a
stored field). So a schema walker can recognise the recursion point today by reading
`_zod.innerType`; the objectui#7581 false negative — `ActionSchema` reported "not exported by
name" when it plainly is — was the wrong handle, not an unrecognisable schema. Memoising is
still worth doing where it is free, because it makes the public `.unwrap()` honest.

**The "rebuilt on every parse" cost does not exist.** The finding recorded, explicitly
unmeasured, that a document with N nodes reconstructs the recursive sub-schema N times. It
does not: the getter runs **once per lazy for the life of the process**, via the same
`_cachedInner` — measured at one call during the first parse of a 13-node document and zero
during the second. Wall clock agrees. `NavigationItemSchema` over a 73-node document,
memoised versus not, medians of nine trials of 200 parses: 149,973 ns versus 140,293 ns per
parse — ratio 0.94x, with the ranges overlapping. Those are shared-box seconds, so the
absolutes are not idle-machine figures; the ratio is the reading, and the reading is "no
difference". There is no parse-time win here, and anyone pricing the strict face
(objectui#7935 / objectstack#5250) should strike this from the input list.

No accept/reject behaviour moves — a memoised getter changes schema *identity*, not what is
declared or admitted. The measurement, the eight `ReferenceError` messages, the identity
matrix and an executable reproduction of both the TDZ mechanism and the once-per-process
getter are pinned in `packages/types/src/__tests__/zod-lazy-getter-identity-7918.test.ts`.

⚠️ Also settled while locating the ten: `AppMenuItemSchema` has no declaration of its own —
it is the barrel alias of `app.zod.ts`'s `MenuItemSchema`, while the barrel's own
`MenuItemSchema` is `overlay.zod.ts`'s. Two different schemas, so the list really is ten
entries and not nine.
