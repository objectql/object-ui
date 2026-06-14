---
"@object-ui/app-shell": patch
---

fix(app-shell): send the current-page object to the AI assistant context

The floating console assistant forwarded only `appName` + the full objects list,
never the object the user is actually viewing — so asking it to "analyse this
object" (especially in a non-English prompt) gave the agent nothing to anchor on
and it replied that it couldn't find the object. The current object/record are
now derived from the route (mirroring `useTrackRouteAsRecent`'s URL layout,
tolerant of a `_console` shell prefix) and passed as `context.objectName` /
`context.recordId`, so the backend injects that object's schema into the system
prompt and scopes data queries to it. Pairs with the framework current-object
resolution fix.
