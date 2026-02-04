# ObjectUI Functional Design Zod Schemas

**版本 / Version:** 1.0  
**创建日期 / Created:** 2026年2月4日 / February 4, 2026  
**基于 / Based On:** FUNCTIONAL_DESIGN.md Component Specifications

---

## 📋 概述 / Overview

本文档包含了基于 `FUNCTIONAL_DESIGN.md` 文档中定义的所有组件的 Zod 验证模式。这些模式提供了运行时类型验证和 TypeScript 类型推断。

This document contains Zod validation schemas for all components defined in `FUNCTIONAL_DESIGN.md`. These schemas provide runtime type validation and TypeScript type inference.

---

## 🎯 用途 / Purpose

### 运行时验证 / Runtime Validation
```typescript
import { EnhancedButtonSchema } from '@object-ui/types/zod';

const buttonConfig = {
  type: 'button',
  text: 'Click Me',
  variant: 'default',
  size: 'default',
};

// 验证配置 / Validate configuration
const result = EnhancedButtonSchema.safeParse(buttonConfig);

if (result.success) {
  console.log('✅ Valid button config:', result.data);
} else {
  console.error('❌ Validation errors:', result.error.errors);
}
```

### 类型推断 / Type Inference
```typescript
import { z } from 'zod';
import { EnhancedButtonSchema } from '@object-ui/types/zod';

// 自动推断 TypeScript 类型 / Automatically infer TypeScript types
type ButtonConfig = z.infer<typeof EnhancedButtonSchema>;

const button: ButtonConfig = {
  type: 'button',
  text: 'Submit',
  variant: 'default',
  loading: false,
};
```

### 表单验证 / Form Validation
```typescript
import { FormSchema } from '@object-ui/types/zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function MyForm() {
  const form = useForm({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      fields: [],
      layout: 'vertical',
    },
  });
  
  // ... form implementation
}
```

---

## 📦 组件分类 / Component Categories

### 1. 基础组件 / Foundation Components (5)

| Schema | Description | Example |
|--------|-------------|---------|
| `FDTextSchema` | Text display with formatting | `{ type: 'text', value: 'Hello', size: 'lg' }` |
| `EnhancedButtonSchema` | Enhanced button with variants | `{ type: 'button', text: 'Click', variant: 'default' }` |
| `FDIconSchema` | Icon display | `{ type: 'icon', name: 'Menu', size: 'base' }` |
| `FDImageSchema` | Image with lazy loading | `{ type: 'image', src: '/img.jpg', alt: 'Photo' }` |
| `FDSeparatorSchema` | Visual separator | `{ type: 'separator', orientation: 'horizontal' }` |

**示例 / Example:**
```typescript
import { FDTextSchema } from '@object-ui/types/zod';

const textConfig = FDTextSchema.parse({
  type: 'text',
  value: 'Welcome to ObjectUI',
  size: '2xl',
  weight: 'bold',
  align: 'center',
  color: 'text-primary-600',
});
```

### 2. 布局组件 / Layout Components (6)

| Schema | Description | Example |
|--------|-------------|---------|
| `FDContainerSchema` | Responsive container | `{ type: 'container', maxWidth: 'xl', children: [] }` |
| `FDFlexSchema` | Flexbox layout | `{ type: 'flex', direction: 'row', gap: 4 }` |
| `FDGridSchema` | CSS Grid layout | `{ type: 'grid', columns: 3, gap: 4 }` |
| `FDCardSchema` | Card container | `{ type: 'card', title: 'Title', variant: 'default' }` |
| `FDTabsSchema` | Tabbed interface | `{ type: 'tabs', items: [], variant: 'default' }` |

**响应式网格示例 / Responsive Grid Example:**
```typescript
import { FDGridSchema } from '@object-ui/types/zod';

const gridConfig = FDGridSchema.parse({
  type: 'grid',
  columns: {
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4,
  },
  gap: 6,
  children: [
    { type: 'card', title: 'Card 1' },
    { type: 'card', title: 'Card 2' },
    { type: 'card', title: 'Card 3' },
  ],
});
```

