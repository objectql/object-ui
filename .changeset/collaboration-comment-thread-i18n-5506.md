---
'@object-ui/collaboration': patch
'@object-ui/i18n': patch
---

Localize `@object-ui/collaboration` — `CommentThread` no longer hardcodes English (objectstack#5506)

`@object-ui/collaboration` depended only on `@object-ui/types` and carried every
user-visible string as an English literal, so a `zh` console rendered a Chinese
shell around an English comment thread: "3 comments", "Reply", "Resolve",
"just now", "Add a comment... (use @ to mention)".

The package now takes `@object-ui/i18n` as a dependency and exposes one
translation seam, `useCollaborationTranslation` /
`COLLAB_DEFAULT_TRANSLATIONS`, built on `createSafeTranslation` — the same
factory `data-table`, `form` and `filter-builder` use. Under an `I18nProvider`
it resolves the session locale; with no provider it resolves the English
defaults map, which is what keeps `CommentThread` usable standalone. There is
deliberately no `formatter`/label prop escape hatch: a host that wants
different copy overrides the locale keys, so one thread can never end up half
translated by the bundle and half by props.

The issue listed 13 sites. A site-by-site sweep of the file found **20** — the
seven the original sweep missed are `{n}h ago`, `{n}d ago`, `(edited)`, the
thread's own comment count, the `Oldest`/`Newest` sort options,
`Replying to {name}...`, and the composer's `Send` button. All 20 are keyed
here; leaving any behind would have shipped a thread that is 90% translated.

Two of them carry a second defect on top of being untranslated: the plural
**rule** was compiled into the component, not just the words.

- the header read `` `${n} comment${n !== 1 ? 's' : ''}` ``;
- the reaction chip tooltip read `` n === 1 ? '1 reaction' : `${n} reactions` ``.

Both produced correct *English* — this is not the "1 items" bug objectui#3423
fixed on the tab badge — but the choice between the two forms was English
grammar hardwired into the render path. No locale could apply its own: ru needs
three forms and ja needs none, and neither could ever be expressed no matter
what the packs said.

Both now use the repo's **two-key** plural convention
(`collaboration.commentCount`/`commentCountOne`,
`collaboration.reactionCount`/`reactionCountOne`) rather than an i18next
`_one`/`_other` pair: zh/ja/ko have no separate singular form, so those packs
would legitimately omit the `_one` half and `all-locales-key-parity` reads a
legitimately-absent half as a lost key. Counts are interpolated as strings, so
i18next skips its own plural resolution and the two-key scheme stays in charge.

The reaction tooltip gets a **dedicated** key pair rather than reusing
`detail.reactionCount`: that one interpolates `{{emoji}}`, and at this call
site the emoji is the chip's visible label with nothing to hand the
placeholder — reuse would have left a literal `{{emoji}}` in the accessible
name under every locale.

Relative timestamps stayed word-level: the existing minute/hour/day buckets are
untouched and no date library was introduced. The `>= 7d` branch still uses the
runtime's own `toLocaleDateString()` — that is not a hardcoded English literal,
and pinning it to the session language has its own failure mode (an
unrecognised tag throws into the surrounding `catch`, which would render a raw
ISO string), so it is tracked separately.

`Save` / `Cancel` / `Edit` / `Delete` read from the shared `common` namespace
instead of being re-spelled under `collaboration` — they are the generic action
words, already translated in all ten packs, and a second spelling would only be
a second thing to keep in sync. The 21 genuinely new keys are added to all ten
locale packs with real translations.
