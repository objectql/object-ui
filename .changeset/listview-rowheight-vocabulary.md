---
"@object-ui/core": minor
"@object-ui/plugin-list": minor
"@object-ui/app-shell": minor
"@object-ui/types": patch
---

refactor(views): ListView resolves density from the spec-canonical `rowHeight` (#2890 scope A step 2)

Second rename in the ListView vocabulary migration: **`densityMode` → `rowHeight`**,
folded in the same `normalizeListViewSchema` that step 1 introduced.

Unlike `fields`/`columns` this is not a pure alias — the two vocabularies are
different sizes. The spec has five row heights (`compact`/`short`/`medium`/
`tall`/`extra_tall`); ListView's toolbar offers three densities
(`compact`/`comfortable`/`spacious`). Both directions now live in one place as
`DENSITY_MODE_TO_ROW_HEIGHT` / `ROW_HEIGHT_TO_DENSITY_MODE`, chosen so a fold
followed by a read is a round trip (`spacious` → `tall` → `spacious`), with the
narrowing collapse (`short` → `compact`, `extra_tall` → `spacious`) stated once
instead of being re-derived per call site.

Two behavior fixes fall out of it:

- **Precedence is no longer inverted.** `ListView` read `densityMode` *first*, so
  a view carrying both keys rendered the legacy value — backwards from every
  other legacy/canonical pair in the schema. The canonical key now wins.
- **The toolbar stops re-seeding the legacy key.** `ObjectView`'s
  `onDensityChange` persisted `densityMode` into stored view metadata on every
  density toggle, so the legacy vocabulary kept regrowing underneath the
  migration. It persists `rowHeight` now.

`densityMode` stays declared on `ListViewSchema` and in the drift guard's
sanctioned set — stored views carry it and it is still valid input — but it is
input-only.
