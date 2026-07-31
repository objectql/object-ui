---
'@object-ui/types': minor
'@object-ui/core': patch
'@object-ui/components': patch
---

**Authoring types are input types (framework#4074 steps 2–3): `ActionParam` takes the spec's declaration forms, `ListViewSchema` stops promising parse-output defaults, and `FormField.dependsOn` matches its runtime reader.**

Three public types said something different from what the platform accepts. All
three divergences were found by making `packages/types`' tests compile (#3009)
and then resolving the declared `p1-spec-alignment.test.ts` debt site-by-site
instead of papering over it.

**`ActionParam` is now the authoring shape, aligned with the spec's input.**
`name` / `label` / `type` become optional and `field` / `objectOverride` appear:
the spec's primary way to declare a param — a bare field reference that inherits
label/type/validation/options from an object field — was unrepresentable while
all three were required. The *resolved* shape the dialog consumes (after
app-shell's `resolveActionParams()` inlines the reference) remains
`@object-ui/core`'s `ActionParamDef`, with all three required. Authoring and
resolved are different types on purpose. `label` and option labels take the
spec's `I18nLabel` by import — which the new compile-time guard promptly
revealed to be aliased to plain `string` in the current spec (the per-locale
record is the separate `I18nObject`), so this is not a behavioural widening
today; importing the alias means objectui tracks any future widening
automatically.

**Breaking:** code destructuring `param.name` / `param.label` / `param.type` as
guaranteed must now handle the field-backed form (or consume the resolved
`ActionParamDef` instead, which is what dialog-side code should be doing).

**`ListViewInferred` is `z.input`, not `z.infer`.** The spec sub-schemas that
flow into the list-view surface (`userActions`, `tabs` → `ViewTab`, `sharing`)
carry `.default()`s, so the inferred output type made fields like
`userActions.refresh` or a tab's `pinned`/`visible` *required* — but nothing on
the render path ever runs `.parse()`: `normalizeListViewSchema` deliberately
applies no defaults ("an absent flag stays absent", its own suite). The output
type therefore rejected valid authored metadata (`userActions: { sort: true }`)
while promising renderers defaults that never arrive. Typing the surface as
input matches both the author and the runtime object. Code that *trusted* those
phantom defaults now gets an optionality error — which is a latent bug surfacing,
not a regression: the value really could be absent.

**`FormField.dependsOn` is `DependsOnInput`.** The runtime reader
(`resolveCascadingOptions`) has always accepted a bare name, a list of names, or
lookup-parameter entries `{ field, param }` — its parameter type says so. The
public property said `string`, so array-authored metadata type-errored while
working, and the form renderer read the key through `(f as any).dependsOn` to
get past its own type. The shape now lives in `@object-ui/types` (single source
of truth next to `FormField`), `@object-ui/core` imports and re-exports it, and
the two `as any` reads in the components form renderer are typed.

**The `p1-spec-alignment.test.ts` exclusion is gone.** Its 14 errors resolved:
the two "sharing in ObjectUI format" tests and the legacy-ARIA-spelling fixture
are deleted/rewritten — those dialects are *normalizer input*, folded by
`normalizeListViewSchema` and asserted branch-by-branch in core's
`normalize-list-view.test.ts`, the seam where the fold actually runs; asserting
them on the canonical type only ever "passed" because nothing compiled the file.
One fixture claimed a shape no surface ever admitted (an ObjectQL triplet as a
spec `ViewTab.filter`) and was corrected to the rule-object form. Every test
file in `@object-ui/types` is now compiled, with no exclusions.

Discrimination-checked: reverting `ListViewInferred` to `z.infer`, `dependsOn`
to `string`, or `ActionParam.name` to required each produces the expected
compile error in the now-compiled test files (`TS2739` / `TS2322` / `TS2741`);
restored, all projects are clean.
