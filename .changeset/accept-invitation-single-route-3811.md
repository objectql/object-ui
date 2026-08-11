---
'@object-ui/console': minor
'@object-ui/i18n': minor
'@object-ui/app-shell': patch
---

`/accept-invitation/:invitationId` is one route, one component, one namespace — the console now renders the invitation page that actually shows you the invitation

Two components shipped for this single URL. The console routed its own thin page, which offered nothing but an Accept and a Decline button: it never told the user which organization they had been invited to, in what role, or when the link expires, and accepting left them in whatever organization they were already in. App-shell's page — exported as `DefaultAcceptInvitationPage`, routed by nobody — fetches the invitation, shows the organization, the role and the expiry date, and switches the user into that organization on accept. Console now routes that one. The thin page is deleted.

Behind them sat two i18n namespaces for one screen: `acceptInvitation.*` (12 keys) for the thin page and `organization.accept.*` (14) for the richer one, both freshly translated into ten languages by different slices of objectui#3546, neither wrong when read on its own. That is 26 keys of duplicated copy with no gate to tell the next author which of the two to edit — the failure mode this repo already has an uncollected precedent for. `acceptInvitation.*` is removed from all ten packs, and its absence is pinned negatively so it cannot drift back: the slice-three test now asserts that no pack defines any of the 12 retired keys (nor an emptied namespace root left by a partial revert), and that neither consuming package asks `t()` for one.

One behavior needed repairing before the swap was safe rather than after. `?redirect=` is a basename-stripped path by contract in this console — `LoginPage` re-prefixes it with the mount before navigating — and the thin page built it from the route param, correctly. App-shell's page built it from `window.location.pathname`, which already carries the mount, so a console served under a `<base href="/console/">` would have sent the user back to `/console/console/accept-invitation/…` after signing in. It now reads the router (`useLocation`), like every other producer of that parameter in this repo. Under the default `/` mount the two spellings are identical, which is why only a basename case can see the difference; that case is now a test.

Nothing published was removed: `DefaultAcceptInvitationPage` keeps its export and simply becomes the routed implementation. Downstream apps mounting it get the redirect fix and are otherwise untouched.
