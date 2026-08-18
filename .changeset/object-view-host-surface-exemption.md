---
---

Records the maintainer ruling of 2026-08-18 on objectui#5097: the 27 keys `ObjectView`'s
`renderListView` delegation branch reads off the object-view node that are not declared
members of `ObjectViewSchema` are HOST-COMPOSITION surface, exempted with reasons, and are
not to be taught as schema keys.

Nothing is released. Every edit to `packages/plugin-view/src/ObjectView.tsx` is a comment
or one of two new module-level constants that hold the exemption list for the test to
derive against; the constants are not re-exported from the package entry point, so the
published API is unchanged, no read was added or removed, and no runtime path is touched
(`git diff` on that file: 154 insertions, 0 deletions). The rest of the change is a new
test file under `src/__tests__/`.
