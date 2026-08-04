---
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

The console server-action wrapper's `opensInNewTab` choreography no longer
ships hard-coded bilingual Chinese/English copy (objectui#3321, AGENTS.md
Commandment #-1): the pre-opened SSO spinner tab (title + body) and the
popup-blocked toast (title, description, action label) are now localized
through new `console.serverAction.*` keys in `@object-ui/i18n`, added at full
parity across all eleven locale packs.

`createConsoleServerActionHandler` gains an optional i18next-style `t` option
(`t(key, englishDefault)`) — the wrapper is a plain function, so the translate
function is injected from the two hook-context call sites
(`useConsoleActionRuntime`, `RecordDetailView`) via `useObjectTranslation`.
When omitted (tests / standalone), every string falls back to its English
default; no non-English copy remains in code. Locale strings are HTML-escaped
before being written into the spinner document.
