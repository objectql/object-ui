/**
 * ObjectUI — Page Renderer
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * The Page renderer interprets PageSchema into structured layouts.
 * It supports four page types (record, home, app, utility) and
 * renders named regions (header, sidebar, main, footer, aside) with
 * configurable widths. When no regions are defined, it falls back to
 * body/children for backward compatibility.
 */

import React, { useMemo } from 'react';
import type { BaseSchema, PageNodeSchema, PageNodeRegion, SchemaNode } from '@object-ui/types';
import { SchemaRenderer, toRenderableSchema, PageVariablesProvider, PageVariableActionBridge } from '@object-ui/react';
import { ComponentRegistry } from '@object-ui/core';
import { compile, manifestFromConfigs } from '@object-ui/sdui-parser';
import { ReactKindPage } from './react-page';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map region width enum values to Tailwind width classes */
function getRegionWidthClass(width?: string): string {
  switch (width) {
    case 'small':
      return 'w-64';
    case 'medium':
      return 'w-80';
    case 'large':
      return 'w-96';
    case 'full':
      return 'w-full';
    default:
      return width ? width : 'w-full';
  }
}

/** Sidebar/aside width — full-width on mobile, fixed at md+ so the rail stacks
 *  above/below the main column on phones instead of squeezing it. LITERAL
 *  responsive strings so Tailwind's JIT scanner emits them. */
function getSidebarWidthClass(width?: string): string {
  switch (width) {
    case 'small':
      return 'w-full md:w-64';
    case 'medium':
      return 'w-full md:w-80';
    case 'large':
      return 'w-full md:w-96';
    default:
      return 'w-full';
  }
}

/** Max-width constraint by page type */
function getPageMaxWidth(pageType?: string): string {
  switch (pageType) {
    case 'utility':
      return 'max-w-4xl';
    case 'home':
      return 'max-w-screen-2xl';
    case 'app':
      return 'max-w-screen-xl';
    case 'record':
    default:
      return 'max-w-7xl';
  }
}

/** Find a named region (case-insensitive) */
function findRegion(regions: PageNodeRegion[] | undefined, name: string): PageNodeRegion | undefined {
  return regions?.find((r) => r.name?.toLowerCase() === name.toLowerCase());
}

/** Get all regions that are NOT in the named set */
function getRemainingRegions(regions: PageNodeRegion[] | undefined, exclude: string[]): PageNodeRegion[] {
  if (!regions) return [];
  const lowerSet = new Set(exclude.map((n) => n.toLowerCase()));
  return regions.filter((r) => !lowerSet.has(r.name?.toLowerCase() ?? ''));
}

// ---------------------------------------------------------------------------
// "One page, one h1" — who owns the page heading (objectui#3434)
// ---------------------------------------------------------------------------

/**
 * `page:header` is registered `skipFallback: true`, so this is the ONLY node
 * type that resolves to PageHeaderRenderer — no bare `header` alias to match.
 */
const PAGE_HEADER_TYPE = 'page:header';

/** Text a header title contributes once `{token}` interpolation is stripped. */
function literalTitleText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    // `interpolate()` (containers.tsx) replaces `{field}` with the record value
    // and blanks it when there is none, so only the literal remainder is text
    // we can promise will be on screen.
    return value.replace(/\{[a-zA-Z0-9_.]+\}/g, '').replace(/\s+/g, ' ').trim();
  }
  if (typeof value === 'object') {
    // Inline translation map (`pickLocalized`): any non-empty translation
    // means the header will render a heading in some language.
    return Object.values(value as Record<string, unknown>)
      .map((v) => literalTitleText(v))
      .find((s) => s !== '') ?? '';
  }
  return String(value);
}

/** Does this node render a `page:header` heading of its own? */
function isTitledPageHeader(node: any): boolean {
  if (node?.type !== PAGE_HEADER_TYPE) return false;
  // Spec bridge may inline `properties.*` onto the node or preserve the bag —
  // PageHeaderRenderer reads both, so this must too.
  return literalTitleText(node?.title ?? node?.properties?.title) !== '';
}

/** Depth-bounded walk over the component shapes a page can nest. */
function containsTitledPageHeader(nodes: unknown, depth = 0): boolean {
  if (!Array.isArray(nodes) || depth > 6) return false;
  return nodes.some(
    (n: any) =>
      !!n &&
      typeof n === 'object' &&
      (isTitledPageHeader(n) ||
        containsTitledPageHeader(n.components, depth + 1) ||
        containsTitledPageHeader(n.children, depth + 1) ||
        containsTitledPageHeader(n.body, depth + 1)),
  );
}

