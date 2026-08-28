---
---

Tests only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared. No package `src/` is touched; the only file changed is
`examples/console-starter/test/vite-alias-closure.test.ts`, and that example is private.

Makes the alias-closure walker record an unresolvable **relative** import instead of
dropping it.

`computeClosure()` walks two kinds of specifier. The bare-specifier branch pushed a miss
onto `unresolvable`; the relative branch dropped one with no record at all. So
`expect(closure.unresolvable).toEqual([])` was not a weak assertion for relative imports
— it was a structurally empty one. It could not fail no matter how many relative
specifiers the walk failed to follow, and the `filesWalked` floor was the only signal
that anything had gone wrong.

That is how two earlier conversions to explicit extensions (objectui#4538, objectui#5214)
each truncated this walk while landing green: the floor had enough slack to absorb both,
and only went red once app-shell — the largest package — converted and took the count
under 500. The direct symptom was being swallowed one branch away the whole time.

Measured on `main` at the time of this change, with the resolver ablated to its
pre-objectui#5357 behaviour to reproduce that regression class: 275 relative specifiers
dropped, `filesWalked` 1245 to 402, packages reached 29 to 22 — and `unresolvable` still
reporting `[]`. With this change the same ablation fails the suite with all 275 named,
each alongside the file that imports it.

The miss is recorded only for specifiers that are *meant* to be modules — no extension,
or one of the JS/TS emitted extensions. `ts.preProcessFile` also reports `./styles.css`,
`./data.json` and `./logo.svg`, which `resolveModule` cannot resolve by design, so
recording those identically would fail the suite for a reason that is not a defect.
Assets and Vite resource specifiers (`?raw`, `?url`, `?inline`) are skipped into a
separate `nonModuleSkipped` list — explicitly, and observably, rather than by accident.

Four fixtures pin the class against the real walker so a future edit cannot silently
re-blind the branch: `./Foo.js` resolving through to the `Foo.tsx` on disk, planted
unresolvable modules of both spellings being named, assets staying out of `unresolvable`
while still being accounted for, and the classifier's boundary cases.
