---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

Refine Studio package-scoped navigation and home overview.

Studio now treats the selected package as the home overview scope, flattens the root Overview sidebar group, hides the duplicate all-metadata sidebar entry, redirects the invalid package metadata route to package management, preserves the selected package across package-management navigation, and adds a localized package-management sidebar label.
