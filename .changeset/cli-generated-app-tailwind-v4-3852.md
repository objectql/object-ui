---
'@object-ui/cli': patch
---

修复 `objectui dev` 生成的临时 app 的 CSS 管线:整套从 Tailwind 3 迁到 Tailwind 4

生成器写出的样式面此前是完整的 v3 三件套 —— `src/index.css` 用 `@tailwind base/components/utilities` 指令、`postcss.config.js` 写 v3 的 `tailwindcss: {}` 插件键、外加一份 `tailwind.config.js` —— 而仓内与 `@object-ui/components` 都已在 v4(components 的 peer 是 `tailwindcss ^4.2.1`)。两个后果都是真的:

- **仓内 `objectui dev` 今天不出样式。** `commands/dev.ts` 的 monorepo 分支把 `require('tailwindcss')(configPath)` 当 PostCSS 插件调用,v4 下这条路径只会抛 "moved to `@tailwindcss/postcss`",而该异常被 `try/catch` 吞成一行黄字警告;`css.postcss` 因此没被设上,Vite 退回去搜配置文件,`/src/index.css` 请求最终 500(实测:`Failed to load PostCSS config … Cannot find module '@tailwindcss/postcss'`),浏览器里一条样式都没有。
- **仓外一次干净安装会 ERESOLVE。** 生成清单声明 `tailwindcss ^3.4.19`,与它依赖的 `@object-ui/components` 的 v4 peer 冲突。

改动:

- `src/index.css` 改为仓内惯用的 v4 CSS-first 写法(`@import 'tailwindcss'` + `@custom-variant dark` + `@source` + `@theme`),`@theme` 的 token 集与 `packages/components/src/index.css` 逐条对齐 —— 包含 v3 config 一直缺、而生成的 `src/Layout.tsx` 自己就在用的 8 个 `sidebar-*` token。
- `postcss.config.js` 改写 `'@tailwindcss/postcss': {}`;`tailwind.config.js` 不再生成(v4 下没有 `@config` 指向它时它就是死文件,仓内本身也零个 `tailwind.config.*`),v3 的 `content` 扫描面等价迁为 `@source`。
- 清单:`tailwindcss` 抬到 `^4.3.3` 并新增 `@tailwindcss/postcss ^4.3.3`,两者都锚回仓内(#3827 记的 `TAILWIND_V3_DEFERRED` 记账钉随之翻转)。
- `commands/dev.ts` 改用 `@tailwindcss/postcss`,并由 `@object-ui/cli` 自己声明这两个插件包;加载失败不再吞成警告,而是带修法响亮报错 —— 静默无样式正是这个缺陷能潜伏这么久的原因。
