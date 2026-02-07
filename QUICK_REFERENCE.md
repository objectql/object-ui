# Quick Reference Guide | 快速参考指南

## 📍 Where to Find Everything

### Documentation | 文档

#### ObjectOS Integration
**File:** `content/docs/guide/objectos-integration.mdx`  
**URL:** https://www.objectui.org/docs/guide/objectos-integration  
**Topics:**
- Integration architecture
- Quick start guide
- Multi-tenancy support
- RBAC integration
- 3 deployment strategies
- Migration from competitors

#### Console Rendering
**File:** `content/docs/guide/console-rendering.mdx`  
**URL:** https://www.objectui.org/docs/guide/console-rendering  
**Topics:**
- Terminal/CLI rendering
- Ink integration
- CLI tool examples
- Server console setup
- Best practices

#### AG Grid (Chinese)
**File:** `content/docs/plugins/plugin-aggrid.zh-CN.mdx`  
**URL:** https://www.objectui.org/docs/plugins/plugin-aggrid.zh-CN  
**Topics:**
- 完整的中文文档
- 交互式示例
- API 参考

---

### Storybook Stories | 故事示例

**File:** `packages/components/src/stories-json/object-aggrid-advanced.stories.tsx`  
**Run:** `pnpm storybook`  
**Navigate to:** Plugins > Data Views > Object AgGrid Advanced

**Stories:**
1. Status Bar & Aggregations - 状态栏和聚合
2. Context Menu - 右键菜单
3. Inline Editing + Row Selection - 行内编辑
4. Full Featured - 完整功能
5. Alpine Theme (Full Featured)
6. Balham Theme + Export
7. Material Theme + Status Bar

---

### Development Plans | 开发计划

#### Integration Roadmap
**File:** `OBJECTOS_INTEGRATION_ROADMAP.md`  
**Scope:** 12 months (Q1-Q4 2026)  
**Phases:**
- Q1: Foundation (Multi-tenant, RBAC, System Objects)
- Q2: Enterprise Features (Workflows, Collaboration)
- Q3: Production Readiness (Performance, i18n, Security)
- Q4: Ecosystem Expansion (Marketplace, Cloud Platform)

#### Complete Summary
**File:** `UPDATE_SUMMARY.md`  
**Contents:**
- Package scan results
- All documentation updates
- Storybook enhancements
- Impact assessment
- Next steps

---

## 🎯 Quick Commands

### View Documentation Locally
```bash
cd /home/runner/work/objectui/objectui
pnpm site:dev
# Visit http://localhost:3000
```

### Run Storybook
```bash
pnpm storybook
# Visit http://localhost:6006
```

### Build Project
```bash
pnpm build
```

### Run Examples
```bash
# CRM with console
pnpm serve:crm
# Visit http://localhost:3000/console

# Todo example
pnpm serve:todo

# Kitchen Sink
pnpm serve:kitchen-sink
```

---

## 📋 Checklist for Next Developer

### Immediate Tasks
- [ ] Review `UPDATE_SUMMARY.md`
- [ ] Review `OBJECTOS_INTEGRATION_ROADMAP.md`
- [ ] Test Storybook stories locally
- [ ] Verify documentation renders correctly

### Short-term (Next Sprint)
- [ ] Create console-showcase example
- [ ] Enhance kitchen-sink with AG Grid features
- [ ] Add more Chinese translations
- [ ] Create ObjectOS integration example

### Medium-term (Next Quarter)
- [ ] Implement Phase 1 of roadmap (Foundation)
- [ ] Build multi-tenancy support
- [ ] Implement RBAC system
- [ ] Integrate system objects

---

## 🔗 Important Links

### Documentation
- ObjectOS Integration: `/content/docs/guide/objectos-integration.mdx`
- Console Rendering: `/content/docs/guide/console-rendering.mdx`
- AG Grid Chinese: `/content/docs/plugins/plugin-aggrid.zh-CN.mdx`

### Storybook
- Advanced Stories: `/packages/components/src/stories-json/object-aggrid-advanced.stories.tsx`

### Planning
- Roadmap: `/OBJECTOS_INTEGRATION_ROADMAP.md`
- Summary: `/UPDATE_SUMMARY.md`

### Examples
- CRM: `/examples/crm/`
- Todo: `/examples/todo/`
- Kitchen Sink: `/examples/kitchen-sink/`

---

## 💡 Key Concepts

### ObjectOS Integration
1. **Adapter Pattern**: Use `ObjectStackAdapter` for data layer
2. **Multi-tenancy**: Implement via `TenantProvider`
3. **RBAC**: Use `PermissionGuard` components
4. **Workflows**: Define state machines in schemas

### Console Rendering
1. **Ink Framework**: React for CLI applications
2. **CLI-Table3**: Terminal table rendering
3. **Inquirer**: Interactive prompts
4. **Chalk**: Colored terminal output

### Internationalization
1. **Pattern**: Create `.zh-CN.mdx` files alongside `.mdx`
2. **Translation**: Keep schema structure, translate content
3. **Navigation**: Update `meta.json` for language-specific pages

---

## 🎓 Learning Resources

### Created in This PR
- **ObjectOS Integration Guide** - Learn how to integrate with ObjectOS
- **Console Rendering Patterns** - Build CLI tools with ObjectUI
- **Chinese Documentation Example** - See i18n implementation
- **Development Roadmap** - Understand the 12-month plan

### Existing Resources
- Main README: `/README.md`
- Improvement Plan: `/IMPROVEMENT_PLAN.md`
- Contributing Guide: `/CONTRIBUTING.md`
- Examples: `/examples/`

---

## 📞 Support

For questions about:
- **Documentation**: Check `UPDATE_SUMMARY.md`
- **Integration**: See `OBJECTOS_INTEGRATION_ROADMAP.md`
- **Implementation**: Review examples in `/examples/`
- **Issues**: GitHub Issues

---

**Last Updated:** 2026-02-07  
**Status:** ✅ Complete and Ready for Review
