---
'@object-ui/types': minor
---

`ViewNavigationConfig` IS the spec's navigation config — the second spelling stops requiring `mode` (objectui#4588)

`@object-ui/types` published **two** types for one spec object, and they disagreed
about whether `mode` may be omitted. `index.ts` re-exports the spec's
`NavigationConfig` unchanged, while `objectql.ts` hand-declared a
`ViewNavigationConfig` covering the same six keys with `mode` **required** — under
a doc comment that itself claimed `@default 'page'`.

The spec never asked for that. `@objectstack/spec` declares
`mode: NavigationModeSchema.default('page')` in `NavigationConfigSchema`, and a
`.default()` lands on the **authoring** side as `| undefined`, which is why the
spec publishes its own type as the schema's `z.input`. So
`navigation: { view: 'summary_view' }` is legal authored metadata that lets the
mode default — and the hand copy refused it, at the three schema interfaces that
spell `navigation?: ViewNavigationConfig` (`ObjectGridSchema`, `ObjectViewSchema`,
`NamedListView`). Authoring one meant inventing a `mode` the renderer was going to
default anyway, or writing an assertion.

`ViewNavigationConfig` is now that spec type, per this file's own standing rule —
"Never Redefine Types. ALWAYS import them." Measured against the published spec
build, the hand copy had drifted on `mode` and nothing else: the other five keys
carried the spec's exact value domains. The per-key documentation now lives with
the schema in the spec instead of being restated here, so the `'page'` default no
longer has a third place to fall out of sync.

**No runtime behaviour changes.** A census of every `.mode` read in the repo found
all of them to be `=== 'x'` comparisons or `navigation?.mode ?? 'page'` — no reader
of this alias reads `mode` unguarded, so nothing observes the difference at run
time. This is objectui#4550 / PR objectui#4586 one package over: that one collapsed
`@object-ui/react`'s `NavigationConfig` to the same spec input, and this is the
remaining half.

Graded `minor` on the published-position analysis: in the built `.d.ts`
`ViewNavigationConfig` occurs **only in input positions** — the three `navigation?:`
properties of authored schema interfaces — and in **no** return type, since this
package publishes no function that hands one back. For consumers the change is
therefore purely permissive: everything that compiled still compiles, and
spec-shaped configs that previously needed an invented `mode` now compile without
one. That gained input shape is a capability rather than an internal repair, which
is more than `patch` describes. The reader-side narrowing (`mode` is now
`| undefined`) is real but secondary, and in-repo it has no affected reader.
