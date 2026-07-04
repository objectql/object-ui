---
'@object-ui/fields': patch
---

Show inline line-item (master-detail subform) row actions always, not on hover.
In grid mode the per-row remove (🗑) and duplicate buttons were `opacity-0`
until the row was hovered (`group-hover`), so they read as "delete not
supported" and were unreachable on touch / coarse-pointer devices with no hover.
They now render at full opacity (kept muted via `text-muted-foreground`); the
action column width was already reserved, so there is no layout shift. Existing
`allow_delete: false` / `readonly` / `disabled` / `min_rows` gating is unchanged.
