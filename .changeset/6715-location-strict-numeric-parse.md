---
'@object-ui/fields': patch
---

`LocationField` no longer invents a coordinate out of text that is only partly a
number (objectui#6715).

Each half of the typed pair was read with a bare `parseFloat`, which stops at the
first character it cannot read and returns what it got. So `"12abc, 34"` emitted
`{ lat: 12, lng: 34 }` — a coordinate nobody typed.

**Why nothing downstream could catch it, and why that makes this different from
objectui#6714.** Every one of those truncations is a pair
`valueSchemaFor({ type: 'location' })` ACCEPTS: well-formed, in range, and wrong.
#6714's `999, 999` was at least a value the contract refuses, so something
downstream could in principle have objected; here the platform validator cannot
be the oracle at all. Measured on `b76ca6764` by driving a real `ObjectForm`
(create mode, a `type: 'location'` field, a fake `DataSource`) and submitting:

```
typed "12abc, 34"    create({ place: {"lat":12,"lng":34} })    aria-invalid=false
typed "1.2.3, 4"     create({ place: {"lat":1.2,"lng":4} })    aria-invalid=false
typed "12deg, 34"    create({ place: {"lat":12,"lng":34} })    aria-invalid=false
typed "0x10, 34"     create({ place: {"lat":0,"lng":34} })     aria-invalid=false
typed "12.5 N, 34 E" create({ place: {"lat":12.5,"lng":34} })  aria-invalid=false
```

The last two show the size of the class. `0x10` truncates to `0` — objectui#6272's
`|| 0` in the Gulf of Guinea, arriving through a different door — and
`"12.5 N, 34 E"` drops the hemisphere, so a `12.5 S` paste would have been stored
as `+12.5`, on the wrong side of the equator, with nothing said.

**The fix** parses each half as a strict whole-string number, applying
objectui#6272's precedent: a field that renders a plausible wrong place is worse
than one that renders nothing. The test is `parseFloat`'s OWN grammar, anchored —
not a stricter notion of a number invented in the widget — so every form that is
a number today still is: negatives, a leading `+`, surrounding whitespace,
exponent forms (`3.027e1`), and a bare decimal point on either side (`.5`, `30.`).

The refusal is **announced**, through the machinery objectui#6716 landed rather
than a new one, and it names the half it could not read: *Not saved: latitude
"12abc" is not a number. Enter plain decimals (example: 30.2741, 120.1551).* A
third silent refusal would have re-opened the defect #6716 had just closed.

Two boundaries drawn deliberately:

- Text with **no** number at the front (`abc`, `NaN`, `here, there`) keeps the
  pre-existing format sentence. "No number at all" and "a number with text after
  it" are different mistakes and get different advice.
- `Infinity` carries no residue — `parseFloat` reads the whole word — so it is
  still refused by objectui#6714's **range** arm, not by the new one.

⛔ Degree/hemisphere notation (`12°N, 34°E`) is **not** parsed. It stays refused,
per the maintainer ruling of 2026-08-29: the paste route is unmeasured, and it
becomes its own feature card if real demand arrives.
