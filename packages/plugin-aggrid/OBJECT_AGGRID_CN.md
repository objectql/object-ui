# ObjectAgGrid - 元数据驱动的数据网格

ObjectAgGrid 是基于 AG Grid 的元数据驱动数据网格组件，通过 `@objectstack/client` 自动获取对象元数据和数据，支持所有字段类型的自动渲染和格式化。

## 主要特性

- ✅ **自动元数据获取**：从 ObjectStack 后端自动获取对象架构
- ✅ **自动数据加载**：支持分页、过滤和排序的数据获取
- ✅ **全字段类型支持**：支持所有 ObjectUI 字段类型，包括基础类型、高级类型和复杂类型
- ✅ **零列配置**：根据元数据自动生成列定义
- ✅ **内联编辑**：支持单元格编辑并自动保存到后端
- ✅ **选择性显示**：可选择只显示特定字段
- ✅ **CSV导出**：内置数据导出功能
- ✅ **完全类型安全**：TypeScript 类型定义完整

## 安装

```bash
pnpm add @object-ui/plugin-aggrid @object-ui/data-objectstack ag-grid-community ag-grid-react
```

## 基础用法

### 1. 创建数据源

```typescript
import { ObjectStackAdapter } from '@object-ui/data-objectstack';

const dataSource = new ObjectStackAdapter({
  baseUrl: 'https://api.example.com',
  token: 'your-api-token'
});
```

### 2. 使用 ObjectAgGrid

```typescript
import '@object-ui/plugin-aggrid';

const schema = {
  type: 'object-aggrid',
  objectName: 'contacts',     // 要获取的对象名称
  dataSource: dataSource,      // ObjectStack 数据源
  pagination: true,
  pageSize: 20,
  theme: 'quartz',
  height: 600
};

// 在 SchemaRenderer 中使用
<SchemaRenderer schema={schema} />
```

## 支持的字段类型

ObjectAgGrid 自动为所有字段类型应用适当的格式化器和单元格渲染器：

### 基础类型
- **text, textarea, markdown, html**: 普通文本显示
- **number**: 数字格式化（可选精度）
- **boolean**: 显示为 ✓ Yes / ✗ No
- **date**: 本地化日期格式
- **datetime**: 本地化日期时间格式
- **time**: 时间显示

### 高级类型
- **currency**: 货币格式化（例如：$1,234.56）
  ```typescript
  { type: 'currency', currency: 'USD', precision: 2 }
  // 渲染为: $1,234.56
  ```

- **percent**: 百分比格式化（例如：45.5%）
  ```typescript
  { type: 'percent', precision: 1 }
  // 渲染为: 45.5%
  ```

- **email**: 可点击的邮件链接
  ```typescript
  { type: 'email' }
  // 渲染为: <a href="mailto:user@example.com">user@example.com</a>
  ```

- **phone**: 可点击的电话链接
  ```typescript
  { type: 'phone' }
  // 渲染为: <a href="tel:+1-555-0101">+1-555-0101</a>
  ```

- **url**: 可点击的网址链接
  ```typescript
  { type: 'url' }
  // 渲染为: <a href="https://example.com" target="_blank">https://example.com</a>
  ```

### 选择和查找类型
- **select**: 显示选项标签
  ```typescript
  { 
    type: 'select', 
    options: [
      { label: '激活', value: 'active' },
      { label: '停用', value: 'inactive' }
    ]
  }
  ```

- **lookup, master_detail**: 显示关联对象的名称或标签
  ```typescript
  { type: 'lookup', reference_to: 'accounts' }
  ```

### 可视化类型
- **color**: 带颜色色块的显示
  ```typescript
  { type: 'color' }
  // 渲染为: [色块] #FF5733
  ```

- **rating**: 星级评分
  ```typescript
  { type: 'rating', max: 5 }
  // 渲染为: ⭐⭐⭐⭐⭐
  ```

- **image**: 缩略图显示
  ```typescript
  { type: 'image' }
  // 渲染为 40x40px 图片
  ```

