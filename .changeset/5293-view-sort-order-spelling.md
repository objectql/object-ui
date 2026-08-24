---
'@object-ui/plugin-view': minor
---

**Breaking (shipped as `minor` per AGENTS.md §版本号策略).** `ObjectViewProps.views[].sort`
now spells its direction key **`order`**. The retired spelling is **`direction`** — named
here so that a host still writing it can find this entry by searching the old key
(objectui#5293).

```diff
  <ObjectView
    views={[{
      id: 'recent', label: 'Recent', type: 'grid',
-     sort: [{ field: 'created_at', direction: 'desc' }],
+     sort: [{ field: 'created_at', order: 'desc' }],
    }]}
  />
```

**Nothing that worked stops working, because `direction` never worked.** No reader in the
repo has ever known the word. All three consumers of the resolved `activeView.sort` read
`order`: the non-grid fetch lowers it through the shared sink `convertSortToQueryParams`,
whose `entry.order === 'desc'` is false for a missing key; the grid path forwards it to
`ObjectGridSchema.sort`, where `ObjectGrid` builds the wire string `` `${s.field} ${s.order}` ``
— literally `"created_at undefined"` — and `parseSchemaSort` reads a missing `order` as
ascending, so the column header even drew an ascending arrow; `mergedSort` hands the same
value to the delegated list view.

So a host writing the exact shape the prop declared got an **ascending** list with no
failure signal anywhere: the declaration said the value was well-formed, and the direction
was dropped at three independent readers rather than rejected at one. This rename does not
take away a feature — it converts a silent wrong answer into a loud type error at the one
place that can still be fixed cheaply.

`order` is the spelling every other sort surface already uses (`SortConfig`,
`NamedListView.sort`, `ObjectGridSchema.sort` / `.defaultSort`, and the shared
`QuerySortEntry` sink), so the prop now has one spelling repo-wide and declared equals
enforced.

⛔ Deliberately **not** a tolerant dual-read (`direction ?? order`): that is the tolerance
layer objectui#4869 ruled against, and admitting the old key as an alias would rebuild the
drift this change removes. `SortUI` is untouched — it legitimately owns `direction` on its
own `SortUISchema` and converts at its boundaries.
