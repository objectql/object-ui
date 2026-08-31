---
---

Declaration-only: `metadata-viewer`'s state-machine view no longer hand-writes
the select-option shape.

`packages/components/src/renderers/basic/metadata-viewer.tsx` declared its own
module-local `interface SelectOption` — four of the five keys
`@objectstack/spec/data`'s `SelectOption` declares, with `visibleWhen` dropped
by silence: no `Omit` naming the narrowing and no comment saying the drop was
deliberate. It is now derived, `type StateOption = Omit<SpecSelectOption,
'visibleWhen'>`, the same `Omit`-with-named-narrowings form
`metadata-admin/form-spec.ts` uses for `FormFieldSpec.options`, with the drop
and the retained `default` each written out next to its reason.

No behaviour change and no released surface moves: the type is module-local,
the value it annotates arrives from `useMetadataItem` as `any`, and
`StateMachineView`'s `labelOf` / `colorOf` / `initial` logic is untouched — the
object-field `default` it reads stays the ruled-`enforce` key it always was.
