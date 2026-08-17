---
'@object-ui/types': minor
'@object-ui/react': minor
'@object-ui/plugin-list': minor
'@object-ui/plugin-view': minor
'@object-ui/app-shell': minor
'@object-ui/components': minor
---

Remove the retired `striped` / `bordered` / `virtualScroll` list-view surface

objectstack#7176 retired `list.striped`, `list.bordered` and `list.virtualScroll`
from the spec after measuring every objectui reader as pass-through: each one
copied the key onward and no renderer ever applied it. objectui stops declaring,
typing and forwarding them.

Off the chain: the `@objectstack/spec` list-view bridge in `@object-ui/react`,
`ListView`'s child-view props in `@object-ui/plugin-list`, both `ObjectView`
relays (`@object-ui/plugin-view` and `@object-ui/app-shell`), the `ObjectGridSchema`
and `NamedListView` declarations in `@object-ui/types` (interface and zod),
`ObjectGrid.component.yml` in `@object-ui/components`, and the page-block
inspector's `striped` / `bordered` toggles in the metadata-admin designer.

Behaviour is unchanged: nothing read these keys, so nothing rendered differently
for them. Stored view metadata that still carries one keeps validating — the keys
are simply no longer relayed. `ListViewSchema` continues to take the spec's
list-view fields by reference, so the protocol's own retirement tombstones
arrive with the next `@objectstack/spec` bump and reject the keys at the
authoring boundary. Restoring any of the three as live surface requires an
implementation card filed first, per the ruling.
