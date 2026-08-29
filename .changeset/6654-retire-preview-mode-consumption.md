---
'@object-ui/app-shell': minor
'@object-ui/react': minor
---

Retire the discovery-wire preview mode — the console no longer turns
authentication off because a server said `mode: 'preview'` (objectui#6654).

`@objectstack/spec` retired the `RuntimeMode` value `'preview'` and the whole
`PreviewModeConfig` block (objectstack#11846). This console still read that
surface back off the runtime discovery payload, which is a different layer from
the retired compile-time type — so the consumption could not simply be assumed
dead, and its removal was ruled deliberately (2026-08-29).

- `ConditionalAuthWrapper` (`@object-ui/app-shell`) drops the branch gated on
  `discovery.mode === 'preview'`. That branch called `setAuthEnabled(false)` and
  simulated an identity out of `discovery.previewMode`, every field behind a
  default. Auth availability is now decided **only** by the ADR-0076 D12 service
  reading (`isServiceUsable(discovery.services.auth)`), exactly as for any other
  mode.
- `DiscoveryInfo` (`@object-ui/react`) drops the `previewMode` block and stops
  documenting `'preview'` as a runtime mode; the package README's discovery
  section is updated to match.

**Accepted failure direction:** a deployment that still emits `mode: 'preview'`
or a `previewMode` block now falls back to the ordinary auth reading — it
requires login. That is loud, diagnosable and more secure than keeping a dormant
auth-off path keyed on a spelling the platform no longer produces.

**Not affected:** `AuthProvider`'s `previewMode` prop, `useAuth().previewMode`
and `PreviewBanner` in `@object-ui/auth` are a separate published capability
with a different producer (a host passing the prop). Only the discovery-wire
producer of that prop is retired; hosts that pass it explicitly are unchanged.
