---
'@object-ui/plugin-grid': patch
'@object-ui/core': patch
---

The bulk-action dialog's "this widget needs a DataSource" rule now derives from the shared reference-field family instead of a fourth private copy.

`packages/plugin-grid/src/components/bulkParamToField.ts` held its own
`DATA_SOURCE_WIDGET_TYPES` — the fourth hand-maintained answer to one question
("which widget has to query records, so it must be handed a DataSource and a
`reference_to`"), and the only one whose member set matched none of the other
three: `lookup` / `master_detail` / `user`, against `@object-ui/core`'s
`EXPANDABLE_FIELD_TYPES` (which also holds `tree`) and the object form's rule
(which adds three widget-hint pickers). Nothing anywhere could detect the drift;
the same shape objectui#4770 and objectui#4790 each closed on another surface.

It now reads core's set through one predicate, so all three consumers of the rule
— the label prefetch / option source (`isLookupishParam`), the `dataSource` prop
the dialog threads into the widget (`fieldNeedsDataSource`), and the
`reference_to` / `display_field` branch of `bulkParamToField` — cannot drift apart
from each other or from the form again.

No behaviour change on any reachable path, which is why this is a patch. The one
member the two tables differed on, `tree`, can never be a widget key on this
surface: it is absent from the fields widget map and `mapFieldTypeToFormType`
sends it to `field:lookup`, so a `tree` param arrives at the rule as `lookup`
(pinned). The divergence in the other direction is deliberately preserved: the
form additionally wires `object-ref` / `filter-condition` / `recipient-picker`,
widget hints no object schema can declare and no bulk param produces — absorbing
them would change which widgets receive a DataSource here, which is a behaviour
change and not a convergence.

The pin is an identity pin, not a membership one: it spies on the `has` of the
Set object core exports, so a member-identical private copy fails it. A
value-equality assertion would have passed against exactly the defect this
change removes.