### 3. 表单组件 / Form Components (10)

| Schema | Description | Features |
|--------|-------------|----------|
| `EnhancedInputSchema` | Enhanced text input | Validation, prefix/suffix slots |
| `FDTextareaSchema` | Multi-line input | Auto-resize, character count |
| `EnhancedSelectSchema` | Enhanced select | Search, multi-select, async options |
| `FDCheckboxSchema` | Checkbox | Indeterminate state |
| `FDRadioGroupSchema` | Radio group | Card variant |
| `FDSwitchSchema` | Toggle switch | Loading state |
| `FDSliderSchema` | Range slider | Marks, tooltip |
| `FDDatePickerSchema` | Date picker | Range, time, locale |
| `FDFileUploadSchema` | File upload | Drag-drop, preview, progress |
| `FDFormSchema` | Complete form | Validation, responsive layout |

**增强型输入示例 / Enhanced Input Example:**
```typescript
import { EnhancedInputSchema } from '@object-ui/types/zod';

const inputConfig = EnhancedInputSchema.parse({
  type: 'input',
  name: 'email',
  placeholder: 'Enter your email',
  inputType: 'email',
  validation: [
    { type: 'required', message: 'Email is required' },
    { type: 'email', message: 'Invalid email format' },
  ],
  prefix: { type: 'icon', name: 'Mail' },
  size: 'default',
});
```

**表单配置示例 / Form Configuration Example:**
```typescript
import { FDFormSchema } from '@object-ui/types/zod';

const formConfig = FDFormSchema.parse({
  type: 'form',
  layout: 'vertical',
  columns: { md: 2 },
  fields: [
    {
      name: 'firstName',
      label: 'First Name',
      required: true,
      component: {
        type: 'input',
        inputType: 'text',
      },
    },
    {
      name: 'email',
      label: 'Email',
      required: true,
      component: {
        type: 'input',
        inputType: 'email',
      },
      validation: [
        { type: 'email' },
      ],
    },
  ],
  submitText: 'Submit',
  validateOnChange: true,
});
```

### 4. 数据展示组件 / Data Display Components (7)

| Schema | Description | Features |
|--------|-------------|----------|
| `FDTableSchema` | Data table | Sorting, filtering, pagination, selection |
| `FDListSchema` | Vertical list | Virtual scrolling, infinite scroll |
| `FDBadgeSchema` | Status badge | Variants, dot mode |
| `FDAvatarSchema` | User avatar | Image, text, icon fallback |
| `FDStatisticSchema` | Numeric display | Trends, count-up animation |
| `FDAlertSchema` | Alert message | Variants, closable, actions |
| `FDTimelineSchema` | Timeline | Events, statuses |

**高级表格示例 / Advanced Table Example:**
```typescript
import { FDTableSchema } from '@object-ui/types/zod';

const tableConfig = FDTableSchema.parse({
  type: 'table',
  columns: [
    {
      key: 'name',
      title: 'Name',
      dataIndex: 'name',
      sortable: true,
      filterable: true,
      filterType: 'text',
    },
    {
      key: 'age',
      title: 'Age',
      dataIndex: 'age',
      width: 100,
      sortable: true,
      align: 'center',
    },
    {
      key: 'email',
      title: 'Email',
      dataIndex: 'email',
      ellipsis: true,
    },
  ],
  data: [
    { id: 1, name: 'John', age: 30, email: 'john@example.com' },
    { id: 2, name: 'Jane', age: 25, email: 'jane@example.com' },
  ],
  selectable: 'multiple',
  pagination: {
    pageSize: 10,
    showTotal: true,
  },
  striped: true,
  hoverable: true,
});
```

### 5. 反馈组件 / Feedback Components (5)

