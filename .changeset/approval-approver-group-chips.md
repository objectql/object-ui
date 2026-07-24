---
"@object-ui/console": patch
---

feat(approvals): label pending-approver chips with their group (objectui#2807)

Follow-up to #2762 P1-2. The dedupe pass collapsed repeated "waiting on"
chips to one with a `×N` count, but couldn't say *which* group (finance /
legal / …) each pending approver represented in a 会签 (per_group) request —
the data wasn't there. With the framework now emitting
`pending_approver_groups` (`@objectstack/plugin-approvals`), the drawer:

- keys the chip collapse by **(name, group)** — the same person filling two
  different groups stays two labeled chips (`Dev Admin · finance`,
  `Dev Admin · legal`), while one group filled twice collapses to a single
  chip with a count;
- renders the group as a muted `· <group>` sub-tag on the chip.

Degrades cleanly: with no group data (non-`per_group`, or an older backend)
the key is the name alone, keeping the plain dedupe + `×N` behavior.
