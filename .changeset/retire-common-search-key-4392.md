---
'@object-ui/i18n': minor
'@object-ui/fields': patch
---

i18n: retire the reader-less `common.search` key from all ten locale packs

`common.search` (`Search`, no ellipsis) had exactly one consumer: `LookupField`
built its dialog placeholder by concatenating the key with three ASCII full
stops. objectui#4375 / PR #4391 retired that concatenation — the placeholder is
the reused `table.search` pack value (`Search…`, one U+2026 glyph), which is what
brought it under objectui#3878's glyph pin. That left `common.search` with zero
readers repo-wide while it still existed in all ten packs.

Re-verified before deleting, repo-wide: no `t()` call site in any package or app,
no MDX or JSON reference, and the one dynamic template-literal reader of the
`common` namespace takes a two-member union parameter (`'openChat' |
'closeChat'`) that cannot resolve to it. No user-visible string changes — this key never rendered.

The dormant copy in `@object-ui/fields`' no-provider fallback table
(`useFieldTranslation.ts`'s `FIELD_DEFAULTS`) goes with it. That table is a
module-local `Record<string, string>` read only when no `LocalizationProvider`
is mounted; it is not exported, so removing an entry no reader asks for changes
no rendered output and narrows no public type. Hence patch for that package,
while the pack change is a minor: deleting a key from `en` narrows the exported
`TranslationKeys` type (`typeof en`), so code indexing `TranslationKeys` at
`common.search` stops type-checking. Same grading, for the same reason, as
objectui#4145's `report.editor.*` retirement. No runtime consumer existed to
break.

Retiring a key from `common` was the ruled decision on objectui#4392 rather than
keeping it as vocabulary: nothing pins a dormant key's meaning, so its next
reader inherits an unreviewed contract, and a dormant key beside a live
`table.search` is where a second dialect gets started. The objectui#4328
dead-surface family has consistently chosen removal for zero-consumer surfaces.

The neighbouring `common.select` (minted one commit earlier by objectui#4386 /
PR #4397) is a different key and is untouched.

A negative pin (`packages/i18n/src/__tests__/common-search-retired-4392.test.ts`)
fails if the key returns to any pack, if any package reads or re-declares it, or
if a dynamic `common.*` reader grows a `search` member — every existing i18n gate
runs call site to key, and none of them can see a key with no call site.
