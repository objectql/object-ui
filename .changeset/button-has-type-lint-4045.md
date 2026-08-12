---
'@object-ui/app-shell': patch
'@object-ui/components': patch
'@object-ui/console': patch
'@object-ui/plugin-ai': patch
'@object-ui/plugin-designer': patch
'@object-ui/plugin-kanban': patch
'@object-ui/plugin-map': patch
'@object-ui/plugin-view': patch
'@object-ui/react': patch
'@object-ui/runner': patch
---

Every plain `<button>` now declares its `type`. HTML defaults an untyped button to
`type="submit"`, so any of these buttons would submit the form it was composed into
instead of running its own handler — a real risk for renderers (`drawer`, `tree-view`,
`navigation-overlay`) whose placement inside a form is a JSON metadata decision. 114
sites were converted to `type="button"`; no site was a genuine submit button, and the
DOM is otherwise unchanged.

The defect class is now closed mechanically by a new `object-ui/button-has-type` ESLint
rule (error), so the next untyped button fails CI at write time rather than being found
by a fourth audit round (objectui#4045, closing the objectui#3344 family).
