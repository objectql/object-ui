---
'@object-ui/plugin-kanban': minor
'@object-ui/i18n': patch
---

Kanban: a drop that makes fields required now collects them instead of dead-ending

Dragging a card into a column whose value flips a field's `requiredWhen` predicate to TRUE used to PATCH the column value alone. The engine refused the whole update — correctly, that is what the predicate declares — and the board had no way to finish the move: the only path to closing a won deal was to abandon the board and open the record form. HotCRM's opportunity pipeline is the reported case (`win_reason` is required when `stage == "closed_won"`), but the dead end belonged to every board whose target column carries a conditional requirement.

The board now evaluates the target column's predicates BEFORE writing anything. If the move would make fields required while they are still empty, it opens a small dialog collecting exactly those fields, then submits the column value and everything collected as ONE PATCH — never two writes, which would leave the record in the refused state if the second one failed. A drop that triggers no predicate is untouched, down to the PATCH body.

The verdict comes from `@object-ui/core`'s `resolveFieldRuleState` — the same evaluator the record form, the wizard and the line-item grid already resolve `visibleWhen`/`readonlyWhen`/`requiredWhen` with, delegating to `@objectstack/formula`'s CEL engine. The board's prompt and the server's enforcement therefore reach the identical verdict rather than drifting through a second hand-rolled predicate evaluator. Emptiness is core's `isMissingForRequired`, the presence contract the form and the server share, so a `false` boolean and a `0` count as answers and are not re-asked.

Every control in the dialog is `@object-ui/fields`' `FieldEditWidget`, the same widget the record form renders for that field type — a select edits as a select, a date as a date picker — so this adds no second set of field-rendering decisions.

Four kinds of field are deliberately NOT collected, and each falls through to the unchanged PATCH where the server's refusal (legible since objectstack#7525) speaks for itself: one that already has a value, one `visibleWhen` hides, one that is readonly, and one whose type has no edit widget at all. A dialog row with no control would be a worse dead end than the one being fixed.

Cancelling writes nothing and leaves the card in its original column; a combined PATCH that is still refused for some other reason surfaces the refusal and rolls back exactly as a plain rejected move does, rather than looping the dialog on an arbitrary server error.

`@object-ui/i18n` carries two new `kanban.*` strings for the dialog, translated across all ten packs. Its public type surface is unchanged — the `.d.ts` was measured identical before and after — hence the patch bump.
