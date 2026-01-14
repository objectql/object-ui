# 设计器拖拽和调整大小功能实现总结

## 概述

本次更新为 Object UI 设计器实现了完整的**拖放**和**调整大小**功能，同时使用高级 Tailwind CSS 样式和流畅动画优化了用户体验。

---

## 🎯 问题解决

**原始需求：**
> "该如何规划设计器中哪些控件可以拖动，哪些可以放大缩小。如何更新tailwind优化设计体验"

**解决方案：**
1. ✅ **规划了哪些组件可拖动** - 除根容器外的所有组件都可拖动
2. ✅ **规划了哪些组件可调整大小** - 仅容器/布局组件可调整大小
3. ✅ **更新了 Tailwind 样式** - 使用渐变边框、动画和平滑过渡优化设计体验

---

## 📋 功能分类

### 可拖动的组件（全部组件）

**所有组件默认都可拖动**，除了根容器。这允许您：
- 在父容器内重新排序组件
- 在不同容器之间移动组件
- 快速重组布局

**视觉反馈：**
- 悬停时显示抓手光标 (🖐️)
- 拖动时显示抓取光标 (✊)
- 原始位置显示半透明效果
- 可放置区域显示渐变边框动画

### 可调整大小的组件（仅容器组件）

**仅容器/布局组件可调整大小：**
- `card` - 带标题/描述的卡片容器
- `container` - 响应式容器包装器
- `grid` - 网格布局组件

**为什么不是所有组件？**
- 叶子组件（输入框、按钮、文本）应保持其固有大小
- 容器组件需要自定义尺寸来控制布局
- 这防止 UI 不一致并保持设计质量

**调整大小交互：**
1. **选择**可调整大小的组件
2. **调整手柄**出现在边缘和角落（8 个方向）
3. **拖动**手柄调整宽度、高度或两者
4. 尺寸受最小/最大值约束

**视觉反馈：**
- 悬停时调整手柄显示为圆形点
- 角落手柄（较大）用于对角调整
- 边缘手柄（较小）用于单轴调整
- 光标变化指示调整方向（↔, ↕, ↗, ↖, ↘, ↙）

---

## 🎨 视觉设计系统优化

### 高级渐变效果

**选择状态：**
- **动画渐变边框**（靛蓝-600 → 靛蓝-700 → 靛蓝-800）
- **脉冲动画**指示活动选择
- **组件类型标签**带渐变背景
- **增强阴影**多层效果
- **调整手柄**（如果组件可调整大小）

**悬停状态：**
- 渐变边框效果（靛蓝-400 → 靛蓝-500）
- 轻微向上平移（1px）
- 增强阴影
- 平滑 200ms 三次贝塞尔过渡

**拖动状态：**
- 原始位置的**幽灵效果**（40% 不透明度，灰度，模糊）
- **放置区域**显示虚线渐变边框
- **指示徽章**引导放置位置

### 颜色方案

使用**靛蓝/紫色光谱**保持一致性：

| 元素 | 颜色 | 用途 |
|------|------|------|
| 悬停边框 | 靛蓝-400 → 靛蓝-500 | 微妙指示 |
| 选择边框 | 靛蓝-600 → 靛蓝-700 → 靛蓝-800 | 强焦点 |
| 放置区域 | 靛蓝-400 → 靛蓝-500 → 靛蓝-600 | 活动目标 |
| 徽章和标签 | 靛蓝-600 → 紫色-600 | 信息性 |
| 调整手柄 | 靛蓝-500 | 交互元素 |
| 可调整大小指示器 | 翠绿-400 → 绿色-500 | 状态徽章 |

### 动画系统

所有动画使用**三次贝塞尔缓动**实现平滑自然的运动：

```css
/* 标准过渡 */
transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

/* 选择边框的脉冲动画 */
@keyframes pulse-border {
  0%, 100% { box-shadow: /* 微妙 */ }
  50% { box-shadow: /* 增强 */ }
}

/* 放置区域脉冲 */
@keyframes pulse-drop-zone {
  0%, 100% { /* 浅渐变 */ }
  50% { /* 深渐变 */ }
}
```

---

## 🔧 技术实现

### 1. 组件元数据增强

在 `ComponentMeta` 类型中添加了新属性：

```typescript
export interface ComponentMeta {
  // 现有属性...
  
  // 新增：是否可调整大小
  resizable?: boolean;
  
  // 新增：调整大小约束
  resizeConstraints?: {
    width?: boolean;        // 允许宽度调整
    height?: boolean;       // 允许高度调整
    minWidth?: number;      // 最小宽度（像素）
    maxWidth?: number;      // 最大宽度（像素）
    minHeight?: number;     // 最小高度（像素）
    maxHeight?: number;     // 最大高度（像素）
  };
}
```

