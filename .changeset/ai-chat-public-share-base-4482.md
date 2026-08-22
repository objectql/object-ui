---
'@object-ui/app-shell': patch
---

`AiChatPage`'s public share-link base now resolves through the one console-mount
resolver instead of a private copy of it (objectui#4482).

The page built `publicShareBase` itself — read the injected `<base href>`, take its
pathname, trim trailing slashes, concatenate `${origin}${base}/s` — which was the third
independent implementation of the mount resolution `resolveConsoleUrl` centralizes.
objectui#4472 had just deleted the other two on that rule; this was the surviving
sibling. Its output was correct, so nothing a user hits was broken and nothing a user
hits changes: measured over the base-href matrix, the deleted builder and
`resolveConsoleUrl('s')` return identical URLs for every shape the console is served in
— `/_console/` (the only href the framework CLI injects), `/` root mounts, `./` portable
builds, nested mounts, and no `<base>` at all.

The `/s` resolution now lives beside its three siblings as `resolvePublicShareBase()`,
which keeps the one thing a bare `resolveConsoleUrl('s')` call would drop: with no DOM
it returns `undefined` rather than a URL built from an origin that does not exist, so
`ShareDialog` applies its own fallback. It deliberately takes no `baseURI` argument —
the mount is only ever carried by the injected `<base href>`, and a resolver with no
other input cannot be pinned by a test that steers something production never reads.

`resolvePublicShareBase.browser.test.tsx` pins the resolved base against a real injected
`<base>` element for each deployment shape, plus a structural case asserting no other
app-shell file reads the `<base>` tag — so a fourth copy fails a test rather than
waiting for mount semantics to change under it.
