---
'@object-ui/react': patch
---

SpecBridge's form-view bridge stops reading `defaultSort` and `aria`, two keys spec 17
retired on the FormView carrier (`retiredKey()` tombstones — authoring either is a parse
error). Both guards were unreachable for any FormView that passed validation, and both
ends were measured dead before removal: no form renderer reads either off the node
(`plugin-form` reads neither, and `SchemaRenderer`'s ARIA injection resolves flat
`ariaLabel`/`ariaDescribedBy`/`role`, never a nested `aria` object). Behaviour for
spec-valid metadata is unchanged; a host that fed the exported bridge a raw pre-17
document no longer gets these two keys copied onto a node slot nothing consumed. The
LIST view's `aria` pass-through is untouched — that carrier stayed live and is applied by
`ListView`.
