---
'@object-ui/console': patch
---

The console's `/docs` portal is code-split for real: its four pages leave the eager closure instead of only pretending to.

`AppContent.tsx` lazy-imports `DocsLayout` / `DocsSlug` / `DocPage` for the
app-scoped `/apps/:packageId/docs` tree (ADR-0048). `App.tsx` imported the same
three statically for the platform portal at `/docs` (ADR-0046 section 6), so all
of them sat in the eager graph regardless and the `import()` moved nothing —
three `INEFFECTIVE_DYNAMIC_IMPORT` warnings on every `vite build`
(objectui#5467). A static import on either side silently defeats the split for
both, and the only signal is a build warning that fails nothing.

`App.tsx` now reaches all four docs pages through `lazy()` behind `Suspense`,
matching the pattern `AppContent.tsx` already uses. `DocsIndex` joins them even
though it carried no warning: `AppContent` renders `AppDocsIndex` at that slot,
so nothing imported `DocsIndex` dynamically, but left static it alone would keep
`DocShell`, `use-book-data` and `book-nav` eager and the portal would only
half-leave the closure.

Measured on this branch with the `dist/eager-closure.json` gauge added by
objectui#5324, both builds exiting 0:

| | before | after |
|---|---|---|
| `INEFFECTIVE_DYNAMIC_IMPORT` warnings | 46 | 44 |
| eager closure, gzipped | 3,881,609 B | 3,870,058 B |
| eager chunks | 58 | 52 |

Six chunks leave the eager closure: `plugin-markdown` (4,212 B gz),
`CreateViewDialog` (3,617 B), `use-book-data` (1,966 B), `DocShell` (476 B),
`componentRegistry` (99 B), and `src` (129,555 B), the last of which rolldown
folds into the entry chunk rather than dropping — which is why the entry chunk
grows from 25,910 to 154,378 B gzipped while the closure as a whole shrinks by
11,551 B. The entry stays far under that budget's 350 KB line, and the eager
closure is the number a page load actually pays.

What does NOT move is `vendor-markdown`, 164,708 B gzipped and the reason this
looked like a bigger win than it is. Three eager chunks import it statically,
and only one of them was this portal: `plugin-chatbot` reaches it directly, and
`packages/fields`' `MarkdownContent` — lazy in source — is folded into the
eagerly imported `ui-components` chunk by the `advancedChunks` group that claims
every `packages/fields` module. That is objectui#5325's mechanism, not this
card's, and it is why the saving here is 0.30% rather than 4%.
