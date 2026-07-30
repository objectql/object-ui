---
"@object-ui/plugin-detail": minor
"@object-ui/core": minor
"@object-ui/console": patch
---

feat(record): declare inputs for the seven configurable record:\* blocks, and curate six

Seven `record:*` blocks shipped with renderers that read props but declared no
`inputs`. That combination is the worst of both: the renderer honours
`limit`, `severity`, `location` …, while every authoring surface — the designer
panel, the AI vocabulary, the generated manifest — reports the block takes no
configuration. objectui#3013 recorded them as deliberately uncurated for
exactly that reason.

The declarations mirror what each renderer actually reads:

| block | inputs |
|---|---|
| `record:activity` | 11 — from `RecordActivityComponentProps` |
| `record:chatter` / `record:discussion` | 5 — from `RecordChatterComponentProps` |
| `record:alert` | 8 — severity, title, body, visible, icon, action, dismissible, dismissKey |
| `record:quick_actions` | 7 — actionNames, requiredPermissions, location, align, inline, variant, size |
| `record:history` | 3 — limit, emptyText, unknownUserText |
| `record:reference_rail` | 1 — hideEmpty |

`inputs` describe what an AUTHOR writes, which is a subset of what the renderer
reads. `entries`, `loading` and resolved `actions` are injected by the host
shell off RecordContext; declaring them would invite a model to hand-write the
data the page is supposed to fetch. `aria` is omitted for the reason it is
omitted on `record:details` — an accessibility escape hatch, not a layout
choice. `location` takes its enum from the spec's `ACTION_LOCATIONS` rather
than restating it, per objectui#3019.

Six of the seven are now in `PUBLIC_BLOCKS`: configurable and absent from the
contract is the state objectui#3006 was about. The contract goes 36 → 42 tags,
all resolving.

`record:chatter` stays out — it is the same renderer as `record:discussion`
under a Salesforce-familiar name, kept for schemas already in the wild. Two
spellings of one block is ambiguity an authoring model cannot resolve, so the
vocabulary carries the spec's name. A test compares the two input lists, so the
day they diverge the exclusion stops being justified and fails.

A companion assertion requires every curated `record:*` tag to declare inputs.
A curated tag with none reads as "takes no configuration" when the renderer in
fact reads props — the same gap objectui#3006 opened, pointed the other way.
