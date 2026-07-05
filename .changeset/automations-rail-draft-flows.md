---
'@object-ui/app-shell': patch
---

Studio Automations rail now shows authored-but-unpublished (draft) flows.

The Automations pillar loaded its rail with `client.list('flow', …)` only, which
returns published/active metadata — so a flow authored (saved as a draft) but not
yet published was invisible in the rail, even while the "Changes · N" counter
showed a pending draft existed. Every sibling pillar (Data / Interfaces / Access)
already merged `client.listDrafts`; Automations was the sole outlier.

The published ∪ draft merge is extracted into a shared, unit-tested
`loadPackageSurfaces` helper and adopted by the Automations pillar, which also now
re-reads on `publishNonce` so drafts that go live collapse back into the published
rail after a package publish. A draft-only flow now appears in its rail (badged
"Unpublished draft"), is selectable, and loads its draft body for editing —
matching the other pillars. Fixes the empty-rail report for writable-base packages
whose flows are all still drafts.
