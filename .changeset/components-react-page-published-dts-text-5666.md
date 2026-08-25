---
'@object-ui/components': patch
---

Published declaration text for the react page renderer changed: `kind:'react'` page `source` styling is now stated in the shipped `.d.ts`

`dist/renderers/layout/react-page.d.ts` is in this package's npm tarball, and the
declaration emitter reproduces that module's file-header documentation into it
verbatim. Two things a consumer reads — on hover over `ReactKindPage` in an editor,
or straight out of the tarball — now say something different:

- The injected-scope note no longer tells authors that layout is left to "plain
  HTML + Tailwind". It says plain HTML.
- A new paragraph states the styling contract for `kind:'react'` page `source`:
  `source` is runtime metadata, not build input. Style with inline `style` objects
  using `hsl(var(--token))` theme colors, and render overlays through `ObjectForm`
  with `formType` `"drawer"` or `"modal"` rather than a hand-rolled `fixed inset-0`
  backdrop. Do **not** author Tailwind utility classes in page `source`: the
  console's Tailwind is compiled at build time by scanning the console's own `src`
  and there is no safelist, so an authored utility class silently produces no CSS
  and no error anywhere. `os validate` reports it as
  `page-source-className-tailwind`. (ADR-0065; ADR-0080's 2026-06-30 amendment;
  see `content/docs/guide/react-pages.md`.)

That is guidance an author can act on, and it contradicts what this package's
declarations previously told them, so it is a change to the published surface
rather than an internal edit. No runtime behaviour changed and no export moved.

This entry is corrective. The text landed under objectui#5461 with a changeset that
declared only `@object-ui/types`, on the stated grounds that the edits "do not
project into any `.d.ts`". Rebuilding the package shows that they do — the reasoning
and the measurement are recorded in `scripts/check-changeset-presence.mjs`'s header,
where the next author will meet them.
