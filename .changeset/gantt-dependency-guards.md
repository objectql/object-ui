---
"@object-ui/plugin-gantt": patch
---

拖拽连线增加内建校验与宿主否决钩子(#2436 第 1、2 项)。落点为锁定行
(`locked`)或分组行(`type: 'group'`)时,悬停不再高亮、松手不再创建;
成环依赖(直接回边、跨层级传递回边)基于**全量任务集**检测并拒绝——不受
折叠子树导致可见连线缺边的影响。新增 `onBeforeDependencyCreate(source,
target, type)` 钩子,在内建校验通过后调用,返回 `false` 可否决本次连线
(即 DHTMLX `onBeforeLinkAdd` / Syncfusion `actionBegin` 惯例)。
`wouldCreateDependencyCycle` 从 `scheduling` 导出并单测覆盖。
