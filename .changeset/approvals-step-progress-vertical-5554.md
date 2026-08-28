---
'@object-ui/console': patch
'@object-ui/app-shell': patch
---

The approval step progress bar is a vertical stepper, so long flows stop
clipping their tail steps.

Both occurrences were a single non-wrapping flex row whose steps were each
`shrink-0`. A flex row's min-content width is the sum of its non-shrinkable
items, so the bar's intrinsic width grew without bound with step count and
label length. On a live 17.1.0 project a real 6-step flow with ordinary CJK
step names measured **1070px inside a 527px container** (objectui#5554).

The two hosts failed differently, and neither failure was recoverable by the
reader:

- **`ApprovalsInboxPage`** (the inbox detail drawer) — the bar itself was not
  scrollable, so the nearest scroller was the drawer *panel*. Reaching steps
  4-6 meant dragging the drawer's own horizontal scrollbar, which pushed the
  record card, the activity timeline and the action buttons off-screen and left
  a near-blank panel.
- **`RecordApprovalsPanel`** (the record page's approvals panel) — this one
  carried `overflow-x-auto`, so it scrolled itself rather than its container.
  Better, but the tail steps still sat behind a scroll gesture with no visible
  affordance.

In both, readers took the clipped bar for the end of the data; the reporting
customer acceptance tester said so verbatim. Widening the window does not help:
the drawer is fixed-width, and clipping was identical at 1440x900 and 1920x1000.

Both now render as a column: one row per step, a badge-and-rail gutter, and a
label that may wrap. Width is capped by the container at every step count and
every label length, which also suits both hosts' tall-and-narrow aspect. The
rail segment below each step keeps the tint rule the horizontal connector used
— it is coloured by the step it leads *into*.

**Always vertical, with no step-count or measured-width threshold**, because
the overflow is driven by intrinsic content width (labels x count), not by
count alone: three 16-character CJK labels already crowd a 527px drawer, so any
count threshold picks a cutoff that is wrong for some real flow, and a measured
one reintroduces a viewport-dependent branch. The card's requirement is a fix
that cannot break at an untested viewport or flow length, and a layout with no
breakpoint and no measurement is the form that satisfies it. Horizontal-with-
scroll was ruled out for both occurrences: it leaves steps behind a gesture.

Pinned in `ApprovalsInboxPage.stepProgressVertical.test.tsx` and
`RecordApprovalsPanel.stepProgressVertical.test.tsx`. "The stepper renders" is
green against the broken code too — every step was always in the DOM, and the
clipping was layout — so the suites assert the property the defect names
instead: no row is `shrink-0`, every label is `min-w-0` and none is
`whitespace-nowrap`, nothing in the subtree is an `overflow-x` scroller, and no
axis, overflow or width-pinning class carries a breakpoint prefix (so there is
no viewport with untested behaviour). The reported failing regime is exercised
directly with the reporter's own six CJK labels, and a 2/5/6/12-step sweep pins
that the layout classes are byte-identical across all four, so no count
threshold can put some other flow length back on the old path.

The two steppers are kept identical by hand rather than extracted to a shared
component: they live in different packages, and deduplicating them is a
refactor with its own surface. Filed separately.
