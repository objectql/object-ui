---
'@object-ui/app-shell': patch
---

A row-level-security policy authored under a package is now saved — Studio's package door carries every facet the permission editor can author

Opening the Access pillar inside a writable package, adding an RLS policy (name, object, USING, CHECK) and clicking a fully-enabled Save produced a 200, a success toast, and no row filter anywhere. The PUT body was `{"name":…,"label":…,"objects":{},"fields":{}}` — the `rowLevelSecurity` key was not on the wire at all, so the record read back after publish carried no policy while the surface still showed one. Tab visibility and the delegated-admin scope were reverted the same way. A silent revert is worse than a refusal here: the admin is left with positive, false evidence that a control is in place.

`mergePermissionSlice` — the package door's save path (ADR-0086 P0) — rebuilt the record from a freshly-read base and took only `name`, `label`, `isDefault`, `objects` and `fields` from the editor. Every other facet came from the server's stored copy, whatever the author had just typed. The whitelist was correct when it was written and then drifted: `rowLevelSecurity`, `tabPermissions` and `adminScope` became authorable afterwards and nothing said so.

The rule is now inverted rather than extended by four more names: a facet the editor can author comes from the edited draft, and the freshly-read base supplies only what the editor cannot author. The package scoping that P0 actually needs is `objects` / `fields` and nothing else — the load path narrows exactly those two maps and hands every other facet to the editors unscoped — so other packages' contributed rows are still preserved byte-for-byte by the same row-level merge as before. A facet the edited body does not carry at all still comes from the base: absence means "this caller does not model the facet", never "the author cleared it", and clearing still persists as clearing because the facet editors always write a value (an emptied policy list is `[]`, not a missing key).

Drift cannot recur silently. A structural guard scans the editor sources for the keys their `setDraft(...)` updaters write into the draft and fails when one of them is not carried by the slice, so the next facet added to the editor reds in CI instead of being discarded on Save. The environment door, which was never affected, is pinned unchanged as a guard, and the pins assert the saved body rather than the toast — a 200 is exactly what this defect already produced.
