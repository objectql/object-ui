# ObjectUI 与 ObjectStack Spec v0.7.1 对齐分析

## 执行摘要

本文档分析了 ObjectUI 与 ObjectStack 规范 v0.7.1 的对齐状态，识别了差距，并提供了实现完整协议兼容性的综合开发计划。

**当前对齐状态: ~80%**

### 核心发现

✅ **优势:**
- 核心数据类型和字段定义良好匹配
- 查询基础功能（select, filter, sort, pagination）已对齐
- 视图架构（grid, kanban, calendar）符合规范模式
- 数据适配器与 ObjectStack client v0.7.1 完全兼容

❌ **关键差距:**
- 窗口函数（row_number, rank, lag, lead）未实现
- 综合验证框架缺失（规范定义了9种验证类型，ObjectUI仅实现基础验证）
- Action 架构比规范简单得多
- 缺少异步验证支持

⚠️ **次要差距:**
- 缺少聚合函数：count_distinct, array_agg, string_agg
- 缺少视图类型：spreadsheet, gallery, timeline
- 缺少应用级权限声明
- 未实现 Join 执行策略提示

---

## 详细分析

### 1. 数据协议对比

#### 1.1 字段类型 ✅ **完全对齐**

ObjectUI 支持 37 种字段类型，完全覆盖并超越规范要求：

**基础字段:** text, textarea, number, boolean, date, datetime, time
**高级字段:** lookup, master_detail, formula, summary
**UI字段:** color, signature, qrcode, rating, slider
**企业字段:** vector (AI嵌入), grid (子表格)

**结论:** 字段类型覆盖率优秀，ObjectUI 的扩展（vector, grid）已被规范 v0.7.1 支持。

---

#### 1.2 查询架构 ⚠️ **部分对齐**

##### 已支持功能 ✅

| 功能 | ObjectUI | 规范 | 状态 |
|------|---------|------|------|
| SELECT 字段选择 | ✅ | ✅ | 完美 |
| WHERE 过滤 | ✅ | ✅ | 完美 |
| ORDER BY 排序 | ✅ | ✅ | 完美 |
| 分页 (limit/offset) | ✅ | ✅ | 完美 |
| JOIN 连接 | ✅ | ✅ | 完美 |
| GROUP BY 分组 | ✅ | ✅ | 完美 |
| 基础聚合 | count, sum, avg, min, max | + count_distinct, array_agg, string_agg | **差距: 缺少3个函数** |

##### 缺失功能 ❌

**1. 窗口函数 (关键差距)**

规范 v0.7.1 支持的窗口函数：
- 排名: `row_number`, `rank`, `dense_rank`, `percent_rank`
- 偏移: `lag`, `lead`
- 边界: `first_value`, `last_value`
- 聚合窗口: `sum`, `avg`, `count`, `min`, `max`

**影响:** 无法构建分析查询，如排名、累计总数、移动平均值。

**示例用例:**
```typescript
// 规范支持的查询（ObjectUI 当前不支持）
{
  object: 'orders',
  fields: ['customer_id', 'amount', 'order_date'],
  windows: [{
    function: 'row_number',
    alias: 'order_rank',
    partitionBy: ['customer_id'],
    orderBy: [{ field: 'amount', order: 'desc' }]
  }]
}
// SQL: SELECT *, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY amount DESC) as order_rank FROM orders
```

**2. Join 执行策略提示**
```typescript
type JoinStrategy = 'auto' | 'database' | 'hash' | 'loop';
```
**影响:** 跨数据源连接时，查询优化器无法接收性能提示。

**3. 增强聚合函数**
- `count_distinct`: 统计唯一值
- `array_agg`: 聚合为数组
- `string_agg`: 字符串连接

---

#### 1.3 过滤架构 ✅ **良好对齐**

ObjectUI 的过滤操作符是规范的**超集**：

