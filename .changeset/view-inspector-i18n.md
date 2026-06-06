---
"@object-ui/app-shell": patch
---

Localize the View variant inspector labels. The inspector (the View "home" panel, also hosted by the runtime ObjectView right-rail view editor after the spec-driven migration) previously rendered hardcoded English labels — "Label", "View type", "Object", the view-type dropdown options, and the "spec schema unavailable" hint. These now route through the metadata-admin i18n catalog (en + zh) so the runtime console and the studio both display localized text.
