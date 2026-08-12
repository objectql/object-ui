---
'@object-ui/components': patch
---

`@object-ui/components` compiles under `noImplicitAny` — the workspace's last strict-relaxing package

`packages/components/tsconfig.json` carried `"noImplicitAny": false`, the only place in the workspace that relaxed a `strict` sub-flag, under a comment that explained the neighbouring `rootDir` removal rather than the flag itself. `tsconfig.test.json` mirrored the one flag deliberately, so that a test project could not become the compiler of record for a source strictness decision the build config owns. Both now simply inherit `strict: true` from the root config, and the mirror's reasoning is rewritten to record why the mirror is gone rather than deleted silently.

Turning the flag on reported 26 implicitly-`any` sites in five renderer source files and 2 in the package's own tests, all of which now have real types. Nothing about the runtime changed; every one of the package's 1077 tests passes untouched.

Two of those signatures were typed by measurement rather than by preference, and both are worth recording:

The ten `sidebar.tsx` entry points follow the convention the package's other registered renderers already use — an inline `{ schema: <X>Schema; [key: string]: any }` annotation naming the registered component's own schema type (21 occurrences across the renderer tree, against zero uses of `ComponentRendererProps`). Only `'sidebar'` itself has a schema type in the registry map; the other ten registrations are sidebar *parts* with none of their own, so they take `BaseSchema`, the type every registered node satisfies. Annotating them `SidebarSchema` would have asserted `type: 'sidebar'` on a node whose type is `'sidebar-header'`.

The action renderers' callbacks are typed from `UIActionSchema`, not the legacy `ActionSchema` those three files import for their declarations. The legacy interface (`crud.ts`, already `@deprecated`) has no `locations`, so the shared `actionRendersAt` placement predicate rejects it outright; its `variant` union has no `'primary'`, the value the objectui#2339 ordering tie-break compares against; and its `type` is the literal `'action'`, while the actions actually flowing through these renderers carry `'form' | 'script' | 'url' | 'flow' | 'api' | 'modal'`. `action:bar`'s own documented example is a `UIActionSchema`. None of this was checkable before, because the props type never reached the callbacks at all: `forwardRef` routes props through `PropsWithoutRef`, whose `Omit` collapses a props type carrying `[key: string]: any` down to the bare index signature, so `schema` arrived as `any` and every callback under it inferred `any` too. The fix annotates each action list once where it enters and lets the `filter`/`some`/`map` chains below infer.

Graded `patch`: no declaration this package publishes changes shape. The three action schema interfaces and the leaf components whose props moved to `UIActionSchema` are internal — none is re-exported from `src/index.ts`. The `actions?: ActionSchema[]` keys those interfaces still declare remain on the legacy type; reconciling that declaration with the type the implementation actually receives reaches roughly 46 sites across 12 files and is filed separately.
