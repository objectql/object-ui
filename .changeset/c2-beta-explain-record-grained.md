---
"@object-ui/app-shell": minor
---

feat(app-shell): C2-β — AccessExplainPanel record 粒度渲染 (framework#2920)

AccessExplainPanel 现支持记录级解释(ADR-0095):

- **记录选择器**:选定对象后可输入或从 RecordPickerDialog 选择一条 `recordId`;请求带上 `recordId`。
- **逐层行级归因**:每层展开该记录的 `record` 归因——outcome 徽标(准入/排除/未评估)、命中的 `rules[]`(权限集 → 岗位 → 共享 → 行规则,含 kind/grants/via/effect 三态圆点)、有效行过滤(rowFilter JSON)、matchesRecord。
- **顶部记录判定**:`record.visible` 结论横幅 + `decidedBy` 决定性层(该记录为何可见/不可见)。
- **posture / kernelTier**:principal 卡片显示 posture 档位徽标;每层显示 kernel tier(租户墙 vs 业务 RLS)标签。
- i18n:en + zh-CN 全量 key。

**向后兼容**:不带 `recordId` 时行为与对象级完全一致。
