# ObjectUI Development Roadmap

> **Last Updated:** February 10, 2026  
> **Current Version:** v0.5.x  
> **Target Version:** v2.0.0  
> **Spec Version:** @objectstack/spec v2.0.1

---

## 📋 Executive Summary

ObjectUI is a universal Server-Driven UI (SDUI) engine built on React + Tailwind + Shadcn, designed to become the world's most popular enterprise management software platform framework. This roadmap consolidates all development plans, including spec alignment, ObjectOS integration, and ecosystem expansion.

**Strategic Goals:**
- **Technical Excellence:** 100% @objectstack/spec compatibility, 80%+ test coverage, world-class performance
- **Enterprise-Ready:** Multi-tenancy, RBAC, workflow engine, real-time collaboration
- **Global Reach:** 10+ languages, 10,000+ GitHub stars, 50,000+ weekly NPM downloads
- **Commercial Success:** ObjectUI Cloud platform, 100+ enterprise customers, $2M+ annual revenue

---

## 🔍 @objectstack/client Evaluation Summary

> 📄 Full evaluation: [OBJECTSTACK_CLIENT_EVALUATION.md](./OBJECTSTACK_CLIENT_EVALUATION.md)

**Verdict: ✅ @objectstack/client can fully support developing a complete low-code app UI based on @objectstack/spec.**

**Coverage Score: 22/24 protocol features (92%) implemented today.**

| Domain | Client API Coverage | ObjectUI Implementation | Score |
|--------|-------------------|------------------------|-------|
| **Data CRUD** | `data.find/get/create/update/delete` | ObjectStackAdapter | ✅ 100% |
| **Metadata** | `meta.getObject/getItem` | Schema-driven rendering | ✅ 100% |
| **UI Views** | Schema → 13+ view types | 20 plugin packages | ✅ 100% |
| **Actions** | 5 action types + batch ops | ActionExecutor | ✅ 95% |
| **Auth** | Token + custom fetch | @object-ui/auth | ✅ 100% |
| **Permissions** | Server-side role data | @object-ui/permissions | ✅ 100% |
| **Multi-Tenancy** | X-Tenant-ID header | @object-ui/tenant | ✅ 100% |
| **Advanced** | Workflow, AI, Reports | Plugin packages | ✅ 85% |
| **Real-time** | WebSocket (planned) | 🔲 Q3 2026 | ⚠️ Gap |
| **Offline** | Service Worker sync | 🔲 Q3 2026 | ⚠️ Gap |

**Key Integration Points:**
- **Dynamic Token Injection:** `ObjectStackAdapter({ fetch: createAuthenticatedFetch(authClient) })`
- **Schema-Driven Rendering:** `meta.getObject()` → SchemaRenderer pipeline
- **App Loading:** `meta.getItem('apps', id)` → Dynamic app configuration
- **Metadata Caching:** Built-in MetadataCache with TTL + LRU eviction

---

## 🎯 Current Status (February 2026)

### Achievements ✅

**Architecture & Quality:**
- ✅ 35 packages in monorepo (20 plugins, 4 core, 11 tools)
- ✅ 91+ components fully documented
- ✅ 57+ Storybook stories with interactive demos
- ✅ TypeScript 5.9+ strict mode (100%)
- ✅ React 19 + Tailwind CSS + Shadcn UI
- ✅ ~100% @objectstack/spec v2.0.1 coverage
- ✅ @objectstack/client integration validated (92% protocol coverage)

**Recent Completions (v0.5.0):**
- ✅ Form variants (simple, tabbed, wizard, split, drawer, modal)
- ✅ NavigationConfig (7 modes: page, drawer, modal, split, popover, new_window, none)
- ✅ Action System (5 types: script, url, modal, flow, api)
- ✅ Theme System (aligned with spec, CSS custom properties, dark mode)
- ✅ Page System (4 types: record, home, app, utility with region-based layouts)
- ✅ ViewData API Provider (api, value, object providers)
- ✅ AG Grid advanced features (inline editing, CSV export, status bar, context menu)

### Current Gaps & Priorities ⚠️

