---
'@object-ui/console': patch
'@object-ui/app-shell': patch
---

`/setup` is a real address again — the console gets a stable deep link into platform administration instead of bouncing you back to home

Opening `/_console/setup` landed on `/_console/home`. System settings had no direct URL at all: the only way in was clicking the 「系统设置」 card on the home launcher, which meant the entry point could not be bookmarked, could not be pasted into a support runbook, and was asymmetric with Studio, whose front door has been stable for a while.

The route was never missing — it was occupied. `/setup` mounts the first-run owner-bootstrap wizard (ported here when the Account SPA was retired), and that page evicts everyone it is not meant for: a signed-in visitor via `window.location.assign('/')`, which the landing resolver then turns into `/home` on any multi-app deployment. So the bounce was the wizard doing its job at a URL that had quietly acquired a second, more common meaning.

`/setup` now decides between the two, on the condition the wizard itself already probes — whether the deployment has an owner (`GET /api/v1/auth/bootstrap-status`). No owner yet: the wizard, unchanged. Otherwise: the platform-administration deep link. A live session short-circuits the probe entirely, because `hasOwner: false` cannot be true while somebody is signed in — which also keeps a failed probe from re-creating the bounce it is meant to remove. The verdict is latched for the lifetime of the mount, because `signUp()` flips the session to authenticated while the wizard is still renaming the bootstrap organization, and re-deciding on that flip would unmount the wizard mid-submission.

The destination is read from metadata rather than spelled out. `SetupRedirect` (new, exported from `@object-ui/app-shell` alongside `SystemRedirect`, with its policy available as the pure `resolveSetupAppPath`) resolves the Setup app through the same `appRouteSegment()` helper the home launcher's app cards use, and forwards to the app ROOT — so the page you land on is whatever `AppContent` already resolves as that app's landing item, not a second copy of that policy that would drift the next time Setup's navigation is re-ordered. Search and hash carry across the hop, as they do for `SystemRedirect`.

Two edges are handled rather than papered over. An unauthenticated deep link now goes to `/login?redirect=%2Fsetup` through the console's existing auth-redirect contract — router-derived, so it stays correct under a `<base href>` mount — and lands back on `/setup` after signing in; previously it reached a bare `/login` and the deep link was dropped. And a viewer whose metadata contains no Setup app (the common cause is not a broken build but a missing `setup.access` permission, which filters the app out server-side) gets the shell's ordinary "App not available" screen, with its retry and its one-shot metadata re-check — never a silent landing on home, and never the bare `/apps/setup` pseudo-route, which would have resolved to whichever app happens to be the default.

`/_console/studio` was checked for the same asymmetry and needed no change: bare `/studio` is a declared front door rendering the builder landing, and `/studio/:packageId` already redirects to its Data pillar.
