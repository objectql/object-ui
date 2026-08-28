---
---

Documentation and gate-only change (objectui#6186). The `thresholds` closure claim
carried by `@object-ui/sdui-parser`'s unconsumed-widget-option census was written
twice — in the census header and in the plugin-dashboard docs page — and is now
single-sourced onto the census header, with a new gate re-deriving it from source
on every test run. The block-schema page's whole-tree negative is bounded to the
block family's own keys.

The only edit to published source is the census module's comment header: no
exported symbol, runtime behaviour or emitted diagnostic changes, so this releases
nothing.
