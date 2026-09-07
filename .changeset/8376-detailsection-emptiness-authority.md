---
'@object-ui/plugin-detail': minor
---

`DetailSection` now has ONE definition of emptiness, and it **trims**
(objectui#8376).

The component decided "is this field empty?" three times — the row filter behind
`emptyCount`, the reader's "Show N empty fields" toggle and the auto-hide
heuristic; the branch that draws the muted em-dash `No value` affordance; and
the one that offers click-to-copy — each with its own raw
`null | undefined | ''` test. None of them trimmed, while `@object-ui/core`'s
`recordDisplayValueAt` — the definition the record page's H1 uses, and since
objectui#8350 the definition `record:details`' dedupe ladder uses — does. A
whitespace-only field value was therefore FILLED here and EMPTY everywhere else
in the same render path.

**The user-visible defect, in three widening steps.**

- The row painted a **visually blank cell**. The em-dash affordance exists
  precisely so a reader can tell "this field has nothing" from "this page failed
  to render"; a value of `'   '` took the cell-renderer path instead and printed
  the spaces.
- It **escaped the counter**. `Show N empty fields` read one too low, and
  revealing the empty rows did not reveal this one — it had never been hidden,
  because it had never been counted.
- ⭐ It could **arm auto-hide by itself**. `shouldAutoHideEmpty` requires only
  `filledCount > 0`, and the all-empty case is deliberately reserved so a sparse
  or brand-new record keeps its labels as a structural skeleton. A section whose
  ONLY non-null value was `'   '` had `filledCount === 1`: the skeleton was
  suppressed and **every genuinely empty row in that section** was hidden behind
  a toggle — on a page a reader would describe as blank.

**The change.** All three reads now go through one function, and its scalar
answer is `recordDisplayValueAt`'s rather than a fourth hand-written test. A row
that says `No value` is the same row the counter counts and the same row that no
longer offers to copy its spaces.

**Scoped to strings, deliberately — and this is narrower than objectui#8350's
move.** `recordDisplayValueAt` answers "does this resolve to a NAME", so an
object value runs through the Salesforce-style display chain and is empty when
that yields nothing. That is right for a title and wrong for a CELL: here an
object value is handed to a type-aware cell renderer that knows how to draw it —
`{ latitude, longitude }` as coordinates, `{ street, city, … }` as a formatted
postal address, an option array as badges, anything else as JSON. None of those
carries a name-ish key, so delegating that half would have replaced populated
cells with `No value` and let auto-hide bury them. An object is a value on this
surface, exactly as before.

The only values whose rendering changes are strings that contain nothing but
whitespace. `0`, `false`, `''`, `null`, `undefined` and every object value are
classified exactly as they were.
