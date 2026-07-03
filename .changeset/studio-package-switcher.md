---
"@object-ui/app-shell": patch
---

feat(studio): package switcher + inline "new writable package" in the top bar

The pillar Studio's top-bar package name becomes a **switcher**: it lists the app's
packages (kernel/system packages hidden), marks each **可写** (database base) or
**只读** (code package — the ADR-0070 D4 gate refuses authoring into these), and
switches by navigation. A **新建软件包** inline form creates a writable base
(`POST /packages {id,name}` — 名称 + auto-derived, hand-editable package id) and
jumps straight into its Data pillar.

The current package also shows a proactive **只读** badge, so users learn the
package is read-only *before* hitting the save-time gate. Writability display is a
heuristic (`scope: 'project'` = code, scope-less = base); the server-side gate stays
the authority.
