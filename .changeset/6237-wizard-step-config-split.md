---
'@object-ui/plugin-form': patch
---

Split `WizardStepConfig` off `FormSectionConfig`, and correct the section-predicate
support table (objectui#6237, maintainer ruling 2026-08-30).

`WizardForm` typed its steps as `Omit<FormSectionConfig, 'visibleWhen'>` — a
subtraction from the TabbedForm section type, which is the predicate-CARRYING
type. That defended the one key it named and left the mechanism open: every key
added to `FormSectionConfig` reached a wizard step by default, so the next
predicate in the same family (`readonlyWhen` / `requiredWhen`, already this
package's field-level vocabulary) would have handed the wizard a silent slot its
renderer does not read — the declared-but-unenforced shape the ruling split the
types to stop.

`WizardStepConfig` is now declared independently in `WizardForm.tsx`, which is
simply what `SplitFormSectionConfig`, `ModalFormSectionConfig` and
`DrawerFormSectionConfig` already do: each layout owns its group shape, documents
`className` / `gridClassName` in its own terms, and declares `visibleWhen` only
where its renderer honours it. The derivation flips from subtractive to additive
— a key is authorable on a wizard step only if someone writes it there.

No behaviour change and no key added or removed: `WizardStepConfig` exports the
same key set it already had, and `visibleWhen` on a wizard step literal was, and
remains, a compile error. What is new is that it stays one for the whole
predicate family, pinned by a type-level assertion that fails the build if any
`*When` key ever appears on the step type.

Documentation repair in the same stroke: the support table in the README and in
`content/docs/plugins/plugin-form.mdx` still said `formType: 'tabbed'` sections
drop the predicate. That stopped being true when the tabbed arm landed — the row
now reads **Yes**, the surrounding prose no longer claims two inert arms or a
diagnostic that fires for `tabbed`, and the wizard row stays **No**, which is
still exactly true.
