---
'@object-ui/app-shell': minor
'@object-ui/i18n': minor
---

Signal the platform's preview stage in the UI.

The console top bar (`AppHeader`) now shows a small **Preview** chip next to the
product wordmark on every surface (home / app / orgs), so users always know the
whole platform is pre-GA. It's a new `PreviewBadge` component driven by a
`branding.stage` field in runtime-config (`'preview' | 'beta' | 'ga'`, exposed
via `getPlatformStage()`), which defaults to `'preview'` so the badge shows out
of the box. Operators flip the stage to `'ga'` at launch (`OS_PRODUCT_STAGE` /
`RuntimeConfigPlugin`) and the badge disappears with no code change; `'beta'`
renders a "Beta" chip instead. Labels are localized under `topbar.stage.*`.
