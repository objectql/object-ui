---
'@object-ui/app-shell': patch
'@object-ui/console': patch
---

Register `approvals:inbox` as a component ref, and stop sending Home's "pending approvals" card into the setup app (objectstack#7231).

The Approvals Inbox had no addressable identity: nothing in any app's navigation metadata pointed at it, and every entry to it was a hardcoded path. `HomePage`'s action-center card spelled `/apps/setup/system/approvals`. That path is not wrong about the page — `system/approvals` is mounted as both `extraRoutes` and `extraRoutesNoApp`, so `/apps/{any app}/system/approvals` has always resolved — it is wrong about the app. A business user with approvals waiting but no access to `setup` followed the only entry Home offers them into the shell's "App not available" guard.

Two changes, one additive and one corrective:

- `approvals:inbox` now resolves in the component registry to the Approvals Inbox page, so a `{ type: 'component', componentRef: 'approvals:inbox' }` nav item renders the full inbox at `/apps/{app}/component/approvals/inbox` — tabs, drawer, decision actions and record deep links all scoped to `{app}`. Both mount paths are relative routes under `/apps/:appName/*`, so the page reads the same `:appName` and the same `?request={id}` deep link either way. The standalone `system/approvals` route is untouched and stays the target of server notification and email links; the registry key is purely additive indirection, so the approval surface can be rebuilt later behind the same key without any navigation metadata changing.
- The Home card now navigates within the app the user last had open, re-checked against their live active-app list so a remembered app that has since been deactivated is not resurrected as a dead link, falling back to their first available app. `setup` survives only as the last resort for an app carrying no addressable segment at all — the zero-app workspace never reaches this producer, because Home returns its welcome empty state before the action center exists.
