---
---

Test-only: the two generator anchor rules — `packages/cli`'s app/init manifests and
`packages/create-plugin`'s template devDependencies — now collect every drifted range and
report them from a single assertion, instead of one `expect` per name that threw on the
first mismatch. A dependabot batch that moves several in-repo ranges is one round of
repair rather than one round per name, and which name got reported no longer depends on
its position in the anchor table. The preconditions (the anchor must resolve; in-repo
manifests must agree) still fail fast and are kept in a separate pass, so a repo-state
failure is never reported as, or beside, template drift. No published behaviour changes
(objectui#4974).