**规范基础操作符:**
- 相等: `$eq`, `$ne`
- 比较: `$gt`, `$gte`, `$lt`, `$lte`
- 集合: `$in`, `$nin`, `$between`
- 字符串: `$contains`, `$startsWith`, `$endsWith`
- 空值: `$null`, `$exist`
- 逻辑: `$and`, `$or`, `$not`

**ObjectUI 扩展:**
- 日期特定: `date_equals`, `date_after`, `date_before`, `date_this_week` 等
- 搜索: `full_text_search`, `fuzzy_search`
- 查找: `lookup_in`, `lookup_not_in`

**建议:** ✅ 保留扩展，维护向后兼容性。

---

#### 1.4 验证架构 ❌ **重大差距**

| 验证类型 | ObjectUI | 规范 v0.7.1 | 优先级 |
|---------|---------|------------|--------|
| **脚本/公式** | 基础表达式验证 | ✅ ScriptValidationSchema | **高** |
| **唯一性** | 字段级唯一标志 | ✅ UniquenessValidationSchema (多字段、作用域、大小写敏感) | **高** |
| **状态机** | ❌ 未实现 | ✅ StateMachineValidationSchema | 中 |
| **格式** | 基础模式匹配 | ✅ FormatValidationSchema (正则、预定义模式) | 中 |
| **跨字段** | ❌ 有限 | ✅ CrossFieldValidationSchema | **高** |
| **JSON Schema** | ❌ 未实现 | ✅ JSONSchemaValidationSchema | 中 |
| **异步/远程** | ❌ 未实现 | ✅ AsyncValidationSchema | **高** |
| **自定义** | ✅ 自定义函数 | ✅ CustomValidationSchema | 正常 |
| **条件性** | ❌ 未实现 | ✅ ConditionalValidationSchema | 中 |

**当前 ObjectUI 实现:**
```typescript
// 仅字段级别的简单规则
interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'custom';
  value?: any;
  message?: string;
}
```

**规范 v0.7.1 实现:**
```typescript
// 对象级别的复杂验证规则
interface BaseValidation {
  name: string;
  active: boolean;
  events: ('insert' | 'update' | 'delete')[];
  severity: 'error' | 'warning' | 'info';
  message: string;
}

type ValidationRule = 
  | ScriptValidation      // 公式验证
  | UniquenessValidation  // 唯一性（多字段、作用域）
  | StateMachineValidation // 状态转换
  | CrossFieldValidation   // 跨字段依赖
  | AsyncValidation        // 远程端点验证
  | ConditionalValidation  // 条件验证
  | 等9种类型...
```

**影响:**
- ❌ 无法实现企业验证模式（状态机、异步验证）
- ❌ 无法跨多个字段进行依赖验证
- ❌ 无法使用远程验证端点
- ❌ 缺少严重级别（错误/警告/信息）
- ❌ 缺少事件生命周期钩子

---

### 2. UI 协议对比

#### 2.1 视图架构 ✅ **良好对齐**

| 视图类型 | ObjectUI | 规范 v0.7.1 | 状态 |
|----------|---------|-------------|------|
| 网格 (Grid) | ✅ | ✅ | 完美 |
| 看板 (Kanban) | ✅ | ✅ | 完美 |
| 日历 (Calendar) | ✅ | ✅ | 完美 |
| 甘特图 (Gantt) | ✅ | ✅ | 完美 |
| 地图 (Map) | ✅ | ✅ | 完美 |
| 表单 (Form) | ✅ | ❌ 不在规范 | 正常（ObjectUI扩展） |
| 图表 (Chart) | ✅ | ✅ | 完美 |
| 电子表格 (Spreadsheet) | ❌ 缺失 | ✅ | **差距** |
| 画廊 (Gallery) | ❌ 缺失 | ✅ | **差距** |
| 时间线 (Timeline) | ❌ 缺失 | ✅ | **差距** |

**数据源配置:** ✅ 完美对齐（支持 object/api/value 三种提供者）

---

