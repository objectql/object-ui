---
'@object-ui/plugin-detail': minor
---

The whole record page now shares ONE definition of emptiness, and it **trims**
(objectui#8394).

objectui#8350 gave `record:details`' dedupe ladder the page H1's authority;
objectui#8376 converged `DetailSection`'s three spellings onto it. Four raw
`null | undefined | ''` tests were left on the same page, none of them trimming.
So for a whitespace-only value the H1 said "empty", the body grid said "empty",
and the bands between and around them said "filled" and painted nothing — a
contradiction visible in a single screenful.

**What a reader saw, per band.**

- **The highlight strip** (`HeaderHighlight`, ADR-0085) sits between the H1 and
  the body grid, and after objectui#8376 it was the last band on the page still
  calling a whitespace-only value FILLED: it painted a **blank chip** where the
  em-dash affordance belongs.
- **The summary chips beside the H1** (`DetailView`) rendered a **blank Badge**.
  ⭐ And this surface decides emptiness **twice**: the auto-detection that picks
  which field becomes a chip asked the same raw question one rung earlier, so a
  whitespace-only `status` won the single status slot — and then the render
  dropped it, leaving **no status chip at all** where a genuinely filled `stage`
  would have shown one. Fixing only the render site would have turned a blank
  chip into a missing chip.
- **The audit timeline** (`HistoryTimeline`) printed the spaces instead of the
  `—` it uses to mean "nothing".
- **The record footer** (`RecordMetaFooter`) rendered a **blank actor**. ⭐ Here
  the fix is at the READ, not at the renderer: four consumers ask "is there an
  actor?" about one value — the presence gate, the `sameUser` suppression, the
  choice between the `Created by` and the "by"-less `Created` label, and the
  gate that actually mounts the renderer. Only the last reaches the renderer, so
  converging it alone would have removed the blank and left `Created by · 5m
  ago` standing over an actor that is not there — the dangling phrase that label
  branch exists to prevent. Normalized once at the read, all four agree.

**The change.** `hasCellValue` — the predicate objectui#8376 measured into
existence — moves out of `DetailSection.tsx` into a small shared module, and
every band above reads it. Its scalar answer is `@object-ui/core`'s
`recordDisplayValueAt`, the same authority the H1 uses, rather than a fifth
hand-written test.

**Objects are still values, deliberately.** `recordDisplayValueAt` answers "does
this resolve to a NAME", so an object goes through the Salesforce-style display
chain and is empty when that yields nothing. Right for a title, wrong for a
cell: on these surfaces an object is handed to a type-aware renderer that knows
how to draw it — `{ latitude, longitude }` as coordinates, an option array as
badges, an expanded `{ id, name }` reference through the lookup renderer's own
display chain, anything else as JSON. Delegating that half would have replaced
populated chips, cells and actors with placeholders. This applies to the record
footer too, which the filing card guessed might want the title predicate: it
does not, because its renderer draws objects.

The only values whose rendering changes are strings that contain nothing but
whitespace. `0`, `false`, `''`, `null`, `undefined` and every object value are
classified exactly as they were.
