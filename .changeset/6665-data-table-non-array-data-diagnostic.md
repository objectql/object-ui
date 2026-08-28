---
'@object-ui/components': patch
---

A non-array `data` authored on a `data-table` node is now named at render
instead of dropped in silence (objectui#6665).

`DataTableRenderer` takes its rows from `data: rawData = EMPTY_ROWS` off the
node and then collapses `Array.isArray(rawData) ? rawData : EMPTY_ROWS`. Any
non-array value an author wrote therefore becomes zero rows with no error and
no warning, and the table draws a correct-looking header over `No results
found` — which reads as a success receipt, the hardest failure shape for a
human or an AI author to self-check.

The spelling that opened the card is a `${...}` expression string, and it is a
defect rather than a design because the SAME expression is evaluated one key
over. Re-measured on merge-base `5967be095` through the real `SchemaRenderer`
(the table was previously quoted from `skills/objectui/rules/protocol.md` as a
measurement on `f1c27f037` and had not been re-run); all four legs reproduced,
and they are now pinned as tests rather than prose:

| node | body |
|---|---|
| `{ "data": "${data.customers}" }` | `No results found` |
| `{ "props": { "data": "${data.customers}" } }` | `No results found` |
| `{ "properties": { "data": "${data.customers}" } }` | the two rows |
| `{ "data": [ two literal records ] }` | the two rows |

The predicate is deliberately WIDER than the reported spelling: `data` authored
and not an array. The `${...}` shape only selects a sharper sentence, because
the swallow at `Array.isArray(...)` is general — a number, an object, a `null`
and a plain string are dropped exactly as silently, and a predicate keyed on
the expression shape would leave each of them to arrive as a fresh card.

It reuses objectui#6575's channel (`dataTableBindDiagnostic.ts`) as a SECOND
predicate rather than a widened one. The nodes that trip this carry no `bind`
at all, so that diagnostic's silence on them is correct behaviour, not a gap.

No behaviour change: node-level `data` still does not evaluate expressions.
Making it do so is a behaviour change on a published component and was ruled to
the maintainer, not to this change. Nothing is added to the published surface
either — the new predicate, message builder and prefix constant are
module-internal and are not re-exported from the package entry, matching
objectui#6575's own symbols. The trap stops being silent; it does not stop
being a trap.
