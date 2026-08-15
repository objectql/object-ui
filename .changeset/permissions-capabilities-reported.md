---
'@object-ui/permissions': patch
'@object-ui/app-shell': patch
---

`MePermissionsProvider` distinguishes an unreported `systemPermissions` (a
backend predating ADR-0066, which omits the field from `/me/permissions`
entirely) from a genuinely empty one (a real answer: "this session holds zero
system capabilities").

Both used to collapse into the same `[]`, so `hasCapabilities` consumers could
not gate strictly on a real empty answer without also stripping
capability-gated UI from every user on a non-reporting deployment
(objectstack#8270) — the only way around it was a per-call-site "empty ⇒
treat as unreported" heuristic (`HomePage.tsx`'s `useCanAuthorMetadata`).

`systemPermissions` on `PermissionContextValue` is now `string[] | undefined`
(same shape `@object-ui/react`'s `useCapabilityGate` already uses for the
ADR-0066 D4 action gate), and `hasCapabilities` itself fails OPEN when it is
`undefined` and gates strictly on a reported empty array. The call-site
heuristic in `HomePage.tsx` retires in favor of the centralized signal.

Two more call sites that fed `systemPermissions` into the ADR-0066 D4 action
gate (`RecordDetailView`'s `resolveActionUser`, and the shell-level
`useConsoleActionRuntime`) used to default a loaded-but-`undefined` answer to
`[]` before forwarding it, which silently re-collapsed the same distinction
one layer down and gated every `requiredPermissions` action closed on a
non-reporting deployment instead of open. Both now forward the value as-is.
