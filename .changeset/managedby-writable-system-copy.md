---
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

**Distinguish writable `system` objects from engine-owned ones in the Console (framework ADR-0103 / #3220).** The framework split the overloaded `managedBy: 'system'` bucket: engine-owned rows stay read-only, but several `system` objects are admin/user-writable *data* (Notification Preferences/Subscriptions/Templates, delegated RBAC assignments, user preferences) and declare `userActions` opening their writes.

The Console already surfaced the New/Edit/Delete buttons correctly for these (all affordance mirrors honour `userActions`), but the badge and empty-state *copy* still called every `system` object a "read-only monitoring surface". Now:

- **`ManagedByBadge`** takes the object's `userActions` and, when a `system` object opens any write, renders the "Platform schema — admin-writable" variant instead of the engine-owned copy.
- **`resolveManagedByEmptyState`** returns `undefined` for a `system` object whose `userActions.create` is set, so the generic empty state (with the New button) shows instead of "entries appear automatically".
- New `managedByBadge.systemWritable.*` strings (en + zh; other locales fall back to the English default).

Copy/UX only — no behavioural change to what a user can do.
