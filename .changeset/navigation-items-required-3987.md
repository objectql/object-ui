---
"@object-ui/layout": patch
---

`navigation-renderer` 的 `items` 声明为 `required: true` —— 校验器不再放过必崩的节点

`items` 在组件侧是**非可选**的 `NavigationItem[]`(`NavigationRendererProps.items`,无 `?`),
渲染器也不给默认值,而注册声明一直没写 `required`。`sdui-parser` 只在 `input.required` 为真时
报 `missing-required-prop`(`validate.ts:55-64`),于是 `{ "type": "navigation-renderer" }`
这个节点**校验零诊断、渲染直接抛**:第一处无守卫的读点是 `pinnedItems` memo 里的
`collectPinnedItems(filteredItems)`(`NavigationRenderer.tsx:1242` → `:1410` 的
`for (const item of items)`),实测 `TypeError: items is not iterable`。
(`resolveActiveNavItem` memo 挡得住 —— 它的 `visit` 首行是 `if (!nodes) return`;
`:1247` 的 `filteredItems.slice()` 同样会抛,但根本走不到。)

这是 objectui#3972(键的**存在**与**类型**三面对齐)的第四面:**可选性**。#3972 与
objectui#3900 都是删除假诊断,这一条相反——它是**收紧**。

**blast radius:** 今天省略 `items` 写 `navigation-renderer` 的 schema,会新增一条
**error** 级 `missing-required-prop`。受影响面是仓外按 `inputs` / `packages/layout/README.md`
做 schema 驱动的消费者(仓内没有任何 JSON 元数据把它当 schema 节点写,React 调用侧的必填由
TS 兜住;`examples/schema-catalog` 的 `not-a-container` 对照节点补了 `items: []`,使它只剩
那一处故意植入的缺陷)。而这条诊断新拦下的形状,**恰好等于渲染必然崩溃的形状** —— 让作者
(尤其是 AI 作者)在发布期就听到运行期注定要发生的失败,正是 `missing-required-prop` 存在
的理由。若某个消费者确实想要"缺 items 就渲染空导航",那是给组件加 `= []` 默认值的另一条路
(objectui#3987 里记了,与本改动不互斥),而不是让校验器继续沉默。

`basePath` **保持可选**并被钉成对照:渲染器真的给了它默认值(`basePath = ''`)。`required`
是逐个属性从组件读出的事实,不是一刀切——否则这道门会开始拒绝完全能渲染的 schema,作者就会
学着无视 `missing-required-prop`,正如 #3972 里他们被教着无视 `type-mismatch`。
