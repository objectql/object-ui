/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `kind:'react'` page renderer — the TRUSTED execution tier.
 *
 * Unlike `kind:'html'` (constrained JSX parsed, never executed), a react page's
 * `source` is real JavaScript/JSX: hooks, event handlers, `.map`, arbitrary
 * expressions. It is transpiled (Sucrase) and evaluated directly in the main
 * React tree by `@object-ui/react-runtime` — NO sandbox. The platform trusts
 * its (reviewed, draft-gated) page authors, so the host capability
 * `CAP_REACT_PAGES` defaults ON; a deployment that does not trust its authors
 * turns it OFF server-side (the runtime injects the disable global when
 * `OS_PAGE_REACT=off`). The transpiler is lazy-loaded — fetched in a
 * separate chunk only when a react page actually renders with the capability on.
 *
 * Scope injected into the source:
 *   - `React`                — so authors can call hooks.
 *   - the PUBLIC data blocks — `<ObjectGrid>`, `<ObjectForm>`, charts, metrics…
 *     each as a prop-driven wrapper that renders via SchemaRenderer. Layout is
 *     left to plain HTML (React's strength); only the data blocks that can't be
 *     expressed in HTML are injected.
 *   - `Block`                — escape hatch: `<Block type="object-grid" .../>`.
 *   - `useAdapter`            — live data hook: query/create/update objects.
 *   - `data` / `variables`   — page data + local variables, for convenience.
 *
 * Styling — page source is metadata, not build input. A react page styles with
 * inline `style` objects using `hsl(var(--token))` theme colors; overlays render
 * through `<ObjectForm formType="drawer"|"modal">` rather than a hand-rolled
 * `fixed inset-0` backdrop. Do NOT author Tailwind utility classes in page
 * `source`: `source` is runtime metadata, the console's Tailwind is compiled at
 * build time by scanning the console's own `src`, and there is no safelist — an
 * authored utility class silently produces no CSS. `os validate` reports it as
 * `page-source-className-tailwind`. (ADR-0065; ADR-0080's 2026-06-30 amendment;
 * see `content/docs/guide/react-pages.md`.)
 */

import * as React from 'react';
import { ComponentRegistry, isCapabilityEnabled, CAP_REACT_PAGES } from '@object-ui/core';
import { SchemaRenderer, SchemaRendererProvider, useAdapter } from '@object-ui/react';

type RuntimeModule = typeof import('@object-ui/react-runtime');

// kebab/snake tag -> PascalCase identifier authors write in JSX.
function toPascal(tag: string): string {
  return tag
    .split(/[-_:]/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

// Build the component scope from the curated PUBLIC contract. We inject the
// data/leaf blocks (non-containers) as prop-driven wrappers; layout containers
// are intentionally left out — in react mode the author composes layout with
// real HTML and inline `style` objects, not our schema-children renderers (and
// not Tailwind classes — see the styling note in this file's header).
//
// Lazily-registered blocks (`object-kanban`, `object-map`, `markdown`, … — see
// apps/console/src/main.tsx) are in here too: `getPublicConfigs()` resolves
// `registerLazy` stubs, so the scope is complete at build time regardless of
// which plugin chunks have been imported (objectui#2953). Each wrapper defers
// to SchemaRenderer, which triggers the loader and renders the placeholder, so
// the scope itself never has to change once built — which is exactly what lets
// it stay identity-stable and keeps the page from remounting (objectui#2954).
function buildComponentScope(dataSource: unknown): Record<string, React.ComponentType<any>> {
  const scope: Record<string, React.ComponentType<any>> = {};
  const seen = new Set<string>();
  // Some data blocks read their dataSource from props (e.g. `list-view`), others
  // from the SchemaRenderer context (e.g. `object-form`). We inject it as a prop
  // here AND wrap the page in a SchemaRendererProvider below, so both kinds work.
  for (const cfg of ComponentRegistry.getPublicConfigs() as Array<{ type: string; isContainer?: boolean }>) {
    const tag = cfg.type;
    if (!tag || cfg.isContainer) continue;
    const name = toPascal(tag);
    if (seen.has(name)) continue;
    seen.add(name);
    // `type` is the SDUI envelope's component discriminator, but it is ALSO a
    // legitimate prop name in a block's own spec schema — `ChartConfig.type` is
    // the chart family. Flattening props into the schema bag collides the two:
    // spreading last let an author's `type="bar"` replace `object-chart` and
    // the block stopped resolving; stamping the discriminator last silently ate
    // the author's value instead. Neither is acceptable (ADR-0078), so the
    // discriminator wins the `type` slot and the author's value is preserved
    // beside it under `specType` for the block to read
    // (objectui#2880 / framework#3729).
    const Wrapper: React.FC<any> = ({ children: _children, ...props }) => {
      const specType = typeof props.type === 'string' && props.type !== tag ? props.type : undefined;
      return React.createElement(SchemaRenderer as any, {
        schema: { dataSource, ...props, ...(specType ? { specType } : {}), type: tag },
      });
    };
    Wrapper.displayName = name;
    scope[name] = Wrapper;
  }
  // Escape hatch: render any registered component by type.
  const Block: React.FC<{ type: string; [k: string]: unknown }> = ({ type, children: _c, ...props }) =>
    React.createElement(SchemaRenderer as any, { schema: { type, dataSource, ...props } });
  Block.displayName = 'Block';
  scope.Block = Block;
  return scope;
}

/**
 * Stand-in for "no adapter yet" — the window before the host's AdapterProvider
 * finishes connecting, and any surface that renders a react page without one.
 *
 * A module constant, not an inline `?? {}`: this is a context value, and
 * SchemaRendererProvider memoises on its identity. A fresh object per render
 * would break that memo for every block inside the page, re-cloning each
 * block's schema and re-running its expressions on every render of the page —
 * the same defect the SchemaRenderer fallback had (objectui#2954).
 */
const NO_DATA_SOURCE = {};

function CapabilityDisabledNotice(): React.ReactElement {
  return (
    <div className="m-4 rounded-md border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="font-semibold">React pages are disabled on this deployment</div>
      <p className="mt-1 leading-relaxed">
        <code>kind:&apos;react&apos;</code> pages execute author JavaScript directly in the
        application. This deployment has turned the capability off
        (<code>OS_PAGE_REACT=off</code> / <code>disableCapability(&apos;react-pages&apos;)</code>).
        It is ON by default; re-enable it if your page authors are trusted.
      </p>
    </div>
  );
}

export const ReactKindPage: React.FC<{ schema: any }> = ({ schema }) => {
  const source: string = typeof schema?.source === 'string' ? schema.source : '';
  // The live data source for the injected data blocks (and the page's own
  // `useAdapter()` calls). Same object the rest of the app renders against.
  const adapter = useAdapter();
  // Gate: default-closed. Off in OSS / untrusted builds. Read here so the hooks
  // below stay unconditional; the disabled notice is returned after them, and
  // the effect never loads the gated runtime when disabled.
  const capabilityEnabled = isCapabilityEnabled(CAP_REACT_PAGES);

  const [runtime, setRuntime] = React.useState<RuntimeModule | null>(null);
  const [loadError, setLoadError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!capabilityEnabled) return;
    let alive = true;
    import('@object-ui/react-runtime')
      .then((m) => alive && setRuntime(m))
      .catch((e) => alive && setLoadError(e as Error));
    return () => {
      alive = false;
    };
  }, [capabilityEnabled]);

  // Keep this identity STABLE. ReactRunner recompiles the page whenever the
  // scope identity changes, and every compile mints a fresh `Page` function —
  // i.e. a new element type — which remounts the subtree and wipes the page's
  // own `useState` (objectui#2954). That's why this deliberately does not
  // subscribe to ComponentRegistry changes the way SchemaRenderer does: a lazy
  // plugin finishing its registration notifies the registry, and rebuilding the
  // scope there would reset every interactive page on the screen. It doesn't
  // need to — `buildComponentScope` already sees lazy blocks (objectui#2953).
  const scope = React.useMemo(
    () => ({
      ...buildComponentScope(adapter),
      // Live data access — `const adapter = useAdapter()` inside the page, then
      // adapter.find('object', {...}) / .create / .update. Hooks injected as
      // closure vars; the page calls them from its own component body.
      useAdapter,
      data: schema?.data ?? schema?.variables ?? {},
      variables: schema?.variables ?? {},
      page: schema ?? {},
    }),
    [schema, adapter],
  );

  // Capability gate — returned after all hooks above so hook order stays stable.
  if (!capabilityEnabled) {
    return <CapabilityDisabledNotice />;
  }

  if (loadError) {
    return (
      <div className="m-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <div className="font-semibold">Failed to load the react runtime</div>
        <pre className="mt-1 whitespace-pre-wrap">{String(loadError)}</pre>
      </div>
    );
  }
  if (!source.trim()) {
    return (
      <div className="m-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        A <code>kind:&apos;react&apos;</code> page requires a non-empty <code>source</code>.
      </div>
    );
  }
  if (!runtime) {
    return <div className="m-4 text-sm text-muted-foreground">Loading react runtime…</div>;
  }

  const { ReactRunner } = runtime;
  return (
    <SchemaRendererProvider dataSource={adapter ?? NO_DATA_SOURCE}>
      <ReactRunner
        code={source}
        scope={scope}
        fallback={(error) => (
          <div className="m-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="font-semibold">React page error</div>
            <pre className="mt-1 whitespace-pre-wrap">{String(error)}</pre>
          </div>
        )}
      />
    </SchemaRendererProvider>
  );
};
