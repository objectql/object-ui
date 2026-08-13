---
'@object-ui/console': patch
---

Console: restore `crypto.randomUUID` on insecure origins so list views stop crashing on LAN IPs

`crypto.randomUUID` is exposed only in secure contexts (HTTPS or
`http://localhost`). Reaching a dev box over plain HTTP from another machine —
`http://192.168.x.x:4001/_console/`, the ordinary second-device flow — left the
method undefined, and every unguarded caller threw
`TypeError: crypto.randomUUID is not a function`, taking the console's list
views into the ErrorBoundary.

The console's HTML entry now installs an RFC 4122 v4 fallback built on
`crypto.getRandomValues` (which is not secure-context-gated, so the entropy
stays cryptographic). It runs as an inline classic script, synchronously during
parse, so it precedes every bundled chunk. It is guarded on absence and never
replaces a native implementation, so secure origins are unaffected; with no
entropy source available it installs nothing rather than degrading to
`Math.random`.
