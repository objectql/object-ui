---
'@object-ui/plugin-form': minor
---

`formType: 'tabbed'` now honours an authored section `visibleWhen` (objectui#6237).

The tabbed arm of the one grouping contract ruled 2026-08-29 (option A). Before
this, an authored `FormSection.visibleWhen` was dropped on the tabbed route
while `split` / `drawer` / `modal` and the flat layout all honoured it — the key
never reached a renderer at all, so it did nothing.

`TabbedForm` already synthesised the renderer's `fieldTabs`, which is the same
machinery the `modal` + `contentLayout: 'tabbed'` arm runs on. The predicate was
simply dropped at three points on the way there, and all three now carry it:
`ObjectForm`'s tabbed section map, `FormSectionConfig` (which declared no such
key), and `TabbedForm`'s `fieldTabs` synthesis.

Because the arm reaches the existing evaluator, the three ruled semantics are
inherited rather than re-implemented beside it: a hidden tab's values still
submit, its fields skip client-side validation (so a required field on a hidden
tab cannot block a submit invisibly — objectui#2959's defect through a new
door), a predicate hiding the ACTIVE tab re-selects deterministically instead of
drawing an empty panel, and arm engagement stays structural on the DECLARED
tabs so a predicate cannot collapse the strip mid-interaction.

Two boundaries are deliberate:

- A single-section tabbed form never engages the tab arm, so it degrades to the
  untabbed layout's own predicate mechanism — a chrome-less `section-divider`
  claiming its members by name. Existing single-section forms are unchanged; the
  gate is emitted only where a predicate was actually authored.
- Wizard STEPS still do not take a predicate, and now say so in the type:
  `WizardStepConfig` omits the key, because a step predicate is a different
  contract (step-boundary reactive against the ruled live-record reactivity, and
  needing navigation and final-gate semantics none of this machinery supplies).
  `ObjectForm` continues to report that gap at runtime for untyped JSON.
