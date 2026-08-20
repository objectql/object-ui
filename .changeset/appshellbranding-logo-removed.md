---
'@object-ui/layout': minor
'@object-ui/app-shell': minor
'@object-ui/console': minor
---

Remove the published optional key `logo` from `AppShellBranding` (`@object-ui/layout`).

The key was declared but never read. `useAppShellBranding` applies only
`primaryColor`, `accentColor`, `favicon` and `title`, and `AppShell` installs no
context provider at all — so its doc comment, "Logo URL — passed to sidebar/navbar
via context", described a mechanism that did not exist. Three call sites were
feeding the key a real value that was silently discarded, and all three are removed
with it: `AppSchemaRenderer`, `ConsoleLayout` and the console's `useBranding` hook.

The real logo entry point is unchanged and is where it always was: the app schema's
own `branding.logo`, read directly by `AppSidebar` in `@object-ui/app-shell`, plus
the app schema's top-level `logo`, rendered directly by `AppSchemaRenderer`'s
default sidebar header. Neither path went through `AppShellBranding`, so nothing
rendering-visible changes.

Migration: a consumer that passes `logo` inside an `AppShellBranding` object literal
now gets a compile error. Delete the key — it never reached a renderer. To show a
logo, set it on the app schema's `branding.logo` instead.
