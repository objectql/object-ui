---
---

Test-only (objectui#4860): pin `packages/layout/README.md`'s `## Registration`
key list to `registerLayout()`'s actual `ComponentRegistry.register` calls, in
both directions. No published source changed and no behaviour changed, so this
declares no package.

The same component-key list is published in three places. Two were already held
to source — the guide's sentence by `guide-layout-sidebar-nav-doc.test.ts`
(objectui#4840) and the keys' existence by `app-shell-not-a-component-key.test.tsx`
(objectui#4841) — and this README's list was the one copy nothing checked. The
asymmetry was measured rather than assumed: objectui#4841 deregistered
`app-shell`, the guide's list went red and forced the page to be edited, and the
README's list named the same retired key with no test noticing. It was corrected
by hand in PR #4859, which is the failure mode itself: a README is this package's
npm landing page, and a key listed there that nothing registers is a reader
authoring that node and getting the renderer's `Unknown component type` panel
(OBJUI-001).

Both lists are parsed on every run rather than restated in the test — hardcoding
them would reproduce objectui#3899's own defect, whose prose listed a
`sidebar-nav` key this package has never registered.
