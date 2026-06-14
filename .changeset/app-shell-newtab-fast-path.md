---
"@object-ui/app-shell": minor
"@object-ui/core": minor
---

feat(app-shell): zero-roundtrip `newTabUrl` fast path for `opensInNewTab` actions

Actions that declare `newTabUrl` (a path template with a `{recordId}` placeholder
whose target endpoint performs all auth/authz itself) now drive the pre-opened
popup straight to that URL on click, skipping the action POST entirely — applied
to both server-action paths (list rows via `useConsoleActionRuntime`, record
header via `RecordDetailView`). The popup paints the existing spinner page until
the (possibly slow) endpoint commits its redirect; the URL is resolved absolute
because `about:blank` gives a bare-relative href no reliable base. The
popup-blocked toast fallback is unchanged. Removes one full round trip of
white-screen latency from every such Open click.
