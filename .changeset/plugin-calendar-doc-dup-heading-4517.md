---
---

Docs only: `content/docs/plugins/plugin-calendar.mdx` printed the `## ObjectCalendar
Component` heading and its intro sentence ("Calendar component designed for use with
ObjectQL data sources.") twice, back to back, with nothing between the two copies
(objectui#4517). The first pair is removed; the second one and everything under it —
`### Features` onwards — is untouched, and the section keeps exactly the content it
always had.

Nothing rendered wrong, but the duplication was visible in two places a reader lands on:
the docs site builds its table of contents from headings, so the page nav listed
"ObjectCalendar Component" twice with the first entry pointing at an anchor that had no
content beneath it, and two headings with the same text produce two slugs — the plain
`#objectcalendar-component` plus a de-duplicated variant — which makes a deep link to the
section ambiguous about which of the two it lands on.

No package source, types or runtime behaviour changed, so this declares no release; the
mechanical presence gate (`scripts/check-changeset-presence.mjs`) does not owe one for a
`content/docs/**` diff either. It is declared anyway because that is what this repo does
with docs-only work — the same empty-frontmatter shape as the `content/docs` corrections
in objectui#4793, #4808, #4823, #4827 — so the change is recorded once rather than
arriving unannounced.
