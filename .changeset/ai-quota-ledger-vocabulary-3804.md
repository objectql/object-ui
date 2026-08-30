---
'@object-ui/plugin-chatbot': patch
---

Recognize the landed AI quota ledger vocabulary in the chat error path

`parseAiQuotaError` now accepts the three SCREAMING_SNAKE ledger codes the cloud
token guardrail emits (`AI_ALLOWANCE_EXHAUSTED`, `AI_DESIGN_QUOTA_EXHAUSTED`,
`AI_DATA_CHAT_TRIAL_EXHAUSTED`) alongside the legacy lowercase trio, which stays
readable for producers that have not converged yet. The companion fields
(`messageEn` / `upgrade` / `topUp` / `resetsTonight`) are now read from the
declared envelope's `error.details` as well as their legacy top-level position,
with the declared position winning.

A quota-exhausted user gets the upgrade / top-up CTA again instead of the
generic "Response failed" banner. The per-turn message cap's generic
`QUOTA_EXCEEDED` deliberately keeps its existing rate-limit path — it has no
upgrade or top-up next step.
