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
// Template layouts — predefined layout templates
// ---------------------------------------------------------------------------

/** Template: full-width single column */
const FullWidthTemplate: React.FC<{ schema: PageSchema }> = ({ schema }) => {
  if (schema.regions && schema.regions.length > 0) {
    return <RegionLayout regions={schema.regions} pageType={schema.pageType} />;
  }
  return <FlatContent schema={schema} />;
};

/** Template: header-sidebar-main — header spanning full width, sidebar + main below */
const HeaderSidebarMainTemplate: React.FC<{ schema: PageSchema }> = ({ schema }) => {
  const regions = schema.regions || [];
  if (regions.length === 0) return <FlatContent schema={schema} />;

  const header = findRegion(regions, 'header');
  const sidebar = findRegion(regions, 'sidebar');
  const main = findRegion(regions, 'main');
  const extras = getRemainingRegions(regions, ['header', 'sidebar', 'main']);

  return (
    <div className="flex flex-col gap-6" data-template="header-sidebar-main">
      {header && <RegionContent region={header} />}
      <div className="flex flex-1 gap-6">
        {sidebar && (
          <aside className={cn('shrink-0', getRegionWidthClass(sidebar.width as string || 'medium'))}>
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
const ThreeColumnTemplate: React.FC<{ schema: PageSchema }> = ({ schema }) => {
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
      {footer && <RegionContent region={footer} />}
    </div>
  );
};

/** Template: dashboard — 2x2 grid of regions */
const DashboardTemplate: React.FC<{ schema: PageSchema }> = ({ schema }) => {
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
const TEMPLATE_REGISTRY: Record<string, React.FC<{ schema: PageSchema }>> = {
  'default': FullWidthTemplate,
  'full-width': FullWidthTemplate,
  'header-sidebar-main': HeaderSidebarMainTemplate,
  'three-column': ThreeColumnTemplate,
  'dashboard': DashboardTemplate,
};

/** Resolve template: if the schema specifies a template name, use the matching layout */
function resolveTemplate(schema: PageSchema): React.FC<{ schema: PageSchema }> | null {
  if (!schema.template) return null;
  return TEMPLATE_REGISTRY[schema.template] || null;
}

// ---------------------------------------------------------------------------
// Page type variant layouts
// ---------------------------------------------------------------------------

/** Record page — detail-oriented, narrower max-width */
const RecordPageLayout: React.FC<{ schema: PageSchema }> = ({ schema }) => {
  if (schema.regions && schema.regions.length > 0) {
    return <RegionLayout regions={schema.regions} pageType="record" />;
  }
  return <FlatContent schema={schema} />;
};

/** Home page — dashboard-style, wider layout */
const HomePageLayout: React.FC<{ schema: PageSchema }> = ({ schema }) => {
  if (schema.regions && schema.regions.length > 0) {
    return <RegionLayout regions={schema.regions} pageType="home" />;
  }
  return <FlatContent schema={schema} />;
};

/** App page — application shell, full-width capable */
const AppPageLayout: React.FC<{ schema: PageSchema }> = ({ schema }) => {
  if (schema.regions && schema.regions.length > 0) {
    return <RegionLayout regions={schema.regions} pageType="app" />;
  }
  return <FlatContent schema={schema} />;
};

/** Utility page — compact, focused, narrower */
const UtilityPageLayout: React.FC<{ schema: PageSchema }> = ({ schema }) => {
  if (schema.regions && schema.regions.length > 0) {
    return <RegionLayout regions={schema.regions} pageType="utility" />;
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

  // Extract designer-related props
  const {
    'data-obj-id': dataObjId,
    'data-obj-type': dataObjType,
    style,
    ...pageProps
  } = props;

  // Select the layout variant based on template or page type
  const TemplateLayout = resolveTemplate(schema);
  let LayoutVariant: React.FC<{ schema: PageSchema }>;

  if (TemplateLayout) {
    // Template takes priority over page type
    LayoutVariant = TemplateLayout;
  } else {
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
      <PageVariablesProvider definitions={schema.variables}>
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

