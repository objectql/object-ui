---
'@object-ui/app-shell': minor
'@object-ui/console': minor
---

Console telemetry can now be hard-disabled on an already-built artifact

`/api/v1/runtime/config` gained `telemetry.allowClientErrorReporting`
(objectstack#11382), and the Console now reads it. The Sentry decision becomes a
conjunction of two independent grants — a DSN injected at **build** time AND a
positive permission from the **runtime** — so the single pre-built SPA that both
the hosted SaaS console and the on-premises / air-gapped EE images embed can be
silenced by the deployment it lands in, with no rebuild and without editing files
inside a published bundle. That was the half objectui#5522 could not close before:
every other input to the gate is a Vite build-time variable frozen into the bundle
as a literal, which is how an air-gapped EE Console came to send 14 Sentry
envelopes per session to `sentry.io` carrying IP + User-Agent PII with no way for
the customer to turn it off (objectstack-ai/cloud#1508).

The permission fails **closed** in every direction: absent key, `telemetry` block
absent, malformed payload, failed fetch, or a runtime predating the key all read as
*do not send* — which is precisely the set of runtimes leaking today. It is a
permission and never a source: the server supplies no DSN and cannot turn telemetry
on for a build that carries none. Only a real boolean `true` grants; `'true'`, `1`
and other truthy lookalikes do not.

Behaviour change for deployments that already inject a DSN: reporting now also
requires the runtime to grant permission, via
`OS_TELEMETRY_CLIENT_ERROR_REPORTING_ENABLED` (or `RuntimeConfigPlugin`'s
`allowClientErrorReporting`). A build that opted in but whose runtime says nothing
will go quiet — deliberately, since that is the same artifact an air-gapped
customer runs.

`@object-ui/app-shell` additionally exports `isClientErrorReportingAllowed()` and
the `RuntimeTelemetry` type, so consumers read the permission through the one
fail-closed accessor instead of writing their own optional-chain against the
payload.
