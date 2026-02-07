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

import React from 'react';
import type { PageSchema, PageRegion, SchemaNode } from '@object-ui/types';
import { SchemaRenderer, PageVariablesProvider } from '@object-ui/react';
import { ComponentRegistry } from '@object-ui/core';
import { cn } from '../../lib/utils';

// ---------------------------------------------------------------------------
// Page Object Context — provides record data to child components
// ---------------------------------------------------------------------------

const PageObjectContext = React.createContext<{
  objectName: string | undefined;
  recordData: Record<string, any> | null;
  loading: boolean;
  error: string | null;
}>({
  objectName: undefined,
  recordData: null,
  loading: false,
  error: null,
});

/**
 * Hook to access the page object data from any child component.
 */
export function usePageObject() {
  return React.useContext(PageObjectContext);
}

// ---------------------------------------------------------------------------
// Page Templates — predefined layout structures
// ---------------------------------------------------------------------------

/**
 * Template registry: maps template names to region configurations.
 * Templates define default region structures when no explicit regions are provided.
 */
const PAGE_TEMPLATES: Record<string, (schema: PageSchema) => PageRegion[]> = {
  /**
   * Default template: just renders body/children as a single main region
   */
  default: (schema) => {
    const content = schema.body || schema.children;
    const nodes: SchemaNode[] = Array.isArray(content) ? content : content ? [content as SchemaNode] : [];
    return [{ name: 'main', type: 'main', components: nodes }];
  },

  /**
   * Header + Main content template
   */
  'header-main': (schema) => {
    const content = schema.body || schema.children;
    const nodes: SchemaNode[] = Array.isArray(content) ? content : content ? [content as SchemaNode] : [];
    const regions: PageRegion[] = [];
    if (schema.title || schema.description) {
      regions.push({
        name: 'header',
        type: 'header',
        width: 'full',
        components: [{
          type: 'page-header',
          title: schema.title,
          description: schema.description,
        } as any],
      });
    }
    regions.push({ name: 'main', type: 'main', components: nodes });
    return regions;
  },

  /**
   * Header + Sidebar + Main template
   */
  'header-sidebar-main': (schema) => {
    const content = schema.body || schema.children;
    const nodes: SchemaNode[] = Array.isArray(content) ? content : content ? [content as SchemaNode] : [];
    // Split: first child goes to sidebar, rest to main
    const sidebarContent = nodes.length > 0 ? [nodes[0]] : [];
    const mainContent = nodes.length > 1 ? nodes.slice(1) : [];
    return [
      ...(schema.title ? [{
        name: 'header',
        type: 'header' as const,
        width: 'full' as const,
        components: [{
          type: 'page-header',
          title: schema.title,
          description: schema.description,
        } as any],
      }] : []),
      { name: 'sidebar', type: 'sidebar' as const, width: 'small' as const, components: sidebarContent },
      { name: 'main', type: 'main' as const, components: mainContent },
    ];
  },

  /**
   * Sidebar + Main + Aside (three-column) template
   */
  'sidebar-main-aside': (schema) => {
    const content = schema.body || schema.children;
    const nodes: SchemaNode[] = Array.isArray(content) ? content : content ? [content as SchemaNode] : [];
    const sidebarContent = nodes.length > 0 ? [nodes[0]] : [];
    const asideContent = nodes.length > 2 ? [nodes[nodes.length - 1]] : [];
    const mainContent = nodes.length > 1 ? nodes.slice(1, asideContent.length ? -1 : undefined) : [];
    return [
      { name: 'sidebar', type: 'sidebar' as const, width: 'small' as const, components: sidebarContent },
      { name: 'main', type: 'main' as const, components: mainContent },
      { name: 'aside', type: 'aside' as const, width: 'small' as const, components: asideContent },
    ];
  },

  /**
   * Full-width stacked template (for dashboards/home pages)
   */
  'full-width': (schema) => {
    const content = schema.body || schema.children;
    const nodes: SchemaNode[] = Array.isArray(content) ? content : content ? [content as SchemaNode] : [];
    return [{ name: 'main', type: 'main', width: 'full', components: nodes }];
  },
};

/**
 * Resolve a template name to regions.
 * Returns null if explicit regions are provided or template is not found.
 */
function resolveTemplate(schema: PageSchema): PageRegion[] | null {
  // Explicit regions always take precedence over templates
  if (schema.regions && schema.regions.length > 0) {
    return null;
  }

  const templateName = schema.template || 'default';
  const templateFn = PAGE_TEMPLATES[templateName];
  if (!templateFn) {
    return null;
  }

  return templateFn(schema);
}

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
function findRegion(regions: PageRegion[] | undefined, name: string): PageRegion | undefined {
  return regions?.find((r) => r.name?.toLowerCase() === name.toLowerCase());
}

/** Get all regions that are NOT in the named set */
function getRemainingRegions(regions: PageRegion[] | undefined, exclude: string[]): PageRegion[] {
  if (!regions) return [];
  const lowerSet = new Set(exclude.map((n) => n.toLowerCase()));
  return regions.filter((r) => !lowerSet.has(r.name?.toLowerCase() ?? ''));
}

// ---------------------------------------------------------------------------
// RegionContent — renders all components inside a single region
// ---------------------------------------------------------------------------

