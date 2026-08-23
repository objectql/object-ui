---
'@object-ui/react': patch
---

`SchemaRenderer`'s node visibility gate now emits a dev-only warning when a
predicate reads `data.*` and the data-source adapter cannot answer that read, so
an author who wrote `properties: { visible: "data.status == 'draft'" }` sees the
constant they authored instead of shipping it (objectui#5687).

At the node tier `data` is the data-source **adapter** — the object `${data.total}`
in a props bag resolves against — and it has never been the row. A predicate
written with the deprecated `data.*` spelling therefore resolves `undefined ==
'draft'`, which is a perfectly good `false`: the block is hidden on every row, and
because it does not throw, the unresolvable-predicate reporter added for
objectui#5454 never fired. Measured on this base, the same predicate written as a
`{ dialect: 'cel' }` envelope *does* throw and *was* already reported — so whether
an author heard about the identical mistake depended on which dialect they happened
to write it in, which is the arbitrariness objectui#5454 existed to remove.

**No verdict changes and no interpolation changes** (maintainer ruling,
2026-08-22, option A). The node tier keeps its documented `data` = adapter
semantics; objectui#5330's row binding does not extend here. The evaluator's answer
is returned exactly as computed and `${data.*}` interpolation is untouched — only
the silence moved.

The report fires on a `data.*` read the bound adapter answers with `undefined`, not
on the spelling. A genuine adapter read stays silent (`data.total > 0` against an
adapter carrying `total`), a canonical `record.*` predicate stays silent, and a
correctly-hiding gate stays silent. Dev builds only, `console.warn`, deduped per
node type + key + predicate source — the same module, Set and lifecycle as the
objectui#5454 reporter.

This loudness is temporary by design: it dissolves when objectui#5330's deprecation
window for the `data.*` row spelling closes.
