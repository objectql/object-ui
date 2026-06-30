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
 *   - the PUBLIC data blocks — `<ObjectTable>`, `<ObjectForm>`, charts, metrics…
 *     each as a prop-driven wrapper that renders via SchemaRenderer. Layout is
 *     left to plain HTML + Tailwind (React's strength); only the data blocks
 *     that can't be expressed in HTML are injected.
 *   - `Block`                — escape hatch: `<Block type="object-table" .../>`.
 *   - `useAdapter`            — live data hook: query/create/update objects.
 *   - `data` / `variables`   — page data + local variables, for convenience.
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
// real HTML + Tailwind, not our schema-children renderers.
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
    const Wrapper: React.FC<any> = ({ children: _children, ...props }) =>
      React.createElement(SchemaRenderer as any, { schema: { type: tag, dataSource, ...props } });
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

  // Gate: default-closed. Off in OSS / untrusted builds.
  if (!isCapabilityEnabled(CAP_REACT_PAGES)) {
    return <CapabilityDisabledNotice />;
  }

  const [runtime, setRuntime] = React.useState<RuntimeModule | null>(null);
  const [loadError, setLoadError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let alive = true;
    import('@object-ui/react-runtime')
      .then((m) => alive && setRuntime(m))
      .catch((e) => alive && setLoadError(e as Error));
    return () => {
      alive = false;
    };
  }, []);

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
    <SchemaRendererProvider dataSource={adapter ?? {}}>
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
