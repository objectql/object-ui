---
'@object-ui/plugin-timeline': patch
---

Gantt date type gate: judge the `[[DateValue]]` slot, not the prototype chain
(objectui#7027).

`isGanttDateType` asked `value instanceof Date`, which answers "does this
inherit from `Date.prototype`?" and not "is this a `Date`?". An object that
inherits the prototype without owning the internal slot passed the gate,
reached `new Date(value)`, ran ToPrimitive, and threw
`TypeError: Method Date.prototype.toString called on incompatible receiver` —
uncaught, mid-render, so the author got a blank screen where #6781's named
diagnostic belongs. Three spellings crashed on `main`, measured:
`Object.create(Date.prototype)`, that impostor behind a `Proxy` that throws on
every get, and a `Proxy` with a throwing `getPrototypeOf` trap (`instanceof` is
not total on its own terms either).

Both sites now ask a total brand test that invokes the builtin
`Date.prototype.getTime` with `.call`: it reads the receiver's `[[DateValue]]`
slot and nothing else, so no author getter runs, no `Symbol.toStringTag` is
consulted, and no proxy trap fires. The two brand tests the finding suggested
were measured and rejected — `Object.prototype.toString.call` performs
`Get(O, @@toStringTag)` unconditionally, and `Number.isFinite(value.getTime())`
calls the author's `getTime`, which would refuse a real `Date` subclass by
dying on it. Both are pinned as red rows.

No change to which values are accepted: #6781's accept set
(`string | finite number | Date`) is untouched, `new Date(NaN)` still passes
the type gate and is still refused by the parse check with its `Invalid Date`
spelling, and every newly-refused value is one no authored document can carry
(ObjectUI metadata is JSON, which cannot spell a prototype).
