---
---

Internal cleanup in `@object-ui/plugin-gantt`: `GanttView.tsx` dropped three
declarations (four bindings) that nothing in the tree ever read.

- `const HEADER_HEIGHT = 50;` and `const COLUMN_WIDTH = 100;` — module-level
  constants with zero readers repo-wide. Both were lazy: unread module bindings
  cost nothing at runtime, so removing them changes no behaviour at all.
- `const [currentDate, setCurrentDate] = React.useState(() => tzShift.now());` —
  a different class of residue. Unlike the two constants this one was **live**:
  every mount allocated a state slot and ran the `tzShift.now()` initializer,
  even though neither the value nor the setter was ever referenced. Removing it
  has a real (if tiny) runtime effect, and no observable one — nothing rendered
  from it and nothing could set it, so no output, prop, or timing a consumer can
  see changes.

No published symbol moves: none of the four were exported, `COLUMN_WIDTH` is not
the same binding as the local `const COLUMN_WIDTH = 110` that three sibling test
files declare for themselves, and `tzShift` keeps 27 other readers in the file so
its import stays live. Nothing to release — declared as a no-bump change.
