---
'@object-ui/auth': minor
'@object-ui/console': minor
'@object-ui/core': minor
'@object-ui/fields': minor
'@object-ui/layout': minor
'@object-ui/plugin-ai': minor
'@object-ui/plugin-calendar': minor
'@object-ui/plugin-chatbot': minor
'@object-ui/plugin-dashboard': minor
'@object-ui/plugin-designer': minor
'@object-ui/plugin-editor': minor
'@object-ui/plugin-map': minor
'@object-ui/plugin-markdown': minor
'@object-ui/plugin-report': minor
'@object-ui/react': minor
'@object-ui/runner': minor
---

Remove 37 runtime dependencies that no file in the declaring package consumes, and gate
the direction so the next one cannot land (objectui#8198).

`check:phantom-deps` judges imports that are not declared; nothing judged the reverse,
so a declaration could outlive its last consumer indefinitely. That is what happened to
`recharts` in `@object-ui/components` after objectui#7397 deleted its only importer — it
was removed by hand on objectui#7625, and nothing would have reported the next one. The
new `pnpm check:unused-deps` asks the reverse question over `dependencies` and
`optionalDependencies` of every released package.

**Potentially breaking, for consumers relying on hoisting.** Nothing these packages ship
changes: their Vite `external` predicates are path-based and never read `dependencies`,
so no built artifact moves. What changes is the install graph — a project that imports
one of the removed packages while depending only on the ObjectUI package that used to
drag it in will no longer resolve it. Declare it directly; that is the correct
dependency edge in either case. The removals, by package:

- `@object-ui/plugin-designer`: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@object-ui/fields`
- `@object-ui/plugin-chatbot`: `react-markdown`, `react-syntax-highlighter`, `remark-gfm` (and the orphaned `@types/react-syntax-highlighter`)
- `@object-ui/plugin-report`: `@object-ui/plugin-grid`, `clsx`, `react-i18next`, `tailwind-merge`
- `@object-ui/plugin-map`: `@objectstack/spec`, `lucide-react`, `zod`
- `@object-ui/runner`: `class-variance-authority`, `clsx`, `tailwind-merge`
- `@object-ui/core`: `lodash`, `zod`
- `@object-ui/layout`: `clsx`, `tailwind-merge`, and `react-dom` — which it pinned at an exact version in `dependencies` while also declaring it as a peer range, i.e. a library hard-depending on the renderer it asks its host to supply
- `@object-ui/plugin-dashboard`: `clsx`, `tailwind-merge`, and the same `react-dom` defect
- `@object-ui/plugin-ai`: `@object-ui/react`, `clsx`, `tailwind-merge`
- `@object-ui/fields`: `clsx`, `tailwind-merge`
- `@object-ui/console`: `@object-ui/react-runtime`, `sucrase`
- `@object-ui/auth`: `@object-ui/types`
- `@object-ui/plugin-calendar`: `@object-ui/fields`
- `@object-ui/plugin-editor`, `@object-ui/plugin-markdown`: `@object-ui/react`
- `@object-ui/react`: `react-hook-form`

Every one was verified by a whole-package grep before removal — the name appeared nowhere
under the package but its own manifest and CHANGELOG — and the whole workspace builds,
type-checks and tests green afterwards.
