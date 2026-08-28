---
'@object-ui/app-shell': patch
'@object-ui/console': patch
---

Console builds no longer carry a live Sentry DSN, and `sendDefaultPii` is now opt-in
(objectui#5522).

`@object-ui/console` publishes a pre-built SPA, so ONE artifact — built once from
`apps/console/.env.production` — is what the hosted SaaS console and the on-premises /
air-gapped EE images all embed. Vite inlines every `VITE_*` from that file into the
bundle as a frozen object literal, so the DSN committed there was a live third-party
telemetry endpoint compiled into artifacts that land inside customer networks. It could
not be switched off afterwards either: the `VITE_SENTRY_ENABLED` kill switch is read off
that same frozen literal, so on a shipped bundle it is `undefined` forever and editing
env vars on the deployed host does nothing. An air-gapped deployment was measured
sending 14 envelopes per session to sentry.io with IP + User-Agent PII, unstoppable by
the customer.

- `apps/console/.env.production` no longer defines `VITE_SENTRY_DSN`,
  `VITE_SENTRY_ENVIRONMENT` or `VITE_SENTRY_SEND_DEFAULT_PII`. A build with no DSN never
  imports `@sentry/react`, so the `vendor-sentry` chunk is not even fetched.
- `sendDefaultPii` changed from opt-out (`!== 'false'`) to **opt-in** (`=== 'true'`), so
  IP address and User-Agent are never the inherited default of a build that did not ask
  for them.
- The gate now fails **closed**: an absent, empty or whitespace-only DSN means do not
  send. The direction is deliberately inverted from the usual — an unreported error is
  recoverable, PII leaving an air-gapped deployment is not.

**Action required for deployments that want error reporting** (the hosted SaaS/demo
console): inject `VITE_SENTRY_DSN` from your build environment, the same way
`VITE_SERVER_URL` is already injected, plus `VITE_SENTRY_SEND_DEFAULT_PII=true` if you
still want IP/User-Agent on events. Nothing else changes for builds that opt in.
