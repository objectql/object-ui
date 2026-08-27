---
'@object-ui/app-shell': patch
---

The object designer's client-side 422 on a draft carrying the retired `formula`
field key is now actionable (objectui#6526, adjudicated option B). The spec's
rejection at `fields.<name>` gains an appended pointer that names the field and
names the destination: select the field and make one edit in its Formula (CEL)
editor, which commits the value to `expression` and clears the retired alias.

Presentation only — the verdict, issue set and paths are unchanged, and nothing
about what the gate accepts changes. The migration path itself is untouched:
`RETIRED_FIELD_KEYS` still does not strip `formula` (objectui#6043's ruling),
and the object stays unsaveable until the author makes that one edit — the
ruling's accepted cost, now with a signposted way out. The pointer fires only
for `formula`-type fields, where the inspector actually renders that editor
(objectui#4306); any other field type keeps the bare spec message.
