---
'@object-ui/app-shell': minor
---

Flow builder: variable data-picker for expression / template config fields. Expression and template surfaces (decision Branches, edge Condition, Assignment values, Screen description, CRUD field values / filter, subflow / script inputs) now show a "{x}" picker listing the references in scope at that node — flow variables, upstream node outputs, the trigger record's fields, and any enclosing loop item — resolved graph-aware by walking the flow back from the node. Selecting a reference inserts the correctly-braced token at the cursor (bare CEL in `expression` fields, `{var}` in template fields), handling the ADR-0032 brace-in-CEL trap for the author. Free-text typing is unchanged and an empty scope degrades to a plain input.