/**
 * Does the page delegate its `<h1>` to an authored `page:header`?
 *
 * A document has exactly ONE `h1`. When an author drops a `page:header` into a
 * region, THAT component is the page's title renderer — the record chip on
 * record pages, a bare `<h1>` everywhere else — so PageRenderer must not emit a
 * second one. It used to, for every non-record page type: the showcase
 * master-detail page rendered its `label` as an `h1` AND its `page:header`
 * title as another `h1` with the same name, which is a broken document outline,
 * a title a screen reader announces twice, and a visible duplicate on screen
 * (objectui#3434 — a live e2e `getByRole('heading', { name })` resolved to 2
 * elements). Record pages already delegated the whole title block; this is the
 * same rule stated for every page type.
 *
 * Deliberately conservative — only a header whose title renders literal text
 * counts. `page:header` drops an empty title (and one that interpolates to
 * nothing, e.g. `title: '{name}'` with no record in scope), so suppressing ours
 * against a header that renders no heading would leave the page with NO `h1`.
 */
function pageHeaderOwnsTitle(schema: PageNodeSchema): boolean {
  const regionNodes = (schema.regions ?? []).flatMap((r: any) => r?.components ?? []);
  return (
    containsTitledPageHeader(regionNodes) ||
    containsTitledPageHeader((schema as any).body) ||
    containsTitledPageHeader((schema as any).children)
  );
}

// ---------------------------------------------------------------------------
// RegionContent — renders all components inside a single region
// ---------------------------------------------------------------------------

