---
---

Docs and gates only: the root `README.md` — the repository's landing page and the
most-read authored file in it — was outside the scan surface of every doc gate,
and had been teaching `stat-card` four times in its flagship "dashboard in JSON"
example. Nothing registers `stat-card`, so a reader who copied the headline
snippet got four OBJUI-001 "Unknown component type" panels.

The file now joins the scan surface of `check-doc-component-types` and
`check-doc-snippet-types`, and the four widgets are retargeted onto `statistic`,
which is registered and declares a `value` carriage row, so the example keeps its
expressions. Per the maintainer's 2026-09-01 ruling on the (A)/(B) fork —
option (B), no new carriage rows — four documentation sites that authored `${…}`
in keys with no carriage row now teach what actually renders instead.

No package source changed, so this ships nothing: `check-changeset-presence`
independently reports "no changeset is owed" for this diff. The declaration
states the release intent rather than bumping anything.
