---
'@object-ui/plugin-detail': patch
---

Give `InlineCreateRelated`'s card-header close button an accessible name (objectui#3411 — the neighbouring defect found while implementing #3381/PR #3410, in the same file and left outside that PR's scope fence as a different class).

The button is icon-only: its sole child was a lucide `X`, with no text, `aria-label`, `aria-labelledby` or `title`. lucide-react excludes childless, a11y-prop-less icons from the accessibility tree (it defaults them to `aria-hidden="true"`), so the button had no name source at all and its computed accessible name was the empty string — a screen reader announced a nameless "button". Unlike the placeholder case in #3381 there was no browser-side fallback to soften it: the name was empty in every implementation. WCAG 4.1.2 / 2.4.6.

The fix is `aria-label="Close"` on the button, plus an explicit `aria-hidden="true"` on the icon so the intent is local rather than inherited from the icon library's default. `aria-label` rather than #3381's visually hidden `<label>` because this control has no visible copy for a label to stay in step with — the drift that ruling guarded against cannot arise here — and it matches the shape the repo's other close buttons already use (shadcn's dialog/sheet, `DashboardEditor`).

No props, spec or visible-copy change; the component's rendering is otherwise identical.
