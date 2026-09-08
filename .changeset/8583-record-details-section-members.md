---
'@object-ui/types': patch
---

`RecordDetailsComponentProps.sections[]` declares the six member keys
`@objectstack/spec` 17.3.0 `RecordDetailsProps.sections[]` declares and this
type omitted: `columns`, `icon`, `description`, `showBorder`, `defaultCollapsed`
and `headerColor` (objectui#8583, item 1).

Every one of the six was already honoured at runtime — `RecordDetailsRenderer`
spreads each authored section through to `DetailSection`, which reads all six —
and accepted by the contract, so the published TypeScript face was the only
layer that said no: a spec-valid section such as `{ group: 'terms', columns: 2 }`
was refused by `tsc` (`TS2353`) while rendering correctly. The six now carry the
spec's own authoring types (`columns` a number, `headerColor` the closed
six-token vocabulary), all optional, exactly as the spec declares them.

Additive only: no existing member moves, no value that type-checked before
stops type-checking. The remaining item on that card — the member this type
declares that the spec refuses — is a separate decision and is untouched here.
