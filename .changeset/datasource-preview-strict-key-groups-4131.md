---
'@object-ui/app-shell': patch
---

`DatasourcePreview` no longer renders three key groups `DatasourceSchema` rejects
(objectui#4131). `retryPolicy`, `healthCheck` and `capabilities` were removed from the
datasource document by objectstack#4583 under ADR-0049 enforce-or-remove — connection
retry and health probing belong to the runtime driver, and pushdown is decided by that
driver's own `supports.*`, never by datasource metadata. The schema is `.strict()`, so it
refuses all three by name, while the preview kept painting a `Retry Policy` SideBlock, a
`Health Check` SideBlock and a `Capabilities` chip strip for them. An author who typed any
of the three saw the designer confirm a draft that cannot be saved — the preview was the
only surface acknowledging the keys at all, so it was also the strongest signal they
worked. `pool` and `ssl` are still declared and still render.

This is the third wave of the same defect on this one file (objectui#3275 deleted
`d.type` / `isDefault` / the `Array.isArray(capabilities)` branch; objectui#3143 deleted
the read-replica pill), and the removals had been in `main` eight days before anyone
noticed — nothing compared the two halves of the contract. They are now compared
mechanically: `DatasourcePreview.spec-keys.test.ts` derives the keys the preview reads off
the draft from the component's own AST, derives the keys the schema accepts from the
schema object's `.keyof()`, and fails on any read the schema would reject. Neither side is
written down as a list, so a key added or removed in `@objectstack/spec` moves the pin on
the next dependency bump instead of leaving it stale.
