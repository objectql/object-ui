---
"@object-ui/app-shell": minor
---

The environment entitlement dialog now reads its context from
`error.details.*` — the single declared location — and the flat dual-dialect
tolerance is deleted (objectui#3329, the objectui half of cloud#1046).

`entitlementDialogFromError()` maps a cloud env-create 403 into the friendly
upgrade / limit dialog. It read `upgrade_url`, `contact_url`, `plan`, `current`
and `limit` off the error object's **top level**, where the control plane used
to put them as undeclared siblings of `code`. Those keys are conformant only by
evaporating: `ApiErrorSchema` is a plain `z.object` that STRIPS unknown keys, so
they survive to the Console purely because this path consumes the raw wire body
before any parse. ADR-0112 (with framework#4224 and cloud#930's `AiErrorExtra`)
declares `details` as the slot for structured error context, and cloud#1046
moves the producer there.

## What changed

- All entitlement context is read from `error.details.<key>` and **nowhere
  else**. `code` and `message` are declared `ApiErrorSchema` fields and stay on
  `error` itself.
- `entitlementErrorFields()` — the `body?.error ?? body` flat/nested tolerance —
  is **removed**. A flat body (`error` as a string with `code` at the top level)
  no longer produces a dialog; it takes the caller's ordinary error path.
- No `??` chain between shapes was added in its place: exactly one shape is
  accepted after this change, and tests pin both directions (details is read;
  the retired locations are not).

## Breaking note — read before tracking objectui `main` directly

This is a wire-shape change with no consumer-side fallback, by decision on
cloud#1046 (option A). It is safe for the **hosted** product because the cloud
image pins objectui by `.objectui-sha`: cloud#1046's second half lands the
producer change and the pin bump in one PR, so producer and consumer flip
atomically and the hosted Console never runs one against the other.

**Self-hosted deployments that track objectui `main` ahead of their control
plane** will, until that control plane emits `error.details.*`, see the
entitlement dialog lose its context: the upgrade CTA falls back to
`/settings/billing`, `PRODUCTION_ENV_LIMIT` drops its "Contact sales" CTA,
`DEV_ENV_PLAN_LOCKED` says "free plan" regardless of the real plan, and
`DEV_ENV_LIMIT` drops the "using X of Y" counts. The dialog itself still opens
and its titles/messages are unaffected — `code` did not move. Upgrade the
control plane past cloud#1046 to restore the context.