#### 2.2 应用架构 ⚠️ **次要差距**

| 属性 | ObjectUI | 规范 v0.7.1 | 差距 |
|------|---------|------------|------|
| name, label, icon | ✅ | ✅ | - |
| branding | ✅ | ✅ | - |
| navigation | ✅ | ✅ | - |
| homePageId | ❌ 隐式 | ✅ 显式字符串 | **差距** |
| requiredPermissions | ❌ 缺失 | ✅ 字符串数组 | **差距** |

**影响:** 无法在元数据中声明应用级权限要求。

---

#### 2.3 Action 架构 ❌ **重大差距**

**ObjectUI 当前实现（简单）:**
```typescript
interface AppAction {
  type: 'button' | 'dropdown' | 'user';
  label?: string;
  icon?: string;
  onClick?: string;
  items?: AppAction[]; // 下拉菜单
}
```

**规范 v0.7.1 实现（全面）:**
```typescript
interface ActionSchema {
  name: string;  // 标识符
  label: string; // 显示标签
  icon?: string;
  
  // 显示位置
  locations?: Array<
    | 'list_toolbar'      // 列表工具栏（批量操作）
    | 'list_item'         // 行级操作
    | 'record_header'     // 详情页头部
    | 'record_more'       // 详情"更多"菜单
    | 'record_related'    // 相关列表
    | 'global_nav'        // 顶部导航
  >;
  
  // 视觉表现
  component?: 'action:button' | 'action:icon' | 'action:menu' | 'action:group';
  
  // 行为类型
  type: 'script' | 'url' | 'modal' | 'flow' | 'api';
  execute?: string;
  
  // 用户输入（支持40+字段类型）
  params?: ActionParam[];
  
  // 反馈
  confirmText?: string;      // 确认对话框
  successMessage?: string;   // 成功消息
  refreshAfter?: boolean;    // 自动刷新
  
  // 条件
  visible?: string;  // 可见性表达式
  enabled?: string;  // 启用状态表达式
}
```

**关键缺失功能:**
1. ❌ **locations**: 无法指定操作出现位置
2. ❌ **params**: 无结构化参数收集
3. ❌ **confirmText**: 无内置确认对话框
4. ❌ **successMessage**: 无自动成功反馈
5. ❌ **refreshAfter**: 无自动数据刷新
6. ❌ **visible**: 无条件可见性表达式

**影响:** 必须手动实现确认、反馈、刷新逻辑，无法声明式构建操作按钮。

---

## 开发计划

### 优先级矩阵

| 优先级 | 任务 | 影响 | 工作量 | 涉及包 |
|--------|-----|------|--------|--------|
| **P0** | 窗口函数 | 企业分析 | 高 | types, core |
| **P0** | 验证框架 | 数据完整性 | 高 | types, core, react |
| **P0** | Action 架构增强 | 用户体验 | 中 | types, react, components |
| **P1** | 异步验证 | 远程验证 | 中 | core, react |
| **P1** | 增强聚合 | 分析能力 | 低 | types, core |
| **P2** | 视图类型 | UI 完整性 | 中 | types, plugins |
| **P2** | 应用权限 | 安全性 | 低 | types, react |
| **P3** | Join 策略 | 性能 | 低 | types, core |

---

### 第一阶段: 关键差距 (第1-2周)

#### 任务 1.1: 窗口函数支持

**要修改的文件:**
- `packages/types/src/data-protocol.ts`
- `packages/core/src/query/query-ast.ts`

**实现:**
```typescript
// 添加到 data-protocol.ts
export type WindowFunction = 
  | 'row_number' | 'rank' | 'dense_rank' | 'percent_rank'
  | 'lag' | 'lead' | 'first_value' | 'last_value'
  | 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface WindowNode {
  function: WindowFunction;
  field?: string;
  alias: string;
  partitionBy?: string[];
  orderBy?: SortField[];
}

export interface QuerySchema {
  // ... 现有字段
  windows?: WindowNode[];
}
```