| Schema | Description | Features |
|--------|-------------|----------|
| `FDToastSchema` | Toast notification | Auto-close, variants, positions |
| `FDProgressSchema` | Progress indicator | Linear/circular, indeterminate |
| `FDSpinnerSchema` | Loading spinner | Variants, sizes |
| `FDSkeletonSchema` | Loading placeholder | Text/circular/rectangular |
| `FDEmptySchema` | Empty state | Custom image, actions |

**Toast 配置 / Toast Configuration:**
```typescript
import { FDToastSchema } from '@object-ui/types/zod';

const toastConfig = FDToastSchema.parse({
  type: 'toast',
  title: 'Success',
  description: 'Your changes have been saved',
  variant: 'success',
  duration: 3000,
  position: 'top-right',
  closable: true,
});
```

### 6. 折叠组件 / Disclosure Components (3)

| Schema | Description | Features |
|--------|-------------|----------|
| `FDAccordionSchema` | Accordion panels | Single/multiple expansion |
| `FDCollapsibleSchema` | Collapsible panel | Controlled state |
| `FDToggleGroupSchema` | Toggle group | Single/multiple selection |

### 7. 浮层组件 / Overlay Components (5)

| Schema | Description | Features |
|--------|-------------|----------|
| `FDDialogSchema` | Modal dialog | Sizes, draggable, close controls |
| `FDSheetSchema` | Side drawer | 4 directions, gestures |
| `FDPopoverSchema` | Popup card | Smart positioning, triggers |
| `FDTooltipSchema` | Tooltip | Delay, positioning |
| `FDDropdownMenuSchema` | Dropdown menu | Nested items, shortcuts |

**对话框示例 / Dialog Example:**
```typescript
import { FDDialogSchema } from '@object-ui/types/zod';

const dialogConfig = FDDialogSchema.parse({
  type: 'dialog',
  title: 'Confirm Delete',
  description: 'Are you sure you want to delete this item?',
  size: 'default',
  closable: true,
  closeOnEscape: true,
  content: {
    type: 'text',
    value: 'This action cannot be undone.',
  },
  footer: [
    {
      type: 'button',
      text: 'Cancel',
      variant: 'outline',
    },
    {
      type: 'button',
      text: 'Delete',
      variant: 'destructive',
    },
  ],
});
```

### 8. 导航组件 / Navigation Components (4)

| Schema | Description | Features |
|--------|-------------|----------|
| `BreadcrumbSchema` | Breadcrumb trail | Icons, custom separator |
| `FDPaginationSchema` | Page navigation | Size changer, quick jumper |
| `FDSidebarSchema` | Sidebar menu | Collapse, themes, nested |
| `FDHeaderBarSchema` | Header bar | Logo, nav, actions, sticky |

### 9. 复杂组件 / Complex Components (4)

| Schema | Description | Features |
|--------|-------------|----------|
| `FDDashboardSchema` | Dashboard | Drag-drop, resize, responsive |
| `FDKanbanSchema` | Kanban board | Drag cards, column limits |
| `FDCalendarViewSchema` | Calendar | Month/week/day, events, editable |
| `FDChatbotSchema` | Chat interface | Streaming, markdown, file upload |

**仪表板配置 / Dashboard Configuration:**
```typescript
import { FDDashboardSchema } from '@object-ui/types/zod';

const dashboardConfig = FDDashboardSchema.parse({
  type: 'dashboard',
  widgets: [
    {
      id: 'widget-1',
      title: 'Revenue',
      type: 'statistic',
      config: {
        value: 12345,
        trend: 'up',
        trendValue: '+12%',
      },
    },
    {
      id: 'widget-2',
      title: 'Users',
      type: 'chart',
      config: {
        chartType: 'line',
        data: [],
      },
      refreshInterval: 30000,
    },
  ],
  layout: [
    { i: 'widget-1', x: 0, y: 0, w: 6, h: 4 },
    { i: 'widget-2', x: 6, y: 0, w: 6, h: 4 },
  ],
  cols: { lg: 12, md: 12, sm: 6 },
  rowHeight: 60,
  editable: true,
});
```

