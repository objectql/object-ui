---
'@object-ui/plugin-kanban': patch
---

A rejected Kanban drag rolls the card back on both data ownerships, not just when the board owns its own records

Dragging a card into a column the server refuses (`PATCH` 400 `invalid_transition`) left the card sitting in the target column until a manual reload, whenever the board was hosted by a parent that supplies records through the `data` prop — the ListView/console path, which is the one real users meet. The toast fired and the server value was untouched, so the board was showing a move that had not happened.

`handleCardMove` performed its failure revert only inside `if (!hasExternalData)`. The reasoning recorded next to it was that the parent handles the refresh, and for an accepted move it does — the parent's mutation subscription refetches and the new value propagates. A *rejected* move changes nothing server-side, so no refetch is ever triggered and nothing un-said the optimistic move.

The revert is now unconditional, which is also what makes it a single code path rather than two. The card's on-screen position does not live in `ObjectKanban` at all: the board component moves the card inside its own column state before reporting the move upward, and re-syncs that state from its `columns` prop whenever the prop's identity changes — which any re-render of `ObjectKanban` produces, since the renderer re-buckets the records into fresh column arrays. On the internal path the revert corrects the record and re-renders; on the external path it re-renders against the parent's records, which the server never changed, and the re-bucket puts the card back where it started.

The optimistic write on the way *in* stays gated on internal data deliberately, and the asymmetry is now pinned by tests: writing it on the external path would re-render against the unchanged parent records and snap an accepted move back before the server had answered. Accepted moves on both paths, and the existing rejection toast, are covered by controls alongside the regression test.
