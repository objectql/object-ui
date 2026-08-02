---
"@object-ui/core": minor
---

fix(dashboard): an unrecognised date filter value is skipped and named, not compared

The residual the preset-name fix (objectui#3150 / objectstack#4475) left behind,
and the more deceptive half of it: a `date`/`dateRange` filter value that is
neither a known preset name nor a parseable date used to fall through to the
"a bare string date means equality on that day" branch. A misspelled default —
`defaultValue: 'last_7_dayz'` — therefore reached the widget query as
`runtimeFilter: { created_at: 'last_7_dayz' }`, which the backend faithfully
compiled to `WHERE created_at = $1`. `200 OK`, widget renders, count is 0 —
indistinguishable from "this range genuinely has no data". No 4xx, no console
warning, no UI signal. objectstack#4475 took a full RC cycle to catch for
exactly this reason: **0 looks like a legitimate answer**.

`buildFilterCondition` now holds a date value to three spellings, and only
three:

1. a known preset name → range bounds (unchanged, objectui#3150);
2. an ISO date (`2026-01-15`, `2026-01-15T08:30:00Z`) or a date-macro token
   (`{today}`, `{7_days_ago}`) → equality on that day (the documented
   behaviour, unchanged);
3. **anything else → the filter is skipped and `console.warn` names the filter,
   the offending value, and the accepted spellings.**

The `{ preset: '<unknown>' }` object form gets the same voice. It already
dropped the filter — silently — because the preset lookup missed and no
`from`/`to` remained; that drop is now announced. When explicit bounds ride
along with an unknown preset the bounds are still honoured, and the warning says
which of the two won.

Rule 3 is deliberately the same strictness `buildWidgetScopedFilter` already
applies to a *default binding on a field the object does not have* — skip and
warn, with the same rationale spelled out there: never emit a query the backend
can only empty-match. Field *names* had that guard; field *values* did not.

The macro-token check asks `resolveDateMacros` itself whether it recognises the
string, rather than restating its token grammar in a second place. One
vocabulary, no dialect to drift — and a token that resolver does not know
(`{last_7_dayz}`) is precisely the typo this guard exists to catch.

Levelled `minor`, matching objectui#3150, because the emitted query shape
changes: a dashboard carrying a misspelled date value stops sending a
never-matching equality and instead sends no constraint for that filter (its
numbers go from 0 to unfiltered) while the console says why. Anything asserting
on the previously-emitted equality will see it disappear.

Note the direction of the relaxation is chosen, not incidental: skipping widens
the result set, so the number visibly changes and the warning explains it —
whereas the old behaviour narrowed it to zero, which is the one outcome an
author cannot tell from a correct answer. Author-time rejection (validating
`GlobalFilterSchema.defaultValue` at publish, in `@objectstack/spec`) is the
stricter complement and belongs on the platform side; it is filed separately.
