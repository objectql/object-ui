---
'@object-ui/app-shell': patch
---

The permission matrix honors `allowRuntimeCreate` — and its read-only badge names the gate that actually tripped

On a stock boot the permission-matrix editor rendered every checkbox disabled, hid Save, and captioned itself `Read-only (OS_METADATA_WRITABLE not enabled)` — in a **writable** package, at both the metadata-admin route and inside Studio's Access pillar — while the server accepted the very write it was refusing to offer (`PUT /api/v1/meta/permission/<n>?package=<pkg>` → 200, measured on objectstack#7637).

The editor's writability switch read `allowOrgOverride` alone. That flag and `allowRuntimeCreate` are two different doors: the first is permission to OVERLAY a code-shipped item per organization, the second is permission to AUTHOR an item at runtime — and authoring is what this editor's Save does under a `packageId` (`mode: 'draft'` + `packageId`, ADR-0086 P0/P2). The server refuses only when BOTH are false; `permission` sits in exactly the gap, `allowOrgOverride: false` (ADR-0005 forbids per-org overlay of a packaged permission set — silent privilege drift) with `allowRuntimeCreate: true`, which objectstack#6483 kept open deliberately. The switch now reads the disjunction, off the raw server entry, the way `DirectoryPage`, `EmbeddedItemEditor` and `ResourceEditPage` already read it and the way `useMetadata.ts` documents on the field itself.

The package-level gate is untouched and still dominant: a read-only package locks this screen whatever the type permits, so a code-defined package behaves exactly as before.

The badge and the controls also stop disagreeing, and the fix is what closed the gap rather than a second edit. `PageShell`'s writability badge was already reading the full disjunction (`readOnly` → `allowOrgOverride` → `allowRuntimeCreate`); the controls were the outlier, so the two predicates are now byte-identical and a four-state table pins them that way. Previously this screen showed a "create-only" badge above 207 dead checkboxes.

The read-only caption is honest in both directions now. `OS_METADATA_WRITABLE` was never the type gate's cause — that variable does not sit beside `allowOrgOverride`, it flips it (`getMetaTypes` emits `allowOrgOverride: base.allowOrgOverride || isEnvOverridden`), so there was no reachable state in which the old sentence was the right explanation: whenever the hatch is on for a type, that type is writable and no read-only badge renders. The caption now names the per-type registry declaration that actually locked the surface, and keeps the env var where it belongs — as the documented remedy, in the hint.
