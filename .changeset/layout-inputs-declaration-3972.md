---
"@object-ui/layout": patch
---

`registerLayout()` 的 `inputs` 声明面与渲染器实现对齐 —— 校验器不再对正确写法报假诊断

`inputs` 是**作者面**:`sdui-parser/src/validate.ts` 拿一个节点的顶层属性逐个比对
`comp.inputs`,不在其中的报 `unknown-prop`,类型不符的报 `type-mismatch`;设计器面板、
`sdui.manifest.json`、生成的 JSX 类型也都由它派生。所以声明面写错的代价不是"文档不全",
而是**校验器对着能正常渲染的 schema 说谎**(objectui#3972,与 objectui#3900 同族、换到属性面)。

两处修正,都是按渲染器**实际读点**审计出来的:

- **`page-header` 补声明 `icon` 与 `actions`。** 两个键三面齐全:渲染器真读
  (`PageHeader.tsx:117` 取参 `:224-226` 渲染 icon;`:119` 取参 `:192-196` 把 actions
  委派给 `record:quick_actions`)、`@objectstack/spec/ui` 的 `PageHeaderProps` 声明、
  `ManifestInputType` 表达得了(`string` / `array`)。`content/docs/layout/page-header.mdx`
  的 Component Props 段落也把两者写成公开契约,而该文档页**唯一**的 live demo
  (`layout-page-header/pageheader-with-actions`)就写着 `"icon": "users"` —— 于是仓内
  自己的文档示例每次过 manifest 门都收到一条 `unknown-prop: page-header has no prop "icon"`。
  `actions` 的类型与 canonical 的 `page:header` 逐字一致(`type: 'array'`),一个概念一个键
  一种类型。
- **`navigation-renderer` 的 `items` 由 `type: 'object'` 改为 `'array'`。**
  `NavigationRendererProps.items` 是 `NavigationItem[]`(`NavigationRenderer.tsx:108`),
  而 `checkType` 对 `'object'` 判 `typeof value === 'object' && !Array.isArray(value)`、
  对 `'array'` 判 `Array.isArray`(`validate.ts:124-129`)—— 两者互斥。所以旧声明对这个
  渲染器**唯一能渲染的形状**报 `type-mismatch ... expected an object`,而对真会让它崩的
  对象形状一言不发。这不是 objectui#3832 的表达力问题:`ManifestInputType` 本来就有
  `'array'`,只是声明写错了一个表达得了的类型。

**刻意不声明**的键同样被钉住,因为"照抄 spec 的 shape"是这条修复最容易滑进去的反向缺陷:
`breadcrumb`(spec 有、这个渲染器零读点 —— 声明它就是 objectui#3829 的缺陷方向)、
`showBack` / `action` / `description`(渲染器读、spec 无此键 —— 声明任一个就是在开第二套
方言,正是 objectui#3226 收窄要防的事)、`aria`(每个 block 都因同一理由省略的可访问性逃逸口)。

渲染输出逐字节不变:渲染路径从不读 `inputs`。变化只在校验/设计器/清单这一侧,且两个方向
都钉了 —— 正确写法放行的同时,`description` 这类刻意不声明的键仍报 `unknown-prop`、
`items` 写成对象仍报 `type-mismatch`(诊断没有被弄哑)。
