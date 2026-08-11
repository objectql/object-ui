---
'@object-ui/i18n': minor
'@object-ui/console': minor
---

console: seed the UI language from the tenant's server-side locale

`GET /auth/me/localization` has always been fetched on every boot, but its
`locale` only ever fed currency/date formatting — the UI language was decided
entirely client-side, so a tenant configured `zh-CN` still handed every new
device an English console until each user switched by hand.

The tenant locale now sits in the language precedence chain, between the user's
own choice and the browser's:

1. the user's explicit choice (`objectui-locale`)
2. the tenant's server locale, cached at `objectui-locale-seed`
3. the browser language
4. `en`

The server value is cached in a slot of its own and is never written into the
explicit-choice slot, so it can never masquerade as a preference the user
expressed: only a manual switch promotes a language to an explicit choice. A
cached seed applies synchronously at bootstrap, and the in-app fetch refreshes
that cache from every successful answer, so a tenant that changes its locale
reaches choice-less devices on their next boot without an old seed pinning
them. On a device's true first visit the fetch is raced against a ~500ms
timeout alongside the console's existing pre-mount round-trips and fails open
to the browser language; a seed that arrives after the bound is cached for the
next boot rather than re-languaging a live session. A tenant locale this build
ships no pack for falls through to the next tier instead of half-rendering.

No platform additions: no new endpoint, no client read/write API, and
`sys_user_preference` is untouched.
