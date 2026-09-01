---
---

Docs and tests only for `@object-ui/plugin-timeline`. `spellGanttDateValue`'s
docblock claimed every branch was total; measured in-render, `Array.isArray`
throws on a revoked `Proxy`, so the claim is now scoped to the input set that
is actually exercised and the exclusion is pinned as rows in the existing
adversarial set. The same measurement falsified the wider claim that
`Array.isArray` is the last non-total operation on the gantt date path — five
reads upstream of the helper throw first, recorded in objectui#7153. No
published behaviour changes.
