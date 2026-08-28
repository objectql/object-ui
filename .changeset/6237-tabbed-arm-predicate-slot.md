---
'@object-ui/types': minor
'@object-ui/components': minor
'@object-ui/plugin-form': minor
---

The tabbed arm of the grouping contract (objectui#6237, same maintainer ruling as
objectui#6236): `FormFieldTab` gains the predicate slot the ruling named —
`visibleWhen?: string | { dialect?: string; source: string }` — so a section rendered as
a TAB PANEL (`ModalForm` `contentLayout: 'tabbed'`) can finally carry an authored
`FormSection.visibleWhen`. The tabbed layout synthesises no `section-divider` at all, so
the #6236 membership-claim mechanism had nothing to stamp the predicate onto and no slot
to copy it into; the predicate was silently dropped one hop before evaluation (measured
in objectui#6237's card).

The form renderer evaluates the tab's predicate with the same record assembly the
field-level rules use (`ruleRecord` / `previousRecord` / host predicate scope, #6010),
fail-open, and when FALSE draws neither the tab's trigger nor its panel. Not drawing the
panel unmounts the claimed fields through the exact mechanism a field's own false
predicate uses, so the ruled hidden-group semantics are inherited rather than
re-implemented, and are pinned in `fieldtab-visiblewhen-6237.test.tsx`:

- **Visibility decides what is DRAWN and nothing else** — a hidden tab's values still
  submit.
- **A hidden tab's fields skip client-side validation** — a user is never blocked by an
  error pointing at a control they cannot see; the server-side contract remains the loud
  floor for genuinely-required data (#2959's trap, answered the same way for tabs as for
  sections). A tab hiding mid-session clears its members' stale errors.
- **Deterministic re-selection**: a predicate hiding the ACTIVE tab activates the user's
  pick if still visible, else the declared default, else the first visible tab — never an
  empty panel — and the user's pick is restored the moment its tab is re-admitted.
- **No mid-interaction collapse**: whether the tabbed arm engages stays judged on the
  DECLARED tabs, so a predicate hiding one of two tabs filters the strip (and hides the
  tab's fields) instead of collapsing the modal into the stacked layout under the user's
  cursor. With every tab hidden the strip is omitted; unclaimed fields still render.
- **A tab without the key keeps the pre-#6237 contract** (always drawn), so existing
  schemas are untouched.

`@object-ui/plugin-form` wires the producer half: `ModalForm`'s tabbed synthesis site now
copies the section's `visibleWhen` onto the tab it emits, and the #6111 layout matrix
gains the tabbed-modal rows (direct and via `ObjectForm` delegation). `TabbedForm` /
`WizardForm` still declare no section predicate in their own section configs — those arms
remain open on objectui#6237.
