---
"@object-ui/fields": patch
"@object-ui/plugin-grid": patch
"@object-ui/app-shell": patch
---

fix(fields): retire the `owner` field-type alias with a loud tombstone

`owner` was a synonym for `user` with zero behavioral delta — both resolved to
the same `UserField` widget — and it is not a member of `@objectstack/spec`'s
closed `FieldType`, so no object schema could ever declare it. It was reachable
only through hand-written SDUI, and the three code faces that read it had
already drifted apart on the word: the form's data-source rule excluded it,
while plugin-grid's bulk-action dialog and app-shell's `paramToField` included
it.

The retired spelling now fails **loudly**. Deleting the alias on its own would
have been absorbed by two silent tails (`mapFieldTypeToFormType`'s
`|| 'field:text'` and `resolveFormWidgetType`'s `: 'text'`), each handing back a
working plain text input with no check turning red — so anyone who had written
`type: 'owner'`, including an AI author copying it out of a doc, would have
shipped a text box believing they shipped a person picker. Instead:

- `type: 'owner'` and `widget: 'field:owner'` both resolve to a registered
  tombstone widget that renders a visible refusal naming the migration;
- the same prescription is written to the console once per spelling;
- the read/cell path degrades to the text cell deliberately and says so.

Migration: write the record-owner field as `{ type: 'user', name: 'owner' }` —
the field NAME carries the ownership meaning, the type carries the widget.
`UserField` and `UserCellRenderer` are unchanged; only the synonym is gone.

Also corrects the `dataSource` TSDoc in `@object-ui/fields`, which listed `grid`
among the widgets the form renderer wires a DataSource to. `GridField` never
read `dataSource` and no data-source table ever contained the key.
