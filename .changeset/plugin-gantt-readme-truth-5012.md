---
'@object-ui/plugin-gantt': patch
---

Docs only: `packages/plugin-gantt/README.md` no longer teaches two identifiers the
package does not export, nor a task shape it does not produce (objectui#5012).
Each README import was judged against the entry module's real export surface
(35 names, read from the build product's `dist/index.d.ts`), and every corrected
snippet was type-checked against that same build product:

- **`ganttComponents`** — taught as a components map to iterate over for "manual
  registration" (`Object.entries(ganttComponents).forEach(...)`). It does not
  exist anywhere in the package, so the snippet was `Object.entries(undefined)`:
  a `TypeError` on the first line a reader copied. Registration is *only* the
  side effect of importing the entry point, which runs the two
  `ComponentRegistry.register(...)` calls in `src/index.tsx`. The section is
  replaced by what actually happens: the schema types those calls claim
  (`object-gantt` → `plugin-gantt:object-gantt`, `gantt` → `view:gantt`, both
  with a bare-`type` fallback), the package's real export surface, and — for the
  use case the old snippet was reaching for — registering the exported
  `ObjectGanttRenderer` under a key of your own.

- **`GanttSchema`** — taught as the component schema type in the TypeScript
  section. Pure fiction: zero hits in this package and in `@object-ui/types`
  (a plain grep appears to find it only as a substring of `ObjectGanttSchema`;
  under a word boundary it has no hits at all). The authored type does exist
  under its real name, so the example is rewritten around it rather than
  dropped: `ObjectGanttSchema` from `@object-ui/types`, which is
  **record-driven** — `type: 'object-gantt'` plus an object name and the fields
  to read. It never carried the `tasks` array the old snippet assigned to it.
  No export was added to make the old name true.

- **`GanttTask`** — the one real name of the three, and the reason the section
  still failed to compile. The documented shape had drifted from the exported
  type on three counts: the label field is `title`, not `name`; `start`/`end`
  are `Date` objects, not ISO strings; and `color` is a CSS color, not a
  Tailwind class. Both the "Task Structure" reference block and the typed
  example now match the exported declaration, and the reference block is pinned
  against it in both assignment directions so a future drift fails a check
  instead of compiling as an unrelated local interface.

No code, types or runtime behaviour change — the diff is one README and this
changeset. The correction reaches npm with the package's next publish, which is
why it declares a patch: `README.md` is in the package's published `files`.
