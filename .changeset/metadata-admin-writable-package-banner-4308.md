---
'@object-ui/app-shell': patch
---

metadata-admin stops declaring an object "provided by an installed package" when it lives in a writable package

For an object published into a **writable** package, three surfaces disagreed about whether it could be edited: the metadata-admin designer showed the artifact lock banner — _"This object is provided by an installed package, so it is read-only at runtime. To change it, edit it in its source package and republish"_ — while Studio presented the same object as editable and the server accepted the PUT. The banner asserted a lock nothing enforced, so an operator who believed it went off to republish a source package for a change they could have made in front of them.

The cause was the tier test this page uses to pick between the two-tier authorization gates: overlaying a code-shipped artifact needs `allowOrgOverride`, authoring org content needs only `allowRuntimeCreate`. It asked whether a `code` layer exists and is not tagged with the `sys_metadata` sentinel — and an org-authored item satisfies both, because boot-time rehydration of `sys_metadata` re-registers each row under its **real** package id. `object` is precisely the type where the two gates diverge (`allowOrgOverride: false`, `allowRuntimeCreate: true`), so the mis-tiering surfaced as a hard lock.

The page now also asks ADR-0010 `provenance`, which the server already ships on the layered envelope and which is the axis that actually separates tenant-authored content from code-shipped artifacts. This is not a new opinion about writability: the framework was bitten by the identical read and fixed it the same way (`isTenantAuthored`, cloud#970 — an app the user had just built went un-editable at the first kernel rebuild); this page still carried the pre-cloud#970 spelling. The two in-place copies of the test, which is how they drifted apart in the first place, are now one derivation.

Nothing was loosened. A genuine code package still reports `provenance: 'package'` and stays read-only here, per the objectui#4036 ruling — "a code-defined package is read-only; customize in a writable package" is one rule, and this only stops it firing on packages that are not code-defined. An item with no provenance stamped (older server) keeps the conservative artifact reading rather than unlocking on a missing field, matching the `lock` flags beside it. The suite pins both directions: the banner is gone for a writable package and the form is genuinely editable, and it is still rendered for a code package, for the legacy `sys_metadata` sentinel, and for an unstamped item.

The banner wording is unchanged — it is now shown only where it was always accurate.
