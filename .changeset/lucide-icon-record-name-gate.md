---
---

Adds `check:icon-record-names`, a repo-level gate asserting that every authored icon
name reaching a resolver that reads lucide's runtime `icons` record is a live key of
that record. lucide retires a spelling by dropping it from that record while keeping
it as a deprecated named export, so a retired name still imports, still type-checks
and still renders as a component while resolving to nothing as a string — the class
behind objectui#5586 and objectui#5622, each of which left a local pin behind. The
gate judges against the record itself rather than any list of retired spellings, and
re-discovers the resolver population on every run.

No published behaviour changes: the touched `src/` files carry comment updates only,
and the three repaired spellings are in example schemas and the docs playground.
