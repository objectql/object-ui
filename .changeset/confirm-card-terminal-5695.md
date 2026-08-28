---
'@object-ui/plugin-chatbot': minor
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

The 确认修改 (confirm changes) card now carries a UI-owned terminal state after approval (#5695): `detectReplayOutcome` lifts the confirm-replay envelope (`replay_*` tool results) into 应用中 / 已生效 / 已暂存为草稿（含内联发布）/ 未生效（含 publishError 首行）, rendered on the original card across the live, hydration/share, and localStorage-cache converters. A failed in-turn publish no longer rehydrates as an ordinary draft card with a live Publish button — the UI-rendered refusal is the layer a model cannot narrate over. New `console.ai.changesApplying/Applied/Drafted/Failed` keys in all ten locale packs.
