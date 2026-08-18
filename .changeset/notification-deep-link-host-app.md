---
'@object-ui/app-shell': patch
---

Notification deep links now open the record instead of the app landing page.

A notification's `action_url` is app-relative by contract — the messaging
service synthesizes `/{object}/{id}` from the event's source (ADR-0030 L5), so
it names a record and the console has to host it under an app. Home's action
centre navigated the field verbatim, and the top-bar bell navigated it bare on
every surface that mounts outside `/apps/:appName/*` (`/home`, `/organizations`,
the full-page AI screen). Either way the path matched no route, so the console
catch-all forwarded it to `/` and the landing resolver dropped the user on the
default app's home — with the notification already marked read, which destroyed
the pointer to the record rather than merely misdirecting it.

Both surfaces now resolve the target through one shared helper, which reuses the
same host-app resolution the inbox and activity drills already use, leaves an
explicit `/apps/...` target untouched, and opens off-console links in a new tab
instead of routing them.
