---
'@object-ui/components': patch
'@object-ui/core': patch
'@object-ui/types': patch
---

fix(actions): forward `bodyShape` end-to-end so a declared body wrap is honoured

Sibling of the `bodyExtra` fix, same failure shape one key over. `bodyShape` is
the spec's body-WRAPPING declaration for a `type: 'api'` action — `'flat'` (the
default) or `{ wrap: key }` to nest the collected params under `key`, the shape
better-auth's `organization/update` needs. The console `apiHandler` read it
unconditionally while **no** action renderer forwarded it, so an author who
declared `bodyShape: { wrap: 'data' }` on an `action:button` / `:group` / `:icon`
/ `:menu` action got a FLAT body on the wire: the endpoint received the params at
the top level, and the declaration read as honoured because it parsed and
published.

The four declared-action renderers now forward the key, and `ActionSchema`
declares it (typed by derivation from the spec, so the union cannot drift).
`ActionRunner.executeAPI` — the fallback path taken when no host registered an
`api` handler — now reads it too, closing a second asymmetry in which the same
action changed body shape depending on which host executed it. The wrap covers
the collected params only; `bodyExtra` and other top-level keys stay flat, which
is the spec's own wording for the key and what both console read-sites already
did.

`element:button` deliberately does **not** forward it: its whitelist mirrors
spec's `InlineActionSchema` pick list field for field, and that pick list does
not include `bodyShape` — it is not inline vocabulary.
