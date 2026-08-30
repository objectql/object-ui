---
'@object-ui/app-shell': patch
---

A per-option `visibleWhen` written into a metadata form now actually withdraws that option
in the metadata-admin renderer (objectui#6247).

`SelectOptionSchema` declares `visibleWhen` (ADR-0068 / objectui#2284) and the schema is
`z.core.$strict` — an undeclared sibling key is refused with `unrecognized_keys` — so the
key is a real declaration, and a `*.form.ts` carrying a per-option predicate parses clean.
The metadata-admin renderer never read it: all three controls that consume
`fieldSpec.options` mapped the authored list straight to items. Accepted, stored, shipped,
ignored — ADR-0049's declared-but-unenforced shape.

**This is a behaviour change, and it is the point of the fix.** Metadata that was inert
starts hiding options. An author who wrote a narrowing and got no narrowing now gets one.
Both of the old failure modes pointed the same way — the option stayed offered — so
nothing that relied on the old behaviour was relying on a narrowing being honoured; it was
relying on one being ignored. Zero `*.form.ts` in the tree uses the key today, so no
shipped form changes shape on this release.

Three consuming controls now filter, and each has a pin asserting an option **absent** on a
false predicate: the builtin Select in `SchemaForm.tsx`, `MultiSelectWidget`, and
`colorPaletteOptions` → `ColorSwatchGroupWidget`. Asserting absence is the whole of the
test design — this evaluator fails OPEN, so "the option is shown" is equally the outcome of
predicate-true, predicate-never-arrived and predicate-faulted, and a positive-only pin
passes against the unfixed renderer.

Per the maintainer ruling on the card (affirmed three times: 2026-08-25 batch 4;
2026-08-25 upholding A2 over the A1 counter-proposal; 2026-08-27 declining the A0
reject-the-key alternative):

- **Scope (A2).** `SchemaForm`'s `evaluatePredicate` ctx now binds the four ADR-0068 D1
  identity spellings — `current_user`, `user`, `ctx.user`, `os.user` — **alongside** `data`,
  selected out of the host `ExpressionProvider`'s bag rather than copied, so the alias set
  cannot drift from the one builder. `data` stays the **draft**: the provider's bag also
  carries a `data` key meaning its own data scope, and adopting that would be
  objectui#5926 gap 2's "same key, opposite meanings" one nesting level apart. `record`,
  `app` and `features` are deliberately left **unbound** so they keep raising the loud
  warn-once diagnostic instead of resolving to a silent `undefined`. That diagnostic now
  reads the bound names off the actual scope instead of asserting "the only name is
  `data`", which stopped being true the moment identity was bound — a diagnostic that lies
  sends the author to un-write a spelling that was correct. No new evaluator: the option
  filter routes through the same `evaluatePredicate` the section, field and repeater-row
  gates already use.
- **Emptied sets (B1).** The control's **face** keeps reading the **raw** option list —
  `resolveFieldFace`'s `hasOptions`, `resolveColorWidgetKey`, and each `options.length > 0`
  branch condition — and only the rendered list is filtered. Withdrawing every option
  renders an **empty picker**. Filtering the branch condition instead would have degraded
  the builtin Select to a free-text `Input` and `MultiSelectWidget` to its comma-tag
  editor — "withdraw every option" displayed as "type whatever you like" — and would have
  flipped a fully-withdrawn palette from the `color-picker` registration to `color-input`,
  making the labelling channel objectui#4871 point 4 fixes in the host predicate-dependent.
- **Stored values (C1).** No pruning. A selected value whose option is now hidden survives
  in the stored metadata and the picker shows the placeholder. This includes the quiet path:
  `MultiSelectWidget`'s toggle re-orders the selection against the **raw** list, because
  ordering against the filtered one would have dropped a hidden-but-selected value on the
  next unrelated click. This renderer edits **source metadata**, and objectui#4247's own
  reasoning — "missing information is not a reason to destroy stored data" — applies harder
  here than it did on the runtime record surface.

`FormFieldSpec.options` is also no longer hand-written. It derives from the spec's
`SelectOption` with its narrowings named in an `Omit`, per this file's own convention:
`visibleWhen` is re-pointed to the local `VisibilityPredicate` (`dialect` optional, `source`
required — the shape an evaluator here actually takes), and `default` stays dropped **and
now says so**, because nothing on this surface reads it. Two of the spec's five option keys
had been dropped by silence, which is precisely how a legally-authored per-option
`visibleWhen` came to parse clean and render inert.

**Not fixed here, and it bounds what this change delivers:** this interim evaluator's `in`
operator requires an array **literal** on the right (`role in ['admin','owner']`), so the
ADR's headline spelling `'admin' in current_user.positions` — membership against a *path* —
still falls through to the bare-truthy branch and evaluates TRUE regardless of the user,
silently. That is a pre-existing grammar gap of the whole subset, identical for `data.*`
(`'x' in data.tags` is equally inert) and unchanged by this card; it is filed separately.
The spellings this fix makes genuinely discriminate are the documented subset —
`path == literal`, `path != literal`, `path in [literals]`, `!path`, `path`, `&&`, `||`.