### 2. 调整大小手柄组件

创建了 `ResizeHandle` 组件支持 8 个方向：

- `n` - 北（顶部）
- `s` - 南（底部）
- `e` - 东（右侧）
- `w` - 西（左侧）
- `ne` - 东北（右上角）
- `nw` - 西北（左上角）
- `se` - 东南（右下角）
- `sw` - 西南（左下角）

### 3. 状态管理

在 DesignerContext 中添加调整大小状态：

```typescript
type ResizingState = {
  nodeId: string;
  direction: ResizeDirection;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
} | null;
```

### 4. 组件配置示例

如何使组件可调整大小：

```typescript
ComponentRegistry.register('card', 
  CardComponent,
  {
    label: 'Card',
    resizable: true,
    resizeConstraints: {
      width: true,
      height: true,
      minWidth: 200,
      maxWidth: 800,
      minHeight: 100,
      maxHeight: 600
    }
  }
);
```

---

## 📊 改进的组件面板

### 视觉指示器

**可调整大小徽章：**
- 右上角的小**绿点**
- 悬停时出现
- 指示组件支持调整大小

**组件卡片：**
- 悬停时**缩放动画**（1.05x）
- 拖动时**激活缩放**（0.95x）
- 悬停时**渐变背景**
- **增强的图标背景**

### 分类组织

使用渐变标题组织组件分类：

1. **布局** - 容器组件（大多可调整大小）
2. **表单** - 输入组件（不可调整大小）
3. **数据展示** - 展示组件（混合）
4. **反馈** - 警告/提示组件（不可调整大小）
5. **叠加层** - 模态/弹出层组件（不可调整大小）
6. **导航** - 导航/标签组件（混合）

---

## ⌨️ 键盘快捷键

| 快捷键 | 操作 |
|--------|------|
| `点击` | 选择组件（如果可调整大小则显示调整手柄）|
| `拖动` | 移动组件 |
| `Ctrl/Cmd + Z` | 撤销调整大小/移动 |
| `Ctrl/Cmd + Y` | 重做调整大小/移动 |
| `Delete` | 删除选中的组件 |
| `Esc` | 取消选择（隐藏调整手柄）|

---

## 📁 修改的文件

**核心类型和注册表：**（2 个文件）
- `packages/types/src/base.ts`
- `packages/core/src/registry/Registry.ts`

**设计器实现：**（5 个文件）
- `packages/designer/src/context/DesignerContext.tsx`
- `packages/designer/src/components/Canvas.tsx`
- `packages/designer/src/components/ResizeHandle.tsx`（新文件）
- `packages/designer/src/components/ComponentPalette.tsx`
- `packages/designer/src/index.ts`

**可调整大小的组件：**（3 个文件）
- `packages/components/src/renderers/layout/card.tsx`
- `packages/components/src/renderers/layout/container.tsx`
- `packages/components/src/renderers/layout/grid.tsx`

**文档：**（2 个文件）
- `packages/designer/DRAG_AND_RESIZE_GUIDE.md`（新文件）
- `packages/designer/README.md`

**测试：**（1 个文件）
- `packages/designer/src/__tests__/resize.test.tsx`（新文件）

**总计：15 个文件**

---

## 🧪 测试覆盖

添加了全面的单元测试：
- ✅ 调整大小状态管理测试
- ✅ 约束应用测试
- ✅ 组件选择测试
- ✅ 尺寸更新测试
- ✅ 注册表配置测试

---

## 📖 文档

**新文档：**
1. **DRAG_AND_RESIZE_GUIDE.md** - 详细的使用指南
   - 组件行为说明
   - 配置示例
   - 视觉设计系统
   - 最佳实践
   - 故障排除

2. **更新的 README.md**
   - 新功能亮点
   - 可调整大小的组件列表
   - 增强的功能路线图

---

## 🚀 未来增强

基础已完成。未来的改进可能包括：
- [ ] 调整大小时的网格对齐
- [ ] 纵横比锁定（Shift+拖动）
- [ ] 键盘调整大小（Shift+方向键）
- [ ] 多选调整大小
- [ ] 基于百分比的约束
- [ ] 从中心调整大小（Alt+拖动）

---

## ✅ 实现完成

所有任务已完成：
- ✅ 完整实现
- ✅ 高级视觉设计
- ✅ 全面文档
- ✅ 单元测试
- ✅ 类型安全

**本实现完全解决了原始问题，并提供了更好的设计体验。**