**Critical Gaps (P0):**
- ⚠️ Test coverage: 62% lines, 43% functions (Target: 80%+)
- ⚠️ Internationalization: No built-in i18n support
- ⚠️ Performance: Bundle size 200KB, LCP 1.2s (Target: 150KB, 600ms)

**Authentication & Console Gaps (P0):**
- ✅ Authentication package (@object-ui/auth with AuthProvider, useAuth, AuthGuard, forms)
- ✅ Console integration (auth routes, AuthGuard, UserMenu in sidebar, real auth session)
- ✅ Session management & token injection into @objectstack/client
- ✅ System admin UIs (sys_user, sys_org, sys_role, sys_audit_log)

**ObjectOS Integration Gaps (P1):**
- ✅ Multi-tenant architecture support (@object-ui/tenant)
- ✅ RBAC integration (object/field/row-level permissions) (@object-ui/permissions)
- ✅ System objects (sys_user, sys_org, sys_role, sys_permission, sys_audit_log)
- ✅ Workflow engine integration
- 🔲 Real-time collaboration (WebSocket, presence, comments)

**@objectstack/client Integration Gaps (P1):**
- ✅ Dynamic app loading from server metadata via `adapter.getApp()` + `useDynamicApp` hook
- ✅ Widget manifest system for runtime widget registration (WidgetManifest + WidgetRegistry)
- 🔲 Formula functions in expression engine (SUM, AVG, TODAY, NOW, IF)
- ✅ Schema hot-reload via cache invalidation (`useDynamicApp.refresh()`)
- 🔲 File upload integration via client file API

**Spec Alignment Gaps (P1):**
- ✅ Widget System (WidgetManifest, WidgetRegistry, dynamic loading)
- 🔲 Formula functions (SUM, AVG, TODAY, NOW, IF)
- 🔲 Report export (PDF, Excel)

---

## 🗺️ 2026 Development Roadmap

### Q1 2026: Foundation Strengthening (Jan-Mar) ✅ In Progress

**Goal:** Solidify infrastructure, improve quality, and establish global reach

#### 1.1 Test System Enhancement (4 weeks)
**Target:** 80%+ test coverage

- [x] Add tests for all core modules (@object-ui/core)
- [x] Add tests for all components (@object-ui/components)
- [x] Add E2E test framework (Playwright)
- [ ] Add performance benchmark suite
- [ ] Visual regression tests (Storybook snapshot + Chromatic)

#### 1.2 Internationalization (i18n) Support (3 weeks)
**Target:** 10+ languages, RTL layout

- [x] Create @object-ui/i18n package
- [x] Integrate i18next library
- [x] Add translation support to all components
- [x] Provide 10+ language packs (zh, en, ja, ko, de, fr, es, pt, ru, ar)
- [x] RTL layout support
- [x] Date/currency formatting utilities

#### 1.3 Documentation System Upgrade (2 weeks)
**Target:** World-class documentation

- [x] 5-minute quick start guide
- [ ] Complete zero-to-deployment tutorial
- [ ] Video tutorial series
- [ ] Complete case studies (CRM, E-commerce, Analytics, Workflow)
- [ ] Multi-language documentation (Chinese, English, Japanese)

#### 1.4 Performance Optimization (3 weeks)
**Target:** 50%+ performance improvement

- [x] Enhanced lazy loading with retry and error boundaries
- [x] Plugin preloading utilities

**Performance Targets:**
- First Contentful Paint: 800ms → 400ms
- Largest Contentful Paint: 1.2s → 600ms
- Bundle Size: 200KB → 140KB (gzipped)

#### 1.5 Console Authentication System (6 weeks)
**Target:** Complete login-to-usage flow using @objectstack/client + better-auth

> 📄 Detailed plan: [CONSOLE_AUTH_PLAN.md](./CONSOLE_AUTH_PLAN.md)  
> 📄 Client evaluation: [OBJECTSTACK_CLIENT_EVALUATION.md](./OBJECTSTACK_CLIENT_EVALUATION.md)

