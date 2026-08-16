---
'@object-ui/app-shell': patch
'@object-ui/layout': patch
---

Studio 页面设计器不再为 canonical `page:header` 提供 `icon` 编辑框(objectui#3829)

`PageHeaderProps.icon` 已在 `@objectstack/spec` 17.0.0 随 ADR-0087 D2 退役
(objectstack#6946 / PR objectstack#7115):canonical `page:header` 渲染器从未读过它,
表头的身份由 record chrome(`recordChrome`)与每个 action 自带的 `icon` 承担。退役前
作者填入的值被静默丢弃,退役后平台按名拒绝整个节点 —— 而设计器仍在提供那个输入框,
等于教作者写出解析失败的元数据。本次移除该字段与它此时已成孤儿的两条 i18n 键
(en / zh 同一次改动,两张表的键集保持一致),并把「不得回潮」钉在
`previews/__tests__/block-config.test.ts`。

`@object-ui/layout` 的 `page-header` / `layout:page-header` 别名**保留** `icon` 输入,
行为不变:那是另一个渲染器,它真读真画(`PageHeader.tsx`),文档与本仓唯一的活 demo
都写它。变的只是这条声明的**依据** —— 从 spec parity 改述为 renderer-read 事实,并让
`page-header-authorable-keys` 守卫在派生 spec 键集时跳过墓碑成员,不再因为
`Object.keys(shape)` 仍列着已退役的 `icon` 而假绿。
