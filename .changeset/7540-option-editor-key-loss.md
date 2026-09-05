---
'@object-ui/app-shell': patch
---

fix(app-shell): the object-field options editor no longer drops `default` and `visibleWhen` on save

Opening a picklist field in the metadata-admin designer, editing any option and
saving used to write the option back without its `default` or `visibleWhen`
key. It was not a validation failure — the payload stayed perfectly valid, just
smaller than what the author wrote — so the loss was silent, and it took a
picklist default with it: `default` is `enforce` on the object-field face, and
the engine seeds the insert path from the option holding it.

The loss started in the reader, not the writer. `readOptions` projected each
authored option down to `value` / `label` / `color`, so both keys were already
gone before `patchOptions` ran. `readOptions` now carries the keys the editor
has no control for and `patchOptions` writes them back, which also protects any
option key the spec accepts later. No authoring UI changed.
