---
"@object-ui/fields": patch
"@object-ui/data-objectstack": patch
"@object-ui/plugin-detail": patch
"@object-ui/plugin-form": patch
"@object-ui/components": patch
---

Setup permission sets: `system_permissions` is now a structured capability
multi-select instead of a raw JSON textarea (ADR-0056 P2, epic #2398).

A new `CapabilityMultiSelectField` (`field:capability-multiselect`) renders the
live `sys_capability` registry as scope-grouped, labelled chips with the
capability description on hover, and round-trips the value **byte-equivalent** to
the `sys_permission_set.system_permissions` storage (a JSON-string array of
capability names — parsed on load, `JSON.stringify(names)` on save). Unknown /
legacy names are preserved. The widget is stamped onto the field via a single
choke point (`ObjectStackAdapter.getObjectSchema`), so both the record form
(ObjectForm) and the detail-page inline edit (DetailView / DetailSection) show
the picker; the field's storage type is unchanged. First step toward retiring
Setup's permission JSON textareas in favor of structured Studio editors.
