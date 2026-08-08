---
"@object-ui/plugin-detail": patch
---

`record:details` 的 `sections` 输入说明改为从 spec 形状派生的对象形,不再教已被退役的「Section IDs」

`inputs` 不是文档,而是发布出去的编写契约:`gen-manifest.ts` 把它序列化进
`sdui.manifest.json`(保存门 + parser 白名单)和 `sdui-intrinsics.d.ts`。而
`record:details.sections` 的说明写的是 `Section IDs to show (required when layout
is "custom")` —— 那是 17.x 以前的形状。pin 版 `@objectstack/spec@17.0.0-rc.5` 的
`RecordDetailsProps.sections` 是对象数组 `{ name?, label?, columns?, fields }`,
objectstack#5611 把 `z.array(z.string())` 那条拼法**删掉**而不是 union 进来(既无
producer 也无 consumer,一种形状而不是两套事实契约)。

照旧说明写 `sections: ['contact_info', 'address']` 的作者,在四层之间拿不到任何
诊断:`['a','b']` 对 manifest 门是合法 `array`(门只看顶层键名 + 粗类型),上游
`validateComponentProps` 是 advisory 级,spec 只在真的走 parse 的路径上才拒,而
`RecordDetailsRenderer` 对每个条目读 `s.name` / `s.label` / `s.fields` —— 字符串上
三者全 `undefined`,该 section 一个字段都不渲染。`layout: 'custom'` 时 sections 是
详情页正文的唯一来源,所以结果是一张没有报错的空白详情页。

新说明逐键派生自 spec 各成员的 `.describe()` 与渲染器实读:`fields` 必填、按序渲染;
`label` 是标题(省略即无标题、无边框);`name` 是 snake_case 稳定标识与 i18n 锚点
(标题走 `objects.{object}._sections.{name}.label`);`columns`(1-4)是本 section 的
字段栅格宽度,省略则由渲染器推导;并明确写出字符串条目不被接受。渲染器另外还认的
`title` / `showBorder` / `hideEmpty` **故意不写进说明** —— spec 的 section 对象没有
声明它们,parse 时会被静默剥掉,发布它们等于教作者写契约丢弃的键。

同时新增 `recordDetailsInputs.spec-parity.test.ts`:两个方向的断言都在运行时从 spec
schema 派生(每个 spec 成员键都能从说明里发现;本 block 不声明 spec 不接受的顶层
input),所以下一次 spec 变形会先让测试红,而不是又一次静默张开。仅说明文本变化,无
运行时行为改动。
