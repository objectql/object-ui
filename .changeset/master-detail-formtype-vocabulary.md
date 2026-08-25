---
"@object-ui/plugin-form": patch
---

`object-master-detail-form` declares `formType` as a closed vocabulary instead of a bare `string`.

The block declared `formType` as `type: 'string'` while the sibling `object-form` declared the
same key as an `enum`, and both funnel into the renderer that switches on those variant names. A
value outside the vocabulary therefore matched no branch and fell through to the flat field list
with no diagnostic — measured, a `formType` of `'wizzard'` renders the parent half with its
authored sections silently gone.

The declared set is `simple | tabbed`, measured against the master-detail composition rather than
copied from the sibling's six: `drawer` and `modal` host the parent half in a portal dialog outside
the master-detail container, so its single bottom Save bar has no form to submit; `wizard` mounts
only the current step's fields and turns that Save bar into a `Next`; `split` renders inline but
persists through `dataSource.create` instead of the atomic batch.

Authoring-surface only. The manifest, the JSX-page compiler and the save gate now report an
out-of-vocabulary value as `invalid-enum`; rejection at publish time remains `@objectstack/spec`'s.
