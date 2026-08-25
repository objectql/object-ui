---
'@object-ui/data-objectstack': minor
'@object-ui/app-shell': minor
'@object-ui/plugin-list': patch
'@object-ui/i18n': patch
---

**View configuration is explicitly org-wide, and its write path is now gated (objectstack#7494's
ruling, maintainer 2026-08-12).** The `sort` / `hiddenFields` / `columnState` / `rowHeight` that a
list toolbar persists were never per-user: they are one shared row on the view, so an ordinary user
dragging a column or cycling density was re-styling that view for the entire organization. Nothing
in the console said so, and nothing stopped it. A per-user scope stays parked (objectstack#7611,
v18) and is deliberately not built here — which is precisely why the write has to be gated rather
than narrowed: there is no second, private store for it to fall back to.

`ObjectStackAdapter.updateViewConfig` now refuses when the session's **reported** ADR-0066 capability
set does not contain `manage_metadata`, throwing the new `ViewConfigPermissionDeniedError`
(`VIEW_CONFIG_PERMISSION_DENIED`, with `isViewConfigPermissionDeniedError` and the
`VIEW_CONFIG_CAPABILITY` constant alongside it). The gate is the **first** statement in the method —
before `connect()`, before the payload is assembled — so a refused call puts nothing on the wire.
It is on the write rather than on the toolbar button on purpose: withholding the affordance would
leave the method still accepting the call from anything else holding the adapter, whereas a gate on
the write is inherited by every caller, present and future.

`manage_metadata` is not a newly minted name. It is the capability this repo already treats as
metadata-authoring authority — `HomePage`'s `AUTHORING_CAPABILITY`, the one the server itself
refuses metadata writes without — and the gated write goes through `client.meta.saveItem`, the very
same ADR-0005 metadata door, so this applies the authority the server is already applying instead of
inventing a parallel one.

**Unknown fails open, by doctrine.** A capability set that was never reported (a backend predating
ADR-0066, or no permission provider mounted) is not a denial: the server enforces regardless, so a
client-side refusal on missing data cannot protect anything and can only break a permitted user. A
*reported* empty grant gates strictly. Hosts push the session's capabilities in with the new
`setSystemCapabilities`; `ObjectView` wires it from `usePermissions()`.

The refusal is also **said out loud**. `ObjectView`'s persist path previously swallowed every failure
into `console.error`, which for a debounced toggle whose UI has already moved would have left the
operator looking at a density they did not get; a denied write now raises a toast. And the "View
settings" popover — where density and field visibility are actually changed — now states the scope
before the operator acts: *"Grouping, color, density, and visible fields. Applies to everyone who
uses this view."*, translated in all ten packs.
