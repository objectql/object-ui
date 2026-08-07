---
'@object-ui/collaboration': patch
---

Give `CommentThread`'s `+` reaction picker a real accessible name (objectui#3478)

The fourth glyph-only control in the same component, and the one objectui#3441
walked past. Its content is the literal `'+'`, so the `title` objectstack#5506
gave it (`collaboration.addThumbsUp`) could never become its accessible name: a
`button`'s name is computed from CONTENT (accname §2F) before the `title`
tooltip is consulted at all (§2I). A screen reader announced "plus button". The
copy existed, was localized into all ten packs, and reached only the people who
could already see the button.

That is a different failure from #3441's three buttons, which is why it survived
that fix — those had no authored copy anywhere, so every "is the key wired up?"
check found the gap. Here the key WAS wired up and the English WAS in
`COLLAB_DEFAULT_TRANSLATIONS`; only its DESTINATION was wrong. #3441's own pin
test recorded the defect without naming it, asserting `getByTitle('Add thumbs
up')` and `queryAllByRole('button', { name: 'Add thumbs up' })).toHaveLength(0)`
in the same green case — two assertions that together say "the title is set and
it is not the name". The docblock read them as pinning the picker apart from the
quick 👍; they were also, unread, the bug report.

The fix adds `aria-label` (accname §2C, which outranks content) alongside the
existing `title`, on the same key. Zero new keys — the copy was always there.

The `title` is KEPT rather than replaced, and this is the one control in the
component where carrying both is right instead of redundant: `+` says nothing to
a sighted mouse user either, so the hover hint is doing real work of its own.
(The 👍/❤️ buttons #3441 fixed had no `title` to keep.) Both attributes read the
same key, so the tooltip and the name cannot drift apart.

The name stays `addThumbsUp` — it describes what the button does today
(`onReaction(id, '👍')`, unconditionally), not what `styles.reactionPicker`
hints it might become. Turning it into an actual emoji picker is a feature
change, and the copy follows the behaviour when that lands. It also stays
distinct from #3441's `reactThumbsUp`: on a comment that already has reactions
both controls are on screen at once, and now that both carry a real accessible
name, sharing one key would be worse than when #3441 declined to — two visibly
different buttons announcing themselves identically.

The adjacent reaction chips are deliberately untouched. Their content is
`${emoji} ${count}` — already a descriptive name — so name-from-content is the
right answer there, and their `title` adds the count in words.

Tests assert the computed accessible name via `getByRole('button', { name })`
rather than the presence of an attribute, in English, Chinese and with no
`I18nProvider` mounted; the mirror assertion (`{ name: '+' }` finds nothing) is
what fails if the `aria-label` is ever dropped. #3441's pin was rewritten in
place to pin the new both-named state instead of the old separation, since the
statement it used to make is exactly the one this change falsifies.
