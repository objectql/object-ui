---
"@object-ui/plugin-form": patch
---

`SimpleObjectForm`: consult a declared `submitHandler` before the inline-fields carve-out

`ObjectFormSchema.submitHandler` is documented as handing the collected values to the host INSTEAD of calling `dataSource.create` / `dataSource.update`, so a form that declares it has a submit target with or without an adapter. `SimpleObjectForm.handleSubmit` nevertheless opened with the inline-fields carve-out (`hasInlineFields && !dataSource`), which returned before the persistence chain: a host that had declared it owns the write was never asked, and `onSuccess` confirmed a write that never happened (measured `onSuccess 1 / submitHandler 0`).

The carve-out now fires only when no `submitHandler` is declared, and the "no submit target" refusal moved into the persistence chain after the seam — the shape the five variant renderers already use, reusing their shared refusal from `submitTarget.ts` rather than a private copy. A form with inline fields and no seam is unchanged: its `onSuccess` is still the write.
