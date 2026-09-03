---
'@object-ui/app-shell': patch
---

Studio's package switcher reads the server's `writable` verdict instead of guessing
from `manifest.scope` (objectui#7177, ADR-0130 Consequences row 6, server half in
objectstack#14375).

`GET /api/v1/packages` now stamps every row with `writable: boolean`, computed by
`isWritablePackage` (ADR-0070 D2) — the same predicate the server's authoring and
lifecycle gates enforce. `parsePackages` uses it when the row carries one, so the
lock badge and the gate cannot disagree.

The old `scope !== 'project'` expression stays as the fallback for servers that
predate the field, and its output is pinned byte-identical. It is wrong for exactly
one row, which is why the verdict had to move server-side: a `type: module`
sub-package of a multi-package artifact (ADR-0130 D4) is served with no `scope` key
at all — the schema default is applied at parse time, while the artifact load path
hands the raw manifest body to `registerApp`. The heuristic reads that as a writable
database base, while the server refuses every write to it. Nothing in the raw row
separates it from a scope-less Studio-created base, which really is writable — only
the server's `engine.manifests` does, so a client-side "missing scope means
read-only" rule would have flipped every Studio base read-only instead.

Kernel packages (`scope: system` / `cloud`) stay hidden whatever verdict they carry:
that filter is about visibility, not writability.
