---
'@object-ui/app-shell': minor
'@object-ui/plugin-chatbot': minor
---

Fix the three breaks at the AI paywall moment (#7253), measured on a free plan's
second build iteration when the cloud guardrail refuses "Confirm changes" with a
429 `AI_DESIGN_QUOTA_EXHAUSTED`.

- **The upgrade CTA no longer opens a 404.** It used to open a client-composed
  `${cloudBase}/apps/cloud-control/sys_environment`, which guessed the control
  plane's console mount, app slug and route — all three wrong — and landed on
  the API's `ENDPOINT_NOT_FOUND` JSON. `cloudInstallDeepLink` /
  `cloudPricingDeepLink` are replaced by `cloudConsoleUrl()`, the
  runtime-supplied cloud origin with no path appended; the control plane's own
  root redirect decides the landing page. The former
  `|| 'https://cloud.objectos.app'` default is gone: a runtime with no upstream
  cloud now renders no upgrade link at all rather than pointing a self-hosted
  user at the vendor's SaaS.
- **The confirm card gets an explicit failure state.** A quota refusal parks the
  card on "not applied" with the server's own next step (reset tomorrow /
  upgrade) plus the upgrade action, instead of silently rolling back to
  "Confirm / Adjust" as though the click had never happened. Transient failures
  (offline, per-minute rate limit) still roll back, because retrying is the
  right next step there.
- **The composer is no longer refilled with an already-delivered message.**
  Only text typed into the composer is restorable now; card-driven sends
  (confirm, approve, suggestion chips) send canned text the user never typed and
  no longer leave the previous prompt staged as if it needed resending.
