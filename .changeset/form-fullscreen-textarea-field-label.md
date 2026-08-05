---
'@object-ui/components': patch
---

表单内置 `textarea` 的全屏编辑对话框现在能拿到字段自己的 label：对话框标题显示字段名而不是恒定的通用词「编辑文本」，同一张表单上多个长文本字段的展开按钮也终于有了互不相同的无障碍名（objectui#3393）。

`renderFormField` 在解构字段配置时把 `label` 单独取走了（它要渲染 `<FormLabel>`），而下游 `renderFieldComponent` 唯一调用点重建 props 对象时显式补回了 `field` / `inputType` / `options` / `placeholder` / `emptyHint` / `dependsOnLabels` 等等，唯独漏了 `label`。于是内置 `textarea` 分支里的 `label` 恒为 `undefined`，`FullscreenTextarea` 中两条依赖它的分支从写下那天起就没走到过：

- 对话框标题 `label ?? t('form.fullscreen.title')` 永远落到通用词——一个叫「备注」的字段点开全屏编辑，标题不会说自己是「备注」；
- 展开按钮的无障碍名永远插值通用名词，一张有三个长文本字段的表单上三个按钮读屏完全一样。读屏用户无法判断自己要展开的是哪个字段，这是可达性缺陷而不是观感问题。

## 改了什么

- 调用点显式转发 `label`（与 `placeholder` / `emptyHint` 同法），这是唯一的行为改动。
- `label` 属于 renderer-only：`stripRendererOnlyProps` 与 `stripRegisteredFieldProps` 各加一条丢弃项，所以它既不会变成 DOM 上的 `label="备注"` 杂属性（每个内置分支都会把剩余 props 直接摊到 DOM 节点上），也不会成为注册型 widget 新收到的 prop——自 v17 起 `field` 是它们唯一的元数据载体（objectui#3233），label 一直在那里读。
- 内置 `textarea` 分支里那句 `const { label: _label, ...rest }` 随之删除。它本想拦住 label 落到 DOM，但既然从来没有 label 送进来，它拦的是不存在的东西（ESLint 一直报着 `'_label' is assigned a value but never used`），而且只护住了这一个分支。现在这件事由 strip 统一负责，所有分支同等受护。

十个语言包零改动：#3272 把 `form.fullscreen.toggle` 做成了带 `{{label}}` 插值的整句（zh 插在句尾、ja 插在句首），label 一通，十个语言的句子直接就对。字段没有 label 时仍回落到被翻译的通用词。