- **avatar**: 圆形头像
  ```typescript
  { type: 'avatar' }
  // 渲染为 32x32px 圆形头像
  ```

### 高级字段类型
- **formula**: 只读计算字段
- **summary**: 汇总/汇总字段
- **auto_number**: 自动编号字段
- **user, owner**: 用户字段
- **file**: 文件字段

## Schema API

```typescript
interface ObjectAgGridSchema {
  // 必需
  type: 'object-aggrid';
  objectName: string;              // 对象名称
  dataSource: DataSource;          // ObjectStack 数据源实例
  
  // 可选字段配置
  fieldNames?: string[];           // 只显示这些字段（默认：全部）
  fields?: FieldMetadata[];        // 覆盖字段元数据
  
  // 查询参数
  filters?: Record<string, any>;   // 查询过滤器
  sort?: Record<string, 'asc' | 'desc'>; // 排序
  pageSize?: number;               // 每页行数（默认：10）
  
  // 显示选项（与 aggrid 相同）
  pagination?: boolean;            // 启用分页（默认：true）
  theme?: string;                  // 网格主题（默认：'quartz'）
  height?: number | string;        // 网格高度（默认：500）
  
  // 编辑
  editable?: boolean;              // 启用内联编辑（自动保存到后端）
  
  // 导出、状态栏、回调等（与 aggrid 相同）
  exportConfig?: ExportConfig;
  statusBar?: StatusBarConfig;
  columnConfig?: ColumnConfig;
  callbacks?: {
    onDataLoaded?: (data: any[]) => void;
    onDataError?: (error: Error) => void;
    // ... 其他 aggrid 回调
  };
}
```

## 使用示例

### 基础示例

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'users',
  dataSource: myDataSource,
  pagination: true,
  pageSize: 25
};
```

### 字段选择

只显示特定字段：

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'contacts',
  dataSource: myDataSource,
  fieldNames: ['name', 'email', 'phone', 'company'],
  pagination: true
};
```

### 过滤和排序

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'products',
  dataSource: myDataSource,
  filters: {
    category: 'Electronics',
    price: { $lt: 1000 }
  },
  sort: {
    price: 'asc'
  },
  pagination: true
};
```

### 可编辑网格（自动保存）

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'tasks',
  dataSource: myDataSource,
  editable: true,               // 启用编辑
  singleClickEdit: true,        // 单击编辑
  callbacks: {
    onCellValueChanged: (event) => {
      // 更改自动保存到后端
      console.log('已保存:', event.data);
    },
    onDataError: (error) => {
      console.error('数据错误:', error);
    }
  }
};
```

### CSV 导出

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'sales',
  dataSource: myDataSource,
  exportConfig: {
    enabled: true,
    fileName: 'sales-report.csv'
  },
  callbacks: {
    onExport: (data, format) => {
      console.log(`导出 ${data.length} 条记录为 ${format}`);
    }
  }
};
```

### 列配置

全局应用列设置：

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'contacts',
  dataSource: myDataSource,
  columnConfig: {
    resizable: true,      // 所有列可调整大小
    sortable: true,       // 所有列可排序
    filterable: true      // 所有列可过滤
  },
  enableRangeSelection: true  // Excel 样式范围选择
};
```

### 状态栏和聚合

在网格底部显示汇总统计：

```typescript
const schema = {
  type: 'object-aggrid',
  objectName: 'orders',
  dataSource: myDataSource,
  statusBar: {
    enabled: true,
    aggregations: ['count', 'sum', 'avg', 'min', 'max']
  }
};
```

### 多主题支持

```typescript
// Quartz 主题（默认）
{ type: 'object-aggrid', theme: 'quartz', ... }

// Alpine 主题
{ type: 'object-aggrid', theme: 'alpine', ... }

// Balham 主题
{ type: 'object-aggrid', theme: 'balham', ... }

// Material 主题
{ type: 'object-aggrid', theme: 'material', ... }
```

## 完整示例

