# Object UI CLI 使用指南 / CLI User Guide

[English](#english) | [中文](#chinese)

---

<a name="chinese"></a>

## 中文文档

### 简介

Object UI CLI 是一个命令行工具，让您可以通过 JSON schema 文件快速构建和运行应用程序。

### 安装

```bash
# 全局安装
npm install -g @object-ui/cli

# 或使用 pnpm
pnpm add -g @object-ui/cli

# 或使用 npx（无需安装）
npx @object-ui/cli --help
```

### 快速开始

#### 1. 创建新应用

```bash
# 使用默认模板（dashboard）
objectui init my-app

# 使用特定模板
objectui init my-app --template form

# 在当前目录创建
objectui init . --template simple
```

**可用模板：**
- `dashboard` - 完整的仪表盘界面（默认）
- `form` - 表单示例
- `simple` - 简单的起始模板

#### 2. 启动开发服务器

```bash
# 进入应用目录
cd my-app

# 启动服务器
objectui serve app.schema.json

# 自定义端口
objectui serve app.schema.json --port 8080

# 指定主机
objectui serve app.schema.json --host 0.0.0.0
```

#### 3. 编辑 Schema

打开 `app.schema.json` 文件，修改 JSON 内容即可实时更新应用界面。

### 命令参考

#### `objectui init [name]`

创建新的 Object UI 应用。

**参数：**
- `[name]` - 应用名称（可选，默认：`my-app`）

**选项：**
- `-t, --template <template>` - 使用的模板：`simple`、`form` 或 `dashboard`（默认：`dashboard`）

**示例：**
```bash
objectui init blog --template dashboard
objectui init form-app --template form
objectui init . --template simple
```

#### `objectui serve [schema]`

启动开发服务器来渲染 JSON schema。

**参数：**
- `[schema]` - JSON schema 文件路径（可选，默认：`app.schema.json`）

**选项：**
- `-p, --port <port>` - 服务器端口（默认：`3000`）
- `-h, --host <host>` - 服务器主机（默认：`localhost`）

**示例：**
```bash
objectui serve
objectui serve my-schema.json
objectui serve app.schema.json --port 8080
objectui serve app.schema.json --host 0.0.0.0 --port 3001
```

### Schema 示例

#### 简单示例

```json
{
  "type": "div",
  "className": "min-h-screen flex items-center justify-center",
  "body": {
    "type": "card",
    "title": "欢迎使用 Object UI",
    "body": {
      "type": "text",
      "content": "开始构建您的应用吧！"
    }
  }
}
```

#### 表单示例

```json
{
  "type": "div",
  "className": "min-h-screen flex items-center justify-center p-4",
  "body": {
    "type": "card",
    "className": "w-full max-w-md",
    "title": "联系我们",
    "body": {
      "type": "div",
      "className": "p-6 space-y-4",
      "body": [
        {
          "type": "input",
          "label": "姓名",
          "placeholder": "请输入您的姓名"
        },
        {
          "type": "input",
          "label": "邮箱",
          "inputType": "email",
          "placeholder": "your@email.com"
        },
        {
          "type": "textarea",
          "label": "消息",
          "placeholder": "请输入您的消息"
        },
        {
          "type": "button",
          "label": "提交",
          "className": "w-full"
        }
      ]
    }
  }
}
```

### 常见问题

#### 1. 如何自定义样式？

Object UI 使用 Tailwind CSS，您可以在任何组件的 `className` 属性中添加 Tailwind 类：

```json
{
  "type": "button",
  "label": "按钮",
  "className": "bg-blue-500 hover:bg-blue-600 text-white"
}
```

#### 2. 如何使用数据绑定？

可以使用 `${expression}` 语法：

```json
{
  "type": "text",
  "content": "欢迎, ${user.name}!"
}
```

#### 3. 支持哪些组件？

查看完整组件列表：
- [组件文档](https://www.objectui.org/docs/api/components)
- [协议规范](https://www.objectui.org/docs/protocol/overview)

---

<a name="english"></a>

## English Documentation

### Introduction

Object UI CLI is a command-line tool that allows you to quickly build and run applications using JSON schema files.

### Installation

```bash
# Install globally
npm install -g @object-ui/cli

# Or using pnpm
pnpm add -g @object-ui/cli

# Or use with npx (no installation required)
npx @object-ui/cli --help
```

### Quick Start

#### 1. Create a New Application

```bash
# Use default template (dashboard)
objectui init my-app

# Use specific template
objectui init my-app --template form

# Create in current directory
objectui init . --template simple
```

**Available Templates:**
- `dashboard` - Complete dashboard interface (default)
- `form` - Form example
- `simple` - Simple starter template

#### 2. Start Development Server

```bash
# Navigate to app directory
cd my-app

# Start server
objectui serve app.schema.json

# Custom port
objectui serve app.schema.json --port 8080

# Specify host
objectui serve app.schema.json --host 0.0.0.0
```

#### 3. Edit Schema

Open the `app.schema.json` file and modify the JSON content to see real-time updates in your application.

### Command Reference

#### `objectui init [name]`

Create a new Object UI application.

**Arguments:**
- `[name]` - Application name (optional, default: `my-app`)

**Options:**
- `-t, --template <template>` - Template to use: `simple`, `form`, or `dashboard` (default: `dashboard`)

**Examples:**
```bash
objectui init blog --template dashboard
objectui init form-app --template form
objectui init . --template simple
```

#### `objectui serve [schema]`

Start a development server to render your JSON schema.

**Arguments:**
- `[schema]` - Path to JSON schema file (optional, default: `app.schema.json`)

**Options:**
- `-p, --port <port>` - Server port (default: `3000`)
- `-h, --host <host>` - Server host (default: `localhost`)

**Examples:**
```bash
objectui serve
objectui serve my-schema.json
objectui serve app.schema.json --port 8080
objectui serve app.schema.json --host 0.0.0.0 --port 3001
```

### Schema Examples

#### Simple Example

```json
{
  "type": "div",
  "className": "min-h-screen flex items-center justify-center",
  "body": {
    "type": "card",
    "title": "Welcome to Object UI",
    "body": {
      "type": "text",
      "content": "Start building your application!"
    }
  }
}
```

#### Form Example

```json
{
  "type": "div",
  "className": "min-h-screen flex items-center justify-center p-4",
  "body": {
    "type": "card",
    "className": "w-full max-w-md",
    "title": "Contact Us",
    "body": {
      "type": "div",
      "className": "p-6 space-y-4",
      "body": [
        {
          "type": "input",
          "label": "Name",
          "placeholder": "Enter your name"
        },
        {
          "type": "input",
          "label": "Email",
          "inputType": "email",
          "placeholder": "your@email.com"
        },
        {
          "type": "textarea",
          "label": "Message",
          "placeholder": "Enter your message"
        },
        {
          "type": "button",
          "label": "Submit",
          "className": "w-full"
        }
      ]
    }
  }
}
```

### FAQ

#### 1. How to customize styles?

Object UI uses Tailwind CSS. You can add Tailwind classes to any component's `className` property:

```json
{
  "type": "button",
  "label": "Button",
  "className": "bg-blue-500 hover:bg-blue-600 text-white"
}
```

#### 2. How to use data binding?

Use the `${expression}` syntax:

```json
{
  "type": "text",
  "content": "Welcome, ${user.name}!"
}
```

#### 3. What components are supported?

See the complete component list:
- [Component Documentation](https://www.objectui.org/docs/api/components)
- [Protocol Specification](https://www.objectui.org/docs/protocol/overview)

### Learn More

- [Official Website](https://www.objectui.org)
- [Documentation](https://www.objectui.org/docs)
- [GitHub Repository](https://github.com/objectql/objectui)
- [Examples](https://github.com/objectql/objectui/tree/main/examples)

### License

MIT
