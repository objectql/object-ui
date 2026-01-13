# Object UI Packages 重构方案

## 当前问题分析

### 现有结构
```
packages/
├── core/           # ❌ 仅有占位代码
├── designer/       # ✅ 设计器（正确）
├── engine/         # ❌ 仅有版本号占位
├── protocol/       # ⚠️  定义了 SchemaNode 但职责不清
├── react/          # ❌ 仅有占位代码
├── renderer/       # ⚠️  实际承担了 SchemaRenderer 和所有渲染器
└── ui/             # ⚠️  包含了 Shadcn 组件和 metadata
```

### 核心问题
1. **职责混乱**: `renderer` 包同时承担了注册表、渲染器和组件映射
2. **命名不符**: 没有 `components` 包，违反了 copilot-instructions 中的标准
3. **空包存在**: `core`、`engine`、`react` 几乎没有实际内容
4. **边界模糊**: `protocol` vs `core` vs `engine` 的分工不明确

---

## 标准架构（目标）

根据 `.github/copilot-instructions.md` 和 `docs/spec/` 定义的标准架构：

```
packages/
├── core/              # 🧠 The Brain - 纯 TypeScript 逻辑
│   ├── types/         # Schema 类型定义（从 protocol 迁移）
│   ├── registry/      # 组件注册表（从 renderer 迁移）
│   ├── data-scope/    # 数据作用域链
│   ├── evaluator/     # 表达式求值引擎
│   └── validators/    # Zod 验证器
│
├── react/             # 🔌 The Glue - React 绑定层
│   ├── SchemaRenderer.tsx      # 主渲染器（从 renderer 迁移）
│   ├── hooks/                  # useRenderer, useDataScope
│   └── context/                # React Context 包装器
│
├── components/        # 💪 The Body - 官方标准 UI 实现
│   ├── ui/            # Shadcn 原子组件（从 ui 迁移）
│   └── renderers/     # ObjectUI 包装器（从 renderer 迁移）
│       ├── basic/     # 基础组件渲染器
│       ├── form/      # 表单组件渲染器
│       ├── layout/    # 布局组件渲染器
│       └── ...
│
├── designer/          # 🎨 The Tool - 可视化编辑器（保持不变）
│
├── plugins/           # ⚔️  The Weapons - 重量级集成（新增）
│   ├── ag-grid/       # AG Grid 集成
│   ├── devexpress/    # DevExpress 集成
│   └── monaco/        # Monaco 编辑器集成
│
└── [废弃包]
    ├── protocol/      # ❌ 合并到 core/types
    ├── engine/        # ❌ 合并到 core
    ├── renderer/      # ❌ 拆分到 react + components
    └── ui/            # ❌ 重命名为 components/ui
```

---

## 详细迁移路径

### Phase 1: 创建新的标准结构

#### 1.1 重构 `packages/core`

**目标**: 成为纯 TypeScript 的核心逻辑层，零 React 依赖

```
packages/core/
├── package.json          # 依赖: zod, lodash (无 React)
├── tsconfig.json
└── src/
    ├── index.ts
    ├── types/
    │   ├── base.ts       # BaseSchema interface
    │   ├── components.ts # 所有组件的 Schema 定义
    │   ├── page.ts       # PageSchema
    │   ├── view.ts       # ViewSchema
    │   └── object.ts     # ObjectSchema
    │
    ├── registry/
    │   ├── Registry.ts          # 注册表核心逻辑
    │   └── ComponentConfig.ts   # 组件配置类型
    │
    ├── data-scope/
    │   ├── DataScope.ts         # 作用域链实现
    │   └── ScopeChain.ts        # 原型链查找
    │
    ├── evaluator/
    │   ├── Evaluator.ts         # 表达式求值
    │   └── ExpressionParser.ts  # ${...} 解析器
    │
    └── validators/
        └── schemas.ts            # Zod 验证规则
```

**迁移清单**:
- ✅ 从 `packages/protocol/src/index.ts` 迁移 `SchemaNode` 等类型
- ✅ 从 `packages/renderer/src/registry.tsx` 迁移注册表逻辑
- ✅ 新建 `DataScope` 和 `Evaluator` 实现

---

#### 1.2 重构 `packages/react`

