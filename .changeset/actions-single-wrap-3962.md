---
"@object-ui/app-shell": patch
---

fix(actions): read objectstack#3962's single-wrapped /actions responses; legacy double wrap detected narrowly

objectstack#3962 made `/actions` failures speak HTTP (400 rejection / 404 / 403
/ 503 / 500) and single-wrapped success — `body.data` IS the handler's return
value. `interpretActionResponse` / `readActionPayload` now treat that as the
primary shape: the pre-#3962 double envelope is detected NARROWLY (a boolean
`success` and no keys beyond the envelope's own) and unwrapped for older
runtimes, so a handler value that merely contains a `success` key is
handler-owned and passes through untouched. `ActionResult.data`'s depth quirk
self-heals on #3962 servers.
