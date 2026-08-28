---
---

Docs only — this publishes nothing, declared explicitly with an empty frontmatter rather
than left undeclared.

`content/docs/guide/react-pages.md` contradicted the framework's sources on four points.
The guide is live material (`@object-ui/react-runtime`'s README links it twice), so each
one was reachable teaching. All four were re-measured against `objectstack@f094214b3` and
resolved toward the source:

- **Tailwind styling.** The guide taught Tailwind `className` as the react tier's styling
  primitive, which ADR-0080's 2026-06-30 amendment retracted under ADR-0065 (Accepted): a
  page's `source` is runtime metadata the console's build-time Tailwind never scans, so an
  authored utility class silently produces no CSS. Replaced with the per-tier primitive the
  shipped `page-source-className-tailwind` rule names — inline `style={{ … }}` with
  `hsl(var(--token))` on the react tier, structured props plus a JSON `style` object on the
  html tier — and added a Styling section giving the mechanism.
- **`record:*` scope.** The family was offered as the illustrative in-scope example while
  `os validate` rejects it (`react-block-needs-record-context`, severity error, matched by
  type). The tag-derivation rule is kept — it is accurate — and the exclusion, the real
  error text, and the per-block alternatives are now stated beside it.
- **`adapter.find` options.** The `Live data` sample passed `filters:`, which is not a
  `QueryParams` key; `convertQueryParams` reads only `$`-prefixed keys, so the sample
  returned the object's records unfiltered with no error. Corrected to `$filter`. The same
  sample also treated the result as an array — `find` resolves to a `QueryResult`, so
  `.map` on it throws; corrected to `res.data` alongside it.
- **Block inventory.** The guide conflated the runtime scope (every public non-container
  block) with the authored contract (`REACT_BLOCKS`: `ObjectForm`, `ListView`,
  `ObjectChart`, `Block`). Both are now stated as two tiers, with the generated
  `react-blocks.md` named as the prop authority, and the flat-props example moved off two
  deprecated `ObjectGrid` spellings (`pageSize`, `fields`) onto the canonical
  `pagination` / `fields` on `ListView`.
