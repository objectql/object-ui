---
"@object-ui/types": minor
---

remove(tenant): drop the zero-consumer `@object-ui/tenant` package and the `types/tenant.ts` mirror (#2564)

`@object-ui/tenant` (`TenantProvider` / `TenantGuard` / `TenantScopedQuery` /
`createTenantResolver` / `useTenant` / `useTenantBranding`) was an
exported-but-dead aspirational surface: no workspace package depended on it
and nothing imported it. Its `TenantConfig.isolation` strategy enum
(`'database' | 'schema' | 'row' | 'hybrid'`) was the UI mirror of the spec's
`tenancy.strategy`, which framework#2763/framework#2962 removed under the same
enforce-or-remove doctrine — the platform has exactly two tenancy modes, and
neither is configured client-side.

`@object-ui/types` no longer exports the tenant type family
(`TenantConfig`, `TenantIsolationStrategy`, `TenantStatus`, `TenantPlan`,
`TenantBranding`, `TenantLimits`, `TenantContext`,
`TenantResolutionStrategy`, `TenantProviderConfig`,
`TenantScopedQueryConfig`).

Migration: real tenant scoping is server-enforced — `createAuthenticatedFetch`
(`@object-ui/auth`) already injects the active organization as `X-Tenant-ID`
on every API call, and the backend applies row-level isolation
(`tenancy.enabled` + `tenantField` in `@objectstack/spec`). Per-tenant
branding is a `ThemeSchema` concern. The skills guides and docs that
advertised the dead package have been rewritten to say exactly that.
