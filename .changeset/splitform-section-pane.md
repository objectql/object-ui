---
"@object-ui/types": minor
"@object-ui/plugin-form": minor
---

feat(form): `SplitForm` honours the spec's new `FormSection.pane`

A split form's panel assignment was a hardcoded positional rule — first section
left, everything else right. The rule was invisible in the metadata, so
reordering sections silently moved them across the divider, and an author could
not place two sections in the left pane at all.

Sections now declare their panel: `pane: 'primary' | 'secondary'`
(@objectstack/spec `FormSection.pane`, objectstack#4160). Placement follows the
key, not the array position — reordering paned sections never changes the
layout. Omitted keys keep the exact legacy rule (first section `primary`, rest
`secondary`), so existing metadata renders unchanged.

`ObjectForm`'s split dispatch copies the key through its per-key section mapping
(the path that once silently dropped `visibleOn`), and `ObjectFormSection`
declares it. The spec side rejects `pane` on non-split form types at parse, so
the key can never be an accepted-but-ignored no-op.
