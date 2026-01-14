# 组件

Object UI 提供了一套全面的预构建组件，实现了常见的 UI 模式。所有组件都使用 **Shadcn UI** 和 **Tailwind CSS** 构建，具有最大的灵活性和可定制性。

## 概述

`@object-ui/components` 包包括：

- **50+ 组件** - 涵盖表单、数据展示、布局和反馈
- **Tailwind 原生** - 使用 Tailwind 类完全可定制
- **无障碍** - 符合 WCAG 标准，键盘导航，ARIA 标签
- **类型安全** - 完整的 TypeScript 支持
- **主题化** - 深色模式和自定义主题
- **响应式** - 移动优先设计

## 安装

```bash
npm install @object-ui/components @object-ui/react @object-ui/core
```

**对等依赖：**
```json
{
  "react": "^18.0.0 || ^19.0.0",
  "react-dom": "^18.0.0 || ^19.0.0",
  "tailwindcss": "^3.0.0"
}
```

## 设置

### 1. 配置 Tailwind

将 Object UI 组件添加到 Tailwind 内容中：

```js
// tailwind.config.js
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './node_modules/@object-ui/components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### 2. 导入样式

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@import '@object-ui/components/dist/style.css';
```

### 3. 注册组件

```tsx
// src/main.tsx 或 src/App.tsx
import { registerDefaultRenderers } from '@object-ui/components'

// 一次性注册所有组件
registerDefaultRenderers()
```

## 使用

### 使用 SchemaRenderer

使用组件的主要方式是通过 schema：

```tsx
import { SchemaRenderer } from '@object-ui/react'

const schema = {
  type: 'card',
  title: '用户资料',
  className: 'max-w-md',
  body: {
    type: 'flex',
    direction: 'column',
    gap: 4,
    children: [
      {
        type: 'input',
        name: 'name',
        label: '全名',
        placeholder: '输入您的姓名'
      },
      {
        type: 'input',
        name: 'email',
        label: '邮箱',
        type: 'email',
        placeholder: 'you@example.com'
      },
      {
        type: 'button',
        label: '保存',
        variant: 'default'
      }
    ]
  }
}

function App() {
  return <SchemaRenderer schema={schema} />
}
```

## 组件分类

### 表单组件

用于用户输入和数据录入的组件。

#### Input - 输入框

带验证支持的文本输入字段。

```json
{
  "type": "input",
  "name": "username",
  "label": "用户名",
  "placeholder": "输入用户名",
  "required": true,
  "className": "w-full"
}
```

**属性：**
- `name` - 字段名称
- `label` - 字段标签
- `placeholder` - 占位符文本
- `type` - 输入类型（text、email、password、number 等）
- `required` - 必填字段
- `disabled` - 禁用状态
- `value` - 字段值
- `onChange` - 变更处理器

---

#### Textarea - 多行文本框

多行文本输入。

```json
{
  "type": "textarea",
  "name": "description",
  "label": "描述",
  "placeholder": "输入描述...",
  "rows": 4
}
```

---

#### Select - 选择框

下拉选择。

```json
{
  "type": "select",
  "name": "country",
  "label": "国家",
  "options": [
    { "value": "cn", "label": "中国" },
    { "value": "us", "label": "美国" },
    { "value": "uk", "label": "英国" }
  ]
}
```

---

#### Checkbox - 复选框

布尔值的复选框输入。

```json
{
  "type": "checkbox",
  "name": "terms",
  "label": "我同意条款和条件",
  "required": true
}
```

---

#### Radio - 单选按钮

从组中单选的单选按钮。

```json
{
  "type": "radio",
  "name": "plan",
  "label": "选择计划",
  "options": [
    { "value": "free", "label": "免费版" },
    { "value": "pro", "label": "专业版" },
    { "value": "enterprise", "label": "企业版" }
  ]
}
```

---

#### Date Picker - 日期选择器

日期选择组件。

```json
{
  "type": "date-picker",
  "name": "birthdate",
  "label": "出生日期",
  "format": "YYYY-MM-DD"
}
```

---

### 布局组件

用于构建页面布局的组件。

#### Container - 容器

带可选最大宽度的通用容器。

```json
{
  "type": "container",
  "maxWidth": "lg",
  "className": "py-8",
  "children": [...]
}
```

---

#### Grid - 网格布局

CSS 网格布局。

```json
{
  "type": "grid",
  "cols": 3,
  "gap": 4,
  "children": [
    { "type": "card", "title": "卡片 1" },
    { "type": "card", "title": "卡片 2" },
    { "type": "card", "title": "卡片 3" }
  ]
}
```

