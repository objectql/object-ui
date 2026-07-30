---
'@object-ui/console': patch
---

**The shared-record page's redaction notice never rendered on the enveloped path.**

`GET /api/v1/share-links/:token/resolve` has two producers — the framework's
sharing plugin and the runtime dispatcher's `/share-links` domain, which is the
designed primary surface for cloud's per-environment kernels. `SharedRecordPage`
read both, but the wire spells the field `redactFields` while the render reads
`redactedFields`, and only the BARE branch did that rename. The enveloped branch
handed `body.data` straight through, so on the dispatcher path `redactedFields`
was always `undefined` and "Some fields are hidden by the owner" never appeared —
on exactly the pages where fields WERE being stripped. The record itself was
correctly redacted throughout; what was missing is the visitor being told.

The fold now lives in one place, `normalizeResolvedShare` in the new
`pages/shared-record-shape.ts`, with both envelopes covered by tests. Extracting
it out of the page module is also what lets those tests run without loading the
chat renderer and the app-shell graph behind it.

Prompted by objectstack#3983, which moves the plugin surface onto the same
enveloped shape the dispatcher already used: without this fix that convergence
would have spread the missing notice from the dispatcher path to every share
page. No API change — the page reads a superset of what it read before, so it
still works against a pre-#3983 framework.
