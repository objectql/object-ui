---
"@object-ui/console": patch
---

`FormPage`'s post-submit `redirect` behaviour now consumes the destination the way objectstack#7496 ruled it (objectui#4190): as a **relative in-app path**, navigated to with the router, with `{{record.field}}` interpolation URL-escaped when the redirect is built — and an out-of-contract destination refused on screen instead of followed.

The url was previously handed to a browser-level, full-page navigation exactly as authored. Two consequences, both fixed here:

- **A ruled in-app path left the app.** A full-page navigation does not see React Router's `basename`, so on a console served under a mount — which the framework CLI configures for every embedded deployment — an authored `/objects/lead` resolved against the origin root and dropped the submitter out of the SPA. Both mounts of this renderer (`/f/:slug` and `/forms/:name`) live inside the console's router, so the destination is now a router navigation and the mount is applied by the router itself. `withConsoleBase()` is deliberately not used: it prefixes anything not already targeting another absolute SPA mount, so it would have mangled an absolute destination rather than fixing it.
- **`{{record.field}}` tokens were never substituted.** The ruled shape accepts them and assigns the substitution — and the URL-escaping of every interpolated value — to the moment the redirect is built, which is here. The scope is the record the submit just wrote (values as submitted, with whatever the server echoed back layered over them, and the id read by the same one rule the `created-record` behaviour uses).

The shape verdict is not restated in this app: `resolveSubmitRedirect` asks `@objectstack/spec`'s own `FormViewSchema` at the moment of use, so an absolute URL, a protocol-relative `//host`, a backslash, a control-character smuggle, a malformed token or a document-relative path is refused with the spec's own author-facing prescription, and a later widening of the ruling is followed by the pin rather than by an edit here. A refusal confirms the submit — the write succeeded, only the destination was out of contract — and shows the reason, rather than leaving the submitter watching a redirect that must not happen.

`delayMs` semantics are unchanged. The wait now lives in an effect tied to the component, so a submitter who navigates away during the delay is no longer yanked back by a timer that outlived the page.
