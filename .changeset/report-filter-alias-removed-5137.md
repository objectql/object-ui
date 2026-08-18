---
'@object-ui/plugin-report': minor
---

`DatasetReportRenderer` no longer reads `filter` as an alias for `runtimeFilter`.

`filter` is not an authorable key. `ReportSchema` in `@objectstack/spec` (17.0.0)
is `z.core.$strict` and rejects it outright, going out of its way to name the
replacement: ``Unrecognized key(s) on this report: `filter`. Did you mean
`filter` → `runtimeFilter`?`` The renderer accepted the rejected spelling anyway,
at two sites — the report-level `report.runtimeFilter ?? report.filter` and the
per-joined-block `block.runtimeFilter ?? block.filter`. Metadata that could not
be authored through the validated path still rendered when it arrived by some
other route, so the strictness the spec promises was not the strictness the
runtime enforced. It matters most for AI-authored metadata: a generator emitting
`filter` got a working report from this renderer and a hard validation failure
from anything that parsed the document first, and which one the author met was a
function of which path the document travelled.

**Behaviour change — read this if you store report documents.** A stored document
still carrying `filter` no longer has that filter applied: it renders
**unfiltered**, showing rows the report was scoped to exclude. Server-side
permissions are unaffected and still apply, so this is not an access-control
change — it is a report showing more rows than its author intended. Scored
`minor` per this repo's version policy (AGENTS.md §版本号策略), which reserves
`major` for the synchronized `@objectstack` major bump; the narrowing is
described here rather than encoded in the number.

Because rendering unfiltered *in silence* would be worse than an error, the
dropped key is not silent. When a document carrying `filter` reaches the
renderer, a dev-mode warning fires once per offending report or block, naming the
key, quoting the spec's own rename hint verbatim (so an author meets one message
rather than two dialects of one message), and stating that no filter was applied.
It is a no-op under `NODE_ENV=production` and changes no types.

Fix your documents by renaming `filter` to `runtimeFilter` — the key the schema
actually declares, and the one the suggestion has always pointed at. Reports that
already author `runtimeFilter`, and hosts that pass the `runtimeFilter` prop, are
entirely unaffected.
