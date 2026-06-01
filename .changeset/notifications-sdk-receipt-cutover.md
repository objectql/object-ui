---
'@object-ui/react': patch
---

Repoint `useClientNotifications` to the ADR-0030 `@objectstack/client` surface

The `useClientNotifications` bridge hook called `client.notifications.*` with
signatures that no longer exist on `@objectstack/client@7.x`:

- `registerDevice(token, platform)` → the SDK takes a single
  `RegisterDeviceRequest` object (`{ token, platform }`).
- `markAsRead(id)` → there is no single-id method; the SDK exposes
  `markRead(ids: string[])`. The hook keeps its friendly single-id API and
  adapts to the batch call.

These helpers are the stable transport contract for ADR-0030 (Notification
Convergence): server-side they route to the L5 `sys_inbox_message`
materialization and the `sys_notification_receipt` read-state spine — the
re-modeled `sys_notification` L2 event no longer carries recipient/read
columns. (The Console bell itself reads the inbox + receipts directly via the
generic data API; see the `@object-ui/app-shell` bell cut-over.)

## Cut-over sequence (operational — run in this order)

The Console UI repoint must land together with the framework pipeline **and**
the data migration so the bell is never blank and read-state is never lost:

1. Deploy the framework ADR-0030 change (objects + `emit()` + producers). New
   notifications now land in `sys_inbox_message` + `sys_notification_receipt`.
2. Run the data migration **once** to carry existing notifications across —
   `migrateSysNotificationToEvent({ driver, data })` from
   `@objectstack/metadata/migrations`. It splits each legacy `sys_notification`
   inbox row into a `sys_inbox_message` + receipt, rewrites the row to the event
   shape, and clears the legacy columns. It is **idempotent** and reports
   `not_applicable` on fresh installs. This runs against the ObjectStack
   **server/data engine** — it is not a Console (frontend) step.
3. Deploy the objectui repoint (this change + the `@object-ui/app-shell` bell
   cut-over).
