---
'@object-ui/console': patch
'@object-ui/app-shell': patch
---

Send the console host's legacy URL redirects straight to the canonical metadata-admin routes instead of routing them through the deprecated `component/metadata/resource` alias (objectui#3639).

`apps/console`'s `ObjectRedirect` and `MetadataRedirect` rewrote `system/objects[/:name]` and `system/metadata[/:type[/:name]]` onto `…/component/metadata/resource[/:name]?type=:type`. app-shell declares that spelling as a legacy *alias*, not a page: its route element is `LegacyMetadataRedirect`, which immediately navigates on to `…/metadata/:type[/:name]`. Every one of those URLs therefore took two `<Navigate>` hops (plus a re-render) to reach a destination the host could name directly — and it was this indirection that carried `sys-objects` into the zero-app blank screen fixed in objectui#3610, since the alias was the leg that branch did not recognise.

Both redirects now construct `…/metadata/:type[/:name]` (and `…/metadata` for the typeless directory arm) themselves. The endpoints are unchanged, byte for byte, including the alias hop's own percent-encoding of `:type` and its verbatim pass-through of `:name`; only the intermediate hop is gone. The alias routes stay declared exactly as they were — bookmarks, external links and the setup left-nav still arrive on them and are still forwarded — this change only stops the console feeding its own traffic through them.

Also corrects four docblocks that described the alias as "the engine route", in `apps/console`'s two redirects and in app-shell's `datasource` resource registration and page. That wording is not merely stale: the objectui#3610 dispatch read this chain and concluded `component/metadata/resource` was the canonical spelling, which is the exact opposite of what the route table says.
