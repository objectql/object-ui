---
"@object-ui/types": minor
"@object-ui/core": minor
"@object-ui/react": minor
"@object-ui/components": minor
"@object-ui/fields": minor
"@object-ui/layout": minor
"@object-ui/data-objectstack": minor
"@object-ui/i18n": minor
"@object-ui/auth": minor
"@object-ui/tenant": minor
"@object-ui/permissions": minor
"@object-ui/mobile": minor
"@object-ui/cli": minor
"@object-ui/runner": minor
"@object-ui/create-plugin": minor
"@object-ui/plugin-aggrid": minor
"@object-ui/plugin-ai": minor
"@object-ui/plugin-calendar": minor
"@object-ui/plugin-charts": minor
"@object-ui/plugin-chatbot": minor
"@object-ui/plugin-dashboard": minor
"@object-ui/plugin-designer": minor
"@object-ui/plugin-detail": minor
"@object-ui/plugin-editor": minor
"@object-ui/plugin-form": minor
"@object-ui/plugin-gantt": minor
"@object-ui/plugin-grid": minor
"@object-ui/plugin-kanban": minor
"@object-ui/plugin-list": minor
"@object-ui/plugin-map": minor
"@object-ui/plugin-markdown": minor
"@object-ui/plugin-report": minor
"@object-ui/plugin-timeline": minor
"@object-ui/plugin-view": minor
"@object-ui/plugin-workflow": minor
"object-ui": minor
---

Upgrade to @objectstack v3.0.0 and console bundle optimization

- Upgraded all @objectstack/* packages from ^2.0.7 to ^3.0.0
- Breaking change migrations: Hub → Cloud namespace, definePlugin removed, PaginatedResult.value → .records, PaginatedResult.count → .total, client.meta.getObject() → client.meta.getItem()
- Console bundle optimization: split monolithic 3.7 MB chunk into 17 granular cacheable chunks (95% main entry reduction)
- Added gzip + brotli pre-compression via vite-plugin-compression2
- Lazy MSW loading for build:server (~150 KB gzip saved)
- Added bundle analysis with rollup-plugin-visualizer
