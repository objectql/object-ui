---
---

Comment-only. `EXPANDABLE_FIELD_TYPES`' docblock in `@object-ui/core` claimed an
unexpanded `user` id "renders as `—`". Measured false: `user` never drew the
em-dash, and the three families that do draw it draw it only for opaque-id-shaped
values. The rendering claim is dropped rather than corrected — it describes
`@object-ui/fields`, which `@object-ui/core` does not depend on, so nothing that
can reach this file can check it. The storage claim, which is what the set
actually depends on, is kept. The consumer list is corrected by four
(objectui#5874's own conversions were never added to it) and given a
re-derivation recipe. No published behaviour changes.
