---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

fix(preview): draft-preview bar no longer demands a redundant Publish when nothing is pending

Under the auto-publish posture an AI build leaves zero pending drafts, yet opening a
draft preview still showed "Draft preview — Nothing here is live until you publish."
alongside "Changes (0)" and a Publish button — a self-contradicting, no-op call to
action. `DraftPreviewBar` now reflects the real pending-draft count: when it is
known to be zero the bar softens to a neutral preview indicator and drops the
Publish/Changes affordances; an unknown count (still loading / fetch failed) keeps
the publish path. `HomePage` (count-gated) and `RuntimeDraftBar` (draft-gated)
already behaved this way — this aligns the third surface.
