# Error Tracking (Console)

Sentry error reporting is **already built into the Console**. There is nothing to
install and no init code to write — this guide is about *turning it on*, which takes
two independent opt-ins, one at build time and one at runtime.

> ⛔ **Do not add your own `Sentry.init()` / `src/lib/sentry.ts` to the Console.** A
> second init is not gated by anything below, so it would report regardless of what the
> deployment permits — rebuilding the exact "decision frozen at build time, no operator
> switch" shape that objectui#5522 existed to remove. The integration below is the
> supported path; extend it, don't duplicate it.

## The gate: reporting needs BOTH halves

```
send  ⇔  a DSN was injected at BUILD time  ∧  the RUNTIME granted permission
```

Both are opt-in, and **either one alone denies**. This is what lets one artifact serve
every posture: `@object-ui/console` publishes a single pre-built SPA that the hosted SaaS
console and the on-premises / air-gapped EE images all embed, so the bundle cannot tell
those deployments apart — only the server can.

The decision lives in one place, `resolveSentryGate()` in
`packages/app-shell/src/observability/sentry.ts`, and is pinned case by case in
`sentry.test.ts`.

### Half 1 — build time (the build environment of the Console)

Set these in your **deploy environment** (hosting panel / CI), the same way you already
inject `VITE_SERVER_URL`. The authoritative list is the comment block in
`apps/console/.env.production` — mirror it, don't invent knobs.

| Variable | Effect |
|:--|:--|
| `VITE_SENTRY_DSN` | **Required.** Presence *is* the build-time opt-in — there is no separate "enable" flag. Absent ⇒ `initSentry()` returns `false` and `@sentry/react` is never even imported, so the vendor-sentry chunk is never fetched. |
| `VITE_SENTRY_SEND_DEFAULT_PII` | `=true` opts in to sending **IP address + User-Agent**. Off by default: one artifact serves both SaaS and on-prem, so PII collection must be the deliberate choice of the build that wants it. |
| `VITE_SENTRY_ENABLED` | `=false` force-disables reporting even when a DSN was injected — for a pipeline that keeps the DSN in its environment but wants reporting stopped. |
| `VITE_SENTRY_ENVIRONMENT` | Defaults to Vite's `MODE`. |
| `VITE_SENTRY_RELEASE` | Defaults to `VITE_APP_VERSION`, then `unknown`. CI typically injects the commit SHA. |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | Defaults to `0.1`. |
| `VITE_SENTRY_REPLAY` | `=true` records 10% of **error** sessions. Session replay is otherwise off. |

