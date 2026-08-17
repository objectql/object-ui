---
'@object-ui/app-shell': patch
---

metadata-admin 表单里六条不经注册表的渲染路径不再发悬空 `for`：结构化面按 IDREF 命名，JSON 兜底面把 id 落到自己的 textarea 上。

objectui#4871（PR #5041）给 `WIDGETS` 注册表的二十个条目加了 `labelling` 声明，`FieldRow` 据此发命名通道。但有六条路径根本不经过注册表，因而没有声明可依，一律走默认的 `control` 通道，而它们都不消费 `id`：`composite` / `repeater` / `record` 由 `fieldSpec.type` 决定并在注册表查找之前短路；另外三条结构化兜底（递归 `SchemaForm` / `RepeaterField` / `RawJsonEditor`）是在 `FieldControl` 内部、按 union 解析后的 `effective` schema 才选的 —— 也就是标签已经写完之后。真 `SchemaForm` 渲染实测（基线 `e7c5a80a8`，可编辑与只读两态）：六条路径十二个读数全是 `for=DANGLING hostIdEl=NONE` —— 可见标签指向文档中不存在的 id。这与 #4871 / #4857 / #4788 同一失效类，且比干脆没有关联更糟：解析到无的关联被工具链读作已闭合。

修法与 #4871 同形：把那段晚判定整体上提成纯函数 `resolveFieldFace()`，只吃 `FieldControl` 渲染所依据的那几个输入（`fieldSpec` / `widget` / `schema` / `value`），返回究竟渲染哪一个面。`FieldRow` 在写标签之前调它决定通道，`FieldControl` 调同一个函数而不再自行判定 —— 判据只有一份，声明与 DOM 无从走岔。

六条路径的处置按实测逐条判定，并不齐整：

- `composite`、递归 `nested-form` 里确有可 label 元素，但它属于**子字段自己的**标签（`mdf-sub` / `mdf-inner`）；`repeater` / `array-of-object` / `record` 自己只拥有折叠、新增、删除这些辅助按钮。这五条都是容器面，走 #4788 的容器形：标签发布自身 id，容器以 `role="group"` 应答 `aria-labelledby`，`for` 摘掉。`record` 委派给注册 widget 的那一形态也把 IDREF 转发下去，声明才在两种形态下都成立。
- `raw-json` 是卡面点名要**确认而非假定**的一条，实测结果与预期相反：`RawJsonEditor` 的面恰好是一个可 label 元素 —— 一个没有任何别的标签指向的 `<textarea>`，在每个分支、两种状态下都在。它读到 `hostIdEl=NONE` 是因为 id 从未被接进去，不是因为这个面接不住。所以它是真正的 `control` 面，id 直接落到 textarea 上；反过来把一个孤零零的 textarea 包进具名 group，只会命名容器而让用户真正输入的控件无名 —— 那正是 objectui#4010 裁定的反面。

注册表的二十个条目、`WIDGET_LABELLING` 声明表及其断言一字未动：注册 widget 仍由注册表说话，上提的解析函数不替它改判。
