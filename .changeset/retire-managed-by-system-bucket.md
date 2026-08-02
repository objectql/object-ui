---
"@object-ui/types": minor
"@object-ui/core": minor
"@object-ui/app-shell": minor
---

feat!: follow the framework's `managedBy: 'system'` → `'system-data'` retirement (objectstack#3355)

**FROM → TO: `managedBy: 'system'` → `managedBy: 'system-data'`.** The framework
retired the residual `system` bucket in protocol 17; this is the UI half of that
change, landing with it so the closed `ManagedByBucket` union stays a mirror
rather than a fork.

ADR-0103 split the overloaded `system` bucket additively in v16 — the
engine-owned objects moved to the explicit `engine-owned`, the admin/user-writable
ones stayed on `system` — which left that value named after the half that had
already moved out. `system-data` names what it actually holds: the SCHEMA is the
platform's, the DATA is the admin's or the user's.

**The derivation this deletes is the point.** Because v16's `system` doubled as
both the engine-owned default and the writable set, three UI surfaces had to
RECOVER the distinction from `userActions` at render time:

- `isSystemWritable()` probed `userActions` for any opted-in write. It is now
  `managedBy === 'system-data'` — the bucket answers directly.
- `ManagedByBadge` derived a synthetic `'system-writable'` variant key. The
  variant map is now 1:1 with the bucket union, so a new bucket is a compile
  error to miss instead of a silent fallthrough. The `systemWritable` /
  `system` i18n keys are **unchanged**, so no locale bundle moves.
- `resolveManagedByEmptyState()` asked the resolved `create` affordance whether a
  `system` list should read "entries appear automatically" or show the New
  button. `system-data` now falls through to the generic empty state by
  definition; `engine-owned` keeps the automatic-entries copy.

**Breaking (UI API):** `ManagedByBadge`'s `userActions` prop and the exported
`ManagedByUserActions` interface are **removed**. The bucket alone selects the
variant now, so the prop had become metadata nothing read — the exact defect the
framework change exists to remove; shipping it as an accepted-but-ignored prop
would have reproduced it one layer up. Drop the prop from call sites; no other
change is needed.

`MANAGED_BY_BUCKETS` and `ManagedByBucket` no longer contain `'system'`.
