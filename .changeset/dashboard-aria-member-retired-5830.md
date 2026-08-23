---
'@object-ui/types': minor
---

**Published TS surface narrowed:** `DashboardComponentSchema` no longer declares
the `aria` member (`{ ariaLabel?, ariaDescribedBy?, role? }`). Its doc comment
claimed alignment with `@objectstack/spec AriaPropsSchema`, but the spec removed
`dashboard.aria` at the #3896 audit close-out — `DashboardSchema.shape.aria` is
a tombstone that refuses any value and tells authors to delete the key — and no
dashboard renderer ever read `schema.aria` (objectui#5830).

What an author loses is the **type-level suggestion** only: the key was already
refused at parse (the Zod twin inherits the spec tombstone by reference), and
`BaseSchema`'s index signature means an existing `aria:` line still compiles.
There is **no runtime behaviour change** — the key never rendered, and stored
documents carrying it already failed validation before this release.
