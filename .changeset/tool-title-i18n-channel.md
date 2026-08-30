---
'@object-ui/plugin-chatbot': patch
---

工具卡片的名字终于有了 i18n 通道（此前中文界面里必然是英文）

实测（cloud#1658，全中文环境）：

```
统计一下每个阅读状态各有多少本书
  Describe object    已完成   执行过程     ← 工具名英文
  Visualize data     已完成   执行过程     ← 工具名英文
  已统计完成，各阅读状态的书本数量如下：…    ← 其余全中文
```

卡片上每一处都本地化了——状态、动作、回答——**唯独工具名不能**，因为
`humanizeToolName` 是个纯英文构词器（`describe_object` → `Describe object`），
名字从未经过翻译，任何语言包都够不着它。而"它现在在做什么"恰恰是用户最需要读懂的一步。

现在它接受一个可选的 `translate`（形状即 `useSafeTranslate()`），按
`chatbot.tool.<tool_name>` 查；查不到就回落到与今天完全一致的英文标题。

**这一步只打通通道，不改变任何现有显示**：不传 translate 时行为逐字不变（测试的第一组
就在钉这一点），语言包也还没有条目。后续两件事各自独立、可分别推进：
把两个调用点接上 `useSafeTranslate()`；以及按需往语言包里补 `chatbot.tool.*`。
先落通道是因为——在通道存在之前，翻译工作根本无处可放。

回落刻意交给英文标题而非原始名：语言包缺条目时显示 `Describe object`（与今天相同），
而不是 `describe_object`（比今天更差）。
