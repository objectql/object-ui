# ObjectUI Development Roadmap

> **Last Updated:** February 12, 2026
> **Current Version:** v0.5.x
> **Spec Version:** @objectstack/spec v3.0.0
> **Client Version:** @objectstack/client v3.0.0
> **Current Priority:** 🎯 Developer Experience · User Experience · Component Excellence · Documentation

---

## 📋 Executive Summary

ObjectUI is a universal Server-Driven UI (SDUI) engine built on React + Tailwind + Shadcn. It renders JSON metadata from the @objectstack/spec protocol into pixel-perfect, accessible, and interactive enterprise interfaces.

**Where We Are:** The foundation is solid — 35 packages, 91+ components, 200+ test files, 68 Storybook stories, 98% spec compliance, and all 42 builds passing. The @objectstack/spec v3.0.0 migration is complete, and the Console v1.0 production build is optimized and shipping.

**What's Next:** Before expanding to marketplace or cloud features, we are focusing on **developer experience** and **user experience**. A full-repository audit (Feb 2026) identified concrete improvement areas across all 35 packages, 4 examples, the Console app, 128 documentation pages, and 68 Storybook stories. The re-prioritized focus is:

1. **🛠️ Developer Experience (DX)** — Zero-friction onboarding, discoverable APIs, helpful errors, complete docs
2. **🎨 User Experience (UX)** — Console polish, i18n completeness, accessibility, performance at scale
3. **🧩 Component Excellence** — Every component polished, well-tested, and delightful to use
4. **📖 Documentation** — Complete API docs, rich Storybook stories, tutorials, and guides

> 📄 Companion documents:
> - [SPEC_COMPLIANCE_EVALUATION.md](./SPEC_COMPLIANCE_EVALUATION.md) — Per-package spec compliance (98% current)
> - [OBJECTSTACK_CLIENT_EVALUATION.md](./OBJECTSTACK_CLIENT_EVALUATION.md) — Client SDK evaluation (100% protocol coverage)
> - [DESIGNER_UX_ANALYSIS.md](./DESIGNER_UX_ANALYSIS.md) — Designer UX improvement plan

---

## ✅ Completed Milestones

Everything below has been built, tested, and verified. These items are stable and shipping.

### Foundation (Q1 2026)

Accessibility (AriaProps injection, WCAG 2.1 AA audit with axe-core), responsive design (breakpoint-aware layouts), I18n deep integration (10 languages, RTL, plural rules, locale-aware formatting), I18nLabel handling across all schema fields, 80%+ test coverage with E2E (Playwright) and visual regression (Storybook snapshots), and critical bug fixes (DataScope, plugin-ai handlers, plugin-detail data fetching, plugin-map error handling).

### Interactive Experience (Q2 2026)

Drag-and-drop framework (DndProvider + useDnd for Kanban, Dashboard, Calendar, Grid, Sidebar), gesture & touch support (swipe, pinch, long-press via useSpecGesture), focus management & keyboard navigation (focus traps, keyboard shortcuts, CRUD shortcuts), animation & motion system (7 presets, reduced-motion aware), notification system (toast/banner/snackbar with full CRUD), view enhancements (gallery, column summary, grouping, row color, density modes, view sharing), Console UX (skeleton loading, toast notifications, responsive sidebar, onboarding walkthrough, global search, favorites), and Designer Phase 1 (ARIA attributes, keyboard shortcuts, empty states, zoom controls across all 5 designers).

### Enterprise & Offline (Q3 2026)

Offline-first architecture (offline detection, sync queue, conflict resolution, auto-sync, IndexedDB persistence, ETag caching), real-time collaboration (@object-ui/collaboration with live cursors, presence, comment threads, conflict resolution), performance optimization (Web Vitals tracking, performance budgets, performance dashboard), and page transitions (9 transition types with View Transitions API support).

### Console v1.0 Production Release

Bundle optimization (main entry 48.5 KB gzip, 17 granular chunks, 95% reduction from monolithic build), Gzip + Brotli pre-compression, MSW lazy-loading with full exclusion in server mode, bundle analysis tooling, and production hardening (CSP headers, modulepreload hints, cache documentation, error tracking guide, performance budget CI).

### v3.0.0 Deep Integration

Full adoption of Cloud namespace, contracts/integration/security/studio modules, v3.0.0 PaginatedResult API (records/total/hasMore), updated ObjectStackAdapter metadata API, and 17 compatibility tests.

### Designer Completion

