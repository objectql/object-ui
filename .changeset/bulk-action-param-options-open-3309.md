---
"@object-ui/types": patch
---

`BulkActionParam.options` entries now accept the widget config the renderer already forwards

The entry type was a closed `{ label, value }`, and it was the only layer in the
path that said so. `bulkParamToField` spreads each entry into the metadata it
hands the field widget (`{ ...o, value: String(o.value) }`), so extra keys
survive; the destination shape `SelectOptionMetadata` declares `color` / `icon` /
`disabled` / `visibleWhen` and `@object-ui/fields` genuinely reads them; and
`@objectstack/spec`'s `BulkActionParamSchema` makes the same entry
`.passthrough()`, so the server accepts them. Writing
`options: [{ label: 'Purple', value: 'purple', color: '#8B5CF6' }]` therefore
produced a TypeScript excess-property error on a configuration the renderer
honours — the type rejected working metadata, which is the most expensive
direction for an author (an AI author especially) that trusts it absolutely.

The entry now carries a `[key: string]: unknown` catch-all, matching the one its
parent `BulkActionParam` has had all along and the idiom `ActionParamOption`
settled one interface over. `label` and `value` stay required and keep their
exact types: open is not optional, and the catch-all is not an invitation to
author new option keys — the authoring gate remains the spec's strict
`SelectOptionSchema`. No runtime behaviour changes; the widening is
backward-compatible for consumers.