**目标**: React 绑定层，连接 core 和 components

```
packages/react/
├── package.json       # peerDeps: react, react-dom
│                      # deps: @object-ui/core
├── tsconfig.json
└── src/
    ├── index.ts
    ├── SchemaRenderer.tsx     # 主渲染器（从 renderer 迁移）
    ├── hooks/
    │   ├── useRenderer.ts
    │   ├── useDataScope.ts
    │   └── useRegistry.ts
    └── context/
        ├── RendererContext.tsx
        └── DataScopeContext.tsx
```

**迁移清单**:
- ✅ 从 `packages/renderer/src/index.tsx` 迁移 `SchemaRenderer`
- ✅ 创建 React Hooks 封装 core 逻辑

---

#### 1.3 创建 `packages/components`

**目标**: 官方标准组件库，包含 Shadcn UI + ObjectUI 渲染器

```
packages/components/
├── package.json
│   # deps: @object-ui/core, @object-ui/react
│   # deps: @radix-ui/*, tailwindcss, lucide-react
├── components.json    # Shadcn 配置（从 ui 迁移）
├── tailwind.config.js
└── src/
    ├── index.ts       # 统一导出
    ├── index.css      # Tailwind 基础样式
    │
    ├── ui/            # 🟦 Shadcn 原子组件（从 packages/ui 迁移）
    │   ├── button.tsx
    │   ├── input.tsx
    │   ├── select.tsx
    │   └── ...
    │
    └── renderers/     # 🟨 ObjectUI 包装器（从 renderer 迁移）
        ├── basic/
        │   ├── ButtonRenderer.tsx
        │   ├── TextRenderer.tsx
        │   └── index.ts
        ├── form/
        │   ├── InputRenderer.tsx
        │   ├── SelectRenderer.tsx
        │   └── index.ts
        ├── layout/
        │   ├── ContainerRenderer.tsx
        │   ├── GridRenderer.tsx
        │   └── index.ts
        ├── data-display/
        │   ├── TableRenderer.tsx
        │   └── CardRenderer.tsx
        └── index.ts   # 自动注册所有渲染器
```

**迁移清单**:
- ✅ 从 `packages/ui/src/components/ui/*` 迁移 Shadcn 组件
- ✅ 从 `packages/renderer/src/renderers/*` 迁移渲染器
- ✅ 保留 Tailwind 配置和样式

---

#### 1.4 创建 `packages/plugins/`

**目标**: 隔离重量级第三方集成

```
packages/plugins/
├── ag-grid/
│   ├── package.json  # deps: ag-grid-react
│   └── src/
│       ├── GridRenderer.tsx
│       └── index.ts
│
├── devexpress/
│   ├── package.json  # deps: devextreme-react
│   └── src/
│
└── monaco/
    ├── package.json  # deps: @monaco-editor/react
    └── src/
```

---

### Phase 2: 更新依赖关系

#### 依赖链
```
designer
   ↓
components ──→ react ──→ core
   ↓              ↓
plugins/*    (peerDeps: react, react-dom)
```

#### Package.json 依赖矩阵

