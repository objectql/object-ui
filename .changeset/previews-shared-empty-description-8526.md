---
'@object-ui/app-shell': patch
---

Metadata-admin previews: the empty-collection sentences under `metadata-admin/previews/` render the shared `EmptyDescription`

Sixteen sites across twelve preview files (`ActionPreview`, `AgentPreview`, `DatasourcePreview`, `EmailTemplatePreview`, `FlowPreview`, `FlowRunsPanel`, `FlowSimulatorPanel`, `JobPreview`, `ScreenPreview`, `SkillPreview`, `ToolPreview`, `TranslationPreview`) each hand-rolled the same empty-collection state — a muted italic sentence in a plain `div` — and two of them (`AgentPreview`, `ToolPreview`) declared a file-local component literally named `Empty`, which shadowed the shared family in the one place a maintainer would reach for it. They now render `EmptyDescription` from `@object-ui/components`, used alone outside any `Empty` container, so every one of these states carries the family's `data-slot="empty-description"` and is one kind of thing.

Each site keeps its measured size (`text-xs` for the rails, `text-[10px]` for the run-row step log, `text-[11px]` for the translation category card, `text-sm` for the screen body), so the layout delta at every site is zero. The two local `Empty` components are removed.
