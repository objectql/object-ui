---
'@object-ui/components': minor
'@object-ui/app-shell': minor
'@object-ui/plugin-detail': minor
'@object-ui/plugin-list': minor
'@object-ui/plugin-view': minor
---

Consolidate the seven lucide icon-name resolvers into one seam (objectui#5935).

Seven modules resolved authored icon names into lucide's runtime `icons` record, each
with its own copy of the logic: **three different tokenisers** (`split('-')` on five of
them, `split(/[-_\s]/)` on one, `split(/[-_\s]+/)` on one) and the `Home` -> `House`
rename on only **four** of the seven. The same authored name therefore rendered on one
surface and not another — the sidebar-vs-action-bar disagreement objectui#5633 opened
with. There is now one resolver, `resolveIcon`, exported from `@object-ui/components`,
and the other six call it.

**The tokeniser is `split(/[-_\s]+/)` with `Home` -> `House` applied universally, and it
was measured rather than chosen.** Its regression set is empty three independent ways:
against the authored population, against a maximally-pessimistic every-authored-name x
every-surface cross-product, and against a bound-free differential over 8,298 spellings
derived from all 1,767 live record keys — each with a discrimination control that fired
in the same run. `split('-')` was **not** adoptable: it regresses 4,748 name-surface
pairs in that last reading, stripping two surfaces of every snake_case and
space-separated spelling they resolve today.

**What changes for you — all of it widening, none of it removal.** No name that resolved
before stops resolving: no key of lucide's record contains `_`, whitespace or `-`
(measured: 0 of 1,767), so whenever the old narrow tokeniser produced a live key the
wider one produces the same key. Sixteen name-surface pairs start resolving where they
rendered a fallback or nothing before:

- `layout_dashboard` and `building_2` (and every other snake_case or space-separated
  spelling) now resolve on the shared resolver, `ui:icon`, `ListView`'s empty state,
  `TabBar` and `ViewSwitcher` — they previously resolved only on the action preview and
  the related list.
- `home` / `Home` now resolves on `RelatedList`, `ListView` and `TabBar`, which carried
  no rename map. `Home` is not a live record key, so this could only ever be a widening.

**What does NOT change: what each surface draws when a name does not resolve.** The seam
answers `name -> component`, returning `null`, and decides nothing else (maintainer
ruling 2026-09-03 on objectui#5935). Every call site keeps its own fallback, visibly, at
the call site: `ui:icon` keeps its `SquareDashed` placeholder and its warning
(objectui#5631, untouched), `RelatedList` and `ListView` keep their `Inbox` glyph,
`ActionPreview` keeps its three-character name chip, and the shared resolver, `TabBar`
and `ViewSwitcher` keep `null`. A two-valued `onUnresolvable` parameter was ruled on and
then dropped once the tree was measured to have four such behaviours rather than two: a
lookup function is the wrong place to publish a presentation decision.

`resolveIcon` is newly exported from `@object-ui/components`, which is the only surface
this adds. `scripts/check-lucide-icon-record-names.mjs` is simplified in the same change:
its census goes from seven sites to one, and its normalisation stops being a
widest-common approximation of three disagreeing resolvers — so the under-reporting that
gate disclosed at objectui#5932 is closed rather than merely bounded.
