---
'@object-ui/app-shell': patch
---

metadata-admin 表单:嵌套字段 DOM id 按路径作用域,grid/table 单元格由列头命名

**objectui#5062 —— 交叉接线的标签关联。** `FieldRow` 用字段的**本层**名字构造宿主 id
(`mdf-{name}`),但它在四个嵌套点被递归调用(composite 子行、repeater 卡片行、record
展开项、递归 `SchemaForm`)。不同父级下的同名子字段因此产生同一个 DOM id,而
`<label for>` 只解析到文档中的**第一个**匹配。实测(两个 composite `a` / `b`,各带一个
名为 `field` 的子字段,值 x / y):

```
ids: ["mdf-a-label","mdf-field","mdf-b-label","mdf-field"]
DUPLICATES: ["mdf-field"]
label "Field A" for=mdf-field  resolves to INPUT[value="x"]
label "Field B" for=mdf-field  resolves to INPUT[value="x"]   <- Field A 的控件
```

即点击 "Field B" 聚焦到 Field A 的输入框,辅助技术把 Field A 的控件读成 "Field B"。
这不是 #4871 / #4857 / #4788 / #5039 那一类「解析到无」,而是**解析到了错的元素** ——
DOM 上看不出任何破绽。id 改为按字段**路径**派生(`mdf-a.field` / `mdf-b.field`);
**顶层字段 id 保持 `mdf-{field}` 不变**,既有选择器面不动,只有嵌套行加前缀。record
项入 id 的是它的**序号**而非作者输入的键名 —— 键名可能含空格,会把 `aria-labelledby`
的 IDREF 切成两个引用。

**objectui#5063 —— grid/table 单元格无可访问名。** `RepeaterField` 的 `widget: 'grid'`
布局里,列名只作为 `th` 的可见文本存在:不是 `label`,没有 `id` 可供引用,也没有
`scope`。实测每个单元格控件 `label[for]` / `aria-label` / `aria-labelledby` 三者全无,
屏幕阅读器逐格听到的是「无名编辑框」。现在每个 `th` 发一个(同样路径作用域的)id 加
`scope="col"`,单元格控件以 `aria-labelledby` 指向对应列头 —— 列名只写一次,改名不会
漂移。卡片布局本就每行走 `FieldRow` 带真实 `label for`,不受影响。
