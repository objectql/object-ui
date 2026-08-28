---
'@object-ui/plugin-dashboard': patch
---

`DashboardRenderer` no longer emits an empty dashboard header wrapper. The
wrapper used to render whenever `header` was declared, while each of its
children — title, description, actions — was additionally suppressible. With
the console page chrome present (`hideHeaderText`, set because the chrome
already renders the dashboard's title and description) and no `header.actions`,
every child evaluated falsy and the DOM still received
`<div class="col-span-full mb-4"></div>`: zero children, yet a full grid row
(measured 64px) plus `mb-4` of dead band above the filter bar, on every console
dashboard page (objectui#5812, measured on HotCRM 17.1.0).

The three children are now computed first and the wrapper renders only if one
of them survives. Nothing else changes: a standalone embed (no chrome) renders
title and description exactly as before, and declared `header.actions` keep the
wrapper alive even under the chrome, since the chrome renders text only. Authors
needed this — dropping `header` from the metadata to reclaim the pixels would
have cost the standalone embed its title, which is what `header` is for.
