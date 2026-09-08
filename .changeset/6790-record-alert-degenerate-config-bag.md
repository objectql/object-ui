---
'@object-ui/plugin-detail': patch
---

`record:alert` stops re-reading a degenerate `properties` bag as its own character indices — the sixth and last member of the `readProps()` family joins the five objectui#6783 converged (objectui#6790).

The renderer's config-bag reader spelled its fallback `(schema?.properties ?? {})`. `??` only replaces `null`/`undefined`, so a non-object `properties` (a string, an array) went into the object spread and came back out as indexed keys: for `properties: 'not-a-bag'` the bag held `{ '0': 'n', … '8': 'g' }` beside the node's own keys — nine keys nobody authored. The reader — now its own module, `renderers/record-alert.readProps.ts`, the way `@object-ui/components` keeps its reader — asks `isConfigBag`, exported from `@object-ui/react`'s package entry since objectui#6783, and a degenerate bag contributes no keys. The expression itself is unchanged: the node's own keys stay underneath (the legacy flat spelling still resolves) and a nested key still wins the contested one; there is no `props` alias leg here and none is added.

**What this does not change, measured rather than predicted.** No rendered output moves. `record:alert` reads named keys off the bag (`title`, `body`, `severity`, `icon`, `action`, `dismissible`, `dismissKey`, `visible`) and never spreads it onto a DOM element, so the indices were computed and then dropped; a degenerate bag renders exactly as no bag at all, before and after. The census behind objectui#6708 found zero authored nodes carrying a degenerate config bag. What the guard buys is what objectui#6752 measured its own guard buys: the authored value's shape is not reinterpreted.
