---
---

Post-merge correctives to objectui#7210's non-grid row ceiling (objectui#7507),
all of them inside a change that has not been released yet — so nothing here is
a user-visible fix, and the ceiling's own changeset carries the release note.

- `.changeset/7210-non-grid-row-ceiling.md`: the four view packages move from
  `patch` to `minor` (they carry the behaviour break), the example footnote is
  replaced with the copy that actually renders — no thousands separators, since
  the i18next config declares no `format` and the provider-less path
  interpolates through `String(v)` — and the export list names
  `NonGridCeilingResult`.
- `ObjectCalendar`'s external-`data` sync now also clears `rowCeiling`, so a
  footnote raised by this component's own truncated fetch cannot outlive the
  rows it described. Latent today: the only host that passes `data` passes it
  from mount. Pinned in `ObjectCalendar.externalDataCeiling-7507.test.tsx`.
- The map and calendar ceiling pins now assert the row count handed to the
  view, not only `$top` and the footnote; the four pins' reverse-verification
  docblocks are rewritten to the mechanism that was measured rather than the
  one that was predicted.
- Comment-only: the false "the only package all four already depend on"
  rationale on `@object-ui/react`'s entry, and the stale "~1 KB of headroom"
  note in the ten locale packs.
