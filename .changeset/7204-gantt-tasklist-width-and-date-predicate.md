---
'@object-ui/plugin-gantt': minor
---

Size the gantt task list from its container, and give a row's dates ONE predicate
(objectui#7204, objectui#7224; maintainer ruling 2026-09-02, option Y).

**A row could show no dates at all.** Two gates decided whether a row's dates were
painted, and they read two different widths. The Start/End columns were gated on the
container-derived task-list width; the `8/26 → 9/2` sublabel under the title was gated
by the component's own `@media (min-width: 640px) { .gantt-sm-hidden { display: none } }`
rule, which reads the viewport. Between a 640px and a 1023px container both were shut,
so the row's dates existed in the DOM twice and were painted zero times. The same hole
opened at any width once the splitter was dragged under the threshold.

The sublabel now renders on exactly the complement of the Start/End columns, both from
the same container-derived width, and the media rule is gone. A row always carries its
dates one way or the other.

**And the task list no longer caps at 320px.** From a 1024px container up, the pane
takes 3/8 of the container clamped to `[320, 560]` instead of a flat 320. At 1440 that
is 540px, which leaves the title 287px with the Start/End columns still painted — a
40-character title measures 262px in the row's font, so real-world task names stop
truncating to about seven characters while several hundred pixels of chart sit empty.
Measured in Chromium at a 1440px container: title 53px before, 287px after.

The Start/End threshold moves from an estimated 280 to a derived **412** — 32 row
padding + 160 for the two columns + 28 for the open-details slot + 32 of title
furniture + 160 minimum title, each term traced to the markup that spends it. Below it
the sublabel carries the dates. One consequence worth stating: between a 1024px and a
1097px container the columns are now off and the dates ride the sublabel, which trades
two 80px date cells for a title that grows from 67px to 291px.

Not fixed here, and unchanged: a row's `depth * 14` indent is unbounded, so no single
default keeps a deeply nested row legible.
