---
"@object-ui/core": minor
"@object-ui/types": minor
"@object-ui/plugin-list": minor
"@object-ui/react": minor
---

refactor(views): ListView's `aria` and `sharing` are the spec sub-shapes (#2890 scope A step 5)

Last rename batch in the ListView vocabulary migration.

**`aria`** is now the spec's `AriaPropsSchema`: `label` → `ariaLabel`,
`describedBy` → `ariaDescribedBy`, folded at the ListView boundary like every
other legacy key. Two things fall out of adopting the spec shape:

- `role` becomes authorable. The list region hardcoded `role="region"`; it now
  reads `aria.role` and falls back to `region`.
- `aria.live` stays as a documented local extension — it has no spec
  counterpart, and dropping it would silently disable a shipped capability.
  Promote it rather than growing that extension.

**`sharing`** is now the spec's `ViewSharingSchema` (`{ type, lockedBy }`),
imported by reference — the local four-key object is gone. The legacy pair folds
in: `visibility` collapses onto the two ownership kinds the spec models (only
`private` is `personal`; `team` / `organization` / `public` are all
`collaborative`), and a bare `enabled: true` maps to `personal`, which is the
badge the user already saw (the old title fell back to `'private'`).

*Visible change*: the share badge's tooltip shows the spec ownership type, so a
view authored with `visibility: 'team'` reads "Sharing: collaborative" instead
of "Sharing: team". The four-value audience has no spec home and nothing but
that tooltip consumed it; keeping a second audience enum alive would re-open the
fork this issue closes.

Also fixes the **spec bridge**, which was doing the opposite of its job: given a
spec-shaped `sharing`, `transformListView` *downgraded* it — inventing a legacy
`visibility` audience and an `enabled` flag that the renderer then had to fold
back. Both sides speak `ViewSharing` now, so it passes through.

`conditionalFormatting` and `exportOptions` are deliberately **not** folded.
Both objectui shapes are supersets carrying capability the spec cannot express —
the `{ field, operator, value }` rule form, and `maxRecords` / `includeHeaders`
/ `fileNamePrefix`. Folding them onto the narrower spec shapes would delete
working features; they want promotion upstream, not a rename.