All 4 phases complete across 5 designers (Page, View, DataModel, Process, Report): drag-and-drop positioning, undo/redo with command pattern, confirmation dialogs, edge creation UI, inline editing, full property editors with live preview, canvas pan/zoom with minimap, auto-layout algorithms, copy/paste, multi-select, responsive panels, real-time collaboration integration, live cursors, synchronized undo/redo, and version history.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: @objectstack/spec v3.0.0 (The Protocol)                  │
│  Pure TypeScript type definitions — 12 export modules               │
│  ❌ No runtime code. No React. No dependencies.                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ imports (never redefines)
┌──────────────────────────────▼──────────────────────────────────────┐
│  Layer 2: @object-ui/types (The Bridge)                             │
│  Re-exports spec types + ObjectUI-specific schemas                  │
│  ❌ No runtime code. Zero dependencies.                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ consumed by
┌──────────────────────────────▼──────────────────────────────────────┐
│  Layer 3: Implementations (The Runtime)                             │
│  core (Registry, Expressions, Validation, Actions)                  │
│  react (SchemaRenderer, Hooks, Providers)                           │
│  components (91+ Shadcn-based renderers)                            │
│  fields (35+ field widgets)                                         │
│  layout (AppShell, Page, SidebarNav)                                │
│  plugin-* (Grid, Kanban, Calendar, Charts, etc.)                   │
│  auth / tenant / permissions / i18n (Infrastructure)                │
│  data-objectstack (ObjectStackAdapter)                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Full-Repository Audit (February 2026)

> A comprehensive scan of the entire codebase and documentation, analyzed from both **Developer Experience (DX)** and **User Experience (UX)** perspectives.

### Audit Scope

| Area | Count | Notes |
|------|-------|-------|
| Packages | 35 | 27 with README, 10 missing README |
| Components | 91+ | 48 base UI + 14 custom + 29 renderers |
| Field Widgets | 36+ | Consistent FieldWidgetProps pattern |
| Storybook Stories | 68 | Good coverage, some gaps in edge-case stories |
| Documentation Pages | 128 | .mdx files across 8 categories |
| Test Files | 200+ | 3,235+ tests, 80% coverage |
| Examples | 4 | todo, crm, kitchen-sink, msw-todo |
| CLI Commands | 11 | init, build, dev, serve, doctor, etc. |
| I18n Locales | 11 | ar, de, en, es, fr, ja, ko, pt, ru, zh + RTL |
| CI Workflows | 13 | CI, CodeQL, Storybook, perf budget, etc. |

### Key Findings

**Strengths:**
- Solid architecture with clear layer separation (spec → types → core → react → components)
- Excellent quick-start guide (`content/docs/guide/quick-start.md`, 197 lines)
- Clean app bootstrapping (`apps/console/src/main.tsx`, 44 lines, well-commented)
- 11 CLI commands with `doctor` for environment diagnosis
- Per-component error boundaries with retry (SchemaErrorBoundary)
- 13 CI/CD workflows including performance budgets and visual regression

**Gaps Identified:**
- 10 packages missing README: auth, tenant, permissions, i18n, mobile, collaboration, plugin-ai, plugin-designer, plugin-workflow, plugin-report
- 20+ React hooks exported without JSDoc documentation
- Console has hardcoded English strings (LoadingScreen, KeyboardShortcutsDialog) outside i18n
- MIGRATION_GUIDE.md referenced in README but does not exist
- Types package has minimal JSDoc on exported interfaces
- No interactive schema playground in documentation site
- Core error messages lack error codes and actionable fix suggestions

---

## 🎯 Current Priorities

> All foundation work is complete. Priorities re-ordered based on the Feb 2026 audit, with DX and UX front and center.

### P1. Developer Experience 🛠️

**Goal:** A developer can go from `git clone` to a running app in under 5 minutes, with discoverable APIs, helpful errors, and complete documentation at every step.

#### P1.1 Zero-Friction Onboarding
- [x] Create MIGRATION_GUIDE.md at repo root (currently referenced in README but missing)
- [ ] Streamline `npx create-objectui-app` scaffolding with working Vite + Tailwind templates
- [ ] Ensure `pnpm install && pnpm dev` starts the console with zero additional configuration
- [x] Add a standalone "Hello World" example (5-file, <50 lines total) demonstrating JSON → UI flow
- [ ] Provide copy-paste-ready schema examples in the root README for instant gratification