**Phase 1 — Auth Foundation (Week 1-2):**
- [x] Create `@object-ui/auth` package (AuthProvider, useAuth, AuthGuard)
- [x] Integrate better-auth client (`createAuthClient`, session management)
- [x] Implement LoginForm, RegisterForm, ForgotPasswordForm (Shadcn UI)
- [x] Implement authenticated fetch wrapper for @objectstack/client token injection

**Phase 2 — Console Integration (Week 3-4):**
- [x] Add /login, /register, /forgot-password routes to Console
- [x] Wrap app routes with AuthGuard (redirect unauthenticated users)
- [x] Connect AuthProvider → ExpressionProvider → PermissionProvider chain
- [x] Add UserMenu to AppSidebar footer (profile, settings, sign out)
- [x] Replace hardcoded user context with real auth session

**Phase 3 — System Administration (Week 5-6):**
- [x] Define system objects (sys_user, sys_org, sys_role, sys_permission, sys_audit_log)
- [x] Build user management page (reuse plugin-grid + plugin-form)
- [x] Build organization management page with member management
- [x] Build role management page with permission assignment matrix
- [x] Build user profile page (profile edit, password change)
- [x] Build audit log viewer (read-only grid)

#### 1.6 @objectstack/client Low-Code Integration (3 weeks)
**Target:** Validate and enhance client SDK integration for full low-code platform capability

> 📄 Full evaluation: [OBJECTSTACK_CLIENT_EVALUATION.md](./OBJECTSTACK_CLIENT_EVALUATION.md)

**Dynamic App Loading (Week 1):**
- [x] Implement dynamic app configuration loading via `adapter.getApp(appId)`
- [x] Add server-side schema fetching with fallback to static config (`useDynamicApp` hook)
- [x] Schema hot-reload via MetadataCache invalidation + re-render (`refresh()`)

**Widget System Foundation (Week 2):**
- [x] Define WidgetManifest interface for runtime widget registration
- [x] Implement plugin auto-discovery from server metadata (WidgetRegistry)
- [x] Custom widget registry for user-defined components

**Data Integration Hardening (Week 3):**
- [ ] File upload integration via extended ObjectStackAdapter
- [x] Connection resilience testing (auto-reconnect, error recovery)
- [ ] End-to-end data flow validation with live ObjectStack backend

**Deliverables:**
- @object-ui/auth package ✅
- Console login / register / password reset pages ✅
- System administration pages (users, orgs, roles, audit logs) ✅
- Dynamic app loading from server metadata ✅
- Widget manifest system ✅
- @objectstack/client integration hardening (in progress)

**Q1 Milestone:**
- **v0.6.0 Release (March 2026):** Infrastructure Complete + Auth Foundation + Client Integration Validated

---

### Q2 2026: Feature Enhancement & ObjectOS Integration (Apr-Jun)

**Goal:** Complete @objectstack/spec alignment and enterprise features

#### 2.1 Complete @objectstack/spec v2.0.1 Alignment (6 weeks)

- [x] ObjectQL deep integration (JOIN, aggregation, subqueries)
- [x] Complete ViewSchema implementation
- [x] ActionSchema enhancement (batch ops, transactions, undo/redo)
- [x] Permission System (RBAC, field/row-level)
- [x] Validation System enhancement

#### 2.2 Multi-Tenancy & RBAC Integration (4 weeks)

- [x] Tenant Context Provider
- [x] Tenant isolation and scoped queries
- [x] Custom branding per tenant
- [x] Object/field/row-level permissions
- [x] Permission guards and hooks

**Deliverables:**
- @object-ui/tenant package ✅
- @object-ui/permissions package ✅

#### 2.3 System Objects Integration (2 weeks)

> ⬆️ Auth-related system objects (sys_user, sys_org, sys_role) are initiated in Q1 §1.5 Phase 3.
> Q2 focuses on completing advanced features and integration hardening.

- [ ] Complete sys_permission advanced UI (conditional permissions, sharing rules)
- [ ] sys_audit_log advanced features (search, export, retention policies)
- [ ] Pre-built UI components (org tree visualization, role assignment matrix)
- [ ] Admin console polish and production readiness
- [ ] OAuth provider management UI (GitHub, Google, SAML SSO)

