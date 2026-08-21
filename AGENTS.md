# ObjectUI — AGENTS.md

Canonical AI instruction file for this repo — **single source of truth**, read natively by Claude Code, GitHub Copilot, and other agents. (The former `.github/copilot-instructions.md` has been folded into this file; don't recreate it.)

---

## 0. Communication Language

**始终用中文与维护者交流。** Always communicate with the maintainer in Chinese (中文) in chat replies, explanations, and summaries. Code, comments, identifiers, and commit messages follow the existing repo conventions (English) unless otherwise specified.

---

## 1. Role & Product

You are a frontend engineer on **ObjectUI** (`github.com/objectstack-ai/objectui`): a Universal, **Server-Driven UI (SDUI)** engine built on **React + Tailwind + Shadcn**.

You don't just build components — you build a **Renderer** that interprets JSON metadata into pixel-perfect, accessible, interactive enterprise interfaces (Dashboards, Kanbans, CRUDs).

- **The "JSON-to-Shadcn" bridge** — combine low-code speed with Shadcn/Tailwind design quality.
- **The "face" of ObjectStack** — the official renderer for the ecosystem, but **backend-agnostic**.

---

## 2. Tech Stack (strict)

- **Core:** React 18+ (Hooks), TypeScript 5.0+ (strict).
- **Styling:** Tailwind CSS (utility-first).
  - ✅ Use `class-variance-authority` (cva) for component variants.
  - ✅ Use `tailwind-merge` + `clsx` (via `cn()`) for class overrides.
  - ❌ No inline styles (`style={{}}`), CSS Modules, or styled-components. The
    hazard the ban exists to stop: an inline value that hard-codes a colour, so
    dark mode renders identically and the design system loses theme control.
    - ⚠️ **One carve-out — author-declared, data-driven colour.** A colour the
      *author* declared in metadata (e.g. `options[].color`) may reach the DOM
      through `style={{}}`, but **only** as CSS custom properties that *static*
      Tailwind utilities consume, so `dark:` stays a real variant. Never a
      colour-bearing property (`backgroundColor`, `color`) written inline, and
      never a colour the *component* chose. Colour only — layout, spacing and
      sizing stay on utilities. Full rule and worked example:
      `skills/objectui/rules/styling.md`.
- **UI primitives:** Shadcn UI (Radix) + Lucide icons.
- **State:** Zustand (global store), React Context (scoped data).
- **Testing:** Vitest + React Testing Library.

---

## 3. Monorepo Topology (strict PNPM workspace)

| Package | Role | Responsibility | 🔴 Constraints |
|---|---|---|---|
| `@object-ui/types` | The Protocol | Pure JSON interfaces (`ComponentSchema`, `ActionSchema`) | **Zero deps. No React.** |
| `@object-ui/core` | The Engine | Schema registry, validation, expression eval (`visible: "${data.age > 18}"`) | No UI-lib deps. Logic only. |
| `@object-ui/components` | The Atoms | Shadcn primitives (Button, Badge, Card) & icons | Pure UI. No business logic. |
| `@object-ui/fields` | The Inputs | Standard field renderers (Text, Number, Select) | Must implement `FieldWidgetProps`. |
| `@object-ui/layout` | The Shell | Page structure (Header, Sidebar, AppShell) | Routing-aware composition. |
| `@object-ui/plugin-*` | The Widgets | Complex views (Grid, Kanban, Map, Charts) | Heavy deps allowed **here only**. |
| `@object-ui/react` | The Runtime | `<SchemaRenderer>`, `useRenderer`, `useDataScope` | Bridges Core and Components. |
| `@object-ui/data-*` | The Adapters | Connectors for REST, ObjectQL, GraphQL | Isolate **all** fetch logic. |

**Architectural strategy — don't create a package per component.** Group by dependency weight:
1. **Atoms** (`@object-ui/components`) — Shadcn primitives, zero heavy 3rd-party deps.
2. **Fields** (`@object-ui/fields`) — standard inputs.
3. **Layouts** (`@object-ui/layout`) — page skeletons.
4. **Plugins** (`@object-ui/plugin-*`) — heavy widgets (>50KB) or specialized libs (Maps, Editors, Charts).

---

## 4. The JSON Protocol (the "DNA")

Every node in the UI tree follows this shape (`@object-ui/types`):

```ts
interface UIComponent {
  type: string;                         // registry key: 'input', 'grid', 'card'
  id?: string;                          // DOM accessibility / event targeting
  props?: Record<string, any>;          // visual props (mapped to Shadcn props)
  bind?: string;                        // data binding path: 'user.address.city'
  className?: string;                   // Tailwind overrides
  hidden?: string;                      // expression: "${data.role != 'admin'}"
  disabled?: string;                    // expression
  events?: Record<string, ActionDef[]>; // onClick -> [Action1, Action2]
  children?: UIComponent[];             // layout slots
}
```

---

## 5. Coding Standards (the Commandments)

- **#-1 — English-only codebase.** This is an international OSS project. All user-facing text (component labels, buttons, titles, errors), code comments, docs (`README.md`, `docs/*.md`), and console/log messages MUST be English. No Chinese or other non-English in those. *(This rule governs the **codebase**; this instruction file may use Chinese in operational sections.)*
- **#0 — Strict adherence to `@objectstack/spec`.** All schemas/JSON structures/types MUST follow `@objectstack/spec`. Don't invent schema properties — if the spec says `columns`, don't use `fields`. Check the spec before writing any `interface`/`type`.
- **#0.1 — Fix the metadata, not the renderer (contract-first).** Corollary to #0. This is a metadata-driven system: `@objectstack/spec` is the contract between producers and this renderer. When a piece of metadata "doesn't render," ask **first**: *is it spec-compliant? is this the long-term-correct direction?* If the metadata is off-spec, fix it at the **producer** (and have it rejected at authoring/publish) — do **not** add a lenient fallback/alias in the renderer (reading both `columns` and `fields`, coercing a malformed shape, `??`-defaulting around bad input) to make non-compliant metadata "work." A tolerant fallback fossilizes the wrong convention into a second de-facto contract, dilutes the spec, and hides the producer's bug — one strict contract beats N dialects. We own both ends, so Postel's "be liberal in what you accept" does **not** apply (that's for untrusted boundaries). Change the **spec** only when it is genuinely wrong — deliberately, in `@objectstack/spec`, never by accreting renderer-side fallbacks.
- **#1 — Protocol-agnostic.** Never hardcode `objectql.find()`. Use the DataSource interface; inject `dataSource` via `<SchemaRendererProvider dataSource={...} />`.
- **#2 — Docs-driven.** For every feature/refactor, update package `README.md` **and** `content/docs/guide/*.md`. Not done until docs reflect the code.
- **#3 — "Shadcn-native" aesthetics.** We are "serializable Shadcn". Follow Shadcn's DOM structure (`CardHeader`/`CardTitle`/`CardContent`). Always expose `className` in schema props so users can override via JSON.
- **#4 — Action system.** Actions are **data, not functions**. `@object-ui/core` is an event bus dispatching them:
  ```json
  "events": { "onClick": [
    { "action": "validate", "target": "form_1" },
    { "action": "submit", "target": "form_1" },
    { "action": "navigate", "params": { "url": "/success" } }
  ] }
  ```
- **#5 — Layout as components.** Treat `Grid`/`Stack`/`Container` as first-class. Layout schemas declare responsive columns on the node as `columns` — a number, or a breakpoint object (`columns: { xs: 1, md: 2, lg: 4 }`); never `cols`, which nothing reads (objectui#4001).
- **#6 — Type safety over magic.** No `any` — use strict generics. Map `"type": "button"` → React component via a central `ComponentRegistry`. **No `eval()` / runtime dynamic imports** to load components (security).
- **#7 — No-Touch zones (Shadcn purity).** `packages/components/src/ui/**/*.tsx` are upstream 3rd-party files overwritten by sync scripts — **never edit their logic/styles**. To change `Button`/`Dialog` behavior: create/edit a wrapper in `packages/components/src/custom/`, import the primitive from `@/ui/...`, and wrap it.
- **#8 — UI state lives where it can survive (objectui#2269, ADR-0054 C3).** Classify every piece of UI state before writing it: **addressable** (user would share it / expect it back after refresh / Back should respect it) → the **URL** (`?recordId=`, `?form=`, `?tab=` — constants in `app-shell/src/urlParams.ts`, never string literals); **preference** (stable across records/sessions) → localStorage or server prefs; **truly ephemeral** (hover, open dropdown — nobody cares if it's lost) → component state. The rule: **state that must survive a data refresh may never live only in an uncontrolled component** (that's how the detail-tab reset happened — objectui#2257). Corollary: **refresh data, don't rebuild UI** — after a save/action, invalidate the affected data (`notifyDataChanged` from `@object-ui/react`) so consumers refetch in place; never bump a `key=` to remount a subtree (it destroys scroll, collapsed sections, tab state, in-progress inline edits, and triggers a refetch storm).

---

## 6. Implementation Patterns

**Component registry (extensibility):**
```ts
// packages/core/src/registry.ts
const registry = new Map<string, ComponentImpl>();
export function registerComponent(type: string, impl: ComponentImpl) { registry.set(type, impl); }
export function resolveComponent(type: string) { return registry.get(type) || FallbackComponent; }
```

**Renderer loop (recursion):**
```tsx
// packages/react/src/SchemaRenderer.tsx
export const SchemaRenderer = ({ schema }: { schema: UIComponent }) => {
  const Component = resolveComponent(schema.type);
  const { isHidden } = useExpression(schema.hidden);
  if (isHidden) return null;
  return (
    <Component schema={schema} className={cn(schema.className)} {...schema.props}>
      {schema.children?.map(child => <SchemaRenderer key={child.id} schema={child} />)}
    </Component>
  );
};
```

---

## 7. Debugging & Browser Simulation

- **Official MSW integration** — use `@objectstack/plugin-msw` to init the mock API server (don't hand-roll fetch interceptors). Configure `MSWPlugin` with the right `baseUrl` (e.g. `/api/v1`).
- **Client data fetching** — always use `@objectstack/client`, never raw `fetch`/`axios` in components. Verify the client `baseUrl` matches the mock server.
- **Upstream fixes first** — if you hit a bug/limit in `@objectstack/*`, don't monkey-patch the app; fix the source package (if in the workspace) or report it. Prioritize fixing the core engine over patching apps.

---

## 8. AI Workflow

- **New component** (e.g. `DataTable`): define schema in `@object-ui/types` → map to Shadcn in `@object-ui/components` → get array data via `useDataScope()` (don't fetch inside the component) → register `"type": "table"` in the core registry.
- **Action logic** (e.g. open modal): add the action interface to `types` → implement the handler in the `@object-ui/core` ActionEngine → trigger via `useActionRunner()`.
- **Documentation**: show the JSON config first; describe how Tailwind `className` affects the component.

---

## 9. Operational Rules

### Housekeeping
- 截图/trace 一律存 `/tmp/`,任务尾清理。禁止写入仓库根。
- `.gitignore` 已锚定 `/*.png` 等防兜底,并额外忽略根级 `/--*` —— 名字以 `--` 开头的根文件必然是把 CLI 参数当成了输出文件名(#3193:一张叫 `--full-page` 的 68KB 截图被提交进来,因为没有 `.png` 后缀,`/*.png` 兜不住)。兜底只是最后一道,仍要主动清。
  - 删这类文件要用 `--` 断开参数解析:`rm -- ./--full-page`、`git rm -- './--full-page'`。
- 任务结束:停**自己起的**后台服务(见下方"服务纪律";别按端口杀别人的)、清 `.playwright-mcp/`。
- 改完代码提交时:**只要改了发版包的 `src/`(`.changeset/config.json` 的 `fixed` 组,含 `apps/console`),就必须新增一个 `.changeset/*.md`** —— 这一条由 `.github/workflows/changeset-presence.yml` 机械强制(objectui#3387),`pnpm changeset` 写正常 bump,**纯内部改动/只动测试就写空 frontmatter(`---` 紧跟 `---`)显式声明"不发版"**,那是合法的一等通过写法。要的是"声明一次",不是强制发版。
  - 别再按"feature 要写、bug 修复不用"来判断 —— 正是这个旧判据让三条用户可见的修复(`19716b5bf` fix(charts)、`5e7ef1141` fix(i18n)、`0e50440` #3518)搭顺风车发了出去,任何 CHANGELOG/版本号/发布记录里都查不到:平台侧的发布判据(objectstack#4731/#4843)读的就是本仓声明的 changeset。
  - 本地先自查:`node scripts/check-changeset-presence.mjs`(未提交的 changeset 也算)。

### 怎么跑测试(有两种写法会静默假绿 —— 现已机械拦截)

**唯一正确的跑法:在【仓库根目录】执行,路径相对仓根书写,前面不要加 `--`。**

```bash
pnpm exec vitest run packages/<pkg>/src/<file>.test.ts   # 只跑一个文件
pnpm exec vitest run packages/<pkg>/                     # 只跑一个包
pnpm test                                                # 全量(CI 就是它,可加 --shard=1/4)
```

AGENTS.md 的「只跑受影响的包」指的是**用上面的路径过滤缩小范围**,不是 `cd` 进包里、也不是
`pnpm --filter <pkg> test` —— 那两条恰好就是下面的陷阱。

- **陷阱一:让 vitest 的 cwd 落在包目录里(objectui#3378)。** `pnpm --filter <pkg> test`、
  `turbo run test`、`cd packages/x && pnpm exec vitest` 都属于这类。vitest 把 root 定成该
  目录,根级 projects(`unit`/`dom`/`dom-heavy`)的 include(`packages/**`、`examples/**`、
  `scripts/**`)相对它匹配不到任何文件;只有以**绝对路径**引入的 `apps/console` project 仍解析
  成功。于是跑的是 `@object-ui/console` 的 22 个文件、报 `Test Files 22 passed (22)`,而本包
  (app-shell 有 281 个)一个都没跑。**没有 "0 tests matched" 信号** —— 计数是 22 不是 0,
  `passWithNoTests` 根本不参与,按包级约定验证的 agent 会据此报「整包绿」。
- **陷阱二:把路径挂在 `--` 后面(objectui#3288)。** `pnpm --filter <pkg> test -- --run <paths>`:
  pnpm 把 `--` **原样**转发进脚本,vitest 的 CLI 解析在 `--` 处停止,后面的一切(包括你的路径)
  在 vitest 看到之前就没了 —— 不是「被忽略并警告」,是压根不存在。于是退回默认集合(叠加陷阱一
  就是别人的包),新加的测试文件零执行、输出全绿。
- **两条现在都会直接失败**,由 `scripts/vitest-invocation-guard.mjs` 拦下:vitest root 不是仓根
  → 拒绝;`--` 后面还有参数 → 拒绝。报错正文会指出机制并给出上面的正确命令。包级 `test` 脚本的
  存废是 objectui#3240;在那之前它们只失败,不撒谎。
  - **拦截点不止 `vitest.config.mts` 一处**(objectui#5406)。vitest 只加载「启动目录里的那份」
    config,所以根 config 顶部那一次调用,只覆盖得到「本包没有 config(向上找到根 config)」或
    「本包 config import 了根 config(import 即执行其模块作用域)」这两条路。11 个**独立**的
    `packages/plugin-*/vitest.config.ts` 两条都不占——它们自带 `happy-dom` + `globals` + 本地
    setup 且**完全没有 alias 表**,于是从包目录跑就用上了一份 CI 从不使用的 config,而 guard
    根本没被 import。实测:`cd packages/plugin-grid && pnpm exec vitest run
    src/__tests__/ObjectGrid.exportOptionsKeys.test.ts` 曾经报 `Test Files 1 passed (1)` /
    `Tests 5 passed (5)` 并以 0 退出。这 11 份现在各自调用 guard;新增任何一份 `vitest.config.*`
    若两条路都不占,`scripts/__tests__/vitest-invocation-guard.test.ts` 会红。
- **路径过滤零匹配也不再是绿的**:一旦命令行点名了文件,`passWithNoTests` 自动关闭 ——
  写错的路径 / 相对错目录的路径 → 非零退出,而不是「跑了 0 个文件然后绿」。
- 确需从包目录启动,把 root 显式指回仓根:`pnpm exec vitest run --root ../.. packages/<pkg>/`。
  真要临时绕过 guard(自担风险):`OBJECTUI_VITEST_GUARD=off`。

### 测试纪律(flaky 测试:先找竞态,别调超时)

单跑稳定绿、全量并行下偶发红的测试,**根因几乎总是同一个**:一段**无界的模块加载被计入了一个有界的窗口**。满并行下 Vite 的 transform 管线是饱和的(单 `dom-heavy` 项目就 ~60s transform),实测一次首包 `import()` 可达 **976ms** —— 已吃掉 RTL `findBy`/`waitFor` 默认 **1000ms** 预算的 97.6%。于是断言在和模块加载器抢时间,红绿取决于机器负载而不是被测代码。

- **断言的内容落在 `React.lazy` / 动态 `import()` 边界之后 → 在测试文件的模块作用域直接 `import` 该模块**(`import '@object-ui/plugin-charts';` + 一行注释说明原因)。成本进入 import 阶段,**不受任何 test/hook 超时约束**。specifier 必须与被测组件里的**完全一致** —— ESM 按解析后的 specifier 缓存,这样组件自己的 `React.lazy` 工厂才会立刻 resolve。
- **不要用 `beforeAll` 预热**:它受 `hookTimeout`(**10s**)约束,比它取代的 `testTimeout`(**15s**)**更窄**,那只是把问题挪个窝。**这一条现在由 lint 机械强制** —— `object-ui/no-dynamic-import-in-test-hook`(error)禁止在 `beforeAll`/`beforeEach` 体内 `await import(…)`。两种写法**不会**被它拦(都是正当的,已在规则的 RuleTester 里钉住):传给注册器的**惰性工厂**(`registerLazy('x', () => import('./x'))` —— hook 只是登记 loader,并不执行导入);以及同一 hook 里调了 `vi.resetModules()`/`doMock`/`stubEnv`/`stubGlobal` 的**故意重导入**(它必须读取只在 hook 时存在的状态,提到模块作用域反而会改坏测试)。
- **禁止**用「调高超时」或「把文件塞进 `vitest.config.mts` 的 `heavyDomTests`」来修 flaky —— 两者都只是把竞态藏起来。`heavyDomTests` 只用于 registry「`<type>` not registered」这类失败。
- 失败现场会直接指认根因:dump 里若仍是 Suspense fallback(如 `Loading report renderer…`),就是本条;**hook 超时表现为「失败的*文件* + 0 个失败*测试*」**(其余全部 skipped),别误读成断言失败。
- 顺手体检:别把 `keysOf(x)` 这类整体计算写在 `.filter()` 谓词里(每个元素重算一遍)。`all-locales-key-parity` 曾因此 7.51s,提升出谓词后 **25ms**。
- **i18n 取证纪律:凡按「排版/字符记法」做普查或断言的正则,一律 `u` flag + `\p{L}` 之类的 Unicode 属性类,禁止 ASCII `\w`/`[a-z]`。** JS 的 `\w` 不论加不加 `u` 都等于 `[A-Za-z0-9_]`,匹配不到西里尔/阿拉伯/CJK 字母 —— 本仓十个包里 **五个是非拉丁文字**,所以这类正则的结论对它们**恒为「零命中」**,而且失败方向是最坏的那种:普查报告「该包不用这种记法」,断言绿着但**从不检查任何东西**。两种形态都实际发生过(objectui#3866):PR #3847 用 `/\(\w{1,4}\)/` 普查括号复数记法,给 ru 判了「全包 0 处」,实测 `\p{L}` 是 12 处、其中就有和被查 key 同构的 `{{count}} поле(й)`;同一写法写进断言后,对 zh/ja/ko/ru/ar 五包永假空转。**改法**:`/\([\p{L}]{1,4}\)/u`,并把反例连同旧写法一起钉住(`expect(RE.test('поле(й)')).toBe(true)` + `expect(/\(\w{1,4}\)/.test('поле(й)')).toBe(false)`),否则下一个人看不出两种写法不等价。**顺带记住属性类自己的边界**:`\p{L}` 只有字母(数字括号如 `(Pos1)` 不在内),`\(` 只有 ASCII 括号(全角 U+FF08/U+FF09 不在内,zh/ja 用得不少)—— 按你要查的记法选类,查不到的那半要在 PR 里写明是界外,别默认为零。
- **本地一片 parity/schema 测试失败,先怀疑 stale install**(`node_modules` 里的 `@objectstack/spec` 版本落后于 lockfile),不是回归 —— CI 每次全新安装,永远不会命中这个。
- **别用 `prettier` 给改动做收尾检查 —— 它对未改动内容就是红的。** 本仓没有格式化门禁:没有 `.prettierrc` / `prettier.config.*` / `.prettierignore` / `.editorconfig`,没有 workflow 跑它,`eslint.config.js` 里也没有任何格式规则(全是正确性/ratchet 规则);那条从未接线的 devDependency 已随 objectui#3657 / PR #3681 删掉,仓内(排除 `pnpm-lock.yaml`)已 grep 不到 prettier。**但命令仍然跑得通** —— 容器镜像在 `/opt/node22/lib/node_modules/` 预装了一份全局 prettier(实测 3.8.1),仓内解析不到时 `pnpm exec` 会沿 PATH 兜底,任何装有全局 prettier 的机器同理。没有配置就按 prettier **默认值**(双引号、`printWidth: 80`)判定,而本仓是单引号、行宽更宽,于是**逐字节等于 `origin/main` 的文件照样报 `exit=1`**:根因是「默认配置 ≠ 本仓约定」,**不是**「`main` 没格式化」,也不是你改坏了。**禁止**据此 `--write` —— 未改动的 `scripts/check-doc-links.mjs` 单个文件就是 389 行重排(它的测试文件 1646 行),内容是 `'x'` → `"x"` 与 80 列回绕这类与你无关的 diff,会一起混进你的 PR。正确动作:忽略这份输出;本仓真接了线的检查是 `pnpm lint` / `pnpm test` 与根 `package.json` 里的 `check:*` 那几条。前情 objectui#3657、#3682。

前情:objectui#3010(一次修掉五个文件,含一个已被「超时调到 15s」糊过、满负载下依然 15021ms 超时的例子)。

### 版本号策略(version alignment)
- **objectui 的 major 与 `@objectstack`(spec/client/formula)的 major 保持一致**:依赖到 `@objectstack ^11.x` 时,objectui 这个固定版本组(`.changeset/config.json` 的 `fixed`,39 个包一起发)的 major 必须是 `11`。心智模型:**major 相同即兼容**。
- minor/patch **独立演进**——objectstack 没动时不必跟发;objectui 自己的改动照常用 changeset 推进(从当前 major 起步,如 `11.0.0 → 11.1.0`)。
- objectstack 跨 major(→12)时,下一次 objectui 发版一并把 major 提到 `12`。
- 推论:**changeset 里不要声明 `major`** —— fixed 组任一 `major` 都会把全组推上去、脱离 objectstack 的节奏(如 17.x 期间被推到 18)。objectui 自身的破坏性变更也标 `minor`(在正文里写清 breaking 语义即可);唯一例外是跟随 objectstack 跨 major 的那一次同步升级。
- **这一条现在由 CI 机械强制** —— `scripts/check-changeset-no-major.mjs` 在任一 changeset 声明 `major` 时退出非零,由 `.github/workflows/changeset-guard.yml` 跑(它是唯一以 `.changeset/**` 为**触发**路径的 workflow。这里曾写「`ci.yml`/`lint.yml` 都把 `**/*.md` 和 `.changeset/**` 列进 `paths-ignore`,只加 changeset 的 PR 不会启动任何 workflow」——**已不成立,别照它做判断**:objectui#3523 step 2 把 `paths-ignore` 从这两个 workflow 的 `pull_request` 上删掉了,今天它**只**留在 `push` 触发上;PR 的路径判断改在 job 内做 —— `ci.yml` 的 `Decide whether this change needs a full run` 步骤,`lint.yml` 有同名的一份。所以 md-only / changeset-only 的 PR **照常启动**这两个 workflow 并产出 required context —— 实测 PR #3856(只改一个 `.md`)起了 16 个 check、PR #4339(只给 AGENTS.md 加一行)起了 17 个。真正被跳过的是重活:那个 job 内开关的排除表逐条**等于** `push` 的 `paths-ignore`(仍含 `**/*.md` 与 `.changeset/**`),changeset-only 的 PR 里这两个 workflow 每一步都 skip。这才是 changeset-guard.yml 今天仍必须独立、且以 `.changeset/**` **反向**触发的理由:它跑在那个 job 内开关之外,免安装免构建,是唯一判得到 changeset-only PR 的东西。见 objectui#3523 step 2 / objectui#3857),`pnpm test` 里另有一条仓库状态断言兜底。跟随 objectstack 跨 major 的那一次发版设 `OBJECTUI_ALLOW_MAJOR=1` 放行。前情:objectui#3161/#3159/#3160/#3225 四个 changeset 在 17.x 期间标了 `major`(17 个包条目),足以把 39 个包发成 `18.0.0`。
- 这是约定优先于 semver 纯粹性的取舍(为可维护/好记),因此 objectui 的 major 不代表「它自身 API 的破坏性变更次数」。`@object-ui/site` 与 `@object-ui/example-*` 在 `ignore` 列表,不随组联动。

### 多 agent 协作纪律(并行修改本仓库,务必遵守)

本仓库有**多个 agent 并行**修改 —— 分支会被切换、共享文件会在你工作时被改动(正常现象,不是 bug):

- **只改你任务需要的文件**;别去"修"无关的 diff、回退或别人的在途编辑,也别管整棵工作树。
- **必须一个任务一个 git worktree**(`git worktree add ../objectui-<task> -b <branch> main`,新树里跑 `pnpm install`)做物理隔离 —— 这是强制而非「首选」。共享的 `main` checkout **不是**可用退路:HEAD 会被别的 agent 切换、你刚写的文件会在操作中途被 reset 掉。一个 **PreToolUse 钩子**(`.claude/hooks/guard-main-checkout.sh`)**强制**此规则:除非被编辑文件位于专属 **worktree** 否则拦截 `Edit`/`Write`/`NotebookEdit`——在共享 checkout 上开 feature 分支**也不行**(仍会被切走),且按**被编辑文件所属的仓库**判断(sibling 仓 `framework`/`cloud` 一并守住)(确属非任务的临时改动用 `OS_ALLOW_MAIN_EDITS=1` 放行)。即便在自己的 worktree 里,下面这些防御性条款仍然适用。
- **绝不 `git stash` —— stash 栈不在上一条的 worktree 隔离范围内。** `git stash` 把栈存在**共享 `.git` 目录**里的 `refs/stash`,**每个 worktree 共用同一个 LIFO 栈**:上一条的物理隔离**不覆盖它**。两个 agent 各自在自己的 worktree 里 stash,push/pop 的是同一个栈 —— 你的 `pop` 取回的是对方刚压进去的改动,你自己的改动留在栈上等着被对方取走;而 `pop` **报成功**,唯一的症状是别人的文件出现在你的 `git status` 里,随后一次 `git add -A` 就把对方的在途工作合进了你的 PR。不是假想:objectui#3430 两个并行 agent 在反向验证中间踩实,双方在途改动都丢了(只能作为 unreachable commit 捞回)。替代做法只有下面这些 —— 都不碰共享状态,都在你自己的 worktree 内,且**首选先 commit 再还原**(上面反向验证那条已把它定为标准写法):

  ```bash
  git commit -am wip                                     # 还原:git reset --soft HEAD~1
  git diff > /tmp/wip.patch && git checkout -- <paths>   # 还原:git apply /tmp/wip.patch
  git worktree add ../objectui-<task>-cmp <ref>          # 另开一棵树做对照
  ```

  三者的共同点是**先把未提交状态捕获下来**再动工作区;任何「先覆盖、事后再从某个 ref 取回」的写法都**不是**替代做法 —— 它假设你的改动已经提交,而反向验证时通常没有(objectstack#7800:那条推荐语害一个 agent 丢了在途改动)。一个 **PreToolUse 钩子**(`.claude/hooks/guard-shared-stash.sh`)**强制**此规则:拦截 push/pop/drop/clear 共享栈的 `Bash` 命令,放行拿不到别人条目的形式 —— `git stash list`/`show`/`create`,以及 `git stash apply <sha>` / `store <sha>` 且 sha 为**字面十六进制 object id**(绝不用 `stash@{N}` —— 那是你并不拥有的那个栈里的一个**位置**)。确知栈只属于你时用 `OS_ALLOW_STASH=1` 放行;改了钩子就重跑 `.claude/hooks/guard-shared-stash.selftest.sh`。
- **临时文件所在的 scratchpad 目录跨会话共享 —— 提交信息与 PR 正文一律别落到那里。** 容器发给每个会话的「scratchpad」临时目录事实上被多个并行会话映射到**同一个路径**,和上一条的 stash 栈同族:一块位于 worktree 之外的共享可写状态,worktree 隔离**管不到它**。两个 agent 各写一份同名的 `commitmsg.txt` / `pr-body.md`,后写的整份顶掉先写的;而 `git commit -F` 读到别人的文件**不报错**,每一步都报成功 —— 受害的是**另一个** agent 的产出(你的提交信息落到别人的 commit 上,你这边什么都看不出来),没有任何错误可供发现。实测在 20 分钟内撞了两次,可见的损伤是 `main` 上一条 squash commit:提交信息描述的是一张卡、diff 实施的是另一张卡,两者毫无关系;`main` 不重写,于是这条误导永久留在 git 考古里 —— 下一个人按 `git log --grep` 找那张卡,会得出「已经做过了」的错误结论。两条做法,**有先后之分**:

  1. **首选机制:让内容根本不落共享盘。** 提交信息用 `git commit -F -` 配 heredoc(或多个 `-m`),PR 正文直接作为工具参数传(用 `gh` 就把正文写成进程内的 heredoc,别先写文件再 `--body-file`)。内容不落盘,就无从被顶掉。

  ```bash
  git commit -F - <<'EOF'
  fix(scope): 一句话主题

  正文……
  EOF
  ```

  2. **次选纪律:确实需要临时文件时,文件名一律带卡号/分支号前缀**(该目录里既有的 `3309-pr.md` 就是这个惯例),**且用完即删**;写完要用之前先读回一遍,确认拿到的还是自己那份。

  两条不是并列的两个建议:前缀与删除要求每个作者每一次都记得,记性会衰减,而衰减是静默的(见上:撞车不报错);`git commit -F -` 那种形式让撞车**不可能发生**,不依赖任何人的记性。所以能用形式解决的,就别退回到纪律。这一族目前**没有钩子**兜底(上面 worktree 与 stash 两条各有一个 PreToolUse 钩子),因此这条规则的全部效力就在于你选哪种形式。
- **一个任务一个 feature 分支 + 一个 PR**;**绝不**把任务改动直接提交到 `main`。
- **绝不 `git push --force`/`--force-with-lease`,绝不推 `main`**(会覆盖并行 agent 的工作;`main` 共享,一律走 PR)。**禁令不按「这条分支是不是只有我一个人用」分档**:那个判断评估错的时候没有任何症状,而错掉的代价正是本节要防的那类静默丢工作 —— 所以它一律绝对,单人 feature 分支同样不例外。**要把自己的分支同步到当前 `main`,合规路线是 merge,不是 rebase**:`git fetch origin && git merge origin/main`,解完冲突照常 push。代价只是一个 merge commit —— 本仓 PR 一律 `--squash` 入队合并,它不会留到 `main` 上;换来的是任何一次 push 都不重写已经推上去的历史。**「要同步分支」从来不是 force-push 的理由**,别用 `git rebase origin/main` + `--force-with-lease` 去「把历史弄干净」。(入队合并本身并不要求你同步 —— 队列会在当前 `main` 上重建,见下面「不必为了合并去 rebase 其他在途分支」那条;主动同步的价值在于提前撞出别人刚落地的破坏。)
- **每次 commit/push 前先确认当前分支**(`git rev-parse --abbrev-ref HEAD`);HEAD 可能被别的 agent 切走 —— 不是你的分支就停下重新 checkout。
- 改**共享文件**(barrel/注册表):编辑→`git add`→commit 一气呵成,并核验提交确实含你的改动(`git show HEAD:<file> | grep <你的改动>`);真冲突只重加*你自己*那几行,其余交给 PR 合并。
- **要做反向验证(删掉修复 → 看预期的钉子变红 → 还原)就先把修复 commit 掉。** 提交之后,还原是 `git checkout <你的分支> -- <path>`,对着一个真实存在的 commit 取回;直接对**未提交**的改动做同一个删除(`git checkout origin/main -- <path>`)则没有任何还原点 —— 工作区就是唯一副本,而 `git stash` 一律禁用(共享 stash 栈,见本节上面「绝不 `git stash`」那条),改动当场就没了。同一天两次踩实:#4278(PR #4293)、#4243(PR #4299),两次都靠会话 transcript 逐行重打才找回来 —— transcript 不全就是净损失。#4243 那次是先 commit、再重跑一遍反向验证,最终那组红绿数字才可信。
- **本仓由 ruleset 强制走合并队列(merge queue):直接合并会被 405 拒绝。** 实测(objectui#3243,对 15/15 全绿、`mergeable_state: clean`、非 draft 的 PR #3241):

  ```
  PUT /repos/objectstack-ai/objectui/pulls/3241/merge
  → 405 Repository rule violations found
     Changes must be made through the merge queue
  ```

  实测是从 REST 端点发起的;405 正文那句 `Changes must be made through the merge queue` 拒绝的是**「直接合并」这个动作**本身,不是某个客户端,所以旧文教的 `gh pr merge --squash --delete-branch`(不带 `--auto`)这条收尾路径同样不成立(`gh` 具体报什么文案随版本变,**别按文案去猜**,认准下面的入队路径)。**撞上这个 405 不是你权限不够** —— 别去试更强的手段,也别以为要等人工审批。
- **CI 全绿即自行合并,不必等维护者确认**(授权语义没变,变的只是动作;⛔ **例外:diff 命中受管面的 PR 不适用本条** —— 见下方「受管面」,那类 PR 停在 draft 等人类合并)—— 修改完成后**只提交你任务改动的文件**(逐路径 `git add <file>`,绝不 `git add -A` 扫入无关 diff),开 **draft** PR;等远端 CI 全绿后:

  ```bash
  gh pr ready <n>                                    # 退出 draft
  gh pr merge <n> --squash --auto --delete-branch    # 挂 auto-merge = 入合并队列
  # MCP 等价物:pull request update(draft: false) + enable_pr_auto_merge
  ```

  队列会把 PR **在当前 `main` 上重建**后再落地,重建不绿就把它踢出队列,而不是把红的落到共享 `main` 上。所以旧版那条「绝不 `gh pr merge --auto`」的前提已经反转:它防的正是队列现在替你防住的事,而在强制队列的仓库里 **enable auto-merge 就是入队的标准手段**,也是本仓实际走得通的唯一通路(仓内佐证:`.github/workflows/dependabot-auto-merge.yml` 对 Dependabot PR 用的就是 `gh pr merge --auto --squash`)。注意 path-filter 跳过的检查(显示 `skipping`)不是失败,配合 `mergeStateStatus: CLEAN` 即算全绿。
- **auto-merge 会在「合并冲突」和「draft」窗口里被静默丢弃 —— 事后必须复查并重挂。** 已两次踩实(先例 PR #3458):PR 一旦变成 conflicting、或被(重新)标记为 draft,已挂上的 auto-merge 就没了,**且不会有任何通知**。解完冲突或 `gh pr ready` 之后若不重新挂一次,PR 会一直停在那里 —— 看着"全绿待合",实际谁也没在等它。收工前复查一次:`gh pr view <n> --json isDraft,mergeStateStatus,autoMergeRequest`,`autoMergeRequest` 为 `null` 就是掉了,重挂。
- **不必为了合并去 rebase 其他在途分支** —— 队列自己会在当前 `main` 上重建,旧版「串行合并、合下一个前先 rebase 在途分支」那套编排已是历史。**但队列只拦得住文本冲突和 CI 看得见的破坏**:两个各自全绿的 PR 仍可能**语义冲突**(改了同一约定的两端;一边删掉了另一边刚开始用的导出)。所以动**共享面**(barrel/注册表/公共类型/跨包约定)时,合并前扫一眼在途 PR(`gh pr list`),有交叠就在 PR 正文里写清交叠点与取并集的办法(先例:PR #3458 对 #3456 同文件交叠的说明)。
- ruleset 的**具体配置**(谁可绕过、required checks 清单)本文不写 —— 从仓内读不到,别照抄任何推断。上面几条写的都是实测到的可观测行为。

### ⛔ 受管面(governed surface):agent 起草,人类合并

维护者裁决(2026-08-18),**原文照录、不翻译** —— 提问明确点名了本仓:

> 任何对 agents.md 等文件的修改是不是也需要人类审核? 包括 objectui cloud仓库

> 同意

**本仓的受管面 —— 四项,已逐条对本仓实际目录核实:**

- `AGENTS.md` —— **你正在读的这个文件本身就是受管面**。
- `CLAUDE.md` —— 仓根一个。
- `.claude/**` —— **整棵树**:hooks、settings、launch 配置、内部 skills,一个不落,**不是只有 skills**。
- `docs/adr/**` —— 本仓**确实有**这个目录;它和上面三项同级,不因为篇数少而降级。

⚠️ **别把两棵 skills 树弄混 —— 这是本仓最容易踩的一条:**

- `.claude/skills/**` —— 内部 agent 工具,在 `.claude/**` 之内,**受管**。
- `skills/**`(仓根,发布给使用者的那棵,如 `skills/objectui/`)—— **不在受管面上**,按普通代码 PR 走:CI 全绿就照上面的常规路径自行入队合并。`.agents/skills/` 是 skill 的**安装位置**(内容由 `skills-lock.json` 还原,第三方的那些被 gitignore),不是规程文本,同样不受管。

  两棵树名字像、内容都叫 skill,判据却只有一个:**路径是不是以 `.claude/` 开头**。曾有 agent 把发布用的 `skills/` 当成「维护者专属」而不敢挂 auto-merge,PR 白等一轮 —— **往保守方向误判同样是误判**,它一样让活停在那里。

**硬规则 —— PR 的 diff 命中受管面时:**

⛔ 绝不 `gh pr ready`(不退出 draft)、⛔ 绝不加入合并队列、⛔ 绝不 `gh pr merge --auto` / `enable_pr_auto_merge`、⛔ 绝不自己合并。这类 PR **停在 draft,等人类合并**。**人类的那次合并动作本身就是审核记录** —— 不需要额外的逐 PR 批准点击,也别去等一个不存在的 approval。

- **判据是 PR 的文件清单,不是 PR 的标题或描述。** 命中与否只看路径。
- **混合 diff:一条命中即整个 PR 分叉,没有比例判断。** 99 个普通文件 + 1 个受管文件 = 整个 PR 等人类合并。其余部分急着落地,就把受管文件**拆成单独的 PR**,别用「占比很小」给自己开口子。
- **起草不受限。** 写、推分支、开 PR、按 review 修改,每个席位照做不误;被保留的只有**落地**这一个动作。
- **CI 全绿、已 review 都不构成例外。** 这类文件是后续每一次 dispatch 读的操作规程,绿灯说明不了它该不该成为规程。
- **发现自己已经挂上了怎么办**:把 PR 转回 **draft** 是唯一能可靠退出合并队列的动作 —— 只调 `disable_pr_auto_merge` 会摘掉 auto-merge 但**不取消队列成员资格**,两个都要做。⚠️ 只回收**你自己**挂上的:本仓多 agent 共用同一 GitHub 身份,不是你设置的状态就属于别的 actor —— 去问、去报告,别替他回退。

**本仓没有任何机械兜底,这一段就是全部。** 本仓没有 CODEOWNERS(核实:仓内不存在该文件),受管面上没有 required check、没有钩子,也没有事后审计把受管面的合并列出来给任何人看 —— 违规会**静默成功**,不会有任何人被通知。`../objectstack` 有一份 report-only 的合并后审计(`scripts/pm/check-governed-merges.mjs`),它只读那个仓自己的合并,**不覆盖本仓**。所以在本仓,这条规则的全部效力就在于你读到了它并照做。**本段没点名的兜底工具,就是不存在的工具**;哪天本仓真有了检测,它会写在这里。

### 服务纪律(本仓库与 `../objectstack` 多 agent 并行开发)

本仓库和 `../objectstack` 都有多个 agent 同时开发,正在运行的 dev 服务很可能是**别人的**:

- **要测试就自己起临时服务**(自选空闲端口),**绝不随手停/杀别人的服务** —— 发现端口被占先 `lsof -i :PORT` 看清是谁的,不是你起的就换端口,不要 kill。
- **开发完成必须关掉自己起的服务**,只清理自己启动的进程(按记下的 PID 杀,不要按端口/进程名一锅端)。

### Local dev — console UI ↔ backend (read before debugging UI)

- **启动前端**:仓根 `pnpm --filter @object-ui/console dev`(Vite,固定 **:5180**,见 `apps/console/vite.config.ts`)。
- **后端默认连 `:3000`**:vite `/api` proxy → `DEV_PROXY_TARGET || http://localhost:3000`。**要测哪个后端就把它跑在 :3000**(framework 仓:`PORT=3000 pnpm dev:crm`,或 `PORT=3000 pnpm dev` = showcase)。经 `pnpm --filter @object-ui/console dev` 传 `DEV_PROXY_TARGET` env **不**可靠(不一定透传到 vite 子进程);要把 console 指向别的后端端口,`cd apps/console` 后内联设 env 才灵(已实测——见下「每个 agent 独立测试栈」)。
- `framework` 的 `:3001/_console` 服务的是**已发布的** console(`packages/console/dist`),**不是本仓 src**;改 src 必须用上面的 :5180 dev 服务验证(或在 framework 跑 `pnpm objectui:refresh` 重新拉构建——慢)。
- 路由用 app 的 **`name`**(如 `showcase_app`,不是 `showcase`);直接 URL 进对象可能落到 Setup「对象不存在」——先经启动台/应用切换进入该 app 设好 currentApp。
- **清 localStorage 会登出**(session token 存 localStorage;首页应用磁贴也读 localStorage 缓存,跨会话会显示过期的 app 列表)。
- better-auth 用 `localhost`(非 `127.0.0.1`)否则 Invalid origin。
- 浏览器验证:优先用桌面 preview(`preview_*`,`.claude/launch.json` 里配 `showcase-console`);chrome-devtools MCP 掉线时切 preview。

### 每个 agent 独立测试栈(端口隔离,多 agent 并行的推荐做法)

上面是**单栈**约定(后端 :3000 + 前端 :5180);多 agent 并行时端口会打架。要彻底隔离,每人起**自己端口**的一整套栈(后端 + console),互不干扰。**下面这套已实测端到端跑通**(console 代理登录 + 从自己后端拉到 `showcase_account` 的 Northwind/Contoso):

1. **后端(`../objectstack`)—— `--fresh` 临时库 + 自选端口**,数据与端口都隔离、退出自动清:
   ```bash
   # showcase(带 showcase_field_zoo / showcase_account 等):
   cd ../objectstack/examples/app-showcase
   pnpm exec objectstack dev --seed-admin --fresh -p 4010
   #  --fresh        临时 sqlite 库(os.tmpdir()/objectstack-dev-*),SIGINT/SIGTERM 自动删,绝不碰别人的 .objectstack/data/dev.db
   #  -p <port>      监听端口(等价 OS_PORT / PORT;dev 模式端口被占会自动顺延)
   #  --seed-admin   默认开;空库播种 admin@objectos.ai / admin123
   # CRM:  cd ../objectstack/examples/app-crm && pnpm exec objectstack dev --seed-admin --fresh -p <port>
   # 要持久库(跨重启保留):去掉 --fresh,改用 --database "file:/tmp/agent-<port>.db"(或 OS_DATABASE_URL)
   ```
   干净 checkout 首次需先 `pnpm setup`(build `@objectstack/spec`);已装过的直接可跑。

2. **Console(你的 objectui worktree)—— 自选端口 + 指向你的后端**:
   ```bash
   cd apps/console
   DEV_PROXY_TARGET=http://localhost:4010 pnpm exec vite --port 5190 --strictPort
   #  必须 cd 进 apps/console 让 env 直达 vite;用 `pnpm --filter … dev` 传 env 不可靠
   #  --strictPort   端口被占直接报错,绝不静默顺延撞到别人的端口上
   ```
   自检:`curl 'http://localhost:5190/api/v1/data/showcase_account?$top=2'`(经 console 代理打到你的 :4010,应返回 Northwind/Contoso)。

3. **Live E2E —— 全 env 参数化指向你的端口**(见 `playwright.live.config.ts` / `e2e/live/global-setup.ts`):
   ```bash
   LIVE_APP_URL=http://localhost:5190 LIVE_API_URL=http://localhost:4010 pnpm test:e2e:live
   #  凭据用 LIVE_EMAIL / LIVE_PASSWORD 覆盖(默认 admin@objectos.ai / admin123)
   ```

4. **桌面 preview**:给 `.claude/launch.json` 加一条你自己的 console 配置,仿现成的 `console-build-test`(`cd apps/console && DEV_PROXY_TARGET=http://localhost:<后端> pnpm dev --port <前端> --strictPort`)。

**纪律**:端口自选空闲高位(用前 `lsof -i :PORT` 确认没人占);收工只按**自己记下的 PID** 收(`kill $(lsof -ti tcp:<你的端口>)`),`--fresh` 临时库随进程退出自动清;**绝不动 :3000 / :5180**(通常是别人的单栈)。

### Edit sizing
Keep single `edit`/`create` payloads under ~20000 bytes. If an edit fails, break it into multiple smaller ones.
