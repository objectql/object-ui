---
'@object-ui/plugin-detail': patch
---

The record page's summary chips beside the H1 no longer render an object-valued
field as the literal text `[object Object]`.

`effectiveSummaryFields`' chip displayed `String(val)` with only currency, date,
datetime, percent and the option families formatted, so an expanded lookup
payload, a location or an address printed the placeholder next to the page
title — and, because the chip's accessible name is built from that same string,
in its accessible name too.

An object value is now drawn by the field's own cell renderer, the way the
highlights strip one band below already reads it: a lookup chip shows the
referenced record's name, an address chip its formatted postal line, a location
chip its coordinates. Fifteen field kinds whose renderer does not fit a pill —
the option families (a badge inside a badge), `user` (an avatar), the image
family (no text at all), and the kinds that draw a "No value" face for a value
the page has just called filled — keep a text chip and take
`@object-ui/fields`' shared value coercion instead.

Values that already rendered are untouched, and the chip's emptiness
classification is unchanged.
