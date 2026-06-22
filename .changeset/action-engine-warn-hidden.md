---
"@object-ui/core": patch
---

fix(actions): warn when an action is hidden by a throwing `visible` predicate

`ActionEngine.getActionsForLocation` is fail-closed: a `visible` predicate that
throws hides the action. The most common cause is an authoring bug — a BARE
field reference (`done` instead of `record.done`), which is undeclared in the
`{ record, recordId, objectName, user }` eval scope. Hiding it silently made
that bug invisible (a long debugging hunt). The catch now emits a one-time
`console.warn` naming the action + predicate + error, with the `record.<field>`
tip. Deduped per predicate so re-renders don't spam.
