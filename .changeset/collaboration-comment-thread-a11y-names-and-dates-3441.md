---
'@object-ui/collaboration': patch
'@object-ui/i18n': patch
---

Name `CommentThread`'s three emoji-only buttons, and follow the session language past the 7-day mark (objectui#3441)

Two leftovers from objectstack#5506 / objectui#3424, in the same component. It
is an exported, published component with no in-repo consumer, so both only ever
bite an external host.

**One — three controls with no authored accessible name.** Each comment's two
quick-reaction buttons (`'👍'` and `'❤️'`) and the reply banner's dismiss button
(`'✕'`) carried no `aria-label` and no `title`. The `+` reaction picker right
beside them has had one since #3424 (`collaboration.addThumbsUp`), which is what
makes these three an omission rather than a design choice.

`aria-label`, not the `title` the `+` uses: a `button`'s accessible name is
computed from its CONTENT (accname §2F) before the `title` tooltip is ever
consulted (§2I), so on a button whose only child is a glyph a `title` decorates
the mouse and leaves the name alone. What a screen reader read out was the
codepoint — "thumbs up", "red heart", in English whatever the session language,
and for U+2715 MULTIPLICATION X very often nothing at all.

Three new keys in all ten packs: `collaboration.reactThumbsUp`,
`collaboration.reactHeart`, `collaboration.cancelReply`.

`reactThumbsUp` is deliberately NOT a reuse of `addThumbsUp`, even though both
dispatch the same `onReaction(id, '👍')` today. `addThumbsUp` names the reaction
bar's picker entry point, whose copy follows the picker if it ever picks; and on
any comment that already has reactions the two controls are on screen together,
so one shared key would put two visibly different buttons under one name.
`cancelReply` rather than the generic `common.cancel` for the same reason — an
accessible name has to say what is being cancelled (only the reply target is
dropped; anything typed into the composer survives).

**Two — the >= 7 day timestamp ignored the session language.** `formatTimestamp`
ended in a bare `date.toLocaleDateString()`, i.e. the RUNTIME's locale, so a
`zh` session read "6 天前" for a six-day-old comment and `8/1/2026` for an
eight-day-old one.

The fix passes the session `language`, but not straight through — that is the
trap #3424 flagged and declined to walk into. `toLocaleDateString(tag)`
canonicalizes its argument and throws `RangeError` on anything not well-formed
per BCP 47, and the session language reaches the component verbatim: a host that
configures `defaultLanguage: 'en_US'` (the POSIX spelling — well-formed-looking,
and rejected) hands `Intl` a tag it refuses. That `RangeError` would land in
`formatTimestamp`'s outer `catch`, whose fallback is `return iso`, replacing the
date with a raw `2026-08-01T09:30:00.000Z` — worse than the un-localized date it
set out to fix.

So the absolute-date branch gets its own local `try`/`catch` that falls back to
the no-argument call. A malformed tag degrades to exactly the previous
behaviour (the runtime's own locale); the worst case of following the session
language is the status quo, never a regression. A well-formed but unknown tag
such as `xx-YY` does not throw at all — `Intl` resolves it to the default — so
only genuinely malformed tags reach the guard. No date library, and no month or
weekday copy in the locale packs: `Intl` already owns the per-locale ordering
and separators.

Tests assert the computed accessible name via `getByRole('button', { name })`
rather than the presence of an attribute, which is the distinction the fix turns
on, and pin that no button is left answering to a bare emoji. The malformed-tag
case is recorded honestly as green on both sides of this change — `origin/main`
never passed a tag anywhere, so it could not trip over a bad one; its
counterfactual is the naive fix, and dropping the inner `catch` is what turns it
red with the raw ISO string in the DOM.
