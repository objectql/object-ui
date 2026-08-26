---
---

Internal type hygiene in `ObjectGrid`'s column resolver: the authored `prefix`
column key is now read directly instead of through `(col as any)`, since
`ListColumn` declares it. No published behaviour changes — the cast erased at
runtime, so the same property was read before and after; what changes is that
`ColumnPrefix`'s typing now reaches the prefix cell renderer, and a new pin
(`columnReadBoundary-6458.test.ts`) refuses any future cast read of a key the
spec's `ListColumnSchema` declares.
