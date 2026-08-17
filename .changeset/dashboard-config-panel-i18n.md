---
'@object-ui/plugin-dashboard': patch
'@object-ui/i18n': patch
---

The dashboard config sidebar translates: `WidgetConfigPanel` and `DashboardConfigPanel` are wired through `t()`.

Both panels build a `ConfigPanelSchema` — breadcrumb, section titles, field
labels, placeholders, help text and option labels — and neither imported a
translation hook at all, so all 61 of their user-visible strings were English
literals. Both are exported from the package barrel and mounted by
`DashboardWithConfig` as the dashboard editing sidebar, so a user on any
non-English console opened a panel that stayed English inside chrome that had
translated around it.

They now resolve through a new `dashboard.config.*` namespace — 75 keys, added
to all ten locale packs. The namespace sits beside `dashboard.trend.*` and
`dashboard.filters.*`, which is where this package's other translated surfaces
already read from, and the panels reach it through
`useConfigPanelTranslation`, a `createSafeTranslation` hook whose
`CONFIG_PANEL_DEFAULT_TRANSLATIONS` map carries the English defaults for hosts
that mount no `I18nProvider`.

The keys are authored fresh against the wording the panels actually ship rather
than restored from the retired `configPanel.*` block: that vocabulary had no
reader, was never validated against a shipped label, and covered 16 of the 61
strings. Where the two name the same word the translations are reused.

Every `en` pack value and every built-in default is byte-identical to the
literal it replaces, so English rendering and provider-less rendering are
unchanged — asserted row by row, in both directions, against a frozen table of
the pre-change literals.
