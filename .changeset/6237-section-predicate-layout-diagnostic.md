---
'@object-ui/plugin-form': patch
---

An authored section `visibleWhen` on `formType: 'tabbed'` or `formType: 'wizard'` now
**reports** that the layout cannot honour it, instead of being silently dropped
(objectui#6237).

`ObjectForm` rebuilds each section key by key when it delegates to a layout, so a key
the map does not copy never reaches a renderer at all. Three of those maps copy
`visibleWhen` (`split` / `drawer` / `modal`, objectui#6111) and the flat arm carries it
on the `section-divider` pseudo-field — but the `tabbed` and `wizard` maps copy nothing,
so an author writing the key on those two arms watched it do exactly nothing, with no
signal anywhere. That silence is the defect this ships against.

The two arms now log a warning naming the layout and the sections whose predicate is
being dropped, through one shared message builder so they cannot drift apart.

**This changes no rendering behaviour** — the predicate is still not evaluated on those
arms. It is the interim half of a maintainer ruling (2026-08-29) that the real repair is
a **design** task: one renderer-side section/group contract with a predicate slot,
designed once for every layout arm (tabbed / TabbedForm / WizardForm / flat) rather than
patched arm by arm. The ruling requires the diagnostic to land first, so the gap stops
being invisible while that contract is designed.

Deliberately silent on the arms that work, so the warning stays worth reading:

- `split` / `drawer` / `modal`, and the flat layout — all honour a section `visibleWhen`.
- `ModalForm` with `contentLayout: 'tabbed'` — honours it through the real
  `FormFieldTab.visibleWhen` slot that landed in objectui#6619. "Tabbed" names two
  different things on this card; only `formType: 'tabbed'` (`TabbedForm`) is inert.
- A master-detail parent, which re-enters `ObjectForm` through its own parent schema —
  the report is left to that inner pass, where the real layout is decided (a
  master-detail `wizard` parent renders `simple`, which honours the key). Reporting at
  both would double-report the tabbed parent and false-report the wizard one.

No authorable key is added anywhere: declaring `visibleWhen` on a type whose renderer
ignores it is the defect this card family exists to close, and the shared
`FormSectionConfig` that `WizardForm` uses for its steps makes that trap concrete.
