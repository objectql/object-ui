---
'@object-ui/components': minor
---

feat(data-table): pass `pendingRow` to the host cell editor — the row with its staged edits merged over it (#7188)

`data-table` already computed each row's `pendingChanges` entry in the row loop that
renders the editor; it now hands the injected editor that row merged with those staged
values as `pendingRow`, next to the persisted `row`. Nothing about `row`, `value`,
`stage`, `commit` or `cancel` changed. A host editor that scopes itself by a sibling
field can read `pendingRow` and follow an edit the user has made but not yet saved.