const RegionContent: React.FC<{
  region: PageRegion;
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
        <SchemaRenderer key={(node as any)?.id || `${region.name}-${idx}`} schema={node} />
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// RegionLayout — structured layout with named slots
// ---------------------------------------------------------------------------

const RegionLayout: React.FC<{
  regions: PageRegion[];
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
      <div className="flex flex-1 gap-6">
        {sidebar && (
          <aside className={cn('shrink-0', getRegionWidthClass(sidebar.width as string || 'small'))}>
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
          <aside className={cn('shrink-0', getRegionWidthClass(aside.width as string || 'small'))}>
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

const FlatContent: React.FC<{ schema: PageSchema }> = ({ schema }) => {
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
// Page type variant layouts
// ---------------------------------------------------------------------------

/** Record page — detail-oriented, narrower max-width */
const RecordPageLayout: React.FC<{ schema: PageSchema }> = ({ schema }) => {
  const regions = schema.regions?.length ? schema.regions : resolveTemplate(schema);
  if (regions && regions.length > 0) {
    return <RegionLayout regions={regions} pageType="record" />;
  }
  return <FlatContent schema={schema} />;
};

/** Home page — dashboard-style, wider layout */
const HomePageLayout: React.FC<{ schema: PageSchema }> = ({ schema }) => {
  const regions = schema.regions?.length ? schema.regions : resolveTemplate(schema);
  if (regions && regions.length > 0) {
    return <RegionLayout regions={regions} pageType="home" />;
  }
  return <FlatContent schema={schema} />;
};

/** App page — application shell, full-width capable */
const AppPageLayout: React.FC<{ schema: PageSchema }> = ({ schema }) => {
  const regions = schema.regions?.length ? schema.regions : resolveTemplate(schema);
  if (regions && regions.length > 0) {
    return <RegionLayout regions={regions} pageType="app" />;
  }
  return <FlatContent schema={schema} />;
};

/** Utility page — compact, focused, narrower */
const UtilityPageLayout: React.FC<{ schema: PageSchema }> = ({ schema }) => {
  const regions = schema.regions?.length ? schema.regions : resolveTemplate(schema);
  if (regions && regions.length > 0) {
    return <RegionLayout regions={regions} pageType="utility" />;
  }
  return <FlatContent schema={schema} />;
};

// ---------------------------------------------------------------------------
// Main PageRenderer
// ---------------------------------------------------------------------------

export const PageRenderer: React.FC<{
  schema: PageSchema;
  className?: string;
  [key: string]: any;
}> = ({ schema, className, ...props }) => {
  const pageType = schema.pageType || 'record';

  // Page.object data binding state
  const [recordData, setRecordData] = React.useState<Record<string, any> | null>(null);
  const [objectLoading, setObjectLoading] = React.useState(false);
  const [objectError, setObjectError] = React.useState<string | null>(null);

  // If schema.object is set, provide it via context for child components
  // The actual data fetching is triggered by consumers via a DataSource passed in props
  const dataSource = props.dataSource;
  const recordId = props.recordId;

  React.useEffect(() => {
    if (!schema.object || !dataSource || !recordId) return;

    let cancelled = false;
    setObjectLoading(true);
    setObjectError(null);

    (async () => {
      try {
        const data = await dataSource.findOne(schema.object!, recordId);
        if (!cancelled) {
          setRecordData(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setObjectError(err?.message || 'Failed to load record data');
        }
      } finally {
        if (!cancelled) {
          setObjectLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [schema.object, dataSource, recordId]);

  // Extract designer-related props
  const {
    'data-obj-id': dataObjId,
    'data-obj-type': dataObjType,
    style,
    dataSource: _ds,
    recordId: _rid,
    ...pageProps
  } = props;

  // Select the layout variant based on page type
  let LayoutVariant: React.FC<{ schema: PageSchema }>;
  switch (pageType) {
    case 'home':
      LayoutVariant = HomePageLayout;
      break;
    case 'app':
      LayoutVariant = AppPageLayout;
      break;
    case 'utility':
      LayoutVariant = UtilityPageLayout;
      break;
    case 'record':
    default:
      LayoutVariant = RecordPageLayout;
      break;
  }

  const pageContent = (
    <div
      className={cn(
        'min-h-full w-full bg-background p-4 md:p-6 lg:p-8',
        className,
      )}
      data-page-type={pageType}
      data-obj-id={dataObjId}
      data-obj-type={dataObjType}
      style={style}
      {...pageProps}
    >
      <div className={cn('mx-auto space-y-8', getPageMaxWidth(pageType))}>
        {/* Page header */}
        {(schema.title || schema.description) && (
          <div className="space-y-2">
            {schema.title && (
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {schema.title}
              </h1>
            )}
            {schema.description && (
              <p className="text-muted-foreground">{schema.description}</p>
            )}
          </div>
        )}

        {/* Page body — type-specific layout */}
        <LayoutVariant schema={schema} />
      </div>
    </div>
  );

  // Wrap with PageVariablesProvider when variables are defined
  if (schema.variables && schema.variables.length > 0) {
    return (
      <PageObjectContext.Provider value={{ objectName: schema.object, recordData, loading: objectLoading, error: objectError }}>
        <PageVariablesProvider definitions={schema.variables}>
          {pageContent}
        </PageVariablesProvider>
      </PageObjectContext.Provider>
    );
  }

  // Wrap with object context when schema.object is defined
  if (schema.object) {
    return (
      <PageObjectContext.Provider value={{ objectName: schema.object, recordData, loading: objectLoading, error: objectError }}>
        {pageContent}
      </PageObjectContext.Provider>
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

