---
'@object-ui/plugin-form': minor
'@object-ui/types': minor
---

A form-view section can reference a declared field group instead of copying its
members (objectstack#13855, objectui#7051 — the view-level half; the
`record:details` half shipped as objectui#8497).

`@objectstack/spec` 17.3.0 declares two ways for a `form.sections[]` entry to give
itself members: enumerate `fields`, or point `group` at one of the object's declared
`fieldGroups` and inherit that group's membership **and** its presentation. Nothing on
this renderer read `group`, and the omission was not a no-op:

- on the default `simple` layout an authored `{ group: 'contact_info' }` threw
  `Cannot read properties of undefined (reading 'map')` out of the section loop in
  `SimpleObjectForm`'s own body — above the JSX it returns, so no per-section error
  boundary could contain it — and **blanked the entire form**, taking every
  well-formed sibling section with it;
- on `tabbed` / `split` / `drawer` / `modal` the section silently rendered nothing;
- on `wizard` it rendered an empty step.

`ObjectForm` now resolves the reference **once**, above its routing fork, so all six
layouts inherit it: a `{ group }` section renders the members that group declares, in
the order and with the label, description and collapse state the object declares them
with. Resolution goes through `deriveFieldGroupLayout` (ADR-0085 §5) via this
package's existing single adapter — the same code path the no-sections field-group
fallback already used, so authoring a group by reference and letting the fallback
derive it produce the same section by construction. No assembly rule is
re-implemented here.

The object definition is fetched only when a section actually authors `group`, so a
form that does not use the reference form issues no additional request and takes no
new path.

Diagnostics rather than silence, for the shapes the spec door cannot see (programmatic
SDUI callers): a `group` naming no declared group renders nothing and is reported once
on the console (`@objectstack/lint` owns it as `form-section-group-unknown`); a
group-owned presentation key restated beside `group` is ignored — the spec grants no
override semantics — and reported; `group` on a wizard step is refused and reported,
because a step has no slot for the `collapse` / `visibleWhen` a group carries.

Also in this change: `@object-ui/types`' `ObjectFormSection` declares `group` and makes
`fields` optional, so the spec-legal shape finally compiles for a TypeScript author;
and the shared field-group adapter now carries the group's `description` and
`visibleWhen` onto the section it derives — both are keys the assembler emits and
`ObjectFormSection` declares, and a key-by-key rebuild that drops one is how a declared
group's presentation goes missing.