#### P1.2 API Discoverability & JSDoc
- [x] Add JSDoc comments to all 20+ exported React hooks (`useExpression`, `useActionRunner`, `useViewData`, `useDynamicApp`, `usePerformance`, `useCrudShortcuts`, etc.)
- [x] Add JSDoc with usage examples to key types in `@object-ui/types` (`SchemaNode`, `FieldMetadata`, `ViewSchema`, `ActionSchema`, etc.)
- [ ] Document all context providers (`ThemeContext`, `AuthContext`, `I18nContext`, `NotificationContext`, `DndContext`) with usage examples
- [ ] Ensure TypeScript autocompletion works smoothly for all schema types via strict discriminated unions

#### P1.3 Error Messages & Debugging
- [x] Create error code system (`OBJUI-001`, `OBJUI-002`, etc.) with documentation links
- [x] Improve SchemaErrorBoundary to show actionable fix suggestions in dev mode (e.g., "Missing field 'type'. Did you mean to use a PageSchema?")
- [x] Replace generic `console.warn()` calls in core with structured error factory
- [x] Add `OBJECTUI_DEBUG=true` mode with schema resolution tracing and component render timing
- [ ] Ensure console warnings for deprecated APIs include migration code snippets

#### P1.4 CLI Tooling Polish
- [ ] Verify `objectui init` produces a buildable project with all dependencies resolved
- [ ] Enhance `objectui doctor` to check TypeScript version, Tailwind config, and peer dependencies
- [ ] Verify `create-plugin` template produces a plugin with working tests and Storybook story
- [ ] Add `objectui validate <schema.json>` command for schema linting with actionable error messages
- [ ] Resolve 8 TODO/FIXME items in CLI code (`doctor.ts`, `dev.ts`, `check.ts`)

#### P1.5 Package READMEs (10 Missing)
- [x] Add README for `@object-ui/auth` — authentication guards, login/register forms, AuthContext
- [x] Add README for `@object-ui/tenant` — multi-tenancy support, TenantProvider, branding
- [x] Add README for `@object-ui/permissions` — RBAC, PermissionGuard, usePermissions hook
- [x] Add README for `@object-ui/i18n` — 11 locales, RTL support, I18nProvider, formatting utilities
- [x] Add README for `@object-ui/mobile` — responsive hooks, gesture support, touch optimization
- [x] Add README for `@object-ui/collaboration` — live cursors, presence, comment threads, conflict resolution
- [x] Add README for `@object-ui/plugin-ai` — AI form assistance, recommendations, NL query
- [x] Add README for `@object-ui/plugin-designer` — 5 visual designers (Page, View, DataModel, Process, Report)
- [x] Add README for `@object-ui/plugin-workflow` — approval processes, workflow designer
- [x] Add README for `@object-ui/plugin-report` — report builder, viewer, exporter, scheduling

---

### P2. User Experience 🎨

**Goal:** Every interaction in the Console and rendered UIs is fast, polished, accessible, and works flawlessly in all supported languages.

#### P2.1 Console i18n Completeness
- [x] Migrate hardcoded strings in `LoadingScreen.tsx` to i18n keys ("ObjectStack Console", "Initializing application...")
- [x] Migrate hardcoded strings in `KeyboardShortcutsDialog.tsx` to i18n keys
- [ ] Audit all `apps/console/src/components/` for remaining hardcoded UI strings
- [x] Remove all Chinese UI strings; enforce English-only with i18n key lookups
- [ ] Add locale switcher to Console settings panel

#### P2.2 Console Architecture Cleanup
- [ ] Consolidate hand-wired ObjectView into plugin-based ObjectView (eliminate duplication)
- [ ] Replace lightweight local data adapter with official `@object-ui/data-objectstack`
- [ ] Replace custom `defineConfig()` with standard `defineStack()` configuration
- [ ] Register all missing plugins properly in the plugin registry
- [ ] Convert hardcoded view tabs to schema-driven configuration

#### P2.3 Accessibility & Inclusive Design
- [ ] Run axe-core audit on Console pages (currently 30 tests on primitives, not on assembled pages)
- [ ] Ensure focus management across all Console navigation flows (sidebar → content → modal → back)
- [ ] Verify screen reader experience for complex views (Grid, Kanban, Calendar)
- [ ] Test all color combinations against WCAG 2.1 AA contrast ratios in both light and dark themes
- [ ] Add `prefers-reduced-motion` respect to all animations (page transitions, DnD, skeleton loading)

#### P2.4 Performance at Scale
- [ ] Benchmark Grid/Kanban/Calendar with 1,000+ and 10,000+ records; set performance baselines
- [ ] Implement virtual scrolling for large data grids (plugin-grid, plugin-aggrid)
- [ ] Profile and optimize initial Console load (target: < 2s on 3G, currently ~3s estimated)
- [ ] Add loading skeleton states for all async data views
- [ ] Test view switching (grid ↔ kanban ↔ calendar) state preservation with large datasets

