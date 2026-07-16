---
"@object-ui/app-shell": minor
---

Studio: author list/grid `conditionalFormatting` rules with a CEL editor (#1584 / #1582 follow-up).

`conditionalFormatting` previously had no authoring UI in Studio — a low-code
author could only hand-write the JSON. Adds a `ConditionalFormattingEditor` to the
View inspector (`ViewVariantInspector`, list-family views; also hosted by the
runtime ObjectView's right-rail view editor): an ordered list of rules, each a
**CEL predicate** authored with `CelPredicateField` (inline lint + field
autocomplete on the canonical `@objectstack/formula` engine — the same engine the
runtime and server use) plus background / text / border colors. Rules are
first-match-wins, so the editor supports move up / down.

It reads and writes the spec-canonical `{ condition, style }` shape (what the list
/ grid / kanban renderers evaluate since #1584). Legacy rule shapes — native
`{ field, operator, value }`, top-level color props, or a `{ dialect, source }`
condition envelope — are normalized to `{ condition, style }` on read, so opening
an existing rule upgrades it in place. English + Chinese labels included.
