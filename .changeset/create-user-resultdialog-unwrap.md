---
"@object-ui/app-shell": patch
---

Fix "Create User" (and set_user_password / enable_two_factor /
create_oauth_application) result dialogs rendering an empty email + temporary
password: the console `apiHandler` now unwraps the `{ success, data }` response
envelope so `resultDialog` field paths resolve against the inner `data`,
matching `flowHandler` / `serverActionHandler` and the documented "path into
`data`" contract. Paired with framework#2842 (objectui#2396).
