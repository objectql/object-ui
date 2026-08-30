---
'@object-ui/plugin-gantt': minor
'@object-ui/types': minor
---

**plugin-gantt: the `gantt` block now outranks the flat top-level spelling, and
the losing face's keys are named instead of dropped.**

`getGanttConfig` checked the flattened top-level spelling first and returned
early, so a node carrying both spellings rendered the flat one and every key
inside an authored `gantt` block was discarded with **no diagnostic** — not even
the `GanttConfigSchema.safeParse` warning, which sat behind that early return.

`plugin-map` had the identical two-faces shape ruled the other way (maintainer
ruling on objectui#5018, 2026-08-17, landed in PR #5156): the block wins, with a
dev-mode warning naming the ignored top-level keys. objectui#6469 inherits that
ruling, so the two sibling view plugins now answer the same question the same
way.

What changes:

- A node carrying **both** spellings now renders the **`gantt` block's** values.
  The block is taken **whole** — the flat keys are not merged into it.
- In dev, `[ObjectGantt] … these top-level keys are IGNORED: …` names every
  shadowed flat key, once per distinct shadowing.
- Nothing else moves. A node with only the flat spelling, or only a block, is
  read exactly as before.

**Producer-safe:** `ObjectView` (`case 'gantt'`) and `ListView` (`case 'gantt'`)
both flatten `options.gantt` onto top-level keys and emit **no** `gantt` key, so
every gantt reached through either view layer still takes the flat branch, and
the new warning cannot fire on that path. This is the same producer check the
`plugin-map` flip pinned, re-run on today's `main`.

This **supersedes** the precedence sentence in the objectui#6051 changeset
(`.changeset/6051-gantt-flat-config-declared-keys.md`), which recorded the flat
branch winning — accurate for that change, which deliberately did not touch
precedence, and reversed by this one.
