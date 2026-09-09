---
'@object-ui/core': patch
---

A dataset measure over a `datetime` field now honours `measure.format`, like one over a `date` field already did (objectui#8352).

`formatMeasureDate` routes a date-shaped measure value down one of two arms. The
date arm threaded `format` into `formatDate`'s style parameter; the datetime arm
called `formatDateTime(v, { locale })` and dropped `format` on the floor. That was
structural rather than a threading slip — `formatDateTime(value, options?)` has no
style parameter — so `format: 'relative'` on a `Field.datetime` measure could not be
honoured even in principle, and rendered the absolute face with no error, no warning
and no fallback. Measured on a real browser boot against the showcase app in both
`zh-CN` and `en-US`: `min(created_at)` five days old read `2026年9月1日 00:00` with
and without `format: 'relative'`, while `min(due_date)` — a `date` field, same page
load, same tile — moved from `9月8日` to `后天`.

The datetime arm now selects a formatter instead of threading one, so both arms
honour the same two words and nothing else:

- `'relative'` resolves through `formatRelativeDate`, the same function the date arm
  reaches, so the same calendar day reads the same phrase for either field type. Its
  ±7-day fallback is inherited rather than re-decided at the call site: beyond that
  window both arms render the absolute face, which is unchanged behaviour.
- `'short'` resolves to the dense narrow-card face of the value's own type —
  `formatDateTime`'s `'compact'` for a datetime, which keeps the time of day and is
  byte-identical to what every `datetime` grid cell already paints.
- every other string, `'compact'` and date patterns such as `'YYYY-MM-DD'` included,
  falls to that arm's default face, exactly as before.

No published signature moved. Threading `format` into `formatDateTime`'s
`options.style` key would have honoured `'compact'` — the one word the date arm does
*not* honour — while still ignoring both words it does, so the call site maps the
vocabulary explicitly and a test pins that it does.

The docblocks on `formatMeasure` and `formatMeasureDate` are now qualified per arm.
The previous wording ("`format: 'short'` and `format: 'relative'` are honoured") was
true of the date arm and read as though it covered both; a triage pass took it as
evidence the defect was already fixed and downgraded the card, which a driven browser
run then refuted. The arms agree now, but the undifferentiated sentence is not coming
back — it is what hid the disagreement.