#### P2.5 Console Feature Completeness
- [ ] Verify CRUD end-to-end for all object types (create, read, update, delete, bulk operations)
- [ ] Verify command palette (⌘K) searches across all entity types
- [ ] Ensure dark/light theme toggle is consistent across all pages with no flash
- [ ] Test responsive layout on tablet (768px) and mobile (375px) breakpoints
- [ ] Verify inline editing in grid view with save/cancel/validation feedback

---

### P3. Component Excellence 🧩

**Goal:** Every component is polished, consistent, well-tested, and delightful to use.

#### P3.1 Component Quality Audit
- [ ] Audit all 91+ components for API consistency (prop naming, default values, error states)
- [ ] Ensure every component has complete TypeScript types with JSDoc descriptions
- [ ] Standardize error/empty/loading states across all components using shared primitives
- [ ] Add missing edge-case handling (overflow, truncation, null data, large datasets)

#### P3.2 Field Widget Polish
- [ ] Audit all 36+ field widgets for consistent validation feedback (error message placement, color, icon)
- [ ] Ensure all fields work correctly in all form variants (simple, tabbed, wizard, split, drawer, modal)
- [ ] Test field widgets with extreme inputs (10,000-char strings, MAX_SAFE_INTEGER, emoji, RTL text)
- [ ] Polish date/time/datetime pickers for timezone edge cases and locale formatting

#### P3.3 Plugin View Robustness
- [ ] Verify all 13+ view types handle empty data, loading, and error states gracefully
- [ ] Ensure consistent toolbar, filter, and sort behavior across all views
- [ ] Validate view switching preserves selection state, scroll position, and filter criteria
- [ ] Add E2E tests for critical view workflows (Grid → detail → back, Kanban drag-and-drop)

#### P3.4 Test Coverage
- [ ] Increase test coverage from 80% → 90% (target: 4,000+ tests)
- [ ] Identify and cover components with < 80% test coverage
- [ ] Add integration tests for complex interactions (DnD + undo/redo, form validation + submit)
- [ ] Add snapshot tests for critical UI output consistency

#### P3.5 Storybook Enhancement
- [ ] Ensure every exported component has at least one Storybook story (target: 91+ stories from current 68)
- [ ] Add interactive controls (args) for all major props in each story
- [ ] Add "edge case" stories per component (empty data, error state, loading, overflow, RTL)
- [ ] Organize stories with consistent categorization (Components / Fields / Layout / Plugins)

---

### P4. Documentation 📖

**Goal:** Comprehensive, accurate, and easy-to-navigate documentation that is a developer's best friend.

#### P4.1 Guide Content
- [ ] Verify "Getting Started" guide (`quick-start.md`) stays current with latest API
- [ ] Write "Building a CRUD App" end-to-end tutorial (complete walkthrough: schema → data → deploy)
- [ ] Write "Custom Plugin Development" guide with best practices and template walkthrough
- [ ] Write "Theming & Customization" guide (Tailwind config, cva variants, dark mode, CSS custom properties)
- [ ] Add deployment guides for examples (Docker, Vercel, Railway configurations)

#### P4.2 API Reference
- [ ] Generate API reference docs from TypeScript types (TSDoc → documentation site)
- [ ] Document all schema types with annotated examples (ViewSchema, ActionSchema, FieldSchema, etc.)
- [ ] Add interactive schema playground on documentation site (JSON editor → live preview)
- [ ] Document expression engine syntax and all built-in functions with examples

#### P4.3 Storybook as Living Documentation
- [ ] Ensure Storybook serves as the primary component reference alongside docs site
- [ ] Add usage documentation (MDX) alongside each component story
- [ ] Add accessibility notes for each component (keyboard shortcuts, ARIA roles, screen reader behavior)
- [ ] Deploy Storybook to a publicly accessible URL (storybook.objectui.org)

#### P4.4 Architecture & Internals
- [ ] Document the layer architecture (spec → types → core → react → components → plugins) with data flow diagrams
- [ ] Document the plugin system architecture (registration, lifecycle, lazy loading)
- [ ] Add troubleshooting guide for common development issues
- [ ] Document CI/CD pipeline architecture (13 workflows, their triggers and responsibilities)

---

## 🔮 Future Vision (Deferred)

> The following items are **not** in the current sprint. They will be re-evaluated once P1–P4 are substantially complete.

