---
---

`ObjectGantt` internal cleanup, measured as a zero-pixel change:

- The comment block above the `navConfig` default repeated its own last two
  lines verbatim, leaving a mid-sentence fragment. The sentence is now stated
  once, in full.
- The drawer default no longer spells the spec-deprecated `width`
  (`@deprecated [#2578 -> size]`). It is now `{ mode: 'drawer' }`, so
  `resolveOverlayWidth` returns `undefined` and `RecordDetailDrawer`'s own
  `width` default supplies the identical `min(960px, 60vw)`. The resolved
  overlay width is unchanged on every viewport, and is now pinned by a test.

No published behaviour changes.
