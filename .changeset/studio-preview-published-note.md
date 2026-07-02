---
"@object-ui/app-shell": patch
---

fix(studio): say what the Form preview shows — published definition, not the draft

The Data pillar's Form view has two sub-modes: **布局** (the WYSIWYG layout designer,
rendered from the draft) and **预览** (the live runtime ObjectForm). The preview
renders the **published** definition on purpose — a draft with structural changes has
no physical columns yet (DDL lands at publish), so a draft-with-data preview would
break — but the UI never said so: after arranging a draft in 布局, switching to 预览
silently showed the old shape, reading as "my changes are lost".

Now the sub-mode captions state their source (布局 = 草稿 · 含未发布改动 / 预览 =
已发布定义), and when unpublished changes exist the preview shows an amber note:
confirm the draft in 布局, or publish (top bar) first to see the published effect.
Publishing stays a deliberate user action — nothing auto-publishes.
