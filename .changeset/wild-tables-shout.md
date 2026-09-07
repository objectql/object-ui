---
---

Test-only change: `RelatedList.lookupLabelResolution` waits for the batch lookup-label map with a side-effect-free predicate and renders the cell once afterwards, instead of rendering inside the `waitFor` callback. No published behaviour changes.
