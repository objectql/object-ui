---
'@object-ui/plugin-view': patch
---

docs: README 按真实导出面重写虚构的 `viewComponents` 手动注册,并把 `ObjectViewSchema` 的导入路径改到 `@object-ui/types`

`### Manual Registration` 教的 `viewComponents` 在本包(以至全仓)零命中,照抄第一行就是
`Object.entries(undefined)` 抛 TypeError;替换为三节真话:七个 `ComponentRegistry.register`
调用认领的 schema 类型键表、本包 39 个真实导出名、以及把导出组件挂到自定义键的写法。

`ObjectViewSchema` 是真类型,但声明在 `@object-ui/types`,本包只 import 不 re-export,按
README 原路径导入是 TS2305;改导入路径(未新增任何导出或 re-export),示例键面随之对齐真身
(`objectName` 必填、`defaultViewType`、`table.columns`)。

无代码/类型/运行时改动。声明 patch 是因为 `README.md` 在包的 `files` 里,随下次发布到 npm。
