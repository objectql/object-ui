---
'@object-ui/types': minor
'@object-ui/components': minor
---

The section grouping contract (objectui#6236, maintainer ruling 2026-08-27): a
`section-divider` row may now CLAIM its member fields — `FormField.fields: string[]`, the
same membership shape `FormFieldTab.fields` / `FormFieldPane.fields` already model — and
the form renderer then gates the WHOLE group on the divider's own visibility verdict
(`visibleWhen` / `visibleOn` / legacy `condition`).

Before this, one authored `FormSection.visibleWhen` meant two different things: the
console renderer drops the whole `<section>` (heading and fields), while the plugin-form
chain's renderer treated `section-divider` as a purely presentational row and hid only
the HEADING, leaving the section's fields rendering (measured in objectui#6111, which
pinned that honestly rather than implying a guarantee it did not deliver).

Ruled semantics, now pinned in `section-grouping-6236.test.tsx`:

- **Visibility decides what is DRAWN and nothing else** (console precedent, 2026-08-22
  ruling after #5594) — a hidden section's values still submit.
- **A hidden section's fields skip client-side validation** — a user is never blocked by
  an error pointing at a control they cannot see (the objectui#6110 defect shape); the
  server-side contract remains the loud floor for genuinely-required data. A section
  hiding mid-session also clears its members' stale errors, the way a field's own false
  predicate already did.
- **A divider without a claim keeps the old contract** (its predicate gates only the
  heading), so existing schemas are untouched.

Both halves ride the mechanism the field-level predicate already uses (return `null`;
react-hook-form keeps the value and skips the unmounted control), so field-level and
section-level visibility cannot drift apart. The zod mirror (`FormFieldSchema`) declares
the key with the same scope note. Scope note: the plugin-form `section-divider` synthesis
sites do not yet stamp the claim onto the dividers they emit — an authored section
predicate on those chains still gates only the heading until that wiring lands (the
remaining half of objectui#6236). The tabbed arm's predicate slot (objectui#6237) is
designed to reuse this same grouping contract.
