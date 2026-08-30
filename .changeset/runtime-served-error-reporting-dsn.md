---
'@object-ui/app-shell': minor
'@object-ui/console': minor
---

Console error reporting is now configured entirely by the **server**: the DSN and every
knob that travels with it arrive on `GET /api/v1/runtime/config`, and the build-time
`VITE_SENTRY_DSN` path is retired (objectui#5522, consumer half of objectstack#12681).

ObjectStack's users consume a **prebuilt** Console. Under the previous two-key gate —
a build-time DSN **and** a runtime permission — a build-time key was unreachable for
them, so a self-hosting operator could not enable client error reporting at all: the
permission was reachable and the source was not. The maintainer named it on 2026-08-27:

> 「我是一个开发平台呀，我的用户并不会去构建我的前端，我理解这种应该在服务端传进去。」

```
send  ⇔  the runtime served a DSN
```

**The DSN's presence IS the grant.** There is no companion permission flag, and the one
that briefly existed is removed rather than paralleled. Two knobs in two places produced
two silent dead states — "permission on, no DSN" and "DSN in, permission off" — that look
identical from the browser; one knob cannot disagree with itself. Turning reporting off is
unsetting the server DSN, and there is deliberately no build-time force-off left, because
nobody consuming a prebuilt console could reach one.

The fail-closed posture is unchanged and structurally stronger. Absence of a *source* is
not a value that can be misread, so a runtime predating the key, a third-party host, a
404, a network failure, a malformed body and a config that has not arrived yet all read as
off — where the boolean needed a strict `=== true` plus a written argument about why a
negative `disabled` flag would have been vacuous on exactly the runtimes that were leaking.

### What moved, and the one thing that did not

`sendDefaultPii`, `environment`, `tracesSampleRate` and the error-session replay rate move
into the runtime payload. They were build-time variables, so a prebuilt-console consumer
could set none of them — including the one deciding whether IP and User-Agent leave their
network. This is not new surface; it is the same surface moved to the side that can
operate it.

`VITE_SENTRY_RELEASE` **stays build-time**, and is now the only `VITE_SENTRY_*` variable
that exists. A release identifies which bundle produced a stack trace and must match the
source maps that bundle's pipeline uploaded — a property of the build, which no server can
know. `VITE_SENTRY_ENABLED`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_TRACES_SAMPLE_RATE`
and `VITE_SENTRY_REPLAY` are retired along with `VITE_SENTRY_DSN`.

### Breaking

| FROM | TO |
|:--|:--|
| `VITE_SENTRY_DSN=…` in the Console build environment | `OS_TELEMETRY_CLIENT_ERROR_REPORTING_DSN=…` on the ObjectStack runtime |
| `VITE_SENTRY_SEND_DEFAULT_PII=true` | `OS_TELEMETRY_CLIENT_ERROR_REPORTING_SEND_DEFAULT_PII=true` |
| `VITE_SENTRY_ENVIRONMENT=…` | `OS_TELEMETRY_CLIENT_ERROR_REPORTING_ENVIRONMENT=…` |
| `VITE_SENTRY_TRACES_SAMPLE_RATE=…` | `OS_TELEMETRY_CLIENT_ERROR_REPORTING_TRACES_SAMPLE_RATE=…` |
| `VITE_SENTRY_REPLAY=true` | `OS_TELEMETRY_CLIENT_ERROR_REPORTING_REPLAY_SAMPLE_RATE=0.1` |
| `VITE_SENTRY_ENABLED=false` | unset the runtime DSN |
| `isClientErrorReportingAllowed(): boolean` | `getClientErrorReporting(): RuntimeClientErrorReporting \| null` |
| `resolveSentryGate(env, runtimeAllows)` | `resolveSentryGate(runtimeErrorReporting)` |
| `RuntimeTelemetry.allowClientErrorReporting: boolean` | `RuntimeTelemetry.errorReporting?: RuntimeClientErrorReporting` |

One-line fix for a deployment: move your `VITE_SENTRY_*` values onto the ObjectStack
server as the `OS_TELEMETRY_CLIENT_ERROR_REPORTING_*` variables above, and drop them from
the Console build environment. One-line fix for a consumer of `@object-ui/app-shell`:
`const sink = getClientErrorReporting(); if (sink) …` in place of
`if (buildTimeDsn && isClientErrorReportingAllowed())` — the build-time conjunct is gone,
because the server now supplies the source.

**Landing order is safe in both directions.** A Console built before this change meets a
new server, reads an absent `allowClientErrorReporting` and stays off; a Console built
after it meets an old server, reads an absent DSN and stays off. Neither half can turn
reporting on by itself, so the two repos' PRs can land in any order.

The `committed-telemetry-endpoint.test.ts` ratchet is unchanged in rules and unchanged in
job: nothing endpoint-shaped may be committed to this repo. Its rules key on the
variable's suffix and on the value rather than on the `VITE_` prefix, so they already
cover the runtime-side spelling — now pinned, so a later tidy-up cannot narrow them to the
retired names and reopen the hole under a new one.
