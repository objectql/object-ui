---
'@object-ui/app-shell': minor
---

The built-moment transition (#5799): a build conversation that has produced a WHOLE-APP build auto-routes to `/studio/<pkg>/interfaces` — on live completion and on reopening the conversation — after idempotently re-keying the thread under the `app:<pkg>:build` cache key the Studio dock resolves, so the workbench's right rail continues the SAME conversation. Cold start keeps the full-page surface; the dock's 以完整页面打开 door carries a sticky per-conversation opt-out so the one sanctioned way back is never bounced straight to Studio.
