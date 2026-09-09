---
---

Test-only change. Thirteen `RecordDetailView` test files stubbed
`useRecordPresence` as `{ viewers: [], others: [] }`, while the real hook
returns `PresenceUser[]` and its only consumer reads `recordPresence.length > 0`.
An object has no `length`, so the presence row was structurally unrenderable in
those files: they exercised the no-presence branch through a shape mismatch
rather than through the empty array the branch is about, and no value of the
object stub could ever have made the row appear. All thirteen now stub `[]`,
matching the nine files that already did. No published package changes — the
edits are confined to `*.test.tsx` files, which no package's `files[]` ships.
