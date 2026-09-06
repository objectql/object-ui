---
'@object-ui/app-shell': patch
---

Studio object designer: a new field's API name now follows the Label on **every**
keystroke, not just the first one (objectui#7615).

Typing a label one character at a time — what a person at a keyboard actually does —
used to leave the field permanently named after its first letter: `Health Score`
produced the API name `h`, and no later keystroke moved it. Pasting or autofilling the
same label produced `health_score`, so the two ways of entering the same label
disagreed. The one-letter name then leaked into the REST API, formulas and exports,
with nothing on screen saying the API name had stopped following the Label.

Cause: the derivation asked "is this name still auto-generated?" by pattern-matching
the name itself (`field_<N>` / `<type>` / `<type>_<N>`), and its own first rename
destroyed that shape. The inspector now records who owns the API name instead of
re-reading it off a string the feature rewrites.

Three boundaries, unchanged in intent from objectui#2260:

- a new field whose API name the author has not touched re-derives on every label
  change;
- a field that arrived already named (i.e. saved) is never renamed by a label edit;
- once the author types in the API name box the Label stops moving it — including
  when what they typed looks like an auto-generated placeholder, which no
  pattern-match on the string alone can tell apart from a real one.