#### 2.4 Enterprise-Grade Features (4 weeks)

- [x] Advanced Grid (tree grid, grouping, Excel export)
- [x] Reporting Engine (visual designer, PDF export, scheduling)
- [x] Workflow Engine (visual designer, approval processes)
- [x] AI Integration (form filling, recommendations, NL queries)

#### 2.5 Mobile Optimization (3 weeks)

- [x] Mobile-responsive components
- [x] PWA support (Service Worker, offline caching)
- [x] Touch gesture support

**Deliverables:**
- @object-ui/mobile package ✅

#### 2.6 @objectstack/client Full-Stack Integration (4 weeks)
**Target:** Complete low-code platform capability validated by client evaluation

> 📄 Based on: [OBJECTSTACK_CLIENT_EVALUATION.md](./OBJECTSTACK_CLIENT_EVALUATION.md)

**Expression Engine Enhancement (Week 1-2):**
- [ ] Formula functions: SUM, AVG, COUNT, MIN, MAX
- [ ] Date functions: TODAY, NOW, DATEADD, DATEDIFF
- [ ] Logic functions: IF, AND, OR, NOT, SWITCH
- [ ] String functions: CONCAT, LEFT, RIGHT, TRIM, UPPER, LOWER
- [ ] Integration with ObjectQL aggregation queries via @objectstack/client

**Report Export Integration (Week 2-3):**
- [ ] PDF export with live data from `adapter.find()` queries
- [ ] Excel export with formatted columns and formulas
- [ ] Scheduled report generation via workflow triggers

**Server-Side Transaction Support (Week 3-4):**
- [ ] Transaction wrapper for multi-step operations via @objectstack/client
- [ ] Optimistic UI updates with rollback on failure
- [ ] Batch operation progress tracking with connection-aware retry

**Q2 Milestone:**
- **v1.0.0 Release (June 2026):** Feature Complete + Full @objectstack/client Integration

---

### Q3 2026: Ecosystem Building (Jul-Sep)

**Goal:** Build thriving ecosystem and add collaboration features

#### 3.1 Real-time Collaboration (4 weeks)

> ⚠️ Identified as a gap in @objectstack/client evaluation — requires WebSocket infrastructure

- [ ] WebSocket integration with @objectstack/client real-time channels
- [ ] Live cursors and presence indicators
- [ ] Comment threads and @mentions
- [ ] Conflict resolution and version history
- [ ] Offline queue with sync-on-reconnect via Service Worker

**Deliverables:**
- @object-ui/collaboration package

#### 3.2 Plugin Marketplace (8 weeks)

- [ ] Plugin marketplace website
- [ ] Plugin publishing platform
- [ ] 20+ official plugins (WeChat, DingTalk, Stripe, OAuth, etc.)
- [ ] Plugin development guide

#### 3.3 Visual Designer Upgrade (6 weeks)

- [x] Drag-and-drop page designer
- [x] Data model designer (ER diagrams)
- [x] Process designer (BPMN 2.0)
- [x] Report designer
- [x] Multi-user collaborative editing

**Deliverables:**
- @object-ui/plugin-designer package ✅

#### 3.4 Community Building (Ongoing)

- [ ] Official website (www.objectui.org)
- [ ] Discord community
- [ ] Monthly webinars
- [ ] Technical blog (weekly posts)
- [ ] YouTube tutorials (weekly)

**Q3 Milestone:**
- **v1.5.0 Release (September 2026):** Ecosystem Thriving
  - 30+ plugins
  - 5,000+ GitHub stars
  - 1,000+ community members

---

### Q4 2026: Commercialization & Cloud Platform (Oct-Dec)

**Goal:** Launch ObjectUI Cloud and achieve commercial success

#### 4.1 ObjectUI Cloud (8 weeks)

- [ ] Project hosting and online editor
- [ ] Database as a Service
- [ ] One-click deployment
- [ ] Performance monitoring and alerts
- [ ] Billing system (Free, Pro $49/mo, Enterprise $299/mo)

