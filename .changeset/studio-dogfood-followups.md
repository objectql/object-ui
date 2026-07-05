---
"@object-ui/app-shell": minor
---

Studio package-create dogfood follow-ups (objectstack-ai/framework#2615):

- Create app can scaffold navigation from the package's objects (checkbox, on by default): one spec-valid object menu item per object, closing the "fresh app has zero nav" dead-end (objectui#2262).
- studio-design's remaining hardcoded Chinese strings (BuilderLanding, ObjectFormDesigner, ObjectValidationsPanel, ObjectSettingsPanel) now route through the i18n layer with English defaults and zh-CN translations, fixing the mixed-language screens (objectui#2264).
- ObjectFormDesigner gains a full read-only mode (drag/rename/add/delete gated), complementing the read-only package gating that landed in #2263.
