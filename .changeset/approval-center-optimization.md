---
"@object-ui/components": patch
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

fix(approvals): Approval Center UX pass — badge nowrap, approve confirm, decision progress bar, localized declared actions (#2762)

- **Badge no longer stacks CJK text vertically (P0-1)** — `Badge` gains
  `whitespace-nowrap` in its base variants (a badge is a single-line pill by
  definition), and the inbox 状态 column gets a minimum width, so 待审批 can
  never render as 待/审/批.
- **Quick Approve now confirms (P0-2)** — the row's right-edge ✓, the mobile
  card button and the `a` keyboard shortcut all route through a confirmation
  dialog before executing, mirroring the Reject flow; an irreversible decision
  can no longer fire on a stray click.
- **Decision progress is visualized (P1-1)** — the drawer renders a segmented
  progress bar (ARIA `progressbar`) for `decision_progress`, per-group chips
  get an explicit unsatisfied ○ state next to the satisfied ✓, the eligible
  approver count is spelled out, and the drawer pager now reads
  "Request N of M" so it can't be misread as approval progress.
- **Declared action labels localize (P0-3)** — `DeclaredActionsBar` resolves
  label / confirmText / successMessage through the `_actions.<name>.*`
  translation convention (metadata literals as fallback), matching
  ObjectView/RecordDetailView; with the `@objectstack/plugin-approvals`
  bundle, the drawer shows 通过 / 拒绝 / 转签 instead of English in a zh-CN
  workspace. New `approvalsInbox` keys shipped in all ten locales.