const RegionContent: React.FC<{
  region: PageNodeRegion;
  className?: string;
}> = ({ region, className }) => {
  const components = region.components || [];
  if (components.length === 0) return null;

  return (
    <div
      className={cn('space-y-4', region.className, className)}
      data-region={region.name}
    >
      {components.map((node: SchemaNode, idx: number) => (
        <SchemaRenderer key={(node as any)?.id || `${region.name}-${idx}`} schema={toRenderableSchema(node)} />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// RegionLayout — structured layout with named slots
// ---------------------------------------------------------------------------

const RegionLayout: React.FC<{
  regions: PageNodeRegion[];
  pageType?: string;
  className?: string;
}> = ({ regions, pageType, className }) => {
  const header = findRegion(regions, 'header');
  const sidebar = findRegion(regions, 'sidebar');
  const main = findRegion(regions, 'main');
  const aside = findRegion(regions, 'aside');
  const footer = findRegion(regions, 'footer');

  // Remaining regions that don't match named slots → append below main
  const extras = getRemainingRegions(regions, ['header', 'sidebar', 'main', 'aside', 'footer']);

  // If there's no named layout structure, just stack everything
  const hasStructure = header || sidebar || main || aside || footer;
  if (!hasStructure) {
    return (
      <div className={cn('space-y-6', className)} data-page-layout={pageType}>
        {regions.map((region, idx) => (
          <RegionContent key={region.name || idx} region={region} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', className)} data-page-layout={pageType}>
      {/* Header region */}
      {header && (
        <RegionContent
          region={header}
          className={cn(getRegionWidthClass(header.width as string))}
        />
      )}

      {/* Body: sidebar + main + aside */}
      <div className="flex flex-col md:flex-row flex-1 gap-6">
        {sidebar && (
          <aside className={cn('md:shrink-0', getSidebarWidthClass(sidebar.width as string || 'small'))}>
            <RegionContent region={sidebar} />
          </aside>
        )}

        <div className="flex-1 min-w-0 space-y-6">
          {main && <RegionContent region={main} />}
          {extras.map((region, idx) => (
            <RegionContent key={region.name || `extra-${idx}`} region={region} />
          ))}
        </div>

        {aside && (
          <aside className={cn('md:shrink-0', getSidebarWidthClass(aside.width as string || 'small'), aside.className)}>
            <RegionContent region={aside} />
          </aside>
        )}
      </div>

      {/* Footer region */}
      {footer && (
        <RegionContent
          region={footer}
          className={cn(getRegionWidthClass(footer.width as string))}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// FlatContent — legacy body/children fallback
// ---------------------------------------------------------------------------

const FlatContent: React.FC<{ schema: PageNodeSchema }> = ({ schema }) => {
  const content = schema.body || schema.children;
  const nodes: SchemaNode[] = Array.isArray(content)
    ? content
    : content
      ? [content as SchemaNode]
      : [];

  if (nodes.length === 0) return null;

  return (
    <div className="space-y-6">
      {nodes.map((node: any, index: number) => (
        <SchemaRenderer key={node?.id || index} schema={node} />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Template layouts — predefined layout templates
// ---------------------------------------------------------------------------

/** Template: full-width single column */
const FullWidthTemplate: React.FC<{ schema: PageNodeSchema }> = ({ schema }) => {
  if (schema.regions && schema.regions.length > 0) {
    return <RegionLayout regions={schema.regions} pageType={schema.pageType} />;
  }
  return <FlatContent schema={schema} />;
};

/** Template: header-sidebar-main — header spanning full width, sidebar + main below */
const HeaderSidebarMainTemplate: React.FC<{ schema: PageNodeSchema }> = ({ schema }) => {
  const regions = schema.regions || [];
  if (regions.length === 0) return <FlatContent schema={schema} />;

  const header = findRegion(regions, 'header');
  const sidebar = findRegion(regions, 'sidebar');
  const main = findRegion(regions, 'main');
  const extras = getRemainingRegions(regions, ['header', 'sidebar', 'main']);

  return (
    <div className="flex flex-col gap-6" data-template="header-sidebar-main">
      {header && <RegionContent region={header} />}
      <div className="flex flex-col md:flex-row flex-1 gap-6">
        {sidebar && (
          <aside className={cn('md:shrink-0', getSidebarWidthClass(sidebar.width as string || 'medium'))}>
            <RegionContent region={sidebar} />
          </aside>
        )}
        <div className="flex-1 min-w-0 space-y-6">
          {main && <RegionContent region={main} />}
          {extras.map((region, idx) => (
            <RegionContent key={region.name || `extra-${idx}`} region={region} />
          ))}
        </div>
      </div>
    </div>
  );
};

/** Template: three-column — sidebar + main + aside */
const ThreeColumnTemplate: React.FC<{ schema: PageNodeSchema }> = ({ schema }) => {
  const regions = schema.regions || [];
  if (regions.length === 0) return <FlatContent schema={schema} />;

  const header = findRegion(regions, 'header');
  const sidebar = findRegion(regions, 'sidebar');
  const main = findRegion(regions, 'main');
  const aside = findRegion(regions, 'aside');
  const footer = findRegion(regions, 'footer');
  const extras = getRemainingRegions(regions, ['header', 'sidebar', 'main', 'aside', 'footer']);

  return (
    <div className="flex flex-col gap-6" data-template="three-column">
      {header && <RegionContent region={header} />}
      <div className="flex flex-col md:flex-row flex-1 gap-6">
        {sidebar && (
          <aside className={cn('md:shrink-0', getSidebarWidthClass(sidebar.width as string || 'small'))}>
            <RegionContent region={sidebar} />
          </aside>
        )}
        <div className="flex-1 min-w-0 space-y-6">
          {main && <RegionContent region={main} />}
          {extras.map((region, idx) => (
            <RegionContent key={region.name || `extra-${idx}`} region={region} />
          ))}
        </div>
        {aside && (
          <aside className={cn('md:shrink-0', getSidebarWidthClass(aside.width as string || 'small'), aside.className)}>
            <RegionContent region={aside} />
          </aside>
        )}
      </div>
      {footer && <RegionContent region={footer} />}
    </div>
  );
};

/** Template: dashboard — 2x2 grid of regions */
const DashboardTemplate: React.FC<{ schema: PageNodeSchema }> = ({ schema }) => {
  const regions = schema.regions || [];
  if (regions.length === 0) return <FlatContent schema={schema} />;

  const header = findRegion(regions, 'header');
  const footer = findRegion(regions, 'footer');
  const contentRegions = getRemainingRegions(regions, ['header', 'footer']);

  return (
    <div className="flex flex-col gap-6" data-template="dashboard">
      {header && <RegionContent region={header} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {contentRegions.map((region, idx) => (
          <RegionContent key={region.name || `region-${idx}`} region={region} />
        ))}
      </div>
      {footer && <RegionContent region={footer} />}
    </div>
  );
};

/** Template registry — maps template names to layout components */
const TEMPLATE_REGISTRY: Record<string, React.FC<{ schema: PageNodeSchema }>> = {
  'default': FullWidthTemplate,
  'full-width': FullWidthTemplate,
  'header-sidebar-main': HeaderSidebarMainTemplate,
  'three-column': ThreeColumnTemplate,
  'dashboard': DashboardTemplate,
};

/** Resolve template: if the schema specifies a template name, use the matching layout */
function resolveTemplate(schema: PageNodeSchema): React.FC<{ schema: PageNodeSchema }> | null {
  if (!schema.template) return null;
  return TEMPLATE_REGISTRY[schema.template] || null;
}

// ---------------------------------------------------------------------------
// Page type variant layouts
// ---------------------------------------------------------------------------

/** Record page — detail-oriented, narrower max-width */
const RecordPageLayout: React.FC<{ schema: PageNodeSchema }> = ({ schema }) => {
  if (schema.regions && schema.regions.length > 0) {
    return <RegionLayout regions={schema.regions} pageType="record" />;
  }
  return <FlatContent schema={schema} />;
};

/** Home page — dashboard-style, wider layout */
const HomePageLayout: React.FC<{ schema: PageNodeSchema }> = ({ schema }) => {
  if (schema.regions && schema.regions.length > 0) {
    return <RegionLayout regions={schema.regions} pageType="home" />;
  }
  return <FlatContent schema={schema} />;
};

/** App page — application shell, full-width capable */
const AppPageLayout: React.FC<{ schema: PageNodeSchema }> = ({ schema }) => {
  if (schema.regions && schema.regions.length > 0) {
    return <RegionLayout regions={schema.regions} pageType="app" />;
  }
  return <FlatContent schema={schema} />;
};

/** Utility page — compact, focused, narrower */
const UtilityPageLayout: React.FC<{ schema: PageNodeSchema }> = ({ schema }) => {
  if (schema.regions && schema.regions.length > 0) {
    return <RegionLayout regions={schema.regions} pageType="utility" />;
  }
  return <FlatContent schema={schema} />;
};

// ---------------------------------------------------------------------------
// ADR-0080: a `kind:'jsx'` page carries a constrained JSX `source`. We compile
// it (parse, never execute) into a SchemaNode tree and render it. The whitelist
// / contract is the live registry. Cached; rebuilt when the registry grows.
let _jsxManifestSig = -1;
let _jsxManifest: ReturnType<typeof manifestFromConfigs> | null = null;
function getJsxManifest() {
  // Key the whitelist by the registry's tag keys (bare AND namespaced) — a
  // config's `.type` is always the namespaced form (Registry stores the bare
  // alias pointing at the namespaced type), so getAllConfigs() alone would
  // never admit the bare `<flex>` tag authors write.
  //
  // KNOWN types, not loaded ones. A lazily-registered block is a real member of
  // this app's vocabulary; leaving it out of the whitelist rejected
  // `<object-kanban>` as "not an allowed component" and — because a compile
  // error fails the WHOLE page, not just that node — took the entire page down
  // with it, load-order dependently (objectui#2953, html tier).
  //
  // A stub has no `inputs` yet, so its props come back as `unknown-prop`
  // WARNINGS rather than errors: the page compiles and renders, and the inner
  // SchemaRenderer triggers the loader and swaps in the real block. Authoring
  // time still gets full prop validation — `sdui.manifest.json` is generated
  // with every plugin eagerly loaded, and asserts as much.
  const version = ComponentRegistry.getVersion();
  if (_jsxManifest === null || _jsxManifestSig !== version) {
    const configs = ComponentRegistry.getKnownTypes().map((t) => {
      const meta = ComponentRegistry.getMeta(t);
      return { type: t, namespace: meta?.namespace, isContainer: meta?.isContainer, inputs: meta?.inputs };
    });
    _jsxManifest = manifestFromConfigs(configs as unknown as Parameters<typeof manifestFromConfigs>[0]);
    _jsxManifestSig = version;
  }
  return _jsxManifest;
}

// Main PageRenderer
// ---------------------------------------------------------------------------

export const PageRenderer: React.FC<{
  schema: PageNodeSchema;
  className?: string;
  [key: string]: any;
}> = ({ schema, className, ...props }) => {
  const pageType = schema.pageType || 'record';
  // A `kind:'html'` page compiles its source against the registry, and a
  // compile error fails the whole page. Without this the failure is permanent
  // for the session: `layoutElement` is memoised, so a page that compiled
  // before the block it needs was registered kept rendering the cached error
  // panel even after the plugin landed. Mirrors SchemaRenderer's subscription.
  const [registryTick, bumpRegistryTick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => ComponentRegistry.subscribe(bumpRegistryTick), []);
  // Spec PageSchema declares `label` (required); `title` is the objectui
  // spelling. Dual-read so a spec-authored page still renders its header
  // (framework#1878 §3 naming-drift recheck).
  const pageTitle = schema.title ?? (schema as any).label;

  // Extract designer-related props and strip schema-only metadata that
  // would otherwise leak onto the wrapper <div> as invalid HTML attributes
  // (e.g. `isDefault`, `assignedProfiles`, `_packageId`, `aria` object).
  // We keep this list aligned with `PageSchema` in `@object-ui/types`. As a
  // safety net we also drop any `_`-prefixed keys (internal metadata from
  // the synth pipeline) before spreading the remainder onto the DOM.
  const {
    'data-obj-id': dataObjId,
    'data-obj-type': dataObjType,
    style,
    // PageSchema descriptors — UI metadata, not DOM attributes
    pageType: _pageTypeProp,
    schema: _schemaProp,
    regions: _regionsProp,
    template: _templateProp,
    title: _titleProp,
    icon: _iconProp,
    description: _descriptionProp,
    object: _objectProp,
    variables: _variablesProp,
    body: _bodyProp,
    isDefault: _isDefaultProp,
    assignedProfiles: _assignedProfilesProp,
    aria: _ariaProp,
    recordOverride: _recordOverrideProp,
    permissions: _permissionsProp,
    requiredPermissions: _requiredPermissionsProp,
    enforceFieldSecurity: _enforceFLSProp,
    redactFields: _redactFieldsProp,
    children: _childrenProp,
    ...rawPageProps
  } = props;
  // Drop any `_`-prefixed keys (e.g. `_packageId`, `_synth`) — these are
  // internal metadata that React would warn about if forwarded to the DOM.
  const pageProps = Object.fromEntries(
    Object.entries(rawPageProps).filter(([k]) => !k.startsWith('_')),
  );

  // Select the layout variant based on template or page type
  const layoutElement = useMemo(() => {
    // `PageSchema['kind']` now spells the source-authored values too, matching
    // @objectstack/spec — no cast needed to read what the renderer dispatches on.
    const kind = schema.kind;
    // `kind:'react'` — TRUSTED execution tier: real React, run (not parsed) by
    // @object-ui/react-runtime, gated behind the host CAP_REACT_PAGES flag.
    if (kind === 'react') {
      return <ReactKindPage schema={schema} />;
    }
    // `kind:'html'` (formerly 'jsx') — author-written constrained JSX/HTML+Tailwind
    // compiled (parsed, never executed) to a SchemaNode tree and rendered. The
    // legacy 'jsx' value is still accepted as a deprecated alias.
    if (kind === 'html' || kind === 'jsx') {
      const src = (schema as { source?: string }).source ?? '';
      const { tree, diagnostics } = compile(src, getJsxManifest());
      const errors = diagnostics.filter((d) => d.severity === 'error');
      if (errors.length) {
        return (
          <div className="m-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="font-semibold">HTML page failed to compile ({errors.length})</div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {errors.slice(0, 8).map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          </div>
        );
      }
      return tree ? <SchemaRenderer schema={tree as unknown as BaseSchema} /> : null;
    }
    const TemplateLayout = resolveTemplate(schema);
    if (TemplateLayout) {
      // Template takes priority over page type
      // eslint-disable-next-line react-hooks/static-components -- TemplateLayout is resolved from a stable template registry
      return <TemplateLayout schema={schema} />;
    }
    switch (pageType) {
      case 'home':
        return <HomePageLayout schema={schema} />;
      case 'app':
        return <AppPageLayout schema={schema} />;
      case 'utility':
        return <UtilityPageLayout schema={schema} />;
      case 'record':
      default:
        return <RecordPageLayout schema={schema} />;
    }
    // `registryTick` only matters to the kind:'html' branch above, which
    // recompiles against the (now larger) whitelist. Every other branch just
    // rebuilds the same element type with the same props, which React
    // reconciles in place — no remount, no state loss (pinned by
    // react-page-state.test.tsx).
  }, [schema, pageType, registryTick]);

  // Full-bleed: a page whose `main` region is declared `width: 'full'` fills
  // the viewport with NO centered max-width cap — for dashboards / 大屏 /
  // kiosk screens that should use the whole width. Falls back to the
  // page-type max-width otherwise.
  const fullBleed = (schema.regions ?? []).some(
    (r) => r.name?.toLowerCase() === 'main' && (r.width as string) === 'full',
  );
  const maxWidthClass = fullBleed ? 'max-w-none' : getPageMaxWidth(pageType);

  // Who renders the page's single `<h1>` (objectui#3434). Record pages always
  // delegate to `page:header`; every other page type delegates too as soon as
  // the author put a titled `page:header` in a region.
  const headerOwnsTitle = React.useMemo(
    () => pageType === 'record' || pageHeaderOwnsTitle(schema),
    [schema, pageType],
  );
  const showPageTitle = !!pageTitle && !headerOwnsTitle;
  // The description is the page's own prose, not a duplicate of the header's
  // `subtitle`, so delegating the heading does not delete it.
  const showPageDescription = !!schema.description && pageType !== 'record';

  const pageContent = (
    <div
      className={cn(
        'min-h-full w-full bg-background p-3 md:p-4 lg:p-6',
        className,
      )}
      data-page-type={pageType}
      data-obj-id={dataObjId}
      data-obj-type={dataObjType}
      style={style}
      {...pageProps}
    >
      <div className={cn(fullBleed ? 'space-y-6' : 'mx-auto space-y-6', maxWidthClass)}>
        {/* Implicit page title — the fallback heading for a page that does NOT
            author its own `page:header`. Suppressed whenever that component
            owns the h1 (always on record pages, and on any page carrying a
            titled `page:header`), so the document never has two `h1`.
            `title` is the objectui spelling; the spec's PageNodeSchema declares
            `label` (required), so dual-read it — mirrors the fallback
            DashboardRenderer already uses (framework#1878 §3 recheck). */}
        {(showPageTitle || showPageDescription) && (
          <div className="space-y-2">
            {showPageTitle && (
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {pageTitle}
              </h1>
            )}
            {showPageDescription && (
              <p className="text-muted-foreground">{schema.description}</p>
            )}
          </div>
        )}

        {/* Page body — type-specific layout */}
        {layoutElement}
      </div>
    </div>
  );

  // Wrap with PageVariablesProvider when variables are defined
  if (schema.variables && schema.variables.length > 0) {
    return (
      <PageVariablesProvider definitions={schema.variables}>
        {/* Publish the live page-variable snapshot into the action runtime so a
            submit button can post `{{page.<var>}}` values (SDUI form data-entry). */}
        <PageVariableActionBridge />
        {pageContent}
      </PageVariablesProvider>
    );
  }

  return pageContent;
};

// ---------------------------------------------------------------------------
// ComponentRegistry registration
// ---------------------------------------------------------------------------

const pageMeta: any = {
  namespace: 'ui',
  label: 'Page',
  icon: 'Layout',
  category: 'layout',
  inputs: [
    { name: 'title', type: 'string', label: 'Title' },
    { name: 'description', type: 'string', label: 'Description' },
    { name: 'pageType', type: 'string', label: 'Page Type' },
    { name: 'object', type: 'string', label: 'Object Name' },
    { name: 'template', type: 'string', label: 'Template' },
    {
      name: 'regions',
      type: 'array',
      label: 'Regions',
      itemType: 'object',
    },
    {
      name: 'variables',
      type: 'array',
      label: 'Variables',
      itemType: 'object',
    },
    {
      name: 'body',
      type: 'array',
      label: 'Content (Legacy)',
      itemType: 'component',
    },
  ],
};

ComponentRegistry.register('page', PageRenderer, pageMeta);
ComponentRegistry.register('app', PageRenderer, { ...pageMeta, label: 'App Page' });
ComponentRegistry.register('utility', PageRenderer, { ...pageMeta, label: 'Utility Page' });
ComponentRegistry.register('home', PageRenderer, { ...pageMeta, label: 'Home Page' });
ComponentRegistry.register('record', PageRenderer, { ...pageMeta, label: 'Record Page' });

