---
'@object-ui/fields': minor
'@object-ui/plugin-kanban': patch
---

`FieldEditWidget` now delivers the NON-DOM half of the contract it declares (objectui#7008).

objectui#7009 made the factory forward its declared DOM pass-through block. The rest of
`FieldWidgetComponentProps` was still dropped: `error`, `onUploadingChange`, and the whole
"Host plumbing" block (`dataSource`, `dependentValues`, `dependsOn`, `dependsOnLabels`,
`emptyHint`, `onSelectRecord`, `onCreateNew`). A host could pass any of them with no type
error and the widget never received it — the "declared but not delivered" class this
package treats as first-class.

`error` was the live one. `InlineFieldInput` has passed `error` into this factory since
PR #7109 and the factory dropped it, so an inline-edit control that had failed validation
never reported `aria-invalid`: a sighted user saw the red hint, a screen-reader user was
told nothing. The kanban `RequiredFieldsDialog` had the same hole from the other side — it
computes the validation state and could not hand it over — and now passes `error`, so its
controls are marked. Delivering `error` buys the a11y MARKING only; the message text stays
with the host, per the objectui#3222 contract.

The keys travel through a new sibling executor, `toHostProps` (exported alongside
`toDomProps`), never through the DOM whitelist — none of them is DOM-legal, and routing a
`dataSource` adapter there is the `[object Object]` leak that whitelist exists to stop.
Three compile-time assertions make the two executors partition the contract, so a future
declared key cannot go undelivered silently.

`dataSource` precedence is stated rather than left to emerge: a host's explicit
`dataSource` prop WINS over `SchemaRendererContext`. That is the order `LookupField`
already implements; the factory is a conduit and resolves nothing. A host that passes no
`dataSource` keeps reading the context exactly as before, so no in-repo host changes
behaviour.
