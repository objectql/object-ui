---
"@object-ui/layout": patch
---

`page-header` 注册补 `isContainer: true` —— 校验器不再对文档承诺的 children 写法报 `not-a-container`

`PageHeader` 一直**有意**把 `schema.children` 渲染进右侧动作槽(`PageHeader.tsx:182`,
`record:quick_actions` 嵌在 `page:header.children` 下就是靠它),
`content/docs/layout/page-header.mdx` 把该槽的优先级(`action` → React `children` →
`actions` → schema children)写成公开契约,该文档页唯一的 live demo
(`layout-page-header/pageheader-with-actions`)正是这个形状且实测正常渲染。但
`packages/layout/src/index.ts` 的注册漏了 `isContainer: true`。

漏这个 flag 从来没有挡住任何渲染 —— 渲染路径根本不读它(`SchemaRenderer` 把
`children` 从 React props 里剥掉当元数据,而始终把整个节点作为 `schema` 传下去,
`PageHeader` 自己再把 `schema.children` 放回槽里)。它的消费者在别处:`sdui-parser`
的 `not-a-container` 诊断、Studio 调色板元数据、react-page 标签表。所以真正的后果是
**校验器在说谎**:作者照文档写出能正常渲染的 schema,却拿到一条
"`page-header` does not accept children" 的 warning;信了这条 warning 去掉 children,
右槽就空掉。而会说谎的 warning 比缺一条 warning 更贵 —— 它训练作者(尤其 AI 作者)
连真实的 `not-a-container`(那些确实不收子节点的组件)一起无视。

这不是在 spec 之外新开作者面:`children` 是 objectui JSON 协议里**每个节点**的基础属性
(`sdui-parser/src/validate.ts` 的 `BASE_PROPS` 把它和 `type`/`id`/`className` 并列),
不是 `PageHeaderProps` 的键。所以这个 flag 回答的是协议层面的"该节点是否接受子节点列表",
而对这个组件,答案一直是"是"。维护者 2026-08-09 就 objectui#3900 的 A/B 分叉裁定 A 案,
理由同上。

行为面变化极窄:注册元数据一个布尔位。渲染输出逐字节不变(渲染路径不读该 flag);
`sdui-parser` 对带 children 的 `page-header` 少报一条 warning;设计器把它当容器对待
(即它本来的样子)。canonical 的 `page:header`(`@object-ui/components`)不在此列且刻意不动
—— 那个渲染器完全不读 `schema.children`,所以它没有 `isContainer` 是正确的。

两个方向都已钉住:文档 demo 走应用真实构建的 manifest 后不再产生 `not-a-container`,
而一个真正不收子节点的组件(`navigation-renderer`)带 children 时诊断照旧触发 ——
后者是前者的对照,保证这条修复不是把诊断弄哑了。
