---
'@object-ui/app-shell': patch
---

The last two hand-rolled empty states under `metadata-admin/previews/` take the
shared `EmptyDescription` (objectui#8570), finishing what PR #8569 started.

Both were filed as inline markers "standing in for an absent scalar". Their
predicates and their non-empty arms say otherwise — `Object.keys(value).length`
opening a `<dl>`, and `fields.length` opening a chip row — so both are
empty-COLLECTION statements whose *layout* was inline, never their semantics.
That is the family `EmptyDescription` already carries at twelve sites in this
directory, one of them 66 lines above the first of these in the same file.

- `DatasourcePreview` side rail ("Pool" / "SSL", unconfigured): now
  `<EmptyDescription className="text-[11px] italic">`. The size is this block's
  own, not the `text-xs` used by the "No config keys set." site above it: the
  rail body renders at 11px and the shared base ships `text-sm/relaxed`, so
  omitting a size would have grown the word 11px → 14px and dropped the italic.
  Measured in Chromium; with the size passed, type metrics and block height are
  unchanged. The box itself becomes block-level (full width instead of
  shrink-to-fit), matching the `<dl>` it alternates with.
- `ValidationPreview` cross-field ("Fields involved", no fields): now
  `<EmptyDescription className="text-xs italic">`. A flex container blockifies
  its children, so the `<span>` this replaces already computed to
  `display: block`; measured against real Tailwind output in Chromium, the
  container and marker boxes are byte-identical either way.

`EmptyValue` is deliberately untouched — its docblock scopes it to a missing
cell/field value and its accessible name says "No value", which is false about
a collection. The wording of both sentences is preserved.
