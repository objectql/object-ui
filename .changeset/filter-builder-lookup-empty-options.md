---
"@object-ui/components": patch
---

fix(components): FilterBuilder 的 lookup 列不再因 `options: []` 被拒掉远程搜索 (objectui#5031)

`renderValueInput` 里那条远程 picker 分支的条件写的是 `!field?.options`,而 `[]`
是真值 —— 于是一个带 `referenceTo`、`options` 为空数组的 lookup 列**进不到**
`LookupValuePicker`,落进按 options 画的分支:标量算子得到一个候选数为 0 的
Select(没有搜索框),`in` / `notIn` 得到一个空的勾选框列表。用户在这一列上挑不出
任何**新**值,而同一列若 `options` 键干脆缺席反而能拿到完整的远程搜索。可达性不需要
任何异常状态:`@object-ui/fields` 的 `deriveFilterFields` 与 `plugin-view` 的
`deriveFieldOptions` 都把 `options` 原样透传,对象元数据里 picklist 值尚未到位时
就是这个形状。

objectui#4874(PR #5030)已经为「静态选项集是否真的在位」建了唯一判据
`hasStaticOptionDomain(field)`(= `options` 是**非空数组**),并按「`options: []`
属于远程/未到位」这一侧裁定了值域行为。这条分支条件把同一个问题又答了一遍,两个答案
对 `options: []` 相反:值域侧当它是远程列(保值),控件侧当它是静态列(画空 Select)。

按 2026-08-17 维护者裁定,分支条件改读同一个判据:

- `referenceTo`(或 `type` 为 `user` / `owner`)且 `options` 为 `[]` 的 lookup 列
  → `LookupValuePicker`,与 `options` 键缺席时完全一致:有搜索框、有候选、能选出
  新值;多值算子走 picker 的多选形态,仍然回吐列表(objectui#3958)。
- `options` **非空**的列不受影响 —— 选项集就是它的全部值域,静态 Select 依旧。
- 分支的其余条件未动:没有 `referenceTo` 又不是 `user` / `owner` 的列(无处可搜)、
  以及 `select` 这类非 lookup 列,路由与此前逐字相同。

「值必须可见」这一条不变,只是由 picker 而不是临时 `SelectItem` 兑现。
