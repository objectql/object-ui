---
"@object-ui/core": minor
---

feat(core): inventory `ActionDef`'s keys and warn on the ones nothing reads — objectstack#4075 step 1

`ActionDef` ends with `[key: string]: any`, so it accepts any key of any type.
Deleting `ActionDef.execute` produced **zero** compile errors even though the
field had just been removed (objectui#2990), and stale metadata still authoring
`execute: 'markDone'` type-checks today. The same deletion against
`@object-ui/types`' `ActionSchema` — which has no index signature — correctly
produced `TS2353` at the authoring site. One of the two readers can catch a
retired key; the other is structurally incapable, which is how a typo (`targt`)
and a tombstoned key both reach a runner that then silently does nothing.

This is the non-breaking first step of the staged narrowing: it makes the key set
**visible** and warns on anything outside it, without changing a single type.

New exports from `@object-ui/core`:

- `ACTION_DEF_KEYS`, `SPEC_ACTION_KEYS`, `NAVIGATION_ALIAS_KEYS`,
  `RETIRED_ACTION_KEYS`, `KNOWN_ACTION_KEYS` — the inventory.
- `classifyActionKeys(action)` — splits an action's own keys into `unknown` and
  `retired`.
- `warnOnUnknownActionKeys(action)` — dev-mode only, warn-once. Called by
  `ActionRunner.execute`, so no consumer wiring is needed.

A retired key gets a louder, more specific warning than an unknown one: an
unknown key is probably a typo, a retired key is metadata that used to work.
`execute` is not simply gone from the spec — it is a live **tombstone**, still
present in `ActionSchema` so the parser can reject it by name with the rename
prescription.

Nothing is rejected and no types changed, so existing metadata behaves exactly as
before. Promoting the legitimate keys to explicit optional fields, then removing
the index signature so `tsc` catches both typos and retired keys, are steps 2 and
3 of objectstack#4075.
