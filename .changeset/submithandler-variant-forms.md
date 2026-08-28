---
"@object-ui/plugin-form": patch
---

Honour the declared `submitHandler` seam in every form variant, not just the simple one.

`ObjectFormSchema.submitHandler` is documented as the seam a host uses to own persistence: the form validates and hands the collected values over instead of calling `dataSource.create` / `dataSource.update`. `ObjectForm` forwarded the key into every variant it routes to, but only `SimpleObjectForm` read it — `TabbedForm`, `WizardForm`, `SplitForm`, `DrawerForm` and `ModalForm` persisted directly.

**Behaviour change on a persistence path.** A master-detail parent half rendered `tabbed` (or `split`) now commits through the atomic `batchTransaction` together with its child collections, instead of writing the parent independently through `dataSource.create`. Previously the child leg was never attempted on those layouts: the parent was committed alone, the entered line items were silently discarded, no compensation ran, and a success toast confirmed the save. A failing child leg now leaves no committed parent, on every layout that renders the parent half inline.

`WizardForm` additionally skips its own default success toast / redirect arms when a `submitHandler` is present, matching `ObjectForm`, so a host that owns the write also owns the outcome.

The `object-master-detail-form.formType` vocabulary is unchanged and stays `simple | tabbed`.
