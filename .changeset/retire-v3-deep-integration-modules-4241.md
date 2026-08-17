---
'@object-ui/data-objectstack': minor
---

data-objectstack: retire the four remaining `v3.0.0 Deep Integration` modules — `IntegrationManager`, `SecurityManager`, the studio canvas helpers (`createDefaultCanvasConfig` / `snapToGrid` / `calculateAutoLayout`), and the contract helpers (`validatePluginContract` / `generateContractManifest`) — for having zero code consumers outside this package

`src/index.ts`'s `// v3.0.0 Deep Integration modules` banner introduced five
modules. objectui#4152 / PR #4239 already retired the first,
`CloudOperations`, for fabricating a plausible success against a client
namespace that does not exist. This closes out the other four:
`contracts.ts`, `integration.ts`, `security.ts`, `studio.ts`.

**Not a repeat of #4152's urgency limb.** None of these four fabricated
anything — `SecurityManager.generateCSPHeader()` really composes a header,
`snapToGrid` really snaps, `validatePluginContract` really validates. What
they shared with `CloudOperations` was the other limb: published surface of
`@object-ui/data-objectstack` with a measured **zero** code consumers outside
this package, across `packages/`, `apps/` and `examples/` (`.ts`/`.tsx`,
excluding `node_modules`). The two apparent hits on re-measurement were
homonyms, not consumers — `packages/plugin-designer/src/PageDesigner.tsx`
declares its own local `snapToGrid` callback with no import from this
package, and the `SecurityManager` hits outside this file are prose in
`CHANGELOG.md`. Under the startup-focus principle a declared capability with
no producer, no consumer and no business pull is retired, not kept on the
chance it becomes useful.

**Breaking, in FROM → TO form.** The following are no longer exported from
`@object-ui/data-objectstack`:

- `IntegrationManager` and its types (`IntegrationConfig`, `IntegrationTrigger`,
  `IntegrationProvider`, `SlackIntegrationConfig`, `EmailIntegrationConfig`,
  `WebhookIntegrationConfig`)
- `SecurityManager` and its types (`SecurityManagerPolicy`, `CSPConfig`,
  `AuditLogConfig`, `AuditEventType`, `DataMaskingConfig`, `DataMaskingRule`,
  `AuditLogEntry`)
- `createDefaultCanvasConfig`, `snapToGrid`, `calculateAutoLayout` and their
  types (`StudioCanvasConfig`, `StudioPropertyEditor`,
  `StudioThemeBuilderConfig`, `StudioColorPalette`, `StudioTypographyPreset`,
  `StudioShadowPreset`)
- `validatePluginContract`, `generateContractManifest` and their types
  (`PluginContract`, `PluginExport`, `PluginAPIContract`,
  `ContractValidationResult`, `ContractValidationError`)

It is a `minor` under this repo's version policy (objectui's own breaking
changes never declare `major`). Nothing broke that was working: the only
in-repo construction sites were this package's own `v3-compat.test.ts` (which
exercised the modules directly) and `spec-symbol-batch6.test.ts` (which only
guarded `SecurityManagerPolicy`'s name against colliding with the spec's
unrelated `SecurityPolicy` — that guard is removed along with its subject).

**No compile-compat stub was left**, for the same reason #4152 left none: with
no consumer to keep compiling, a stub would be a second phantom surface
guarding the first.

**The banner and the compat-test title stop claiming a v3.** `index.ts`'s
`// v3.0.0 Deep Integration modules` banner had nothing left under it once
these four went, so it is removed rather than retitled.
`v3-compat.test.ts` — titled "v3.0.0 compatibility tests for @objectstack
dependencies" against a resolved `@objectstack` family of `17.0.0-rc.6` even
before this change — is not an empty shell (one block, `PaginatedResult API`,
never depended on any of the five retired modules), so it stays and is
retitled instead of deleted.

A negative pin
(`src/v3-deep-integration-retired-4241.pin.test.ts`) replaces the retired
`v3-compat.test.ts` cases and fails if any of the thirty retired names
returns — reading both the runtime export list (which catches the seven
class/function exports) and `index.ts`'s source text (the only instrument
that can catch a returning `export type`).
