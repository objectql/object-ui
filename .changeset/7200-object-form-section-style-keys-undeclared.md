---
'@object-ui/types': minor
---

`ObjectFormSection` no longer declares `className` / `gridClassName` (objectui#7200 —
the declared-but-inert remainder of objectstack#13626).

**Breaking, deliberately.** A TypeScript literal annotated `ObjectFormSection` (or an
`ObjectFormSchema.sections` entry) that carries `className` or `gridClassName` is now a
compile error at the authoring site. Before this change the two members were declared
with doc comments promising a wrapper / grid class, while — since objectstack#13626
retired the seven renderer reads (`@object-ui/plugin-form` 2026-09-01) — nothing
delivered it: an author could write either key, have it type-check, and get nothing.

The authored-metadata type now agrees with `@objectstack/spec`, whose `FormSectionSchema`
is a strict object declaring neither key, and with the ruling's rationale (maintainer
2026-09-01, verbatim): "retire the reads … Declaring the keys was weighed and not adopted:
it would formally invite free Tailwind strings into authored metadata, the exact class
the boundary exists to keep out." A `?: never` tombstone was not used: `ObjectFormSection`
has no zod mirror (`ObjectFormSchema` in `zod/objectql.zod.ts` does not declare
`sections`), so there is no parse door to refuse at, and a tombstone is still a
declaration in completion and in the published `.d.ts`.

**Not changed.** The five per-layout section config types in `@object-ui/plugin-form`
(`ModalFormSectionConfig`, `SplitFormSectionConfig`, TabbedForm's `FormSectionConfig`,
`WizardStepConfig`, `DrawerFormSectionConfig`) keep their `className` / `gridClassName`:
their renderers read them for programmatic React mounts, which the authorable boundary
does not govern. The form ROOT `className` (`ObjectFormSchema.className`) is a different
key on a different node and is unaffected. Runtime behaviour is unchanged — JSON metadata
carrying either key was already ignored.

**Migration.** Remove the two keys from any `ObjectFormSection` literal; they did nothing.
Style sections through the host application's own CSS or the form ROOT `className`.
Section *layout* stays authorable through `columns`.
