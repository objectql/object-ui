---
"@object-ui/i18n": patch
---

Backfill the `console` namespace's 41 missing locale keys plus the `console.ai.group.` template family (objectui#3546, slice four)

`scripts/check-i18n-call-site-keys.mjs` (objectui#3530) measured **41 distinct
keys at 47 call sites** under `console.*` that a `t()` call site asks for and
that **no locale pack defined** — five of those keys have more than one site
(`console.ai.dock.maximize` has three), which is why the denominator is measured
and never counted by hand. All 47 carried an inline
`t(key, { defaultValue: 'English' })`, so this is the objectui#3517 class:
English rendered correctly, and **all ten languages were stuck on it**. Nothing
here rendered a raw key — slice one (PR #3583) held those sites.

What that meant on the page: a `zh` user opening `/ai` got "Waiting for
server…", "Still working…" and "Connection lost — reconnecting…" in the
connection banner, all ten "Designing your app…" progress hints in English, and
"Built" / "Not yet built" / "Published" / "Publish failed" on the plan card; the
ChatDock's whole chrome (title, resize handle, collapse, "Open full page") was
English including two `aria-label`s; the conversation sidebar's date headers read
"Today" / "Yesterday" / "Previous 7 days"; a mistyped URL produced an English
"Page not found"; and the `?` shortcuts dialog's AI group was English inside an
otherwise translated table. Two of these strings ("Not yet built", "TODAY") are
named in objectui#2458's mixed-language list.

- **`packages/i18n/src/locales/en.ts`** gains 46 keys: the 41 measured ones plus
  the five members of the `console.ai.group.` family. `console.notFound` is a new
  sub-namespace; the rest extend `console.shortcuts` and `console.ai` (with new
  `console.ai.dock`, `console.ai.designingPlanHint` and `console.ai.group`
  objects). Every one of the 41 measured keys takes its call site's inline
  `defaultValue` **byte for byte** (46/47 sites, script-compared), so the pack
  path and the inline-default path cannot diverge.
  - The one site that cannot match is `ChatDock.tsx:563`, where a single key
    (`console.ai.dock.open`) carries two different English strings: the
    `aria-label` says `Open assistant` and the `title` says
    `Open assistant (⌘⇧I)`. A key can hold one value, so `en` takes the
    `aria-label` spelling — an accessible name must not carry a glyph run that
    screen readers announce as symbols, and `⌘` is a mac-only glyph that a
    *language* pack cannot vary per platform. The tooltip therefore stops
    advertising the shortcut; recorded on objectui#3810 (whose class this
    divergence joins) rather than papered over.

- **`console.ai.group.` leaves the ratchet's `missingPrefixes` (4 → 3).** It is a
  template key — ``t(`console.ai.group.${group.key}`)`` in
  `ConversationsSidebar.tsx:277` — whose static head matched no `en` key, so every
  expansion missed. Its value surface is the **closed** `ConversationGroupKey`
  union, so the repair is an enumeration of all five members, not a wildcard; a
  test reads the component's own union and label map and fails if a sixth bucket
  is ever added without a key.

- **The nine other packs** get real translations, each evidenced against its own
  `console` neighbours: `zh` full-width punctuation and the pack's single-em-dash
  status-line style, `ja`/`ko` the pack's `AI ` spacing, `de` formal *Sie* and
  its `Wird …` progressive, `fr` straight apostrophes, `es` *usted* (as the
  `console.ai` neighbourhood already uses), `pt` the pack's `off-line` spelling,
  `ru` ё orthography, `ar` verb-first phrasing that never opens an RTL sentence
  with a Latin token. Where `en` repeats a string the packs already translate
  (`Go back`, `Publish failed`, `Try again`, `Back to home`, `Assistant`,
  `Today`, `Yesterday`), the existing neighbour's wording is reused rather than
  re-invented.

- **`scripts/i18n-call-site-key-baseline.json`** shrinks by exactly 42 entries
  (41 keys + 1 prefix family): 109 → 68 keys, 4 → 3 prefixes.

No component changed: an AST sweep of all 308 `console.*` call sites in the repo
found zero dead `t(key) || 'English'` fallbacks among this slice's keys.
