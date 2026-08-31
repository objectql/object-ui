---
'@object-ui/types': minor
---

**Breaking for authored metadata:** `DashboardWidgetSchema` (the zod validator
in `@object-ui/types/zod`) is now `.strict()` — an undeclared widget key
REFUSES the parse with zod's `unrecognized_keys` issue naming every offending
key, instead of being silently deleted.

Before this change the schema was a plain `z.object()`: a widget carrying
`zzcanary` / `categoryField` / `aggregate` parsed five-keys-in, three-keys-out,
verdict ACCEPT — the same "dropped without a word" failure the schema's own
docstring records from the pre-derivation hand copy, still live for every key
no contract declares (objectui#6002). Maintainer ruling 2026-08-25, Route 1
two-step: objectui#6150 declared the 13 genuinely-consumed keys first (landed
as PR #6945), then this flip makes a stale or mistyped key loud everywhere the
contract is consulted (`objectui validate`, `safeValidateSchema`, the catalog
gate) instead of only inside one catalog test.

**Who is affected — a widget authoring a key outside the declared surface:**
the retired pre-ADR-0021 inline analytics shape (`object` / `categoryField` /
`valueField` / `aggregate`) is the canonical case — it used to validate clean
with all four keys deleted; it now refuses with the keys named. The spec's
tombstoned keys (`actionUrl` / `actionType` / `actionIcon` / `aria` /
`responsive`) keep their specific removal messages — they are declared
`z.never()` members, so they do not degrade to a generic unknown-key error.

**Not affected:** a `metric-card` COMPONENT node in a dashboard's widget slot.
Its props (`value` / `icon` / `trend` / `trendValue` — registry inputs, not
widget keys) stay legal: per the 2026-08-14 ruling (objectstack#8593) a
component node is owned by objectui's own passthrough `BaseSchema`, and
`DashboardComponentSchema`'s widget slot now routes component-enum types there
before the strict widget schema is consulted. The legacy
`{ id, component, layout }` envelope also still parses. The repo-wide corpus
preflight (575 JSON files, every dashboard-bearing doc fence, all designer
emit paths) measured **zero** newly-refused widgets.
