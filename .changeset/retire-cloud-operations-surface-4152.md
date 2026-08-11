---
'@object-ui/data-objectstack': minor
---

data-objectstack: retire the phantom `CloudOperations` surface — the class, its three `Cloud*` types, and the module that claimed to integrate a cloud namespace no client has ever shipped

`src/cloud.ts` exported a `CloudOperations` class with four methods, all
re-exported from the package entry, so this was published surface of
`@object-ui/data-objectstack`. Every method optional-chained into
`client.cloud?.…`, and no released `@objectstack/client` has ever exported a
`cloud` namespace. Re-measured at `17.0.0-rc.6` before deleting: the module's
export list is `ObjectStackClient`, `ScopedProjectClient`, `RealtimeAPI`,
`QueryBuilder`, `FilterBuilder`, `createQuery`, `createFilter`, and a
constructed client's `.cloud` is `undefined`. The nearest real namespaces on the
instance — `projects` (which owns `/api/v1/cloud/environments`) and `packages`
(which owns marketplace installs) — are not what these methods reached for.

So every call resolved `undefined` and fell through to a literal:

| method | what it returned, always |
|:--|:--|
| `deploy` | `{ deploymentId: 'deploy-' + Date.now(), status: 'pending' }` |
| `getDeploymentStatus` | `{ status: 'unknown' }` |
| `searchMarketplace` | `[]` |
| `installPlugin` | `{ success: false }` |

The maintainer's 2026-08-11 ruling removed it rather than repairing it, and named
the reason: `deploy()` did not degrade to an error, it **manufactured a
plausible success**. A caller got a well-formed `deploymentId` for an operation
that never left the process and then polled it forever against
`{ status: 'unknown' }`. That is the most dangerous shape for an AI consumer,
which builds downstream logic on the fake id instead of getting suspicious.
Under the startup-focus principle a declared capability with no producer, no
consumer and no business pull is retired, not stubbed.

**Breaking, in FROM → TO form.** `CloudOperations`, `CloudDeploymentConfig`,
`CloudHostingConfig` and `CloudMarketplaceEntry` are no longer exported from
`@object-ui/data-objectstack`. It is a `minor` under this repo's version policy
(objectui's own breaking changes never declare `major`). Nothing broke that was
working: the only in-repo construction site was a test, and every method's
observable behaviour was a fabricated constant.

**No compile-compat stub was left.** The ruling allows one — throwing loud
`NotImplemented` — only where a compile need is demonstrated. Measured across the
whole repository, the sole importers were the package's own `index.ts`,
`v3-compat.test.ts` (three cases asserting the fallback had the right *keys*,
which is how the emptiness stayed green) and objectui#3720's vocabulary pin. No
app, no other package, no doc. With no consumer to keep compiling, a stub would
be a second phantom surface guarding the first.

The false module header went with it — it read `Cloud namespace integration for
@objectstack/spec v3.0.0 / Replaces the legacy Hub namespace`, against a resolved
spec of `17.0.0-rc.6` and schemas this package never consumed.

**objectui#3720's pin retires with its subject.** `cloud-environment-vocabulary.pin.test.ts`
pinned the doc comment on `CloudDeploymentConfig.environment` — the deliberate
three-member deploy-target vocabulary and the `staging`-is-not-a-discovery-member
trap. Every fact it held was a claim *about* that comment, and its spec-side
assertions existed only to keep those claims honest; with the type deleted they
would pin `@objectstack/spec`'s enums on behalf of no local reader — the same
phantom shape this change closes. #3720's conclusion is unaffected and now moot:
it found no producer-side deploy-target type to converge onto because the
producer did not exist, and this change removes the consumer that was waiting for
it. Its pending empty changeset (`cloud-deploy-environment-vocabulary-3720.md`,
never released) is removed too, since it announced a deliberate vocabulary on a
type this same release deletes.

A negative pin (`src/cloud-surface-retired-4152.pin.test.ts`) replaces the
retired cases and fails if any of the four names returns — reading both the
runtime export list (which catches the class) and `index.ts`'s source text
(which is the only instrument that can catch a returning `export type`).
