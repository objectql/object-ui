---
---

Comment-only. The `record:details` and `record:highlights` registration comments in
`@object-ui/plugin-detail` stated that the spec STRIPS an undeclared key on parse.
Measured against the installed `@objectstack/spec` 17.2.0, it REFUSES it — `safeParse`
returns `success: false` with `unrecognized_keys` naming the key — so both comments now
state the mechanism they actually rely on. No published behaviour changes: the decision
both comments record (do not publish those keys as authorable inputs) is unchanged, and
no declaration, type or renderer was touched.
