---
'@object-ui/plugin-kanban': patch
---

Kanban: a `columns` prop update now reaches the DOM in the same commit
(objectui#8534).

`KanbanImpl` mirrors its `columns` prop into `boardColumns` state. That mirror
was re-synced by a passive `useEffect`, and passive effects run *after* the
commit — so every prop-driven column change was painted one commit late. A board
whose data resolved after mount rendered a frame of column headers with empty
card lists before a second commit filled them in, and any card cell derived from
data that arrived with the newer prop generation (a field's declared label, for
one) rendered from the older generation for that frame.

The mirror **stays**. Deriving `boardColumns` from the prop is not available:
the drag path writes it optimistically and the prop never carries card *order*
back — a same-column reorder calls no callback at all, and `ObjectKanban`'s
`handleCardMove` early-returns on `fromColumnId === toColumnId` and discards
`newIndex`. Order truth is local, so a derived board would roll a committed
reorder back on the next prop change. What changed is only *when* the mirror is
aligned: during render (React's documented "adjusting state when a prop changes"
pattern) instead of in an effect. The reset trigger is byte-identical to the
effect's — `safeColumns` identity — so the rejected-move rollback of
objectui#4138 still fires exactly as before, and optimistic reordering is
unaffected.

⚠️ This closes **one** of the two first-frame races on this board. The other —
`KanbanRenderer`'s `React.lazy` chunk load racing the data commit — is untouched
and still open.
