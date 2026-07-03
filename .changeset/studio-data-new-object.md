---
"@object-ui/app-shell": patch
---

feat(studio): Data pillar left rail gains search + inline "new object"

Closes the two remaining v1 rail gaps from the builder design (§4): the objects rail
now has a **search** filter and an inline **新建对象** creator (显示名 + auto-derived
snake_case 标识符 — hand-editable, since CJK labels can't derive one). Creating saves
the object as a **draft in the current package** (same runtime-create path the classic
Studio editor uses), seeded with one text field, and lands in 表单 · 布局 — the
metadata-level designer.

Draft-only objects (no physical table until the package publish) now get honest
placeholders instead of broken surfaces: the Records grid explains that data arrives
after publish (instead of firing SQL at a table that doesn't exist), and 预览 explains
there is no published definition yet.
