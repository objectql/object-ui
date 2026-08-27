---
'@object-ui/plugin-chatbot': patch
'@object-ui/app-shell': patch
---

「打开这条记录 →」卡片——ask 的记录交接终于有了客户端的另一半

服务端半边（cloud#1659 的 `open_record`）先落了地，实测发现它是**半活的**：agent 发出
`status:'record_handoff'`、回答说「点击上方链接打开」，而上方根本没有链接——控制台
有 `build_handoff` 的探测器，这个状态一处都不认识，信号被原样丢弃。

按五步补齐：`detectRecordHandoff`（含持久化 `{type:'text',value}` 包裹形状——replay
信封那课的规矩）→ live 映射提升 → 水合提升 → 卡片渲染 → 宿主回调。

两个设计点：

- **app 段点击时现场解析**。记录路由要 `/apps/:app/:object/record/:id`，交接载荷只有
  对象和记录 id；宿主回调用一次同源元数据读取 `_packageId` 再导航，不给 agent 增加
  它未必知道的参数。
- **刻意不做「被取代」置灰**。builder 卡的旧 prompt 会过时，旧的记录链接不会——记录
  不因为有新交接而失效。

真机闭环验证：问「把《沉默的大多数》标记成已读」→ 卡片渲染
（`沉默的大多数 — 把阅读状态改为已读`）→ 点击 → 落在
`/apps/app.hdke/hdke_book/record/<id>` 详情页，「编辑」在手边。

缺任一 id 的交接在探测器就被丢弃，与服务端的拒绝对称——指向空处的卡片比散文更糟。
