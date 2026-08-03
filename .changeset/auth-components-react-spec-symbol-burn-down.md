---
"@object-ui/auth": minor
"@object-ui/components": minor
"@object-ui/react": minor
---

Stop declaring 18 `@object-ui/auth` / `@object-ui/components` / `@object-ui/react`
symbols under names `@objectstack/spec` owns (objectui#3159, objectstack#4115
batch 5).

**Breaking for importers of all three packages** — six exported names changed,
because the spec exports the same name for a *different* thing:

| package | was | now | what the spec's same-named export actually is |
|:--|:--|:--|:--|
| `auth` | `AuthSession` | `AuthClientSession` | the SERVER's session record (`{ id, userId, expiresAt: ISO string, token? }`) |
| `auth` | `AuthProviderConfig` | `AuthProviderOptions` | an OAuth/OIDC provider registration (`{ id, clientId, clientSecret, scope? }`) |
| `components` | `FilterCondition` | `FilterBuilderCondition` | the recursive ObjectQL predicate AST (`$and`/`$or`/`$not`) |
| `components` | `Field` | `FieldContainer` | an object FIELD's metadata and its builder namespace |
| `react` | `ConflictResolutionStrategy` | `ConflictResolution` | the metadata-MERGE policy (`error \| priority \| first-wins \| last-wins`) |

The `react` rename is the odd one out: the new name is the **spec's own** name
for the union that hook always used, so it is a re-export rather than a dialect.

Eleven more keep their names and are now **imported or derived from the spec**
instead of re-declared: `TenancyPosture`, `DelegableScope` (+`DelegableAdminScope`),
`AuthUser`, `ShareLinkPermission`, `ShareLinkAudience`, `ShareLink`, `SortItem`,
`OfflineStrategy`, `OfflineCacheConfig`, `OfflineSyncConfig`, `OfflineConfig`,
`NavigationConfig`.

**Three of the copies were losing information, not just duplicating it.**

- `AuthUser` never declared the spec's `positions` or `tenantId` — the
  authorization inputs. Its `[key: string]: unknown` index signature meant the
  omission was invisible at every call site *and* to any structural comparison
  (the objectstack#4075 mechanism). It now `extends` the spec principal, so the
  display-only fields (`image`, `role`, `roles`, `emailVerified`) are the delta
  and the spec's keys arrive on their own.
- `useNavigationOverlay`'s copy carried the note *"inline … to avoid importing
  from `@object-ui/types` (which may not be a direct dependency of
  `@object-ui/react`)"*. The vocabulary belongs to `@objectstack/spec`, which
  **is** a direct dependency — the same expired "kept local to avoid a
  dependency" comment objectui#3169 found in `@object-ui/app-shell`.
- `useOffline` and `usePerformance` both opened with *"Types aligned with
  `@objectstack/spec` v2.0.7"*. The installed spec is 17.0.0-rc.1.

`ShareLink` derives from the spec row **minus `password_hash`** — omitted rather
than optional, because it is the credential itself and typing it in a browser
package is an invitation to render it. `password_protected` (the boolean the UI
needs in its place) is the one local addition.

The config types derive from each schema's **input** side, not `z.infer`.
`useOffline(config: OfflineConfig = {})` defaults to the empty object, which the
output type — every `.default()`ed key required — would reject outright.

`@objectstack/spec` moves from `devDependencies` to `dependencies` in
`@object-ui/components`: its public type surface now references the spec.

Scored `minor`, not `major`, per this repo's fixed-group rule — objectui's major
tracks `@objectstack`, so breaking changes of our own ship as minor with the
semantics spelled out above (see AGENTS.md §版本号策略). A `major` here would carry
all 39 packages of the fixed group to `18.0.0` and off objectstack's 17.x line.
