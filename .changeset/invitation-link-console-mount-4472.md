---
'@object-ui/app-shell': patch
---

The copied invitation link is one the recipient can actually open — both copy sites resolve through the console mount instead of rebuilding it from `BASE_URL`

Copying a link from the workspace **Invitations** tab produced `http://localhost:8080./accept-invitation/<id>` — unusable twice over. Both copy sites (the Invitations tab's per-row copy button and the invite dialog's freshly-created "Accept link" field) carried their own `buildAcceptUrl`, glueing `${window.location.origin}` to `import.meta.env.BASE_URL`. In the portable build the console ships (`base: './'`) `BASE_URL` is the literal `'.'`, so that concatenation put a dot straight after the authority — a trailing-dot host. Removing the dot by hand did not help either: the resulting `/accept-invitation/<id>` skips the deployment mount, and a console served under `/_console/` answers that path with `{"error":"Not found"}`. An invited user had no working way in.

Both local copies are deleted. The two sites now call `resolveConsoleUrl`, the mount-aware helper `WorkspaceSwitcher` and `OrganizationsPage` already use for full-page navigations — it resolves against the `<base href>` the server injects, which is exactly the trailing-dot failure `resolveHomeUrl`'s header documents as retired. One resolver, one answer: no URL assembly survives in either file, and the invite dialog resolves once so its displayed field and its clipboard cannot drift apart.
