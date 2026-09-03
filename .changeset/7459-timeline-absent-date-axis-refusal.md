---
'@object-ui/plugin-timeline': minor
'@object-ui/i18n': minor
---

`ObjectTimeline` refuses an undeclared date axis instead of inventing one
(objectui#7459).

Steps ① and ② of the three-step sequence the maintainer ruled on objectui#7070
(2026-09-01, 总监批 #28). House posture, on record with that ruling:
日期轴永不虚构 — a date axis is never fabricated.

`ObjectTimeline` resolved its date axis through five declared bindings and then
closed the chain with a sixth rung that was a bare literal field name nobody
has ever declared. A name therefore ALWAYS resolved: for a view that declared
no axis, every record read a key its object does not carry, every event landed
in the "No date" bucket, and the screen read as a timeline that had been built
and simply had nothing in it.

Two changes, shipped together because neither is observable alone:

- **The renderer now refuses.** An object-bound timeline with no declared date
  axis renders a diagnostic naming every binding it accepts —
  `timeline.startDateField`, `timeline.dateField`, `mapping.date`, and the two
  deprecated flat spellings — instead of a chart. The twin of `ObjectGantt`'s
  "Gantt configuration required" screen, in the shape objectui#7070 settled.
- **The invented sixth rung is gone**, which is the only thing that makes the
  refusal reachable. Added while the floor stood, it would have been dead code;
  retired without the refusal, it would have produced exactly the silent
  "No date" outcome the ruling rejects.

**What changes for an author.** A view that declares a date axis is completely
unaffected — all five declared spellings resolve exactly as before, and a
timeline authored from literal `items` is never refused, since its items carry
their own dates and no field name is read for them. A view that declared no
axis anywhere, and was rendering an empty-looking timeline, now says so.

⚠️ Both premises were RE-MEASURED on the current tree before anything was
edited, rather than taken from the card: the renderer had no absent-axis
refusal (against a live control term that fires in the same file), and the
floor was still present and still spelled as reported. The pairing itself is
pinned — the refusal cases go red the moment the floor returns, including one
whose records carry a column that happens to be named `date`, where a returned
floor renders a convincing timeline rather than an empty one.

Refusal is distinguished from "renders an empty timeline" by asserting the
canvas is ABSENT, not merely event-free. The component's success surface is now
named (`data-testid="timeline-canvas"`) so that distinction can be measured;
every other terminal state of the component already named itself.

Step ③ of the ruling — the `'created_at'` floors on the two plugin faces —
stays on objectui#7070 and is deliberately NOT in this change.