---

#### Card - 卡片

带可选标题和页脚的卡片容器。

```json
{
  "type": "card",
  "title": "卡片标题",
  "description": "卡片描述",
  "body": { ... },
  "footer": { ... }
}
```

---

#### Tabs - 选项卡

选项卡导航容器。

```json
{
  "type": "tabs",
  "defaultTab": "profile",
  "tabs": [
    {
      "id": "profile",
      "label": "个人资料",
      "content": { ... }
    },
    {
      "id": "settings",
      "label": "设置",
      "content": { ... }
    }
  ]
}
```

---

### 数据展示

用于展示数据和内容的组件。

#### Table - 表格

带排序和分页的数据表格。

```json
{
  "type": "table",
  "data": [
    { "id": 1, "name": "张三", "email": "zhang@example.com" },
    { "id": 2, "name": "李四", "email": "li@example.com" }
  ],
  "columns": [
    { "key": "name", "label": "姓名", "sortable": true },
    { "key": "email", "label": "邮箱" }
  ]
}
```

---

#### Badge - 徽章

用于标签和计数的小徽章。

```json
{
  "type": "badge",
  "label": "新",
  "variant": "default"
}
```

---

#### Avatar - 头像

用户头像组件。

```json
{
  "type": "avatar",
  "src": "https://example.com/avatar.jpg",
  "alt": "用户名",
  "fallback": "张"
}
```

---

### 反馈

用于用户反馈和通知的组件。

#### Alert - 警告

警告消息。

```json
{
  "type": "alert",
  "variant": "info",
  "title": "信息",
  "message": "这是一条信息消息。"
}
```

---

#### Dialog - 对话框

模态对话框。

```json
{
  "type": "dialog",
  "title": "确认操作",
  "description": "您确定要继续吗？",
  "content": { ... },
  "actions": [
    { "type": "button", "label": "取消", "variant": "outline" },
    { "type": "button", "label": "确认", "variant": "default" }
  ]
}
```

---

### 导航

用于导航和操作的组件。

#### Button - 按钮

按钮组件。

```json
{
  "type": "button",
  "label": "点击我",
  "variant": "default",
  "size": "md",
  "disabled": false
}
```

**属性：**
- `label` - 按钮文本
- `variant` - 按钮样式（default、destructive、outline、secondary、ghost、link）
- `size` - 按钮大小（sm、md、lg）
- `disabled` - 禁用状态
- `onClick` - 点击处理器

---

## 自定义

### 使用 Tailwind 类

所有组件都接受用于自定义样式的 `className`：

```json
{
  "type": "button",
  "label": "自定义按钮",
  "className": "bg-blue-500 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full"
}
```

### 自定义组件

使用您自己的组件覆盖内置组件：

```tsx
import { getComponentRegistry } from '@object-ui/react'
import { Button } from '@object-ui/components'

function CustomButton(props) {
  return (
    <Button
      {...props}
      className={`my-custom-class ${props.className || ''}`}
    />
  )
}

const registry = getComponentRegistry()
registry.register('button', CustomButton)
```

## 示例

### 登录表单

```tsx
const loginForm = {
  type: 'card',
  className: 'max-w-md mx-auto mt-8',
  title: '欢迎回来',
  description: '登录您的帐户',
  body: {
    type: 'flex',
    direction: 'column',
    gap: 4,
    children: [
      {
        type: 'input',
        name: 'email',
        label: '邮箱',
        type: 'email',
        placeholder: 'you@example.com',
        required: true
      },
      {
        type: 'input',
        name: 'password',
        label: '密码',
        type: 'password',
        required: true
      },
      {
        type: 'checkbox',
        name: 'remember',
        label: '记住我'
      },
      {
        type: 'button',
        label: '登录',
        variant: 'default',
        className: 'w-full'
      }
    ]
  }
}
```

### 数据表格

```tsx
const userTable = {
  type: 'table',
  data: [
    { id: 1, name: '张三', email: 'zhang@example.com', role: '管理员' },
    { id: 2, name: '李四', email: 'li@example.com', role: '用户' },
    { id: 3, name: '王五', email: 'wang@example.com', role: '用户' }
  ],
  columns: [
    { key: 'name', label: '姓名', sortable: true },
    { key: 'email', label: '邮箱' },
    { key: 'role', label: '角色', sortable: true }
  ],
  pagination: true,
  pageSize: 10
}
```

## 相关文档

- [组件注册表](./component-registry.md) - 注册组件
- [插件](./plugins.md) - 使用插件扩展
- [English Version](../../guide/components.md) - 完整英文文档
