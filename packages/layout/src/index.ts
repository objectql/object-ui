/**
 * ObjectUI Layout
 * Copyright (c) 2024-present ObjectStack Inc.
 */

import { ComponentRegistry } from '@object-ui/core';
import { PageHeader } from './PageHeader';
import { AppShell } from './AppShell';
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
  // The runtime `subtitle ?? description` fallback in `PageHeader.tsx` stays
  // for now ON PURPOSE: this alias exists for out-of-repo consumer schemas, so
  // "no in-repo author writes `description`" is not evidence that nobody does,
  // and dropping the read would silently delete their second line. That read
  // is retired together with an ADR-0087 D2 conversion entry
  // (`page-header-subtitle-alias`, `description` → `subtitle` at load time),
  // which lives in the framework repo. Narrowing the DECLARATION is
  // unconditional and independent of that: it breaks no consumer, and it stops
  // the registry from teaching the wrong key in the meantime.
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
  ComponentRegistry.register('page-header', PageHeader, {
    namespace: 'layout',
    label: 'Page Header',
    category: 'Layout',
    isContainer: true,
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'subtitle', type: 'string', label: 'Subtitle' },
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

  ComponentRegistry.register('app-shell', AppShell, {
    namespace: 'layout',
    label: 'App Shell',
    category: 'Layout',
  });

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

  ComponentRegistry.register('navigation-renderer', NavigationRenderer, {
    namespace: 'layout',
    label: 'Navigation Renderer',
    category: 'Layout',
    inputs: [
      { name: 'items', type: 'object' },
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
