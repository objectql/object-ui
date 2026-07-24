---
"@object-ui/console": patch
---

fix(approvals): Approval Center density + amount emphasis (#2762 P2)

- **Column rebalance** — the inbox table gave five auto columns equal width,
  leaving 审批事项 (Request) over-wide next to a cramped 状态 (Status). The
  Record column (the primary content) now gets the widest share, Request a
  moderate one, and Status/Submitted fixed widths so they never crowd.
- **Lead with the amount** — the drawer summary card now surfaces the
  decision-critical amount as a filled figure at the top of the card instead
  of burying it in the generic field grid (and drops it from that grid so it
  shows once).

Also verified two P2 items need no change: light mode already works —
`ConsoleShell` mounts `ThemeProvider defaultTheme="system"` (follows the OS
`prefers-color-scheme`) with a `ModeToggle`, and the page's own classes carry
full light/dark variants; and the queue already has a bulk approve/reject
toolbar for the select-all/per-row selection.
