---
'@object-ui/plugin-calendar': patch
---

`object-calendar` / `view:calendar` now DECLARE the last three spec-carried keys the renderer
already honoured — `data`, `staticData` and `loading` — so the html tier stops reporting working
metadata as `unknown-prop`. Each declared description names the POSITION the key is honoured at:
`data` replaces the calendar's own query, `staticData` is read below `data` and above `objectName`,
and `loading` is honoured only alongside an array `data` (objectui#8314, slice 2b of
objectui#8201). Every `object-calendar` key the spec declares is now discoverable.
