---
---

Internal only — no user-visible change, so no release.

ADR-0057 / issue #2477 items 2 and 3 (Studio dock collapse persistence, folded
layout side-by-side at `xl`) were already implemented by PR #2478; this adds the
regression pins that PR shipped without, and corrects three doc comments that
still described the pre-#2478 behaviour. Tests, comments, and the extraction of
the breakpoint constant into its own module — no runtime behaviour changes.
