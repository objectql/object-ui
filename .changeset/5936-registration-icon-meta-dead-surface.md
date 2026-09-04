---
---

Test and tooling only; no published behaviour changes.

objectui#5936 asked for the consumer of a component registration's `icon` meta
before the lucide icon gate was extended to that population. Three first-party
populations were measured (objectui, objectstack, cloud) and none has one, so
the gate is **not** extended — adjudicated 2026-09-04. This records that reading
in the gate's own header and retires the membership half of the `ui:icon` local
pin, which had been kept on the premise that the palette lives outside this repo.

Why the EMPTY frontmatter, when PR #7590 an hour earlier declared a real `patch`
for the same card: that change edited two published packages' RENDERER source,
so consumers of the tarball could observe it. This one is confined to
`packages/components/src/__tests__/` and to `scripts/`, and it changes no
runtime code path in any package.

⚠️ The empty declaration rests on "test and tooling only", NOT on the
"no consumer anywhere" premise. That premise is objectui#5936's ADR-0049
retirement premise and this change deliberately does not lean on it: the
published `ComponentMeta.icon` key is untouched, and whether it should itself be
retired stays a maintainer decision.
