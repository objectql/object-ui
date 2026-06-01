---
'@object-ui/app-shell': minor
---

Repoint the Console bell to `sys_inbox_message` + `sys_notification_receipt` (ADR-0030)

The notification bell read the legacy `sys_notification` object's
`recipient_id`/`is_read`/`title`/`body` columns. ADR-0030 re-modeled
`sys_notification` into the L2 *event* (no recipient/read-state), so the bell
returned nothing — every notification the new pipeline produced was invisible.

The bell now reads the L5 in-app materialization instead:

- **List**: `sys_inbox_message` filtered by `user_id` (the `mine` scope), 20
  most-recent, ordered by `created_at`.
- **Read-state**: joins `sys_notification_receipt` (filtered by `user_id` +
  `channel:'inbox'`). A message is unread until its event has a
  `read`/`clicked`/`dismissed` receipt; the unread count drives the badge.
- **Mark-read**: `UPDATE`s the existing `delivered` receipt to `read`
  (keyed `(notification_id, user_id, channel)`), inserting only as a fallback
  when no receipt exists. Replaces the old `sys_notification.is_read` write.
- **Navigation**: follows the materialization's `action_url` (absolute,
  `/apps/...`, or app-relative `/{object}/{id}`), falling back to the legacy
  `source_object`/`source_id` pointer.
- **"View all"**: routes to `/apps/setup/sys_inbox_message?view=mine`.

Pairs with the framework ADR-0030 pipeline (`@objectstack/service-messaging`).
Verified in-browser (showcase Console): a materialized inbox message + its
`delivered` receipt lit the bell badge; the popover rendered the row;
"mark all read" flipped the receipt to `read` in place (no duplicate) and
cleared the badge.
