---
---

The gantt's timeline column width says what it does: a flat 110px floor, not a
container-width breakpoint table (objectui#7228). **No behaviour changes** — this is
why the changeset carries no package bump.

`columnWidthForContainer(width)` branched on the container width three ways and returned
110 from all three arms, so its parameter was read only to be compared against thresholds
nothing acted on. That shape is not neutral: the two siblings directly beneath it,
`taskListWidthForContainer` and `showStartEndColumns`, branch on the *same* 640/1024
breakpoints and really do vary, so the dead table read as a live responsive policy. A
reader — human or agent — reasonably concluded the gantt narrows its columns in small
embeds. It does not, and has not since objectui#1870.

The history settles what the arms were for. The function was born a real curve
(`35/50/60` off `window.innerWidth`), kept it through the rename to a container-derived
width, and was bumped to `44/64/80` inside objectui#1870 — then, in a later commit of that
same PR titled *"floor timeline columns at 110px so day/week/month stay readable"*, the
whole curve was deliberately replaced by a single floor. The comment added in that commit
names the value's provenance ("user-specified minimum") and why a flat floor costs nothing
at the wide end (the fit-stretch and manual zoom both move the width upward). The
branching was leftover shape, not an unfinished table.

So the arms are gone and the value all three returned is now a module constant,
`BASE_COLUMN_W`, documented as the floor it is — matching how objectui#7420 hoisted the
task-list geometry in this file: fixed px values become named module constants, helpers
stay functions only where they genuinely vary with the container.

Nine pins now hold the behaviour on both sides of each retired breakpoint (320 / 500 /
639 / 640 / 800 / 1023 / 1024 / 1280 / 1920), plus one that requires a single distinct
value across all of them. Nothing pinned this before: every sibling suite that reads a
column width first forces the container to 1280 "so columnWidth=110 (deterministic)",
pinning the widest arm alone — so neither re-curving the width nor moving the floor would
have been caught.
