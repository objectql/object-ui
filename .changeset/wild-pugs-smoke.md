---
'@object-ui/components': patch
---

`ActionParamDialog`'s `select` branch no longer renders a hardcoded English `Select...` placeholder. The fallback used when an action param declares no `placeholder` of its own now reads the existing `common.select` pack key, so it is translated in all ten locales and carries the typographic ellipsis (U+2026) that #3878 converged the packs on. Authored `placeholder` metadata keeps priority, and no locale pack changed — the key was reused from `LookupField`'s identical select-trigger use.
