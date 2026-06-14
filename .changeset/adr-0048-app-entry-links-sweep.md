---
"@object-ui/app-shell": patch
"@object-ui/console": patch
---

ADR-0048: finish sweeping app-entry links onto the canonical package-id route
segment (follow-up to the home-page fix).

- `AppManagementPage` (System → Apps) "Open app" button now opens
  `/apps/<packageId>` (`app._packageId ?? app.name`) instead of `/apps/<name>`.
- `AppContent` current-app sub-routes/redirects (the `metadata/package` →
  `component/developer/packages` redirect, and the record-form `baseUrl`) now
  build against the URL's own `appName` segment instead of `activeApp.name`, so a
  `/apps/<packageId>/…` URL keeps its package-id segment instead of flipping to
  the name form. `requestedAppMissing` (preview-drafts) now resolves the segment
  via `matchAppBySegment` so a package-id URL isn't treated as a missing app.
