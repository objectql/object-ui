---
'@object-ui/fields': patch
---

`LocationField` no longer discards a location's `altitude` / `accuracy` when the user
retypes the coordinate pair (objectui#6664).

The widget edits the pair as one comma-separated text box and rebuilt its emission as a
fresh `{ lat, lng }` from the parsed text, so the two OPTIONAL keys `@objectstack/spec`
declares alongside them — `LocationValue` is `{ lat, lng, altitude?, accuracy? }` — were
gone the moment anyone edited the coordinates. Nothing warned; they simply were not in
the object handed to `onChange`. Both keys are registered on the platform's authorable
surface (`authorable-surface.base.json`), so a customer may author them even though the
platform itself produces neither today — measured in both repos.

The drop **predates** objectui#6272: before that flip the widget emitted
`{ latitude, longitude }` and discarded the rest identically. What #6272 changed is only
that the *declared* value type is now the spec's, so the type claimed four keys while the
write path handled two. This closes that gap; it is not a regression #6272 introduced.

The carry is a key-by-key pick of exactly those two keys out of a value that is already a
valid `LocationValue` — deliberately **not** a spread of the incoming value, which would
carry a stored record's retired `latitude` / `longitude` spelling straight back into the
emitted object and undo #6272's rename. A negative control pins that. Each key is taken
only when it is a usable number, because the spec's `z.number()` rejects `NaN`, `Infinity`
and a numeric string alike; leaving such a value behind narrows the emission rather than
widening what the widget accepts.
