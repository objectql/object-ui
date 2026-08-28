---
'@object-ui/app-shell': patch
'@object-ui/console': patch
---

The form-field authoring contract now has ONE declaration, and the console reads it
instead of its own copy.

objectui#5040 was not a missing key. It was that **two hand-written descriptions of
one contract drifted**, and nothing could notice, because each was only ever checked
against itself. PR #5537 converged the two app-shell descriptions into
`views/metadata-admin/form-spec.ts`. A **third** survived in `apps/console`:
`FormPage.tsx` declared its own nine-key `interface FormFieldSpec`, under the same
name, in a different package — so the same failure mode stayed fully available.

Measured key by key before choosing a route, because the two honest outcomes are
"same contract, import it" and "genuinely narrower layer, rename it and pin the
subset". The console's copy was a strict subset — 9 of the shared type's 26 keys,
every one identical in type, none console-only — and it sat in a position that
describes an **authored document**: `FormSectionSpec.fields`, read straight off the
`/meta/view/:name` payload, the same spec `FormView` metadata-admin renders (both
files even spell the same six-member `type` union and call the element type
`FormFieldSpec`). The narrow, renderer-honoured shape is a different type that
already exists in that file, `RenderableField`. So this was one contract described
twice, and the console's description was wrong about the document: legal metadata —
`visibleWhen`, `dependsOn`, `type`, `options`, `immutable`, the recursive `fields`,
and ten more keys — was undeclared there. That is #5040's own symptom, "the type
rejects the configuration the runtime accepts", which no runtime test can see.

`@object-ui/app-shell` therefore re-exports `FormFieldSpec` from its package root
(type-only, erased at build — nothing is added to the bundle), and `FormPage.tsx`
imports it and deletes the local declaration. Reachability is the load-bearing half:
a type that cannot be imported is a type that gets retyped, and retyped copies drift.
`form-spec.ts` itself is untouched.

`FormPage.fieldSpec.test.ts` is the pin that makes future drift loud. It reads the
field-spec type back out of the **exported** `buildSections` signature rather than
naming it, so re-inlining a local `interface FormFieldSpec` fails `type-check` even
if the copy agrees on every key on the day it is written — which is exactly what did
not happen to the copy this change removes. Its liveness controls are what stop it
being a phantom check: the removed nine-key shape is pinned NOT equal to the shared
type (so the `Equal` helper is proven to still discriminate), `RenderableField` is
pinned not equal to it either (so the honoured-row and authored-document types cannot
be collapsed again), and an undeclared key is still rejected (so the import did not
smuggle in an index signature). Behaviour is unchanged: the runtime always accepted
these keys, and the vitest half proves the same rows are built.