### 10. 业务组件 / Business Components (3)

| Schema | Description | Features |
|--------|-------------|----------|
| `FDObjectGridSchema` | ObjectQL grid | CRUD, filters, bulk actions |
| `FDObjectFormSchema` | ObjectQL form | Field mapping, validation |
| `FDListViewSchema` | List view | View switching, grouping |

**ObjectGrid 示例 / ObjectGrid Example:**
```typescript
import { FDObjectGridSchema } from '@object-ui/types/zod';

const gridConfig = FDObjectGridSchema.parse({
  type: 'object-grid',
  objectName: 'account',
  columns: [
    { field: 'name', label: 'Account Name', sortable: true },
    { field: 'industry', label: 'Industry', filterable: true },
    { field: 'revenue', label: 'Revenue', type: 'currency' },
  ],
  selectable: true,
  searchable: true,
  toolbar: {
    showCreate: true,
    showDelete: true,
    showExport: true,
  },
  filters: [
    { field: 'status', operator: 'eq', value: 'active' },
  ],
});
```

---

## 🔧 高级用法 / Advanced Usage

### 1. 自定义验证 / Custom Validation

```typescript
import { z } from 'zod';
import { EnhancedInputSchema } from '@object-ui/types/zod';

// 扩展现有模式 / Extend existing schema
const CustomInputSchema = EnhancedInputSchema.extend({
  // 添加自定义字段 / Add custom fields
  customField: z.string().optional(),
}).refine(
  (data) => {
    // 自定义验证逻辑 / Custom validation logic
    if (data.inputType === 'email' && !data.validation?.some(v => v.type === 'email')) {
      return false;
    }
    return true;
  },
  {
    message: 'Email input must have email validation',
  }
);
```

### 2. 条件验证 / Conditional Validation

```typescript
import { z } from 'zod';

const ConditionalFormSchema = z.object({
  type: z.literal('form'),
  fields: z.array(z.any()),
  submitOnEnter: z.boolean().optional(),
}).refine(
  (data) => {
    // 如果有文件上传字段,禁用 Enter 提交
    // Disable Enter submit if there's a file upload field
    const hasFileUpload = data.fields.some(f => f.component?.type === 'file-upload');
    if (hasFileUpload && data.submitOnEnter) {
      return false;
    }
    return true;
  },
  {
    message: 'Cannot use submitOnEnter with file upload fields',
    path: ['submitOnEnter'],
  }
);
```

### 3. 部分验证 / Partial Validation

```typescript
import { EnhancedButtonSchema } from '@object-ui/types/zod';

// 创建部分模式用于更新 / Create partial schema for updates
const PartialButtonSchema = EnhancedButtonSchema.partial();

// 只验证提供的字段 / Only validate provided fields
const updateData = PartialButtonSchema.parse({
  loading: true,
  disabled: false,
});
```

### 4. 批量验证 / Batch Validation

```typescript
import { CompleteFunctionalDesignSchema } from '@object-ui/types/zod';

const components = [
  { type: 'button', text: 'Click' },
  { type: 'input', name: 'email' },
  { type: 'card', title: 'Card' },
];

// 验证所有组件 / Validate all components
const validatedComponents = components.map(comp => {
  const result = CompleteFunctionalDesignSchema.safeParse(comp);
  if (!result.success) {
    console.error(`Invalid component:`, comp, result.error);
    return null;
  }
  return result.data;
}).filter(Boolean);
```

---

## 📊 验证错误处理 / Validation Error Handling

### 错误格式 / Error Format

```typescript
import { EnhancedButtonSchema } from '@object-ui/types/zod';

const result = EnhancedButtonSchema.safeParse({
  type: 'button',
  variant: 'invalid-variant', // ❌ 无效值
});

if (!result.success) {
  console.error('Validation errors:', result.error.errors);
  // [
  //   {
  //     code: 'invalid_enum_value',
  //     options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
  //     path: ['variant'],
  //     message: "Invalid enum value. Expected 'default' | 'destructive' | ...",
  //   }
  // ]
}
```

