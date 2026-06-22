---
"@object-ui/components": patch
"@object-ui/types": patch
"@object-ui/plugin-form": patch
---

feat(components): metadata-derived field locators on generated forms (ADR-0054 Phase 4)

The form renderer now emits a stable `data-testid="field:{objectName}.{field}"`
(plus `data-field`) on every field wrapper, derived from the form's `objectName`
and each field's name — closing the locator gap at the source so every generated
form (`ObjectForm`/`ModalForm`/`DrawerForm`/`SplitForm`/`WizardForm`) inherits
testable fields with zero per-app work (ADR-0054 C4). `FormSchema` gains an
optional `objectName`; the object prefix is omitted (`field:{field}`) when a form
has none. `FormItem` now accepts `data-*` attributes.