```typescript
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import { ObjectAgGridRenderer } from '@object-ui/plugin-aggrid';

// 创建数据源
const dataSource = new ObjectStackAdapter({
  baseUrl: process.env.REACT_APP_API_URL,
  token: localStorage.getItem('authToken')
});

// 定义 schema
const schema = {
  type: 'object-aggrid',
  objectName: 'opportunities',
  dataSource: dataSource,
  
  // 只显示关键字段
  fieldNames: [
    'name', 
    'account', 
    'amount', 
    'probability', 
    'stage', 
    'close_date',
    'owner'
  ],
  
  // 查询参数
  filters: {
    stage: { $in: ['Qualification', 'Proposal', 'Negotiation'] },
    amount: { $gte: 10000 }
  },
  sort: {
    close_date: 'asc'
  },
  
  // 显示设置
  pagination: true,
  pageSize: 50,
  theme: 'quartz',
  height: 700,
  
  // 功能
  editable: true,
  exportConfig: {
    enabled: true,
    fileName: 'opportunities.csv'
  },
  statusBar: {
    enabled: true,
    aggregations: ['count', 'sum']
  },
  columnConfig: {
    resizable: true,
    sortable: true,
    filterable: true
  },
  
  // 回调
  callbacks: {
    onDataLoaded: (data) => {
      console.log(`加载了 ${data.length} 条商机`);
    },
    onCellValueChanged: (event) => {
      console.log('字段更新:', event.colDef.field, event.newValue);
    },
    onDataError: (error) => {
      alert('加载数据失败: ' + error.message);
    }
  }
};

// 渲染组件
function App() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">商机管理</h1>
      <ObjectAgGridRenderer schema={schema} />
    </div>
  );
}
```

## 与标准 AgGrid 的对比

| 特性 | AgGrid | ObjectAgGrid |
|------|--------|--------------|
| 列定义 | 手动定义 `columnDefs` | 自动从元数据生成 |
| 数据获取 | 手动传入 `rowData` | 自动从后端获取 |
| 字段格式化 | 手动配置 formatter | 根据字段类型自动应用 |
| 编辑保存 | 手动处理 | 自动保存到后端 |
| 适用场景 | 静态/已知数据结构 | 动态/元数据驱动 |

## 最佳实践

1. **缓存数据源实例**：避免在每次渲染时创建新的 DataSource
   ```typescript
   const dataSource = useMemo(() => new ObjectStackAdapter({...}), []);
   ```

2. **使用 fieldNames 优化性能**：只显示需要的字段
   ```typescript
   fieldNames: ['id', 'name', 'email', 'status']
   ```

3. **合理设置分页大小**：根据数据量调整
   ```typescript
   pageSize: 25  // 适中的默认值
   ```

4. **处理错误**：实现 onDataError 回调
   ```typescript
   callbacks: {
     onDataError: (error) => {
       // 显示友好的错误消息
       toast.error('数据加载失败');
     }
   }
   ```

5. **编辑时的字段验证**：在后端实现验证逻辑
   ```typescript
   editable: true,
   callbacks: {
     onCellValueChanged: async (event) => {
       try {
         // 后端会进行验证
         await dataSource.update(...);
       } catch (error) {
         // 恢复原值
         event.node.setDataValue(event.colDef.field!, event.oldValue);
       }
     }
   }
   ```

## 故障排除

### 数据未加载
- 检查 `dataSource` 是否正确初始化
- 验证 `objectName` 是否存在于后端
- 检查网络请求和 API 响应

### 列未显示
- 确认对象架构中有字段定义
- 检查 `fieldNames` 配置是否正确
- 查看浏览器控制台的错误信息

### 编辑不工作
- 确保 `editable: true`
- 检查字段是否标记为 `readonly`
- 验证后端 update API 是否可用

## 许可证

MIT

## 相关资源

- [AG Grid 文档](https://www.ag-grid.com/documentation/)
- [ObjectStack Client 文档](https://docs.objectstack.ai/client)
- [ObjectUI 类型系统](../types/README.md)
