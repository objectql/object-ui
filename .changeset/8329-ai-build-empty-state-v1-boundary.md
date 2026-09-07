---
'@object-ui/i18n': patch
'@object-ui/app-shell': patch
---

AI 搭建入口的空状态不再承诺 v1 拒绝的东西（objectui#8329）。

`console.ai.empty.build.description` 和 `console.ai.empty.editApp.description`
原本告诉用户「描述一个应用或流程 —— 我会起草对象、界面和自动化」。cloud 的 v1
创作边界（ADR-0112）不含流程、动作、定时，模型会明确拒绝这类请求，所以这是入口
处对用户做的一个会被打回的承诺。它是这个家族里最后一处 —— 起始 chip 的措辞
（cloud#1984）和模型收尾的「后续你可以」（cloud#2022）已经修过。

⚠️ **十个语言包每一个都有自己翻译好的违规版本**，全部一并修正；组件里两处硬编码
`defaultValue` 兜底也同步更新，否则任一语言包丢 key 时旧承诺会静默回归。

未改动的是**手工**路径的文案（`home.build.subtitle`、Studio 落地页、导入时运行
已有自动化、打包自动化运维、marketplace 分类）—— Studio 确实能建流程，那些承诺
是真的。判据是「v1 的 AI 创作边界」，不是「automation 这个词」。

回滚：ADR-0112 v2 加回流程/动作时，这两句与 chip 文案同一行回滚；测试里的
`RETIRED` 映射存了十个语言包的原句。
