---
'@object-ui/plugin-list': patch
---

`userFilters` tabs: the `allowAddTab` button now adds a tab instead of doing nothing (objectstack#5236)

The affordance `allowAddTab` renders had hover styling and `title="Add filter tab"` but no `onClick`, and `TabFilters` took no add-tab callback at all — a control that looked fully clickable and did nothing, which disguises "not implemented" as "a bug where clicking does nothing". That mattered more once objectstack#5073 promoted `allowAddTab` into the spec's `UserFiltersSchema`: the key became discoverable through JSON Schema, the Studio SchemaForm and the reference docs, so an author writing `allowAddTab: true` gets a declaration the runtime did not honour.

Clicking it now opens a small naming popover (the same Popover primitive the filter chips and the "More" overflow already use). Confirming a name adds a tab to the same bar as the presets, carrying a snapshot of the conditions applied at that moment, and selects it. Session tabs also carry a remove affordance; authored presets deliberately do not, since those are metadata. Removing the active session tab re-selects the author's default with the same precedence the initial mount uses, so the bar is never left with no active tab while the removed tab's conditions stay applied.

The new tab is **session-scoped, held in component state** — no `sys_metadata` write, no API call, no web storage, per ADR-0047 ("an end user's filter choices are session-scoped and never become metadata"). `sessionStorage` was available and deliberately not used: `UserFilters` receives no object or view identity, so any storage key it could invent would be shared by every list in the browser tab, surfacing one list's ad-hoc tabs on another's bar. Persistence beyond the mount, if ever wanted, belongs to the host that already owns the session channel for filter selections (`onSelectionsChange` mirrored into `uf_*` URL params) and can key it by view. The synthetic tab id is reported through `onSelectionsChange` like any other tab switch, so a host mirroring it into the URL hands it back on the next mount, where the existing id check finds no such tab and falls back to the author's default.

No public API change: `UserFiltersProps` is untouched, and `allowAddTab: false` / an omitted `allowAddTab` still render no affordance at all.
