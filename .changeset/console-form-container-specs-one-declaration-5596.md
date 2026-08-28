---
'@object-ui/app-shell': patch
'@object-ui/console': patch
---

The two form CONTAINER contracts now have ONE declaration each, derived from
`@objectstack/spec`, and the console reads them instead of its own copies.

objectui#5542 converged the LEAF of this contract — the field spec — and left the
two containers above it untouched, because converging them was a bigger call than a
mechanical import. `FormSectionSpec` and `FormViewSpec` were each hand-declared
twice under the same names, once in `packages/app-shell`'s `SchemaForm.tsx` and once
in `apps/console`'s `FormPage.tsx`. Unlike the leaf — whose console copy was a clean
subset — these two had **already drifted, in both directions**, so neither copy was a
subset of the other and there were two live answers to "what may an author write":

- `FormSectionSpec` — app-shell declared `description` / `visibleWhen` / `visibleOn`;
  the console declared none of them. The console's `columns` admitted the string arm
  (`'1' | '2' | '3' | '4'`); app-shell's took numbers only.
- `FormViewSpec` — the console declared `label` / `groups` / `sharing` /
  `submitBehavior`; app-shell stopped at `type` plus `sections`.

The drift is decided by asking the **contract**, not by picking a side. `columns`
does admit the string arm (`FormSectionSchema.columns` unions `z.enum(['1','2','3','4'])`
with the four numeric literals, folded to a number by its own transform), so
app-shell's numbers-only declaration was rejecting metadata the platform accepts —
objectui#5040's own symptom, not a deliberate narrowing. `label` on the form view is
the opposite answer: `FormViewSchema` **rejects** it (`unrecognized_keys`, measured
against the installed `@objectstack/spec` 17.0.0), because a form config is titled,
not labelled. The value that read actually finds is the VIEW's identity label, which
arrives on the `ExpandedViewItem` envelope or beside the config on a flattened
runtime overlay — so it is declared on `FormPage.tsx`'s own `FormViewBody`, next to
the body it unwraps, rather than smuggled onto the form contract.

Both types are therefore **derived from the spec's own `FormSection` / `FormView`
with named narrowings** — the repo's sanctioned form for a spec-shaped local type
(`scripts/check-spec-symbol-derivation.mjs`) — rather than restated. Every key the
two layers agree on comes from the spec and cannot fall behind it; the four positions
where this layer is deliberately narrower are each named in an `Omit` list and
restated once next to its reason: `fields` keeps the converged 26-key leaf (deriving
it would silently re-open #5542), and `label` / `description` / `visibleWhen` /
`visibleOn` keep the shapes this repo's renderers and evaluators actually consume
rather than the spec's `I18nLabel` and `ExpressionInput`. `apps/console`'s
`submitBehavior` union — previously hand-written under the comment "Mirrors the spec
FormView.submitBehavior union" — is now read back off the shared type, making the
mirror structural. `@object-ui/app-shell` re-exports both names from its package root
(type-only, erased at build — nothing is added to the bundle), because a type that
cannot be imported is a type that gets retyped.

The pins are what make future drift loud, and each half is pinned on both sides.
`form-spec.containers.test.tsx` and `FormPage.viewSpec.test.ts` compare the
non-narrowed half of each type against the spec's own symbol, so re-hand-writing
either declaration fails `type-check` the day the spec moves rather than years later
when someone reads two files side by side — and the console's pins read both types
back out of the **exported** `buildSections` signature rather than naming them, so a
re-inlined local copy fails even if it agrees on every key on the day it is written.
Their liveness controls are what stop them being phantom checks: the removed copies
are pinned NOT equal to the shared types (proving the `Equal` helper still
discriminates), the renderer's honoured `RenderableSection` is pinned not equal
either (so the authored-document and honoured-row types cannot be collapsed again),
and an undeclared key is still rejected (so the derivation smuggled in no index
signature or `any`). Every narrowing carries a matching negative pin, so "derived"
cannot quietly become "widened to whatever the spec says".

Behaviour is unchanged — the runtime always accepted these keys. The vitest halves
prove it: a section spelling its column count as the string `'3'` lays out identically
to the numeric `3` on both sides, and a section carrying the keys only one side used
to declare builds the same rows.
