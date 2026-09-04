---
---

Console documentation only (`apps/console/docs/**`) — nothing published moves, so no version bump.

`UI_IMPROVEMENT_PROPOSAL.md` section 3.1 taught `<ResizablePanelGroup direction="horizontal">`.
The exported component takes `orientation`, not `direction`
(`packages/components/src/ui/resizable.tsx:44`, pinned by
`packages/components/src/__tests__/resizable-orientation.test.tsx` and used in-tree at
`packages/components/src/custom/navigation-overlay.tsx:519`), so a reader who copied the guide's
first prop got a type error. The prop is corrected in place.

The other ten red `ts` / `tsx` blocks across that tree are excerpt fragments rather than defects,
and each now carries `check-doc-snippet-types.mjs`'s per-block fragment declaration with a written
reason naming the identifiers the excerpt leaves to its host. No `UNGATED_DOCS` entry was added:
the 2026-09-02 ruling on objectui#6600 rejects whole-file exemptions, and this card is that
ruling's step 1 — content first, then the gate roots move (objectui#6600 step 2).

Why the empty frontmatter rather than a bump: `apps/console/docs/**` is not in `@object-ui/console`'s
`files` (`dist`, `plugin.ts`, `plugin.js`, `plugin.d.ts`, `README.md`), so no published artifact
changes. `scripts/check-changeset-presence.mjs` agrees — it reports no changeset owed for this
range. Note for the record that `@object-ui/console` is **not** `private: true`: it is a published
member of the 40-package `fixed` group at 17.6.0, so the "no release" declaration rests on the
unshipped path, not on privacy.
