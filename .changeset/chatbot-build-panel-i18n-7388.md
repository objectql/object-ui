---
"@object-ui/plugin-chatbot": patch
"@object-ui/i18n": patch
---

fix(plugin-chatbot): localize the build-progress panel, which was an English island (objectui#7388)

Every label the build panel is HANDED was already localized — the host passes
`openBuiltAppLabel`, `designBuiltAppLabel`, `previewDraftLabel` and the three
connection cues through its own `t()`. Every string the panel OWNED was a
literal in the component, so a fully Chinese conversation watched its app get
built under `Building your app…`, over `Objects` / `Views` / `Dashboards` /
`App` / `Sample data` row headings — one per row, on every build — and a
`+N more` overflow counter.

All of them now resolve through the console's pack as `chatbot.build.*`, added
to all ten locales. Behaviour for a known phase is unchanged in English, and
the unknown-artifact-type fallback still renders the raw type rather than a
raw i18n key.
