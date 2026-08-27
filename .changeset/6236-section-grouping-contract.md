---
'@object-ui/types': minor
'@object-ui/components': minor
'@object-ui/plugin-form': minor
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
the key with the same scope note.

`@object-ui/plugin-form` wires the producer half: all six `section-divider` synthesis
sites (ObjectForm's stacked simple path, ModalForm's sectioned and derived-fieldGroup
paths, DrawerForm's sectioned and derived-fieldGroup paths, SplitForm's panes) now stamp
the membership claim onto the divider they emit, from the RESOLVED member list — so an
authored `FormSection.visibleWhen` finally hides the whole section on the object-view
chain, matching the console renderer. The #6111 honest pin (`measured scope`) flipped
accordingly: it now pins heading-and-fields hiding together, and every per-layout DENIED
row asserts the claimed member as well as the heading. The derived-fieldGroup sites carry
the claim for uniformity but stay fail-open — the spec `fieldGroups` vocabulary has no
section-predicate slot to author. The tabbed arm's predicate slot (objectui#6237) is
designed to reuse this same grouping contract.
