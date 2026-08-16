/**
 * ObjectUI Layout
 * Copyright (c) 2024-present ObjectStack Inc.
 */

import { ComponentRegistry } from '@object-ui/core';
import { PageHeader } from './PageHeader';
import { PageCard } from './PageCard';
import { SidebarNav } from './SidebarNav';
import { ResponsiveGrid } from './ResponsiveGrid';
import { NavigationRenderer } from './NavigationRenderer';
import { AppSchemaRenderer } from './AppSchemaRenderer';

export * from './PageHeader';
export * from './AppShell';
export * from './PageCard';
export * from './SidebarNav';
export * from './ResponsiveGrid';
export * from './NavigationRenderer';
export * from './AppSchemaRenderer';

export function registerLayout() {
  // Legacy `page-header` alias. Kept for any consumer schemas that still
  // reference the kebab-cased ID; the canonical renderer lives in
  // `@object-ui/components` under the protocol-compliant `page:header`
  // namespace. We intentionally do NOT re-register `page:header` here —
  // doing so would (depending on package load order) clobber the
  // record-aware renderer in components with this thinner one.
  //
  // `inputs` declares the AUTHORABLE surface, and it must name the same keys
  // the spec does — the designer and the framework's
  // `check:react-declaration-parity` read this list and treat everything in it
  // as a legal input (objectui#3226). `@objectstack/spec/ui`'s
  // `PageHeaderProps` declares `subtitle`; it has no `description`. This list
  // used to declare `description`, so the alias did not merely tolerate a
  // legacy spelling — it ADVERTISED a second dialect for the one concept
  // `page:header` calls `subtitle`, and metadata authored against it renders
  // a subtitle here and nothing at all under the canonical key.
  //
  // The runtime `subtitle ?? description` fallback in `PageHeader.tsx` is gone
  // too (objectui#3789). It was kept for out-of-repo consumer schemas — "no
  // in-repo author writes `description`" was never evidence that nobody does —
  // and it retired only once the ADR-0087 D2 conversion entry
  // `page-header-subtitle-alias` (`description` → `subtitle` at load time, in
  // the framework repo) was MEASURED to reach every spec-valid header position:
  // regions, `slots.*` (objectstack#6776) and containers nested to any depth,
  // `properties.children` / `items[].children` / `body` / `footer`
  // (objectstack#6775, PR #7034). That measurement is now a standing pin —
  // `__tests__/page-header-subtitle-conversion-coverage.test.ts` — so a spec
  // build whose conversion reach narrows again goes red HERE, where the missing
  // fallback would otherwise turn into a silently dropped second line.
  //
  // `isContainer: true` is the other half of the same principle, and it is NOT
  // an extension of the spec's authoring surface (objectui#3900). `children` is
  // a base property of EVERY node in objectui's JSON protocol — `BASE_PROPS` in
  // `sdui-parser/src/validate.ts` lists it beside `type`/`id`/`className` — not
  // a key of the spec's `PageHeaderProps`. So this flag answers the protocol
  // question "does this node accept a child list?", and for this component the
  // answer has always been yes: `PageHeader.tsx` deliberately re-introduces
  // `schema.children` into the right-hand slot (that is how `record:quick_actions`
  // nests under `page:header.children`), `content/docs/layout/page-header.mdx`
  // publishes the slot's precedence as contract, and the docs page's only live
  // demo is exactly that shape.
  //
  // Leaving the flag off did not make children illegal — nothing on the render
  // path reads `isContainer` — it made the VALIDATOR lie: `sdui-parser`'s
  // `not-a-container` diagnostic fired on the documented, demo-verified,
  // correctly-rendering write-up. A warning that lies is worse than a missing
  // one, because it trains authors (AI authors especially) to discount the true
  // `not-a-container` reports on components that really are childless.
  //
  // `icon` and `actions` are the same lie on two more keys, found by auditing
  // this list against the renderer's actual read points (objectui#3972). Each
  // declared key below is aligned on the faces that have to agree, and the
  // audit's negative results are as load-bearing as its positive ones:
  //
  //   RENDERER READS IT × A `ManifestInputType` CAN SPELL IT
  //   - `title` / `subtitle`  — read at `PageHeader.tsx:121/122`; both are live
  //     spec keys of `PageHeaderProps`, which is the objectui#3226 narrowing
  //     above.
  //   - `icon`      — read at `PageHeader.tsx:123`, rendered at `:231-233` (a
  //     string goes through `LazyIcon`, a node renders as-is). This one stands
  //     on the RENDERER-READ fact ALONE, and the change of footing is
  //     deliberate rather than an oversight: `PageHeaderProps.icon` was retired
  //     upstream as an ADR-0087 D2 tombstone in @objectstack/spec 17.0.0
  //     (objectstack#6946 / PR objectstack#7115) because the CANONICAL
  //     `page:header` renderer never read it. THIS renderer does — it draws the
  //     icon beside the title — `content/docs/layout/page-header.mdx` publishes
  //     the prop, and the docs page's only live demo
  //     (`layout-page-header/pageheader-with-actions`) writes `"icon": "users"`,
  //     so withdrawing the input would delete a working capability and make the
  //     manifest gate report `unknown-prop` on the repo's own documented
  //     example. `type: 'string'` because the AUTHORABLE spelling is an icon
  //     name; the `React.ReactNode` form is a programmatic prop, not JSON.
  //     objectui#3829 ruled it stays on exactly this footing. What keeps the
  //     claim honest — and stops the retired spec key from reading as parity —
  //     is `__tests__/page-header-authorable-keys.test.tsx`, which skips
  //     tombstones when it derives the spec's key set.
  //   - `actions`   — read at `:125`, resolved at `:199-203` and delegated to
  //     `record:quick_actions`; `PageHeaderProps.actions` is a LIVE spec key (an
  //     array of action ids), and the canonical `page:header` already publishes
  //     it as `type: 'array'` (`components/.../containers.tsx:1692`). Spelled
  //     identically here on purpose — one concept, one key, one type.
  //
  // NOT declared, deliberately, and each for its own reason:
  //   - `breadcrumb` — spec declares it, this renderer has NO read point (the
  //     word appears only in a comment and an `aria-label`). Declaring it would
  //     be objectui#3829's defect in reverse: an authoring surface the platform
  //     silently drops. (`page:header.icon` WAS that same case on the CANONICAL
  //     renderer — which is why it sits in `UNPUBLISHED_EXEMPTIONS` in
  //     `apps/console/src/__tests__/registry-inputs-spec-parity.test.ts`, and
  //     why the spec retired the key there while `icon` stays declared HERE:
  //     different renderers, opposite read facts.)
  //   - `showBack` / `action` — this renderer reads them, the spec has no such
  //     keys. Declaring one would publish a second dialect, which is the whole
  //     point of the objectui#3226 narrowing above. (`description` used to sit
  //     in this line for the same reason; objectui#3789 removed the read, so it
  //     is no longer a key this renderer honours in any spelling.)
  //   - `aria` — spec declares it; omitted for the reason every block omits it
  //     (accessibility escape hatch, not a layout choice).
  ComponentRegistry.register('page-header', PageHeader, {
    namespace: 'layout',
    label: 'Page Header',
    category: 'Layout',
    isContainer: true,
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'subtitle', type: 'string', label: 'Subtitle' },
      { name: 'icon', type: 'string', label: 'Icon', description: 'Lucide icon name' },
      {
        name: 'actions',
        type: 'array',
        label: 'Actions',
        description: 'ActionDef list (or action ids) rendered through record:quick_actions',
      },
    ],
  });

  // Page Card — register ONLY as `layout:page:card`. `skipFallback` keeps this
  // thin div from clobbering the bare `page:card` key, which belongs to the
  // record-aware PageCardRenderer in @object-ui/components (it renders
  // title/body/children; this one only renders React children and would
  // otherwise leak schema props onto the DOM). Same rationale as `page-header`.
  ComponentRegistry.register('page:card', PageCard, {
    namespace: 'layout',
    skipFallback: true,
    label: 'Page Card',
    category: 'Layout',
    isContainer: true
  });

  // NOTE: `app-shell` is deliberately NOT a component key (objectui#4841,
  // ADR-0049 enforce-or-remove, remove side; maintainer ruling 2026-08-16).
  //
  // It used to be registered here — key `app-shell`, component `AppShell`,
  // `namespace: 'layout'`, `label: 'App Shell'`, `category: 'Layout'`, and no
  // `inputs` — and that registration could never produce an app shell.
  //
  // (The call is described rather than quoted on purpose: the pins that read
  // this file ask it for the registered key list with a regex over
  // `ComponentRegistry` + `.register(`, and a verbatim copy in a comment reads
  // to them as a live registration. Same reason the file's other notes name
  // keys in prose.)
  // Four of `AppShellProps`' seven keys are `React.ReactNode` slots (`sidebar`,
  // `navbar`, `children`, `rightRail`) and a JSON document can fill none of
  // them. Measured on `378dc920b`, a node had exactly two outcomes, neither of
  // them a shell:
  //
  //   - `children` is dropped in SILENCE. `SchemaRenderer` strips `children`
  //     (and `body`) out of a node before spreading the remaining keys as
  //     props, and `AppShell` reads its `children` PROP, never
  //     `schema.children`. The `<main>` element rendered empty, console.error
  //     count 0.
  //   - a schema in `sidebar` / `navbar` / `rightRail` reaches the component as
  //     a plain object and React refuses to render it, so the node became the
  //     renderer's error box ("Objects are not valid as a React child").
  //
  // Only `className` / `defaultOpen` / `branding` — the three plain-data keys —
  // ever survived the JSON path, i.e. the best result JSON could reach was a
  // shell with no navigation, no top bar and an empty content area. With no
  // `inputs` declared, `sdui-parser`'s unknown-prop check had nothing to compare
  // a node against either, so neither outcome was diagnosed (same family as
  // objectui#3972).
  //
  // Removing the key does not remove a capability — it replaces a
  // parse-succeeds-renders-nothing middle state with a NAMED refusal:
  // `{ "type": "app-shell" }` now resolves to nothing, so `SchemaRenderer`
  // renders its OBJUI-001 panel ("Unknown component type: app-shell") and
  // `sdui-parser` reports `unknown-component`. Loud beats silent.
  //
  // The two survivors carry the two real capabilities, and this is the whole
  // point of the split:
  //   - `AppShell` stays EXPORTED (above) as a React composition primitive —
  //     compose the shell in React and render JSON pages inside it.
  //   - `app-schema-renderer` (below) stays the ONE JSON door for "render a
  //     whole shell from a schema": it declares `inputs` and builds branding and
  //     sidebar navigation out of an `AppSchema` document.
  //
  // Re-registering `app-shell` is not a one-line revert: it needs `inputs` AND a
  // rendering adapter that turns the schema values in `sidebar`/`navbar`/
  // `rightRail` into nodes and wires `schema.children` to `children` (option B
  // on objectui#4841), plus an answer to how it then differs from
  // `app-schema-renderer`. `__tests__/app-shell-not-a-component-key.test.tsx`
  // pins the current state and says the same thing where it fails.

  ComponentRegistry.register('responsive-grid', ResponsiveGrid, {
    namespace: 'layout',
    label: 'Responsive Grid',
    category: 'Layout',
    isContainer: true,
    inputs: [
      { name: 'columns', type: 'object' },
      { name: 'gap', type: 'number' },
    ],
  });

  // `items` is `NavigationItem[]` (`NavigationRenderer.tsx:108`) — an ARRAY, and
  // it used to be declared `type: 'object'` (objectui#3972). Those are not two
  // spellings of one check: `sdui-parser`'s `checkType` accepts `'object'` only
  // for `typeof value === 'object' && !Array.isArray(value)` and `'array'` only
  // for `Array.isArray(value)` (`validate.ts:124-129`), so the declaration made
  // the manifest gate report `type-mismatch: <navigation-renderer> prop "items"
  // expected an object` on the ONLY value this renderer can render — and stay
  // silent on the object that would crash it.
  //
  // This is not objectui#3832 (`ComponentInput.type` cannot spell a spec union):
  // `ManifestInputType` has `'array'`, so the declaration was simply wrong about
  // a type it could express exactly.
  //
  // `required: true` is the fourth face of the same agreement (objectui#3987).
  // #3972 aligned the key's EXISTENCE and TYPE; optionality was still declared
  // the opposite of what the component enforces. `NavigationRendererProps.items`
  // has no `?` and the renderer supplies no default (`NavigationRenderer.tsx:1204`),
  // so `{ "type": "navigation-renderer" }` — a node the validator passed in
  // silence, because `validate.ts:55-64` only reports `missing-required-prop`
  // when `input.required` is set — crashes on the first thing the render does
  // with the prop: `collectPinnedItems(filteredItems)` at `:1242` does
  // `for (const item of items)` (`:1410`) and throws
  // `TypeError: items is not iterable`. (The `resolveActiveNavItem` memo above
  // it survives, its `visit` guards `if (!nodes) return`; `filteredItems.slice()`
  // at `:1247` would throw too but is never reached.)
  //
  // So this is not a stylistic "document it as required" — it is the one
  // diagnostic that exists precisely to stop a node whose render is a
  // guaranteed crash from shipping. `basePath` below stays optional because the
  // renderer really does default it (`basePath = ''`); the two are declared
  // differently because the component treats them differently.
  ComponentRegistry.register('navigation-renderer', NavigationRenderer, {
    namespace: 'layout',
    label: 'Navigation Renderer',
    category: 'Layout',
    inputs: [
      { name: 'items', type: 'array', required: true },
      { name: 'basePath', type: 'string' },
    ],
  });

  ComponentRegistry.register('app-schema-renderer', AppSchemaRenderer, {
    namespace: 'layout',
    label: 'App Schema Renderer',
    category: 'Layout',
    isContainer: true,
    inputs: [
      { name: 'schema', type: 'object' },
      { name: 'basePath', type: 'string' },
      { name: 'mobileNavMode', type: 'string' },
    ],
  });

  // NOTE: 'page' registration is handled by @object-ui/components PageRenderer.
  // That renderer supports page types (record/home/app/utility), named regions,
  // and PageVariablesProvider. Do NOT re-register 'page' here to avoid conflicts.
  //
  // This package used to ALSO export a `page`-node renderer (`PageNodeRenderer`,
  // `./Page`) that this note kept unregistered — so it had no call site and
  // never ran, while still advertising itself from the public API as if
  // `@object-ui/layout` were where page rendering lives. Deleted in
  // objectui#3223 under ADR-0049 (enforce-or-remove): one key, one renderer. If
  // the `page` node needs something layout owns, add it to the components
  // renderer — do not reintroduce a second one here.
}

// Keep backward compatibility for now if called directly
try {
  registerLayout();
} catch (e) {
  // Ignore registration errors during build/test cycles
}