⛔ **Never commit a DSN** — not to `.env.production`, not as an "example". Vite inlines
every `VITE_*` from a committed `.env` file into the published bundle as a frozen object
literal, so a committed DSN is a live third-party endpoint compiled into an artifact that
lands inside customer networks, and it cannot be switched off afterwards (the
`VITE_SENTRY_ENABLED` kill switch is read off that same frozen literal). That is not
hypothetical: an air-gapped EE deployment was measured sending 14 Sentry envelopes per
session carrying IP + User-Agent PII, with no way for the customer to stop it
(objectstack-ai/cloud#1508, objectui#5522). The ratchet
`packages/app-shell/src/observability/committed-telemetry-endpoint.test.ts` fails CI if
any committed `.env*` file carries a telemetry endpoint or turns PII on by default.

A DSN looks like `https://your-key@your-org.ingest.sentry.io/your-project-id`.

### Half 2 — runtime (each production server)

The server grants permission through `telemetry.allowClientErrorReporting` on
`GET /api/v1/runtime/config`. Set it on the **ObjectStack runtime**, not the Console
build:

```bash
OS_TELEMETRY_CLIENT_ERROR_REPORTING_ENABLED=true
```

…or, from a host that composes the plugin directly:

```ts
new RuntimeConfigPlugin({ allowClientErrorReporting: true })
```

The explicit plugin option wins over the environment variable. The switch answers to a
**closed** vocabulary — `1` / `true` / `on` / `yes` grant, `0` / `false` / `off` / `no`
deny — and an **unrecognised spelling is refused, never coerced**: the permission stays
denied and `RuntimeConfigPlugin` names the rejected value in a warning at mount time. So
`=enable` or `=Y` does not quietly half-work; check your server's startup log if
reporting stays silent.

⚠️ **`OS_CLOUD_URL=off` overrules a grant.** A runtime that declared its control plane
off has declined outbound calls, and this one with it — the permission is lowered to
`false` and the refusal is warned about at mount. This is the copied-env-file shape
cloud#1508 reported: a hosted configuration landing on an air-gapped box.

Canonical row for this variable:
[Environment Variables → Observability](https://objectstack.ai/docs/deployment/environment-variables)
(`content/docs/deployment/environment-variables.mdx` in the objectstack repo).

## Fail-closed contract

**Either half missing ⇒ no reporting, silently, by design.** Every "cannot determine the
answer" state — the config fetch failed, the endpoint 404s, the runtime predates the key,
a third-party host, the config has not arrived yet — reads as **denied**. An unreported
error is recoverable; PII leaving an air-gapped deployment is not. Silence is therefore
the *correct* behaviour, not a bug to work around: if you want reporting, supply both
halves rather than loosening the gate.

Note the direction differs from `isMarketplaceEnabled()` / `isAiStudioEnabled()`, which
fail **open**. Do not "make it consistent" with them.

### Ordering, if you embed app-shell in your own host

`initSentry()` must run **after** `initRuntimeConfig()` has settled — the runtime
permission is a server-pushed value that reads denied until the payload arrives, and
`initSentry()` memoizes its verdict on first call. Calling it at module-eval time freezes
`denied` for the whole session, turning the operator switch into a permanent removal.
`apps/console/src/main.tsx` does this correctly: `initSentry()` is kicked off inside
`.finally()` on the boot `Promise.all`, so a failed config fetch still never blocks first
paint (and on that path the permission is denied, so the failure direction is silence).

## Reporting errors from your own code

Use the built-in helpers from `@object-ui/app-shell` — they route through the same gate
and no-op when it denied, so they cannot become a second ungated path:

```ts
import { captureError, setSentryUser } from '@object-ui/app-shell';

captureError(err, { where: 'record-save' });  // no-op unless the gate passed
setSentryUser({ id: user.id });               // pass null on logout
```

`packages/app-shell/src/chrome/ErrorBoundary.tsx` already calls `captureError()` with the
React component stack, so uncaught render errors are covered without any wiring.

## Verifying a deployment

1. **Check the runtime half** — it is the half you can inspect from outside:

   ```bash
   curl -s https://your-deployment.example.com/api/v1/runtime/config | jq .telemetry
   # → { "allowClientErrorReporting": true }
   ```

   `false` (or an absent `telemetry` block) means the server is denying; fix that before
   looking at the build.

2. **Check the build half** — in the browser devtools **Network** tab, confirm the
   `vendor-sentry` chunk is fetched on load. If it never appears, the bundle carries no
   DSN (or `VITE_SENTRY_ENABLED=false`), and no runtime grant can rescue it: the server
   supplies a *permission*, never a source.

3. **Trigger a test error** — in the browser console, `throw new Error('Test error')`.

4. **Confirm it lands** in your Sentry project, tagged with the expected `environment`
   and `release`.

## Source maps

The Console build sets `sourcemap: false` (`apps/console/vite.config.ts`). For readable
stack traces, enable source maps in CI only, upload them, then discard them rather than
publishing them with the bundle:

```yaml
- name: Upload Source Maps
  run: |
    npx @sentry/cli sourcemaps upload \
      --auth-token $SENTRY_AUTH_TOKEN \
      --org your-org \
      --project objectui-console \
      --release $VITE_SENTRY_RELEASE \
      apps/console/dist/assets/
```

Keep `--release` identical to the `VITE_SENTRY_RELEASE` the bundle was built with, or the
uploaded maps will not match the events.

## Content Security Policy

The Console ships **no CSP meta tag** today — `apps/console/index.html` sets none, and the
repo defines no default policy. Nothing in the Console needs relaxing for Sentry out of
the box.

If **your hosting layer** serves CSP headers (many do), Sentry's ingest endpoint has to be
reachable or events are dropped silently by the browser:

```
connect-src 'self' https://*.ingest.sentry.io;
```

Match the origin to your own DSN — `*.ingest.sentry.io` for current Sentry SaaS projects,
your own host for a self-hosted Sentry.

## Related

- `packages/app-shell/src/observability/sentry.ts` — the gate and its rationale
- `packages/app-shell/src/runtime-config.ts` — `isClientErrorReportingAllowed()`
- `apps/console/.env.production` — authoritative build-time variable list
- objectui#5522 · objectstack#10805 · objectstack-ai/cloud#1508
