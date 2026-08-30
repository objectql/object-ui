---
'@object-ui/types': minor
'@object-ui/components': minor
---

feat(types): declare `renderCellEditor` and schema-level `cellClassName` on `DataTableSchema`

`data-table` has read both keys on its production path all along — `renderCellEditor`
through a `(schema as any)` cast, `cellClassName` by destructuring it into the class of
its three utility cells (the selection checkbox, the row number, the row actions).
Neither was declared, so authoring either one was unchecked: a misspelling produced no
error and no widget, and no editor completion offered them.
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
  cellClassName: 'px-2 py-1 text-sm',        // utility cells only (see below)
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

⚠️ **What the schema-level `cellClassName` actually styles.** It is NOT the
table-level twin of the per-column key: the two reach **disjoint** cells. Measured on
the render, the schema-level key is folded into the **utility** cells only — the
selection-checkbox cell, the row-number cell and the row-actions cell — while every
**data** cell folds `TableColumn.cellClassName` and nothing else. Row density is
therefore a pair of settings (`ObjectGrid` sets both), and the schema-level key alone
leaves data cells at the primitive's default `p-4`. The docblock, the zod `describe`
and `content/docs/components/complex/data-table.mdx` all say this now.

No runtime behaviour changed anywhere, and nothing was retired. The zod mirror
(`@object-ui/types/zod`) gains both keys in the same stroke, so the validator accepts
what the published types now invite.
