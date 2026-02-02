# ObjectUI 快速入门指南
# ObjectUI Quick Start Guide (中文版)

**5 分钟快速搭建企业级前端界面**

---

## 目录

1. [快速开始](#快速开始)
2. [三种使用方式](#三种使用方式)
3. [核心概念](#核心概念)
4. [常见场景示例](#常见场景示例)
5. [FAQ](#faq)

---

## 快速开始

### 前提条件

- Node.js 20+ 
- PNPM 9+ (推荐) 或 NPM/Yarn

### 方式一：使用 CLI（最快）⚡

```bash
# 1. 全局安装 CLI
npm install -g @object-ui/cli

# 2. 创建新项目
objectui init my-app

# 3. 进入项目目录
cd my-app

# 4. 启动开发服务器
objectui serve app.schema.json

# 访问 http://localhost:3000
```

**就这么简单！** 现在你已经有了一个运行中的企业级前端界面。

---

### 方式二：在现有 React 项目中使用

```bash
# 1. 安装核心包
npm install @object-ui/react @object-ui/components @object-ui/fields

# 2. 安装数据适配器（可选）
npm install @object-ui/data-objectstack

# 3. 按需安装插件
npm install @object-ui/plugin-grid @object-ui/plugin-charts
```

**配置 Tailwind CSS：**

```javascript
// tailwind.config.js
export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './node_modules/@object-ui/components/**/*.{js,jsx}'
  ],
  theme: { extend: {} },
  plugins: []
};
```

**在你的应用中使用：**

```tsx
// App.tsx
import { SchemaRenderer } from '@object-ui/react';
import { registerDefaultRenderers } from '@object-ui/components';
import { registerField } from '@object-ui/fields';

// 注册组件
registerDefaultRenderers();

// 按需注册字段（减少 bundle 体积）
registerField('text');
registerField('number');
registerField('email');

const schema = {
  type: 'page',
  title: '用户管理',
  body: {
    type: 'crud',
    api: '/api/users',
    columns: [
      { name: 'name', label: '姓名', type: 'text' },
      { name: 'email', label: '邮箱', type: 'email' },
      { name: 'role', label: '角色', type: 'select', 
        options: ['admin', 'user', 'guest'] }
    ]
  }
};

function App() {
  return <SchemaRenderer schema={schema} />;
}

export default App;
```

---

### 方式三：从源码开始（完整控制）

```bash
# 1. 克隆仓库
git clone https://github.com/objectstack-ai/objectui.git
cd objectui

# 2. 安装依赖
pnpm install

# 3. 构建所有包
pnpm build

# 4. 启动开发控制台
pnpm dev

# 访问 http://localhost:5173
```

---

## 三种使用方式对比

| 特性 | CLI 方式 | React 集成 | 源码方式 |
|------|---------|-----------|---------|
| **启动时间** | ⚡ 5 分钟 | ⏱️ 15 分钟 | 🕐 30 分钟 |
| **适用场景** | 快速原型<br/>简单应用 | 生产环境<br/>现有项目 | 完全自定义<br/>贡献代码 |
| **学习曲线** | ⭐ 零代码 | ⭐⭐ 需要 React | ⭐⭐⭐ 需要深入理解 |
| **灵活性** | ⭐⭐ 有限 | ⭐⭐⭐ 高 | ⭐⭐⭐⭐⭐ 完全控制 |
| **Bundle 优化** | ⭐⭐ 自动 | ⭐⭐⭐⭐ 可控 | ⭐⭐⭐⭐⭐ 完全优化 |
| **推荐使用** | 入门学习<br/>内部工具 | 企业应用<br/>生产环境 | 深度定制<br/>开源贡献 |

---

## 核心概念

### 1. Schema（配置）

ObjectUI 使用 **JSON Schema** 描述界面。Schema 是声明式的配置对象。

**最简单的 Schema：**

```json
{
  "type": "text",
  "content": "Hello World"
}
```

**带数据绑定的 Schema：**

```json
{
  "type": "text",
  "content": "用户数：${stats.users}"
}
```

### 2. 组件类型

ObjectUI 提供 **40+ 组件**，分为 7 类：

```
📦 布局组件
   ├─ page, card, grid, flex, stack, tabs
   
📝 表单组件
   ├─ input, select, checkbox, radio, switch, slider
   
📊 数据显示
   ├─ table, list, badge, avatar, chart
   
💬 反馈组件
   ├─ toast, alert, progress, skeleton
   
🎭 弹出层
   ├─ dialog, sheet, drawer, popover, tooltip
   
🧭 导航组件
   ├─ breadcrumb, pagination, menu
   
🔌 高级插件
   ├─ crud, kanban, calendar, gantt, dashboard
```

### 3. 数据绑定

使用 `${}` 表达式绑定数据：

```json
{
  "type": "card",
  "title": "${user.name}",
  "description": "邮箱：${user.email}",
  "visible": "${user.isActive}"
}
```

### 4. 动作系统

处理用户交互：

```json
{
  "type": "button",
  "label": "保存",
  "onClick": {
    "type": "ajax",
    "api": "/api/users",
    "method": "POST",
    "data": "${formData}",
    "onSuccess": {
      "type": "toast",
      "message": "保存成功！"
    }
  }
}
```

---

## 常见场景示例

### 场景 1：数据列表（CRUD）

```json
{
  "type": "crud",
  "title": "用户管理",
  "api": "/api/users",
  "columns": [
    { "name": "id", "label": "ID", "type": "text" },
    { "name": "name", "label": "姓名", "type": "text" },
    { "name": "email", "label": "邮箱", "type": "email" },
    { "name": "role", "label": "角色", "type": "select",
      "options": ["admin", "user", "guest"] },
    { "name": "status", "label": "状态", "type": "badge" }
  ],
  "actions": [
    { "label": "新建", "type": "create", "icon": "plus" },
    { "label": "编辑", "type": "update", "icon": "edit" },
    { "label": "删除", "type": "delete", "icon": "trash",
      "confirm": "确定要删除吗？" }
  ],
  "pagination": { "pageSize": 20 },
  "searchable": true,
  "exportable": true
}
```

---

### 场景 2：仪表盘

```json
{
  "type": "dashboard",
  "title": "运营仪表盘",
  "widgets": [
    {
      "type": "card",
      "title": "总用户数",
      "value": "${stats.totalUsers}",
      "icon": "users",
      "trend": { "value": 12.5, "direction": "up" }
    },
    {
      "type": "card",
      "title": "月营业额",
      "value": "${formatCurrency(stats.revenue)}",
      "icon": "dollar-sign",
      "trend": { "value": 8.3, "direction": "up" }
    },
    {
      "type": "chart",
      "title": "销售趋势",
      "chartType": "line",
      "dataSource": { "api": "/api/stats/sales" },
      "xField": "date",
      "yField": "amount"
    },
    {
      "type": "grid",
      "title": "最近订单",
      "dataSource": { "api": "/api/orders/recent" },
      "columns": [
        { "field": "orderNo", "label": "订单号" },
        { "field": "customer", "label": "客户" },
        { "field": "amount", "label": "金额", "type": "currency" }
      ]
    }
  ]
}
```

---

### 场景 3：多步骤表单

```json
{
  "type": "form",
  "title": "用户注册",
  "steps": [
    {
      "title": "基本信息",
      "fields": [
        { "name": "name", "label": "姓名", "type": "text", "required": true },
        { "name": "email", "label": "邮箱", "type": "email", "required": true,
          "validation": { "type": "email", "unique": true } },
        { "name": "phone", "label": "电话", "type": "phone" }
      ]
    },
    {
      "title": "账户信息",
      "fields": [
        { "name": "username", "label": "用户名", "type": "text", "required": true },
        { "name": "password", "label": "密码", "type": "password", "required": true,
          "validation": { "minLength": 8 } },
        { "name": "confirmPassword", "label": "确认密码", "type": "password",
          "validation": { "match": "password" } }
      ]
    },
    {
      "title": "完成",
      "fields": [
        { "name": "terms", "label": "我同意服务条款", "type": "checkbox", "required": true }
      ]
    }
  ],
  "onSubmit": {
    "type": "ajax",
    "api": "/api/register",
    "method": "POST",
    "data": "${formData}",
    "onSuccess": {
      "type": "redirect",
      "url": "/dashboard"
    }
  }
}
```

---

### 场景 4：看板（项目管理）

```json
{
  "type": "kanban",
  "title": "项目任务看板",
  "dataSource": { "api": "/api/tasks" },
  "groupByField": "status",
  "columns": [
    { "id": "todo", "title": "待办", "color": "gray" },
    { "id": "in_progress", "title": "进行中", "color": "blue" },
    { "id": "review", "title": "审核中", "color": "yellow" },
    { "id": "done", "title": "已完成", "color": "green" }
  ],
  "cardTemplate": {
    "title": "${task.title}",
    "description": "${task.description}",
    "avatar": "${task.assignee.avatar}",
    "tags": "${task.tags}",
    "priority": "${task.priority}"
  },
  "onCardMove": {
    "type": "ajax",
    "api": "/api/tasks/${card.id}/move",
    "method": "PATCH",
    "data": { "status": "${targetColumn}" }
  }
}
```

---

### 场景 5：数据可视化图表

```json
{
  "type": "page",
  "title": "销售分析",
  "body": {
    "type": "grid",
    "columns": 2,
    "items": [
      {
        "type": "chart",
        "chartType": "area",
        "title": "销售趋势",
        "dataSource": { "api": "/api/stats/sales-trend" },
        "xField": "date",
        "yField": "amount",
        "smooth": true
      },
      {
        "type": "chart",
        "chartType": "pie",
        "title": "产品分布",
        "dataSource": { "api": "/api/stats/products" },
        "nameField": "product",
        "valueField": "count"
      },
      {
        "type": "chart",
        "chartType": "bar",
        "title": "区域对比",
        "dataSource": { "api": "/api/stats/regions" },
        "xField": "region",
        "yField": "sales"
      },
      {
        "type": "chart",
        "chartType": "radar",
        "title": "绩效雷达图",
        "dataSource": { "api": "/api/stats/performance" },
        "indicators": ["销售", "服务", "质量", "速度", "创新"]
      }
    ]
  }
}
```

---

### 场景 6：详情页

```json
{
  "type": "detail",
  "title": "用户详情",
  "dataSource": { "api": "/api/users/${id}" },
  "sections": [
    {
      "title": "基本信息",
      "fields": [
        { "name": "name", "label": "姓名" },
        { "name": "email", "label": "邮箱" },
        { "name": "phone", "label": "电话" },
        { "name": "department", "label": "部门" }
      ]
    },
    {
      "title": "权限信息",
      "fields": [
        { "name": "role", "label": "角色" },
        { "name": "permissions", "label": "权限列表", "type": "tags" },
        { "name": "status", "label": "状态", "type": "badge" }
      ]
    },
    {
      "title": "统计数据",
      "layout": "grid",
      "columns": 3,
      "fields": [
        { "name": "loginCount", "label": "登录次数", "type": "statistic" },
        { "name": "lastLogin", "label": "最后登录", "type": "datetime" },
        { "name": "createdAt", "label": "创建时间", "type": "datetime" }
      ]
    }
  ],
  "tabs": [
    {
      "title": "订单记录",
      "component": {
        "type": "grid",
        "dataSource": { "api": "/api/users/${id}/orders" },
        "columns": [
          { "field": "orderNo", "label": "订单号" },
          { "field": "amount", "label": "金额", "type": "currency" },
          { "field": "status", "label": "状态", "type": "badge" }
        ]
      }
    },
    {
      "title": "活动日志",
      "component": {
        "type": "timeline",
        "dataSource": { "api": "/api/users/${id}/activities" }
      }
    }
  ]
}
```

---

## 高级特性

### 1. 表达式系统

ObjectUI 支持强大的表达式语法：

```json
{
  "visible": "${user.role === 'admin'}",
  "disabled": "${!user.canEdit}",
  "className": "${item.isActive ? 'text-green-500' : 'text-gray-500'}",
  "value": "${user.firstName + ' ' + user.lastName}",
  "options": "${departments.map(d => ({ label: d.name, value: d.id }))}",
  "total": "${items.reduce((sum, item) => sum + item.price, 0)}"
}
```

### 2. 条件渲染

```json
{
  "type": "grid",
  "items": [
    {
      "type": "card",
      "title": "欢迎",
      "visible": "${user.isNewUser}"
    },
    {
      "type": "alert",
      "message": "请完善个人信息",
      "visible": "${!user.profileComplete}",
      "variant": "warning"
    }
  ]
}
```

### 3. 动作链（Action Chaining）

```json
{
  "type": "button",
  "label": "提交",
  "onClick": {
    "type": "chain",
    "actions": [
      {
        "type": "ajax",
        "api": "/api/validate",
        "method": "POST"
      },
      {
        "type": "ajax",
        "api": "/api/submit",
        "method": "POST",
        "data": "${formData}"
      },
      {
        "type": "toast",
        "message": "提交成功！",
        "variant": "success"
      },
      {
        "type": "redirect",
        "url": "/success"
      }
    ]
  }
}
```

### 4. 权限控制

```json
{
  "type": "crud",
  "api": "/api/users",
  "permissions": {
    "create": "${user.role === 'admin'}",
    "update": "${user.role === 'admin' || record.id === user.id}",
    "delete": "${user.role === 'admin'}",
    "export": "${user.hasPermission('export_users')}"
  },
  "columns": [
    { "name": "salary", "label": "薪资", "type": "currency",
      "visible": "${user.role === 'admin'}" }
  ]
}
```

### 5. 主题定制

```tsx
import { ThemeProvider } from '@object-ui/react';

const customTheme = {
  mode: 'dark',
  colors: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  },
  radius: 'lg',
  font: 'system-ui'
};

function App() {
  return (
    <ThemeProvider theme={customTheme}>
      <SchemaRenderer schema={schema} />
    </ThemeProvider>
  );
}
```

---

## 性能优化技巧

### 1. 懒加载字段（减少 70% Bundle）

```typescript
// ❌ 不推荐 - 加载所有字段
import { registerAllFields } from '@object-ui/fields';
registerAllFields(); // 300KB

// ✅ 推荐 - 按需加载
import { registerField } from '@object-ui/fields';
registerField('text');
registerField('number');
registerField('email');
// 只有 90KB！
```

### 2. 懒加载插件

```tsx
import { lazy, Suspense } from 'react';

const KanbanView = lazy(() => import('@object-ui/plugin-kanban'));

function KanbanPage() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <SchemaRenderer schema={kanbanSchema} />
    </Suspense>
  );
}
```

### 3. 虚拟滚动（大数据列表）

```json
{
  "type": "grid",
  "dataSource": { "api": "/api/large-dataset" },
  "virtualScroll": true,
  "pageSize": 50
}
```

### 4. API 缓存

```typescript
import { createObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = createObjectStackAdapter({
  baseUrl: API_URL,
  cache: {
    enabled: true,
    ttl: 300000  // 5 分钟
  }
});
```

---

## FAQ

### Q1: ObjectUI 和其他 Low-Code 平台有什么区别？

**A:** ObjectUI 的核心差异：
- ✅ **Tailwind 原生** - 不是自定义样式系统
- ✅ **TypeScript 严格模式** - 完整类型安全
- ✅ **Shadcn/UI 设计质量** - 不是"看起来像 Low-Code"
- ✅ **Bundle 体积小 6 倍** - 50KB vs 300KB+
- ✅ **完全开源 MIT** - 可以 fork 和定制

### Q2: 可以和现有 React 项目集成吗？

**A:** 完全可以！ObjectUI 设计为 React 库，可以：
- 在现有项目中局部使用
- 和其他 React 组件混用
- 自定义主题和组件
- 随时导出为标准 React 代码

### Q3: 支持哪些数据源？

**A:** ObjectUI 支持任何后端：
- ✅ REST API
- ✅ GraphQL
- ✅ ObjectQL (ObjectStack)
- ✅ Firebase
- ✅ 自定义适配器

### Q4: 如何自定义组件？

**A:** 三种方式：
1. **覆盖默认组件**
   ```typescript
   ComponentRegistry.register('button', MyCustomButton);
   ```

2. **创建新组件**
   ```typescript
   ComponentRegistry.register('my-widget', MyWidget, {
     namespace: 'custom'
   });
   ```

3. **使用插件系统**
   ```bash
   pnpm create-plugin my-plugin
   ```

### Q5: 生产环境稳定吗？

**A:** ObjectUI 已经生产就绪：
- ✅ 85%+ 测试覆盖率
- ✅ TypeScript 严格模式
- ✅ 持续集成 (CI/CD)
- ✅ 安全扫描 (CodeQL)
- ✅ 活跃维护和支持

### Q6: 如何处理复杂业务逻辑？

**A:** 多种方式：
- **表达式系统** - 简单逻辑内联
- **自定义动作** - 注册业务逻辑
- **混用 React 组件** - 复杂场景用代码
- **触发器系统** - 工作流自动化

### Q7: 支持移动端吗？

**A:** 支持响应式设计：
- ✅ Tailwind 响应式类
- ✅ 触摸友好的组件
- ⏳ 专用移动组件（开发中）

### Q8: 如何升级版本？

**A:** 查看 [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- 遵循语义化版本
- 提供迁移工具
- 详细的升级文档

---

## 学习资源

### 官方资源
- 📖 [完整文档](https://www.objectui.org)
- 💻 [GitHub 仓库](https://github.com/objectstack-ai/objectui)
- 🎨 [Storybook 组件展示](./storybook/)
- 📦 [示例项目](./examples/)

### 社区
- ⭐ [Star on GitHub](https://github.com/objectstack-ai/objectui)
- 🐛 [报告问题](https://github.com/objectstack-ai/objectui/issues)
- 📧 [联系我们](mailto:hello@objectui.org)

### 延伸阅读
- [架构评估报告](./ARCHITECTURE_EVALUATION.zh-CN.md)
- [ObjectStack Spec 对齐分析](./OBJECTSTACK_SPEC_ALIGNMENT.zh-CN.md)
- [企业级解决方案](./OBJECTUI_ENTERPRISE_SOLUTION.md)
- [贡献指南](./CONTRIBUTING.md)

---

## 下一步

现在你已经掌握了 ObjectUI 的基础知识，可以：

1. **尝试示例** - 运行 `pnpm dev` 查看示例
2. **构建你的第一个应用** - 使用 CLI 创建项目
3. **阅读完整文档** - 深入了解所有功能
4. **加入社区** - 获取帮助和分享经验

**祝你使用愉快！** 🎉

---

**版本：** v1.0  
**更新时间：** 2026-02-02  
**维护：** ObjectUI Team
