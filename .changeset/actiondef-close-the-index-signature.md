---
"@object-ui/core": minor
---

Close `ActionDef` — delete the `[key: string]: any` index signature and converge `visible` / `disabled` on the spec's unified shape.

`ActionDef` accepted any key of any type, so a typo (`targt`) and a retired spec
key (`execute`) both type-checked and the runner then silently bound no handler
— the objectstack#2169 "Mark Done does nothing" shape. Step 1
(objectstack#4075) made that audible with a dev-mode warning; step 2 promoted
the 18 spec-owned keys to real fields. This is **step 3**, executing the
maintainer's 2026-08-06 ruling now that its upstream half shipped in
`@objectstack/spec` 17.0.0-rc.6 (objectstack#5970).

- **`visible` and `disabled` now have ONE shape, derived from the spec** —
  `boolean | string(CEL) | { dialect, source }`. The ruling was "统一形状,spec
  采纳": boolean is the degenerate literal verdict, the string is CEL shorthand,
  the envelope is the full form. `visible` loses its hand-written `| boolean`
  (the spec adopted that arm, so restating it locally would be a second
  contract), and `disabled` gains the envelope arm it never had — it was
  `string | boolean`, which is why the envelope the spec emits could only be
  read through a cast.
- **The index signature is gone.** `tsc` now rejects an unknown or retired key
  at any site that authors an action literal in code.
- **Five keys the deletion surfaced, promoted to real fields.** `to`,
  `external`, `newTab`, `replace` — the `navigation` alias's own spelling, ruled
  legitimate by step 1 and listed in `NAVIGATION_ALIAS_KEYS` ever since, but
  declared only as data; and `description`, which every action renderer forwards
  (`check:action-forward-parity` requires it) and the param-collection dialog
  reads for its subtitle (objectui#4192). These were the only two `TS2353`s the
  deletion produced across the whole workspace.
- **`ActionContext` keeps its index signature**, deliberately. It is a runtime
  data bag whose keys are genuinely open; `ActionDef` is a declared metadata
  contract. That asymmetry is the point, and it is now pinned in both
  directions.

**Breaking edge, deliberate — same class as step 2's, one step further.** An
`ActionDef` literal carrying a key this interface does not declare is now a
compile error where it previously compiled and did nothing at runtime. That
includes the retired `execute` (rename it to `target`; `os migrate meta --from
16` rewrites it) and plain typos. Values that were only ever absorbed silently
are the ones that stop compiling, so the failure moves to where it can be fixed
rather than appearing as a button that does nothing.

**What did NOT retire with the index signature**, contrary to step 1's
expectation: the dev-mode `warnOnUnknownActionKeys` shim and `executeScript`'s
`execute` rename prescription both stay. `tsc` only ever sees actions authored
as TypeScript, while stored `sys_metadata` rows are rehydrated UNPARSED
(objectstack#3903) — which is the population `execute: 'markDone'` actually
lives in. The two mechanisms cover disjoint populations; retiring the runtime
half would have re-opened the gap it was written for.
