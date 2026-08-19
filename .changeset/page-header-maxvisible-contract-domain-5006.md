---
'@object-ui/components': patch
'@object-ui/types': patch
---

`page:header`'s `maxVisible` / `mobileMaxVisible` now honour the contract's value domain instead of a laxer renderer tolerance.

Three authorities gave two answers for the same value (objectui#5006). Measured on
`ComponentPropsMap['page:header']` at `@objectstack/spec@17.0.0` — the member lives
on the `@objectstack/spec/ui` subpath, not the package root — both keys are a
POSITIVE SAFE INTEGER (`{format:'safeint'}` plus
`{check:'greater_than',value:0,inclusive:false}`). Spec rejects `0`, `-1`, `1.5`
and anything past `Number.MAX_SAFE_INTEGER`. objectui's manifest gate and
`sdui-parser`'s `checkType` said nothing about any of them, and the renderer's
`readMax` was looser still: it accepted `0` and floored fractions. So the loosest
of the three layers decided what shipped on screen, while `os validate` / `os build`
rejected the very same metadata outright.

`readMax` now accepts only what the contract accepts. `Number.isSafeInteger(v) && v > 0`
is the exact translation of `safeint`, not an approximation — plain `Number.isInteger`
would admit `2**53 + 2` and `1e21`, which spec rejects.

Behaviour change, stated because this NARROWS the renderer's accept set rather than
only fixing a fault: a contract-rejected value no longer takes effect and falls back
to the documented default (3 desktop / 1 mobile). Concretely, `maxVisible: 0` used to
render zero inline buttons and sweep every action into the overflow menu, and
`maxVisible: 1.5` used to be floored to `1`; both now render the default 3-inline
split. This is a narrowing *toward* an already-published contract — no in-tree
producer writes a rejected value, so nothing in the repo changes behaviour. Both
schema-level and `properties.*` spellings go through the one reader. `action:bar`'s
`maxVisible` is an unrelated reader with no `ComponentPropsMap` entry and is
deliberately untouched.

`ComponentInput.type`'s doc comment now records the trade the ruling fixed in place
(maintainer, 2026-08-17): the coarse `number` arm plus `description` is the
publication face's expression ceiling today, and spec is the sole judge of values.
Giving `ComponentInput` real constraint slots, and binding `checkType` to spec, were
both deferred with a named reopen condition — a measured case of an author shipping
a spec-rejected value that objectui's silence let through.
