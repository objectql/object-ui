---
---

Doc-snippet gate tooling only, no published package source changed.

`check-doc-snippet-types` collects blocks with `scanFences`, whose fence-opening
anchor accepted a run of leading spaces and tabs and nothing else. A fence
opened inside a Markdown blockquote carries a `> ` prefix, so the anchor never
matched, the block was never collected, and the gate compiled nothing for it.
There was no diagnostic: an uncollected block appears in no count, and its page
still reports as covered. A callout is a natural home for an import example,
which is exactly the snippet class that rots when an export is renamed — the one
class this gate exists to catch.

The opener now tolerates a blockquote prefix and carries the opener's quote
DEPTH through the rest of the walk: the search for the closing fence reads
candidate lines at that same depth, and every body line is stripped of that many
markers before it reaches the compiler. Depth 0 — every unquoted fence in the
corpus — takes an identity path that returns the line unchanged byte for byte,
so the other 773 collected blocks scan exactly as they did before. Stripping
consumes at most one space after each marker, per CommonMark, so indentation
belonging to the snippet survives.

Carrying the depth to the CLOSING fence is what makes this safe in both
directions. Without it a blockquoted fence would find no close and swallow the
rest of the file; and a plain fence would be closed early by any `> ` + backticks
line quoted inside it as prose. Both directions are pinned.

Measured over the gate's own 224-document population: collected blocks 773 → 774.
The one newly-collected block is the import callout at
`content/docs/api/schema-reference.md` line 12, and it compiles — the gate's
semantic phase judges 272 of 272 with 0 failures. Nothing left the population.
