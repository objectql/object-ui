---
---

Comment text only, zero-pixel: the record-drawer `size: 'lg'` bucket question is
recorded as ruled, and the three in-code pointers stop naming closed cards as its
open home.

`ObjectKanban`, `ObjectCalendar` and `ObjectGantt` each carried a comment saying
the bucket question "stays open" on objectui#6303 / objectui#6259. Both cards had
closed, so the pointer chain terminated on closed cards and the question it
pointed at was tracked nowhere. It has since been ruled: objectui#6584,
2026-08-27 — the record-navigation drawer stays on the CSS literal, with no
convergence on the `size: 'lg'` bucket, because that bucket (`min(92vw, 960px)`)
is up to 53% wider below a 1600px viewport and there was no demand for the
change.

The three comments now cite objectui#6584 and state the ruling and its date. The
measurement prose they carry (`min(92vw, 960px)` vs `min(960px, 60vw)`) is kept
verbatim — it is still true and it is the reason the ruling went the way it did.
`RecordDetailDrawer`'s `width` docblock, the single code home of the literal that
all three renderers fall through to, gains the same note so the record lives at
the line a future editor would actually change.

No published behaviour changes: no default, `width` expression, `size` prop or
runtime value is touched.
