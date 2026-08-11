---
'@object-ui/app-shell': patch
---

fix(app-shell): the top-bar bell polls the inbox on every console surface, not only inside an app (#4110)

The bell's `sys_inbox_message` + `sys_notification_receipt` poll was gated on the
header's `isApp` variant flag — the flag that exists to hide the app-only presence
avatars and connection dot. The bell itself renders in every variant, so on Home,
Organizations and the full-page AI screen its Notifications tab held `[]` forever:
"Unread" read "You're all caught up" and "All" — which applies no predicate at all —
read "No notifications", while Home's own To-do card listed the same row from the
same object. The inbox is scoped to the signed-in user, not to the app in the URL,
so the poll is now scoped by `user?.id` only.
