---
---

Measurement-only change in `@object-ui/app-shell`: objectui#7190 asked whether a
`dependsOn` lookup gates on the DETAIL page, and deliberately left it unanswered
— a detail page renders ONE record, which is exactly the "record scope"
`LookupField`'s `ctx.data` channel exists to carry, so a host that populates it
would make the cascade resolve and there would be no defect. Measured in the
real host, it gates.

New `views/RecordDetailView.lookupDependsOn-7190.test.tsx` mounts the app-shell
record page, loads a record carrying the parent value, enters inline edit by
double-click, and reads the picker's own trigger. The declared lookup comes back
`lookup-trigger-gated`, disabled, "Select region first" — while the `region`
field it names is on screen in the same edit session carrying `emea`. The
control lookup beside it (same reference, same record, no `dependsOn`) is
asserted enabled, so the gated reading is a measurement and not a broken
fixture. Both of `InlineFieldInput`'s call sites are covered — the details body
and the highlights strip — and both gate.

Pinned as the current behaviour, not fixed: which record the host should feed
(the saved record, or the inline session's in-flight staged edits) is a design
question this measurement does not answer, and the sibling fix for the grid is
still in flight.

No behaviour change.
