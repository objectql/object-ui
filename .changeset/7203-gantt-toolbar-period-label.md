---
'@object-ui/plugin-gantt': patch
---

Gantt toolbar: the period label names the visible window, and the prev/next
buttons step it (objectui#7203).

The label formatted `timelineRange.start` — the memo spanning the whole dataset
— so it named the first unit of the entire result set and could not change while
the chart was scrolled, because it was not derived from scroll position at all.
On a dataset running January to December it therefore read "January 2026" at
every scroll position, four pixels above a band header correctly reading
"Aug 2026". Measured on the demo fixture in Chromium at 1440x900: on first paint,
after the chart auto-scrolls to Today, the label read `December 2025` over
columns `28F 29S 30S 31M 1T 2W 3T` with the band beneath them reading `Aug 2026`.
Two month labels four pixels apart, disagreeing — and the wrong one is the
prominent one, so the chart reads as if the columns were mislabelled.

The label now names the period at the left edge of the viewport, snapped to the
same tier `headerGroups` bands the timeline by: a month under day and week view,
a year under month and quarter view, a decade under year view, the shift-day
under shift-segmented day view. The toolbar and the band header therefore agree
by construction rather than by two derivations that can drift. Wording is
unchanged for the month tier — the toolbar still spells the month out
("August 2026" beside the header's "Aug 2026").

The `‹` / `›` buttons rendered an `aria-label` and an icon and carried no
`onClick`. They now scroll the visible window one period backwards/forwards at
that same tier, clamped to the ends of the timeline (ADR-0049 enforce-or-remove:
wiring is the branch the label change makes available). They step the label's
tier rather than one column, so a click always changes what the label says.

The band header is untouched. It was already correct; it is the reference here.
