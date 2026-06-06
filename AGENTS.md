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
- 任务结束:停后台服务(`lsof -i :PORT -t`)、清 `.playwright-mcp/`。
- 改完代码提交时:功能改进(feature)需写 changeset(`pnpm changeset`);纯 bug 修复不需要。

### 多 agent 协作纪律(并行修改本仓库,务必遵守)

本仓库有**多个 agent 并行**修改 —— 分支会被切换、共享文件会在你工作时被改动(正常现象,不是 bug):

- **只改你任务需要的文件**;别去"修"无关的 diff、回退或别人的在途编辑,也别管整棵工作树。
- **首选一个任务一个 git worktree**(`git worktree add ../objectui-<task> -b <branch>`)做物理隔离;下面这些防御性条款适用于必须共用同一工作树的情况。
- **一个任务一个 feature 分支 + 一个 PR**;**绝不**把任务改动直接提交到 `main`。
- **绝不 `git push --force`/`--force-with-lease`,绝不推 `main`**(会覆盖并行 agent 的工作;`main` 共享,一律走 PR)。
- **每次 commit/push 前先确认当前分支**(`git rev-parse --abbrev-ref HEAD`);HEAD 可能被别的 agent 切走 —— 不是你的分支就停下重新 checkout。
- 改**共享文件**(barrel/注册表):编辑→`git add`→commit 一气呵成,并核验提交确实含你的改动(`git show HEAD:<file> | grep <你的改动>`);真冲突只重加*你自己*那几行,其余交给 PR 合并。
- **合并前必须等远端 CI 全绿,绝不 `gh pr merge --auto`** —— auto-merge 可能把还红着的 PR 落到共享 `main` 上,弄脏所有并行 agent 的基线。串行合并;合下一个前先 rebase 其他在途分支。注意 path-filter 跳过的检查(显示 `skipping`)配合 `mergeStateStatus:CLEAN` 即算全绿,不是失败。

### Local dev — console UI ↔ backend (read before debugging UI)

- **启动前端**:仓根 `pnpm --filter @object-ui/console dev`(Vite,固定 **:5180**,见 `apps/console/vite.config.ts`)。
- **后端默认连 `:3000`**:vite `/api` proxy → `DEV_PROXY_TARGET || http://localhost:3000`。**要测哪个后端就把它跑在 :3000**(framework 仓:`PORT=3000 pnpm dev:crm`,或 `PORT=3000 pnpm dev` = showcase)。经 `pnpm --filter` 传 `DEV_PROXY_TARGET` env 不一定透传到 vite 子进程——优先把后端跑在 :3000,别依赖 env 覆盖。
- `framework` 的 `:3001/_console` 服务的是**已发布的** console(`packages/console/dist`),**不是本仓 src**;改 src 必须用上面的 :5180 dev 服务验证(或在 framework 跑 `pnpm objectui:refresh` 重新拉构建——慢)。
- 路由用 app 的 **`name`**(如 `showcase_app`,不是 `showcase`);直接 URL 进对象可能落到 Setup「对象不存在」——先经启动台/应用切换进入该 app 设好 currentApp。
- **清 localStorage 会登出**(session token 存 localStorage;首页应用磁贴也读 localStorage 缓存,跨会话会显示过期的 app 列表)。
- better-auth 用 `localhost`(非 `127.0.0.1`)否则 Invalid origin。
- 浏览器验证:优先用桌面 preview(`preview_*`,`.claude/launch.json` 里配 `showcase-console`);chrome-devtools MCP 掉线时切 preview。

### Edit sizing
Keep single `edit`/`create` payloads under ~20000 bytes. If an edit fails, break it into multiple smaller ones.