---

#### 任务 1.2: 综合验证框架

**要修改的文件:**
- `packages/types/src/data-protocol.ts` - 添加验证类型定义
- `packages/core/src/validation/validation-engine.ts` - 扩展验证引擎
- `packages/core/src/validation/validators/` - 新建验证器目录

**实现:**
```typescript
// 基础验证接口
export interface BaseValidation {
  name: string;
  label?: string;
  description?: string;
  active: boolean;
  events: Array<'insert' | 'update' | 'delete'>;
  severity: 'error' | 'warning' | 'info';
  message: string;
  tags?: string[];
}

// 脚本验证
export interface ScriptValidation extends BaseValidation {
  type: 'script';
  condition: string; // 表达式
}

// 唯一性验证（多字段）
export interface UniquenessValidation extends BaseValidation {
  type: 'unique';
  fields: string[];
  scope?: string; // 作用域表达式
  caseSensitive?: boolean;
}

// 状态机验证
export interface StateMachineValidation extends BaseValidation {
  type: 'state_machine';
  stateField: string;
  transitions: Array<{
    from: string | string[];
    to: string;
    condition?: string;
  }>;
}

// 异步验证
export interface AsyncValidation extends BaseValidation {
  type: 'async';
  endpoint: string;
  method?: 'GET' | 'POST';
  debounce?: number;
  cache?: { enabled: boolean; ttl?: number };
}

// 9种验证类型的联合类型
export type ValidationRule = 
  | ScriptValidation
  | UniquenessValidation
  | StateMachineValidation
  | CrossFieldValidation
  | AsyncValidation
  | ConditionalValidation
  | FormatValidation
  | JSONSchemaValidation
  | CustomValidation;
```

---

#### 任务 1.3: Action 架构增强

**要修改的文件:**
- `packages/types/src/ui-action.ts` - 新文件，完整 Action 定义
- `packages/react/src/components/actions/ActionButton.tsx` - 重写

**实现:**
```typescript
// packages/types/src/ui-action.ts
export type ActionLocation = 
  | 'list_toolbar'      // 列表工具栏
  | 'list_item'         // 行级操作
  | 'record_header'     // 详情页头部
  | 'record_more'       // 更多菜单
  | 'record_related'    // 相关列表
  | 'global_nav';       // 全局导航

export interface ActionParam {
  name: string;
  label: string;
  type: FieldType;  // 支持40+字段类型
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

export interface ActionSchema {
  name: string;        // snake_case 标识符
  label: string;
  icon?: string;
  
  locations?: ActionLocation[];
  component?: 'action:button' | 'action:icon' | 'action:menu';
  
  type: 'script' | 'url' | 'modal' | 'flow' | 'api';
  execute?: string;
  
  params?: ActionParam[];
  
  confirmText?: string;
  successMessage?: string;
  refreshAfter?: boolean;
  
  visible?: string;  // 表达式
  enabled?: string;  // 表达式
}
```

**React 组件:**
```typescript
// packages/react/src/components/actions/ActionButton.tsx
export function ActionButton({ action, context }: ActionButtonProps) {
  const handleClick = async () => {
    // 1. 检查可见性条件
    if (!evaluateExpression(action.visible, context)) return;
    
    // 2. 显示确认对话框
    if (action.confirmText && !await confirm(action.confirmText)) return;
    
    // 3. 收集参数
    const params = await collectParams(action.params);
    
    // 4. 执行操作
    await executeAction(action, params);
    
    // 5. 显示成功消息
    if (action.successMessage) {
      toast.success(action.successMessage);
    }
    
    // 6. 刷新数据
    if (action.refreshAfter) {
      refreshData();
    }
  };
  
  return <Button onClick={handleClick} />;
}
```

---

### 第二阶段: 高优先级 (第3-4周)

