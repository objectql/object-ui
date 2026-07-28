---
"@object-ui/i18n": patch
"@object-ui/components": patch
"@object-ui/app-shell": patch
---

fix(i18n): close the last three zh-branch gaps (objectui#2871, part 3)

The three items the #2871 classification marked as real but *not* a
migrate-the-copy fix. Each needed a different remedy.

**`LoadingScreen` — ten languages collapsed to two.** The boot splash already
selected real locale packs (not inline copy), but through
`lang.startsWith('zh') ? zh : en`, so a ja/ko/de user watched the whole startup
in English. It now indexes `builtInLocales` by the two-letter prefix.

Each field falls back to `en` **individually**, which matters: `console.*` is
one of the namespaces that trails in the non-`zh` packs (objectui#2872 part a),
so a whole-object swap would have rendered `undefined` on the splash rather
than English. `console.loadingHint` was in fact missing from all eight — added
here, since a blank line under the progress list is worse than an English one.

**`containers.tsx` — two language sources that could disagree.** The tab-label
call sites resolved `language` from `useObjectTranslation()`, then handed the
string to `translateLabel`, which called `detectLocale()` and read
`document.documentElement.lang` on its own. Those update independently, so an
in-app language switch could leave a tab label and its surrounding chrome in
different languages until the next reload. `language` is now threaded in, and
`detectLocale` is deleted so nothing reaches for the DOM again.

**`field-types.ts` — a two-language data catalog.** `FieldTypeMeta` carried a
`labelZh` column beside `label`, which capped the field-type picker at English
or Chinese by construction. The 46 type names and 9 category names move into
the Studio catalog as `engine.fieldType.<id>` / `engine.fieldCategory.<cat>`,
generated from the existing values so no wording changes. This removes the
`isZh` helper from **both** `ObjectFieldInspector` and `ObjectFormCanvas` — the
two files the classification listed as "keep the component, fix the catalog".

The picker's search filter previously matched `id`, the English label, and
`labelZh` — so searching in Japanese or German matched nothing. It now matches
the label as the user actually sees it.
