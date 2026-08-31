---
'@object-ui/fields': patch
---

`FieldEditWidget` now DELIVERS the DOM pass-through block it DECLARES
(objectui#6909).

Its props are `FieldWidgetComponentProps` — the controlled-input keys
intersected with `FieldWidgetDomProps`, `AriaAttributes` and the open `data-`
family — so a host could always pass `id`, `name`, `autoFocus`, `tabIndex`,
`onBlur`, `onFocus`, `onClick`, any `aria-*` and any `data-*` with no type
error. The body then destructured five keys and rendered the widget with those,
so `autoFocus` was the ONLY survivor of the whole block and everything else was
silently dropped. That is this package's own first-class defect class, named in
`widgets/toDomProps.ts`: a key that type-checks, reads as supported, and
silently never reaches the element (objectui#3290's `aria-required`,
objectui#3222's validation slot).

Not a widening, and not a contract change. The keys were already declared, and
each widget still re-filters through its own `toDomProps` before anything
reaches a DOM element — what any widget accepts or rejects is unchanged. The
factory was simply the one link in the chain nothing bound to the declaration:
`toDomProps` binds the WIDGET contract to its whitelist with compile-time
assertions in both directions, and the factory sat above them, bound to
neither.

The fix hands the widget `toDomProps(props)` — this package's own executor —
rather than a second key list written out in the factory. That reuse is the
guard: `toDomProps.ts`'s direction-2 assertion already makes
`keyof FieldWidgetDomProps extends DomPassThroughKey` a compile error to
violate, so a key added to the declared DOM block now reaches the widget
through this factory automatically. One mechanism, one judge — a private list
here would have been free to drift, which is how the factory came to deliver
one key out of seven.

The forwarded set is a deliberate superset of `FieldWidgetDomProps`: it also
carries `className` and `disabled`, declared on the controlled-input block and
forwarded by the same executor for the reason stated there — withholding them
makes it a silent styling- and interactivity-dropper. The semantic props
(`field`, `value`, `onChange`, `readonly`, and `compact` for the relational
pickers) stay explicit and are applied after the spread, so a host cannot
displace them.

**No host in this repo changes behaviour.** Measured on all three call sites
before the fix: `ObjectGrid.renderCellEditor` passes `{ field, value, onChange }`,
`InlineFieldInput` passes those plus `autoFocus` (the key that already worked),
and `RequiredFieldsDialog` passes those plus `readonly`. None passes a dropped
key, so this is a plain repair rather than a live regression — but
`RequiredFieldsDialog` had already worked *around* the drop, wrapping each
control in a `label` because "`FieldEditWidget` … takes no `id` to associate
with". It does now.

Also corrects a comment in `@object-ui/components`' `data-table.tsx` that this
change falsifies. It justified the injected editor's document-level
`pointerdown` listener partly with "`FieldEditWidget` forwards `autoFocus` and
nothing else out of the DOM block, so a host handler could not reach the
control through it even if one were passed" — no longer true. The listener is
still load-bearing for the other half of that reason, which is untouched: the
`renderCellEditor` context object has nowhere to put an `onBlur` in the first
place. Comment only; no behaviour change in that package.