#### 任务 2.1: 增强聚合函数
```typescript
export type AggregationFunction = 
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count_distinct'  // 新增
  | 'array_agg'       // 新增
  | 'string_agg';     // 新增
```

#### 任务 2.2: 应用级权限
```typescript
export interface AppSchema {
  // ... 现有字段
  homePageId?: string;
  requiredPermissions?: string[];
}
```

---

### 第三阶段: 中等优先级 (第5-6周)

#### 任务 3.1: 缺失的视图类型
**新建包:**
- `packages/plugin-spreadsheet/` - 电子表格视图
- `packages/plugin-gallery/` - 画廊视图
- `packages/plugin-timeline/` - 时间线视图

#### 任务 3.2: Join 执行策略
```typescript
export type JoinStrategy = 'auto' | 'database' | 'hash' | 'loop';

export interface JoinConfig {
  // ... 现有字段
  strategy?: JoinStrategy;
}
```

---

## 测试策略

### 单元测试
- [ ] 窗口函数 AST 构建
- [ ] 所有9种验证类型
- [ ] Action 参数收集
- [ ] 聚合函数（count_distinct, array_agg, string_agg）

### 集成测试
- [ ] ValidationEngine 与 ObjectStack 后端集成
- [ ] Action 执行与参数收集
- [ ] 实际查询中的窗口函数

### E2E 测试
- [ ] 完整 CRUD 流程与验证
- [ ] 带确认的 Action 流程
- [ ] 报表中的窗口函数

---

## 迁移指南

### 对现有用户

#### Actions 升级
```typescript
// 旧版 (v0.3.x)
const action: AppAction = {
  type: 'button',
  label: '审批',
  onClick: 'approveRecord'
};

// 新版 (v0.4.x)
const action: ActionSchema = {
  name: 'approve_record',
  label: '审批',
  type: 'script',
  execute: 'approveRecord',
  locations: ['record_header'],
  confirmText: '确定要审批吗？',
  successMessage: '记录已审批',
  refreshAfter: true
};
```

#### Validation 升级
```typescript
// 旧版（仅字段级）
const field: FieldMetadata = {
  name: 'email',
  type: 'email',
  required: true,
  unique: true
};

// 新版（对象级验证规则）
const object: ObjectSchemaMetadata = {
  fields: {
    email: { name: 'email', type: 'email' }
  },
  validations: [
    {
      name: 'email_required',
      type: 'script',
      condition: 'email != null && email.length > 0',
      message: '邮箱是必填项',
      events: ['insert', 'update'],
      severity: 'error'
    },
    {
      name: 'unique_email',
      type: 'unique',
      fields: ['email'],
      message: '邮箱必须唯一',
      events: ['insert', 'update'],
      severity: 'error'
    }
  ]
};
```

---

## 版本兼容性

| ObjectUI 版本 | ObjectStack Spec | 状态 |
|--------------|-----------------|------|
| v0.3.x | v0.7.1 | ⚠️ 部分（80%） |
| v0.4.x (目标) | v0.7.1 | ✅ 完全（95%+） |

---

## 成功指标

完全对齐后：
- ✅ 与 @objectstack/spec v0.7.1 100% 类型兼容
- ✅ 支持所有9种验证类型
- ✅ 窗口函数用于分析
- ✅ 声明式 Action 系统（带参数）
- ✅ 增强聚合函数
- ✅ 缺失的视图类型（spreadsheet, gallery, timeline）
- ✅ 新功能 90%+ 测试覆盖率

---

## 参考资料

- ObjectStack Spec: https://www.npmjs.com/package/@objectstack/spec
- ObjectStack Client: https://www.npmjs.com/package/@objectstack/client
- ObjectUI 仓库: https://github.com/objectstack-ai/objectui
- 第三阶段实现: [PHASE3_IMPLEMENTATION.md](./PHASE3_IMPLEMENTATION.md)

---

**最后更新:** 2026-01-31  
**状态:** 准备实施  
**预计完成:** 6周