### Ecosystem & Marketplace
- Plugin marketplace website with search, ratings, and install count
- Plugin publishing CLI (`objectui publish`) with automated validation
- 25+ official plugins
- Plugin contract enforcement via contracts module

### Community Growth
- Official website (www.objectui.org) with interactive playground
- Discord community
- Monthly webinars, technical blog, YouTube tutorials
- Conference talks and contributor program

### ObjectUI Cloud (2027)
- Project hosting, online editor, Database as a Service
- One-click deployment, performance monitoring
- Billing system (Free / Pro / Enterprise)

### Industry Solutions (2027)
- CRM, ERP, HRM, E-commerce, Project Management accelerators
- Technology & channel partnerships
- AI-powered schema generation from natural language

---

## 📈 Success Metrics

| Metric | Current (Feb 2026) | Short-Term Target | How Measured |
|--------|--------------------|--------------------|--------------|
| **Test Coverage** | 80% | 90% | `pnpm test:coverage` |
| **Test Count** | 3,235+ | 4,000+ | `pnpm test` summary |
| **Spec Compliance** | 98% | 100% | SPEC_COMPLIANCE_EVALUATION.md |
| **Storybook Stories** | 68 | 91+ (1 per component) | Story file count |
| **Package READMEs** | 27/35 (77%) | 35/35 (100%) | README.md presence |
| **Hooks with JSDoc** | ~5/20+ (~25%) | 20+/20+ (100%) | Grep `/** */` in hooks |
| **Console i18n Coverage** | ~80% | 100% | No hardcoded strings |
| **Build Status** | 42/42 pass | 42/42 pass | `pnpm build` |
| **WCAG AA Compliance** | Primitives only | Full Console pages | axe-core audit |
| **CLI Commands Working** | 11 | 11 (all verified) | `objectui doctor` |
| **TODO/FIXME Count** | 8 files | 0 | Grep `TODO\|FIXME\|HACK` |

### DX Success Criteria
- [ ] New developer can `git clone` → `pnpm install` → `pnpm dev` → see Console in < 5 minutes
- [ ] `objectui init my-app` creates a buildable project with zero errors
- [ ] Every exported function/hook/type has JSDoc with at least one usage example
- [ ] Invalid schema input produces an error message with fix suggestion and docs link

### UX Success Criteria
- [ ] Console loads in < 2s on simulated 3G connection
- [ ] All Console UI strings are internationalized (0 hardcoded strings)
- [ ] Grid view handles 10,000+ records without jank (< 100ms interaction latency)
- [ ] Full keyboard navigation for all Console workflows (no mouse required)

---

## ⚠️ Risk Management

| Risk | Mitigation |
|------|------------|
| **New developer abandons due to poor onboarding** | P1.1 zero-friction setup; MIGRATION_GUIDE.md; "Hello World" example |
| **Spec changes (post v3.0.0)** | Strict "import, never redefine" rule; type updates propagate automatically |
| **Performance regression** | Performance budgets in CI, PerformanceConfigSchema monitoring, 10K-record benchmarks |
| **i18n regression (new hardcoded strings)** | ESLint rule to detect string literals in JSX; i18n coverage metric in CI |
| **Component API inconsistency** | Audit checklist, automated prop-type validation, Storybook as source of truth |
| **Documentation drift** | TSDoc generation from source, Storybook stories alongside code, link checker CI |
| **Accessibility regression** | axe-core tests on full Console pages (not just primitives), WCAG AA CI check |

---

## 📚 Reference Documents

- [SPEC_COMPLIANCE_EVALUATION.md](./SPEC_COMPLIANCE_EVALUATION.md) — Per-package v3.0.0 compliance (98% current)
- [OBJECTSTACK_CLIENT_EVALUATION.md](./OBJECTSTACK_CLIENT_EVALUATION.md) — Client SDK evaluation (100% protocol coverage)
- [DESIGNER_UX_ANALYSIS.md](./DESIGNER_UX_ANALYSIS.md) — Designer UX improvement plan
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Contribution guidelines
- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) — Developer quick reference

---

## 🎯 Getting Involved

### For Contributors
- Review [CONTRIBUTING.md](./CONTRIBUTING.md)
- Check [Good First Issues](https://github.com/objectstack-ai/objectui/labels/good%20first%20issue)

### For Plugin Developers
- Read [Plugin Development Guide](./content/docs/guide/plugin-development.mdx)

---

**Roadmap Status:** 🎯 Active — Developer Experience · User Experience · Component Excellence · Documentation
**Next Review:** March 15, 2026
**Contact:** hello@objectui.org | https://github.com/objectstack-ai/objectui