### 友好的错误消息 / Friendly Error Messages

```typescript
import { ZodError } from 'zod';

function formatZodError(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  
  error.errors.forEach(err => {
    const path = err.path.join('.');
    fieldErrors[path] = err.message;
  });
  
  return fieldErrors;
}

// 使用 / Usage
const result = EnhancedButtonSchema.safeParse(invalidData);
if (!result.success) {
  const errors = formatZodError(result.error);
  console.log(errors);
  // { "variant": "Invalid enum value...", "size": "Invalid enum value..." }
}
```

---

## 🎯 最佳实践 / Best Practices

### 1. 在组件注册时验证 / Validate During Component Registration

```typescript
import { ComponentRegistry } from '@object-ui/core';
import { EnhancedButtonSchema } from '@object-ui/types/zod';

ComponentRegistry.register('button', ButtonComponent, {
  validate: (schema) => {
    return EnhancedButtonSchema.safeParse(schema);
  },
});
```

### 2. 在运行时验证用户输入 / Validate User Input at Runtime

```typescript
import { FDFormSchema } from '@object-ui/types/zod';

function validateFormConfig(userConfig: unknown) {
  const result = FDFormSchema.safeParse(userConfig);
  
  if (!result.success) {
    throw new Error(`Invalid form configuration: ${result.error.message}`);
  }
  
  return result.data; // TypeScript 类型安全 / Type-safe
}
```

### 3. 结合表单库使用 / Use with Form Libraries

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FDFormSchema } from '@object-ui/types/zod';

function FormBuilder() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(FDFormSchema),
  });
  
  const onSubmit = (data: z.infer<typeof FDFormSchema>) => {
    console.log('Valid form config:', data);
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* form fields */}
    </form>
  );
}
```

### 4. 生成 JSON Schema / Generate JSON Schema

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';
import { EnhancedButtonSchema } from '@object-ui/types/zod';

const jsonSchema = zodToJsonSchema(EnhancedButtonSchema, 'ButtonSchema');

console.log(JSON.stringify(jsonSchema, null, 2));
// 可用于 API 文档、表单生成等
// Can be used for API docs, form generation, etc.
```

---

## 📝 总结 / Summary

所有 50+ 组件的 Zod 模式已创建完成，涵盖:

All 50+ component Zod schemas have been created, covering:

- ✅ **基础组件** (5): Text, Button, Icon, Image, Separator
- ✅ **布局组件** (6): Container, Flex, Grid, Card, Tabs, etc.
- ✅ **表单组件** (10): Input, Select, DatePicker, FileUpload, Form, etc.
- ✅ **数据展示** (7): Table, List, Badge, Avatar, Timeline, etc.
- ✅ **反馈组件** (5): Toast, Progress, Spinner, Skeleton, Empty
- ✅ **折叠组件** (3): Accordion, Collapsible, ToggleGroup
- ✅ **浮层组件** (5): Dialog, Sheet, Popover, Tooltip, DropdownMenu
- ✅ **导航组件** (4): Breadcrumb, Pagination, Sidebar, HeaderBar
- ✅ **复杂组件** (4): Dashboard, Kanban, Calendar, Chatbot
- ✅ **业务组件** (3): ObjectGrid, ObjectForm, ListView

**总计: 52 个组件模式 / Total: 52 Component Schemas**

---

## 🔗 相关链接 / Related Links

- [FUNCTIONAL_DESIGN.md](../../../../FUNCTIONAL_DESIGN.md) - 组件功能设计文档
- [Zod Documentation](https://zod.dev) - Zod 官方文档
- [@object-ui/types](../../README.md) - 类型定义文档

---

**文档维护 / Document Maintenance**  
本文档随 Zod 模式更新而更新。如有疑问或建议，请提交 Issue。

This document is updated alongside the Zod schemas. For questions or suggestions, please submit an issue.
