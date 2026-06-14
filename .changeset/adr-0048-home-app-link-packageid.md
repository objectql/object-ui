---
"@object-ui/app-shell": patch
---

ADR-0048: the console **home** page now links into apps by their canonical
package-id route segment, matching the nav. The app grid (`HomePage`) and the
"add to favorites" href (`AppCard`) were still building `/apps/<app.name>` while
the sidebar/switcher/command-palette emit `/apps/<packageId>` (via
`appRouteSegment`). So opening an app from the home page produced a name-form URL
(e.g. `/apps/studio`) instead of `/apps/com.objectstack.studio`. Both now use
`appRouteSegment(app)`.
