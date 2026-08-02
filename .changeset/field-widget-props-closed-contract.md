---
"@object-ui/fields": minor
---

`FieldWidgetComponentProps` stops claiming to have every key (objectui#3221).

**Breaking for widget authors**: the exported `FieldWidgetComponentProps` no
longer ends in `[key: string]: any`. FROM: any prop name at all type-checked and
read as `any`. TO: the type declares a closed set — the controlled-input
contract (`value` / `onChange` / `field` / `readonly` / `disabled` /
`className` / `errorMessage` / `onUploadingChange`), the host plumbing a
renderer forwards (`schema`, `dataSource`, `dependentValues`, `dependsOn`,
`emptyHint`, `compact`, `onSelectRecord`, `onCreateNew`), and DOM pass-through
(`id`, `name`, `autoFocus`, `tabIndex`, `onBlur`/`onFocus`/`onClick`, every
`aria-*`, and `data-*` via a template-literal key). A custom widget reading
anything else now fails `tsc`; the fix is to read it off `field` (the metadata)
or to add the key here with its producer named.

Scored `minor`, not `major`, per this repo's fixed-group rule — objectui's major
tracks `@objectstack`, so breaking changes of our own ship as minor with the
semantics spelled out (see AGENTS.md §版本号策略). The practical blast radius is
small: every call site in this monorepo — `plugin-detail`'s inline editor,
`plugin-grid`'s cell editor, `app-shell`'s metadata inspectors, the form
renderer — compiles unchanged, because the closed set was derived from them.

Why it mattered: an index signature is the objectstack#4075 mechanism — **a type
that claims to have every key can never be reported as missing one**. Three
things followed, and all three are now fixed:

- `props.required` and `props.error`, both declared by the spec's
  `FieldWidgetPropsSchema` and both absent here, were legal reads typed `any`
  and `undefined` at runtime forever. They are compile errors now, which is what
  makes the `error` / `errorMessage` divergence (objectui#3222) decidable by the
  compiler instead of by a symbol guard. This change deliberately does **not**
  resolve that divergence — only make it visible.
- A misspelled prop (`readOnly` for `readonly`, `onchange` for `onChange`)
  compiled and silently did nothing.
- Any structural / parity comparison against the type was useless *in
  principle*, which is why objectui#3161's batch-7 symbol guard was the only
  detector that could see the collision at all.

Also cleaned up inside the package: ~20 `(props as any).x` reads of keys the
type now declares (`compact`, `dataSource`, `disabled`, `name`, `id`,
`onCreateNew`, `onSelectRecord`, `contextRecord`, `dependentValues`) read
through the type instead — leaving them would have kept the "a typo compiles"
half of the defect alive at exactly the sites that matter. The three batch-7
tripwires that existed to go red on this change
(`_IndexSignatureStillThere` / `_RequiredSilentlyReadsAsAny` /
`_ErrorSilentlyReadsAsAny`) are replaced by their inverse, so re-widening the
type fails a test rather than passing one.
