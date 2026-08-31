---
'@object-ui/plugin-timeline': patch
---

Spell a refused gantt date by a RULE, not by `String` (objectui#6907)

`spellGanttDateValue` fills the `{{value}}` hole of the unusable-gantt-date
alert, whose job is to name the value the author wrote. Its `String(value)`
fallback was written when nothing but `[object Object]`-shaped values could
reach it; objectui#6905's type rule routes the whole non-date type space
through it, and it failed three ways — measured on `b458300ca`:

- it **VANISHES**: `endDate: []` rendered "endDate is , which is not a valid
  date", the value gone from its own sentence;
- it **LIES**: `['2024-01-01']` read as `2024-01-01` and `[0]` / `0n` as `0` —
  a text that IS a valid date, and a number that IS an accepted one (`0` is a
  kept gantt date), so the author was told a correct-looking value was invalid
  with no hint the wrapper was at fault;
- it **THROWS**: `{ toString() { throw } }`, a throwing `Symbol.toStringTag`
  getter and `Object.create(null)` each crashed the render outright. #6759 built
  this helper "total by construction" and #6905 made that load-bearing, but the
  type gate only stopped `new Date` from throwing — `String(value)` handed
  control to author code one line later, so the crash class moved into the
  speller instead of going away.

The rule now recorded on the helper:

    Spell the value when the LANGUAGE owns its spelling.
    Name its TYPE when producing text would run AUTHOR code.

Every primitive keeps a spelling fixed by the grammar, so it is spelled as the
author typed it — including `bigint`, which gains its `n` (`0n`, no longer the
accepted `0`). A `Date` uses `Date.prototype.toString.call`, byte-identical to
`String` but not hijackable by a subclass. Everything else is named:
`an array`, `a function`, `an object`, chosen with `Array.isArray` and `typeof`,
which read no author-controlled property.

`JSON.stringify` is refuted, not overlooked: it throws on a `bigint` and on a
cycle, which would put the crash class straight back. A bounded rendering is
refused on the same ground — even an element count is not total, because
`Array.isArray` is true of a Proxy whose `length` trap throws.

Which values are refused is unchanged (that is objectui#6781's ruling), the
`undefined` / `null` / quoted-string spellings pinned by #6759 and #6770 do not
move, the shared inverted-range diagnostic reads identically, and no new i18n
key is added — the article rides in the existing `{{value}}` hole.
