---
'@object-ui/plugin-detail': minor
---

**An empty array is no longer a cell value on the record page (objectui#8474).**

`hasCellValue` — THE definition of emptiness for `record:details` (objectui#8376,
widened to the package by objectui#8394, extracted to `emptiness.ts` by
objectui#8457) — opened with
`if (value !== null && typeof value === 'object') return true;`. `typeof []` is
`'object'`, so an **empty array was a value** and nothing further was asked of
it.

The object half's reasoning is sound and stays: an object value is handed to a
type-aware renderer that knows how to draw it. But every example it reasons
about is a *populated* object, and for `[]` the renderer has nothing to draw —
`SelectCellRenderer` tests `value == null || value === ''`, which `[]` passes,
then maps it over zero entries. The result was the blank cell the em-dash exists
to prevent, produced by the function that exists to prevent it, plus the full
objectui#8376 triple: the row escaped `emptyCount`, `canCopy` offered to copy it,
and because `shouldAutoHideEmpty` needs only `filledCount > 0` a section whose
one non-null value was `[]` armed auto-hide by itself and buried every genuinely
empty row around it.

**The change.** One arm inside the object branch:
`if (Array.isArray(value) && value.length === 0) return false;`. All five readers
of the shared authority get the corrected answer — `DetailSection`'s affordance,
`emptyCount` and `canCopy`; `HeaderHighlight`'s highlight strip; `DetailView`'s
summary chips; `HistoryTimeline`'s diff placeholder; `RecordMetaFooter`'s actor
test.

**What did NOT move, and why it is a measurement.** `{}` is still a value: on
`json`, `object` and `location` fields it draws the literal `{}` through
`JsonCellRenderer`, so there is no blank cell to fix. The shape that would have
swept it in — `Object.keys(value).length === 0` — is also true of a `Date`, a
populated `Map`, a populated `Set` and a getter-backed class instance, which
would be a false-empty on values that render.

**Declared cost.** A `json`-family field holding `[]` previously rendered the
literal two-character text `[]`; it now draws the `No value` placeholder. That is
intended and pinned.

`RelatedList.isValueEmpty` is untouched: it already drew this line, and the
shared authority moved toward it — never the reverse.
