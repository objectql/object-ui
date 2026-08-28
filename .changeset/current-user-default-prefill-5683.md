---
'@object-ui/permissions': minor
'@object-ui/plugin-form': minor
---

Create forms pre-fill the `current_user` defaultValue token with the acting user (#5683). `PermissionContextValue` gains `userId` (from `/me/permissions`; `null` = unknown), and the create-form seeding resolves `defaultValue: 'current_user'` on `user` / `lookup→sys_user` fields to that id — the same value the engine stamps at insert, so the pre-fill is a preview of the server's own resolution, not a second default contract. Unknown user (no provider / anonymous / role-based provider) seeds nothing and keeps the omit-and-let-the-engine-resolve behavior. `NOW()` and CEL defaults stay server-owned.
