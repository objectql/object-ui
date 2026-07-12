---
"@object-ui/app-shell": patch
"@object-ui/plugin-detail": patch
"@object-ui/data-objectstack": patch
"@object-ui/fields": patch
"@object-ui/plugin-form": patch
"@object-ui/components": patch
---

Permission sets — pure separation of **design** (Studio) and **assignment**
(Setup), per ADR-0056 / epic #2398. A `sys_permission_set` used to render its six
authorization facets in Setup as raw `[Object]` / JSON textareas, and only
objects+fields were editable in Studio; this reworks both surfaces.

**Setup (assign + read-only):**
- The six facets (`object_permissions`, `field_permissions`, `system_permissions`,
  `row_level_security`, `tab_permissions`, `admin_scope`) now render read-only on
  the `sys_permission_set` record page as a compact summary (counts, or capability
  chips) plus a **“Design in Studio →”** deep-link into the structured editor
  (`/apps/:appName/metadata/permission/:setName`, env scope). No `[Object]`, no
  JSON — in the record view, inline edit, and the create/edit form. Implemented as
  a `permission-facet-link` field widget stamped onto the six fields via the single
  `ObjectStackAdapter.getObjectSchema` choke point and honored by DetailSection +
  the record form.
- User assignment (add/remove via `sys_user_permission_set`) is surfaced directly
  on the Setup record page.

**Studio (design every facet):** the permission matrix editor gains structured
editors for the facets that were JSON-only —
- **System Capabilities**: a multi-select over the live `sys_capability` registry
  (scope-grouped, labelled chips).
- **Row-Level Security**: per-policy rows (object · operation · enabled) with CEL
  USING/CHECK.
- **Tab Visibility**: per-tab `visible | hidden | default_on | default_off`.
- **Delegated Admin Scope**: business-unit + subtree, manage-assignments /
  -bindings / author-env-sets toggles, and an assignable-permission-sets allowlist.
Assignment was moved out of the editor (it is now a Setup act) — the editor is
purely a design surface.

Storage/types are unchanged; editors read/write the draft’s existing parsed
fields and tolerate legacy JSON strings on load. Note: env-scope metadata saves of
these facets do not yet project onto the queryable `sys_permission_set` data
record the Setup summary reads, so a fresh Studio edit isn’t reflected in Setup’s
read-only view until the projection refreshes — tracked as a framework follow-up
(enforcement reads the authoritative metadata).
