---
'@object-ui/app-shell': patch
'@object-ui/console': patch
---

The console chrome's Home affordances follow the product's declared landing (objectui#7256).

`/` has honored `app.isDefault` since the hardcoded `PREFERRED_APPS = ['cloud_control']`
redirect was retired; the chrome had not. The top-bar logo, the sidebar's Home row, the
mobile sheet's Home row and the app-switcher's Home entry each named `/home` literally —
the ENVIRONMENT layer's launcher (ADR-0075). So a deployment that declares a landing
offered the customer two homes in two voices, and one click on the logo left the declared
one.

On cloud's control plane that second home is actively wrong: its "Build an app" / "Start
from a template" cards are environment-side actions that cannot work from the control
plane, and its "Your apps" tiles are the control plane's own internal management apps.

- `@object-ui/app-shell` adds `resolveDeclaredHomePath()` — the one reader of the
  declaration — plus `useHomePath()`, which the four chrome sites now consume. The signal
  is the App metadata the server already sends: no hostname sniff, and no product name
  baked into the shared bundle.
- `@object-ui/console`'s `/` resolver is unchanged, and a behavioural matrix now pins its
  answer equal to the chrome's for every declared app list, so the post-login landing and
  the logo cannot drift apart.

Deployments that declare no landing are unaffected: every Home affordance still resolves
to `/home`. The "this app is gone" recovery redirects in `AppContent` / `ConsoleShell` are
deliberately untouched — they are error paths, not Home affordances.
