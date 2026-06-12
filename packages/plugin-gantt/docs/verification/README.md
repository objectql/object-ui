# Browser verification — Gantt Phases 1–5

Automated end-to-end verification of the Gantt plugin in a real Chromium
browser, driven by [`scripts/verify-browser.mjs`](../../scripts/verify-browser.mjs)
against the demo app ([`demo/`](../../demo/)). The script asserts behavior via
the DOM and persists the screenshots in this directory; `results.json` holds
the machine-readable outcome of the latest run.

Run it with the demo server up:

```sh
pnpm --dir packages/plugin-gantt exec vite demo --port 5199
node packages/plugin-gantt/scripts/verify-browser.mjs
```

## Latest run: 18/18 checks passed

### 1. Hierarchy, milestones, dependency links

- 13 tree rows (3 summary groups + 8 tasks + 2 milestones), 3 summary
  brackets, 2 milestone diamonds.
- 10 dependency arrows covering **all four link types** (`fs`, `ss`, `ff`,
  `sf`), plus the red Today line and both custom markers (Sprint 2,
  Code freeze).
- ![Project overview, day mode](01-project-overview.png)
- ![Whole project with all links, week mode](02-week-mode-all-links.png)

### 2. Collapse / expand

- Collapsing the *Build* summary hides its 4 child rows (13 → 9) and the
  links into the subtree (10 → 4); expanding restores all 13 rows.
- ![Build group collapsed](03-build-collapsed.png)

### 3. Hover tooltip + link highlight

- Hovering *Backend services* shows the tooltip (`Jun 18 → Jul 8 · 20d · 30%`)
  and highlights exactly its 2 links (t3→t4, t4→t6).
- ![Tooltip and highlighted links](04-tooltip-and-link-highlight.png)

### 4. Drag-to-create dependency

- A real mouse drag from the link dot of *Documentation* onto *Frontend app*
  shows the dashed rubber band mid-drag; dropping creates the new `t8 → t5`
  arrow.
- ![Rubber band mid-drag](05-link-create-drag.png)
- ![New dependency created](06-link-created.png)

### 5. Performance — 5,000 tasks (`?perf=5000`)

| Metric | Result |
| --- | --- |
| Initial render (5,000 tasks) | **27 ms** |
| Rows in the DOM | **26** of 5,000 |
| Week columns in the DOM | **26** |
| Window shift after jumping to the middle of the list | **40.5 ms** |
| Rows in the DOM after the jump | 32 |

- ![5,000 tasks, top of list](07-perf-5000-top.png)
- ![5,000 tasks, scrolled to the middle](08-perf-5000-scrolled-mid.png)
