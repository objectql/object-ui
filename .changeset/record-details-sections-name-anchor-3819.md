---
"@object-ui/app-shell": patch
---

`record:details` section editor now offers the `name` i18n anchor

The page block inspector's `record:details` → Sections editor exposed
`label` / `columns` / `fields` and silently omitted `name`. That key is not
decoration: it is the section heading's i18n anchor. `plugin-detail`'s
`record-details` renderer resolves the heading through
`objects.<object>._sections.<name>.label` and falls back to the authored string
whenever `name` is absent —

```
const translatedTitle = s.name && objectName
  ? sectionLabel(objectName, s.name, rawTitle ?? s.name)
  : rawTitle;
```

— so every section built in Studio was untranslatable by construction: one
authored string in every locale, plus an upstream
`translation-section-name-missing` diagnostic the author had no control to
clear. The key was reachable only by hand-editing source, which is precisely
what a designer exists to avoid.

The new `Name (i18n key)` text box sits first in each section entry, matching
`page:tabs` / `page:accordion` where the stable identifier precedes the human
label. Its placeholder carries the snake_case convention, because
`BlockPropField` has no description or pattern affordance — the same reason the
suite already requires every `json` field to carry a shape placeholder.

Two authoring decisions, both deliberate and both pinned:

**The anchor is never derived from `label`.** `InspectorTextField` does expose an
`onBlur` hook for deriving a dependent field, and the block-config renderer
deliberately leaves it unwired here. A label may already be localized prose — or
an inline `{ en, 'zh-CN' }` map, which `record-details` runs through
`pickLocalized` — and seeding an anchor from it freezes one locale's text into
the one value that must stay locale-independent. Worse, it would be invisible:
the renderer falls back to the authored label when a translation misses, so a
wrongly-derived anchor renders exactly like the bug it was meant to fix, until
someone adds a second locale.

**Sections authored before this field existed are not backfilled.** They open
with the anchor box empty and their `label` untouched; nothing is written until
the author types. This needs no code — the inspector is read-through, writing
only from a commit handler — and the alternative would mark an untouched page
dirty merely for being opened.

No validation was added. `BlockPropField` has no pattern/validate capability,
and inventing one for a single field is out of scope; the placeholder states the
convention and the upstream lint rule remains the enforcement point.

Coverage for this block's section entry is now derived from the spec's own
`RecordDetailsProps` shape rather than hand-listed, so the next section key the
spec grows fails loudly here instead of quietly never reaching the designer.
