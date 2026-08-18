---
'@object-ui/plugin-detail': patch
---

修复相关列表(`RelatedList`)以 spec 规范拼写 `field` 声明的对象列只出表头、单元格全空的问题(objectui#5022)。

`RelatedList` 的所有身份读点都经由 `columnIdentity` 规范优先解析,因此
`{ field: 'status', label: 'Status' }` 能通过 FLS 过滤、外键过滤、空列裁剪与排序判定;而它喂给的
`data-table` 只按 `col.accessorKey || col.name` 归一化访问键,从不读 `field`,于是每个单元格取的是
`row[undefined]`,渲染成空值占位符 —— 与 objectui#3951 同形,只差一种拼写。

现在 `normalizeColumn` 在把对象列交给表格前,把解析出的身份写回 `accessorKey`:
词表解析留在 `RelatedList` 一侧,不并入表格适配器(`column-identity.ts` 有意画下的
`TABLE_ADAPTER_COLUMN_KEY` 边界)。作者已显式声明的 `accessorKey` 不被覆盖,原有拼写一并保留,
无法解析出身份的条目原样返回。legacy `name` 拼写、字符串列与显式 `accessorKey` 列行为不变。

同一处身份现在同时供给单元格取数与表头排序 —— 此前 `field` 列的表头排序派发的是
`undefined` 字段(被 `RelatedList` 丢弃),该列在取数与排序两个方向上同时失效。
