---
'@object-ui/app-shell': minor
---

Studio simplification, first cut (#5813): the Data pillar's object sub-tabs collapse to 记录/表单 with the five power panels (验证/钩子/操作/API/设置) behind one 「高级」 menu (the open panel's name wears the active pill, so the collapsed default never hides where you are); drafts now AUTO-save (debounced 1.5s, CEL-blocking gates the timer per the objectui#4306 rule, a failed save waits for the next edit) and the four 保存草稿 buttons are retired in favor of a quiet saving/last-saved hint; the 权限 pillar moves from the top-level row into a 「更多」 overflow whose items carry the same dirty-guard as the primary pillars — the /studio/:pkg/access route and every page behind it are untouched.
