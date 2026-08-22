---
'@object-ui/i18n': patch
'@object-ui/app-shell': patch
---

Follow-up to #5696: the pending-drafts bar's strings live at `console.ai.pendingDrafts.*` with en+zh locale entries — the i18n call-site key gate and ratchet flagged the original root-level keys that existed nowhere.
