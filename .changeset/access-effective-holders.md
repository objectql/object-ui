---
"@object-ui/app-shell": patch
---

Access pillar: the 已分配用户 section now lists EFFECTIVE holders — direct
grants ∪ holders of every position bound to the set — with per-row
attribution badges (直授 / 经岗位 X). Position-held rows are not removable
here (remove on the position's assignments); an `everyone`-anchor binding
renders as a note ("every signed-in member holds this set") instead of
enumerating the tenant (objectui#2382 — the direct-grants-only list told
admins "0 users" for any normally-administered set). The explain panel's
user field gains a chevron so "pick another user" is discoverable
(objectui#2381 — the picker existed but read as static text).
