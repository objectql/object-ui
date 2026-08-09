---
"@object-ui/plugin-map": patch
---

`plugin-map` 加载时不再向控制台打印 `Registering object-map...`

`packages/plugin-map/src/index.tsx` 的注册调用之前留着一句调试输出
`console.log('Registering object-map...')`。它位于**模块作用域**,所以不是「渲染地图时打一行」,
而是**只要这个 plugin 被 import 就打一行**:console 应用的 `register-plugins` 一加载即触发,
单元测试里跟着刷,生产 bundle 同样保留 —— 使用者控制台里凭空多出一行来源不明的噪音。

同仓其余 18 个 plugin 的 `src/index.tsx` 注册处都没有这类输出,这一句是孤例
(`plugin-editor` 里唯一的 `console.log` 命中是 `defaultProps.value` 示例代码字符串,
不是会执行的语句)。纯噪音,不涉及任何行为:注册本身、`ObjectMap` 的渲染与取数都不读它。

顺带记一条搜索时确认的背景:仓库的 eslint 配置没有开 `no-console` 规则,所以这类遗留
调试输出没有任何自动化拦网 —— 这次是靠人工发现的。是否全仓开 `no-console`(以及
`ObjectMap.tsx` 里三处**有意**保留的 `console.warn`/`console.error` 诊断如何豁免)是一个
影响多个包的策略决定,已另行开单,不混进本 PR。

回潮钉在 `src/index.registration.test.tsx`:spy 掉 `console.log`/`info`/`debug` 后
`vi.resetModules()` 再 `import('./index')`,断言零输出。钉子刻意只覆盖这三个「噪音通道」,
不含 `warn`/`error` —— `ComponentRegistry.register()` 在缺 namespace、以及裸名 fallback
覆盖冲突时**按设计**会 `console.warn`(`packages/core/src/registry/Registry.ts`),
一刀切断言「零 console 输出」等于把 Registry 的诊断契约钉在这里,将来会因与「遗留调试输出」
无关的原因变红。钉子里还有一条非空断言:import 后校验 `object-map`/`map` 两个注册确实进了
registry,免得模块缓存导致 import 未真正执行、于是「没有输出」是因为**什么都没发生**而假绿。
