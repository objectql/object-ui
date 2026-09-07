---
---

Test-only change; no published behaviour changes.

objectui#7828 ports the three harness guards from objectui#7527 (`c2fc261f5`),
plus PR #7826's bound capture, from the timeline `colorField` ladder fixture to
its two siblings — `ObjectCalendar.colorFieldLadder-7243.test.tsx` and
`ObjectGantt.colorFieldLadder-7243.test.tsx`. Their readiness predicate now
identifies WHICH render wrote instead of counting arity, each helper returns the
array that predicate accepted rather than re-reading a module global, every
render is unmounted in a `finally`, and no renderer may be alive when one is
mounted.

No runtime code is touched, and neither component's behaviour was changed or
found wanting: the two-paint window the guards exist for was measured for and is
absent on both (both gate their record query on the settled object schema), so
this is a fixture that can no longer be broken by the ordinary next edit, not a
fix for a failure.
