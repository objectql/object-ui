---
"@object-ui/app-shell": patch
---

fix(metadata-admin): drop the SkillPreview "Required Permissions" panel (framework#3686)

Upstream removed `SkillSchema.permissions` — skill invocation was never gated by
it. Showing a "Required Permissions" section (and a "N required perms" header
pill) for an unenforced list taught the wrong model: access is gated at the
AGENT (`access`/`permissions`, enforced at the chat route) or on the underlying
actions the skill's tools call.
