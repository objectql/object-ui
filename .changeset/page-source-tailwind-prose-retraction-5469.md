---
'@object-ui/react-runtime': patch
'@object-ui/sdui-parser': patch
'@object-ui/components': patch
---

Documentation no longer teaches the "JSX/HTML + Tailwind" framing for a page's
`source`, which ADR-0080's own 2026-06-30 header amendment (under ADR-0065,
Accepted) retracted. objectui#5461 corrected three sites; a multiline census
found eight more, in three spellings a line-oriented grep could not see.

A page's `source` is *runtime metadata*. The console's Tailwind is compiled at
build time by scanning the console's own `src`, and there is no safelist, so it
never sees your page: an authored utility class produces CSS only by coincidence
(when objectui already ships that exact class) and otherwise produces nothing,
with no error anywhere. That is the ADR-0065 "works only by coincidence" failure
mode, and it is how a modal's `bg-black/50` backdrop reached production fully
transparent. `os validate` reports it as `page-source-className-tailwind`, a
warning on kinds `html`, `react` and `jsx`, shipped in `@objectstack/lint@11.5.0`.

The tiers themselves are unchanged and every load-bearing claim survives —
parse-never-execute, the untrusted-author safety argument for `html`, and the
deprecated `'jsx'` alias. Only the styling primitive is corrected, to the wording
`content/docs/guide/react-pages.md` §Styling already uses:

| `kind` | Style with |
|---|---|
| `"html"` | The blocks' own structured props (`` `<flex direction gap>` ``, `` `<grid columns>` ``) plus a JSON `style` object. |
| `"react"` | Inline `style` objects. |

Colors on both tiers come from the theme as `hsl(var(--token))`.

Why each package has an entry — each was measured against its built artefact, not
assumed:

- **`@object-ui/react-runtime`**: `README.md` is published to npm (npm includes
  `README.md` in the tarball regardless of `files`). Its "no sandbox" callout is
  the paragraph that routes untrusted-author work to the `html` tier, and it
  carried the retracted framing line-wrapped across `:17-18`. It also gains the
  §Styling section it was missing — the absence is why the framing survived here.
- **`@object-ui/sdui-parser`**: the corrected header of `src/types.ts` projects
  verbatim into the published `dist/types.d.ts`.
- **`@object-ui/components`**: the corrected header of
  `src/renderers/basic/html-elements.tsx` projects verbatim into the published
  `dist/renderers/basic/html-elements.d.ts`. The `kind === 'html'` dispatch-arm
  comment in `src/renderers/layout/page.tsx` does **not** project (it is inside a
  function body) and is included here only because the same package already owes
  an entry.

No behaviour change: this is prose only. `CHANGELOG.md` occurrences are
deliberately untouched — immutable release history.
