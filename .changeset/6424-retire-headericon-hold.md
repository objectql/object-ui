---
---

Internal type cleanup in `plugin-grid`: `ObjectGridColumnHolds` no longer declares
`headerIcon`, which `TableColumn` has declared since objectui#6615, plus the docblock
corrections and pins that go with it. Nothing published moves — `ObjectGridColumnHolds`
is not part of the package entry's exported surface (measured: 0 occurrences in
`dist/index.d.ts`, control `ObjectGridColumnState` 1), and the two emit types are
byte-identical without the member (27 resolved members before and after, against a
positive control that removing `pinned` instead takes them to 26). No published
behaviour changes.
