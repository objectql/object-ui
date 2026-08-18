---
'@object-ui/plugin-form': patch
---

`EmbeddableForm`'s thank-you redirect stops being mount-blind: an in-app destination now goes through the host's injected navigate.

The redirect ended in one unconditional `window.location.href = url`. That is
right for the external destination this key deliberately admits, and wrong for
the in-app one it equally admits: a rooted path such as `/thanks` assigned to
`location.href` resolves against the ORIGIN root, so under a host mounted at a
sub-path — the framework CLI configures one for every embedded deployment, and
the console runs at basename `/_console` — the submitter landed outside the
application, usually on the host's own 404. Nothing refused either half of that
authoring, so the failure was silent. This is objectui#4989 defect 4 on the key
that card explicitly did not cover, and it is fixed here through the seam
objectui#5111 landed (`HostNavigationContext`, `@object-ui/react`).

The destinations are now split by who can travel to them:

- an **app-relative** destination (`/thanks`, `thanks`, `?ok=1`, `#done`) is
  handed to the host's navigate when a host supplied one, so a mounted host
  places it inside its mount; with no provider the behaviour is byte-for-byte
  what it was — a host with no router has no basename, so origin-rooted
  resolution is already correct there;
- an **external** destination admitted by `allowedRedirectHosts` keeps
  browser-level navigation **unconditionally**. This is the seam's own declared
  input contract, not a conservatism: `HostNavigationValue.navigate` documents
  `to` as an application-relative path, "never an absolute URL", because a host
  navigate is a client-side router transition. Since a relative reference cannot
  carry an authority, the seam is now structurally incapable of being handed a
  cross-origin URL.

A same-origin **absolute** URL — the one shape those two arms do not name — also
keeps browser-level navigation. Routing it through the seam would mean rewriting
the author's full address into a path a mounted router then places at a
different address; an author who spelled out the whole address asked for that
address.

Not changed, deliberately: `isRedirectUrlSafe` and `allowedRedirectHosts` —
WHICH destinations are followed. That acceptance set (same-origin OR the
author's allowlist) is this key's own contract, a refused destination reaches
neither the seam nor the browser, and objectstack#7496's relative-only ruling
belongs to `submitBehavior.url` and is not imported onto this key. The wait's
ownership (objectui#5049) and the thank-you panel's copy (objectui#5073) are
carried over unchanged: unmounting or pressing "Submit Another Response" still
cancels a pending redirect, seam or no seam.
