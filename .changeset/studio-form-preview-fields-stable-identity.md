---
'@object-ui/app-shell': patch
---

The Studio Data pillar's form preview no longer rebuilds `ObjectForm`'s `fields` array on every render (#4574).

The pillar built the real runtime `ObjectForm`'s `fields` array inline, in the same shape #4567 fixed for the grid. `ObjectForm` lists `schema.fields` in its field-generation effect's dependency array by identity, so a fresh array on every render of the pillar (which re-renders at keystroke rate) re-ran that effect on every keystroke — redundant recomputation plus one extra `setFormFields` render pass, not a duplicate query: the effect is a pure derivation, and the object-schema fetch and record load are separate effects that never depended on `schema.fields`.

The array is now memoized on the draft's `fields`, as a second memo alongside the grid's existing `gridColumns` memo — not a reuse of it, since the form's filter differs (it does not drop a field named `actions`, unlike the grid). The dependency stays live: adding, removing or reordering a field still produces a new array.
