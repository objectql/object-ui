---
'@object-ui/app-shell': minor
---

Studio Data tab: metadata-driven config panels for Validations, Hooks and Actions (with add).

The object **Validations**, **Hooks** and **Actions** sub-tabs are now no-code config panels driven by the corresponding metadata, each able to **create** new entries:

- **Validations** — the panel covers every spec rule type, not just `script`: `cross_field`, `state_machine`, `format`, `json_schema` and `conditional` are all authorable (previously they were read-only "maintain in code"). The **New** menu adds any type seeded with a valid, never-firing skeleton, and a rule's type can be switched in place; CEL predicates reuse the shared `ConditionBuilder`.
- **Hooks** — a new curated `HookDefaultInspector` replaces the flat generic form: the target object is an **object picker** (multi-select + `*`, not a free-text box), lifecycle events are grouped checkboxes, and the handler is a **dedicated code editor** (language + body). Advanced props fall through to a `SchemaForm` fed the live `hook` JSONSchema from `/meta/types`.
- **Actions** — the `ActionDefaultInspector` now receives the live `action` JSONSchema as `serverSchema`, so its "More fields" section can edit any spec property not curated above (nothing is un-editable).

`DataPillar` resolves the per-type schemas once (via `useMetadataTypes`) and passes them down.
