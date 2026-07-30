---
"@object-ui/core": minor
"@object-ui/console": patch
---

feat(sdui): curate the page:\*, element:\* and action:\* families into the public contract

The AI-authoring vocabulary and the Studio page designer disagreed by thirteen
blocks: `PUBLIC_BLOCKS` carried one `page:` tag and one `element:` tag while
the designer palette — and @objectstack/spec's page schema — offered the whole
families. A block a human can drag in Studio was invisible to a model writing
the same page, which is the objectui#3006 state at 10× the scale.

Fifteen tags join the contract (36 → 42 → **57**), every one shipping a
renderer with declared inputs (objectui#3065):

- `page:` — tabs, card, accordion, section, footer, sidebar
- `element:` — text, number, button, definition-list, repeater
- `action:` — button, group, menu, icon

Five stay out, each with its reason recorded and guarded: `action:bar`
(`record:quick_actions` covers the record action strip; the spec blesses the
other four), `element:image` (duplicates the curated `image` — one spelling
per concept), and `element:record_picker` / `element:text_input` /
`element:metadata_viewer` (mirroring the Studio palette's own exclusions, so
the two vocabularies stay out for the same reasons rather than by
coincidence).

The console's reverse-coverage guard now sweeps all four semantic namespaces
instead of `record:` alone — checking only the namespace you just fixed is
exactly how the last 22 doubled keys went unnoticed (objectui#3037). A new
prop-less allowlist (`element:divider`, `page:section`, `page:footer`,
`page:sidebar`) keeps "declares no inputs" a pinned decision in both
directions: those four must stay at zero, everything else curated must declare
a surface.
