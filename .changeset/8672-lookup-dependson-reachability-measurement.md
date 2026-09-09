---
---

Measurement-only change in `@object-ui/app-shell`: objectui#8672 asked how
reachable a `dependsOn` lookup ACTION PARAM is, and where the surface that
admits it lives. No behaviour changes and no disposition is chosen — the card
names three (wire it · refuse it · declare the limit) and this pins what is true
today so the ruling is made against something stable.

New `views/ActionParamDialog.lookupDependsOnReach-8672.test.tsx`, three legs,
each with a lit control:

- **Leg A — current shape, not contract.** Driving the real `ActionParamDialog`,
  a lookup param declaring `dependsOn` renders `lookup-trigger-gated`, disabled,
  "Select account first", and filling the named parent does NOT lift it. A
  control lookup identical but for `dependsOn` is asserted enabled, and the
  keystroke is driven through a `radio` param whose `visibleWhen` DOES react to
  it — so "the gate did not lift" is read against a keystroke proven to have
  reached and re-rendered the dialog.
- **Leg B — contract, version-qualified.** `@objectstack/spec`'s
  `ActionParamSchema` (17.3.0) is `.strict()` and refuses `dependsOn` on an
  action param of ANY type, with a positive control that parses and an
  unknown-key negative control that is refused. `@object-ui/types`' `ActionParam`
  derives its keys from `z.input` of that schema, so it declares none either.
- **Leg C — current shape, not contract.** The one route the repo points authors
  to (`RESOLVED_ONLY_PARAM_KEYS.dependsOn`: make the param field-backed) reads
  `field.depends_on`, the SNAKE spelling `FieldSchema` refuses by name, while the
  camel `dependsOn` it accepts is never read — so a spec-valid object field
  declaring the cascade resolves to `dependsOn: undefined`. A sibling key off the
  same field def is asserted to arrive in the same call, so the `undefined` is a
  reading and not an empty fixture.

Also corrects a stale sentence in `utils/paramToField.test.ts` that described
this seam backwards ("…or the dialog's dependent lookups would have gone dead
silently" — there has never been a working cascade here to go dead).
