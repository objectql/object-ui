---
---

Removes the `taskListWidth_LEGACY_REMOVED` tombstone from `GanttView`, and records the fact
it was carrying at the site that owns it.

The line was one `const` bound to the literal `null` inside the component body, left behind
by the finished task-list-width refactor. Measured on `origin/main` `a27d153c2`, the
identifier appeared exactly once in the whole repo — its own declaration — and zero times in
a read position; the same probe run returned 20 read sites for the live `taskListWidth` and
360 for `rowHeight`, so the zero is a reading and not a broken grep. Nothing in the platform
repo declared it either. It carried no state, no side effect and no contract surface.

What it did carry was a false signal. A name spelling `_LEGACY_REMOVED`, sitting inside the
component a few hundred lines below the real width derivation, reads as a seam deliberately
retained for a reason recorded elsewhere, so the next reader goes looking for that reason.

Its trailing comment held one fact worth keeping — that the width now comes from the
container `useResizeObserver` — and that fact was stated nowhere at the observer call site.
It moves there rather than dying with the line: the observed container width is named as the
source the auto-sized row height, base column width and task-list pane width all derive
from. No behaviour changes, and nothing published moves.
