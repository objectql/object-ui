---
'@object-ui/console': patch
---

The first-run setup wizard no longer drops a brand-new owner outside the console

On a console served under a mount — `/_console/`, which the framework CLI configures for every embedded deployment by injecting a `<base href>` — finishing the first-run owner bootstrap landed the new owner on the ORIGIN root instead of the console. Both of `SetupPage`'s exits navigated to a bare `/`: the success path after the account is created and the bootstrap organization renamed, and the bounce that sends an already-signed-in visitor away. `window.location.assign` does not go through React Router, so its `basename` never applied and a root-relative `/` left the SPA. It is the worst possible moment for a dead end — the first screen after creating the account, on a deployment that by definition has no other account to recover with.

Under the default `/` mount the prefixed and unprefixed spellings are identical, which is why no standalone `os dev` run ever surfaced this.

Both exits now go through the console-mount helper `LoginPage` already used for exactly this, so they land inside the SPA under every mount. They stay full-page navigations deliberately: the console shell mounts its metadata tree as soon as auth *resolves* rather than when it authenticates, and re-keys it only on language, so the app list read while nobody was signed in would survive a router navigation and leave the new owner in an appless console. Tearing the document down is what guarantees the console rebuilds with the session.

The helper itself was module-private to `LoginPage` and had already been copied verbatim into `RegisterPage`. It now lives in one place with all three auth surfaces importing it, so the next mount fix lands once rather than three times. `LoginPage` and `RegisterPage` behaviour is unchanged, and pinned as unchanged across all three mount configurations.
