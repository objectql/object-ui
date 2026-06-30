---
"@object-ui/plugin-detail": minor
---

Declare designer inputs for the `record:*` blocks (details, related_list,
highlights, path) so they conform to the spec protocol (RecordDetailsProps /
RecordRelatedListProps / RecordHighlightsProps / RecordPathProps in
@objectstack/spec component.zod). They previously registered ZERO inputs — the
visual designer could not configure them, and the spec↔frontend conformance
check flagged 17 spec-only divergences. Now each block's inputs mirror its spec
schema (columns/layout/sections/fields, etc.).
