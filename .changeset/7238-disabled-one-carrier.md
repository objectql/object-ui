---
"@object-ui/components": patch
---

fix(components): eight widgets now consume `SchemaRenderer`'s evaluated `disabled` verdict instead of re-reading the raw authored key

`disabled` on a schema node is `boolean | string` — the string being a predicate. `SchemaRenderer` evaluates `disabled` / `disabledOn`, strips the raw key from the props it spreads, and forwards the answer as a real `disabled` prop. `ui:form`, `ui:button`, `ui:input`, `ui:textarea`, `ui:checkbox`, `ui:select`, `ui:combobox` and `ui:collapsible` re-read the raw key beside that verdict, and an expression string is truthy however it evaluates.

Two user-visible defects go away:

- `ui:form` — a form declaring `disabled: "${...}"` greyed out every field, the submit button and the cancel button even when the predicate was FALSE.
- `ui:button` — `loading: true` did not disable the button when it was rendered through `SchemaRenderer`: the computed state was overwritten by the forwarded verdict arriving through the DOM pass-through spread, so the spinner ran on a live control.

The six DOM pass-throughs kept their behaviour through `SchemaRenderer` and now read the verdict by name rather than depending on spread order.
