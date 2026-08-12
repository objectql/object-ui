---
'@object-ui/app-shell': patch
---

console: an inaccessible landing app bounces to `/home` instead of stranding the user on a chrome-less page

Switching organization (and accepting an invitation, which switches as its last step) could land a `member` on `/apps/setup` rendering the bare "No apps configured" screen — no header, no navigation, no workspace switcher, and no way back except editing the URL by hand.

`GET /meta/apps` is filtered per session server-side, so an empty list means "nothing here is yours to open", not "this workspace has no apps". When the app surface has no app to enter, it now redirects to `/home`, which renders inside the shell chrome and already carries the copy for this state. A workspace admin still gets the first-run empty state with its create-app / system-settings actions, and a user with access to the app enters it exactly as before.
