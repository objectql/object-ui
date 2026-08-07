---
'@object-ui/app-shell': patch
---

The no-apps empty state's "Create Your First App" CTA now opens the app-creation
flow instead of silently bouncing the user back to the landing page. It called
`navigate('/create-app')` — an ABSOLUTE path, so it resolved against the HOST's
root route tree, which declares no `/create-app`; the reference host's trailing
`<Route path="*">` therefore replaced it with `/`. The `create-app` route is
declared by `AppContent` itself, inside the `/apps/:appName/*` subtree (both the
no-active-app branch and the with-app router), so the CTA now builds the
app-scoped `/apps/<segment>/create-app` — the platform's canonical app URL
(ADR-0048) and the same target the sidebar's add-app entry already links to. On
a fresh zero-app deployment this was the first screen's only route into app
creation, and it read as a button that does nothing (#3573).

A plain relative `navigate('create-app')` is deliberately NOT the fix, and the
new routing test pins why: under the installed react-router 7,
`getResolveToMatches` resolves a relative target against the LEAF match's full
`pathname` with the splat INCLUDED (in v6 this was the `v7_relativeSplatPath`
future flag; v7 hardcodes it). The empty state renders across a whole URL family
— `/apps/setup` and any deeper `/apps/setup/<segment>` — so the relative form is
right only at the shallowest of them and builds
`/apps/setup/<segment>/create-app` elsewhere, which matches no route and renders
a blank screen instead of the bounce. The sibling "System Settings" CTA is
unchanged.
