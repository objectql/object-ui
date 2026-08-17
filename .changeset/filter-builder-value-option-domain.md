---
"@object-ui/components": patch
---

fix(components): FilterBuilder 的值不再落在列的选项集之外还看不见 (objectui#4874)

带 `options` 的 select/lookup 列，其值控件是一个受控的 Radix Select，而
`SelectValue` 只认已挂载的 `SelectItem`。于是文本列的 `equals "acme"` 指到
picklist 列（选项 `won` / `lost`）之后，值控件显示空，行里仍是
`value: "acme"` —— `foldFilterGroupToSpecRules` 照样持久化、实时网格照样拿
`stage equals "acme"` 去查。这是 #4768（operator）、#4781（值的类型）之后
「看不见的值」的第三张脸，成因是**值域**而不是类型：`select` / `lookup` 属于
文本族，`"acme"` 在类型上装得下，只是不在该列的选项集里。

按 2026-08-17 维护者裁定（A + C 组合）：

- **静态选项列**（`options` 是非空数组，选项集就是该列的全部值域）：切换 field
  时做成员判定，不在选项集里的值清到 #4781 的那套空形 —— 标量 `''`、列表逐项
  过滤后 `[]`。列表是**逐项**判定，用户写对的那几项不会被一颗坏项连坐。
- **远程/异步列**（lookup 远程搜索、`options` 缺席，或 `options: []` 尚未到位）：
  值**保留**并**可见** —— 绝不因一份从未声称完整的本地选项集去删一个合法的
  lookup id。Select 把该值挂成一个临时项（标签用值本身，与
  `LookupValuePicker` 对没有 label 的 id 的做法一致），多值列表把它渲染成一行
  已勾选、可取消的条目。
- 可见性是**无条件**的：无论值是切列带来的、从已存视图读回来的，还是选项集晚到
  才对不上，控件都显示行里真正带着的东西。「行带值、控件空白」这个形态不再存在，
  也不会为了显示去悄悄改写传入的 `value`。
