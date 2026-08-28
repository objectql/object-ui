---
'@object-ui/plugin-chatbot': patch
'@object-ui/app-shell': patch
---

The built-moment transition (#5799) now fires on auto-publish environments too: `detectBuiltAppPackage` reads the raw build envelope (`status:'drafted'` OR `'published'`, packageId + an `app` item), because an auto-publish posture rewrites apply_blueprint's envelope to `published` and the drafted-only `draftReview` lift never fired there — measured live on staging, where reopening a built conversation stayed on the full page.