| Package      | Dependencies                              | Peer Dependencies |
|--------------|-------------------------------------------|-------------------|
| `core`       | zod, lodash                               | -                 |
| `react`      | @object-ui/core                           | react, react-dom  |
| `components` | @object-ui/core, @object-ui/react, @radix-ui/*, tailwindcss | react, react-dom |
| `designer`   | @object-ui/components                     | react, react-dom  |
| `plugins/*`  | @object-ui/components, <plugin-lib>       | react, react-dom  |

---

### Phase 3: 废弃旧包

```bash
# 删除或归档
packages/protocol/   → 合并到 core/types
packages/engine/     → 合并到 core
packages/renderer/   → 拆分到 react + components
packages/ui/         → 重命名为 components/ui
```

---

## 迁移步骤（执行顺序）

### Step 1: 准备阶段
```bash
# 1. 创建新的包结构
mkdir -p packages/components/{src/{ui,renderers},metadata}
mkdir -p packages/plugins/{ag-grid,devexpress,monaco}

# 2. 备份当前代码
git checkout -b refactor/packages-restructure
```

### Step 2: 迁移 Core（最底层）
```bash
# 从 protocol 迁移类型
cp packages/protocol/src/* packages/core/src/types/

# 从 renderer 迁移注册表
cp packages/renderer/src/registry.tsx packages/core/src/registry/Registry.ts
# 🔧 移除 React 依赖，改为纯 TypeScript
```

### Step 3: 迁移 React（中间层）
```bash
# 迁移 SchemaRenderer
cp packages/renderer/src/index.tsx packages/react/src/SchemaRenderer.tsx
# 🔧 更新 import 路径指向 @object-ui/core
```

### Step 4: 迁移 Components（UI 层）
```bash
# 迁移 Shadcn UI 组件
cp -r packages/ui/src/components/ui packages/components/src/ui
cp packages/ui/src/index.css packages/components/src/

# 迁移渲染器
cp -r packages/renderer/src/renderers packages/components/src/

# 迁移 metadata
cp -r packages/ui/metadata packages/components/metadata
```

### Step 5: 更新依赖
```bash
# 在所有包中更新 import 路径
# 从: import { X } from '@object-ui/protocol'
# 到: import { X } from '@object-ui/core'

# 从: import { SchemaRenderer } from '@object-ui/renderer'
# 到: import { SchemaRenderer } from '@object-ui/react'
```

### Step 6: 删除旧包
```bash
rm -rf packages/protocol
rm -rf packages/engine
rm -rf packages/renderer
rm -rf packages/ui
```

---

## 验证清单

### 功能验证
- [ ] `examples/prototype` 能正常构建和运行
- [ ] `examples/designer-demo` 能正常构建和运行
- [ ] 所有单元测试通过
- [ ] TypeScript 类型检查通过

### 架构验证
- [ ] `packages/core` 无 React 依赖
- [ ] `packages/react` 只依赖 core + React
- [ ] `packages/components` 包含完整的 UI + 渲染器
- [ ] 循环依赖检查通过

### 文档验证
- [ ] 更新 `README.md`
- [ ] 更新 `docs/guide/installation.md`
- [ ] 更新 `docs/spec/project-structure.md`
- [ ] 更新 `.github/copilot-instructions.md`（如需调整）

---

## 关键设计决策

### 为什么合并 protocol 到 core？
- `protocol` 原本只有类型定义，职责过窄
- 类型定义是核心逻辑的一部分，应该在 `core` 中
- 避免过度拆分导致包数量膨胀

### 为什么拆分 renderer？
- `renderer` 违反了单一职责原则，同时包含：
  - 注册表逻辑（应该在 core）
  - React 绑定（应该在 react）
  - UI 组件（应该在 components）
- 拆分后各层职责清晰，符合标准架构

### 为什么重命名 ui 为 components？
- `ui` 命名过于宽泛
- `components` 明确表达「官方标准组件库」的定位
- 与 copilot-instructions 中的术语一致

### 为什么新增 plugins？
- 隔离重量级第三方库（AG Grid 200KB+）
- 支持按需加载，避免污染核心包
- 为未来扩展预留空间

---

## 风险评估

### 高风险项
1. **Import 路径大规模变更** - 可能遗漏部分引用
   - 缓解: 使用 IDE 全局搜索替换 + TypeScript 检查

2. **循环依赖** - components 依赖 react，react 依赖 core
   - 缓解: 严格遵守单向依赖原则，禁止反向引用

### 中风险项
1. **测试覆盖不足** - 当前测试较少，可能遗漏回归问题
   - 缓解: 重构前补充关键路径的集成测试

2. **第三方依赖版本冲突** - Shadcn 组件依赖特定 Radix 版本
   - 缓解: 使用 pnpm 的 workspace 协议锁定版本

---

## 成功标准

重构完成后应达到：

1. ✅ **架构清晰**: 每个包职责单一明确
2. ✅ **零 React 污染**: core 包可以在 Node.js 中使用
3. ✅ **Tree-shakable**: 用户只引入需要的组件
4. ✅ **向后兼容**: 旧代码通过 import 路径调整即可迁移
5. ✅ **文档完整**: AI 和人类都能快速理解架构

---

## 附录：参考文档

- [Architecture Blueprint](docs/spec/architecture.md)
- [Project Structure Spec](docs/spec/project-structure.md)
- [Copilot Instructions](.github/copilot-instructions.md)
