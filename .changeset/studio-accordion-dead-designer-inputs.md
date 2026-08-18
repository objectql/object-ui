---
'@object-ui/app-shell': patch
---

Studio 页面设计器不再为 `page:accordion` 提供 `title` 与分区 `value` 编辑框(objectui#5212)

`PageAccordionRenderer`(`renderers/layout/containers.tsx`)只读 `items`/`allowMultiple`/
`variant`,从未有过 accordion 级别的标题;`@objectstack/spec` 的 `PageAccordionProps` 也
从未声明 `title`。分区 `value` 更隐蔽:渲染器在渲染前用 `panel-${idx}` **覆盖**每个分区
的 `value`(`itemsWithValue = items.map((it, idx) => ({ ...it, value: \`panel-${idx}\` }))`),
所以作者写入的值永远到不了 Radix item——这与一栏之隔的 `page:tabs` 不对称:那里作者写的
`items[].value`(设计器字段名 `key`)确实被读取,仅在缺省时才落到 `tab-${idx}`。

两个键此前都能在 Studio 中配置、保存,却对渲染结果毫无影响,也没有任何诊断提示——本次移除
让设计器诚实反映渲染器真正读取的形状,并移除随之成为孤儿的两条 i18n 键(en / zh 同一次改
动,两张表的键集保持一致)。`page:tabs` 未受影响,`不得回潮` 钉在
`previews/__tests__/block-config.test.ts`。

原三键中的第三个——`page:header.icon`——已在 objectui#3829 / PR #4794 移除,先于本 issue
被测量到,不在本次改动范围内。
