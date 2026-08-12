---
'@object-ui/app-shell': patch
'@object-ui/plugin-list': patch
'@object-ui/plugin-report': patch
'@object-ui/i18n': patch
---

fix(print): `window.print()` produces a usable page, and the Print buttons say what they do

The list, report and dashboard Print controls were bare `window.print()` calls with no
print stylesheet, so the browser printed the whole console — sidebar, top bar, chat rail,
toasts — with the data table clipped to a single viewport. With no label to the contrary
they were being accepted against "export to PDF" requirements, which they have never been.

- `@object-ui/app-shell/styles.css` gains a shared `@media print` block: it hides the shell
  chrome, prints the active content area full-width, releases the viewport-height flex chain
  so long tables paginate instead of clipping, repeats table headers on every sheet, and
  neutralises dark mode (which otherwise prints white-on-white). One sheet serves list,
  report and dashboard.
- The list and report Print buttons carry a tooltip and accessible name stating that they
  open the browser's own print dialog and are not a PDF export (new `common.printDialogHint`,
  translated in all ten locale packs).
- The dashboard's `export_dashboard_pdf` action no longer toasts "Preparing PDF export…" —
  it names the print dialog it actually opens (`dashboardActions.pdfPreparing` is replaced by
  `dashboardActions.printDialogOpening`).

No control was removed and no headless detection was added. A real print/PDF primitive
remains out of scope (`objectstack-ai/objectstack#1301`, closed NOT_PLANNED).
