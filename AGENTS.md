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
  - ❌ No inline styles (`style={{}}`), CSS Modules, or styled-components.
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
- **#5 — Layout as components.** Treat `Grid`/`Stack`/`Container` as first-class. Layout schemas support responsive props (`cols: { sm: 1, md: 2, lg: 4 }`).
- **#6 — Type safety over magic.** No `any` — use strict generics. Map `"type": "button"` → React component via a central `ComponentRegistry`. **No `eval()` / runtime dynamic imports** to load components (security).
- **#7 — No-Touch zones (Shadcn purity).** `packages/components/src/ui/**/*.tsx` are upstream 3rd-party files overwritten by sync scripts — **never edit their logic/styles**. To change `Button`/`Dialog` behavior: create/edit a wrapper in `packages/components/src/custom/`, import the primitive from `@/ui/...`, and wrap it.

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
- `.gitignore` 已锚定 `/*.png` 等防兜底,但仍要主动清。
- 任务结束:停**自己起的**后台服务(见下方"服务纪律";别按端口杀别人的)、清 `.playwright-mcp/`。
- 改完代码提交时:功能改进(feature)需写 changeset(`pnpm changeset`);纯 bug 修复不需要。

### 版本号策略(version alignment)
- **objectui 的 major 与 `@objectstack`(spec/client/formula)的 major 保持一致**:依赖到 `@objectstack ^11.x` 时,objectui 这个固定版本组(`.changeset/config.json` 的 `fixed`,39 个包一起发)的 major 必须是 `11`。心智模型:**major 相同即兼容**。
- minor/patch **独立演进**——objectstack 没动时不必跟发;objectui 自己的改动照常用 changeset 推进(从当前 major 起步,如 `11.0.0 → 11.1.0`)。
- objectstack 跨 major(→12)时,下一次 objectui 发版一并把 major 提到 `12`。
- 这是约定优先于 semver 纯粹性的取舍(为可维护/好记),因此 objectui 的 major 不代表「它自身 API 的破坏性变更次数」。`@object-ui/site` 与 `@object-ui/example-*` 在 `ignore` 列表,不随组联动。

### 多 agent 协作纪律(并行修改本仓库,务必遵守)

本仓库有**多个 agent 并行**修改 —— 分支会被切换、共享文件会在你工作时被改动(正常现象,不是 bug):

- **只改你任务需要的文件**;别去"修"无关的 diff、回退或别人的在途编辑,也别管整棵工作树。
- **必须一个任务一个 git worktree**(`git worktree add ../objectui-<task> -b <branch> main`,新树里跑 `pnpm install`)做物理隔离 —— 这是强制而非「首选」。共享的 `main` checkout **不是**可用退路:HEAD 会被别的 agent 切换、你刚写的文件会在操作中途被 reset 掉。一个 **PreToolUse 钩子**(`.claude/hooks/guard-main-checkout.sh`)**强制**此规则:HEAD 在 `main` 上时拦截 `Edit`/`Write`/`NotebookEdit`(确属非任务的临时改动用 `OS_ALLOW_MAIN_EDITS=1` 放行)。即便在自己的 worktree 里,下面这些防御性条款仍然适用。
- **一个任务一个 feature 分支 + 一个 PR**;**绝不**把任务改动直接提交到 `main`。
- **绝不 `git push --force`/`--force-with-lease`,绝不推 `main`**(会覆盖并行 agent 的工作;`main` 共享,一律走 PR)。
- **每次 commit/push 前先确认当前分支**(`git rev-parse --abbrev-ref HEAD`);HEAD 可能被别的 agent 切走 —— 不是你的分支就停下重新 checkout。
- 改**共享文件**(barrel/注册表):编辑→`git add`→commit 一气呵成,并核验提交确实含你的改动(`git show HEAD:<file> | grep <你的改动>`);真冲突只重加*你自己*那几行,其余交给 PR 合并。
- **合并前必须等远端 CI 全绿,绝不 `gh pr merge --auto`** —— auto-merge 可能把还红着的 PR 落到共享 `main` 上,弄脏所有并行 agent 的基线。串行合并;合下一个前先 rebase 其他在途分支。注意 path-filter 跳过的检查(显示 `skipping`)配合 `mergeStateStatus:CLEAN` 即算全绿,不是失败。
- **CI 全绿即自行合并,不必等维护者确认** —— 修改完成后**只提交你任务改动的文件**(逐路径 `git add <file>`,绝不 `git add -A` 扫入无关 diff),开 PR;待测试/CI 全部通过后直接 `gh pr merge --squash --delete-branch`。测试通过就是合并门槛。

### 服务纪律(本仓库与 `../framework` 多 agent 并行开发)

本仓库和 `../framework` 都有多个 agent 同时开发,正在运行的 dev 服务很可能是**别人的**:

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

1. **后端(`../framework`)—— `--fresh` 临时库 + 自选端口**,数据与端口都隔离、退出自动清:
   ```bash
   # showcase(带 showcase_field_zoo / showcase_account 等):
   cd ../framework/examples/app-showcase
   pnpm exec objectstack dev --seed-admin --fresh -p 4010
   #  --fresh        临时 sqlite 库(os.tmpdir()/objectstack-dev-*),SIGINT/SIGTERM 自动删,绝不碰别人的 .objectstack/data/dev.db
   #  -p <port>      监听端口(等价 OS_PORT / PORT;dev 模式端口被占会自动顺延)
   #  --seed-admin   默认开;空库播种 admin@objectos.ai / admin123
   # CRM:  cd ../framework/examples/app-crm && pnpm exec objectstack dev --seed-admin --fresh -p <port>
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
