---
"@object-ui/console": patch
---

FormPage: unwrap the ExpandedViewItem envelope from `/meta/view/:name` — the form
spec lives under `config`, so internal forms rendered zero fields with a bare
Submit that falsely succeeded. Non-form views reaching the forms route now throw
an actionable error instead of the same empty-form false positive.
