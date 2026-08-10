---
"@object-ui/app-shell": patch
"@object-ui/plugin-detail": patch
"@object-ui/plugin-list": patch
"@object-ui/console": patch
---

Align 43 inline `defaultValue` strings with the `en` pack, and make the call-site gate enforce it (objectui#3810)

`t(key, { defaultValue: 'English text' })` only renders that text when i18next
**misses** the key. Where the key exists in `packages/i18n/src/locales/en.ts` the
pack value always wins, so the inline string is dead code — and 43 of those dead
strings said something different from the sentence users actually read.

`scripts/check-i18n-call-site-keys.mjs` (objectui#3530) now compares the two
whenever a call site carries a literal `defaultValue` for a key `en` defines, and
fails on any byte of difference. It is a hard rule with **no baseline**: the
repo-wide census measured 43 sites in 19 files out of 851 literal inline defaults,
and all 43 are aligned here, so there is no debt for a ratchet to hold. A
`defaultValue` on a key that is *not* yet in `en` stays legal — that transition
runs for months (objectui#3546) and belongs to the existing `missing-key` rule,
which keeps reporting it alone.

Every fix moved the CALL SITE to the pack's wording. `en.ts` is untouched: its
values are what users read today, and changing one would oblige the same change in
the nine other packs (`scripts/check-i18n-en-drift.mjs`, objectui#3650). Six of the
43 differed only in an ellipsis (`...` against U+2026) — invisible in review, which
is how they survived three i18n gates that are each blind to this class by
construction.

The visible effect is confined to hosts that render these components with **no**
`I18nProvider` and no initialised i18next instance. There, react-i18next's
not-ready `t` returns the `defaultValue`, so the inline string was the rendered
one; it now matches what a provider-backed app has always shown. Inside the
console — provider mounted — nothing users see changes. The clearest converging
examples: the workspaces screen was written as "Organizations" at nine call sites
while every user has been reading "Workspaces"; the forgot-password success line
was written as "If an account exists, a reset link has been sent." while the pack
asserts "We've sent a password reset link to {{email}}."