#### 4.2 Industry Solutions (Ongoing)

- [ ] CRM System
- [ ] ERP System
- [ ] HRM System
- [ ] E-commerce Backend
- [ ] Project Management

#### 4.3 Partner Ecosystem (Ongoing)

- [ ] Technology partnerships (AWS, Alibaba Cloud, MongoDB)
- [ ] Channel partnerships (system integrators, consulting firms)
- [ ] 10+ strategic partners

**Q4 Milestone:**
- **v2.0.0 Release (December 2026):** Commercial Success
  - 1,000+ cloud users
  - 50+ enterprise customers
  - $500k annual revenue

---

## 📈 2026 Annual Targets

| Metric | Q1 | Q2 | Q3 | Q4 |
|--------|-----|-----|-----|-----|
| **Test Coverage** | 80% | 85% | 90% | 90% |
| **Spec Alignment** | 85% | 100% | 100% | 100% |
| **Client Integration** | 92% | 95% | 100% | 100% |
| **Performance (LCP)** | 0.6s | 0.5s | 0.5s | 0.4s |
| **GitHub Stars** | 1K | 2.5K | 5K | 10K |
| **NPM Downloads/week** | 5K | 10K | 20K | 50K |
| **Plugins** | 17 | 20 | 30 | 35 |
| **Enterprise Customers** | - | 5 | 25 | 50 |
| **Annual Revenue** | - | - | $100K | $500K |

---

## 💰 Resource Requirements

### Team Structure (15 people)
- Senior Full-Stack Engineer: 3
- Frontend Engineer: 4
- Backend Engineer: 2
- QA Engineer: 2
- DevOps Engineer: 1
- Technical Writer: 1
- Product Manager: 1
- UI/UX Designer: 1

### Budget (12 months)
- Personnel: $1,200,000
- Infrastructure: $60,000
- Tools & Software: $30,000
- Marketing: $140,000
- Contingency (10%): $143,000
- **Total: $1,573,000**

### Expected ROI
- Year 1 Revenue: $550K
- Year 2 Revenue: $2.2M

---

## ⚠️ Risk Management

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Spec Changes | Medium | High | Regular sync with ObjectStack team |
| Performance Issues | Medium | Medium | Early testing, optimization sprints |
| Security Vulnerabilities | Low | High | Security audits, bug bounty |
| Competition | High | Medium | Differentiation, rapid iteration |
| Low Adoption | Medium | High | Enhanced marketing, lower barriers |

---

## 📚 Reference Documents

This roadmap consolidates information from:

1. **IMPROVEMENT_PLAN.md** - Comprehensive 12-month improvement plan
2. **OBJECTOS_INTEGRATION_ROADMAP.md** - ObjectOS integration specifications
3. **apps/console/DEVELOPMENT_PLAN.md** - Console development plan
4. **UPDATE_SUMMARY.md** - Recent updates summary
5. **.github/copilot-instructions.md** - Architectural guidelines
6. **CONSOLE_AUTH_PLAN.md** - Console authentication & full-flow development plan (@objectstack/client + better-auth)
7. **OBJECTSTACK_CLIENT_EVALUATION.md** - Comprehensive evaluation of @objectstack/client for low-code app UI development (92% protocol coverage, 22/24 features)

For detailed technical specifications, implementation patterns, and historical context, please refer to these source documents.

---

## 🎯 Getting Involved

### For Contributors
- Review [CONTRIBUTING.md](./CONTRIBUTING.md)
- Join our [Discord](https://discord.gg/objectui)
- Check [Good First Issues](https://github.com/objectstack-ai/objectui/labels/good%20first%20issue)

### For Enterprise Users
- Explore [Enterprise Services](https://www.objectui.org/enterprise)
- Request a demo: hello@objectui.org

### For Plugin Developers
- Read [Plugin Development Guide](./content/docs/guide/plugin-development.mdx)
- Submit plugins to the marketplace

---

**Roadmap Status:** ✅ Active  
**Next Review:** March 1, 2026  
**Contact:** hello@objectui.org | https://github.com/objectstack-ai/objectui
