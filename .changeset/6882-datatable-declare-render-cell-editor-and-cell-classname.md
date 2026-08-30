---
'@object-ui/types': minor
'@object-ui/components': minor
---

feat(types): declare `renderCellEditor` and schema-level `cellClassName` on `DataTableSchema`

`data-table` has read both keys on its production path all along — `renderCellEditor`
through a `(schema as any)` cast, `cellClassName` by destructuring it into every body
cell's class. Neither was declared, so authoring either one was unchecked: a
misspelling produced no error and no widget, and no editor completion offered them.
`DataTableSchema` now declares both, and the cast in `data-table.tsx` is gone rather
than replaced.

What you can write after this change that you could not write before, exactly:
**nothing new runs.** Both keys had the same effect yesterday, because
`BaseSchema`'s `[key: string]: any` already admitted them at any type at all. What
changes is that they are now *checked* and *documented*:

```ts
const schema: DataTableSchema = {
  type: 'data-table',
  columns, data,
  cellClassName: 'px-2 py-1 text-sm',        // every body cell — row-density padding
  renderCellEditor: ({ column, value, commit, cancel }) =>
    column.type === 'select'
      ? <MyPicker value={value} onSelect={commit} onDismiss={cancel} />
      : null,                                  // null → fall through to the built-in editor
};
```

⚠️ **One reject direction, deliberate.** Because the keys were previously absorbed by
the index signature as `any`, authored values of the *wrong shape* also compiled and
silently did nothing. They are now compile errors:

- `cellClassName` is declared `string`, matching `BaseSchema.className` and
  `TableColumn.cellClassName`. The renderer passes it through `cn()`, which would
  also swallow `['a','b']` or `{ a: true }` — those spellings now fail to compile.
  One authored spelling for a class slot is the contract.
- `renderCellEditor` is declared as the function `data-table` actually calls. A
  non-function value (or a function with an incompatible context/return type) now
  fails to compile instead of being ignored at runtime.

No runtime behaviour changed anywhere, and nothing was retired. The zod mirror
(`@object-ui/types/zod`) gains both keys in the same stroke, so the validator accepts
what the published types now invite.
