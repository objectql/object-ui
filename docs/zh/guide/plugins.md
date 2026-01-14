# 插件系统

Object UI 支持强大的插件系统，允许您使用额外的组件扩展框架。插件是独立的包，按需加载，在提供丰富功能的同时保持主应用程序包的精简。

## 概述

插件是按需加载的组件包，具有以下特点：

- **自动注册** - 导入时自动注册组件
- **按需加载** - 重量级依赖按需加载
- **保持精简** - 仅在需要时加载
- **类型安全** - 完整的 TypeScript 支持
- **最佳实践** - 内置加载状态

## 官方插件

### @object-ui/plugin-editor

基于 Monaco Editor（VS Code 的编辑器）的代码编辑器组件。

**安装：**
```bash
npm install @object-ui/plugin-editor
```

**使用：**
```tsx
// 在应用入口导入一次
import '@object-ui/plugin-editor'

// 在 schema 中使用
const schema = {
  type: 'code-editor',
  value: 'console.log("你好，世界！");',
  language: 'javascript',
  theme: 'vs-dark',
  height: '400px'
}
```

**特性：**
- 支持 100+ 种编程语言的语法高亮
- 智能提示和代码补全
- 查找和替换
- 多种主题
- 按需加载（初始 ~20 KB，Monaco 按需加载）

---

### @object-ui/plugin-charts

基于 Recharts 的数据可视化组件。

**安装：**
```bash
npm install @object-ui/plugin-charts
```

**使用：**
```tsx
// 在应用入口导入一次
import '@object-ui/plugin-charts'

// 在 schema 中使用
const schema = {
  type: 'chart-bar',
  data: [
    { name: '一月', value: 400 },
    { name: '二月', value: 300 },
    { name: '三月', value: 600 }
  ],
  dataKey: 'value',
  xAxisKey: 'name',
  height: 400
}
```

**特性：**
- 柱状图、折线图、面积图、饼图
- 响应式设计
- 可自定义颜色和样式
- 按需加载（~540 KB 仅在渲染时加载）

---

### @object-ui/plugin-kanban

基于 @dnd-kit 的看板组件，支持拖放功能。

**安装：**
```bash
npm install @object-ui/plugin-kanban
```

**使用：**
```tsx
// 在应用入口导入一次
import '@object-ui/plugin-kanban'

// 在 schema 中使用
const schema = {
  type: 'kanban',
  columns: [
    {
      id: 'todo',
      title: '待办',
      cards: [
        { id: '1', title: '任务 1', description: '做某事' }
      ]
    },
    {
      id: 'done',
      title: '已完成',
      cards: []
    }
  ]
}
```

**特性：**
- 在列之间拖放卡片
- 列限制（WIP 限制）
- 卡片徽章用于状态/优先级
- 键盘导航
- 按需加载（~100-150 KB 仅在渲染时加载）

---

### @object-ui/plugin-markdown

支持 GitHub 风格 Markdown 的渲染器。

**安装：**
```bash
npm install @object-ui/plugin-markdown
```

**使用：**
```tsx
// 在应用入口导入一次
import '@object-ui/plugin-markdown'

// 在 schema 中使用
const schema = {
  type: 'markdown',
  content: '# 你好世界\n\n这是 **markdown** 文本。'
}
```

**特性：**
- GitHub 风格 Markdown（表格、任务列表、删除线）
- XSS 防护（已净化输出）
- 代码语法高亮
- 按需加载（~100-200 KB 仅在渲染时加载）

---

## 插件工作原理

### 按需加载架构

插件使用 React 的 `lazy()` 和 `Suspense` 按需加载重量级依赖：

```typescript
// 插件结构
import React, { Suspense } from 'react'
import { Skeleton } from '@object-ui/components'

// 按需加载重量级实现
const LazyEditor = React.lazy(() => import('./MonacoImpl'))

export const CodeEditorRenderer = (props) => (
  <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
    <LazyEditor {...props} />
  </Suspense>
)
```

**优势：**
- **更小的初始包** - 主应用加载更快
- **渐进式加载** - 组件在需要时加载
- **更好的用户体验** - 下载时显示加载骨架
- **自动代码分割** - Vite 处理分块

### 包大小影响

| 插件 | 初始加载 | 按需加载 |
|--------|-------------|-----------|
| plugin-editor | ~0.2 KB | ~20 KB |
| plugin-charts | ~0.2 KB | ~540 KB |
| plugin-kanban | ~0.2 KB | ~100-150 KB |
| plugin-markdown | ~0.2 KB | ~100-200 KB |

如果不使用按需加载，所有这些代码都会在主包中！

### 自动注册

插件在导入时自动注册其组件：

```typescript
// 在插件的 index.tsx 中
import { ComponentRegistry } from '@object-ui/core'

ComponentRegistry.register('code-editor', CodeEditorRenderer)
```

您只需导入插件一次：

```typescript
// 在 App.tsx 或 main.tsx 中
import '@object-ui/plugin-editor'
import '@object-ui/plugin-charts'
import '@object-ui/plugin-kanban'
import '@object-ui/plugin-markdown'
```

现在所有插件组件都可以在您的 schema 中使用！

## 创建自定义插件

您可以遵循相同的模式创建自己的插件。详细步骤请参考[英文文档](../guide/plugins.md#creating-custom-plugins)。

## 最佳实践

### 1. 保持入口文件轻量

主 index 文件应仅包含：
- 懒加载包装器
- 组件注册
- 类型导出

重量级导入放在 `*Impl.tsx` 文件中。

### 2. 提供良好的加载状态

在加载时始终显示有意义的骨架：

```typescript
<Suspense fallback={
  <Skeleton className="w-full h-[400px]" />
}>
  <LazyComponent {...props} />
</Suspense>
```

### 3. 导出类型

使您的插件类型安全：

```typescript
export type { MyFeatureSchema } from './types'
```

## 相关文档

- [组件注册表](./component-registry.md) - 了解注册表
- [懒加载插件架构](/docs/lazy-loaded-plugins.md) - 深入了解
- [English Version](../../guide/plugins.md) - 完整英文文档
