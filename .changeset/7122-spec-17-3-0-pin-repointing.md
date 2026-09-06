---
---

Re-point the pins `@objectstack/spec` 17.3.0 moved, and harvest three
exemptions the contract outgrew (objectui#7122). Test only; no package is
released by this change.

- **The `#7496` family, 14 assertions across three files.** 17.3.0 kept every
  `submitBehavior.url` refusal and its reasoning and only restated provenance as
  `(ruled 2026-08-11)`. The pins asserted the citation FORM, not the citation —
  objectui#7702's defect shape — so they now assert the durable property via a
  documented `CITES_ITS_RULING`, which discriminates the spec's prose from a
  locally hand-written sentence. Deliberately not re-pinned to the new prose
  verbatim, which would move the brittleness rather than remove it.
- **`CITES_ITS_RULING` is `/\(ruled \d{4}-\d{2}-\d{2}(?: on #\d{3,})?\)/`,
  and its first spelling was not good enough.** That draft was
  `/\(ruled \d{4}-\d{2}-\d{2}\)|#\d{3,}/`, whose loose alternative
  discriminated NOTHING — this repo's own hand-written messages routinely cite
  `objectui#NNNN`, so a local sentence satisfied it, and telling those two apart
  is the assertion's whole job. It was also unnecessary: measured on both
  installed artifacts, 17.2.0 says `(ruled 2026-08-11 on #7496)` and 17.3.0 says
  `(ruled 2026-08-11)`, so the issue number never appears outside that
  parenthesis and `(ruled ` + a date already matched both. The optional
  ` on #NNNN` tail keeps the 17.2.0 spelling admissible without admitting a bare
  local `#7122`.
- **The fourth file joined the other three.**
  `packages/plugin-form/src/submitRedirect.test.ts` had been re-pointed to the
  literal `'ruled 2026-08-11'` while its three siblings used the shape — the
  same brittleness one word along, a date instead of an issue number, and four
  files disagreeing about what the pinned property is. It now uses
  `CITES_ITS_RULING` too.
- **`object-grid.defaultSort` became an ADR-0087 D2 tombstone**, so its
  unpublished-key exemption, its GA-pending entry and its carve-out row are
  deleted — the ninth harvest by the mechanism the eight before it were designed
  to die by. The block's prose claiming a tombstone would NOT make an entry
  stale is corrected; its own cited counter-example was harvested that way.
- **`OFF_SPEC_ARM_EXEMPTIONS` is now empty.** `element:number.filter` accepts
  the array form (objectui#6206) and `object-grid.data` accepts the
  discriminated `ViewDataSchema` object (objectui#6207) — both converged
  upstream in the direction their own reasons named, with no declaration edited.
  Both issues are closable as resolved-upstream.
- **Two negative pins re-derived, not inverted.** The `object-master-detail-form`
  `formType` boundary now refuses what it used to admit (`invalid_value`, plus a
  bespoke ADR-0001 prescription for `wizard`), and the location value schema is
  now strict (`unrecognized_keys` naming the retired `latitude`/`longitude`
  pair). Each pin records the new fact, keeps a control opposite it, and pins the
  refusal's SHAPE. The `LocationField` fence explicitly re-derives why its
  key-level assertions stay: no parse stands on the emit path, so strictness
  changed the consequence of a spread regression, not the widget's exposure.
