---
'@object-ui/layout': minor
---

**Breaking (shipped as `minor`, following the `page-header` `description` retirement):**
`app-shell` is no longer a component key. `registerLayout()` registered `AppShell` under
that key with no `inputs`; the registration is gone (objectui#4841, ADR-0049
enforce-or-remove, remove side, maintainer ruling 2026-08-16).

**What it could never do.** Four of `AppShellProps`' seven keys are `React.ReactNode`
slots — `sidebar`, `navbar`, `children`, `rightRail` — and a JSON document can fill none
of them, so `{ "type": "app-shell" }` resolved to a component that had exactly two
outcomes, neither of them a shell. `children` was dropped in silence: `SchemaRenderer`
strips `children` (and `body`) before spreading a node's keys as props, and `AppShell`
reads its `children` prop, never `schema.children`, so the `<main>` element rendered
empty with nothing logged. A schema written into `sidebar` / `navbar` / `rightRail`
arrived as a plain object React refuses to render, replacing the node with an error box.
Only `className`, `defaultOpen` and `branding` ever survived the JSON path, i.e. the best
result JSON could reach was a shell with no navigation, no top bar and an empty content
area. With no `inputs` declared, `sdui-parser` had no declaration face to compare a node
against either, so neither outcome was diagnosed.

**What changes for an author.** The middle state — parses, resolves, renders nothing — is
replaced by a named refusal. `SchemaRenderer` now shows its `Unknown component type:
app-shell` panel (`OBJUI-001`) and `sdui-parser` reports an `error`-severity
`unknown-component` diagnostic before render.

**FROM → TO.** There is no in-place rewrite, because the node never produced a shell.
Schema authors who want the whole shell from metadata use `app-schema-renderer`
(`AppSchemaRenderer`), which declares its `inputs` and builds branding and sidebar
navigation from an `AppSchema` document: `{ "type": "app-shell", … }` →
`{ "type": "app-schema-renderer", "schema": { … } }`. Everyone else composes in React —
`AppShell` is **unchanged and still exported** from `@object-ui/layout`, and remains the
way to build a shell and render JSON pages inside it.

Repo-wide scan before removal found no `"type": "app-shell"` node anywhere in
`objectstack-ai/objectui` or `objectstack-ai/objectstack` at `origin/main` — no example,
catalog schema, fixture or template authored one. `content/docs/guide/layout.md` is
updated to state the new fact, and
`packages/layout/src/__tests__/app-shell-not-a-component-key.test.tsx` pins it on both
faces (source and live registry) plus the rendered diagnostic.
