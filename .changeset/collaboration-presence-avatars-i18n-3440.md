---
'@object-ui/collaboration': patch
'@object-ui/i18n': patch
---

Localize `PresenceAvatars` — the avatar stack's accessible name and tooltips follow the session language (objectui#3440)

objectui#3424 wired `@object-ui/collaboration` up to `@object-ui/i18n` but only
converted `CommentThread`. `PresenceAvatars` in the same package kept three
English literals, and it is not a dormant export — the console renders it in
two places: `app-shell/src/layout/AppHeader.tsx` (tenant presence beside the
lifecycle badge) and `app-shell/src/views/RecordDetailView.tsx` (who else is on
this record). A `zh` session got them in English.

The three sites:

- the group's `aria-label`, `` `${n} user${n !== 1 ? 's' : ''} present` ``;
- the overflow badge's tooltip, `` `${n} more user${n !== 1 ? 's' : ''}` ``;
- each avatar's tooltip, `` `${name} (${status})` ``.

The first one is the whole control as far as a screen reader is concerned: the
stack renders images and initials and nothing else, so there was no other
accessible name to fall back on.

As with the comment count in #3424, the first two carried a second defect on
top of being untranslated — the plural **rule** was compiled into the component.
Both produced correct *English* (each has a real singular branch, so this is
not the "1 items" defect objectui#3423 fixed on the tab badge), but
`n !== 1 ? 's' : ''` is English grammar in a render path and no locale could
apply its own. Both now use the repo's **two-key** plural convention
(`collaboration.presentUserCount`/`presentUserCountOne`,
`collaboration.moreUserCount`/`moreUserCountOne`) rather than an i18next
`_one`/`_other` pair, with the count interpolated as a string so i18next skips
its own plural resolution. German is what witnesses the move: "1 anwesender
Benutzer" vs "2 anwesende Benutzer" inflects the adjective, which the deleted
ternary could not have produced for any pack.

The avatar tooltip becomes a single `collaboration.userStatusTitle` key
(`{{name}} ({{status}})`) so the parentheses and their spacing belong to the
translation — the CJK packs drop the space English puts before `(`, matching
their existing `edited: '(已编辑)'`.

Its `status` is a **display-layer** translation
(`collaboration.statusActive` / `statusIdle` / `statusAway`): the
`PresenceUser['status']` enum value stays raw data everywhere it is stored,
compared or passed around — including the `statusColors` lookup — and is
translated only at this render exit. A status outside the declared union
renders as itself, the raw string: presence users arrive from a host-supplied
`PresenceSource` transport, so an unmapped value is reachable at runtime
whatever the type says, and the fallback invents nothing rather than leaving an
empty bracket pair.

Eight new keys, added to all ten locale packs with real translations.
