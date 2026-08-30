---
---

Tests only — no published behaviour changes.

objectui#6598 reported that a `kind:'html'` page's `<list-view>` rendered rows but
no data columns, in all eight `columns` spellings the reporter tried. Re-measured
on the merged ref: the symptom no longer reproduces in any of the eight. The
three mechanisms behind it were fixed by objectui#6614 / PR #6669 (the braced
literal subset), PR #6679 (the unauthored-projection handoff) and objectui#6677
(the grid's default-column derivation). This adds the matrix pin the card itself
was missing — every one of the eight spellings, end to end through the real live
registration and the real object-grid — so no future change can put any of them
back into the reported state.
