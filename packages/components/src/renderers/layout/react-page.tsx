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
 * React tree by `@object-ui/react-runtime` — NO sandbox. That is only safe under
 * trust, so it is gated behind the host capability `CAP_REACT_PAGES` (default
 * OFF; enterprise / private deployments opt in). The runtime is lazy-loaded so
 * the transpiler ships in a separate chunk fetched only when a react page
 * actually renders with the capability on.
 *
 * Scope injected into the source:
 *   - `React`                — so authors can call hooks.
 *   - the PUBLIC data blocks — `<ObjectTable>`, `<ObjectForm>`, charts, metrics…
 *     each as a prop-driven wrapper that renders via SchemaRenderer. Layout is
 *     left to plain HTML + Tailwind (React's strength); only the data blocks
 *     that can't be expressed in HTML are injected.
 *   - `Block`                — escape hatch: `<Block type="object-table" .../>`.
 *   - `data` / `variables`   — page data + local variables, for convenience.
 */

import * as React from 'react';
import { ComponentRegistry, isCapabilityEnabled, CAP_REACT_PAGES } from '@object-ui/core';
import { SchemaRenderer } from '@object-ui/react';

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
function buildComponentScope(): Record<string, React.ComponentType<any>> {
  const scope: Record<string, React.ComponentType<any>> = {};
  const seen = new Set<string>();
  for (const cfg of ComponentRegistry.getPublicConfigs() as Array<{ type: string; isContainer?: boolean }>) {
    const tag = cfg.type;
    if (!tag || cfg.isContainer) continue;
    const name = toPascal(tag);
    if (seen.has(name)) continue;
    seen.add(name);
    const Wrapper: React.FC<any> = ({ children: _children, ...props }) =>
      React.createElement(SchemaRenderer as any, { schema: { type: tag, ...props } });
    Wrapper.displayName = name;
    scope[name] = Wrapper;
  }
  // Escape hatch: render any registered component by type.
  const Block: React.FC<{ type: string; [k: string]: unknown }> = ({ type, children: _c, ...props }) =>
    React.createElement(SchemaRenderer as any, { schema: { type, ...props } });
  Block.displayName = 'Block';
  scope.Block = Block;
  return scope;
}

function CapabilityDisabledNotice(): React.ReactElement {
  return (
    <div className="m-4 rounded-md border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="font-semibold">This page requires the “React pages” capability</div>
      <p className="mt-1 leading-relaxed">
        <code>kind:&apos;react&apos;</code> pages execute author JavaScript directly in the
        application. For safety this runs only on trusted (enterprise / private)
        deployments. A host enables it with{' '}
        <code>enableCapability(&apos;react-pages&apos;)</code>.
      </p>
    </div>
  );
}

export const ReactKindPage: React.FC<{ schema: any }> = ({ schema }) => {
  const source: string = typeof schema?.source === 'string' ? schema.source : '';

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
      ...buildComponentScope(),
      data: schema?.data ?? schema?.variables ?? {},
      variables: schema?.variables ?? {},
      page: schema ?? {},
    }),
    [schema],
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
  );
};
