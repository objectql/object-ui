---
'@object-ui/app-shell': patch
'@object-ui/types': patch
'@object-ui/plugin-form': patch
---

Wizard view v1, the objectui half (Card R, objectui#6985) — alignment + pins for the
ruled `type: 'wizard'` tightening (objectstack#13622 D1–D8, maintainer ruling
2026-08-31; spec half objectstack PR #13733).

The renderer was already aligned: `WizardStepConfig` carries no predicate/collapse
keys (objectui#6237's ruled split), the wizard route drops-and-reports an authored
step `visibleWhen`, and `allowSkip` has been navigation-freedom-not-validation-
exemption since #2959. This card lands the residue:

- **metadata-admin view create seeds one starter step for a wizard** (app-shell
  `anchors.ts`): the create body used to emit `sections: []` for every form type,
  which for `type: 'wizard'` is exactly the shape the tightened spec refuses at
  parse (D7 — a stepless wizard silently rendered as a plain simple form). Same
  seed-the-required-shape move the flow anchor makes for its `type` enum
  (objectui#2326). Other form types keep the bare `[]` — only the wizard variant
  refuses emptiness.
- **`@object-ui/types` TSDoc states the ruled wizard boundary** where the shared
  section/form types restate the form-view family: `ObjectFormSection.visibleWhen`
  / `collapsible` / `collapsed` name the wizard drop + spec-door refusal;
  `ObjectFormSchema.sections` states sections-ARE-steps and array-order-is-step-
  order; `allowSkip` states the D4 semantics. Type SHAPES are unchanged — the
  spec's own ruled mechanism is a parse-time refinement over the single shared
  section schema (D2 option A), which these types mirror at the type level.
- **Consumer-side behaviour pins** (`wizardRuledSemantics-6985.test.tsx`): the
  wizard-inert step keys are dropped, never honoured (a denying `visibleWhen`
  does not remove a step; `collapsible`/`collapsed: true` produce no collapse
  affordance, with a positive control on the affordance probe); the empty-steps
  wizard's measured degradation to a simple form is pinned as the shape the spec
  door now refuses (one-step wizards stay legal — no arity floor); array order
  is step order (with a reversed-array control).
- **Installed-spec door pins** (`wizardSpecDoor-6985.test.ts`), gated on a
  capability probe of the installed `FormViewSchema` rather than a version
  string: the post-Card-S half (refusal messages, prescriptions, the authored-
  `false` collapse boundary, the wizard-scoped control) activates by itself on
  the lockfile bump that brings the tightening in; until then the pre-tightening
  half records the 17.2.x accept-set it measured. `steps:` is pinned refused on
  every spec line.

No teaching material — the #13337/#13086 fence lifts only after both halves land;
docs changes here are TSDoc/comments only.
