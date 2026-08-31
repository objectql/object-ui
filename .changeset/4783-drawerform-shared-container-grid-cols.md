---
---

Internal only, no release: `DrawerForm.tsx` now imports `CONTAINER_GRID_COLS` from
`./autoLayout` instead of keeping its own private copy of the table
(objectui#4783 observation 二). `ModalForm.tsx` already consumed the shared
export from the same import block, so this makes the two siblings agree on where
the container-query grid classes come from.

The copy was verified byte-identical before deleting it, not assumed to be —
the finding was filed on 2026-08-16 and a drifted copy deleted as "cleanup"
would ship a silent behaviour change. Both declarations were extracted
mechanically and compared: with the leading `export ` keyword stripped, the two
six-line blocks hash to the same SHA-256
(`e41f57cf2cd6ce0966a1fcbf27c78c56ca1abc4236015bc12b3189146837ecbf`), so all four
column entries — including the `1: undefined` row that makes callers fall back to
the single-column stack — are unchanged for every reader. Both drawer call sites
index the table exactly as before; only the binding's origin moved.

No user-visible change, hence empty frontmatter: same class strings, same
lookups, same rendered markup.
