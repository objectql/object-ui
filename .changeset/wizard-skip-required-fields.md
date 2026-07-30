---
"@object-ui/plugin-form": patch
---

fix(form): a wizard with `allowSkip` no longer submits past the required fields you skipped

`allowSkip` let the user jump to any step from the indicator, and
`handleStepClick` did so without validating anything on the way. Since a wizard
mounts ONE step at a time and react-hook-form only validates the fields currently
**mounted**, a required field on a step nobody opened was never registered, never
validated, and simply absent from the payload.

Measured against the unfixed component — 3 steps, required `owner` on step 2,
`allowSkip: true`, click step 3's indicator, fill it, hit Create:

    createCalls: 1
    payload:     { subject: 'S1', notes: 'S3' }   // `owner` missing entirely
    UI mentions "required": false                 // nothing said so

So an invalid create went out and the client said nothing about why — #2959's
validation half, wearing a wizard's clothes.

The final submit now checks the WHOLE declared field set, and when something is
outstanding it returns the user to the first step that has one, marks that step's
indicator (`data-error="true"`, destructive circle + icon), names the fields in a
toast, and sends nothing. Conditional rules are honoured: the check runs on the
canonical `resolveFieldRuleState`, the same engine the form renderer and the
server's rule-validator use, so a field hidden by `visibleWhen` or not yet
required by `requiredWhen` is not demanded. The sequential path is unaffected —
a forward jump is refused without `allowSkip`, so Next already validated each step.

Also in `WizardForm`:

- `FormView.columns` is now honoured (spec key, previously dropped): the grid
  width is the view's `columns`, else the step's own. Unlike the tabbed/split
  hosts there is no widest-section fallback — wizard steps never share a viewport,
  so each keeps its authored width.
- the root gained `@container`. The step grid is sized with container queries, and
  without a container ancestor every `@md:`/`@2xl:` variant was inert — a step
  declaring 2 columns rendered single-column. Found by running it in a browser;
  the class was present all along, which is why asserting the class alone had
  missed it.
