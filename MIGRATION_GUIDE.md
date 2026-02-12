# Migration Guide

## Migrating to v3.0.0

This guide covers migrating from `@objectstack/spec` v2.x to v3.0.0 and from `@objectstack/client` v2.x to v3.0.0. These are the upstream dependencies that ObjectUI builds on — if you use ObjectUI with ObjectStack, follow these steps when upgrading.

> **Tip:** The v3.0.0 migration in ObjectUI is complete (see [CHANGELOG.md](./CHANGELOG.md)). This guide helps you migrate your own application code.

---

### Breaking Changes

| Change | v2.x | v3.0.0 |
|--------|------|--------|
| **Namespace rename** | `Hub` | `Cloud` |
| **Plugin definition** | `definePlugin()` | Removed — use `defineStack()` only |
| **Paginated results** | `.value` / `.count` | `.records` / `.total` (+ `.hasMore`) |
| **Metadata API** | `client.meta.getObject(name)` | `client.meta.getItem('object', name)` |
| **New modules** | — | `contracts`, `integration`, `security`, `studio` |

---

### Step-by-Step Migration

#### 1. Update Dependencies

```bash
# Update all @objectstack packages to v3.0.0
npm install @objectstack/spec@^3.0.0 @objectstack/client@^3.0.0
# or with pnpm
pnpm add @objectstack/spec@^3.0.0 @objectstack/client@^3.0.0
```

#### 2. Replace Hub → Cloud Namespace

Search your codebase for `Hub` namespace references and replace with `Cloud`:

```typescript
// ❌ v2.x
import { Hub } from '@objectstack/spec';

// ✅ v3.0.0
import { Cloud } from '@objectstack/spec';
```

#### 3. Replace definePlugin → defineStack

`definePlugin()` has been removed. Use `defineStack()` for all configuration, including plugins, apps, objects, and dashboards.

```typescript
// ❌ v2.x
import { definePlugin } from '@objectstack/spec';
export default definePlugin({ name: 'my-plugin', objects: [/* ... */] });

// ✅ v3.0.0
import { defineStack } from '@objectstack/spec';
export default defineStack({
  manifest: { id: 'my-app', name: 'my_app', version: '1.0.0', type: 'app' },
  objects: [/* ... */],
  apps: [/* ... */],
});
```

#### 4. Update PaginatedResult Fields

All paginated responses now use `.records` and `.total` instead of `.value` and `.count`. The new `.hasMore` boolean simplifies infinite-scroll patterns.

```typescript
// ❌ v2.x
const result = await client.data.find('accounts', query);
const items = result.value;    // array of records
const count = result.count;    // total count

// ✅ v3.0.0
const result = await client.data.find('accounts', query);
const items = result.records;  // array of records
const count = result.total;    // total count
const more = result.hasMore;   // boolean — are there more pages?
```

If you have custom data adapters, update all references:

```typescript
// ❌ v2.x adapter
return { data: response.value, total: response.count };

// ✅ v3.0.0 adapter
return { data: response.records, total: response.total };
```

#### 5. Update Metadata API Calls

The `meta.getObject()` convenience method is replaced by the unified `meta.getItem()` API.

```typescript
// ❌ v2.x
const schema = await client.meta.getObject('account');

// ✅ v3.0.0
const schema = await client.meta.getItem('object', 'account');
```

Other metadata patterns:

```typescript
const view = await client.meta.getItem('account', 'views/list');  // view definition
const app = await client.meta.getItem('apps', 'crm');             // app definition
```

---

### API Quick Reference

```typescript
// Hub → Cloud
Hub.*                  → Cloud.*

// definePlugin → defineStack
definePlugin({ ... })  → defineStack({ manifest: { ... }, objects: [...] })

// PaginatedResult
result.value           → result.records
result.count           → result.total
/* new */                 result.hasMore

// Metadata API
meta.getObject(name)   → meta.getItem('object', name)
```

---

### New Features in v3.0.0

#### Contracts Module

Validate plugin contracts and generate manifests for the marketplace:

```typescript
import { validatePluginContract, generateContractManifest } from './contracts';

const result = validatePluginContract({
  name: 'my-plugin',
  version: '1.0.0',
  exports: [{ name: 'GridView', type: 'component' }],
  permissions: ['data.read'],
});
// result.valid === true, result.errors === []
```

#### Integration Module

Register external service integrations with event-driven triggers:

```typescript
import { IntegrationManager } from './integration';

const manager = new IntegrationManager();
manager.register('slack-notify', {
  provider: 'slack',
  enabled: true,
  config: { webhookUrl: 'https://hooks.slack.com/...' },
  triggers: [{ event: 'record.created' }],
});
```

#### Security Module

CSP headers, audit logging, and field-level data masking:

```typescript
import { SecurityManager } from './security';

const security = new SecurityManager({
  csp: { scriptSrc: ["'self'"], connectSrc: ["'self'", 'https://api.example.com'] },
  dataMasking: {
    rules: [
      { field: 'ssn', strategy: 'partial', visibleChars: 4 },
      { field: 'password', strategy: 'redact' },
    ],
  },
});
const masked = security.maskRecord({ ssn: '123-45-6789', password: 'secret' });
// masked.ssn === '123-*******', masked.password === '[REDACTED]'
```

#### Studio Module

Canvas configuration helpers for visual designers:

```typescript
import { createDefaultCanvasConfig, snapToGrid } from './studio';

const canvas = createDefaultCanvasConfig({ width: 1600, showMinimap: true });
const snapped = snapToGrid(13, 27, 8); // { x: 16, y: 24 }
```

---

### Troubleshooting

#### `definePlugin is not a function`

`definePlugin` was removed in v3.0.0. Replace all usages with `defineStack()`. See [Step 3](#3-replace-defineplugin--definestack) above.

#### `result.value is undefined` in data grids

Paginated results no longer have `.value`. Update to `.records`:

```bash
grep -rn '\.value' --include='*.ts' --include='*.tsx' | grep -i 'result\|response\|paginated'
```

#### `client.meta.getObject is not a function`

The `getObject()` method was replaced by the unified `getItem()` API. See [Step 5](#5-update-metadata-api-calls).

#### TypeScript errors after upgrade

Ensure all `@objectstack/*` packages are on v3.0.0. Mixing v2 and v3 packages causes type conflicts:

```bash
npm ls @objectstack/spec @objectstack/client
```

#### Further Resources

- [CHANGELOG.md](./CHANGELOG.md) — Full list of changes in each release
- [ROADMAP.md](./ROADMAP.md) — Current development priorities
- [SPEC_COMPLIANCE_EVALUATION.md](./SPEC_COMPLIANCE_EVALUATION.md) — Per-package v3.0.0 compliance status
- [OBJECTSTACK_CLIENT_EVALUATION.md](./OBJECTSTACK_CLIENT_EVALUATION.md) — Client SDK evaluation
